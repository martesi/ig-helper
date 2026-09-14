import { state } from "../settings";
import { reloadScript } from "./general";
import { logger } from "./logger";
import { _i18n } from "./i18n";
import { showSettingsDialog } from './settings_dialog.jsx';
import { mountDebugPanel, mountFeedbackPanel, mountLegacyDialog } from '../ui/dialogs.jsx';
import { LEGACY_DIALOG_ROOT_ID, queryAllLegacyDialog, queryLegacyDialog, removeOwnedUiRoot } from '../ui/shadow.js';

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
    queryAllLegacyDialog('.IG_POPUP_DIG').forEach(popup => {
        popup.classList.toggle('hidden', Boolean(hasHidden));
    });
}


/**
 * registerMenuCommand
 * @description Register script menu command.
 *
 * @return {void}
 */
export function registerMenuCommand() {
    for (const id of state.registerMenuIds) {
        logger('GM_unregisterMenuCommand', id);
        GM_unregisterMenuCommand(id);
    }
    state.registerMenuIds.length = 0;

    state.registerMenuIds.push(GM_registerMenuCommand(_i18n('SETTING'), () => {
        showSetting();
    }, {
        accessKey: "w"
    }));

    state.registerMenuIds.push(GM_registerMenuCommand(_i18n('HOTKEY_KEY_SETTINGS_KEY'), () => {
        showHotkeySetting();
    }, {
        accessKey: "q"
    }));

    state.registerMenuIds.push(GM_registerMenuCommand(_i18n('DONATE'), () => {
        GM_openInTab("https://ko-fi.com/snkoarashi", { active: true });
    }, {
        accessKey: "d"
    }));

    state.registerMenuIds.push(GM_registerMenuCommand(_i18n('DEBUG'), () => {
        showDebugDOM();
    }, {
        accessKey: "z"
    }));

    state.registerMenuIds.push(GM_registerMenuCommand(_i18n('FEEDBACK'), () => {
        showFeedbackDOM();
    }, {
        accessKey: "f"
    }));

    state.registerMenuIds.push(GM_registerMenuCommand(_i18n('RELOAD_SCRIPT'), () => {
        reloadScript();
    }, {
        accessKey: "r"
    }));
}

export function showHotkeySetting() {
    showSettingsDialog('keyboard', registerMenuCommand);
}

/**
 * showSetting
 * @description Show script settings window.
 *
 * @return {void}
 */
export function showSetting() {
    showSettingsDialog('preferences', registerMenuCommand);
}

/**
 * showDebugDOM
 * @description Show full DOM tree.
 *
 * @return {void}
 */
export function showDebugDOM() {
    removeLegacyDialogs();
    IG_createDM();
    queryLegacyDialog('.IG_POPUP_DIG #post_info').textContent = 'IG Debug DOM Tree';
    mountDebugPanel(queryLegacyDialog('.IG_POPUP_DIG .IG_POPUP_DIG_BODY'), {
        showTree: _i18n('SHOW_DOM_TREE'),
        copyTree: _i18n('SELECT_AND_COPY'),
        downloadTree: _i18n('DOWNLOAD_DOM_TREE'),
        github: _i18n('REPORT_GITHUB'),
        discord: _i18n('REPORT_DISCORD'),
    });
}

/**
 * showFeedbackDOM
 * @description Show feedback options.
 *
 * @return {void}
 */
export function showFeedbackDOM() {
    removeLegacyDialogs();
    IG_createDM();
    queryLegacyDialog('.IG_POPUP_DIG #post_info').textContent = 'Feedback Options';
    mountFeedbackPanel(queryLegacyDialog('.IG_POPUP_DIG .IG_POPUP_DIG_BODY'), {
        fork: _i18n('REPORT_FORK'),
        github: _i18n('REPORT_GITHUB'),
        discord: _i18n('REPORT_DISCORD'),
    });
}

function removeLegacyDialogs() {
    removeOwnedUiRoot(LEGACY_DIALOG_ROOT_ID);
}
