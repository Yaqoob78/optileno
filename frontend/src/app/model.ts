import { useMemo } from 'react';
import { diffDays, formatDay, formatRelative, weekday, type ISODate } from '../lib/dates';
import { buildPlan, formatHours, isActive, summarize, type Forecast, type OfferResult, type Plan, type Project, type Summary } from '../lib/engine';
import { loggedOn, type AppState } from '../lib/store';

export interface PlanView {
  plan: Plan;
  summary: Summary;
  loggedToday: number;
  active: Project[];
  byId: Map<string, Project>;
}

export function usePlan(state: AppState, today: ISODate): PlanView {
  return useMemo(() => {
    const loggedToday = loggedOn(state, today);
    const plan = buildPlan({ projects: state.projects, settings: state.settings, today, loggedToday });
    const active = state.projects
      .filter(isActive)
      .sort((a, b) => (a.deadline === b.deadline ? a.createdAt - b.createdAt : a.deadline < b.deadline ? -1 : 1));
    return {
      plan,
      summary: summarize(plan, state.projects),
      loggedToday,
      active,
      byId: new Map(state.projects.map((p) => [p.id, p])),
    };
  }, [state, today]);
}

/** "today", "tomorrow", "by Friday", "by Oct 17" */
export function byWhen(date: ISODate, today: ISODate): string {
  const n = diffDays(today, date);
  if (n <= 0) return 'today';
  if (n === 1) return 'tomorrow';
  if (n < 7) return `by ${formatRelative(date, today)}`;
  return `by ${formatDay(date)}`;
}

export type Tone = 'neutral' | 'ok' | 'tight' | 'risk';

/** "no buffer" reads better than "0h of buffer". */
export function bufferText(hours: number): string {
  return hours <= 0.01 ? 'no buffer' : `${formatHours(hours)} of buffer`;
}

export interface Headline {
  title: string;
  detail: string;
  tone: Tone;
}

export function headline(view: PlanView, today: ISODate, clientName: (p: Project) => string | undefined): Headline {
  const { summary, active, byId } = view;
  if (!active.length) {
    return {
      title: 'Nothing booked yet.',
      detail: "Add what you're working on. Optileno will show you what fits — and what doesn't.",
      tone: 'neutral',
    };
  }

  if (summary.atRisk.length) {
    const first = byId.get(summary.atRisk[0].projectId)!;
    const f = summary.atRisk[0];
    if (summary.atRisk.length > 1) {
      return {
        title: `${summary.atRisk.length} deadlines will slip.`,
        detail: `You're ${formatHours(summary.totalShort)} short in total. Start with ${first.title}, due ${formatRelative(first.deadline, today)}.`,
        tone: 'risk',
      };
    }
    if (f.overdue) {
      const who = clientName(first);
      return {
        title: `${first.title} is overdue.`,
        detail: `${formatHours(first.hoursLeft)} still to do. Finish it first${who ? `, or agree a new date with ${who}` : ''}.`,
        tone: 'risk',
      };
    }
    return {
      title: `${first.title} won't be done ${byWhen(first.deadline, today)}.`,
      detail: `You're ${formatHours(f.hoursShort)} short. Agree a new date or trim scope now — not the night before.`,
      tone: 'risk',
    };
  }

  if (summary.tight.length) {
    const f = summary.tight[0];
    const p = byId.get(f.projectId)!;
    return {
      title: 'On time — but tight.',
      detail: `${p.title} has ${f.bufferHours <= 0.01 ? 'no buffer' : `only ${bufferText(f.bufferHours)}`} before ${formatRelative(p.deadline, today)}. One slow day and it slips.`,
      tone: 'tight',
    };
  }

  const open = summary.openHours14;
  return {
    title: "You're on track.",
    detail:
      open > 0
        ? `Every deadline lands on time. You have ${formatHours(open)} open in the next two weeks.`
        : 'Every deadline lands on time — but the next two weeks are fully booked.',
    tone: 'ok',
  };
}

export function statusLine(f: Forecast, p: Project, today: ISODate): { text: string; tone: Tone } {
  if (f.overdue) return { text: `Overdue · ${formatHours(p.hoursLeft)} left`, tone: 'risk' };
  if (f.risk === 'at-risk') {
    return {
      text: f.finish ? `Short ${formatHours(f.hoursShort)} · lands ${formatRelative(f.finish, today)}` : `Short ${formatHours(f.hoursShort)}`,
      tone: 'risk',
    };
  }
  if (f.risk === 'tight') return { text: `Tight · ${f.bufferHours <= 0.01 ? 'no' : formatHours(f.bufferHours)} buffer`, tone: 'tight' };
  return {
    text: `Done ${f.finish ? byWhen(f.finish, today) : ''} · ${formatHours(f.bufferHours)} buffer`,
    tone: 'ok',
  };
}

/* ─── Offer copy ─── */

export function offerHeadline(r: OfferResult, deadline: ISODate, today: ISODate): Headline {
  if (r.verdict === 'yes') {
    return {
      title: 'Yes — it fits.',
      detail: `It lands ${r.offer.finish ? byWhen(r.offer.finish, today) : byWhen(deadline, today)} with ${bufferText(r.offer.bufferHours)}. Nothing else slips.`,
      tone: 'ok',
    };
  }
  if (r.verdict === 'tight') {
    return {
      title: 'Yes, but it’s tight.',
      detail:
        r.offer.risk === 'tight'
          ? `It fits with ${r.offer.bufferHours <= 0.01 ? 'no buffer at all' : `only ${bufferText(r.offer.bufferHours)}`}. Keep the scope firm.`
          : 'It fits, but it eats the safety margin on other work.',
      tone: 'tight',
    };
  }
  return {
    title: `Not ${byWhen(deadline, today)}.`,
    detail: `To say yes as asked you'd need ${formatHours(r.hoursNeeded)} more before then.`,
    tone: 'risk',
  };
}

export function replyDraft(r: OfferResult, deadline: ISODate, contact: string): string {
  const hi = contact.trim() ? `Hi ${contact.trim()},` : 'Hi,';
  if (r.verdict !== 'no') {
    return `${hi}\n\nThanks for thinking of me! I'd be glad to take this on — I can deliver by ${formatDay(deadline)}.\n\nBest,`;
  }
  if (r.safeDate) {
    return `${hi}\n\nThanks for thinking of me — I'd love to help. My schedule is committed until then, so the earliest I can deliver this properly is ${formatDay(r.safeDate)}. Would that work for you?\n\nBest,`;
  }
  return `${hi}\n\nThanks for thinking of me! I'm fully booked for the foreseeable future, so I have to pass on this one — but I'd love to be considered for future work.\n\nBest,`;
}

export const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
/** Display order: Monday first. */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

export function isWeekend(date: ISODate): boolean {
  const d = weekday(date);
  return d === 0 || d === 6;
}
