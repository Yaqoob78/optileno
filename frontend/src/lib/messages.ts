import { addWorkdays, formatLong, type ISODate } from './dates';
import { formatHours, formatMoney, type Currency } from './money';
import type { ItemKind, Tone } from './model';

/* Replies that sound like a person, not a policy. Every draft does three
   things: says yes to the relationship, names the boundary once, and gives
   the client an easy next step. */

export interface DraftInput {
  kind: ItemKind;
  tone: Tone;
  contact: string;
  title: string;
  currency: Currency;
  amount: number;
  hours: number;
  days: number;
  round: number | null;
  roundsIncluded: number;
  overRounds: boolean;
  /** Current delivery date, if the project has one. */
  delivery: ISODate | null;
  fix?: boolean;
  /** Link to the client's scope page (already contains this request). */
  link?: string | null;
  signature: string;
}

function greet(contact: string): string {
  const name = contact.trim().split(/\s+/)[0];
  return name ? `Hi ${name},` : 'Hi,';
}

function sign(signature: string): string {
  const name = signature.trim().split(/\s+/)[0];
  return name ? `\n\n${name}` : '';
}

function moveLine(delivery: ISODate | null, days: number): string {
  if (days <= 0) return 'no change to the delivery date';
  if (delivery) return `moves delivery from ${formatLong(delivery)} to ${formatLong(addWorkdays(delivery, days))}`;
  return `adds about ${days} working ${days === 1 ? 'day' : 'days'}`;
}

function approveLine(link: string | null | undefined, warm: boolean): string {
  if (link) return warm ? `If that works for you, you can approve it here and I’ll get started:\n${link}` : `Approve here: ${link}`;
  return warm ? 'If that works for you, just reply “approved” and I’ll get started.' : 'Reply “approved” and I’ll start.';
}

