import { h } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { useLocation, useParams } from 'wouter-preact';
import { Button, Input, Select, Switch } from '../../../shared/ui/components.jsx';
import { KeyboardIcon, SlidersHorizontalIcon } from '../../../shared/ui/icons.jsx';
import {
    HOTKEY_OPTIONS,
    HOTKEY_SETTINGS,
    PARENT_CHILD_MAPPING,
} from '../schema.js';
import { requestSettings } from './client.js';
import { createTranslator, loadLocale, localeManifest, resolveLanguage } from './i18n.js';
import './settings.css';

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

export function OptionsApp() {
    const [data, setData] = useState(null);
    const [language, setLanguage] = useState('en-US');
    const [locale, setLocale] = useState({});
    const [error, setError] = useState('');
    const [conflict, setConflict] = useState(null);
    const [, navigate] = useLocation();
    const { tab: routeTab } = useParams();
    const tab = routeTab === 'keyboard' ? 'keyboard' : 'preferences';
    const t = createTranslator(locale);

    useEffect(() => {
        let cancelled = false;
        requestSettings('getState').then(async result => {
            const resolvedLanguage = resolveLanguage(result.language);
            const translations = await loadLocale(resolvedLanguage);
            if (cancelled) return;
            setData(result);
            setLanguage(resolvedLanguage);
            setLocale(translations);
        }).catch(reason => {
            if (!cancelled) setError(reason.message);
        });
        return () => { cancelled = true; };
    }, []);

    function setTab(next) {
        navigate(`/settings/${next}`);
    }

    async function saveSetting(name, value) {
        try {
            await requestSettings('setSetting', { name, value });
            setData(current => ({ ...current, settings: { ...current.settings, [name]: value } }));
            setError('');
        } catch (reason) {
            setError(reason.message);
        }
    }

    async function saveLanguage(value) {
        const resolved = resolveLanguage(value);
        try {
            await requestSettings('setLanguage', { value: resolved });
            const translations = await loadLocale(resolved);
            setLanguage(resolved);
            setLocale(translations);
            setError('');
        } catch (reason) {
            setError(reason.message);
        }
    }

    async function saveVolume(value) {
        const next = Math.max(0, Math.min(1, Number(value)));
        setData(current => ({ ...current, videoVolume: next }));
        try {
            await requestSettings('setVideoVolume', { value: next });
            setError('');
        } catch (reason) {
            setError(reason.message);
        }
    }

    async function saveRenameFormat(value) {
        setData(current => ({ ...current, renameFormat: value }));
        try {
            await requestSettings('setRenameFormat', { value });
            setError('');
        } catch (reason) {
            setError(reason.message);
        }
    }

    async function saveHotkey(stateKey, value) {
        try {
            const keyCode = await requestSettings('setHotkey', { stateKey, value: Number(value) });
            setData(current => ({ ...current, hotkeys: { ...current.hotkeys, [stateKey]: keyCode } }));
            setConflict(null);
            setError('');
        } catch (reason) {
            setConflict(stateKey);
            if (!reason.message.includes('conflict')) setError(reason.message);
        }
    }

    return (
        <main class="IG_SETTINGS_DIALOG ig-helper-ui" data-settings-tab={tab}>
            <div class="IG_SETTINGS_PANEL">
                <header class="IG_SETTINGS_HEADER">
                    <div>
                        <h2>{t('SETTING')}</h2>
                        <p>{t('SETTINGS_DESCRIPTION')}</p>
                    </div>
                    {data?.version && <span class="IG_SETTINGS_VERSION">v{data.version}</span>}
                </header>

                {error && <p class="IG_SETTINGS_STATUS" role="alert">{error}</p>}
                {!data && !error && <p class="IG_SETTINGS_STATUS">Loading settings…</p>}

                {data && (
                    <div class="tabs IG_SETTINGS_LAYOUT">
                        <nav class="IG_SETTINGS_TABS" aria-label={t('SETTINGS_SECTIONS')} role="tablist" aria-orientation="vertical" data-variant="line">
                            <button type="button" role="tab" aria-selected={tab === 'preferences'} onClick={() => setTab('preferences')}>
                                <SlidersHorizontalIcon />
                                {t('SETTINGS_PREFERENCES')}
                            </button>
                            <button type="button" role="tab" aria-selected={tab === 'keyboard'} onClick={() => setTab('keyboard')}>
                                <KeyboardIcon />
                                {t('SETTINGS_KEYBOARD')}
                            </button>
                        </nav>

                        <section class="IG_SETTINGS_CONTENT" role="tabpanel">
                            {tab === 'preferences' ? (
                                <Preferences data={data} language={language} t={t}
                                    onLanguageChange={saveLanguage} onSettingChange={saveSetting}
                                    onVolumeChange={saveVolume} onRenameFormatChange={saveRenameFormat} />
                            ) : (
                                <KeyboardSettings data={data} conflict={conflict} t={t} onSave={saveHotkey} />
                            )}
                        </section>
                    </div>
                )}
            </div>
        </main>
    );
}

