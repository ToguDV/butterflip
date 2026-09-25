// Iconos lineales del sistema Soft Pop (extraídos de design/index.html).
// SVGs inline para no depender de sprites externos.

export type IconName =
  | 'cards'
  | 'plus'
  | 'grid'
  | 'layers'
  | 'play'
  | 'sun'
  | 'moon'
  | 'trash'
  | 'clock'
  | 'flame'
  | 'target'
  | 'book'
  | 'flip'
  | 'grip'
  | 'check'
  | 'arrow-left';

const PATHS: Record<IconName, React.ReactNode> = {
  cards: (
    <>
      <rect x="3.5" y="5.5" width="17" height="13" rx="2.5" />
      <path d="M7.5 15.5h5M7.5 11.5h9" />
    </>
  ),
  plus: <path d="M12 5.5v13M5.5 12h13" />,
  grid: (
    <>
      <rect x="4.5" y="4.5" width="6.5" height="6.5" rx="2" />
      <rect x="13" y="4.5" width="6.5" height="6.5" rx="2" />
      <rect x="4.5" y="13" width="6.5" height="6.5" rx="2" />
      <rect x="13" y="13" width="6.5" height="6.5" rx="2" />
    </>
  ),
  layers: (
    <>
      <path d="M12 3.5l8.5 4.5L12 12.5 3.5 8z" />
      <path d="M3.5 12.5L12 17l8.5-4.5" />
    </>
  ),
  play: <path d="M8 5.5l10 6.5-10 6.5z" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.4 5.4l1.7 1.7M16.9 16.9l1.7 1.7M18.6 5.4l-1.7 1.7M7.1 16.9l-1.7 1.7" />
    </>
  ),
  moon: <path d="M20 14.6A8.6 8.6 0 0 1 9.4 4 8.6 8.6 0 1 0 20 14.6z" />,
  trash: <path d="M4.5 7h15M10 7V4.8h4V7M7.2 7l.9 13.2h7.8L16.8 7" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  flame: (
    <path d="M12 3.5c3.2 3 4.8 5.6 4.8 8.4a4.8 4.8 0 0 1-9.6 0c0-1.5.7-2.9 1.7-4 .2 1 .8 1.7 1.6 2 .1-2 .6-4 1.5-6.4z" />
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3.4" />
    </>
  ),
  book: (
    <>
      <path d="M5 4.5h9.5A2.5 2.5 0 0 1 17 7v12.5H7.5A2.5 2.5 0 0 1 5 17z" />
      <path d="M5 17a2.5 2.5 0 0 1 2.5-2.5H17" />
    </>
  ),
  flip: (
    <>
      <path d="M4.5 8.5h15M16 5l3.5 3.5L16 12M19.5 15.5h-15M8 12l-3.5 3.5L8 19" />
    </>
  ),
  grip: (
    <>
      <circle cx="9.5" cy="6" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="14.5" cy="6" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="9.5" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="14.5" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="9.5" cy="18" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="14.5" cy="18" r="1.5" fill="currentColor" stroke="none" />
    </>
  ),
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  'arrow-left': <path d="M19.5 12h-15M10 5.5L3.5 12 10 18.5" />,
};

interface IconProps {
  name: IconName;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export default function Icon({ name, size = 'md', className }: IconProps) {
  const cls = ['i', size === 'sm' && 'i--sm', size === 'lg' && 'i--lg', className]
    .filter(Boolean)
    .join(' ');
  return (
    <svg className={cls} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {PATHS[name]}
    </svg>
  );
}
