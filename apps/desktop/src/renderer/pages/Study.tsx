import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDueCards, getDecks, updateCard, addReviewLog } from '../db/localDb';
import { computeNextReview } from '../srs/engine';
import Icon from '../components/Icon';
import SwipeCard, { type SwipeDirection } from '../components/SwipeCard';
import type { Card, Deck } from '@flashcards/shared';

// La UI de swipe es binaria: izquierda = fallaste, derecha = la sabías.
const AGAIN = 0;
const GOOD = 2;

// Monograma: iniciales del mazo (dos letras).
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '··';
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
}

export default function Study() {
  const [cards, setCards] = useState<Card[]>([]);
  const [decks, setDecks] = useState<Deck[]>([]);
  const [index, setIndex] = useState(0);
  const [showBack, setShowBack] = useState(false);
  const [finished, setFinished] = useState(false);
  const navigate = useNavigate();

  async function load() {
    const [due, deckList] = await Promise.all([getDueCards(), getDecks()]);
    setDecks(deckList);
    if (due.length === 0) {
      setFinished(true);
      setCards([]);
    } else {
      setCards(due);
      setIndex(0);
      setShowBack(false);
      setFinished(false);
    }
  }

  useEffect(() => { load(); }, []);

  const card = cards[index];
  const deckName = card ? decks.find((d) => d.id === card.deckId)?.name ?? 'Study session' : 'Study session';

  const handleRate = useCallback(async (rating: number) => {
    const current = cards[index];
    if (!current) return;
    await addReviewLog(current.id, rating);
    const updates = computeNextReview(current, rating);
    await updateCard(current.id, updates);
    if (index + 1 >= cards.length) {
      setFinished(true);
    } else {
      setIndex(index + 1);
      setShowBack(false);
    }
  }, [cards, index]);

  const handleSwipe = useCallback((direction: SwipeDirection) => {
    void handleRate(direction === 'left' ? AGAIN : GOOD);
  }, [handleRate]);

  // Atajos: Space voltea, ←/→ califican como el swipe.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (finished) return;
      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        if (!showBack) setShowBack(true);
        return;
      }
      if (showBack && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        e.preventDefault();
        void handleRate(e.key === 'ArrowLeft' ? AGAIN : GOOD);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [finished, showBack, handleRate]);

  if (finished) {
    return (
      <div className="view">
        <div className="session">
          <section className="card">
            <header className="card__head">
              <h2>All caught up! 🎉</h2>
              <span className="card__meta">No cards due for review</span>
            </header>
            <p className="empty">Come back when your cards are due again.</p>
            <button className="btn btn--primary" type="button" onClick={load}>
              <Icon name="check" size="sm" />Check again
            </button>
          </section>
        </div>
      </div>
    );
  }

  if (!card) return <div className="view"><p className="empty">Loading…</p></div>;

  const deck = decks.find((d) => d.id === card.deckId);
  const progress = Math.round((index / cards.length) * 100);
  const monogramColor = 'var(--coral)';

  return (
    <div className="view">
      <div className="page-head">
        <div>
          <p className="overline">Study session</p>
          <h1 className="page-title">{deckName}</h1>
        </div>
        <div className="page-actions">
          <button className="btn btn--ghost btn--compact" type="button" onClick={() => navigate('/')}>
            End session
          </button>
        </div>
      </div>

      <div className="session">
        <div className="session__head">
          <span className="monogram" style={{ '--c': monogramColor } as React.CSSProperties}>
            {initials(deckName)}
          </span>
          <span className="session__title">{deck?.name ?? 'Study session'}</span>
          <span className="session__meta">Card {index + 1} of {cards.length}</span>
        </div>
        <div className="progress"><i style={{ width: `${progress}%` }} /></div>

        <div className="study-grid">
          <SwipeCard key={card.id} disabled={!showBack} onSwipe={handleSwipe}>
            <p className="overline">Front</p>
            <h2 className="studycard__q">{card.front}</h2>
            {showBack ? (
              <>
                <hr className="studycard__rule" />
                <p className="overline">Answer</p>
                <p className="studycard__a">{card.back}</p>
                <div className="swipehint">
                  <div className="swipehint__row">
                    <button
                      className="swipehint__btn swipehint__btn--again"
                      type="button"
                      onClick={() => void handleRate(AGAIN)}
                    >
                      <Icon name="arrow-left" size="sm" />
                      <span>Again</span>
                      <small>{computeNextReview(card, AGAIN).intervalDays}d</small>
                    </button>
                    <button
                      className="swipehint__btn swipehint__btn--good"
                      type="button"
                      onClick={() => void handleRate(GOOD)}
                    >
                      <small>{computeNextReview(card, GOOD).intervalDays}d</small>
                      <span>Good</span>
                      <Icon name="arrow-right" size="sm" />
                    </button>
                  </div>
                  <p className="swipehint__note">
                    Swipe the card left or right · <span className="kbd">←</span>
                    <span className="kbd">→</span> keys
                  </p>
                </div>
              </>
            ) : (
              <button className="btn btn--primary btn--reveal" type="button" onClick={() => setShowBack(true)}>
                <Icon name="flip" size="sm" />Show answer
              </button>
            )}
          </SwipeCard>
        </div>
      </div>
    </div>
  );
}
