import { expect, test } from '@playwright/test';
import { VITE_URL, IgHelperE2E, registerE2E } from './harness.js';
const e2e = new IgHelperE2E();

test.describe('IG Helper browser E2E', () => {
    registerE2E(test, e2e);

    test.describe('Execution', { tag: '@execution' }, () => {
        test('legacy 10-item carousel is completed from the current web-info response', async () => {
            const page = await e2e.context.newPage();
            try {
                await page.goto(`${VITE_URL}/src/shared/api.js`, { waitUntil: 'domcontentloaded' });
                const result = await page.evaluate(async () => {
                    globalThis.GM_getResourceText = () => '{}';
                    globalThis.GM_getValue = (_key, fallback) => fallback;

                    const image = { src: 'https://example.test/image.jpg' };
                    const legacyItems = Array.from({ length: 10 }, (_, index) => ({
                        node: { __typename: 'GraphImage', id: `legacy-${index}`, display_resources: [image] },
                    }));
                    const currentItems = Array.from({ length: 12 }, (_, index) => ({
                        pk: `current-${index}`,
                        taken_at: 1700000000,
                        video_dash_manifest: null,
                        video_versions: null,
                        image_versions2: { candidates: [{ url: image.src }] },
                    }));
                    const requests = [];
                    const request = options => {
                        requests.push(options.url);
                        const response = options.url.includes('query_hash=')
                            ? {
                                status: 'ok',
                                data: {
                                    shortcode_media: {
                                        __typename: 'GraphSidecar',
                                        id: 'legacy-post',
                                        shortcode: 'synthetic-carousel',
                                        owner: { username: 'example' },
                                        taken_at_timestamp: 1700000000,
                                        display_resources: [image],
                                        edge_sidecar_to_children: { edges: legacyItems },
                                    },
                                },
                            }
                            : {
                                status: 'ok',
                                data: {
                                    xdt_api__v1__media__shortcode__web_info: {
                                        items: [{ carousel_media: currentItems }],
                                    },
                                },
                            };
                        queueMicrotask(() => options.onload({ response: JSON.stringify(response), finalUrl: options.url }));
                        return { abort() {} };
                    };
                    const { getBlobMedia } = await import('/src/shared/api.js?e2e-long-carousel=1');
                    const media = await getBlobMedia('synthetic-carousel', request);
                    return {
                        type: media.type,
                        count: media.data.carousel_media?.length ?? 0,
                        requests: requests.length,
                    };
                });

                expect(result).toEqual({ type: 'query_id', count: 12, requests: 2 });
            } finally {
                await page.close();
            }
        });

        test('legacy HTML redirect falls back to web-info media', async () => {
            const page = await e2e.context.newPage();
            try {
                await page.goto(`${VITE_URL}/src/shared/api.js`, { waitUntil: 'domcontentloaded' });
                const result = await page.evaluate(async () => {
                    globalThis.GM_getValue = (_key, fallback) => fallback;

                    const requests = [];
                    const request = options => {
                        requests.push(options.url);
                        const response = options.url.includes('query_hash=')
                            ? '<!DOCTYPE html><html></html>'
                            : JSON.stringify({
                                status: 'ok',
                                data: { xdt_api__v1__media__shortcode__web_info: { items: [{
                                    pk: '123',
                                    code: 'synthetic-post',
                                    taken_at: 1700000000,
                                    owner: { username: 'example' },
                                    video_dash_manifest: null,
                                    video_versions: null,
                                    image_versions2: { candidates: [{ url: 'https://example.test/image.jpg' }] },
                                }] } },
                            });
                        queueMicrotask(() => options.onload({ response, status: 200, finalUrl: options.url }));
                        return { abort() {} };
                    };
                    const { getBlobMedia, getPostOwner } = await import('/src/shared/api.js?e2e-html-fallback=1');
                    const media = await getBlobMedia('synthetic-post', request);
                    const owner = await getPostOwner('synthetic-post', request);
                    return { type: media.type, code: media.data.code, owner, requests: requests.length };
                });

                expect(result).toEqual({ type: 'query_id', code: 'synthetic-post', owner: 'example', requests: 4 });
            } finally {
                await page.close();
            }
        });

        test('invalid post paths reject before issuing requests', async () => {
            const page = await e2e.context.newPage();
            try {
                await page.goto(`${VITE_URL}/src/shared/api.js`, { waitUntil: 'domcontentloaded' });
                const result = await page.evaluate(async () => {
                    globalThis.GM_getResourceText = () => '{}';
                    globalThis.GM_getValue = (_key, fallback) => fallback;

                    let requests = 0;
                    const request = () => { requests += 1; };
                    globalThis.GM_xmlhttpRequest = request;

                    const { getBlobMedia, getBlobMediaWithQueryID, getPostOwner } =
                        await import('/src/shared/api.js?e2e-invalid-path=1');

                    const rejected = [];
                    for (const call of [
                        () => getPostOwner(''),
                        () => getBlobMedia('', request),
                        () => getBlobMediaWithQueryID('', request),
                    ]) {
                        try {
                            await call();
                        } catch (error) {
                            rejected.push(error instanceof Error && error.message === 'NOPATH');
                        }
                    }

                    return { requests, rejected };
                });

                expect(result).toEqual({ requests: 0, rejected: [true, true, true] });
            } finally {
                await page.close();
            }
        });

        test('GM download failures propagate to saveFiles', async () => {
            const page = await e2e.context.newPage();
            try {
                await page.goto(`${VITE_URL}/src/shared/download.js`, { waitUntil: 'domcontentloaded' });
                const result = await page.evaluate(async () => {
                    globalThis.GM_getResourceText = () => '{}';
                    globalThis.GM_getValue = (_key, fallback) => fallback;
                    globalThis.GM_setValue = () => {};
                    globalThis.GM_info = { script: { version: 'e2e' } };
                    globalThis.GM_download = options => queueMicrotask(() => options.onerror(new Error('blocked')));

                    const { USER_SETTING } = await import('/src/settings/state.js?e2e-gm-download-state=1');
                    USER_SETTING.USE_EXTERNAL_DOWNLOAD_MODE = true;
                    const { saveFiles } = await import('/src/shared/download.js?e2e-gm-download-failure=1');

                    return saveFiles('https://example.invalid/file.jpg', {
                        username: 'e2e',
                        sourceType: 'photo',
                        timestamp: Date.now(),
                        filetype: 'jpg',
                        shortcode: '',
                    });
                });

                expect(result).toBe(false);
            } finally {
                await page.close();
            }
        });
    });

});
