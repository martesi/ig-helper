import { userIdCache, state } from "../settings/state";
import { logger } from "./logger";
import * as z from "zod/mini";
import { Effect } from 'effect';
import { gmGet, gmPost, RequestError } from './transport.ts';
import type { Request } from './transport.ts';
import { assertInstagramPostShortcode } from './instagram-path.ts';
import { legacyMediaSchema, mediaInfoSchema, modernMediaSchema, normalizeStoryResponse, storyResponseSchema, userInfoSchema } from './instagram-data.ts';
import type { BlobMediaResponse, LegacyMedia, ModernMedia, StoryResponse, UserInfo } from './instagram-data.ts';
import { findLocalUserInfo, getPageUserInfo, userInfoFromOwner } from './local-user';
import { extractMediaFromDOM, isMediaURL } from './dom-media';
import { buildInstagramGraphQLRequest, highlightGraphQL, highlightVariables, storyGraphQL, storyVariables } from './instagram-graphql';

const objectResponseSchema = z.record(z.string(), z.unknown());

function parseResponse(response: Tampermonkey.Response<object>) {
    return z.parse(objectResponseSchema, JSON.parse(response.response));
}
function schemaIssuePaths(error: unknown): unknown[] | undefined {
    if (typeof error !== 'object' || error === null || !('issues' in error) || !Array.isArray(error.issues)) return undefined;
    return error.issues.map(issue => typeof issue === 'object' && issue !== null && 'path' in issue ? JSON.stringify(issue.path) : undefined);
}
function isRateLimitPayload(payload: Record<string, unknown>): boolean {
    const message = [payload.message, payload.feedback_message, payload.error_type]
        .filter(value => typeof value === 'string')
        .join(' ');
    return /rate.?limit|too many requests|please wait a few minutes|try again later/i.test(message);
}
function requestParsed<T extends z.ZodMiniType>(operation: string, url: string, schema: T, headers?: Record<string, string>, request?: Request, anonymous = false) {
    return Effect.runPromise(gmGet(operation, url, { headers, request, anonymous }).pipe(
        Effect.flatMap(response => Effect.try({
            try: () => {
                const data = parseResponse(response);
                if (data.message === 'login_required' || data.error_type === 'login_required' || data.require_login === true) {
                    throw new RequestError({ operation, kind: 'http', requiresLogin: true });
                }
                if (isRateLimitPayload(data)) {
                    throw new RequestError({ operation, kind: 'http', status: 429, cause: data });
                }
                return z.parse(schema, data);
            },
            catch: cause => cause instanceof RequestError ? cause : new RequestError({ operation, kind: 'http', cause }),
        })),
    ));
}
function requestPostedParsed<T extends z.ZodMiniType>(operation: string, url: string, data: Tampermonkey.Request['data'], schema: T, headers?: Record<string, string>, request?: Request, anonymous = false) {
    return Effect.runPromise(gmPost(operation, url, data, { headers, request, anonymous }).pipe(
        Effect.flatMap(response => Effect.try({
            try: () => {
                const payload = parseResponse(response);
                if (payload.message === 'login_required' || payload.error_type === 'login_required' || payload.require_login === true) {
                    throw new RequestError({ operation, kind: 'http', requiresLogin: true });
                }
                if (isRateLimitPayload(payload)) {
                    throw new RequestError({ operation, kind: 'http', status: 429, cause: payload });
                }
                return z.parse(schema, payload);
            },
            catch: cause => cause instanceof RequestError ? cause : new RequestError({ operation, kind: 'http', cause }),
        })),
    ));
}
function shouldFallbackStoryRequest(error: unknown): boolean {
    if (!(error instanceof RequestError)) return true;
    if (error.requiresLogin === true || error.kind === 'network' || error.kind === 'timeout' || error.kind === 'server') return false;
    if (error.status == null) return error.kind === 'http';
    return [400, 404, 405, 410].includes(error.status);
}
export function getAppID(): string {
    if (typeof document !== 'undefined') {
        for (const script of document.querySelectorAll('script[type="application/json"]')) {
            const match = script.textContent?.match(/"APP_ID":"([0-9]+)"/i);
            if (match) return match[1];
        }
    }
    return '936619743392459';
}

