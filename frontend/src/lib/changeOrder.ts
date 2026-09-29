import { addWorkdays, formatFull, formatLong, isValidISO, toISO, type ISODate } from './dates';
import { projectTotals } from './ledger';
import { formatMoney, isCurrency, type Currency } from './money';
import type { Profile, Project, RequestItem } from './model';
import { packJSON, siteOrigin, unpackJSON } from './share';

/* A change order is the formal version of "that's extra": a numbered page
   listing each addition with its price and effect on delivery, which the
   client ticks, signs with their name, and sends back in one tap. Like the
   scope page, the whole document travels inside the link. */

export interface ChangeOrderLine {
  id: string;
  title: string;
  /** What the client actually said. */
  asked: string;
  hours: number;
  amount: number;
  days: number;
}

export interface ChangeOrder {
  v: 1;
  /** Number within the project: CO-001, CO-002… */
  n: number;
  /** When it was issued (ms). */
  t: number;
  freelancer: { name: string; business: string; email: string };
  currency: Currency;
  project: {
    id: string;
    client: string;
    contact: string;
    name: string;
    fee: number;
    /** Extras approved before this change order. */
    approved: number;
    /** Delivery date before this change order. */
    delivery: ISODate | null;
  };
  lines: ChangeOrderLine[];
}

export function coLabel(n: number): string {
  return `CO-${String(n).padStart(3, '0')}`;
}

/** Short fingerprint of what was priced, so both sides can tell they're looking at the same document. */
export function changeOrderRef(n: number, lines: Pick<ChangeOrderLine, 'id' | 'amount' | 'days'>[]): string {
  const text = `${n}|${lines.map((l) => `${l.id}:${l.amount}:${l.days}`).join('|')}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36).toUpperCase().padStart(7, '0').slice(-5);
}

/** The extras in change order `n` that are still waiting on the client, oldest first. */
export function linesOf(projectItems: RequestItem[], n: number): RequestItem[] {
  return projectItems.filter((i) => i.kind === 'extra' && i.co === n && i.status === 'proposed').sort((a, b) => a.createdAt - b.createdAt);
}

export function buildChangeOrder(project: Project, projectItems: RequestItem[], profile: Profile, n: number, now = Date.now()): ChangeOrder {
  const totals = projectTotals(project, projectItems);
  return {
    v: 1,
    n,
    t: now,
    freelancer: { name: profile.name, business: profile.business, email: profile.email },
    currency: profile.currency,
    project: {
      id: project.id,
      client: project.client,
      contact: project.contact,
      name: project.name,
      fee: project.fee,
      approved: totals.approved,
      delivery: totals.delivery,
    },
    lines: linesOf(projectItems, n).map((i) => ({
      id: i.id,
      title: i.title,
      asked: i.text === i.title ? '' : i.text.slice(0, 280),
      hours: i.hours,
      amount: i.amount,
      days: i.days,
    })),
  };
}

export interface ChangeOrderTotals {
  subtotal: number;
  days: number;
  before: number;
  after: number;
  deliveryAfter: ISODate | null;
}

/** What the project looks like if the client approves `selected` lines. */
export function changeOrderTotals(co: ChangeOrder, selected: Set<string>): ChangeOrderTotals {
  const chosen = co.lines.filter((l) => selected.has(l.id));
  const subtotal = chosen.reduce((s, l) => s + l.amount, 0);
  const days = chosen.reduce((s, l) => s + l.days, 0);
  const before = co.project.fee + co.project.approved;
  return {
    subtotal,
    days,
    before,
    after: before + subtotal,
    deliveryAfter: co.project.delivery ? addWorkdays(co.project.delivery, days) : null,
  };
}

/* ─── Compact wire format ─── */

type Wire = [1, number, number, [string, string, string], string, [string, string, string, string, number, number, string], [string, string, string, number, number, number][]];

function toWire(co: ChangeOrder): Wire {
  const p = co.project;
  return [
    1,
    co.n,
    co.t,
    [co.freelancer.name, co.freelancer.business, co.freelancer.email],
    co.currency,
    [p.id, p.client, p.contact, p.name, p.fee, p.approved, p.delivery ?? ''],
    co.lines.map((l) => [l.id, l.title, l.asked, l.hours, l.amount, l.days]),
  ];
}

const str = (v: unknown, max = 300) => (typeof v === 'string' ? v.slice(0, max) : '');
const num = (v: unknown, max = 1e9) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(0, v)) : 0);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v.slice(0, 50) : []);

function fromWire(w: unknown): ChangeOrder | null {
  if (!Array.isArray(w) || w[0] !== 1) return null;
  const f = arr(w[3]);
  const p = arr(w[5]);
  const lines = arr(w[6])
    .map((raw) => {
      const x = arr(raw);
      return { id: str(x[0], 80), title: str(x[1], 120), asked: str(x[2], 280), hours: num(x[3], 1000), amount: num(x[4]), days: Math.round(num(x[5], 365)) };
    })
    .filter((l) => l.id && l.title);
  const n = Math.round(num(w[1], 9999));
  if (!n || !str(p[0]) || !lines.length) return null;
  return {
    v: 1,
    n,
    t: num(w[2], 1e14) || Date.now(),
    freelancer: { name: str(f[0], 80), business: str(f[1], 120), email: str(f[2], 200) },
    currency: isCurrency(w[4]) ? w[4] : 'USD',
    project: {
      id: str(p[0], 80),
      client: str(p[1], 120),
      contact: str(p[2], 80),
      name: str(p[3], 200) || 'Project',
      fee: num(p[4]),
      approved: num(p[5]),
      delivery: isValidISO(p[6]) ? p[6] : null,
    },
    lines,
  };
}

export async function encodeChangeOrder(co: ChangeOrder): Promise<string> {
  return packJSON(toWire(co));
}

export async function decodeChangeOrder(encoded: string): Promise<ChangeOrder | null> {
  const wire = await unpackJSON(encoded);
  return wire === undefined ? null : fromWire(wire);
}

export async function changeOrderLink(project: Project, projectItems: RequestItem[], profile: Profile, n: number): Promise<string> {
  return `${siteOrigin()}/co#${await encodeChangeOrder(buildChangeOrder(project, projectItems, profile, n))}`;
}

