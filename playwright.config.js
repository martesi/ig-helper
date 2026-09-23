import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: './tests/e2e',
    testMatch: '**/*.e2e.js',
    outputDir: '.cache/arca/playwright/test-results',
    timeout: 90000,
    workers: 1,
    reporter: 'line',
    projects: [
        {
            name: 'anonymous',
        },
        {
            name: 'default',
        },
    ],
});
