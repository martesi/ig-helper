import { startDebugReporter } from '../debug/reporter.ts';
import { registerEvents } from './events.ts';
import { initialize } from './initial.ts';
import { applyStyles } from './styles.ts';
import { startTimer } from './timer.ts';

export function startInstagram() {
    applyStyles();
    startDebugReporter();
    initialize();
    startTimer();
    registerEvents();
}
