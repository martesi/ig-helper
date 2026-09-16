import {
    DEFAULT_RENAME_FORMAT,
    DEFAULT_USER_SETTINGS,
    DEFAULT_VIDEO_VOLUME,
    HOTKEY_OPTIONS,
    HOTKEY_SETTINGS,
    SETTINGS_STORAGE_KEYS,
} from './schema';

const CHANNEL = 'ig-helper:settings';
const hotkeysByStateKey = new Map(HOTKEY_SETTINGS.map(config => [config.stateKey, config]));

window.addEventListener('message', async event => {
    if (event.source !== window || event.origin !== location.origin) return;
    const message = event.data;
    if (message?.channel !== CHANNEL || message.direction !== 'request') return;

    try {
        const result = await handleRequest(message.method, message.payload);
        respond(message.id, true, result);
    } catch (error) {
        respond(message.id, false, null, error instanceof Error ? error.message : String(error));
    }
});

function respond(id, ok, result, error) {
    window.postMessage({ channel: CHANNEL, direction: 'response', id, ok, result, error }, location.origin);
}

function handleRequest(method, payload = {}) {
    switch (method) {
        case 'getState':
            return getState();
        case 'setSetting':
            return setSetting(payload);
        case 'setLanguage':
            return setLanguage(payload.value);
        case 'setVideoVolume':
            return setVideoVolume(payload.value);
        case 'setRenameFormat':
            return setRenameFormat(payload.value);
        case 'setHotkey':
            return setHotkey(payload);
        default:
            throw new Error(`Unsupported settings operation: ${method}`);
    }
}

function getState() {
    return {
        settings: Object.fromEntries(Object.entries(DEFAULT_USER_SETTINGS).map(([key, fallback]) => [key, GM_getValue(key, fallback)])),
        language: GM_getValue(SETTINGS_STORAGE_KEYS.language, navigator.language || 'en-US'),
        videoVolume: Number(GM_getValue(SETTINGS_STORAGE_KEYS.videoVolume, DEFAULT_VIDEO_VOLUME)),
        renameFormat: GM_getValue(SETTINGS_STORAGE_KEYS.renameFormat, DEFAULT_RENAME_FORMAT),
        hotkeys: Object.fromEntries(HOTKEY_SETTINGS.map(config => [config.stateKey, Number(GM_getValue(config.storageKey, config.defaultKeyCode))])),
        version: GM_info.script.version,
    };
}

function setSetting({ name, value }) {
    if (!Object.hasOwn(DEFAULT_USER_SETTINGS, name) || typeof value !== 'boolean') throw new Error('Invalid setting');
    GM_setValue(name, value);
    return value;
}

function setLanguage(value) {
    if (typeof value !== 'string' || !value || value.length > 32) throw new Error('Invalid language');
    GM_setValue(SETTINGS_STORAGE_KEYS.language, value);
    return value;
}

function setVideoVolume(value) {
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0 || number > 1) throw new Error('Invalid video volume');
    GM_setValue(SETTINGS_STORAGE_KEYS.videoVolume, number);
    return number;
}

function setRenameFormat(value) {
    if (typeof value !== 'string' || value.length > 500) throw new Error('Invalid rename format');
    GM_setValue(SETTINGS_STORAGE_KEYS.renameFormat, value);
    return value;
}

function setHotkey({ stateKey, value }) {
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
