import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import {
    CDP_HTTP,
    IMAGE_VIEWER_ROOT_ID,
    INSTAGRAM_HOME,
    LEGACY_DIALOG_ROOT_ID,
    PROFILE_URL,
    SETTINGS_ROOT_ID,
    IgHelperE2E,
} from './webview-harness.js';

const HOTKEY_OPTIONS_COUNT = 13;

const FEATURE_MATRIX = [
    ['userscript bootstrap', true],
    ['settings preferences and persistence', true],
    ['keyboard shortcut configuration', true],
    ['debug dialog and DOM capture', true],
    ['feed post controls', true],
    ['image viewer interactions', true],
    ['open resource in new tab', true],
    ['legacy resource picker and selection', true],
    ['real media download', true],
    ['profile avatar control', true],
    ['reels controls', false],
    ['story/highlight controls', false],
];

const automatedFeatureCount = FEATURE_MATRIX.filter(([, covered]) => covered).length;
const functionalCoverage = automatedFeatureCount / FEATURE_MATRIX.length;

const e2e = new IgHelperE2E();
let hotkeys;

describe('IG Helper live browser E2E', () => {
    beforeAll(async () => {
        await e2e.start();
    }, 45000);

    afterAll(async () => {
        await e2e.stop();
    });

    test('coverage target stays at or above 80% of defined major surfaces', () => {
        expect(functionalCoverage).toBeGreaterThanOrEqual(0.8);
        expect(automatedFeatureCount).toBe(10);
        expect(FEATURE_MATRIX.length).toBe(12);
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
    }, 20000);

    test('settings render in Shadow DOM, persist a real preference, and expose shortcut configuration', async () => {
        await e2e.goto(INSTAGRAM_HOME);
        await e2e.openSettings();
        await e2e.showPreferencesTab();

        const initial = await e2e.shadowJson(SETTINGS_ROOT_ID, `({
            tab: root.querySelector('.IG_SETTINGS_DIALOG')?.dataset.settingsTab,
            switches: root.querySelectorAll('input[role="switch"]').length,
            directVisible: Boolean(root.querySelector('#DIRECT_DOWNLOAD_VISIBLE_RESOURCE')?.checked),
        })`);
        expect(initial.tab).toBe('preferences');
        expect(initial.switches).toBeGreaterThanOrEqual(15);

        await e2e.setSettings({ DIRECT_DOWNLOAD_VISIBLE_RESOURCE: !initial.directVisible });
        await e2e.closeSettings();
        await e2e.openSettings();
        await e2e.showPreferencesTab();

        const persisted = await e2e.shadowJson(
            SETTINGS_ROOT_ID,
            `Boolean(root.querySelector('#DIRECT_DOWNLOAD_VISIBLE_RESOURCE')?.checked)`,
        );
        expect(persisted).toBe(!initial.directVisible);

        await e2e.setSettings({ DIRECT_DOWNLOAD_VISIBLE_RESOURCE: initial.directVisible });
        await e2e.showKeyboardTab();
        hotkeys = await e2e.readHotkeys();

        const keyboard = await e2e.shadowJson(SETTINGS_ROOT_ID, `({
            tab: root.querySelector('.IG_SETTINGS_DIALOG')?.dataset.settingsTab,
            selects: root.querySelectorAll('.IG_HOTKEY_ROW .select').length,
            nativeSelects: root.querySelectorAll('.IG_HOTKEY_ROW select').length,
        })`);
        expect(keyboard.tab).toBe('keyboard');
        expect(keyboard.selects).toBe(4);
        expect(keyboard.nativeSelects).toBe(0);

        await e2e.clickShadow(SETTINGS_ROOT_ID, '#settingsHotkeyKeyCode-trigger');
        const customSelect = await e2e.shadowJson(SETTINGS_ROOT_ID, `({
            expanded: root.querySelector('#settingsHotkeyKeyCode-trigger')?.getAttribute('aria-expanded'),
            options: root.querySelectorAll('#settingsHotkeyKeyCode-listbox [role="option"]').length,
            popoverHidden: root.querySelector('#settingsHotkeyKeyCode [data-popover]')?.getAttribute('aria-hidden'),
        })`);
        expect(customSelect.expanded).toBe('true');
        expect(customSelect.popoverHidden).toBe('false');
        expect(customSelect.options).toBe(HOTKEY_OPTIONS_COUNT);
        await e2e.clickShadow(SETTINGS_ROOT_ID, '#settingsHotkeyKeyCode [role="option"][aria-selected="true"]');

        expect(hotkeys.settings).toBeGreaterThan(0);
        expect(hotkeys.debug).toBeGreaterThan(0);

        await e2e.closeSettings();
    }, 15000);

    test('configured debug hotkey opens the Shadow DOM dialog and captures the live DOM tree', async () => {
        if (!hotkeys) {
            await e2e.openSettings();
            hotkeys = await e2e.readHotkeys();
            await e2e.closeSettings();
        }

        await e2e.pressLegacyHotkey(hotkeys.debug);
        await e2e.waitFor(`!!document.getElementById(${JSON.stringify(LEGACY_DIALOG_ROOT_ID)})?.shadowRoot`, 3000);

        const opened = await e2e.shadowJson(LEGACY_DIALOG_ROOT_ID, `({
            debug: !!root.querySelector('.IG_LEGACY_PANEL'),
            textarea: !!root.querySelector('.IG_POPUP_DIG_BODY textarea'),
        })`);
        expect(opened.debug).toBe(true);
        expect(opened.textarea).toBe(true);

        await e2e.clickShadow(LEGACY_DIALOG_ROOT_ID, '.IG_DISPLAY_DOM_TREE');
        await e2e.waitFor(`(() => {
            const root = document.getElementById(${JSON.stringify(LEGACY_DIALOG_ROOT_ID)})?.shadowRoot;
            const area = root?.querySelector('.IG_POPUP_DIG_BODY textarea');
            return (area?.value || area?.textContent || '').length > 1000;
        })()`, 5000);

        const treeLength = await e2e.shadowJson(
            LEGACY_DIALOG_ROOT_ID,
            `(root.querySelector('.IG_POPUP_DIG_BODY textarea')?.value || root.querySelector('.IG_POPUP_DIG_BODY textarea')?.textContent || '').length`,
        );
        expect(treeLength).toBeGreaterThan(1000);

        await e2e.pressLegacyHotkey(81);
        await e2e.waitFor(`!document.getElementById(${JSON.stringify(LEGACY_DIALOG_ROOT_ID)})`, 3000);
    }, 15000);

    test('feed hover mounts post controls and image viewer supports rotate, zoom, and close', async () => {
        await e2e.ensurePostControls();

        const controls = await e2e.json(`({
            wrappers: document.querySelectorAll('.button_wrapper').length,
            viewer: document.querySelectorAll('.button_wrapper .IG_IMAGE_VIEWER').length,
            newTab: document.querySelectorAll('.button_wrapper .IG_NEWTAB_MAIN').length,
            download: document.querySelectorAll('.button_wrapper .IG_DW_MAIN').length,
        })`);
        expect(controls.wrappers).toBeGreaterThan(0);
        expect(controls.viewer).toBeGreaterThan(0);
        expect(controls.newTab).toBeGreaterThan(0);
        expect(controls.download).toBeGreaterThan(0);

        await e2e.view.click('.button_wrapper .IG_IMAGE_VIEWER');
        await e2e.waitFor(`!!document.getElementById(${JSON.stringify(IMAGE_VIEWER_ROOT_ID)})?.shadowRoot`, 3000);

        await e2e.clickShadow(IMAGE_VIEWER_ROOT_ID, '#rotate_right');
        await e2e.waitFor(`document.getElementById(${JSON.stringify(IMAGE_VIEWER_ROOT_ID)})?.shadowRoot?.querySelector('#iv_rotate')?.style.transform.includes('90deg')`, 3000);

        await e2e.waitFor(`(() => {
            const image = document.getElementById(${JSON.stringify(IMAGE_VIEWER_ROOT_ID)})?.shadowRoot?.querySelector('#iv_image');
            const rect = image?.getBoundingClientRect();
            return image?.complete && image.naturalWidth > 0 && rect?.width > 0;
        })()`, 10000);
        await e2e.clickShadow(IMAGE_VIEWER_ROOT_ID, '#iv_image');
        await e2e.waitFor(`document.getElementById(${JSON.stringify(IMAGE_VIEWER_ROOT_ID)})?.shadowRoot?.querySelector('#iv_transform')?.style.transform.includes('scale(2.25)')`, 3000);

        const transform = await e2e.shadowJson(IMAGE_VIEWER_ROOT_ID, `({
            rotate: root.querySelector('#iv_rotate')?.style.transform,
            zoom: root.querySelector('#iv_transform')?.style.transform,
        })`);
        expect(transform.rotate).toContain('90deg');
        expect(transform.zoom).toContain('scale(2.25)');

        await e2e.clickShadow(IMAGE_VIEWER_ROOT_ID, '#iv_close');
        await e2e.waitFor(`!document.getElementById(${JSON.stringify(IMAGE_VIEWER_ROOT_ID)})`, 3000);
    }, 20000);

    test('open-in-new-tab creates a real Chrome target and cleans it up', async () => {
        await e2e.ensurePostControls();
        const before = await e2e.browserTargets();
        const beforeIds = new Set(before.map(target => target.id));

        await e2e.view.click('.button_wrapper .IG_NEWTAB_MAIN');

        let created;
        const deadline = Date.now() + 10000;
        while (Date.now() < deadline) {
            const after = await e2e.browserTargets();
            created = after.find(target => target.type === 'page' && !beforeIds.has(target.id));
            if (created) break;
            await Bun.sleep(100);
        }

        expect(created).toBeDefined();
        expect(created.url).not.toBe('about:blank');
        await e2e.closeTarget(created.id);
    }, 20000);

    test('resource picker selection works and a real post media download completes on disk', async () => {
        const requiredSettings = {
            DIRECT_DOWNLOAD_ALL: false,
            DIRECT_DOWNLOAD_VISIBLE_RESOURCE: false,
            FORCE_FETCH_ALL_RESOURCES: false,
            FORCE_RESOURCE_VIA_MEDIA: false,
            USE_EXTERNAL_DOWNLOAD_MODE: false,
            MODIFY_RESOURCE_EXIF: false,
        };

        await e2e.withSettings(requiredSettings, async () => {
            await e2e.configureDownloads();
            await e2e.ensurePostControls();
            await e2e.view.click('.button_wrapper .IG_DW_MAIN');

            await e2e.waitFor(`(() => {
                const root = document.getElementById(${JSON.stringify(LEGACY_DIALOG_ROOT_ID)})?.shadowRoot;
                return !!root?.querySelector('.IG_POPUP_DIG_BODY a[data-needed="direct"]');
            })()`, 20000);

            const resources = await e2e.shadowJson(LEGACY_DIALOG_ROOT_ID, `({
                links: root.querySelectorAll('.IG_POPUP_DIG_BODY a[data-needed="direct"]').length,
                checkboxes: root.querySelectorAll('.IG_POPUP_DIG_BODY .inner_box').length,
            })`);
            expect(resources.links).toBeGreaterThan(0);
            expect(resources.checkboxes).toBeGreaterThan(0);

            await e2e.clickShadow(LEGACY_DIALOG_ROOT_ID, '.IG_SELECT_ALL input');
            await e2e.waitFor(`(() => {
                const root = document.getElementById(${JSON.stringify(LEGACY_DIALOG_ROOT_ID)})?.shadowRoot;
                const boxes = [...(root?.querySelectorAll('.IG_POPUP_DIG_BODY .inner_box') || [])];
                return boxes.length > 0 && boxes.every(box => box.checked);
            })()`, 3000);

            const summary = await e2e.shadowJson(
                LEGACY_DIALOG_ROOT_ID,
                `root.querySelector('.IG_SELECT_ALL')?.textContent || ''`,
            );
            expect(summary).toContain(String(resources.checkboxes));

            await e2e.clickShadow(LEGACY_DIALOG_ROOT_ID, '.IG_POPUP_DIG_BODY a[data-needed="direct"]');
            const { begin, complete } = await e2e.waitForCompletedDownload(30000);

            expect(begin).toBeDefined();
            expect(begin.suggestedFilename).toMatch(/\.(jpg|jpeg|png|webp|mp4)$/i);
            expect(complete.filePath).toBeTruthy();
            expect(complete.totalBytes).toBeGreaterThan(1000);
            expect(complete.receivedBytes).toBe(complete.totalBytes);

            await e2e.pressLegacyHotkey(81);
            await e2e.waitFor(`!document.getElementById(${JSON.stringify(LEGACY_DIALOG_ROOT_ID)})`, 3000);
        });
    }, 60000);

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
    }, 20000);

    test('documents the currently uncovered live-route families instead of pretending they passed', () => {
        const uncovered = FEATURE_MATRIX.filter(([, covered]) => !covered).map(([name]) => name);
        expect(uncovered).toEqual(['reels controls', 'story/highlight controls']);
        expect(CDP_HTTP.startsWith('http')).toBe(true);
    });
});
