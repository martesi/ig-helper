import $ from 'jquery';
import { Effect } from 'effect';
import { DIRECT_DOWNLOAD_MODE_OPTIONS, USER_SETTING, state, resourceCountSelector } from '../../settings/state';
import { triggerLinkElement, saveMediaThumbnail, showMediaActionFailure } from '../../shared/media-download';
import { openNewTab, replaceSameOriginHost } from '../../shared/navigation';
import { showToast } from '../../shared/ui/status.tsx';
import { logger } from '../../shared/logger';
import { getMediaInfo } from '../../shared/api';
import { _i18n } from '../../shared/i18n';
import { openImageViewer } from '../media/image-viewer.tsx';
import { appendMediaResource } from '../../shared/ui/media-resource.tsx';
import { mediaIdFromURL } from '../media/image-cache';
import { openResourcePicker } from '../../shared/ui/resource-picker.tsx';
import { runWithLoadingBar } from '../loading';
import { downloadLocalPostImage, findVisiblePostImage, getVisibleNodeIndex } from './local-image';
import { getPostShortcodeFromURL as getPostPathFromURL } from '../../shared/instagram-path';
import { createMediaListDOM, batchDownloadPostFiles } from './resources';

export function openPostImageViewer(target: HTMLElement) {
    const url = getCurrentPostImageUrl(target);

    if (url) {
        openImageViewer(url);
    } else {
        showToast('Cannot find resource URL.');
    }
}

function getCurrentPostImageUrl(target: HTMLElement): string | null {
    const image = findVisiblePostImage(getPostContainerFromButton(target));
    return image?.currentSrc || image?.src || null;
}

export async function copyPostResourceToClipboard(target: HTMLElement): Promise<boolean> {
    if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
        showToast(_i18n('COPY_MEDIA_CLIPBOARD_UNAVAILABLE'), 'warning');
        return false;
    }

    if ($(target).find('.IG_THUMBNAIL_MAIN').length > 0) {
        showToast(_i18n('COPY_MEDIA_UNSUPPORTED'), 'warning');
        return false;
    }

    const url = getCurrentPostImageUrl(target);
    if (!url) {
        showToast(_i18n('COPY_MEDIA_FAILED'));
        return false;
    }

    const copy = Effect.tryPromise({
        try: async () => {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const blob = await response.blob();
            const type = blob.type === 'image/png' || ClipboardItem.supports?.(blob.type) ? blob.type : 'image/png';
            const data = type === blob.type ? blob : await toClipboardPng(blob);
            await navigator.clipboard.write([new ClipboardItem({ [type]: data })]);
        },
        catch: cause => cause,
    });
    return Effect.runPromise(copy).then(() => true, err => {
        logger('copyPostResourceToClipboard', err);
        showToast(_i18n('COPY_MEDIA_FAILED'));
        return false;
    });
}

async function toClipboardPng(blob: Blob): Promise<Blob> {
    if (blob.type === 'image/png') return blob;

    const bitmap = await createImageBitmap(blob);
    const conversion = Effect.tryPromise({
        try: async () => {
        const canvas = document.createElement('canvas');
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Canvas 2D context unavailable');
        context.drawImage(bitmap, 0, 0);

        return new Promise<Blob>((resolve, reject) => {
            canvas.toBlob(
                result => result ? resolve(result) : reject(new Error('PNG conversion failed')),
                'image/png',
            );
        });
        },
        catch: cause => cause,
    }).pipe(Effect.ensuring(Effect.sync(() => bitmap.close())));
    return Effect.runPromise(conversion);
}

async function runPostResourceAction<T>(
    operation: string,
    target: HTMLElement,
    action: ($article: JQuery<Element>, postPath: string) => Promise<T>,
): Promise<T | undefined> {
    return getPostContextFromButton(target).then(async ({ $article, postPath }) => {
        if ($article.length === 0 || !postPath) throw new Error('Cannot determine post path');
        state.GL_username = $article.data('username');
        state.GL_postPath = postPath;
        return await action($article, postPath);
    }).catch(error => {
        logger(operation, error);
        showMediaActionFailure(error, 'Could not get this media.');
        return undefined;
    });
}

async function loadPostResources(postPath: string, message = ''): Promise<HTMLElement> {
    const root = document.createElement('div');
    if (await createMediaListDOM(postPath, root, message) < 1) throw new Error('No post resources found');
    return root;
}

