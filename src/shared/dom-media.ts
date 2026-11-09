import { parseDashManifest } from './dash-manifest';
import type { ModernMedia } from './instagram-data';
import { state } from '../settings/state';

export function isMediaURL(url: string | undefined): boolean {
    return Boolean(url && URL.canParse(url) && /^https?:$/.test(new URL(url).protocol));
}

interface FiberNode {
    memoizedProps?: Record<string, unknown>;
    return?: FiberNode | null;
}

export function findFiberProp<T>(element: Element, predicate: (props: Record<string, unknown>) => T | null): T | null {
    const fiberKey = Object.keys(element).find(k => k.startsWith('__reactFiber') || k.startsWith('__reactInternalInstance'));
    if (!fiberKey) return null;

    let curr = (element as unknown as Record<string, unknown>)[fiberKey] as FiberNode | null | undefined;
    const visited = new WeakSet<object>();

    while (curr) {
        if (curr.memoizedProps && typeof curr.memoizedProps === 'object') {
            const found = searchProps(curr.memoizedProps, predicate, visited, 0);
            if (found !== null) return found;
        }
        curr = curr.return;
    }
    return null;
}

function searchProps<T>(
    obj: unknown,
    predicate: (props: Record<string, unknown>) => T | null,
    visited: WeakSet<object>,
    depth: number,
): T | null {
    if (!obj || typeof obj !== 'object' || depth > 10 || visited.has(obj)) return null;
    visited.add(obj);

    const direct = predicate(obj as Record<string, unknown>);
    if (direct !== null) return direct;

    for (const val of Object.values(obj)) {
        if (typeof val === 'object' && val !== null) {
            const nested = searchProps(val, predicate, visited, depth + 1);
            if (nested !== null) return nested;
        }
    }
    return null;
}

export function findPostContainer(postPath: string): HTMLElement | null {
    if (typeof document === 'undefined' || typeof document.querySelectorAll !== 'function') return null;

    const candidates = Array.from(document.querySelectorAll<HTMLElement>(
        '[data-snig="canDownload"], [role="dialog"], article, main',
    ));

    // 1. Check for explicit postPath match in data attributes or post links
    for (const el of candidates) {
        if (el.dataset?.igHelperPostPath === postPath) return el;
        if ((el as unknown as Record<string, unknown>)._igHelper_postPath === postPath) return el;
        if (typeof el.querySelector === 'function' && el.querySelector(`a[href*="/p/${postPath}"], a[href*="/reel/${postPath}"]`)) return el;
    }

    if (typeof document.querySelector !== 'function') return null;

    // 2. If current location matches postPath, check dialog or article
    if (typeof location !== 'undefined' && location.pathname?.includes(postPath)) {
        const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
        if (dialog && (dialog.querySelector?.('video') || dialog.querySelector?.('img'))) return dialog;

        const article = document.querySelector<HTMLElement>('article');
        if (article && (article.querySelector?.('video') || article.querySelector?.('img'))) return article;

        const downloadable = document.querySelector<HTMLElement>('[data-snig="canDownload"]');
        if (downloadable) return downloadable;
    }

    // 3. Fallback: open dialog if present
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    if (dialog && (dialog.querySelector?.('video') || dialog.querySelector?.('img'))) return dialog;

    return null;
}

export function getContainerUsername(container: HTMLElement): string {
    const dataUser = container.getAttribute?.('data-username') || container.dataset?.username;
    if (dataUser) return dataUser;

    if (typeof container.querySelectorAll !== 'function') return state.GL_username || '';

    const userLinks = container.querySelectorAll<HTMLAnchorElement>('a[href^="/"]');
    for (const link of userLinks) {
        const href = link.getAttribute('href') || '';
        const match = href.match(/^\/([a-zA-Z0-9._]+)\/?$/);
        if (match && !['p', 'reel', 'reels', 'stories', 'explore', 'direct'].includes(match[1])) {
            const text = link.textContent?.trim();
            if (text && text.toLowerCase() === match[1].toLowerCase()) {
                return match[1];
            }
        }
    }

    for (const link of userLinks) {
        const href = link.getAttribute('href') || '';
        const match = href.match(/^\/([a-zA-Z0-9._]+)\/?$/);
        if (match && !['p', 'reel', 'reels', 'stories', 'explore', 'direct'].includes(match[1])) {
            return match[1];
        }
    }

    if (state.GL_username) return state.GL_username;
    return '';
}

export function extractMediaFromDOM(postPath: string): ModernMedia | null {
    const container = findPostContainer(postPath);
    if (!container) return null;

    const video = container.querySelector('video');
    const username = getContainerUsername(container);

    const published = container.querySelector('time[datetime]')?.getAttribute('datetime');
    const parsedDate = published ? Date.parse(published) : NaN;
    const timestamp = Number.isFinite(parsedDate) ? Math.floor(parsedDate / 1000) : Math.floor(Date.now() / 1000);

    if (video) {
        const manifest = findFiberProp(video, p => typeof p.manifest === 'string' ? p.manifest : null);
        const progressive = findFiberProp(video, p => typeof p.hdSrc === 'string'
            ? { hdSrc: p.hdSrc as string, sdSrc: typeof p.sdSrc === 'string' ? p.sdSrc : undefined }
            : null);

        const videoVersions: Array<{ url: string; width?: number; height?: number }> = [];

        if (progressive?.hdSrc && isMediaURL(progressive.hdSrc)) {
            videoVersions.push({ url: progressive.hdSrc, width: 720, height: 1280 });
        }
        if (progressive?.sdSrc && isMediaURL(progressive.sdSrc)) {
            videoVersions.push({ url: progressive.sdSrc, width: 360, height: 640 });
        }

        if (manifest) {
            const dash = parseDashManifest(manifest);
            if (dash.video?.url && isMediaURL(dash.video.url) && !videoVersions.some(v => v.url === dash.video!.url)) {
                videoVersions.unshift({
                    url: dash.video.url,
                    width: dash.video.width || 720,
                    height: dash.video.height || 1280,
                });
            }
        }

        if (video.src && isMediaURL(video.src) && !video.src.startsWith('blob:') && !videoVersions.some(v => v.url === video.src)) {
            videoVersions.push({ url: video.src });
        }

        if (videoVersions.length > 0) {
            const poster = video.poster || container.querySelector<HTMLImageElement>('img[src]')?.src || '';
            const candidates = isMediaURL(poster) ? [{ url: poster }] : [{ url: videoVersions[0].url }];

            return {
                code: postPath,
                pk: `dom_${postPath}`,
                taken_at: timestamp,
                media_type: 2,
                owner: { username },
                video_dash_manifest: manifest || null,
                video_versions: videoVersions,
                image_versions2: { candidates },
            };
        }
    }

    // Image fallback
    const img = container.querySelector<HTMLImageElement>('._aagv img[src], img[alt][src], img[src]');
    if (img?.src && isMediaURL(img.src)) {
        return {
            code: postPath,
            pk: `dom_${postPath}`,
            taken_at: timestamp,
            media_type: 1,
            owner: { username },
            video_dash_manifest: null,
            video_versions: null,
            image_versions2: { candidates: [{ url: img.src }] },
        };
    }

    return null;
}