/* ─── The signed answer ─── */

export interface ChangeOrderApproval {
  projectId: string;
  n: number;
  ref: string;
  approved: string[];
  by: string;
}

/** Link in the client's reply that records their decision in the freelancer's app. */
export function changeOrderApprovalLink(a: ChangeOrderApproval): string {
  const q = new URLSearchParams({ co: a.projectId, n: String(a.n), ref: a.ref, ok: a.approved.join(','), by: a.by });
  return `${siteOrigin()}/app#${q.toString()}`;
}

export function parseChangeOrderApproval(hash: string): ChangeOrderApproval | null {
  const q = new URLSearchParams(hash.replace(/^#/, ''));
  const projectId = q.get('co');
  const n = Number(q.get('n'));
  if (!projectId || !Number.isInteger(n) || n < 1) return null;
  return {
    projectId: projectId.slice(0, 80),
    n,
    ref: (q.get('ref') ?? '').slice(0, 12),
    approved: (q.get('ok') ?? '')
      .split(',')
      .map((id) => id.trim().slice(0, 80))
      .filter(Boolean)
      .slice(0, 50),
    by: (q.get('by') ?? '').trim().slice(0, 80),
  };
}

/** The email (or chat message) the client sends back when they sign. */
export function approvalMessage(co: ChangeOrder, selected: Set<string>, by: string, signedAt = new Date()): { subject: string; body: string } {
  const money = (n: number) => formatMoney(n, co.currency);
  const t = changeOrderTotals(co, selected);
  const ref = changeOrderRef(co.n, co.lines);
  const label = coLabel(co.n);
  const yes = co.lines.filter((l) => selected.has(l.id));
  const no = co.lines.filter((l) => !selected.has(l.id));
  const first = co.freelancer.name.trim().split(/\s+/)[0] || 'there';
  const link = changeOrderApprovalLink({ projectId: co.project.id, n: co.n, ref, approved: yes.map((l) => l.id), by });
  const date = formatFull(toISO(signedAt));

  if (!yes.length) {
    return {
      subject: `Not going ahead: ${label} for ${co.project.name}`,
      body: `Hi ${first},\n\nThanks for putting ${label} together (ref ${ref}). We’ll leave these out for now:\n\n${no
        .map((l) => `✗ ${l.title} · ${money(l.amount)}`)
        .join('\n')}\n\n${by}, ${date}\n\n(Records this in your Optileno: ${link})`,
    };
  }

  const lines = [...yes.map((l) => `✓ ${l.title} · ${money(l.amount)}`), ...no.map((l) => `✗ Not now: ${l.title} · ${money(l.amount)}`)].join('\n');
  const delivery = co.project.delivery && t.deliveryAfter ? `\nNew delivery date: ${formatLong(t.deliveryAfter)}.` : '';
  return {
    subject: `Approved: ${label} for ${co.project.name} (${money(t.subtotal)})`,
    body: `Hi ${first},\n\nI approve change order ${label} for ${co.project.name} (ref ${ref}):\n\n${lines}\n\nApproved: ${money(t.subtotal)}. New project total: ${money(t.after)}.${delivery}\n\nSigned: ${by}, ${date}\n\n(One-tap confirm for your Optileno: ${link})`,
  };
}
