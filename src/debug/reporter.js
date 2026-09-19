import { state, USER_SETTING } from '../settings/state.js';
import { CONTROL_ORIGIN, DEBUG_CHANNEL, DEBUG_COMMANDS } from './protocol.js';

const MAX_LOGS = 200;
const MAX_ERRORS = 50;
const startedAt = Date.now();
const errors = [];

export function startDebugReporter() {
    window.addEventListener('message', event => {
        if (event.origin !== CONTROL_ORIGIN) return;
        if (event.data?.channel !== DEBUG_CHANNEL || event.data.direction !== 'request') return;

        const id = Number.isInteger(event.data.id) && event.data.id > 0 ? event.data.id : null;
        const method = event.data.method;
        if (id == null || !DEBUG_COMMANDS.has(method) || !event.source) return;

        try {
            const result = handleRequest(method);
            event.source.postMessage({ channel: DEBUG_CHANNEL, direction: 'response', id, ok: true, result }, event.origin);
        } catch (error) {
            event.source.postMessage({
                channel: DEBUG_CHANNEL,
                direction: 'response',
                id,
                ok: false,
                error: error instanceof Error ? error.message : String(error),
            }, event.origin);
        }
    });

    window.addEventListener('error', event => {
        rememberError(event.error ?? event.message);
    });

    window.addEventListener('unhandledrejection', event => {
        rememberError(event.reason);
    });
}

function handleRequest(method) {
    if (method === 'getSnapshot') return createSnapshot();

    if (method === 'clearLogs') {
        state.GL_logger.length = 0;
        errors.length = 0;
        return createSnapshot();
    }

    if (method === 'captureDom') {
        return {
            capturedAt: Date.now(),
            url: `${location.origin}${location.pathname}`,
            html: document.querySelector('div[id^="mount"]')?.innerHTML ?? '',
        };
    }

    throw new Error(`Unsupported debugger command: ${method}`);
}

function createSnapshot() {
    return {
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
        errors: [...errors],
    };
}

function rememberError(error) {
    errors.push({
        time: Date.now(),
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack ?? '' : '',
    });
    if (errors.length > MAX_ERRORS) errors.splice(0, errors.length - MAX_ERRORS);
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