const rawUserSchema = z.object({
    user: z.object({
        id: z.optional(z.string()),
        pk: z.optional(z.string()),
        username: z.string(),
        profile_pic_url: z.optional(z.string()),
    }),
});

function normalizeUserInfo(value: z.infer<typeof rawUserSchema>): UserInfo {
    const id = value.user.id ?? value.user.pk;
    if (!id) throw new Error('Instagram user response has no id');
    return z.parse(userInfoSchema, {
        user: {
            id,
            pk: value.user.pk ?? id,
            username: value.user.username,
            profile_pic_url: value.user.profile_pic_url ?? '',
        },
    });
}


/**
 * getHighlightStories
 * @description Get a list of all stories in highlight Id.
 *
 * @param  {Integer}  highlightId
 * @return {Object}
 */
export function getHighlightStories(highlightId: string, request?: Request): Promise<StoryResponse> {
    const modern = buildInstagramGraphQLRequest(getAppID(), highlightGraphQL, highlightVariables(highlightId));
    return requestPostedParsed('getHighlightStories', modern.url, modern.data, objectResponseSchema, modern.headers, request)
        .then(normalizeStoryResponse)
        .catch(error => {
            if (!shouldFallbackStoryRequest(error)) throw error;
            logger('getHighlightStories()', 'modern query failed; trying legacy query', error);
            const url = `https://www.instagram.com/graphql/query/?query_hash=45246d3fe16ccc6577e0bd297a5db1ab&variables=%7B%22highlight_reel_ids%22:%5B%22${encodeURIComponent(highlightId)}%22%5D,%22precomposed_overlay%22:false%7D`;
            return requestParsed('getHighlightStories', url, storyResponseSchema, undefined, request).then(normalizeStoryResponse);
        });
}

/**
 * getStories
 * @description Get a list of all stories in user Id.
 *
 * @param  {Integer}  userId
 * @return {Object}
 */
export function getStories(userId: string, request?: Request): Promise<StoryResponse> {
    const modern = buildInstagramGraphQLRequest(getAppID(), storyGraphQL, storyVariables(userId));
    return requestPostedParsed('getStories', modern.url, modern.data, objectResponseSchema, modern.headers, request)
        .then(normalizeStoryResponse)
        .catch(error => {
            if (!shouldFallbackStoryRequest(error)) throw error;
            logger('getStories()', 'modern query failed; trying legacy query', error);
            const url = `https://www.instagram.com/graphql/query/?query_hash=15463e8449a83d3d60b06be7e90627c7&variables=%7B%22reel_ids%22:%5B%22${encodeURIComponent(userId)}%22%5D,%22precomposed_overlay%22:false%7D`;
            return requestParsed('getStories', url, storyResponseSchema, undefined, request).then(normalizeStoryResponse);
        });
}

/**
 * getUserId
 * @description Get user's id with username.
 *
 * @param  {String}  username
 * @return {Promise<Integer>}
 */
export async function getUserId(username: string): Promise<UserInfo> {
    if (!username) throw new Error('Instagram username is missing');
    const cached = userIdCache.get(username);
    if (cached) return cached;
    const local = findLocalUserInfo(state.GL_dataCache, username) ?? getPageUserInfo(username);
    if (local) {
        userIdCache.set(username, local);
        return local;
    }

    const url = `https://www.instagram.com/web/search/topsearch/?query=${encodeURIComponent(username)}`;
    const searchSchema = z.object({ users: z.array(rawUserSchema) });
    const searchedUser = await requestParsed('getUserId', url, searchSchema).then(result => {
        const match = result.users.find(entry => entry.user.username.toLowerCase() === username.toLowerCase());
        if (!match) return null;
        const user = normalizeUserInfo(match);
        userIdCache.set(username, user);
        return user;
    }).catch(error => {
        logger('getUserId()', 'search failed', error);
        return null;
    });
    if (searchedUser) return searchedUser;

    const user = await getUserIdWithAgent(username);
    userIdCache.set(username, user);
    return user;
}

