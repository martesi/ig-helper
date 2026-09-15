# Live browser E2E

The E2E suite uses `Bun.WebView` against the existing Chrome instance over CDP. It does not use an Instagram fixture or mock media downloads.

Set `IG_HELPER_E2E_CDP` when the browser endpoint differs from the project default.

Run:

```sh
bun run test:e2e
```

The suite starts both Vite dev servers when ports 9000 and 9100 are not already serving the userscript and settings app, reinstalls the development userscript through Violentmonkey, opens real Instagram pages in the existing browser profile, and restores any settings it temporarily changes.

A real post media download uses Chrome's configured download directory. The test requires `Browser.downloadWillBegin`, a completed `Browser.downloadProgress` event, a concrete browser-reported file path, and matching non-zero received/total byte counts. The harness does not replace the browser download with a mock or container-side fetch.

## Functional coverage

The test matrix intentionally measures major user-visible feature families rather than source-line coverage. Current automated surfaces are: live-session bootstrap, settings persistence, shortcut configuration, debug DOM capture, feed post controls, image viewer, open-in-new-tab, resource picker/selection, real media download, and profile-avatar control. Reels and story/highlight controls are listed as uncovered until a stable live route is available for deterministic automation.

That is 10/12 major surfaces (83.3%).
