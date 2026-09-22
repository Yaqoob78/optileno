import { useMemo, useState } from 'react';
import { Check, ChevronDown, Plus } from 'lucide-react';
import { addDays, diffDays, formatDay, formatShort, fromISO, weekdayShort, type ISODate } from '../lib/dates';
import { formatHours, type Project } from '../lib/engine';
import { actions, clientOf, type AppState } from '../lib/store';
import { useToast } from '../components/Toast';
import { headline, statusLine, type PlanView } from './model';

interface WeekViewProps {
  state: AppState;
  view: PlanView;
  today: ISODate;
  onAdd: () => void;
  onEdit: (id: string) => void;
}

const STRIP_DAYS = 14;

export function WeekView({ state, view, today, onAdd, onEdit }: WeekViewProps) {
  const toast = useToast();
  const [showDone, setShowDone] = useState(false);
  const clientName = (p: Project) => clientOf(state, p)?.name;
  const h = headline(view, today, clientName);
  const colorOf = (p: Project | undefined) => `var(--c${(p && clientOf(state, p)?.color) ?? 7})`;

  const done = useMemo(
    () => state.projects.filter((p) => p.doneAt).sort((a, b) => (b.doneAt ?? 0) - (a.doneAt ?? 0)).slice(0, 12),
    [state.projects],
  );

  const complete = (p: Project) => {
    actions.setDone(p.id, true);
    toast({ message: `${p.title} marked done`, action: { label: 'Undo', onClick: () => actions.setDone(p.id, false) } });
  };

  return (
    <div className="view">
      <section className={`verdict tone-${h.tone}`} aria-live="polite">
        <h1 className="verdict-title serif">{h.title}</h1>
        <p className="verdict-detail">{h.detail}</p>
      </section>

      {view.active.length > 0 && (
        <CapacityStrip state={state} view={view} today={today} colorOf={colorOf} />
      )}

      <section className="section">
        <div className="section-head">
          <h2 className="section-title">Projects</h2>
          <button type="button" className="btn btn-quiet btn-sm" onClick={onAdd}>
            <Plus size={15} /> Add project
          </button>
        </div>

        {view.active.length === 0 ? (
          <div className="empty">
            <p className="serif empty-title">Start with what's already on your plate.</p>
            <p className="muted">Type it the way you'd say it: “Acme — landing page, 12h, Friday”.</p>
            <button type="button" className="btn btn-primary" onClick={onAdd}>
              <Plus size={16} /> Add your first project
            </button>
          </div>
        ) : (
          <ul className="project-list">
            {view.active.map((p) => {
              const f = view.plan.forecasts.get(p.id)!;
              const st = statusLine(f, p, today);
              const client = clientOf(state, p);
              return (
                <li key={p.id} className="project-row">
                  <button
                    type="button"
                    className="check"
                    style={{ ['--dot' as string]: colorOf(p) }}
                    onClick={() => complete(p)}
                    aria-label={`Mark ${p.title} as done`}
                    title="Mark done"
                  >
                    <Check size={13} strokeWidth={2.6} />
                  </button>
                  <button type="button" className="project-main" onClick={() => onEdit(p.id)}>
                    <span className="project-title">{p.title}</span>
                    <span className="project-meta">
                      {client && <span>{client.name}</span>}
                      {client && <span aria-hidden="true">·</span>}
                      <span>{formatHours(p.hoursLeft)} left</span>
                      <span aria-hidden="true">·</span>
                      <span>Due {formatDay(p.deadline)}</span>
                    </span>
                  </button>
                  <span className={`status tone-${st.tone}`}>{st.text}</span>
                </li>
              );
            })}
          </ul>
        )}

        {done.length > 0 && (
          <div className="done-block">
            <button type="button" className="done-toggle" onClick={() => setShowDone((v) => !v)} aria-expanded={showDone}>
              <ChevronDown size={15} style={{ transform: showDone ? 'rotate(180deg)' : 'none' }} />
              Completed ({done.length})
            </button>
            {showDone && (
              <ul className="done-list">
                {done.map((p) => (
                  <li key={p.id}>
                    <span className="done-dot" style={{ background: colorOf(p) }} />
                    <span className="done-title">{p.title}</span>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => actions.setDone(p.id, false)}>
                      Reopen
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function CapacityStrip({
  state,
  view,
  today,
  colorOf,
}: {
  state: AppState;
  view: PlanView;
  today: ISODate;
  colorOf: (p: Project | undefined) => string;
}) {
  const days = useMemo(() => {
    const list = [];
    for (let i = 0; i < STRIP_DAYS; i++) {
      const date = addDays(today, i);
      const plan = view.plan.days.find((d) => d.date === date);
      const logged = i === 0 ? view.loggedToday : 0;
      const capacity = (plan?.capacity ?? 0) + logged;
      list.push({ date, capacity, logged, allocations: plan?.allocations ?? [], free: plan?.free ?? 0 });
    }
    return list;
  }, [view, today]);

  const max = Math.max(1, ...days.map((d) => d.capacity), ...state.settings.hoursByWeekday);
  const deadlines = new Map<ISODate, Project[]>();
  for (const p of view.active) {
    if (diffDays(today, p.deadline) < STRIP_DAYS && p.deadline >= today) {
      deadlines.set(p.deadline, [...(deadlines.get(p.deadline) ?? []), p]);
    }
  }
  const overdue = view.active.filter((p) => p.deadline < today);

  return (
    <section className="strip-wrap" aria-label="Your next two weeks">
      <div className="strip-legend">
        <span className="muted">Next two weeks</span>
        <span className="legend-items">
          <span><i className="lg lg-work" /> booked</span>
          <span><i className="lg lg-free" /> open</span>
          <span><i className="lg lg-due" /> due</span>
        </span>
      </div>
      <div className="strip" role="list">
        {days.map((d, i) => {
          const off = d.capacity === 0;
          const label = [
            `${formatDay(d.date)}: `,
            off ? 'no working hours' : `${formatHours(d.capacity)} available`,
            ...d.allocations.map((a) => `, ${view.byId.get(a.projectId)?.title} ${formatHours(a.hours)}`),
            d.free > 0.01 && !off ? `, ${formatHours(d.free)} open` : '',
          ].join('');
          const due = deadlines.get(d.date) ?? [];
          const weekStart = i > 0 && fromISO(d.date).getDay() === 1;
          return (
            <div
              key={d.date}
              role="listitem"
              className={`day${i === 0 ? ' is-today' : ''}${off ? ' is-off' : ''}${weekStart ? ' week-start' : ''}`}
              title={label}
              aria-label={label}
            >
              <div className="day-bar-area">
                {!off && (
                  <div className="day-bar" style={{ height: `${(d.capacity / max) * 100}%` }}>
                    {d.logged > 0.01 && (
                      <span className="seg seg-logged" style={{ flexGrow: d.logged }} />
                    )}
                    {d.allocations.map((a) => (
                      <span
                        key={a.projectId}
                        className="seg"
                        style={{ flexGrow: a.hours, background: colorOf(view.byId.get(a.projectId)) }}
                      />
                    ))}
                    {d.free > 0.01 && <span className="seg seg-free" style={{ flexGrow: d.free }} />}
                  </div>
                )}
              </div>
              <div className="day-dues">
                {due.slice(0, 3).map((p) => (
                  <span key={p.id} className="due-mark" style={{ background: colorOf(p) }} title={`${p.title} due`} />
                ))}
              </div>
              <div className="day-label">
                <span className="day-wd">{i === 0 ? 'Today' : weekdayShort(d.date)}</span>
                <span className="day-num">{fromISO(d.date).getDate()}</span>
              </div>
            </div>
          );
        })}
      </div>
      {overdue.length > 0 && (
        <p className="strip-note tone-risk">
          Overdue: {overdue.map((p) => `${p.title} (was due ${formatShort(p.deadline)})`).join(', ')}
        </p>
      )}
    </section>
  );
}
