import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDueCards, getDecks, updateCard, addReviewLog } from '../db/localDb';
import { computeNextReview } from '../srs/engine';
import Icon from '../components/Icon';
import type { Card, Deck } from '@flashcards/shared';

const RATE_BUTTONS = [
  { rating: 0, label: 'Again', c: 'var(--error)', tc: undefined },
  { rating: 1, label: 'Hard', c: 'var(--butter)', tc: 'var(--ink)' },
  { rating: 2, label: 'Good', c: 'var(--success)', tc: undefined },
  { rating: 3, label: 'Easy', c: 'var(--blue-ink)', tc: undefined },
] as const;

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

  // Atajos del design: Space voltea, 1–4 califican.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (finished) return;
      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        if (!showBack) setShowBack(true);
        return;
      }
      if (showBack && ['1', '2', '3', '4'].includes(e.key)) {
        void handleRate(Number(e.key));
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
          <article className="studycard">
            <p className="overline">Front</p>
            <h2 className="studycard__q">{card.front}</h2>
            {showBack && (
              <>
                <hr className="studycard__rule" />
                <p className="overline">Answer</p>
                <p className="studycard__a">{card.back}</p>
                <div className="rate">
                  {RATE_BUTTONS.map(({ rating, label, c, tc }) => (
                    <button
                      key={rating}
                      className="rate__btn"
                      type="button"
                      style={{ '--c': c, ...(tc ? { '--tc': tc } : {}) } as React.CSSProperties}
                      onClick={() => void handleRate(rating)}
                    >
                      {label}
                      <small>{computeNextReview(card, rating).intervalDays}d</small>
                    </button>
                  ))}
                </div>
                <footer className="studycard__foot">
                  <span className="kbd">1</span><span className="kbd">2</span>
                  <span className="kbd">3</span><span className="kbd">4</span>rate
                  <span className="kbd">Space</span>flip
                </footer>
              </>
            )}
          </article>

          <aside className="sidepanel">
            {showBack ? (
              <>
                <p className="panel__label" style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>
                  Revealed
                </p>
                <p className="sidepanel__q">{card.front}</p>
                <p className="sidepanel__hint"><span className="kbd">1</span>–<span className="kbd">4</span>to rate</p>
              </>
            ) : (
              <>
                <p className="overline">Before reveal</p>
                <p className="sidepanel__hint" style={{ justifyContent: 'flex-start', margin: '4px 0 0' }}>
                  Front only · no answer visible
                </p>
                <p className="sidepanel__q">{card.front}</p>
                <button className="btn btn--primary" type="button" onClick={() => setShowBack(true)}>
                  <Icon name="flip" size="sm" />Show answer
                </button>
                <p className="sidepanel__hint"><span className="kbd">Space</span>to reveal</p>
              </>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
