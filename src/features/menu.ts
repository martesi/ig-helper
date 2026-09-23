import { state } from '../settings/state';
import { logger } from '../shared/logger';
import { _i18n } from '../shared/i18n';

const PAGE_ROOT = import.meta.env.DEV
    ? 'http://127.0.0.1:9000/#/'
    : 'https://martesi.github.io/ig-helper/#/';
const CONTROL_WINDOW_NAME = 'ig-helper-control';

export function registerMenuCommand() {
    for (const id of state.registerMenuIds) {
        logger('GM_unregisterMenuCommand', id);
        GM_unregisterMenuCommand(id);
    }
    state.registerMenuIds.length = 0;

    state.registerMenuIds.push(
        GM_registerMenuCommand(_i18n('SETTING'), showSetting, { accessKey: 'w' }),
    );
}

export function showSetting() {
    openPage('settings/preferences');
}

export function showHotkeySetting() {
    openPage('settings/keyboard');
}

export function showDebugger() {
    openPage('debug');
}

function openPage(path: string) {
    const url = `${PAGE_ROOT}${path}`;
    const controlWindow = window.open(url, CONTROL_WINDOW_NAME);
    if (controlWindow) {
        controlWindow.focus();
        return;
    }

    logger('window.open blocked; falling back to GM_openInTab', url);
    GM_openInTab(url, { active: true });
}
