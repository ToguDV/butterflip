import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDecks, createDeck, getCardsByDeck, getDueCards, getReviewLogs, getReviewLogsByDate } from '../db/localDb';
import Heatmap from '../components/Heatmap';
import Icon from '../components/Icon';
import type { Deck } from '@flashcards/shared';

// Colores de tile del sistema: azul maíz → coral → butter, ciclando por índice.
const TILE_VARIANTS = ['blue', 'coral', 'butter'] as const;

interface DeckStat {
  total: number;
  due: number;
}

export default function Home() {
  const [decks, setDecks] = useState<Deck[]>([]);
  const [stats, setStats] = useState<Record<string, DeckStat>>({});
  const [heatmapData, setHeatmapData] = useState<Record<string, number>>({});
  const [dueCount, setDueCount] = useState(0);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [newName, setNewName] = useState('');
  const navigate = useNavigate();

  async function load() {
    const [d, due, heat, logs] = await Promise.all([
      getDecks(),
      getDueCards(),
      getReviewLogsByDate(),
      getReviewLogs(),
    ]);
    setDecks(d);
    setDueCount(due.length);
    setHeatmapData(heat);
    if (logs.length > 0) {
      const good = logs.filter((l) => l.rating >= 2).length;
      setAccuracy(Math.round((good / logs.length) * 100));
    } else {
      setAccuracy(null);
    }

    const perDeck: Record<string, DeckStat> = {};
    await Promise.all(
      d.map(async (deck) => {
        const cards = await getCardsByDeck(deck.id);
        const now = Date.now();
        const dueInDeck = cards.filter(
          (c) => !c.nextReviewAt || new Date(c.nextReviewAt).getTime() <= now
        ).length;
        perDeck[deck.id] = { total: cards.length, due: dueInDeck };
      })
    );
    setStats(perDeck);
  }

  useEffect(() => { load(); }, []);

  async function handleCreate() {
    if (!newName.trim()) return;
    await createDeck(newName.trim());
    setNewName('');
    await load();
  }

  const today = useMemo(() => {
    const d = new Date();
    const reviewsToday = heatmapData[d.toISOString().split('T')[0]] || 0;
    return { label: d.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' }), reviewsToday };
  }, [heatmapData]);

  // Racha: días consecutivos con actividad terminando hoy.
  const streak = useMemo(() => {
    let s = 0;
    const d = new Date();
    for (;;) {
      const iso = d.toISOString().split('T')[0];
      if ((heatmapData[iso] || 0) > 0) {
        s += 1;
        d.setDate(d.getDate() - 1);
      } else {
        break;
      }
    }
    return s;
  }, [heatmapData]);

  const totalReviews = useMemo(
    () => Object.values(heatmapData).reduce((a, b) => a + b, 0),
    [heatmapData]
  );

  return (
    <div className="view">
      <div className="page-head">
        <div>
          <p className="overline">{today.label}</p>
          <h1 className="page-title">Dashboard</h1>
        </div>
        <div className="page-actions">
          <button className="btn btn--primary" type="button" onClick={() => navigate('/study')}>
            <Icon name="play" size="sm" />Study {dueCount} due
          </button>
        </div>
      </div>

      <div className="stats">
        <div className="stat">
          <p className="stat__label"><Icon name="clock" size="sm" />Due today</p>
          <p className="stat__value">{dueCount}</p>
        </div>
        <div className="stat">
          <p className="stat__label"><Icon name="flame" size="sm" />Streak</p>
          <p className="stat__value">{streak} <span className="stat__delta">days</span></p>
        </div>
        <div className="stat">
          <p className="stat__label"><Icon name="book" size="sm" />Reviews</p>
          <p className="stat__value">{totalReviews.toLocaleString('en-US')}</p>
        </div>
        <div className="stat">
          <p className="stat__label"><Icon name="target" size="sm" />Accuracy</p>
          <p className="stat__value">{accuracy === null ? '—' : accuracy}<span className="stat__delta">%</span></p>
        </div>
      </div>

      <section className="card">
        <header className="card__head">
          <h2>Activity</h2>
          <span className="card__meta">Last 12 months · {today.reviewsToday} reviews today</span>
        </header>
        <Heatmap data={heatmapData} />
      </section>

      <section className="card" id="decks">
        <header className="card__head">
          <h2>Decks</h2>
          <span className="card__meta">{decks.length} decks · {dueCount} due today</span>
        </header>
        <div className="newdeck">
          <input
            className="input"
            type="text"
            placeholder="New deck name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
          />
          <button className="btn btn--primary" type="button" onClick={handleCreate}>
            <Icon name="plus" size="sm" />Create
          </button>
        </div>
        {decks.length === 0 ? (
          <p className="empty">No decks yet — create your first one above.</p>
        ) : (
          <ul className="decklist">
            {decks.map((deck, i) => {
              const s = stats[deck.id] || { total: 0, due: 0 };
              const pct = s.total > 0 ? Math.round(((s.total - s.due) / s.total) * 100) : 0;
              const dueLabel = s.due > 0 ? `${s.due} due` : s.total > 0 ? 'up to date' : 'new';
              return (
                <li
                  key={deck.id}
                  className={`decktile decktile--${TILE_VARIANTS[i % TILE_VARIANTS.length]}`}
                >
                  <div className="decktile__head">
                    <button className="decktile__name" type="button" onClick={() => navigate(`/deck/${deck.id}`)}>
                      {deck.name}
                    </button>
                    <span className="decktile__due">{dueLabel}</span>
                  </div>
                  <p className="decktile__desc">{deck.description || 'No description'}</p>
                  <div className="decktile__foot">
                    <span className="progress"><i style={{ width: `${pct}%` }} /></span>
                    <span className="decktile__pct">{pct}%</span>
                    <button className="btn--tile" type="button" onClick={() => navigate(`/deck/${deck.id}`)}>
                      Open
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
