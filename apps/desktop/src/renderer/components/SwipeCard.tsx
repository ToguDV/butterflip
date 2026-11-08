import { useEffect, useRef, useState } from 'react';

export type SwipeDirection = 'left' | 'right';

interface SwipeCardProps {
  children: React.ReactNode;
  disabled?: boolean;
  onSwipe: (direction: SwipeDirection) => void;
}

// Umbral en px para confirmar el swipe (mouse y touch comparten gesto).
const SWIPE_THRESHOLD = 96;
const EXIT_MS = 180;

/**
 * Tarjeta arrastrable estilo Tinder: sigue al puntero, se inclina y sale
 * hacia el lado elegido. Si no se pasa el umbral, vuelve a su lugar.
 * El componente padre decide qué significa cada dirección.
 */
export default function SwipeCard({ children, disabled = false, onSwipe }: SwipeCardProps) {
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const pointerId = useRef<number | null>(null);
  const startX = useRef(0);
  const currentDx = useRef(0);
  const leaving = useRef(false);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    };
  }, []);

  function reset() {
    if (leaving.current) return;
    pointerId.current = null;
    currentDx.current = 0;
    setDragging(false);
    setDx(0);
  }

  function commit(direction: SwipeDirection) {
    if (leaving.current) return;
    leaving.current = true;
    setDragging(false);
    // Lleva la tarjeta fuera del viewport antes de avisar al padre.
    setDx(direction === 'right' ? window.innerWidth : -window.innerWidth);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    timer.current = window.setTimeout(() => onSwipe(direction), reduced ? 0 : EXIT_MS);
  }

  function handlePointerDown(e: React.PointerEvent<HTMLElement>) {
    if (disabled || leaving.current) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    // Los botones de respaldo (Again/Good) no inician un swipe.
    if ((e.target as HTMLElement).closest('button, a, input, textarea, select')) return;

    pointerId.current = e.pointerId;
    startX.current = e.clientX;
    currentDx.current = 0;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLElement>) {
    if (pointerId.current !== e.pointerId || leaving.current) return;
    const next = e.clientX - startX.current;
    currentDx.current = next;
    setDx(next);
  }

  function handlePointerUp(e: React.PointerEvent<HTMLElement>) {
    if (pointerId.current !== e.pointerId || leaving.current) return;
    pointerId.current = null;
    setDragging(false);

    if (Math.abs(currentDx.current) >= SWIPE_THRESHOLD) {
      commit(currentDx.current < 0 ? 'left' : 'right');
    } else {
      pointerId.current = null;
      reset();
    }
  }

  const progress = Math.min(1, Math.abs(dx) / SWIPE_THRESHOLD);
  const leftProgress = dx < 0 ? progress : 0;
  const rightProgress = dx > 0 ? progress : 0;
  const rotation = Math.max(-9, Math.min(9, dx / 16));
  const enabled = !disabled;

  return (
    <div className="swipecard">
      <span
        className="swipecard__badge swipecard__badge--again"
        style={{ opacity: enabled ? leftProgress : 0 }}
        aria-hidden="true"
      >
        Again
      </span>
      <span
        className="swipecard__badge swipecard__badge--good"
        style={{ opacity: enabled ? rightProgress : 0 }}
        aria-hidden="true"
      >
        Good
      </span>
      <article
        className={`studycard${enabled ? ' studycard--swipe' : ''}${dragging ? ' is-dragging' : ''}`}
        style={{ transform: `translate3d(${dx}px, 0, 0) rotate(${rotation}deg)` }}
        role="group"
        aria-label={enabled ? 'Swipe left for Again or right for Good' : undefined}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={reset}
      >
        {children}
      </article>
    </div>
  );
}
