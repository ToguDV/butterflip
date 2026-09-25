import { useEffect, useState } from 'react';
import { Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import Home from './pages/Home';
import DeckEditor from './pages/DeckEditor';
import Study from './pages/Study';
import Icon, { type IconName } from './components/Icon';

type Theme = 'light' | 'dark';

const THEME_KEY = 'flashcards-theme';

export default function App() {
  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem(THEME_KEY) as Theme | null) || 'light';
  });
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  const activeTab =
    location.pathname.startsWith('/deck') ? 'decks'
    : location.pathname.startsWith('/study') ? 'study'
    : 'dashboard';

  // El tab "Decks" lleva al dashboard y hace scroll a la sección de mazos.
  async function goDecks() {
    if (location.pathname !== '/') navigate('/');
    requestAnimationFrame(() => {
      document.getElementById('decks')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  return (
    <>
      <header className="topbar">
        <Link className="brand" to="/">
          <span className="brand__mark">
            <Icon name="cards" />
          </span>
          <span>Flashcards</span>
          <span className="brand__tag">local first</span>
        </Link>
        <div className="seg" role="group" aria-label="Theme">
          <button
            type="button"
            aria-pressed={theme === 'light'}
            onClick={() => setTheme('light')}
          >
            <Icon name="sun" size="sm" />Light
          </button>
          <button
            type="button"
            aria-pressed={theme === 'dark'}
            onClick={() => setTheme('dark')}
          >
            <Icon name="moon" size="sm" />Dark
          </button>
        </div>
      </header>

      <main className="doc">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/deck/:deckId" element={<DeckEditor />} />
          <Route path="/study" element={<Study />} />
        </Routes>
      </main>

      <nav className="tabbar" aria-label="Main navigation">
        <TabItem icon="grid" label="Dashboard" active={activeTab === 'dashboard'} to="/" />
        <TabItem icon="play" label="Study" active={activeTab === 'study'} to="/study" />
        <button
          type="button"
          className="tab"
          aria-current={activeTab === 'decks' ? 'page' : undefined}
          onClick={goDecks}
        >
          <Icon name="layers" />
          <span className="tab__label">Decks</span>
        </button>
      </nav>
    </>
  );
}

interface TabItemProps {
  icon: IconName;
  label: string;
  active: boolean;
  to: string;
}

function TabItem({ icon, label, active, to }: TabItemProps) {
  return (
    <Link
      to={to}
      className="tab"
      aria-current={active ? 'page' : undefined}
    >
      <Icon name={icon} />
      <span className="tab__label">{label}</span>
    </Link>
  );
}
