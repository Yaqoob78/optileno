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
import { Interactive3DCard } from '../../components/landing/Interactive3DCard';
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

const WAVE_PATHS = Array.from({ length: 42 }).map((_, i) => {
  const y = 40 + i * 26;
  const phaseRow = i * 0.3;
  const cy1 = y - 130 + Math.sin(phaseRow) * 80;
  const cy2 = y + 130 + Math.sin(phaseRow - 1.2) * 80;
  const cy3 = y + Math.sin(phaseRow - 2.4) * 60;
  return `M -100 ${y} C 480 ${cy1}, 1020 ${cy2}, 1600 ${cy3}`;
});

export default function Landing() {
  const navigate = useNavigate();
  const shouldReduceMotion = useReducedMotion();
  const sceneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let animationFrameId: number;
    let time = 0;

    const renderWaves = () => {
      time += 0.003; // Controls how fast the waves undulate
      if (!sceneRef.current) return;

      const basePaths = sceneRef.current.querySelectorAll('.waves-base path');
      const activePaths = sceneRef.current.querySelectorAll('.waves-active path');

      for (let i = 0; i < 42; i++) {
        const y = 40 + i * 26;
        const phaseRow = i * 0.3;
        const waveSpeed = time * 2;

        const cy1 = y - 130 + Math.sin(phaseRow + waveSpeed) * 80;
        const cy2 = y + 130 + Math.sin(phaseRow + waveSpeed - 1.2) * 80;
        const cy3 = y + Math.sin(phaseRow + waveSpeed - 2.4) * 60;

        const d = `M -100 ${y} C 480 ${cy1}, 1020 ${cy2}, 1600 ${cy3}`;

        if (basePaths[i]) basePaths[i].setAttribute('d', d);
        if (activePaths[i]) activePaths[i].setAttribute('d', d);
      }

      animationFrameId = requestAnimationFrame(renderWaves);
    };

    renderWaves();

    const handleMouseMove = (e: MouseEvent) => {
      if (!sceneRef.current) return;
      const rect = sceneRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      sceneRef.current.style.setProperty('--mouse-x', `${x}px`);
      sceneRef.current.style.setProperty('--mouse-y', `${y}px`);
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animationFrameId);
    };
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

              <Interactive3DCard fileName={screen.fileName} title={screen.title} />
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
