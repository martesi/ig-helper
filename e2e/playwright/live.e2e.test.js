import { expect, test } from '@playwright/test';
import { DIRECT_DOWNLOAD_MODE_OPTIONS } from '../../src/settings/schema.js';
import {
    IMAGE_VIEWER_ROOT_ID,
    INSTAGRAM_HOME,
    LEGACY_DIALOG_ROOT_ID,
    PROFILE_URL,
    VITE_URL,
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
                copy: Boolean(wrapper?.querySelector('.IG_COPY_MAIN')),
                download: Boolean(wrapper?.querySelector('.IG_DW_MAIN')),
            };
        })()`);

        expect(controls.wrapper).toBe(true);
        expect(controls.allButtons).toBe(true);
        expect(controls.viewerOrThumbnail).toBe(true);
        expect(controls.newTab).toBe(true);
        expect(controls.copy).toBe(true);
        expect(controls.download).toBe(true);
    });

    test('copy current post image writes image data and reports success', async () => {
        await e2e.ensurePostControls();
        const selector = '.button_wrapper:has(.IG_IMAGE_VIEWER) .IG_COPY_MAIN';
        await e2e.waitFor(`!!document.querySelector('${selector}')`, 15000);

        await e2e.evaluate(`(() => {
            window.__igHelperCopyMessage = '';
            window.__igHelperCopyWrites = 0;
            window.__igHelperCopyType = '';
            window.__igHelperCopyBlobType = '';
            window.__igHelperCopyMocks = {
                alert: window.alert,
                clipboard: Object.getOwnPropertyDescriptor(navigator, 'clipboard'),
                clipboardItem: Object.getOwnPropertyDescriptor(window, 'ClipboardItem'),
            };
            window.alert = message => { window.__igHelperCopyMessage = String(message); };
            Object.defineProperty(window, 'ClipboardItem', {
                configurable: true,
                writable: true,
                value: class {
                    static supports(type) { return type.startsWith('image/'); }
                    constructor(items) {
                        this.items = items;
                        window.__igHelperCopyType = Object.keys(items)[0] || '';
                    }
                },
            });
            Object.defineProperty(navigator, 'clipboard', {
                configurable: true,
                value: {
                    write: async items => {
                        window.__igHelperCopyWrites += items.length;
                        const blobs = await Promise.all(items.flatMap(item => Object.values(item.items)));
                        window.__igHelperCopyBlobType = blobs[0]?.type || '';
                    },
                },
            });
        })()`);

        try {
            await e2e.click(selector);
            await e2e.waitFor(`window.__igHelperCopyWrites === 1 && window.__igHelperCopyMessage.length > 0`, 3000);
            const result = await e2e.json(`({
                writes: window.__igHelperCopyWrites,
                message: window.__igHelperCopyMessage,
                type: window.__igHelperCopyType,
                blobType: window.__igHelperCopyBlobType,
            })`);
            expect(result.writes).toBe(1);
            expect(result.message).toBe('Media copied to clipboard.');
            expect(result.type).toMatch(/^image\//);
            expect(result.blobType).toBe(result.type);
        } finally {
            await e2e.evaluate(`(() => {
                const mocks = window.__igHelperCopyMocks;
                if (!mocks) return;
                window.alert = mocks.alert;
                if (mocks.clipboardItem) Object.defineProperty(window, 'ClipboardItem', mocks.clipboardItem);
                else delete window.ClipboardItem;
                if (mocks.clipboard) Object.defineProperty(navigator, 'clipboard', mocks.clipboard);
                else delete navigator.clipboard;
                delete window.__igHelperCopyMocks;
            })()`);
        }
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
            mediaPreview: document.querySelector('#SHOW_MEDIA_PREVIEW')?.checked,
        })`);
        expect(initial.href).toContain('/#/settings');
        expect(initial.sections).toBe(7);
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

        await e2e.waitFor(`document.querySelectorAll('.button_wrapper .IG_DW_MAIN').length > 0`, 15000);
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
            await debuggerPage.waitForFunction(() => {
                const section = [...document.querySelectorAll('.IG_DEBUGGER_SECTION')]
                    .find(item => item.querySelector('h4')?.textContent === 'DOM snapshot');
                return (section?.querySelector('pre')?.textContent || '').length > 1000;
            }, undefined, { timeout: 5000 });

            await debuggerPage.getByRole('link', { name: 'Settings' }).click();
            await debuggerPage.waitForFunction(
                () => location.hash.startsWith('#/settings') && document.querySelectorAll('[data-settings-section]').length === 7,
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

    test('post action row places native-sized controls beside Save and image viewer supports rotate, zoom, and close', async () => {
        await e2e.ensurePostControls();

        const controls = await e2e.json(`(() => {
            const wrapper = document.querySelector('.button_wrapper');
            const section = wrapper?.closest('section');
            const groups = section ? [...section.children].filter(child => child.tagName === 'DIV') : [];
            const saveIcon = section?.querySelector('svg[aria-label="Save"], svg[aria-label="Remove"]');
            const saveGroup = groups.find(group => group.contains(saveIcon));
            const saveItem = saveIcon?.closest('[role="button"]');
            const wrapperRect = wrapper?.getBoundingClientRect();
            const saveRect = saveIcon?.getBoundingClientRect();
            const buttonRects = [...(wrapper?.querySelectorAll('.IG_POST_CONTROL') || [])]
                .map(button => button.getBoundingClientRect());
            return {
                wrappers: document.querySelectorAll('.button_wrapper').length,
                viewer: document.querySelectorAll('.button_wrapper .IG_IMAGE_VIEWER').length,
                newTab: document.querySelectorAll('.button_wrapper .IG_NEWTAB_MAIN').length,
                download: document.querySelectorAll('.button_wrapper .IG_DW_MAIN').length,
                besideSave: Boolean(
                    saveIcon &&
                    saveGroup &&
                    wrapper?.parentElement === saveGroup &&
                    wrapper.nextElementSibling?.contains(saveIcon)
                ),
                nativeButtonSize: buttonRects.length > 0 && buttonRects.every(rect => rect.width === 40 && rect.height === 40),
                saveGap: wrapperRect && saveRect ? Math.round(saveRect.left - wrapperRect.right) : null,
                aligned: wrapperRect && saveRect
                    ? Math.abs((wrapperRect.top + wrapperRect.height / 2) - (saveRect.top + saveRect.height / 2)) < 1
                    : false,
                marginRight: wrapper ? getComputedStyle(wrapper).marginRight : null,
                saveItem: Boolean(saveItem),
                position: wrapper ? getComputedStyle(wrapper).position : null,
            };
        })()`);
        expect(controls.wrappers).toBeGreaterThan(0);
        expect(controls.viewer).toBeGreaterThan(0);
        expect(controls.newTab).toBeGreaterThan(0);
        expect(controls.download).toBeGreaterThan(0);
        expect(controls.besideSave).toBe(true);
        expect(controls.nativeButtonSize).toBe(true);
        expect(controls.saveGap).toBe(8);
        expect(controls.aligned).toBe(true);
        expect(controls.marginRight).toBe('8px');
        expect(controls.saveItem).toBe(true);
        expect(controls.position).toBe('static');

        await e2e.page.locator('.button_wrapper .IG_DW_MAIN').first().hover();
        const hoverStyle = await e2e.json(`(() => {
            const style = getComputedStyle(document.querySelector('.button_wrapper .IG_DW_MAIN'));
            return { transform: style.transform, background: style.backgroundColor };
        })()`);
        expect(hoverStyle.transform).toContain('1.05');
        expect(hoverStyle.background).toBe('rgba(0, 0, 0, 0)');

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

    test('open-in-new-tab creates a real Chrome target without mounting the legacy dialog', async () => {
        await e2e.ensurePostControls();
        await e2e.evaluate(`(() => {
            window.__igHelperLegacyDialogMounted = false;
            window.__igHelperLegacyDialogObserver?.disconnect();
            window.__igHelperLegacyDialogObserver = new MutationObserver(() => {
                if (document.getElementById(${JSON.stringify(LEGACY_DIALOG_ROOT_ID)})) {
                    window.__igHelperLegacyDialogMounted = true;
                }
            });
            window.__igHelperLegacyDialogObserver.observe(document.body, { childList: true });
        })()`);

        const created = await e2e.clickAndWaitForPage('.button_wrapper .IG_NEWTAB_MAIN');

        expect(created.url()).not.toBe('about:blank');
        expect(await e2e.evaluate('window.__igHelperLegacyDialogMounted')).toBe(false);
        expect(await e2e.evaluate(`!!document.getElementById(${JSON.stringify(LEGACY_DIALOG_ROOT_ID)})`)).toBe(false);
        await e2e.evaluate('window.__igHelperLegacyDialogObserver?.disconnect()');
        await created.close();
    });

    test('download-all bypasses the legacy dialog', async () => {
        await e2e.withSettings({ DIRECT_DOWNLOAD_MODE: DIRECT_DOWNLOAD_MODE_OPTIONS.VISIBLE }, async () => {
            await e2e.goto(PERMALINK_URL);
            await e2e.waitFor(`!!document.querySelector('.button_wrapper .IG_DW_ALL_MAIN')`, 15000);
            await e2e.evaluate(`(() => {
                window.__igHelperLegacyDialogMounted = false;
                window.__igHelperLegacyDialogObserver?.disconnect();
                window.__igHelperLegacyDialogObserver = new MutationObserver(() => {
                    if (document.getElementById(${JSON.stringify(LEGACY_DIALOG_ROOT_ID)})) {
                        window.__igHelperLegacyDialogMounted = true;
                    }
                });
                window.__igHelperLegacyDialogObserver.observe(document.body, { childList: true });
            })()`);

            await e2e.click('.button_wrapper .IG_DW_ALL_MAIN');
            await e2e.page.waitForTimeout(1000);

            const legacyDialog = await e2e.json(`({
                mounted: window.__igHelperLegacyDialogMounted,
                present: !!document.getElementById(${JSON.stringify(LEGACY_DIALOG_ROOT_ID)}),
            })`);
            expect(legacyDialog.mounted).toBe(false);
            expect(legacyDialog.present).toBe(false);

            await e2e.evaluate(`window.__igHelperLegacyDialogObserver?.disconnect()`);
        });
    });

    test('legacy 10-item carousel is completed from the current web-info response', async () => {
        const page = await e2e.context.newPage();
        try {
            await page.goto(`${VITE_URL}/src/shared/api.js`, { waitUntil: 'domcontentloaded' });
            const result = await page.evaluate(async () => {
                globalThis.GM_getResourceText = () => '{}';
                globalThis.GM_getValue = (_key, fallback) => fallback;

                const legacyItems = Array.from({ length: 10 }, (_, index) => ({ node: { id: `legacy-${index}` } }));
                const currentItems = Array.from({ length: 12 }, (_, index) => ({ pk: `current-${index}` }));
                const requests = [];
                const request = options => {
                    requests.push(options.url);
                    const response = options.url.includes('query_hash=')
                        ? {
                            status: 'ok',
                            data: {
                                shortcode_media: {
                                    __typename: 'GraphSidecar',
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


    test('preview setting hides only the lightbox button', async () => {
        await e2e.withSettings({
            DIRECT_DOWNLOAD_MODE: DIRECT_DOWNLOAD_MODE_OPTIONS.ASK,
            SHOW_MEDIA_PREVIEW: false,
            FORCE_FETCH_ALL_RESOURCES: false,
            FORCE_RESOURCE_VIA_MEDIA: false,
        }, async () => {
            await e2e.ensurePostControls();
            const wrapper = '.button_wrapper.IG_CONTROL_BAR:not(:has(.IG_THUMBNAIL_MAIN))';
            await e2e.waitFor(`!!document.querySelector('${wrapper}')`, 15000);

            const controls = await e2e.json(`(() => {
                const root = document.querySelector('${wrapper}');
                return {
                    viewer: Boolean(root?.querySelector('.IG_IMAGE_VIEWER')),
                    copy: Boolean(root?.querySelector('.IG_COPY_MAIN')),
                    newTab: Boolean(root?.querySelector('.IG_NEWTAB_MAIN')),
                    download: Boolean(root?.querySelector('.IG_DW_MAIN')),
                };
            })()`);
            expect(controls).toEqual({ viewer: false, copy: true, newTab: true, download: true });

            await e2e.click(`${wrapper} .IG_DW_MAIN`);
            await e2e.waitFor(`!!document.getElementById(${JSON.stringify(RESOURCE_PICKER_ROOT_ID)})?.shadowRoot?.querySelector('.resource-picker-item img')`, 20000);
            expect(await e2e.shadowJson(RESOURCE_PICKER_ROOT_ID, `root.querySelectorAll('.resource-picker-item img').length`)).toBeGreaterThan(0);

            await e2e.clickShadow(RESOURCE_PICKER_ROOT_ID, '.resource-picker-header .btn[data-size="icon-sm"]');
        });
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

    test('resource picker manages modal focus', async () => {
        const page = await e2e.context.newPage();
        try {
            await page.goto(`${VITE_URL}/src/shared/ui/resource-picker.jsx`, { waitUntil: 'domcontentloaded' });
            const result = await page.evaluate(async () => {
                globalThis.GM_getResourceText = () => '{}';
                globalThis.GM_getValue = (_key, fallback) => fallback;

                const returnButton = document.createElement('button');
                returnButton.id = 'return-focus';
                document.body.append(returnButton);
                returnButton.focus();

                const { openResourcePicker, removeResourcePicker, RESOURCE_PICKER_ROOT_ID } =
                    await import('/src/shared/ui/resource-picker.jsx?e2e-focus=1');

                openResourcePicker({
                    title: 'Pick media',
                    resources: [],
                    onDownload: async () => {},
                });
                await new Promise(resolve => requestAnimationFrame(resolve));

                const host = document.getElementById(RESOURCE_PICKER_ROOT_ID);
                const dialog = host.shadowRoot.querySelector('[role="dialog"]');
                const focusedDialog = host.shadowRoot.activeElement === dialog;
                removeResourcePicker();

                return {
                    modal: dialog.getAttribute('aria-modal'),
                    focusedDialog,
                    restored: document.activeElement === returnButton,
                };
            });

            expect(result).toEqual({ modal: 'true', focusedDialog: true, restored: true });
        } finally {
            await page.close();
        }
    });

    test('download status reports failed fetches', async () => {
        const page = await e2e.context.newPage();
        try {
            await page.goto(`${VITE_URL}/src/shared/general.js`, { waitUntil: 'domcontentloaded' });
            const result = await page.evaluate(async () => {
                globalThis.GM_getResourceText = () => '{}';
                globalThis.GM_getValue = (_key, fallback) => fallback;
                globalThis.GM_setValue = () => {};
                globalThis.GM_info = { script: { version: 'e2e' } };

                const { saveFiles } = await import('/src/shared/general.js?e2e-download-failure=1');
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
                    const status = document.getElementById('ig-helper-download-status');
                    return {
                        success,
                        state: status?.dataset.status,
                        role: status?.getAttribute('role'),
                        text: status?.textContent,
                    };
                } finally {
                    globalThis.fetch = originalFetch;
                }
            });

            expect(result.success).toBe(false);
            expect(result.state).toBe('failed');
            expect(result.role).toBe('status');
            expect(result.text).toBe('Download failed');
        } finally {
            await page.close();
        }
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
                panelRadius: getComputedStyle(root.querySelector('.resource-picker')).borderRadius,
                titleSize: getComputedStyle(root.querySelector('.resource-picker-title strong')).fontSize,
            })`);
            expect(resources.items).toBeGreaterThan(0);
            expect(resources.checkboxes).toBeGreaterThan(0);
            expect(resources.panelRadius).toBe('16px');
            expect(resources.titleSize).toBe('19px');

            await e2e.page.setViewportSize({ width: 320, height: 800 });
            const mobile = await e2e.shadowJson(RESOURCE_PICKER_ROOT_ID, `(() => {
                const footer = root.querySelector('.resource-picker-footer');
                const panel = root.querySelector('.resource-picker');
                const count = root.querySelector('.resource-picker-count');
                const buttons = [...footer.querySelectorAll('.btn')];
                return {
                    width: footer.clientWidth,
                    scrollWidth: footer.scrollWidth,
                    height: footer.clientHeight,
                    panelBottom: panel.getBoundingClientRect().bottom,
                    viewportHeight: innerHeight,
                    countAboveButtons: count.getBoundingClientRect().bottom <= Math.min(...buttons.map(button => button.getBoundingClientRect().top)),
                };
            })()`);
            expect(mobile.scrollWidth).toBeLessThanOrEqual(mobile.width + 1);
            expect(mobile.height).toBeLessThanOrEqual(100);
            expect(mobile.panelBottom).toBeLessThanOrEqual(mobile.viewportHeight + 1);
            expect(mobile.countAboveButtons).toBe(true);

            await e2e.page.emulateMedia({ colorScheme: 'dark' });
            const dark = await e2e.shadowJson(RESOURCE_PICKER_ROOT_ID, `(() => {
                const panel = root.querySelector('.resource-picker');
                return {
                    background: getComputedStyle(panel).backgroundColor,
                    foreground: getComputedStyle(panel).color,
                };
            })()`);
            expect(dark.background).toBe('rgb(0, 0, 0)');
            expect(dark.foreground).toBe('rgb(245, 245, 245)');
            await e2e.page.emulateMedia({ colorScheme: 'light' });
            await e2e.page.setViewportSize({ width: 1280, height: 900 });

            await e2e.clickShadow(RESOURCE_PICKER_ROOT_ID, '.resource-picker-footer .btn[data-variant="outline"]');
            await e2e.waitFor(`(() => {
                const root = document.getElementById(${JSON.stringify(RESOURCE_PICKER_ROOT_ID)})?.shadowRoot;
                const boxes = [...(root?.querySelectorAll('.resource-picker-item .input[type="checkbox"]') || [])];
                return boxes.length > 0 && boxes.every(box => box.checked);
            })()`, 3000);

            const checkedIndicator = await e2e.shadowJson(RESOURCE_PICKER_ROOT_ID, `(() => {
                const checkbox = root.querySelector('.resource-picker-item .input[type="checkbox"]');
                const style = getComputedStyle(checkbox, '::after');
                return { width: style.width, maskImage: style.maskImage };
            })()`);
            expect(Number.parseFloat(checkedIndicator.width)).toBeGreaterThan(0);
            expect(checkedIndicator.maskImage).not.toBe('none');

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

            await e2e.evaluate(`(() => {
                window.__igHelperDownloadStates = [];
                window.__igHelperDownloadStatusObserver?.disconnect();
                window.__igHelperDownloadStatusObserver = new MutationObserver(() => {
                    const status = document.getElementById('ig-helper-download-status')?.dataset.status;
                    if (status) window.__igHelperDownloadStates.push(status);
                });
                window.__igHelperDownloadStatusObserver.observe(document.body, {
                    childList: true,
                    subtree: true,
                    attributes: true,
                    attributeFilter: ['data-status'],
                });
            })()`);
            await e2e.clickShadow(RESOURCE_PICKER_ROOT_ID, '.resource-picker-footer .btn[data-variant="primary"]');
            await e2e.waitFor(`!document.getElementById(${JSON.stringify(RESOURCE_PICKER_ROOT_ID)})`, 3000);

            const { begin, complete } = await e2e.waitForCompletedDownload(30000);

            expect(begin).toBeDefined();
            expect(begin.suggestedFilename).toMatch(/\.(jpg|jpeg|png|webp|mp4)$/i);
            expect(complete.filePath).toBeTruthy();
            expect(complete.totalBytes).toBeGreaterThan(1000);
            expect(complete.receivedBytes).toBe(complete.totalBytes);
            await e2e.waitFor(`window.__igHelperDownloadStates?.includes('complete')`, 3000);
            const downloadStates = await e2e.json('window.__igHelperDownloadStates');
            expect(downloadStates).toContain('started');
            expect(downloadStates).toContain('complete');
            await e2e.evaluate('window.__igHelperDownloadStatusObserver?.disconnect()');

        });
    });

    test('resource picker renders Korean item counts without leaking placeholders', async () => {
        await e2e.openSettings();
        const originalLanguage = await e2e.readLanguage();

        try {
            await e2e.setLanguage('ko');
            await e2e.closeSettings();

            await e2e.withSettings({
                DIRECT_DOWNLOAD_MODE: DIRECT_DOWNLOAD_MODE_OPTIONS.ASK,
                FORCE_FETCH_ALL_RESOURCES: false,
                FORCE_RESOURCE_VIA_MEDIA: false,
            }, async () => {
                await e2e.ensurePostControls();
                await e2e.click('.button_wrapper .IG_DW_MAIN');
                await e2e.waitFor(`!!document.getElementById(${JSON.stringify(RESOURCE_PICKER_ROOT_ID)})?.shadowRoot?.querySelector('.resource-picker-title span')`, 20000);

                const itemCount = await e2e.shadowJson(
                    RESOURCE_PICKER_ROOT_ID,
                    `root.querySelector('.resource-picker-title span')?.textContent || ''`,
                );
                expect(itemCount).not.toContain('%COUNT%');
                expect(itemCount).toMatch(/^\d+개 항목$/);

                await e2e.clickShadow(RESOURCE_PICKER_ROOT_ID, '.resource-picker-header .btn[data-size="icon-sm"]');
            });
        } finally {
            await e2e.openSettings();
            await e2e.setLanguage(originalLanguage);
            await e2e.closeSettings();
        }
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

    test('Reels controls remount after Instagram replaces the helper subtree', async () => {
        await e2e.goto('https://www.instagram.com/reels/');
        await e2e.waitFor(`document.querySelectorAll('.IG_REELS').length > 0`, 20000);

        const initial = await e2e.json(`({
            hosts: document.querySelectorAll('.IG_REEL_CONTROLS').length,
            downloads: document.querySelectorAll('.IG_REELS').length,
            newTabs: document.querySelectorAll('.IG_REELS_NEWTAB').length,
            thumbnails: document.querySelectorAll('.IG_REELS_THUMBNAIL').length,
            legacy: document.querySelectorAll('.IG_REELS.IG_LEGACY_CONTROL').length,
        })`);
        expect(initial.hosts).toBeGreaterThan(0);
        expect(initial.downloads).toBeGreaterThan(0);
        expect(initial.newTabs).toBeGreaterThan(0);
        expect(initial.thumbnails).toBeGreaterThan(0);
        expect(initial.legacy).toBe(0);

        await e2e.evaluate(`(() => {
            window.__igHelperReelSlider = document.querySelector('div.volume_slider');
            document.querySelector('.IG_REEL_CONTROLS')?.remove();
        })()`);
        await e2e.waitFor(`document.querySelectorAll('.IG_REEL_CONTROLS').length >= ${initial.hosts}`, 5000);

        const remounted = await e2e.json(`({
            hosts: document.querySelectorAll('.IG_REEL_CONTROLS').length,
            controlsComplete: [...document.querySelectorAll('.IG_REEL_CONTROLS')].every(host =>
                host.querySelectorAll('.IG_REELS').length === 1 &&
                host.querySelectorAll('.IG_REELS_NEWTAB').length === 1 &&
                host.querySelectorAll('.IG_REELS_THUMBNAIL').length === 1
            ),
            sliderPreserved: !window.__igHelperReelSlider || window.__igHelperReelSlider.isConnected,
        })`);
        expect(remounted.hosts).toBe(initial.hosts);
        expect(remounted.controlsComplete).toBe(true);
        expect(remounted.sliderPreserved).toBe(true);
    });

    test('Story controls mount when the authenticated home feed exposes a live story', async () => {
        await e2e.goto(INSTAGRAM_HOME);
        const storyUrl = await e2e.evaluate(`(() => {
            const link = [...document.querySelectorAll('a[href^="/stories/"]')]
                .find(anchor => !anchor.getAttribute('href')?.startsWith('/stories/highlights/'));
            return link ? new URL(link.href, location.origin).href : '';
        })()`);
        test.skip(!storyUrl, 'No live story is available in the authenticated feed');

        await e2e.goto(storyUrl);
        await e2e.waitFor(`document.querySelectorAll('.IG_DWSTORY').length > 0`, 15000);
        expect(await e2e.json(`document.querySelectorAll('.IG_DWSTORY').length`)).toBeGreaterThan(0);
        expect(await e2e.json(`document.querySelectorAll('.IG_DWNEWTAB').length`)).toBeGreaterThan(0);
    });

    test('Highlight controls mount when the profile exposes a highlight', async () => {
        await e2e.goto(PROFILE_URL);
        const highlightUrl = await e2e.evaluate(`(() => {
            const link = document.querySelector('a[href^="/stories/highlights/"]');
            return link ? new URL(link.href, location.origin).href : '';
        })()`);
        test.skip(!highlightUrl, 'No highlight is available on the configured profile');

        await e2e.goto(highlightUrl);
        await e2e.waitFor(`document.querySelectorAll('.IG_DWHISTORY').length > 0`, 15000);
        expect(await e2e.json(`document.querySelectorAll('.IG_DWHISTORY').length`)).toBeGreaterThan(0);
        expect(await e2e.json(`document.querySelectorAll('.IG_DWHINEWTAB').length`)).toBeGreaterThan(0);
    });

});
