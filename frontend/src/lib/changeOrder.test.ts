import { beforeEach, describe, expect, it } from 'vitest';
import {
  approvalMessage,
  buildChangeOrder,
  changeOrderRef,
  changeOrderTotals,
  coLabel,
  decodeChangeOrder,
  encodeChangeOrder,
  parseChangeOrderApproval,
} from './changeOrder';
import { itemsOf } from './ledger';
import { draftBatchReply } from './messages';
import { buildSample } from './sample';
import { actions, DEFAULT_STATE, getState, setState } from './store';

const NOW = new Date(2026, 8, 23, 12).getTime();
const profile = { ...DEFAULT_STATE.profile, name: 'Sam Rivera', email: 'sam@example.com', rate: 80 };

function workspace() {
  const { projects, items } = buildSample(profile, NOW);
  setState(() => ({ ...DEFAULT_STATE, profile, projects, items, settings: { ...DEFAULT_STATE.settings, onboarded: true } }));
  return projects[0];
}

function addExtras(projectId: string, specs: [string, number, number][]): string[] {
  return actions.addItems(specs.map(([title, amount, days]) => ({ projectId, text: `Could you ${title.toLowerCase()}?`, title, kind: 'extra', hours: amount / 80, amount, days, round: null })));
}

describe('change orders', () => {
  beforeEach(() => {
    setState(() => DEFAULT_STATE);
  });

  it('numbers change orders per project and keeps the number when the same set is resent', () => {
    const web = workspace();
    const ids = addExtras(web.id, [
      ['Add a blog page', 320, 1],
      ['Add a careers page', 240, 1],
    ]);
    // The sample's pricing page was signed in CO-001
    expect(actions.issueChangeOrder(web.id, ids)).toBe(2);
    expect(actions.issueChangeOrder(web.id, ids)).toBe(2);
    expect(actions.issueChangeOrder(web.id, [ids[0]])).toBe(3);
  });

  it('builds the document from the waiting extras, in the order they were asked', () => {
    const web = workspace();
    const ids = addExtras(web.id, [
      ['Add a blog page', 320, 1],
      ['Add a careers page', 240, 2],
    ]);
    const n = actions.issueChangeOrder(web.id, ids);
    const co = buildChangeOrder(web, itemsOf(getState().items, web.id), profile, n, NOW);
    expect(co.lines.map((l) => l.title)).toEqual(['Add a blog page', 'Add a careers page']);
    expect(co.project.approved).toBe(320); // the sample's approved pricing page
    const t = changeOrderTotals(co, new Set([ids[1]]));
    expect(t.subtotal).toBe(240);
    expect(t.after).toBe(web.fee + 320 + 240);
    expect(t.days).toBe(2);
  });

  it('round-trips through the link and rejects garbage', async () => {
    const web = workspace();
    const ids = addExtras(web.id, [['Add a blog page', 320, 1]]);
    const n = actions.issueChangeOrder(web.id, ids);
    const co = buildChangeOrder(web, itemsOf(getState().items, web.id), profile, n, NOW);
    const encoded = await encodeChangeOrder(co);
    expect(encoded.length).toBeLessThan(1500);
    expect(await decodeChangeOrder(encoded)).toEqual(co);
    expect(await decodeChangeOrder('zgarbage')).toBeNull();
  });

  it('gives a reference that changes when a price changes', () => {
    const lines = [{ id: 'a', amount: 320, days: 1 }];
    expect(changeOrderRef(1, lines)).toMatch(/^[0-9A-Z]{5}$/);
    expect(changeOrderRef(1, lines)).toBe(changeOrderRef(1, lines));
    expect(changeOrderRef(1, [{ ...lines[0], amount: 330 }])).not.toBe(changeOrderRef(1, lines));
    expect(coLabel(3)).toBe('CO-003');
  });

  it('writes an approval that records the signature back in the app', () => {
    const web = workspace();
    const ids = addExtras(web.id, [
      ['Add a blog page', 320, 1],
      ['Add a careers page', 240, 1],
    ]);
    const n = actions.issueChangeOrder(web.id, ids);
    const co = buildChangeOrder(web, itemsOf(getState().items, web.id), profile, n, NOW);
    const { subject, body } = approvalMessage(co, new Set([ids[0]]), 'Maya Chen', new Date(NOW));
    expect(subject).toBe('Approved: CO-002 for Website redesign ($320)');
    expect(body).toContain('✓ Add a blog page · $320');
    expect(body).toContain('✗ Not now: Add a careers page · $240');
    expect(body).toContain('Signed: Maya Chen, September 23, 2026');

    const link = /https?:\/\/\S+\/app#(\S+?)\)/.exec(body)?.[1];
    const approval = parseChangeOrderApproval(`#${link}`);
    expect(approval).toMatchObject({ projectId: web.id, n: 2, approved: [ids[0]], by: 'Maya Chen', ref: changeOrderRef(2, co.lines) });

    const result = actions.approveChangeOrder(approval!.projectId, approval!.n, approval!.approved, approval!.by, approval!.ref);
    expect(result?.stale).toBe(false);
    expect(result?.approved.map((i) => i.title)).toEqual(['Add a blog page']);
    expect(result?.declined.map((i) => i.title)).toEqual(['Add a careers page']);
    const items = getState().items;
    expect(items.find((i) => i.id === ids[0])).toMatchObject({ status: 'approved', approvedBy: 'Maya Chen' });
    expect(items.find((i) => i.id === ids[1])).toMatchObject({ status: 'declined', approvedBy: null });
  });

  it('flags an approval signed against an older price', () => {
    const web = workspace();
    const ids = addExtras(web.id, [['Add a blog page', 320, 1]]);
    const n = actions.issueChangeOrder(web.id, ids);
    const ref = changeOrderRef(n, buildChangeOrder(web, itemsOf(getState().items, web.id), profile, n).lines);
    actions.updateItem(ids[0], { amount: 360 });
    expect(actions.approveChangeOrder(web.id, n, ids, 'Maya Chen', ref)?.stale).toBe(true);
  });

  it('ignores approval links that are not change orders', () => {
    expect(parseChangeOrderApproval('#ok=p.i')).toBeNull();
    expect(parseChangeOrderApproval('#co=p&n=zero')).toBeNull();
  });
});

describe('draftBatchReply', () => {
  it('answers every ask in one message, grouped the way the client will read it', () => {
    const reply = draftBatchReply({
      tone: 'warm',
      contact: 'Maya Chen',
      currency: 'USD',
      included: ['Contact form not sending on mobile'],
      revisions: [{ round: 1, titles: ['Make the hero headline bigger', 'Make the buttons rounder'] }],
      roundsIncluded: 2,
      extras: [
        { title: 'Add a pricing page', amount: 320 },
        { title: 'Write the About page copy', amount: 240 },
      ],
      gifts: [],
      days: 2,
      delivery: '2026-10-09',
      changeOrder: 'CO-002',
      link: 'https://www.optileno.com/co#z123',
      signature: 'Sam Rivera',
    });
    expect(reply).toMatch(/^Hi Maya,/);
    expect(reply).toContain('Revision round 1 of 2:\n• Make the hero headline bigger\n• Make the buttons rounder');
    expect(reply).toContain('in change order CO-002');
    expect(reply).toContain('Together $560, and it moves delivery from Fri, Oct 9 to Tue, Oct 13.');
    expect(reply).toContain('https://www.optileno.com/co#z123');
    expect(reply).toMatch(/Sam$/);
  });
});
