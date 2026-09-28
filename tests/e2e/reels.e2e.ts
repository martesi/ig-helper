import { expect, test } from '@playwright/test';
import { PROFILE_URL, IgHelperE2E, registerE2E, requireAuthenticatedProfile } from './harness.ts';
const e2e = new IgHelperE2E();

test.describe('IG Helper browser E2E', () => {
    registerE2E(test, e2e);

    test.describe('UI', { tag: '@ui' }, () => {
        test('profile reel permalink mounts post controls without a feed', async () => {
            await e2e.goto(PROFILE_URL);
            const reelUrl = await e2e.evaluate(`(() => {
                const link = document.querySelector('a[href*="/reel/"]');
                return link ? new URL(link.href, location.origin).href : '';
            })()`);
            expect(reelUrl).toBeTruthy();

            await e2e.withSettings({ SHOW_OPEN_IN_NEW_TAB_BUTTON: true }, async () => {
                await e2e.goto(reelUrl);
                await e2e.waitFor(`document.querySelector('.button_wrapper.IG_CONTROL_BAR')?.shadowRoot?.querySelector('.IG_DW_MAIN')`, 15000);
                const controls = await e2e.json(`(() => {
                    const root = document.querySelector('.button_wrapper.IG_CONTROL_BAR')?.shadowRoot;
                    return {
                        download: Boolean(root?.querySelector('.IG_DW_MAIN')),
                        newTab: Boolean(root?.querySelector('.IG_NEWTAB_MAIN')),
                    };
                })()`);
                expect(controls).toEqual({ download: true, newTab: true });
            });
        });
    });

    test.describe('Authenticated UI', { tag: ['@ui', '@auth'] }, () => {
        requireAuthenticatedProfile(test, e2e);
        test('Reels controls remount after Instagram replaces the helper subtree', async () => {
            await e2e.withSettings({ SHOW_OPEN_IN_NEW_TAB_BUTTON: true }, async () => {
                await e2e.goto('https://www.instagram.com/reels/');
                await e2e.waitFor(`document.querySelector('.IG_REEL_CONTROLS')?.shadowRoot?.querySelector('.IG_REELS')`, 20000);

                const initial = await e2e.json(`(() => {
                    const hosts = [...document.querySelectorAll('.IG_REEL_CONTROLS')];
                    return {
                        hosts: hosts.length,
                        downloads: hosts.filter(host => host.shadowRoot?.querySelector('.IG_REELS')).length,
                        newTabs: hosts.filter(host => host.shadowRoot?.querySelector('.IG_REELS_NEWTAB')).length,
                        thumbnails: hosts.filter(host => host.shadowRoot?.querySelector('.IG_REELS_THUMBNAIL')).length,
                    };
                })()`);
                expect(initial.hosts).toBeGreaterThan(0);
                expect(initial.downloads).toBeGreaterThan(0);
                expect(initial.newTabs).toBeGreaterThan(0);
                expect(initial.thumbnails).toBeGreaterThan(0);

                await e2e.evaluate(`document.querySelector('.IG_REEL_CONTROLS')?.remove()`);
                await e2e.waitFor(`document.querySelectorAll('.IG_REEL_CONTROLS').length >= ${initial.hosts}`, 5000);

                const remounted = await e2e.json(`({
                    hosts: document.querySelectorAll('.IG_REEL_CONTROLS').length,
                    controlsComplete: [...document.querySelectorAll('.IG_REEL_CONTROLS')].every(host =>
                        host.shadowRoot?.querySelectorAll('.IG_REELS').length === 1 &&
                        host.shadowRoot?.querySelectorAll('.IG_REELS_NEWTAB').length === 1 &&
                        host.shadowRoot?.querySelectorAll('.IG_REELS_THUMBNAIL').length === 1
                    ),
                })`);
                expect(remounted.hosts).toBe(initial.hosts);
                expect(remounted.controlsComplete).toBe(true);
            });
        });
    });

});
