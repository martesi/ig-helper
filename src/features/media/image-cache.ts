/*  
──────────────────────────────────────────────────────────────
    📦  IMAGE CACHE (12h) + NETWORK SNIFFER
────────────────────────────────────────────────────────────── 
*/

import { IMAGE_CACHE_KEY, IMAGE_CACHE_MAX_AGE, IMAGE_MAX_CACHE_ITEMS, state, USER_SETTING } from "../../settings/state";
import { Effect } from 'effect';

let mediaCacheDirty = false;
let mediaCacheSaveTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * purgeCache
 * @description Purge image cache entries older than 12 hours.
 *
 * @return {void}
 */
export function purgeCache() {
    const now = Date.now();
    for (const id in state.GL_imageCache) {
        if ((now - state.GL_imageCache[id].ts) > IMAGE_CACHE_MAX_AGE) delete state.GL_imageCache[id];
    }
    GM_setValue(IMAGE_CACHE_KEY, state.GL_imageCache);
}


/**
 * mediaIdFromURL
 * @description Decode mediaId from ig_cache_key parameter that Instagram includes in the URL.
 *
 * @param  {string}  url
 * @return {?string}
 */
export function mediaIdFromURL(url: string): string | null {
    if (!URL.canParse(url)) return null;
    const key = new URL(url).searchParams.get('ig_cache_key');
    if (!key) return null;
    const b64 = key.split('.')[0];
    return Effect.runSync(Effect.try({ try: () => atob(b64), catch: () => null }).pipe(
        Effect.catchCause(() => Effect.succeed(null)),
    ));
}

/**
 * putInCache
 * @description Save URL to image cache.
 *
 * @param  {string}  mediaId
 * @param  {string}  url
 * @return {void}
 */
export function putInCache(mediaId: string, url: string) {
    if (!mediaId) return;

    const keys = Object.keys(state.GL_imageCache);
    if (keys.length >= IMAGE_MAX_CACHE_ITEMS) {
        keys.sort((a, b) => state.GL_imageCache[a].ts - state.GL_imageCache[b].ts);
        delete state.GL_imageCache[keys[0]];
    }

    mediaCacheDirty = true;
    state.GL_imageCache[mediaId] = { url, ts: Date.now() };

    if (!mediaCacheSaveTimer) {
        mediaCacheSaveTimer = setTimeout(() => {
            if (mediaCacheDirty) {
                GM_setValue(IMAGE_CACHE_KEY, state.GL_imageCache);
                mediaCacheDirty = false;
            }
            mediaCacheSaveTimer = null;
        }, 500); // write in script storage per 500 ms
    }
}

/**
 * getImageFromCache
 * @description Read image URL from cache; returns null if not found or expired.
 *
 * @param  {string}  mediaId
 * @return {?string}
 */
export function getImageFromCache(mediaId: string): string | null {
    if (!mediaId) return null;
    const entry = state.GL_imageCache[mediaId];
    if (!entry) return null;
    if ((Date.now() - entry.ts) > IMAGE_CACHE_MAX_AGE) { delete state.GL_imageCache[mediaId]; return null; }
    return entry.url;
}

/**
 * registerPerformanceObserver
 * @description Register performance observer to document, captures any loaded image resource.
 *
 * @return Effect that owns the observer's lifetime.
 */
export function registerPerformanceObserver() {
    return Effect.acquireRelease(
        Effect.sync(() => {
            const observer = new PerformanceObserver(list => {
                if (!USER_SETTING.CAPTURE_IMAGE_VIA_MEDIA_CACHE) return;

                list.getEntries().forEach(entry => {
                    if (!(entry instanceof PerformanceResourceTiming)) return;
                    if (entry.initiatorType !== 'img') return;
                    const url = entry.name;
                    if (
                        !(url.includes('_e35') || url.includes('_e15') || url.includes('.webp?')) ||
                        url.includes('_e35_s') ||
                        url.match(/_[sp](\d+)x\1(?!\d)/)
                    ) return;

                    const id = mediaIdFromURL(url);
                    if (id && !state.GL_imageCache[id]) putInCache(id, url);
                });
            });
            observer.observe({ entryTypes: ['resource'] });
            return observer;
        }),
        observer => Effect.sync(() => observer.disconnect()),
    );
}
