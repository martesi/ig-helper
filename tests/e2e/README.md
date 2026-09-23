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

Tests are grouped by feature (`post.e2e.js`, `reels.e2e.js`, and similar). Playwright tags select UI or execution coverage; auth-only groups use a conditional skip outside the authenticated `default` profile.

```sh
bun run test:e2e:ui         # all UI coverage, both profiles
bun run test:e2e:execution  # all execution coverage, both profiles
bun run test:e2e:exe        # alias for execution coverage
bun run test:e2e            # full anonymous suite
bun run test:e2e:all        # full suite, both profiles
bun run test:e2e:anonymous  # cookie-free coverage only
bun run test:e2e:auth       # authenticated-only coverage
```

UI and execution commands select matching Playwright tags for both profiles. Auth-only tests are skipped in the cookie-free `anonymous` profile. `test:e2e` runs anonymous coverage, `test:e2e:auth` runs auth-tagged tests, and `test:e2e:all` starts both profiles and runs their Playwright projects concurrently. Each project uses one worker, keeping its tests sequential against the shared browser session. The `anonymous` profile clears cookies; `default` retains the authenticated session. UI tests never require a real file download.

The installed Arca harness owns Chromium lifecycle and injects its actual CDP endpoint into Playwright Test. The local Playwright harness contains only IG Helper-specific navigation, assertions, settings manipulation, and download checks.

Browser state and Playwright artifacts live under `.cache/arca/`.

## Skill installation

APM owns the project-local skill and lock state:

```sh
apm install --frozen
bun install
```

The resolved skill is deployed to `.agents/skills/e2e` and included as a Bun workspace. Run APM first because redeploying the skill replaces its generated `node_modules`; `bun install` then installs the dependencies declared by the skill's own `package.json`.
