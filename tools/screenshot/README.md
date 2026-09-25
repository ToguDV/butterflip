# Screenshots without a display

Captures the **real renderer build** (`apps/desktop/dist/renderer`) in headless Chromium.
The Electron preload bridge (`window.electronAPI` → IPC → SQLite) is shimmed with
[sql.js](https://sql.js.org) (real SQLite/WASM) over a seeded DB, so the UI renders with
authentic data — no X server and no Electron window needed.

## Usage

```bash
cd tools/screenshot
npm install --no-save playwright-core sql.js

npm run seed    # builds flashcards.db (schema copied from apps/desktop/src/main/main.ts)
npm run stage   # copies the renderer build + injects shim.js
CHROME_PATH=... npm run shot   # screenshots into tools/screenshot/out/
```

`prepare.js` reads the build from `apps/desktop/dist/renderer`, so rebuild it first with
`pnpm --filter desktop build:renderer` if the UI changed.

## Files

| File | Purpose |
| --- | --- |
| `seed.js` | Creates `flashcards.db` with demo decks/cards and ~10 months of review logs for the heatmap |
| `shim.js` | Browser implementation of `window.electronAPI` (`dbExec`/`dbGet`/`dbAll`) backed by sql.js |
| `prepare.js` | Copies the built renderer and wires `sql-wasm.js` + `shim.js` into `index.html` |
| `shot.js` | Static server + Playwright: Dashboard, Study (front/answer) and Deck editor |
| `serve.js` | Static server only (no Playwright): serves the staged renderer at `:8899` for browsing the app in a normal browser, optionally behind a Cloudflare quick tunnel (`cloudflared tunnel --url http://127.0.0.1:8899`). Redirects `/` → `/renderer/index.html` (assets use relative paths) |
| `fonts.conf` | fontconfig profile used when the sandbox has no system fonts |

## Sandbox notes

On this machine Chromium's shared libraries and fonts live outside the default paths, so the
run needs (adjust/omit on a normal box):

```bash
export LD_LIBRARY_PATH=/tmp/sysroot/usr/lib/x86_64-linux-gnu:/tmp/sysroot/lib/x86_64-linux-gnu:/tmp/sysroot/usr/lib:/tmp/sysroot/lib
export FONTCONFIG_FILE=$PWD/fonts.conf
export XDG_CACHE_HOME=/tmp/fontcache
node shot.js
```

`CHROME_PATH` overrides the Chromium binary; otherwise the Playwright cache is searched.
