import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { SyncRequestSchema } from '@flashcards/shared';

const router = Router();
router.use(authMiddleware);

router.post('/', async (req: AuthRequest, res) => {
  const parsed = SyncRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.format() });
    return;
  }
  const { deviceId, lastSyncedAt, decks: clientDecks, cards: clientCards, reviewLogs: clientLogs } = parsed.data;
  const userId = req.userId!;

  // Upsert client changes (last-write-wins) - enforce userId from token
  for (const d of clientDecks) {
    await prisma.deck.upsert({
      where: { id: d.id },
      update: { name: d.name, description: d.description, userId, updatedAt: new Date() },
      create: { id: d.id, name: d.name || 'Untitled', description: d.description, userId },
    });
  }
  for (const c of clientCards) {
    await prisma.card.upsert({
      where: { id: c.id },
      update: {
        front: c.front,
        back: c.back,
        deckId: c.deckId || '',
        userId,
        intervalDays: c.intervalDays,
        repetitions: c.repetitions,
        easeFactor: c.easeFactor,
        nextReviewAt: c.nextReviewAt ? new Date(c.nextReviewAt) : null,
        updatedAt: new Date(),
      },
      create: {
        id: c.id,
        front: c.front || '',
        back: c.back || '',
        deckId: c.deckId || '',
        userId,
        intervalDays: c.intervalDays ?? 0,
        repetitions: c.repetitions ?? 0,
        easeFactor: c.easeFactor ?? 2.5,
        nextReviewAt: c.nextReviewAt ? new Date(c.nextReviewAt) : null,
      },
    });
  }
  for (const l of clientLogs) {
    await prisma.reviewLog.upsert({
      where: { id: l.id },
      update: { rating: l.rating, reviewedAt: new Date(l.reviewedAt) },
      create: { id: l.id, cardId: l.cardId, userId, rating: l.rating, reviewedAt: new Date(l.reviewedAt) },
    });
  }

  const after = lastSyncedAt ? new Date(lastSyncedAt) : new Date(0);

  const [decks, cards, reviewLogs] = await Promise.all([
    prisma.deck.findMany({ where: { userId, updatedAt: { gt: after } } }),
    prisma.card.findMany({ where: { userId, updatedAt: { gt: after } } }),
    prisma.reviewLog.findMany({ where: { userId, createdAt: { gt: after } } }),
  ]);

  const serverTime = new Date().toISOString();

  await prisma.syncCheckpoint.upsert({
    where: { userId_deviceId: { userId, deviceId } },
    update: { lastSyncedAt: serverTime },
    create: { userId, deviceId, lastSyncedAt: serverTime },
  });

  res.json({ serverTime, decks, cards, reviewLogs });
});

export default router;
