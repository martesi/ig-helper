import { expect, test } from 'bun:test';
import { Effect, Fiber } from 'effect';
import { gmGet } from '../../src/shared/transport.ts';

test('retries transient failures and returns the successful response', async () => {
    let attempts = 0;
    const request = (details: Tampermonkey.Request) => {
        attempts += 1;
        queueMicrotask(() => {
            if (attempts < 3) details.onerror?.({ error: 'network' } as Tampermonkey.ErrorResponse);
            else details.onload?.({ status: 200, response: '{}', finalUrl: String(details.url) } as Tampermonkey.Response<object>);
        });
        return { abort() {} };
    };

    const response = await Effect.runPromise(gmGet('test', '/media', { request }));
    expect(response.status).toBe(200);
    expect(attempts).toBe(3);
});

test('aborts a pending request when interrupted', async () => {
    let aborts = 0;
    const request = () => ({ abort() { aborts += 1; } });
    const fiber = Effect.runFork(gmGet('test', '/media', { request }));
    await Effect.runPromise(Fiber.interrupt(fiber));
    expect(aborts).toBe(1);
});

test('accepts status-less test-manager responses for schema validation', async () => {
    const request = (details: Tampermonkey.Request) => {
        queueMicrotask(() => details.onload?.({ response: '{}', finalUrl: String(details.url) } as Tampermonkey.Response<object>));
        return { abort() {} };
    };

    const response = await Effect.runPromise(gmGet('test', '/media', { request }));
    expect(response.response).toBe('{}');
});
