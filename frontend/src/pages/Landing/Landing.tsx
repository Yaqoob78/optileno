import React from 'react';
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
  Shield,
  Clock,
  Sparkles,
  Layers,
  Workflow,
  ArrowUpRight,
} from 'lucide-react';
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
    title: 'AI Workflow Control',
    description: 'Leno turns goals into daily actions with clear priorities and adaptive planning.',
    icon: <Bot size={20} />,
  },
  {
    title: 'Planner Precision',
    description: 'Tasks, habits, and deep work blocks remain aligned with your real calendar context.',
    icon: <Calendar size={20} />,
  },
  {
    title: 'Analytics You Can Act On',
    description: 'Productivity and behavior metrics are surfaced with decisions, not noise.',
    icon: <BarChart2 size={20} />,
  },
  {
    title: 'Execution Reliability',
    description: 'Fast feedback loops, stable state sync, and predictable outcomes across sessions.',
    icon: <CheckCircle size={20} />,
  },
  {
    title: 'Trust and Security',
    description: 'Built with secure auth flows and clear data boundaries for professional use.',
    icon: <Shield size={20} />,
  },
  {
    title: 'Focus Engineering',
    description: 'Deep work timing and session quality are structured to protect high-value output.',
    icon: <Clock size={20} />,
  },
];

const SCREEN_CARDS: ScreenCard[] = [
  {
    title: 'Dashboard Overview',
    subtitle: 'Command center for focus, goals, and momentum.',
    fileName: 'dashboard-mockup.png',
    badge: 'Executive View',
  },
  {
    title: 'Planner Overview',
    subtitle: 'Daily execution stack with tasks, habits, and deep work.',
    fileName: 'planner-overall.png',
    badge: 'Planner Grid',
  },
  {
    title: 'Analytics Overview',
    subtitle: 'Performance and behavior intelligence in one place.',
    fileName: 'analytics-overall.png',
    badge: 'Insights Layer',
  },
];

const CAPABILITY_GROUPS: CapabilityGroup[] = [
  {
    title: 'Project Management',
    summary: 'Plan, schedule, and automate delivery without losing control of priorities.',
    items: [
      {
        title: 'AI Project Manager',
        description: 'Auto-build execution plans from goals, deadlines, and team constraints.',
      },
      {
        title: 'Adaptive Project Timeline',
        description: 'Visualize project phases with smart reordering when priorities change.',
      },
      {
        title: 'AI Workflows',
        description: 'Automate repeatable SOPs so recurring projects ship with less overhead.',
      },
    ],
  },
  {
    title: 'Time Management',
    summary: 'Turn scattered tasks into a structured, high-output day.',
    items: [
      {
        title: 'AI Task Manager',
        description: 'Prioritize tasks based on urgency, impact, and your actual workload.',
      },
      {
        title: 'AI Calendar Planning',
        description: 'Auto-plan focused work blocks around meetings and hard deadlines.',
      },
      {
        title: 'Meeting Assistant',
        description: 'Simplify planning, prep, and follow-ups from one execution layer.',
      },
    ],
  },
  {
    title: 'Knowledge Management',
    summary: 'Capture context quickly and convert insight into action.',
    items: [
      {
        title: 'Leno AI Chat',
        description: 'Ask, plan, and execute in one conversation instead of switching tools.',
      },
      {
        title: 'AI Meeting Notetaker',
        description: 'Auto-summarize meetings into clear action items and owners.',
      },
      {
        title: 'AI Dashboards',
        description: 'Track tasks, goals, and execution quality in one live command center.',
      },
      {
        title: 'AI Docs Assistant',
        description: 'Draft, organize, and refine documents with execution context attached.',
      },
    ],
  },
  {
    title: 'And More',
    summary: 'Expand operations with deeper intelligence and connected systems.',
    items: [
      {
        title: 'AI Sheets',
        description: 'Blend spreadsheet flexibility with AI recommendations and automation.',
      },
      {
        title: 'Integrations Layer',
        description: 'Connect existing tools without breaking execution flow in Optileno.',
      },
      {
        title: 'AI Reports',
        description: 'Generate decision-ready reports from productivity and behavior signals.',
      },
    ],
  },
];

const USE_CASE_GROUPS: UseCaseGroup[] = [
  {
    title: 'Service Businesses',
    icon: <Building2 size={18} />,
    entries: [
      'IT Service Providers',
      'Marketing Agencies',
      'Design Agencies',
      'Law Firms',
      'Consulting Businesses',
      'Construction Companies',
      'Real Estate Management',
    ],
  },
  {
    title: 'Functional Teams',
    icon: <Briefcase size={18} />,
    entries: ['Startups', 'Sales Teams', 'Executive Teams'],
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

const HERO_TITLE = 'Get an unfair advantage with AI that doubles daily productivity.';
const HERO_TITLE_WORDS = HERO_TITLE.split(' ');
const HERO_PILLS = ['AI Projects', 'AI Tasks', 'AI Calendar', 'AI Meetings', 'AI Docs', 'AI Reports'];

export default function Landing() {
  const navigate = useNavigate();
  const shouldReduceMotion = useReducedMotion();

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
      <div className="scene-bg" aria-hidden="true">
        <div className="orb orb-a" />
        <div className="orb orb-b" />
        <div className="grid-fade" />
      </div>

      <nav className="landing-nav">
        <div className="nav-container">
          <div className="nav-logo">
            <img src="/logo-light.svg" alt="Optileno" className="logo-image" />
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
            Optileno unifies AI Projects, AI Tasks, AI Calendar, AI Meetings, AI Docs, AI Notes, AI Reports,
            AI Workflows, and more so your team executes faster with less overhead.
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
            <span>Platform Capabilities</span>
            <h2>One operating layer for project, time, and knowledge execution</h2>
            <p>
              Structured like enterprise software, designed for speed like an AI-native workspace.
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
            <h2>Built for service organizations and high-output internal teams</h2>
            <p>
              Choose your operating mode and run planning, delivery, and reporting from one AI platform.
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
        <p>© 2026 Optileno. Serious productivity, engineered with AI.</p>
        <p className="footer-note">AI projects. AI planning. AI execution. One system.</p>
      </footer>
    </div>
  );
}
