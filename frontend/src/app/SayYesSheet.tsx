import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Check, Copy } from 'lucide-react';
import { addDays, diffDays, formatDay, formatRelative, weekday, type ISODate } from '../lib/dates';
import { evaluateOffer, formatHours } from '../lib/engine';
import { parseLine } from '../lib/parse';
import { actions, loggedOn, type AppState } from '../lib/store';
import { Sheet } from '../components/Sheet';
import { useToast } from '../components/Toast';
import { offerHeadline, replyDraft } from './model';

interface SayYesSheetProps {
  open: boolean;
  onClose: () => void;
  state: AppState;
  today: ISODate;
}

export function SayYesSheet({ open, onClose, state, today }: SayYesSheetProps) {
  const toast = useToast();
  const [line, setLine] = useState('');
  const [title, setTitle] = useState('');
  const [contact, setContact] = useState('');
  const [hours, setHours] = useState('');
  const [deadline, setDeadline] = useState('');
  const [startDate, setStartDate] = useState('');
  const [reply, setReply] = useState('');
  const [replyEdited, setReplyEdited] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLine('');
    setTitle('');
    setContact('');
    setHours('');
    setDeadline('');
    setStartDate('');
    setReplyEdited(false);
    setCopied(false);
  }, [open]);

  const onLine = (text: string) => {
    setLine(text);
    const parsed = parseLine(text, today);
    if (parsed.hours !== undefined) setHours(String(parsed.hours));
    if (parsed.deadline) setDeadline(parsed.deadline);
    if (parsed.client) setContact(parsed.client);
    setTitle(parsed.title);
  };

  const offerHours = Number(hours);
  const result = useMemo(() => {
    if (!(offerHours > 0) || !deadline) return null;
    return evaluateOffer(
      { projects: state.projects, settings: state.settings, today, loggedToday: loggedOn(state, today) },
      { hours: offerHours, deadline, startDate: startDate || null },
    );
  }, [state, today, offerHours, deadline, startDate]);

  const draft = result ? replyDraft(result, deadline, contact) : '';
  useEffect(() => {
    if (!replyEdited) setReply(draft);
  }, [draft, replyEdited]);

  const h = result ? offerHeadline(result, deadline, today) : null;
  const byId = new Map(state.projects.map((p) => [p.id, p]));
  const acceptDate = result ? (result.verdict === 'no' ? result.safeDate : deadline) : null;

  const accept = () => {
    if (!result || !acceptDate) return;
    actions.addProject({
      title: title || 'New project',
      clientName: contact || undefined,
      hoursLeft: offerHours,
      deadline: acceptDate,
      startDate: startDate || null,
    });
    toast({ message: `Added — due ${formatDay(acceptDate)}` });
    onClose();
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(reply);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast({ message: 'Copy failed — select the text and copy it manually' });
    }
  };

  const wd = weekday(today);
  const lateInWeek = wd === 5 || wd === 6 || wd === 0;
  const quickDates: { label: string; date: ISODate }[] = [
    { label: lateInWeek ? 'Next Fri' : 'This Fri', date: addDays(today, (5 - wd + 7) % 7 || 7) },
    { label: '1 week', date: addDays(today, 7) },
    { label: '2 weeks', date: addDays(today, 14) },
    { label: '1 month', date: addDays(today, 30) },
  ];

  return (
    <Sheet open={open} onClose={onClose} title="Can I say yes?" width={620}>
      <p className="sheet-lead">
        Check a request against your real week before you answer. Nothing is added until you say so.
      </p>

      <label className="field">
        <span>What are they asking for?</span>
        <input
          data-autofocus
          className="input input-lg"
          value={line}
          onChange={(e) => onLine(e.target.value)}
          placeholder="Northwind — pitch deck, 16h, by next Friday"
          autoComplete="off"
        />
      </label>

      <div className="form-grid">
        <label className="field">
          <span>Hours of work</span>
          <input
            className="input"
            type="number"
            min={0.5}
            step={0.5}
            inputMode="decimal"
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            placeholder="e.g. 16"
          />
        </label>
        <label className="field">
          <span>They need it by</span>
          <input className="input" type="date" min={today} value={deadline} onChange={(e) => setDeadline(e.target.value)} />
        </label>
      </div>
      <div className="chips" role="group" aria-label="Quick deadlines">
        {quickDates.map((q) => (
          <button
            key={q.label}
            type="button"
            className={`chip${deadline === q.date ? ' is-on' : ''}`}
            onClick={() => setDeadline(q.date)}
          >
            {q.label}
          </button>
        ))}
      </div>

      <details className="more">
        <summary>More options</summary>
        <div className="form-grid">
          <label className="field">
            <span>Can't start before (optional)</span>
            <input className="input" type="date" min={today} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </label>
          <label className="field">
            <span>Client or contact (for the reply)</span>
            <input className="input" value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Sam" />
          </label>
        </div>
      </details>

      {!result && (
        <div className="offer-empty">
          <p className="muted">Add the hours and the date they need it — the answer appears instantly.</p>
        </div>
      )}

      {result && h && (
        <section className={`offer tone-${h.tone}`} aria-live="polite">
          <h3 className="offer-title serif">{h.title}</h3>
          <p className="offer-detail">{h.detail}</p>

          {result.displaced.length > 0 && (
            <div className="offer-block">
              <p className="offer-label">What would slip</p>
              <ul className="offer-list">
                {result.displaced.map((d) => {
                  const p = byId.get(d.projectId);
                  return (
                    <li key={d.projectId}>
                      <span>{p?.title}</span>
                      <span className="muted">
                        {formatHours(d.extraShort)} short for {p ? formatRelative(p.deadline, today) : ''}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {result.verdict === 'tight' && result.squeezed.length > 0 && (
            <div className="offer-block">
              <p className="offer-label">Loses its safety margin</p>
              <ul className="offer-list">
                {result.squeezed.map((id) => (
                  <li key={id}>
                    <span>{byId.get(id)?.title}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.verdict === 'no' && (
            <div className="counter">
              {result.safeDate ? (
                <>
                  <p className="offer-label">Promise this instead</p>
                  <p className="counter-date serif">{formatDay(result.safeDate)}</p>
                  <p className="muted">
                    {diffDays(deadline, result.safeDate) > 0
                      ? `${diffDays(deadline, result.safeDate)} day${diffDays(deadline, result.safeDate) === 1 ? '' : 's'} later than asked — and nothing else moves.`
                      : 'Nothing else moves.'}
                  </p>
                </>
              ) : (
                <p className="muted">Your schedule has no room for this within a year. Check your working hours in Settings.</p>
              )}
            </div>
          )}

          <div className="offer-block">
            <div className="reply-head">
              <p className="offer-label">Your reply</p>
              <button type="button" className="btn btn-ghost btn-sm" onClick={copy}>
                {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <textarea
              className="input reply"
              rows={6}
              value={reply}
              onChange={(e) => {
                setReply(e.target.value);
                setReplyEdited(true);
              }}
            />
          </div>
        </section>
      )}

      {result && acceptDate && (
        <div className="sheet-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Not now
          </button>
          <button type="button" className="btn btn-primary" onClick={accept}>
            {result.verdict === 'no' ? `Add with ${formatDay(acceptDate)}` : 'Add to my projects'} <ArrowRight size={15} />
          </button>
        </div>
      )}
    </Sheet>
  );
}
