import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, CircleHelp, Plus, Settings2, Sun } from 'lucide-react';
import { actions, useAppState, useToday } from '../lib/store';
import { Wordmark } from '../components/Wordmark';
import { usePlan } from './model';
import { WeekView } from './WeekView';
import { TodayView } from './TodayView';
import { SayYesSheet } from './SayYesSheet';
import { ProjectSheet } from './ProjectSheet';
import { SettingsSheet } from './SettingsSheet';
import { Onboarding } from './Onboarding';

type Tab = 'week' | 'today';
const TAB_KEY = 'optileno.tab';

function readTab(): Tab {
  try {
    return localStorage.getItem(TAB_KEY) === 'today' ? 'today' : 'week';
  } catch {
    return 'week';
  }
}

export function AppPage() {
  const state = useAppState();
  const today = useToday();
  const view = usePlan(state, today);
  const [tab, setTabState] = useState<Tab>(readTab);
  const [sayYesOpen, setSayYesOpen] = useState(false);
  const [projectSheet, setProjectSheet] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });
  const [settingsOpen, setSettingsOpen] = useState(false);

  const setTab = (t: Tab) => {
    setTabState(t);
    try {
      localStorage.setItem(TAB_KEY, t);
    } catch {
      /* ignore */
    }
  };

  const openAdd = () => setProjectSheet({ open: true, id: null });
  const anySheet = sayYesOpen || projectSheet.open || settingsOpen;

  useEffect(() => {
    document.title = 'Optileno';
  }, []);

  useEffect(() => {
    if (!state.settings.onboarded) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (anySheet || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement;
      if (t.closest('input, textarea, select, [contenteditable="true"]')) return;
      const k = e.key.toLowerCase();
      if (k === 'y') {
        e.preventDefault();
        setSayYesOpen(true);
      } else if (k === 'n') {
        e.preventDefault();
        openAdd();
      } else if (k === 'w') setTab('week');
      else if (k === 't') setTab('today');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [anySheet, state.settings.onboarded]);

  if (!state.settings.onboarded) return <Onboarding state={state} today={today} />;

  return (
    <div className="app">
      <header className="topbar">
        <Link to="/" className="brand" aria-label="Optileno home">
          <Wordmark />
        </Link>
        <nav className="tabs" aria-label="Views">
          <button type="button" className={tab === 'week' ? 'is-on' : ''} aria-current={tab === 'week' ? 'page' : undefined} onClick={() => setTab('week')}>
            Week
          </button>
          <button type="button" className={tab === 'today' ? 'is-on' : ''} aria-current={tab === 'today' ? 'page' : undefined} onClick={() => setTab('today')}>
            Today
          </button>
        </nav>
        <div className="top-actions">
          <button type="button" className="btn btn-ghost btn-sm hide-sm" onClick={openAdd} title="Add a project (N)">
            <Plus size={15} /> Add <kbd>N</kbd>
          </button>
          <button type="button" className="btn btn-primary btn-sm hide-sm" onClick={() => setSayYesOpen(true)} title="Check a new request (Y)">
            Can I say yes? <kbd>Y</kbd>
          </button>
          <button type="button" className="icon-btn" onClick={() => setSettingsOpen(true)} aria-label="Settings">
            <Settings2 size={18} />
          </button>
        </div>
      </header>

      {state.settings.sample && (
        <div className="banner">
          <span>You're exploring sample projects. Try “Can I say yes?” — then start with your own.</span>
          <button type="button" className="btn btn-quiet btn-sm" onClick={() => actions.clearAll(true)}>
            Start with my projects
          </button>
        </div>
      )}

      <main className="main">
        {tab === 'week' ? (
          <WeekView state={state} view={view} today={today} onAdd={openAdd} onEdit={(id) => setProjectSheet({ open: true, id })} />
        ) : (
          <TodayView state={state} view={view} today={today} onAdd={openAdd} />
        )}
      </main>

      <nav className="bottombar" aria-label="Views">
        <button type="button" className={tab === 'week' ? 'is-on' : ''} onClick={() => setTab('week')}>
          <CalendarDays size={19} />
          <span>Week</span>
        </button>
        <button type="button" className="bottombar-main" onClick={() => setSayYesOpen(true)}>
          <CircleHelp size={19} />
          <span>Can I say yes?</span>
        </button>
        <button type="button" className={tab === 'today' ? 'is-on' : ''} onClick={() => setTab('today')}>
          <Sun size={19} />
          <span>Today</span>
        </button>
      </nav>
      <button type="button" className="fab" onClick={openAdd} aria-label="Add a project">
        <Plus size={22} />
      </button>

      <SayYesSheet open={sayYesOpen} onClose={() => setSayYesOpen(false)} state={state} today={today} />
      <ProjectSheet
        open={projectSheet.open}
        projectId={projectSheet.id}
        onClose={() => setProjectSheet({ open: false, id: null })}
        state={state}
        today={today}
      />
      <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} state={state} today={today} />
    </div>
  );
}
