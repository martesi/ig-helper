import { expect, test } from '@playwright/test';
import { INSTAGRAM_HOME, PROFILE_URL, IgHelperE2E, registerE2E, requireAuthenticatedProfile } from './harness.js';
const e2e = new IgHelperE2E();

test.describe('IG Helper browser E2E', () => {

    test.describe('Authenticated UI', { tag: ['@ui', '@auth'] }, () => {
        requireAuthenticatedProfile(test, e2e);
        registerE2E(test, e2e);
        test('Story controls mount when the authenticated home feed exposes a live story', async () => {
            await e2e.goto(INSTAGRAM_HOME);
            const storyUrl = await e2e.evaluate(`(() => {
                const link = [...document.querySelectorAll('a[href^="/stories/"]')]
                    .find(anchor => !anchor.getAttribute('href')?.startsWith('/stories/highlights/'));
                return link ? new URL(link.href, location.origin).href : '';
            })()`);
            test.skip(!storyUrl, 'No live story is available in the authenticated feed');

            await e2e.withSettings({ SHOW_OPEN_IN_NEW_TAB_BUTTON: false }, async () => {
                await e2e.page.setViewportSize({ width: 390, height: 844 });
                await e2e.goto(storyUrl);
                await e2e.waitFor(`document.querySelector('.IG_STORY_CONTROL_BAR')?.shadowRoot?.querySelector('.IG_DW_MAIN')`, 15000);
                const mobile = await e2e.json(`(() => {
                    const host = document.querySelector('.IG_STORY_CONTROL_BAR');
                    const root = host?.shadowRoot;
                    const like = host?.parentElement?.querySelector('svg[aria-label="Like"]');
                    const download = root?.querySelector('.IG_DW_MAIN');
                    return {
                        download: Boolean(download),
                        newTab: Boolean(root?.querySelector('.IG_NEWTAB_MAIN')),
                        sameRow: Boolean(host && like && host.parentElement.querySelector('svg[aria-label="Direct"]')),
                        sameColor: Boolean(like && getComputedStyle(host).color === getComputedStyle(like).color),
                        pointer: download ? getComputedStyle(download).cursor : '',
                    };
                })()`);
                expect(mobile.download).toBe(true);
                expect(mobile.newTab).toBe(false);
                expect(mobile.sameRow).toBe(true);
                expect(mobile.sameColor).toBe(true);
                expect(mobile.pointer).toBe('pointer');
            });

            await e2e.page.setViewportSize({ width: 1280, height: 900 });
            await e2e.withSettings({ SHOW_OPEN_IN_NEW_TAB_BUTTON: true }, async () => {
                await e2e.goto(storyUrl);
                await e2e.waitFor(`document.querySelector('.IG_STORY_CONTROL_BAR')?.shadowRoot?.querySelector('.IG_NEWTAB_MAIN')`, 15000);
                expect(await e2e.json(`Boolean(document.querySelector('.IG_STORY_CONTROL_BAR')?.shadowRoot?.querySelector('.IG_NEWTAB_MAIN'))`)).toBe(true);
            });
        });

        test('Highlight controls mount when the profile exposes a highlight', async () => {
            await e2e.goto(PROFILE_URL);
            const highlightUrl = await e2e.evaluate(`(() => {
                const link = document.querySelector('a[href^="/stories/highlights/"]');
                return link ? new URL(link.href, location.origin).href : '';
            })()`);
            test.skip(!highlightUrl, 'No highlight is available on the configured profile');

            await e2e.goto(highlightUrl);
            await e2e.waitFor(`document.querySelector('.IG_HIGHLIGHT_CONTROL_BAR')?.shadowRoot?.querySelector('.IG_DW_MAIN')`, 15000);
            expect(await e2e.json(`Boolean(document.querySelector('.IG_HIGHLIGHT_CONTROL_BAR')?.shadowRoot?.querySelector('.IG_DW_MAIN'))`)).toBe(true);
            expect(await e2e.json(`Boolean(document.querySelector('.IG_HIGHLIGHT_CONTROL_BAR')?.shadowRoot?.querySelector('.IG_NEWTAB_MAIN'))`)).toBe(true);
        });
    });

});
