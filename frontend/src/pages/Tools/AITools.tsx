import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Loader2,
  Mail,
  Sparkles,
  Timer,
} from "lucide-react";
import SEO from "../../components/common/SEO";
import { api } from "../../services/api/client";
import "./ai-tools.css";

type ToolId = "task-prioritizer" | "weekly-planner";

type ToolMeta = {
  id: ToolId;
  label: string;
  title: string;
  description: string;
  endpoint: string;
  leadTool: string;
  canonicalPath: string;
};

type TaskPriority = {
  rank: number;
  task: string;
  score: number;
  estimated_minutes: number;
  why_now: string;
  next_action: string;
};

type TimeBlock = {
  label: string;
  task: string;
  time: string;
  minutes: number;
};

type TaskPrioritizerResult = {
  summary: string;
  top_priorities: TaskPriority[];
  time_blocks: TimeBlock[];
  not_to_do_today: Array<{ task: string; reason: string }>;
  focus_rule?: string;
  share_hook?: string;
  optileno_bridge?: string;
};

type WeeklyPlannerDay = {
  day: number;
  focus: string;
  tasks: string[];
  focus_block_minutes: number;
  success_metric: string;
  avoid: string;
};

type WeeklyPlannerResult = {
  weekly_theme: string;
  audience: string;
  days: WeeklyPlannerDay[];
  review_questions: string[];
  share_hook?: string;
  optileno_bridge?: string;
};

type ToolResult = TaskPrioritizerResult | WeeklyPlannerResult;

const TOOL_META: Record<ToolId, ToolMeta> = {
  "task-prioritizer": {
    id: "task-prioritizer",
    label: "AI Task Prioritizer",
    title: "Free AI Task Prioritizer",
    description:
      "Paste a messy task list and get a ranked execution plan with focus blocks, what to do first, and what to avoid today.",
    endpoint: "/tools/task-prioritizer",
    leadTool: "ai-task-prioritizer",
    canonicalPath: "/tools/ai-task-prioritizer",
  },
  "weekly-planner": {
    id: "weekly-planner",
    label: "AI Weekly Planner",
    title: "Free AI Weekly Planner",
    description:
      "Turn one important goal into a practical 7-day plan with daily tasks, focus blocks, and review prompts.",
    endpoint: "/tools/weekly-planner",
    leadTool: "ai-weekly-planner",
    canonicalPath: "/tools/ai-weekly-planner",
  },
};

const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"];

