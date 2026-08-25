import React, { useRef, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useReducedMotion, type Variants } from 'framer-motion';
import {
  ArrowRight,
  Bot,
  Building2,
  Briefcase,
  Calendar,
  BarChart2,
  CheckCircle,
  Clock,
  TrendingUp,
  Zap,
  Target,
  Timer,
  ChevronDown,
  Plus,
  Minus,
  Wrench,
} from 'lucide-react';
import { Logo } from '../../components/common/Logo';
import { Interactive3DCard } from '../../components/landing/Interactive3DCard';
import SEO from '../../components/common/SEO';
import './landing.css';

/* ─── Types ─── */
type Feature = {
  title: string;
  description: string;
  icon: React.ReactNode;
};

type ScreenCard = {
  title: string;
  subtitle: string;
  fileName: string;
  badge: string;
};

type CapabilityItem = {
  title: string;
  description: string;
};

type CapabilityGroup = {
  title: string;
  summary: string;
  items: CapabilityItem[];
};

type UseCaseGroup = {
  title: string;
  icon: React.ReactNode;
  entries: string[];
};

type Testimonial = {
  author: string;
  initials: string;
  title: string;
  quote: string;
  gradientFrom: string;
  gradientTo: string;
};

type FAQItem = {
  question: string;
  answer: string;
};

/* ─── Data ─── */

const FEATURES: Feature[] = [
  {
    title: 'Goal → Tasks in seconds',
    description: 'Tell Leno your goal. Get a prioritized task list instantly.',
    icon: <Bot size={20} />,
  },
  {
    title: 'One view. Zero chaos.',
    description: 'Tasks, habits, and focus blocks in a single daily view.',
    icon: <Calendar size={20} />,
  },
  {
    title: 'Know when you\'re about to crash.',
    description: 'Track your focus score, burnout risk, and peak productive hours.',
    icon: <BarChart2 size={20} />,
  },
  {
    title: 'Ship more. Miss less.',
    description: 'Real-time sync and feedback loops to keep every task on track.',
    icon: <CheckCircle size={20} />,
  },
  {
    title: 'Protected deep work time.',
    description: 'Built-in focus timers that shield your attention when it matters most.',
    icon: <Clock size={20} />,
  },
];

const SCREEN_CARDS: ScreenCard[] = [
  {
    title: 'Dashboard Overview',
    subtitle: 'Your command center for goals, tasks, and intelligence.',
    fileName: 'dashboard-mockup.png',
    badge: 'Executive View',
  },
  {
    title: 'Execution Planner',
    subtitle: 'The daily stack tracking tasks, habits, and focus.',
    fileName: 'planner-overall.png',
    badge: 'Planner Grid',
  },
  {
    title: 'Performance Analytics',
    subtitle: 'Transparent insights into your behavior and productivity.',
    fileName: 'analytics-overall.png',
    badge: 'Insights Layer',
  },
];

const CAPABILITY_GROUPS: CapabilityGroup[] = [
  {
    title: 'Goal Execution',
    summary: 'Plan and execute without losing control of your overarching priorities.',
    items: [
      {
        title: 'Leno Assistant',
        description: 'Ask Leno to draft tasks from complex objectives in seconds.',
      },
      {
        title: 'Adaptive Planning',
        description: 'Stay on course even when priorities inevitably shift.',
      },
    ],
  },
  {
    title: 'Time & Focus Mastery',
    summary: 'Turn scattered inputs into structured, high-output sessions.',
    items: [
      {
        title: 'Smart Task Manager',
        description: 'Prioritize by urgency, impact, and your actual capacity.',
      },
      {
        title: 'Deep Work Modes',
        description: 'Eliminate distractions with focused time-boxing.',
      },
    ],
  },
  {
    title: 'Actionable Intelligence',
    summary: 'Convert raw productivity data into behavioral insights.',
    items: [
      {
        title: 'Burnout Tracking',
        description: 'Monitor fatigue to prevent crashes before they happen.',
      },
      {
        title: 'Focus Hotspots',
        description: 'Learn when you work best across the week.',
      },
    ],
  },
];

