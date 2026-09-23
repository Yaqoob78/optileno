import { addWorkdays, todayISO } from './dates';
import { niceRound } from './money';
import type { Profile, Project, RequestItem } from './model';
import { templateById, type TemplateId } from './templates';

/* A believable workspace for exploring: three projects mid-flight, priced
   from the visitor's own rate so the numbers feel like theirs. */

const HOUR = 3_600_000;

function id(prefix: string, n: number) {
  return `sample-${prefix}-${n}`;
}

function project(key: string, template: TemplateId, client: string, contact: string, name: string, fee: number, deadlineInDays: number, doneCount: number, now: number): Project {
  const t = templateById(template);
  return {
    id: `sample-${key}`,
    client,
    contact,
    name,
    template,
    fee,
    deadline: addWorkdays(todayISO(new Date(now)), deadlineInDays),
    deliverables: t.deliverables.map((title, i) => ({ id: `${key}-d${i}`, title, done: i < doneCount })),
    excluded: [...t.excluded],
    revisions: t.revisions,
    createdAt: now - 12 * 24 * HOUR,
    archivedAt: null,
  };
}

export function buildSample(profile: Profile, now = Date.now()): { projects: Project[]; items: RequestItem[] } {
  const rate = profile.rate > 0 ? profile.rate : 75;
  const price = (h: number) => niceRound(h * rate);
  const days = (h: number) => Math.max(1, Math.ceil(h / (profile.hoursPerDay || 6)));

  const web = project('web', 'website', 'Northwind Coffee', 'Maya', 'Website redesign', niceRound(rate * 64), 14, 2, now);
  const vid = project('vid', 'video', 'Lumen Labs', 'Dev', 'Product launch video', niceRound(rate * 28), 6, 3, now);
  const brand = project('brand', 'brand', 'Fernwood Studio', 'Aisha', 'Logo & identity', niceRound(rate * 36), 3, 4, now);

  let n = 0;
  const item = (p: Project, hoursAgo: number, text: string, title: string, rest: Partial<RequestItem>): RequestItem => {
    n += 1;
    const createdAt = now - hoursAgo * HOUR;
    return {
      id: id('i', n),
      projectId: p.id,
      text,
      title,
      kind: 'included',
      hours: 0,
      amount: 0,
      days: 0,
      status: null,
      round: null,
      createdAt,
      decidedAt: createdAt,
      ...rest,
    };
  };

  const items: RequestItem[] = [
    item(web, 120, 'Could the hero headline be a bit bigger? It feels a little timid.', 'Make the hero headline bigger', { kind: 'revision', round: 1, hours: 0.5 }),
    item(web, 96, 'The contact form isn’t sending on my phone 😬', 'Contact form not sending on mobile', { kind: 'included', hours: 1 }),
    item(web, 70, 'Can we add a pricing page too? Nothing fancy.', 'Add a pricing page', { kind: 'extra', status: 'approved', hours: 4, amount: price(4), days: days(4), decidedAt: now - 60 * HOUR }),
    item(web, 26, 'Quick one: swap the footer icons for the outline style?', 'Swap the footer icons for the outline style', { kind: 'gift', hours: 0.75, amount: price(0.75) }),
    item(web, 3, 'Could you write the copy for the About page? We’re a bit stuck on it.', 'Write the copy for the About page', { kind: 'extra', status: 'proposed', hours: 3, amount: price(3), days: days(3), decidedAt: null }),

    item(vid, 150, 'Can the music come in a little later, around 0:12?', 'Bring the music in later, around 0:12', { kind: 'revision', round: 1, hours: 0.5 }),
    item(vid, 80, 'We’d love a vertical 9:16 version for Reels as well.', 'A vertical 9:16 version for Reels', { kind: 'extra', status: 'approved', hours: 2, amount: price(2), days: days(2), decidedAt: now - 72 * HOUR }),
    item(vid, 30, 'Trim the intro by a couple of seconds?', 'Trim the intro by a couple of seconds', { kind: 'revision', round: 2, hours: 0.5 }),

    item(brand, 200, 'Love concept B! Could the icon be a touch bolder?', 'Make the icon a touch bolder', { kind: 'revision', round: 1, hours: 1 }),
    item(brand, 110, 'Can we try the wordmark in a warmer green?', 'Try the wordmark in a warmer green', { kind: 'revision', round: 2, hours: 1 }),
    item(brand, 40, 'Could you also design business cards to match?', 'Design business cards to match', { kind: 'extra', status: 'approved', hours: 3, amount: price(3), days: days(3), decidedAt: now - 30 * HOUR }),
    item(brand, 5, 'One more round on the spacing between the letters?', 'Another round on letter spacing', { kind: 'extra', status: 'proposed', hours: 1.5, amount: price(1.5), days: 1, decidedAt: null }),
  ];

  return { projects: [web, vid, brand], items };
}
