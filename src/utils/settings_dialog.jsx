import { Fragment, h, render } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { KeyboardIcon, SlidersHorizontalIcon, XIcon } from '../ui/icons.jsx';
import { locale_manifest, PARENT_CHILD_MAPPING, state, USER_SETTING } from '../settings';
import { Button, IconButton, Input, Select, Switch } from '../ui/components.jsx';
import { _i18n, getTranslationText, repaintingTranslations } from './i18n';

const SETTINGS_ROOT_ID = 'ig-helper-settings-root';
const HOTKEY_OPTIONS = [87, 90, 88, 68, 75, 67, 83, 192, 49, 50, 51, 52, 53];
const HOTKEY_SETTINGS = [
    { key: 'HOTKEY_SETTINGS_KEY', stateKey: 'settingsHotkeyKeyCode', storageKey: 'G_HOTKEY_SETTINGS_KEYCODE', defaultKeyCode: 87 },
    { key: 'HOTKEY_KEY_SETTINGS_KEY', stateKey: 'keySettingsHotkeyKeyCode', storageKey: 'G_HOTKEY_KEY_SETTINGS_KEYCODE', defaultKeyCode: 67 },
    { key: 'HOTKEY_DEBUG_KEY', stateKey: 'debugHotkeyKeyCode', storageKey: 'G_HOTKEY_DEBUG_KEYCODE', defaultKeyCode: 90 },
    { key: 'HOTKEY_DOWNLOAD_STORY_KEY', stateKey: 'downloadStoryHotkeyKeyCode', storageKey: 'G_HOTKEY_DOWNLOAD_STORY_KEYCODE', defaultKeyCode: 83 },
];

const PREFERENCE_SECTIONS = [
    {
        key: 'SETTINGS_DOWNLOADS',
        descriptionKey: 'SETTINGS_DOWNLOADS_DESCRIPTION',
        settings: ['DIRECT_DOWNLOAD_VISIBLE_RESOURCE', 'DIRECT_DOWNLOAD_ALL', 'DIRECT_DOWNLOAD_STORY', 'FORCE_FETCH_ALL_RESOURCES', 'USE_EXTERNAL_DOWNLOAD_MODE'],
    },
    {
        key: 'SETTINGS_FILES',
        descriptionKey: 'SETTINGS_FILES_DESCRIPTION',
        settings: ['AUTO_RENAME', 'MODIFY_RESOURCE_EXIF'],
    },
    {
        key: 'SETTINGS_MEDIA',
        descriptionKey: 'SETTINGS_MEDIA_DESCRIPTION',
        settings: ['FORCE_RESOURCE_VIA_MEDIA', 'CAPTURE_IMAGE_VIA_MEDIA_CACHE'],
    },
    {
        key: 'SETTINGS_PLAYBACK',
        descriptionKey: 'SETTINGS_PLAYBACK_DESCRIPTION',
        settings: ['DISABLE_VIDEO_LOOPING', 'HTML5_VIDEO_CONTROL', 'MODIFY_VIDEO_VOLUME', 'SCROLL_BUTTON'],
    },
    {
        key: 'SETTINGS_NAVIGATION',
        descriptionKey: 'SETTINGS_NAVIGATION_DESCRIPTION',
        settings: ['REDIRECT_CLICK_USER_STORY_PICTURE', 'SKIP_VIEW_STORY_CONFIRM', 'SKIP_SHARED_WITH_YOU_DIALOG'],
    },
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
        dialog.showModal();
        dialog.focus({ preventScroll: true });
        return () => {
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
                    <nav class="IG_SETTINGS_TABS" aria-label={_i18n('SETTINGS_SECTIONS')} role="tablist" aria-orientation="vertical">
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
        <div class="IG_SETTINGS_PAGE">
            <SettingsSection titleKey="SETTINGS_GENERAL" descriptionKey="SETTINGS_GENERAL_DESCRIPTION">
                <div class="IG_SETTING_ROW IG_SETTINGS_LANGUAGE">
                    <div class="IG_SETTING_COPY">
                        <label for="langSelect">{_i18n('SETTINGS_LANGUAGE')}</label>
                        <p>{_i18n('SETTINGS_LANGUAGE_NOTE')}</p>
                    </div>
                    <Select id="langSelect" value={language} onChange={onLanguageChange}>
                        {Object.entries(locale_manifest).map(([value, label]) => <option value={value}>{label}</option>)}
                    </Select>
                </div>
            </SettingsSection>

            {preferenceSections().map(section => (
                <SettingsSection titleKey={section.key} descriptionKey={section.descriptionKey}>
                    {section.settings.map(setting => (
                        <PreferenceSetting {...setting} onSettingChange={onSettingChange} />
                    ))}
                </SettingsSection>
            ))}
        </div>
    );
}

