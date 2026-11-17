import { render } from 'preact';
import type { JSX } from 'preact';
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { SVG, USER_SETTING } from '../../settings/state';
import { _i18n } from '../../shared/i18n';
import { Button } from '../../shared/ui/components.tsx';
import { CheckIcon, CopyIcon } from '../../shared/ui/icons.tsx';
import { adoptShadowStyles } from '../../shared/ui/shadow-styles.ts';
import { clampScale, computeMenuPlacement } from './menu-position.ts';
import styles from './controls.css?inline';

interface MediaControlOptions {
    showDownloadAll?: boolean;
    showMediaPreview?: boolean;
    showOpenInNewTab?: boolean;
    showCopy?: boolean;
    mediaType?: 'image' | 'video';
    /** Opt-in (posts only): keep the download button visible and tuck the other controls into a menu. */
    collapsible?: boolean;
    actions?: {
        thumbnail?: () => unknown; view?: () => unknown; newTab?: () => unknown;
        copy?: () => unknown; downloadAll?: () => unknown; download?: () => unknown;
    };
}

interface MediaControlsProps {
    showDownloadAll: boolean;
    showMediaPreview: boolean;
    showOpenInNewTab: boolean;
    showCopy: boolean;
    mediaType: 'image' | 'video';
    collapsible: boolean;
    actions: NonNullable<MediaControlOptions['actions']>;
    renderVersion: number;
}

type SecondaryProps = Pick<MediaControlsProps, 'showDownloadAll' | 'showMediaPreview' | 'showOpenInNewTab' | 'showCopy' | 'mediaType' | 'actions'>;

interface SecondaryItem {
    key: string;
    className: string;
    labelKey: string;
    icon?: string;
    onClick?: () => unknown;
}

interface MenuState {
    open: boolean;
    activeIndex: number;
    onMenuClose: (delay?: number) => void;
    onActive: (index: number) => void;
}

type MenuFocusTarget = 'first' | 'last' | null;

const HOVER_OPEN_DELAY = 120;
const HOVER_CLOSE_DELAY = 220;
const LONG_PRESS_DELAY = 480;
const LONG_PRESS_MOVE_TOLERANCE = 10;
const SUPPRESS_CLICK_RESET_DELAY = 700;
const COPY_CONFIRM_VISIBLE_DELAY = 1500;
const COPY_MENU_CLOSE_DELAY = 900;
const MENU_GAP = 6;
const VIEWPORT_MARGIN = 8;
const POSITION_REFINE_DELAY = 160;
// Below this fraction of the viewport the menu prefers to open upward, so it does
// not cover the caption/comment area under the post's action row.
const LOWER_THIRD = 2 / 3;

const renderVersions = new WeakMap<ShadowRoot, number>();

export function mountPostControls(mount: HTMLElement, options: MediaControlOptions = {}) {
    mountMediaControls(mount, { collapsible: true, ...options });
}

export function mountMediaControls(mount: HTMLElement, {
    showDownloadAll = false,
    showMediaPreview = USER_SETTING.SHOW_MEDIA_PREVIEW,
    showOpenInNewTab = USER_SETTING.SHOW_OPEN_IN_NEW_TAB_BUTTON,
    showCopy = true,
    mediaType = 'image',
    collapsible = false,
    actions = {},
}: MediaControlOptions = {}) {
    const root = mount.shadowRoot ?? mount.attachShadow({ mode: 'open' });
    adoptShadowStyles(root, styles);
    const renderVersion = (renderVersions.get(root) ?? 0) + 1;
    renderVersions.set(root, renderVersion);
    render(<MediaControls
        showDownloadAll={showDownloadAll}
        showMediaPreview={showMediaPreview}
        showOpenInNewTab={showOpenInNewTab}
        showCopy={showCopy}
        mediaType={mediaType}
        collapsible={collapsible}
        actions={actions}
        renderVersion={renderVersion}
    />, root);
}


function MediaControls(props: MediaControlsProps) {
    if (props.collapsible) return <CollapsibleControls {...props} />;

    return (
        <>
            <SecondaryControls items={getSecondaryItems(props)} />
            <ControlButton class="IG_DW_MAIN" labelKey="DW" icon={SVG.DOWNLOAD} onClick={props.actions.download} />
        </>
    );
}