const USE_CASE_GROUPS: UseCaseGroup[] = [
  {
    title: 'Ambitious Professionals',
    icon: <Building2 size={18} />,
    entries: [
      'Founders & Builders',
      'Creators',
      'Executives',
      'Freelancers',
      'Consultants',
    ],
  },
  {
    title: 'High-Output Teams',
    icon: <Briefcase size={18} />,
    entries: ['Startups', 'Small Agencies', 'Remote Teams'],
  },
];

const TESTIMONIALS: Testimonial[] = [
  {
    author: 'For SaaS Founders',
    initials: 'SF',
    title: 'Kill context-switching',
    quote: 'Leno breaks your roadmap into prioritized daily tasks, so execution never stalls between five different tools.',
    gradientFrom: '#60a5fa',
    gradientTo: '#3b82f6',
  },
  {
    author: 'For Agency Owners',
    initials: 'AO',
    title: 'Protect your peak weeks',
    quote: 'Burnout-risk tracking watches your workload patterns and flags overload before a launch week crashes you.',
    gradientFrom: '#fbbf24',
    gradientTo: '#d97706',
  },
  {
    author: 'For Senior Executives',
    initials: 'SE',
    title: 'Execute what matters',
    quote: 'Goals synchronize with daily focus sprints, so the work that actually moves the needle gets scheduled first.',
    gradientFrom: '#34d399',
    gradientTo: '#059669',
  },
];

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
    answer: 'Yes! The core planner, daily time-blocking, focus score tracking, and Leno AI assistant are 100% free forever without requiring a credit card. If you want power-user features like 150 AI requests/day, focus heatmaps, and advanced AI automation, you can upgrade to Ultra Pro anytime for $6.99/month.',
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

const HERO_STATS = [
  {
    icon: <TrendingUp size={18} />,
    label: 'Goals → Daily Tasks, Automatically',
  },
  {
    icon: <Zap size={18} />,
    label: 'Tasks, Focus & Analytics in One',
  },
  {
    icon: <Timer size={18} />,
    label: '90-sec First Planned Day',
  },
  {
    icon: <Target size={18} />,
    label: 'Live Focus Score Tracking',
  },
];

const HERO_TITLE = 'Stop planning. Start finishing.';
const HERO_TITLE_WORDS = HERO_TITLE.split(' ');

const WAVE_PATHS = Array.from({ length: 42 }).map((_, i) => {
  const y = 40 + i * 26;
  const phaseRow = i * 0.3;
  const cy1 = y - 130 + Math.sin(phaseRow) * 80;
  const cy2 = y + 130 + Math.sin(phaseRow - 1.2) * 80;
  const cy3 = y + Math.sin(phaseRow - 2.4) * 60;
  return `M -100 ${y} C 480 ${cy1}, 1020 ${cy2}, 1600 ${cy3}`;
});

/* ─── FAQ Accordion Item ─── */
function FAQAccordion({ item, index }: { item: FAQItem; index: number }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className={`faq-item ${isOpen ? 'faq-open' : ''}`}>
      <button
        className="faq-question"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        id={`faq-q-${index}`}
      >
        <span>{item.question}</span>
        {isOpen ? <Minus size={18} /> : <Plus size={18} />}
      </button>
      <div className="faq-answer" role="region" aria-labelledby={`faq-q-${index}`}>
        {isOpen && <p>{item.answer}</p>}
      </div>
    </div>
  );
}

/* ─── Component ─── */

