import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: './e2e/playwright',
    testMatch: '**/*.e2e.test.js',
    timeout: 90000,
    workers: 1,
    reporter: 'line',
});
