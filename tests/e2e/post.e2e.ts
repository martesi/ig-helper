import { expect, test } from '@playwright/test';
import { DIRECT_DOWNLOAD_MODE_OPTIONS } from '../../src/settings/schema.js';
import { IMAGE_VIEWER_ROOT_ID, PERMALINK_URL, VITE_URL, IgHelperE2E, registerE2E, requireAuthenticatedProfile } from './harness.ts';
const RESOURCE_PICKER_ROOT_ID = 'ig-helper-resource-picker-root';
const e2e = new IgHelperE2E();

test.describe('IG Helper browser E2E', () => {
    registerE2E(test, e2e);

    test.describe('UI', { tag: '@ui' }, () => {
        test('direct permalink mounts post controls on the media container', async () => {
            await e2e.goto(PERMALINK_URL);
            await e2e.waitFor(`document.querySelectorAll('[data-snig="canDownload"] .button_wrapper').length > 0`, 15000);

            const state = await e2e.json(`({
                href: location.href,
                targets: document.querySelectorAll('[data-snig="canDownload"]').length,
                wrappers: document.querySelectorAll('[data-snig="canDownload"] .button_wrapper').length,
                duplicateControlSections: [...document.querySelectorAll('section')].filter(section =>
                    section.querySelectorAll('.button_wrapper.IG_CONTROL_BAR').length > 1
                ).length,
                media: [...document.querySelectorAll('[data-snig="canDownload"] img, [data-snig="canDownload"] video')].some(element => {
                    const rect = element.getBoundingClientRect();
                    return rect.width > 64 && rect.height > 64;
                }),
            })`);

            expect(state.href).toBe(PERMALINK_URL);
            expect(state.targets).toBeGreaterThan(0);
            expect(state.wrappers).toBeGreaterThan(0);
            expect(state.duplicateControlSections).toBe(0);
            expect(state.media).toBe(true);
        });

        test('post control bar keeps only download visible and reveals the rest on hover', async () => {
            await e2e.withSettings({
                SHOW_MEDIA_PREVIEW: true,
                SHOW_OPEN_IN_NEW_TAB_BUTTON: true,
            }, async () => {
                await e2e.ensurePostControls();

            const wrapper = e2e.page.locator('.button_wrapper.IG_CONTROL_BAR').first();

            const closed = await wrapper.evaluate(host => {
                const root = host?.shadowRoot;
                const download = root?.querySelector('.IG_DW_MAIN');
                const menu = root?.querySelector('.IG_CONTROL_MENU');
                const rect = download?.getBoundingClientRect();
                return {
                    downloadVisible: Boolean(rect && rect.width === 40 && rect.height === 40),
                    menuClosed: menu?.getAttribute('data-open') === 'false'
                        && menu?.getAttribute('aria-hidden') === 'true'
                        && getComputedStyle(menu).visibility === 'hidden',
                    toggle: download?.getAttribute('aria-haspopup') === 'menu'
                        && download?.getAttribute('aria-expanded') === 'false',
                    sidebarHidden: [...(root?.querySelectorAll('.IG_POST_CONTROL') || [])]
                        .filter(button => !button.classList.contains('IG_DW_MAIN'))
                        .every(button => getComputedStyle(button).visibility === 'hidden'),
                };
            });
            expect(closed).toEqual({ downloadVisible: true, menuClosed: true, toggle: true, sidebarHidden: true });

            await e2e.openPostMenu(wrapper);

            const controls = await wrapper.evaluate(host => {
                const root = host?.shadowRoot;
                const menu = root?.querySelector('.IG_CONTROL_MENU');
                const items = [...(menu?.querySelectorAll('[role="menuitem"]') || [])];
                const triggerRect = root?.querySelector('.IG_DW_MAIN')?.getBoundingClientRect();
                const menuRect = menu?.getBoundingClientRect();
                return {
                    viewerOrThumbnail: Boolean(root?.querySelector('.IG_IMAGE_VIEWER, .IG_THUMBNAIL_MAIN')),
                    newTab: Boolean(root?.querySelector('.IG_NEWTAB_MAIN')),
                    copy: Boolean(root?.querySelector('.IG_COPY_MAIN')),
                    download: Boolean(root?.querySelector('.IG_DW_MAIN')),
                    menuOpen: menu?.getAttribute('data-open') === 'true'
                        && menu?.getAttribute('aria-hidden') === 'false',
                    expanded: root?.querySelector('.IG_DW_MAIN')?.getAttribute('aria-expanded') === 'true',
                    itemsMounted: items.length,
                    allItems: items.length > 0 && items.every(item =>
                        item.tagName === 'BUTTON' &&
                        item.classList.contains('IG_POST_CONTROL') &&
                        Boolean(item.getAttribute('aria-label')) &&
                        Boolean(item.querySelector('svg')) &&
                        (item.textContent || '').trim().length > 0 &&
                        item.getBoundingClientRect().height === 40
                    ),
                    anchored: Boolean(triggerRect && menuRect) && (() => {
                        const gapBelow = Math.round(menuRect.top - triggerRect.bottom);
                        const gapAbove = Math.round(triggerRect.top - menuRect.bottom);
                        return menu?.getAttribute('data-placement') === 'top'
                            ? Math.abs(gapAbove - 6) <= 1
                            : Math.abs(gapBelow - 6) <= 1;
                    })(),
                    inViewport: Boolean(menuRect)
                        && menuRect.left >= 0
                        && menuRect.right <= innerWidth + 1
                        && menuRect.top >= 0
                        && menuRect.bottom <= innerHeight + 1,
                };
            });

            expect(controls.viewerOrThumbnail).toBe(true);
            expect(controls.newTab).toBe(true);
            expect(controls.copy).toBe(true);
            expect(controls.download).toBe(true);
            expect(controls.menuOpen).toBe(true);
            expect(controls.expanded).toBe(true);
            expect(controls.itemsMounted).toBeGreaterThan(0);
            expect(controls.allItems).toBe(true);
            expect(controls.anchored).toBe(true);
            expect(controls.inViewport).toBe(true);

            await e2e.page.mouse.move(8, 8);
            await e2e.waitFor(`document.querySelector('.button_wrapper.IG_CONTROL_BAR')?.shadowRoot?.querySelector('.IG_CONTROL_MENU')?.getAttribute('data-open') === 'false'`, 3000);
            });
        });

        test('post action row places native-sized controls beside Save', async () => {
            await e2e.withSettings({
                SHOW_MEDIA_PREVIEW: true,
                SHOW_OPEN_IN_NEW_TAB_BUTTON: true,
            }, async () => {
                await e2e.ensurePostControls();

            const imageControls = e2e.page.locator('.button_wrapper.IG_CONTROL_BAR')
                .filter({ has: e2e.page.locator('.IG_IMAGE_VIEWER') })
                .first();
            await imageControls.waitFor({ state: 'visible', timeout: 15000 });

            const controls = await imageControls.evaluate(wrapper => {
                const root = wrapper?.shadowRoot;
                const section = wrapper?.closest('section');
                const groups = section ? [...section.children].filter(child => child.tagName === 'DIV') : [];
                const saveIcon = section?.querySelector('svg[aria-label="Save"], svg[aria-label="Remove"]');
                const saveGroup = groups.find(group => group.contains(saveIcon));
                const saveItem = saveIcon?.closest('[role="button"]');
                const wrapperRect = wrapper?.getBoundingClientRect();
                const saveRect = saveIcon?.getBoundingClientRect();
                const buttonRects = [...(root?.querySelectorAll('.IG_DW_MAIN') || [])]
                    .map(button => button.getBoundingClientRect());
                return {
                    wrappers: document.querySelectorAll('.button_wrapper.IG_CONTROL_BAR').length,
                    viewer: Boolean(root?.querySelector('.IG_IMAGE_VIEWER')),
                    newTab: Boolean(root?.querySelector('.IG_NEWTAB_MAIN')),
                    download: Boolean(root?.querySelector('.IG_DW_MAIN')),
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
            });
            expect(controls.wrappers).toBeGreaterThan(0);
            expect(controls.viewer).toBe(true);
            expect(controls.newTab).toBe(true);
            expect(controls.download).toBe(true);
            expect(controls.besideSave).toBe(true);
            expect(controls.nativeButtonSize).toBe(true);
            expect(controls.saveGap).toBe(8);
            expect(controls.aligned).toBe(true);
            expect(controls.marginRight).toBe('8px');
            expect(controls.saveItem).toBe(true);
            expect(controls.position).toBe('static');

            await e2e.openPostMenu(imageControls);
            const menu = await imageControls.evaluate(wrapper => {
                const root = wrapper?.shadowRoot;
                const triggerRect = root?.querySelector('.IG_DW_MAIN')?.getBoundingClientRect();
                const menuElement = root?.querySelector('.IG_CONTROL_MENU');
                const menuRect = menuElement?.getBoundingClientRect();
                const rows = [...(menuElement?.querySelectorAll('[role="menuitem"]') || [])]
                    .map(item => `${Math.round(item.getBoundingClientRect().width)}x${Math.round(item.getBoundingClientRect().height)}`);
                const placement = menuElement?.getAttribute('data-placement');
                const gap = triggerRect && menuRect
                    ? placement === 'top'
                        ? Math.round(triggerRect.top - menuRect.bottom)
                        : Math.round(menuRect.top - triggerRect.bottom)
                    : null;
                return {
                    open: menuElement?.getAttribute('data-open'),
                    placement,
                    gap,
                    rightAligned: Boolean(triggerRect && menuRect) && Math.abs(menuRect.right - triggerRect.right) <= 1,
                    inViewport: Boolean(menuRect) && menuRect.bottom <= innerHeight + 1 && menuRect.left >= 0,
                    rows,
                };
            });
            expect(menu.open).toBe('true');
            // The action row sits in the lower third of a 900px viewport, so the menu opens upward.
            expect(menu.placement).toBe('top');
            expect(menu.gap).toBe(6);
            expect(menu.rightAligned).toBe(true);
            expect(menu.inViewport).toBe(true);
            expect(menu.rows.length).toBeGreaterThan(0);
            expect(menu.rows.every(row => row.endsWith('x40'))).toBe(true);

            await e2e.page.setViewportSize({ width: 1280, height: 1400 });
            await e2e.waitFor(`document.querySelector('.button_wrapper.IG_CONTROL_BAR')?.shadowRoot?.querySelector('.IG_CONTROL_MENU')?.dataset.placement === 'bottom'`, 3000);
            const belowMenu = await imageControls.evaluate(wrapper => {
                const root = wrapper?.shadowRoot;
                const trigger = root?.querySelector('.IG_DW_MAIN')?.getBoundingClientRect();
                const menuElement = root?.querySelector('.IG_CONTROL_MENU');
                const menuRect = menuElement?.getBoundingClientRect();
                return {
                    placement: menuElement?.getAttribute('data-placement'),
                    gap: trigger && menuRect ? Math.round(menuRect.top - trigger.bottom) : null,
                };
            });
            expect(belowMenu.placement).toBe('bottom');
            expect(belowMenu.gap).toBe(6);
            await e2e.page.setViewportSize({ width: 1280, height: 900 });

            });
        });

        test('post control menu handles keyboard, long-press and carousel remounts', async () => {
            await e2e.withSettings({ SHOW_MEDIA_PREVIEW: true }, async () => {
                await e2e.ensurePostControls();
                const wrapper = e2e.page.locator('.button_wrapper.IG_CONTROL_BAR').first();
                const download = wrapper.locator('.IG_DW_MAIN');
                const menuState = () => wrapper.evaluate(host =>
                    host.shadowRoot?.querySelector('.IG_CONTROL_MENU')?.getAttribute('data-open'));

                // Keyboard: ArrowDown opens and focuses the first item; Escape restores the trigger.
                await download.focus();
                await download.press('ArrowDown');
                await wrapper.locator('.IG_CONTROL_MENU[data-open="true"]').waitFor({ state: 'visible', timeout: 3000 });

                const keyboard = await wrapper.evaluate(host => {
                    const root = host?.shadowRoot;
                    const items = [...(root?.querySelectorAll('[role="menuitem"]') || [])];
                    return {
                        focusedFirst: root?.activeElement === items[0],
                        roving: items.filter(item => item.tabIndex === 0).length,
                        expanded: root?.querySelector('.IG_DW_MAIN')?.getAttribute('aria-expanded'),
                    };
                });
                expect(keyboard).toEqual({ focusedFirst: true, roving: 1, expanded: 'true' });

                // Pointer drift must not dismiss a menu that owns keyboard focus.
                await e2e.page.mouse.move(8, 8);
                await e2e.page.waitForTimeout(400);
                expect(await menuState()).toBe('true');

                await e2e.page.keyboard.press('Escape');
                await e2e.waitFor(`document.querySelector('.button_wrapper.IG_CONTROL_BAR')?.shadowRoot?.querySelector('.IG_CONTROL_MENU')?.getAttribute('data-open') === 'false'`, 3000);
                expect(await wrapper.evaluate(host =>
                    host.shadowRoot?.activeElement === host.shadowRoot?.querySelector('.IG_DW_MAIN'))).toBe(true);

                // A focused trigger (e.g. after a click) must not pin a hover-opened menu open.
                await e2e.openPostMenu(wrapper);
                await download.focus();
                await e2e.page.mouse.move(8, 8);
                await e2e.waitFor(`document.querySelector('.button_wrapper.IG_CONTROL_BAR')?.shadowRoot?.querySelector('.IG_CONTROL_MENU')?.getAttribute('data-open') === 'false'`, 3000);

                // Long-press (touch) opens the menu without triggering a download.
                const cdp = await e2e.context.newCDPSession(e2e.page);
                const box = await download.boundingBox();
                await cdp.send('Input.dispatchTouchEvent', {
                    type: 'touchStart',
                    touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }],
                });
                await e2e.page.waitForTimeout(700);
                await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
                await cdp.detach();
                await wrapper.locator('.IG_CONTROL_MENU[data-open="true"]').waitFor({ state: 'visible', timeout: 3000 });

                // Close with a synthetic outside pointerdown so the test never navigates the page.
                await wrapper.evaluate(() => {
                    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }));
                });
                await e2e.waitFor(`document.querySelector('.button_wrapper.IG_CONTROL_BAR')?.shadowRoot?.querySelector('.IG_CONTROL_MENU')?.getAttribute('data-open') === 'false'`, 3000);

                // Carousel navigation re-mounts the controls, which dismisses the menu.
                await e2e.openPostMenu(wrapper);
                await e2e.page.getByRole('button', { name: 'Next' }).first().click({ timeout: 5000 });
                await e2e.page.waitForTimeout(900);
                expect(await menuState()).toBe('false');
            });
        });

        test('preview setting hides only the lightbox button', async () => {
            await e2e.withSettings({
                DIRECT_DOWNLOAD_MODE: DIRECT_DOWNLOAD_MODE_OPTIONS.ASK,
                SHOW_MEDIA_PREVIEW: false,
                SHOW_OPEN_IN_NEW_TAB_BUTTON: false,
                FORCE_RESOURCE_VIA_MEDIA: false,
            }, async () => {
                await e2e.ensurePostControls();
                const wrapper = e2e.page.locator('.button_wrapper.IG_CONTROL_BAR')
                    .filter({ hasNot: e2e.page.locator('.IG_THUMBNAIL_MAIN') })
                    .first();
                await wrapper.waitFor({ state: 'visible', timeout: 15000 });

                const controls = await wrapper.evaluate(host => {
                    const root = host.shadowRoot;
                    return {
                        viewer: Boolean(root?.querySelector('.IG_IMAGE_VIEWER')),
                        copy: Boolean(root?.querySelector('.IG_COPY_MAIN')),
                        newTab: Boolean(root?.querySelector('.IG_NEWTAB_MAIN')),
                        download: Boolean(root?.querySelector('.IG_DW_MAIN')),
                    };
                });
                expect(controls).toEqual({ viewer: false, copy: true, newTab: false, download: true });
            });
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
    });

    test.describe('Authenticated UI', { tag: ['@ui', '@auth'] }, () => {
        requireAuthenticatedProfile(test, e2e);
        test('image viewer supports rotate, zoom, and close', async () => {
            await e2e.withSettings({ SHOW_MEDIA_PREVIEW: true }, async () => {
                await e2e.ensurePostControls();
                const imageControls = e2e.page.locator('.button_wrapper.IG_CONTROL_BAR')
                    .filter({ has: e2e.page.locator('.IG_IMAGE_VIEWER') })
                    .first();
                const downloadButton = imageControls.locator('.IG_DW_MAIN');
                await downloadButton.hover();
                await expect(downloadButton).toHaveCSS('transform', 'matrix(1.05, 0, 0, 1.05, 0, 0)');
                await expect(downloadButton).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
                await e2e.openPostMenu(imageControls);
                await imageControls.locator('.IG_IMAGE_VIEWER').click();
                await e2e.waitFor(`!!document.getElementById(${JSON.stringify(IMAGE_VIEWER_ROOT_ID)})`, 3000);

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
            });
        });

        test('image viewer ignores a stale cached carousel image', async () => {
            await e2e.withSettings({ SHOW_MEDIA_PREVIEW: true }, async () => {
                await e2e.ensurePostControls();
                const initialSrc = await e2e.page.locator('[data-snig="canDownload"] img[alt][src]').first().evaluate(image =>
                    (image as HTMLImageElement).currentSrc || (image as HTMLImageElement).src
                );
                const next = e2e.page.getByRole('button', { name: 'Next' }).first();
                await next.click();
                await e2e.page.waitForTimeout(700);

                const expected = await e2e.page.evaluate(() => {
                    const article = document.querySelector<HTMLElement>('[data-snig="canDownload"]');
                    if (!article) return null;
                    const images = [...article.querySelectorAll<HTMLImageElement>('img[alt][src]')]
                        .filter(image => {
                            const rect = image.getBoundingClientRect();
                            return rect.width > 64 && rect.height > 64 && rect.left >= 0 && rect.right <= innerWidth;
                        });
                    const current = images[0];
                    if (!current) return null;
                    return current.currentSrc || current.src;
                });
                expect(expected).toBeTruthy();

                await e2e.page.evaluate(staleSrc => {
                    const article = document.querySelector<HTMLElement>('[data-snig="canDownload"]');
                    const host = article?.querySelector<HTMLElement>('.button_wrapper.IG_CONTROL_BAR');
                    if (!article || !host) throw new Error('Could not find post preview controls');
                    globalThis.jQuery(article).data('igHelper_displayResourceURL', staleSrc);
                    host.shadowRoot?.querySelector<HTMLButtonElement>('.IG_IMAGE_VIEWER')?.click();
                }, initialSrc);
                await e2e.waitFor(`!!document.getElementById(${JSON.stringify(IMAGE_VIEWER_ROOT_ID)})`, 3000);

                const viewerSrc = await e2e.shadowJson(IMAGE_VIEWER_ROOT_ID, `root.querySelector('#iv_image')?.src`);
                expect(viewerSrc).toBe(expected);
            });
        });

        test('resource picker selection and responsive styling', async () => {
            await e2e.withSettings({
                DIRECT_DOWNLOAD_MODE: DIRECT_DOWNLOAD_MODE_OPTIONS.ASK,
                FORCE_RESOURCE_VIA_MEDIA: false,
            }, async () => {
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

                await e2e.clickShadow(RESOURCE_PICKER_ROOT_ID, '.resource-picker-header .btn[data-size="icon-sm"]');
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
    });

    test.describe('Authenticated Execution', { tag: ['@execution', '@auth'] }, () => {
        requireAuthenticatedProfile(test, e2e);
        test('copy current post image writes image data and reports success', async () => {
            await e2e.ensurePostControls();
            const imageControls = e2e.page.locator('.button_wrapper.IG_CONTROL_BAR')
                .filter({ has: e2e.page.locator('.IG_IMAGE_VIEWER') })
                .first();
            const copyButton = imageControls.locator('.IG_COPY_MAIN');
            await copyButton.waitFor({ state: 'attached', timeout: 15000 });

            await e2e.evaluate(`(() => {
                window.__igHelperCopyWrites = 0;
                window.__igHelperCopyType = '';
                window.__igHelperCopyBlobType = '';
                window.__igHelperCopyMocks = {
                    clipboard: Object.getOwnPropertyDescriptor(navigator, 'clipboard'),
                    clipboardItem: Object.getOwnPropertyDescriptor(window, 'ClipboardItem'),
                };
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
                await e2e.dismissInstagramNotificationPrompt();
                await e2e.actionDelay();
                await e2e.openPostMenu(imageControls);
                await copyButton.click();
                await e2e.waitFor(`window.__igHelperCopyWrites === 1`, 3000);
                await expect(copyButton).toHaveAttribute('data-copied', 'true');
                const result = await e2e.json(`({
                    writes: window.__igHelperCopyWrites,
                    type: window.__igHelperCopyType,
                    blobType: window.__igHelperCopyBlobType,
                })`);
                expect(result.writes).toBe(1);
                expect(result.type).toMatch(/^image\//);
                expect(result.blobType).toBe(result.type);
            } finally {
                await e2e.evaluate(`(() => {
                    const mocks = window.__igHelperCopyMocks;
                    if (!mocks) return;
                    if (mocks.clipboardItem) Object.defineProperty(window, 'ClipboardItem', mocks.clipboardItem);
                    else delete window.ClipboardItem;
                    if (mocks.clipboard) Object.defineProperty(navigator, 'clipboard', mocks.clipboard);
                    else delete navigator.clipboard;
                    delete window.__igHelperCopyMocks;
                })()`);
            }
        });

        test('open-in-new-tab creates a real Chrome target', async () => {
            await e2e.withSettings({ SHOW_OPEN_IN_NEW_TAB_BUTTON: true }, async () => {
                await e2e.ensurePostControls();
                await e2e.dismissInstagramNotificationPrompt();
                await e2e.openPostMenu();

                const created = await e2e.clickAndWaitForPage('.button_wrapper .IG_NEWTAB_MAIN');

                expect(created.url()).not.toBe('about:blank');
                await created.close();
            });
        });

        test('download-all bypasses the resource picker', async () => {
            await e2e.withSettings({ DIRECT_DOWNLOAD_MODE: DIRECT_DOWNLOAD_MODE_OPTIONS.VISIBLE }, async () => {
                await e2e.goto(PERMALINK_URL);
                const wrapper = e2e.page.locator('.button_wrapper.IG_CONTROL_BAR').first();
                await e2e.openPostMenu(wrapper);
                const downloadAllButton = wrapper.locator('.IG_DW_ALL_MAIN');
                await downloadAllButton.waitFor({ state: 'visible', timeout: 15000 });

                await e2e.dismissInstagramNotificationPrompt();
                await e2e.actionDelay();
                await downloadAllButton.click();
                await e2e.page.waitForTimeout(1000);
                expect(await e2e.json(`!!document.getElementById(${JSON.stringify(RESOURCE_PICKER_ROOT_ID)})`)).toBe(false);
            });
        });

        test('real post media download completes on disk', async () => {
            await e2e.withSettings({
                DIRECT_DOWNLOAD_MODE: DIRECT_DOWNLOAD_MODE_OPTIONS.ASK,
                FORCE_RESOURCE_VIA_MEDIA: false,
                USE_EXTERNAL_DOWNLOAD_MODE: false,
                MODIFY_RESOURCE_EXIF: false,
            }, async () => {
                await e2e.configureDownloads();
                await e2e.ensurePostControls();
                await e2e.click('.button_wrapper .IG_DW_MAIN');
                await e2e.waitFor(`!!document.getElementById(${JSON.stringify(RESOURCE_PICKER_ROOT_ID)})?.shadowRoot?.querySelector('.resource-picker-item')`, 20000);

                await e2e.clickShadow(RESOURCE_PICKER_ROOT_ID, '.resource-picker-item .input[type="checkbox"]');
                await e2e.clickShadow(RESOURCE_PICKER_ROOT_ID, '.resource-picker-footer .btn[data-variant="primary"]');
                await e2e.waitFor(`!document.getElementById(${JSON.stringify(RESOURCE_PICKER_ROOT_ID)})`, 3000);

                const { begin, complete } = await e2e.waitForCompletedDownload(30000);
                expect(begin).toBeDefined();
                expect(begin.suggestedFilename).toMatch(/\.(jpg|jpeg|png|webp|mp4)$/i);
                expect(complete.filePath).toBeTruthy();
                expect(complete.totalBytes).toBeGreaterThan(1000);
                expect(complete.receivedBytes).toBe(complete.totalBytes);
                expect(await e2e.json('Boolean(document.getElementById("ig-helper-download-status"))')).toBe(false);
            });
        });
    });

});
