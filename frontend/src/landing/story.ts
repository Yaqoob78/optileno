import { addDays, diffDays, todayISO, weekday, type ISODate } from '../lib/dates';
import { buildPlan, evaluateOffer, type OfferResult, type Plan, type Project, type WorkSettings } from '../lib/engine';

/* The landing film runs on the real planning engine. Every block the visitor
   sees is an allocation returned by buildPlan(); every verdict comes from
   evaluateOffer(). Change the engine and the film changes with it. */

export const DAYS = 14;

export const COLORS = {
  sage: '#72b08e',
  sky: '#6fa0d8',
  lavender: '#9d8ad6',
  amber: '#f2ae34',
  /** Late is always the same unmistakable red, whoever's work it is. */
  late: '#e0392a',
  offerLate: '#e0392a',
};

export const SETTINGS: WorkSettings = { hoursByWeekday: [0, 5, 5, 5, 5, 5, 0], timeOff: {} };

export interface StoryProject {
  id: string;
  title: string;
  client: string;
  color: string;
  hours: number;
  dueDay: number;
}

export const PROJECTS: StoryProject[] = [
  { id: 'deck', title: 'Pitch deck', client: 'Northwind', color: COLORS.sage, hours: 6, dueDay: 2 },
  { id: 'landing', title: 'Landing page', client: 'Acme', color: COLORS.sky, hours: 14, dueDay: 4 },
  { id: 'video', title: 'Launch video', client: 'Lumen', color: COLORS.lavender, hours: 18, dueDay: 10 },
];

export const OFFER = { id: 'offer', title: 'Pricing page', client: 'Orbit', hours: 12, dueDay: 4 };

export type Tone = 'base' | 'offer' | 'late' | 'offerLate';

export interface Segment {
  key: string;
  projectId: string;
  day: number;
  /** Hours already stacked below this segment on its day. */
  bottom: number;
  hours: number;
  tone: Tone;
  color: string;
}

export interface Layout {
  segments: Segment[];
  /** Deadline rings around a day's plinth. */
  rings: { day: number; color: string }[];
  /** Column of light on the day you can promise. */
  beamDay: number | null;
  /** The request hovering above the week before it's placed. */
  floatOffer: { day: number; hours: number } | null;
}

/** The film always starts on a Monday: the coming one, or today if it's Monday. */
export function storyStart(today: ISODate = todayISO()): ISODate {
  const wd = weekday(today);
  return wd === 1 ? today : addDays(today, (8 - wd) % 7);
}

function baseProjects(start: ISODate): Project[] {
  return PROJECTS.map((p, i) => ({
    id: p.id,
    clientId: null,
    title: p.title,
    hoursLeft: p.hours,
    deadline: addDays(start, p.dueDay),
    createdAt: i + 1,
  }));
}

function offerProject(hours: number, deadline: ISODate): Project {
  return { id: OFFER.id, clientId: null, title: OFFER.title, hoursLeft: hours, deadline, createdAt: Number.MAX_SAFE_INTEGER };
}

function toLayout(plan: Plan, start: ISODate, dueDays: Record<string, number>): Layout {
  const colorOf = Object.fromEntries(PROJECTS.map((p) => [p.id, p.color]));
  const segments: Segment[] = [];
  for (let d = 0; d < DAYS; d++) {
    const day = plan.days.find((x) => x.date === addDays(start, d));
    if (!day) continue;
    let bottom = 0;
    for (const a of day.allocations) {
      const isOffer = a.projectId === OFFER.id;
      const late = d > (dueDays[a.projectId] ?? Infinity);
      segments.push({
        key: `${a.projectId}@${d}`,
        projectId: a.projectId,
        day: d,
        bottom,
        hours: a.hours,
        tone: isOffer ? (late ? 'offerLate' : 'offer') : late ? 'late' : 'base',
        color: isOffer ? (late ? COLORS.offerLate : COLORS.amber) : late ? COLORS.late : colorOf[a.projectId],
      });
      bottom += a.hours;
    }
  }
  return { segments, rings: [], beamDay: null, floatOffer: null };
}

const baseDue = () => Object.fromEntries(PROJECTS.map((p) => [p.id, p.dueDay]));

export interface Story {
  start: ISODate;
  base: Layout;
  ask: Layout;
  truth: Layout;
  answer: Layout;
  result: OfferResult;
  safeDay: number | null;
}

export function buildStory(start: ISODate = storyStart()): Story {
  const projects = baseProjects(start);
  const input = { projects, settings: SETTINGS, today: start };
  const base = toLayout(buildPlan(input), start, baseDue());

  const askedDeadline = addDays(start, OFFER.dueDay);
  const result = evaluateOffer(input, { hours: OFFER.hours, deadline: askedDeadline })!;

  const truthPlan = buildPlan({ ...input, projects: [...projects, offerProject(OFFER.hours, askedDeadline)] });
  const truth = toLayout(truthPlan, start, { ...baseDue(), [OFFER.id]: OFFER.dueDay });
  truth.rings = [
    { day: OFFER.dueDay, color: COLORS.amber },
    { day: PROJECTS[2].dueDay, color: COLORS.lavender },
  ];

  const safeDay = result.safeDate ? diffDays(start, result.safeDate) : null;
  const answerPlan = result.safeDate
    ? buildPlan({ ...input, projects: [...projects, offerProject(OFFER.hours, result.safeDate)] })
    : buildPlan(input);
  const answer = toLayout(answerPlan, start, { ...baseDue(), [OFFER.id]: safeDay ?? DAYS });
  answer.beamDay = safeDay !== null && safeDay < DAYS ? safeDay : null;

  return {
    start,
    base,
    ask: { ...base, rings: [{ day: OFFER.dueDay, color: COLORS.amber }], floatOffer: { day: OFFER.dueDay, hours: OFFER.hours } },
    truth,
    answer,
    result,
    safeDay,
  };
}

/** The visitor's own what-if, laid out exactly as the app would plan it. */
export function tryLayout(start: ISODate, hours: number, dueDay: number): { layout: Layout; result: OfferResult } {
  const projects = baseProjects(start);
  const input = { projects, settings: SETTINGS, today: start };
  const deadline = addDays(start, dueDay);
  const result = evaluateOffer(input, { hours, deadline })!;
  const plan = buildPlan({ ...input, projects: [...projects, offerProject(hours, deadline)] });
  const layout = toLayout(plan, start, { ...baseDue(), [OFFER.id]: dueDay });
  layout.rings = [{ day: dueDay, color: COLORS.amber }];
  if (result.verdict === 'no') {
    const safe = result.safeDate ? diffDays(start, result.safeDate) : null;
    layout.beamDay = safe !== null && safe < DAYS ? safe : null;
  } else if (result.offer.finish) {
    layout.beamDay = diffDays(start, result.offer.finish);
  }
  return { layout, result };
}
