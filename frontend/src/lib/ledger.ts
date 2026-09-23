import { addWorkdays, type ISODate } from './dates';
import type { Project, RequestItem } from './model';

/* The money side of a project: what was agreed, what was added, what was
   given away on purpose, and what is still waiting on the client. */

export function itemsOf(items: RequestItem[], projectId: string): RequestItem[] {
  return items.filter((i) => i.projectId === projectId);
}

/** Highest revision round used so far (rounds are numbered from 1). */
export function roundsUsed(projectItems: RequestItem[]): number {
  return projectItems.reduce((max, i) => (i.kind === 'revision' && i.round ? Math.max(max, i.round) : max), 0);
}

export interface ProjectTotals {
  fee: number;
  approved: number;
  pending: number;
  gifted: number;
  total: number;
  approvedDays: number;
  pendingCount: number;
  roundsUsed: number;
  roundsIncluded: number;
  delivery: ISODate | null;
  requests: number;
}

export function projectTotals(project: Project, projectItems: RequestItem[]): ProjectTotals {
  let approved = 0;
  let pending = 0;
  let gifted = 0;
  let approvedDays = 0;
  let pendingCount = 0;
  for (const i of projectItems) {
    if (i.kind === 'extra' && i.status === 'approved') {
      approved += i.amount;
      approvedDays += i.days;
    } else if (i.kind === 'extra' && i.status === 'proposed') {
      pending += i.amount;
      pendingCount += 1;
    } else if (i.kind === 'gift') {
      gifted += i.amount;
    }
  }
  return {
    fee: project.fee,
    approved,
    pending,
    gifted,
    total: project.fee + approved,
    approvedDays,
    pendingCount,
    roundsUsed: roundsUsed(projectItems),
    roundsIncluded: project.revisions,
    delivery: project.deadline ? addWorkdays(project.deadline, approvedDays) : null,
    requests: projectItems.length,
  };
}

export interface WorkspaceTotals {
  recovered: number;
  pending: number;
  gifted: number;
  pendingCount: number;
  requests: number;
}

/** Totals across projects, optionally only for requests made since `since` (ms). */
export function workspaceTotals(items: RequestItem[], since = 0): WorkspaceTotals {
  const t: WorkspaceTotals = { recovered: 0, pending: 0, gifted: 0, pendingCount: 0, requests: 0 };
  for (const i of items) {
    if (i.createdAt < since) continue;
    t.requests += 1;
    if (i.kind === 'extra' && i.status === 'approved') t.recovered += i.amount;
    else if (i.kind === 'extra' && i.status === 'proposed') {
      t.pending += i.amount;
      t.pendingCount += 1;
    } else if (i.kind === 'gift') t.gifted += i.amount;
  }
  return t;
}

export function startOfYear(now = new Date()): number {
  return new Date(now.getFullYear(), 0, 1).getTime();
}
