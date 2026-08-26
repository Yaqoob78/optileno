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
  | "goal-progress"
  | "ai-planner"
  | "ai-task-manager"
  | "ai-task"
  | "ai-productivity"
  | "ai-daily-productivity"
  | "ai-calendar-planner"
  | "workflow-automation-agency-owners";

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
  "ai-planner": {
    title: "AI Planner",
    subtitle: "AI-powered daily planning that turns goals into tasks, focus windows, and progress checkpoints.",
    icon: <CalendarCheck2 size={26} />,
    eyebrow: "AI Planner",
    bullets: [
      "Auto-suggested task planning for your most important work.",
      "Daily schedules that adapt to your focus and capacity.",
      "Planner insights linked directly to execution and goals.",
    ],
    metaTitle: "AI Planner for Daily Tasks, Goals, and Focus - Optileno",
    metaDescription: "Use Optileno as an AI planner for daily task planning, focus blocks, goal tracking, and productivity analytics.",
    canonicalPath: "/ai-planner",
  },
  "ai-calendar-planner": {
    title: "AI Calendar Planner",
    subtitle: "Intelligent time blocking, automated schedule optimization, and seamless task-to-calendar execution.",
    icon: <CalendarCheck2 size={26} />,
    eyebrow: "AI Calendar & Schedule",
    bullets: [
      "Autonomous time blocking that defends your highest-leverage deep work windows.",
      "Energy-aware schedule distribution based on your personal productivity peaks.",
      "Instant schedule realignment when priorities change without calendar friction.",
    ],
    metaTitle: "AI Calendar Planner & Smart Time Blocking - Optileno",
    metaDescription: "Automate your daily schedule with Optileno's AI calendar planner. Smart time blocking, energy-aware task scheduling, and deep work focus protection.",
    canonicalPath: "/ai-calendar-planner",
  },
  "workflow-automation-agency-owners": {
    title: "Workflow Automation for Agency Owners",
    subtitle: "Eliminate operational bottlenecks, automate client deliverables, and protect founder bandwidth with AI.",
    icon: <Target size={26} />,
    eyebrow: "Agency Workflow Automation",
    bullets: [
      "Intelligent task triage that routes client deliverables without breaking flow state.",
      "Burnout risk analytics that highlight operational strain before deadlines slip.",
      "High-level agency milestones transformed into structured daily sprint blocks.",
    ],
    metaTitle: "Workflow Automation for Agency Owners & Founders - Optileno",
    metaDescription: "Streamline client deliverables, automate task prioritization, prevent team burnout, and scale your agency with Optileno's AI workflow automation.",
    canonicalPath: "/workflow-automation-agency-owners",
  },
  "ai-task-manager": {
    title: "AI Task Manager",
    subtitle: "Manage your tasks with AI prioritization, execution structure, and progress visibility.",
    icon: <CalendarCheck2 size={26} />,
    eyebrow: "AI Task Manager",
    bullets: [
      "Smart task prioritization based on urgency, impact, and burnout risk.",
      "Structured daily execution blocks for every task.",
      "Progress tracking that keeps task work aligned with goals.",
    ],
    metaTitle: "AI Task Manager for Priorities and Execution - Optileno",
    metaDescription: "Optileno is an AI task manager for prioritizing work, planning focus sessions, tracking goals, and improving daily productivity.",
    canonicalPath: "/ai-task-manager",
  },
  "ai-task": {
    title: "AI Task",
    subtitle: "A smarter way to plan, prioritize, and complete task work with AI guidance.",
    icon: <CalendarCheck2 size={26} />,
    eyebrow: "AI Task",
    bullets: [
      "Task creation guided by context and goal alignment.",
      "Daily execution recommendations to reduce task overload.",
      "Clear next steps that keep task work moving forward.",
    ],
    metaTitle: "AI Task Planning and Prioritization - Optileno",
    metaDescription: "Plan AI task workflows with Optileno, prioritize important work, and turn daily tasks into measurable goal progress.",
    canonicalPath: "/ai-task",
  },
  "ai-productivity": {
    title: "AI Productivity App",
    subtitle: "Boost daily productivity with AI planning, task management, and focus analytics.",
    icon: <Target size={26} />,
    eyebrow: "AI Productivity",
    bullets: [
      "AI-driven daily planning for more productive workdays.",
      "Task, focus, and goal tracking in one productivity workspace.",
      "Insights that help you keep work moving without overwhelm.",
    ],
    metaTitle: "AI Productivity App for Planning and Analytics - Optileno",
    metaDescription: "Optileno is an AI productivity app for daily planning, task management, focus analytics, burnout signals, and goal progress.",
    canonicalPath: "/ai-productivity",
  },
  "ai-daily-productivity": {
    title: "AI Daily Productivity Planner",
    subtitle: "Create daily plans with AI-powered task execution, focus blocks, and goal momentum.",
    icon: <Target size={26} />,
    eyebrow: "Daily Productivity",
    bullets: [
      "AI-designed daily routines for peak productivity.",
      "Task and focus recommendations aligned with your real day.",
      "Daily progress signals to prevent missed work and burnout.",
    ],
    metaTitle: "AI Daily Productivity Planner for Focus Work - Optileno",
    metaDescription: "Use Optileno as an AI daily productivity planner for task execution, focus blocks, routines, and goal-driven workdays.",
    canonicalPath: "/ai-daily-productivity",
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
            <button type="button" className="feature-secondary-btn" onClick={() => navigate("/tools")}>
              Try Free AI Tools
            </button>
          </div>
        </main>
      </div>
    </>
  );
}
