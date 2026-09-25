// Prepares a servable copy of the real renderer build with the sql.js bridge injected.
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const REPO = path.resolve(__dirname, '..', '..');
const SRC = process.env.RENDERER_DIST || path.join(REPO, 'apps/desktop/dist/renderer');
const DEST = path.join(ROOT, 'renderer');

if (!fs.existsSync(SRC)) {
  throw new Error(`renderer build not found at ${SRC} — run "pnpm --filter desktop build:renderer" first`);
}

fs.rmSync(DEST, { recursive: true, force: true });
fs.cpSync(SRC, DEST, { recursive: true });

for (const f of ['sql-wasm.js', 'sql-wasm.wasm']) {
  fs.copyFileSync(path.join(ROOT, 'node_modules/sql.js/dist', f), path.join(ROOT, f));
}
if (!fs.existsSync(path.join(ROOT, 'flashcards.db'))) throw new Error('run `node seed.js` first');

const htmlPath = path.join(DEST, 'index.html');
let html = fs.readFileSync(htmlPath, 'utf8');
html = html.replace(
  /<script type="module"/,
  '<script src="/sql-wasm.js"></script>\n    <script src="/shim.js"></script>\n    <script type="module"'
);
fs.writeFileSync(htmlPath, html);
console.log('prepared', htmlPath);
