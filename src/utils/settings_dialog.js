import htm from 'htm';
import { h, render } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { locale_manifest, PARENT_CHILD_MAPPING, state, SVG, USER_SETTING } from '../settings';
import { _i18n } from './i18n';

const SETTINGS_ROOT_ID = 'ig-helper-settings-root';
const html = htm.bind(h);
const HOTKEY_OPTIONS = [87, 90, 88, 68, 75, 67, 83, 192, 49, 50, 51, 52, 53];
const HOTKEY_SETTINGS = [
    { key: 'HOTKEY_SETTINGS_KEY', stateKey: 'settingsHotkeyKeyCode', storageKey: 'G_HOTKEY_SETTINGS_KEYCODE', defaultKeyCode: 87 },
    { key: 'HOTKEY_KEY_SETTINGS_KEY', stateKey: 'keySettingsHotkeyKeyCode', storageKey: 'G_HOTKEY_KEY_SETTINGS_KEYCODE', defaultKeyCode: 67 },
    { key: 'HOTKEY_DEBUG_KEY', stateKey: 'debugHotkeyKeyCode', storageKey: 'G_HOTKEY_DEBUG_KEYCODE', defaultKeyCode: 90 },
    { key: 'HOTKEY_DOWNLOAD_STORY_KEY', stateKey: 'downloadStoryHotkeyKeyCode', storageKey: 'G_HOTKEY_DOWNLOAD_STORY_KEYCODE', defaultKeyCode: 83 },
];

export function showSettingsDialog(initialTab = 'preferences') {
    closeSettingsDialog();
    document.querySelectorAll('.IG_POPUP_DIG').forEach(dialog => dialog.remove());

    const root = document.createElement('div');
    root.id = SETTINGS_ROOT_ID;
    document.body.append(root);
    render(html`<${SettingsDialog} initialTab=${initialTab} />`, root);
}

export function closeSettingsDialog() {
    const root = document.getElementById(SETTINGS_ROOT_ID);
    if (!root) return;
    render(null, root);
    root.remove();
}

function SettingsDialog({ initialTab }) {
    const dialogRef = useRef(null);
    const [tab, setTab] = useState(initialTab);
    const [conflict, setConflict] = useState(null);
    const [, refreshHotkeys] = useState(0);

    useEffect(() => {
        const dialog = dialogRef.current;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        dialog.showModal();
        return () => {
            document.body.style.overflow = previousOverflow;
            if (dialog.open) dialog.close();
        };
    }, []);

    function closeFromBackdrop(event) {
        if (event.target === event.currentTarget) closeSettingsDialog();
    }

    function saveHotkey(event, config) {
        const keyCode = Number(event.currentTarget.value);
        if (HOTKEY_SETTINGS.some(setting => setting.stateKey !== config.stateKey && state[setting.stateKey] === keyCode)) {
            event.currentTarget.value = state[config.stateKey];
            setConflict(config.stateKey);
            return;
        }
        state[config.stateKey] = keyCode;
        GM_setValue(config.storageKey, keyCode);
        setConflict(null);
        refreshHotkeys(version => version + 1);
    }

    function resetHotkey(config) {
        state[config.stateKey] = config.defaultKeyCode;
        GM_setValue(config.storageKey, config.defaultKeyCode);
        setConflict(null);
        refreshHotkeys(version => version + 1);
    }

    return html`
        <dialog ref=${dialogRef} class="IG_POPUP_DIG IG_SETTINGS_DIALOG" data-settings-tab=${tab}
            aria-labelledby="ig-settings-title" onClick=${closeFromBackdrop}
            onCancel=${event => { event.preventDefault(); closeSettingsDialog(); }}>
            <div class="IG_POPUP_DIG_MAIN IG_SETTINGS_PANEL" onClick=${event => event.stopPropagation()}>
                <header class="IG_POPUP_DIG_TITLE IG_SETTINGS_HEADER">
                    <h2 id="ig-settings-title">${_i18n('SETTING')}</h2>
                    <div id="post_info">Preference Settings</div>
                    <button type="button" class="IG_SETTINGS_CLOSE" aria-label=${_i18n('CLOSE')}
                        dangerouslySetInnerHTML=${{ __html: SVG.CLOSE }} onClick=${closeSettingsDialog} />
                </header>
                <div class="IG_SETTINGS_LAYOUT">
                    <nav class="IG_SETTINGS_TABS" aria-label="Settings sections" role="tablist">
                        <button type="button" role="tab" aria-selected=${tab === 'preferences'}
                            class=${tab === 'preferences' ? 'selected' : ''} onClick=${() => setTab('preferences')}>Preferences</button>
                        <button type="button" role="tab" aria-selected=${tab === 'keyboard'}
                            class=${tab === 'keyboard' ? 'selected' : ''} onClick=${() => setTab('keyboard')}>Keyboard shortcuts</button>
                    </nav>
                    <div class="IG_POPUP_DIG_BODY IG_SETTINGS_CONTENT">
                        ${tab === 'preferences' ? html`
                            <div class="IG_SETTINGS_LANGUAGE">
                                <label for="langSelect">Language</label>
                                <select id="langSelect" value=${state.lang}>
                                    ${Object.entries(locale_manifest).map(([value, label]) => html`
                                        <option value=${value}>${label}</option>
                                    `)}
                                </select>
                                <p>Some translations are machine-generated and may be inaccurate.</p>
                            </div>
                            <div class="IG_SETTINGS_LIST">
                                ${orderedSettings().map(setting => html`<${PreferenceSetting} ...${setting} />`)}
                            </div>
                        ` : html`
                            <div class="IG_SETTINGS_SECTION_INTRO">Choose the <kbd>Alt</kbd> shortcut for each action.</div>
                            <div class="IG_SETTINGS_LIST IG_SETTINGS_HOTKEYS">
                                ${HOTKEY_SETTINGS.map(config => html`
                                    <div class="IG_SETTINGS_HOTKEY">
                                        <label for=${config.stateKey}>${_i18n(config.key)}</label>
                                        <select id=${config.stateKey} value=${state[config.stateKey]} onChange=${event => saveHotkey(event, config)}>
                                            ${HOTKEY_OPTIONS.map(keyCode => html`<option value=${keyCode}>${hotkeyLabel(keyCode)}</option>`)}
                                        </select>
                                        <button type="button" onClick=${() => resetHotkey(config)}>Reset</button>
                                        ${conflict === config.stateKey && html`<p role="alert">${_i18n('HOTKEY_CONFLICT_WARNING')}</p>`}
                                    </div>
                                `)}
                            </div>
                        `}
                    </div>
                </div>
            </div>
        </dialog>
    `;
}

