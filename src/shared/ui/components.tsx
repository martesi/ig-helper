import { isValidElement, toChildArray } from 'preact';
import type { ComponentChildren, ComponentType, JSX } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';

type ButtonProps = JSX.IntrinsicElements['button'] & { variant?: string; size?: string };
type InputProps = JSX.IntrinsicElements['input'];

export function Button({ class: className = '', variant = 'secondary', size = 'default', ...props }: ButtonProps) {
    return <button type="button" class={`btn ${className}`.trim()} data-variant={variant} data-size={size} {...props} />;
}

export function IconButton({ class: className = '', icon: Icon, label, title = label, ...props }: ButtonProps & {
    icon: ComponentType<JSX.SVGAttributes<SVGSVGElement>>; label: string; title?: string;
}) {
    return (
        <Button class={`IG_ICON_BUTTON ${className}`.trim()} variant="ghost" size="icon-sm"
            aria-label={label} title={title} {...props}>
            <Icon aria-hidden="true" />
        </Button>
    );
}

export function ControlBar({ class: className = '', children, ...props }: JSX.IntrinsicElements['div']) {
    return <div class={`IG_CONTROL_BAR ${className}`.trim()} {...props}>{children}</div>;
}

export function Input({ class: className = '', type = 'text', ...props }: InputProps) {
    return <input type={type} class={`input ${className}`.trim()} {...props} />;
}

export function Checkbox({ class: className = '', ...props }: InputProps) {
    return <input type="checkbox" class={`input ${className}`.trim()} {...props} />;
}

export function Switch({ class: className = '', ...props }: InputProps) {
    return <input type="checkbox" role="switch" class={`input ${className}`.trim()} {...props} />;
}

export function Select({ class: className = '', children, id, value, onValueChange, popoverAlign = 'start', ...props }: {
    class?: string; children: ComponentChildren; id: string; value: string | number;
    onValueChange?: (value: string | number) => void; popoverAlign?: 'start' | 'end';
} & Omit<JSX.IntrinsicElements['div'], 'children' | 'id'>) {
    const rootRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const [open, setOpen] = useState(false);
    const options = toChildArray(children).filter(isValidElement).flatMap(option => {
        if (!('value' in option.props)) return [];
        const { value, children } = option.props;
        return typeof value === 'string' || typeof value === 'number' ? [{ value, children }] : [];
    });
    const selectedIndex = Math.max(0, options.findIndex(option => String(option.value) === String(value)));
    const [activeIndex, setActiveIndex] = useState(selectedIndex);
    const selected = options[selectedIndex];
    const listboxId = `${id}-listbox`;

    useEffect(() => {
        if (!open) return undefined;
        const eventRoot = rootRef.current?.getRootNode();
        if (!eventRoot) return undefined;

        function closeFromOutside(event: Event) {
            if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false);
        }

        eventRoot.addEventListener('pointerdown', closeFromOutside);
        return () => eventRoot.removeEventListener('pointerdown', closeFromOutside);
    }, [open]);

    useEffect(() => {
        if (!open) return;
        rootRef.current?.querySelector(`[data-option-index="${activeIndex}"]`)?.scrollIntoView({ block: 'nearest' });
    }, [activeIndex, open]);

    function openAt(index: number = selectedIndex) {
        setActiveIndex(index);
        setOpen(true);
    }

    function selectIndex(index: number) {
        const option = options[index];
        if (!option) return;
        onValueChange?.(option.value);
        setOpen(false);
        triggerRef.current?.focus();
    }

    function handleKeyDown(event: JSX.TargetedKeyboardEvent<HTMLButtonElement>) {
        if (event.key === 'Escape') {
            if (!open) return;
            event.preventDefault();
            setOpen(false);
            return;
        }

        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            const direction = event.key === 'ArrowDown' ? 1 : -1;
            const next = (activeIndex + direction + options.length) % options.length;
            if (open) setActiveIndex(next);
            else openAt((selectedIndex + direction + options.length) % options.length);
            return;
        }

        if (event.key === 'Home' || event.key === 'End') {
            event.preventDefault();
            const index = event.key === 'Home' ? 0 : options.length - 1;
            if (open) setActiveIndex(index);
            else openAt(index);
            return;
        }

        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        if (open) selectIndex(activeIndex);
        else openAt();
    }

    return (
        <div ref={rootRef} id={id} class={`select ${className}`.trim()} {...props}>
            <button ref={triggerRef} id={`${id}-trigger`} type="button" role="combobox" aria-haspopup="listbox" aria-expanded={open}
                aria-controls={listboxId} aria-activedescendant={open ? `${id}-option-${activeIndex}` : undefined}
                onClick={() => open ? setOpen(false) : openAt()} onKeyDown={handleKeyDown}>
                <span class="truncate">{selected?.children}</span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                    stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="m6 9 6 6 6-6" />
                </svg>
            </button>
            <div class="scrollbar-sm" data-popover data-align={popoverAlign} aria-hidden={!open}>
                <div role="listbox" id={listboxId} aria-orientation="vertical" aria-labelledby={`${id}-trigger`}>
                    {options.map((option, index) => {
                        const isSelected = String(option.value) === String(value);
                        return (
                            <div key={option.value} id={`${id}-option-${index}`} role="option"
                                data-value={option.value} data-option-index={index}
                                aria-selected={isSelected}
                                class={open && index === activeIndex ? 'active' : ''}
                                onMouseEnter={() => setActiveIndex(index)} onClick={() => selectIndex(index)}>
                                {option.children}
                            </div>
                        );
                    })}
                </div>
            </div>
            <input id={`${id}-value`} type="hidden" value={value} readOnly />
        </div>
    );
}

export function Textarea({ class: className = '', ...props }: JSX.IntrinsicElements['textarea']) {
    return <textarea class={`textarea ${className}`.trim()} {...props} />;
}