function SecondaryControls({ items, menu }: { items: SecondaryItem[]; menu?: MenuState }) {
    return (
        <>
            {items.map((item, index) => {
                const menuProps: Partial<{
                    role: 'menuitem'; tabIndex: number; showLabel: boolean;
                    onMenuClose: (delay?: number) => void; onFocus: () => void;
                }> = menu ? {
                    role: 'menuitem',
                    tabIndex: menu.open && menu.activeIndex === index ? 0 : -1,
                    showLabel: true,
                    onMenuClose: menu.onMenuClose,
                    onFocus: () => menu.onActive(index),
                } : {};

                return item.icon
                    ? <ControlButton key={item.key} class={item.className} labelKey={item.labelKey} icon={item.icon} onClick={item.onClick} {...menuProps} />
                    : <CopyControlButton key={item.key} labelKey={item.labelKey} onClick={item.onClick} {...menuProps} />;
            })}
        </>
    );
}

function getSecondaryItems({ showDownloadAll, showMediaPreview, showOpenInNewTab, showCopy, mediaType, actions }: SecondaryProps): SecondaryItem[] {
    const items: SecondaryItem[] = [];

    if (mediaType === 'video') {
        items.push({ key: 'thumbnail', className: 'IG_THUMBNAIL_MAIN', labelKey: 'VIDEO_THUMBNAIL', icon: SVG.THUMBNAIL, onClick: actions.thumbnail });
    } else if (showMediaPreview) {
        items.push({ key: 'viewer', className: 'IG_IMAGE_VIEWER', labelKey: 'IMAGE_VIEWER', icon: SVG.FULLSCREEN, onClick: actions.view });
    }
    if (showOpenInNewTab) {
        items.push({ key: 'newTab', className: 'IG_NEWTAB_MAIN', labelKey: 'NEW_TAB', icon: SVG.NEW_TAB, onClick: actions.newTab });
    }
    if (showCopy) {
        items.push({ key: 'copy', className: 'IG_COPY_MAIN', labelKey: 'COPY_MEDIA', onClick: actions.copy });
    }
    if (showDownloadAll) {
        items.push({ key: 'downloadAll', className: 'IG_DW_ALL_MAIN', labelKey: 'DW_ALL', icon: SVG.DOWNLOAD_ALL, onClick: actions.downloadAll });
    }

    return items;
}


