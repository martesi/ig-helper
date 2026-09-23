import { Effect } from 'effect';
import lightDomStyles from './light-dom.css?inline';

export function applyStyles() {
    return Effect.acquireRelease(
        Effect.sync(() => GM_addStyle(lightDomStyles)),
        style => Effect.sync(() => style.remove()),
    );
}
