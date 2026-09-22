# Repository agent instructions

## Browser E2E

The project-local E2E skill is installed by APM at `.agents/skills/e2e`.

For agent-driven browser verification, use:

```sh
bun run test:agent -- <browser command and arguments>
```

The harness starts or reuses the configured browser, dev server, userscript manager, cookies, and plugins automatically. Do not add separate start/stop steps.

Do not inspect, import, modify, or run `e2e/playwright/`, `playwright.config.js`, or Playwright commands for Agent E2E.

After any code change, always run `bun run test:e2e:ui`. Run `bun run test:e2e:execution` as well when runtime or functional behavior changed. Pure UI, styling, refactor, or test-infrastructure changes do not require the execution/download category unless they affect behavior. Use `bun run test:e2e` when the full automated suite is requested.
