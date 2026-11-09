import { Effect } from 'effect';

const HASTE_BITMAP_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-_';
const STORIES_DOC_ID = '29170422829314651';
const HIGHLIGHTS_DOC_ID = '29299425373007309';
type UnknownRecord = Record<string, unknown>;

export const storyGraphQL = {
    docId: STORIES_DOC_ID,
    friendlyName: 'PolarisStoriesV3ReelPageStandaloneQuery',
    crn: 'comet.igweb.PolarisProfilePostsTabRoute',
    rootFieldName: 'xdt_api__v1__feed__reels_media',
} as const;

export const highlightGraphQL = {
    docId: HIGHLIGHTS_DOC_ID,
    friendlyName: 'PolarisStoriesV3HighlightsPageQuery',
    crn: 'comet.igweb.PolarisProfilePostsTabRoute',
    rootFieldName: 'xdt_api__v1__feed__reels_media__connection',
} as const;

export interface InstagramGraphQLRequest {
    readonly url: string;
    readonly data: FormData;
    readonly headers: Record<string, string>;
}

interface SiteData {
    readonly [key: string]: unknown;
}

function pageScripts(): Element[] {
    if (typeof document === 'undefined') return [];
    return Array.from(document.querySelectorAll('script[type="application/json"][data-sjs]'));
}

function scriptText(): string[] {
    return pageScripts().map(script => script.textContent ?? '').filter(Boolean);
}

function findToken(pattern: RegExp): string {
    for (const text of scriptText()) {
        const match = text.match(pattern);
        if (match?.[1]) return match[1];
    }
    return '';
}

