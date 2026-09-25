import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import fs from 'fs';
import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import os from 'os';

const dbDir = path.join(os.homedir(), '.flashcards');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}
const dbPath = path.join(dbDir, 'flashcards.db');
const db = new sqlite3.Database(dbPath);

const dbRun = promisify((sql: string, params: unknown[], cb: (err: Error | null, result: unknown) => void) => {
  db.run(sql, params, function(this: sqlite3.RunResult, err: Error | null) {
    cb(err, { lastID: this.lastID, changes: this.changes });
  });
});
const dbGet = promisify(db.get.bind(db)) as (sql: string, params?: unknown[]) => Promise<unknown>;
const dbAll = promisify(db.all.bind(db)) as (sql: string, params?: unknown[]) => Promise<unknown[]>;

async function initDb() {
  const exec = promisify(db.exec.bind(db));
  await exec(`
    CREATE TABLE IF NOT EXISTS decks (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      userId TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS cards (
      id TEXT PRIMARY KEY,
      front TEXT NOT NULL,
      back TEXT NOT NULL,
      deckId TEXT NOT NULL,
      intervalDays INTEGER DEFAULT 0,
      repetitions INTEGER DEFAULT 0,
      easeFactor REAL DEFAULT 2.5,
      nextReviewAt TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS reviewLogs (
      id TEXT PRIMARY KEY,
      cardId TEXT NOT NULL,
      rating INTEGER NOT NULL,
      reviewedAt TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS syncMeta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, '../renderer/index.html'));
  }
}

app.whenReady().then(async () => {
  await initDb();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// IPC handlers for local SQLite
ipcMain.handle('db:exec', async (_event, sql: string, params?: unknown[]) => {
  try {
    if (sql.trim().toLowerCase().startsWith('select')) {
      return dbAll(sql, params || []);
    }
    return dbRun(sql, params || []);
  } catch (err) {
    console.error('db:exec error', err);
    throw err;
  }
});

ipcMain.handle('db:get', async (_event, sql: string, params?: unknown[]) => {
  return dbGet(sql, params || []);
});

ipcMain.handle('db:all', async (_event, sql: string, params?: unknown[]) => {
  return dbAll(sql, params || []);
});
