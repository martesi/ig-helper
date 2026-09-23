import $ from 'jquery';
import { DIRECT_DOWNLOAD_MODE_OPTIONS, USER_SETTING, state } from "../settings/state";
import { appendMediaResource } from "../shared/ui/media-resource.tsx";
import { saveFiles } from "../shared/download";
import { getStoryProgress, getStoryId } from "../shared/story";
import { openNewTab } from "../shared/navigation";
import { tryHandleDashFromMediaItem } from "../shared/dash";
import { updateLoadingBar } from "../shared/ui/status.tsx";
import { logger } from "../shared/logger";
import { getUserId, getStories, getMediaInfo } from "../shared/api";
import { _i18n } from "../shared/i18n";
import { getImageFromCache } from "./media/image-cache";
import { batchDownloadPostFiles } from './post/post.ts';
import { mountMediaControls } from './post/controls.tsx';
import { openResourcePicker } from '../shared/ui/resource-picker.tsx';
import type { StoryResponse } from '../shared/instagram-data.ts';

/**
 * createStoryResourceElements
 * @description Build the same media-resource elements used by post downloads.
 *
 * @return {void}
 */
export function createStoryResourceElements(obj: StoryResponse, type: string): HTMLAnchorElement[] {
    const root = document.createElement('div');
    const reel = obj.data.reels_media[0];
    const username = reel?.user?.username || reel?.owner?.username;

    reel.items.forEach((item, idx) => {
        const timestamp = USER_SETTING.RENAME_PUBLISH_DATE
            ? item.taken_at_timestamp
            : Math.floor(Date.now() / 1000);
        const displayResources = [...item.display_resources].sort((a, b) => b.config_width - a.config_width);
        const preview = displayResources[0]?.src;
        const resource = item.is_video
            ? { type: 'mp4', href: item.video_resources[0]?.src, labelKey: 'VID' }
            : { type: 'jpg', href: preview, labelKey: 'IMG' };

        if (!resource.href || !preview) return;

        appendMediaResource(root, {
            mediaId: item.id,
            datetime: timestamp,
            blob: true,
            name: type,
            type: resource.type,
            username,
            path: item.id,
            index: idx + 1,
            displayIndex: idx + 1,
            href: resource.href,
            preview,
            labelKey: resource.labelKey,
            label: _i18n(resource.labelKey),
        });
    });

    return Array.from(root.querySelectorAll('a[data-needed="direct"]'));
}

/**
 * onStoryAll
 * @description Trigger user's story all download event.
 *
 * @return {void}
 */
export async function onStoryAll() {
    updateLoadingBar(true);
    try {
        const username = $("body > div section._ac0a header._ac0k ._ac0l a + div a").first().text()
            || location.pathname.split("/").filter(Boolean).at(1) || '';
        const userInfo = await getUserId(username);
        const stories = await getStories(userInfo.user.pk);
        await downloadStoryResources(stories, 'stories', `Story · ${username}`);
    }
    finally {
        updateLoadingBar(false);
    }
}

export async function downloadStoryResources(data: StoryResponse, type: string, title: string): Promise<void> {
    const elements = createStoryResourceElements(data, type);
    if (USER_SETTING.DIRECT_DOWNLOAD_MODE === DIRECT_DOWNLOAD_MODE_OPTIONS.ASK) {
        openStoryResourcePicker(title, elements);
        return;
    }
    await batchDownloadPostFiles(elements);
}

function openStoryResourcePicker(title: string, elements: HTMLAnchorElement[]) {
    const resources = elements.map(element => ({
        mediaId: element.getAttribute('media-id'),
        preview: element.dataset.preview ?? element.dataset.href,
        label: _i18n(element.dataset.type === 'mp4' ? 'VID' : 'IMG'),
        element,
    }));

    openResourcePicker({
        title,
        resources,
        onDownload: selected => batchDownloadPostFiles(selected.map(resource => resource.element)),
    });
}

