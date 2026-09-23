import { Effect } from 'effect';
import { updateLoadingBar } from '../shared/ui/status.tsx';

export function runWithLoadingBar<A>(run: () => Promise<A>): Promise<A> {
    return Effect.runPromise(
        Effect.gen(function* () {
            yield* Effect.sync(() => updateLoadingBar(true));
            return yield* Effect.tryPromise({ try: run, catch: cause => cause });
        }).pipe(Effect.ensuring(Effect.sync(() => updateLoadingBar(false)))),
    );
}
