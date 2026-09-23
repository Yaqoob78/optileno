import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Archive, ArchiveRestore, ArrowLeft, Check, Gift, Pencil, Send, Trash2, X } from 'lucide-react';
import { CountUp } from '../components/CountUp';
import { Menu } from '../components/Menu';
import { ItemStamp, Pips } from '../components/Stamp';
import { useToast } from '../components/Toast';
import { formatLong, formatWhen } from '../lib/dates';
import { itemsOf, projectTotals } from '../lib/ledger';
import { formatMoney } from '../lib/money';
import type { Project, RequestItem } from '../lib/model';
import { actions, useAppState } from '../lib/store';
import { Composer } from './Composer';

interface ProjectViewProps {
  project: Project;
  onAsk: (projectId: string, text: string) => void;
  onEdit: () => void;
  onShare: () => void;
}

export function ProjectView({ project, onAsk, onEdit, onShare }: ProjectViewProps) {
  const state = useAppState();
  const toast = useToast();
  const navigate = useNavigate();
  const items = useMemo(() => itemsOf(state.items, project.id).sort((a, b) => b.createdAt - a.createdAt), [state.items, project.id]);
  const t = projectTotals(project, items);
  const money = (n: number) => formatMoney(n, state.profile.currency);
  const done = project.deliverables.filter((d) => d.done).length;

  return (
    <div className="project-view">
      <nav className="crumbs">
        <Link to="/app" className="link-btn crumb-back">
          <ArrowLeft size={15} /> All projects
        </Link>
      </nav>

      <header className="project-head">
        <div className="project-head-text">
          <p className="eyebrow">{project.client || 'No client yet'}</p>
          <h1 className="serif project-title">{project.name}</h1>
          <p className="project-sub muted">
            {t.delivery ? <>Delivery {formatLong(t.delivery)}</> : 'No delivery date'}
            {t.approvedDays > 0 && project.deadline && <> · moved {t.approvedDays} {t.approvedDays === 1 ? 'day' : 'days'} by approved extras</>}
            {project.archivedAt && <> · Finished</>}
          </p>
        </div>
        <div className="project-head-actions">
          <button type="button" className="btn" onClick={onEdit}>
            <Pencil size={15} /> Scope
          </button>
          <button type="button" className="btn btn-primary" onClick={onShare}>
            <Send size={15} /> Share with client
          </button>
          <Menu
            items={[
              project.archivedAt
                ? { label: 'Reopen project', icon: <ArchiveRestore size={15} />, onSelect: () => actions.setArchived(project.id, false) }
                : { label: 'Mark as finished', icon: <Archive size={15} />, onSelect: () => actions.setArchived(project.id, true) },
              {
                label: 'Delete project',
                icon: <Trash2 size={15} />,
                danger: true,
                onSelect: () => {
                  const undo = actions.deleteProject(project.id);
                  navigate('/app');
                  toast({ message: `Deleted ${project.name}.`, action: { label: 'Undo', onClick: undo } });
                },
              },
            ]}
          />
        </div>
      </header>

      <section className="project-sums" aria-label="Project money">
        <div>
          <span className="eyebrow">Agreed</span>
          <span className="num">{money(t.fee)}</span>
        </div>
        <div className="sum-op" aria-hidden="true">
          +
        </div>
        <div>
          <span className="eyebrow">Approved extras</span>
          <span className="num sum-accent">
            <CountUp value={t.approved} format={money} />
          </span>
        </div>
        <div className="sum-op" aria-hidden="true">
          =
        </div>
        <div className="sum-total">
          <span className="eyebrow">Project total</span>
          <span className="num">
            <CountUp value={t.total} format={money} />
          </span>
        </div>
        <div className="sum-side">
          <span>
            <span className="dot dot-extra" /> {money(t.pending)} waiting
          </span>
          <span>
            <span className="dot dot-gift" /> {money(t.gifted)} gifted
          </span>
        </div>
      </section>

      <div className="project-body">
        <div className="project-main">
          <Composer projects={[project]} projectId={project.id} onSubmit={onAsk} fixedProject />

          <section className="requests" aria-label="Requests">
            <div className="section-head">
              <h2 className="section-title">Requests</h2>
              <span className="hint">{items.length === 0 ? 'None yet' : `${items.length} logged`}</span>
            </div>
            {items.length === 0 ? (
              <p className="requests-empty muted">
                When {project.contact || 'your client'} asks for something, paste it above. Every request lands here with its verdict, so neither of you has to remember.
              </p>
            ) : (
              <ol className="request-list">
                {items.map((item) => (
                  <RequestRow key={item.id} item={item} project={project} />
                ))}
              </ol>
            )}
          </section>
        </div>

        <aside className="scope-card" aria-label="Scope">
          <div className="scope-card-head">
            <h2 className="section-title">The scope</h2>
            <button type="button" className="link-btn" onClick={onEdit}>
              Edit
            </button>
          </div>

          <div className="scope-block">
            <div className="scope-block-head">
              <span className="eyebrow">Included</span>
              <span className="hint num">
                {done}/{project.deliverables.length} done
              </span>
            </div>
            {project.deliverables.length === 0 ? (
              <p className="hint">No deliverables listed yet.</p>
            ) : (
              <ul className="deliverables">
                {project.deliverables.map((d) => (
                  <li key={d.id}>
                    <button type="button" className={`deliverable${d.done ? ' done' : ''}`} onClick={() => actions.toggleDeliverable(project.id, d.id)} aria-pressed={d.done}>
                      <span className="check" aria-hidden="true">
                        {d.done && <Check size={12} strokeWidth={3} />}
                      </span>
                      <span>{d.title}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="scope-block">
            <div className="scope-block-head">
              <span className="eyebrow">Revision rounds</span>
              <span className="hint num">
                {Math.min(t.roundsUsed, t.roundsIncluded)} of {t.roundsIncluded} used
              </span>
            </div>
            <Pips used={t.roundsUsed} included={t.roundsIncluded} />
          </div>

          <div className="scope-block">
            <span className="eyebrow">Not included</span>
            {project.excluded.length === 0 ? (
              <p className="hint">Nothing listed. Adding a few items here makes Optileno much sharper.</p>
            ) : (
              <ul className="excluded">
                {project.excluded.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function RequestRow({ item, project }: { item: RequestItem; project: Project }) {
  const { profile } = useAppState();
  const toast = useToast();
  const money = (n: number) => formatMoney(n, profile.currency);

  const remove = () => {
    const undo = actions.deleteItem(item.id);
    toast({ message: 'Request removed.', action: { label: 'Undo', onClick: undo } });
  };

  return (
    <li className={`request request-${item.kind}${item.status ? ` request-${item.status}` : ''}`}>
      <div className="request-stamp">
        <ItemStamp item={item} currency={profile.currency} roundsIncluded={project.revisions} />
      </div>
      <div className="request-body">
        <div className="request-title-row">
          <h3 className="request-title">{item.title}</h3>
          <span className="request-when hint">{formatWhen(item.createdAt)}</span>
        </div>
        {item.text && item.text !== item.title && <p className="request-quote">“{item.text}”</p>}
        {item.kind === 'extra' && item.status === 'proposed' && (
          <div className="request-actions">
            <span className="request-waiting">Waiting on {project.contact || 'client'}</span>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => {
                actions.setStatus(item.id, 'approved');
                toast({ message: `Approved. ${money(item.amount)} added to the project.` });
              }}
            >
              <Check size={14} /> Approved
            </button>
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => actions.convert(item.id, 'gift')}>
              <Gift size={14} /> Gift it instead
            </button>
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => actions.setStatus(item.id, 'declined')}>
              <X size={14} /> Declined
            </button>
          </div>
        )}
        {item.kind === 'extra' && item.status !== 'proposed' && (
          <p className="request-meta hint">
            {item.status === 'approved' ? 'Approved' : 'Declined'}
            {item.decidedAt ? ` ${formatWhen(item.decidedAt).toLowerCase()}` : ''}
            {item.status === 'approved' && item.days > 0 ? ` · +${item.days} ${item.days === 1 ? 'day' : 'days'}` : ''}
            {' · '}
            <button type="button" className="link-btn" onClick={() => actions.setStatus(item.id, 'proposed')}>
              undo
            </button>
          </p>
        )}
        {item.kind === 'gift' && (
          <p className="request-meta hint">
            Shown to your client as a gift worth {money(item.amount)} ·{' '}
            <button type="button" className="link-btn" onClick={() => actions.convert(item.id, 'extra')}>
              charge instead
            </button>
          </p>
        )}
      </div>
      <button type="button" className="icon-btn request-remove" onClick={remove} aria-label={`Remove ${item.title}`}>
        <Trash2 size={15} />
      </button>
    </li>
  );
}
