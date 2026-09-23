import { Effect } from 'effect';
import { logger } from '../shared/logger';

const failureMessage = location.hostname.endsWith('instagram.com')
    ? 'Instagram startup failed'
    : 'settings bridge startup failed';
const program = Effect.gen(function* () {
    if (location.hostname.endsWith('instagram.com')) {
        const { startInstagram } = yield* Effect.tryPromise({
            try: () => import('./instagram.ts'),
            catch: cause => cause,
        });
        yield* startInstagram();
    } else {
        const { startSettingsBridge } = yield* Effect.tryPromise({
            try: () => import('../settings/bridge.ts'),
            catch: cause => cause,
        });
        yield* startSettingsBridge();
    }

    yield* Effect.never;
}).pipe(Effect.catchCause(cause => Effect.sync(() => logger('app entry', failureMessage, cause))));

Effect.runFork(Effect.scoped(program));
