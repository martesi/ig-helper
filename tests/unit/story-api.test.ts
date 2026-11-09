import { expect, mock, test } from 'bun:test';
import { normalizeStoryResponse } from '../../src/shared/instagram-data.ts';

mock.module('../../src/settings/state.ts', () => ({
    userIdCache: new Map(),
    state: { GL_logger: [] },
}));

const { getHighlightStories, getStories } = await import('../../src/shared/api.ts');

function modernStoryResponse() {
    return {
        data: {
            xdt_api__v1__feed__reels_media: {
                reels_media: [{
                    owner: { id: '7', pk: '7', username: 'alice', profile_pic_url: 'avatar' },
                    items: [{
                        id: 'story-1',
                        taken_at: 1700000000,
                        image_versions2: {
                            candidates: [
                                { url: 'https://cdn.example.test/high.jpg', width: 1080, height: 1920 },
                                { url: 'https://cdn.example.test/low.jpg', width: 320, height: 568 },
                            ],
                        },
                        video_versions: null,
                    }],
                }],
            },
        },
    };
}

function fakeRequest(replies: unknown[]) {
    const calls: Tampermonkey.Request[] = [];
    const request = (details: Tampermonkey.Request) => {
        calls.push(details);
        const reply = replies[calls.length - 1];
        const wrapped = reply && typeof reply === 'object' && 'body' in reply ? reply as { body: unknown; status?: number } : undefined;
        const body = wrapped?.body ?? reply ?? {};
        queueMicrotask(() => details.onload?.({
            status: wrapped?.status ?? 200,
            response: JSON.stringify(body),
            finalUrl: String(details.url),
        } as Tampermonkey.Response<object>));
        return { abort() {} };
    };
    return { request, calls };
}

test('normalizes the modern stories envelope and candidate URLs', () => {
    const response = normalizeStoryResponse(modernStoryResponse());
    const item = response.data.reels_media[0].items[0];

    expect(item.taken_at_timestamp).toBe(1700000000);
    expect(item.display_resources.map(resource => resource.src)).toEqual([
        'https://cdn.example.test/low.jpg',
        'https://cdn.example.test/high.jpg',
    ]);
    expect(item.is_video).toBe(false);
    expect(response.data.reels_media[0].owner.username).toBe('alice');
});

test('prefers the numeric pk when modern story ids are composite', () => {
    const payload = modernStoryResponse();
    payload.data.xdt_api__v1__feed__reels_media.reels_media[0].items[0] = {
        pk: '1234567890',
        id: '1234567890_7',
        taken_at: 1700000000,
        image_versions2: { candidates: [{ url: 'https://cdn.example.test/story.jpg', width: 640 }] },
        video_versions: null,
    };
    const response = normalizeStoryResponse(payload);

    expect(response.data.reels_media[0].items[0].id).toBe('1234567890');
});

test('rejects video stories without a usable video URL', () => {
    expect(() => normalizeStoryResponse({
        data: {
            xdt_api__v1__feed__reels_media: {
                reels_media: [{
                    owner: { username: 'alice' },
                    items: [{
                        id: 'video-1',
                        media_type: 2,
                        image_versions2: { candidates: [{ url: 'https://cdn.example.test/frame.jpg', width: 640 }] },
                        video_versions: null,
                        video_dash_manifest: 'manifest-only',
                    }],
                }],
            },
        },
    })).toThrow('usable video URL');
});

test('does not treat empty optional video fields as evidence of video', () => {
    const response = normalizeStoryResponse({
        data: {
            xdt_api__v1__feed__reels_media: {
                reels_media: [{
                    owner: { username: 'alice' },
                    items: [{
                        id: 'image-1',
                        is_video: false,
                        media_type: 1,
                        image_versions2: { candidates: [{ url: 'https://cdn.example.test/photo.jpg', width: 640 }] },
                        video_versions: [],
                        video_dash_manifest: '',
                    }],
                }],
            },
        },
    });

    expect(response.data.reels_media[0].items[0].is_video).toBe(false);
});

test('filters malformed modern URLs and rejects items without a usable preview', () => {
    const response = normalizeStoryResponse({
        data: {
            xdt_api__v1__feed__reels_media: {
                reels_media: [{
                    owner: { username: 'alice' },
                    items: [{
                        id: 'image-2',
                        image_versions2: {
                            candidates: [
                                { url: 'javascript:alert(1)', width: 1080 },
                                { url: 'not-a-url', width: 640 },
                                { url: 'https://cdn.example.test/valid.jpg', width: 320 },
                            ],
                        },
                        video_versions: null,
                    }],
                }],
            },
        },
    });
    expect(response.data.reels_media[0].items[0].display_resources.map(resource => resource.src)).toEqual([
        'https://cdn.example.test/valid.jpg',
    ]);

    expect(() => normalizeStoryResponse({
        data: {
            xdt_api__v1__feed__reels_media: {
                reels_media: [{
                    owner: { username: 'alice' },
                    items: [{
                        id: 'image-3',
                        image_versions2: { candidates: [{ url: 'not-a-url', width: 640 }] },
                        video_versions: null,
                    }],
                }],
            },
        },
    })).toThrow('preview image');

    expect(() => normalizeStoryResponse({
        data: {
            xdt_api__v1__feed__reels_media: {
                reels_media: [{
                    owner: { username: 'alice' },
                    items: [{
                        id: 'video-2',
                        image_versions2: { candidates: [{ url: 'https://cdn.example.test/frame.jpg', width: 640 }] },
                        video_versions: [{ url: 'javascript:alert(1)' }],
                    }],
                }],
            },
        },
    })).toThrow('usable video URL');
});

