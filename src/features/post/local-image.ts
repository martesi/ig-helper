import $ from 'jquery';
import { DIRECT_DOWNLOAD_MODE_OPTIONS, USER_SETTING, resourceCountSelector } from '../../settings/state';
import { saveFiles } from '../../shared/download';
import { showToast } from '../../shared/ui/status.tsx';
import { getPostShortcodeFromURL } from '../../shared/instagram-path';
import { selectImageURL } from './image-source';
import { getImageFromCache, mediaIdFromURL } from '../media/image-cache';

export async function downloadLocalPostImage(target: HTMLElement, index: number): Promise<boolean> {
    if (USER_SETTING.FORCE_RESOURCE_VIA_MEDIA || USER_SETTING.DIRECT_DOWNLOAD_MODE !== DIRECT_DOWNLOAD_MODE_OPTIONS.VISIBLE) return false;
    const article = $(target).closest('[data-snig="canDownload"]');
    const image = findVisiblePostImage(article);
    if (!image) return false;
    const source = selectImageURL(image);
    const mediaId = source ? mediaIdFromURL(source) : null;
    const cached = USER_SETTING.CAPTURE_IMAGE_VIA_MEDIA_CACHE && mediaId ? getImageFromCache(mediaId) : null;
    const url = cached ?? source;
    if (!url) return false;
    const username = String(article.data('username') || '');
    if (!username) return false;

    const cachedPath: unknown = article.data('igHelper_postPath');
    const shortcode = (typeof cachedPath === 'string' ? cachedPath : null) ?? article.find('a[href]').toArray()
        .map(link => getPostShortcodeFromURL(link.getAttribute('href'))).find(Boolean)
        ?? getPostShortcodeFromURL(location.href);
    // Keep metadata-dependent actions on their existing fallback if the page lacks it.
    if (!shortcode) return false;
    const published = article.find('time[datetime]').first().attr('datetime');
    const timestamp = published ? Date.parse(published) : NaN;
    if (USER_SETTING.RENAME_PUBLISH_DATE && !Number.isFinite(timestamp)) return false;

    const saved = await saveFiles(url, {
        username, sourceType: 'photo', filetype: 'jpg',
        shortcode, index: index + 1,
        timestamp: USER_SETTING.RENAME_PUBLISH_DATE ? timestamp : Date.now(),
    });
    if (!saved) showToast('Could not save this image.', 'error');
    // A failed file transfer should not trigger another round of API lookups.
    return true;
}

export function findVisiblePostImage(article: JQuery<Element>): HTMLImageElement | null {
    const items = article.find(resourceCountSelector).toArray();
    if (items.length) {
        const viewport = items[0]?.parentElement?.parentElement?.parentElement?.getBoundingClientRect();
        if (!viewport || viewport.width <= 0) return null;
        const visible = items.map(item => ({ item, width: visibleWidth(item, viewport) }))
            .sort((a, b) => b.width - a.width)[0];
        if (!visible || visible.width <= 0 || visible.item.querySelector('video')) return null;
        return $(visible.item).find<HTMLImageElement>('._aagv img[src], img[alt][src]').first()[0] ?? null;
    }

    if (article.find('video').length) return null;
    return article.find<HTMLImageElement>('._aagv img[src]').filter(function () {
        const rect = this.getBoundingClientRect();
        return rect.width > 64 && rect.height > 64;
    }).first()[0] ?? null;
}

function visibleWidth(item: Element, viewport: DOMRect): number {
    const rect = item.getBoundingClientRect();
    return Math.max(0, Math.min(rect.right, viewport.right) - Math.max(rect.left, viewport.left));
}
