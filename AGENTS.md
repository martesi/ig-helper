# Browser E2E
- Agent checks: `bun run test:agent -- <browser command and args>`; `.agents/skills/e2e` manages setup (no separate start/stop).
- Agent E2E: never access `e2e/playwright/`, `playwright.config.js`, or Playwright commands.
- After all code changes, run `bun run test:e2e:ui`; add `bun run test:e2e:execution` for runtime/functional changes.
- Full suite on request: `bun run test:e2e`.
