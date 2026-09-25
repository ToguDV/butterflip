// Captura headless del preview de diseño (design/index.html).
//
//   node design/capture.cjs
//
// Genera en design/screenshots/ (mobile-first: la app se mira en un teléfono):
//   01-dashboard-{light,dark}.png     · 390x844 @3x
//   02-study-{light,dark}.png
//   03-deck-editor-{light,dark}.png
//   04-design-system-{light,dark}.png · full page
//   05-desktop-{light,dark}.png       · 1200x800 @2x (dashboard ancho)
//
// No necesita display: Chromium corre headless. Reutiliza playwright-core del
// harness tools/screenshot/node_modules (no instala nada en apps/desktop).
//
// En sandboxes sin librerías/fuentes del sistema, el script se auto-configura:
//   CHROME_PATH      binario de Chromium (si no, busca en ~/.cache/ms-playwright)
//   FONTCONFIG_FILE  tools/screenshot/fonts.conf
//   XDG_CACHE_HOME   /tmp/fontcache
//   LD_LIBRARY_PATH  /tmp/sysroot/... (solo si existe)
// Sobrescribí cualquiera exportándola antes de correr el script.

const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');

const ROOT = __dirname;
const OUT = path.join(ROOT, 'screenshots');
const SANDBOX = '/tmp/sysroot';

// ---------------------------------------------------------------------------
// Entorno del sandbox (solo completa lo que falte)
// ---------------------------------------------------------------------------
const fontsConf = path.join(ROOT, '..', 'tools', 'screenshot', 'fonts.conf');
if (!process.env.FONTCONFIG_FILE && fs.existsSync(fontsConf)) {
  process.env.FONTCONFIG_FILE = fontsConf;
}
if (!process.env.XDG_CACHE_HOME) {
  process.env.XDG_CACHE_HOME = '/tmp/fontcache';
}
// El shell puede traer un LD_LIBRARY_PATH propio (p. ej. de otro runtime), así que
// anteponemos las librerías del sandbox en vez de pisar el valor existente.
if (fs.existsSync(SANDBOX)) {
  const sandboxLibs = [
    path.join(SANDBOX, 'usr/lib/x86_64-linux-gnu'),
    path.join(SANDBOX, 'lib/x86_64-linux-gnu'),
    path.join(SANDBOX, 'usr/lib'),
    path.join(SANDBOX, 'lib')
  ];
  const current = (process.env.LD_LIBRARY_PATH || '').split(':').filter(Boolean);
  process.env.LD_LIBRARY_PATH = [...sandboxLibs, ...current].join(':');
}

// ---------------------------------------------------------------------------
// playwright-core: harness existente → local → global
// ---------------------------------------------------------------------------
function loadPlaywright() {
  const candidates = [
    path.join(ROOT, '..', 'tools', 'screenshot', 'node_modules', 'playwright-core'),
    'playwright-core',
    'playwright'
  ];
  for (const candidate of candidates) {
    try {
      return require(candidate);
    } catch (error) {
      if (error.code !== 'MODULE_NOT_FOUND') throw error;
    }
  }
  throw new Error(
    'playwright-core no encontrado. Instalalo con: cd tools/screenshot && npm install --no-save playwright-core'
  );
}

function findChrome(chromium) {
  const direct = [process.env.CHROME_PATH, chromium.executablePath?.()].filter(Boolean);
  for (const candidate of direct) if (fs.existsSync(candidate)) return candidate;

  const cache = path.join(os.homedir(), '.cache/ms-playwright');
  if (!fs.existsSync(cache)) return null;
  const relatives = [
    'chrome-linux64/chrome',
    'chrome-linux/chrome',
    'chrome-headless-shell-linux64/chrome-headless-shell'
  ];
  for (const dir of fs.readdirSync(cache).filter((entry) => entry.startsWith('chromium'))) {
    for (const relative of relatives) {
      const candidate = path.join(cache, dir, relative);
      if (fs.existsSync(candidate)) return candidate;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Servidor estático sobre design/
// ---------------------------------------------------------------------------
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png'
};

function serve() {
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0].split('#')[0]);
    const file = path.join(ROOT, url === '/' ? '/index.html' : url);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404);
      return res.end('not found');
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

// ---------------------------------------------------------------------------
// Plan de capturas
// ---------------------------------------------------------------------------
// Plan de capturas: mobile primero (390x844 @3x) y una probada de desktop.
// El preview es mobile-first, así que el ancho de referencia es el del teléfono.
const MOBILE = { width: 390, height: 844 };
const DESKTOP = { width: 1200, height: 800 };
const SHOTS = [
  { name: '01-dashboard', view: 'dashboard', viewport: MOBILE, deviceScaleFactor: 3 },
  { name: '02-study', view: 'study', viewport: MOBILE, deviceScaleFactor: 3 },
  { name: '03-deck-editor', view: 'deck-editor', viewport: MOBILE, deviceScaleFactor: 3 },
  { name: '04-design-system', view: 'design', fullPage: true, viewport: MOBILE, deviceScaleFactor: 3 },
  { name: '05-desktop', view: 'dashboard', viewport: DESKTOP, deviceScaleFactor: 2 }
];
const THEMES = ['light', 'dark'];

