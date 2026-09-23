import { useSyncExternalStore } from 'react';
import { isValidISO, type ISODate } from './dates';
import { isCurrency, niceRound } from './money';
import type { Deliverable, ExtraStatus, ItemKind, Profile, Project, RequestItem, Theme, Tone } from './model';
import { buildSample } from './sample';
import { TEMPLATES, type TemplateId } from './templates';

/* Local-first state: everything lives in this browser. No account, and
   nothing about your clients ever leaves the device unless you share it. */

export interface Settings {
  theme: Theme;
  tone: Tone;
  onboarded: boolean;
  /** True while the workspace holds the example projects. */
  sample: boolean;
  lastProjectId: string | null;
}

export interface AppState {
  version: 3;
  profile: Profile;
  settings: Settings;
  projects: Project[];
  items: RequestItem[];
}

export const STORAGE_KEY = 'optileno.v3';

export const DEFAULT_STATE: AppState = {
  version: 3,
  profile: { name: '', business: '', email: '', rate: 75, currency: 'USD', hoursPerDay: 6 },
  settings: { theme: 'system', tone: 'warm', onboarded: false, sample: false, lastProjectId: null },
  projects: [],
  items: [],
};

export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

const s = (v: unknown, max = 200) => (typeof v === 'string' ? v.slice(0, max) : '');
const n = (v: unknown, fallback = 0, max = 1e9) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(0, v)) : fallback);
const KINDS: ItemKind[] = ['included', 'revision', 'extra', 'gift'];
const STATUSES: ExtraStatus[] = ['proposed', 'approved', 'declined'];

/** Accepts only well-formed data, so a corrupted or hand-edited import can't break the app. */
export function sanitize(raw: unknown): AppState | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (r.version !== 3) return null;
  const p = (r.profile ?? {}) as Record<string, unknown>;
  const st = (r.settings ?? {}) as Record<string, unknown>;
  const projects: Project[] = (Array.isArray(r.projects) ? r.projects : [])
    .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object' && typeof (x as Project).id === 'string')
    .map((x) => ({
      id: s(x.id, 80),
      client: s(x.client, 120),
      contact: s(x.contact, 80),
      name: s(x.name) || 'Untitled project',
      template: (TEMPLATES.some((t) => t.id === x.template) ? x.template : 'custom') as TemplateId,
      fee: n(x.fee),
      deadline: isValidISO(x.deadline) ? x.deadline : null,
      deliverables: (Array.isArray(x.deliverables) ? x.deliverables : [])
        .filter((d): d is Deliverable => !!d && typeof d.title === 'string')
        .map((d) => ({ id: s(d.id, 80) || uid(), title: s(d.title, 300), done: !!d.done })),
      excluded: (Array.isArray(x.excluded) ? x.excluded : []).map((e) => s(e, 200)).filter(Boolean),
      revisions: Math.round(n(x.revisions, 2, 20)),
      createdAt: n(x.createdAt, Date.now(), 1e14),
      archivedAt: typeof x.archivedAt === 'number' ? x.archivedAt : null,
    }));
  const ids = new Set(projects.map((x) => x.id));
  const items: RequestItem[] = (Array.isArray(r.items) ? r.items : [])
    .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object' && ids.has((x as RequestItem).projectId))
    .map((x) => {
      const kind = KINDS.includes(x.kind as ItemKind) ? (x.kind as ItemKind) : 'included';
      return {
        id: s(x.id, 80) || uid(),
        projectId: s(x.projectId, 80),
        text: s(x.text, 2000),
        title: s(x.title, 120) || 'Client request',
        kind,
        hours: n(x.hours, 0, 1000),
        amount: n(x.amount),
        days: Math.round(n(x.days, 0, 365)),
        status: kind === 'extra' ? (STATUSES.includes(x.status as ExtraStatus) ? (x.status as ExtraStatus) : 'proposed') : null,
        round: kind === 'revision' ? Math.max(1, Math.round(n(x.round, 1, 50))) : null,
        createdAt: n(x.createdAt, Date.now(), 1e14),
        decidedAt: typeof x.decidedAt === 'number' ? x.decidedAt : null,
      };
    });
  return {
    version: 3,
    profile: {
      name: s(p.name, 80),
      business: s(p.business, 120),
      email: s(p.email, 200),
      rate: n(p.rate, 75, 100000),
      currency: isCurrency(p.currency) ? p.currency : 'USD',
      hoursPerDay: n(p.hoursPerDay, 6, 24) || 6,
    },
    settings: {
      theme: st.theme === 'light' || st.theme === 'dark' ? st.theme : 'system',
      tone: st.tone === 'brief' ? 'brief' : 'warm',
      onboarded: !!st.onboarded,
      sample: !!st.sample,
      lastProjectId: typeof st.lastProjectId === 'string' && ids.has(st.lastProjectId) ? st.lastProjectId : null,
    },
    projects,
    items,
  };
}