const getAnonymousId = () => {
  const key = "optileno_growth_anonymous_id";
  const existing = window.localStorage.getItem(key);
  if (existing) return existing;

  const nextId =
    typeof window.crypto?.randomUUID === "function"
      ? window.crypto.randomUUID()
      : `anon_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  window.localStorage.setItem(key, nextId);
  return nextId;
};

const collectUtm = () => {
  const params = new URLSearchParams(window.location.search);
  return UTM_KEYS.reduce<Record<string, string>>((acc, key) => {
    const value = params.get(key);
    if (value) acc[key] = value;
    return acc;
  }, {});
};

const isTaskPrioritizerResult = (result: ToolResult | null): result is TaskPrioritizerResult =>
  Boolean(result && "top_priorities" in result);

const isWeeklyPlannerResult = (result: ToolResult | null): result is WeeklyPlannerResult =>
  Boolean(result && "days" in result);

export default function AITools({ initialTool = "task-prioritizer" }: { initialTool?: ToolId }) {
  const navigate = useNavigate();
  const [activeTool, setActiveTool] = useState<ToolId>(initialTool);
  const [tasksText, setTasksText] = useState(
    "Fix checkout bug before demo\nPublish launch update\nResearch new ideas\nEmail beta users",
  );
  const [taskAudience, setTaskAudience] = useState("founder");
  const [workHours, setWorkHours] = useState(6);
  const [goal, setGoal] = useState("Launch the beta onboarding flow");
  const [weeklyAudience, setWeeklyAudience] = useState("creator");
  const [hoursPerDay, setHoursPerDay] = useState(2);
  const [result, setResult] = useState<ToolResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [leadMessage, setLeadMessage] = useState("");
  const [leadLoading, setLeadLoading] = useState(false);
  const [nextUrl, setNextUrl] = useState("");

  const anonymousId = useMemo(getAnonymousId, []);
  const activeMeta = TOOL_META[activeTool];
  const sourcePath = typeof window !== "undefined" ? window.location.pathname : activeMeta.canonicalPath;
  const isToolIndex = sourcePath === "/tools" || sourcePath === "/free-ai-tools";
  const canonicalPath = isToolIndex ? "/tools" : activeMeta.canonicalPath;
  const canonicalUrl = `https://www.optileno.com${canonicalPath}`;
  const sourceUrl = typeof window !== "undefined" ? window.location.href : canonicalUrl;
  const utm = useMemo(collectUtm, []);

  useEffect(() => {
    setActiveTool(initialTool);
  }, [initialTool]);

  const runTool = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setLeadMessage("");
    setNextUrl("");

    const payload =
      activeTool === "task-prioritizer"
        ? {
            tasks_text: tasksText,
            audience: taskAudience,
            work_hours: workHours,
            anonymous_id: anonymousId,
            source_path: sourcePath,
            source_url: sourceUrl,
            utm,
          }
        : {
            goal,
            audience: weeklyAudience,
            hours_per_day: hoursPerDay,
            anonymous_id: anonymousId,
            source_path: sourcePath,
            source_url: sourceUrl,
            utm,
          };

    const response = await api.post<ToolResult>(activeMeta.endpoint, payload);
    setLoading(false);

    if (!response.success || !response.data) {
      setError(response.error?.message || "Could not generate the plan. Please try again.");
      return;
    }

    setResult(response.data);
  };

  const captureLead = async (event: FormEvent) => {
    event.preventDefault();
    if (!result) return;

    setLeadLoading(true);
    setLeadMessage("");

    const response = await api.post<{ next_url?: string; message?: string }>("/growth/leads", {
      email,
      tool: activeMeta.leadTool,
      source_path: sourcePath,
      source_url: sourceUrl,
      anonymous_id: anonymousId,
      utm,
      result_snapshot: result,
      consent: true,
    });

    setLeadLoading(false);

    if (!response.success) {
      setLeadMessage(response.error?.message || "Could not save this result yet.");
      return;
    }

    setLeadMessage(response.data?.message || "Saved. Create an Optileno account to continue.");
    setNextUrl(response.data?.next_url || `/register?source=${activeMeta.leadTool}`);
  };

  const switchTool = (toolId: ToolId) => {
    setActiveTool(toolId);
    setResult(null);
    setError("");
    setLeadMessage("");
    setNextUrl("");
  };

  return (
    <>
      <SEO
        title={isToolIndex ? "Free AI Productivity Tools | Optileno" : `${activeMeta.title} | Optileno`}
        description={`${activeMeta.description} Built for AI planning, task management, and daily productivity.`}
        canonicalUrl={canonicalUrl}
      />
      <div className="ai-tools-page">
        <header className="ai-tools-nav">
          <Link to="/" className="ai-tools-brand">
            <img src="/logo-light.svg" alt="Optileno" />
            <span>Optileno</span>
          </Link>
          <div className="ai-tools-nav-actions">
            <button type="button" onClick={() => navigate("/")}>Home</button>
            <button type="button" className="ai-tools-nav-primary" onClick={() => navigate("/register")}>
              Start Free Forever
            </button>
          </div>
        </header>

        <main className="ai-tools-main">
          <section className="ai-tools-hero">
            <span className="ai-tools-kicker">
              <Sparkles size={15} />
              Free AI productivity tools
            </span>
            <h1>Plan the work before the day runs away.</h1>
            <p>
              Use Optileno's free AI tools to prioritize tasks, build a weekly plan,
              and then turn the result into a live AI productivity system.
            </p>
            <div className="ai-tools-pills" aria-label="Tool selector">
              {(Object.keys(TOOL_META) as ToolId[]).map((toolId) => (
                <button
                  key={toolId}
                  type="button"
                  className={activeTool === toolId ? "active" : ""}
                  onClick={() => switchTool(toolId)}
                >
                  {toolId === "task-prioritizer" ? <ClipboardList size={17} /> : <CalendarDays size={17} />}
                  {TOOL_META[toolId].label}
                </button>
              ))}
            </div>
          </section>

          <section className="ai-tools-workspace">
            <form className="ai-tools-panel" onSubmit={runTool}>
              <div className="ai-tools-panel-head">
                <span>{activeMeta.label}</span>
                <h2>{activeMeta.title}</h2>
                <p>{activeMeta.description}</p>
              </div>

              {activeTool === "task-prioritizer" ? (
                <>
                  <label className="ai-tools-field">
                    <span>Tasks</span>
                    <textarea
                      value={tasksText}
                      onChange={(event) => setTasksText(event.target.value)}
                      rows={8}
                      maxLength={8000}
                    />
                  </label>
                  <div className="ai-tools-field-row">
                    <label className="ai-tools-field">
                      <span>Work type</span>
                      <select value={taskAudience} onChange={(event) => setTaskAudience(event.target.value)}>
                        <option value="founder">Founder</option>
                        <option value="creator">Creator</option>
                        <option value="student">Student</option>
                        <option value="operator">Operator</option>
                      </select>
                    </label>
                    <label className="ai-tools-field">
                      <span>Hours available</span>
                      <input
                        type="number"
                        min={1}
                        max={12}
                        value={workHours}
                        onChange={(event) => setWorkHours(Number(event.target.value))}
                      />
                    </label>
                  </div>
                </>
              ) : (
                <>
                  <label className="ai-tools-field">
                    <span>Goal</span>
                    <textarea
                      value={goal}
                      onChange={(event) => setGoal(event.target.value)}
                      rows={5}
                      maxLength={2000}
                    />
                  </label>
                  <div className="ai-tools-field-row">
                    <label className="ai-tools-field">
                      <span>Work type</span>
                      <select value={weeklyAudience} onChange={(event) => setWeeklyAudience(event.target.value)}>
                        <option value="creator">Creator</option>
                        <option value="founder">Founder</option>
                        <option value="student">Student</option>
                        <option value="team">Team</option>
                      </select>
                    </label>
                    <label className="ai-tools-field">
                      <span>Hours per day</span>
                      <input
                        type="number"
                        min={1}
                        max={8}
                        value={hoursPerDay}
                        onChange={(event) => setHoursPerDay(Number(event.target.value))}
                      />
                    </label>
                  </div>
                </>
              )}

              {error && <p className="ai-tools-error">{error}</p>}

              <button type="submit" className="ai-tools-submit" disabled={loading}>
                {loading ? <Loader2 className="ai-tools-spin" size={18} /> : <Sparkles size={18} />}
                Generate Plan
              </button>
            </form>

            <aside className="ai-tools-result">
              {!result && (
                <div className="ai-tools-empty">
                  <Timer size={34} />
                  <h2>Your result appears here</h2>
                  <p>Optileno will turn your input into a clear execution plan with practical next steps.</p>
                </div>
              )}

              {isTaskPrioritizerResult(result) && (
                <div className="ai-tools-output">
                  <div className="ai-tools-output-head">
                    <CheckCircle2 size={20} />
                    <div>
                      <span>Priority plan</span>
                      <h2>{result.summary}</h2>
                    </div>
                  </div>

                  <div className="ai-tools-priority-list">
                    {result.top_priorities.map((item) => (
                      <article key={`${item.rank}-${item.task}`} className="ai-tools-priority">
                        <div className="ai-tools-rank">#{item.rank}</div>
                        <div>
                          <h3>{item.task}</h3>
                          <p>{item.why_now}</p>
                          <span>{item.estimated_minutes} min · score {item.score}</span>
                        </div>
                      </article>
                    ))}
                  </div>

                  <div className="ai-tools-mini-grid">
                    {result.time_blocks.map((block) => (
                      <div key={`${block.label}-${block.time}`} className="ai-tools-mini-card">
                        <span>{block.time}</span>
                        <p>{block.task}</p>
                      </div>
                    ))}
                  </div>

                  {result.not_to_do_today.length > 0 && (
                    <div className="ai-tools-avoid">
                      <h3>Park these for now</h3>
                      {result.not_to_do_today.map((item) => (
                        <p key={item.task}>{item.task}</p>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {isWeeklyPlannerResult(result) && (
                <div className="ai-tools-output">
                  <div className="ai-tools-output-head">
                    <CheckCircle2 size={20} />
                    <div>
                      <span>7-day plan</span>
                      <h2>{result.weekly_theme}</h2>
                    </div>
                  </div>

                  <div className="ai-tools-days">
                    {result.days.map((day) => (
                      <article key={day.day} className="ai-tools-day">
                        <span>Day {day.day}</span>
                        <h3>{day.focus}</h3>
                        <ul>
                          {day.tasks.map((task) => (
                            <li key={task}>{task}</li>
                          ))}
                        </ul>
                        <p>{day.focus_block_minutes} min focus block</p>
                      </article>
                    ))}
                  </div>
                </div>
              )}

              {result && (
                <form className="ai-tools-lead" onSubmit={captureLead}>
                  <div>
                    <h3>Save this inside Optileno</h3>
                    <p>Send the result to your inbox and continue with live tasks, goals, and focus sessions.</p>
                  </div>
                  <label>
                    <Mail size={16} />
                    <input
                      type="email"
                      required
                      placeholder="you@example.com"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                    />
                  </label>
                  <button type="submit" disabled={leadLoading}>
                    {leadLoading ? <Loader2 className="ai-tools-spin" size={16} /> : "Save Result"}
                  </button>
                  {leadMessage && (
                    <div className="ai-tools-lead-message">
                      <span>{leadMessage}</span>
                      {nextUrl && (
                        <button type="button" onClick={() => navigate(nextUrl)}>
                          Continue
                          <ArrowRight size={14} />
                        </button>
                      )}
                    </div>
                  )}
                </form>
              )}
            </aside>
          </section>
        </main>
      </div>
    </>
  );
}
