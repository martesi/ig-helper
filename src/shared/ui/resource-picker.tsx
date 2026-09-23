import { render } from 'preact';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { _i18n } from '../i18n';
import { logger } from '../logger';
import { Button, Checkbox, IconButton } from './components.tsx';
import { XIcon } from './icons.tsx';
import { adoptShadowStyles } from './shadow-styles.ts';
import styles from './resource-picker.css?inline';

export const RESOURCE_PICKER_ROOT_ID = 'ig-helper-resource-picker-root';

export interface ResourcePickerItem {
    mediaId?: string | null;
    index?: number;
    preview?: string;
    label: string;
    element: HTMLAnchorElement;
}

interface ResourcePickerProps {
    title: string;
    resources: ResourcePickerItem[];
    onDownload: (selected: ResourcePickerItem[]) => void | Promise<unknown>;
    returnFocus?: Element | null;
}

export function openResourcePicker({ title, resources, onDownload }: Omit<ResourcePickerProps, 'returnFocus'>) {
    removeResourcePicker();

    const host = document.createElement('div');
    host.id = RESOURCE_PICKER_ROOT_ID;
    document.body.append(host);

    const shadow = host.attachShadow({ mode: 'open' });
    adoptShadowStyles(shadow, styles);
    render(<ResourcePicker title={title} resources={resources} onDownload={onDownload} returnFocus={document.activeElement} />, shadow);
}

export function removeResourcePicker() {
    const host = document.getElementById(RESOURCE_PICKER_ROOT_ID);
    if (!host) return;
    if (host.shadowRoot) render(null, host.shadowRoot);
    host.remove();
}

function ResourcePicker({ title, resources, onDownload, returnFocus }: ResourcePickerProps) {
    const dialogRef = useRef<HTMLElement>(null);
    const [selected, setSelected] = useState<Set<number>>(() => new Set());

    const selectedResources = resources.filter((_, index) => selected.has(index));
    const allSelected = resources.length > 0 && selected.size === resources.length;
    const itemCount = _i18n(resources.length === 1 ? 'ITEM_COUNT_SINGULAR' : 'ITEM_COUNT_PLURAL')
        .replace('%COUNT%', String(resources.length));
    const selectedCount = _i18n(selected.size === 1 ? 'SELECTED_COUNT_SINGULAR' : 'SELECTED_COUNT_PLURAL')
        .replace('%COUNT%', String(selected.size));

    useLayoutEffect(() => {
        dialogRef.current?.focus();
        return () => {
            if (returnFocus instanceof HTMLElement && returnFocus.isConnected) returnFocus.focus();
        };
    }, [returnFocus]);

    useEffect(() => {
        function onKeyDown(event: KeyboardEvent) {
            if (event.key === 'Escape') {
                removeResourcePicker();
                return;
            }
            if (event.key !== 'Tab') return;

            const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(
                'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
            ) ?? []);
            if (focusable.length === 0) {
                event.preventDefault();
                return;
            }

            const root = dialogRef.current?.getRootNode();
            const active = root instanceof ShadowRoot ? root.activeElement : document.activeElement;
            const activeIndex = focusable.findIndex(element => element === active);
            if (activeIndex < 0) {
                event.preventDefault();
                (event.shiftKey ? focusable.at(-1) : focusable[0])?.focus();
            } else if (event.shiftKey && activeIndex === 0) {
                event.preventDefault();
                focusable.at(-1)?.focus();
            } else if (!event.shiftKey && activeIndex === focusable.length - 1) {
                event.preventDefault();
                focusable[0]?.focus();
            }
        }

        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, []);

    function toggle(index: number) {
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
        void Promise.resolve().then(() => onDownload(resources)).catch(reason => {
            logger('resourcePicker.download.failed', reason);
            alert('The selected media could not be downloaded. Please try again.');
        });
    }

    return (
        <div class="resource-picker-backdrop" onClick={event => {
            if (event.target === event.currentTarget) removeResourcePicker();
        }}>
            <section ref={dialogRef} class="resource-picker" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}>
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
                                <img src={resource.preview ?? ''} alt="" />
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
