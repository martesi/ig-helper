import { logger } from "./logger";

/**
 * triggerReactClickHandler
 * @description Trigger React onClick event handler for the given element.
 *
 * @param {HTMLElement} el 
 */
export function triggerReactClickHandler(el: HTMLElement | undefined): void {
    if (!el) return;
    const reactKey = Object.keys(el).find(k => k.startsWith('__reactProps') || k.startsWith('__reactEventHandlers'));
    if (!reactKey) return;
    const props: unknown = (el as unknown as Record<string, unknown>)[reactKey];

    if (props && typeof props === 'object' && 'onClick' in props && typeof props.onClick === 'function') {
        const mockEvent = {
            target: el,
            currentTarget: el,
            preventDefault: () => { },
            stopPropagation: () => { },
            nativeEvent: new MouseEvent('click')
        };

        props.onClick(mockEvent);
    } else {
        logger('No React click handler found for the element:', el);
    }
};
