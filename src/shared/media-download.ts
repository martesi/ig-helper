import $ from 'jquery';
import { USER_SETTING, state } from "../settings/state";
import { getPostOwner, getMediaInfo } from "./api";
import { getImageFromCache } from "../features/media/image-cache";
import { _i18n } from "./i18n";
import { logger } from "./logger";
import { saveFiles, type SaveMetadata } from "./download";
import { tryHandleDashFromMediaItem } from "./dash";
import { openNewTab, replaceSameOriginHost } from "./navigation";
import { updateLoadingBar } from "./ui/status.tsx";
import { Effect } from 'effect';

export function openOrSaveMedia(url: string, metadata: SaveMetadata, isPreview: boolean): void | Promise<boolean> {
    return isPreview ? openNewTab(url) : saveFiles(url, metadata);
}

export function saveMediaThumbnail($element: JQuery<Element> | Element, fallbackPostPath: string | null = null) {
    const $link = $($element);
    let timestamp = Date.now();
    if (USER_SETTING.RENAME_PUBLISH_DATE && $link.attr('datetime')) {
        timestamp = Number($link.attr('datetime')) || timestamp;
    }

    const mediaId = $link.attr('media-id');
    const cached = USER_SETTING.CAPTURE_IMAGE_VIA_MEDIA_CACHE && mediaId ? getImageFromCache(mediaId) : null;
    const source = cached ?? $link.find('img').first().attr('src');
    if (!source) return Promise.resolve(false);

    if (cached) logger('[Restore Cached postThumbnail]', mediaId);

    return saveFiles(source, {
        username: $link.data('username'),
        sourceType: 'thumbnail',
        timestamp,
        filetype: 'jpg',
        shortcode: $link.data('path') ?? fallbackPostPath,
    });
}

function getInstagramImageScale(url: string): number {
    if (!URL.canParse(url)) return 0;
    const stp = new URL(url).searchParams.get('stp') || '';
    const match = stp.match(/_[sp](\d+)x(\d+)(?:_|$)/);
    return match ? Math.max(Number(match[1]), Number(match[2])) : Infinity;
}


/**
 * triggerLinkElement
 * @description Trigger the link element to start downloading or previewing the resource.
 *
 * @param  {Object}   element     - The element containing resource link metadata.
 * @param  {Boolean}  [isPreview] - True to preview in a new tab instead of downloading.
 * @return {Promise<void>}
 */
