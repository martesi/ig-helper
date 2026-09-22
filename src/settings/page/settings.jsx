import { useEffect, useState } from 'preact/hooks';
import { Link } from 'wouter-preact';
import { Button, Input, Select, Switch } from '../../shared/ui/components.jsx';
import {
    DIRECT_DOWNLOAD_MODE_OPTIONS,
    HOTKEY_OPTIONS,
    HOTKEY_SETTINGS,
    PARENT_CHILD_MAPPING,
} from '../schema.js';
import { requestSettings } from './client.js';
import { createTranslator, loadLocale, localeManifest, resolveLanguage } from './i18n.js';

const SETTINGS_SECTIONS = [
    {
        id: 'downloads',
        key: 'SETTINGS_DOWNLOADS',
        descriptionKey: 'SETTINGS_DOWNLOADS_DESCRIPTION',
        settings: ['DIRECT_DOWNLOAD_MODE'],
    },
    {
        id: 'files',
        key: 'SETTINGS_FILES',
        descriptionKey: 'SETTINGS_FILES_DESCRIPTION',
        settings: ['AUTO_RENAME'],
    },
    {
        id: 'playback',
        key: 'SETTINGS_PLAYBACK',
        descriptionKey: 'SETTINGS_PLAYBACK_DESCRIPTION',
        settings: ['SHOW_MEDIA_PREVIEW', 'SHOW_OPEN_IN_NEW_TAB_BUTTON', 'DISABLE_VIDEO_LOOPING', 'HTML5_VIDEO_CONTROL', 'MODIFY_VIDEO_VOLUME'],
    },
    {
        id: 'navigation',
        key: 'SETTINGS_NAVIGATION',
        descriptionKey: 'SETTINGS_NAVIGATION_DESCRIPTION',
        settings: ['REDIRECT_CLICK_USER_STORY_PICTURE', 'SKIP_VIEW_STORY_CONFIRM', 'SKIP_SHARED_WITH_YOU_DIALOG'],
    },
    {
        id: 'advanced',
        key: 'SETTINGS_ADVANCED',
        descriptionKey: 'SETTINGS_ADVANCED_DESCRIPTION',
        settings: [
            'FORCE_RESOURCE_VIA_MEDIA',
            'CAPTURE_IMAGE_VIA_MEDIA_CACHE',
            'MODIFY_RESOURCE_EXIF',
            'USE_EXTERNAL_DOWNLOAD_MODE',
        ],
    },
];

const SECTION_NAV_ITEMS = [
    { id: 'general', key: 'SETTINGS_GENERAL' },
    ...SETTINGS_SECTIONS.map(({ id, key }) => ({ id, key })),
    { id: 'keyboard', key: 'SETTINGS_KEYBOARD' },
    { id: 'about', key: 'SETTINGS_ABOUT' },
];

export function OptionsApp({ onHeaderChange }) {
    const [data, setData] = useState(null);
    const [language, setLanguage] = useState('en-US');
    const [locale, setLocale] = useState({});
    const [error, setError] = useState('');
    const [conflict, setConflict] = useState(null);
    const [activeSection, setActiveSection] = useState('general');
    const t = createTranslator(locale);

    useEffect(() => {
        let cancelled = false;
        requestSettings('getState').then(async result => {
            const resolvedLanguage = resolveLanguage(result.language);
            const translations = await loadLocale(resolvedLanguage);
            if (cancelled) return;
            const translate = createTranslator(translations);
            setData(result);
            setLanguage(resolvedLanguage);
            setLocale(translations);
            onHeaderChange({
                title: translate('SETTING'),
                description: translate('SETTINGS_DESCRIPTION'),
            });
        }).catch(reason => {
            if (!cancelled) setError(reason.message);
        });
        return () => { cancelled = true; };
    }, [onHeaderChange]);

    useEffect(() => {
        if (!data) return;
        const content = document.querySelector('.IG_SETTINGS_CONTENT');
        const sections = SECTION_NAV_ITEMS.map(({ id }) => document.getElementById(`settings-${id}`)).filter(Boolean);
        if (!content || !sections.length) return;

        const updateActiveSection = () => setActiveSection(findActiveSection(content, sections));
        updateActiveSection();
        content.addEventListener('scroll', updateActiveSection, { passive: true });
        return () => content.removeEventListener('scroll', updateActiveSection);
    }, [data]);

    useEffect(() => {
        document.querySelector(`[data-settings-locator="${activeSection}"]`)
            ?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }, [activeSection]);

    function locateSection(section) {
        setActiveSection(section);
        document.getElementById(`settings-${section}`)?.scrollIntoView({ behavior: 'auto', block: 'start' });
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
            const translate = createTranslator(translations);
            setLanguage(resolved);
            setLocale(translations);
            onHeaderChange({
                title: translate('SETTING'),
                description: translate('SETTINGS_DESCRIPTION'),
            });
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
        <>
            {!data && error && (
                <div class="empty">
                    <header>
                        <h3>Settings unavailable</h3>
                        <p>IG Helper could not connect to the userscript.</p>
                    </header>
                    <footer>
                        <Link class="btn" data-variant="secondary" href="/">Go home</Link>
                    </footer>
                </div>
            )}
            {data && error && <p class="IG_SETTINGS_STATUS" role="alert">{error}</p>}
            {!data && !error && <p class="IG_SETTINGS_STATUS">Loading settings…</p>}

            {data && (
                <div class="IG_SETTINGS_LAYOUT">
                    <nav class="IG_SETTINGS_TABS" aria-label={t('SETTINGS_SECTIONS')}>
                        {SECTION_NAV_ITEMS.map(section => (
                            <Button key={section.id} class="IG_SETTINGS_LOCATOR" variant="ghost"
                                data-settings-locator={section.id}
                                aria-current={activeSection === section.id ? 'location' : undefined}
                                onClick={() => locateSection(section.id)}>
                                {t(section.key)}
                            </Button>
                        ))}
                    </nav>

                    <section class="IG_SETTINGS_CONTENT">
                        <div class="IG_SETTINGS_PAGE">
                            <SettingsSections data={data} language={language} t={t}
                                onLanguageChange={saveLanguage} onSettingChange={saveSetting}
                                onVolumeChange={saveVolume} onRenameFormatChange={saveRenameFormat} />
                            <KeyboardSettings data={data} conflict={conflict} t={t} onSave={saveHotkey} />
                            <SettingsSection id="about" title={t('SETTINGS_ABOUT')} description={t('SETTINGS_ABOUT_DESCRIPTION')}>
                                <div class="IG_SETTING_ROW">
                                    <div class="IG_SETTING_COPY">
                                        <span class="IG_SETTING_LABEL">{t('SETTINGS_VERSION')}</span>
                                    </div>
                                    <span class="IG_SETTING_VALUE">v{data.version}</span>
                                </div>
                            </SettingsSection>
                        </div>
                    </section>
                </div>
            )}
        </>
    );
}

