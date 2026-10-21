import { expect, mock, test } from 'bun:test';

// The Media API needs only this state; no browser DOM or Instagram cookies are required.
mock.module('../../src/settings/state.ts', () => ({
    userIdCache: new Map(),
    state: { GL_logger: [] },
}));
const { getBlobMedia, getBlobMediaWithQueryID } = await import('../../src/shared/api.ts');

const shortcode = 'DeitHxulGZK';
const videoURL = 'https://cdn.example.test/video.mp4';

function videoMedia(videoVersions: Array<{ url: string }> | null = [{ url: videoURL }]) {
    return {
        pk: '123', code: shortcode, taken_at: 1700000000,
        owner: { username: 'example' },
        media_type: 2,
        video_versions: videoVersions,
        image_versions2: { candidates: [{ url: 'https://cdn.example.test/thumb.jpg' }] },
    };
}

function webInfo(...items: unknown[]) {
    return { data: { xdt_api__v1__media__shortcode__web_info: { items } } };
}

function fakeRequests(...replies: Array<{ status?: number; body?: unknown }>) {
    const calls: Array<{ anonymous: boolean; url: string }> = [];
    const request = (details: Tampermonkey.Request) => {
        calls.push({ anonymous: details.anonymous === true, url: String(details.url) });
        const reply = replies[calls.length - 1];
        queueMicrotask(() => details.onload?.({
            status: reply?.status ?? 200,
            response: JSON.stringify(reply?.body ?? {}),
            finalUrl: String(details.url),
        } as Tampermonkey.Response<object>));
        return { abort() {} };
    };
    return { request, calls };
}

async function withFakePage<T>(action: () => Promise<T>): Promise<T> {
    const previousDocument = globalThis.document;
    globalThis.document = { querySelectorAll: () => [] } as unknown as Document;
    try {
        return await action();
    } finally {
        globalThis.document = previousDocument;
    }
}

function webRequest(request: ReturnType<typeof fakeRequests>['request']) {
    return withFakePage(() => getBlobMediaWithQueryID(shortcode, request));
}

test('public media is returned anonymously without touching the session', async () => {
    const fake = fakeRequests({ body: webInfo(videoMedia()) });
    const media = await webRequest(fake.request);
    expect(media.video_versions?.[0].url).toBe(videoURL);
    expect(fake.calls.map(call => call.anonymous)).toEqual([true]);
});

test('public images and mixed carousels remain anonymous', async () => {
    const image = { ...videoMedia(null), media_type: 1 };
    const carousel = { ...image, media_type: 8, carousel_media: [image, videoMedia()] };
    const fake = fakeRequests({ body: webInfo(image) }, { body: webInfo(carousel) });
    expect((await webRequest(fake.request)).image_versions2.candidates).toHaveLength(1);
    expect((await webRequest(fake.request)).carousel_media).toHaveLength(2);
    expect(fake.calls.map(call => call.anonymous)).toEqual([true, true]);
});

test('carousel without children does not silently become a photo', async () => {
    const incomplete = { ...videoMedia(null), media_type: 8 };
    const complete = { ...incomplete, carousel_media: [videoMedia()] };
    const fake = fakeRequests({ body: webInfo(incomplete) }, { body: webInfo(complete) });
    const media = await webRequest(fake.request);
    expect(media.carousel_media).toHaveLength(1);
    expect(fake.calls.map(call => call.anonymous)).toEqual([true, false]);
});

test('200 response without media retries with the current session', async () => {
    const fake = fakeRequests({ body: webInfo() }, { body: webInfo(videoMedia()) });
    const media = await webRequest(fake.request);
    expect(media.video_versions?.[0].url).toBe(videoURL);
    expect(fake.calls.map(call => call.anonymous)).toEqual([true, false]);
});

test.each([401, 403, 404])('HTTP %i retries once with session', async status => {
    const fake = fakeRequests({ status }, { body: webInfo(videoMedia()) });
    const media = await webRequest(fake.request);
    expect(media.video_versions?.[0].url).toBe(videoURL);
    expect(fake.calls.map(call => call.anonymous)).toEqual([true, false]);
});

test('malformed anonymous payload retries with session', async () => {
    const fake = fakeRequests({ body: { status: 'ok', data: {} } }, { body: webInfo(videoMedia()) });
    await webRequest(fake.request);
    expect(fake.calls.map(call => call.anonymous)).toEqual([true, false]);
});

