// Builds a realistic local SQLite DB (same schema as apps/desktop/src/main/main.ts)
// using real SQLite (sql.js / WASM), so the headless screenshot shows authentic data.
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DAY = 86400000;
const today = new Date();
const iso = (d) => d.toISOString();
const dayKey = (d) => d.toISOString().split('T')[0];

(async () => {
  const SQL = await initSqlJs();
  const db = new SQL.Database();

  db.run(`
    CREATE TABLE IF NOT EXISTS decks (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT, userId TEXT,
      createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS cards (
      id TEXT PRIMARY KEY, front TEXT NOT NULL, back TEXT NOT NULL, deckId TEXT NOT NULL,
      intervalDays INTEGER DEFAULT 0, repetitions INTEGER DEFAULT 0, easeFactor REAL DEFAULT 2.5,
      nextReviewAt TEXT, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS reviewLogs (
      id TEXT PRIMARY KEY, cardId TEXT NOT NULL, rating INTEGER NOT NULL,
      reviewedAt TEXT NOT NULL, createdAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS syncMeta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  `);

  const decks = [
    ['d1', 'Spanish Vocabulary', 'A1 → B1 core vocabulary, 500 most common words'],
    ['d2', 'JavaScript Interview', 'Closures, event loop, prototypes & async patterns'],
    ['d3', 'World Capitals', 'Countries and their capital cities'],
    ['d4', 'Systems Design', 'Scaling, caching, CAP theorem and queueing'],
  ];

  const cards = [
    ['c1', 'la biblioteca', 'the library', 'd1'],
    ['c2', 'el atardecer', 'sunset / dusk', 'd1'],
    ['c3', 'aprender', 'to learn', 'd1'],
    ['c4', 'el rincón', 'the corner (of a room)', 'd1'],
    ['c5', 'What is a closure?', 'A function that keeps a reference to its lexical scope even when executed outside it.', 'd2'],
    ['c6', 'Explain the event loop', 'Single-threaded loop that drains the call stack, then microtasks (promises), then timers/macrotasks.', 'd2'],
    ['c7', 'What does `this` bind to?', 'Depends on call site: default, implicit (obj.fn), explicit (call/apply/bind) or lexical (arrow functions).', 'd2'],
    ['c8', 'Australia', 'Canberra', 'd3'],
    ['c9', 'Canada', 'Ottawa', 'd3'],
    ['c10', 'Brazil', 'Brasília', 'd3'],
    ['c11', 'What is CAP theorem?', 'Under a network partition you must choose between consistency and availability.', 'd4'],
    ['c12', 'Cache invalidation strategies', 'TTL, write-through, write-behind and explicit purge on mutation.', 'd4'],
  ];

  const insertDeck = db.prepare('INSERT INTO decks VALUES (?,?,?,?,?,?)');
  decks.forEach(([id, name, description], i) => {
    const created = iso(new Date(today.getTime() - (140 - i * 9) * DAY));
    insertDeck.run([id, name, description, 'demo-user', created, created]);
  });
  insertDeck.free();

  const insertCard = db.prepare('INSERT INTO cards VALUES (?,?,?,?,?,?,?,?,?,?)');
  cards.forEach(([id, front, back, deckId], i) => {
    const created = iso(new Date(today.getTime() - (120 - i * 4) * DAY));
    // Cards the SRS engine considers "due" (NULL or in the past) for the Study screen.
    const due = i % 3 !== 2;
    const nextReviewAt = due
      ? iso(new Date(today.getTime() - (i % 5) * DAY))
      : iso(new Date(today.getTime() + (i + 1) * DAY));
    insertCard.run([id, front, back, deckId, due ? 1 : 7, due ? 1 : 3, 2.5, nextReviewAt, created, created]);
  });
  insertCard.free();

  // Review history for the activity heatmap: ~10 months with streaks, weekends off and gaps.
  const insertLog = db.prepare('INSERT INTO reviewLogs VALUES (?,?,?,?,?)');
  let n = 0;
  for (let back = 300; back >= 0; back--) {
    const d = new Date(today.getTime() - back * DAY);
    const dow = d.getUTCDay();
    const seed = Math.sin(back * 12.9898) * 43758.5453;
    const rnd = seed - Math.floor(seed); // deterministic pseudo-random
    if (back > 210 && rnd < 0.55) continue;       // sparse start
    if (dow === 0 && rnd < 0.6) continue;          // some Sundays off
    if (rnd < 0.08) continue;                      // occasional missed day
    if (back > 45 && back < 95) continue;          // a vacation gap
    const base = back < 30 ? 12 : back < 90 ? 9 : 5;
    const count = Math.max(1, Math.round(base + rnd * 14));
    for (let k = 0; k < count; k++) {
      const reviewedAt = new Date(d.getTime() + (8 + (k % 12)) * 3600000 + k * 60000);
      insertLog.run([`r${n++}`, cards[k % cards.length][0], k % 4, iso(reviewedAt), iso(reviewedAt)]);
    }
  }
  insertLog.free();

  db.run("INSERT INTO syncMeta VALUES ('lastSyncAt', ?)", [iso(new Date(today.getTime() - 2 * 3600000))]);

  const out = path.join(__dirname, 'flashcards.db');
  fs.writeFileSync(out, Buffer.from(db.export()));
  const [{ values }] = db.exec('SELECT COUNT(*) FROM reviewLogs');
  console.log(`wrote ${out} (${values[0][0]} review logs, ${decks.length} decks, ${cards.length} cards)`);
})();
