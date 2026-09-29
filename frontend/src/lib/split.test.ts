import { describe, expect, it } from 'vitest';
import type { Project, RequestItem } from './model';
import { splitAsks } from './split';
import { templateById } from './templates';
import { suggestAll } from './verdict';

const NOW = new Date(2026, 8, 23, 12).getTime();

function project(template: 'website' | 'brand', revisions?: number): Project {
  const t = templateById(template);
  return {
    id: 'p1',
    client: 'Northwind',
    contact: 'Maya',
    name: 'Test',
    template,
    fee: 4000,
    deadline: '2026-10-09',
    deliverables: t.deliverables.map((title, i) => ({ id: `d${i}`, title, done: false })),
    excluded: t.excluded,
    revisions: revisions ?? t.revisions,
    createdAt: 0,
    archivedAt: null,
  };
}

describe('splitAsks', () => {
  it('pulls separate asks out of a real email and drops the small talk', () => {
    const email = `Hi Sam,

Thanks for the new version, the team loves it! A few things:

1. Could the hero headline be a bit bigger?
2. Can we add a pricing page? Nothing fancy.
3. The contact form isn't sending on my phone.

Also, could you write the About page copy? We're stuck on it.

Thanks!
Maya
Northwind Coffee`;
    expect(splitAsks(email)).toEqual([
      'Could the hero headline be a bit bigger?',
      'Can we add a pricing page?',
      "The contact form isn't sending on my phone.",
      'Also, could you write the About page copy?',
    ]);
  });

  it('ignores quoted history and signatures', () => {
    const thread = `Can we try the logo in a warmer green?
--
Maya Chen | Northwind

On Tue, Sep 22, 2026 at 9:14 AM Sam Rivera <sam@example.com> wrote:
> Here are the three concepts. Could you pick one?`;
    expect(splitAsks(thread)).toEqual(['Can we try the logo in a warmer green?']);
  });

  it('splits "and also" and semicolons inside one sentence', () => {
    expect(splitAsks('Can we make the logo bigger and also add a pricing page?')).toEqual(['Can we make the logo bigger', 'add a pricing page?']);
    expect(splitAsks('swap the footer icons; move the CTA higher')).toEqual(['swap the footer icons', 'move the CTA higher']);
  });

  it('keeps "could you also…" whole', () => {
    expect(splitAsks('Could you also add a pricing page?')).toEqual(['Could you also add a pricing page?']);
  });

  it('drops follow-ups that only point at the ask before them', () => {
    expect(splitAsks('The form is broken on mobile. Can you take a look? Let me know!')).toEqual(['The form is broken on mobile.']);
  });

  it('joins lines wrapped by an email client', () => {
    expect(splitAsks('Could you make the header\nlogo a touch bigger?\n\nAnd can we add a blog page?')).toEqual([
      'Could you make the header logo a touch bigger?',
      'And can we add a blog page?',
    ]);
  });

  it('skips email headers pasted with the message', () => {
    expect(splitAsks('From: Maya Chen\nSubject: Feedback\n\nCan the buttons be rounder?')).toEqual(['Can the buttons be rounder?']);
  });

  it('drops lead-ins like "one more thing" so they don\'t read as more work', () => {
    expect(splitAsks('Can the icon be bolder? And one more thing, tighten the letter spacing.')).toEqual(['Can the icon be bolder?', 'Tighten the letter spacing.']);
    expect(splitAsks('Quick one: swap the footer icons. Also the header logo could be bigger?')).toEqual(['Swap the footer icons.', 'Also the header logo could be bigger?']);
  });

  it('returns nothing for pure small talk', () => {
    expect(splitAsks('Looks great, thanks so much for the quick turnaround!')).toEqual([]);
  });
});

describe('suggestAll', () => {
  it('reads each ask, keeping changes from one message in one round', () => {
    const asks = ['Could the headline be bigger?', 'Can the buttons be rounder?', 'Can we add a pricing page?'];
    const v = suggestAll(asks, project('website'), [], NOW);
    expect(v.map((x) => x.kind)).toEqual(['revision', 'revision', 'extra']);
    expect(v[0].round).toBe(1);
    expect(v[1].round).toBe(1);
  });

  it('charges one extra round, not one per change, once included rounds are used', () => {
    const used: RequestItem[] = [1, 2].map((round) => ({
      id: `r${round}`,
      projectId: 'p1',
      text: 'change',
      title: 'change',
      kind: 'revision',
      hours: 1,
      amount: 0,
      days: 0,
      status: null,
      round,
      createdAt: NOW - (300 - round * 100) * 3_600_000,
      decidedAt: NOW,
      co: null,
      approvedBy: null,
    }));
    const v = suggestAll(['Can the icon be bolder?', 'Could the green be warmer?', 'Tighten the letter spacing'], project('brand', 2), used, NOW);
    expect(v[0].kind).toBe('extra');
    expect(v[0].overRounds).toBe(true);
    expect(v.slice(1).map((x) => [x.kind, x.round])).toEqual([
      ['revision', 3],
      ['revision', 3],
    ]);
    expect(v[1].reason).toBe('Part of the extra round above.');
  });
});
