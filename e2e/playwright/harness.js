import { setTimeout as sleep } from 'node:timers/promises';
import { chromium } from '@playwright/test';

export const IMAGE_VIEWER_ROOT_ID = 'ig-helper-image-viewer-root';

export const CDP_HTTP = process.env.PLAYWRIGHT_CDP_ENDPOINT ?? 'http://127.0.0.1:2000';
export const INSTAGRAM_HOME = process.env.IG_HELPER_E2E_HOME ?? 'https://www.instagram.com/';
export const PROFILE_URL = process.env.IG_HELPER_E2E_PROFILE ?? 'https://www.instagram.com/instagram/';
export const VITE_URL = process.env.IG_HELPER_E2E_VITE ?? 'http://127.0.0.1:9000';
export const OPTIONS_URL = process.env.IG_HELPER_E2E_OPTIONS ?? VITE_URL;

const actionDelayMin = Number(process.env.IG_HELPER_E2E_ACTION_DELAY_MIN ?? 80);
const actionDelayMax = Math.max(actionDelayMin, Number(process.env.IG_HELPER_E2E_ACTION_DELAY_MAX ?? 220));

export class IgHelperE2E {
    constructor() {
        this.browser = null;
        this.context = null;
        this.page = null;
        this.downloadEvents = [];
        this.downloadCdp = null;
    }

    async start() {
        try {
            await this.connectBrowser();
            this.page = await this.createPage();
            await this.goto(INSTAGRAM_HOME);
        } catch (error) {
            await this.stop();
            throw error;
        }
    }

    async stop() {
        await this.downloadCdp?.detach().catch(() => {});
        await this.page?.close().catch(() => {});
        this.page = null;
        this.browser = null;
        this.context = null;
    }

    async connectBrowser() {
        this.browser = await chromium.connectOverCDP(CDP_HTTP);
        this.context = this.browser.contexts()[0];
        if (!this.context) throw new Error('Connected Chrome has no default browser context');
    }

    async createPage() {
        const page = await this.context.newPage();
        await page.setViewportSize({ width: 1280, height: 900 });
        return page;
    }

    async goto(url) {
        await this.actionDelay();
        await this.page.goto('about:blank');
        await this.page.goto(url, { waitUntil: 'domcontentloaded' });
        await this.page.bringToFront();
        await sleep(1200);
    }

    async reload() {
        const url = await this.evaluate('location.href');
        await this.downloadCdp?.detach().catch(() => {});
        this.downloadCdp = null;
        await this.page.close().catch(() => {});
        this.page = await this.createPage();
        await this.goto(url);
    }

    async evaluate(expression) {
        return this.page.evaluate(expression);
    }

    async json(expression) {
        return this.evaluate(expression);
    }

    async waitFor(expression, timeout = 10000) {
        return this.waitForOn(this.page, expression, timeout);
    }

    async waitForOn(page, expression, timeout = 10000) {
        await page.waitForFunction(expression, undefined, { timeout, polling: 100 });
    }

    async shadowJson(hostId, expression) {
        return this.json(`(() => {
            const root = document.getElementById(${JSON.stringify(hostId)})?.shadowRoot;
            if (!root) return null;
            return (${expression});
        })()`);
    }

    async clickShadow(hostId, selector, index = 0) {
        const locator = this.page.locator(`#${hostId}`).locator(selector).nth(index);
        await this.actionDelay();
        await locator.click();
    }

    async click(selector, index = 0) {
        await this.dismissInstagramNotificationPrompt();
        const locator = this.page.locator(selector).nth(index);
        await this.actionDelay();
        await locator.click();
    }

    async dismissInstagramNotificationPrompt() {
        if (!this.page.url().startsWith('https://www.instagram.com/')) return;

        const turnOn = this.page.getByRole('button', { name: 'Turn On', exact: true });
        if (!await turnOn.isVisible().catch(() => false)) return;

        const notNow = this.page.getByRole('button', { name: 'Not Now', exact: true });
        if (await notNow.isVisible().catch(() => false)) await notNow.click();
    }

    async pressLegacyHotkey(keyCode) {
        await this.page.bringToFront();
        await this.actionDelay();
        await this.page.keyboard.press(`Alt+${hotkeyKey(keyCode)}`);
        await sleep(250);
    }

    async openSettings(section = 'general') {
        await this.goto(`${OPTIONS_URL}/#/settings`);
        await this.waitFor(`document.querySelectorAll('[data-settings-section]').length === 8`, 10000);
        await this.locateSettingsSection(section);
    }

    async closeSettings() {
        await this.goto(INSTAGRAM_HOME);
    }

    async showGeneralSection() {
        await this.locateSettingsSection('general');
        await this.waitFor(`document.querySelectorAll('input[role="switch"]').length > 0`, 5000);
    }

    async showKeyboardTab() {
        await this.locateSettingsSection('keyboard');
        await this.waitFor(`document.querySelectorAll('.IG_HOTKEY_ROW .select').length > 0`, 5000);
    }

