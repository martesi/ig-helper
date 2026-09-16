import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const LEGACY_DIALOG_ROOT_ID = 'ig-helper-legacy-dialog-root';
export const IMAGE_VIEWER_ROOT_ID = 'ig-helper-image-viewer-root';

export const CDP_HTTP = process.env.IG_HELPER_E2E_CDP ?? 'http://169.254.1.2:9223';
export const INSTAGRAM_HOME = process.env.IG_HELPER_E2E_HOME ?? 'https://www.instagram.com/';
export const PROFILE_URL = process.env.IG_HELPER_E2E_PROFILE ?? 'https://www.instagram.com/instagram/';
export const VITE_URL = process.env.IG_HELPER_E2E_VITE ?? 'http://127.0.0.1:9000';
export const OPTIONS_URL = process.env.IG_HELPER_E2E_OPTIONS ?? 'http://127.0.0.1:9100';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));

export class IgHelperE2E {
    constructor() {
        this.view = null;
        this.viteProcess = null;
        this.downloadEvents = [];
        this._downloadListenerInstalled = false;
    }

    async start() {
        await this.ensureDevServer();
        await this.assertCdpAvailable();
        await this.installUserscript();
        this.view = await this.createView();
        await this.goto(INSTAGRAM_HOME);
        await this.waitFor(`document.querySelectorAll('[data-snig="canDownload"]').length > 0`, 15000);
    }

    async stop() {
        try {
            this.view?.close();
        } catch {
            // The tab may already have closed itself.
        }
        this.view = null;

        if (this.viteProcess) {
            this.viteProcess.kill();
            this.viteProcess = null;
        }

    }

    async ensureDevServer() {
        const ready = async () =>
            await this.isReachable(`${VITE_URL}/__vite-plugin-monkey.install.user.js`) &&
            await this.isReachable(`${OPTIONS_URL}/settings/`);
        if (await ready()) return;

        this.viteProcess = Bun.spawn(['bun', 'run', 'dev'], {
            cwd: repoRoot,
            stdout: 'ignore',
            stderr: 'ignore',
        });

        const deadline = Date.now() + 10000;
        while (Date.now() < deadline) {
            if (await ready()) return;
            await Bun.sleep(100);
        }
        throw new Error(`Vite did not become ready at ${VITE_URL} and ${OPTIONS_URL}`);
    }

    async isReachable(url) {
        try {
            const response = await fetch(url, { signal: AbortSignal.timeout(800) });
            return response.ok;
        } catch {
            return false;
        }
    }

    async assertCdpAvailable() {
        const response = await fetch(`${CDP_HTTP}/json/version`);
        if (!response.ok) throw new Error(`CDP endpoint unavailable: ${CDP_HTTP}`);
        const version = await response.json();
        if (!version.webSocketDebuggerUrl) throw new Error('Chrome did not expose webSocketDebuggerUrl');
    }

    async browserWebSocketUrl() {
        const response = await fetch(`${CDP_HTTP}/json/version`);
        if (!response.ok) throw new Error(`CDP endpoint unavailable: ${CDP_HTTP}`);
        const version = await response.json();
        return version.webSocketDebuggerUrl;
    }

    async createView() {
        const websocket = await this.browserWebSocketUrl();
        const view = new Bun.WebView({
            backend: { type: 'chrome', url: websocket },
            width: 1280,
            height: 900,
        });
        await view.navigate('about:blank');
        await this.activatePage(view);
        return view;
    }

    async installUserscript() {
        const installView = await this.createView();
        try {
            try {
                await installView.navigate(`${VITE_URL}/__vite-plugin-monkey.install.user.js`);
            } catch (error) {
                if (!String(error).includes('ERR_ABORTED')) throw error;
            }
            await this.waitForOn(installView, `location.protocol === 'chrome-extension:' && !!document.querySelector('#confirm') && !document.querySelector('#confirm').disabled`, 5000);
            await installView.evaluate(`document.querySelector('#confirm')?.click()`);
            await this.waitForOn(installView, `document.body?.innerText.includes('Script installed.')`, 5000);
        } finally {
            try {
                installView.close();
            } catch {
                // Violentmonkey may close the confirmation target itself.
            }
        }
    }

