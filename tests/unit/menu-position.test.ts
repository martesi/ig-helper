import { expect, test } from 'bun:test';
import { clampScale, computeMenuPlacement } from '../../src/features/post/menu-position';

const viewport = { width: 1280, height: 900 };
const menu = { width: 180, height: 134 };

test('anchors the menu under the trigger when there is room below', () => {
    const placement = computeMenuPlacement(
        { top: 200, bottom: 240, right: 977, height: 40 },
        menu,
        viewport,
    );

    expect(placement.above).toBe(false);
    expect(placement.top).toBe(246);
    expect(placement.left).toBe(797);
});

test('prefers opening upward when the trigger sits in the lower third', () => {
    const placement = computeMenuPlacement(
        { top: 584, bottom: 624, right: 977, height: 40 },
        menu,
        viewport,
    );

    expect(placement.above).toBe(true);
    expect(placement.top).toBe(444);
});

test('flips upward when the menu would overflow the viewport bottom', () => {
    const placement = computeMenuPlacement(
        { top: 700, bottom: 740, right: 977, height: 40 },
        menu,
        { width: 1280, height: 760 },
    );

    expect(placement.above).toBe(true);
    expect(placement.top).toBe(560);
});

test('clamps inside both margins when neither side fits', () => {
    const tallMenu = { width: 180, height: 300 };
    const placement = computeMenuPlacement(
        { top: 140, bottom: 180, right: 400, height: 40 },
        tallMenu,
        { width: 500, height: 320 },
    );

    expect(placement.top).toBeGreaterThanOrEqual(8);
    expect(placement.top + tallMenu.height).toBeLessThanOrEqual(320 - 8 + 0.001);
});

test('right-aligns to the trigger and clamps to the horizontal margins', () => {
    const wide = { width: 400, height: 134 };
    const placement = computeMenuPlacement(
        { top: 200, bottom: 240, right: 300, height: 40 },
        wide,
        { width: 500, height: 900 },
    );

    expect(placement.left).toBe(8);
    expect(placement.left + wide.width).toBeLessThanOrEqual(500 - 8 + 0.001);
});

test('keeps a menu wider than the viewport at the leading margin', () => {
    const wide = { width: 900, height: 134 };
    const placement = computeMenuPlacement(
        { top: 200, bottom: 240, right: 500, height: 40 },
        wide,
        { width: 600, height: 900 },
    );

    expect(placement.left).toBe(8);
});

test('clamps the painted/CSS scale used for coordinate correction', () => {
    expect(clampScale(0.5)).toBe(0.5);
    expect(clampScale(3)).toBe(3);
    expect(clampScale(0)).toBe(1);
    expect(clampScale(-2)).toBe(1);
    expect(clampScale(Number.POSITIVE_INFINITY)).toBe(1);
    expect(clampScale(100)).toBe(10);
});
