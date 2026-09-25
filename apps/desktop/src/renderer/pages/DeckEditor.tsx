import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getCardsByDeck, createCard, deleteCard, updateDeck, deleteDeck, getDecks } from '../db/localDb';
import Icon from '../components/Icon';
import type { Card, Deck } from '@flashcards/shared';

// Monograma: iniciales del mazo (dos letras).
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '··';
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
}

export default function DeckEditor() {
  const { deckId } = useParams<{ deckId: string }>();
  const navigate = useNavigate();
  const [deck, setDeck] = useState<Deck | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');

  async function load() {
    if (!deckId) return;
    const decks = await getDecks();
    setDeck(decks.find((d) => d.id === deckId) || null);
    const c = await getCardsByDeck(deckId);
    setCards(c);
  }

  useEffect(() => { load(); }, [deckId]);

  async function handleAdd() {
    if (!deckId || !front.trim() || !back.trim()) return;
    await createCard(front.trim(), back.trim(), deckId);
    setFront('');
    setBack('');
    await load();
  }

  async function handleDeleteCard(id: string) {
    if (!confirm('Delete card?')) return;
    await deleteCard(id);
    await load();
  }

  async function handleRename() {
    const name = prompt('New deck name', deck?.name);
    if (!name || !deckId) return;
    await updateDeck(deckId, { name });
    await load();
  }

  async function handleDeleteDeck() {
    if (!deckId || !deck) return;
    if (!confirm(`Delete "${deck.name}" and all its cards?`)) return;
    await deleteDeck(deckId);
    navigate('/');
  }

  if (!deck) return <div className="view"><p className="empty">Deck not found.</p></div>;

  const now = Date.now();
  const dueCount = cards.filter(
    (c) => !c.nextReviewAt || new Date(c.nextReviewAt).getTime() <= now
  ).length;

  return (
    <div className="view">
      <div className="page-head">
        <div className="page-head__title">
          <span className="monogram monogram--lg" style={{ '--c': 'var(--coral)' } as React.CSSProperties}>
            {initials(deck.name)}
          </span>
          <div>
            <p className="overline">Deck</p>
            <h1 className="page-title">{deck.name}</h1>
            <p className="page-sub">
              {cards.length} cards · {dueCount} due today
            </p>
          </div>
        </div>
        <div className="page-actions">
          <button className="btn btn--secondary btn--compact" type="button" onClick={handleRename}>
            Rename
          </button>
          <button className="btn btn--danger btn--compact" type="button" onClick={handleDeleteDeck}>
            <Icon name="trash" size="sm" />Delete deck
          </button>
          <button
            className="btn btn--primary"
            type="button"
            disabled={dueCount === 0}
            onClick={() => navigate('/study')}
          >
            <Icon name="play" size="sm" />Study {dueCount} due
          </button>
        </div>
      </div>

      <section className="card">
        <header className="card__head">
          <h2>Add card</h2>
          <span className="card__meta">Enter to save</span>
        </header>
        <div className="addcard">
          <div className="field">
            <label className="field__label" htmlFor="card-front">Front</label>
            <input
              className="input"
              id="card-front"
              type="text"
              placeholder="What does `this` bind to?"
              value={front}
              onChange={(e) => setFront(e.target.value)}
            />
          </div>
          <div className="field">
            <label className="field__label" htmlFor="card-back">Back</label>
            <input
              className="input"
              id="card-back"
              type="text"
              placeholder="Depends on the call site…"
              value={back}
              onChange={(e) => setBack(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
            />
          </div>
          <button className="btn btn--primary" type="button" onClick={handleAdd}>
            <Icon name="plus" size="sm" />Add card
          </button>
        </div>
      </section>

      <section className="card">
        <header className="card__head">
          <h2>Cards</h2>
          <span className="card__meta">{cards.length} total · {dueCount} due today</span>
        </header>
        {cards.length === 0 ? (
          <p className="empty">No cards yet — add the first one above.</p>
        ) : (
          <ul className="cardlist">
            {cards.map((c) => {
              const isDue = !c.nextReviewAt || new Date(c.nextReviewAt).getTime() <= now;
              return (
                <li className="cardrow" key={c.id}>
                  <div className="cardrow__body">
                    <p className="cardrow__front">{c.front}</p>
                    <p className="cardrow__back">{c.back}</p>
                  </div>
                  <div className="cardrow__meta">
                    <span className={`chip ${c.repetitions === 0 ? 'chip--new' : isDue ? 'chip--due' : 'chip--done'}`}>
                      {c.repetitions === 0 ? 'new' : isDue ? 'due today' : 'reviewed'}
                    </span>
                    <span className="chip chip--outline">ease {c.easeFactor}</span>
                    <button
                      className="btn btn--ghost btn--icon btn--compact"
                      type="button"
                      aria-label="Delete card"
                      onClick={() => handleDeleteCard(c.id)}
                    >
                      <Icon name="trash" size="sm" className="i--error" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
