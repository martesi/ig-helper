import { render } from 'preact';
import { Button } from './components.jsx';

export function appendLegacyControl(parent, { className, label, labelKey, icon }) {
    const fragment = document.createDocumentFragment();
    render(
        <Button class={`IG_LEGACY_CONTROL ${className}`} variant="ghost" size="icon-sm"
            data-ih-locale-title={labelKey} title={label} aria-label={label}
            dangerouslySetInnerHTML={{ __html: icon }} />,
        fragment,
    );
    const control = fragment.firstChild;
    parent.append(control);
    return control;
}

export function appendReelScrollControls(parent) {
    const fragment = document.createDocumentFragment();
    render(
        <section id="scrollWrapper">
            <div class="button-up"><div /></div>
            <div class="button-down"><div /></div>
        </section>,
        fragment,
    );
    const controls = fragment.firstChild;
    parent.append(controls);
    return controls;
}
