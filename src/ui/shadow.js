import uiStyles from '../ui.css?inline';

export const LEGACY_DIALOG_ROOT_ID = 'ig-helper-legacy-dialog-root';
export const LEGACY_DIALOG_MOUNTED_EVENT = 'ig-helper:legacy-dialog-mounted';

export function createOwnedUiRoot(id, extraStyles = '') {
    const host = document.createElement('div');
    host.id = id;

    const shadowRoot = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = extraStyles ? `${uiStyles}\n${extraStyles}` : uiStyles;

    const mount = document.createElement('div');
    mount.dataset.igHelperMount = '';

    shadowRoot.append(style, mount);
    document.body.append(host);
    return { host, mount, shadowRoot };
}

export function getOwnedUiShadowRoot(id) {
    return document.getElementById(id)?.shadowRoot ?? null;
}

export function getOwnedUiMount(id) {
    return getOwnedUiShadowRoot(id)?.querySelector('[data-ig-helper-mount]') ?? null;
}

export function removeOwnedUiRoot(id) {
    document.getElementById(id)?.remove();
}

export function queryLegacyDialog(selector) {
    return getOwnedUiShadowRoot(LEGACY_DIALOG_ROOT_ID)?.querySelector(selector) ?? null;
}

export function queryAllLegacyDialog(selector) {
    return Array.from(getOwnedUiShadowRoot(LEGACY_DIALOG_ROOT_ID)?.querySelectorAll(selector) ?? []);
}
