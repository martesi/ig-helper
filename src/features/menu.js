import { DEBUG_ENABLED_KEY } from '../debug/protocol.js';
import { state } from '../settings/state';
import { logger } from '../shared/logger';
import { _i18n } from '../shared/i18n';
import { mountLegacyDialog, queryLegacyDialog } from '../shared/ui/dialogs.jsx';

const PAGE_ROOT = import.meta.env.DEV
    ? 'http://127.0.0.1:9100/#/'
    : 'https://martesi.github.io/ig-helper/#/';

/**
 * IG_createDM
 * @description A dialog showing a list of all media files in the post.
 *
 * @param  {Boolean}  hasHidden
 * @param  {Boolean}  hasCheckbox
 * @return {void}
 */
export function IG_createDM(hasHidden, hasCheckbox) {
    mountLegacyDialog({
        hidden: Boolean(hasHidden),
        hasCheckbox: Boolean(hasCheckbox),
        version: GM_info.script.version,
        labels: {
            close: _i18n('CLOSE'),
            downloadSelected: _i18n('BATCH_DOWNLOAD_SELECTED'),
            downloadAll: _i18n('BATCH_DOWNLOAD_DIRECT'),
            selectAll: _i18n('ALL_CHECK'),
        },
    });
}

/**
 * IG_setDM
 * @description Set a dialog status.
 *
 * @param  {Boolean}  hasHidden
 * @return {void}
 */
export function IG_setDM(hasHidden) {
    queryLegacyDialog('.IG_POPUP_DIG')?.classList.toggle('hidden', Boolean(hasHidden));
}

export function registerMenuCommand() {
    for (const id of state.registerMenuIds) {
        logger('GM_unregisterMenuCommand', id);
        GM_unregisterMenuCommand(id);
    }
    state.registerMenuIds.length = 0;

    state.registerMenuIds.push(
        GM_registerMenuCommand(_i18n('SETTING'), showSetting, { accessKey: 'w' }),
        GM_registerMenuCommand(debuggerMenuLabel(), toggleDebugger, { accessKey: 'z' }),
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

export function toggleDebugger() {
    const enabled = !GM_getValue(DEBUG_ENABLED_KEY, false);
    GM_setValue(DEBUG_ENABLED_KEY, enabled);
    registerMenuCommand();
    if (enabled) showDebugger();
}

function debuggerMenuLabel() {
    return `${GM_getValue(DEBUG_ENABLED_KEY, false) ? '✓' : '○'} ${_i18n('DEBUG')}`;
}

function openPage(path) {
    GM_openInTab(`${PAGE_ROOT}${path}`, { active: true });
}