test('HTTP 200 API rejection retries with session except when throttled', async () => {
    const denied = fakeRequests({ body: { status: 'fail', message: 'Media not available' } }, { body: webInfo(videoMedia()) });
    expect((await webRequest(denied.request)).video_versions?.[0].url).toBe(videoURL);
    expect(denied.calls.map(call => call.anonymous)).toEqual([true, false]);

    const throttled = fakeRequests({ body: { status: 'fail', message: 'Please wait a few minutes before you try again.' } });
    await expect(webRequest(throttled.request)).rejects.toThrow();
    expect(throttled.calls.map(call => call.anonymous)).toEqual([true]);
});

test('missing video versions are not accepted as a downloadable video', async () => {
    const fake = fakeRequests({ body: webInfo(videoMedia([])) }, { body: webInfo(videoMedia()) });
    const media = await webRequest(fake.request);
    expect(media.video_versions?.[0].url).toBe(videoURL);
    expect(fake.calls.map(call => call.anonymous)).toEqual([true, false]);
});

test('missing and invalid video URLs retry before accepting a download', async () => {
    const missing = fakeRequests({ body: webInfo(videoMedia(null)) }, { body: webInfo(videoMedia()) });
    expect((await webRequest(missing.request)).video_versions?.[0].url).toBe(videoURL);
    expect(missing.calls.map(call => call.anonymous)).toEqual([true, false]);

    const invalid = fakeRequests(
        { body: webInfo({ ...videoMedia(), video_versions: [{ url: 'javascript:alert(1)' }] }) },
        { body: webInfo(videoMedia()) },
    );
    expect((await webRequest(invalid.request)).video_versions?.[0].url).toBe(videoURL);
    expect(invalid.calls.map(call => call.anonymous)).toEqual([true, false]);
});

test('rate limits do not trigger authenticated retries', async () => {
    const fake = fakeRequests({ status: 429 }, { body: webInfo(videoMedia()) });
    await expect(webRequest(fake.request)).rejects.toThrow();
    expect(fake.calls.map(call => call.anonymous)).toEqual([true]);
});

test('denied session access stays an error instead of claiming the post is private', async () => {
    const fake = fakeRequests({ status: 403 }, { status: 403 });
    await expect(webRequest(fake.request)).rejects.toThrow();
    expect(fake.calls.map(call => call.anonymous)).toEqual([true, false]);
});

test('legacy denial retries modern media anonymously before using the session', async () => {
    const fake = fakeRequests(
        { status: 403 },
        { body: webInfo() },
        { body: webInfo(videoMedia()) },
    );
    const result = await withFakePage(() => getBlobMedia(shortcode, fake.request));
    expect(result.type).toBe('query_id');
    expect(fake.calls.map(call => call.anonymous)).toEqual([true, true, false]);
});

test('working legacy video still avoids the modern endpoint and session', async () => {
    const fake = fakeRequests({ body: {
        data: { shortcode_media: {
            __typename: 'GraphVideo', id: '123', shortcode, owner: { username: 'example' },
            taken_at_timestamp: 1700000000,
            video_url: videoURL,
            display_resources: [{ src: 'https://cdn.example.test/1.jpg' }, { src: 'https://cdn.example.test/2.jpg' }],
        } },
    } });
    const result = await withFakePage(() => getBlobMedia(shortcode, fake.request));
    expect(result.type).toBe('query_hash');
    expect(fake.calls.map(call => call.anonymous)).toEqual([true]);
});

test('legacy video without a video URL falls back to usable modern media', async () => {
    const fake = fakeRequests({ body: {
        data: { shortcode_media: {
            __typename: 'GraphVideo', id: '123', shortcode, owner: { username: 'example' },
            taken_at_timestamp: 1700000000,
            display_resources: [{ src: 'https://cdn.example.test/1.jpg' }, { src: 'https://cdn.example.test/2.jpg' }],
        } },
    } }, { body: webInfo(videoMedia()) });
    const result = await withFakePage(() => getBlobMedia(shortcode, fake.request));
    expect(result.type).toBe('query_id');
    expect(fake.calls.map(call => call.anonymous)).toEqual([true, true]);
});
