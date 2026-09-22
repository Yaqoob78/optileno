import { useRef, useState } from 'react';
import { Download, Minus, Plus, Upload, X } from 'lucide-react';
import { addDays, diffDays, formatDay, type ISODate } from '../lib/dates';
import { formatHours } from '../lib/engine';
import { actions, type AppState, type Theme } from '../lib/store';
import { Sheet } from '../components/Sheet';
import { useToast } from '../components/Toast';
import { WEEKDAY_LABELS, WEEK_ORDER } from './model';

interface SettingsSheetProps {
  open: boolean;
  onClose: () => void;
  state: AppState;
  today: ISODate;
}

export function SettingsSheet({ open, onClose, state, today }: SettingsSheetProps) {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [offFrom, setOffFrom] = useState('');
  const [offTo, setOffTo] = useState('');
  const [confirmErase, setConfirmErase] = useState(false);
  const hours = state.settings.hoursByWeekday;
  const weekly = hours.reduce((s, h) => s + h, 0);

  const setDay = (day: number, value: number) => {
    const next = [...hours];
    next[day] = Math.min(16, Math.max(0, Math.round(value * 2) / 2));
    actions.setHoursByWeekday(next);
  };

  const addTimeOff = () => {
    if (!offFrom) return;
    const end = offTo && offTo >= offFrom ? offTo : offFrom;
    const dates: ISODate[] = [];
    for (let i = 0; i <= Math.min(diffDays(offFrom, end), 90); i++) dates.push(addDays(offFrom, i));
    actions.setTimeOff(dates, 24);
    toast({ message: dates.length === 1 ? `${formatDay(offFrom)} marked off` : `${dates.length} days marked off` });
    setOffFrom('');
    setOffTo('');
  };

  const upcomingOff = Object.keys(state.settings.timeOff)
    .filter((d) => d >= today)
    .sort();

  const exportData = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `optileno-${today}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importData = async (file: File) => {
    try {
      const ok = actions.importData(JSON.parse(await file.text()));
      toast({ message: ok ? 'Imported' : "That file doesn't look like an Optileno export" });
    } catch {
      toast({ message: "Couldn't read that file" });
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="Settings">
      <section className="settings-group">
        <div className="settings-head">
          <h3>Your real working hours</h3>
          <span className="muted">{formatHours(weekly)} a week</span>
        </div>
        <p className="hint">Focused client work only — not email, calls or admin. Every answer Optileno gives is built on these numbers.</p>
        <ul className="hours-list">
          {WEEK_ORDER.map((day) => (
            <li key={day}>
              <span className="hours-day">{WEEKDAY_LABELS[day]}</span>
              <div className="stepper" role="group" aria-label={`${WEEKDAY_LABELS[day]} hours`}>
                <button type="button" className="icon-btn" onClick={() => setDay(day, hours[day] - 0.5)} aria-label="Less">
                  <Minus size={15} />
                </button>
                <span className="stepper-value">{hours[day] ? formatHours(hours[day]) : 'Off'}</span>
                <button type="button" className="icon-btn" onClick={() => setDay(day, hours[day] + 0.5)} aria-label="More">
                  <Plus size={15} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="settings-group">
        <div className="settings-head">
          <h3>Time off</h3>
        </div>
        <p className="hint">Holidays, sick days, a conference — mark them so nothing gets planned there.</p>
        <div className="form-grid">
          <label className="field">
            <span>From</span>
            <input className="input" type="date" min={today} value={offFrom} onChange={(e) => setOffFrom(e.target.value)} />
          </label>
          <label className="field">
            <span>To (optional)</span>
            <input className="input" type="date" min={offFrom || today} value={offTo} onChange={(e) => setOffTo(e.target.value)} />
          </label>
        </div>
        <button type="button" className="btn btn-quiet btn-sm" onClick={addTimeOff} disabled={!offFrom}>
          Mark as off
        </button>
        {upcomingOff.length > 0 && (
          <ul className="off-list">
            {upcomingOff.map((d) => (
              <li key={d}>
                <span>{formatDay(d)}</span>
                <button type="button" className="icon-btn" onClick={() => actions.setTimeOff([d], null)} aria-label={`Remove ${formatDay(d)}`}>
                  <X size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="settings-group">
        <div className="settings-head">
          <h3>Appearance</h3>
        </div>
        <div className="segmented" role="radiogroup" aria-label="Theme">
          {(['system', 'light', 'dark'] as Theme[]).map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={state.settings.theme === t}
              className={state.settings.theme === t ? 'is-on' : ''}
              onClick={() => actions.setTheme(t)}
            >
              {t[0].toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </section>

      <section className="settings-group">
        <div className="settings-head">
          <h3>Your data</h3>
        </div>
        <p className="hint">Everything is stored in this browser only — no account, no server. Export a backup now and then, or to move to another device.</p>
        <div className="row-actions">
          <button type="button" className="btn btn-quiet btn-sm" onClick={exportData}>
            <Download size={15} /> Export backup
          </button>
          <button type="button" className="btn btn-quiet btn-sm" onClick={() => fileRef.current?.click()}>
            <Upload size={15} /> Import
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void importData(f);
              e.target.value = '';
            }}
          />
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => actions.loadSample(today)}>
            Load sample projects
          </button>
        </div>
        {confirmErase ? (
          <div className="confirm">
            <span>Delete every project and log? This can't be undone.</span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirmErase(false)}>
              Keep
            </button>
            <button
              type="button"
              className="btn btn-danger btn-sm"
              onClick={() => {
                actions.clearAll(true);
                setConfirmErase(false);
                toast({ message: 'All projects erased' });
              }}
            >
              Erase
            </button>
          </div>
        ) : (
          <button type="button" className="btn btn-danger btn-sm" onClick={() => setConfirmErase(true)}>
            Erase all projects
          </button>
        )}
      </section>

      <section className="settings-group">
        <p className="hint">
          Optileno is in early access. Ideas or problems? <a href="mailto:optilenoai@gmail.com">optilenoai@gmail.com</a>
        </p>
      </section>
    </Sheet>
  );
}
