import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import {
  MotionConfig,
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionValue,
} from 'framer-motion';
import Lenis from 'lenis';
import {
  ArrowRight,
  CalendarCheck,
  ChartColumn,
  Check,
  Feather,
  GraduationCap,
  MessageCircle,
  Minus,
  Mouse,
  Palette,
  Plus,
  Rocket,
} from 'lucide-react';
import { Logo } from '../../components/common/Logo';
import SEO from '../../components/common/SEO';
import { AnalyticsMockup, ChatMockup, DashboardMockup, PlannerMockup } from './LandingMockups';
import type { ForestScene } from './scene/ForestScene';
import './landing.css';

/* ─── Content ─── */

type FAQItem = { question: string; answer: string };

const FAQ_ITEMS: FAQItem[] = [
  {
    question: 'How is Optileno different from Taskade, Motion, Morgen, Sunsama, Notion, or Todoist?',
    answer: 'Optileno is not trying to be another blank workspace, team wiki, or pure calendar scheduler. It focuses on AI execution: turning goals into daily tasks, protecting deep work, and showing behavior analytics like focus score, goal progress, and burnout risk in one system.',
  },
  {
    question: 'Is my data safe?',
    answer: 'Yes. All data is encrypted in transit and at rest. We use industry-standard security practices and never sell your data. Your productivity intelligence stays yours.',
  },
  {
    question: 'Is Optileno really 100% Free?',
    answer: 'Yes! The core planner, daily time-blocking, focus score tracking, and Leno AI assistant are 100% free forever without requiring a credit card. If you want power-user features like 150 AI requests/day, focus heatmaps, and advanced AI automation, you can upgrade to Ultra Pro anytime.',
  },
  {
    question: 'Can I use Optileno on mobile?',
    answer: 'Yes. Optileno is fully responsive and works on any device. Your daily plan, focus sessions, and AI assistant are always accessible.',
  },
  {
    question: 'How fast can I get started?',
    answer: 'Under 90 seconds. Sign up, tell Leno your top goal, and you\'ll have a prioritized daily plan before you finish your coffee.',
  },
  {
    question: 'Can I try Optileno before creating an account?',
    answer: 'Yes. The free AI tools let you prioritize tasks or generate a weekly plan first. If the result is useful, you can save it and continue inside Optileno.',
  },
  {
    question: 'Can I cancel anytime?',
    answer: 'Absolutely. No contracts, no lock-in. Cancel from your settings in two clicks.',
  },
];

const FEATURES = [
  { icon: MessageCircle, title: 'AI Chat Assistant', text: 'Think. Plan. Get things done.' },
  { icon: CalendarCheck, title: 'Smart Planner', text: 'Turn goals into daily action.' },
  { icon: ChartColumn, title: 'Deep Analytics', text: 'Understand your focus & progress.' },
  { icon: Feather, title: 'Beautiful, Distraction-Free UI', text: 'Designed for a calmer mind.' },
];

const PEOPLE = [
  {
    icon: GraduationCap,
    who: 'Students',
    text: 'Turn a semester of deadlines into calm, doable daily steps — with Leno there whenever you get stuck.',
  },
  {
    icon: Palette,
    who: 'Designers & creators',
    text: 'Protect long, quiet blocks for deep creative work and let the planner arrange everything else around them.',
  },
  {
    icon: Rocket,
    who: 'Founders',
    text: 'Break a roadmap into prioritized daily tasks, and see burnout coming before launch week does.',
  },
];

const PLANS = {
  free: {
    name: 'Free',
    tagline: 'Get started',
    features: ['Leno AI chat — 15 requests/day', 'Full planner: tasks, habits, goals', 'Mood tracker & productivity score', 'Basic analytics dashboard'],
  },
  pro: {
    name: 'Ultra Pro',
    tagline: 'For focused individuals',
    monthly: '₹1,499',
    yearly: '₹12,999',
    features: ['Leno AI chat — 150 requests/day', 'Agentic planner automation', 'Focus heatmap & burnout risk', 'Advanced analytics & AI insights', 'Priority support'],
  },
};

