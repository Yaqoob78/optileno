import { useState } from 'react';
import { ArrowLeft, Clapperboard, Code2, Feather, LayoutTemplate, Minus, MonitorSmartphone, PenTool, Plus, Sparkles } from 'lucide-react';
import { Sheet } from '../components/Sheet';
import { addWorkdays, todayISO } from '../lib/dates';
import { currencySymbol } from '../lib/money';
import type { Project } from '../lib/model';
import { actions, useAppState, type ProjectDraft } from '../lib/store';
import { TEMPLATES, templateById, type TemplateId } from '../lib/templates';
import { ListEditor } from './ListEditor';

const ICONS: Record<TemplateId, typeof Sparkles> = {
  website: MonitorSmartphone,
  landing: LayoutTemplate,
  brand: PenTool,
  video: Clapperboard,
  dev: Code2,
  writing: Feather,
  custom: Sparkles,
};

interface ProjectSheetProps {
  project?: Project;
  onClose: () => void;
  onCreated?: (id: string) => void;
}

function draftFrom(template: TemplateId, rateHours = 0): ProjectDraft {
  const t = templateById(template);
  return {
    client: '',
    contact: '',
    name: t.id === 'custom' ? '' : t.label,
    template,
    fee: rateHours,
    deadline: addWorkdays(todayISO(), 15),
    deliverables: t.deliverables.map((title) => ({ title })),
    excluded: [...t.excluded],
    revisions: t.revisions,
  };
}

/** Draw the lines: a scope in about a minute, starting from what a careful proposal would say. */
export function ProjectSheet({ project, onClose, onCreated }: ProjectSheetProps) {
  const { profile } = useAppState();
  const editing = !!project;
  const [step, setStep] = useState<'template' | 'details'>(editing ? 'details' : 'template');
  const [draft, setDraft] = useState<ProjectDraft>(() =>
    project
      ? { ...project, deliverables: project.deliverables.map((d) => ({ ...d })), excluded: [...project.excluded] }
      : draftFrom('website'),
  );
  const [deliverables, setDeliverables] = useState<string[]>(() => draft.deliverables.map((d) => d.title));
  const [touched, setTouched] = useState(false);

  const set = <K extends keyof ProjectDraft>(key: K, value: ProjectDraft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  const pick = (id: TemplateId) => {
    const next = draftFrom(id);
    setDraft(next);
    setDeliverables(next.deliverables.map((d) => d.title));
    setStep('details');
  };

  const valid = draft.name.trim().length > 0 && draft.fee > 0;

  const save = () => {
    setTouched(true);
    if (!valid) return;
    const existing = project?.deliverables ?? [];
    const final: ProjectDraft = {
      ...draft,
      deliverables: deliverables.map((title, i) => {
        const match = existing.find((d) => d.title === title) ?? existing[i];
        return match && match.title === title ? { id: match.id, title, done: match.done } : { title };
      }),
    };
    if (project) {
      actions.updateProject(project.id, final);
      onClose();
    } else {
      onCreated?.(actions.addProject(final));
    }
  };

  if (step === 'template') {
    return (
      <Sheet open onClose={onClose} title="What are you working on?" width={640}>
        <p className="muted sheet-lede">Pick the closest one. Deliverables, revision rounds and what’s not included are filled in from a careful proposal. Change anything.</p>
        <div className="template-grid">
          {TEMPLATES.map((t) => {
            const Icon = ICONS[t.id];
            return (
              <button key={t.id} type="button" className="template-card" onClick={() => pick(t.id)}>
                <Icon size={20} strokeWidth={1.6} />
                <span className="template-name">{t.label}</span>
                <span className="template-blurb">{t.blurb}</span>
              </button>
            );
          })}
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={editing ? 'Edit scope' : 'Draw the lines'}
      width={640}
      footer={
        <>
          {!editing && (
            <button type="button" className="btn btn-ghost" onClick={() => setStep('template')} style={{ marginRight: 'auto' }}>
              <ArrowLeft size={16} /> Templates
            </button>
          )}
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={save}>
            {editing ? 'Save scope' : 'Create project'}
          </button>
        </>
      }
    >
      <div className="form-grid">
        <div className="row">
          <div className="field">
            <label className="label" htmlFor="p-client">
              Client
            </label>
            <input id="p-client" className="input" value={draft.client} onChange={(e) => set('client', e.target.value)} placeholder="Northwind Coffee" data-autofocus />
          </div>
          <div className="field">
            <label className="label" htmlFor="p-contact">
              Their first name <span className="muted">(for replies)</span>
            </label>
            <input id="p-contact" className="input" value={draft.contact} onChange={(e) => set('contact', e.target.value)} placeholder="Maya" />
          </div>
        </div>

        <div className="field">
          <label className="label" htmlFor="p-name">
            Project
          </label>
          <input
            id="p-name"
            className="input"
            value={draft.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="Website redesign"
            aria-invalid={touched && !draft.name.trim()}
          />
        </div>

        <div className="row">
          <div className="field">
            <label className="label" htmlFor="p-fee">
              Fixed fee
            </label>
            <div className="input-affix">
              <span className="affix">{currencySymbol(profile.currency)}</span>
              <input
                id="p-fee"
                className="input num"
                inputMode="decimal"
                value={draft.fee || ''}
                placeholder="4,800"
                aria-invalid={touched && draft.fee <= 0}
                onChange={(e) => set('fee', Math.max(0, Number(e.target.value.replace(/[^\d.]/g, '')) || 0))}
              />
            </div>
            {touched && draft.fee <= 0 && <span className="hint warn-text">What did you quote? It’s how extras are put in context.</span>}
          </div>
          <div className="field">
            <label className="label" htmlFor="p-deadline">
              Delivery date
            </label>
            <input id="p-deadline" className="input" type="date" value={draft.deadline ?? ''} onChange={(e) => set('deadline', e.target.value || null)} />
          </div>
        </div>

        <ListEditor
          label="What’s included"
          items={deliverables}
          onChange={setDeliverables}
          placeholder="e.g. Design for 5 pages"
          addLabel="Add a deliverable"
        />

        <div className="field">
          <span className="label">Revision rounds included</span>
          <div className="stepper">
            <button type="button" className="icon-btn" onClick={() => set('revisions', Math.max(0, draft.revisions - 1))} aria-label="Fewer rounds">
              <Minus size={16} />
            </button>
            <span className="stepper-value num" aria-live="polite">
              {draft.revisions}
            </span>
            <button type="button" className="icon-btn" onClick={() => set('revisions', Math.min(10, draft.revisions + 1))} aria-label="More rounds">
              <Plus size={16} />
            </button>
            <span className="hint">A round is one batch of feedback. Feedback that arrives in pieces on the same day counts once.</span>
          </div>
        </div>

        <ListEditor
          label="Not included"
          items={draft.excluded}
          onChange={(excluded) => set('excluded', excluded)}
          placeholder="e.g. Copywriting"
          addLabel="Add something that’s not included"
          variant="excluded"
        />
        <p className="hint">
          The “not included” list is what does the heavy lifting. When a request touches something on it, Optileno will say so.
        </p>
      </div>
    </Sheet>
  );
}
