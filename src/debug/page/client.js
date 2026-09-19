import { DEBUG_CHANNEL, normalizeInstagramOrigin } from '../protocol.js';

const pending = new Map();
let nextId = 0;
const openerOrigin = normalizeInstagramOrigin(new URLSearchParams(location.search).get('openerOrigin'));

window.addEventListener('message', event => {
    if (!openerOrigin || event.origin !== openerOrigin || event.source !== window.opener) return;
    if (event.data?.channel !== DEBUG_CHANNEL || event.data.direction !== 'response') return;

    const request = pending.get(event.data.id);
    if (!request) return;

    pending.delete(event.data.id);
    clearTimeout(request.timer);
    clearInterval(request.retry);

    if (event.data.ok) request.resolve(event.data.result);
    else request.reject(new Error(event.data.error || 'IG Helper debugger request failed'));
});

export function hasDebugOpener() {
    return Boolean(openerOrigin && window.opener && !window.opener.closed);
}

export function requestDebug(method) {
    return new Promise((resolve, reject) => {
        if (!hasDebugOpener()) {
            reject(new Error('Open Settings from Instagram to attach the debugger.'));
            return;
        }

        const id = ++nextId;
        const message = { channel: DEBUG_CHANNEL, direction: 'request', id, method };
        const send = () => window.opener.postMessage(message, openerOrigin);
        const retry = setInterval(send, 100);
        const timer = setTimeout(() => {
            pending.delete(id);
            clearInterval(retry);
            reject(new Error('The Instagram tab did not respond.'));
        }, 5000);

        pending.set(id, { resolve, reject, retry, timer });
        send();
    });
}
