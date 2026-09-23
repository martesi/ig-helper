import { expect, test } from '@playwright/test';
import { DIRECT_DOWNLOAD_MODE_OPTIONS } from '../../src/settings/schema.js';
import { IgHelperE2E, registerE2E } from './harness.js';
const HOTKEY_OPTIONS_COUNT = 13;
let hotkeys;
const e2e = new IgHelperE2E();

test.describe('IG Helper browser E2E', () => {
    registerE2E(test, e2e);

    test.describe('UI', { tag: '@ui' }, () => {
        test('settings render as one continuous page, persist a real preference, and expose shortcut configuration', async () => {
            await e2e.openSettings();
            await e2e.showGeneralSection();

            const initial = await e2e.json(`({
                href: location.href,
                sections: document.querySelectorAll('[data-settings-section]').length,
                switches: document.querySelectorAll('input[role="switch"]').length,
                hotkeyRows: document.querySelectorAll('.IG_HOTKEY_ROW').length,
                directDownloadMode: document.querySelector('#DIRECT_DOWNLOAD_MODE-value')?.value,
                mediaPreview: document.querySelector('#SHOW_MEDIA_PREVIEW')?.checked,
            })`);
            expect(initial.href).toContain('/#/settings');
            expect(initial.sections).toBe(8);
            expect(initial.switches).toBeGreaterThanOrEqual(16);
            expect(initial.hotkeyRows).toBe(4);
            expect(await e2e.json(`document.querySelectorAll('[data-settings-section="advanced"] input[role="switch"]').length`)).toBeGreaterThanOrEqual(5);
            expect(await e2e.evaluate(`document.querySelector('[data-settings-locator="general"]')?.getAttribute('aria-current')`)).toBe('location');

            await e2e.evaluate(`(() => {
                const content = document.querySelector('.IG_SETTINGS_CONTENT');
                const downloads = document.querySelector('[data-settings-section="downloads"]');
                content.scrollTop = downloads.offsetTop;
            })()`);
            await e2e.waitFor(`document.querySelector('[data-settings-locator="downloads"]')?.getAttribute('aria-current') === 'location'`, 3000);

            const nextDownloadMode = initial.directDownloadMode === DIRECT_DOWNLOAD_MODE_OPTIONS.ASK
                ? DIRECT_DOWNLOAD_MODE_OPTIONS.ALL
                : DIRECT_DOWNLOAD_MODE_OPTIONS.ASK;
            await e2e.setSettings({ SHOW_MEDIA_PREVIEW: true });
            const nextMediaPreview = false;
            await e2e.setSettings({ DIRECT_DOWNLOAD_MODE: nextDownloadMode, SHOW_MEDIA_PREVIEW: nextMediaPreview });
            const bridgePreview = await e2e.evaluate(`import('/src/settings/page/client.js').then(({ requestSettings }) => requestSettings('getState')).then(result => result.settings.SHOW_MEDIA_PREVIEW)`);
            expect(bridgePreview).toBe(nextMediaPreview);
            await e2e.reload();
            await e2e.showGeneralSection();

            const persisted = await e2e.json(`({
                directDownloadMode: document.querySelector('#DIRECT_DOWNLOAD_MODE-value')?.value,
                mediaPreview: document.querySelector('#SHOW_MEDIA_PREVIEW')?.checked,
            })`);
            expect(persisted.directDownloadMode).toBe(nextDownloadMode);
            expect(persisted.mediaPreview).toBe(nextMediaPreview);

            await e2e.setSettings({ DIRECT_DOWNLOAD_MODE: initial.directDownloadMode, SHOW_MEDIA_PREVIEW: initial.mediaPreview });
            await e2e.showKeyboardTab();
            hotkeys = await e2e.readHotkeys();

            const keyboard = await e2e.json(`({
                top: document.querySelector('[data-settings-section="keyboard"]')?.getBoundingClientRect().top,
                selects: document.querySelectorAll('.IG_HOTKEY_ROW .select').length,
                nativeSelects: document.querySelectorAll('.IG_HOTKEY_ROW select').length,
            })`);
            expect(keyboard.top).toBeGreaterThanOrEqual(0);
            expect(keyboard.top).toBeLessThan(450);
            expect(keyboard.selects).toBe(4);
            expect(keyboard.nativeSelects).toBe(0);
            expect(await e2e.evaluate(`document.querySelector('[data-settings-locator="keyboard"]')?.getAttribute('aria-current')`)).toBe('location');

            await e2e.click('#settingsHotkeyKeyCode-trigger');
            const customSelect = await e2e.json(`({
                expanded: document.querySelector('#settingsHotkeyKeyCode-trigger')?.getAttribute('aria-expanded'),
                options: document.querySelectorAll('#settingsHotkeyKeyCode-listbox [role="option"]').length,
                popoverHidden: document.querySelector('#settingsHotkeyKeyCode [data-popover]')?.getAttribute('aria-hidden'),
            })`);
            expect(customSelect.expanded).toBe('true');
            expect(customSelect.popoverHidden).toBe('false');
            expect(customSelect.options).toBe(HOTKEY_OPTIONS_COUNT);
            await e2e.click('#settingsHotkeyKeyCode [role="option"][aria-selected="true"]');

            expect(hotkeys.settings).toBeGreaterThan(0);
            expect(hotkeys.debug).toBeGreaterThan(0);

            await e2e.closeSettings();
        });

        test('configured debug hotkey opens the attached control window and captures the live DOM tree', async () => {
            if (!hotkeys) {
                await e2e.openSettings();
                hotkeys = await e2e.readHotkeys();
                await e2e.closeSettings();
            }

            await e2e.ensurePostControls();
            const debuggerPagePromise = e2e.context.waitForEvent('page', { timeout: 5000 });
            await e2e.pressLegacyHotkey(hotkeys.debug);
            const debuggerPage = await debuggerPagePromise;

            try {
                await debuggerPage.waitForLoadState('domcontentloaded');
                expect(new URL(debuggerPage.url()).hash).toBe('#/debug');
                expect(await debuggerPage.evaluate(() => Boolean(window.opener))).toBe(true);
                await expect(debuggerPage.getByRole('button', { name: 'Reload tab' })).toHaveCount(0);

                await debuggerPage.waitForFunction(
                    () => document.querySelector('.IG_DEBUGGER_TITLE h3')?.textContent?.length > 0,
                    undefined,
                    { timeout: 5000 },
                );

                await debuggerPage.getByRole('button', { name: 'Capture DOM' }).click();
                const domActions = debuggerPage.locator('.IG_DEBUGGER_ACTIONS .button-group');
                await expect(domActions.getByRole('button', { name: 'Copy DOM snapshot' })).toBeVisible();
                await expect(domActions.getByRole('button', { name: 'Download DOM snapshot' })).toBeVisible();
                await expect(domActions.getByRole('button', { name: 'Capture DOM again' })).toBeVisible();
                await expect(domActions.locator('button')).toHaveCount(3);
                await expect(domActions.locator('button svg')).toHaveCount(3);
                const groupGeometry = await domActions.locator('button').evaluateAll(buttons => buttons.map(button => {
                    const style = getComputedStyle(button);
                    const rect = button.getBoundingClientRect();
                    return {
                        left: rect.left,
                        right: rect.right,
                        borderLeftWidth: style.borderLeftWidth,
                        borderTopLeftRadius: style.borderTopLeftRadius,
                        borderTopRightRadius: style.borderTopRightRadius,
                    };
                }));
                expect(groupGeometry[1].left).toBe(groupGeometry[0].right);
                expect(groupGeometry[1].borderLeftWidth).toBe('0px');
                expect(groupGeometry[0].borderTopRightRadius).toBe('0px');
                expect(groupGeometry[1].borderTopLeftRadius).toBe('0px');

                await debuggerPage.getByRole('link', { name: 'Settings' }).click();
                await debuggerPage.waitForFunction(
                    () => location.hash.startsWith('#/settings') && document.querySelectorAll('[data-settings-section]').length === 8,
                    undefined,
                    { timeout: 5000 },
                );

                const originalMediaPreview = await debuggerPage.evaluate(() => document.querySelector('#SHOW_MEDIA_PREVIEW')?.checked);
                await debuggerPage.locator('label[for="SHOW_MEDIA_PREVIEW"]').click();
                const nextMediaPreview = !originalMediaPreview;
                await debuggerPage.waitForFunction(
                    expected => document.querySelector('#SHOW_MEDIA_PREVIEW')?.checked === expected,
                    nextMediaPreview,
                    { timeout: 3000 },
                );
                await debuggerPage.waitForFunction(async expected => {
                    const { requestDebug } = await import('/src/debug/page/client.js');
                    return (await requestDebug('getSnapshot')).settings.SHOW_MEDIA_PREVIEW === expected;
                }, nextMediaPreview, { timeout: 5000 });

                await debuggerPage.locator('label[for="SHOW_MEDIA_PREVIEW"]').click();
                await debuggerPage.waitForFunction(async expected => {
                    const { requestDebug } = await import('/src/debug/page/client.js');
                    return (await requestDebug('getSnapshot')).settings.SHOW_MEDIA_PREVIEW === expected;
                }, originalMediaPreview, { timeout: 5000 });

                await debuggerPage.getByRole('link', { name: 'Debugger' }).click();
                await debuggerPage.waitForFunction(
                    () => location.hash === '#/debug' && document.querySelector('.IG_DEBUGGER_TITLE h3'),
                    undefined,
                    { timeout: 5000 },
                );
            } finally {
                await debuggerPage.close().catch(() => {});
                await e2e.page.bringToFront();
            }
        });
    });

});
