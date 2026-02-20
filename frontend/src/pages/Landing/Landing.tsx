import React from 'react';
import { useNavigate } from 'react-router-dom';
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

export default function Landing() {
  const navigate = useNavigate();

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
            <button className="nav-btn-secondary" onClick={() => navigate('/register')}>Try Optileno For Free</button>
            <button className="nav-btn-secondary" onClick={() => navigate('/chat-leno')}>Leno AI Free Chat</button>
            <button className="nav-link" onClick={() => navigate('/login')}>Login</button>
            <button className="nav-btn-primary" onClick={() => navigate('/register')}>Get Access</button>
          </div>
        </div>
      </nav>

      <main className="hero-section">
        <section className="hero-content">
          <span className="kicker">AI Productivity Platform For The AI Era</span>
          <h1 className="hero-title">Get an unfair advantage with AI that doubles daily productivity.</h1>
          <p className="hero-subtitle">
            Optileno unifies AI Projects, AI Tasks, AI Calendar, AI Meetings, AI Docs, AI Notes, AI Reports,
            AI Workflows, and more so your team executes faster with less overhead.
          </p>

          <div className="hero-pill-row" aria-label="Core Optileno capabilities">
            <span className="hero-pill">AI Projects</span>
            <span className="hero-pill">AI Tasks</span>
            <span className="hero-pill">AI Calendar</span>
            <span className="hero-pill">AI Meetings</span>
            <span className="hero-pill">AI Docs</span>
            <span className="hero-pill">AI Reports</span>
          </div>

          <div className="hero-stats">
            {HERO_METRICS.map((metric) => (
              <div className="stat-card" key={metric.label}>
                {metric.icon}
                <span>{metric.label}</span>
              </div>
            ))}
          </div>

          <div className="cta-wrapper hero-cta-stack">
            <button className="cta-button" onClick={() => navigate('/register')}>
              Try Optileno For Free
              <ArrowRight size={18} />
            </button>
            <button className="cta-button-secondary" onClick={() => navigate('/chat-leno')}>
              Leno AI Free Chat
            </button>
            <button className="cta-button-tertiary" onClick={() => navigate('/dashboard-preview')}>
              See Dashboard Preview
              <ArrowUpRight size={16} />
            </button>
            <p className="cta-note">3-day free trial. Built for serious execution teams and ambitious individuals.</p>
          </div>
        </section>

        <section className="screens-section" aria-label="Product screenshots">
          {SCREEN_CARDS.map((screen) => (
            <article key={screen.fileName} className="screen-card">
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
            </article>
          ))}
        </section>

        <section className="features-section" aria-label="Platform features">
          <h2>Built for measurable output, not vanity metrics</h2>
          <div className="features-grid">
            {FEATURES.map((feature) => (
              <article key={feature.title} className="feature-card">
                <div className="feature-icon">{feature.icon}</div>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="capabilities-section" aria-label="Platform capability categories">
          <div className="section-heading">
            <span>Platform Capabilities</span>
            <h2>One operating layer for project, time, and knowledge execution</h2>
            <p>
              Structured like enterprise software, designed for speed like an AI-native workspace.
            </p>
          </div>

          <div className="capabilities-grid">
            {CAPABILITY_GROUPS.map((group) => (
              <article key={group.title} className="capability-card">
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
              </article>
            ))}
          </div>
        </section>

        <section className="use-cases-section" aria-label="Optileno use cases">
          <div className="section-heading">
            <span>Use Cases</span>
            <h2>Built for service organizations and high-output internal teams</h2>
            <p>
              Choose your operating mode and run planning, delivery, and reporting from one AI platform.
            </p>
          </div>

          <div className="use-case-grid">
            {USE_CASE_GROUPS.map((group) => (
              <article key={group.title} className="use-case-card">
                <div className="use-case-head">
                  {group.icon}
                  <h3>{group.title}</h3>
                </div>
                <div className="use-case-list">
                  {group.entries.map((entry) => (
                    <span key={entry}>{entry}</span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="journey-section" aria-label="Start your Optileno journey">
          <div className="journey-card">
            <div className="journey-copy">
              <span className="journey-kicker">Start Today</span>
              <h2>Begin Journey with Optileno</h2>
              <p>
                Launch your AI productivity stack in minutes and move from planning to measurable execution.
              </p>
            </div>
            <div className="journey-actions">
              <button className="cta-button" onClick={() => navigate('/register')}>
                Begin Journey
                <ArrowRight size={18} />
              </button>
              <button className="cta-button-secondary" onClick={() => navigate('/chat-leno')}>
                Try Leno AI Free Chat
              </button>
              <button className="cta-button-tertiary" onClick={() => navigate('/login')}>
                Login
              </button>
            </div>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <p>© 2026 Optileno. Serious productivity, engineered with AI.</p>
        <p className="footer-note">AI projects. AI planning. AI execution. One system.</p>
      </footer>
    </div>
  );
}