// Evidencia que se acumula durante la corrida (mobile-first se verifica, no se asume).
const AUDIT = [];

// Audit de mobile: sin scroll horizontal y targets táctiles de 44px para arriba.
async function auditMobile(page, label) {
  return page.evaluate((tag) => {
    const root = document.documentElement;
    const small = new Set();
    for (const el of document.querySelectorAll('a[href], button, input, select, textarea')) {
      const rect = el.getBoundingClientRect();
      if (!rect.width || !rect.height) continue;
      if (rect.height < 44) {
        const cls = typeof el.className === 'string' ? el.className.split(/\s+/)[0] : '';
        small.add(`${el.tagName.toLowerCase()}${cls ? '.' + cls : ''} ${Math.round(rect.width)}x${Math.round(rect.height)}`);
      }
    }
    return {
      label: tag,
      overflow: root.scrollWidth - root.clientWidth,
      scrollWidth: root.scrollWidth,
      clientWidth: root.clientWidth,
      small: [...small]
    };
  }, label);
}

async function capture(browser, base, { name, view, fullPage = false, viewport, deviceScaleFactor }, theme) {
  const context = await browser.newContext({ viewport, deviceScaleFactor });
  // El tema se fija antes de que corran los scripts de la página.
  await context.addInitScript((value) => {
    try {
      localStorage.setItem('flashcards-design-theme', value);
    } catch (error) {
      /* storage bloqueado: el atributo por defecto es light */
    }
  }, theme);

  const page = await context.newPage();
  await page.goto(`${base}/index.html#${view}`, { waitUntil: 'load' });
  // Fuentes self-hosted no hay: esperamos a Google Fonts sin bloquear el run.
  await page.evaluate(() =>
    Promise.race([document.fonts.ready, new Promise((resolve) => setTimeout(resolve, 5000))])
  );
  // Capturas determinísticas: sin animaciones ni transiciones a mitad de camino.
  // En full page el tab bar fijo se dibujaría a mitad de página (artefacto del
  // viewport), así que se lo deja fluir al final del documento.
  await page.addStyleTag({
    content:
      '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}' +
      (fullPage ? '.tabbar{position:static!important;}' : '')
  });
  await page.waitForTimeout(120);

  if (viewport.width <= 480) {
    AUDIT.push(await auditMobile(page, `${name}-${theme}`));
  }

  const file = path.join(OUT, `${name}-${theme}.png`);
  await page.screenshot({ path: file, fullPage });
  await context.close();

  const { size } = fs.statSync(file);
  console.log(`  ${path.relative(process.cwd(), file)}  ${(size / 1024).toFixed(0)} KB`);
  return { file, size };
}

(async () => {
  const { chromium } = loadPlaywright();
  const executablePath = findChrome(chromium);
  if (!executablePath) {
    throw new Error('Chromium no encontrado: exportá CHROME_PATH o instalá los browsers de Playwright');
  }

  fs.mkdirSync(OUT, { recursive: true });
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}`;
  console.log(`Chromium: ${executablePath}`);
  console.log(`Preview:  ${base}/index.html`);

  const browser = await chromium.launch({
    executablePath,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none']
  });

  try {
    for (const shot of SHOTS) {
      for (const theme of THEMES) {
        await capture(browser, base, shot, theme);
      }
    }
  } finally {
    await browser.close();
    server.close();
  }

  const files = fs.readdirSync(OUT).filter((file) => file.endsWith('.png'));
  console.log(`\n${files.length} capturas en design/screenshots/`);

  const overflows = AUDIT.filter((a) => a.overflow > 0);
  const smallTargets = AUDIT.flatMap((a) => a.small.map((s) => `${a.label}: ${s}`));
  for (const a of AUDIT) {
    console.log(
      `  ${a.label}: viewport ${a.clientWidth}px · scroll ${a.scrollWidth}px · overflow ${a.overflow}px`
    );
  }
  if (smallTargets.length) {
    console.log('  targets < 44px:\n' + smallTargets.map((s) => `    ${s}`).join('\n'));
  }

  if (files.length !== SHOTS.length * THEMES.length) {
    throw new Error(`esperaba ${SHOTS.length * THEMES.length} PNGs, hay ${files.length}`);
  }
  if (overflows.length) {
    throw new Error(`scroll horizontal en mobile: ${overflows.map((a) => a.label).join(', ')}`);
  }
  if (smallTargets.length) {
    throw new Error(`targets táctiles < 44px: ${smallTargets.length}`);
  }
  console.log('sin scroll horizontal y targets >= 44px en los 8 shots mobile ✓');
})().catch((error) => {
  console.error(`\ncapture falló: ${error.message}`);
  process.exit(1);
});
