const CHANNEL = 'ig-helper:debug';
const pending = new Map();
let nextId = 0;

window.addEventListener('message', event => {
    if (event.origin !== location.origin || event.source !== window) return;
    if (event.data?.channel !== CHANNEL || event.data.direction !== 'response') return;

    const request = pending.get(event.data.id);
    if (!request) return;

    pending.delete(event.data.id);
    clearTimeout(request.timer);
    clearInterval(request.retry);

    if (event.data.ok) request.resolve(event.data.result);
    else request.reject(new Error(event.data.error || 'IG Helper debugger request failed'));
});

export function requestDebug(method, payload) {
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

        pending.set(id, { resolve, reject, timer, retry });
        send();
    });
}