async function getVisiblePostResource(index: number, postPath: string): Promise<JQuery<Element>> {
    const root = await loadPostResources(postPath);
    const $link = $(root).find(`a[data-globalindex="${index + 1}"]`).first();
    if ($link.length === 0) throw new Error('Current post resource not found');
    return $link;
}

export function openPostVideoThumbnail(target: HTMLElement) {
    const index = getVisibleNodeIndex(getPostContainerFromButton(target));
    return runWithLoadingBar(() => runPostResourceAction('openPostVideoThumbnail', target, async (_article, postPath) => {
        const $link = await getVisiblePostResource(index, postPath);
        if (!await saveMediaThumbnail($link, postPath)) throw new Error('Post thumbnail is unavailable');
    }));
}

export function openPostResourceInNewTab(target: HTMLElement) {
    const index = getVisibleNodeIndex(getPostContainerFromButton(target));
    return runWithLoadingBar(() => runPostResourceAction('openPostResourceInNewTab', target, async (_article, postPath) => {
        const $link = await getVisiblePostResource(index, postPath);
        if (USER_SETTING.FORCE_RESOURCE_VIA_MEDIA && USER_SETTING.NEW_TAB_ALWAYS_FORCE_MEDIA_IN_POST) {
            await triggerLinkElement($link[0], true);
            return;
        }

        const href = $link.data('href');
        if (!href) throw new Error('Post resource URL is unavailable');
        openNewTab(replaceSameOriginHost(href));
    }));
}

export async function downloadAllPostResources(target: HTMLElement) {
    await runWithLoadingBar(() => runPostResourceAction('downloadAllPostResources', target, async (_article, postPath) => {
        const popupBody = await loadPostResources(postPath, _i18n("LOAD_BLOB_MULTIPLE"));
        await batchDownloadPostFiles($(popupBody).find('a').toArray());
    }));
}