function PreferenceSetting({ name, isChild }) {
    return html`
        <div class=${`globalSettings${isChild ? ' child' : ''}`}>
            <label class="IG_SETTINGS_TOGGLE" for=${name} title=${_i18n(`${name}_INTRO`)} data-ih-locale-title=${`${name}_INTRO`}>
                <span data-ih-locale=${settingLabelKey(name)}>${_i18n(settingLabelKey(name))}</span>
            </label>
            <input id=${name} value="box" type="checkbox" checked=${USER_SETTING[name]} />
            <label class="chbtn" for=${name} aria-label=${_i18n(name)}><span class="rounds" /></label>
            ${name === 'MODIFY_VIDEO_VOLUME' ? html`
                <div id="tempWrapper" class="IG_SETTINGS_EDITOR">
                    <label for="video_volume">Video volume</label>
                    <input id="video_volume" aria-label="Video volume" value=${state.videoVolume}
                        type="range" min="0" max="1" step="0.05" />
                    <input aria-label="Video volume value" value=${state.videoVolume}
                        type="number" min="0" max="1" step="0.05" />
                </div>
            ` : html`
                ${name === 'AUTO_RENAME' && html`
                    <div id="tempWrapper" class="IG_SETTINGS_EDITOR">
                        <label for="date_format">File name format</label>
                        <input id="date_format" aria-label="File rename format" value=${state.fileRenameFormat} />
                    </div>
                `}
            `}
        </div>
    `;
}

function hotkeyLabel(keyCode) {
    return `Alt+${keyCode === 192 ? '~' : String.fromCharCode(keyCode)}`;
}

function settingLabelKey(name) {
    return name === 'AUTO_RENAME' || name === 'MODIFY_VIDEO_VOLUME' ? `${name}_SETTINGS_LABEL` : name;
}

function orderedSettings() {
    const childNames = new Set(Object.values(PARENT_CHILD_MAPPING).flat());
    const settings = [];

    Object.keys(USER_SETTING).forEach(name => {
        if (childNames.has(name)) return;
        settings.push({ name, isChild: false });
        PARENT_CHILD_MAPPING[name]?.forEach(child => settings.push({ name: child, isChild: true }));
    });

    return settings;
}
