import { initSettings } from "../shared/general";
import { logger } from "../shared/logger";
import { getTranslationText, repaintingTranslations } from "../shared/i18n";
import { state } from "../settings/state";
import { purgeCache } from "../features/media/image-cache";
import { registerMenuCommand } from "../features/menu";

// initialization script
initSettings();
registerMenuCommand();

getTranslationText(state.lang).then((res) => {
    state.locale[state.lang] = res;
    repaintingTranslations();
    registerMenuCommand();
}).catch((err) => {
    registerMenuCommand();

    if (!state.lang.startsWith('en')) {
        console.error('getTranslationText catch error:', err);
    }
});

let activeLanguage = state.lang;
window.addEventListener('focus', async () => {
    initSettings();
    if (state.lang === activeLanguage) return;

    activeLanguage = state.lang;
    if (!state.lang.startsWith('en') && state.locale[state.lang] == null) {
        try {
            state.locale[state.lang] = await getTranslationText(state.lang);
        } catch (err) {
            console.error('getTranslationText focus sync failed:', err);
        }
    }
    repaintingTranslations();
    registerMenuCommand();
});

logger('Script Loaded', GM_info.script.name, 'version:', GM_info.script.version);
purgeCache();
/*******************************/
