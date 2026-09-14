import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SETTINGS_ROOT_ID = 'ig-helper-settings-root';
export const LEGACY_DIALOG_ROOT_ID = 'ig-helper-legacy-dialog-root';
export const IMAGE_VIEWER_ROOT_ID = 'ig-helper-image-viewer-root';

export const CDP_HTTP = process.env.IG_HELPER_E2E_CDP ?? 'http://169.254.1.2:9223';
export const INSTAGRAM_HOME = process.env.IG_HELPER_E2E_HOME ?? 'https://www.instagram.com/';
export const PROFILE_URL = process.env.IG_HELPER_E2E_PROFILE ?? 'https://www.instagram.com/instagram/';
export const VITE_URL = process.env.IG_HELPER_E2E_VITE ?? 'http://127.0.0.1:5173';

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
        if (await this.isReachable(`${VITE_URL}/__vite-plugin-monkey.install.user.js`)) return;

        this.viteProcess = Bun.spawn(['bun', 'run', 'dev', '--', '--host', '0.0.0.0'], {
            cwd: repoRoot,
            stdout: 'ignore',
            stderr: 'ignore',
        });

        const deadline = Date.now() + 10000;
        while (Date.now() < deadline) {
            if (await this.isReachable(`${VITE_URL}/__vite-plugin-monkey.install.user.js`)) return;
            await Bun.sleep(100);
        }
        throw new Error(`Vite did not become ready at ${VITE_URL}`);
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
            await installView.navigate(`${VITE_URL}/__vite-plugin-monkey.install.user.js`);
            await this.waitForOn(installView, `location.protocol === 'chrome-extension:' && !!document.querySelector('#confirm')`, 5000);
            await installView.evaluate(`document.querySelector('#confirm')?.click()`);
            await Bun.sleep(250);
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
        await this.view.reload();
        await this.activatePage();
        await Bun.sleep(1200);
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

    async openSettings() {
        const candidates = [87, 90, 88, 68, 75, 67, 83, 192, 49, 50, 51, 52, 53];
        for (const keyCode of candidates) {
            await this.pressLegacyHotkey(keyCode);
            await Bun.sleep(100);
            if (await this.evaluate(`!!document.getElementById(${JSON.stringify(SETTINGS_ROOT_ID)})?.shadowRoot`)) {
                await this.waitFor(`document.getElementById(${JSON.stringify(SETTINGS_ROOT_ID)})?.shadowRoot?.querySelector('.IG_SETTINGS_DIALOG')?.open === true`, 3000);
                return keyCode;
            }
            if (await this.evaluate(`!!document.getElementById(${JSON.stringify(LEGACY_DIALOG_ROOT_ID)})`)) {
                await this.pressLegacyHotkey(81);
            }
        }
        throw new Error('Could not open settings with any supported configured hotkey');
    }

    async closeSettings() {
        if (!await this.evaluate(`!!document.getElementById(${JSON.stringify(SETTINGS_ROOT_ID)})?.shadowRoot`)) return;
        await this.clickShadow(SETTINGS_ROOT_ID, '.IG_SETTINGS_CLOSE');
        await this.waitFor(`!document.getElementById(${JSON.stringify(SETTINGS_ROOT_ID)})`, 3000);
    }

    async showPreferencesTab() {
        const selected = await this.shadowJson(SETTINGS_ROOT_ID, `root.querySelector('.IG_SETTINGS_DIALOG')?.dataset.settingsTab`);
        if (selected === 'preferences') return;
        await this.clickShadow(SETTINGS_ROOT_ID, '[role="tab"]', 0);
        await this.waitFor(`document.getElementById(${JSON.stringify(SETTINGS_ROOT_ID)})?.shadowRoot?.querySelector('.IG_SETTINGS_DIALOG')?.dataset.settingsTab === 'preferences'`, 3000);
    }

    async showKeyboardTab() {
        const selected = await this.shadowJson(SETTINGS_ROOT_ID, `root.querySelector('.IG_SETTINGS_DIALOG')?.dataset.settingsTab`);
        if (selected === 'keyboard') return;
        await this.clickShadow(SETTINGS_ROOT_ID, '[role="tab"]', 1);
        await this.waitFor(`document.getElementById(${JSON.stringify(SETTINGS_ROOT_ID)})?.shadowRoot?.querySelector('.IG_SETTINGS_DIALOG')?.dataset.settingsTab === 'keyboard'`, 3000);
    }

    async readHotkeys() {
        await this.showKeyboardTab();
        return this.shadowJson(SETTINGS_ROOT_ID, `({
            settings: Number(root.querySelector('#settingsHotkeyKeyCode')?.value),
            keyboard: Number(root.querySelector('#keySettingsHotkeyKeyCode')?.value),
            debug: Number(root.querySelector('#debugHotkeyKeyCode')?.value),
            story: Number(root.querySelector('#downloadStoryHotkeyKeyCode')?.value),
        })`);
    }

    async readSettings(names) {
        await this.showPreferencesTab();
        return this.shadowJson(SETTINGS_ROOT_ID, `Object.fromEntries(${JSON.stringify(names)}.map(name => {
            const element = root.querySelector('#' + name);
            return [name, Boolean(element?.checked)];
        }))`);
    }

    async setSettings(values) {
        await this.showPreferencesTab();
        for (const [name, desired] of Object.entries(values)) {
            const current = await this.shadowJson(SETTINGS_ROOT_ID, `Boolean(root.querySelector('#' + ${JSON.stringify(name)})?.checked)`);
            if (current === desired) continue;
            await this.clickShadow(SETTINGS_ROOT_ID, `label[for="${name}"]`);
            await this.waitFor(`document.getElementById(${JSON.stringify(SETTINGS_ROOT_ID)})?.shadowRoot?.querySelector('#${name}')?.checked === ${desired}`, 3000);
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
            if (!await this.evaluate(`!!document.getElementById(${JSON.stringify(SETTINGS_ROOT_ID)})?.shadowRoot`)) {
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
