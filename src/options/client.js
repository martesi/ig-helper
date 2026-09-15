const CHANNEL = 'ig-helper:settings';
const pending = new Map();
let nextId = 0;

window.addEventListener('message', event => {
    if (event.source !== window || event.origin !== location.origin) return;
    const message = event.data;
    if (message?.channel !== CHANNEL || message.direction !== 'response') return;

    const request = pending.get(message.id);
    if (!request) return;
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
        }, 2000);

        pending.set(id, { resolve, reject, retry, timer });
        send();
    });
}
