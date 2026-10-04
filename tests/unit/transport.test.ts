import { expect, test } from 'bun:test';
import { Effect, Fiber } from 'effect';
import { gmGet, RequestError } from '../../src/shared/transport.ts';

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

test('anonymous requests retain cookie suppression on every retry', async () => {
    const attempts: Tampermonkey.Request[] = [];
    const request = (details: Tampermonkey.Request) => {
        attempts.push(details);
        queueMicrotask(() => attempts.length === 1
            ? details.onerror?.({ error: 'network' } as Tampermonkey.ErrorResponse)
            : details.onload?.({ status: 200, response: '{}' } as Tampermonkey.Response<object>));
        return { abort() {} };
    };
    await Effect.runPromise(gmGet('public media', '/media', { request, anonymous: true }));
    expect(attempts).toHaveLength(2);
    expect(attempts.every(attempt => attempt.anonymous === true)).toBe(true);
});

test('does not retry access rejections with or without cookies', async () => {
    let attempts = 0;
    const request = (details: Tampermonkey.Request) => {
        attempts += 1;
        queueMicrotask(() => details.onload?.({ status: 401, response: '{}' } as Tampermonkey.Response<object>));
        return { abort() {} };
    };
    const result = await Effect.runPromiseExit(gmGet('public media', '/media', { request, anonymous: true }));
    expect(result._tag).toBe('Failure');
    expect(attempts).toBe(1);
});

test('identifies login redirects separately from rate limits', async () => {
    const rejected = async (response: Partial<Tampermonkey.Response<object>>) => {
        const request = (details: Tampermonkey.Request) => {
            queueMicrotask(() => details.onload?.(response as Tampermonkey.Response<object>));
            return { abort() {} };
        };
        return Effect.runPromise(gmGet('public media', '/media', { request, anonymous: true })).catch(error => error);
    };
    const login = await rejected({ status: 200, finalUrl: 'https://www.instagram.com/accounts/login/', response: '<html>Login</html>' });
    expect(login).toBeInstanceOf(RequestError);
    expect(login.requiresLogin).toBe(true);
    const loginJson = await rejected({ status: 401, response: '{"message":"login_required"}' });
    expect(loginJson.requiresLogin).toBe(true);
    const limited = await rejected({ status: 401, response: '{"message":"Please wait a few minutes before you try again."}' });
    expect(limited.requiresLogin).not.toBe(true);
    const rateLimit = await rejected({ status: 429, response: '{}' });
    expect(rateLimit.requiresLogin).not.toBe(true);
});
