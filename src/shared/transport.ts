import { Data, Effect, Schedule } from 'effect';

export class RequestError extends Data.TaggedError('RequestError')<{
    readonly operation: string;
    readonly kind: 'network' | 'timeout' | 'server' | 'http';
    readonly status?: number;
    readonly cause?: unknown;
}> {}

export type Request = (details: Tampermonkey.Request) => Tampermonkey.AbortHandle<void>;

interface GetOptions {
    readonly headers?: Record<string, string>;
    readonly request?: Request;
}

export function gmGet(operation: string, url: string, options: GetOptions = {}) {
    const request = options.request ?? GM_xmlhttpRequest;
    const attempt = Effect.callback<Tampermonkey.Response<object>, RequestError>((resume) => {
        let handle: Tampermonkey.AbortHandle<void>;
        try {
            handle = request({
                method: 'GET',
                url,
                headers: options.headers,
                timeout: 8000,
                onload: response => {
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
            });
        } catch (cause) {
            resume(Effect.fail(new RequestError({ operation, kind: 'network', cause })));
            return;
        }
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
