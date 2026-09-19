import { startDebugReporter } from '../debug/reporter.js';
import { registerEvents } from './events.js';
import { initialize } from './initial.js';
import { applyStyles } from './styles.js';
import { startTimer } from './timer.js';

export function startInstagram() {
    applyStyles();
    startDebugReporter();
    initialize();
    startTimer();
    registerEvents();
}
