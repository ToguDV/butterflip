// Servidor estático del renderer real con el shim de sql.js, para previsualizar
// la app en el navegador (vía tunnel de Cloudflare). Igual que shot.js pero
// sin Playwright y en modo persistente.
const http = require('http');
const fs = require('fs');
const path = require('path');

// Igual que shot.js: la raíz es el harness (staging en renderer/ + shim, wasm y DB arriba).
const ROOT = __dirname;
const PORT = Number(process.env.PORT || 8899);

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.wasm': 'application/wasm',
  '.db': 'application/octet-stream',
  '.png': 'image/png',
};

http
  .createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0].split('#')[0]);
    // El build usa rutas de assets relativas: abrir en /renderer/index.html
    // para que ./assets resuelva. Redirigimos la raíz.
    if (url === '/') {
      res.writeHead(301, { Location: '/renderer/index.html' });
      return res.end();
    }
    // SPA: cualquier ruta sin extensión cae en index.html (hash router no lo usa, pero por las dudas).
    let file = path.join(ROOT, url === '/' ? '/renderer/index.html' : url);
    if (!file.startsWith(ROOT)) {
      res.writeHead(403);
      return res.end('forbidden');
    }
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      if (!path.extname(url)) file = path.join(ROOT, 'renderer/index.html');
      else {
        res.writeHead(404);
        return res.end('not found');
      }
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  })
  .listen(PORT, '127.0.0.1', () => {
    console.log(`renderer preview listo en http://127.0.0.1:${PORT}`);
  });
