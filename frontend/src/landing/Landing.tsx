import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Lenis from 'lenis';
import { ArrowDown, ArrowRight, CalendarCheck2, CircleHelp, ShieldCheck, TriangleAlert } from 'lucide-react';
import { addDays, formatDay, fromISO, weekdayShort } from '../lib/dates';
import { formatHours } from '../lib/engine';
import { offerHeadline } from '../app/model';
import { Mark } from '../components/Wordmark';
import { DAYS, OFFER, PROJECTS, buildStory, tryLayout, type Layout } from './story';
import type { Stage } from './cinema/Stage';

const CHAPTERS = ['Begin', 'Your week', 'Your work', 'The ask', 'The truth', 'The answer', 'Try it', 'What you get', 'Private', 'Tomorrow'];
/** Height of one hour in the 3D scene (kept in sync with cinema/Stage.ts). */
const HOUR = 0.34;

const TRY_DEADLINES = [
  { label: 'Wed', day: 2 },
  { label: 'Fri', day: 4 },
  { label: 'Next Wed', day: 9 },
  { label: 'Next Fri', day: 11 },
];

/** Label group visibility: 1 at its chapters, fading out between them. */
function presence(c: number, chapters: number[]): number {
  return Math.max(0, ...chapters.map((k) => 1 - Math.abs(c - k) * 1.8));
}

function pickQuality(): 'high' | 'low' {
  const narrow = window.matchMedia('(max-width: 820px)').matches;
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const cores = navigator.hardwareConcurrency || 4;
  return narrow || coarse || cores <= 4 ? 'low' : 'high';
}

