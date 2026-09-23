import { initSettings } from "../shared/general";
import { logger } from "../shared/logger";
import { getTranslationText, repaintingTranslations } from "../shared/i18n";
import { state, USER_SETTING } from "../settings/state";
import { HOTKEY_SETTINGS, SETTINGS_STORAGE_KEYS } from "../settings/schema";
import { purgeCache } from "../features/media/image-cache";
import { registerMenuCommand } from "../features/menu";

export function initialize() {
    initSettings();
    registerMenuCommand();

    getTranslationText(state.lang).then((res) => {
        state.locale[state.lang] = res;
        repaintingTranslations();
        registerMenuCommand();
    }).catch((err) => {
        registerMenuCommand();

        if (!state.lang.startsWith('en')) {
            logger('getTranslationText()', 'failed', err);
        }
    });

    let activeLanguage = state.lang;
    async function syncSettings() {
        initSettings();
        if (state.lang === activeLanguage) return;

        activeLanguage = state.lang;
        if (!state.lang.startsWith('en') && state.locale[state.lang] == null) {
            try {
                state.locale[state.lang] = await getTranslationText(state.lang);
            } catch (err) {
                logger('getTranslationText()', 'focus sync failed', err);
            }
        }
        repaintingTranslations();
        registerMenuCommand();
    }

    const settingsStorageKeys = [
        ...Object.keys(USER_SETTING),
        ...Object.values(SETTINGS_STORAGE_KEYS),
        ...HOTKEY_SETTINGS.map(config => config.storageKey),
    ];
    for (const key of settingsStorageKeys) {
        GM_addValueChangeListener(key, () => {
            void syncSettings();
        });
    }

    logger('Script Loaded', GM_info.script.name, 'version:', GM_info.script.version);
    purgeCache();
}