async function appendVisiblePostResources($article: JQuery<Element>, popupBody: HTMLElement, postPath: string) {
    const resourceItems = $article.find(resourceCountSelector);
    const publishTime = new Date(
        $article.find('a[href] time[datetime]').filter(function () {
            const href = $(this).parents('a[href]').attr('href');
            return href?.startsWith('/p/') || href?.match(/\/([\w.\-_]+)\/(p|reel)\//ig) != null;
        }).first().attr('datetime') ?? '',
    ).getTime();

    if (resourceItems.length === 0) {
        if (USER_SETTING.FORCE_RESOURCE_VIA_MEDIA) {
            await createMediaListDOM(postPath, popupBody, _i18n('LOAD_BLOB_MULTIPLE'));
            return;
        }

        const videos = $article.find('video');
        const images = $article.find('._aagv img');
        const imageLink = images.attr('srcset')?.split(' ')[0] || images.attr('src');
        if (videos.attr('src')) await createMediaListDOM(postPath, popupBody, _i18n('LOAD_BLOB_ONE'));
        if (imageLink) appendPostImage(popupBody, imageLink, 1, publishTime, postPath);
        return;
    }

    let hasBlob = false;
    resourceItems.each(function () {
        if ($(this).parent().parent().parent().find('video').attr('src')) hasBlob = true;
    });
    if (hasBlob || USER_SETTING.FORCE_RESOURCE_VIA_MEDIA) {
        await createMediaListDOM(postPath, popupBody, _i18n('LOAD_BLOB_MULTIPLE'));
        return;
    }

    let index = 0;
    let foundBlob = false;
    resourceItems.each(function () {
        index++;
        const $this = $(this);
        const videos = $this.find('video');
        const images = $this.find('._aagv img');
        const imageLink = images.attr('srcset')?.split(' ')[0] || images.attr('src');
        if (videos.attr('src')) foundBlob = true;
        if (imageLink) appendPostImage(popupBody, imageLink, index, publishTime, postPath);
    });
    if (foundBlob) await createMediaListDOM(postPath, popupBody, _i18n('LOAD_BLOB_RELOAD'));
}

function appendPostImage(root: HTMLElement, imageLink: string, index: number, publishTime: number, postPath: string) {
    appendMediaResource(root, {
        datetime: publishTime, name: 'photo', type: 'jpg', username: state.GL_username,
        path: postPath, index, href: imageLink, preview: imageLink, labelKey: 'IMG', label: _i18n('IMG'),
    });
}

export async function downloadPostResource(target: HTMLElement) {
    const index = getVisibleNodeIndex(getPostContainerFromButton(target));
    if (await downloadLocalPostImage(target, index)) return;
    await runPostResourceAction('downloadPostResource', target, async ($article, postPath) => {
        if (USER_SETTING.DIRECT_DOWNLOAD_MODE === DIRECT_DOWNLOAD_MODE_OPTIONS.ASK) {
            await runWithLoadingBar(async () => {
                const resourceRoot = await loadPostResources(postPath, _i18n("LOAD_BLOB_MULTIPLE"));
                const resources = Array.from(resourceRoot.querySelectorAll<HTMLAnchorElement>('a[data-needed="direct"]')).map(anchor => ({
                    mediaId: anchor.getAttribute('media-id'),
                    preview: anchor.dataset.preview ?? anchor.dataset.href,
                    label: _i18n(anchor.dataset.type === 'mp4' ? 'VID' : 'IMG'),
                    element: anchor,
                }));

                openResourcePicker({
                    title: `Post ${postPath}`,
                    resources,
                    onDownload: selected => batchDownloadPostFiles(selected.map(resource => $(resource.element))),
                });
            });

            return;
        }

        const popupBody = document.createElement('div');

        if (USER_SETTING.DIRECT_DOWNLOAD_MODE === DIRECT_DOWNLOAD_MODE_OPTIONS.VISIBLE) {
            await runWithLoadingBar(async () => {
                const $targetLink = await getVisiblePostResource(index, postPath);
                await triggerLinkElement($targetLink[0], false);
            });

            return;
        }

        if (USER_SETTING.DIRECT_DOWNLOAD_MODE !== DIRECT_DOWNLOAD_MODE_OPTIONS.ALL) {
            await appendVisiblePostResources($article, popupBody, postPath);
        }

        if (USER_SETTING.DIRECT_DOWNLOAD_MODE === DIRECT_DOWNLOAD_MODE_OPTIONS.ALL) {
            const allResources = await loadPostResources(postPath, _i18n("LOAD_BLOB_MULTIPLE"));
            await batchDownloadPostFiles($(allResources).find('a').toArray());
        }
    });
}


function getPostContainerFromButton(target: HTMLElement): JQuery<Element> {
    return $(target).closest('[data-snig="canDownload"]');
}

async function getPostPathFromMedia(target: HTMLElement): Promise<string | null> {
    const $mediaRoot = getPostContainerFromButton(target);
    const mediaElement = $mediaRoot.find('img[src*="ig_cache_key="], video[poster*="ig_cache_key="]').first()[0];
    const mediaURL = mediaElement instanceof HTMLImageElement
        ? mediaElement.currentSrc || mediaElement.src
        : mediaElement instanceof HTMLVideoElement ? mediaElement.currentSrc || mediaElement.src || mediaElement.poster : '';
    const mediaId = mediaURL ? mediaIdFromURL(mediaURL) : null;
    if (!mediaId) return null;

    const apiResponse = await getMediaInfo(mediaId);
    const mediaItem = apiResponse?.items?.[0];
    if (!mediaItem?.code) return null;
    if (mediaItem.product_type !== 'carousel_item') return mediaItem.code;

    const fetchResponse = await fetch(`/p/${mediaItem.code}/`, { credentials: 'same-origin' });
    return getPostPathFromURL(fetchResponse.url) || mediaItem.code;
}

/**
 * getPostContextFromButton
 * @description Resolve the current post container and shortcode safely across
 * homepage, dialog, /p/, /reel/, and feed layouts without post permalinks.
 *
 * @param {HTMLElement|JQuery} target
 * @return {Promise<{ $article: JQuery<HTMLElement>, postPath: (string|null) }>}
 */
export async function getPostContextFromButton(target: HTMLElement): Promise<{ $article: JQuery<Element>; postPath: string | null }> {
    const $article = getPostContainerFromButton(target);
    if ($article.length === 0) {
        return { $article: $(), postPath: null };
    }

    const cachedPath = $article.data('igHelper_postPath');
    if (typeof cachedPath === 'string') return { $article, postPath: cachedPath };

    const candidates: string[] = [];
    $article.find('a[href]').each(function () {
        const href = $(this).attr('href');
        if (href && getPostPathFromURL(href)) candidates.push(href);
    });

    let postPath = candidates.map(getPostPathFromURL).find(Boolean) || getPostPathFromURL(location.href);
    if (!postPath) postPath = await getPostPathFromMedia(target);
    if (postPath) $article.data('igHelper_postPath', postPath);

    return { $article, postPath };
}