export function Landing() {
  const story = useMemo(() => buildStory(), []);
  const start = story.start;
  const [hours, setHours] = useState(OFFER.hours);
  const [dueDay, setDueDay] = useState(OFFER.dueDay);
  const tried = useMemo(() => tryLayout(start, hours, dueDay), [start, hours, dueDay]);
  const tryVerdict = offerHeadline(tried.result, addDays(start, dueDay), start);

  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const railRef = useRef<HTMLSpanElement>(null);
  const railNumRef = useRef<HTMLSpanElement>(null);
  const railLabelRef = useRef<HTMLSpanElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const dayRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const projectRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const lateRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const floatRef = useRef<HTMLSpanElement>(null);
  const beamRef = useRef<HTMLSpanElement>(null);
  const tryLayoutRef = useRef<Layout>(tried.layout);
  const tryResultRef = useRef(tried.result);
  const stageRef = useRef<Stage | null>(null);
  const chapterIdxRef = useRef(-1);
  const lenisRef = useRef<Lenis | null>(null);
  const [worldReady, setWorldReady] = useState(false);

  const truthOffer = story.result.offer.hoursShort;
  const truthVideo = story.result.displaced[0]?.extraShort ?? 0;
  const safeDateText = story.result.safeDate ? formatDay(story.result.safeDate) : '';

  // Late labels per layout (grouped per project)
  const lateText = (layout: Layout) => {
    const byProject = new Map<string, number>();
    for (const s of layout.segments) {
      if (s.tone === 'late' || s.tone === 'offerLate') byProject.set(s.projectId, (byProject.get(s.projectId) ?? 0) + s.hours);
    }
    return byProject;
  };

  const layoutFor = (idx: number): Layout => {
    if (idx <= 2) return story.base;
    if (idx === 3) return story.ask;
    if (idx === 4) return story.truth;
    if (idx === 6) return tryLayoutRef.current;
    return story.answer;
  };

  const beamTextFor = (idx: number) => {
    if (idx === 6) {
      const r = tryLayoutRef.current;
      return r.beamDay === null ? '' : tryResultRef.current.verdict === 'no' ? `Promise ${formatDay(addDays(start, r.beamDay))}` : `Done ${formatDay(addDays(start, r.beamDay))}`;
    }
    return `Promise ${safeDateText}`;
  };

  useEffect(() => {
    document.title = 'Optileno — Know if you can say yes';
  }, []);

  // Push the visitor's what-if into the film while they're on that chapter
  useEffect(() => {
    tryLayoutRef.current = tried.layout;
    tryResultRef.current = tried.result;
    if (chapterIdxRef.current === 6 && stageRef.current) {
      stageRef.current.setLayout(tried.layout);
      if (beamRef.current) beamRef.current.textContent = beamTextFor(6);
    }
  }, [tried]);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return undefined;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const lenis = reduce ? null : new Lenis({ lerp: 0.08, smoothWheel: true, wheelMultiplier: 0.85, touchMultiplier: 1.3 });
    lenisRef.current = lenis;

    const sections = Array.from(root.querySelectorAll<HTMLElement>('[data-chapter]'));
    const inners = sections.map((s) => s.querySelector<HTMLElement>('.ch-inner'));
    let anchors: number[] = [];
    const measure = () => {
      const vh = window.innerHeight;
      const max = Math.max(1, document.documentElement.scrollHeight - vh);
      let prev = -1;
      anchors = sections.map((el, i) => {
        const top = el.getBoundingClientRect().top + window.scrollY;
        let a = i === 0 ? 0 : top + (el.offsetHeight - vh) / 2;
        a = Math.min(Math.max(a, prev + 1), max);
        prev = a;
        return a;
      });
    };
    const chapterAt = (y: number) => {
      if (!anchors.length || y <= anchors[0]) return 0;
      for (let i = 0; i < anchors.length - 1; i++) {
        if (y < anchors[i + 1]) {
          const span = anchors[i + 1] - anchors[i];
          return i + (span > 0 ? (y - anchors[i]) / span : 1);
        }
      }
      return anchors.length - 1;
    };
    measure();

    let cancelled = false;
    let stage: Stage | null = null;
    let w = 0;
    let h = 0;
    const syncSize = () => {
      if (!stage) return;
      if (canvas.clientWidth !== w || canvas.clientHeight !== h) {
        w = canvas.clientWidth;
        h = canvas.clientHeight;
        stage.resize(w, h);
      }
    };

    import('./cinema/Stage')
      .then(({ Stage }) => {
        if (cancelled) return;
        try {
          stage = new Stage({ canvas, quality: pickQuality(), reducedMotion: reduce });
        } catch (err) {
          console.warn('[landing] WebGL unavailable — showing the story without 3D', err);
          return;
        }
        stageRef.current = stage;
        syncSize();
        const c = chapterAt(window.scrollY);
        stage.setChapter(c);
        stage.snap();
        stage.setLayout(layoutFor(Math.round(c)));
        setWorldReady(true);
      })
      .catch((err) => console.warn('[landing] failed to load the 3D stage', err));

    const onLost = (e: Event) => {
      e.preventDefault();
      stage = null;
      stageRef.current = null;
      setWorldReady(false);
    };
    canvas.addEventListener('webglcontextlost', onLost);

    const fine = window.matchMedia('(pointer: fine)').matches;
    const onPointer = (e: PointerEvent) =>
      stage?.setPointer((e.clientX / window.innerWidth) * 2 - 1, -((e.clientY / window.innerHeight) * 2 - 1));
    if (fine && !reduce) window.addEventListener('pointermove', onPointer, { passive: true });

    const ro = new ResizeObserver(() => {
      measure();
      syncSize();
    });
    ro.observe(root);
    const onResize = () => {
      measure();
      syncSize();
    };
    window.addEventListener('resize', onResize);

    const place = (el: HTMLElement | null, x: number, y: number, opacity: number) => {
      if (!el) return;
      el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -50%)`;
      el.style.opacity = opacity.toFixed(3);
    };

    let raf = 0;
    let scrolled = false;
    const loop = (t: number) => {
      lenis?.raf(t);
      const y = lenis ? lenis.animatedScroll : window.scrollY;
      const c = chapterAt(y);
      const idx = Math.round(c);

      // Copy cross-fades in place while its chapter is on stage
      inners.forEach((inner, i) => {
        if (!inner) return;
        const d = c - i;
        const o = Math.max(0, 1 - Math.abs(d) * 1.7);
        inner.style.opacity = o.toFixed(3);
        inner.style.transform = `translate3d(0, ${(-d * 40).toFixed(1)}px, 0)`;
        inner.style.visibility = o < 0.01 ? 'hidden' : 'visible';
        inner.style.pointerEvents = o > 0.35 ? 'auto' : 'none';
      });

      if (railRef.current) railRef.current.style.transform = `scaleY(${(c / (CHAPTERS.length - 1)).toFixed(4)})`;
      if (idx !== chapterIdxRef.current) {
        chapterIdxRef.current = idx;
        if (railNumRef.current) railNumRef.current.textContent = idx === 0 ? '—' : String(idx).padStart(2, '0');
        if (railLabelRef.current) railLabelRef.current.textContent = CHAPTERS[idx] ?? '';
        stage?.setLayout(layoutFor(idx));
        if (beamRef.current) beamRef.current.textContent = beamTextFor(idx);
      }
      const isScrolled = y > 30;
      if (isScrolled !== scrolled) {
        scrolled = isScrolled;
        navRef.current?.classList.toggle('is-scrolled', scrolled);
      }

      if (stage && !document.hidden) {
        stage.setChapter(c);
        stage.render(t / 1000);

        const a = stage.anchors();
        const dayO = presence(c, [1, 2, 6]);
        a.days.forEach((v, i) => {
          const p = stage!.toScreen(v);
          place(dayRefs.current[i], p.x, p.y + 16, p.visible ? dayO : 0);
        });

        const projO = presence(c, [2]);
        PROJECTS.forEach((proj, i) => {
          const first = a.blocks.find((b) => b.seg.projectId === proj.id);
          const el = projectRefs.current[i];
          if (!first) return place(el, -999, -999, 0);
          const p = stage!.toScreen(first.pos);
          place(el, p.x, p.y, p.visible ? projO * first.opacity : 0);
        });

        const lateO = presence(c, [4, 6]);
        const late = lateText(idx === 6 ? tryLayoutRef.current : story.truth);
        const lateIds = [...late.keys()];
        lateRefs.current.forEach((el, i) => {
          const id = lateIds[i];
          if (!el) return;
          if (!id || !(idx === 4 || idx === 6)) return place(el, -999, -999, 0);
          const segs = a.blocks.filter((b) => b.seg.projectId === id && (b.seg.tone === 'late' || b.seg.tone === 'offerLate'));
          if (!segs.length) return place(el, -999, -999, 0);
          const top = segs.reduce((m, b) => (b.pos.y > m.pos.y ? b : m));
          const p = stage!.toScreen(top.pos.clone().setY(top.pos.y + (top.seg.hours * HOUR) / 2 + 0.28));
          const name = id === OFFER.id ? OFFER.title : PROJECTS.find((x) => x.id === id)?.title ?? '';
          const text = `${name} · ${formatHours(late.get(id)!)} late`;
          if (el.textContent !== text) el.textContent = text;
          place(el, p.x, p.y, p.visible ? lateO : 0);
        });

        const floatO = presence(c, [3]);
        if (a.float) {
          const p = stage.toScreen(a.float);
          place(floatRef.current, p.x, p.y - 18, p.visible ? floatO : 0);
        } else place(floatRef.current, -999, -999, 0);

        const beamO = presence(c, [5, 6]);
        if (a.beam) {
          const p = stage.toScreen(a.beam);
          place(beamRef.current, p.x, p.y, p.visible ? beamO : 0);
        } else place(beamRef.current, -999, -999, 0);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      canvas.removeEventListener('webglcontextlost', onLost);
      window.removeEventListener('pointermove', onPointer);
      window.removeEventListener('resize', onResize);
      ro.disconnect();
      lenis?.destroy();
      lenisRef.current = null;
      stage?.dispose();
      stageRef.current = null;
    };
  }, []);

  const goTo = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (lenisRef.current) lenisRef.current.scrollTo(el, { duration: 2.4, offset: el.offsetHeight / 2 - window.innerHeight / 2 });
    else el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="film" ref={rootRef}>
      <div className="film-backdrop" aria-hidden="true" />
      <canvas ref={canvasRef} className={`film-canvas${worldReady ? ' is-ready' : ''}`} aria-hidden="true" />

      <div className="film-labels" aria-hidden="true">
        {Array.from({ length: DAYS }, (_, d) => {
          const date = addDays(start, d);
          const off = d % 7 >= 5;
          return (
            <span key={d} ref={(el) => void (dayRefs.current[d] = el)} className={`lbl lbl-day${off ? ' is-off' : ''}`}>
              <b>{weekdayShort(date)}</b> {fromISO(date).getDate()}
            </span>
          );
        })}
        {PROJECTS.map((p, i) => (
          <span key={p.id} ref={(el) => void (projectRefs.current[i] = el)} className="lbl lbl-project" style={{ ['--c' as string]: p.color }}>
            <i />
            {p.title} · {p.hours}h · due {weekdayShort(addDays(start, p.dueDay))}
            {p.dueDay >= 7 ? ' (next)' : ''}
          </span>
        ))}
        {[0, 1, 2, 3].map((i) => (
          <span key={i} ref={(el) => void (lateRefs.current[i] = el)} className="lbl lbl-late" />
        ))}
        <span ref={floatRef} className="lbl lbl-float">
          {OFFER.title} · {OFFER.hours}h · by Friday
        </span>
        <span ref={beamRef} className="lbl lbl-beam">
          Promise {safeDateText}
        </span>
      </div>

      <header className="film-nav" ref={navRef}>
        <Link to="/" className="film-brand" aria-label="Optileno home">
          <Mark size={24} />
          <span>Optileno</span>
        </Link>
        <nav className="film-nav-links" aria-label="Page">
          <button type="button" onClick={() => goTo('ch-week')}>How it works</button>
          <button type="button" onClick={() => goTo('ch-try')}>Try it</button>
          <Link to="/app" className="film-btn film-btn-sm">
            Open Optileno
          </Link>
        </nav>
      </header>

      <div className="film-rail" aria-hidden="true">
        <span className="rail-num" ref={railNumRef}>—</span>
        <span className="rail-track">
          <span className="rail-fill" ref={railRef} />
        </span>
        <span className="rail-label" ref={railLabelRef}>Begin</span>
      </div>

      <main>
        <section id="ch-hero" data-chapter={0} className="ch ch-hero">
          <div className="ch-inner ch-center">
            <div className="copy copy-hero">
              <p className="kicker">For freelancers juggling client work</p>
              <h1 className="display">Know if you can say yes.</h1>
              <p className="lede">
                Optileno checks every new request against your real week — and shows you, before you answer, what fits, what would slip, and the date you can safely promise.
              </p>
              <div className="cta-row">
                <Link to="/app" className="film-btn">
                  Try it free — no signup <ArrowRight size={16} />
                </Link>
                <button type="button" className="film-link" onClick={() => goTo('ch-week')}>
                  See how it works <ArrowDown size={15} />
                </button>
              </div>
              <p className="fine">
                <ShieldCheck size={14} /> Works in your browser. Your projects never leave your device.
              </p>
            </div>
          </div>
        </section>

        <section id="ch-week" data-chapter={1} className="ch">
          <div className="ch-inner ch-top-left">
            <div className="copy">
              <p className="kicker">01 — Your week</p>
              <h2 className="display display-md">This is your real week.</h2>
              <p className="lede">
                Fourteen days. Five focused hours each weekday — the hours client work actually gets done, not the hours you sit at your desk. Each glass pillar holds exactly that much.
              </p>
            </div>
          </div>
        </section>

        <section data-chapter={2} className="ch">
          <div className="ch-inner ch-top-right">
            <div className="copy">
              <p className="kicker">02 — Your work</p>
              <h2 className="display display-md">Every project takes up real space.</h2>
              <p className="lede">
                A pitch deck due Wednesday. A landing page due Friday. A launch video due next Thursday. Optileno stacks them earliest-deadline-first — the order that gives every deadline its best chance.
              </p>
            </div>
          </div>
        </section>

        <section data-chapter={3} className="ch">
          <div className="ch-inner ch-top-right">
            <div className="copy">
              <p className="kicker">03 — The ask</p>
              <div className="film-message" role="img" aria-label={`Message from Sam at ${OFFER.client}`}>
                <div className="film-message-head">
                  <span className="film-message-avatar">S</span>
                  <span>
                    <b>Sam</b> · {OFFER.client}
                  </span>
                  <span className="film-message-time">9:41</span>
                </div>
                <p>Hey! Could you do our pricing page by Friday? Should be about {OFFER.hours} hours 🙏</p>
              </div>
              <h2 className="display display-md">Your gut says: sure.</h2>
            </div>
          </div>
        </section>

        <section data-chapter={4} className="ch ch-dark">
          <div className="ch-inner ch-top-left">
            <div className="copy">
              <p className="kicker">04 — The truth</p>
              <h2 className="display display-md">The math says no.</h2>
              <p className="lede">
                Friday only has five hours left. Say yes, and {formatHours(truthOffer)} of the new job lands late — and your launch video slips {formatHours(truthVideo)} past its deadline.
              </p>
              <p className="fine">Red is late. Optileno shows you before it happens, not the night before.</p>
            </div>
          </div>
        </section>

        <section data-chapter={5} className="ch">
          <div className="ch-inner ch-top-left">
            <div className="copy">
              <p className="kicker">05 — The answer</p>
              <h2 className="display display-md">Promise next Friday. Nothing else moves.</h2>
              <div className="film-reply">
                <p className="film-reply-label">Your reply, written for you</p>
                <p>
                  Hi Sam — thanks for thinking of me! My week is committed through Thursday, so the earliest I can deliver the pricing page properly is <b>{safeDateText}</b>. Would that work?
                </p>
              </div>
            </div>
          </div>
        </section>

        <section id="ch-try" data-chapter={6} className="ch ch-try">
          <div className="ch-inner ch-bottom">
            <div className="deck">
              <div className="deck-copy">
                <p className="kicker">06 — Try it</p>
                <h2 className="display display-sm">Now you ask.</h2>
                <p className="fine">Same week, same engine as the app. Change the request and watch the week re-stack.</p>
              </div>
              <div className="deck-controls">
                <label className="deck-field">
                  <span>
                    Hours of work <b>{hours}h</b>
                  </span>
                  <input type="range" min={2} max={40} step={1} value={hours} onChange={(e) => setHours(Number(e.target.value))} />
                </label>
                <div className="deck-field">
                  <span>They need it by</span>
                  <div className="deck-chips" role="group" aria-label="Deadline">
                    {TRY_DEADLINES.map((d) => (
                      <button key={d.day} type="button" className={dueDay === d.day ? 'is-on' : ''} aria-pressed={dueDay === d.day} onClick={() => setDueDay(d.day)}>
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className={`deck-verdict tone-${tryVerdict.tone}`} aria-live="polite">
                <p className="deck-verdict-title">{tryVerdict.title}</p>
                <p>{tryVerdict.detail}</p>
                {tried.result.verdict === 'no' && tried.result.safeDate && (
                  <p className="deck-safe">
                    Promise <b>{formatDay(tried.result.safeDate)}</b> instead — nothing else moves.
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>

        <section data-chapter={7} className="ch">
          <div className="ch-inner ch-center">
            <div className="copy copy-center">
              <p className="kicker">07 — What you get</p>
              <h2 className="display display-md">One question, answered well.</h2>
              <div className="film-features">
                <div className="film-feature">
                  <CircleHelp size={20} />
                  <h3>Can I say yes?</h3>
                  <p>An instant verdict on any request — which projects would slip, by how many hours, and the date you can promise instead.</p>
                </div>
                <div className="film-feature">
                  <TriangleAlert size={20} />
                  <h3>Trouble, a week early</h3>
                  <p>See which deadline is at risk while there's still time to move it — not the night before it's due.</p>
                </div>
                <div className="film-feature">
                  <CalendarCheck2 size={20} />
                  <h3>A day you can finish</h3>
                  <p>Today's work in deadline order. Log an hour and the whole plan re-flows around it.</p>
                </div>
              </div>
              <p className="fine">Type projects in plain words — “Acme — landing page, 12h, Friday”. Set up in three minutes.</p>
            </div>
          </div>
        </section>

        <section data-chapter={8} className="ch ch-dark">
          <div className="ch-inner ch-top-left">
            <div className="copy">
              <p className="kicker">08 — Private</p>
              <h2 className="display display-md">Your clients stay yours.</h2>
              <p className="lede">No account. No server. No meeting bots, no chat window. Optileno runs in your browser and keeps every project on your own device.</p>
            </div>
          </div>
        </section>

        <section data-chapter={9} className="ch ch-final ch-dark">
          <div className="ch-inner ch-center">
            <div className="copy copy-center">
              <h2 className="display">The next client will ask. Know your answer.</h2>
              <div className="cta-row cta-center">
                <Link to="/app" className="film-btn film-btn-lg">
                  Open Optileno — it's free <ArrowRight size={17} />
                </Link>
              </div>
              <p className="fine">No signup. Free while in early access.</p>
            </div>
          </div>
        </section>
      </main>

      <footer className="film-footer">
        <span className="film-brand">
          <Mark size={20} />
          <span>Optileno</span>
        </span>
        <p>Your data never leaves your browser. Questions or ideas: <a href="mailto:optilenoai@gmail.com">optilenoai@gmail.com</a></p>
        <p>© {new Date().getFullYear()} Optileno</p>
      </footer>
    </div>
  );
}