/** Get a user through Instagram's profile endpoint when search has no match. */
export async function getUserIdWithAgent(username: string): Promise<UserInfo> {
    const appId = getAppID();
    if (!appId) throw new Error('Instagram app id is missing');
    const url = `https://i.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`;
    const response = await requestParsed('getUserIdWithAgent', url,
        z.object({ data: rawUserSchema }), { 'X-IG-App-ID': appId });
    return normalizeUserInfo(response.data);
}

/**
 * getUserHighSizeProfile
 * @description Get user's high quality avatar image.
 *
 * @param  {Integer}  userId
 * @return {String}
 */
export async function getUserHighSizeProfile(userId: string): Promise<string> {
    const url = `https://www.instagram.com/api/v1/users/${userId}/info/`;
    const response = await requestParsed('getUserHighSizeProfile', url, z.object({
        status: z.string(),
        user: z.object({ hd_profile_pic_url_info: z.object({ url: z.string() }) }),
    }), {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; Pixel 7 XL)Build/RP1A.20845.002; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/5.0 Chrome/117.0.5938.60 Mobile Safari/537.36 Instagram 307.0.0.34.111',
    });
    if (response.status !== 'ok') throw new Error(`Instagram profile request returned ${response.status}`);
    return response.user.hd_profile_pic_url_info.url;
}

/** Get the owner name for a post shortcode. */
export async function getPostOwner(postPath: string, request: Request = GM_xmlhttpRequest): Promise<string> {
    assertInstagramPostShortcode(postPath);
    const embedded = getEmbeddedMedia(postPath);
    if (embedded?.owner.username) {
        rememberMediaOwner(embedded.owner);
        return embedded.owner.username;
    }

    const appId = getAppID();
    const url = `https://www.instagram.com/graphql/query/?query_hash=2c4c2e343a8f64c625ba02b2aa12c7f8&variables=%7B%22shortcode%22:%22${encodeURIComponent(postPath)}%22%7D`;
    const headers = {
        'User-Agent': MOBILE_USER_AGENT,
        ...(appId ? { 'X-IG-App-ID': appId } : {}),
    };
    return requestParsed('getPostOwner', url, z.object({
        data: z.object({ shortcode_media: z.object({ owner: z.object({ username: z.string() }) }) }),
    }), headers, request, true).then(response => response.data.shortcode_media.owner.username).catch(async error => {
        logger('getPostOwner()', 'legacy query failed; trying web-info', schemaIssuePaths(error) ?? error);
        const media = await getBlobMediaWithQueryID(postPath, request);
        if (!media.owner.username) throw new Error('Instagram web-info response did not include an owner');
        return media.owner.username;
    });
}

/**
 * getBlobMedia
 * @description Get list of all media files in post with post shortcode.
 *
 * @param  {String}  postPath
 * @return {Object}
 */
const MOBILE_USER_AGENT = 'Mozilla/5.0 (Linux; Android 10; Pixel 7 XL)Build/RP1A.20845.002; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/5.0 Chrome/117.0.5938.60 Mobile Safari/537.36 Instagram 307.0.0.34.111';

function normalizeModernMedia(value: z.infer<typeof modernMediaSchema>, fallbackUsername = ''): ModernMedia {
    const owner = value.owner ?? value.user;
    return { ...value, owner: owner ?? { username: fallbackUsername } };
}

function getEmbeddedMedia(postPath: string): ModernMedia | null {
    if (typeof document !== 'undefined') {
        for (const script of document.querySelectorAll('script[type="application/json"]')) {
            const text = script.textContent ?? '';
            if (!text.includes(postPath) || !/video_versions|image_versions2/.test(text)) continue;

            const data = Effect.runSync(Effect.try({
                try: (): unknown => JSON.parse(text),
                catch: () => null,
            }).pipe(Effect.catchCause(() => Effect.succeed(null))));
            const media = findEmbeddedMedia(data, postPath);
            if (media) return media;
        }
    }
    const domMedia = extractMediaFromDOM(postPath);
    if (domMedia && hasUsableModernMedia(domMedia)) {
        return domMedia;
    }
    return null;
}

