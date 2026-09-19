import {
    DEBUG_COMMANDS,
    DEBUG_ENABLED_KEY,
    DEBUG_TAB_PREFIX,
    debugCommandKey,
    debugDomKey,
} from './protocol.js';

const CHANNEL = 'ig-helper:debug';
const SESSION_MAX_AGE_MS = 5000;

window.addEventListener('message', event => {
    if (event.origin !== location.origin || event.source !== window) return;
    if (event.data?.channel !== CHANNEL || event.data.direction !== 'request') return;

    const id = Number.isInteger(event.data.id) && event.data.id > 0 ? event.data.id : null;
    if (id == null) return;

    try {
        respond(id, true, handleRequest(event.data.method, event.data.payload));
    } catch (error) {
        respond(id, false, null, error instanceof Error ? error.message : String(error));
    }
});

function respond(id, ok, result, error) {
    window.postMessage({ channel: CHANNEL, direction: 'response', id, ok, result, error }, location.origin);
}

function handleRequest(method, payload = {}) {
    if (method === 'getState') {
        const now = Date.now();
        return {
            enabled: Boolean(GM_getValue(DEBUG_ENABLED_KEY, false)),
            sessions: GM_listValues()
                .filter(key => key.startsWith(DEBUG_TAB_PREFIX))
                .map(key => [key, GM_getValue(key)])
                .filter(([key, snapshot]) => {
                    const active = snapshot?.tabId && now - snapshot.updatedAt <= SESSION_MAX_AGE_MS;
                    if (!active) GM_deleteValue(key);
                    return active;
                })
                .map(([, snapshot]) => snapshot)
                .sort((a, b) => b.updatedAt - a.updatedAt),
        };
    }

    if (method === 'setEnabled') {
        const enabled = Boolean(payload.enabled);
        GM_setValue(DEBUG_ENABLED_KEY, enabled);
        return enabled;
    }

    if (method === 'command') {
        const { tabId, type } = payload;
        if (typeof tabId !== 'string' || !tabId || !DEBUG_COMMANDS.has(type)) throw new Error('Invalid debugger command');
        GM_setValue(debugCommandKey(tabId), {
            id: crypto.randomUUID(),
            tabId,
            type,
            at: Date.now(),
        });
        return true;
    }

    if (method === 'getDom') {
        if (typeof payload.tabId !== 'string' || !payload.tabId) throw new Error('Invalid debugger tab');
        return GM_getValue(debugDomKey(payload.tabId), null);
    }

    throw new Error(`Unsupported debugger operation: ${method}`);
}