    async locateSettingsSection(section) {
        const target = `[data-settings-section="${section}"]`;
        await this.waitFor(`!!document.querySelector(${JSON.stringify(`[data-settings-locator="${section}"]`)}) && !!document.querySelector(${JSON.stringify(target)})`, 10000);
        await this.click(`[data-settings-locator="${section}"]`);
        await this.waitFor(`(() => {
            const rect = document.querySelector(${JSON.stringify(target)})?.getBoundingClientRect();
            return !!rect && rect.top >= 0 && rect.top < innerHeight / 2;
        })()`, 5000);
    }

    async readHotkeys() {
        await this.showKeyboardTab();
        return this.json(`({
            settings: Number(document.querySelector('#settingsHotkeyKeyCode-value')?.value),
            keyboard: Number(document.querySelector('#keySettingsHotkeyKeyCode-value')?.value),
            debug: Number(document.querySelector('#debugHotkeyKeyCode-value')?.value),
            story: Number(document.querySelector('#downloadStoryHotkeyKeyCode-value')?.value),
        })`);
    }

    async readLanguage() {
        await this.showGeneralSection();
        return this.evaluate(`document.querySelector('#langSelect-value')?.value`);
    }

    async setLanguage(language) {
        await this.showGeneralSection();
        const current = await this.readLanguage();
        if (current === language) return;

        await this.click('#langSelect-trigger');
        await this.click(`#langSelect-listbox [data-value="${language}"]`);
        await this.waitFor(`document.querySelector('#langSelect-value')?.value === ${JSON.stringify(language)}`, 3000);
    }

    async readSettings(names) {
        await this.showGeneralSection();
        return this.json(`Object.fromEntries(${JSON.stringify(names)}.map(name => {
            const element = document.querySelector('#' + name);
            const valueElement = document.querySelector('#' + name + '-value');
            return [name, valueElement ? valueElement.value : Boolean(element?.checked)];
        }))`);
    }

    async setSettings(values) {
        await this.showGeneralSection();
        for (const [name, desired] of Object.entries(values)) {
            const current = await this.evaluate(`(() => {
                const element = document.querySelector('#' + ${JSON.stringify(name)});
                const valueElement = document.querySelector('#' + ${JSON.stringify(name)} + '-value');
                return valueElement ? valueElement.value : Boolean(element?.checked);
            })()`);
            if (current === desired) continue;

            if (typeof desired === 'string') {
                await this.click(`#${name}-trigger`);
                await this.click(`#${name}-listbox [data-value="${desired}"]`);
                await this.waitFor(`document.querySelector('#${name}-value')?.value === ${JSON.stringify(desired)}`, 3000);
                continue;
            }

            await this.click(`label[for="${name}"]`);
            await this.waitFor(`document.querySelector('#${name}')?.checked === ${desired}`, 3000);
        }
    }

    async withSettings(values, action) {
        await this.openSettings();
        const names = Object.keys(values);
        const original = await this.readSettings(names);
        try {
            await this.setSettings(values);
            await this.closeSettings();
            return await action(original);
        } finally {
            if (!String(await this.evaluate('location.href')).startsWith(`${OPTIONS_URL}/settings/`)) {
                await this.openSettings();
            }
            await this.setSettings(original);
            await this.closeSettings();
        }
    }

    async ensurePostControls() {
        await this.goto(INSTAGRAM_HOME);
        await this.page.locator('.button_wrapper.IG_CONTROL_BAR').first().locator('.IG_DW_MAIN').waitFor({
            state: 'visible',
            timeout: 15000,
        });
    }

    async configureDownloads() {
        this.downloadEvents.length = 0;
        await this.downloadCdp?.detach().catch(() => {});
        this.downloadCdp = await this.context.newCDPSession(this.page);
        this.downloadCdp.on('Browser.downloadWillBegin', event => {
            this.downloadEvents.push({ type: 'begin', ...event });
        });
        this.downloadCdp.on('Browser.downloadProgress', event => {
            this.downloadEvents.push({ type: 'progress', ...event });
        });
        await this.downloadCdp.send('Browser.setDownloadBehavior', {
            behavior: 'default',
            eventsEnabled: true,
        });
    }

    async waitForCompletedDownload(timeout = 30000) {
        const deadline = Date.now() + timeout;
        while (Date.now() < deadline) {
            const complete = this.downloadEvents.find(event =>
                event.type === 'progress' && event.state === 'completed' && event.filePath
            );
            if (complete) {
                const begin = this.downloadEvents.find(event => event.type === 'begin' && event.guid === complete.guid);
                return { begin, complete };
            }
            const canceled = this.downloadEvents.find(event =>
                event.type === 'progress' && event.state === 'canceled'
            );
            if (canceled) throw new Error(`Browser canceled download ${canceled.guid}`);
            await sleep(100);
        }
        throw new Error('Browser download did not complete');
    }

    async clickAndWaitForPage(selector) {
        const pagePromise = this.context.waitForEvent('page', { timeout: 10000 });
        await this.click(selector);
        const page = await pagePromise;
        await page.waitForLoadState('domcontentloaded').catch(() => {});
        return page;
    }

    async actionDelay() {
        const ms = actionDelayMin + Math.floor(Math.random() * (actionDelayMax - actionDelayMin + 1));
        await sleep(ms);
    }
}

function hotkeyKey(keyCode) {
    if (keyCode === 192) return 'Backquote';
    return String.fromCharCode(keyCode);
}