export default function Landing() {
  const navigate = useNavigate();
  const shouldReduceMotion = useReducedMotion();
  const sceneRef = useRef<HTMLDivElement>(null);
  const [showStickyBar, setShowStickyBar] = useState(false);

  useEffect(() => {
    let animationFrameId: number;
    let time = 0;
    let heroVisible = true;
    let prevMouseY = 0;
    let prevMouseTime = performance.now();
    let audioCtx: AudioContext | null = null;

    // Calming, meditative pentatonic harp/chime frequencies for productivity
    const HARMONIC_FREQS = [
      261.63, // C4
      293.66, // D4
      329.63, // E4
      392.00, // G4
      440.00, // A4
      523.25, // C5
      587.33, // D5
      659.25, // E5
      783.99, // G5
      880.00, // A5
    ];

    // Cooldown per line to maintain serene, calm, musical strumming
    const lastPlayedTimes = new Float64Array(42);

    const playStringSound = (index: number) => {
      // ONLY play for the upper wave lines (not lower lines or other elements)
      if (index >= 22) return;

      const nowMs = performance.now();
      if (nowMs - lastPlayedTimes[index] < 180) return;
      lastPlayedTimes[index] = nowMs;

      try {
        if (!audioCtx) {
          const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
          if (AudioCtx) audioCtx = new AudioCtx();
        }
        if (audioCtx && audioCtx.state === 'suspended') {
          audioCtx.resume().catch(() => {});
        }
        if (!audioCtx || audioCtx.state !== 'running') return;

        const now = audioCtx.currentTime;
        const freq = HARMONIC_FREQS[index % HARMONIC_FREQS.length];

        // Pure, warm, calm sine fundamental
        const osc = audioCtx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);

        // Soft subtle warm overtone (gives a wooden acoustic feel)
        const overtone = audioCtx.createOscillator();
        overtone.type = 'triangle';
        overtone.frequency.setValueAtTime(freq * 2, now);

        // Warm, mellow lowpass filter (removes any harsh/irritating highs)
        const filter = audioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(850, now);
        filter.frequency.exponentialRampToValueAtTime(220, now + 0.45);

        // Calm, subtle master volume envelope (gentle ambient presence)
        const gain = audioCtx.createGain();
        const overtoneGain = audioCtx.createGain();

        gain.gain.setValueAtTime(0.016, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.48);

        overtoneGain.gain.setValueAtTime(0.005, now);
        overtoneGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);

        osc.connect(filter);
        overtone.connect(overtoneGain);
        overtoneGain.connect(filter);
        filter.connect(gain);
        gain.connect(audioCtx.destination);

        osc.start(now);
        overtone.start(now);
        osc.stop(now + 0.5);
        overtone.stop(now + 0.5);
      } catch {
        // Silent catch for browser autoplay policies
      }
    };

    let basePaths: NodeListOf<SVGPathElement> | null = null;
    let activePaths: NodeListOf<SVGPathElement> | null = null;

    const renderWaves = () => {
      if (!heroVisible) return;
      time += 0.003;
      if (!sceneRef.current) return;

      if (!basePaths || !activePaths) {
        basePaths = sceneRef.current.querySelectorAll<SVGPathElement>('.waves-base path');
        activePaths = sceneRef.current.querySelectorAll<SVGPathElement>('.waves-active path');
      }

      for (let i = 0; i < 42; i++) {
        const y = 40 + i * 26;
        const phaseRow = i * 0.3;
        const waveSpeed = time * 2;

        const cy1 = y - 130 + Math.sin(phaseRow + waveSpeed) * 80;
        const cy2 = y + 130 + Math.sin(phaseRow + waveSpeed - 1.2) * 80;
        const cy3 = y + Math.sin(phaseRow + waveSpeed - 2.4) * 60;

        const d = `M -100 ${y} C 480 ${cy1}, 1020 ${cy2}, 1600 ${cy3}`;

        if (basePaths && basePaths[i]) basePaths[i].setAttribute('d', d);
        if (activePaths && activePaths[i]) activePaths[i].setAttribute('d', d);
      }

      animationFrameId = requestAnimationFrame(renderWaves);
    };

    // Stop animation loop when hero is out of view
    let waveObserver: IntersectionObserver | undefined;
    if (!shouldReduceMotion) {
      renderWaves();

      if (sceneRef.current && typeof IntersectionObserver !== 'undefined') {
        waveObserver = new IntersectionObserver(([entry]) => {
          const wasVisible = heroVisible;
          heroVisible = entry.isIntersecting;
          if (heroVisible && !wasVisible) renderWaves();
          if (!heroVisible) cancelAnimationFrame(animationFrameId);
        });
        waveObserver.observe(sceneRef.current);
      }
    }

    // Strictly interact ONLY with the upper wave curves
    const handlePointerInteraction = (clientX: number, clientY: number) => {
      if (!sceneRef.current || !heroVisible) return;
      const rect = sceneRef.current.getBoundingClientRect();

      // Restrict to the upper wave area only
      if (
        clientX < rect.left ||
        clientX > rect.right ||
        clientY < rect.top ||
        clientY > rect.top + Math.min(rect.height * 0.55, 480)
      ) {
        return;
      }

      const x = clientX - rect.left;
      const y = clientY - rect.top;
      sceneRef.current.style.setProperty('--mouse-x', `${x}px`);
      sceneRef.current.style.setProperty('--mouse-y', `${y}px`);

      const now = performance.now();
      const dt = Math.max((now - prevMouseTime) / 1000, 0.001);
      const vy = (y - prevMouseY) / dt;

      const svgNormY = (y / Math.max(rect.height, 1)) * 1000;
      const prevSvgNormY = (prevMouseY / Math.max(rect.height, 1)) * 1000;

      // Only check the top visible lines (0 to 21)
      if (svgNormY <= 520) {
        for (let i = 0; i < 22; i++) {
          const lineY = 40 + i * 26;
          const crossed =
            (prevSvgNormY <= lineY && svgNormY >= lineY) ||
            (prevSvgNormY >= lineY && svgNormY <= lineY);
          const dist = Math.abs(svgNormY - lineY);

          if (crossed || (dist < 10 && Math.abs(vy) > 50)) {
            playStringSound(i);
          }
        }
      }

      prevMouseY = y;
      prevMouseTime = now;
    };

    const handleMouseMove = (e: MouseEvent) => {
      handlePointerInteraction(e.clientX, e.clientY);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        handlePointerInteraction(e.touches[0].clientX, e.touches[0].clientY);
      }
    };

    /* Sticky CTA bar: appears after 15% scroll */
    const handleScroll = () => {
      const scrollPct = window.scrollY / (document.documentElement.scrollHeight - window.innerHeight);
      setShowStickyBar(scrollPct > 0.15 && scrollPct < 0.9);
    };

    const sceneEl = sceneRef.current;
    if (sceneEl) {
      sceneEl.addEventListener('mousemove', handleMouseMove, { passive: true });
      sceneEl.addEventListener('touchmove', handleTouchMove, { passive: true });
    }
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      if (sceneEl) {
        sceneEl.removeEventListener('mousemove', handleMouseMove);
        sceneEl.removeEventListener('touchmove', handleTouchMove);
      }
      window.removeEventListener('scroll', handleScroll);
      cancelAnimationFrame(animationFrameId);
      waveObserver?.disconnect();
      if (audioCtx && audioCtx.state !== 'closed') {
        audioCtx.close().catch(() => {});
      }
    };
  }, [shouldReduceMotion]);

  const revealVariants = React.useMemo<Variants>(
    () => ({
      hidden: {
        opacity: 0,
        y: shouldReduceMotion ? 0 : 24,
        scale: shouldReduceMotion ? 1 : 0.985,
        filter: shouldReduceMotion ? 'none' : 'blur(8px)',
      },
      visible: (delay: number = 0) => ({
        opacity: 1,
        y: 0,
        scale: 1,
        filter: 'blur(0px)',
        transition: {
          duration: shouldReduceMotion ? 0.18 : 0.62,
          delay,
          ease: [0.22, 1, 0.36, 1],
        },
      }),
    }),
    [shouldReduceMotion],
  );

  const titleContainerVariants = React.useMemo<Variants>(
    () => ({
      hidden: {},
      visible: {
        transition: {
          delayChildren: shouldReduceMotion ? 0 : 0.08,
          staggerChildren: shouldReduceMotion ? 0 : 0.065,
        },
      },
    }),
    [shouldReduceMotion],
  );

  const titleWordVariants = React.useMemo<Variants>(
    () => ({
      hidden: {
        opacity: 0,
        y: shouldReduceMotion ? 0 : 20,
        filter: shouldReduceMotion ? 'none' : 'blur(10px)',
      },
      visible: {
        opacity: 1,
        y: 0,
        filter: 'blur(0px)',
        transition: {
          duration: shouldReduceMotion ? 0.1 : 0.55,
          ease: [0.22, 1, 0.36, 1],
        },
      },
    }),
    [shouldReduceMotion],
  );

  return (
    <>
      <SEO
        title="AI Calendar Planner for Solo Agency Owners & Operators | Optileno"
        description="Learn how to turn high level goals into daily tasks with AI. A daily focus app to prevent developer burnout and protect your deep work time."
        keywords="ai calendar planner for solo agency owners, daily focus app to prevent developer burnout, how to turn high level goals into daily tasks with ai, optileno, focus app, daily task planner"
        canonicalUrl="https://www.optileno.com/"
      />
      <div className="landing-page">
        <div className="scene-bg" aria-hidden="true" ref={sceneRef}>
          <div className="orb orb-a" />
          <div className="orb orb-b" />

          <div className="waves-container">
            <svg className="waves-base" viewBox="0 0 1440 1000" preserveAspectRatio="none">
              <defs>
                <linearGradient id="waveGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#60a5fa" />
                  <stop offset="50%" stopColor="#3b82f6" />
                  <stop offset="100%" stopColor="#d97706" />
                </linearGradient>
              </defs>
              {WAVE_PATHS.map((path, index) => (
                <path key={`base-${index}`} d={path} stroke="rgba(255, 255, 255, 0.04)" strokeWidth="1" fill="none" />
              ))}
            </svg>
          </div>

          <div className="waves-container waves-glow">
            <svg className="waves-active" viewBox="0 0 1440 1000" preserveAspectRatio="none">
              {WAVE_PATHS.map((path, index) => (
                <path key={`glow-${index}`} d={path} stroke="url(#waveGradient)" strokeWidth="2.5" fill="none" />
              ))}
            </svg>
          </div>
        </div>

        {/* ─── Nav ─── */}
        <nav className="landing-nav">
          <div className="nav-container">
            <div className="nav-logo">
              <Logo size={56} animated={true} glow={true} />
              <span className="logo-text">Optileno</span>
            </div>
            <div className="nav-actions">
              <button className="nav-link nav-link-tools btn-premium" onClick={() => navigate('/tools')}>
                <Wrench size={15} />
                Free AI Tools
              </button>
              <button
                className="nav-btn-access btn-premium"
                onClick={() => navigate('/get-access')}
              >
                Get Access
              </button>
              <button className="nav-link btn-premium" onClick={() => navigate('/login')}>Login</button>
              <button className="nav-btn-primary nav-cta-gold btn-premium" onClick={() => navigate('/register')}>
                Start Free Forever
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </nav>

        {/* ─── Sticky Mid-Page CTA Bar ─── */}
        <div className={`sticky-cta-bar ${showStickyBar ? 'sticky-visible' : ''}`}>
          <div className="sticky-cta-inner">
            <span className="sticky-cta-text">Ready to start executing?</span>
            <button className="sticky-cta-btn-secondary btn-premium" onClick={() => navigate('/get-access')}>
              Get Access
            </button>
            <button className="sticky-cta-btn btn-premium" onClick={() => navigate('/register')}>
              Start Free Forever
              <ArrowRight size={15} />
            </button>
          </div>
        </div>

        <main className="hero-section">
          {/* ─── Hero Content ─── */}
          <motion.section
            className="hero-content"
            initial="hidden"
            animate="visible"
            variants={revealVariants}
            custom={0.02}
          >
            <motion.span className="kicker kicker-luxury" variants={revealVariants} custom={0.08}>
              <span className="kicker-pulse-dot" />
              100% Free Forever · No Credit Card Required
            </motion.span>

            <motion.h1
              className="hero-title"
              variants={titleContainerVariants}
              initial="hidden"
              animate="visible"
              aria-label={HERO_TITLE}
            >
              {HERO_TITLE_WORDS.map((word, index) => (
                <motion.span key={`${word}-${index}`} className="hero-title-word" variants={titleWordVariants}>
                  {word}
                </motion.span>
              ))}
            </motion.h1>

            <motion.h2 className="hero-subtitle" variants={revealVariants} custom={0.16}>
              Optileno turns high-level goals into daily tasks with AI planning,
              habit tracking, and behavioral analytics — built to protect your
              focus and catch burnout before it catches you.
            </motion.h2>

            <motion.p className="hero-social-proof" variants={revealVariants} custom={0.2}>
              The AI planner for founders, agency owners, developers, and high-output builders.
            </motion.p>

            <div className="hero-stats">
              {HERO_STATS.map((metric, index) => (
                <motion.div
                  className="stat-card"
                  key={metric.label}
                  variants={revealVariants}
                  initial="hidden"
                  animate="visible"
                  custom={0.24 + index * 0.05}
                >
                  {metric.icon}
                  <span>{metric.label}</span>
                </motion.div>
              ))}
            </div>

            <motion.div className="cta-wrapper hero-cta-stack" variants={revealVariants} custom={0.44}>
              <button className="cta-button cta-gold btn-premium" onClick={() => navigate('/register')}>
                Start Planning Free
                <ArrowRight size={18} />
              </button>
              <button className="cta-button-secondary btn-premium" onClick={() => navigate('/dashboard-preview')}>
                See Dashboard Preview
              </button>
              <button className="cta-button-tertiary btn-premium" onClick={() => navigate('/get-access')}>
                Have an invite? Get Access
              </button>
              
              <div className="hero-live-proof">
                <span className="live-radar-dot" />
                <span>1,420+ daily focus sprints planned today • 100% Free Forever • Instant 1-Click Access</span>
              </div>
            </motion.div>

            <motion.div className="hero-keyword-links" variants={revealVariants} custom={0.52}>
              <span>Explore:</span>
              <div className="hero-keyword-buttons">
                <button type="button" className="keyword-chip" onClick={() => navigate('/ai-planner')}>For agency owners</button>
                <button type="button" className="keyword-chip" onClick={() => navigate('/ai-productivity')}>For developers</button>
                <button type="button" className="keyword-chip" onClick={() => navigate('/tools')}>Free AI tools</button>
              </div>
            </motion.div>

            {/* Scroll indicator */}
            <motion.div
              className="scroll-indicator"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.2, duration: 0.6 }}
            >
              <ChevronDown size={22} />
            </motion.div>
          </motion.section>

          {/* ─── Screens ─── */}
          <motion.section
            className="screens-section"
            aria-label="Product screenshots"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            variants={revealVariants}
            custom={0.03}
          >
            {SCREEN_CARDS.map((screen, index) => (
              <motion.article
                key={screen.fileName}
                className="screen-card"
                variants={revealVariants}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, amount: 0.2 }}
                custom={0.06 + index * 0.06}
              >
                <div className="screen-top">
                  <span className="screen-badge">{screen.badge}</span>
                  <h3>{screen.title}</h3>
                  <p>{screen.subtitle}</p>
                </div>

                <Interactive3DCard fileName={screen.fileName} title={screen.title} />
              </motion.article>
            ))}
          </motion.section>

          {/* ─── Features ─── */}
          <motion.section
            className="features-section"
            aria-label="Platform features"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            variants={revealVariants}
            custom={0.04}
          >
            <h2>Everything you need to go from idea → executed</h2>
            <div className="features-grid">
              {FEATURES.map((feature, index) => (
                <motion.article
                  key={feature.title}
                  className="feature-card"
                  variants={revealVariants}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, amount: 0.2 }}
                  custom={0.08 + index * 0.04}
                >
                  <div className="feature-icon">{feature.icon}</div>
                  <h3>{feature.title}</h3>
                  <p>{feature.description}</p>
                </motion.article>
              ))}
            </div>
          </motion.section>

          {/* ─── Capabilities ─── */}
          <motion.section
            className="capabilities-section"
            aria-label="Platform capability categories"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            variants={revealVariants}
            custom={0.04}
          >
            <div className="section-heading">
              <span>Core Modules</span>
              <h2>From scattered thinking to controlled execution</h2>
              <p>
                Structured for serious work. Designed for speed.
              </p>
            </div>

            <div className="capabilities-grid">
              {CAPABILITY_GROUPS.map((group, groupIndex) => (
                <motion.article
                  key={group.title}
                  className="capability-card"
                  variants={revealVariants}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, amount: 0.2 }}
                  custom={0.08 + groupIndex * 0.05}
                >
                  <h3>{group.title}</h3>
                  <p>{group.summary}</p>
                  <div className="capability-list">
                    {group.items.map((item) => (
                      <div key={item.title} className="capability-item">
                        <h4>{item.title}</h4>
                        <p>{item.description}</p>
                      </div>
                    ))}
                  </div>
                </motion.article>
              ))}
            </div>
          </motion.section>

          {/* ─── Use Cases ─── */}
          <motion.section
            className="use-cases-section"
            aria-label="Optileno use cases"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            variants={revealVariants}
            custom={0.04}
          >
            <div className="section-heading">
              <span>Use Cases</span>
              <h2>Made for people who ship, not people who plan</h2>
              <p>
                Run your planning, delivery, and analytics from one AI platform.
              </p>
            </div>

            <div className="use-case-grid">
              {USE_CASE_GROUPS.map((group, index) => (
                <motion.article
                  key={group.title}
                  className="use-case-card"
                  variants={revealVariants}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, amount: 0.2 }}
                  custom={0.1 + index * 0.08}
                >
                  <div className="use-case-head">
                    {group.icon}
                    <h3>{group.title}</h3>
                  </div>
                  <div className="use-case-list">
                    {group.entries.map((entry) => (
                      <span key={entry}>{entry}</span>
                    ))}
                  </div>
                </motion.article>
              ))}
            </div>
          </motion.section>

          {/* ─── Testimonials ─── */}
          <motion.section
            className="testimonials-section capabilities-section"
            aria-label="Who Optileno is built for"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            variants={revealVariants}
            custom={0.04}
          >
            <div className="section-heading">
              <span>Built For Operators</span>
              <h2>Designed around how operators work</h2>
              <p>
                The workflows Optileno is engineered to power — from solo founders to executive teams.
              </p>
            </div>

            <div className="testimonials-grid">
              {TESTIMONIALS.map((testimonial, index) => (
                <motion.article
                  key={testimonial.author}
                  className="testimonial-card"
                  variants={revealVariants}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, amount: 0.2 }}
                  custom={0.08 + index * 0.04}
                >
                  <div className="testimonial-head">
                    <div
                      className="testimonial-avatar-initials"
                      style={{
                        background: `linear-gradient(135deg, ${testimonial.gradientFrom}, ${testimonial.gradientTo})`,
                      }}
                    >
                      {testimonial.initials}
                    </div>
                    <div className="testimonial-author-wrapper">
                      <h3 className="testimonial-author">{testimonial.author}</h3>
                      <p className="testimonial-title">{testimonial.title}</p>
                    </div>
                  </div>
                  <blockquote className="testimonial-quote">
                    {testimonial.quote}
                  </blockquote>
                </motion.article>
              ))}
            </div>
          </motion.section>

          {/* ─── FAQ ─── */}
          <motion.section
            className="faq-section"
            aria-label="Frequently asked questions"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            variants={revealVariants}
            custom={0.04}
          >
            <div className="section-heading">
              <span>FAQ</span>
              <h2>Questions before you start</h2>
            </div>

            <div className="faq-list">
              {FAQ_ITEMS.map((item, index) => (
                <FAQAccordion key={index} item={item} index={index} />
              ))}
            </div>
          </motion.section>

          {/* ─── Final CTA ─── */}
          <motion.section
            className="journey-section"
            aria-label="Start your Optileno journey"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            variants={revealVariants}
            custom={0.04}
          >
            <div className="journey-card">
              <div className="journey-copy">
                <span className="journey-kicker">Ready?</span>
                <h2>Your first productive day starts in 90 seconds.</h2>
                <p>
                  Set up your goals, get AI-planned tasks, and start executing — 100% Free to use.
                </p>
              </div>
              <div className="journey-actions">
                <button className="cta-button cta-gold btn-premium" onClick={() => navigate('/register')}>
                  Start Planning Free
                  <ArrowRight size={18} />
                </button>
                <p className="cta-note-alt">No credit card required. Upgrade to Ultra Pro anytime.</p>
              </div>
            </div>
          </motion.section>
        </main>

        {/* ─── Footer ─── */}
        <footer className="landing-footer">
          <div className="footer-grid">
            <div className="footer-brand">
              <Logo size={32} animated={false} glow={false} />
              <span className="footer-brand-name">Optileno</span>
            </div>
            <div className="footer-links">
              <button onClick={() => navigate('/tools')}>Free AI Tools</button>
              <button onClick={() => navigate('/privacy')}>Privacy Policy</button>
              <button onClick={() => navigate('/terms')}>Terms of Service</button>
              <button onClick={() => navigate('/refund')}>Refund Policy</button>
              <button onClick={() => navigate('/cookies')}>Cookies Policy</button>
              <button onClick={() => navigate('/login')}>Login</button>
            </div>
          </div>
          <p>© 2026 Optileno. Serious productivity, engineered with AI.</p>
          <p className="footer-note">Built in India. Shipping globally.</p>
        </footer>
      </div>
    </>
  );
}
