import type { Card } from '@flashcards/shared';

const INTERVALS = [1, 3, 7, 14, 30, 60, 120, 240];

export function computeNextReview(card: Card, rating: number): Partial<Card> {
  // rating: 0=Again, 1=Hard, 2=Good, 3=Easy
  let repetitions = card.repetitions;
  let intervalDays = card.intervalDays;

  if (rating >= 2) {
    repetitions = Math.min(repetitions + 1, INTERVALS.length - 1);
    intervalDays = INTERVALS[repetitions];
  } else {
    repetitions = Math.max(0, repetitions - 1);
    intervalDays = INTERVALS[repetitions];
  }

  const nextReviewAt = new Date(Date.now() + intervalDays * 24 * 60 * 60 * 1000).toISOString();
  return { repetitions, intervalDays, nextReviewAt };
}
