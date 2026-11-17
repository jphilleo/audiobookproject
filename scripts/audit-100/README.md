# Follow-up audit observation probes

Audited commit: `b27fb18`. These probes record behavior; they are not a regression suite claiming fixes. Findings and caveats are in `docs/audit-100/README.md`.

Use a disposable directory outside the real data/library directories. **backend.mjs intentionally changes synthetic book metadata and deletes one synthetic chapter asset. Never point it at production or personal books.** No commands below deploy, upload, or change production.

Requirements: project dependencies, ffmpeg on PATH, local Kokoro model for token-limit.mjs, and Playwright/Chrome for browser.cjs. Set PLAYWRIGHT_MODULE to an already-installed Playwright module if it is not resolvable normally, and CHROME_PATH for another Chrome installation. Browser checks are headless with a fresh profile.

Run from repository root, substituting actual disposable paths:

```sh
node scripts/audit-100/extraction.mjs /tmp/audiobook-audit-extraction.json
node scripts/audit-100/token-limit.mjs /tmp/audiobook-audit-tokens.json
node scripts/audit-100/runtime-fixtures.mjs /tmp/audiobook-audit-fixtures /absolute/path/to/a-short-test.m4a
DATA_DIR=/tmp/audiobook-audit-fixtures/books LIBRARY_DIR=/tmp/audiobook-audit-fixtures/library PORT=4874 PUBLIC_URL=http://127.0.0.1:4874 node server.js
```

While that isolated server is running, in another terminal:

```sh
node scripts/audit-100/browser.cjs /tmp/audiobook-audit-browser.json
```

Stop the fixture server before the backend probe, which mutates its fixture files:

```sh
DATA_DIR=/tmp/audiobook-audit-fixtures/books node scripts/audit-100/backend.mjs /tmp/audiobook-audit-backend.json
```

Recreate fixtures before repeating the browser/backend probes. Use a new fixture root if you need identical pristine file state. Fixture metadata uses synthetic chapter durations: do not use it to measure audio-duration accuracy. Downloads named in public fixture manifests are placeholders, and their absence is not counted as a product finding.

Cover probe: create a disposable directory containing a valid small WebP, then run `node scripts/audit-100/cover.mjs OUTPUT_DIRECTORY TEST_M4A WEBP_COVER`. It exercises the actual export builder and records its error. Do not use a real library output directory.

Recorded caveats:

- Token-limit probe replaces waveform generation and measures the actual tokenizer inputs/outputs. A native mutex failure occurred during teardown after evidence was saved. This teardown problem is not counted as an application issue.
- Browser probe 93 disproved an initial aria-current hypothesis. Finding 93 is instead the separately observed no-hash exception. Browser probe 97 timed out on a folded sample; its finding is code-review-only.
- Browser error injection and synthetic ended/pointercancel events isolate specific branches. They do not establish real-world frequency or a mobile-device certification.
- The fake SVG only sets an attribute on itself. It does not exfiltrate data.
- A failed probe remains recorded; never convert probe failures into claims of reproduced application defects.

The original observation JSON files are committed with the report. All 32 existing project tests still passed after this audit; application code was not changed.
