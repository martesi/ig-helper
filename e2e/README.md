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

The suite is tagged by purpose:

```sh
bun run test:e2e:ui         # required after every code change
bun run test:e2e:execution  # runtime/actions/download behavior
bun run test:e2e            # both categories
bun run test:e2e:anonymous  # cookie-free coverage only
bun run test:e2e:auth       # authenticated-only coverage
```

The normal runners execute cookie-free coverage first in the isolated `anonymous` profile, then authenticated-only tests in the default profile. A failure in the first phase does not prevent the second phase from running. UI tests never require a real file download. Run execution tests when functional behavior changes; they can be skipped for changes that do not affect functionality.

The installed Arca harness owns Chromium lifecycle and injects its actual CDP endpoint into Playwright Test. The local Playwright harness contains only IG Helper-specific navigation, assertions, settings manipulation, and download checks.

Browser state and Playwright artifacts live under `.cache/arca/`.

## Skill installation

APM owns the project-local skill and lock state:

```sh
apm install --frozen
bun install
```

The resolved skill is deployed to `.agents/skills/e2e` and included as a Bun workspace. Run APM first because redeploying the skill replaces its generated `node_modules`; `bun install` then installs the dependencies declared by the skill's own `package.json`.
