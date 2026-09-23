import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Plus } from 'lucide-react';
import { CountUp } from '../components/CountUp';
import { Pips } from '../components/Stamp';
import { formatShort } from '../lib/dates';
import { itemsOf, projectTotals, startOfYear, workspaceTotals } from '../lib/ledger';
import { formatMoney } from '../lib/money';
import type { Project } from '../lib/model';
import { actions, useAppState } from '../lib/store';
import { Composer } from './Composer';

function greeting(name: string): string {
  const h = new Date().getHours();
  const part = h < 5 ? 'Working late' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  const first = name.trim().split(/\s+/)[0];
  return first ? `${part}, ${first}.` : `${part}.`;
}

interface DeskProps {
  onAsk: (projectId: string, text: string) => void;
  onNewProject: () => void;
}

export function Desk({ onAsk, onNewProject }: DeskProps) {
  const state = useAppState();
  const { profile, settings } = state;
  const [showArchived, setShowArchived] = useState(false);
  const active = state.projects.filter((p) => !p.archivedAt);
  const archived = state.projects.filter((p) => p.archivedAt);
  const totals = useMemo(() => workspaceTotals(state.items, startOfYear()), [state.items]);
  const money = (n: number) => formatMoney(n, profile.currency);
  const selected = active.find((p) => p.id === settings.lastProjectId)?.id ?? active[0]?.id ?? null;

  return (
    <div className="desk">
      <header className="desk-head">
        <p className="eyebrow">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
        <h1 className="serif desk-greeting">{greeting(profile.name)}</h1>
      </header>

      <section className="ledger-strip" aria-label="This year">
        <div className="ledger-cell">
          <span className="eyebrow">Recovered this year</span>
          <span className="ledger-value num">
            <CountUp value={totals.recovered} format={money} />
          </span>
          <span className="ledger-note">Extras your clients approved</span>
        </div>
        <div className="ledger-cell">
          <span className="eyebrow">Waiting on clients</span>
          <span className="ledger-value num ledger-pending">
            <CountUp value={totals.pending} format={money} />
          </span>
          <span className="ledger-note">
            {totals.pendingCount === 0 ? 'Nothing waiting' : `${totals.pendingCount} ${totals.pendingCount === 1 ? 'extra' : 'extras'} to approve`}
          </span>
        </div>
        <div className="ledger-cell">
          <span className="eyebrow">Gifted, on purpose</span>
          <span className="ledger-value num ledger-gift">
            <CountUp value={totals.gifted} format={money} />
          </span>
          <span className="ledger-note">Goodwill your clients can see</span>
        </div>
      </section>

      {active.length > 0 ? (
        <Composer
          projects={active}
          projectId={selected}
          onProjectChange={(id) => actions.setLastProject(id)}
          onSubmit={onAsk}
        />
      ) : (
        <section className="empty-desk">
          <h2 className="serif">Start with the project you’re on right now.</h2>
          <p className="muted">Pick what kind of work it is and Optileno fills in a careful scope. Takes about a minute. Then every request gets checked against it.</p>
          <div className="empty-actions">
            <button type="button" className="btn btn-primary btn-lg" onClick={onNewProject}>
              <Plus size={18} /> Draw the lines on a project
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => actions.loadSample()}>
              Or explore a sample
            </button>
          </div>
        </section>
      )}

      {active.length > 0 && (
        <section className="projects" aria-label="Projects">
          <div className="section-head">
            <h2 className="section-title">Projects</h2>
            <button type="button" className="btn btn-sm" onClick={onNewProject}>
              <Plus size={15} /> New project
            </button>
          </div>
          <div className="project-grid">
            {active.map((p) => (
              <ProjectCard key={p.id} project={p} />
            ))}
          </div>
        </section>
      )}

      {archived.length > 0 && (
        <section className="archived">
          <button type="button" className="link-btn" onClick={() => setShowArchived((v) => !v)}>
            {showArchived ? 'Hide' : 'Show'} {archived.length} finished {archived.length === 1 ? 'project' : 'projects'}
          </button>
          {showArchived && (
            <div className="project-grid archived-grid">
              {archived.map((p) => (
                <ProjectCard key={p.id} project={p} />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function ProjectCard({ project }: { project: Project }) {
  const state = useAppState();
  const items = itemsOf(state.items, project.id);
  const t = projectTotals(project, items);
  const money = (n: number) => formatMoney(n, state.profile.currency);
  const done = project.deliverables.filter((d) => d.done).length;

  return (
    <Link to={`/app/p/${project.id}`} className="project-card">
      <div className="project-card-top">
        <span className="eyebrow">{project.client || 'No client yet'}</span>
        <ArrowUpRight size={16} className="project-card-arrow" />
      </div>
      <h3 className="serif project-card-name">{project.name}</h3>
      <div className="project-card-money">
        <span className="num project-card-total">{money(t.total)}</span>
        {t.approved > 0 && <span className="num project-card-extra">+{money(t.approved)} extras</span>}
      </div>
      <dl className="project-card-meta">
        <div>
          <dt>Rounds</dt>
          <dd>
            <Pips used={t.roundsUsed} included={t.roundsIncluded} />
          </dd>
        </div>
        <div>
          <dt>Done</dt>
          <dd className="num">
            {done}/{project.deliverables.length}
          </dd>
        </div>
        <div>
          <dt>Delivery</dt>
          <dd>{t.delivery ? formatShort(t.delivery) : '—'}</dd>
        </div>
      </dl>
      {t.pendingCount > 0 && (
        <span className="project-card-flag">
          {t.pendingCount} waiting on {project.contact || 'client'} · {money(t.pending)}
        </span>
      )}
    </Link>
  );
}
