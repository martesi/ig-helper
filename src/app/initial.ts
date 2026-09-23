import { Effect } from 'effect';
import { initSettings, state, USER_SETTING } from "../settings/state";
import { logger } from "../shared/logger";
import { getTranslationText, repaintingTranslations } from "../shared/i18n";
import { HOTKEY_SETTINGS, SETTINGS_STORAGE_KEYS } from "../settings/schema";
import { purgeCache } from "../features/media/image-cache";
import { registerMenuCommand } from "../features/menu";

export function initialize() {
    return Effect.gen(function* () {
        yield* Effect.sync(() => {
            initSettings();
            registerMenuCommand();

            const translation = getTranslationText(state.lang);
            if (translation) {
                state.locale[state.lang] = translation;
                repaintingTranslations();
            }
            registerMenuCommand();
        });

        let activeLanguage = state.lang;
        function syncSettings() {
            initSettings();
            if (state.lang === activeLanguage) return;

            activeLanguage = state.lang;
            if (!state.lang.startsWith('en') && state.locale[state.lang] == null) {
                const translation = getTranslationText(state.lang);
                if (translation) state.locale[state.lang] = translation;
                else logger('getTranslationText()', 'focus sync failed', `Missing translation for ${state.lang}`);
            }
            repaintingTranslations();
            registerMenuCommand();
        }

        const settingsStorageKeys = [
            ...Object.keys(USER_SETTING),
            ...Object.values(SETTINGS_STORAGE_KEYS),
            ...HOTKEY_SETTINGS.map(config => config.storageKey),
        ];
        yield* Effect.acquireRelease(
            Effect.sync(() => settingsStorageKeys.map(key => GM_addValueChangeListener(key, syncSettings))),
            listenerIds => Effect.sync(() => listenerIds.forEach(GM_removeValueChangeListener)),
        );
        yield* Effect.sync(() => {
            logger('Script Loaded', GM_info.script.name, 'version:', GM_info.script.version);
            purgeCache();
        });
    });
}
