import { useEffect, useState, type FormEvent } from 'react';
import { Trash2 } from 'lucide-react';
import { formatRelative, type ISODate } from '../lib/dates';
import { parseLine } from '../lib/parse';
import { actions, clientOf, type AppState } from '../lib/store';
import { Sheet } from '../components/Sheet';
import { useToast } from '../components/Toast';

interface ProjectSheetProps {
  open: boolean;
  onClose: () => void;
  state: AppState;
  today: ISODate;
  /** Edit this project; omit to add a new one. */
  projectId?: string | null;
}

export function ProjectSheet({ open, onClose, state, today, projectId }: ProjectSheetProps) {
  const toast = useToast();
  const editing = projectId ? state.projects.find((p) => p.id === projectId) : undefined;
  const [line, setLine] = useState('');
  const [title, setTitle] = useState('');
  const [client, setClient] = useState('');
  const [hours, setHours] = useState('');
  const [deadline, setDeadline] = useState('');
  const [startDate, setStartDate] = useState('');
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLine('');
    setTouched(false);
    setTitle(editing?.title ?? '');
    setClient(editing ? clientOf(state, editing)?.name ?? '' : '');
    setHours(editing ? String(editing.hoursLeft) : '');
    setDeadline(editing?.deadline ?? '');
    setStartDate(editing?.startDate ?? '');
    // Only reset when the sheet opens or switches project
  }, [open, projectId]);

  const onLine = (text: string) => {
    setLine(text);
    const parsed = parseLine(text, today);
    setTitle(parsed.title);
    if (parsed.client !== undefined) setClient(parsed.client);
    if (parsed.hours !== undefined) setHours(String(parsed.hours));
    if (parsed.deadline) setDeadline(parsed.deadline);
  };

  const hoursNum = Number(hours);
  const errors = {
    title: !title.trim() ? 'Give it a name' : '',
    hours: !(hoursNum > 0) ? 'How many hours of work are left?' : '',
    deadline: !deadline ? 'When is it due?' : '',
  };
  const valid = !errors.title && !errors.hours && !errors.deadline;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!valid) return;
    const draft = { title, clientName: client, hoursLeft: hoursNum, deadline, startDate: startDate || null };
    if (editing) {
      actions.updateProject(editing.id, draft);
      toast({ message: 'Saved' });
      onClose();
    } else {
      actions.addProject(draft);
      toast({ message: `Added ${title.trim()}` });
      // Stay open for rapid entry
      setLine('');
      setTitle('');
      setHours('');
      setDeadline('');
      setStartDate('');
      setTouched(false);
      document.querySelector<HTMLInputElement>('[data-autofocus]')?.focus();
    }
  };

  const remove = () => {
    if (!editing) return;
    const restore = actions.deleteProject(editing.id);
    toast({ message: `Deleted ${editing.title}`, action: { label: 'Undo', onClick: restore } });
    onClose();
  };

  const clientNames = state.clients.map((c) => c.name);

  return (
    <Sheet open={open} onClose={onClose} title={editing ? 'Edit project' : 'Add a project'}>
      <form onSubmit={submit} noValidate className="form">
        {!editing && (
          <label className="field">
            <span>Describe it in one line</span>
            <input
              data-autofocus
              className="input input-lg"
              value={line}
              onChange={(e) => onLine(e.target.value)}
              placeholder="Acme — landing page, 12h, Friday"
              autoComplete="off"
            />
            <small className="hint">Client, hours and deadline are picked up automatically. Check them below.</small>
          </label>
        )}

        <label className="field">
          <span>Project</span>
          <input
            {...(editing ? { 'data-autofocus': true } : {})}
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Landing page redesign"
            aria-invalid={touched && !!errors.title}
          />
          {touched && errors.title && <small className="error">{errors.title}</small>}
        </label>

        <label className="field">
          <span>Client</span>
          <input
            className="input"
            value={client}
            onChange={(e) => setClient(e.target.value)}
            placeholder="Optional"
            list="client-names"
          />
          <datalist id="client-names">
            {clientNames.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
        </label>

        <div className="form-grid">
          <label className="field">
            <span>{editing ? 'Hours left' : 'Hours of work'}</span>
            <input
              className="input"
              type="number"
              min={0.5}
              step={0.5}
              inputMode="decimal"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              placeholder="12"
              aria-invalid={touched && !!errors.hours}
            />
            {touched && errors.hours && <small className="error">{errors.hours}</small>}
          </label>
          <label className="field">
            <span>Due</span>
            <input
              className="input"
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              aria-invalid={touched && !!errors.deadline}
            />
            {touched && errors.deadline ? (
              <small className="error">{errors.deadline}</small>
            ) : (
              deadline && <small className="hint">Due {formatRelative(deadline, today)}</small>
            )}
          </label>
        </div>

        <details className="more" open={!!startDate}>
          <summary>Can't start yet?</summary>
          <label className="field">
            <span>Earliest start</span>
            <input className="input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </label>
        </details>

        <p className="hint">
          Tip: estimate the hours you'll <em>really</em> need, then add a little. Optileno plans around your real week, so honest numbers give honest answers.
        </p>

        <div className="sheet-actions">
          {editing && (
            <button type="button" className="btn btn-danger" onClick={remove}>
              <Trash2 size={15} /> Delete
            </button>
          )}
          <span className="spacer" />
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {editing ? 'Cancel' : 'Done'}
          </button>
          <button type="submit" className="btn btn-primary">
            {editing ? 'Save changes' : 'Add project'}
          </button>
        </div>
      </form>
    </Sheet>
  );
}
