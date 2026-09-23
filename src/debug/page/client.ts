import { Effect } from 'effect';
import { DEBUG_CHANNEL, DebugRequestError, parseDebugResponse } from '../protocol.ts';
import type { DebugMethod, DebugSnapshot, DomCapture } from '../protocol.ts';

const pending = new Map<number, (value: unknown) => void>();
let nextId = 0;

window.addEventListener('message', event => {
    if (event.source !== window.opener) return;
    if (event.data?.channel !== DEBUG_CHANNEL || event.data.direction !== 'response') return;
    pending.get(event.data.id)?.(event.data);
});

export function hasDebugOpener(): boolean {
    return Boolean(window.opener && !window.opener.closed);
}

export function requestDebug(method: 'getSnapshot' | 'clearLogs'): Promise<DebugSnapshot>;
export function requestDebug(method: 'captureDom'): Promise<DomCapture>;
export function requestDebug(method: DebugMethod): Promise<DebugSnapshot | DomCapture>;
export function requestDebug(method: DebugMethod): Promise<DebugSnapshot | DomCapture> {
    if (!hasDebugOpener()) {
        return Promise.reject(new Error('Open Settings from Instagram to attach the debugger.'));
    }

    const id = ++nextId;
    const message = { channel: DEBUG_CHANNEL, direction: 'request', id, method };
    const request = Effect.callback<DebugSnapshot | DomCapture, Error>(resume => {
        const send = () => window.opener.postMessage(message, '*');
        const retry = setInterval(send, 100);
        const timer = setTimeout(() => finish(Effect.fail(new Error(
            'The Instagram tab did not respond.',
        ))), 5000);

        function cleanup() {
            pending.delete(id);
            clearInterval(retry);
            clearTimeout(timer);
        }

        function finish(result: Effect.Effect<DebugSnapshot | DomCapture, Error>) {
            cleanup();
            resume(result);
        }

        pending.set(id, value => {
            try {
                finish(Effect.succeed(parseDebugResponse(method, value)));
            } catch (cause) {
                if (cause instanceof DebugRequestError) {
                    finish(Effect.fail(cause));
                    return;
                }
                console.error('debug.response.invalid', method, cause instanceof Error ? cause.message : String(cause));
                finish(Effect.fail(new Error('IG Helper sent an invalid debugger response.')));
            }
        });
        send();
        return Effect.sync(cleanup);
    });
    return Effect.runPromise(request);
}