function SettingsSection({ titleKey, descriptionKey, children }) {
    return (
        <section class="card IG_SETTINGS_SECTION" data-size="sm">
            <header>
                <h3>{_i18n(titleKey)}</h3>
                <p>{_i18n(descriptionKey)}</p>
            </header>
            <div class="IG_SETTINGS_SECTION_BODY">{children}</div>
        </section>
    );
}

function PreferenceSetting({ name, isChild, parentName, onSettingChange }) {
    const checked = Boolean(USER_SETTING[name]);
    const disabled = isChild && parentName && !USER_SETTING[parentName];
    const label = _i18n(settingLabelKey(name));

    return (
        <div class={`IG_SETTING_ROW${isChild ? ' IG_SETTING_ROW_CHILD' : ''}${disabled ? ' IG_SETTING_ROW_DISABLED' : ''}`}>
            <div class="IG_SETTING_COPY">
                <label for={name} data-ih-locale={settingLabelKey(name)}>{label}</label>
                <p>{settingDescription(name)}</p>
            </div>
            <Switch id={name} checked={checked} disabled={disabled} aria-label={label}
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
        <div class="IG_SETTING_EDITOR">
            <label for="video_volume">{_i18n('SETTINGS_VIDEO_VOLUME')}</label>
            <Input id="video_volume" aria-label={_i18n('SETTINGS_VIDEO_VOLUME')} value={volume}
                type="range" min="0" max="1" step="0.05" style={{ '--slider-value': `${volume * 100}%` }}
                onInput={event => saveVolume(event.currentTarget.value)} />
            <Input class="IG_SETTING_NUMBER" aria-label={_i18n('SETTINGS_VIDEO_VOLUME_VALUE')} value={volume}
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
        <div class="IG_SETTING_EDITOR IG_SETTING_EDITOR_STACKED">
            <label for="date_format">{_i18n('SETTINGS_FILE_NAME_FORMAT')}</label>
            <Input id="date_format" aria-label={_i18n('SETTINGS_FILE_NAME_FORMAT')}
                value={format} onInput={saveFormat} />
        </div>
    );
}

function KeyboardSettings({ conflict, onSave, onReset }) {
    return (
        <div class="IG_SETTINGS_PAGE">
            <SettingsSection titleKey="SETTINGS_KEYBOARD" descriptionKey="SETTINGS_KEYBOARD_DESCRIPTION">
                <div class="IG_SETTINGS_SHORTCUT_NOTE">
                    {_i18n('SETTINGS_SHORTCUT_NOTE')} <kbd class="kbd">Alt</kbd>
                </div>
                {HOTKEY_SETTINGS.map(config => (
                    <div class="IG_HOTKEY_ROW">
                        <label for={config.stateKey}>{_i18n(config.key)}</label>
                        <div class="IG_HOTKEY_ACTIONS">
                            <Select id={config.stateKey} value={state[config.stateKey]} onChange={event => onSave(event, config)}>
                                {HOTKEY_OPTIONS.map(keyCode => <option value={keyCode}>{hotkeyLabel(keyCode)}</option>)}
                            </Select>
                            <Button variant="ghost" size="sm" onClick={() => onReset(config)}>{_i18n('HOTKEY_RESET')}</Button>
                        </div>
                        {conflict === config.stateKey && <p role="alert">{_i18n('HOTKEY_CONFLICT_WARNING')}</p>}
                    </div>
                ))}
            </SettingsSection>
        </div>
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

function preferenceSections() {
    const assigned = new Set();
    const sections = PREFERENCE_SECTIONS.map(section => ({
        ...section,
        settings: section.settings.flatMap(name => {
            if (!(name in USER_SETTING)) return [];
            assigned.add(name);
            const children = (PARENT_CHILD_MAPPING[name] ?? []).filter(child => child in USER_SETTING);
            children.forEach(child => assigned.add(child));
            return [
                { name, isChild: false, parentName: null },
                ...children.map(child => ({ name: child, isChild: true, parentName: name })),
            ];
        }),
    })).filter(section => section.settings.length > 0);

    const remaining = Object.keys(USER_SETTING)
        .filter(name => !assigned.has(name))
        .map(name => ({ name, isChild: false, parentName: null }));

    if (remaining.length > 0) {
        sections.push({ key: 'SETTINGS_OTHER', descriptionKey: 'SETTINGS_OTHER_DESCRIPTION', settings: remaining });
    }
    return sections;
}
