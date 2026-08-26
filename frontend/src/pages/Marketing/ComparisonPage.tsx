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
    heroHeading: "The Smart, Lightweight Motion Alternative for Solo Agencies",
    heroSubheading: "Stop paying $34/month for complex algorithmic overload. Optileno delivers calm AI planning, burnout prevention, and goal-to-task automation at a fraction of the cost.",
    metaTitle: "Optileno vs Motion: Best AI Calendar Planner for Agency Owners (2026)",
    metaDescription: "Comparing Optileno vs Motion App: Discover why solo agency owners and operators choose Optileno for AI calendar planning, burnout risk detection, and transparent pricing.",
    competitorPrice: "$34 / month",
    optilenoPrice: "$0 Free / $6.99 Ultra Pro",
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
        optileno: "$6.99 / mo",
        competitor: "$34.00 / mo"
      },
      {
        name: "Conversational AI Coach (Chat Leno)",
        description: "Natural dialogue with an executive AI assistant that knows your active goals and habits.",
        optileno: true,
        competitor: false
      },
      {
        name: "Burnout Risk & Telemetry Scoring",
        description: "Predictive cognitive fatigue indicators based on focus habits and work patterns.",
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
        name: "Big Five Personality Work-Style Calibration",
        description: "Adapts scheduling recommendations to your conscientiousness and stress tolerance.",
        optileno: true,
        competitor: false
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
        question: "Why switch from Motion to Optileno?",
        answer: "Optileno is engineered for operators and agency owners who need clear execution without Motion's steep $34/mo price tag and rigid schedule rearrangement. Optileno includes AI coaching, burnout warnings, and a genuine 100% Free tier."
      },
      {
        question: "Can I use Optileno alongside Google Calendar?",
        answer: "Yes! Optileno integrates seamlessly with your calendar workflow, allowing you to time-block tasks, protect deep work focus windows, and track goal progress in real time."
      },
      {
        question: "Is Optileno really 100% free?",
        answer: "Yes. The Explorer plan is free forever with 15 AI requests/day, full task management, habit tracking, and productivity analytics. Ultra Pro is only $6.99/mo if you want autonomous agentic planning."
      }
    ]
  },
  sunsama: {
    name: "Sunsama",
    slug: "sunsama",
    tagline: "Optileno vs. Sunsama",
    heroHeading: "AI-Powered Daily Planning Designed for High-Output Operators",
    heroSubheading: "Sunsama is great for manual time-boxing, but Optileno adds the missing piece: autonomous AI agent intelligence, conversational task breakdown, and burnout detection.",
    metaTitle: "Optileno vs Sunsama: AI Task & Calendar Planner for Developers & Agencies",
    metaDescription: "Optileno vs Sunsama comparison: See how Optileno's AI intelligence, automated sprint planning, and $6.99 pricing compare to Sunsama's $20/mo manual workflow.",
    competitorPrice: "$20 / month",
    optilenoPrice: "$0 Free / $6.99 Ultra Pro",
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
        optileno: "$6.99 / mo",
        competitor: "$20.00 / mo"
      },
      {
        name: "Autonomous AI Task Breakdown",
        description: "LLM-driven goal-to-task decomposition and timeline estimation.",
        optileno: true,
        competitor: "Manual Drag-and-Drop"
      },
      {
        name: "Burnout Risk Analytics",
        description: "Real-time indicators that signal cognitive overload and excessive work strain.",
        optileno: true,
        competitor: "Daily Shutdown Prompts"
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
        question: "How does Optileno differ from Sunsama?",
        answer: "Sunsama focuses on manual mindful planning, whereas Optileno combines mindfulness with autonomous AI execution, generative sprint breakdown, and proactive burnout prevention for 65% lower cost."
      },
      {
        question: "Who is Optileno best suited for?",
        answer: "Solo agency owners, software engineers, technical founders, and freelance operators who want maximum output without manual admin friction."
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
