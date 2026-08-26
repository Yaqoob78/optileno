import React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Check, X, ArrowRight, ShieldCheck, Zap, Sparkles, Brain, Clock, DollarSign } from 'lucide-react';
import SEO from '../../components/common/SEO';
import './comparison-page.css';

interface CompetitorData {
  name: string;
  slug: string;
  tagline: string;
  heroHeading: string;
  heroSubheading: string;
  metaTitle: string;
  metaDescription: string;
  competitorPrice: string;
  optilenoPrice: string;
  summaryQuote: string;
  features: {
    name: string;
    description: string;
    optileno: boolean | string;
    competitor: boolean | string;
  }[];
  faqs: {
    question: string;
    answer: string;
  }[];
}

const COMPARISON_DATA: Record<string, CompetitorData> = {
  motion: {
    name: "Motion",
    slug: "motion",
    tagline: "Optileno vs. Motion App",
    heroHeading: "Best Motion App Alternative for Solo Operators",
    heroSubheading: "Stop paying $34/month for rigid algorithmic overload. Optileno combines autonomous AI calendar planning, built-in Burnout Telemetry, and Big Five Personality Calibration to protect your deep work and mental bandwidth.",
    metaTitle: "Best Motion App Alternative for Solo Operators | Optileno",
    metaDescription: "Looking for the best Motion app alternative? Optileno offers AI calendar planning, burnout risk detection, and Big Five work-style calibration without the $34/mo price tag.",
    competitorPrice: "$34 / month",
    optilenoPrice: "$0 Free / $19 Ultra Pro",
    summaryQuote: "Motion attempts to micromanage every 15-minute slot algorithmically, leading to schedule fatigue. Optileno acts as an intelligent partner that defends your deep work blocks without overwhelming you.",
    features: [
      {
        name: "100% Free Tier Forever",
        description: "Zero credit card required to manage daily tasks, habits, and focus sessions.",
        optileno: "Yes (Free Forever)",
        competitor: "No (7-Day Trial Only)"
      },
      {
        name: "Monthly Price (Pro Tier)",
        description: "Standard monthly cost for autonomous AI planning and full features.",
        optileno: "$19 / mo (or $6.99 Early-Bird)",
        competitor: "$34.00 / mo"
      },
      {
        name: "Burnout Risk & Telemetry Scoring",
        description: "Predictive cognitive fatigue indicators based on focus habits and work patterns.",
        optileno: true,
        competitor: false
      },
      {
        name: "Big Five Personality Work-Style Calibration",
        description: "Adapts scheduling recommendations to your conscientiousness and stress tolerance.",
        optileno: true,
        competitor: false
      },
      {
        name: "Conversational AI Coach (Chat Leno)",
        description: "Natural dialogue with an executive AI assistant that knows your active goals and habits.",
        optileno: true,
        competitor: false
      },
      {
        name: "Autonomous Time Blocking",
        description: "Automated schedule alignment that places deep work blocks into open calendar slots.",
        optileno: true,
        competitor: true
      },
      {
        name: "Focus Heatmaps & Analytics",
        description: "Visual time distribution analysis of when you do your most impactful work.",
        optileno: true,
        competitor: "Basic Time Tracking"
      },
      {
        name: "90-Second Daily Sprint Planning",
        description: "Rapid morning alignment that bridges macro revenue goals into micro tasks.",
        optileno: true,
        competitor: false
      }
    ],
    faqs: [
      {
        question: "Why is Optileno the best Motion app alternative for solo operators?",
        answer: "Optileno is engineered specifically for solo agency founders and operators who need clear execution without Motion's steep $34/mo price tag and rigid schedule rearrangement. Optileno includes real-time Burnout Telemetry, Big Five work-style calibration, and a genuine 100% Free tier."
      },
      {
        question: "How does Optileno's Burnout Telemetry differ from Motion?",
        answer: "Motion relentlessly fills empty calendar slots, increasing cognitive fatigue. Optileno continuously measures your task-switching intensity and consecutive sprint hours to alert you before burnout occurs."
      },
      {
        question: "Can I use Optileno alongside Google Calendar?",
        answer: "Yes! Optileno integrates seamlessly with your calendar workflow, allowing you to time-block tasks, protect deep work focus windows, and track goal progress in real time."
      }
    ]
  },
  sunsama: {
    name: "Sunsama",
    slug: "sunsama",
    tagline: "Optileno vs. Sunsama",
    heroHeading: "Sunsama vs Optileno for Developers",
    heroSubheading: "Sunsama requires extensive manual dragging and time-boxing. Optileno gives developers autonomous AI agent intelligence, conversational sprint breakdown, and proactive burnout prevention.",
    metaTitle: "Sunsama vs Optileno for Developers & Operators | Optileno",
    metaDescription: "Comparing Sunsama vs Optileno for developers: Discover how Optileno's AI intelligence, automated sprint planning, and built-in burnout analytics outpace Sunsama's manual workflow.",
    competitorPrice: "$20 / month",
    optilenoPrice: "$0 Free / $19 Ultra Pro",
    summaryQuote: "While Sunsama requires extensive manual dragging and configuration every morning, Optileno uses Chat Leno AI to instantly triage tasks and suggest optimized focus windows in under 90 seconds.",
    features: [
      {
        name: "Free Forever Tier",
        description: "Full daily task and habit tracking with zero payment required.",
        optileno: "Yes (100% Free)",
        competitor: "No (14-Day Trial Only)"
      },
      {
        name: "Monthly Price",
        description: "Monthly subscription for full automated features.",
        optileno: "$19 / mo (or $6.99 Early-Bird)",
        competitor: "$20.00 / mo"
      },
      {
        name: "Burnout Risk Telemetry",
        description: "Real-time indicators that signal cognitive overload and excessive work strain.",
        optileno: true,
        competitor: "Daily Shutdown Prompts"
      },
      {
        name: "Big Five Personality Work-Style Calibration",
        description: "Personalized productivity suggestions adapted to your psychological profile.",
        optileno: true,
        competitor: false
      },
      {
        name: "Autonomous AI Task Breakdown",
        description: "LLM-driven goal-to-task decomposition and timeline estimation.",
        optileno: true,
        competitor: "Manual Drag-and-Drop"
      },
      {
        name: "Chat Leno AI Partner",
        description: "Dedicated conversational agent for real-time priority coaching and problem-solving.",
        optileno: true,
        competitor: false
      },
      {
        name: "Focus Heatmaps & Deep Work Analytics",
        description: "Detailed visualization of deep work velocity and productivity consistency.",
        optileno: true,
        competitor: "Basic Time Analytics"
      }
    ],
    faqs: [
      {
        question: "Why do developers prefer Optileno over Sunsama?",
        answer: "Developers love Optileno because it eliminates the tedious manual drag-and-drop ritual of Sunsama. With Optileno, AI automatically decomposes complex engineering goals into daily focus blocks while guarding against coding burnout."
      },
      {
        question: "How does Big Five Personality Calibration work for software engineers?",
        answer: "Optileno calibrates your schedule based on your conscientiousness, neuroticism, and focus endurance, preventing premature context switching during deep coding sessions."
      }
    ]
  }
};

