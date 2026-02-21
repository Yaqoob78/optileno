import React, { useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useReducedMotion, type Variants } from 'framer-motion';
import {
  ArrowRight,
  Bot,
  BrainCircuit,
  Briefcase,
  Building2,
  Calendar,
  BarChart2,
  CheckCircle,
  Clock,
  Sparkles,
  Layers,
  Workflow,
  ArrowUpRight,
} from 'lucide-react';
import { Logo } from '../../components/common/Logo';
import './landing.css';

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

type NeuralLine = {
  top: string;
  left: string;
  width: string;
  rotate: string;
  tone: 'blue' | 'gold';
  delay: string;
};

type NeuralRow = {
  top: number;
  leftStart: number;
  gap: number;
  count: number;
  widths: number[];
  baseRotate: number;
  delayOffset: number;
  toneStart: 'blue' | 'gold';
};

const FEATURES: Feature[] = [
  {
    title: 'AI Workflow Engine',
    description: 'Turn ambitions into daily tasks with clear priorities.',
    icon: <Bot size={20} />,
  },
  {
    title: 'Precision Planner',
    description: 'Sync your tasks, habits, and focus sprints seamlessly.',
    icon: <Calendar size={20} />,
  },
  {
    title: 'Behavioral Insights',
    description: 'Track real metrics like focus score and burnout risk.',
    icon: <BarChart2 size={20} />,
  },
  {
    title: 'Execution Reliability',
    description: 'Fast feedback loops, state sync, and predictable outcomes.',
    icon: <CheckCircle size={20} />,
  },
  {
    title: 'Deep Work Flow',
    description: 'Built-in focus timers to maximize output and shield attention.',
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

const HERO_METRICS = [
  {
    icon: <Layers size={18} />,
    label: 'Unified Planning Surface',
  },
  {
    icon: <Workflow size={18} />,
    label: 'Operational AI Guidance',
  },
  {
    icon: <Sparkles size={18} />,
    label: 'Decision-Grade Analytics',
  },
  {
    icon: <BrainCircuit size={18} />,
    label: 'Adaptive Intelligence Layer',
  },
];

const HERO_TITLE = 'Double your execution speed with an AI operating system.';
const HERO_TITLE_WORDS = HERO_TITLE.split(' ');
const HERO_PILLS = ['Goals', 'Tasks', 'Planner', 'Leno AI', 'Habits', 'Analytics'];
const NEURAL_ROWS: NeuralRow[] = [
  { top: 8, leftStart: 4, gap: 10.5, count: 10, widths: [70, 85, 75, 90], baseRotate: -10, delayOffset: 0.1, toneStart: 'blue' },
  { top: 14, leftStart: 8, gap: 10.2, count: 9, widths: [80, 70, 90, 75], baseRotate: 8, delayOffset: 0.35, toneStart: 'gold' },
  { top: 20, leftStart: 5, gap: 10.4, count: 10, widths: [75, 85, 70, 95], baseRotate: -8, delayOffset: 0.6, toneStart: 'blue' },
  { top: 26, leftStart: 9, gap: 10.1, count: 9, widths: [85, 75, 95, 80], baseRotate: 9, delayOffset: 0.85, toneStart: 'gold' },
  { top: 32, leftStart: 6, gap: 10.3, count: 10, widths: [70, 90, 80, 85], baseRotate: -7, delayOffset: 1.1, toneStart: 'blue' },
  { top: 38, leftStart: 10, gap: 10.0, count: 9, widths: [90, 80, 85, 75], baseRotate: 7, delayOffset: 1.35, toneStart: 'gold' },
  { top: 44, leftStart: 7, gap: 10.2, count: 10, widths: [80, 75, 90, 85], baseRotate: -9, delayOffset: 1.6, toneStart: 'blue' },
  { top: 50, leftStart: 11, gap: 9.9, count: 9, widths: [85, 90, 75, 80], baseRotate: 8, delayOffset: 1.85, toneStart: 'gold' },
  { top: 56, leftStart: 8, gap: 10.1, count: 10, widths: [75, 80, 95, 70], baseRotate: -8, delayOffset: 2.1, toneStart: 'blue' },
  { top: 62, leftStart: 12, gap: 9.8, count: 9, widths: [95, 85, 80, 75], baseRotate: 6, delayOffset: 2.35, toneStart: 'gold' },
  { top: 68, leftStart: 9, gap: 10.0, count: 10, widths: [70, 90, 75, 85], baseRotate: -7, delayOffset: 2.6, toneStart: 'blue' },
  { top: 74, leftStart: 13, gap: 9.7, count: 9, widths: [85, 75, 90, 80], baseRotate: 8, delayOffset: 2.85, toneStart: 'gold' },
  { top: 80, leftStart: 10, gap: 9.9, count: 10, widths: [80, 85, 70, 95], baseRotate: -9, delayOffset: 3.1, toneStart: 'blue' },
  { top: 86, leftStart: 14, gap: 9.6, count: 8, widths: [90, 80, 85, 75], baseRotate: 7, delayOffset: 3.35, toneStart: 'gold' },
  { top: 92, leftStart: 11, gap: 9.8, count: 10, widths: [75, 95, 80, 85], baseRotate: -8, delayOffset: 3.6, toneStart: 'blue' },
];

const NEURAL_LINES: NeuralLine[] = NEURAL_ROWS.flatMap((row, rowIndex) =>
  Array.from({ length: row.count }, (_, index) => {
    const top = row.top + ((index % 4) - 1.5) * 0.9;
    const left = row.leftStart + index * row.gap + ((index + rowIndex) % 2 === 0 ? 0 : 1.4);
    const width = row.widths[index % row.widths.length] + (index % 2 === 0 ? 0 : 6);
    const rotate = row.baseRotate + ((index % 3) - 1) * 3;
    const toneOffset = row.toneStart === 'gold' ? 1 : 0;
    const tone = (index + toneOffset) % 2 === 0 ? 'blue' : 'gold';
    const delay = (row.delayOffset + index * 0.19) % 3.6;

    return {
      top: `${top.toFixed(1)}%`,
      left: `${left.toFixed(1)}%`,
      width: `${width}px`,
      rotate: `${rotate.toFixed(1)}deg`,
      tone,
      delay: `${delay.toFixed(2)}s`,
    };
  }),
);

export default function Landing() {
  const navigate = useNavigate();
  const shouldReduceMotion = useReducedMotion();
  const sceneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!sceneRef.current) return;
      const rect = sceneRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      sceneRef.current.style.setProperty('--mouse-x', `${x}px`);
      sceneRef.current.style.setProperty('--mouse-y', `${y}px`);
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

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
          staggerChildren: shouldReduceMotion ? 0 : 0.045,
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
    <div className="landing-page">
      <div className="scene-bg" aria-hidden="true" ref={sceneRef}>
        <div className="orb orb-a" />
        <div className="orb orb-b" />
        <div className="neural-lines">
          {NEURAL_LINES.map((line, index) => (
            <span
              key={`base-${line.tone}-${index}`}
              className={`neural-line neural-line-${line.tone}`}
              style={{
                top: line.top,
                left: line.left,
                width: line.width,
                transform: `rotate(${line.rotate})`,
                animationDelay: line.delay,
              }}
            />
          ))}
        </div>
        <div className="neural-lines neural-lines-glow">
          {NEURAL_LINES.map((line, index) => (
            <span
              key={`glow-${line.tone}-${index}`}
              className={`neural-line neural-line-${line.tone}`}
              style={{
                top: line.top,
                left: line.left,
                width: line.width,
                transform: `rotate(${line.rotate})`,
                animationDelay: line.delay,
              }}
            />
          ))}
        </div>
      </div>

      <nav className="landing-nav">
        <div className="nav-container">
          <div className="nav-logo">
            <Logo size={56} animated={true} glow={true} />
            <span className="logo-text">Optileno</span>
          </div>
          <div className="nav-actions">
            <button className="nav-btn-secondary btn-premium" onClick={() => navigate('/register')}>Try Optileno For Free</button>
            <button className="nav-btn-secondary btn-premium" onClick={() => navigate('/chat-leno')}>Leno AI Free Chat</button>
            <button className="nav-link btn-premium" onClick={() => navigate('/login')}>Login</button>
            <button className="nav-btn-primary btn-premium" onClick={() => navigate('/register')}>Get Access</button>
          </div>
        </div>
      </nav>

      <main className="hero-section">
        <h1 className="visually-hidden">10x Your Productivity With The Ultimate AI Operating System</h1>

        <motion.section
          className="hero-content"
          initial="hidden"
          animate="visible"
          variants={revealVariants}
          custom={0.02}
        >
          <motion.span className="kicker" variants={revealVariants} custom={0.08}>
            AI Productivity Platform For The AI Era
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

          <motion.p className="hero-subtitle" variants={revealVariants} custom={0.16}>
            Unify your workflow with intelligent planning, proactive deep work blocks, and
            behavioral analytics to execute faster.
          </motion.p>

          <div className="hero-pill-row" aria-label="Core Optileno capabilities">
            {HERO_PILLS.map((pill, index) => (
              <motion.span
                key={pill}
                className="hero-pill"
                variants={revealVariants}
                initial="hidden"
                animate="visible"
                custom={0.2 + index * 0.04}
              >
                {pill}
              </motion.span>
            ))}
          </div>

          <div className="hero-stats">
            {HERO_METRICS.map((metric, index) => (
              <motion.div
                className="stat-card"
                key={metric.label}
                variants={revealVariants}
                initial="hidden"
                animate="visible"
                custom={0.28 + index * 0.05}
              >
                {metric.icon}
                <span>{metric.label}</span>
              </motion.div>
            ))}
          </div>

          <motion.div className="cta-wrapper hero-cta-stack" variants={revealVariants} custom={0.48}>
            <button className="cta-button btn-premium" onClick={() => navigate('/register')}>
              Try Optileno For Free
              <ArrowRight size={18} />
            </button>
            <button className="cta-button-secondary btn-premium" onClick={() => navigate('/chat-leno')}>
              Leno AI Free Chat
            </button>
            <button className="cta-button-tertiary btn-premium" onClick={() => navigate('/dashboard-preview')}>
              See Dashboard Preview
              <ArrowUpRight size={16} />
            </button>
            <p className="cta-note">3-day free trial. Built for serious execution teams and ambitious individuals.</p>
          </motion.div>
        </motion.section>

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

              <div className="screen-frame">
                <img
                  src={`/${screen.fileName}`}
                  alt={screen.title}
                  loading="lazy"
                  onError={(event) => {
                    const target = event.currentTarget;
                    target.style.display = 'none';
                    const placeholder = target.nextElementSibling as HTMLElement | null;
                    if (placeholder) {
                      placeholder.style.display = 'flex';
                    }
                  }}
                />
                <div className="screen-placeholder" style={{ display: 'none' }}>
                  Add <strong>{screen.fileName}</strong> to <code>frontend/public</code>
                </div>
              </div>
            </motion.article>
          ))}
        </motion.section>

        <motion.section
          className="features-section"
          aria-label="Platform features"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          variants={revealVariants}
          custom={0.04}
        >
          <h2>Built for measurable output, not vanity metrics</h2>
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
            <h2>One layer for project, time, and focus execution</h2>
            <p>
              Structured for serious work, designed for speed.
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
            <h2>Built for professionals and high-output teams</h2>
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
              <span className="journey-kicker">Start Today</span>
              <h2>Begin Journey with Optileno</h2>
              <p>
                Launch your AI productivity stack in minutes and move from planning to measurable execution.
              </p>
            </div>
            <div className="journey-actions">
              <button className="cta-button btn-premium" onClick={() => navigate('/register')}>
                Begin Journey
                <ArrowRight size={18} />
              </button>
              <button className="cta-button-secondary btn-premium" onClick={() => navigate('/chat-leno')}>
                Try Leno AI Free Chat
              </button>
              <button className="cta-button-tertiary btn-premium" onClick={() => navigate('/login')}>
                Login
              </button>
            </div>
          </div>
        </motion.section>
      </main>

      <footer className="landing-footer">
        <p>© 2026. Serious productivity, engineered with AI.</p>
        <p className="footer-note">Goals. Planning. Execution. One system.</p>
      </footer>
    </div>
  );
}
