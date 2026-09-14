import { h } from 'preact';

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

export function Select({ class: className = '', children, ...props }) {
    return <select class={`select ${className}`.trim()} {...props}>{children}</select>;
}
