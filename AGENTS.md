# Repository agent instructions

## Browser E2E

The project-local E2E skill is installed by APM at `.agents/skills/e2e`.

For agent-driven browser verification, use:

```sh
bun run test:agent -- <browser command and arguments>
```

The harness starts or reuses the configured browser, dev server, userscript manager, cookies, and plugins automatically. Do not add separate start/stop steps.

Do not inspect, import, modify, or run `e2e/playwright/`, `playwright.config.js`, or `bun run test:e2e` for Agent E2E. Use `bun run test:e2e` only when the user explicitly asks for Playwright or the automated regression suite.
