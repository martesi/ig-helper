import { Fragment, h, render } from 'preact';
import legacyStyles from '../../../style.css?inline';
import { Button, Checkbox, IconButton, Textarea } from './components.jsx';
import { XIcon } from './icons.jsx';
import {
    createOwnedUiRoot,
    LEGACY_DIALOG_MOUNTED_EVENT,
    LEGACY_DIALOG_ROOT_ID,
    removeOwnedUiRoot,
} from './shadow.js';

export function mountLegacyDialog({ hidden = false, hasCheckbox = false, labels, version }) {
    removeOwnedUiRoot(LEGACY_DIALOG_ROOT_ID);
    const { mount, shadowRoot } = createOwnedUiRoot(LEGACY_DIALOG_ROOT_ID, legacyStyles);
    render(<LegacyDialog hidden={hidden} hasCheckbox={hasCheckbox} labels={labels} version={version} />, mount);
    document.dispatchEvent(new CustomEvent(LEGACY_DIALOG_MOUNTED_EVENT, { detail: shadowRoot }));
    return shadowRoot.querySelector('.IG_POPUP_DIG');
}

export function mountDebugPanel(root, labels) {
    render(<DebugPanel labels={labels} />, root);
}

export function mountFeedbackPanel(root, labels) {
    render(<FeedbackPanel labels={labels} />, root);
}

function LegacyDialog({ hidden, hasCheckbox, labels, version }) {
    return (
        <div class={`IG_POPUP_DIG ig-helper-ui${hidden ? ' hidden' : ''}`}>
            <div class="IG_POPUP_DIG_BG" />
            <div class="IG_POPUP_DIG_MAIN">
                <div class="IG_POPUP_DIG_TITLE">
                    <div class="IG_LEGACY_DIALOG_HEADING">
                        <div>IG Helper v{version}</div>
                        <div id="post_info">Post ID: <span id="article-id" /></div>
                        <IconButton class="IG_POPUP_DIG_BTN" icon={XIcon} label={labels.close} />
                    </div>
                    {hasCheckbox && (
                        <>
                            <div id="button_group" class="IG_LEGACY_DIALOG_ACTIONS">
                                <Button id="batch_download_selected" disabled data-ih-locale="BATCH_DOWNLOAD_SELECTED">
                                    {labels.downloadSelected}
                                </Button>
                                <Button id="batch_download_direct" disabled data-ih-locale="BATCH_DOWNLOAD_DIRECT">
                                    {labels.downloadAll}
                                </Button>
                            </div>
                            <label class="IG_SELECT_ALL IG_LEGACY_SELECT_ALL">
                                <Checkbox value="yes" aria-label={labels.selectAll} />
                                <span data-ih-locale="ALL_CHECK">{labels.selectAll}</span>
                                <span class="item-count" />
                            </label>
                        </>
                    )}
                </div>
                <div class="IG_POPUP_DIG_BODY" />
            </div>
        </div>
    );
}

function DebugPanel({ labels }) {
    return (
        <div class="IG_LEGACY_PANEL">
            <Textarea class="IG_DEBUG_TEXTAREA" readOnly />
            <div class="IG_LEGACY_DIALOG_ACTIONS">
                <Button class="IG_DISPLAY_DOM_TREE">{labels.showTree}</Button>
                <Button class="IG_SELECT_DOM_TREE">{labels.copyTree}</Button>
                <Button class="IG_DOWNLOAD_DOM_TREE">{labels.downloadTree}</Button>
            </div>
            <div class="IG_LEGACY_DIALOG_ACTIONS">
                <a class="btn IG_REPORT_GITHUB" data-variant="outline" href="https://github.com/SN-Koarashi/ig-helper/issues" target="_blank" rel="noreferrer">{labels.github}</a>
                <a class="btn IG_REPORT_DISCORD" data-variant="outline" href="https://discord.gg/q3KT4hdq8x" target="_blank" rel="noreferrer">{labels.discord}</a>
            </div>
        </div>
    );
}

function FeedbackPanel({ labels }) {
    return (
        <div class="IG_LEGACY_PANEL">
            <div class="IG_LEGACY_DIALOG_ACTIONS">
                <a class="btn IG_REPORT_FORK" data-variant="outline" href="https://greasyfork.org/en/scripts/404535-ig-helper/feedback" target="_blank" rel="noreferrer">{labels.fork}</a>
                <a class="btn IG_REPORT_GITHUB" data-variant="outline" href="https://github.com/SN-Koarashi/ig-helper/issues" target="_blank" rel="noreferrer">{labels.github}</a>
                <a class="btn IG_REPORT_DISCORD" data-variant="outline" href="https://discord.gg/q3KT4hdq8x" target="_blank" rel="noreferrer">{labels.discord}</a>
            </div>
        </div>
    );
}
