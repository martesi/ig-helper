import * as z from 'zod/mini';
import { mediaOwnerSchema } from './local-user';

const imageResource = z.object({
    src: z.string(),
    config_width: z.number(),
});

const storyItem = z.object({
    id: z.string(),
    taken_at_timestamp: z.number(),
    is_video: z.boolean(),
    display_url: z.string(),
    display_resources: z.array(imageResource),
    video_resources: z.prefault(z.array(z.object({ src: z.string() })), []),
});

export const storyResponseSchema = z.object({
    data: z.object({
        reels_media: z.array(z.object({
            items: z.array(storyItem),
            owner: mediaOwnerSchema,
            user: z.optional(mediaOwnerSchema),
        })),
    }),
});

export type StoryResponse = z.infer<typeof storyResponseSchema>;
export type StoryItem = StoryResponse['data']['reels_media'][number]['items'][number];

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | null {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as UnknownRecord : null;
}

function asArray(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
}

function asString(value: unknown, fallback = ''): string {
    return typeof value === 'string' ? value : typeof value === 'number' ? String(value) : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() !== '') {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) return parsed;
    }
    return fallback;
}

function isUsableURL(value: string): boolean {
    return URL.canParse(value) && /^https?:$/.test(new URL(value).protocol);
}

function normalizeOwner(value: unknown): z.infer<typeof mediaOwnerSchema> {
    const owner = asRecord(value);
    const username = asString(owner?.username);
    if (!username) throw new Error('Instagram story response has no owner username');
    return {
        username,
        id: owner?.id == null ? null : owner.id as string | number,
        pk: owner?.pk == null ? null : owner.pk as string | number,
        profile_pic_url: owner?.profile_pic_url == null ? null : asString(owner.profile_pic_url),
    };
}

function normalizeImageResources(value: unknown): Array<{ src: string; config_width: number }> {
    const resources = asArray(value).map(candidate => {
        const item = asRecord(candidate);
        const src = asString(item?.src ?? item?.url);
        return { src, config_width: asNumber(item?.config_width ?? item?.width) };
    }).filter(resource => isUsableURL(resource.src));
    return resources.sort((left, right) => left.config_width - right.config_width);
}

function normalizeVideoResources(value: unknown): Array<{ src: string }> {
    const resources = asArray(value).map(candidate => {
        const item = asRecord(candidate);
        return { src: asString(item?.src ?? item?.url) };
    }).filter(resource => isUsableURL(resource.src));
    return resources;
}

function normalizeStoryItem(value: unknown): StoryItem {
    const item = asRecord(value) ?? {};
    const id = asString(item.pk) || asString(item.id);
    if (!id) throw new Error('Instagram story response has an item without an id');
    const imageVersions = asRecord(item.image_versions2);
    const displayResources = normalizeImageResources(item.display_resources ?? imageVersions?.candidates);
    const videoResources = normalizeVideoResources(item.video_resources ?? item.video_versions);
    const hasVideoVersions = Array.isArray(item.video_versions) && item.video_versions.length > 0;
    const mediaType = asNumber(item.media_type, 0);
    const hasVideoManifest = typeof item.video_dash_manifest === 'string' && item.video_dash_manifest.length > 0;
    const isVideo = item.is_video === true || hasVideoVersions || videoResources.length > 0 || mediaType === 2 || hasVideoManifest;
    const displayUrl = isUsableURL(asString(item.display_url)) ? asString(item.display_url) : displayResources.at(-1)?.src || '';
    if (!displayResources.length) throw new Error(`Instagram story item ${id} has no preview image`);
    if (isVideo && !videoResources.length) {
        throw new Error(`Instagram story item ${id} has no usable video URL`);
    }

    return {
        id,
        taken_at_timestamp: asNumber(item.taken_at_timestamp ?? item.taken_at),
        is_video: isVideo,
        display_url: displayUrl,
        display_resources: displayResources,
        video_resources: videoResources,
    };
}

function normalizeReel(value: unknown): StoryResponse['data']['reels_media'][number] {
    const reel = asRecord(value) ?? {};
    if (!Array.isArray(reel.items) || reel.items.length === 0) {
        throw new Error('Instagram story response has an incomplete reel');
    }
    const ownerValue = reel.owner ?? reel.user;
    const owner = normalizeOwner(ownerValue);
    const user = reel.user == null ? undefined : normalizeOwner(reel.user);
    return {
        items: asArray(reel.items).map(normalizeStoryItem),
        owner,
        ...(user ? { user } : {}),
    };
}

function validateStoryResponse(response: StoryResponse): StoryResponse {
    if (response.data.reels_media.length === 0) throw new Error('Instagram story response did not include any reel items');
    for (const reel of response.data.reels_media) {
        if (reel.items.length === 0) throw new Error('Instagram story response has an incomplete reel');
        for (const item of reel.items) {
            if (!item.id) throw new Error('Instagram story response has an item without an id');
            if (!isUsableURL(item.display_url) || item.display_resources.length === 0 || item.display_resources.some(resource => !isUsableURL(resource.src))) {
                throw new Error(`Instagram story item ${item.id} has no preview image`);
            }
            if (item.is_video && item.video_resources.length === 0) {
                throw new Error(`Instagram story item ${item.id} has no usable video URL`);
            }
            if (item.video_resources.some(resource => !isUsableURL(resource.src))) {
                throw new Error(`Instagram story item ${item.id} has no usable video URL`);
            }
        }
    }
    return response;
}

