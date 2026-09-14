import { Fragment, h, render } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { KeyboardIcon, SlidersHorizontalIcon, XIcon } from '../ui/icons.jsx';
import { locale_manifest, PARENT_CHILD_MAPPING, state, USER_SETTING } from '../settings';
import { Button, IconButton, Select, Switch } from '../ui/components.jsx';
import { _i18n, getTranslationText, repaintingTranslations } from './i18n';

const SETTINGS_ROOT_ID = 'ig-helper-settings-root';
const HOTKEY_OPTIONS = [87, 90, 88, 68, 75, 67, 83, 192, 49, 50, 51, 52, 53];
const HOTKEY_SETTINGS = [
    { key: 'HOTKEY_SETTINGS_KEY', stateKey: 'settingsHotkeyKeyCode', storageKey: 'G_HOTKEY_SETTINGS_KEYCODE', defaultKeyCode: 87 },
    { key: 'HOTKEY_KEY_SETTINGS_KEY', stateKey: 'keySettingsHotkeyKeyCode', storageKey: 'G_HOTKEY_KEY_SETTINGS_KEYCODE', defaultKeyCode: 67 },
    { key: 'HOTKEY_DEBUG_KEY', stateKey: 'debugHotkeyKeyCode', storageKey: 'G_HOTKEY_DEBUG_KEYCODE', defaultKeyCode: 90 },
    { key: 'HOTKEY_DOWNLOAD_STORY_KEY', stateKey: 'downloadStoryHotkeyKeyCode', storageKey: 'G_HOTKEY_DOWNLOAD_STORY_KEYCODE', defaultKeyCode: 83 },
];

export function showSettingsDialog(initialTab = 'preferences', onLanguageChange) {
    closeSettingsDialog();
    document.querySelectorAll('.IG_POPUP_DIG').forEach(dialog => dialog.remove());

    const root = document.createElement('div');
    root.id = SETTINGS_ROOT_ID;
    document.body.append(root);
    render(<SettingsDialog initialTab={initialTab} onLanguageChange={onLanguageChange} />, root);
}

export function closeSettingsDialog() {
    const root = document.getElementById(SETTINGS_ROOT_ID);
    if (!root) return;
    render(null, root);
    root.remove();
}

function SettingsDialog({ initialTab, onLanguageChange }) {
    const dialogRef = useRef(null);
    const [tab, setTab] = useState(initialTab);
    const [language, setLanguage] = useState(state.lang);
    const [conflict, setConflict] = useState(null);
    const [, refresh] = useState(0);

    useEffect(() => {
        const dialog = dialogRef.current;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        dialog.showModal();
        dialog.focus({ preventScroll: true });
        return () => {
            document.body.style.overflow = previousOverflow;
            if (dialog.open) dialog.close();
        };
    }, []);

    function closeFromBackdrop(event) {
        if (event.target === event.currentTarget) closeSettingsDialog();
    }

    function saveSetting(name, checked) {
        USER_SETTING[name] = checked;
        GM_setValue(name, checked);
        refresh(version => version + 1);
    }

    async function saveLanguage(event) {
        const value = event.currentTarget.value;
        state.lang = value;
        GM_setValue('UI_LANGUAGE', value);
        setLanguage(value);

        try {
            if (!value.startsWith('en') && state.locale[value] == null) {
                state.locale[value] = await getTranslationText(value);
            }
            repaintingTranslations();
            onLanguageChange?.();
            refresh(version => version + 1);
        } catch (error) {
            console.error('getTranslationText failed:', error);
        }
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
        refresh(version => version + 1);
    }

    function resetHotkey(config) {
        state[config.stateKey] = config.defaultKeyCode;
        GM_setValue(config.storageKey, config.defaultKeyCode);
        setConflict(null);
        refresh(version => version + 1);
    }

    return (
        <dialog ref={dialogRef} class="IG_POPUP_DIG IG_SETTINGS_DIALOG IG_MODAL_DIALOG ig-helper-ui"
            data-settings-tab={tab} aria-labelledby="ig-settings-title" tabIndex={-1} onClick={closeFromBackdrop}
            onCancel={event => { event.preventDefault(); closeSettingsDialog(); }}>
            <div class="IG_SETTINGS_PANEL" onClick={event => event.stopPropagation()}>
                <header class="IG_SETTINGS_HEADER">
                    <div>
                        <h2 id="ig-settings-title">{_i18n('SETTING')}</h2>
                        <p>{_i18n('SETTINGS_DESCRIPTION')}</p>
                    </div>
                    <IconButton class="IG_SETTINGS_CLOSE" icon={XIcon} label={_i18n('CLOSE')} onClick={closeSettingsDialog} />
                </header>

                <div class="tabs IG_SETTINGS_LAYOUT">
                    <nav class="IG_SETTINGS_TABS" aria-label={_i18n('SETTINGS_SECTIONS')} role="tablist" aria-orientation="vertical" data-variant="line">
                        <button type="button" role="tab" aria-selected={tab === 'preferences'}
                            onClick={() => setTab('preferences')}>
                            <SlidersHorizontalIcon />
                            {_i18n('SETTINGS_PREFERENCES')}
                        </button>
                        <button type="button" role="tab" aria-selected={tab === 'keyboard'}
                            onClick={() => setTab('keyboard')}>
                            <KeyboardIcon />
                            {_i18n('SETTINGS_KEYBOARD')}
                        </button>
                    </nav>

                    <section class="IG_SETTINGS_CONTENT" role="tabpanel">
                        {tab === 'preferences' ? (
                            <Preferences language={language} onLanguageChange={saveLanguage} onSettingChange={saveSetting} />
                        ) : (
                            <KeyboardSettings conflict={conflict} onSave={saveHotkey} onReset={resetHotkey} />
                        )}
                    </section>
                </div>
            </div>
        </dialog>
    );
}

