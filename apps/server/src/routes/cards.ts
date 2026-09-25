import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { z } from 'zod';

const router = Router();
router.use(authMiddleware);

const CardInput = z.object({
  front: z.string().min(1),
  back: z.string().min(1),
  deckId: z.string().uuid(),
  intervalDays: z.number().int().min(0).optional(),
  repetitions: z.number().int().min(0).optional(),
  easeFactor: z.number().min(1.3).optional(),
  nextReviewAt: z.string().datetime().nullable().optional(),
});

router.get('/deck/:deckId', async (req: AuthRequest, res) => {
  const cards = await prisma.card.findMany({
    where: { deckId: req.params.deckId, userId: req.userId },
    orderBy: { createdAt: 'desc' },
  });
  res.json(cards);
});

router.get('/due', async (req: AuthRequest, res) => {
  const now = new Date();
  const cards = await prisma.card.findMany({
    where: {
      userId: req.userId,
      OR: [{ nextReviewAt: { lte: now } }, { nextReviewAt: null }],
    },
    include: { deck: true },
    orderBy: { nextReviewAt: 'asc' },
  });
  res.json(cards);
});

router.post('/', async (req: AuthRequest, res) => {
  const parsed = CardInput.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.format() });
    return;
  }
  const card = await prisma.card.create({
    data: { ...parsed.data, userId: req.userId! },
  });
  res.status(201).json(card);
});

router.put('/:id', async (req: AuthRequest, res) => {
  const parsed = CardInput.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.format() });
    return;
  }
  const updated = await prisma.card.updateMany({
    where: { id: req.params.id, userId: req.userId },
    data: parsed.data,
  });
  if (updated.count === 0) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  const card = await prisma.card.findUnique({ where: { id: req.params.id } });
  res.json(card);
});

router.delete('/:id', async (req: AuthRequest, res) => {
  await prisma.card.deleteMany({
    where: { id: req.params.id, userId: req.userId },
  });
  res.status(204).send();
});

export default router;