const CHAPTER_LABELS = ['Begin', 'Clarity', 'Everything', 'Leno', 'Planner', 'Progress', 'People', 'Pricing', 'Questions', 'Tomorrow'];

/** How much the world is dimmed behind each chapter so the UI stays legible. */
const SCRIM = [0, 0.04, 0.5, 0.46, 0.4, 0.46, 0.22, 0.58, 0.64, 0.08];
/** Depth-of-field blur (px) behind the product chapters, desktop only. */
const BLUR = [0, 0, 5, 6, 2.5, 5, 1.5, 6, 7, 0];

const EASE = [0.22, 1, 0.36, 1] as const;

/* ─── Motion helpers ─── */

function Lines({ lines, as = 'h2', className, delay = 0 }: { lines: string[]; as?: 'h1' | 'h2'; className?: string; delay?: number }) {
  const Tag = as === 'h1' ? motion.h1 : motion.h2;
  return (
    <Tag className={className} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.5 }}>
      {lines.map((line, i) => (
        <React.Fragment key={line}>
          <span className="line-mask">
            <motion.span
              className="line"
              variants={{
                hidden: { y: '105%', opacity: 0 },
                show: { y: '0%', opacity: 1, transition: { duration: 1.25, ease: EASE, delay: delay + i * 0.1 } },
              }}
            >
              {line}
            </motion.span>
          </span>
          {i < lines.length - 1 && ' '}
        </React.Fragment>
      ))}
    </Tag>
  );
}

function Reveal({ children, delay = 0, className, y = 26 }: { children: React.ReactNode; delay?: number; className?: string; y?: number }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y, filter: 'blur(8px)' }}
      whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 1.2, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  );
}

/** A story chapter: content dissolves in as it arrives and out as it leaves,
    so each scene hands over to the world behind it. */
function Chapter({
  id,
  index,
  className = '',
  label,
  children,
}: {
  id: string;
  index: number;
  className?: string;
  label: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress: enter } = useScroll({ target: ref, offset: ['start end', 'start 40%'] });
  const { scrollYProgress: exit } = useScroll({ target: ref, offset: ['end 70%', 'end start'] });
  const opacity = useTransform<number, number>([enter, exit] as MotionValue<number>[], ([a, b]) =>
    Math.min(Math.min(1, a * 1.3), 1 - b * 1.15),
  );
  const y = useTransform(exit, [0, 1], [0, -60]);
  return (
    <section ref={ref} id={id} data-chapter={index} className={`chapter ${className}`} aria-label={label}>
      <motion.div className="chapter-inner" style={{ opacity, y }}>
        {children}
      </motion.div>
    </section>
  );
}

function TiltStage({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const rotateY = useTransform(scrollYProgress, [0, 0.5, 1], [-30, -14, -6]);
  const rotateX = useTransform(scrollYProgress, [0, 0.5, 1], [16, 7, 2]);
  const rotateZ = useTransform(scrollYProgress, [0, 1], [3, -1]);
  const y = useTransform(scrollYProgress, [0, 1], [90, -70]);
  return (
    <div ref={ref} className="tilt-stage">
      <motion.div className="tilt-inner" style={{ rotateX, rotateY, rotateZ, y }}>
        {children}
      </motion.div>
    </div>
  );
}

function Drift({ children, amount = 60, className }: { children: React.ReactNode; amount?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], [amount, -amount]);
  return (
    <motion.div ref={ref} className={className} style={{ y }}>
      {children}
    </motion.div>
  );
}

function FAQAccordion({ item, index }: { item: FAQItem; index: number }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`faq-row ${open ? 'is-open' : ''}`}>
      <button
        type="button"
        className="faq-q"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={`faq-a-${index}`}
        id={`faq-q-${index}`}
      >
        <span>{item.question}</span>
        {open ? <Minus size={16} /> : <Plus size={16} />}
      </button>
      <div className="faq-a" id={`faq-a-${index}`} role="region" aria-labelledby={`faq-q-${index}`}>
        <div>
          <p>{item.answer}</p>
        </div>
      </div>
    </div>
  );
}

