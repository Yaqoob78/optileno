import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Bot,
  Calendar,
  BarChart2,
  CheckCircle,
  Shield,
  Clock,
  Sparkles,
  Layers,
  Workflow,
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
            <button className="nav-link" onClick={() => navigate('/login')}>Login</button>
            <button className="nav-btn-primary" onClick={() => navigate('/register')}>Get Access</button>
          </div>
        </div>
      </nav>

      <main className="hero-section">
        <section className="hero-content">
          <span className="kicker">AI Execution Platform</span>
          <h1 className="hero-title">A professional AI workspace designed to increase execution ROI.</h1>
          <p className="hero-subtitle">
            Replace scattered tools with one high-performance operating layer for planning, deep work,
            and analytics. Built so every day starts clear and ends measurable.
          </p>

          <div className="hero-stats">
            <div className="stat-card">
              <Layers size={18} />
              <span>Unified Planning Surface</span>
            </div>
            <div className="stat-card">
              <Workflow size={18} />
              <span>Operational AI Guidance</span>
            </div>
            <div className="stat-card">
              <Sparkles size={18} />
              <span>Decision-Grade Analytics</span>
            </div>
          </div>

          <div className="cta-wrapper">
            <button className="cta-button" onClick={() => navigate('/register')}>
              Start Free Trial
              <ArrowRight size={18} />
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
      </main>

      <footer className="landing-footer">
        <p>© 2026 Optileno. Serious productivity, engineered with AI.</p>
      </footer>
    </div>
  );
}
