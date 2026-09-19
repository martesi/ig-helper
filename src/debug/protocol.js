export const DEBUG_ENABLED_KEY = 'IG_HELPER_DEBUG_ENABLED';
export const DEBUG_TAB_PREFIX = 'IG_HELPER_DEBUG_TAB:';
export const DEBUG_COMMAND_PREFIX = 'IG_HELPER_DEBUG_COMMAND:';
export const DEBUG_DOM_PREFIX = 'IG_HELPER_DEBUG_DOM:';

export const DEBUG_COMMANDS = new Set(['refresh', 'clearLogs', 'captureDom', 'reload']);

export function debugTabKey(tabId) {
    return `${DEBUG_TAB_PREFIX}${tabId}`;
}

export function debugCommandKey(tabId) {
    return `${DEBUG_COMMAND_PREFIX}${tabId}`;
}

export function debugDomKey(tabId) {
    return `${DEBUG_DOM_PREFIX}${tabId}`;
}