test('posts the current stories query and preserves the canonical caller shape', async () => {
    const fake = fakeRequest([modernStoryResponse()]);
    const response = await getStories('42', fake.request);
    const request = fake.calls[0];
    const data = request.data as FormData;

    expect(request.method).toBe('POST');
    expect(String(request.url)).toBe('https://www.instagram.com/graphql/query');
    expect(data.get('doc_id')).toBe('29170422829314651');
    expect(data.get('fb_api_req_friendly_name')).toBe('PolarisStoriesV3ReelPageStandaloneQuery');
    expect(JSON.parse(String(data.get('variables')))).toEqual({
        reel_ids_arr: ['42'],
        __relay_internal__pv__PolarisCommunityNoteStoriesLabelEnabledrelayprovider: true,
    });
    expect(response.data.reels_media[0].items[0].display_url).toBe('https://cdn.example.test/high.jpg');
});

test('normalizes the modern highlight connection and infers video items', async () => {
    const payload = {
        data: {
            xdt_api__v1__feed__reels_media__connection: {
                edges: [{
                    node: {
                        owner: { username: 'alice', pk: '7' },
                        items: [{
                            id: 'highlight-1',
                            taken_at: 1700000001,
                            image_versions2: { candidates: [{ url: 'https://cdn.example.test/frame.jpg', width: 640 }] },
                            video_versions: [{ url: 'https://cdn.example.test/video.mp4', width: 720 }],
                        }],
                    },
                }],
            },
        },
    };
    const fake = fakeRequest([payload]);
    const response = await getHighlightStories('99', fake.request);
    const item = response.data.reels_media[0].items[0];
    const data = fake.calls[0].data as FormData;

    expect(data.get('doc_id')).toBe('29299425373007309');
    expect(JSON.parse(String(data.get('variables')))).toMatchObject({
        initial_reel_id: 'highlight:99',
        reel_ids: ['highlight:99'],
        first: 999,
        last: 0,
    });
    expect(item.is_video).toBe(true);
    expect(item.video_resources[0]?.src).toBe('https://cdn.example.test/video.mp4');
});

test('falls back to the legacy story query when the modern response is unusable', async () => {
    const legacy = {
        data: {
            reels_media: [{
                owner: { username: 'alice', pk: '7' },
                items: [{
                    id: 'legacy-1',
                    taken_at_timestamp: 1700000002,
                    is_video: false,
                    display_url: 'https://cdn.example.test/legacy.jpg',
                    display_resources: [{ src: 'https://cdn.example.test/legacy.jpg', config_width: 640 }],
                    video_resources: [],
                }],
            }],
        },
    };
    const fake = fakeRequest([{ data: {} }, legacy]);
    const response = await getStories('42', fake.request);

    expect(fake.calls.map(call => call.method)).toEqual(['POST', 'GET']);
    expect(response.data.reels_media[0].items[0].id).toBe('legacy-1');
});

test('does not mask login or rate-limit failures with a legacy retry', async () => {
    const login = fakeRequest([{ body: { message: 'login_required' } }]);
    await expect(getStories('42', login.request)).rejects.toMatchObject({ requiresLogin: true });
    expect(login.calls).toHaveLength(1);

    const limited = fakeRequest([{ status: 429, body: {} }]);
    await expect(getHighlightStories('99', limited.request)).rejects.toMatchObject({ status: 429 });
    expect(limited.calls).toHaveLength(1);

    const payloadLimited = fakeRequest([{ body: { status: 'fail', message: 'Please wait a few minutes before you try again.' } }]);
    await expect(getStories('42', payloadLimited.request)).rejects.toMatchObject({ status: 429 });
    expect(payloadLimited.calls).toHaveLength(1);
});

test('rejects unsupported story envelopes instead of returning a partial cache entry', () => {
    expect(() => normalizeStoryResponse({ data: {} })).toThrow('supported reel');
    expect(() => normalizeStoryResponse({ data: { reels_media: [] } })).toThrow('any reel items');
    expect(() => normalizeStoryResponse({
        data: {
            xdt_api__v1__feed__reels_media: {
                reels_media: [{ owner: { username: 'alice' } }],
            },
        },
    })).toThrow('incomplete reel');
    expect(() => normalizeStoryResponse({
        data: {
            reels_media: [{
                owner: { username: 'alice' },
                items: [{
                    id: 'legacy-video',
                    taken_at_timestamp: 1700000000,
                    is_video: true,
                    display_url: 'https://cdn.example.test/frame.jpg',
                    display_resources: [{ src: 'https://cdn.example.test/frame.jpg', config_width: 640 }],
                    video_resources: [],
                }],
            }],
        },
    })).toThrow('usable video URL');
    expect(() => normalizeStoryResponse({
        data: {
            reels_media: [{
                owner: { username: 'alice' },
                items: [{
                    id: 'legacy-image',
                    taken_at_timestamp: 1700000000,
                    is_video: false,
                    display_url: 'https://cdn.example.test/frame.jpg',
                    display_resources: [{ src: 'not-a-url', config_width: 640 }],
                    video_resources: [],
                }],
            }],
        },
    })).toThrow('preview image');
});
