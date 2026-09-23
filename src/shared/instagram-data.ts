import * as z from 'zod/mini';

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
            owner: z.object({ username: z.string() }),
            user: z.optional(z.object({ username: z.string() })),
        })),
    }),
});

export type StoryResponse = z.infer<typeof storyResponseSchema>;
export type StoryItem = StoryResponse['data']['reels_media'][number]['items'][number];

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
    video_dash_manifest: z.optional(z.string()),
    video_versions: z.optional(z.array(mediaCandidate)),
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
    owner: z.object({ username: z.string() }),
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
    owner: z.optional(z.object({ username: z.string() })),
    user: z.optional(z.object({ username: z.string() })),
    video_dash_manifest: z.optional(z.string()),
    video_versions: z.optional(z.array(mediaCandidate)),
    image_versions2: z.prefault(mediaImageVersions, fallbackMediaImageVersions),
    carousel_media: z.optional(z.array(carouselMediaSchema)),
});

export type ModernMedia = Omit<z.infer<typeof modernMediaSchema>, 'owner'> & {
    owner: { username: string };
};
export type BlobMediaResponse =
    | { type: 'query_hash'; data: LegacyMediaRoot }
    | { type: 'query_id'; data: ModernMedia };
