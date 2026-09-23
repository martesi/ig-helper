import { Effect } from 'effect';
import { logger } from '../shared/logger';
import { startInstagram } from './instagram.ts';
import { startSettingsBridge } from '../settings/bridge.ts';

const program = Effect.gen(function* () {
    if (location.hostname.endsWith('instagram.com')) yield* startInstagram();
    else yield* startSettingsBridge();
    yield* Effect.never;
}).pipe(Effect.catchCause(cause => Effect.sync(() => logger('app entry', 'startup failed', cause))));

Effect.runFork(Effect.scoped(program));
