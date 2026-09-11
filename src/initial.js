import { initSettings, logger } from "./utils/general";
import { getTranslationText, repaintingTranslations } from "./utils/i18n";
import { state } from "./settings";
import { purgeCache } from "./utils/image_cache";
import { registerMenuCommand } from "./utils/dialog";
import { registerPostClickHandlers } from "./functions/post";

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

logger('Script Loaded', GM_info.script.name, 'version:', GM_info.script.version);
registerPostClickHandlers();
purgeCache();
/*******************************/
