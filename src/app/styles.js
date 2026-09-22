import legacyStyles from '../../style.css?inline';
import lightDomStyles from './light-dom.css?inline';

export function applyStyles() {
    GM_addStyle(legacyStyles);
    GM_addStyle(lightDomStyles);
}