function SettingsSections({ data, language, t, onLanguageChange, onSettingChange, onVolumeChange, onRenameFormatChange }) {
    return (
        <>
            <SettingsSection id="general" title={t('SETTINGS_GENERAL')} description={t('SETTINGS_GENERAL_DESCRIPTION')}>
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

            {settingsSections().map(section => (
                <SettingsSection key={section.id} id={section.id} title={t(section.key)} description={t(section.descriptionKey)}>
                    {section.settings.map(setting => (
                        <SettingRow key={setting.name} {...setting} data={data} t={t}
                            onSettingChange={onSettingChange} onVolumeChange={onVolumeChange}
                            onRenameFormatChange={onRenameFormatChange} />
                    ))}
                </SettingsSection>
            ))}
        </>
    );
}

function SettingsSection({ id, title, description, children }) {
    return (
        <section id={`settings-${id}`} class="IG_SETTINGS_SECTION" data-settings-section={id}>
            <header>
                <h2>{title}</h2>
                <p>{description}</p>
            </header>
            <div class="IG_SETTINGS_SECTION_BODY">{children}</div>
        </section>
    );
}

function SettingRow({ name, isChild, parentName, data, t, onSettingChange, onVolumeChange, onRenameFormatChange }) {
    const isDownloadMode = name === 'DIRECT_DOWNLOAD_MODE';
    const checked = Boolean(data.settings[name]);
    const disabled = isChild && parentName && !data.settings[parentName];
    const label = t(settingLabelKey(name));

    return (
        <div class={`IG_SETTING_ROW${isChild ? ' IG_SETTING_ROW_CHILD' : ''}${disabled ? ' IG_SETTING_ROW_DISABLED' : ''}`}>
            <div class="IG_SETTING_COPY">
                <label for={name}>{label}</label>
                <p>{settingDescription(t, name)}</p>
            </div>
            {isDownloadMode ? (
                <Select id={name} value={data.settings[name]} onValueChange={value => onSettingChange(name, value)} popoverAlign="end">
                    {Object.entries(DIRECT_DOWNLOAD_MODE_OPTIONS).map(([key, value]) => (
                        <option key={value} value={value}>{t(`DIRECT_DOWNLOAD_MODE_${key}`)}</option>
                    ))}
                </Select>
            ) : (
                <Switch id={name} checked={checked} disabled={disabled} aria-label={label}
                    onChange={event => onSettingChange(name, event.currentTarget.checked)} />
            )}
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
        <SettingsSection id="keyboard" title={t('SETTINGS_KEYBOARD')} description={t('SETTINGS_KEYBOARD_DESCRIPTION')}>
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
    );
}

function settingsSections() {
    return SETTINGS_SECTIONS.map(section => ({
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

function findActiveSection(content, sections) {
    const lastSection = sections.at(-1);
    if (content.scrollTop + content.clientHeight >= content.scrollHeight - 1) {
        return lastSection?.dataset.settingsSection ?? 'general';
    }

    const threshold = content.getBoundingClientRect().top + 32;
    return sections.reduce((active, section) => (
        section.getBoundingClientRect().top <= threshold ? section.dataset.settingsSection : active
    ), sections[0]?.dataset.settingsSection ?? 'general');
}

