import { Data, Effect, Schedule } from 'effect';
import * as z from 'zod/mini';

export class RequestError extends Data.TaggedError('RequestError')<{
    readonly operation: string;
    readonly kind: 'network' | 'timeout' | 'server' | 'http';
    readonly status?: number;
    readonly cause?: unknown;
    readonly requiresLogin?: boolean;
}> {}

export type Request = (details: Tampermonkey.Request) => Tampermonkey.AbortHandle<void>;

interface GetOptions {
    readonly headers?: Record<string, string>;
    readonly request?: Request;
    readonly anonymous?: boolean;
}

export function gmGet(operation: string, url: string, options: GetOptions = {}) {
    const request = options.request ?? GM_xmlhttpRequest;
    const attempt = Effect.callback<Tampermonkey.Response<object>, RequestError>((resume) => {
        const handle = Effect.runSync(Effect.match(Effect.try({
            try: () => request({
                method: 'GET',
                url,
                headers: options.headers,
                anonymous: options.anonymous ?? false,
                timeout: 8000,
                onload: response => {
                    if (responseRequiresLogin(response)) {
                        resume(Effect.fail(new RequestError({ operation, kind: 'http', status: response.status, requiresLogin: true })));
                        return;
                    }
                    // Some userscript test doubles and older managers omit status.
                    // Their payload still crosses the schema validation below.
                    if (response.status == null || (response.status >= 200 && response.status < 300)) {
                        resume(Effect.succeed(response));
                        return;
                    }
                    resume(Effect.fail(new RequestError({
                        operation,
                        kind: response.status >= 500 ? 'server' : 'http',
                        status: response.status,
                    })));
                },
                onerror: cause => resume(Effect.fail(new RequestError({ operation, kind: 'network', cause }))),
                ontimeout: () => resume(Effect.fail(new RequestError({ operation, kind: 'timeout' }))),
            }),
            catch: cause => new RequestError({ operation, kind: 'network', cause }),
        }), {
            onFailure: error => {
                resume(Effect.fail(error));
                return undefined;
            },
            onSuccess: handle => handle,
        }));
        if (!handle) return;
        return Effect.sync(() => handle.abort());
    });

    return attempt.pipe(
        Effect.timeoutOrElse({
            duration: '8 seconds',
            orElse: () => Effect.fail(new RequestError({ operation, kind: 'timeout' })),
        }),
        Effect.retry({
            times: 2,
            while: error => error.kind === 'network' || error.kind === 'timeout' || error.kind === 'server',
            schedule: Schedule.exponential('400 millis', 3),
        }),
    );
}

function responseRequiresLogin(response: Tampermonkey.Response<object>): boolean {
    if (response.finalUrl && URL.canParse(response.finalUrl) && new URL(response.finalUrl).pathname.startsWith('/accounts/login')) return true;
    if (response.status !== 401 && response.status !== 403) return false;
    const body: unknown = Effect.runSync(Effect.try({
        try: (): unknown => JSON.parse(response.response), catch: () => null,
    }).pipe(Effect.catchCause(() => Effect.succeed(null))));
    const parsed = z.safeParse(loginFailureSchema, body);
    return parsed.success && /login[_ ]required|not (?:logged in|authenticated)|must (?:log|sign) in/i
        .test(`${parsed.data.message ?? ''} ${parsed.data.error_type ?? ''}`);
}

const loginFailureSchema = z.object({ message: z.optional(z.string()), error_type: z.optional(z.string()) });