function CollapsibleControls(props: MediaControlsProps) {
    const { actions, renderVersion } = props;
    const items = getSecondaryItems(props);
    const hasItems = items.length > 0;
    const [open, setOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(0);
    const shellRef = useRef<HTMLSpanElement>(null);
    const menuRef = useRef<HTMLSpanElement>(null);
    const openTimer = useRef<number | null>(null);
    const closeTimer = useRef<number | null>(null);
    const longPressTimer = useRef<number | null>(null);
    const suppressTimer = useRef<number | null>(null);
    const pressStart = useRef<{ x: number; y: number } | null>(null);
    const suppressClick = useRef(false);
    const longPressFired = useRef(false);
    const lastPointerType = useRef('');
    const focusOnOpen = useRef<MenuFocusTarget>(null);
    const versionRef = useRef(renderVersion);
    const menuSession = useRef(0);
    const appliedPosition = useRef(false);
    const menuId = useId();

    function getTrigger() {
        return shellRef.current?.querySelector<HTMLButtonElement>('.IG_DW_MAIN') ?? null;
    }

    function getMenuItems() {
        return Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? []);
    }

    function clearOpenTimer() {
        if (openTimer.current !== null) window.clearTimeout(openTimer.current);
        openTimer.current = null;
    }

    function clearCloseTimer() {
        if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
        closeTimer.current = null;
    }

    function clearLongPress() {
        if (longPressTimer.current !== null) window.clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
        pressStart.current = null;
    }

    function clearSuppressTimer() {
        if (suppressTimer.current !== null) window.clearTimeout(suppressTimer.current);
        suppressTimer.current = null;
    }

    function hideMenu(resetPress = true) {
        clearOpenTimer();
        clearCloseTimer();
        focusOnOpen.current = null;
        setOpen(false);
        if (!resetPress) return;
        clearLongPress();
        clearSuppressTimer();
        longPressFired.current = false;
        suppressClick.current = false;
    }

    function closeMenu(restoreFocus = false) {
        hideMenu();
        if (restoreFocus) {
            getTrigger()?.focus();
            return;
        }
        const active = deepActiveElement();
        if (active && menuRef.current?.contains(active)) getTrigger()?.focus();
    }

    function showMenu(focus: MenuFocusTarget = null) {
        menuSession.current += 1;
        appliedPosition.current = false;
        focusOnOpen.current = focus;
        setActiveIndex(focus === 'last' ? Math.max(0, items.length - 1) : 0);
        setOpen(true);
    }

    /** Only a focused menu item keeps the menu alive; a focused trigger must not. */
    function isMenuFocusInside() {
        const menu = menuRef.current;
        const active = deepActiveElement();
        return Boolean(menu && active && menu.contains(active));
    }

    /** `contains` does not cross shadow roots, so compare roots as well. */
    function isInsideShell(node: Node | null | undefined) {
        const shell = shellRef.current;
        if (!shell || !node) return false;
        if (node === shell || shell.contains(node)) return true;
        return node.getRootNode() === shell.getRootNode();
    }

    function isFocusInsideShell() {
        return isInsideShell(deepActiveElement());
    }

    function scheduleOpen(event: JSX.TargetedPointerEvent<HTMLSpanElement>) {
        if (!isHoverPointer(event)) return;
        clearCloseTimer();
        if (!hasItems || open || openTimer.current !== null) return;
        openTimer.current = window.setTimeout(() => {
            openTimer.current = null;
            showMenu();
        }, HOVER_OPEN_DELAY);
    }

    function scheduleClose(event: JSX.TargetedPointerEvent<HTMLSpanElement>) {
        if (!isHoverPointer(event)) return;
        // A keyboard user is using the menu; pointer drift must not dismiss it.
        if (isMenuFocusInside()) return;
        clearOpenTimer();
        if (closeTimer.current !== null) return;
        closeTimer.current = window.setTimeout(() => {
            closeTimer.current = null;
            if (isMenuFocusInside()) return;
            closeMenu();
        }, HOVER_CLOSE_DELAY);
    }

    /** Gallery-style close: actions can defer closing (copy feedback) without racing a reopened menu. */
    function selectMenuItem(delay = 0) {
        const session = menuSession.current;
        const close = () => {
            if (menuSession.current !== session) return;
            closeMenu();
        };
        if (delay > 0) window.setTimeout(close, delay);
        else close();
    }

    function updatePosition() {
        const trigger = getTrigger();
        const menu = menuRef.current;
        if (!trigger || !menu) return;
        if (!trigger.isConnected) {
            hideMenu();
            return;
        }

        const triggerRect = trigger.getBoundingClientRect();
        const measuredMenuRect = menu.getBoundingClientRect();
        const scaleX = menu.offsetWidth > 0 ? clampScale(measuredMenuRect.width / menu.offsetWidth) : 1;
        const scaleY = menu.offsetHeight > 0 ? clampScale(measuredMenuRect.height / menu.offsetHeight) : 1;
        // The trigger has no hover transform, so its ratio reflects ancestor scaling without
        // including the menu's entry animation. Keeping this stable avoids resize-observer churn.
        const ancestorScaleX = trigger.offsetWidth > 0 ? clampScale(triggerRect.width / trigger.offsetWidth) : scaleX;
        const ancestorScaleY = trigger.offsetHeight > 0 ? clampScale(triggerRect.height / trigger.offsetHeight) : scaleY;
        const maxWidthPx = Math.floor(Math.max(0, window.innerWidth - VIEWPORT_MARGIN * 2) / ancestorScaleX);
        const maxHeightPx = Math.floor(Math.max(0, window.innerHeight - VIEWPORT_MARGIN * 2) / ancestorScaleY);
        const maxWidth = `${maxWidthPx}px`;
        const maxHeight = `${maxHeightPx}px`;
        const minWidth = `${Math.min(44, maxWidthPx)}px`;
        if (menu.style.minWidth !== minWidth) menu.style.minWidth = minWidth;
        if (menu.style.maxWidth !== maxWidth) menu.style.maxWidth = maxWidth;
        if (menu.style.maxHeight !== maxHeight) menu.style.maxHeight = maxHeight;

        const menuRect = menu.getBoundingClientRect();
        // Use the painted size: an ancestor transform scales the visual box even though
        // offsetWidth/Height stay unscaled, and the two must not be mixed.
        const width = menuRect.width || menu.offsetWidth;
        const height = menuRect.height || menu.offsetHeight;
        const { top, left, above } = computeMenuPlacement(
            { top: triggerRect.top, bottom: triggerRect.bottom, right: triggerRect.right, height: triggerRect.height },
            { width, height },
            { width: window.innerWidth, height: window.innerHeight },
            { gap: MENU_GAP, margin: VIEWPORT_MARGIN, lowerThird: LOWER_THIRD },
        );

        const placement = above ? 'top' : 'bottom';
        if (menu.dataset.placement !== placement) menu.dataset.placement = placement;

        // The fixed coordinates map through any transformed ancestor, so converge on the
        // intended viewport position across frames. Divide by the painted/CSS scale so a
        // scaled (or zoomed) ancestor cannot overshoot or oscillate.
        const applied = appliedPosition.current
            ? { left: parseFloat(menu.style.left), top: parseFloat(menu.style.top) }
            : { left: 0, top: 0 };
        const dx = (left - menuRect.left) / scaleX;
        const dy = (top - menuRect.top) / scaleY;
        if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) {
            if (!appliedPosition.current) {
                menu.style.left = `${left}px`;
                menu.style.top = `${top}px`;
                appliedPosition.current = true;
            }
            return;
        }

        menu.style.left = `${applied.left + dx}px`;
        menu.style.top = `${applied.top + dy}px`;
        appliedPosition.current = true;
    }

    function focusItemAt(index: number) {
        const elements = getMenuItems();
        if (elements.length === 0) return;
        const next = Math.max(0, Math.min(index, elements.length - 1));
        setActiveIndex(next);
        focusElement(elements[next]);
    }

    /** The menu's visibility transition lags its open state, so poll until it is actually focusable. */
    function focusElement(element: HTMLElement | undefined) {
        const menu = menuRef.current;
        if (!element || !menu) return;
        let attempts = 0;

        const attempt = () => {
            if (!element.isConnected || menu.getAttribute('data-open') !== 'true') return;
            const visible = getComputedStyle(menu).visibility === 'visible';
            if (visible) element.focus();
            if (visible && deepActiveElement() === element) return;
            if (attempts >= 30) return;
            attempts += 1;
            window.requestAnimationFrame(attempt);
        };

        attempt();
    }

    function handleTriggerKeyDown(event: JSX.TargetedKeyboardEvent<HTMLButtonElement>) {
        if (event.key === 'Enter' || event.key === ' ') {
            suppressClick.current = false;
            clearSuppressTimer();
        }
        if (!hasItems) return;
        if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
        event.preventDefault();
        if (open) {
            focusItemAt(event.key === 'ArrowUp' ? items.length - 1 : 0);
            return;
        }
        showMenu(event.key === 'ArrowUp' ? 'last' : 'first');
    }

    function handleTriggerFocus() {
        if (!hasItems || open) return;
        if (!getTrigger()?.matches(':focus-visible')) return;
        showMenu();
    }

    function handleTriggerPointerDown(event: JSX.TargetedPointerEvent<HTMLButtonElement>) {
        lastPointerType.current = event.pointerType;
        suppressClick.current = false;
        clearSuppressTimer();
        clearLongPress();
        if (!isTouchPointer(event)) return;
        if (!hasItems) return;
        pressStart.current = { x: event.clientX, y: event.clientY };
        longPressTimer.current = window.setTimeout(() => {
            longPressTimer.current = null;
            pressStart.current = null;
            if (open) hideMenu(false);
            else showMenu();
            suppressClick.current = true;
            longPressFired.current = true;
        }, LONG_PRESS_DELAY);
    }

    function handleTriggerPointerMove(event: JSX.TargetedPointerEvent<HTMLButtonElement>) {
        const start = pressStart.current;
        if (!start || longPressTimer.current === null) return;
        if (Math.hypot(event.clientX - start.x, event.clientY - start.y) <= LONG_PRESS_MOVE_TOLERANCE) return;
        clearLongPress();
    }

    function handleTriggerPointerEnd() {
        const fired = longPressFired.current;
        longPressFired.current = false;
        clearLongPress();
        if (!fired) return;
        clearSuppressTimer();
        suppressTimer.current = window.setTimeout(() => {
            suppressTimer.current = null;
            suppressClick.current = false;
        }, SUPPRESS_CLICK_RESET_DELAY);
    }

    function handleTriggerClickCapture(event: JSX.TargetedMouseEvent<HTMLButtonElement>) {
        if (!suppressClick.current) return;
        suppressClick.current = false;
        clearSuppressTimer();
        event.preventDefault();
        event.stopImmediatePropagation();
    }

    function handleContextMenu(event: JSX.TargetedMouseEvent<HTMLSpanElement>) {
        if (lastPointerType.current !== 'touch' && lastPointerType.current !== 'pen') return;
        event.preventDefault();
        event.stopPropagation();
    }

    function handleFocusOut(event: JSX.TargetedFocusEvent<HTMLSpanElement>) {
        if (isInsideShell(event.relatedTarget as Node | null)) return;
        hideMenu();
    }

    function handleMenuKeyDown(event: JSX.TargetedKeyboardEvent<HTMLSpanElement>) {
        if (event.key === 'Tab') {
            hideMenu();
            return;
        }
        if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp' && event.key !== 'Home' && event.key !== 'End') return;
        const elements = getMenuItems();
        if (elements.length === 0) return;
        event.preventDefault();
        const target = (event.target as HTMLElement).closest<HTMLElement>('[role="menuitem"]');
        const current = target ? elements.indexOf(target as HTMLButtonElement) : -1;
        const last = elements.length - 1;
        const next = event.key === 'Home' ? 0
            : event.key === 'End' ? last
                : event.key === 'ArrowDown' ? (current + 1) % elements.length
                    : (current <= 0 ? last : current - 1);
        focusItemAt(next);
    }

    useEffect(() => {
        if (versionRef.current === renderVersion) return;
        versionRef.current = renderVersion;
        closeMenu();
    }, [renderVersion]);

    useEffect(() => {
        if (!open) return undefined;

        function handlePointerDown(event: PointerEvent) {
            if (!shellRef.current?.isConnected) {
                closeMenu();
                return;
            }
            if (event.composedPath().includes(shellRef.current)) return;
            closeMenu();
        }

        function handleKeyDown(event: KeyboardEvent) {
            if (event.key === 'Tab') {
                if (isFocusInsideShell()) hideMenu();
                return;
            }
            if (event.key !== 'Escape') return;
            if (!isFocusInsideShell()) {
                hideMenu();
                return;
            }
            event.preventDefault();
            event.stopPropagation();
            closeMenu(true);
        }

        document.addEventListener('pointerdown', handlePointerDown, true);
        document.addEventListener('keydown', handleKeyDown, true);
        return () => {
            document.removeEventListener('pointerdown', handlePointerDown, true);
            document.removeEventListener('keydown', handleKeyDown, true);
        };
    }, [open]);

    useLayoutEffect(() => {
        if (!open) return undefined;
        updatePosition();

        const focusTarget = focusOnOpen.current;
        focusOnOpen.current = null;
        if (focusTarget) {
            const elements = getMenuItems();
            const index = focusTarget === 'last' ? elements.length - 1 : 0;
            focusElement(elements[index]);
        }

        const refineTimer = window.setTimeout(updatePosition, POSITION_REFINE_DELAY);
        const menu = menuRef.current;
        const observer = menu ? new ResizeObserver(() => updatePosition()) : null;
        if (menu) observer?.observe(menu);
        window.addEventListener('scroll', updatePosition, true);
        window.addEventListener('resize', updatePosition);
        // Keep the fixed-position menu glued to the trigger during layout shifts
        // (carousel animation, sticky headers) that fire neither scroll nor resize.
        let frame = window.requestAnimationFrame(function track() {
            updatePosition();
            frame = window.requestAnimationFrame(track);
        });
        return () => {
            window.clearTimeout(refineTimer);
            window.cancelAnimationFrame(frame);
            observer?.disconnect();
            window.removeEventListener('scroll', updatePosition, true);
            window.removeEventListener('resize', updatePosition);
        };
    }, [open]);

    useEffect(() => () => {
        clearOpenTimer();
        clearCloseTimer();
        clearLongPress();
        clearSuppressTimer();
    }, []);

    return (
        <span ref={shellRef} class="IG_CONTROL_SHELL"
            onPointerEnter={scheduleOpen} onPointerLeave={scheduleClose}
            onFocusOut={handleFocusOut} onContextMenu={handleContextMenu}>
            <ControlButton class="IG_DW_MAIN IG_DW_MENU_TRIGGER" labelKey="DW" icon={SVG.DOWNLOAD}
                onClick={actions.download}
                aria-haspopup={hasItems ? 'menu' : undefined}
                aria-expanded={hasItems ? open : undefined}
                aria-controls={hasItems ? menuId : undefined}
                aria-keyshortcuts="ArrowDown"
                onFocus={handleTriggerFocus}
                onKeyDown={handleTriggerKeyDown}
                onClickCapture={handleTriggerClickCapture}
                onPointerDown={handleTriggerPointerDown}
                onPointerMove={handleTriggerPointerMove}
                onPointerUp={handleTriggerPointerEnd}
                onPointerCancel={handleTriggerPointerEnd}
                onPointerLeave={handleTriggerPointerEnd} />
            {hasItems && (
                <span ref={menuRef} id={menuId} class="IG_CONTROL_MENU scrollbar-sm" role="menu"
                    data-open={open ? 'true' : 'false'} aria-hidden={!open}
                    onPointerEnter={clearCloseTimer} onPointerLeave={scheduleClose}
                    onKeyDown={handleMenuKeyDown}>
                    <SecondaryControls items={items} menu={{
                        open,
                        activeIndex,
                        onMenuClose: selectMenuItem,
                        onActive: setActiveIndex,
                    }} />
                </span>
            )}
        </span>
    );
}


