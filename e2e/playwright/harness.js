import { spawn, spawnSync } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { chromium } from '@playwright/test';
import { loadLocalCookies } from '../cookie-loader.js';

export const LEGACY_DIALOG_ROOT_ID = 'ig-helper-legacy-dialog-root';
export const IMAGE_VIEWER_ROOT_ID = 'ig-helper-image-viewer-root';

const externalCdpHttp = process.env.IG_HELPER_E2E_CDP;
export const CDP_HTTP = externalCdpHttp ?? 'http://127.0.0.1:9013';
export const INSTAGRAM_HOME = process.env.IG_HELPER_E2E_HOME ?? 'https://www.instagram.com/';
export const PROFILE_URL = process.env.IG_HELPER_E2E_PROFILE ?? 'https://www.instagram.com/instagram/';
export const VITE_URL = process.env.IG_HELPER_E2E_VITE ?? 'http://127.0.0.1:9000';
export const OPTIONS_URL = process.env.IG_HELPER_E2E_OPTIONS ?? 'http://127.0.0.1:9100';

const repoRoot = process.cwd();
const chromiumPath = process.env.IG_HELPER_E2E_CHROMIUM;
const extensionPath = process.env.IG_HELPER_E2E_EXTENSION;
const cspExtensionPath = process.env.IG_HELPER_E2E_CSP_EXTENSION;
const profileDir = process.env.IG_HELPER_E2E_PROFILE_DIR ?? `${repoRoot}/.browser-state/playwright`;
const actionDelayMin = Number(process.env.IG_HELPER_E2E_ACTION_DELAY_MIN ?? 80);
const actionDelayMax = Math.max(actionDelayMin, Number(process.env.IG_HELPER_E2E_ACTION_DELAY_MAX ?? 220));

export class IgHelperE2E {
    constructor() {
        this.browser = null;
        this.browserProcess = null;
        this.context = null;
        this.page = null;
        this.viteProcesses = [];
        this.downloadEvents = [];
        this.downloadCdp = null;
        this.xvfbProcess = null;
    }

    async start() {
        try {
            await this.ensureDevServer();
            await this.startBrowser();
            await this.context.addCookies(await loadLocalCookies(repoRoot));
            await this.installUserscript();
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

        if (!externalCdpHttp) {
            await this.browser?.close().catch(() => {});
            this.browserProcess?.kill();
            this.browserProcess = null;
        }
        this.browser = null;
        this.context = null;

        this.viteProcesses.forEach(process => process.kill());
        this.viteProcesses = [];

        this.xvfbProcess?.kill();
        this.xvfbProcess = null;
    }

    async startBrowser() {
        if (!externalCdpHttp) {
            await this.ensureDisplay();
            await this.launchOwnedBrowser();
        }

        await this.connectBrowser();

        if (!externalCdpHttp) await this.ensureUserScriptsEnabled();
    }

    async launchOwnedBrowser() {
        if (!chromiumPath || !extensionPath) {
            throw new Error('Playwright E2E requires the repo e2e shell; run `bun run test:e2e`.');
        }
        if (await this.isReachable(`${CDP_HTTP}/json/version`)) {
            throw new Error(`Playwright E2E CDP port is already in use: ${CDP_HTTP}`);
        }

        const extensions = [extensionPath, cspExtensionPath].filter(Boolean).join(',');
        this.browserProcess = spawn(chromiumPath, [
            '--remote-debugging-address=127.0.0.1',
            '--remote-debugging-port=9013',
            `--user-data-dir=${profileDir}`,
            '--no-first-run',
            '--no-default-browser-check',
            `--disable-extensions-except=${extensions}`,
            `--load-extension=${extensions}`,
            '--disable-features=LocalNetworkAccessChecks',
            '--no-sandbox',
            '--disable-dev-shm-usage',
            'about:blank',
        ], {
            cwd: repoRoot,
            stdio: 'ignore',
        });

        const deadline = Date.now() + 10000;
        while (Date.now() < deadline) {
            if (await this.isReachable(`${CDP_HTTP}/json/version`)) return;
            if (this.browserProcess.exitCode != null) {
                throw new Error(`Owned Chromium exited with code ${this.browserProcess.exitCode}`);
            }
            await sleep(100);
        }
        throw new Error(`Owned Chromium did not expose CDP at ${CDP_HTTP}`);
    }

    async connectBrowser() {
        this.browser = await chromium.connectOverCDP(CDP_HTTP);
        this.context = this.browser.contexts()[0];
        if (!this.context) throw new Error('Connected Chrome has no default browser context');
    }

    async ensureDisplay() {
        const display = process.env.DISPLAY ?? ':99';
        process.env.DISPLAY = display;
        if (spawnSync('xdpyinfo', { stdio: 'ignore' }).status === 0) return;

        this.xvfbProcess = spawn('Xvfb', [display, '-screen', '0', '1280x900x24', '-nolisten', 'tcp', '-noreset'], {
            cwd: repoRoot,
            stdio: 'ignore',
        });

        const deadline = Date.now() + 5000;
        while (Date.now() < deadline) {
            if (spawnSync('xdpyinfo', { stdio: 'ignore' }).status === 0) return;
            if (this.xvfbProcess.exitCode != null) {
                throw new Error(`Xvfb exited with code ${this.xvfbProcess.exitCode}`);
            }
            await sleep(100);
        }
        throw new Error(`Xvfb did not become ready on ${display}`);
    }

    async ensureUserScriptsEnabled() {
        const extensionId = await this.getExtensionId();
        const page = await this.createPage();
        try {
            await page.goto(`chrome://extensions/?id=${extensionId}`);
            const toggle = page.locator('#allow-user-scripts cr-toggle');
            if (await toggle.evaluate(element => element.checked)) return;
            await toggle.click();
        } finally {
            await page.close().catch(() => {});
        }

        await this.browser?.close().catch(() => {});
        this.browserProcess?.kill();
        this.browser = null;
        this.context = null;
        this.browserProcess = null;

        const deadline = Date.now() + 5000;
        while (Date.now() < deadline && await this.isReachable(`${CDP_HTTP}/json/version`)) {
            await sleep(100);
        }

        await this.launchOwnedBrowser();
        await this.connectBrowser();
    }

    async getExtensionId() {
        const serviceWorker = this.context.serviceWorkers()[0]
            ?? await this.context.waitForEvent('serviceworker', { timeout: 5000 });
        return new URL(serviceWorker.url()).host;
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
            await this.waitForOn(page, `location.protocol === 'chrome-extension:'`, 5000);

            const violentmonkeyConfirm = page.locator('#confirm');
            if (await violentmonkeyConfirm.count()) {
                await this.waitForOn(page, `!document.querySelector('#confirm').disabled`, 5000);
                await this.actionDelay();
                await violentmonkeyConfirm.click();
                await this.waitForOn(page, `document.body?.innerText.includes('Script installed.') || document.body?.innerText.includes('Script updated.')`, 5000);
                return;
            }

            const scriptcatConfirm = page.getByRole('button', { name: /^(Install Script|Update Script)$/ });
            await scriptcatConfirm.waitFor({ state: 'visible', timeout: 5000 });
            await this.actionDelay();
            await scriptcatConfirm.click();
            await scriptcatConfirm.waitFor({ state: 'detached', timeout: 5000 }).catch(() => {});
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
        await this.dismissInstagramNotificationPrompt();
        const locator = this.page.locator(selector).nth(index);
        await locator.scrollIntoViewIfNeeded();
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
    if (keyCode === 192) return 'Backquote';
    return String.fromCharCode(keyCode);
}
