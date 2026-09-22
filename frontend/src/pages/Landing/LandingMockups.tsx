import { useEffect, useRef, useState } from 'react';
import { motion, useInView, useReducedMotion } from 'framer-motion';
import {
  CalendarDays,
  ChartLine,
  Check,
  ChevronRight,
  Frown,
  Laugh,
  Leaf,
  MessageCircle,
  Smile,
  Sun,
  Timer,
} from 'lucide-react';

/* Illustrative product UI for the landing story. Values are sample data,
   rendered as live HTML so they stay crisp at any size. */

const EASE = [0.22, 1, 0.36, 1] as const;

function ScoreRing({ value, size = 96, stroke = 7, animate = true }: { value: number; size?: number; stroke?: number; animate?: boolean }) {
  const ref = useRef<SVGSVGElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const shown = !animate || inView;
  return (
    <svg ref={ref} className="mk-ring" width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={r} className="mk-ring-track" strokeWidth={stroke} fill="none" />
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        className="mk-ring-fill"
        strokeWidth={stroke}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={circumference}
        initial={{ strokeDashoffset: circumference }}
        animate={{ strokeDashoffset: shown ? circumference * (1 - value / 100) : circumference }}
        transition={{ duration: 1.6, ease: EASE, delay: 0.2 }}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" className="mk-ring-value">
        {value}
      </text>
    </svg>
  );
}

/* ─── 03 · Dashboard ─── */

const DASH_NAV = [
  { icon: Sun, label: 'Today' },
  { icon: CalendarDays, label: 'Planner' },
  { icon: Timer, label: 'Focus' },
  { icon: MessageCircle, label: 'Leno' },
  { icon: ChartLine, label: 'Insights' },
];

const DASH_TODAY = [
  { label: 'Read 30 minutes', done: true },
  { label: 'Workout', done: true },
  { label: 'Work on project', done: false },
  { label: 'Plan tomorrow', done: false },
];

export function DashboardMockup() {
  return (
    <div className="mk-device" aria-hidden="true">
      <aside className="mk-dash-side">
        <div className="mk-dash-brand">
          <span className="mk-dot-logo" />
          Optileno
        </div>
        {DASH_NAV.map(({ icon: Icon, label }, i) => (
          <div key={label} className={`mk-dash-nav ${i === 0 ? 'is-active' : ''}`}>
            <Icon size={13} />
            {label}
          </div>
        ))}
      </aside>
      <div className="mk-dash-main">
        <div className="mk-dash-hello">
          <span>Good morning</span>
          <strong>Let&apos;s make today count.</strong>
        </div>
        <div className="mk-dash-grid">
          <div className="mk-card">
            <div className="mk-card-title">
              Today <span className="mk-muted">4 tasks</span>
            </div>
            <ul className="mk-checklist">
              {DASH_TODAY.map((t) => (
                <li key={t.label} className={t.done ? 'is-done' : ''}>
                  <span className="mk-check">{t.done && <Check size={9} strokeWidth={3} />}</span>
                  {t.label}
                </li>
              ))}
            </ul>
          </div>
          <div className="mk-card mk-card-center">
            <div className="mk-card-title">Focus Score</div>
            <ScoreRing value={87} size={92} />
            <span className="mk-muted">Great momentum!</span>
          </div>
        </div>
        <div className="mk-dash-banner">
          <span className="mk-leaf">
            <Leaf size={14} />
          </span>
          <span>A calmer mind builds a brighter you.</span>
          <ChevronRight size={14} />
        </div>
      </div>
    </div>
  );
}

/* ─── 04 · Chat ─── */

const LENO_STEPS = ['Deep work on your top goal · 9:00', 'A 25-minute walk, no phone · 1:00', 'Review and plan tomorrow · 6:30'];