function load(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return sanitize(JSON.parse(raw)) ?? DEFAULT_STATE;
  } catch {
    /* storage unavailable or corrupt: start fresh in memory */
  }
  return DEFAULT_STATE;
}

let state: AppState = typeof window === 'undefined' ? DEFAULT_STATE : load();
const listeners = new Set<() => void>();

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* quota or privacy mode: keep working in memory */
  }
}

export function getState(): AppState {
  return state;
}

export function setState(update: (s: AppState) => AppState) {
  state = update(state);
  persist();
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

if (typeof window !== 'undefined') {
  // Keep several open tabs in sync
  window.addEventListener('storage', (e) => {
    if (e.key !== STORAGE_KEY) return;
    state = load();
    listeners.forEach((l) => l());
  });
}

export function useAppState(): AppState {
  return useSyncExternalStore(subscribe, getState, getState);
}

/* ─── Actions ─── */

export interface ProjectDraft {
  client: string;
  contact: string;
  name: string;
  template: TemplateId;
  fee: number;
  deadline: ISODate | null;
  deliverables: { id?: string; title: string; done?: boolean }[];
  excluded: string[];
  revisions: number;
}

export interface ItemDraft {
  projectId: string;
  text: string;
  title: string;
  kind: ItemKind;
  hours: number;
  amount: number;
  days: number;
  round: number | null;
}

function cleanDraft(d: ProjectDraft) {
  return {
    client: d.client.trim().slice(0, 120),
    contact: d.contact.trim().slice(0, 80),
    name: d.name.trim().slice(0, 200) || 'Untitled project',
    template: d.template,
    fee: Math.max(0, d.fee || 0),
    deadline: d.deadline && isValidISO(d.deadline) ? d.deadline : null,
    deliverables: d.deliverables
      .map((x) => ({ id: x.id ?? uid(), title: x.title.trim(), done: !!x.done }))
      .filter((x) => x.title),
    excluded: d.excluded.map((x) => x.trim()).filter(Boolean),
    revisions: Math.max(0, Math.min(20, Math.round(d.revisions))),
  };
}

export const actions = {
  completeOnboarding(profile: Partial<Profile>) {
    setState((st) => ({ ...st, profile: { ...st.profile, ...profile }, settings: { ...st.settings, onboarded: true } }));
  },

  updateProfile(patch: Partial<Profile>) {
    setState((st) => ({ ...st, profile: { ...st.profile, ...patch } }));
  },

  setTheme(theme: Theme) {
    setState((st) => ({ ...st, settings: { ...st.settings, theme } }));
  },

  setTone(tone: Tone) {
    setState((st) => ({ ...st, settings: { ...st.settings, tone } }));
  },

  setLastProject(id: string) {
    if (getState().settings.lastProjectId === id) return;
    setState((st) => ({ ...st, settings: { ...st.settings, lastProjectId: id } }));
  },

  addProject(draft: ProjectDraft): string {
    const id = uid();
    setState((st) => ({
      ...st,
      projects: [...st.projects, { id, ...cleanDraft(draft), createdAt: Date.now(), archivedAt: null }],
      settings: { ...st.settings, lastProjectId: id },
    }));
    return id;
  },

  updateProject(id: string, draft: ProjectDraft) {
    setState((st) => ({ ...st, projects: st.projects.map((p) => (p.id === id ? { ...p, ...cleanDraft(draft) } : p)) }));
  },

  toggleDeliverable(projectId: string, deliverableId: string) {
    setState((st) => ({
      ...st,
      projects: st.projects.map((p) =>
        p.id === projectId ? { ...p, deliverables: p.deliverables.map((d) => (d.id === deliverableId ? { ...d, done: !d.done } : d)) } : p,
      ),
    }));
  },

  setArchived(id: string, archived: boolean) {
    setState((st) => ({ ...st, projects: st.projects.map((p) => (p.id === id ? { ...p, archivedAt: archived ? Date.now() : null } : p)) }));
  },

  /** Returns a restore function for undo. */
  deleteProject(id: string): () => void {
    const snapshot = getState();
    setState((st) => ({
      ...st,
      projects: st.projects.filter((p) => p.id !== id),
      items: st.items.filter((i) => i.projectId !== id),
      settings: { ...st.settings, lastProjectId: st.settings.lastProjectId === id ? null : st.settings.lastProjectId },
    }));
    return () => setState(() => snapshot);
  },

  addItem(d: ItemDraft): string {
    const id = uid();
    const now = Date.now();
    const item: RequestItem = {
      id,
      projectId: d.projectId,
      text: d.text.trim().slice(0, 2000),
      title: d.title.trim().slice(0, 120) || 'Client request',
      kind: d.kind,
      hours: Math.max(0, d.hours),
      amount: d.kind === 'extra' || d.kind === 'gift' ? Math.max(0, d.amount) : 0,
      days: d.kind === 'extra' ? Math.max(0, Math.round(d.days)) : 0,
      status: d.kind === 'extra' ? 'proposed' : null,
      round: d.kind === 'revision' ? Math.max(1, d.round ?? 1) : null,
      createdAt: now,
      decidedAt: d.kind === 'extra' ? null : now,
    };
    setState((st) => ({ ...st, items: [...st.items, item], settings: { ...st.settings, lastProjectId: d.projectId } }));
    return id;
  },

  updateItem(id: string, patch: Partial<Pick<RequestItem, 'title' | 'amount' | 'hours' | 'days'>>) {
    setState((st) => ({ ...st, items: st.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) }));
  },

  setStatus(id: string, status: ExtraStatus) {
    setState((st) => ({
      ...st,
      items: st.items.map((i) => (i.id === id && i.kind === 'extra' ? { ...i, status, decidedAt: status === 'proposed' ? null : Date.now() } : i)),
    }));
  },

  /** Charge ↔ gift. A gift keeps the price as its value. */
  convert(id: string, to: 'extra' | 'gift') {
    setState((st) => ({
      ...st,
      items: st.items.map((i) =>
        i.id === id
          ? { ...i, kind: to, status: to === 'extra' ? 'proposed' : null, amount: i.amount || niceRound(i.hours * st.profile.rate), decidedAt: to === 'gift' ? Date.now() : null }
          : i,
      ),
    }));
  },

  /** Returns a restore function for undo. */
  deleteItem(id: string): () => void {
    const snapshot = getState();
    setState((st) => ({ ...st, items: st.items.filter((i) => i.id !== id) }));
    return () => setState(() => snapshot);
  },

  /** Handles the link in a client's approval email. Returns the item if it was waiting. */
  approveFromLink(projectId: string, itemId: string): RequestItem | null {
    const item = getState().items.find((i) => i.id === itemId && i.projectId === projectId && i.kind === 'extra');
    if (!item) return null;
    if (item.status !== 'approved') actions.setStatus(itemId, 'approved');
    return item;
  },

  loadSample() {
    setState((st) => {
      const sample = buildSample(st.profile);
      return {
        ...st,
        projects: sample.projects,
        items: sample.items,
        settings: { ...st.settings, onboarded: true, sample: true, lastProjectId: sample.projects[0].id },
      };
    });
  },

  /** Clears projects (e.g. leaving the sample). Keeps your profile and preferences. */
  clearProjects() {
    setState((st) => ({ ...st, projects: [], items: [], settings: { ...st.settings, sample: false, lastProjectId: null } }));
  },

  eraseEverything() {
    setState((st) => ({ ...DEFAULT_STATE, settings: { ...DEFAULT_STATE.settings, theme: st.settings.theme } }));
  },

  importData(raw: unknown): boolean {
    const next = sanitize(raw);
    if (!next) return false;
    setState(() => ({ ...next, settings: { ...next.settings, onboarded: true } }));
    return true;
  },
};

export function exportData(): string {
  return JSON.stringify(getState(), null, 2);
}
