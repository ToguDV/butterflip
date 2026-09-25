import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { z } from 'zod';

const router = Router();
router.use(authMiddleware);

const ReviewInput = z.object({
  cardId: z.string().uuid(),
  rating: z.number().int().min(0).max(3),
});

router.post('/', async (req: AuthRequest, res) => {
  const parsed = ReviewInput.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.format() });
    return;
  }
  const { cardId, rating } = parsed.data;

  const card = await prisma.card.findFirst({
    where: { id: cardId, userId: req.userId },
  });
  if (!card) {
    res.status(404).json({ error: 'Card not found' });
    return;
  }

  const log = await prisma.reviewLog.create({
    data: { cardId, userId: req.userId!, rating, reviewedAt: new Date() },
  });

  // Simple SRS update on server (last-write-wins fallback)
  const intervals = [1, 3, 7, 14, 30, 60, 120];
  let nextReviewAt: Date | null = null;
  let repetitions = card.repetitions;
  if (rating >= 2) {
    repetitions = Math.min(repetitions + 1, intervals.length - 1);
    nextReviewAt = new Date(Date.now() + intervals[repetitions] * 24 * 60 * 60 * 1000);
  } else {
    repetitions = Math.max(0, repetitions - 1);
    nextReviewAt = new Date(Date.now() + intervals[repetitions] * 24 * 60 * 60 * 1000);
  }

  await prisma.card.update({
    where: { id: cardId },
    data: { repetitions, nextReviewAt, updatedAt: new Date() },
  });

  res.status(201).json(log);
});

export default router;
