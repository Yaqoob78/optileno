import { isValidISO, type ISODate } from './dates';
import { projectTotals } from './ledger';
import { isCurrency, type Currency } from './money';
import type { ExtraStatus, Profile, Project, RequestItem } from './model';

/* The client's scope page travels inside the link itself, after the "#".
   Browsers never send that part to a server, so nothing about the project
   is ever uploaded or stored anywhere but the freelancer's device. */

export interface Snapshot {
  v: 1;
  /** When the snapshot was made (ms). */
  t: number;
  freelancer: { name: string; business: string; email: string };
  currency: Currency;
  project: {
    id: string;
    client: string;
    name: string;
    fee: number;
    deadline: ISODate | null;
    delivery: ISODate | null;
    deliverables: { title: string; done: boolean }[];
    excluded: string[];
    roundsUsed: number;
    roundsIncluded: number;
  };
  extras: { id: string; title: string; amount: number; days: number; status: ExtraStatus }[];
  gifts: { title: string; amount: number }[];
}

export function buildSnapshot(project: Project, projectItems: RequestItem[], profile: Profile, now = Date.now()): Snapshot {
  const totals = projectTotals(project, projectItems);
  const byTime = [...projectItems].sort((a, b) => a.createdAt - b.createdAt);
  return {
    v: 1,
    t: now,
    freelancer: { name: profile.name, business: profile.business, email: profile.email },
    currency: profile.currency,
    project: {
      id: project.id,
      client: project.client,
      name: project.name,
      fee: project.fee,
      deadline: project.deadline,
      delivery: totals.delivery,
      deliverables: project.deliverables.map((d) => ({ title: d.title, done: d.done })),
      excluded: project.excluded,
      roundsUsed: totals.roundsUsed,
      roundsIncluded: project.revisions,
    },
    extras: byTime
      .filter((i) => i.kind === 'extra' && i.status)
      .map((i) => ({ id: i.id, title: i.title, amount: i.amount, days: i.days, status: i.status as ExtraStatus })),
    gifts: byTime.filter((i) => i.kind === 'gift').map((i) => ({ title: i.title, amount: i.amount })),
  };
}

/* ─── Compact wire format (short keys keep links short) ─── */

type Wire = [
  1,
  number,
  [string, string, string],
  string,
  [string, string, string, number, string, string, [string, 0 | 1][], string[], number, number],
  [string, string, number, number, 0 | 1 | 2][],
  [string, number][],
];

const STATUS: ExtraStatus[] = ['proposed', 'approved', 'declined'];

function toWire(s: Snapshot): Wire {
  const p = s.project;
  return [
    1,
    s.t,
    [s.freelancer.name, s.freelancer.business, s.freelancer.email],
    s.currency,
    [p.id, p.client, p.name, p.fee, p.deadline ?? '', p.delivery ?? '', p.deliverables.map((d) => [d.title, d.done ? 1 : 0]), p.excluded, p.roundsUsed, p.roundsIncluded],
    s.extras.map((e) => [e.id, e.title, e.amount, e.days, STATUS.indexOf(e.status) as 0 | 1 | 2]),
    s.gifts.map((g) => [g.title, g.amount]),
  ];
}

const str = (v: unknown, max = 300) => (typeof v === 'string' ? v.slice(0, max) : '');
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, v) : 0);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v.slice(0, 200) : []);

function fromWire(w: unknown): Snapshot | null {
  if (!Array.isArray(w) || w[0] !== 1) return null;
  const f = arr(w[2]);
  const p = arr(w[4]);
  if (!str(p[2])) return null;
  return {
    v: 1,
    t: num(w[1]) || Date.now(),
    freelancer: { name: str(f[0], 80), business: str(f[1], 120), email: str(f[2], 200) },
    currency: isCurrency(w[3]) ? w[3] : 'USD',
    project: {
      id: str(p[0], 80),
      client: str(p[1], 120),
      name: str(p[2], 200),
      fee: num(p[3]),
      deadline: isValidISO(p[4]) ? p[4] : null,
      delivery: isValidISO(p[5]) ? p[5] : null,
      deliverables: arr(p[6]).map((d) => ({ title: str(arr(d)[0]), done: arr(d)[1] === 1 })).filter((d) => d.title),
      excluded: arr(p[7]).map((x) => str(x)).filter(Boolean),
      roundsUsed: Math.round(num(p[8])),
      roundsIncluded: Math.round(num(p[9])),
    },
    extras: arr(w[5])
      .map((e) => {
        const x = arr(e);
        return { id: str(x[0], 80), title: str(x[1]), amount: num(x[2]), days: Math.round(num(x[3])), status: STATUS[Number(x[4])] ?? 'proposed' };
      })
      .filter((e) => e.title),
    gifts: arr(w[6])
      .map((g) => ({ title: str(arr(g)[0]), amount: num(arr(g)[1]) }))
      .filter((g) => g.title),
  };
}

/* ─── base64url + deflate ─── */

function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const body = new Blob([bytes as BlobPart]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(body).arrayBuffer());
}

const canCompress = () => typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined';

export async function encodeSnapshot(s: Snapshot): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(toWire(s)));
  if (canCompress()) {
    try {
      return `z${toBase64Url(await pipe(json, new CompressionStream('deflate-raw')))}`;
    } catch {
      /* fall through to plain encoding */
    }
  }
  return `j${toBase64Url(json)}`;
}

export async function decodeSnapshot(encoded: string): Promise<Snapshot | null> {
  try {
    const kind = encoded[0];
    const bytes = fromBase64Url(encoded.slice(1));
    let json: Uint8Array;
    if (kind === 'z') {
      if (!canCompress()) return null;
      json = await pipe(bytes, new DecompressionStream('deflate-raw'));
    } else if (kind === 'j') {
      json = bytes;
    } else {
      return null;
    }
    return fromWire(JSON.parse(new TextDecoder().decode(json)));
  } catch {
    return null;
  }
}

export function siteOrigin(): string {
  return typeof window === 'undefined' ? 'https://www.optileno.com' : window.location.origin;
}

export async function scopeLink(project: Project, projectItems: RequestItem[], profile: Profile): Promise<string> {
  return `${siteOrigin()}/s#${await encodeSnapshot(buildSnapshot(project, projectItems, profile))}`;
}

/** Link the client's approval email carries back to the freelancer's app. */
export function approvalLink(projectId: string, itemId: string): string {
  return `${siteOrigin()}/app#ok=${encodeURIComponent(projectId)}.${encodeURIComponent(itemId)}`;
}

export function parseApproval(hash: string): { projectId: string; itemId: string } | null {
  const m = /^#?ok=([^.]+)\.(.+)$/.exec(hash);
  if (!m) return null;
  return { projectId: decodeURIComponent(m[1]), itemId: decodeURIComponent(m[2]) };
}
