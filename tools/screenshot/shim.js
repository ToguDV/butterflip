// Shim for the Electron preload bridge (window.electronAPI) so the real renderer
// build can run inside Chromium. Backed by sql.js (real SQLite/WASM) + seeded DB.
window.__dbReady = initSqlJs({ locateFile: (f) => '/' + f }).then(async (SQL) => {
  const buf = await (await fetch('/flashcards.db')).arrayBuffer();
  return new SQL.Database(new Uint8Array(buf));
});

function __query(sql, params) {
  return window.__dbReady.then((db) => {
    const stmt = db.prepare(sql);
    try {
      stmt.bind((params || []).map((p) => (p === undefined ? null : p)));
      const rows = [];
      while (stmt.step()) rows.push(stmt.getAsObject());
      return rows;
    } finally {
      stmt.free();
    }
  });
}

window.electronAPI = {
  dbExec: (sql, params) =>
    /^\s*select/i.test(sql)
      ? __query(sql, params)
      : window.__dbReady.then((db) => {
          db.run(sql, (params || []).map((p) => (p === undefined ? null : p)));
          return { changes: db.getRowsModified() };
        }),
  dbGet: (sql, params) => __query(sql, params).then((rows) => rows[0]),
  dbAll: (sql, params) => __query(sql, params),
};