/**
 * Normalize both the retired query-hash response and the current Relay
 * response to the shape used by the story and highlight features.
 */
export function normalizeStoryResponse(value: unknown): StoryResponse {
    const legacy = z.safeParse(storyResponseSchema, value);
    if (legacy.success) {
        const sanitized = {
            data: {
                reels_media: legacy.data.data.reels_media.map(reel => ({
                    ...reel,
                    items: reel.items.map(item => {
                        const displayResources = item.display_resources.filter(resource => isUsableURL(resource.src));
                        return {
                            ...item,
                            display_url: isUsableURL(item.display_url) ? item.display_url : displayResources.at(-1)?.src || '',
                            display_resources: displayResources,
                            video_resources: item.video_resources.filter(resource => isUsableURL(resource.src)),
                        };
                    }),
                })),
            },
        };
        return validateStoryResponse(z.parse(storyResponseSchema, sanitized));
    }

    const root = asRecord(asRecord(value)?.data);
    const legacyReels = asArray(root?.reels_media);
    if (legacyReels.length > 0) {
        return validateStoryResponse(z.parse(storyResponseSchema, { data: { reels_media: legacyReels.map(normalizeReel) } }));
    }

    const modernStories = asRecord(root?.xdt_api__v1__feed__reels_media);
    const storyReel = asArray(modernStories?.reels_media)[0];
    if (storyReel) {
        return validateStoryResponse(z.parse(storyResponseSchema, { data: { reels_media: [normalizeReel(storyReel)] } }));
    }

    const modernHighlights = asRecord(root?.xdt_api__v1__feed__reels_media__connection);
    const highlightEdge = asRecord(asArray(modernHighlights?.edges)[0]);
    const highlightReel = highlightEdge?.node;
    if (highlightReel) {
        return validateStoryResponse(z.parse(storyResponseSchema, { data: { reels_media: [normalizeReel(highlightReel)] } }));
    }

    throw new Error('Instagram story response did not include a supported reel');
}

const mediaCandidate = z.object({
    url: z.string(),
    width: z.optional(z.number()),
    height: z.optional(z.number()),
});

const mediaImageVersions = z.object({ candidates: z.array(mediaCandidate) });
const fallbackMediaImageVersions = { candidates: [] };
const carouselMediaSchema = z.object({
    pk: z.prefault(z.string(), ''),
    taken_at: z.prefault(z.number(), 0),
    media_type: z.optional(z.number()),
    video_dash_manifest: z.nullish(z.string()),
    video_versions: z.nullish(z.array(mediaCandidate)),
    image_versions2: z.prefault(mediaImageVersions, fallbackMediaImageVersions),
});

export const mediaInfoSchema = z.object({
    status: z.string(),
    message: z.optional(z.string()),
    items: z.prefault(z.array(z.object({
        id: z.string(),
        taken_at: z.number(),
        code: z.optional(z.string()),
        product_type: z.optional(z.string()),
        user: z.nullish(mediaOwnerSchema),
        video_dash_manifest: z.optional(z.string()),
        video_versions: z.optional(z.array(mediaCandidate)),
        image_versions2: z.object({ candidates: z.array(mediaCandidate) }),
    })), []),
});

export type MediaInfoResponse = z.infer<typeof mediaInfoSchema>;

export const userInfoSchema = z.object({
    user: z.object({
        id: z.string(),
        pk: z.string(),
        username: z.string(),
        profile_pic_url: z.string(),
    }),
});

export type UserInfo = z.infer<typeof userInfoSchema>;

const graphImage = z.object({ src: z.string() });
const graphChild = z.object({
    __typename: z.string(),
    id: z.string(),
    video_url: z.optional(z.string()),
    video_dash_manifest: z.optional(z.string()),
    display_resources: z.array(graphImage),
});

export const legacyMediaSchema = z.object({
    __typename: z.string(),
    id: z.string(),
    shortcode: z.string(),
    owner: mediaOwnerSchema,
    taken_at_timestamp: z.number(),
    is_video: z.optional(z.boolean()),
    video_url: z.optional(z.string()),
    video_dash_manifest: z.optional(z.string()),
    display_resources: z.array(graphImage),
    edge_sidecar_to_children: z.optional(z.object({
        edges: z.array(z.object({ node: graphChild })),
    })),
});

export type LegacyMedia = z.infer<typeof legacyMediaSchema>;
export type LegacyMediaRoot = { shortcode_media: LegacyMedia };

export const modernMediaSchema = z.object({
    pk: z.prefault(z.string(), ''),
    code: z.prefault(z.string(), ''),
    taken_at: z.prefault(z.number(), 0),
    media_type: z.optional(z.number()),
    owner: z.nullish(mediaOwnerSchema),
    user: z.nullish(mediaOwnerSchema),
    video_dash_manifest: z.nullish(z.string()),
    video_versions: z.nullish(z.array(mediaCandidate)),
    image_versions2: z.prefault(mediaImageVersions, fallbackMediaImageVersions),
    carousel_media: z.nullish(z.array(carouselMediaSchema)),
});

export type ModernMedia = Omit<z.infer<typeof modernMediaSchema>, 'owner'> & {
    owner: z.infer<typeof mediaOwnerSchema>;
};
export type BlobMediaResponse =
    | { type: 'query_hash'; data: LegacyMediaRoot }
    | { type: 'query_id'; data: ModernMedia };