function Preferences({ language, onLanguageChange, onSettingChange }) {
    return (
        <>
            <div class="IG_SETTINGS_LANGUAGE field">
                <label for="langSelect">{_i18n('SETTINGS_LANGUAGE')}</label>
                <Select id="langSelect" value={language} onChange={onLanguageChange}>
                    {Object.entries(locale_manifest).map(([value, label]) => <option value={value}>{label}</option>)}
                </Select>
                <p>{_i18n('SETTINGS_LANGUAGE_NOTE')}</p>
            </div>
            <div class="IG_SETTINGS_LIST">
                {orderedSettings().map(setting => (
                    <PreferenceSetting {...setting} onSettingChange={onSettingChange} />
                ))}
            </div>
        </>
    );
}

function PreferenceSetting({ name, isChild, parentName, onSettingChange }) {
    const checked = Boolean(USER_SETTING[name]);
    const disabled = isChild && parentName && !USER_SETTING[parentName];

    return (
        <div class={`globalSettings field${isChild ? ' child' : ''}${disabled ? ' disabled' : ''}`} data-orientation="horizontal">
            <section>
                <label for={name} data-ih-locale={settingLabelKey(name)}>{_i18n(settingLabelKey(name))}</label>
                <p>{settingDescription(name)}</p>
            </section>
            <Switch id={name} checked={checked} disabled={disabled}
                aria-label={_i18n(settingLabelKey(name))}
                onChange={event => onSettingChange(name, event.currentTarget.checked)} />
            {name === 'MODIFY_VIDEO_VOLUME' && checked && <VolumeEditor />}
            {name === 'AUTO_RENAME' && checked && <RenameEditor />}
        </div>
    );
}

function VolumeEditor() {
    const [volume, setVolume] = useState(Number(state.videoVolume));

    function saveVolume(value) {
        const next = Math.max(0, Math.min(1, Number(value)));
        setVolume(next);
        state.videoVolume = next;
        GM_setValue('G_VIDEO_VOLUME', next);
    }

    return (
        <div class="IG_SETTINGS_EDITOR field" data-orientation="horizontal">
            <label for="video_volume">{_i18n('SETTINGS_VIDEO_VOLUME')}</label>
            <input id="video_volume" aria-label={_i18n('SETTINGS_VIDEO_VOLUME')} value={volume}
                type="range" min="0" max="1" step="0.05" onInput={event => saveVolume(event.currentTarget.value)} />
            <input class="input" aria-label={_i18n('SETTINGS_VIDEO_VOLUME_VALUE')} value={volume}
                type="number" min="0" max="1" step="0.05" onInput={event => saveVolume(event.currentTarget.value)} />
        </div>
    );
}

function RenameEditor() {
    const [format, setFormat] = useState(state.fileRenameFormat);

    function saveFormat(event) {
        const value = event.currentTarget.value;
        setFormat(value);
        state.fileRenameFormat = value;
        GM_setValue('G_RENAME_FORMAT', value);
    }

    return (
        <div class="IG_SETTINGS_EDITOR field">
            <label for="date_format">{_i18n('SETTINGS_FILE_NAME_FORMAT')}</label>
            <input id="date_format" class="input" aria-label={_i18n('SETTINGS_FILE_NAME_FORMAT')}
                value={format} onInput={saveFormat} />
        </div>
    );
}

function KeyboardSettings({ conflict, onSave, onReset }) {
    return (
        <>
            <div class="IG_SETTINGS_SECTION_INTRO">
                {_i18n('SETTINGS_SHORTCUT_NOTE')} <kbd class="kbd">Alt</kbd>
            </div>
            <div class="IG_SETTINGS_LIST IG_SETTINGS_HOTKEYS">
                {HOTKEY_SETTINGS.map(config => (
                    <div class="IG_SETTINGS_HOTKEY field" data-orientation="horizontal">
                        <label for={config.stateKey}>{_i18n(config.key)}</label>
                        <Select id={config.stateKey} value={state[config.stateKey]} onChange={event => onSave(event, config)}>
                            {HOTKEY_OPTIONS.map(keyCode => <option value={keyCode}>{hotkeyLabel(keyCode)}</option>)}
                        </Select>
                        <Button variant="ghost" size="sm" onClick={() => onReset(config)}>{_i18n('HOTKEY_RESET')}</Button>
                        {conflict === config.stateKey && <p role="alert">{_i18n('HOTKEY_CONFLICT_WARNING')}</p>}
                    </div>
                ))}
            </div>
        </>
    );
}

function hotkeyLabel(keyCode) {
    return `Alt+${keyCode === 192 ? '~' : String.fromCharCode(keyCode)}`;
}

function settingDescription(name) {
    const description = _i18n(`${name}_INTRO`);
    const text = Array.isArray(description) ? description[0] : description;
    return String(text ?? '').split('\n')[0];
}

function settingLabelKey(name) {
    return name === 'AUTO_RENAME' || name === 'MODIFY_VIDEO_VOLUME' ? `${name}_SETTINGS_LABEL` : name;
}

function orderedSettings() {
    const childNames = new Set(Object.values(PARENT_CHILD_MAPPING).flat());
    const settings = [];

    Object.keys(USER_SETTING).forEach(name => {
        if (childNames.has(name)) return;
        settings.push({ name, isChild: false, parentName: null });
        PARENT_CHILD_MAPPING[name]?.forEach(child => settings.push({ name: child, isChild: true, parentName: name }));
    });

    return settings;
}