export function onStoryDownload() {
    if (USER_SETTING.DIRECT_DOWNLOAD_MODE === DIRECT_DOWNLOAD_MODE_OPTIONS.VISIBLE) {
        return onStory(true);
    }
    return onStoryAll();
}

function findStoryControlElement() {
    let actionRow = findStoryActionRow();
    while (actionRow && actionRow !== document.body) {
        if (Array.from(actionRow.querySelectorAll('video, img')).some(element => element.getClientRects().length > 0)) {
            return $(actionRow);
        }
        actionRow = actionRow.parentElement;
    }

    let $element = $('body > div section:visible._ac0a');

    if ($element.length === 0) {
        $element = $('body > div section:visible > div > div[style]:not([class])');
    }
    if ($element.length === 0) {
        $element = $('div[id^="mount"] section > div > a[href="/"]').parent().parent().parent().find('section:visible > div > div[style]:not([class])');
    }
    if ($element.length === 0) {
        $element = $('div[id^="mount"] section > div > a[href="/"]').parent().parent().parent().find('section:visible > div div[style]:not([class]) > div:not([data-visualcompletion="loading-state"])');
    }
    if ($element.length === 0) {
        $element = $('div[id^="mount"] section > div a[href="/"]').parents('section:visible').find('div[style]:not([class])');
    }
    if ($element.length === 0) {
        let widest = 0;
        $('body > div div:not([hidden]) section:visible > div div[class][style] > div[style]:not([class])').each(function () {
            const $candidate = $(this);
            if (($candidate.width() ?? 0) > widest) {
                widest = $candidate.width() ?? 0;
                $element = $candidate.children('div').first();
            }
        });
    }

    return $element.first();
}

function findStoryActionRow() {
    const likeIcon = Array.from(document.querySelectorAll('svg[aria-label="Like"]'))
        .find(element => element.getBoundingClientRect().width > 0);
    if (!likeIcon) return null;

    let row = likeIcon.parentElement;
    while (row && !row.querySelector('svg[aria-label="Direct"]')) row = row.parentElement;
    return row;
}

function mountStoryControlBar(username: string, mediaType: 'video' | 'image') {
    const parent = findStoryActionRow();
    if (!parent) return null;

    let host = Array.from(parent.children).find((element): element is HTMLElement => element instanceof HTMLElement && element.classList.contains('IG_STORY_CONTROL_BAR'));
    if (!host) {
        host = document.createElement('span');
        host.className = 'IG_STORY_CONTROL_BAR';
        host.style.display = 'contents';
        parent.append(host);
    }
    const likeIcon = parent.querySelector('svg[aria-label="Like"]');
    if (likeIcon) host.style.color = getComputedStyle(likeIcon).color;

    const $header = getStoryProgress(username);
    mountMediaControls(host, {
        showDownloadAll: $header.length > 1 && USER_SETTING.DIRECT_DOWNLOAD_MODE === DIRECT_DOWNLOAD_MODE_OPTIONS.VISIBLE,
        showMediaPreview: false,
        showCopy: false,
        mediaType,
        actions: {
            thumbnail: () => onStoryThumbnail(true),
            newTab: () => onStory(true, true, true),
            downloadAll: () => onStoryAll(),
            download: () => onStoryDownload(),
        },
    });
    return host;
}

/**
 * resolveStoryMediaIdByTimestamp
 * @description Identifies the currently visible story by comparing the
 *              <time datetime> element in the viewer with taken_at_timestamp
 *              from the API items array. More reliable than index-based DOM
 *              mapping because it does not depend on CSS class names or
 *              progress-bar structure.
 *
 * @param  {Object}  stories  - Full getStories() / getHighlightStories() response
 * @return {?String}          - Best-matching item id, or null if undetermined
 */
