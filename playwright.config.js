import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: './e2e/playwright',
    testMatch: '**/*.e2e.test.js',
    outputDir: '.cache/arca/playwright/test-results',
    timeout: 90000,
    workers: 1,
    reporter: 'line',
});
