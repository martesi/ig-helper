import { expect, test } from 'bun:test';
import { Effect } from 'effect';

function installBridgeWindow() {
    const target = new EventTarget() as EventTarget & { postMessage: (message: unknown, targetOrigin?: string) => void };
    target.postMessage = message => target.dispatchEvent(new MessageEvent('message', {
        data: message,
        origin: 'https://userscript-sandbox.invalid',
        source: null,
    }));
    Object.defineProperty(globalThis, 'window', { configurable: true, value: target });
    Object.defineProperty(globalThis, 'location', { configurable: true, value: { origin: 'https://martesi.github.io' } });
    Object.defineProperty(globalThis, 'GM_setValue', { configurable: true, value: () => undefined });
    return target;
}

test('settings bridge works when the userscript sandbox changes message source and origin', async () => {
    installBridgeWindow();
    const { startSettingsBridge } = await import('../../src/settings/bridge.ts');
    const { requestSettings } = await import('../../src/settings/page/client.ts');

    const result = await Effect.runPromise(Effect.scoped(Effect.gen(function* () {
        yield* startSettingsBridge();
        return yield* Effect.promise(() => requestSettings('setLanguage', { value: 'en-US' }));
    })));

    expect(result).toBe('en-US');
});
