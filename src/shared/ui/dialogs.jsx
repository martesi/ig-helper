import { render } from 'preact';
import { Button, Checkbox, IconButton } from './components.jsx';
import { XIcon } from './icons.jsx';

export const LEGACY_DIALOG_ROOT_ID = 'ig-helper-legacy-dialog-root';

export function queryLegacyDialog(selector) {
    return document.getElementById(LEGACY_DIALOG_ROOT_ID)?.querySelector(selector) ?? null;
}

export function queryAllLegacyDialog(selector) {
    return Array.from(document.getElementById(LEGACY_DIALOG_ROOT_ID)?.querySelectorAll(selector) ?? []);
}

export function removeLegacyDialog() {
    const root = document.getElementById(LEGACY_DIALOG_ROOT_ID);
    if (!root) return;
    render(null, root);
    root.remove();
}

export function mountLegacyDialog({ hidden = false, hasCheckbox = false, labels, version }) {
    removeLegacyDialog();
    const root = document.createElement('div');
    root.id = LEGACY_DIALOG_ROOT_ID;
    document.body.append(root);
    render(<LegacyDialog hidden={hidden} hasCheckbox={hasCheckbox} labels={labels} version={version} />, root);
    return root.querySelector('.IG_POPUP_DIG');
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