export function draftReply(d: DraftInput): string {
  const warm = d.tone === 'warm';
  const price = formatMoney(d.amount, d.currency);

  if (d.kind === 'included') {
    if (d.fix) {
      return warm
        ? `${greet(d.contact)}\n\nThanks for flagging that. It’s on me to fix, so I’m sorting it now and will let you know once it’s done.${sign(d.signature)}`
        : `Thanks for flagging. Fixing it now, no charge.${sign(d.signature)}`;
    }
    return warm
      ? `${greet(d.contact)}\n\nHappy to. That’s part of what we agreed, so it’s all covered. I’ll include it in the next update.${sign(d.signature)}`
      : `On it. That’s included.${sign(d.signature)}`;
  }

  if (d.kind === 'revision') {
    const r = d.round ?? 1;
    const n = d.roundsIncluded;
    if (!warm) return `Got it. That’s part of revision round ${r} of ${n}.${sign(d.signature)}`;
    const nudge =
      r >= n
        ? `Quick heads-up: this is the last revision round included in the project, so if anything else comes to mind, send it over now and I’ll fold it all in together.`
        : `That leaves ${n - r} more ${n - r === 1 ? 'round' : 'rounds'} after this one, so feel free to batch any other notes into it.`;
    return `${greet(d.contact)}\n\nSounds good. I’ll fold this into revision round ${r} of ${n}. ${nudge}${sign(d.signature)}`;
  }

  if (d.kind === 'gift') {
    return warm
      ? `${greet(d.contact)}\n\nThis one’s on me. It’s a small addition, so I’ve included it at no charge (normally ${price}). Anything else beyond the original scope I’ll quote separately, so we’re always on the same page.${sign(d.signature)}`
      : `Done. No charge for this one (normally ${price}). Future additions I’ll quote separately.${sign(d.signature)}`;
  }

  // Extra
  if (d.overRounds) {
    return warm
      ? `${greet(d.contact)}\n\nHappy to keep refining. We’ve used the ${d.roundsIncluded} revision ${d.roundsIncluded === 1 ? 'round' : 'rounds'} included in the project, so another round would be ${price} (about ${formatHours(d.hours)}) and ${moveLine(d.delivery, d.days)}.\n\n${approveLine(d.link, true)}${sign(d.signature)}`
      : `We’ve used the included revision rounds. Another round: ${price}, ${moveLine(d.delivery, d.days)}. ${approveLine(d.link, false)}${sign(d.signature)}`;
  }
  return warm
    ? `${greet(d.contact)}\n\nLove this idea. It’s outside what we scoped, so here’s what it would take:\n\n• ${d.title}\n• ${price}, about ${formatHours(d.hours)} of work\n• ${capitalize(moveLine(d.delivery, d.days))}\n\nHappy to talk it through if you’d rather swap it for something already in the plan. ${approveLine(d.link, true)}${sign(d.signature)}`
    : `That’s outside our scope: ${d.title}, ${price}, ${moveLine(d.delivery, d.days)}. ${approveLine(d.link, false)}${sign(d.signature)}`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/* ─── One reply for a message that asked for several things ─── */

export interface BatchLine {
  title: string;
  amount: number;
}

export interface BatchDraftInput {
  tone: Tone;
  contact: string;
  currency: Currency;
  included: string[];
  /** Revisions grouped by round; rounds beyond `roundsIncluded` are the paid extra round. */
  revisions: { round: number; titles: string[] }[];
  roundsIncluded: number;
  extras: BatchLine[];
  gifts: BatchLine[];
  /** Working days the extras add, and the delivery date before them. */
  days: number;
  delivery: ISODate | null;
  /** "CO-002", when the extras went into a change order. */
  changeOrder: string | null;
  link?: string | null;
  signature: string;
}

export function draftBatchReply(d: BatchDraftInput): string {
  const warm = d.tone === 'warm';
  const money = (n: number) => formatMoney(n, d.currency);
  const bullets = (xs: string[]) => xs.map((x) => `• ${x}`).join('\n');
  const parts: string[] = [];

  if (d.included.length) {
    parts.push(warm ? `Included, so I’m on it:\n${bullets(d.included)}` : `Included:\n${bullets(d.included)}`);
  }
  for (const r of d.revisions) {
    if (r.round > d.roundsIncluded) {
      parts.push(warm ? `These go into the extra revision round (in the change order below):\n${bullets(r.titles)}` : `Extra round:\n${bullets(r.titles)}`);
      continue;
    }
    const last = r.round >= d.roundsIncluded;
    const head = `Revision round ${r.round} of ${d.roundsIncluded}`;
    parts.push(
      warm
        ? `${head}${last ? ' (the last one included, so send anything else now and I’ll fold it in)' : ''}:\n${bullets(r.titles)}`
        : `${head}:\n${bullets(r.titles)}`,
    );
  }
  if (d.gifts.length) {
    const worth = d.gifts.reduce((s, g) => s + g.amount, 0);
    parts.push(warm ? `On me, no charge (normally ${money(worth)}):\n${bullets(d.gifts.map((g) => g.title))}` : `No charge:\n${bullets(d.gifts.map((g) => g.title))}`);
  }
  if (d.extras.length) {
    const total = d.extras.reduce((s, e) => s + e.amount, 0);
    const where = d.changeOrder ? ` in change order ${d.changeOrder}` : '';
    const list = bullets(d.extras.map((e) => `${e.title} · ${money(e.amount)}`));
    const sum = d.extras.length > 1 ? `Together ${money(total)}, and it ${moveLine(d.delivery, d.days)}.` : `It ${moveLine(d.delivery, d.days)}.`;
    const next = d.link
      ? warm
        ? `Tick the ones you’d like and approve them here:\n${d.link}`
        : `Approve here: ${d.link}`
      : warm
        ? 'Just reply with the ones you’d like and I’ll get started.'
        : 'Reply with the ones you want.';
    parts.push(warm ? `Outside what we scoped, so I’ve priced them${where}:\n${list}\n${sum}\n\n${next}` : `Extra${where}:\n${list}\n${sum} ${next}`);
  }

  if (!warm) return `${parts.join('\n\n')}${sign(d.signature)}`;
  return `${greet(d.contact)}\n\nThanks for these. Here’s how each one fits with what we agreed.\n\n${parts.join('\n\n')}${sign(d.signature)}`;
}
