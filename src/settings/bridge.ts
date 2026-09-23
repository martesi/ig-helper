import {
    DEFAULT_RENAME_FORMAT,
    DEFAULT_USER_SETTINGS,
    DEFAULT_VIDEO_VOLUME,
    DIRECT_DOWNLOAD_MODE_OPTIONS,
    HOTKEY_OPTIONS,
    HOTKEY_SETTINGS,
    resolveDirectDownloadMode,
    SETTINGS_STORAGE_KEYS,
} from './schema';
import { parseSettingsRequest } from './message-schema.ts';
import type { SettingsRequest } from './message-schema.ts';
import { Effect } from 'effect';

const CHANNEL = 'ig-helper:settings';
const hotkeysByStateKey = new Map(HOTKEY_SETTINGS.map(config => [config.stateKey, config]));

export function startSettingsBridge() {
    const onMessage = (event: MessageEvent) => {
        if (event.source !== window || event.origin !== location.origin) return;
        if (event.data?.channel !== CHANNEL || event.data.direction !== 'request') return;

        const id = Number.isInteger(event.data.id) && event.data.id > 0 ? event.data.id : null;
        if (id == null) return;
        Effect.runSync(Effect.match(Effect.try({
            try: () => {
                const message = parseSettingsRequest(event.data);
                respond(message.id, true, handleRequest(message));
            },
            catch: error => error,
        }), {
            onFailure: error => {
                console.error('settings.request.failed', error);
                respond(id, false, null, error instanceof Error ? error.message : String(error));
            },
            onSuccess: () => undefined,
        }));
    };

    return Effect.acquireRelease(
        Effect.sync(() => {
            window.addEventListener('message', onMessage);
            return () => window.removeEventListener('message', onMessage);
        }),
        cleanup => Effect.sync(cleanup),
    );
}

function respond(id: number, ok: boolean, result: unknown, error?: string) {
    window.postMessage({ channel: CHANNEL, direction: 'response', id, ok, result, error }, location.origin);
}

function handleRequest(message: SettingsRequest) {
    switch (message.method) {
        case 'getState':
            return getState();
        case 'setSetting':
            return setSetting(message.payload);
        case 'setLanguage':
            return setLanguage(message.payload.value);
        case 'setVideoVolume':
            return setVideoVolume(message.payload.value);
        case 'setRenameFormat':
            return setRenameFormat(message.payload.value);
        case 'setHotkey':
            return setHotkey(message.payload);
    }
}

function getState() {
    return {
        settings: Object.fromEntries(Object.entries(DEFAULT_USER_SETTINGS).map(([key, fallback]) => [key, getSetting(key, fallback)])),
        language: GM_getValue(SETTINGS_STORAGE_KEYS.language, navigator.language || 'en-US'),
        videoVolume: Number(GM_getValue(SETTINGS_STORAGE_KEYS.videoVolume, DEFAULT_VIDEO_VOLUME)),
        renameFormat: GM_getValue(SETTINGS_STORAGE_KEYS.renameFormat, DEFAULT_RENAME_FORMAT),
        hotkeys: Object.fromEntries(HOTKEY_SETTINGS.map(config => [config.stateKey, Number(GM_getValue(config.storageKey, config.defaultKeyCode))])),
        version: GM_info.script.version,
    };
}

function getSetting(name: string, fallback: string | boolean) {
    if (name !== 'DIRECT_DOWNLOAD_MODE') return GM_getValue(name, fallback);
    return resolveDirectDownloadMode(
        GM_getValue(name),
        GM_getValue('DIRECT_DOWNLOAD_VISIBLE_RESOURCE'),
        GM_getValue('DIRECT_DOWNLOAD_ALL')
    );
}

function setSetting({ name, value }: { name: string; value: unknown }) {
    const fallback = Object.entries(DEFAULT_USER_SETTINGS).find(([key]) => key === name)?.[1];
    if (fallback === undefined) throw new Error('Invalid setting');
    if (name === 'DIRECT_DOWNLOAD_MODE') {
        if (value !== DIRECT_DOWNLOAD_MODE_OPTIONS.ASK && value !== DIRECT_DOWNLOAD_MODE_OPTIONS.VISIBLE &&
            value !== DIRECT_DOWNLOAD_MODE_OPTIONS.ALL) throw new Error('Invalid setting');
    } else if (typeof value !== 'boolean') {
        throw new Error('Invalid setting');
    }
    GM_setValue(name, value);
    return value;
}

function setLanguage(value: string) {
    if (typeof value !== 'string' || !value || value.length > 32) throw new Error('Invalid language');
    GM_setValue(SETTINGS_STORAGE_KEYS.language, value);
    return value;
}

function setVideoVolume(value: string | number) {
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0 || number > 1) throw new Error('Invalid video volume');
    GM_setValue(SETTINGS_STORAGE_KEYS.videoVolume, number);
    return number;
}

function setRenameFormat(value: string) {
    if (typeof value !== 'string' || value.length > 500) throw new Error('Invalid rename format');
    GM_setValue(SETTINGS_STORAGE_KEYS.renameFormat, value);
    return value;
}

function setHotkey({ stateKey, value }: { stateKey: string; value: string | number }) {
    const config = hotkeysByStateKey.get(stateKey);
    const keyCode = Number(value);
    if (!config || !HOTKEY_OPTIONS.includes(keyCode)) throw new Error('Invalid hotkey');

    const conflict = HOTKEY_SETTINGS.some(other =>
        other.stateKey !== stateKey && Number(GM_getValue(other.storageKey, other.defaultKeyCode)) === keyCode
    );
    if (conflict) throw new Error('Hotkey conflicts with another IG Helper action');

    GM_setValue(config.storageKey, keyCode);
    return keyCode;
}
