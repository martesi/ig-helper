import { Effect } from 'effect';
import { startDebugReporter } from '../debug/reporter.ts';
import { registerEvents } from './events.ts';
import { initialize } from './initial.ts';
import { applyStyles } from './styles.ts';
import { startTimer } from './timer.ts';

export function startInstagram() {
    return Effect.gen(function* () {
        yield* applyStyles();
        yield* startDebugReporter();
        yield* initialize();
        yield* startTimer();
        yield* registerEvents();
    });
}
