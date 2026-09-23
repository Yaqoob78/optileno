import { useEffect, useRef, useState, type ReactNode } from 'react';
import { onScrollFrame, scrollToId } from '../scroll';
import { ActionChapter, ChoiceChapter, ClientChapter, HeroChapter, ProblemChapter, SolutionChapter } from './Chapters';
import { DepthStage } from './DepthStage';
import { SCENES } from './scenes';

const CHAPTERS: { id: string; label: string; node: ReactNode }[] = [
  { id: 'ch-hero', label: 'Welcome', node: <HeroChapter /> },
  { id: 'ch-problem', label: 'The problem', node: <ProblemChapter /> },
  { id: 'ch-solution', label: 'The solution', node: <SolutionChapter /> },
  { id: 'ch-action', label: 'In action', node: <ActionChapter /> },
  { id: 'ch-choice', label: 'Charge or gift', node: <ChoiceChapter /> },
  { id: 'ch-client', label: 'Client page', node: <ClientChapter /> },
];

const isNarrow = () => window.matchMedia('(max-width: 900px)').matches;

/**
 * The story. One sticky "living painting" behind six chapters: as each
 * chapter reaches the middle of the screen the world flies to its scene,
 * and the chapter's pieces build in as you keep scrolling.
 */
export function Journey() {
  const root = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const stage = useRef<DepthStage | null>(null);
  const [active, setActive] = useState(0);
  const [mode, setMode] = useState<'webgl' | 'fallback'>('webgl');
  const [ready, setReady] = useState(false);

  // Stage lifecycle
  useEffect(() => {
    const c = canvas.current;
    if (!c) return undefined;
    const s = DepthStage.create(c, SCENES);
    if (!s) {
      setMode('fallback');
      return undefined;
    }
    stage.current = s;
    s.onReady = () => setReady(true);
    s.show(0, true);

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      s.setPointer((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
    };
    const onResize = () => s.resize();
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('resize', onResize);

    // Only draw while the story is on screen
    const io = new IntersectionObserver(([e]) => (e.isIntersecting ? s.play() : s.pause()), { rootMargin: '100px' });
    if (root.current) io.observe(root.current);
    const onVis = () => (document.hidden ? s.pause() : root.current && s.play());
    document.addEventListener('visibilitychange', onVis);

    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVis);
      io.disconnect();
      s.dispose();
      stage.current = null;
    };
  }, []);

  useEffect(() => {
    stage.current?.show(active);
  }, [active]);

  // Scroll: which chapter is on stage, how far into it we are, which pieces are built
  useEffect(() => {
    const el = root.current;
    if (!el) return undefined;
    const chapters = [...el.querySelectorAll<HTMLElement>('.jr-chapter')];
    const steps = chapters.map((ch) => [...ch.querySelectorAll<HTMLElement>('[data-step]')]);
    return onScrollFrame(() => {
      const vh = window.innerHeight;
      const narrow = isNarrow();
      let current = 0;
      chapters.forEach((ch, i) => {
        const r = ch.getBoundingClientRect();
        if (r.top <= vh * 0.55) current = i;
        const span = Math.max(1, r.height - vh);
        const p = -r.top / span;
        if (i === current) stage.current?.setDolly(Math.min(1, Math.max(0, p)));
        const list = steps[i];
        const max = Math.max(1, ...list.map((s) => Number(s.dataset.step) || 0));
        for (const s of list) {
          const k = Number(s.dataset.step) || 0;
          const on = narrow ? s.getBoundingClientRect().top < vh * 0.92 : p >= ((k - 1) / max) * 0.75 - 0.3;
          s.classList.toggle('on', on);
        }
      });
      setActive((a) => (a === current ? a : current));
    });
  }, []);

  const scene = SCENES[active];

  return (
    <section ref={root} className={`jr${ready || mode === 'fallback' ? ' jr-ready' : ''}`} aria-label="How Optileno works, as a story">
      <div className="jr-stage" data-tone={scene.tone} data-side={scene.side}>
        {mode === 'webgl' ? (
          <canvas ref={canvas} className="jr-canvas" aria-hidden="true" />
        ) : (
          <div className="jr-fallback" aria-hidden="true">
            {SCENES.map((s, i) => (
              <img key={s.id} src={s.image} alt="" className={i === active ? 'on' : ''} style={{ objectPosition: `${s.focus[0] * 100}% ${s.focus[1] * 100}%` }} />
            ))}
          </div>
        )}
        <div className="jr-scrim jr-scrim-light" />
        <div className="jr-scrim jr-scrim-dark" />
        <nav className="jr-hud" aria-label="Chapters">
          <span className="jr-hud-label" aria-live="polite">
            {String(active + 1).padStart(2, '0')} / {String(CHAPTERS.length).padStart(2, '0')} · {CHAPTERS[active].label}
          </span>
          <span className="jr-hud-bars">
            {CHAPTERS.map((c, i) => (
              <a
                key={c.id}
                href={`#${c.id}`}
                className={i === active ? 'on' : ''}
                aria-label={c.label}
                aria-current={i === active ? 'step' : undefined}
                onClick={(e) => {
                  e.preventDefault();
                  scrollToId(c.id);
                }}
              />
            ))}
          </span>
        </nav>
      </div>
      <div className="jr-chapters">
        {CHAPTERS.map((c, i) => (
          <article key={c.id} id={c.id} className={`jr-chapter jr-tone-${SCENES[i].tone}${i === active ? ' is-active' : ''}`}>
            {c.node}
          </article>
        ))}
      </div>
    </section>
  );
}
