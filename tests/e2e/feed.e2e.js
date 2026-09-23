import { expect, test } from '@playwright/test';
import { INSTAGRAM_HOME, IgHelperE2E, registerE2E, requireAuthenticatedProfile } from './harness.js';
const e2e = new IgHelperE2E();

test.describe('IG Helper browser E2E', () => {

    test.describe('Authenticated UI', { tag: ['@ui', '@auth'] }, () => {
        requireAuthenticatedProfile(test, e2e);
        registerE2E(test, e2e);
        test('boots in the existing Instagram session and detects feed posts', async () => {
            await e2e.goto(INSTAGRAM_HOME);
            await e2e.waitFor(`document.querySelectorAll('[data-snig="canDownload"]').length > 0`, 15000);

            const state = await e2e.json(`({
                href: location.href,
                title: document.title,
                articles: document.querySelectorAll('article').length,
                targets: document.querySelectorAll('[data-snig="canDownload"]').length,
                hasLoginForm: !!document.querySelector('input[name="username"], input[name="password"]'),
            })`);

            expect(state.href).toBe(INSTAGRAM_HOME);
            expect(state.title).toContain('Instagram');
            expect(state.hasLoginForm).toBe(false);
            expect(state.targets).toBeGreaterThan(0);
        });
    });

});
