import { render } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import { _i18n } from '../i18n';
import { Button, Checkbox, IconButton } from './components.jsx';
import { XIcon } from './icons.jsx';
import styles from './resource-picker.css?inline';

export const RESOURCE_PICKER_ROOT_ID = 'ig-helper-resource-picker-root';
const GLOBAL_PROPERTY_STYLE_ID = 'ig-helper-tailwind-properties';
const PROPERTY_RULE = /@property\s+--[\w-]+\s*\{[^{}]*\}/g;

export function openResourcePicker({ title, resources, onDownload }) {
    removeResourcePicker();

    const host = document.createElement('div');
    host.id = RESOURCE_PICKER_ROOT_ID;
    document.body.append(host);

    const shadow = host.attachShadow({ mode: 'open' });
    installStyles(shadow);
    render(<ResourcePicker title={title} resources={resources} onDownload={onDownload} />, shadow);
}

export function removeResourcePicker() {
    const host = document.getElementById(RESOURCE_PICKER_ROOT_ID);
    if (!host) return;
    render(null, host.shadowRoot);
    host.remove();
}

function installStyles(shadow) {
    const isolatedStyles = styles.replaceAll('--tw-', '--ih-tw-');
    const propertyRules = isolatedStyles.match(PROPERTY_RULE) ?? [];

    if (propertyRules.length > 0 && !document.getElementById(GLOBAL_PROPERTY_STYLE_ID)) {
        const globalStyle = document.createElement('style');
        globalStyle.id = GLOBAL_PROPERTY_STYLE_ID;
        globalStyle.textContent = propertyRules.join('\n');
        document.head.append(globalStyle);
    }

    const style = document.createElement('style');
    style.textContent = isolatedStyles.replace(PROPERTY_RULE, '');
    shadow.append(style);
}

function ResourcePicker({ title, resources, onDownload }) {
    const [selected, setSelected] = useState(() => new Set());

    const selectedResources = useMemo(
        () => resources.filter((_, index) => selected.has(index)),
        [resources, selected],
    );
    const allSelected = resources.length > 0 && selected.size === resources.length;
    const itemCount = _i18n(resources.length === 1 ? 'ITEM_COUNT_SINGULAR' : 'ITEM_COUNT_PLURAL')
        .replace('%COUNT%', resources.length);
    const selectedCount = _i18n(selected.size === 1 ? 'SELECTED_COUNT_SINGULAR' : 'SELECTED_COUNT_PLURAL')
        .replace('%COUNT%', selected.size);

    useEffect(() => {
        function onKeyDown(event) {
            if (event.key === 'Escape') removeResourcePicker();
        }

        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, []);

    function toggle(index) {
        setSelected(current => {
            const next = new Set(current);
            if (next.has(index)) next.delete(index);
            else next.add(index);
            return next;
        });
    }

    function toggleAll() {
        setSelected(allSelected ? new Set() : new Set(resources.map((_, index) => index)));
    }

    function downloadSelected() {
        if (selectedResources.length === 0) return;
        const resources = selectedResources;
        removeResourcePicker();
        void onDownload(resources);
    }

    return (
        <div class="resource-picker-backdrop" onClick={event => {
            if (event.target === event.currentTarget) removeResourcePicker();
        }}>
            <section class="resource-picker" role="dialog" aria-modal="true" aria-label={title}>
                <header class="resource-picker-header">
                    <div class="resource-picker-title">
                        <strong>{title}</strong>
                        <span>{itemCount}</span>
                    </div>
                    <IconButton icon={XIcon} label={_i18n('CLOSE')} onClick={removeResourcePicker} />
                </header>

                <div class="resource-picker-grid">
                    {resources.map((resource, index) => (
                        <article class="resource-picker-item" key={resource.mediaId ?? resource.index ?? index}>
                            <label>
                                <Checkbox checked={selected.has(index)} onChange={() => toggle(index)}
                                    aria-label={`${resource.label} ${index + 1}`} />
                                <img src={resource.preview} alt="" />
                                <span class="resource-picker-item-meta">
                                    <span>{resource.label}</span>
                                    <span>{index + 1}</span>
                                </span>
                            </label>
                        </article>
                    ))}
                </div>

                <footer class="resource-picker-footer">
                    <Button variant="outline" onClick={toggleAll}>{_i18n('ALL_CHECK')}</Button>
                    <span class="resource-picker-count">{selectedCount}</span>
                    <Button variant="primary" disabled={selected.size === 0} onClick={downloadSelected}>
                        {_i18n('BATCH_DOWNLOAD_SELECTED')} ({selected.size})
                    </Button>
                </footer>
            </section>
        </div>
    );
}
