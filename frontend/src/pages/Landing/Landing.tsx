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
const NEURAL_LINES: NeuralLine[] = [
  { top: '9%', left: '6%', width: '86px', rotate: '-13deg', tone: 'blue', delay: '0s' },
  { top: '12%', left: '17%', width: '58px', rotate: '-5deg', tone: 'gold', delay: '0.9s' },
  { top: '15%', left: '30%', width: '96px', rotate: '9deg', tone: 'blue', delay: '1.5s' },
  { top: '11%', left: '43%', width: '64px', rotate: '-10deg', tone: 'gold', delay: '2.3s' },
  { top: '18%', left: '54%', width: '88px', rotate: '6deg', tone: 'blue', delay: '1.1s' },
  { top: '13%', left: '66%', width: '72px', rotate: '-14deg', tone: 'gold', delay: '0.4s' },
  { top: '17%', left: '79%', width: '94px', rotate: '8deg', tone: 'blue', delay: '2.9s' },
  { top: '24%', left: '10%', width: '68px', rotate: '-7deg', tone: 'gold', delay: '1.8s' },
  { top: '27%', left: '23%', width: '92px', rotate: '11deg', tone: 'blue', delay: '0.2s' },
  { top: '23%', left: '36%', width: '76px', rotate: '-9deg', tone: 'gold', delay: '1.2s' },
  { top: '29%', left: '48%', width: '60px', rotate: '4deg', tone: 'blue', delay: '2.1s' },
  { top: '25%', left: '60%', width: '98px', rotate: '-12deg', tone: 'gold', delay: '0.7s' },
  { top: '31%', left: '73%', width: '62px', rotate: '10deg', tone: 'blue', delay: '2.6s' },
  { top: '35%', left: '14%', width: '78px', rotate: '-11deg', tone: 'gold', delay: '1.4s' },
  { top: '38%', left: '31%', width: '90px', rotate: '6deg', tone: 'blue', delay: '2.4s' },
  { top: '36%', left: '47%', width: '66px', rotate: '-6deg', tone: 'gold', delay: '0.5s' },
  { top: '41%', left: '58%', width: '84px', rotate: '12deg', tone: 'blue', delay: '1.9s' },
  { top: '39%', left: '74%', width: '70px', rotate: '-8deg', tone: 'gold', delay: '2.8s' },
  { top: '46%', left: '22%', width: '58px', rotate: '8deg', tone: 'blue', delay: '0.3s' },
  { top: '49%', left: '38%', width: '88px', rotate: '-9deg', tone: 'gold', delay: '1.7s' },
  { top: '47%', left: '53%', width: '72px', rotate: '5deg', tone: 'blue', delay: '2.5s' },
  { top: '51%', left: '68%', width: '80px', rotate: '-11deg', tone: 'gold', delay: '0.8s' },
];

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
        <div className="neural-lines">
          {NEURAL_LINES.map((line, index) => (
            <span
              key={`${line.tone}-${index}`}
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
