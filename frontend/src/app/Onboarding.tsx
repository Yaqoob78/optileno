import { useState, type FormEvent } from 'react';
import { ArrowRight, Minus, Plus } from 'lucide-react';
import { formatDay, type ISODate } from '../lib/dates';
import { formatHours } from '../lib/engine';
import { parseLine } from '../lib/parse';
import { actions, type AppState } from '../lib/store';
import { Wordmark } from '../components/Wordmark';
import { WEEKDAY_LABELS, WEEK_ORDER } from './model';

interface OnboardingProps {
  state: AppState;
  today: ISODate;
}

export function Onboarding({ state, today }: OnboardingProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [days, setDays] = useState<boolean[]>(state.settings.hoursByWeekday.map((h) => h > 0));
  const [perDay, setPerDay] = useState(() => Math.max(...state.settings.hoursByWeekday, 5));
  const [line, setLine] = useState('');
  const [error, setError] = useState('');

  const hoursByWeekday = days.map((on) => (on ? perDay : 0));
  const weekly = hoursByWeekday.reduce((s, h) => s + h, 0);
  const parsed = line.trim() ? parseLine(line, today) : null;
  const added = state.projects.filter((p) => !p.doneAt);

  const addFromLine = (e: FormEvent) => {
    e.preventDefault();
    if (!parsed) return;
    if (!parsed.title) return setError('Add a name for the project.');
    if (!parsed.hours) return setError('Add the hours, like “12h”.');
    if (!parsed.deadline) return setError('Add a deadline, like “Friday” or “Oct 14”.');
    setError('');
    actions.addProject({ title: parsed.title, clientName: parsed.client, hoursLeft: parsed.hours, deadline: parsed.deadline });
    setLine('');
  };

  return (
    <div className="onboarding">
      <header className="onboarding-top">
        <Wordmark />
        <span className="muted">Step {step} of 2</span>
      </header>

      {step === 1 ? (
        <section className="onboarding-card">
          <h1 className="serif onboarding-title">First, your real week.</h1>
          <p className="onboarding-lead">
            Count only focused client work — not email, calls or admin. Most freelancers land between 4 and 6 hours a day. Be honest; every answer depends on it.
          </p>

          <p className="field-label">Which days do you do client work?</p>
          <div className="day-toggles" role="group" aria-label="Working days">
            {WEEK_ORDER.map((d) => (
              <button
                key={d}
                type="button"
                aria-pressed={days[d]}
                className={`day-toggle${days[d] ? ' is-on' : ''}`}
                onClick={() => setDays((prev) => prev.map((v, i) => (i === d ? !v : v)))}
              >
                {WEEKDAY_LABELS[d]}
              </button>
            ))}
          </div>

          <p className="field-label">Focused hours on a working day</p>
          <div className="big-stepper">
            <button type="button" className="icon-btn" onClick={() => setPerDay((h) => Math.max(1, h - 0.5))} aria-label="Fewer hours">
              <Minus size={18} />
            </button>
            <span className="big-stepper-value serif">{formatHours(perDay)}</span>
            <button type="button" className="icon-btn" onClick={() => setPerDay((h) => Math.min(12, h + 0.5))} aria-label="More hours">
              <Plus size={18} />
            </button>
          </div>
          <p className="muted onboarding-sum">That's {formatHours(weekly)} of client work a week. You can fine-tune each day later.</p>

          <div className="onboarding-actions">
            <button
              type="button"
              className="btn btn-primary btn-lg"
              disabled={weekly === 0}
              onClick={() => {
                actions.setHoursByWeekday(hoursByWeekday);
                setStep(2);
              }}
            >
              Continue <ArrowRight size={16} />
            </button>
          </div>
        </section>
      ) : (
        <section className="onboarding-card">
          <h1 className="serif onboarding-title">What's on your plate?</h1>
          <p className="onboarding-lead">Add the projects you're already committed to, one line each — the way you'd say it out loud.</p>

          <form onSubmit={addFromLine} className="onboarding-add">
            <input
              autoFocus
              className="input input-lg"
              value={line}
              onChange={(e) => {
                setLine(e.target.value);
                setError('');
              }}
              placeholder="Acme — landing page, 12h, Friday"
              aria-describedby="onboarding-preview"
            />
            <button type="submit" className="btn btn-primary btn-lg" disabled={!line.trim()}>
              Add
            </button>
          </form>
          <p id="onboarding-preview" className={`preview${error ? ' is-error' : ''}`}>
            {error ||
              (parsed
                ? [parsed.client && `Client: ${parsed.client}`, parsed.title && `Project: ${parsed.title}`, parsed.hours && `${formatHours(parsed.hours)}`, parsed.deadline && `Due ${formatDay(parsed.deadline)}`]
                    .filter(Boolean)
                    .join('  ·  ')
                : 'Client, hours and deadline are understood automatically.')}
          </p>

          {added.length > 0 && (
            <ul className="onboarding-list">
              {added.map((p) => (
                <li key={p.id}>
                  <span>
                    {p.title}
                    {p.clientId && <span className="muted"> · {state.clients.find((c) => c.id === p.clientId)?.name}</span>}
                  </span>
                  <span className="muted">
                    {formatHours(p.hoursLeft)} · due {formatDay(p.deadline)}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <div className="onboarding-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setStep(1)}>
              Back
            </button>
            <span className="spacer" />
            {added.length === 0 && (
              <button type="button" className="btn btn-quiet" onClick={() => actions.loadSample(today)}>
                Explore with sample projects
              </button>
            )}
            <button
              type="button"
              className="btn btn-primary btn-lg"
              disabled={added.length === 0}
              onClick={() => actions.completeOnboarding(state.settings.hoursByWeekday)}
            >
              See my week <ArrowRight size={16} />
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