function Preferences({ data, language, t, onLanguageChange, onSettingChange, onVolumeChange, onRenameFormatChange }) {
    return (
        <div class="IG_SETTINGS_PAGE">
            <SettingsSection title={t('SETTINGS_GENERAL')} description={t('SETTINGS_GENERAL_DESCRIPTION')}>
                <div class="IG_SETTING_ROW IG_SETTINGS_LANGUAGE">
                    <div class="IG_SETTING_COPY">
                        <label for="langSelect-trigger">{t('SETTINGS_LANGUAGE')}</label>
                        <p>{t('SETTINGS_LANGUAGE_NOTE')}</p>
                    </div>
                    <Select id="langSelect" value={language} onValueChange={onLanguageChange} popoverAlign="end">
                        {Object.entries(localeManifest).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </Select>
                </div>
            </SettingsSection>

            {preferenceSections().map(section => (
                <SettingsSection key={section.key} title={t(section.key)} description={t(section.descriptionKey)}>
                    {section.settings.map(setting => (
                        <PreferenceSetting key={setting.name} {...setting} data={data} t={t}
                            onSettingChange={onSettingChange} onVolumeChange={onVolumeChange}
                            onRenameFormatChange={onRenameFormatChange} />
                    ))}
                </SettingsSection>
            ))}
        </div>
    );
}

function SettingsSection({ title, description, children }) {
    return (
        <section class="IG_SETTINGS_SECTION">
            <header>
                <h3>{title}</h3>
                <p>{description}</p>
            </header>
            <div class="IG_SETTINGS_SECTION_BODY">{children}</div>
        </section>
    );
}

function PreferenceSetting({ name, isChild, parentName, data, t, onSettingChange, onVolumeChange, onRenameFormatChange }) {
    const checked = Boolean(data.settings[name]);
    const disabled = isChild && parentName && !data.settings[parentName];
    const label = t(settingLabelKey(name));

    return (
        <div class={`IG_SETTING_ROW${isChild ? ' IG_SETTING_ROW_CHILD' : ''}${disabled ? ' IG_SETTING_ROW_DISABLED' : ''}`}>
            <div class="IG_SETTING_COPY">
                <label for={name}>{label}</label>
                <p>{settingDescription(t, name)}</p>
            </div>
            <Switch id={name} checked={checked} disabled={disabled} aria-label={label}
                onChange={event => onSettingChange(name, event.currentTarget.checked)} />
            {name === 'MODIFY_VIDEO_VOLUME' && checked && (
                <VolumeEditor value={data.videoVolume} t={t} onChange={onVolumeChange} />
            )}
            {name === 'AUTO_RENAME' && checked && (
                <RenameEditor value={data.renameFormat} t={t} onChange={onRenameFormatChange} />
            )}
        </div>
    );
}

function VolumeEditor({ value, t, onChange }) {
    return (
        <div class="IG_SETTING_EDITOR">
            <label for="video_volume">{t('SETTINGS_VIDEO_VOLUME')}</label>
            <Input id="video_volume" aria-label={t('SETTINGS_VIDEO_VOLUME')} value={value}
                type="range" min="0" max="1" step="0.05" style={{ '--slider-value': `${value * 100}%` }}
                onInput={event => onChange(event.currentTarget.value)} />
            <Input class="IG_SETTING_NUMBER" aria-label={t('SETTINGS_VIDEO_VOLUME_VALUE')} value={value}
                type="number" min="0" max="1" step="0.05" onInput={event => onChange(event.currentTarget.value)} />
        </div>
    );
}

function RenameEditor({ value, t, onChange }) {
    return (
        <div class="IG_SETTING_EDITOR IG_SETTING_EDITOR_STACKED">
            <label for="date_format">{t('SETTINGS_FILE_NAME_FORMAT')}</label>
            <Input id="date_format" aria-label={t('SETTINGS_FILE_NAME_FORMAT')} value={value}
                onInput={event => onChange(event.currentTarget.value)} />
        </div>
    );
}

function KeyboardSettings({ data, conflict, t, onSave }) {
    return (
        <div class="IG_SETTINGS_PAGE">
            <SettingsSection title={t('SETTINGS_KEYBOARD')} description={t('SETTINGS_KEYBOARD_DESCRIPTION')}>
                <div class="IG_SETTINGS_SHORTCUT_NOTE">
                    {t('SETTINGS_SHORTCUT_NOTE')} <kbd class="kbd">Alt</kbd>
                </div>
                {HOTKEY_SETTINGS.map(config => (
                    <div key={config.stateKey} class="IG_HOTKEY_ROW">
                        <label for={`${config.stateKey}-trigger`}>{t(config.key)}</label>
                        <div class="IG_HOTKEY_ACTIONS">
                            <Select id={config.stateKey} value={data.hotkeys[config.stateKey]}
                                onValueChange={value => onSave(config.stateKey, value)}>
                                {HOTKEY_OPTIONS.map(keyCode => <option key={keyCode} value={keyCode}>{hotkeyLabel(keyCode)}</option>)}
                            </Select>
                            <Button variant="ghost" size="sm"
                                onClick={() => onSave(config.stateKey, config.defaultKeyCode)}>{t('HOTKEY_RESET')}</Button>
                        </div>
                        {conflict === config.stateKey && <p role="alert">{t('HOTKEY_CONFLICT_WARNING')}</p>}
                    </div>
                ))}
            </SettingsSection>
        </div>
    );
}

function preferenceSections() {
    return PREFERENCE_SECTIONS.map(section => ({
        ...section,
        settings: section.settings.flatMap(name => [
            { name, isChild: false, parentName: null },
            ...(PARENT_CHILD_MAPPING[name] ?? []).map(child => ({ name: child, isChild: true, parentName: name })),
        ]),
    }));
}

function settingDescription(t, name) {
    const description = t(`${name}_INTRO`);
    const text = Array.isArray(description) ? description[0] : description;
    return String(text ?? '').split('\n')[0];
}

function settingLabelKey(name) {
    return name === 'AUTO_RENAME' || name === 'MODIFY_VIDEO_VOLUME' ? `${name}_SETTINGS_LABEL` : name;
}

function hotkeyLabel(keyCode) {
    return `Alt+${keyCode === 192 ? '~' : String.fromCharCode(keyCode)}`;
}

