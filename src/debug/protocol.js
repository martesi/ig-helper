export const DEBUG_CHANNEL = 'ig-helper:debug';
export const DEBUG_COMMANDS = new Set(['getSnapshot', 'clearLogs', 'captureDom', 'reload']);

export const CONTROL_ORIGIN = import.meta.env.DEV
    ? 'http://127.0.0.1:9100'
    : 'https://martesi.github.io';

export function normalizeInstagramOrigin(value) {
    try {
        const url = new URL(value);
        if (url.protocol !== 'https:') return null;
        if (url.hostname !== 'instagram.com' && !url.hostname.endsWith('.instagram.com')) return null;
        return url.origin;
    } catch {
        return null;
    }
}
