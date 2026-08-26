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
    heroSubheading: "Stop paying $34/month for rigid algorithmic reshuffling. Optileno provides intentional AI sprint planning with built-in Burnout Telemetry, Big Five Personality Calibration, and flexible $19/mo monthly pricing with no annual lock-in required.",
    metaTitle: "Best Motion App Alternative for Solo Operators | Optileno",
    metaDescription: "Looking for the best Motion app alternative? Optileno offers AI sprint planning, burnout risk detection, and Big Five calibration at $19/mo with no mandatory annual lock-in.",
    competitorPrice: "$34/mo (Monthly) | $19/mo (Annual)",
    optilenoPrice: "$0 Free | $19/mo Monthly | $12.90/mo Annual",
    summaryQuote: "Motion attempts to micromanage every 15-minute slot algorithmically, moving meetings and tasks without context. Optileno acts as an intelligent partner with human-in-the-loop confirmation that defends your deep work blocks without overwhelming your schedule.",
    features: [
      {
        name: "100% Free Tier Forever",
        description: "Zero credit card required to manage daily tasks, habits, and focus sessions.",
        optileno: "Yes (Free Forever)",
        competitor: "No (7-Day Trial Only)"
      },
      {
        name: "Month-to-Month Flexibility",
        description: "Monthly subscription price without requiring a 1-year upfront commitment.",
        optileno: "$19 / mo",
        competitor: "$34.00 / mo ($19 only on annual)"
      },
      {
        name: "Annual Subscription Value",
        description: "Discounted yearly plan for committed founders.",
        optileno: "~$12.90 / mo (₹12,999 / $155/yr)",
        competitor: "$19.00 / mo ($228.00/yr)"
      },
      {
        name: "Human-in-the-Loop Confirmation",
        description: "AI drafts and suggests schedule optimizations, but never overrides your calendar without explicit approval.",
        optileno: true,
        competitor: "False (Autonomous rescheduling)"
      },
      {
        name: "Burnout Risk & Telemetry Scoring",
        description: "Predictive cognitive fatigue indicators based on focus habits and work patterns.",
        optileno: true,
        competitor: false
      },
      {
        name: "Big Five Personality Calibration",
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
        name: "1-Click Google Calendar & .ics Sync",
        description: "Export and sync tasks and deep work blocks directly to Google Calendar, Apple Calendar, or Outlook.",
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
        question: "How does Optileno's pricing compare to Motion?",
        answer: "Motion costs $34/month on month-to-month billing and only drops to $19/month if you pay for a full year upfront ($228). Optileno gives you full Ultra Pro access for $19/month month-to-month (no annual lock-in), and drops to ~$12.90/month ($155/yr) on annual billing—saving you over 32% on annual and 44% on monthly."
      },
      {
        question: "Why is human-in-the-loop planning better than Motion's autonomous shuffling?",
        answer: "Motion frequently moves tasks and blocks automatically without understanding real-world client context, causing schedule confusion. Optileno generates high-precision recommendations but requires your confirmation before updating your schedule."
      },
      {
        question: "How does Optileno's Burnout Telemetry differ from Motion?",
        answer: "Motion relentlessly packs every open block, accelerating cognitive fatigue. Optileno continuously measures task-switching frequency and consecutive sprint hours to alert you before burnout occurs."
      },
      {
        question: "Can I use Optileno alongside Google Calendar and Outlook?",
        answer: "Yes! Optileno allows you to export your scheduled tasks and deep work sessions directly to Google Calendar with 1 click, or download standard .ics calendar feeds for Outlook and Apple Calendar."
      }
    ]
  },
  sunsama: {
    name: "Sunsama",
    slug: "sunsama",
    tagline: "Optileno vs. Sunsama",
    heroHeading: "Sunsama vs Optileno for Developers & Operators",
    heroSubheading: "Sunsama requires a 20–30 minute manual planning ritual every morning with no AI auto-scheduling. Optileno gives technical founders 90-second AI sprint triage, conversational coaching, and proactive burnout prevention.",
    metaTitle: "Sunsama vs Optileno for Developers & Operators | Optileno",
    metaDescription: "Comparing Sunsama vs Optileno: Discover why fast-moving operators choose Optileno's 90-second AI triage and burnout analytics over Sunsama's manual planning ritual.",
    competitorPrice: "$25/mo (Monthly) | $20/mo (Annual)",
    optilenoPrice: "$0 Free | $19/mo Monthly | $12.90/mo Annual",
    summaryQuote: "Sunsama is intentionally designed for users who enjoy spending 20–30 minutes manually organizing tasks each morning. Optileno is built for technical solo operators who want Chat Leno AI to instantly triage tasks and allocate deep work blocks in under 90 seconds.",
    features: [
      {
        name: "Free Forever Tier",
        description: "Full daily task and habit tracking with zero payment required.",
        optileno: "Yes (100% Free)",
        competitor: "No (14-Day Trial Only)"
      },
      {
        name: "Planning Philosophy & Speed",
        description: "How your daily schedule gets assembled.",
        optileno: "90-Second AI Triage",
        competitor: "20–30 Min Manual Ritual (No AI by design)"
      },
      {
        name: "Monthly Price",
        description: "Standard month-to-month subscription rate.",
        optileno: "$19 / mo",
        competitor: "$25.00 / mo ($20 on annual)"
      },
      {
        name: "Burnout Risk Telemetry",
        description: "Real-time indicators that signal cognitive overload and excessive work strain.",
        optileno: true,
        competitor: "End-of-day reflection prompt"
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
        name: "Calendar Export & Sync (.ics / GCal)",
        description: "Direct export and synchronization into external calendars.",
        optileno: true,
        competitor: true
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
        question: "Why do fast-moving operators choose Optileno over Sunsama?",
        answer: "While Sunsama encourages a slow, manual 25-minute morning planning routine, Optileno uses Chat Leno AI to decompose revenue goals into daily tasks in under 90 seconds, saving hours each week."
      },
      {
        question: "Does Sunsama offer AI auto-scheduling?",
        answer: "No. Sunsama deliberately avoids AI auto-scheduling, positioning manual time-boxing as a mindfulness exercise. Optileno is built for operators who want high-leverage AI automation combined with human control."
      },
      {
        question: "How does Optileno protect against developer burnout?",
        answer: "Optileno measures task-switching velocity, sprint duration, and Big Five personality indicators to warn you when your cognitive load exceeds safe thresholds."
      }
    ]
  },
  reclaim: {
    name: "Reclaim.ai",
    slug: "reclaim",
    tagline: "Optileno vs. Reclaim.ai",
    heroHeading: "Optileno vs Reclaim.ai: AI Operating System vs Calendar Plugin",
    heroSubheading: "Reclaim is a smart calendar auto-blocking plugin for Google Calendar. Optileno is a complete cognitive workstation combining Chat Leno AI sprint coaching, Big Five personality calibration, goal decomposition, and predictive burnout telemetry.",
    metaTitle: "Optileno vs Reclaim.ai for Solo Operators & Founders | Optileno",
    metaDescription: "Compare Optileno vs Reclaim.ai. Discover why solo founders choose Optileno for conversational AI coaching, Big Five work-style tuning, and complete goal tracking.",
    competitorPrice: "$0 Free (Limited) | $8–$10 / mo",
    optilenoPrice: "$0 Free Forever | $19 / mo Ultra Pro",
    summaryQuote: "Reclaim excels as a defensive calendar blocker inside Google Calendar, but lacks conversational reasoning, psychological adaptation, and goal execution breakdown. Optileno pairs calendar protection with an executive AI partner that actively helps you hit revenue milestones.",
    features: [
      {
        name: "AI Conversational Coach (Chat Leno)",
        description: "Natural dialogue with an executive AI partner that knows your active goals, habits, and workload.",
        optileno: true,
        competitor: false
      },
      {
        name: "Big Five Personality Work-Style Calibration",
        description: "Customizes scheduling intensity to your individual conscientiousness and stress tolerance.",
        optileno: true,
        competitor: false
      },
      {
        name: "Predictive Burnout Risk Telemetry",
        description: "Real-time cognitive fatigue metrics analyzing sprint volume and task-switching intensity.",
        optileno: true,
        competitor: "Basic Habit Stats"
      },
      {
        name: "Goal-to-Task AI Deconstruction",
        description: "Transforms high-level agency and product goals into actionable daily sprints.",
        optileno: true,
        competitor: false
      },
      {
        name: "Built-in Deep Work Timer Engine",
        description: "Dedicated focus mode with pause/resume telemetry and session tracking.",
        optileno: true,
        competitor: false
      },
      {
        name: "1-Click Google Calendar & .ics Sync",
        description: "Export tasks and scheduled deep work blocks to Google Calendar and Outlook.",
        optileno: true,
        competitor: "Native Google/Outlook Sync"
      },
      {
        name: "Weekly AI Growth Tools (Prioritizer & Planner)",
        description: "Instant AI triage tools that rank tasks by revenue impact and effort.",
        optileno: true,
        competitor: false
      }
    ],
    faqs: [
      {
        question: "How is Optileno different from Reclaim.ai?",
        answer: "Reclaim is a background calendar utility that moves habit blocks within Google Calendar. Optileno is a full cognitive operating system with conversational AI coaching (Chat Leno), goal deconstruction, Big Five psychological calibration, and a dedicated focus timer."
      },
      {
        question: "Can I use Optileno with my existing calendar?",
        answer: "Yes! Optileno features 1-click Google Calendar event generation and exportable RFC-5545 .ics calendar feeds compatible with Google Calendar, Microsoft Outlook, and Apple Calendar."
      },
      {
        question: "Why does Big Five Personality Calibration matter?",
        answer: "Standard calendar tools treat every human identically. Optileno calibrates task density and break frequency to your psychological profile, preventing ADHD task paralysis and overcommitment."
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
            <Link to="/vs/reclaim">Optileno vs Reclaim</Link>
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
