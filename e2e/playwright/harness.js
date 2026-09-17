import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { chromium } from '@playwright/test';
import { loadLocalCookies } from '../cookie-loader.js';

export const LEGACY_DIALOG_ROOT_ID = 'ig-helper-legacy-dialog-root';
export const IMAGE_VIEWER_ROOT_ID = 'ig-helper-image-viewer-root';

export const CDP_HTTP = process.env.IG_HELPER_E2E_CDP ?? 'http://127.0.0.1:9013';
export const INSTAGRAM_HOME = process.env.IG_HELPER_E2E_HOME ?? 'https://www.instagram.com/';
export const PROFILE_URL = process.env.IG_HELPER_E2E_PROFILE ?? 'https://www.instagram.com/instagram/';
export const VITE_URL = process.env.IG_HELPER_E2E_VITE ?? 'http://127.0.0.1:9000';
export const OPTIONS_URL = process.env.IG_HELPER_E2E_OPTIONS ?? 'http://127.0.0.1:9100';

const repoRoot = process.cwd();
const actionDelayMin = Number(process.env.IG_HELPER_E2E_ACTION_DELAY_MIN ?? 80);
const actionDelayMax = Math.max(actionDelayMin, Number(process.env.IG_HELPER_E2E_ACTION_DELAY_MAX ?? 220));

export class IgHelperE2E {
    constructor() {
        this.browser = null;
        this.context = null;
        this.page = null;
        this.viteProcesses = [];
        this.downloadEvents = [];
        this.downloadCdp = null;
    }

    async start() {
        await this.ensureDevServer();
        this.browser = await chromium.connectOverCDP(CDP_HTTP);
        this.context = this.browser.contexts()[0];
        if (!this.context) throw new Error('Connected Chrome has no default browser context');
        await this.context.addCookies(await loadLocalCookies(repoRoot));

        await this.installUserscript();
        this.page = await this.createPage();
        await this.goto(INSTAGRAM_HOME);
    }

    async stop() {
        await this.downloadCdp?.detach().catch(() => {});
        await this.page?.close().catch(() => {});
        this.page = null;

        this.viteProcesses.forEach(process => process.kill());
        this.viteProcesses = [];
    }

    async ensureDevServer() {
        const scriptReady = () => this.isReachable(`${VITE_URL}/__vite-plugin-monkey.install.user.js`);
        const pagesReady = () => this.isReachable(`${OPTIONS_URL}/settings/`);
        if (!await scriptReady()) this.startDevServer('dev:script');
        if (!await pagesReady()) this.startDevServer('dev:pages');

        const deadline = Date.now() + 10000;
        while (Date.now() < deadline) {
            if (await scriptReady() && await pagesReady()) return;
            await sleep(100);
        }
        throw new Error(`Vite did not become ready at ${VITE_URL} and ${OPTIONS_URL}`);
    }

    startDevServer(script) {
        this.viteProcesses.push(spawn('bun', ['run', script], {
            cwd: repoRoot,
            stdio: 'ignore',
        }));
    }

    async isReachable(url) {
        try {
            const response = await fetch(url, { signal: AbortSignal.timeout(800) });
            return response.ok;
        } catch {
            return false;
        }
    }

    async createPage() {
        const page = await this.context.newPage();
        await page.setViewportSize({ width: 1280, height: 900 });
        return page;
    }

    async installUserscript() {
        const page = await this.createPage();
        try {
            await page.goto(`${VITE_URL}/__vite-plugin-monkey.install.user.js`, { waitUntil: 'domcontentloaded' }).catch(error => {
                if (!String(error).includes('ERR_ABORTED')) throw error;
            });
            await this.waitForOn(page, `location.protocol === 'chrome-extension:' && !!document.querySelector('#confirm') && !document.querySelector('#confirm').disabled`, 5000);
            await this.actionDelay();
            await page.locator('#confirm').click();
            await this.waitForOn(page, `document.body?.innerText.includes('Script installed.')`, 5000);
        } finally {
            await page.close().catch(() => {});
        }
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
        await locator.scrollIntoViewIfNeeded();
        await this.actionDelay();
        await locator.click();
    }

    async click(selector, index = 0) {
        const locator = this.page.locator(selector).nth(index);
        await locator.scrollIntoViewIfNeeded();
        await this.actionDelay();
        await locator.click();
    }

    async pressLegacyHotkey(keyCode) {
        const key = hotkeyKey(keyCode);
        const code = hotkeyCode(keyCode);
        await this.actionDelay();
        return this.evaluate(`(() => {
            const event = new KeyboardEvent('keydown', {
                altKey: true,
                key: ${JSON.stringify(key)},
                code: ${JSON.stringify(code)},
                bubbles: true,
                cancelable: true,
            });
            Object.defineProperty(event, 'which', { get: () => ${keyCode} });
            Object.defineProperty(event, 'keyCode', { get: () => ${keyCode} });
            window.dispatchEvent(event);
            return event.defaultPrevented;
        })()`);
    }

    async openSettings(section = 'general') {
        await this.goto(`${OPTIONS_URL}/#/settings`);
        await this.waitFor(`document.querySelectorAll('[data-settings-section]').length === 7`, 5000);
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
        await this.waitFor(`!!document.querySelector(${JSON.stringify(`[data-settings-locator="${section}"]`)}) && !!document.querySelector(${JSON.stringify(target)})`, 3000);
        await this.click(`[data-settings-locator="${section}"]`);
        await this.waitFor(`(() => {
            const rect = document.querySelector(${JSON.stringify(target)})?.getBoundingClientRect();
            return !!rect && rect.top >= 0 && rect.top < innerHeight / 2;
        })()`, 3000);
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
        await this.waitFor(`document.querySelectorAll('.button_wrapper .IG_DW_MAIN').length > 0`, 15000);
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
    if (keyCode === 192) return '~';
    return String.fromCharCode(keyCode).toLowerCase();
}

function hotkeyCode(keyCode) {
    if (keyCode === 192) return 'Backquote';
    if (keyCode >= 49 && keyCode <= 53) return `Digit${String.fromCharCode(keyCode)}`;
    return `Key${String.fromCharCode(keyCode)}`;
}