export function ChatMockup() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });
  const reduce = useReducedMotion();
  const [stage, setStage] = useState(0);

  useEffect(() => {
    if (!inView) return undefined;
    if (reduce) {
      setStage(4);
      return undefined;
    }
    const timers = [
      window.setTimeout(() => setStage(1), 200),
      window.setTimeout(() => setStage(2), 900),
      window.setTimeout(() => setStage(3), 2300),
      window.setTimeout(() => setStage(4), 3500),
    ];
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [inView, reduce]);

  const bubble = {
    initial: { opacity: 0, y: 14, filter: 'blur(6px)' },
    animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
    transition: { duration: 0.7, ease: EASE },
  };

  return (
    <div ref={ref} className="mk-chat" aria-label="Example conversation with Leno" role="img">
      {stage >= 1 && (
        <motion.div className="mk-bubble mk-bubble-user" {...bubble}>
          How can I be more productive today?
        </motion.div>
      )}
      {stage === 2 && (
        <motion.div className="mk-leno-row" {...bubble}>
          <span className="mk-leno-avatar">
            <Check size={13} strokeWidth={3} />
          </span>
          <span className="mk-typing">
            <i />
            <i />
            <i />
          </span>
        </motion.div>
      )}
      {stage >= 3 && (
        <motion.div className="mk-leno-row" {...bubble}>
          <span className="mk-leno-avatar">
            <Check size={13} strokeWidth={3} />
          </span>
          <div className="mk-bubble mk-bubble-leno">
            <p>Let&apos;s break it down. Here are 3 key actions you can focus on today:</p>
            <ol>
              {LENO_STEPS.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
          </div>
        </motion.div>
      )}
      {stage >= 4 && (
        <motion.div className="mk-bubble mk-bubble-user" {...bubble}>
          Sounds good, let&apos;s do it.
        </motion.div>
      )}
    </div>
  );
}

/* ─── 05 · Planner ─── */

type PlanView = 'Day' | 'Week' | 'Month';

const PLAN_ROWS: Record<PlanView, { id: string; label: string; time: string }[]> = {
  Day: [
    { id: 'd1', label: 'Deep work (2h)', time: '9:00 AM' },
    { id: 'd2', label: 'Gym', time: '12:00 PM' },
    { id: 'd3', label: 'Work on project', time: '2:00 PM' },
    { id: 'd4', label: 'Read', time: '7:00 PM' },
    { id: 'd5', label: 'Plan tomorrow', time: '9:00 PM' },
  ],
  Week: [
    { id: 'w1', label: 'Ship landing page draft', time: 'Mon' },
    { id: 'w2', label: '3 deep-work blocks', time: 'Tue–Thu' },
    { id: 'w3', label: 'Workout ×4', time: 'All week' },
    { id: 'w4', label: 'Weekly review', time: 'Fri' },
    { id: 'w5', label: 'Offline day', time: 'Sun' },
  ],
  Month: [
    { id: 'm1', label: 'Launch portfolio', time: 'Week 1' },
    { id: 'm2', label: 'Finish online course', time: 'Week 2' },
    { id: 'm3', label: 'Run a 10k', time: 'Week 3' },
    { id: 'm4', label: 'Read 2 books', time: 'Ongoing' },
    { id: 'm5', label: 'Monthly reflection', time: 'Week 4' },
  ],
};

const TIMELINE = [
  { label: 'Deep Work', start: 0.5, span: 1.3, tone: 'mint' },
  { label: 'Gym', start: 1.95, span: 0.8, tone: 'mint' },
  { label: 'Project Work', start: 2.9, span: 1.1, tone: 'sage' },
  { label: 'Reading', start: 4.25, span: 0.95, tone: 'dusk' },
];

export function PlannerMockup() {
  const [view, setView] = useState<PlanView>('Day');
  const [done, setDone] = useState<Record<string, boolean>>({ d1: true, d2: true, w1: true, m1: true });

  return (
    <div className="mk-planner">
      <div className="mk-planner-head">
        <strong>My Plan</strong>
        <div className="mk-seg" role="tablist" aria-label="Plan range">
          {(['Day', 'Week', 'Month'] as PlanView[]).map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={view === v}
              className={view === v ? 'is-active' : ''}
              onClick={() => setView(v)}
            >
              {v}
            </button>
          ))}
        </div>
      </div>
      <div className="mk-planner-body">
        <ul className="mk-plan-list">
          {PLAN_ROWS[view].map((row, i) => (
            <motion.li
              key={row.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.45, delay: i * 0.05, ease: EASE }}
            >
              <button
                type="button"
                className={`mk-plan-row ${done[row.id] ? 'is-done' : ''}`}
                aria-pressed={!!done[row.id]}
                onClick={() => setDone((d) => ({ ...d, [row.id]: !d[row.id] }))}
              >
                <span className="mk-check">{done[row.id] && <Check size={10} strokeWidth={3} />}</span>
                <span className="mk-plan-label">{row.label}</span>
                <span className="mk-plan-time">{row.time}</span>
              </button>
            </motion.li>
          ))}
        </ul>
        <div className="mk-timeline" aria-hidden="true">
          {['6 AM', '9 AM', '12 PM', '3 PM', '6 PM', '9 PM'].map((h, i) => (
            <span key={h} className="mk-hour" style={{ top: `${(i / 5.4) * 100}%` }}>
              {h}
            </span>
          ))}
          {TIMELINE.map((b) => (
            <span
              key={b.label}
              className={`mk-block mk-block-${b.tone}`}
              style={{ top: `${(b.start / 5.4) * 100}%`, height: `${(b.span / 5.4) * 100}%` }}
            >
              {b.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── 06 · Analytics ─── */

const TREND = [0.42, 0.55, 0.48, 0.66, 0.72, 0.84, 0.93];
const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function heatLevel(col: number, row: number) {
  const v = Math.sin(col * 1.7 + row * 0.9) * 0.5 + Math.cos(col * 0.6 - row * 1.3) * 0.35 + col * 0.06;
  return Math.max(0, Math.min(4, Math.round(v * 2 + 1.6)));
}

export function AnalyticsMockup() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.35 });

  return (
    <div ref={ref} className="mk-analytics" aria-hidden="true">
      <div className="mk-card mk-card-center">
        <div className="mk-card-title">Focus Score</div>
        <ScoreRing value={87} size={104} stroke={8} />
        <span className="mk-up">+12% this week</span>
      </div>

      <div className="mk-card">
        <div className="mk-card-title">Productivity Trend</div>
        <div className="mk-bars">
          {TREND.map((v, i) => (
            <div key={i} className="mk-bar-col">
              <span className="mk-bar-track">
                <motion.span
                  className="mk-bar"
                  style={{ height: `${v * 100}%`, originY: 1 }}
                  initial={{ scaleY: 0 }}
                  animate={{ scaleY: inView ? 1 : 0 }}
                  transition={{ duration: 1, delay: 0.15 + i * 0.07, ease: EASE }}
                />
              </span>
              <span className="mk-bar-day">{DAYS[i]}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mk-card">
        <div className="mk-card-title">Focus Heatmap</div>
        <div className="mk-heat">
          {Array.from({ length: 7 * 12 }).map((_, i) => {
            const col = i % 12;
            const row = Math.floor(i / 12);
            return (
              <motion.span
                key={i}
                className={`mk-heat-cell lv-${heatLevel(col, row)}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: inView ? 1 : 0 }}
                transition={{ duration: 0.5, delay: 0.2 + col * 0.04 + row * 0.02 }}
              />
            );
          })}
        </div>
        <div className="mk-heat-months">
          <span>Jul</span>
          <span>Aug</span>
          <span>Sep</span>
        </div>
      </div>

      <div className="mk-card">
        <div className="mk-card-title">Mood Tracker</div>
        <svg className="mk-mood" viewBox="0 0 200 70" preserveAspectRatio="none">
          <motion.path
            d="M4 50 C 30 50, 38 22, 64 26 S 100 58, 124 44 S 160 12, 196 20"
            fill="none"
            strokeWidth="2.5"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: inView ? 1 : 0 }}
            transition={{ duration: 1.8, delay: 0.3, ease: EASE }}
          />
        </svg>
        <div className="mk-moods">
          <Frown size={17} />
          <Smile size={17} />
          <Laugh size={17} />
        </div>
      </div>
    </div>
  );
}