function findEmbeddedMedia(value: unknown, postPath: string): ModernMedia | null {
    const pending: unknown[] = [value];
    const visited = new WeakSet<object>();

    for (let count = 0; pending.length && count < 10000; count++) {
        const node = pending.pop();
        if (!node || typeof node !== 'object' || visited.has(node)) continue;
        visited.add(node);

        if (Reflect.get(node, 'code') === postPath) {
            const parsed = z.safeParse(modernMediaSchema, node);
            if (parsed.success && hasUsableModernMedia(parsed.data)) {
                return normalizeModernMedia(parsed.data);
            }
        }

        pending.push(...Object.values(node).slice(0, 10000 - count - pending.length));
    }
    return null;
}

function hasUsableLegacyMedia(media: LegacyMedia): boolean {
    const items = media.__typename === 'GraphSidecar'
        ? media.edge_sidecar_to_children?.edges.map(edge => edge.node) ?? []
        : [media];
    return items.length > 0 && items.every(item => {
        if (!isMediaURL(item.display_resources[1]?.src)) return false;
        if (item.__typename === 'GraphVideo') return isMediaURL(item.video_url);
        return item.__typename === 'GraphImage' && isMediaURL(item.display_resources.at(-1)?.src);
    });
}

function hasUsableModernMedia(media: z.infer<typeof modernMediaSchema>): boolean {
    if (media.media_type === 8 && !media.carousel_media?.length) return false;
    const items = media.carousel_media ?? [media];
    return items.length > 0 && items.every(item => {
        if (!isMediaURL(item.image_versions2.candidates[0]?.url)) return false;
        if (item.media_type === 2 || item.video_versions != null) return isMediaURL(item.video_versions?.[0]?.url);
        return true;
    });
}

function isRateLimitError(error: unknown): boolean {
    if (error instanceof RequestError) return error.status === 429;
    return error instanceof Error && /rate.?limit|too many requests|please wait a few minutes/i.test(error.message);
}

function shouldRetryWithSession(error: unknown): boolean {
    if (isRateLimitError(error)) return true;
    if (error instanceof RequestError) {
        if (error.requiresLogin) return true;
        if (error.status != null) return [401, 403, 404].includes(error.status);
        return error.kind === 'http';
    }
    return true;
}

export async function getBlobMedia(postPath: string, request: Request = GM_xmlhttpRequest): Promise<BlobMediaResponse> {
    assertInstagramPostShortcode(postPath);
    const embeddedMedia = getEmbeddedMedia(postPath);
    if (embeddedMedia) {
        logger('getBlobMedia()', 'using media embedded in the Instagram page');
        rememberMediaOwner(embeddedMedia.owner);
        return { type: 'query_id', data: embeddedMedia };
    }

    const appId = getAppID();
    const url = `https://www.instagram.com/graphql/query/?query_hash=2c4c2e343a8f64c625ba02b2aa12c7f8&variables=%7B%22shortcode%22:%22${encodeURIComponent(postPath)}%22%7D`;
    const headers = {
        'User-Agent': MOBILE_USER_AGENT,
        ...(appId ? { 'X-IG-App-ID': appId } : {}),
    };
    const legacyData = await requestParsed('getBlobMedia', url, z.object({
            status: z.optional(z.string()),
            data: z.optional(z.unknown()),
        }), headers, request, true).then(response => response.status === 'fail'
        ? null
        : z.parse(z.object({ shortcode_media: legacyMediaSchema }), response.data)).catch(error => {
        logger('getBlobMedia()', 'legacy query failed; trying web-info', schemaIssuePaths(error) ?? error);
        return null;
    });
    if (!legacyData || !hasUsableLegacyMedia(legacyData.shortcode_media)) {
        return { type: 'query_id', data: await getBlobMediaWithQueryID(postPath, request) };
    }

    const legacyMedia = legacyData.shortcode_media;
    rememberMediaOwner(legacyMedia.owner);
    const legacyCarouselCount = legacyMedia.edge_sidecar_to_children?.edges.length ?? 0;

    if (legacyMedia.__typename === 'GraphSidecar' && legacyCarouselCount >= 10) {
        const modern = await getBlobMediaWithQueryID(postPath, request, legacyMedia.owner.username).then(modern => {
            if ((modern.carousel_media?.length ?? 1) > legacyCarouselCount) {
                return modern;
            }
            return null;
        }).catch(error => {
            logger('getBlobMedia()', 'query_id completeness fallback failed', schemaIssuePaths(error) ?? error);
            return null;
        });
        if (modern) return { type: 'query_id', data: modern };
    }

    return { type: 'query_hash', data: legacyData };
}