export function resolveStoryMediaIdByTimestamp(stories: StoryResponse): string | null {
    const items = stories?.data?.reels_media?.[0]?.items;
    if (!items || items.length === 0) return null;

    // Reuse the same multi-layout time-element selection that the rest of the
    // script already relies on; exclude highlight-nav links and role="button"
    // to avoid picking up unrelated timestamps.
    const $time = $(
        'body > div section:visible time[datetime]'
    ).filter(function () {
        const $this = $(this);
        return (
            $this.is(':visible') &&
            $this.closest('a[href^="/stories/highlights/"]').length === 0 &&
            $this.closest('[role="button"]').length === 0
        );
    }).first();

    if ($time.length === 0) return null;

    const visibleTs = Math.floor(new Date($time.attr('datetime') ?? '').getTime() / 1000);
    if (!Number.isFinite(visibleTs) || visibleTs === 0) return null;

    let bestId = null;
    let minDiff = Infinity;

    items.forEach(item => {
        const diff = Math.abs((item.taken_at_timestamp || 0) - visibleTs);
        if (diff < minDiff) {
            minDiff = diff;
            bestId = item.id;
        }
    });

    logger('[resolveStoryMediaIdByTimestamp]', 'best match:', bestId, 'diff(s):', minDiff);
    return bestId;  // always return best match — better than any index heuristic
}

/**
 * onStory
 * @description Trigger user's story download event or button display event.
 *
 * @param  {Boolean}  isDownload - Check if it is a download operation
 * @param  {Boolean}  isForce - Check if downloading directly from API instead of cache
 * @param  {Boolean}  isPreview - Check if it is need to open new tab
 * @return {void}
 */
