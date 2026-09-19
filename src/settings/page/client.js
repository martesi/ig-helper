import { parseSettingsResponse } from '../message-schema.js';

const CHANNEL = 'ig-helper:settings';
const pending = new Map();
let nextId = 0;

window.addEventListener('message', event => {
    if (event.origin !== location.origin || event.source !== window) return;
    if (event.data?.channel !== CHANNEL || event.data.direction !== 'response') return;

    const request = pending.get(event.data.id);
    if (!request) return;

    let message;
    try {
        message = parseSettingsResponse(request.method, event.data);
    } catch {
        return;
    }

    pending.delete(message.id);
    clearTimeout(request.timer);
    clearInterval(request.retry);

    if (message.ok) request.resolve(message.result);
    else request.reject(new Error(message.error || 'IG Helper settings request failed'));
});

export function requestSettings(method, payload) {
    return new Promise((resolve, reject) => {
        const id = ++nextId;
        const message = { channel: CHANNEL, direction: 'request', id, method, payload };
        const send = () => window.postMessage(message, location.origin);
        const retry = setInterval(send, 100);
        const timer = setTimeout(() => {
            pending.delete(id);
            clearInterval(retry);
            reject(new Error('IG Helper userscript not detected. Enable it and reload this page.'));
        }, 5000);

        pending.set(id, { resolve, reject, retry, timer, method });
        send();
    });
}
