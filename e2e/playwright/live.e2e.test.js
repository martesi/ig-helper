import { expect, test } from '@playwright/test';
import { DIRECT_DOWNLOAD_MODE_OPTIONS } from '../../src/settings/schema.js';
import {
    IMAGE_VIEWER_ROOT_ID,
    INSTAGRAM_HOME,
    LEGACY_DIALOG_ROOT_ID,
    PROFILE_URL,
    IgHelperE2E,
} from './harness.js';

const HOTKEY_OPTIONS_COUNT = 13;
const PERMALINK_URL = process.env.IG_HELPER_E2E_PERMALINK ?? 'https://www.instagram.com/p/Dc7Z80KGzLT/';
const RESOURCE_PICKER_ROOT_ID = 'ig-helper-resource-picker-root';

const e2e = new IgHelperE2E();
let hotkeys;

test.describe.configure({ mode: 'serial' });

test.describe('IG Helper live browser E2E', () => {
    test.beforeAll(async () => {
        await e2e.start();
    });

    test.afterAll(async () => {
        await e2e.stop();
    });

    test('boots in the existing Instagram session and detects feed posts', async () => {
        await e2e.goto(INSTAGRAM_HOME);
        await e2e.waitFor(`document.querySelectorAll('[data-snig="canDownload"]').length > 0`, 15000);

        const state = await e2e.json(`({
            href: location.href,
            title: document.title,
            articles: document.querySelectorAll('article').length,
            targets: document.querySelectorAll('[data-snig="canDownload"]').length,
            hasLoginForm: !!document.querySelector('input[name="username"], input[name="password"]'),
        })`);

        expect(state.href).toBe(INSTAGRAM_HOME);
        expect(state.title).toContain('Instagram');
        expect(state.hasLoginForm).toBe(false);
        expect(state.targets).toBeGreaterThan(0);
    });

    test('direct permalink mounts post controls on the media container', async () => {
        await e2e.goto(PERMALINK_URL);
        await e2e.waitFor(`document.querySelectorAll('[data-snig="canDownload"] .button_wrapper').length > 0`, 15000);

        const state = await e2e.json(`({
            href: location.href,
            targets: document.querySelectorAll('[data-snig="canDownload"]').length,
            wrappers: document.querySelectorAll('[data-snig="canDownload"] .button_wrapper').length,
            media: [...document.querySelectorAll('[data-snig="canDownload"] img, [data-snig="canDownload"] video')].some(element => {
                const rect = element.getBoundingClientRect();
                return rect.width > 64 && rect.height > 64;
            }),
        })`);

        expect(state.href).toBe(PERMALINK_URL);
        expect(state.targets).toBeGreaterThan(0);
        expect(state.wrappers).toBeGreaterThan(0);
        expect(state.media).toBe(true);
    });

    test('post control bar renders real visible button DOM', async () => {
        await e2e.ensurePostControls();

        const controls = await e2e.json(`(() => {
            const wrapper = document.querySelector('.button_wrapper.IG_CONTROL_BAR');
            const buttons = [...(wrapper?.children || [])];
            return {
                wrapper: Boolean(wrapper),
                allButtons: buttons.length > 0 && buttons.every(button =>
                    button.tagName === 'BUTTON' &&
                    button.classList.contains('IG_POST_CONTROL') &&
                    Boolean(button.getAttribute('aria-label')) &&
                    Boolean(button.querySelector('svg')) &&
                    button.getBoundingClientRect().width > 0 &&
                    button.getBoundingClientRect().height > 0
                ),
                viewerOrThumbnail: Boolean(wrapper?.querySelector('.IG_IMAGE_VIEWER, .IG_THUMBNAIL_MAIN')),
                newTab: Boolean(wrapper?.querySelector('.IG_NEWTAB_MAIN')),
                download: Boolean(wrapper?.querySelector('.IG_DW_MAIN')),
            };
        })()`);

        expect(controls.wrapper).toBe(true);
        expect(controls.allButtons).toBe(true);
        expect(controls.viewerOrThumbnail).toBe(true);
        expect(controls.newTab).toBe(true);
        expect(controls.download).toBe(true);
    });

    test('settings render as one continuous page, persist a real preference, and expose shortcut configuration', async () => {
        await e2e.openSettings();
        await e2e.showGeneralSection();

        const initial = await e2e.json(`({
            href: location.href,
            sections: document.querySelectorAll('[data-settings-section]').length,
            switches: document.querySelectorAll('input[role="switch"]').length,
            hotkeyRows: document.querySelectorAll('.IG_HOTKEY_ROW').length,
            directDownloadMode: document.querySelector('#DIRECT_DOWNLOAD_MODE-value')?.value,
        })`);
        expect(initial.href).toContain('/#/settings');
        expect(initial.sections).toBe(7);
        expect(initial.switches).toBeGreaterThanOrEqual(15);
        expect(initial.hotkeyRows).toBe(4);
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
        await e2e.setSettings({ DIRECT_DOWNLOAD_MODE: nextDownloadMode });
        await e2e.reload();
        await e2e.showGeneralSection();

        const persisted = await e2e.evaluate(`document.querySelector('#DIRECT_DOWNLOAD_MODE-value')?.value`);
        expect(persisted).toBe(nextDownloadMode);

        await e2e.setSettings({ DIRECT_DOWNLOAD_MODE: initial.directDownloadMode });
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

    test('configured debug hotkey opens the Shadow DOM dialog and captures the live DOM tree', async () => {
        if (!hotkeys) {
            await e2e.openSettings();
            hotkeys = await e2e.readHotkeys();
            await e2e.closeSettings();
        }

        await e2e.pressLegacyHotkey(hotkeys.debug);
        await e2e.waitFor(`!!document.getElementById(${JSON.stringify(LEGACY_DIALOG_ROOT_ID)})`, 3000);

        const opened = await e2e.json(`(() => {
            const root = document.getElementById(${JSON.stringify(LEGACY_DIALOG_ROOT_ID)});
            return {
                debug: !!root?.querySelector('.IG_LEGACY_PANEL'),
                textarea: !!root?.querySelector('.IG_POPUP_DIG_BODY textarea'),
            };
        })()`);
        expect(opened.debug).toBe(true);
        expect(opened.textarea).toBe(true);

        await e2e.click(`#${LEGACY_DIALOG_ROOT_ID} .IG_DISPLAY_DOM_TREE`);
        await e2e.waitFor(`(() => {
            const root = document.getElementById(${JSON.stringify(LEGACY_DIALOG_ROOT_ID)});
            const area = root?.querySelector('.IG_POPUP_DIG_BODY textarea');
            return (area?.value || area?.textContent || '').length > 1000;
        })()`, 5000);

        const treeLength = await e2e.json(`(() => {
            const root = document.getElementById(${JSON.stringify(LEGACY_DIALOG_ROOT_ID)});
            const area = root?.querySelector('.IG_POPUP_DIG_BODY textarea');
            return (area?.value || area?.textContent || '').length;
        })()`);
        expect(treeLength).toBeGreaterThan(1000);

        await e2e.pressLegacyHotkey(81);
        await e2e.waitFor(`!document.getElementById(${JSON.stringify(LEGACY_DIALOG_ROOT_ID)})`, 3000);
    });

    test('post action row mounts controls before Save and image viewer supports rotate, zoom, and close', async () => {
        await e2e.ensurePostControls();

        const controls = await e2e.json(`(() => {
            const wrapper = document.querySelector('.button_wrapper');
            const section = wrapper?.closest('section');
            const groups = section ? [...section.children].filter(child => child.tagName === 'DIV') : [];
            const saveIcon = groups[1]?.querySelector('svg[aria-label="Save"], svg[aria-label="Remove"]');
            return {
                wrappers: document.querySelectorAll('.button_wrapper').length,
                viewer: document.querySelectorAll('.button_wrapper .IG_IMAGE_VIEWER').length,
                newTab: document.querySelectorAll('.button_wrapper .IG_NEWTAB_MAIN').length,
                download: document.querySelectorAll('.button_wrapper .IG_DW_MAIN').length,
                beforeSave: Boolean(saveIcon && wrapper?.parentElement === groups[0] && groups[0]?.lastElementChild === wrapper),
                position: wrapper ? getComputedStyle(wrapper).position : null,
            };
        })()`);
        expect(controls.wrappers).toBeGreaterThan(0);
        expect(controls.viewer).toBeGreaterThan(0);
        expect(controls.newTab).toBeGreaterThan(0);
        expect(controls.download).toBeGreaterThan(0);
        expect(controls.beforeSave).toBe(true);
        expect(controls.position).toBe('static');

        await e2e.click('.button_wrapper .IG_IMAGE_VIEWER');
        await e2e.waitFor(`!!document.getElementById(${JSON.stringify(IMAGE_VIEWER_ROOT_ID)})`, 3000);

        await e2e.click(`#${IMAGE_VIEWER_ROOT_ID} #rotate_right`);
        await e2e.waitFor(`document.querySelector('#${IMAGE_VIEWER_ROOT_ID} #iv_rotate')?.style.transform.includes('90deg')`, 3000);

        await e2e.waitFor(`(() => {
            const image = document.querySelector('#${IMAGE_VIEWER_ROOT_ID} #iv_image');
            const rect = image?.getBoundingClientRect();
            return image?.complete && image.naturalWidth > 0 && rect?.width > 0;
        })()`, 10000);
        await e2e.click(`#${IMAGE_VIEWER_ROOT_ID} #iv_image`);
        await e2e.waitFor(`document.querySelector('#${IMAGE_VIEWER_ROOT_ID} #iv_transform')?.style.transform.includes('scale(2.25)')`, 3000);

        const transform = await e2e.json(`({
            rotate: document.querySelector('#${IMAGE_VIEWER_ROOT_ID} #iv_rotate')?.style.transform,
            zoom: document.querySelector('#${IMAGE_VIEWER_ROOT_ID} #iv_transform')?.style.transform,
        })`);
        expect(transform.rotate).toContain('90deg');
        expect(transform.zoom).toContain('scale(2.25)');

        await e2e.click(`#${IMAGE_VIEWER_ROOT_ID} #iv_close`);
        await e2e.waitFor(`!document.getElementById(${JSON.stringify(IMAGE_VIEWER_ROOT_ID)})`, 3000);
    });

    test('open-in-new-tab creates a real Chrome target and cleans it up', async () => {
        await e2e.ensurePostControls();
        const created = await e2e.clickAndWaitForPage('.button_wrapper .IG_NEWTAB_MAIN');

        expect(created.url()).not.toBe('about:blank');
        await created.close();
    });

    test('resource picker selection works and a real post media download completes on disk', async () => {
        const requiredSettings = {
            DIRECT_DOWNLOAD_MODE: DIRECT_DOWNLOAD_MODE_OPTIONS.ASK,
            FORCE_FETCH_ALL_RESOURCES: false,
            FORCE_RESOURCE_VIA_MEDIA: false,
            USE_EXTERNAL_DOWNLOAD_MODE: false,
            MODIFY_RESOURCE_EXIF: false,
        };

        await e2e.withSettings(requiredSettings, async () => {
            await e2e.configureDownloads();
            await e2e.ensurePostControls();
            await e2e.click('.button_wrapper .IG_DW_MAIN');

            await e2e.waitFor(`!!document.getElementById(${JSON.stringify(RESOURCE_PICKER_ROOT_ID)})?.shadowRoot?.querySelector('.resource-picker-item')`, 20000);

            const resources = await e2e.shadowJson(RESOURCE_PICKER_ROOT_ID, `({
                items: root.querySelectorAll('.resource-picker-item').length,
                checkboxes: root.querySelectorAll('.resource-picker-item .input[type="checkbox"]').length,
            })`);
            expect(resources.items).toBeGreaterThan(0);
            expect(resources.checkboxes).toBeGreaterThan(0);

            await e2e.clickShadow(RESOURCE_PICKER_ROOT_ID, '.resource-picker-footer .btn[data-variant="outline"]');
            await e2e.waitFor(`(() => {
                const root = document.getElementById(${JSON.stringify(RESOURCE_PICKER_ROOT_ID)})?.shadowRoot;
                const boxes = [...(root?.querySelectorAll('.resource-picker-item .input[type="checkbox"]') || [])];
                return boxes.length > 0 && boxes.every(box => box.checked);
            })()`, 3000);

            const summary = await e2e.shadowJson(
                RESOURCE_PICKER_ROOT_ID,
                `root.querySelector('.resource-picker-count')?.textContent || ''`,
            );
            expect(summary).toContain(String(resources.checkboxes));

            await e2e.clickShadow(RESOURCE_PICKER_ROOT_ID, '.resource-picker-footer .btn[data-variant="outline"]');
            await e2e.clickShadow(RESOURCE_PICKER_ROOT_ID, '.resource-picker-item .input[type="checkbox"]');
            await e2e.waitFor(`(() => {
                const root = document.getElementById(${JSON.stringify(RESOURCE_PICKER_ROOT_ID)})?.shadowRoot;
                return root?.querySelector('.resource-picker-count')?.textContent?.includes('1');
            })()`, 3000);

            await e2e.clickShadow(RESOURCE_PICKER_ROOT_ID, '.resource-picker-footer .btn[data-variant="primary"]');
            const { begin, complete } = await e2e.waitForCompletedDownload(30000);

            expect(begin).toBeDefined();
            expect(begin.suggestedFilename).toMatch(/\.(jpg|jpeg|png|webp|mp4)$/i);
            expect(complete.filePath).toBeTruthy();
            expect(complete.totalBytes).toBeGreaterThan(1000);
            expect(complete.receivedBytes).toBe(complete.totalBytes);

            await e2e.waitFor(`!document.getElementById(${JSON.stringify(RESOURCE_PICKER_ROOT_ID)})`, 3000);
        });
    });

    test('profile page mounts the avatar download control in the live Instagram DOM', async () => {
        await e2e.goto(PROFILE_URL);
        await e2e.waitFor(`document.querySelectorAll('.IG_DWPROFILE').length > 0`, 10000);

        const profile = await e2e.json(`(() => {
            const control = document.querySelector('.IG_DWPROFILE');
            const rect = control?.getBoundingClientRect();
            return {
                href: location.href,
                controls: document.querySelectorAll('.IG_DWPROFILE').length,
                visible: Boolean(rect && rect.width > 0 && rect.height > 0),
            };
        })()`);

        expect(profile.href).toBe(PROFILE_URL);
        expect(profile.controls).toBeGreaterThan(0);
        expect(profile.visible).toBe(true);
    });

});
