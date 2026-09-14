import { h, toChildArray } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import 'basecoat-css/basecoat';
import 'basecoat-css/select';

window.basecoat?.start();

export function Button({ class: className = '', variant = 'secondary', size = 'default', ...props }) {
    return <button type="button" class={`btn ${className}`.trim()} data-variant={variant} data-size={size} {...props} />;
}

export function IconButton({ class: className = '', icon: Icon, label, title = label, ...props }) {
    return (
        <Button class={`IG_ICON_BUTTON ${className}`.trim()} variant="ghost" size="icon-sm"
            aria-label={label} title={title} {...props}>
            <Icon aria-hidden="true" />
        </Button>
    );
}

export function ControlBar({ class: className = '', children, ...props }) {
    return <div class={`IG_CONTROL_BAR ig-helper-ui ${className}`.trim()} {...props}>{children}</div>;
}

export function Input({ class: className = '', type = 'text', ...props }) {
    return <input type={type} class={`input ${className}`.trim()} {...props} />;
}

export function Checkbox({ class: className = '', ...props }) {
    return <input type="checkbox" class={`input ${className}`.trim()} {...props} />;
}

export function Switch({ class: className = '', ...props }) {
    return <input type="checkbox" role="switch" class={`input ${className}`.trim()} {...props} />;
}

export function Select({ class: className = '', children, id, value, onChange, ...props }) {
    const rootRef = useRef(null);
    const options = toChildArray(children).filter(Boolean);
    const selected = options.find(option => String(option.props.value) === String(value)) ?? options[0];
    const rootId = `${id}-select`;
    const listboxId = `${id}-listbox`;

    useEffect(() => {
        rootRef.current?.refresh?.();
    }, [value]);

    return (
        <div ref={rootRef} id={rootId} class={`select IG_SELECT ${className}`.trim()} onChange={onChange} {...props}>
            <button id={id} type="button" aria-haspopup="listbox" aria-expanded="false" aria-controls={listboxId}>
                <span class="truncate">{selected?.props.children}</span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                    stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="m6 9 6 6 6-6" />
                </svg>
            </button>
            <div data-popover aria-hidden="true">
                <div role="listbox" id={listboxId} aria-orientation="vertical" aria-labelledby={id}>
                    {options.map((option, index) => (
                        <div id={`${id}-option-${index}`} role="option" data-value={option.props.value}
                            aria-selected={String(option.props.value) === String(value) ? 'true' : undefined}>
                            {option.props.children}
                        </div>
                    ))}
                </div>
            </div>
            <input type="hidden" value={value} />
        </div>
    );
}
