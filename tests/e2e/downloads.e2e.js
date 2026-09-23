import { expect, test } from '@playwright/test';
import { VITE_URL, IgHelperE2E, registerE2E } from './harness.js';
const e2e = new IgHelperE2E();

test.describe('IG Helper browser E2E', () => {
    registerE2E(test, e2e);

    test.describe('UI', { tag: '@ui' }, () => {
        test('download progress bar updates and clears', async () => {
            const page = await e2e.context.newPage();
            try {
                await page.goto(`${VITE_URL}/src/shared/ui/status.jsx`, { waitUntil: 'domcontentloaded' });
                const result = await page.evaluate(async () => {
                    const { setDownloadProgress } = await import('/src/shared/ui/status.jsx?e2e-download-progress=1');
                    setDownloadProgress(0, 2);
                    const first = document.getElementById('ig-helper-download-progress')?.shadowRoot?.querySelector('.IG_DOWNLOAD_PROGRESS');
                    setDownloadProgress(1, 2);
                    const second = document.getElementById('ig-helper-download-progress')?.shadowRoot?.querySelector('.IG_DOWNLOAD_PROGRESS');
                    const text = second?.textContent;
                    setDownloadProgress(2, 2);
                    await new Promise(resolve => setTimeout(resolve, 300));
                    return {
                        reused: first === second,
                        text,
                        removed: !document.getElementById('ig-helper-download-progress'),
                    };
                });

                expect(result).toEqual({ reused: true, text: '1/2', removed: true });
            } finally {
                await page.close();
            }
        });
    });

    test.describe('Execution', { tag: '@execution' }, () => {
        test('download failures do not create a toast', async () => {
            const page = await e2e.context.newPage();
            try {
                await page.goto(`${VITE_URL}/src/shared/download.ts`, { waitUntil: 'domcontentloaded' });
                const result = await page.evaluate(async () => {
                    globalThis.GM_getResourceText = () => '{}';
                    globalThis.GM_getValue = (_key, fallback) => fallback;
                    globalThis.GM_setValue = () => {};
                    globalThis.GM_info = { script: { version: 'e2e' } };

                    const { saveFiles } = await import('/src/shared/download.ts?e2e-download-failure=1');
                    const originalFetch = globalThis.fetch;
                    globalThis.fetch = async () => new Response('', { status: 503 });

                    try {
                        const success = await saveFiles('https://example.invalid/fail.jpg', {
                            username: 'e2e',
                            sourceType: 'photo',
                            timestamp: Date.now(),
                            filetype: 'jpg',
                            shortcode: 'failure',
                        });
                        return {
                            success,
                            hasToast: Boolean(document.getElementById('ig-helper-download-status')),
                        };
                    } finally {
                        globalThis.fetch = originalFetch;
                    }
                });

                expect(result.success).toBe(false);
                expect(result.hasToast).toBe(false);
            } finally {
                await page.close();
            }
        });
    });

});
