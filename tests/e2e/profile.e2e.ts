import { expect, test } from '@playwright/test';
import { PROFILE_URL, IgHelperE2E, registerE2E } from './harness.ts';
const e2e = new IgHelperE2E();

test.describe('IG Helper browser E2E', () => {
    registerE2E(test, e2e);

    test.describe('UI', { tag: '@ui' }, () => {
        test('profile page mounts the avatar download control in the live Instagram DOM', async () => {
            await e2e.goto(PROFILE_URL);
            await e2e.waitFor(`document.querySelectorAll('.IG_PROFILE_CONTROL').length > 0`, 10000);

            const profile = await e2e.json(`(() => {
                const control = document.querySelector('.IG_PROFILE_CONTROL');
                const button = control?.shadowRoot?.querySelector('.IG_PROFILE_DOWNLOAD');
                const rect = control?.getBoundingClientRect();
                return {
                    href: location.href,
                    controls: document.querySelectorAll('.IG_PROFILE_CONTROL').length,
                    button: Boolean(button),
                    visible: Boolean(rect && rect.width > 0 && rect.height > 0),
                };
            })()`);

            expect(profile.href).toBe(PROFILE_URL);
            expect(profile.controls).toBeGreaterThan(0);
            expect(profile.button).toBe(true);
            expect(profile.visible).toBe(true);
        });
    });

});
