import { getDecks, getCardsByDeck, getReviewLogs, getSyncMeta, setSyncMeta, exec } from '../db/localDb';
import type { Deck, Card, ReviewLog, SyncRequest, SyncResponse } from '@flashcards/shared';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export async function syncWithServer(token: string, deviceId: string): Promise<SyncResponse | null> {
  const lastSyncedAt = (await getSyncMeta('lastSyncedAt')) || undefined;
  const decks = await getDecks();
  const cards: Card[] = [];
  for (const d of decks) {
    cards.push(...(await getCardsByDeck(d.id)));
  }
  const reviewLogs = await getReviewLogs();

  const payload: SyncRequest = {
    deviceId,
    lastSyncedAt,
    decks,
    cards,
    reviewLogs,
  };

  const res = await fetch(`${API_URL}/sync`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    console.error('Sync failed', await res.text());
    return null;
  }

  const data: SyncResponse = await res.json();

  // Apply server changes locally
  for (const d of data.decks) {
    await exec(
      'INSERT OR REPLACE INTO decks (id, name, description, userId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)',
      [d.id, d.name, d.description || null, d.userId, d.createdAt, d.updatedAt]
    );
  }
  for (const c of data.cards) {
    await exec(
      'INSERT OR REPLACE INTO cards (id, front, back, deckId, intervalDays, repetitions, easeFactor, nextReviewAt, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [c.id, c.front, c.back, c.deckId, c.intervalDays, c.repetitions, c.easeFactor, c.nextReviewAt, c.createdAt, c.updatedAt]
    );
  }
  for (const l of data.reviewLogs) {
    await exec(
      'INSERT OR REPLACE INTO reviewLogs (id, cardId, rating, reviewedAt, createdAt) VALUES (?, ?, ?, ?, ?)',
      [l.id, l.cardId, l.rating, l.reviewedAt, l.createdAt]
    );
  }

  await setSyncMeta('lastSyncedAt', data.serverTime);
  return data;
}
