import { describe, expect, it } from 'vitest';
import { projectTotals, workspaceTotals } from './ledger';
import { niceRound } from './money';
import { buildSample } from './sample';
import { buildSnapshot, decodeSnapshot, encodeSnapshot, parseApproval } from './share';
import { DEFAULT_STATE, sanitize } from './store';

const NOW = new Date(2026, 8, 23, 12).getTime();
const profile = { ...DEFAULT_STATE.profile, name: 'Sam Rivera', email: 'sam@example.com', rate: 80 };

describe('share links', () => {
  it('round-trips a project snapshot through the link', async () => {
    const { projects, items } = buildSample(profile, NOW);
    const p = projects[0];
    const snap = buildSnapshot(p, items.filter((i) => i.projectId === p.id), profile, NOW);
    const encoded = await encodeSnapshot(snap);
    expect(encoded.length).toBeLessThan(2000);
    const back = await decodeSnapshot(encoded);
    expect(back).toEqual(snap);
  });

  it('rejects garbage', async () => {
    expect(await decodeSnapshot('znot-a-real-link')).toBeNull();
    expect(await decodeSnapshot('')).toBeNull();
  });

  it('parses approval links', () => {
    expect(parseApproval('#ok=sample-web.sample-i-5')).toEqual({ projectId: 'sample-web', itemId: 'sample-i-5' });
    expect(parseApproval('#something')).toBeNull();
  });
});

describe('ledger', () => {
  it('adds approved extras to the total and delivery, keeps gifts and pending apart', () => {
    const { projects, items } = buildSample(profile, NOW);
    const web = projects[0];
    const t = projectTotals(web, items.filter((i) => i.projectId === web.id));
    expect(t.approved).toBe(niceRound(4 * 80));
    expect(t.pending).toBe(niceRound(3 * 80));
    expect(t.gifted).toBe(niceRound(0.75 * 80));
    expect(t.total).toBe(web.fee + t.approved);
    expect(t.delivery).not.toBe(web.deadline);
    expect(t.roundsUsed).toBe(1);
  });

  it('sums the whole workspace', () => {
    const { items } = buildSample(profile, NOW);
    const w = workspaceTotals(items);
    expect(w.recovered).toBeGreaterThan(0);
    expect(w.pendingCount).toBe(2);
  });
});

describe('sanitize', () => {
  it('accepts its own export and drops orphans', () => {
    const { projects, items } = buildSample(profile, NOW);
    const raw = JSON.parse(JSON.stringify({ ...DEFAULT_STATE, projects, items: [...items, { ...items[0], id: 'x', projectId: 'missing' }] }));
    const clean = sanitize(raw);
    expect(clean?.projects).toHaveLength(3);
    expect(clean?.items).toHaveLength(items.length);
  });

  it('refuses unrelated JSON', () => {
    expect(sanitize({ hello: 'world' })).toBeNull();
    expect(sanitize(null)).toBeNull();
  });
});

describe('niceRound', () => {
  it('rounds like a person quoting a price', () => {
    expect(niceRound(62.5)).toBe(65);
    expect(niceRound(337)).toBe(340);
    expect(niceRound(4812)).toBe(4800);
    expect(niceRound(0)).toBe(0);
  });
});