function isHoverPointer(event: { pointerType: string }) {
    return event.pointerType === 'mouse' || event.pointerType === '';
}

function isTouchPointer(event: { pointerType: string }) {
    return event.pointerType === 'touch' || event.pointerType === 'pen';
}

function deepActiveElement(): Element | null {
    let active: Element | null = document.activeElement;
    while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
    return active;
}


function CopyControlButton({ labelKey, onClick, onMenuClose, showLabel = false, ...props }: Omit<JSX.IntrinsicElements['button'], 'onClick'> & {
    labelKey: string; onClick?: () => unknown; onMenuClose?: (delay?: number) => void; showLabel?: boolean;
}) {
    const [copied, setCopied] = useState(false);
    const resetTimer = useRef<number | null>(null);
    const label = _i18n(labelKey);

    useEffect(() => () => {
        if (resetTimer.current !== null) window.clearTimeout(resetTimer.current);
    }, []);

    async function copy() {
        const result = await Promise.resolve(onClick?.());
        if (result !== true) {
            onMenuClose?.();
            return;
        }
        setCopied(true);
        if (resetTimer.current !== null) window.clearTimeout(resetTimer.current);
        resetTimer.current = window.setTimeout(() => {
            resetTimer.current = null;
            setCopied(false);
        }, COPY_CONFIRM_VISIBLE_DELAY);
        // Keep the menu open just long enough to show the copied checkmark.
        onMenuClose?.(COPY_MENU_CLOSE_DELAY);
    }

    return (
        <Button class="IG_POST_CONTROL IG_COPY_MAIN" variant="ghost" size="icon-sm"
            data-ih-locale-title={labelKey} data-copied={copied || undefined} title={label} aria-label={label}
            {...props} onClick={() => void copy()}>
            <span class="IG_CONTROL_ICON" aria-hidden="true">{copied ? <CheckIcon /> : <CopyIcon />}</span>
            {showLabel && <span class="IG_CONTROL_LABEL">{label}</span>}
        </Button>
    );
}

function ControlButton({ class: className, labelKey, icon, showLabel = false, onMenuClose, onClick, ...props }: JSX.IntrinsicElements['button'] & {
    labelKey: string; icon: string; showLabel?: boolean; onMenuClose?: (delay?: number) => void;
}) {
    const label = _i18n(labelKey);
    return (
        <Button class={`IG_POST_CONTROL ${className}`} variant="ghost" size="icon-sm"
            data-ih-locale-title={labelKey} title={label} aria-label={label} {...props}
            onClick={event => {
                const result = onClick?.(event);
                if (onMenuClose) Promise.resolve(result).then(() => onMenuClose(), () => onMenuClose());
                return result;
            }}>
            <span class="IG_CONTROL_ICON" aria-hidden="true" dangerouslySetInnerHTML={{ __html: icon }} />
            {showLabel && <span class="IG_CONTROL_LABEL">{label}</span>}
        </Button>
    );
}
