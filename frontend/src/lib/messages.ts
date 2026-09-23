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
