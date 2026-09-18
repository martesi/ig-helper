# Browser E2E

There are two independent paths. Pick one before inspecting test code; they do not share browser state.

## Agent E2E — interactive browser verification

Use this path for **agent E2E**, **use your own browser**, browser-visible debugging, UI verification, or when the `e2e` skill selects website testing.

```sh
bun run test:agent:start
bun run test:agent -- open http://127.0.0.1:9000/__vite-plugin-monkey.install.user.js
bun run test:agent -- snapshot
bun run test:agent:stop
```

`test:agent:start` prepares the repo-owned environment, starts the Vite servers, opens the headed agent browser, and imports local cookies. `test:agent` is equivalent to calling `agent-browser` with the repo's Nix environment, Chromium path, ScriptCat path, session name, and `.browser-state/agent` profile already applied. `test:agent:stop` closes only that agent session and stops dev servers started by `test:agent:start`.

Cookie bootstrap checks `cookies.json` first. If it is absent, it imports matching Netscape-format `cookies*.txt` files. These files stay ignored by git.

If Chromium opens ScriptCat's **Allow User Scripts** instructions on a fresh profile, enable that permission once; `.browser-state/agent` preserves it. If development injection is specifically blocked by HTTP CSP, follow the `e2e` skill's userscript instructions and add its test-only CSP helper for that agent-browser run.

**Boundary:** do not inspect or reuse anything under `e2e/playwright/`, `playwright.config.js`, or `bun run test:e2e` for Agent E2E.

## Playwright — automated regression suite

Use this path only when Playwright or the automated regression suite is explicitly requested.

```sh
bun run test:e2e
```

All Playwright-specific code lives under `e2e/playwright/`. `test:e2e` enters the repo E2E shell, starts its own headed Chromium, exposes CDP on `http://127.0.0.1:9013`, then connects Playwright to that owned browser. Its persistent profile is `.browser-state/playwright`, separate from the agent-browser profile at `.browser-state/agent`. Set `IG_HELPER_E2E_CDP` only to explicitly use an externally managed CDP browser.

At suite startup, Playwright imports `cookies.json`, or Netscape-format `cookies*.txt` when JSON is absent. It starts Xvfb and the Vite servers when needed, enables ScriptCat's user-script permission on the owned profile, installs or updates the development userscript, opens real Instagram pages, and restores settings it temporarily changes.

A real post media download uses Chrome's configured download directory. The test requires `Browser.downloadWillBegin`, a completed `Browser.downloadProgress` event, a concrete browser-reported file path, and matching non-zero received/total byte counts. The harness does not replace the browser download with a mock or container-side fetch.