function pickQuality(): 'high' | 'low' {
  const narrow = window.matchMedia('(max-width: 820px)').matches;
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const cores = navigator.hardwareConcurrency || 4;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
  return narrow || coarse || cores <= 4 || memory <= 4 ? 'low' : 'high';
}

/* ─── Page ─── */

export default function Landing() {
  const navigate = useNavigate();
  const reduceMotion = !!useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scrimRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const railFillRef = useRef<HTMLSpanElement>(null);
  const heroRef = useRef<HTMLElement>(null);
  const lenisRef = useRef<Lenis | null>(null);
  const [worldReady, setWorldReady] = useState(false);
  const [activeChapter, setActiveChapter] = useState(0);
  const [yearly, setYearly] = useState(false);

  const { scrollYProgress: heroExit } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
  const heroOpacity = useTransform(heroExit, [0, 0.55], [1, 0]);
  const heroY = useTransform(heroExit, [0, 1], [0, -140]);

  const goTo = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (lenisRef.current) {
      lenisRef.current.scrollTo(el, { duration: 2.2 });
    } else {
      el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
    }
  }, [reduceMotion]);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return undefined;

    const lenis = reduceMotion
      ? null
      : new Lenis({ lerp: 0.085, smoothWheel: true, wheelMultiplier: 0.9, touchMultiplier: 1.3 });
    lenisRef.current = lenis;

    /* Scroll position → fractional chapter, anchored on each section's centre */
    const sections = Array.from(root.querySelectorAll<HTMLElement>('[data-chapter]'));
    let anchors: number[] = [];
    const measure = () => {
      const vh = window.innerHeight;
      const max = Math.max(document.documentElement.scrollHeight - vh, 1);
      let prev = -1;
      anchors = sections.map((el, i) => {
        const top = el.getBoundingClientRect().top + window.scrollY;
        let a = i === 0 ? 0 : top + el.offsetHeight / 2 - vh / 2;
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

    let scene: ForestScene | null = null;
    let cancelled = false;
    let canvasW = 0;
    let canvasH = 0;
    const syncSize = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (scene && (w !== canvasW || h !== canvasH)) {
        canvasW = w;
        canvasH = h;
        scene.resize(w, h);
      }
    };

    const buildWorld = () => {
      import('./scene/ForestScene')
        .then(({ ForestScene }) => {
          if (cancelled) return;
          try {
            scene = new ForestScene({ canvas, quality: pickQuality(), reducedMotion: reduceMotion });
          } catch (err) {
            console.warn('[landing] WebGL unavailable — keeping the painted backdrop', err);
            return;
          }
          syncSize();
          scene.setChapter(chapterAt(window.scrollY));
          scene.snap();
          scene.render(performance.now() / 1000);
          setWorldReady(true);
        })
        .catch((err) => console.warn('[landing] failed to load 3D scene', err));
    };
    // Let the hero paint first, then build the world
    const hasIdle = typeof window.requestIdleCallback === 'function';
    const idleId = hasIdle ? window.requestIdleCallback(buildWorld, { timeout: 400 }) : window.setTimeout(buildWorld, 60);

    const onContextLost = (e: Event) => {
      e.preventDefault();
      scene = null;
      setWorldReady(false);
    };
    canvas.addEventListener('webglcontextlost', onContextLost);

    const finePointer = window.matchMedia('(pointer: fine)').matches;
    const allowBlur = finePointer && window.innerWidth > 900;
    let lastBlur = -1;
    const onPointer = (e: PointerEvent) => {
      scene?.setPointer((e.clientX / window.innerWidth) * 2 - 1, -((e.clientY / window.innerHeight) * 2 - 1));
    };
    if (finePointer && !reduceMotion) window.addEventListener('pointermove', onPointer, { passive: true });

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

    /* One loop drives smooth scroll, the world and the chrome */
    let raf = 0;
    let lastRounded = -1;
    let lastScrolled = false;
    const loop = (t: number) => {
      lenis?.raf(t);
      const y = lenis ? lenis.animatedScroll : window.scrollY;
      const c = chapterAt(y);

      if (scene && !document.hidden) {
        scene.setChapter(c);
        scene.render(t / 1000);
      }

      const i = Math.min(Math.floor(c), SCRIM.length - 2);
      const f = c - i;
      if (scrimRef.current) scrimRef.current.style.opacity = String(SCRIM[i] + (SCRIM[i + 1] - SCRIM[i]) * f);
      if (allowBlur) {
        const blur = BLUR[i] + (BLUR[i + 1] - BLUR[i]) * f;
        if (Math.abs(blur - lastBlur) > 0.08) {
          lastBlur = blur;
          // Slight overscan hides the soft, darkened edge a blur filter leaves
          canvas.style.filter = blur > 0.1 ? `blur(${blur.toFixed(2)}px)` : 'none';
          canvas.style.transform = blur > 0.1 ? `scale(${(1 + blur * 0.006).toFixed(4)})` : 'none';
        }
      }
      if (railFillRef.current) railFillRef.current.style.transform = `scaleY(${c / (SCRIM.length - 1)})`;

      const rounded = Math.round(c);
      if (rounded !== lastRounded) {
        lastRounded = rounded;
        setActiveChapter(rounded);
      }
      const scrolled = y > 24;
      if (scrolled !== lastScrolled && navRef.current) {
        lastScrolled = scrolled;
        navRef.current.classList.toggle('is-scrolled', scrolled);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      if (hasIdle) window.cancelIdleCallback(idleId);
      else window.clearTimeout(idleId);
      canvas.removeEventListener('webglcontextlost', onContextLost);
      window.removeEventListener('pointermove', onPointer);
      window.removeEventListener('resize', onResize);
      ro.disconnect();
      lenis?.destroy();
      lenisRef.current = null;
      scene?.dispose();
      scene = null;
    };
  }, [reduceMotion]);

  return (
    <MotionConfig reducedMotion="user">
      <SEO
        title="Optileno | Free AI Daily Planner, Smart Calendar & Task Manager"
        description="The smart AI daily planner and calendar assistant. Auto-schedule deep work, organize tasks, track habits, and prevent burnout with Leno AI. Free forever."
        keywords="AI daily planner, smart calendar, AI calendar planner, Motion alternative, Sunsama alternative, Reclaim alternative, Todoist alternative, free task manager, deep work planner, burnout analytics, focus score, workflow automation"
        canonicalUrl="https://www.optileno.com/"
        schema={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "SoftwareApplication",
              "name": "Optileno",
              "applicationCategory": "ProductivityApplication",
              "operatingSystem": "Web, Windows, macOS, iOS, Android",
              "url": "https://www.optileno.com/",
              "description": "The smart AI daily planner and calendar assistant. Auto-schedule deep work, organize tasks, track habits, and prevent burnout with Leno AI. Free forever.",
              "offers": {
                "@type": "Offer",
                "price": "0.00",
                "priceCurrency": "USD",
                "description": "100% Free Explorer Plan Forever"
              },
              "aggregateRating": {
                "@type": "AggregateRating",
                "ratingValue": "4.9",
                "ratingCount": "195",
                "bestRating": "5",
                "worstRating": "1"
              },
              "featureList": [
                "AI Daily Planner & 90-Second Sprint Triage",
                "Smart Calendar Time Blocking & Google Calendar Sync",
                "Deep Work Focus Shield with Built-in Timers",
                "Predictive Cognitive Burnout Risk Telemetry",
                "Big Five Personality Work-Style Calibration",
                "Chat Leno Executive AI Productivity Partner"
              ]
            },
            {
              "@type": "FAQPage",
              "mainEntity": FAQ_ITEMS.map((item) => ({
                "@type": "Question",
                "name": item.question,
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": item.answer
                }
              }))
            }
          ]
        }}
      />
      <Helmet>
        <meta name="theme-color" content="#07100c" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,300..500;1,6..72,300..400&display=swap"
        />
      </Helmet>

      <div className="cine" ref={rootRef}>
        {/* ─── The world ─── */}
        <div className="cine-world" aria-hidden="true">
          <div className="cine-backdrop" />
          <canvas ref={canvasRef} className={`cine-canvas ${worldReady ? 'is-ready' : ''}`} />
        </div>
        <div className="cine-scrim" ref={scrimRef} aria-hidden="true" />
        <div className="cine-vignette" aria-hidden="true" />

        {/* ─── Navigation ─── */}
        <header className="cine-nav" ref={navRef}>
          <a
            href="/"
            className="cine-brand"
            onClick={(e) => {
              e.preventDefault();
              goTo('top');
            }}
          >
            <Logo size={34} animated={false} glow={false} />
            <span>Optileno</span>
          </a>
          <nav className="cine-links" aria-label="Primary">
            <button type="button" onClick={() => goTo('product')}>Product</button>
            <button type="button" onClick={() => goTo('pricing')}>Pricing</button>
            <button type="button" onClick={() => navigate('/tools')}>Free AI Tools</button>
            <button type="button" className="cine-login" onClick={() => navigate('/login')}>Log in</button>
          </nav>
          <button type="button" className="btn-outline" onClick={() => navigate('/register')}>
            Get Started
          </button>
        </header>

        {/* ─── Chapter rail ─── */}
        <div className="cine-rail" aria-hidden="true">
          <span className="rail-num">{String(activeChapter + 1).padStart(2, '0')}</span>
          <span className="rail-track">
            <span className="rail-fill" ref={railFillRef} />
          </span>
          <span className="rail-label">{CHAPTER_LABELS[activeChapter]}</span>
        </div>

        <main>
          {/* 01 · Hero */}
          <section ref={heroRef} id="top" data-chapter={0} className="chapter hero" aria-label="Introduction">
            <motion.div className="hero-copy" style={{ opacity: heroOpacity, y: heroY }}>
              <Lines as="h1" className="display display-xl" lines={['A clearer', 'mind', 'builds a brighter', 'tomorrow.']} delay={0.25} />
              <Reveal delay={0.9}>
                <p className="lede">Your AI companion for focus, planning and a more intentional life.</p>
              </Reveal>
              <Reveal delay={1.1} className="hero-actions">
                <button type="button" className="btn-mint" onClick={() => navigate('/register')}>
                  Start for free <ArrowRight size={16} />
                </button>
                <span className="hero-tag">A calmer. Smarter. You.</span>
              </Reveal>
            </motion.div>
            <motion.button
              type="button"
              className="scroll-cue"
              onClick={() => goTo('story')}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.8, duration: 1 }}
            >
              <Mouse size={16} />
              Scroll to explore
            </motion.button>
          </section>

          {/* 02 · The calm transition */}
          <Chapter id="story" index={1} className="story" label="More than a productivity app">
            <div className="story-copy">
              <Lines className="display display-lg" lines={['More than a', 'productivity app.']} />
              <Reveal delay={0.3}>
                <p className="lede">
                  Optileno helps you think clearly, plan intentionally, and grow consistently — with the power of AI.
                </p>
              </Reveal>
            </div>
            <Reveal delay={0.6} className="story-note">
              <p>
                Clarity
                <br />
                today,
                <br />a better
                <br />
                tomorrow.
              </p>
            </Reveal>
          </Chapter>

          {/* 03 · Features */}
          <Chapter id="product" index={2} className="split" label="Features overview">
            <div className="split-copy">
              <Lines className="display display-md" lines={['Everything you need', 'to grow, in one place.']} />
              <ul className="feature-list">
                {FEATURES.map(({ icon: Icon, title, text }, i) => (
                  <Reveal key={title} delay={0.15 + i * 0.1}>
                    <li>
                      <span className="feature-icon">
                        <Icon size={18} />
                      </span>
                      <span>
                        <strong>{title}</strong>
                        <small>{text}</small>
                      </span>
                    </li>
                  </Reveal>
                ))}
              </ul>
            </div>
            <TiltStage>
              <DashboardMockup />
            </TiltStage>
          </Chapter>

          {/* 04 · Leno chat */}
          <Chapter id="leno" index={3} className="split" label="AI chat">
            <div className="split-copy">
              <Lines className="display display-md" lines={['A conversation', 'that moves you forward.']} />
              <Reveal delay={0.25}>
                <p className="lede">
                  Get personalized guidance, break down complex problems, and stay on track — whenever you need it.
                </p>
              </Reveal>
            </div>
            <Drift className="split-visual">
              <ChatMockup />
            </Drift>
          </Chapter>

          {/* 05 · Planner */}
          <Chapter id="planner" index={4} className="stack" label="Planner">
            <div className="stack-copy">
              <Lines className="display display-md" lines={['Plan less.', 'Do more.']} />
              <Reveal delay={0.25}>
                <p className="lede">Turn your goals into a clear, actionable plan. Let Optileno handle the details.</p>
              </Reveal>
            </div>
            <Drift amount={40}>
              <Reveal delay={0.35}>
                <PlannerMockup />
              </Reveal>
            </Drift>
          </Chapter>

          {/* 06 · Analytics */}
          <Chapter id="progress" index={5} className="split" label="Analytics">
            <div className="split-copy">
              <Lines className="display display-md" lines={['Progress', 'that inspires.']} />
              <Reveal delay={0.25}>
                <p className="lede">Track your focus, habits and momentum with beautiful insights.</p>
              </Reveal>
            </div>
            <Drift className="split-visual" amount={50}>
              <AnalyticsMockup />
            </Drift>
          </Chapter>

          {/* 07 · People */}
          <Chapter id="people" index={6} className="people" label="Who Optileno is for">
            <div className="people-copy">
              <Lines className="display display-md" lines={['Made for real people.', 'Built for real progress.']} />
              <Reveal delay={0.25}>
                <p className="lede">For anyone building a calmer, more focused life — whatever you&apos;re working towards.</p>
              </Reveal>
            </div>
            <div className="people-grid">
              {PEOPLE.map(({ icon: Icon, who, text }, i) => (
                <Reveal key={who} delay={0.2 + i * 0.12} className="glass person">
                  <p>{text}</p>
                  <div className="person-who">
                    <span className="person-avatar">
                      <Icon size={16} />
                    </span>
                    <span>
                      <strong>For {who.toLowerCase()}</strong>
                    </span>
                  </div>
                </Reveal>
              ))}
            </div>
          </Chapter>

          {/* 08 · Pricing */}
          <Chapter id="pricing" index={7} className="pricing" label="Pricing">
            <div className="pricing-head">
              <Lines className="display display-md" lines={['Start your journey today.']} />
              <Reveal delay={0.2}>
                <p className="lede">A clearer mind is just one step away.</p>
              </Reveal>
              <Reveal delay={0.3}>
                <div className="cycle" role="group" aria-label="Billing cycle">
                  <button type="button" className={!yearly ? 'is-active' : ''} aria-pressed={!yearly} onClick={() => setYearly(false)}>
                    Monthly
                  </button>
                  <button type="button" className={yearly ? 'is-active' : ''} aria-pressed={yearly} onClick={() => setYearly(true)}>
                    Yearly <span className="save">Save 28%</span>
                  </button>
                </div>
              </Reveal>
            </div>
            <div className="plans">
              <Reveal delay={0.3} className="glass plan">
                <h3>{PLANS.free.name}</h3>
                <p className="plan-tag">{PLANS.free.tagline}</p>
                <p className="plan-price">
                  ₹0 <small>forever</small>
                </p>
                <ul>
                  {PLANS.free.features.map((f) => (
                    <li key={f}>
                      <Check size={14} /> {f}
                    </li>
                  ))}
                </ul>
                <button type="button" className="btn-ghost" onClick={() => navigate('/register')}>
                  Get Started
                </button>
              </Reveal>
              <Reveal delay={0.42} className="glass plan plan-pro">
                <span className="plan-badge">Most Popular</span>
                <h3>{PLANS.pro.name}</h3>
                <p className="plan-tag">{PLANS.pro.tagline}</p>
                <p className="plan-price">
                  {yearly ? PLANS.pro.yearly : PLANS.pro.monthly} <small>/ {yearly ? 'year' : 'month'}</small>
                </p>
                <ul>
                  {PLANS.pro.features.map((f) => (
                    <li key={f}>
                      <Check size={14} /> {f}
                    </li>
                  ))}
                </ul>
                <button type="button" className="btn-mint" onClick={() => navigate('/register?plan=ultra')}>
                  Start Pro
                </button>
              </Reveal>
            </div>
            <p className="pricing-note">No credit card needed for Free. Cancel Pro anytime from settings.</p>
          </Chapter>

          {/* 09 · Questions */}
          <Chapter id="faq" index={8} className="faq" label="Frequently asked questions">
            <Lines className="display display-md" lines={['Questions, answered.']} />
            <Reveal delay={0.2} className="glass faq-list">
              {FAQ_ITEMS.map((item, index) => (
                <FAQAccordion key={item.question} item={item} index={index} />
              ))}
            </Reveal>
          </Chapter>

          {/* 10 · Final */}
          <Chapter id="begin" index={9} className="finale" label="Get started">
            <div className="finale-copy">
              <Lines className="display display-lg" lines={['A calmer you.', 'A brighter tomorrow.']} />
              <Reveal delay={0.3}>
                <p className="lede">Start for free and take the first step towards a more intentional life.</p>
              </Reveal>
              <Reveal delay={0.45}>
                <button type="button" className="btn-mint" onClick={() => navigate('/register')}>
                  Get Started <ArrowRight size={16} />
                </button>
              </Reveal>
            </div>
            <Reveal delay={0.6} className="finale-verse">
              <p>
                Better
                <br />
                People
                <br />
                Build
                <br />A
                <br />
                Brighter
                <br />
                World.
              </p>
            </Reveal>
            <div className="finale-cycle" aria-hidden="true">
              <span>Focus</span>
              <span>Plan</span>
              <span>Grow</span>
              <span>Repeat</span>
            </div>
          </Chapter>
        </main>

        {/* ─── Footer ─── */}
        <footer className="cine-footer">
          <div className="footer-top">
            <div className="footer-brand">
              <Logo size={28} animated={false} glow={false} />
              <span>Optileno</span>
            </div>
            <nav className="footer-links" aria-label="Footer">
              <button type="button" onClick={() => navigate('/ai-calendar-planner')}>AI Calendar Planner</button>
              <button type="button" onClick={() => navigate('/ai-task-manager')}>AI Task Manager</button>
              <button type="button" onClick={() => navigate('/workflow-automation-agency-owners')}>Agency Automation</button>
              <button type="button" onClick={() => navigate('/tools')}>Free AI Tools</button>
              <button type="button" onClick={() => navigate('/dashboard-preview')}>Live Preview</button>
              <button type="button" onClick={() => navigate('/vs/motion')}>Optileno vs Motion</button>
              <button type="button" onClick={() => navigate('/vs/sunsama')}>Optileno vs Sunsama</button>
              <button type="button" onClick={() => navigate('/vs/reclaim')}>Optileno vs Reclaim</button>
              <button type="button" onClick={() => navigate('/vs/todoist')}>Optileno vs Todoist</button>
              <button type="button" onClick={() => navigate('/vs/notion')}>Optileno vs Notion</button>
              <button type="button" onClick={() => navigate('/get-access')}>Get Access</button>
              <button type="button" onClick={() => navigate('/login')}>Log in</button>
              <button type="button" onClick={() => navigate('/privacy')}>Privacy Policy</button>
              <button type="button" onClick={() => navigate('/terms')}>Terms of Service</button>
              <button type="button" onClick={() => navigate('/refund')}>Refund Policy</button>
              <button type="button" onClick={() => navigate('/cookies')}>Cookies Policy</button>
            </nav>
          </div>
          <div className="footer-bottom">
            <p>© 2026 Optileno. A calmer mind builds a brighter tomorrow.</p>
            <p>Built in India. Shipping globally.</p>
          </div>
        </footer>
      </div>
    </MotionConfig>
  );
}
