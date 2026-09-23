import { userIdCache } from "../settings/state";
import { updateLoadingBar } from "./ui/status.tsx";
import { logger } from "./logger";
import * as z from "zod/mini";
import { Effect } from 'effect';
import { gmGet, RequestError } from './transport.ts';
import type { Request } from './transport.ts';
import { assertInstagramPostShortcode } from './instagram-path.ts';
import { legacyMediaSchema, mediaInfoSchema, modernMediaSchema, storyResponseSchema, userInfoSchema } from './instagram-data.ts';
import type { BlobMediaResponse, LegacyMediaRoot, ModernMedia, StoryResponse, UserInfo } from './instagram-data.ts';

const objectResponseSchema = z.record(z.string(), z.unknown());

function parseResponse(response: Tampermonkey.Response<object>) {
    return z.parse(objectResponseSchema, JSON.parse(response.response));
}
function schemaIssuePaths(error: unknown): unknown[] | undefined {
    if (typeof error !== 'object' || error === null || !('issues' in error) || !Array.isArray(error.issues)) return undefined;
    return error.issues.map(issue => typeof issue === 'object' && issue !== null && 'path' in issue ? JSON.stringify(issue.path) : undefined);
}
function requestParsed<T extends z.ZodMiniType>(operation: string, url: string, schema: T, headers?: Record<string, string>, request?: Request) {
    return Effect.runPromise(gmGet(operation, url, { headers, request }).pipe(
        Effect.flatMap(response => Effect.try({
            try: () => z.parse(schema, parseResponse(response)),
            catch: cause => new RequestError({ operation, kind: 'http', cause }),
        })),
    ));
}
function getAppID() {
    for (const script of document.querySelectorAll('script[type="application/json"]')) {
        const match = script.textContent?.match(/"APP_ID":"([0-9]+)"/i);
        if (match) return match[1];
    }
    return null;
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
export function getHighlightStories(highlightId: string): Promise<StoryResponse> {
    const url = `https://www.instagram.com/graphql/query/?query_hash=45246d3fe16ccc6577e0bd297a5db1ab&variables=%7B%22highlight_reel_ids%22:%5B%22${highlightId}%22%5D,%22precomposed_overlay%22:false%7D`;
    return requestParsed('getHighlightStories', url, storyResponseSchema);
}

/**
 * getStories
 * @description Get a list of all stories in user Id.
 *
 * @param  {Integer}  userId
 * @return {Object}
 */
export function getStories(userId: string): Promise<StoryResponse> {
    const url = `https://www.instagram.com/graphql/query/?query_hash=15463e8449a83d3d60b06be7e90627c7&variables=%7B%22reel_ids%22:%5B%22${userId}%22%5D,%22precomposed_overlay%22:false%7D`;
    return requestParsed('getStories', url, storyResponseSchema);
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

    const url = `https://www.instagram.com/web/search/topsearch/?query=${encodeURIComponent(username)}`;
    const searchSchema = z.object({ users: z.array(rawUserSchema) });
    try {
        const result = await requestParsed('getUserId', url, searchSchema);
        const match = result.users.find(entry => entry.user.username.toLowerCase() === username.toLowerCase());
        if (match) {
            const user = normalizeUserInfo(match);
            userIdCache.set(username, user);
            return user;
        }
    } catch (error) {
        logger('getUserId()', 'search failed', error);
    }

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
export async function getPostOwner(postPath: string): Promise<string> {
    assertInstagramPostShortcode(postPath);
    const url = `https://www.instagram.com/graphql/query/?query_hash=2c4c2e343a8f64c625ba02b2aa12c7f8&variables=%7B%22shortcode%22:%22${encodeURIComponent(postPath)}%22%7D`;
    const response = await requestParsed('getPostOwner', url, z.object({
        data: z.object({ shortcode_media: z.object({ owner: z.object({ username: z.string() }) }) }),
    }));
    return response.data.shortcode_media.owner.username;
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

export async function getBlobMedia(postPath: string, request: Request = GM_xmlhttpRequest): Promise<BlobMediaResponse> {
    assertInstagramPostShortcode(postPath);
    const url = `https://www.instagram.com/graphql/query/?query_hash=2c4c2e343a8f64c625ba02b2aa12c7f8&variables=%7B%22shortcode%22:%22${encodeURIComponent(postPath)}%22%7D`;
    const response = await requestParsed('getBlobMedia', url, z.object({
        status: z.optional(z.string()),
        data: z.optional(z.unknown()),
    }), { 'User-Agent': MOBILE_USER_AGENT }, request);

    if (response.status === 'fail') {
        return { type: 'query_id', data: await getBlobMediaWithQueryID(postPath, request) };
    }
    const carouselSummary = z.parse(z.object({
        shortcode_media: z.object({
            __typename: z.string(),
            owner: z.optional(z.object({ username: z.string() })),
            edge_sidecar_to_children: z.optional(z.object({ edges: z.array(z.unknown()) })),
        }),
    }), response.data).shortcode_media;
    const legacyCarouselCount = carouselSummary.edge_sidecar_to_children?.edges.length ?? 0;

    if (carouselSummary.__typename === 'GraphSidecar' && legacyCarouselCount >= 10) {
        try {
            const modern = await getBlobMediaWithQueryID(postPath, request, carouselSummary.owner?.username);
            if ((modern.carousel_media?.length ?? 1) > legacyCarouselCount) {
                return { type: 'query_id', data: modern };
            }
        } catch (error) {
            logger('getBlobMedia()', 'query_id completeness fallback failed', schemaIssuePaths(error) ?? error);
        }
    }

    const legacyData: LegacyMediaRoot = z.parse(z.object({ shortcode_media: legacyMediaSchema }), response.data);
    return { type: 'query_hash', data: legacyData };
}

/** Get post media through the newer web-info query. */
export async function getBlobMediaWithQueryID(postPath: string, request: Request = GM_xmlhttpRequest, fallbackUsername = ''): Promise<ModernMedia> {
    assertInstagramPostShortcode(postPath);
    const appId = getAppID();
    const url = `https://www.instagram.com/graphql/query/?query_id=9496392173716084&variables={%22shortcode%22:%22${encodeURIComponent(postPath)}%22,%22__relay_internal__pv__PolarisFeedShareMenurelayprovider%22:true,%22__relay_internal__pv__PolarisIsLoggedInrelayprovider%22:true}`;
    const response = await requestParsed('getBlobMediaWithQueryID', url, z.object({
        status: z.optional(z.string()),
        message: z.optional(z.string()),
        feedback_message: z.optional(z.string()),
        data: z.optional(z.unknown()),
    }), {
        'User-Agent': MOBILE_USER_AGENT,
        ...(appId ? { 'X-IG-App-ID': appId } : {}),
    }, request);

    if (response.status === 'fail') {
        throw new Error(`Instagram web-info request failed: ${response.message ?? response.feedback_message ?? 'unknown error'}`);
    }
    const payload = z.parse(z.object({
        xdt_api__v1__media__shortcode__web_info: z.object({ items: z.array(modernMediaSchema) }),
    }), response.data);
    const media = payload.xdt_api__v1__media__shortcode__web_info.items[0];
    if (!media) throw new Error('Instagram web-info response did not include media');
    return normalizeModernMedia(media, fallbackUsername);
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
        alert(message);
        logger('getMediaInfo()', 'reject', message);
        updateLoadingBar(false);
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

    return Effect.runPromise(request).catch(error => {
        logger('getMediaInfo()', 'reject', error);
        if (error instanceof RequestError && error.cause instanceof Error &&
            error.cause.message === 'The account must be logged in to access Media API.') {
            alert(error.cause.message);
        }
        updateLoadingBar(false);
        throw error;
    });
}