function getLSD(): string {
    return findToken(/\["LSD",\[\],\{"token":"([0-9a-z_-]+)"\}/i);
}

function getDTSG(): string {
    return findToken(/"DTSGInitialData",\[\],\{"token":"([^"]+)"\}/i);
}

function getBloksVersion(): string {
    return findToken(/"WebBloksVersioningID",\[\],\{"versioningID":"([^"]+)"\}/i);
}

function findConfig(value: unknown, name: string, visited = new WeakSet<object>()): SiteData | undefined {
    if (!value || typeof value !== 'object') return undefined;
    if (visited.has(value)) return undefined;
    visited.add(value);

    if (Array.isArray(value)) {
        if (value[0] === name && value[2] && typeof value[2] === 'object' && !Array.isArray(value[2])) {
            return value[2] as SiteData;
        }
        for (const child of value) {
            const found = findConfig(child, name, visited);
            if (found) return found;
        }
        return undefined;
    }

    for (const child of Object.values(value)) {
        const found = findConfig(child, name, visited);
        if (found) return found;
    }
    return undefined;
}

function getSiteData(): SiteData {
    for (const script of pageScripts()) {
        const text = script.textContent ?? '';
        if (!text.includes('"SiteData",[],{')) continue;
        const parsed = Effect.runSync(Effect.try({
            try: (): unknown => JSON.parse(text),
            catch: () => null,
        }).pipe(Effect.catchCause(() => Effect.succeed(null))));
        const config = findConfig(parsed, 'SiteData');
        if (config) return config;
    }
    return {};
}

function getCookie(name: string): string {
    if (typeof document === 'undefined') return '';
    const cookieString = typeof document.cookie === 'string' ? document.cookie : '';
    const prefix = `${name}=`;
    const cookie = cookieString.split(';').map(part => part.trim()).find(part => part.startsWith(prefix));
    return cookie ? decodeURIComponent(cookie.slice(prefix.length)) : '';
}

function getString(value: unknown): string {
    return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
}

function siteValue(siteData: SiteData, ...keys: string[]): string {
    for (const key of keys) {
        const value = getString(siteData[key]);
        if (value) return value;
    }
    return '';
}

function getJazoest(fbDtsg: string): string {
    if (!fbDtsg) return '';
    let total = 0;
    for (const character of fbDtsg) total += character.charCodeAt(0);
    return `2${total}`;
}

function genWebSessionId(): string {
    return Array.from({ length: 3 }, () => Math.floor(Math.random() * 2 ** 31).toString(36).padStart(6, '0')).join(':');
}

function appendBody(data: FormData, key: string, value: string): void {
    if (value) data.append(key, value);
}

function encodeHasteBitmap(indexes: Iterable<number>): string {
    const bits: number[] = [];
    for (const index of indexes) {
        if (Number.isInteger(index) && index >= 0) bits[index] = 1;
    }
    if (bits.length === 0) return '';

    const gamma = (value: number) => {
        const binary = value.toString(2);
        return '0'.repeat(binary.length - 1) + binary;
    };

    let lastValue = bits[0] || 0;
    let runLength = 1;
    let output = String(lastValue);
    for (let index = 1; index < bits.length; index++) {
        const value = bits[index] || 0;
        if (value === lastValue) {
            runLength++;
        }
        else {
            output += gamma(runLength);
            lastValue = value;
            runLength = 1;
        }
    }
    output += gamma(runLength);
    return (output + '00000').match(/[01]{6}/g)?.map(chunk => HASTE_BITMAP_ALPHABET[parseInt(chunk, 2)]).join('') ?? '';
}

function parseHasteResourceIndexes(value: unknown): number[] {
    if (typeof value !== 'string' || value[0] !== ':') return [];
    return value.slice(1).split(',').map(item => parseInt(item, 10)).filter(Number.isInteger);
}

function getHasteBitmapParams(): Record<string, string> {
    if (typeof document === 'undefined') return {};

    const dynIndexes = new Set<number>();
    const hasteIndexes: Record<string, Set<number>> = {
        __csr: new Set(),
        __hsdp: new Set(),
        __hblp: new Set(),
        __sjsp: new Set(),
    };
    const resources: UnknownRecord[] = [];
    let csrOn = true;

    const addHasteIndex = (name: string, index: number) => {
        if (!hasteIndexes[name]) hasteIndexes[name] = new Set();
        hasteIndexes[name].add(index);
    };
    const isDefineList = (value: unknown): value is unknown[][] => Array.isArray(value) &&
        value.every(entry => Array.isArray(entry) && typeof entry[0] === 'string');

    const walk = (value: unknown) => {
        const pending: unknown[] = [value];
        const visited = new WeakSet<object>();
        while (pending.length > 0) {
            const node = pending.pop();
            if (!node || typeof node !== 'object') continue;
            if (visited.has(node)) continue;
            visited.add(node);

            if (Array.isArray(node)) {
                if (node[0] === 'AsyncData' && node[1] === 'resolve') continue;
                if (node[0] === 'BootloaderConfig' && node[2] && typeof node[2] === 'object' && !Array.isArray(node[2])) {
                    const config = node[2] as UnknownRecord;
                    // eslint-disable-next-line max-depth
                    if ('csrOn' in config) csrOn = Boolean(config.csrOn);
                }
                pending.push(...node);
                continue;
            }

            const object = node as UnknownRecord;
            if (isDefineList(object.define)) {
                for (const entry of object.define) {
                    const index = entry[3];
                    // eslint-disable-next-line max-depth
                    if (typeof index === 'number' && Number.isInteger(index) && index >= 0) dynIndexes.add(index);
                }
            }
            if (typeof object.phd2_indexes === 'string') {
                parseHasteResourceIndexes(object.phd2_indexes).forEach(index => addHasteIndex('__sjsp', index));
            }
            const upgrades = object.indexUpgrades;
            if (upgrades && typeof upgrades === 'object' && !Array.isArray(upgrades)) {
                for (const [name, indexes] of Object.entries(upgrades)) {
                    parseHasteResourceIndexes(indexes).forEach(index => addHasteIndex(name, index));
                }
            }
            const resourceMap = object.rsrcMap;
            if (resourceMap && typeof resourceMap === 'object' && !Array.isArray(resourceMap)) {
                resources.push(...Object.values(resourceMap).map(resource => {
                    return resource && typeof resource === 'object' && !Array.isArray(resource) ? resource as UnknownRecord : {};
                }));
            }
            pending.push(...Object.values(object));
        }
    };

    for (const script of pageScripts()) {
        const text = script.textContent ?? '';
        if (!text) continue;
        const parsed = Effect.runSync(Effect.try({
            try: (): unknown => JSON.parse(text),
            catch: () => null,
        }).pipe(Effect.catchCause(() => Effect.succeed(null))));
        if (parsed !== null) walk(parsed);
    }

    const bootloaderElements = document.querySelectorAll('script[data-bootloader-hash], link[data-bootloader-hash]');
    for (const element of bootloaderElements) {
        if (typeof (element as Element & { getAttribute?: unknown }).getAttribute !== 'function') continue;
        const getAttribute = (element as Element).getAttribute.bind(element);
        const c = getAttribute('data-c');
        resources.push({
            type: element.tagName === 'LINK' ? 'css' : 'js',
            p: getAttribute('data-p'),
            c: c === '1' ? 1 : c === '2' ? 2 : 0,
        });
    }

    if (csrOn) {
        for (const resource of resources) {
            if (resource.type === 'async' || resource.type === 'csr' || resource.p == null || !resource.c) continue;
            for (const index of parseHasteResourceIndexes(resource.p)) {
                // eslint-disable-next-line max-depth
                if (index !== 0) addHasteIndex('__csr', index);
            }
        }
    }

    const result: Record<string, string> = {};
    const dyn = encodeHasteBitmap(dynIndexes);
    if (dyn) result.__dyn = dyn;
    for (const [name, indexes] of Object.entries(hasteIndexes)) {
        const encoded = encodeHasteBitmap(indexes);
        if (encoded) result[name] = encoded;
    }
    return result;
}

function getPageOrigin(): string {
    if (typeof window !== 'undefined' && window.location?.origin) return window.location.origin;
    return 'https://www.instagram.com';
}

export function buildInstagramGraphQLRequest(
    appId: string,
    query: typeof storyGraphQL | typeof highlightGraphQL,
    variables: Record<string, unknown>,
): InstagramGraphQLRequest {
    const siteData = getSiteData();
    const hasteData = getHasteBitmapParams();
    const fbDtsg = getDTSG();
    const lsd = getLSD();
    const data = new FormData();

    const fields: Record<string, string> = {
        av: getCookie('ds_user_id') || '0',
        fb_api_caller_class: 'RelayModern',
        fb_api_req_friendly_name: query.friendlyName,
        server_timestamps: 'true',
        doc_id: query.docId,
        lsd,
        fb_dtsg: fbDtsg,
        __hs: siteValue(siteData, 'haste_session', '__hs'),
        __hsi: siteValue(siteData, 'hsi', '__hsi'),
        __rev: siteValue(siteData, 'client_revision', '__rev'),
        __spin_r: siteValue(siteData, '__spin_r', 'spin_r'),
        __spin_b: siteValue(siteData, '__spin_b', 'spin_b'),
        __spin_t: siteValue(siteData, '__spin_t', 'spin_t'),
        __comet_req: siteValue(siteData, 'comet_env', '__comet_req', 'comet_req'),
        __ccg: 'EXCELLENT',
        dpr: '3',
        jazoest: getJazoest(fbDtsg),
        __user: '0',
        __a: '1',
        __d: 'www',
        __req: '1',
        __s: genWebSessionId(),
        variables: JSON.stringify(variables),
        __crn: query.crn,
    };

    Object.assign(fields, hasteData);
    for (const [key, value] of Object.entries(fields)) appendBody(data, key, value);

    return {
        url: new URL('/graphql/query', getPageOrigin()).href,
        data,
        headers: {
            Dpr: '3',
            'Sec-Ch-Dpr': '3',
            'Viewport-Width': '3840',
            'Sec-Ch-Viewport-Width': '3840',
            ...(appId ? { 'X-IG-App-ID': appId } : {}),
            ...(getCookie('csrftoken') ? { 'X-CSRFToken': getCookie('csrftoken') } : {}),
            ...(query.friendlyName ? { 'X-Fb-Friendly-Name': query.friendlyName } : {}),
            ...(lsd ? { 'X-Fb-Lsd': lsd } : {}),
            ...(getBloksVersion() ? { 'X-Bloks-Version-ID': getBloksVersion() } : {}),
            'X-Asbd-ID': '359341',
            'X-Root-Field-Name': query.rootFieldName,
        },
    };
}

export function storyVariables(userId: string): Record<string, unknown> {
    return {
        reel_ids_arr: [userId],
        __relay_internal__pv__PolarisCommunityNoteStoriesLabelEnabledrelayprovider: true,
    };
}

export function highlightVariables(highlightId: string): Record<string, unknown> {
    const reelId = highlightId.startsWith('highlight:') ? highlightId : `highlight:${highlightId}`;
    return {
        initial_reel_id: reelId,
        reel_ids: [reelId],
        first: 999,
        last: 0,
        __relay_internal__pv__PolarisCommunityNoteStoriesLabelEnabledrelayprovider: true,
    };
}