export async function onStory(isDownload = false, isForce = false, isPreview = false) {
    const username = $("body > div section._ac0a header._ac0k ._ac0l a + div a").first().text() || location.pathname.split("/").filter(s => s.length > 0).at(1) || '';
    if (isDownload) {
        const date = new Date().getTime();
        let timestamp = Math.floor(date / 1000);

        updateLoadingBar(true);
        if (USER_SETTING.FORCE_RESOURCE_VIA_MEDIA && !state.tempFetchRateLimit) {
            let mediaId: string | null = null;

            const userInfo = await getUserId(username);
            const userId = userInfo.user.pk;
            const stories = await getStories(userId);
            const urlID = location.pathname.split('/').filter(s => s.length > 0 && s.match(/^([0-9]{10,})$/)).at(-1);

            // OPTIMIZATION: cache items reference (used 4+ times)
            const items = stories.data.reels_media[0].items;

            items.forEach(item => {
                if (item.id == urlID) {
                    mediaId = item.id;
                }
            });
			
            // FIX: timestamp-based match before fragile index/CSS fallbacks
            if (mediaId == null) {
                mediaId = resolveStoryMediaIdByTimestamp(stories);
            }

            if (mediaId == null) {
                const $header = getStoryProgress(username);

                $header.each(function (index) {
                    if ($(this).children().length > 0) {
                        mediaId = items[index].id;
                    }
                });
            }

            if (mediaId == null) {
                // appear in from profile page to story page
                $('body > div section:visible div.x1ned7t2.x78zum5 > div').each(function (index) {
                    const $this = $(this);
                    if ($this.hasClass('x1lix1fw')) {
                        if ($this.children().length > 0) {
                            mediaId = items[index].id;
                        }
                    }
                });

                // appear in from home page to story page
                $('body > div section:visible ._ac0k > ._ac3r > div').each(function (index) {
                    if ($(this).children().hasClass('_ac3q')) {
                        mediaId = items[index].id;
                    }
                });
            }

            if (mediaId == null) {
                mediaId = location.pathname.split('/').filter(s => s.length > 0 && s.match(/^([0-9]{10,})$/)).at(-1) ?? null;
            }

            if (!mediaId) {
                updateLoadingBar(false);
                alert('Could not identify the current story.');
                return;
            }

            if (USER_SETTING.CAPTURE_IMAGE_VIA_MEDIA_CACHE) {
                const cached = getImageFromCache(mediaId);
                if (cached && items.find(item => item.id === mediaId)?.is_video === false) {
                    logger("[Restore Cached onStory]", mediaId);
                    if (isPreview) {
                        openNewTab(cached);
                    }
                    else {
                        saveFiles(cached, {
                            username,
                            sourceType: "stories",
                            timestamp,
                            filetype: 'jpg',
                            shortcode: mediaId
                        });
                    }
                    return;
                }
            }

            const result = await getMediaInfo(mediaId);

            if (USER_SETTING.RENAME_PUBLISH_DATE) {
                timestamp = result.items[0].taken_at;
            }

            if (result.status === 'ok') {
                // OPTIMIZATION: cache result.items[0]
                const mediaItem = result.items[0];
                if (mediaItem.video_versions) {
                    const handled = await tryHandleDashFromMediaItem({
                        mediaItem: mediaItem,
                        username,
                        sourceType: "stories",
                        timestamp,
                        shortcode: mediaId,
                        isPreview,
                    });
                    if (handled) {
                        updateLoadingBar(false);
                        return;
                    }

                    if (isPreview) {
                        openNewTab(mediaItem.video_versions[0].url);
                    }
                    else {
                        saveFiles(mediaItem.video_versions[0].url, {
                            username,
                            sourceType: "stories",
                            timestamp,
                            filetype: 'mp4',
                            shortcode: mediaId
                        });
                    }
                }
                else {
                    if (isPreview) {
                        openNewTab(mediaItem.image_versions2.candidates[0].url);
                    }
                    else {
                        saveFiles(mediaItem.image_versions2.candidates[0].url, {
                            username,
                            sourceType: "stories",
                            timestamp,
                            filetype: 'jpg',
                            shortcode: mediaId
                        });
                    }
                }
            }
            else {
                if (USER_SETTING.FALLBACK_TO_BLOB_FETCH_IF_MEDIA_API_THROTTLED) {
                    state.tempFetchRateLimit = true;
                    onStory(isDownload, isForce, isPreview);
                }
                else {
                    alert('Fetch failed from Media API. API response message: ' + result.message);
                }
                logger('onStory()', 'Media API rejected request', result?.message);
            }

            updateLoadingBar(false);
            return;
        }

        if ($('body > div section:visible video[playsinline]').length > 0) {
            // Download stories if it is video
            const type = "mp4";
            let videoURL = "";
            const targetURL = location.pathname.replace(/\/$/ig, '').split("/").at(-1);
            let mediaId = null;

            if (state.GL_dataCache.stories[username] && !isForce) {
                logger('Fetch from memory cache:', username);
                state.GL_dataCache.stories[username].data.reels_media[0].items.forEach(item => {
                    if (item.id == targetURL) {
                        videoURL = item.video_resources[0].src;
                        if (USER_SETTING.RENAME_PUBLISH_DATE) {
                            timestamp = item.taken_at_timestamp;
                            mediaId = item.id;
                        }
                    }
                });

                if (videoURL.length == 0) {
                    logger('Memory cache not found, try fetch from API:', username);
                    onStory(true, true);
                    return;
                }
            }
            else {
                const userInfo = await getUserId(username);
                const userId = userInfo.user.pk;
                const stories = await getStories(userId);
                // OPTIMIZATION: cache items
                const items = stories.data.reels_media[0].items;

                items.forEach(item => {
                    if (item.id == targetURL) {
                        videoURL = item.video_resources[0].src;
                        if (USER_SETTING.RENAME_PUBLISH_DATE) {
                            timestamp = item.taken_at_timestamp;
                            mediaId = item.id;
                        }
                    }
                });

                // GitHub issue #4: thinkpad4
                if (videoURL.length == 0) {

                    const $header = getStoryProgress(username);

                    $header.each(function (index) {
                        if ($(this).children().length > 0) {
                            videoURL = items[index].video_resources[0].src;
                            if (USER_SETTING.RENAME_PUBLISH_DATE) {
                                timestamp = items[index].taken_at_timestamp;
                                mediaId = items[index].id;
                            }
                        }
                    });


                    if (videoURL.length == 0) {
                        // appear in from profile page to story page
                        $('body > div section:visible div.x1ned7t2.x78zum5 > div').each(function (index) {
                            const $this = $(this);
                            if ($this.hasClass('x1lix1fw')) {
                                if ($this.children().length > 0) {
                                    videoURL = items[index].video_resources[0].src;
                                    if (USER_SETTING.RENAME_PUBLISH_DATE) {
                                        timestamp = items[index].taken_at_timestamp;
                                        mediaId = items[index].id;
                                    }
                                }
                            }
                        });

                        // appear in from home page to story page
                        $('body > div section:visible ._ac0k > ._ac3r > div').each(function (index) {
                            if ($(this).children().hasClass('_ac3q')) {
                                videoURL = items[index].video_resources[0].src;
                                if (USER_SETTING.RENAME_PUBLISH_DATE) {
                                    timestamp = items[index].taken_at_timestamp;
                                    mediaId = items[index].id;
                                }
                            }
                        });
                    }
                }

                state.GL_dataCache.stories[username] = stories;
            }

            if (videoURL.length == 0) {
                alert(_i18n("NO_VID_URL"));
            }
            else {
                if (isPreview) {
                    openNewTab(videoURL);
                }
                else {
                    saveFiles(videoURL, {
                        username,
                        sourceType: "stories",
                        timestamp,
                        filetype: type,
                        shortcode: mediaId
                    });
                }
            }
        }
        else {
            // Download stories if it is image
            const srcset = $('body > div section:visible img[referrerpolicy][class], body > div section:visible img[crossorigin][class]:not([alt])').attr('srcset')?.split(',')[0]?.split(' ')[0];
            let link = (srcset) ? srcset : $('body > div section:visible img[referrerpolicy][class], body > div section:visible img[crossorigin][class]:not([alt])').filter(function () {
                const $this = $(this);
                return $this.parents('a').length === 0 && $this.width() === $this.parent().width();
            }).attr('src');

            if (!link) {
                // _aa63 mean stories picture in stories page (not avatar)
                const $element = $('body > div section:visible img._aa63');
                link = ($element.attr('srcset')) ? $element.attr('srcset')?.split(',')[0]?.split(' ')[0] : $element.attr('src');
            }

            if (USER_SETTING.RENAME_PUBLISH_DATE) {
                timestamp = new Date($('body > div section:visible time[datetime][class]').first().attr('datetime') ?? '').getTime();
            }

            const downloadLink = link;
            const type = 'jpg';

            const mediaId = getStoryId(downloadLink);

            if (USER_SETTING.CAPTURE_IMAGE_VIA_MEDIA_CACHE && mediaId) {
                const cached = getImageFromCache(mediaId);
                if (cached) {
                    if (isPreview) {
                        openNewTab(cached);
                    }
                    else {
                        saveFiles(cached, {
                            username,
                            sourceType: "stories",
                            timestamp,
                            filetype: 'jpg',
                            shortcode: mediaId
                        });
                    }
                    return;
                }
            }

            if (!downloadLink) {
                updateLoadingBar(false);
                alert('Could not find the current story image.');
                return;
            }

            if (isPreview) {
                openNewTab(downloadLink);
            }
            else {
                saveFiles(downloadLink, {
                    username,
                    sourceType: "stories",
                    timestamp,
                    filetype: type,
                    shortcode: mediaId
                });
            }
        }

        state.tempFetchRateLimit = false;
        updateLoadingBar(false);
    }
    else {
        if (!document.querySelector('.IG_STORY_CONTROL_BAR')) {
            state.GL_dataCache.stories = {};
            const $element = findStoryControlElement();
            if ($element.length > 0) {
                const mediaType = $element.find('video:visible').length > 0 ? 'video' : 'image';
                mountStoryControlBar(username, mediaType);

                // Modify video volume
                //if(USER_SETTING.MODIFY_VIDEO_VOLUME){
                //    $element.find('video').each(function(){
                //        $(this).on('play playing', function(){
                //            if(!$(this).data('modify')){
                //                $(this).data('modify', true);
                //                this.volume = VIDEO_VOLUME;
                //                logger('(story) Added video event listener #modify');
                //            }
                //        });
                //    });
                //}

                if ($element.find('img[referrerpolicy]').length) {
                    mountStoryControlBar(username, 'image');
                }
                else if ($element.find('video[src^="blob:"]').length) {
                    mountStoryControlBar(username, 'video');
                }
            }
        }
        else {
            const $element = findStoryControlElement();
            if ($element.length > 0) mountStoryControlBar(username, $element.find('video:visible').length > 0 ? 'video' : 'image');
        }
    }
}

