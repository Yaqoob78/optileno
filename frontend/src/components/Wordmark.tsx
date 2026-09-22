/** Optileno mark: a check inside a circle — the answer is yes, and you know it. */
export function Mark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="11" fill="var(--accent)" />
      <path d="M7.3 12.6l3.2 3.2 6.3-7.1" stroke="var(--accent-ink)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="wordmark">
      <Mark />
      <span className="serif">Optileno</span>
    </span>
  );
}
