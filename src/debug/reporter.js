import { state, USER_SETTING } from '../settings/state.js';
import {
    DEBUG_COMMANDS,
    DEBUG_ENABLED_KEY,
    debugCommandKey,
    debugDomKey,
    debugTabKey,
} from './protocol.js';

const HEARTBEAT_MS = 1000;
const MAX_LOGS = 200;
const MAX_ERRORS = 50;

const tabId = crypto.randomUUID();
const startedAt = Date.now();
const errors = [];
let active = false;
let lastCommandId = null;

const heartbeat = setInterval(syncDebugState, HEARTBEAT_MS);

window.addEventListener('error', event => {
    rememberError(event.error ?? event.message);
});

window.addEventListener('unhandledrejection', event => {
    rememberError(event.reason);
});

window.addEventListener('visibilitychange', syncDebugState);
window.addEventListener('pagehide', cleanup);

syncDebugState();

export function publishDebugSnapshot() {
    syncDebugState();
}

function syncDebugState() {
    const enabled = Boolean(GM_getValue(DEBUG_ENABLED_KEY, false));
    if (!enabled) {
        if (active) removeSnapshot();
        active = false;
        return;
    }

    active = true;
    const command = GM_getValue(debugCommandKey(tabId), null);
    if (command?.id && command.id !== lastCommandId && command.tabId === tabId && DEBUG_COMMANDS.has(command.type)) {
        lastCommandId = command.id;
        handleCommand(command.type);
        if (command.type === 'reload') return;
    }

    publish();
}

function cleanup() {
    clearInterval(heartbeat);
    removeSnapshot();
}

function removeSnapshot() {
    GM_deleteValue(debugTabKey(tabId));
    GM_deleteValue(debugDomKey(tabId));
}

function publish() {
    GM_setValue(debugTabKey(tabId), {
        tabId,
        startedAt,
        updatedAt: Date.now(),
        page: {
            url: `${location.origin}${location.pathname}`,
            path: location.pathname,
            visibility: document.visibilityState,
        },
        script: {
            name: GM_info.script.name,
            version: GM_info.script.version,
        },
        runtime: {
            firstStarted: state.firstStarted,
            pageLoaded: state.pageLoaded,
            currentPath: safePath(state.currentURL),
            referrerPath: state.GL_referrer,
            repeatTimerActive: state.GL_repeat != null,
            loggerEntries: state.GL_logger.length,
        },
        dom: {
            mounts: document.querySelectorAll('div[id^="mount"]').length,
            downloadTargets: document.querySelectorAll('[data-snig="canDownload"]').length,
            controlBars: document.querySelectorAll('.button_wrapper').length,
            videos: document.querySelectorAll('video').length,
            images: document.querySelectorAll('img').length,
            legacyDialog: Boolean(document.getElementById('ig-helper-legacy-dialog-root')),
        },
        cache: {
            stories: Object.keys(state.GL_dataCache.stories ?? {}).length,
            highlights: Object.keys(state.GL_dataCache.highlights ?? {}).length,
            media: Object.keys(state.GL_mediaDataCache ?? {}).length,
            images: Object.keys(state.GL_imageCache ?? {}).length,
        },
        settings: { ...USER_SETTING },
        logs: state.GL_logger.slice(-MAX_LOGS).map(log => ({
            time: log.time,
            content: serializeValue(log.content),
        })),
        errors,
    });
}

function handleCommand(type) {
    if (type === 'reload') {
        location.reload();
        return;
    }

    if (type === 'clearLogs') {
        state.GL_logger.length = 0;
        errors.length = 0;
    }

    if (type === 'captureDom') {
        GM_setValue(debugDomKey(tabId), {
            tabId,
            capturedAt: Date.now(),
            url: `${location.origin}${location.pathname}`,
            html: document.querySelector('div[id^="mount"]')?.innerHTML ?? '',
        });
    }

    publish();
}

function rememberError(error) {
    errors.push({
        time: Date.now(),
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack ?? '' : '',
    });
    if (errors.length > MAX_ERRORS) errors.splice(0, errors.length - MAX_ERRORS);
    publish();
}

function safePath(value) {
    try {
        return value ? new URL(value, location.origin).pathname : null;
    } catch {
        return null;
    }
}

function serializeValue(value, depth = 0, seen = new WeakSet()) {
    if (value == null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
    if (typeof value === 'bigint') return String(value);
    if (typeof value === 'function') return `[Function ${value.name || 'anonymous'}]`;
    if (value instanceof Error) return { name: value.name, message: value.message, stack: value.stack ?? '' };
    if (value instanceof Element) return elementSummary(value);
    if (value?.jquery) return Array.from(value).map(elementSummary);
    if (depth >= 3) return '[Object]';
    if (typeof value !== 'object') return String(value);
    if (seen.has(value)) return '[Circular]';

    seen.add(value);
    if (Array.isArray(value)) return value.map(item => serializeValue(item, depth + 1, seen));

    return Object.fromEntries(Object.entries(value).slice(0, 50).map(([key, item]) => [
        key,
        serializeValue(item, depth + 1, seen),
    ]));
}

function elementSummary(element) {
    if (!(element instanceof Element)) return serializeValue(element);
    return {
        tagName: element.tagName,
        id: element.id,
        className: typeof element.className === 'string' ? element.className : '',
    };
}
