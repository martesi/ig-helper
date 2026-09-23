import { state, USER_SETTING } from '../settings/state.ts';
import { CONTROL_ORIGIN, DEBUG_CHANNEL, DEBUG_COMMANDS } from './protocol.ts';
import type { DebugMethod, DebugSnapshot, DomCapture } from './protocol.ts';
import { Effect } from 'effect';

const MAX_LOGS = 200;
const MAX_ERRORS = 50;
const startedAt = Date.now();
const errors: DebugSnapshot['errors'] = [];

export function startDebugReporter() {
    const onMessage = (event: MessageEvent) => {
        if (event.origin !== CONTROL_ORIGIN) return;
        if (event.data?.channel !== DEBUG_CHANNEL || event.data.direction !== 'request') return;

        const id = Number.isInteger(event.data.id) && event.data.id > 0 ? event.data.id : null;
        const method: unknown = event.data.method;
        if (id == null || !DEBUG_COMMANDS.has(method as DebugMethod) || !event.source) return;
        const source = event.source as Window;

        Effect.runSync(Effect.match(Effect.try({
            try: () => {
                const result = handleRequest(method as DebugMethod);
                source.postMessage({ channel: DEBUG_CHANNEL, direction: 'response', id, ok: true, result }, event.origin);
            },
            catch: error => error,
        }), {
            onFailure: error => source.postMessage({
                channel: DEBUG_CHANNEL,
                direction: 'response',
                id,
                ok: false,
                error: error instanceof Error ? error.message : String(error),
            }, event.origin),
            onSuccess: () => undefined,
        }));
    };

    const onError = (event: ErrorEvent) => rememberError(event.error ?? event.message);
    const onUnhandledRejection = (event: PromiseRejectionEvent) => rememberError(event.reason);

    return Effect.acquireRelease(
        Effect.sync(() => {
            window.addEventListener('message', onMessage);
            window.addEventListener('error', onError);
            window.addEventListener('unhandledrejection', onUnhandledRejection);
            return () => {
                window.removeEventListener('message', onMessage);
                window.removeEventListener('error', onError);
                window.removeEventListener('unhandledrejection', onUnhandledRejection);
            };
        }),
        cleanup => Effect.sync(cleanup),
    );
}

function handleRequest(method: DebugMethod): DebugSnapshot | DomCapture {
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

function createSnapshot(): DebugSnapshot {
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

function rememberError(error: unknown) {
    errors.push({
        time: Date.now(),
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack ?? '' : '',
    });
    if (errors.length > MAX_ERRORS) errors.splice(0, errors.length - MAX_ERRORS);
}

function safePath(value: string | null): string | null {
    return value && URL.canParse(value, location.origin) ? new URL(value, location.origin).pathname : null;
}

function serializeValue(value: unknown, depth = 0, seen = new WeakSet<object>()): unknown {
    if (value == null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
    if (typeof value === 'bigint') return String(value);
    if (typeof value === 'function') return `[Function ${value.name || 'anonymous'}]`;
    if (value instanceof Error) return { name: value.name, message: value.message, stack: value.stack ?? '' };
    if (value instanceof Element) return elementSummary(value);
    if (typeof value === 'object' && value !== null && 'jquery' in value && 'length' in value) {
        return Array.from(value as ArrayLike<unknown>).map(elementSummary);
    }
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

function elementSummary(element: unknown): unknown {
    if (!(element instanceof Element)) return serializeValue(element);
    return {
        tagName: element.tagName,
        id: element.id,
        className: typeof element.className === 'string' ? element.className : '',
    };
}
