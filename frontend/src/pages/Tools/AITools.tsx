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
  Clock,
  Flame,
  Zap,
  Activity,
  CalendarCheck,
} from "lucide-react";
import SEO from "../../components/common/SEO";
import { api } from "../../services/api/client";
import "./ai-tools.css";

type ToolId = "task-prioritizer" | "weekly-planner" | "schedule-generator" | "burnout-calculator";

type ToolMeta = {
  id: ToolId;
  label: string;
  title: string;
  description: string;
  endpoint: string;
  leadTool: string;
  canonicalPath: string;
  icon: typeof Sparkles;
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

type ScheduleSlot = {
  type: string;
  time: string;
  title: string;
  duration_minutes: number;
  energy: string;
  recommendation: string;
};

type ScheduleGeneratorResult = {
  schedule_theme: string;
  total_focus_minutes: number;
  slots: ScheduleSlot[];
  top_rule: string;
  share_hook?: string;
  optileno_bridge?: string;
};

type BurnoutCalculatorResult = {
  burnout_score: number;
  tier: string;
  color: string;
  summary: string;
  recovery_actions: string[];
  metrics_breakdown: {
    weekly_hours: number;
    daily_switches: number;
    meeting_hours: number;
    sleep_hours: number;
    weekend_work: boolean;
  };
  share_hook?: string;
  optileno_bridge?: string;
};

type ToolResult =
  | TaskPrioritizerResult
  | WeeklyPlannerResult
  | ScheduleGeneratorResult
  | BurnoutCalculatorResult;

const TOOL_META: Record<ToolId, ToolMeta> = {
  "task-prioritizer": {
    id: "task-prioritizer",
    label: "Task Prioritizer",
    title: "Free AI Task Prioritizer",
    description:
      "Paste a messy task list and get a ranked execution plan with focus blocks, what to do first, and what to avoid today.",
    endpoint: "/tools/task-prioritizer",
    leadTool: "ai-task-prioritizer",
    canonicalPath: "/tools/ai-task-prioritizer",
    icon: ClipboardList,
  },
  "weekly-planner": {
    id: "weekly-planner",
    label: "Weekly Planner",
    title: "Free AI Weekly Sprint Planner",
    description:
      "Turn one important goal into a practical 7-day plan with daily tasks, focus blocks, and review prompts.",
    endpoint: "/tools/weekly-planner",
    leadTool: "ai-weekly-planner",
    canonicalPath: "/tools/ai-weekly-planner",
    icon: CalendarDays,
  },
  "schedule-generator": {
    id: "schedule-generator",
    label: "Schedule Generator",
    title: "Free AI Daily Schedule Generator",
    description:
      "Convert your to-do items into an energy-optimized, time-blocked daily calendar in under 5 seconds.",
    endpoint: "/tools/schedule-generator",
    leadTool: "ai-schedule-generator",
    canonicalPath: "/tools/ai-schedule-generator",
    icon: Clock,
  },
  "burnout-calculator": {
    id: "burnout-calculator",
    label: "Burnout Calculator",
    title: "Free Burnout Risk & Cognitive Fatigue Calculator",
    description:
      "Evaluate your weekly work hours, meeting load, and task-switching to quantify your cognitive fatigue score.",
    endpoint: "/tools/burnout-calculator",
    leadTool: "burnout-risk-calculator",
    canonicalPath: "/tools/burnout-risk-calculator",
    icon: Activity,
  },
};

const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"];

const getAnonymousId = () => {
  const key = "optileno_growth_anonymous_id";
  const existing = typeof window !== "undefined" ? window.localStorage.getItem(key) : null;
  if (existing) return existing;

  const nextId =
    typeof window !== "undefined" && typeof window.crypto?.randomUUID === "function"
      ? window.crypto.randomUUID()
      : `anon_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(key, nextId);
  }
  return nextId;
};

const collectUtm = () => {
  if (typeof window === "undefined") return {};
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

const isScheduleResult = (result: ToolResult | null): result is ScheduleGeneratorResult =>
  Boolean(result && "slots" in result);

const isBurnoutResult = (result: ToolResult | null): result is BurnoutCalculatorResult =>
  Boolean(result && "burnout_score" in result);

export default function AITools({ initialTool = "task-prioritizer" }: { initialTool?: ToolId }) {
  const navigate = useNavigate();
  const [activeTool, setActiveTool] = useState<ToolId>(initialTool);

  // Form states
  const [tasksText, setTasksText] = useState(
    "Fix checkout bug before demo\nPublish launch update\nResearch new ideas\nEmail beta users",
  );
  const [taskAudience, setTaskAudience] = useState("founder");
  const [workHours, setWorkHours] = useState(6);

  const [goal, setGoal] = useState("Launch the beta onboarding flow");
  const [weeklyAudience, setWeeklyAudience] = useState("creator");
  const [hoursPerDay, setHoursPerDay] = useState(2);

  const [scheduleTasks, setScheduleTasks] = useState(
    "Deep work on client deliverable\nInbox zero and team replies\nDeploy landing page updates\nPlan tomorrow's sprint"
  );
  const [startHour, setStartHour] = useState(9);
  const [scheduleHours, setScheduleHours] = useState(8);

  const [weeklyHours, setWeeklyHours] = useState(55);
  const [contextSwitches, setContextSwitches] = useState(20);
  const [meetingHours, setMeetingHours] = useState(12);
  const [sleepHours, setSleepHours] = useState(6.5);
  const [weekendWork, setWeekendWork] = useState(true);

  const [result, setResult] = useState<ToolResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [leadMessage, setLeadMessage] = useState("");
  const [leadLoading, setLeadLoading] = useState(false);
  const [nextUrl, setNextUrl] = useState("");

  const anonymousId = useMemo(getAnonymousId, []);
  const activeMeta = TOOL_META[activeTool] || TOOL_META["task-prioritizer"];
  const sourcePath = typeof window !== "undefined" ? window.location.pathname : activeMeta.canonicalPath;
  const isToolIndex = sourcePath === "/tools" || sourcePath === "/free-ai-tools";
  const canonicalPath = isToolIndex ? "/tools" : activeMeta.canonicalPath;
  const canonicalUrl = `https://www.optileno.com${canonicalPath}`;
  const sourceUrl = typeof window !== "undefined" ? window.location.href : canonicalUrl;
  const utm = useMemo(collectUtm, []);

  useEffect(() => {
    if (initialTool && TOOL_META[initialTool]) {
      setActiveTool(initialTool);
    }
  }, [initialTool]);

  const runTool = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setLeadMessage("");
    setNextUrl("");

    let payload: Record<string, any> = {
      anonymous_id: anonymousId,
      source_path: sourcePath,
      source_url: sourceUrl,
      utm,
    };

    if (activeTool === "task-prioritizer") {
      payload = {
        ...payload,
        tasks_text: tasksText,
        audience: taskAudience,
        work_hours: workHours,
      };
    } else if (activeTool === "weekly-planner") {
      payload = {
        ...payload,
        goal,
        audience: weeklyAudience,
        hours_per_day: hoursPerDay,
      };
    } else if (activeTool === "schedule-generator") {
      payload = {
        ...payload,
        tasks_text: scheduleTasks,
        start_hour: startHour,
        work_hours: scheduleHours,
      };
    } else if (activeTool === "burnout-calculator") {
      payload = {
        ...payload,
        weekly_hours: weeklyHours,
        daily_context_switches: contextSwitches,
        weekly_meeting_hours: meetingHours,
        sleep_hours: sleepHours,
        weekend_work: weekendWork,
      };
    }

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

    setLeadMessage(response.data?.message || "Saved. Create a free Optileno account to continue.");
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
        title={isToolIndex ? "Free AI Productivity Tools & Daily Generators | Optileno" : `${activeMeta.title} | Optileno`}
        description={`${activeMeta.description} Free online tool with instant export to Optileno.`}
        canonicalUrl={canonicalUrl}
        keywords="free AI productivity tools, AI task prioritizer, AI weekly planner, AI schedule generator, burnout risk calculator, time blocking tool"
      />

      <div className="ai-tools-page">
        <header className="ai-tools-header">
          <nav className="ai-tools-nav">
            <Link to="/" className="ai-tools-brand">
              <Sparkles size={20} />
              <span>Optileno</span>
            </Link>
            <div className="ai-tools-nav-links">
              <Link to="/ai-calendar-planner">AI Calendar</Link>
              <Link to="/vs/motion">Motion Alternative</Link>
              <Link to="/register" className="ai-tools-cta">Start Free Forever</Link>
            </div>
          </nav>
        </header>

        <main className="ai-tools-main">
          <section className="ai-tools-hero">
            <span className="ai-tools-badge">100% Free • No Sign-Up Required to Test</span>
            <h1>{activeMeta.title}</h1>
            <p>{activeMeta.description}</p>
          </section>

          {/* Tool Switcher Tabs */}
          <div className="ai-tools-tabs" role="tablist" aria-label="Productivity Tools">
            {(Object.keys(TOOL_META) as ToolId[]).map((key) => {
              const meta = TOOL_META[key];
              const Icon = meta.icon;
              return (
                <button
                  key={key}
                  role="tab"
                  aria-selected={activeTool === key}
                  className={`ai-tools-tab ${activeTool === key ? "active" : ""}`}
                  onClick={() => switchTool(key)}
                >
                  <Icon size={16} />
                  <span>{meta.label}</span>
                </button>
              );
            })}
          </div>

          <section className="ai-tools-layout">
            {/* Tool Input Form */}
            <form className="ai-tools-card" onSubmit={runTool}>
              {activeTool === "task-prioritizer" && (
                <>
                  <label className="ai-tools-field">
                    <span>Your task list (one per line)</span>
                    <textarea
                      value={tasksText}
                      onChange={(event) => setTasksText(event.target.value)}
                      rows={6}
                      placeholder="Paste tasks here..."
                      maxLength={8000}
                    />
                  </label>
                  <div className="ai-tools-field-row">
                    <label className="ai-tools-field">
                      <span>Work type</span>
                      <select value={taskAudience} onChange={(event) => setTaskAudience(event.target.value)}>
                        <option value="founder">Founder / Operator</option>
                        <option value="developer">Developer</option>
                        <option value="creator">Creator</option>
                        <option value="student">Student</option>
                      </select>
                    </label>
                    <label className="ai-tools-field">
                      <span>Hours available today</span>
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
              )}

              {activeTool === "weekly-planner" && (
                <>
                  <label className="ai-tools-field">
                    <span>Primary Weekly Goal</span>
                    <textarea
                      value={goal}
                      onChange={(event) => setGoal(event.target.value)}
                      rows={5}
                      placeholder="e.g. Ship the client onboarding MVP..."
                      maxLength={2000}
                    />
                  </label>
                  <div className="ai-tools-field-row">
                    <label className="ai-tools-field">
                      <span>Role</span>
                      <select value={weeklyAudience} onChange={(event) => setWeeklyAudience(event.target.value)}>
                        <option value="founder">Founder</option>
                        <option value="creator">Creator</option>
                        <option value="operator">Operator</option>
                        <option value="team">Team Lead</option>
                      </select>
                    </label>
                    <label className="ai-tools-field">
                      <span>Hours per day dedicated</span>
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

              {activeTool === "schedule-generator" && (
                <>
                  <label className="ai-tools-field">
                    <span>Tasks to time-block today</span>
                    <textarea
                      value={scheduleTasks}
                      onChange={(event) => setScheduleTasks(event.target.value)}
                      rows={6}
                      placeholder="List your items to block into the day..."
                      maxLength={8000}
                    />
                  </label>
                  <div className="ai-tools-field-row">
                    <label className="ai-tools-field">
                      <span>Start Hour</span>
                      <select value={startHour} onChange={(event) => setStartHour(Number(event.target.value))}>
                        <option value={7}>7:00 AM</option>
                        <option value={8}>8:00 AM</option>
                        <option value={9}>9:00 AM</option>
                        <option value={10}>10:00 AM</option>
                      </select>
                    </label>
                    <label className="ai-tools-field">
                      <span>Workday Duration</span>
                      <select value={scheduleHours} onChange={(event) => setScheduleHours(Number(event.target.value))}>
                        <option value={4}>4 Hours (Part-time)</option>
                        <option value={6}>6 Hours (Focused)</option>
                        <option value={8}>8 Hours (Standard)</option>
                        <option value={10}>10 Hours (Sprint)</option>
                      </select>
                    </label>
                  </div>
                </>
              )}

              {activeTool === "burnout-calculator" && (
                <>
                  <div className="ai-tools-field-row">
                    <label className="ai-tools-field">
                      <span>Weekly Work Hours ({weeklyHours}h)</span>
                      <input
                        type="range"
                        min={20}
                        max={90}
                        value={weeklyHours}
                        onChange={(event) => setWeeklyHours(Number(event.target.value))}
                      />
                    </label>
                    <label className="ai-tools-field">
                      <span>Daily Context Switches (~{contextSwitches})</span>
                      <input
                        type="range"
                        min={1}
                        max={50}
                        value={contextSwitches}
                        onChange={(event) => setContextSwitches(Number(event.target.value))}
                      />
                    </label>
                  </div>

                  <div className="ai-tools-field-row">
                    <label className="ai-tools-field">
                      <span>Weekly Meeting Hours ({meetingHours}h)</span>
                      <input
                        type="number"
                        min={0}
                        max={40}
                        value={meetingHours}
                        onChange={(event) => setMeetingHours(Number(event.target.value))}
                      />
                    </label>
                    <label className="ai-tools-field">
                      <span>Sleep per Night ({sleepHours}h)</span>
                      <input
                        type="number"
                        min={4}
                        max={10}
                        step={0.5}
                        value={sleepHours}
                        onChange={(event) => setSleepHours(Number(event.target.value))}
                      />
                    </label>
                  </div>

                  <label className="ai-tools-field" style={{ flexDirection: 'row', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={weekendWork}
                      onChange={(event) => setWeekendWork(event.target.checked)}
                      style={{ width: 'auto', margin: 0 }}
                    />
                    <span>I frequently work on weekends</span>
                  </label>
                </>
              )}

              {error && <p className="ai-tools-error">{error}</p>}

              <button type="submit" className="ai-tools-submit" disabled={loading}>
                {loading ? <Loader2 className="ai-tools-spin" size={18} /> : <Sparkles size={18} />}
                Generate with AI
              </button>
            </form>

            {/* Tool Output / Result Box */}
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

              {isScheduleResult(result) && (
                <div className="ai-tools-output">
                  <div className="ai-tools-output-head">
                    <Clock size={20} />
                    <div>
                      <span>Daily Schedule</span>
                      <h2>{result.schedule_theme}</h2>
                    </div>
                  </div>

                  <div className="ai-tools-priority-list">
                    {result.slots.map((slot, index) => (
                      <article key={index} className="ai-tools-priority" style={{ borderLeftColor: slot.type === 'deep_work' ? '#60a5fa' : slot.type === 'break' ? '#34d399' : '#a78bfa' }}>
                        <div className="ai-tools-rank" style={{ fontSize: '0.75rem', width: 'auto', padding: '0 8px' }}>{slot.time}</div>
                        <div>
                          <h3>{slot.title}</h3>
                          <p>{slot.recommendation}</p>
                          <span>{slot.duration_minutes} min · {slot.energy}</span>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              )}

              {isBurnoutResult(result) && (
                <div className="ai-tools-output">
                  <div className="ai-tools-output-head" style={{ borderBottomColor: result.color }}>
                    <Activity size={24} style={{ color: result.color }} />
                    <div>
                      <span style={{ color: result.color, fontWeight: 700 }}>{result.tier}</span>
                      <h2>Burnout Risk Score: {result.burnout_score} / 100</h2>
                    </div>
                  </div>

                  <p style={{ margin: '1rem 0', lineHeight: '1.5', color: 'var(--text-secondary)' }}>
                    {result.summary}
                  </p>

                  <div className="ai-tools-avoid" style={{ background: 'rgba(255, 255, 255, 0.03)' }}>
                    <h3 style={{ color: 'var(--text-primary)' }}>Recommended Telemetry Adjustments</h3>
                    {result.recovery_actions.map((act, index) => (
                      <p key={index}>• {act}</p>
                    ))}
                  </div>
                </div>
              )}

              {result && (
                <form className="ai-tools-lead" onSubmit={captureLead}>
                  <div>
                    <h3>Save & Sync with Optileno</h3>
                    <p>Get this plan sent to your email and import it directly into your free Optileno daily planner.</p>
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
                    {leadLoading ? <Loader2 className="ai-tools-spin" size={16} /> : "Import to Optileno Free"}
                  </button>
                  {leadMessage && (
                    <div className="ai-tools-lead-message">
                      <span>{leadMessage}</span>
                      {nextUrl && (
                        <button type="button" onClick={() => navigate(nextUrl)}>
                          Continue to App
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
