export const DEBUG_CHANNEL = 'ig-helper:debug';
export const DEBUG_COMMANDS = new Set(['getSnapshot', 'clearLogs', 'captureDom']);

export const CONTROL_ORIGIN = import.meta.env.DEV
    ? 'http://127.0.0.1:9000'
    : 'https://martesi.github.io';

