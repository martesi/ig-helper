import htm from 'htm';
import { h, render } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { locale_manifest, PARENT_CHILD_MAPPING, state, SVG, USER_SETTING } from '../settings';
import { _i18n } from './i18n';

const SETTINGS_ROOT_ID = 'ig-helper-settings-root';
const html = htm.bind(h);

export function showSettingsDialog() {
    closeSettingsDialog();
    document.querySelectorAll('.IG_POPUP_DIG').forEach(dialog => dialog.remove());

    const root = document.createElement('div');
    root.id = SETTINGS_ROOT_ID;
    document.body.append(root);
    render(html`<${SettingsDialog} />`, root);
}

export function closeSettingsDialog() {
    const root = document.getElementById(SETTINGS_ROOT_ID);
    if (!root) return;
    render(null, root);
    root.remove();
}

function SettingsDialog() {
    const dialogRef = useRef(null);
    const [editor, setEditor] = useState(null);

    useEffect(() => {
        const dialog = dialogRef.current;
        dialog.showModal();
        return () => {
            if (dialog.open) dialog.close();
        };
    }, []);

    function closeFromBackdrop(event) {
        if (event.target === event.currentTarget) closeSettingsDialog();
    }

    function openEditor(event, name) {
        if (name !== 'AUTO_RENAME' && name !== 'MODIFY_VIDEO_VOLUME') return;
        event.preventDefault();
        setEditor(name);
    }

    return html`
        <dialog ref=${dialogRef} class="IG_POPUP_DIG IG_SETTINGS_DIALOG"
            aria-labelledby="ig-settings-title" onClick=${closeFromBackdrop}
            onCancel=${event => { event.preventDefault(); closeSettingsDialog(); }}>
            <div class="IG_POPUP_DIG_MAIN IG_SETTINGS_PANEL" onClick=${event => event.stopPropagation()}>
                <header class="IG_POPUP_DIG_TITLE IG_SETTINGS_HEADER">
                    <div>
                        <h2 id="ig-settings-title">${_i18n('SETTING')}</h2>
                        <div id="post_info">Preference Settings</div>
                    </div>
                    <button type="button" class="IG_SETTINGS_CLOSE" aria-label=${_i18n('CLOSE')}
                        dangerouslySetInnerHTML=${{ __html: SVG.CLOSE }} onClick=${closeSettingsDialog} />
                </header>
                <div class="IG_SETTINGS_LANGUAGE">
                    <label for="langSelect">Language</label>
                    <select id="langSelect" value=${state.lang}>
                        ${Object.entries(locale_manifest).map(([value, label]) => html`
                            <option value=${value}>${label}</option>
                        `)}
                    </select>
                    <p>Some translations are machine-generated and may be inaccurate.</p>
                </div>
                <div class="IG_POPUP_DIG_BODY IG_SETTINGS_LIST">
                    ${orderedSettings().map(({ name, isChild }) => html`
                        <label class=${`globalSettings${isChild ? ' child' : ''}`}
                            title=${_i18n(`${name}_INTRO`)} data-ih-locale-title=${`${name}_INTRO`}
                            onContextMenu=${event => openEditor(event, name)}>
                            <span data-ih-locale=${name}>${_i18n(name)}</span>
                            <input id=${name} value="box" type="checkbox" checked=${USER_SETTING[name]} />
                            <span class="chbtn" aria-hidden="true"><span class="rounds" /></span>
                            ${editor === name && html`<${SettingEditor} name=${name} onClose=${() => setEditor(null)} />`}
                        </label>
                    `)}
                </div>
            </div>
        </dialog>
    `;
}

function SettingEditor({ name, onClose }) {
    function stopRowToggle(event) {
        event.preventDefault();
        event.stopPropagation();
    }

    function closeEditor(event) {
        stopRowToggle(event);
        onClose();
    }

    return html`
        <span id="tempWrapper" class="IG_SETTINGS_EDITOR" onClick=${event => event.stopPropagation()}>
            ${name === 'MODIFY_VIDEO_VOLUME' ? html`
                <input aria-label="Video volume" value=${state.videoVolume}
                    type="range" min="0" max="1" step="0.05" />
                <input aria-label="Video volume value" value=${state.videoVolume}
                    type="number" min="0" max="1" step="0.05" />
            ` : html`
                <input id="date_format" aria-label="File rename format" value=${state.fileRenameFormat} />
            `}
            <button type="button" class="IG_SETTINGS_INLINE_CLOSE" aria-label=${_i18n('CLOSE')}
                dangerouslySetInnerHTML=${{ __html: SVG.CLOSE }} onClick=${closeEditor} />
        </span>
    `;
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
