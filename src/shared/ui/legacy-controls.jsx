import { render } from 'preact';
export function appendLegacyControl(parent, { className, label, labelKey, icon }) {
    const fragment = document.createDocumentFragment();
    render(
        <button type="button" class={`IG_LEGACY_CONTROL ${className}`}
            data-ih-locale-title={labelKey} title={label} aria-label={label}
            dangerouslySetInnerHTML={{ __html: icon }} />,
        fragment,
    );
    const control = fragment.firstChild;
    parent.append(control);
    return control;
}
