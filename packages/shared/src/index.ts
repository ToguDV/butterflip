import { z } from 'zod';

export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().min(1).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const DeckSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().optional(),
  userId: z.string().uuid().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const CardSchema = z.object({
  id: z.string().uuid(),
  front: z.string().min(1),
  back: z.string().min(1),
  deckId: z.string().uuid(),
  userId: z.string().uuid().optional(),
  intervalDays: z.number().int().min(0).default(0),
  repetitions: z.number().int().min(0).default(0),
  easeFactor: z.number().min(1.3).default(2.5),
  nextReviewAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const ReviewLogSchema = z.object({
  id: z.string().uuid(),
  cardId: z.string().uuid(),
  rating: z.number().int().min(0).max(3),
  reviewedAt: z.string().datetime(),
  createdAt: z.string().datetime(),
});

export const SyncCheckpointSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  deviceId: z.string().min(1),
  lastSyncedAt: z.string().datetime(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const SyncRequestSchema = z.object({
  deviceId: z.string().min(1),
  lastSyncedAt: z.string().datetime().optional(),
  decks: z.array(DeckSchema.partial().merge(z.object({ id: z.string().uuid() }))),
  cards: z.array(CardSchema.partial().merge(z.object({ id: z.string().uuid() }))),
  reviewLogs: z.array(ReviewLogSchema),
});

export const SyncResponseSchema = z.object({
  serverTime: z.string().datetime(),
  decks: z.array(DeckSchema),
  cards: z.array(CardSchema),
  reviewLogs: z.array(ReviewLogSchema),
});

export type User = z.infer<typeof UserSchema>;
export type Deck = z.infer<typeof DeckSchema>;
export type Card = z.infer<typeof CardSchema>;
export type ReviewLog = z.infer<typeof ReviewLogSchema>;
export type SyncCheckpoint = z.infer<typeof SyncCheckpointSchema>;
export type SyncRequest = z.infer<typeof SyncRequestSchema>;
export type SyncResponse = z.infer<typeof SyncResponseSchema>;
