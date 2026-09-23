import { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { Settings2 } from 'lucide-react';
import { Wordmark } from '../components/Mark';
import { useToast } from '../components/Toast';
import { formatMoney } from '../lib/money';
import { parseApproval } from '../lib/share';
import { actions, getState, useAppState } from '../lib/store';
import { Desk } from './Desk';
import { Onboarding } from './Onboarding';
import { ProjectSheet } from './ProjectSheet';
import { ProjectView } from './ProjectView';
import { SettingsSheet } from './SettingsSheet';
import { ShareSheet } from './ShareSheet';
import { VerdictSheet } from './VerdictSheet';
import '../styles/app.css';

type Overlay =
  | { kind: 'ask'; projectId: string; text: string }
  | { kind: 'new' }
  | { kind: 'edit'; projectId: string }
  | { kind: 'share'; projectId: string }
  | { kind: 'settings' }
  | null;

export function AppPage() {
  const state = useAppState();
  const toast = useToast();
  const navigate = useNavigate();
  const [overlay, setOverlay] = useState<Overlay>(null);

  useEffect(() => {
    document.title = 'Optileno';
  }, []);

  // A client's approval email links back here: /app#ok=<project>.<item>
  // (on a fresh load, or in a tab that already has the app open)
  useEffect(() => {
    const handle = () => {
      const approval = parseApproval(window.location.hash);
      if (!approval) return;
      window.history.replaceState(null, '', window.location.pathname);
      const item = actions.approveFromLink(approval.projectId, approval.itemId);
      if (item) {
        toast({ message: `Approved by your client: ${item.title} · ${formatMoney(item.amount, getState().profile.currency)}` });
        navigate(`/app/p/${approval.projectId}`);
      } else {
        toast({ message: 'That approval is for a project that isn’t in this browser.' });
      }
    };
    handle();
    window.addEventListener('hashchange', handle);
    return () => window.removeEventListener('hashchange', handle);
  }, [navigate, toast]);

  const close = () => setOverlay(null);
  const ask = (projectId: string, text: string) => setOverlay({ kind: 'ask', projectId, text });
  const find = (id: string) => state.projects.find((p) => p.id === id);

  if (!state.settings.onboarded) {
    return (
      <div className="app-root">
        <Onboarding onStart={(mode) => mode === 'new' && setOverlay({ kind: 'new' })} />
      </div>
    );
  }

  return (
    <div className="app-root">
      <header className="app-bar">
        <Wordmark to="/app" />
        <div className="app-bar-actions">
          <button type="button" className="icon-btn" onClick={() => setOverlay({ kind: 'settings' })} aria-label="Settings">
            <Settings2 size={19} />
          </button>
        </div>
      </header>

      {state.settings.sample && (
        <div className="sample-banner">
          <span>
            You’re exploring a sample. Numbers use your rate of {formatMoney(state.profile.rate, state.profile.currency)}/h.
          </span>
          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={() => {
              actions.clearProjects();
              navigate('/app');
              setOverlay({ kind: 'new' });
            }}
          >
            Start with my own project
          </button>
        </div>
      )}

      <main className="app-main">
        <Routes>
          <Route index element={<Desk onAsk={ask} onNewProject={() => setOverlay({ kind: 'new' })} />} />
          <Route
            path="p/:id"
            element={
              <ProjectRoute
                onAsk={ask}
                onEdit={(id) => setOverlay({ kind: 'edit', projectId: id })}
                onShare={(id) => setOverlay({ kind: 'share', projectId: id })}
              />
            }
          />
          <Route path="*" element={<Navigate to="/app" replace />} />
        </Routes>
      </main>

      {overlay?.kind === 'ask' && find(overlay.projectId) && <VerdictSheet project={find(overlay.projectId)!} text={overlay.text} onClose={close} />}
      {overlay?.kind === 'new' && <NewProject onClose={close} />}
      {overlay?.kind === 'edit' && find(overlay.projectId) && <ProjectSheet project={find(overlay.projectId)} onClose={close} />}
      {overlay?.kind === 'share' && find(overlay.projectId) && <ShareSheet project={find(overlay.projectId)!} onClose={close} />}
      {overlay?.kind === 'settings' && <SettingsSheet onClose={close} />}
    </div>
  );
}

function NewProject({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  return (
    <ProjectSheet
      onClose={onClose}
      onCreated={(id) => {
        onClose();
        navigate(`/app/p/${id}`);
      }}
    />
  );
}

function ProjectRoute({ onAsk, onEdit, onShare }: { onAsk: (projectId: string, text: string) => void; onEdit: (id: string) => void; onShare: (id: string) => void }) {
  const { id } = useParams();
  const state = useAppState();
  const project = state.projects.find((p) => p.id === id);

  useEffect(() => {
    if (project) actions.setLastProject(project.id);
  }, [project]);

  if (!project) return <Navigate to="/app" replace />;
  return <ProjectView project={project} onAsk={onAsk} onEdit={() => onEdit(project.id)} onShare={() => onShare(project.id)} />;
}