export default function ComparisonPage({ competitorKey }: { competitorKey?: string }) {
  const navigate = useNavigate();
  const params = useParams();
  const key = competitorKey || params.competitor || 'motion';
  const data = COMPARISON_DATA[key.toLowerCase()] || COMPARISON_DATA.motion;

  const canonicalUrl = `https://www.optileno.com/vs/${data.slug}`;

  // Structured FAQ Schema
  const comparisonSchema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "SoftwareApplication",
        "name": "Optileno",
        "applicationCategory": "ProductivityApplication",
        "operatingSystem": "Web, Windows, macOS, iOS, Android",
        "url": canonicalUrl,
        "description": data.metaDescription,
        "offers": {
          "@type": "Offer",
          "price": "0.00",
          "priceCurrency": "USD"
        }
      },
      {
        "@type": "FAQPage",
        "mainEntity": data.faqs.map(faq => ({
          "@type": "Question",
          "name": faq.question,
          "acceptedAnswer": {
            "@type": "Answer",
            "text": faq.answer
          }
        }))
      }
    ]
  };

  return (
    <>
      <SEO
        title={data.metaTitle}
        description={data.metaDescription}
        canonicalUrl={canonicalUrl}
        keywords={`Optileno vs ${data.name}, ${data.name} alternative, AI calendar planner, workflow automation, agency productivity app`}
        schema={comparisonSchema}
      />

      <div className="comp-page-shell">
        <div className="comp-page-glow" />

        {/* Navigation Header */}
        <header className="comp-navbar">
          <Link to="/" className="comp-brand">
            <img src="/logo-light.svg" alt="Optileno" className="comp-logo-img" />
            <span className="comp-brand-text">Optileno</span>
          </Link>
          <div className="comp-nav-actions">
            <Link to="/tools" className="comp-nav-link">Free Tools</Link>
            <Link to="/login" className="comp-nav-link">Log In</Link>
            <button className="comp-btn-header" onClick={() => navigate('/register')}>
              Get Started Free
            </button>
          </div>
        </header>

        {/* Hero Section */}
        <main className="comp-container">
          <div className="comp-hero">
            <span className="comp-tagline-chip">
              <Sparkles size={14} />
              {data.tagline}
            </span>
            <h1 className="comp-hero-title">{data.heroHeading}</h1>
            <p className="comp-hero-desc">{data.heroSubheading}</p>

            <div className="comp-hero-pricing-box">
              <div className="pricing-col optileno-box">
                <span className="box-badge">Recommended</span>
                <h3>Optileno</h3>
                <div className="box-price">{data.optilenoPrice}</div>
                <p>100% Free Forever • Ultra Pro at $6.99/mo</p>
                <button className="comp-btn-cta" onClick={() => navigate('/register')}>
                  Start 100% Free
                  <ArrowRight size={16} />
                </button>
              </div>

              <div className="pricing-col competitor-box">
                <span className="box-badge competitor-badge">{data.name}</span>
                <h3>{data.name}</h3>
                <div className="box-price competitor-price">{data.competitorPrice}</div>
                <p>No permanent free tier • High recurring cost</p>
              </div>
            </div>
          </div>

          {/* Quote Section */}
          <div className="comp-quote-banner">
            <Brain size={28} className="quote-icon" />
            <p className="quote-text">"{data.summaryQuote}"</p>
          </div>

          {/* Feature Comparison Table */}
          <section className="comp-table-section">
            <div className="comp-table-header">
              <h2>Feature-by-Feature Comparison</h2>
              <p>See why agency founders and high-output builders are switching to Optileno.</p>
            </div>

            <div className="comp-table-card">
              <table className="comp-table">
                <thead>
                  <tr>
                    <th className="th-feature">Capability</th>
                    <th className="th-optileno">Optileno</th>
                    <th className="th-competitor">{data.name}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.features.map((item, idx) => (
                    <tr key={idx} className={idx % 2 === 0 ? "row-even" : "row-odd"}>
                      <td className="td-feature">
                        <strong>{item.name}</strong>
                        <span>{item.description}</span>
                      </td>
                      <td className="td-optileno">
                        {typeof item.optileno === 'boolean' ? (
                          item.optileno ? (
                            <span className="badge-check"><Check size={18} /> Yes</span>
                          ) : (
                            <span className="badge-cross"><X size={18} /> No</span>
                          )
                        ) : (
                          <strong className="text-highlight">{item.optileno}</strong>
                        )}
                      </td>
                      <td className="td-competitor">
                        {typeof item.competitor === 'boolean' ? (
                          item.competitor ? (
                            <span className="badge-check comp-subtle"><Check size={18} /> Yes</span>
                          ) : (
                            <span className="badge-cross"><X size={18} /> No</span>
                          )
                        ) : (
                          <span>{item.competitor}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Trust Value Cards */}
          <section className="comp-trust-grid">
            <div className="trust-card">
              <div className="trust-icon"><ShieldCheck size={24} /></div>
              <h3>Zero Financial Risk</h3>
              <p>Experience complete goal planning and focus tracking on our 100% Free Explorer tier. No credit card required, ever.</p>
            </div>
            <div className="trust-card">
              <div className="trust-icon"><Zap size={24} /></div>
              <h3>Sub-Second AI Intelligence</h3>
              <p>Powered by ultra-fast Llama 3.3 70B dual-engine architecture for instant schedule generation and interactive coaching.</p>
            </div>
            <div className="trust-card">
              <div className="trust-icon"><Clock size={24} /></div>
              <h3>90-Second Daily Routine</h3>
              <p>Turn ambitious quarterly goals into today’s calibrated deep work sprints in less than 90 seconds every morning.</p>
            </div>
          </section>

          {/* FAQ Accordion */}
          <section className="comp-faq-section">
            <h2>Frequently Asked Questions</h2>
            <div className="comp-faq-list">
              {data.faqs.map((faq, idx) => (
                <div key={idx} className="comp-faq-item">
                  <h3>{faq.question}</h3>
                  <p>{faq.answer}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Final Call To Action */}
          <section className="comp-final-cta">
            <h2>Ready to reclaim 10+ hours of focus every week?</h2>
            <p>Join hundreds of solo operators automating their calendar without the bloat.</p>
            <button className="comp-btn-cta large" onClick={() => navigate('/register')}>
              Start Planning Free Now
              <ArrowRight size={18} />
            </button>
            <span className="cta-subtext">No credit card required • Instant 1-click access</span>
          </section>
        </main>

        {/* Footer */}
        <footer className="comp-footer">
          <div className="comp-footer-links">
            <Link to="/vs/motion">Optileno vs Motion</Link>
            <Link to="/vs/sunsama">Optileno vs Sunsama</Link>
            <Link to="/ai-calendar-planner">AI Calendar Planner</Link>
            <Link to="/workflow-automation-agency-owners">For Agency Owners</Link>
            <Link to="/tools">Free AI Tools</Link>
            <Link to="/privacy">Privacy</Link>
            <Link to="/terms">Terms</Link>
          </div>
          <p>© 2026 Optileno. Built for high-leverage builders and operators.</p>
        </footer>
      </div>
    </>
  );
}
