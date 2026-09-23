import { Effect } from 'effect';
import { parseSettingsResponse } from '../message-schema.ts';
import type { SettingsMethod, SettingsSnapshot } from '../message-schema.ts';

const CHANNEL = 'ig-helper:settings';
const pending = new Map<number, (value: unknown) => void>();
let nextId = 0;

window.addEventListener('message', event => {
    if (event.source !== window || event.origin !== location.origin) return;
    if (event.data?.channel !== CHANNEL || event.data.direction !== 'response') return;
    pending.get(event.data.id)?.(event.data);
});

export function requestSettings(method: 'getState'): Promise<SettingsSnapshot>;
export function requestSettings(method: 'setSetting', payload: { name: string; value: unknown }): Promise<unknown>;
export function requestSettings(method: 'setLanguage', payload: { value: string }): Promise<string>;
export function requestSettings(method: 'setVideoVolume', payload: { value: number }): Promise<number>;
export function requestSettings(method: 'setRenameFormat', payload: { value: string }): Promise<string>;
export function requestSettings(method: 'setHotkey', payload: { stateKey: string; value: number }): Promise<number>;
export function requestSettings(method: SettingsMethod, payload?: unknown): Promise<unknown> {
    const id = ++nextId;
    const message = { channel: CHANNEL, direction: 'request', id, method, payload };
    const request = Effect.callback<unknown, Error>(resume => {
        const send = () => window.postMessage(message, location.origin);
        const retry = setInterval(send, 100);
        const timer = setTimeout(() => finish(Effect.fail(new Error(
            'IG Helper userscript not detected. Enable it and reload this page.',
        ))), 5000);

        function cleanup() {
            pending.delete(id);
            clearInterval(retry);
            clearTimeout(timer);
        }

        function finish(result: Effect.Effect<unknown, Error>) {
            cleanup();
            resume(result);
        }

        pending.set(id, value => {
            const parsed = Effect.try({ try: () => parseSettingsResponse(method, value), catch: cause => cause });
            Effect.runSync(Effect.match(parsed, {
                onFailure: cause => {
                    console.error('settings.response.invalid', method, cause instanceof Error ? cause.message : String(cause));
                    finish(Effect.fail(new Error('IG Helper sent an invalid settings response.')));
                },
                onSuccess: response => {
                    if (response.ok) finish(Effect.succeed(response.result));
                    else finish(Effect.fail(new Error(response.error || 'IG Helper settings request failed')));
                },
            }));
        });
        send();
        return Effect.sync(cleanup);
    });
    return Effect.runPromise(request);
}
