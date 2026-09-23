import type { ReactNode } from 'react';

type Arrow = 'down-left' | 'down-right' | 'left' | 'up-left' | 'none';

const PATHS: Record<Exclude<Arrow, 'none'>, { d: string; head: string; box: string }> = {
  'down-left': { d: 'M70 6 C 76 30, 60 52, 22 62', head: 'M30 52 L 20 63 L 34 68', box: '0 0 90 76' },
  'down-right': { d: 'M14 6 C 8 30, 26 52, 64 62', head: 'M56 52 L 66 63 L 52 68', box: '0 0 90 76' },
  left: { d: 'M84 30 C 64 18, 40 20, 10 34', head: 'M20 24 L 8 35 L 22 42', box: '0 0 92 50' },
  'up-left': { d: 'M72 64 C 70 40, 52 18, 16 12', head: 'M26 4 L 14 12 L 26 22', box: '0 0 90 74' },
};

/** A handwritten margin note, drawn in when its chapter reaches it. */
export function Note({ children, arrow = 'none', className = '', step }: { children: ReactNode; arrow?: Arrow; className?: string; step?: number }) {
  const p = arrow === 'none' ? null : PATHS[arrow];
  return (
    <div className={`jr-note jr-note-${arrow} ${className}`} data-step={step}>
      <span className="jr-note-text">{children}</span>
      {p && (
        <svg className="jr-note-arrow" viewBox={p.box} aria-hidden="true">
          <path d={p.d} pathLength={1} />
          <path d={p.head} pathLength={1} className="jr-note-head" />
        </svg>
      )}
    </div>
  );
}
