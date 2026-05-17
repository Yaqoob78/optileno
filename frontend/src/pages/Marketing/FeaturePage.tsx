import { type ReactElement } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, BarChart3, Bot, CalendarCheck2, LayoutDashboard, Target } from "lucide-react";
import SEO from "../../components/common/SEO";
import "./feature-page.css";

type FeatureKey =
  | "chat-leno"
  | "plan-task"
  | "show-analytics"
  | "dashboard-preview"
  | "goal-progress";

interface FeaturePageProps {
  featureKey: FeatureKey;
}

type FeatureConfig = {
  title: string;
  subtitle: string;
  icon: ReactElement;
  eyebrow: string;
  bullets: string[];
  metaTitle: string;
  metaDescription: string;
  canonicalPath: string;
};

const FEATURE_CONFIG: Record<FeatureKey, FeatureConfig> = {
  "chat-leno": {
    title: "Chat Leno",
    subtitle: "A calm AI partner for focused decisions, planning, and execution.",
    icon: <Bot size={26} />,
    eyebrow: "AI Assistant",
    bullets: [
      "Intent-aware replies that stay concise and actionable.",
      "Context from your goals, tasks, and habits.",
      "Clear follow-up suggestions when momentum drops.",
    ],
    metaTitle: "Chat Leno - AI Productivity Coaching by Optileno",
    metaDescription: "Use Chat Leno, Optileno's AI productivity coach, for practical planning, task decisions, and daily execution support.",
    canonicalPath: "/chat-leno",
  },
  "plan-task": {
    title: "Plan Task",
    subtitle: "Turn priorities into structured tasks with clear timing and execution blocks.",
    icon: <CalendarCheck2 size={26} />,
    eyebrow: "Task Planning",
    bullets: [
      "Task creation with practical effort and timing defaults.",
      "Daily structure aligned with your current focus window.",
      "Cleaner handoff from planning to deep-work execution.",
    ],
    metaTitle: "Plan Task - AI Task Management in Optileno",
    metaDescription: "Plan Task helps you build better daily plans with AI task management, smart structure, timing, and execution blocks in Optileno.",
    canonicalPath: "/plan-task",
  },
  "show-analytics": {
    title: "Show Analytics",
    subtitle: "Real analytics for focus, productivity, risk signals, and improvement loops.",
    icon: <BarChart3 size={26} />,
    eyebrow: "Performance Analytics",
    bullets: [
      "Focus heatmaps and productivity trend visibility.",
      "Burnout risk and behavior-based AI insights.",
      "Metrics that map to your actual planner and chat activity.",
    ],
    metaTitle: "Show Analytics - AI Productivity Analytics by Optileno",
    metaDescription: "Track productivity, focus, and burnout signals with Optileno analytics that reflect real planning, task, and behavior patterns.",
    canonicalPath: "/show-analytics",
  },
  "dashboard-preview": {
    title: "Dashboard",
    subtitle: "A single command center for chat, planning, focus, and progress.",
    icon: <LayoutDashboard size={26} />,
    eyebrow: "Command Center",
    bullets: [
      "Live status of tasks, goals, and active focus sessions.",
      "Quick transitions from review to action.",
      "Clear navigation for daily execution.",
    ],
    metaTitle: "Dashboard - Optileno AI Productivity Command Center",
    metaDescription: "Use the Optileno dashboard to manage AI planning, task management, chat, goals, and analytics from one productivity command center.",
    canonicalPath: "/dashboard-preview",
  },
  "goal-progress": {
    title: "Goal Progress",
    subtitle: "Measure daily movement toward long-term goals with transparent scoring.",
    icon: <Target size={26} />,
    eyebrow: "Goal Intelligence",
    bullets: [
      "Goal tracking connected directly to task completion.",
      "Progress clarity with milestone-aware interpretation.",
      "Actionable next-step suggestions from AI patterns.",
    ],
    metaTitle: "Goal Progress - AI Goal Intelligence by Optileno",
    metaDescription: "Track and improve goal progress with AI-backed feedback tied to your Optileno planner, tasks, and daily execution activity.",
    canonicalPath: "/goal-progress",
  },
};

export default function FeaturePage({ featureKey }: FeaturePageProps) {
  const navigate = useNavigate();
  const feature = FEATURE_CONFIG[featureKey];
  const canonicalUrl = `https://www.optileno.com${feature.canonicalPath}`;

  return (
    <>
      <SEO title={feature.metaTitle} description={feature.metaDescription} canonicalUrl={canonicalUrl} />
      <div className="feature-page-shell">
        <div className="feature-page-noise" />
        <main className="feature-page-card">
          <div className="feature-page-header">
            <Link to="/" className="feature-page-brand">
              <img src="/logo-light.svg" alt="Optileno" />
              <span>Optileno</span>
            </Link>
            <span className="feature-page-eyebrow">{feature.eyebrow}</span>
          </div>

          <div className="feature-page-body">
            <div className="feature-page-icon">{feature.icon}</div>
            <h1>{feature.title}</h1>
            <p className="feature-page-subtitle">{feature.subtitle}</p>

            <ul className="feature-page-list">
              {feature.bullets.map((bullet) => (
                <li key={bullet}>{bullet}</li>
              ))}
            </ul>
          </div>

          <div className="feature-page-actions">
            <button type="button" className="feature-primary-btn" onClick={() => navigate("/register")}>
              Start With Optileno
              <ArrowRight size={16} />
            </button>
            <button type="button" className="feature-secondary-btn" onClick={() => navigate("/")}>
              Back to Home
            </button>
          </div>
        </main>
      </div>
    </>
  );
}
