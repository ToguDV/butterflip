import { v4 as uuidv4 } from 'uuid';
import type { Deck, Card, ReviewLog } from '@flashcards/shared';

export async function exec(sql: string, params?: unknown[]) {
  return window.electronAPI.dbExec(sql, params);
}

export async function get<T>(sql: string, params?: unknown[]): Promise<T | undefined> {
  return window.electronAPI.dbGet(sql, params) as Promise<T | undefined>;
}

export async function all<T>(sql: string, params?: unknown[]): Promise<T[]> {
  return window.electronAPI.dbAll(sql, params) as Promise<T[]>;
}

export async function createDeck(name: string, description?: string, userId?: string): Promise<Deck> {
  const id = uuidv4();
  const now = new Date().toISOString();
  await exec(
    'INSERT INTO decks (id, name, description, userId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)',
    [id, name, description || null, userId || null, now, now]
  );
  return { id, name, description, userId, createdAt: now, updatedAt: now };
}

export async function getDecks(): Promise<Deck[]> {
  return all<Deck>('SELECT * FROM decks ORDER BY updatedAt DESC');
}

export async function updateDeck(id: string, data: Partial<Pick<Deck, 'name' | 'description'>>) {
  const sets: string[] = [];
  const vals: unknown[] = [];
  if (data.name !== undefined) { sets.push('name = ?'); vals.push(data.name); }
  if (data.description !== undefined) { sets.push('description = ?'); vals.push(data.description); }
  sets.push('updatedAt = ?');
  vals.push(new Date().toISOString());
  vals.push(id);
  await exec(`UPDATE decks SET ${sets.join(', ')} WHERE id = ?`, vals);
}

export async function deleteDeck(id: string) {
  await exec('DELETE FROM decks WHERE id = ?', [id]);
  await exec('DELETE FROM cards WHERE deckId = ?', [id]);
}

export async function createCard(front: string, back: string, deckId: string, userId?: string): Promise<Card> {
  const id = uuidv4();
  const now = new Date().toISOString();
  await exec(
    'INSERT INTO cards (id, front, back, deckId, intervalDays, repetitions, easeFactor, nextReviewAt, createdAt, updatedAt) VALUES (?, ?, ?, ?, 0, 0, 2.5, ?, ?, ?)',
    [id, front, back, deckId, null, now, now]
  );
  return { id, front, back, deckId, intervalDays: 0, repetitions: 0, easeFactor: 2.5, nextReviewAt: null, createdAt: now, updatedAt: now };
}

export async function getCardsByDeck(deckId: string): Promise<Card[]> {
  return all<Card>('SELECT * FROM cards WHERE deckId = ? ORDER BY createdAt DESC', [deckId]);
}

export async function getDueCards(): Promise<Card[]> {
  const now = new Date().toISOString();
  return all<Card>(
    'SELECT * FROM cards WHERE nextReviewAt IS NULL OR nextReviewAt <= ? ORDER BY nextReviewAt ASC',
    [now]
  );
}

export async function updateCard(id: string, data: Partial<Pick<Card, 'front' | 'back' | 'intervalDays' | 'repetitions' | 'easeFactor' | 'nextReviewAt'>>) {
  const sets: string[] = [];
  const vals: unknown[] = [];
  if (data.front !== undefined) { sets.push('front = ?'); vals.push(data.front); }
  if (data.back !== undefined) { sets.push('back = ?'); vals.push(data.back); }
  if (data.intervalDays !== undefined) { sets.push('intervalDays = ?'); vals.push(data.intervalDays); }
  if (data.repetitions !== undefined) { sets.push('repetitions = ?'); vals.push(data.repetitions); }
  if (data.easeFactor !== undefined) { sets.push('easeFactor = ?'); vals.push(data.easeFactor); }
  if (data.nextReviewAt !== undefined) { sets.push('nextReviewAt = ?'); vals.push(data.nextReviewAt); }
  sets.push('updatedAt = ?');
  vals.push(new Date().toISOString());
  vals.push(id);
  await exec(`UPDATE cards SET ${sets.join(', ')} WHERE id = ?`, vals);
}

export async function deleteCard(id: string) {
  await exec('DELETE FROM cards WHERE id = ?', [id]);
}

export async function addReviewLog(cardId: string, rating: number): Promise<ReviewLog> {
  const id = uuidv4();
  const now = new Date().toISOString();
  await exec(
    'INSERT INTO reviewLogs (id, cardId, rating, reviewedAt, createdAt) VALUES (?, ?, ?, ?, ?)',
    [id, cardId, rating, now, now]
  );
  return { id, cardId, rating, reviewedAt: now, createdAt: now };
}

export async function getReviewLogs(): Promise<ReviewLog[]> {
  return all<ReviewLog>('SELECT * FROM reviewLogs ORDER BY reviewedAt DESC');
}

export async function getReviewLogsByDate(): Promise<Record<string, number>> {
  const rows = await all<{ date: string; count: number }>(
    "SELECT DATE(reviewedAt) as date, COUNT(*) as count FROM reviewLogs GROUP BY DATE(reviewedAt)"
  );
  const map: Record<string, number> = {};
  for (const r of rows) map[r.date] = r.count;
  return map;
}

export async function getSyncMeta(key: string): Promise<string | undefined> {
  const row = await get<{ value: string }>('SELECT value FROM syncMeta WHERE key = ?', [key]);
  return row?.value;
}

export async function setSyncMeta(key: string, value: string) {
  await exec('INSERT OR REPLACE INTO syncMeta (key, value) VALUES (?, ?)', [key, value]);
}
