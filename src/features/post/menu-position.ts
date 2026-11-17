export interface MenuTriggerRect {
    top: number;
    bottom: number;
    right: number;
    height: number;
}

export interface MenuSize {
    width: number;
    height: number;
}

export interface ViewportSize {
    width: number;
    height: number;
}

export interface MenuPlacement {
    top: number;
    left: number;
    above: boolean;
}

export interface MenuPlacementOptions {
    gap?: number;
    margin?: number;
    /** Fraction of the viewport below which the menu prefers to open upward. */
    lowerThird?: number;
}

const DEFAULT_GAP = 6;
const DEFAULT_MARGIN = 8;
const DEFAULT_LOWER_THIRD = 2 / 3;

/** Guards the painted/CSS size ratio used to translate viewport deltas into CSS deltas. */
export function clampScale(scale: number): number {
    if (!Number.isFinite(scale) || scale <= 0) return 1;
    return Math.min(Math.max(scale, 0.1), 10);
}

/**
 * Anchors the menu under the download button, right-aligned. It opens upward when the
 * trigger sits in the lower part of the viewport, flips when there is not enough room
 * on the preferred side, and always stays inside the viewport margins.
 */
export function computeMenuPlacement(
    trigger: MenuTriggerRect,
    menu: MenuSize,
    viewport: ViewportSize,
    { gap = DEFAULT_GAP, margin = DEFAULT_MARGIN, lowerThird = DEFAULT_LOWER_THIRD }: MenuPlacementOptions = {},
): MenuPlacement {
    const below = trigger.bottom + gap;
    const aboveTop = trigger.top - gap - menu.height;
    const fitsBelow = below + menu.height <= viewport.height - margin;
    const fitsAbove = aboveTop >= margin;
    const prefersAbove = trigger.top + trigger.height / 2 > viewport.height * lowerThird;
    const above = fitsAbove && (!fitsBelow || prefersAbove);

    const maxTop = Math.max(margin, viewport.height - menu.height - margin);
    const top = Math.min(Math.max(margin, Math.round(above ? aboveTop : below)), maxTop);
    const maxLeft = Math.max(margin, viewport.width - menu.width - margin);
    const left = Math.round(Math.min(Math.max(margin, trigger.right - menu.width), maxLeft));

    return { top, left, above };
}
