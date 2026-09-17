# Repository agent instructions

## Browser E2E has two separate paths

When the user asks for **agent E2E**, **browser E2E**, **use your own browser**, or browser-visible verification, use the `e2e` skill and the Agent E2E commands:

```sh
bun run test:agent:start
bun run test:agent -- <agent-browser command and arguments>
bun run test:stop
```

`test:agent` is the repo-configured `agent-browser` CLI. Do not inspect, grep, import, modify, or run `e2e/playwright/`, `playwright.config.js`, or `bun run test:e2e` for Agent E2E. Do not use Playwright as a fallback or copy setup out of the Playwright harness.

Only use `bun run test:e2e` when the user explicitly asks for Playwright, the automated E2E suite, or `test:e2e`.