/** Get post media through the newer web-info query. */
export async function getBlobMediaWithQueryID(postPath: string, request: Request = GM_xmlhttpRequest, fallbackUsername = ''): Promise<ModernMedia> {
    assertInstagramPostShortcode(postPath);
    const appId = getAppID();
    const url = `https://www.instagram.com/graphql/query/?query_id=9496392173716084&variables={%22shortcode%22:%22${encodeURIComponent(postPath)}%22,%22__relay_internal__pv__PolarisFeedShareMenurelayprovider%22:true,%22__relay_internal__pv__PolarisIsLoggedInrelayprovider%22:true}`;
    const load = (anonymous: boolean) => requestParsed('getBlobMediaWithQueryID', url, z.object({
        status: z.optional(z.string()),
        message: z.optional(z.string()),
        feedback_message: z.optional(z.string()),
        data: z.optional(z.unknown()),
    }), {
        'User-Agent': MOBILE_USER_AGENT,
        ...(appId ? { 'X-IG-App-ID': appId } : {}),
    }, request, anonymous);
    const parseMedia = (response: Awaited<ReturnType<typeof load>>) => {
        if (response.status === 'fail') {
            throw new Error(`Instagram web-info request failed: ${response.message ?? response.feedback_message ?? 'unknown error'}`);
        }
        const payload = z.parse(z.object({
            xdt_api__v1__media__shortcode__web_info: z.object({ items: z.array(modernMediaSchema) }),
        }), response.data);
        const media = payload.xdt_api__v1__media__shortcode__web_info.items[0];
        if (!media || (media.code && media.code !== postPath) || !hasUsableModernMedia(media)) {
            throw new Error('Instagram web-info response did not include usable media for this post');
        }
        return media;
    };
    const media = await load(true).then(parseMedia).catch(error => {
        if (!shouldRetryWithSession(error)) throw error;
        logger('getBlobMediaWithQueryID()', 'anonymous media unavailable; retrying with current session', error);
        return load(false).then(parseMedia);
    });
    rememberMediaOwner(media.owner ?? media.user);
    return normalizeModernMedia(media, fallbackUsername);
}

function rememberMediaOwner(owner: unknown) {
    const info = userInfoFromOwner(owner);
    if (info) userIdCache.set(info.user.username, info);
}

/**
 * getMediaInfo
 * @description Get Instagram Media object.
 *
 * @param  {String}  mediaId
 * @return {Object}
 */
export function getMediaInfo(mediaId: string) {
    const appId = getAppID();
    if (!mediaId || !appId) {
        const message = !mediaId
            ? 'Cannot call Media API because the media id is invalid.'
            : 'Cannot call Media API because the app id is invalid.';
        logger('getMediaInfo()', 'reject', message);
        return Promise.reject(new Error(message));
    }

    const url = `https://i.instagram.com/api/v1/media/${mediaId}/info/`;
    const request = gmGet('getMediaInfo', url, {
        headers: {
            'User-Agent': window.navigator.userAgent,
            Accept: '*/*',
            'X-IG-App-ID': appId,
        },
    }).pipe(
        Effect.flatMap(response => Effect.try({
            try: () => {
                if (response.finalUrl !== url) {
                    const path = new URL(response.finalUrl).pathname;
                    throw new Error(path.startsWith('/accounts/login')
                        ? 'The account must be logged in to access Media API.'
                        : 'The Media API redirected the request.');
                }
                return z.parse(mediaInfoSchema, parseResponse(response));
            },
            catch: cause => new RequestError({ operation: 'getMediaInfo', kind: 'http', cause }),
        })),
    );

    return Effect.runPromise(request).then(result => {
        result.items.forEach(item => rememberMediaOwner(item.user));
        return result;
    }).catch(error => {
        logger('getMediaInfo()', 'reject', error);
        throw error;
    });
}

export function isMediaApiAuthError(error: unknown): boolean {
    return error instanceof RequestError && (error.requiresLogin === true || (error.cause instanceof Error &&
        error.cause.message === 'The account must be logged in to access Media API.'));
}
