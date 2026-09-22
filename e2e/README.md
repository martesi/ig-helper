# Browser E2E

The reusable lifecycle lives in the APM-installed `.agents/skills/e2e` skill. IG Helper keeps only product-specific configuration and assertions.

## Agent E2E

Use this for agent-driven browser verification:

```sh
bun run test:agent -- snapshot
bun run test:agent -- open https://www.instagram.com/
```

Each command uses `.config/arca.toml`. The harness starts or reuses Chromium, the Vite dev server, ScriptCat, the CSP helper, and local cookies automatically, then schedules idle cleanup. There are no separate start/stop commands.

Agent sessions share the configured browser profile while remaining separate control sessions.

## Playwright regression suite

Use this only for the automated Playwright suite:

```sh
bun run test:e2e
```

`e2e/run-playwright.mjs` starts the installed Arca harness, runs Playwright against its CDP endpoint on port 2000, and always stops the managed runtime afterward. The Playwright harness contains only IG Helper-specific navigation, assertions, settings manipulation, and download checks.

Browser state and Playwright artifacts live under `.cache/arca/`.

## Skill installation

APM owns the project-local skill and lock state:

```sh
apm install --frozen
bun install
```

The resolved skill is deployed to `.agents/skills/e2e` and included as a Bun workspace. Run APM first because redeploying the skill replaces its generated `node_modules`; `bun install` then installs the dependencies declared by the skill's own `package.json`.
