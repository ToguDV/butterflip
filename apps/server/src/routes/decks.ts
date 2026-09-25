import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { z } from 'zod';

const router = Router();
router.use(authMiddleware);

const DeckInput = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});

router.get('/', async (req: AuthRequest, res) => {
  const decks = await prisma.deck.findMany({
    where: { userId: req.userId },
    include: { _count: { select: { cards: true } } },
    orderBy: { updatedAt: 'desc' },
  });
  res.json(decks);
});

router.post('/', async (req: AuthRequest, res) => {
  const parsed = DeckInput.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.format() });
    return;
  }
  const deck = await prisma.deck.create({
    data: { ...parsed.data, userId: req.userId! },
  });
  res.status(201).json(deck);
});

router.put('/:id', async (req: AuthRequest, res) => {
  const parsed = DeckInput.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.format() });
    return;
  }
  const deck = await prisma.deck.updateMany({
    where: { id: req.params.id, userId: req.userId },
    data: parsed.data,
  });
  if (deck.count === 0) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  const updated = await prisma.deck.findUnique({ where: { id: req.params.id } });
  res.json(updated);
});

router.delete('/:id', async (req: AuthRequest, res) => {
  await prisma.deck.deleteMany({
    where: { id: req.params.id, userId: req.userId },
  });
  res.status(204).send();
});

export default router;
