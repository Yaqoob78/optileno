import { describe, expect, it } from 'vitest';
import type { Project, RequestItem } from './model';
import { templateById } from './templates';
import { suggest, titleFrom } from './verdict';

const NOW = new Date(2026, 8, 23, 12).getTime();
const HOUR = 3_600_000;

function project(template: 'website' | 'brand' | 'video' | 'dev', revisions?: number): Project {
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

function revision(round: number, hoursAgo: number): RequestItem {
  return {
    id: `r${round}-${hoursAgo}`,
    projectId: 'p1',
    text: 'change',
    title: 'change',
    kind: 'revision',
    hours: 1,
    amount: 0,
    days: 0,
    status: null,
    round,
    createdAt: NOW - hoursAgo * HOUR,
    decidedAt: NOW,
  };
}

const read = (text: string, p = project('website'), items: RequestItem[] = []) => suggest(text, p, items, NOW);

describe('suggest', () => {
  it('flags explicitly excluded work as extra, citing the exclusion', () => {
    const v = read('Could you write the copy for the About page?');
    expect(v.kind).toBe('extra');
    expect(v.confidence).toBe('high');
    expect(v.reason).toContain('Copywriting');
  });

  it('treats adding more of a counted deliverable as extra', () => {
    const v = read('Can we add a pricing page too?');
    expect(v.kind).toBe('extra');
    expect(v.hours).toBeGreaterThanOrEqual(4);
  });

  it('treats visual tweaks as a revision round', () => {
    const v = read('Could the hero headline be a bit bigger?');
    expect(v.kind).toBe('revision');
    expect(v.round).toBe(1);
  });

  it('treats broken things as included fixes', () => {
    const v = read('The contact form isn’t working on mobile');
    expect(v.kind).toBe('included');
    expect(v.confidence).toBe('high');
  });

  it('recognises status questions as not being work', () => {
    const v = read('Any update on the homepage?');
    expect(v.kind).toBe('included');
    expect(v.confidence).toBe('low');
  });

  it('catches video cutdowns and aspect ratios', () => {
    const p = project('video');
    expect(read('Can we also get a vertical version for Reels?', p).kind).toBe('extra');
    expect(read('Could you make a 15 second teaser?', p).kind).toBe('extra');
    expect(read('Can the music come in later around 0:12?', p).kind).toBe('revision');
  });

  it('treats more logo concepts as extra', () => {
    const v = read('Could we see a few more concepts?', project('brand'));
    expect(v.kind).toBe('extra');
  });

  it('turns a revision into an extra once included rounds are used', () => {
    const v = read('Can we try the logo in a warmer green?', project('brand', 2), [revision(1, 200), revision(2, 100)]);
    expect(v.kind).toBe('extra');
    expect(v.overRounds).toBe(true);
    expect(v.reason).toContain('2 included revision rounds');
  });

  it('keeps feedback that arrives in pieces within the same round', () => {
    const v = read('Also could the button be darker?', project('website'), [revision(1, 3)]);
    expect(v.kind).toBe('revision');
    expect(v.round).toBe(1);
    expect(v.sameRound).toBe(true);
  });

  it('starts a new round when earlier feedback is old', () => {
    const v = read('Could the button be darker?', project('website'), [revision(1, 72)]);
    expect(v.round).toBe(2);
    expect(v.sameRound).toBe(false);
  });

  it('is honest when nothing matches', () => {
    const v = read('Thinking about a podcast intro jingle');
    expect(v.kind).toBe('extra');
    expect(v.confidence).toBe('low');
  });

  it('counts quantities instead of blaming shared words', () => {
    expect(read('Can we add a pricing page too?').reason).toBe('Your scope includes 5 pages. This goes beyond that.');
    expect(read('Could we see a few more concepts?', project('brand')).reason).toContain('3 initial logo concepts');
    expect(read('Can we get the logo as a GIF animation?', project('brand')).reason).toContain('Animated logo versions');
  });

  it('reads comparatives and visual tweaks as revisions, without false alarms', () => {
    const headline = read('Could the headline be a bit bigger?');
    expect(headline.kind).toBe('revision');
    expect(headline.reason).not.toContain('Copywriting');
    expect(read('Can the buttons be rounder?').kind).toBe('revision');
  });

  it('spots things that have stopped working', () => {
    expect(read('The contact form isn’t sending on my phone').confidence).toBe('high');
    expect(read('The audio cuts out at 1:20', project('video')).kind).toBe('included');
  });

  it('knows a project with zero revisions', () => {
    const v = read('Can you change the font?', project('website', 0));
    expect(v.kind).toBe('extra');
    expect(v.reason).toContain('no revision rounds');
  });
});

describe('titleFrom', () => {
  it('strips pleasantries and filler', () => {
    expect(titleFrom('Hey Sam! Could you also add a pricing page too?')).toBe('Add a pricing page');
    expect(titleFrom('Quick one: swap the footer icons for the outline style?')).toBe('Swap the footer icons for the outline style');
    expect(titleFrom('Would it be possible to get a vertical version? 🙏')).toBe('Get a vertical version');
  });

  it('takes the sentence that carries the request', () => {
    expect(titleFrom('Love it so far. Can we make the logo bigger?')).toBe('Make the logo bigger');
    expect(titleFrom('Swap the hero photo for the team shot.')).toBe('Swap the hero photo for the team shot');
  });

  it('never returns an empty title', () => {
    expect(titleFrom('?!')).toBe('Client request');
  });
});
