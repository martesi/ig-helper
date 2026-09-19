import legacyStyles from '../../style.css?inline';
import componentStyles from '../shared/ui/components.css?inline';
import overlayStyles from '../shared/ui/overlay.css?inline';
import lightDomStyles from './light-dom.css?inline';

export function applyStyles() {
    GM_addStyle(legacyStyles);
    GM_addStyle(componentStyles);
    GM_addStyle(overlayStyles);
    GM_addStyle(lightDomStyles);
}