export function triggerLinkElement($element: JQuery<Element> | Element, isPreview = false): Promise<void> {
    const program = Effect.gen(function* () {
        const $el = $($element);

        const date = new Date().getTime();
        let timestamp = Math.floor(date / 1000);
        let username = String($el.data('username') || state.GL_username || '');
        const index = parseInt($el.attr('data-globalindex') || '0', 10) || 0;

        if (!username && $el.data('path')) {
            logger('catching owner name from shortcode', $el.data('href'));
            username = yield* Effect.tryPromise({
                try: () => getPostOwner(String($el.data('path'))),
                catch: cause => cause,
            }).pipe(Effect.catchCause(cause => Effect.sync(() => {
                logger('get username failed, replace with default string, error message', cause);
                return 'NONE';
            })));
        }

        if (username == null) username = 'NONE';

        if (USER_SETTING.RENAME_PUBLISH_DATE && $el.attr('datetime')) {
            timestamp = parseInt($el.attr('datetime') ?? '', 10) || timestamp;
        }

        const mediaId = $el.attr('media-id') || $el.attr('data-media-id') || null;
        const sourceType = String($el.data('name') || 'post');
        const filetype = String($el.data('type') || 'jpg');
        const shortcode = String($el.data('path') || '');
        const href = String($el.data('href') || '');

        const downloadOnly = !isPreview;

        if (!isPreview && index < 0) {
            alert(_i18n('NO_CHECK_RESOURCE'));
            return;
        }

        if (USER_SETTING.PREFER_DASH_MANIFEST && mediaId && state.GL_mediaDataCache[mediaId]) {
            logger('Video Dash Stream, Processing video with DASH manifest', 'mediaId', mediaId);

            const handled = yield* Effect.tryPromise({
                try: () => tryHandleDashFromMediaItem({
                    mediaItem: state.GL_mediaDataCache[mediaId],
                    username,
                    sourceType,
                    timestamp,
                    shortcode,
                    isPreview: downloadOnly ? false : isPreview,
                    index,
                }),
                catch: cause => cause,
            });

            if (handled) return;
        }

        if (USER_SETTING.CAPTURE_IMAGE_VIA_MEDIA_CACHE) {
            const cached = mediaId ? getImageFromCache(mediaId) : null;

            if (cached && filetype !== 'mp4') {
                if (!downloadOnly && isPreview) {
                    openNewTab(cached);
                } else {
                    yield* Effect.tryPromise({
                        try: () => saveFiles(cached, {
                            username,
                            sourceType,
                            timestamp,
                            filetype: filetype || 'jpg',
                            shortcode,
                            index,
                        }),
                        catch: cause => cause,
                    });
                }
                return;
            }
        }

        if (USER_SETTING.FORCE_RESOURCE_VIA_MEDIA && mediaId) {
            updateLoadingBar(true);
            const result = yield* Effect.tryPromise({
                try: () => getMediaInfo(mediaId),
                catch: cause => cause,
            }).pipe(Effect.ensuring(Effect.sync(() => updateLoadingBar(false))));

            if (result?.status === 'ok') {
                let resource_url = null;
                // OPTIMIZATION: cache result.items[0]
                const mediaItem = result.items?.[0];

                if (mediaItem?.video_versions?.length) {
                    resource_url = mediaItem.video_versions[0].url;
                } else if (mediaItem?.image_versions2?.candidates?.length) {
                    mediaItem.image_versions2.candidates.sort(function (a, b) {
                        const aSTP = new URL(a.url).searchParams.get('stp');
                        const bSTP = new URL(b.url).searchParams.get('stp');

                        if (aSTP && bSTP) {
                            if (aSTP.length > bSTP.length) return 1;
                            if (aSTP.length < bSTP.length) return -1;
                        } else {
                            if ((a.width || 0) > (b.width || 0)) return 1;
                            if ((a.width || 0) < (b.width || 0)) return -1;
                        }

                        return 0;
                    });

                    resource_url = mediaItem.image_versions2.candidates[0].url;
                }

                if (!resource_url) {
                    alert('Cannot find download URL.');
                    return;
                }

                if (
                    href &&
                    filetype !== 'mp4' &&
                    getInstagramImageScale(href) > getInstagramImageScale(resource_url)
                ) {
                    resource_url = href;
                }

                if (!downloadOnly && isPreview) {
                    openNewTab(replaceSameOriginHost(resource_url));
                } else {
                    yield* Effect.tryPromise({
                        try: () => saveFiles(resource_url, {
                            username,
                            sourceType,
                            timestamp,
                            filetype,
                            shortcode,
                            index,
                        }),
                        catch: cause => cause,
                    });
                }
                return;
            }

            if (USER_SETTING.FALLBACK_TO_BLOB_FETCH_IF_MEDIA_API_THROTTLED && href) {
                if (!downloadOnly && isPreview) {
                    openNewTab(replaceSameOriginHost(href));
                } else {
                    yield* Effect.tryPromise({
                        try: () => saveFiles(href, {
                            username,
                            sourceType,
                            timestamp,
                            filetype,
                            shortcode,
                            index,
                        }),
                        catch: cause => cause,
                    });
                }
                return;
            }

            alert(`Fetch failed from Media API. API response message: ${result?.message}`);
            logger('triggerLinkElement()', 'Media API rejected request', result?.message);
            return;
        }

        if (href) {
            if (!downloadOnly && isPreview) {
                openNewTab(replaceSameOriginHost(href));
            } else {
                yield* Effect.tryPromise({
                    try: () => saveFiles(href, {
                        username,
                        sourceType,
                        timestamp,
                        filetype,
                        shortcode,
                        index,
                    }),
                    catch: cause => cause,
                });
            }
            return;
        }

        alert('Cannot find download URL.');
    }).pipe(Effect.catchCause(cause => Effect.sync(() => {
        logger('triggerLinkElement()', 'failed', cause);
    })));
    return Effect.runPromise(program);
}
