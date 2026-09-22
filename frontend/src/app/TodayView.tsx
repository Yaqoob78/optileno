import { Plus, Undo2 } from 'lucide-react';
import { addDays, formatDay, formatRelative, type ISODate } from '../lib/dates';
import { capacityOn, formatHours, type Project } from '../lib/engine';
import { actions, clientOf, type AppState } from '../lib/store';
import { useToast } from '../components/Toast';
import type { PlanView } from './model';

interface TodayViewProps {
  state: AppState;
  view: PlanView;
  today: ISODate;
  onAdd: () => void;
}

export function TodayView({ state, view, today, onAdd }: TodayViewProps) {
  const toast = useToast();
  const todayPlan = view.plan.days[0]?.date === today ? view.plan.days[0] : undefined;
  const baseCapacity = capacityOn(today, state.settings, today, 0);
  const remaining = todayPlan?.allocations ?? [];
  const logs = state.logs.filter((l) => l.date === today).sort((a, b) => a.at - b.at);
  const tomorrow = view.plan.days.find((d) => d.date === addDays(today, 1));
  const colorOf = (p: Project | undefined) => `var(--c${(p && clientOf(state, p)?.color) ?? 7})`;

  const log = (p: Project, hours: number) => {
    const undo = actions.logHours(p.id, hours, today);
    const left = Math.max(0, p.hoursLeft - hours);
    toast({
      message: left <= 0.01 ? `Logged ${formatHours(hours)} — ${p.title} has no hours left` : `Logged ${formatHours(hours)} on ${p.title}`,
      action: { label: 'Undo', onClick: undo },
    });
  };

  let title: string;
  let detail: string;
  if (baseCapacity === 0) {
    title = 'A day off.';
    detail = 'No client hours are planned today. Nothing will slip because of it — the plan already counts on this.';
  } else if (!view.active.length) {
    title = 'Nothing scheduled.';
    detail = "Add what you're working on and today's plan appears here.";
  } else if (!remaining.length && view.loggedToday > 0) {
    title = "Today's plan is done.";
    detail = `You logged ${formatHours(view.loggedToday)}. Anything more is a head start on tomorrow.`;
  } else if (!remaining.length) {
    title = 'Nothing due today.';
    detail = 'Everything scheduled fits on other days. Enjoy the open time — or get ahead.';
  } else {
    const planned = remaining.reduce((s, a) => s + a.hours, 0);
    title = `${formatHours(planned)} of focused work.`;
    detail =
      view.loggedToday > 0
        ? `${formatHours(view.loggedToday)} done so far. Here's the rest of a day you can finish.`
        : `A day you can actually finish — in order of what's due first.`;
  }

  return (
    <div className="view">
      <section className="verdict tone-neutral">
        <p className="eyebrow">{formatDay(today)}</p>
        <h1 className="verdict-title serif">{title}</h1>
        <p className="verdict-detail">{detail}</p>
      </section>

      {remaining.length > 0 && (
        <ol className="today-list">
          {remaining.map((a, i) => {
            const p = view.byId.get(a.projectId)!;
            const client = clientOf(state, p);
            return (
              <li key={a.projectId} className="today-item" style={{ ['--dot' as string]: colorOf(p) }}>
                <span className="today-index">{i + 1}</span>
                <div className="today-main">
                  <span className="today-title">{p.title}</span>
                  <span className="today-meta">
                    {client ? `${client.name} · ` : ''}due {formatRelative(p.deadline, today)} · {formatHours(p.hoursLeft)} left in total
                  </span>
                </div>
                <span className="today-hours serif">{formatHours(a.hours)}</span>
                <div className="today-actions">
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => log(p, 0.5)}>
                    +30m
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => log(p, 1)}>
                    +1h
                  </button>
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => log(p, a.hours)}>
                    Log {formatHours(a.hours)}
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {!view.active.length && (
        <div className="empty">
          <button type="button" className="btn btn-primary" onClick={onAdd}>
            <Plus size={16} /> Add a project
          </button>
        </div>
      )}

      {logs.length > 0 && (
        <section className="section">
          <div className="section-head">
            <h2 className="section-title">Logged today</h2>
            <span className="muted">{formatHours(view.loggedToday)}</span>
          </div>
          <ul className="log-list">
            {logs.map((l) => {
              const p = view.byId.get(l.projectId);
              return (
                <li key={l.id}>
                  <span className="done-dot" style={{ background: colorOf(p) }} />
                  <span className="log-title">{p?.title ?? 'Deleted project'}</span>
                  <span className="log-hours">{formatHours(l.hours)}</span>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`Remove ${formatHours(l.hours)} logged on ${p?.title ?? 'project'}`}
                    title="Remove this entry"
                    onClick={() => actions.removeLog(l.id)}
                  >
                    <Undo2 size={15} />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {tomorrow && tomorrow.allocations.length > 0 && (
        <section className="section">
          <div className="section-head">
            <h2 className="section-title">Tomorrow</h2>
            <span className="muted">{formatHours(tomorrow.used)} planned</span>
          </div>
          <ul className="log-list">
            {tomorrow.allocations.map((a) => {
              const p = view.byId.get(a.projectId);
              return (
                <li key={a.projectId}>
                  <span className="done-dot" style={{ background: colorOf(p) }} />
                  <span className="log-title">{p?.title}</span>
                  <span className="log-hours">{formatHours(a.hours)}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
