import { initSettings } from "./utils/general";
import { logger } from "./utils/logger";
import { getTranslationText, repaintingTranslations } from "./utils/i18n";
import { state } from "./settings";
import { purgeCache } from "./utils/image_cache";
import { registerMenuCommand } from "./utils/dialog";

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
