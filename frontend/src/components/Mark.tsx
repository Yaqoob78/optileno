import { Link } from 'react-router-dom';

/** Optileno mark: two corners of a frame and a red dot inside it. Everything inside the lines. */
export function Mark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3 9.5V5a2 2 0 0 1 2-2h4.5" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" />
      <path d="M21 14.5V19a2 2 0 0 1-2 2h-4.5" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" />
      <circle cx="12" cy="12" r="3.7" fill="var(--accent)" />
    </svg>
  );
}

export function Wordmark({ to = '/', size = 22 }: { to?: string; size?: number }) {
  return (
    <Link to={to} className="wordmark" aria-label="Optileno home">
      <Mark size={size} />
      <span>Optileno</span>
    </Link>
  );
}