    async activatePage(view = this.view) {
        await view.cdp('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
        await view.cdp('Emulation.setFocusEmulationEnabled', { enabled: true });
        await view.cdp('Page.bringToFront');
    }

    async goto(url) {
        await this.view.navigate('about:blank');
        await this.view.navigate(url);
        await this.activatePage();
        await Bun.sleep(1200);
    }

    async reload() {
        const url = await this.evaluate('location.href');
        try {
            this.view.close();
        } catch {
            // The target may already be closing.
        }
        this.view = await this.createView();
        await this.goto(url);
    }

    async evaluate(expression) {
        return this.view.evaluate(expression);
    }

    async json(expression) {
        const result = await this.evaluate(`JSON.stringify(${expression})`);
        return JSON.parse(result);
    }

    async waitFor(expression, timeout = 10000) {
        return this.waitForOn(this.view, expression, timeout);
    }

    async waitForOn(view, expression, timeout = 10000) {
        const deadline = Date.now() + timeout;
        let lastError;
        while (Date.now() < deadline) {
            try {
                if (await view.evaluate(`Boolean(${expression})`)) return;
            } catch (error) {
                lastError = error;
            }
            await Bun.sleep(100);
        }
        throw new Error(`Timed out waiting for: ${expression}${lastError ? ` (${lastError.message})` : ''}`);
    }

    async shadowJson(hostId, expression) {
        return this.json(`(() => {
            const root = document.getElementById(${JSON.stringify(hostId)})?.shadowRoot;
            if (!root) return null;
            return (${expression});
        })()`);
    }

    async shadowRect(hostId, selector, index = 0) {
        const rect = await this.shadowJson(hostId, `(() => {
            const element = root.querySelectorAll(${JSON.stringify(selector)})[${index}];
            if (!element) return null;
            element.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
            const value = element.getBoundingClientRect();
            return { x: value.x, y: value.y, width: value.width, height: value.height };
        })()`);
        if (!rect || rect.width <= 0 || rect.height <= 0) {
            throw new Error(`Shadow element is not actionable: ${hostId} ${selector}[${index}]`);
        }
        return rect;
    }

    async clickShadow(hostId, selector, index = 0) {
        await this.shadowRect(hostId, selector, index);
        await Bun.sleep(50);
        const rect = await this.shadowRect(hostId, selector, index);
        await this.view.click(rect.x + rect.width / 2, rect.y + rect.height / 2);
    }

    async click(selector, index = 0) {
        const rect = await this.json(`(() => {
            const element = document.querySelectorAll(${JSON.stringify(selector)})[${index}];
            if (!element) return null;
            element.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
            const value = element.getBoundingClientRect();
            return { x: value.x, y: value.y, width: value.width, height: value.height };
        })()`);
        if (!rect || rect.width <= 0 || rect.height <= 0) throw new Error(`Element is not actionable: ${selector}[${index}]`);
        await this.view.click(rect.x + rect.width / 2, rect.y + rect.height / 2);
    }

    async pressLegacyHotkey(keyCode) {
        const key = hotkeyKey(keyCode);
        const code = hotkeyCode(keyCode);
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

    async openSettings(section = 'preferences') {
        await this.goto(`${OPTIONS_URL}/#/settings`);
        await this.waitFor(`document.querySelectorAll('[data-settings-section]').length === 2`, 5000);
        await this.locateSettingsSection(section);
    }

    async closeSettings() {
        await this.goto(INSTAGRAM_HOME);
    }

    async showPreferencesTab() {
        await this.locateSettingsSection('preferences');
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
        await this.showPreferencesTab();
        return this.json(`Object.fromEntries(${JSON.stringify(names)}.map(name => {
            const element = document.querySelector('#' + name);
            return [name, Boolean(element?.checked)];
        }))`);
    }

    async setSettings(values) {
        await this.showPreferencesTab();
        for (const [name, desired] of Object.entries(values)) {
            const current = await this.evaluate(`Boolean(document.querySelector('#' + ${JSON.stringify(name)})?.checked)`);
            if (current === desired) continue;
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
        await this.waitFor(`document.querySelectorAll('[data-snig="canDownload"]').length > 0`, 15000);
        const rect = await this.json(`(() => {
            const target = [...document.querySelectorAll('[data-snig="canDownload"]')].find(element => {
                const value = element.getBoundingClientRect();
                return value.width > 200 && value.height > 200 && value.bottom > 0 && value.top < innerHeight;
            });
            if (!target) return null;
            const value = target.getBoundingClientRect();
            return { x: value.x, y: value.y, width: value.width, height: value.height };
        })()`);
        if (!rect) throw new Error('No visible detected post target');
        await this.view.cdp('Input.dispatchMouseEvent', {
            type: 'mouseMoved',
            x: rect.x + rect.width / 2,
            y: Math.max(1, Math.min(899, rect.y + Math.min(100, rect.height / 4))),
        });
        await this.waitFor(`document.querySelectorAll('.button_wrapper .IG_DW_MAIN').length > 0`, 5000);
    }

    async configureDownloads() {
        this.downloadEvents.length = 0;

        if (!this._downloadListenerInstalled) {
            this.view.addEventListener('Browser.downloadWillBegin', event => {
                this.downloadEvents.push({ type: 'begin', ...event.data });
            });
            this.view.addEventListener('Browser.downloadProgress', event => {
                this.downloadEvents.push({ type: 'progress', ...event.data });
            });
            this._downloadListenerInstalled = true;
        }

        // Chrome runs outside AgentDock, so a container-only path cannot be used.
        // Keep the browser's real configured download directory and verify completion via CDP.
        await this.view.cdp('Browser.setDownloadBehavior', {
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
            await Bun.sleep(100);
        }
        throw new Error('Browser download did not complete');
    }

    async browserTargets() {
        const response = await fetch(`${CDP_HTTP}/json/list`);
        if (!response.ok) throw new Error('Unable to list Chrome targets');
        return response.json();
    }

    async closeTarget(targetId) {
        await fetch(`${CDP_HTTP}/json/close/${targetId}`);
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
