// Renders the real Vite build of the desktop renderer in headless Chromium and
// captures screenshots. window.electronAPI (Electron IPC → SQLite) is shimmed
// with sql.js over the seeded DB file, so the UI behaves like the real app.
const { chromium } = require('playwright-core');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const OUT = path.join(ROOT, 'out');

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.wasm': 'application/wasm', '.db': 'application/octet-stream', '.png': 'image/png' };

function findChrome() {
  const direct = [process.env.CHROME_PATH, chromium.executablePath?.()].filter(Boolean);
  for (const p of direct) if (fs.existsSync(p)) return p;

  const cache = path.join(process.env.HOME || '/root', '.cache/ms-playwright');
  if (!fs.existsSync(cache)) return null;
  const rels = ['chrome-linux64/chrome', 'chrome-linux/chrome', 'chrome-headless-shell-linux64/chrome-headless-shell'];
  for (const dir of fs.readdirSync(cache).filter((d) => d.startsWith('chromium'))) {
    for (const rel of rels) {
      const p = path.join(cache, dir, rel);
      if (fs.existsSync(p)) return p;
    }
  }
  return null;
}

const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0].split('#')[0]);
  const file = path.join(ROOT, url === '/' ? '/renderer/index.html' : url);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); return res.end('not found');
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const exe = findChrome();
  if (!exe) throw new Error('chromium not found — set CHROME_PATH or install playwright browsers');

  await new Promise((r) => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}`;

  const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none'] });
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: 2 }); // Electron window size

  const logs = [];
  page.on('console', (m) => { if (!/favicon/.test(m.text())) logs.push(`[${m.type()}] ${m.text()}`); });
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));

  const shot = async (name) => {
    await page.screenshot({ path: path.join(OUT, name) });
    console.log('shot:', name);
  };

  // Fija el tema del app (localStorage) y recarga; se capturan las 5 tomas
  // por tema: light (sin sufijo) y dark (sufijo -dark).
  const setTheme = async (theme) => {
    await page.goto(`${base}/renderer/index.html`, { waitUntil: 'networkidle' });
    await page.evaluate((t) => localStorage.setItem('flashcards-theme', t), theme);
    await page.reload({ waitUntil: 'networkidle' });
  };

  for (const theme of ['light', 'dark']) {
    const sfx = theme === 'dark' ? '-dark' : '';
    await setTheme(theme);

    // 1) Dashboard: activity heatmap + decks
    await page.goto(`${base}/renderer/index.html#/`, { waitUntil: 'networkidle' });
    await page.waitForSelector('text=Spanish Vocabulary', { timeout: 15000 });
    await page.waitForTimeout(600);
    await shot(`01-dashboard${sfx}.png`);

    // 2) Study: card front, then revealed with the rating buttons
    await page.goto(`${base}/renderer/index.html#/study`, { waitUntil: 'networkidle' });
    await page.waitForSelector('text=Show answer', { timeout: 15000 });
    await shot(`02-study-front${sfx}.png`);
    await page.locator('button:has-text("Show answer")').first().click(); // el sidepanel voltea la tarjeta
    await page.waitForSelector('text=Again', { timeout: 15000 });
    await page.waitForTimeout(300);
    await shot(`03-study-answer${sfx}.png`);

    // 3) Deck editor
    await page.goto(`${base}/renderer/index.html#/deck/d2`, { waitUntil: 'networkidle' });
    await page.waitForSelector('text=What is a closure?', { timeout: 15000 });
    await page.waitForTimeout(400);
    await shot(`04-deck-editor${sfx}.png`);

    // 4) Whole dashboard (full heatmap, nothing clipped)
    await page.goto(`${base}/renderer/index.html#/`, { waitUntil: 'networkidle' });
    await page.waitForSelector('text=Spanish Vocabulary', { timeout: 15000 });
    await page.screenshot({ path: path.join(OUT, `05-dashboard-full${sfx}.png`), fullPage: true });
    console.log(`shot: 05-dashboard-full${sfx}.png`);
  }

  // 5) Vista mobile (390×844 @3x, como design/capture.cjs): la session de
  // estudio con la tarjeta revelada, por tema.
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
  const mobileShot = async (name) => {
    await mobile.screenshot({ path: path.join(OUT, name) });
    console.log('shot:', name);
  };
  for (const theme of ['light', 'dark']) {
    const sfx = theme === 'dark' ? '-dark' : '';
    await mobile.goto(`${base}/renderer/index.html`, { waitUntil: 'networkidle' });
    await mobile.evaluate((t) => localStorage.setItem('flashcards-theme', t), theme);
    await mobile.reload({ waitUntil: 'networkidle' });
    await mobile.goto(`${base}/renderer/index.html#/study`, { waitUntil: 'networkidle' });
    await mobile.waitForSelector('text=Show answer', { timeout: 15000 });
    await mobile.locator('button:has-text("Show answer")').first().click();
    await mobile.waitForSelector('text=Again', { timeout: 15000 });
    await mobile.waitForTimeout(300);
    await mobileShot(`06-study-mobile${sfx}.png`);
  }

  if (logs.length) console.log('\npage logs:\n' + logs.join('\n'));
  await browser.close();
  server.close();
})().catch((e) => { console.error(e); process.exit(1); });