/**
 * onStoryThumbnail
 * @description Trigger user's story video thumbnail download event or button display event.
 *
 * @param  {Boolean}  isDownload - Check if it is a download operation
 * @param  {Boolean}  isForce - Check if downloading directly from API instead of cache
 * @return {void}
 */
export async function onStoryThumbnail(isDownload = false, isForce = false) {
    if (isDownload) {
        // Download stories if it is video
        const date = new Date().getTime();
        let timestamp = Math.floor(date / 1000);
        const type = 'jpg';
        const username = $("body > div section._ac0a header._ac0k ._ac0l a + div a").first().text() || location.pathname.split('/').at(2) || '';
        // Download thumbnail
        const targetURL = location.pathname.replace(/\/$/ig, '').split("/").at(-1);
        let videoThumbnailURL = "";
        let mediaId: string | null = null;

        updateLoadingBar(true);

        if (USER_SETTING.FORCE_RESOURCE_VIA_MEDIA && !state.tempFetchRateLimit) {
            const userInfo = await getUserId(username);
            const userId = userInfo.user.pk;
            const stories = await getStories(userId);
            const urlID = location.pathname.split('/').filter(s => s.length > 0 && s.match(/^([0-9]{10,})$/)).at(-1);
            // OPTIMIZATION: cache items reference
            const items = stories.data.reels_media[0].items;

            items.forEach(item => {
                if (item.id == urlID) {
                    mediaId = item.id;
                }
            });
			
            // FIX: timestamp-based match before fragile index/CSS fallbacks
            if (mediaId == null) {
                mediaId = resolveStoryMediaIdByTimestamp(stories);
            }

            if (mediaId == null) {
                const $header = getStoryProgress(username);

                $header.each(function (index) {
                    if ($(this).children().length > 0) {
                        mediaId = items[index].id;
                    }
                });
            }

            if (mediaId == null) {
                // appear in from profile page to story page
                $('body > div section:visible div.x1ned7t2.x78zum5 > div').each(function (index) {
                    const $this = $(this);
                    if ($this.hasClass('x1lix1fw')) {
                        if ($this.children().length > 0) {
                            mediaId = items[index].id;
                        }
                    }
                });

                // appear in from home page to story page
                $('body > div section:visible ._ac0k > ._ac3r > div').each(function (index) {
                    if ($(this).children().hasClass('_ac3q')) {
                        mediaId = items[index].id;
                    }
                });
            }

            if (mediaId == null) {
                mediaId = location.pathname.split('/').filter(s => s.length > 0 && s.match(/^([0-9]{10,})$/)).at(-1) ?? null;
            }

            if (!mediaId) {
                updateLoadingBar(false);
                alert('Could not identify the current story thumbnail.');
                return;
            }

            if (USER_SETTING.CAPTURE_IMAGE_VIA_MEDIA_CACHE) {
                const cached = getImageFromCache(mediaId);
                if (cached) {
                    logger("[Restore Cached onStoryThumbnail]", mediaId);
                    saveFiles(cached, {
                        username,
                        sourceType: "stories",
                        timestamp,
                        filetype: 'jpg',
                        shortcode: mediaId
                    });
                    return;
                }
            }

            const result = await getMediaInfo(mediaId);

            if (USER_SETTING.RENAME_PUBLISH_DATE) {
                timestamp = result.items[0].taken_at;
            }

            if (result.status === 'ok') {
                saveFiles(result.items[0].image_versions2.candidates[0].url, {
                    username,
                    sourceType: "stories",
                    timestamp,
                    filetype: 'jpg',
                    shortcode: mediaId
                });

            }
            else {
                if (USER_SETTING.FALLBACK_TO_BLOB_FETCH_IF_MEDIA_API_THROTTLED) {
                    state.tempFetchRateLimit = true;
                    onStoryThumbnail(true, isForce);
                }
                else {
                    alert('Fetch failed from Media API. API response message: ' + result.message);
                }

                logger('onStoryThumbnail()', 'Media API rejected request', result?.message);
            }

            updateLoadingBar(false);
            return;
        }

        if (state.GL_dataCache.stories[username] && !isForce) {
            logger('Fetch from memory cache:', username);
            state.GL_dataCache.stories[username].data.reels_media[0].items.forEach(item => {
                if (item.id == targetURL) {
                    videoThumbnailURL = item.display_url;
                    if (USER_SETTING.RENAME_PUBLISH_DATE) {
                        timestamp = item.taken_at_timestamp;
                        mediaId = item.id;
                    }
                }
            });

            if (videoThumbnailURL.length == 0) {
                logger('Memory cache not found, try fetch from API:', username);
                onStoryThumbnail(true, true);
                return;
            }
        }
        else {
            const userInfo = await getUserId(username);
            const userId = userInfo.user.pk;
            const stories = await getStories(userId);
            // OPTIMIZATION: cache items
            const items = stories.data.reels_media[0].items;

            items.forEach(item => {
                if (item.id == targetURL) {
                    videoThumbnailURL = item.display_url;
                    if (USER_SETTING.RENAME_PUBLISH_DATE) {
                        timestamp = item.taken_at_timestamp;
                        mediaId = item.id;
                    }
                }
            });

            // GitHub issue #4: thinkpad4
            if (videoThumbnailURL.length == 0) {
                const $header = getStoryProgress(username);

                $header.each(function (index) {
                    if ($(this).children().length > 0) {
                        videoThumbnailURL = items[index].display_url;
                        if (USER_SETTING.RENAME_PUBLISH_DATE) {
                            timestamp = items[index].taken_at_timestamp;
                            mediaId = items[index].id;
                        }
                    }
                });

                if (videoThumbnailURL.length == 0) {
                    // appear in from profile page to story page
                    $('body > div section:visible div.x1ned7t2.x78zum5 > div').each(function (index) {
                        const $this = $(this);
                        if ($this.hasClass('x1lix1fw')) {
                            if ($this.children().length > 0) {
                                videoThumbnailURL = items[index].display_url;
                                if (USER_SETTING.RENAME_PUBLISH_DATE) {
                                    timestamp = items[index].taken_at_timestamp;
                                    mediaId = items[index].id;
                                }
                            }
                        }
                    });

                    // appear in from home page to story page
                    $('body > div section:visible ._ac0k > ._ac3r > div').each(function (index) {
                        if ($(this).children().hasClass('_ac3q')) {
                            videoThumbnailURL = items[index].display_url;
                            if (USER_SETTING.RENAME_PUBLISH_DATE) {
                                timestamp = items[index].taken_at_timestamp;
                                mediaId = items[index].id;
                            }
                        }
                    });
                }
            }
        }

        saveFiles(videoThumbnailURL, {
            username,
            sourceType: "thumbnail",
            timestamp,
            filetype: type,
            shortcode: mediaId
        });
        state.tempFetchRateLimit = false;
        updateLoadingBar(false);
    }
    else {
        const $element = findStoryControlElement();
        const username = $("body > div section._ac0a header._ac0k ._ac0l a + div a").first().text() || location.pathname.split('/').at(2) || '';
        if ($element.find('video:visible').length > 0) mountStoryControlBar(username, 'video');
    }
}
