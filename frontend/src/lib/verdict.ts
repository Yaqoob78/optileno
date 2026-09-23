import type { Project, RequestItem } from './model';
import { roundsUsed } from './ledger';
import { templateById } from './templates';

/* Reads a client request against the project's scope and suggests how to
   treat it. Plain, explainable rules (no AI, nothing leaves the device), and
   it always says *why*, so the freelancer stays the one who decides. */

export type Confidence = 'high' | 'medium' | 'low';

export interface Verdict {
  kind: 'included' | 'revision' | 'extra';
  confidence: Confidence;
  reason: string;
  /** For revisions: the round this belongs to. */
  round: number | null;
  /** True when the round is one already in progress (feedback arriving in pieces). */
  sameRound: boolean;
  /** Suggested hours of work if this becomes an extra. */
  hours: number;
  /** A revision that became an extra because the included rounds ran out. */
  overRounds: boolean;
}

const STOP = new Set(
  `a an the to for of and or in on at by with from into onto we you i me my our your us it its this that these those
   can could would will should shall may might please just be is are was were been get got do does did have has had
   some any bit little quick quickly one so too as well like maybe think want need needs if there here what how
   also really very lot lots thing things stuff all up out off them they their he she him her hey hi hello thanks
   thank love great looks look good nice now then still actually basically about around`.split(/\s+/),
);

/** Words that describe quantity or status, not a subject — never used for matching. */
const WEAK = new Set(
  `additional extra new more beyond agreed other not spec initial final basic two three four five six work
   version versions each per within up connected launch ready`.split(/\s+/),
);

/** Words that mean the same subject, so "write the About copy" matches "Copywriting". */
const GROUPS: string[][] = [
  ['copy', 'copywriting', 'write', 'writing', 'written', 'wording', 'words', 'text'],
  ['page', 'pages', 'subpage'],
  ['stock', 'photo', 'photos', 'photography', 'image', 'images', 'imagery', 'footage', 'illustration', 'illustrations'],
  ['hosting', 'host', 'domain', 'dns', 'server'],
  ['store', 'shop', 'ecommerce', 'e-commerce', 'checkout', 'cart', 'payment', 'payments', 'stripe'],
  ['maintenance', 'maintain', 'ongoing', 'retainer'],
  ['seo', 'keyword', 'keywords', 'ranking', 'rankings'],
  ['print', 'printing', 'stationery', 'business card', 'business cards', 'letterhead', 'flyer', 'flyers', 'poster', 'brochure', 'merch', 'packaging', 'signage'],
  ['social', 'instagram', 'linkedin', 'twitter', 'facebook', 'tiktok', 'stories', 'carousel', 'thumbnail', 'thumbnails'],
  ['vertical', '9:16', 'square', '1:1', '4:5', 'reel', 'reels', 'shorts', 'portrait'],
  ['cutdown', 'cutdowns', 'cut-down', 'teaser', 'teasers', 'trailer', 'clip', 'clips', 'highlight', 'highlights'],
  ['animation', 'animations', 'animate', 'animated', 'motion', 'gif', 'lottie'],
  ['script', 'scripts', 'scriptwriting', 'storyboard'],
  ['voiceover', 'voice-over', 'voice over', 'narration', 'narrator'],
  ['concept', 'concepts', 'option', 'options', 'direction', 'directions', 'alternative', 'alternatives', 'variation', 'variations'],
  ['trademark', 'registration'],
  ['integration', 'integrations', 'integrate', 'api', 'zapier', 'crm', 'hubspot', 'salesforce', 'webhook', 'webhooks'],
  ['migration', 'migrate', 'import'],
  ['a/b', 'variant', 'variants', 'split test'],
  ['ad', 'ads', 'advert', 'adverts', 'banner', 'banners', 'creatives'],
  ['translation', 'translate', 'translated', 'language', 'languages', 'localization', 'localize', 'spanish', 'french', 'german', 'hindi', 'arabic'],
  ['publish', 'publishing', 'upload', 'uploading', 'cms', 'wordpress', 'formatting'],
  ['article', 'articles', 'blog', 'post', 'posts'],
  ['feature', 'features', 'functionality'],
];

const STRONG_ADD =
  /\b(another|additional|extra|add (an?|another|some) (?!bit\b|little\b|touch\b|tad\b|few\b|more\b)|one more|a few more|couple (of )?more|second|third|more (pages?|options?|concepts?|versions?|articles?|sections?|variations?|directions?|cuts?|posts?)|(a|some|an?other) new|new (page|section|feature|version|screen|flow|logo|concept|article|video)|(a|an|another) (\w+ )?version|create|build|design (a|an|another|our|some|the)|write|draft|put together|set up|shoot)\b/;
const WEAK_ADD = /\b(add|adding|also|plus|expand|extend|integrate|connect (it )?(to|with)|include)\b/;
const REVISION =
  /\b(change|changes|tweak|tweaks|adjust|adjustments?|revise|revision|revisions|fix|update|move|swap|replace|bigger|smaller|larger|darker|lighter|bolder|thinner|colou?rs?|fonts?|try|instead|feedback|edit|edits|shorten|trim|align|alignment|spacing|padding|tone|rephrase|reword|rewrite|resize|crop|remove|delete|hide|less|slightly|a bit|tighten|brighter|warmer|cooler|faster|slower|later|earlier|sooner|louder|quieter|softer|shorter|longer|tighter|punchier|higher|lower|wider|narrower|thicker|cleaner|simpler|clearer|stronger|heavier|rounder|sharper|more|swapped|changed|moved|replaced|updated|tweaked|adjusted|edited|removed|resized|cropped|trimmed)\b/;
/** "Can the buttons be rounder?", "make it feel a little warmer" */
const COMPARATIVE = /\b(be|look|feel|seem|sound|make (it|them|this|that))\s+(a (bit|little|touch|tad) |slightly |much |even )?(more \w+|less \w+|[a-z]{3,}er)\b/;
const FIX =
  /\b(bugs?|broken|not working|doesn'?t work|isn'?t working|won'?t (load|open|send|work|play)|(not|isn'?t|aren'?t|stopped) (loading|sending|showing|playing|working|submitting)|errors?|crash(es|ing)?|typos?|404|glitch(es|y)?|misspell(ed|ing)?|cuts? out|cutting out|out of sync|stutter(s|ing)?|blurry|pixelated)\b/;
const STATUS = /\b(any updates?|status|eta|when will|how'?s it (going|coming)|how is it (going|coming)|still on track|on track|timeline)\b/;

function normalize(text: string): string {
  return text.toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim();
}

export function stem(word: string): string {
  if (word.length > 4 && word.endsWith('ies')) return `${word.slice(0, -3)}y`;
  if (word.length > 5 && word.endsWith('ing')) return word.slice(0, -3);
  if (word.length > 4 && word.endsWith('ed')) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
  return word;
}

function sameWord(a: string, b: string): boolean {
  if (a === b) return true;
  const short = a.length < b.length ? a : b;
  const long = a.length < b.length ? b : a;
  return short.length >= 4 && long.length - short.length <= 1 && long.startsWith(short);
}

function tokens(text: string): string[] {
  return normalize(text)
    .split(/[^a-z0-9:/'-]+/)
    .map((w) => w.replace(/^['-]+|['-]+$/g, ''))
    .filter((w) => w.length >= 2 && !STOP.has(w));
}

function keywordsOf(text: string): string[] {
  const out = new Set<string>();
  const norm = normalize(text);
  for (const t of tokens(text)) {
    if (WEAK.has(t) || /^\d+$/.test(t) || t.length < 3) continue;
    out.add(stem(t));
  }
  for (const group of GROUPS) {
    if (group.some((g) => containsPhrase(norm, g))) group.forEach((g) => out.add(g.includes(' ') ? g : stem(g)));
  }
  return [...out];
}

function containsPhrase(norm: string, phrase: string): boolean {
  if (phrase.includes(' ') || /[:/]/.test(phrase)) return norm.includes(phrase);
  return new RegExp(`(^|[^a-z0-9])${phrase.replace(/[-]/g, '\\-')}($|[^a-z0-9])`).test(norm);
}

/** How strongly `requestText` refers to the subject described by `keys`. */
function overlap(requestNorm: string, requestStems: string[], keys: string[]): number {
  let score = 0;
  for (const k of keys) {
    if (k.includes(' ') || /[:/]/.test(k)) {
      if (requestNorm.includes(k)) score += 2;
    } else if (requestStems.some((s) => sameWord(s, k))) {
      score += 1;
    }
  }
  return score;
}

/** `ignore` drops words that can't tell subjects apart (e.g. "logo" in a logo project). */
function bestMatch(requestText: string, subjects: string[], ignore: Set<string> = new Set()): { subject: string; score: number } | null {
  const norm = normalize(requestText);
  const stems = tokens(requestText).map(stem);
  let best: { subject: string; score: number } | null = null;
  for (const subject of subjects) {
    const score = overlap(norm, stems, keywordsOf(subject).filter((k) => !ignore.has(k)));
    if (score > 0 && (!best || score > best.score)) best = { subject, score };
  }
  return best;
}

function estimateHours(text: string, project: Project, overRounds: boolean): number {
  const base = templateById(project.template).extraHours;
  if (overRounds) return Math.max(1, base / 2);
  const t = normalize(text);
  if (/\bpages?\b/.test(t)) return Math.max(base, 4);
  if (/\b(concepts?|options?|directions?|articles?)\b/.test(t)) return 3;
  if (/\b(versions?|vertical|square|9:16|1:1|cutdowns?|teasers?|sections?)\b/.test(t)) return 2;
  return base;
}

const ROUND_WINDOW_MS = 36 * 60 * 60 * 1000;

export function quote(s: string): string {
  const short = s.length > 48 ? `${s.slice(0, 46).trimEnd()}…` : s;
  return `“${short}”`;
}

export function suggest(text: string, project: Project, projectItems: RequestItem[], now = Date.now()): Verdict {
  const norm = normalize(text);
  const isStatus = norm.search(STATUS) >= 0;
  const work = norm.replace(STATUS, ' ');
  const strongAdd = STRONG_ADD.test(work);
  const rev = REVISION.test(work) || COMPARATIVE.test(work);
  // "Also, could the button be darker?" is a tweak, not an addition
  const add = strongAdd || (WEAK_ADD.test(work) && !rev);
  const titles = project.deliverables.map((d) => d.title);
  // Words the deliverables use ("pages", "logo") describe the project itself, so they can't
  // be what makes a request excluded. "Additional pages" is caught by counting instead.
  const shared = new Set(titles.flatMap((t) => keywordsOf(t)));
  const excluded = bestMatch(text, project.excluded, shared);
  const deliverable = bestMatch(text, titles);

  const result = (kind: Verdict['kind'], confidence: Confidence, reason: string): Verdict => ({
    kind,
    confidence,
    reason,
    round: null,
    sameRound: false,
    hours: estimateHours(text, project, false),
    overRounds: false,
  });

  let v: Verdict;
  if (isStatus && !add && !rev) {
    v = result('included', 'low', 'Sounds like a question, not new work.');
  } else if (FIX.test(norm) && !strongAdd) {
    v = result('included', 'high', 'Fixing something that isn’t working is part of the job.');
  } else if (excluded && (add || !rev)) {
    v = result('extra', add ? 'high' : 'medium', `${quote(excluded.subject)} is listed as not included.`);
  } else if (excluded && rev) {
    v = result('revision', 'medium', `Reads like a change, but it touches ${quote(excluded.subject)}, which isn’t included. Worth a second look.`);
  } else if (add && deliverable) {
    const counted =
      /\b(\d+)\s+((?:[a-z]+\s){0,2}(?:pages?|concepts?|articles?|posts?|screens?|sections?|videos?|options?|designs?|logos?|mockups?|illustrations?|banners?|slides?|emails?|variations?|templates?))\b/i.exec(
        deliverable.subject,
      );
    v = result(
      'extra',
      strongAdd ? 'high' : 'medium',
      counted ? `Your scope includes ${counted[1]} ${counted[2].trim()}. This goes beyond that.` : `Goes beyond ${quote(deliverable.subject)} as scoped.`,
    );
  } else if (add) {
    v = result('extra', strongAdd ? 'high' : 'medium', 'Nothing in your scope covers this.');
  } else if (rev) {
    v = deliverable
      ? result('revision', 'high', `A change to ${quote(deliverable.subject)}.`)
      : result('revision', 'medium', 'Sounds like a change to work you’ve already done.');
  } else if (deliverable) {
    v = result('included', 'medium', `Covered by ${quote(deliverable.subject)}.`);
  } else {
    v = result('extra', 'low', 'Nothing in your scope mentions this. Take a closer look.');
  }

  if (v.kind !== 'revision') return v;

  const used = roundsUsed(projectItems);
  const last = projectItems
    .filter((i) => i.kind === 'revision' && i.round)
    .sort((a, b) => b.createdAt - a.createdAt)[0];
  if (last && now - last.createdAt < ROUND_WINDOW_MS) {
    return { ...v, round: last.round, sameRound: true };
  }
  if (used < project.revisions) return { ...v, round: used + 1 };
  return {
    ...v,
    kind: 'extra',
    confidence: 'high',
    reason:
      project.revisions === 0
        ? 'This project has no revision rounds included.'
        : `All ${project.revisions} included revision ${project.revisions === 1 ? 'round is' : 'rounds are'} used.`,
    overRounds: true,
    hours: estimateHours(text, project, true),
  };
}

const LEADING = [
  /^(hey|hi|hello|hiya|morning|yo)\b[\s,!.]*(\w+[,!.]\s*)?/i,
  /^(quick one|quick question|one more thing|one last thing|last thing|small thing|also|oh and|and|ok|okay|so)\b[\s,:—–-]*/i,
  /^(i was wondering if|would it be possible to|is it possible to|any chance (you|we) could|do you think (you|we) could)\s+/i,
  /^(could|can|would|will)\s+(you|we|u)\s+(please\s+)?(also\s+)?(just\s+)?(quickly\s+)?/i,
  /^(please|also|just|quickly)\s+/i,
];

/** Turns "Hey! Could you also add a pricing page too?" into "Add a pricing page". */
export function titleFrom(text: string): string {
  const strip = (sentence: string) => {
    let t = sentence;
    for (let pass = 0; pass < 3; pass++) {
      for (const re of LEADING) t = t.replace(re, '');
    }
    return t
      .replace(/[\p{Extended_Pictographic}\u200d\ufe0f]/gu, '')
      .replace(/\s*(too|as well|please|pls|thanks|thank you)?\s*[?!.…]+\s*$/i, '')
      .replace(/\s+(too|as well|please|pls)$/i, '')
      .trim();
  };
  const sentences = text
    .replace(/\s+/g, ' ')
    .trim()
    .split(/(?<=[.!?…])\s+/)
    .map((raw) => ({ raw, clean: strip(raw) }))
    .filter((x) => x.clean.replace(/[^a-z]/gi, '').length > 3);
  const ask = sentences.find((x) => /\?\s*\S*$/.test(x.raw) || /\b(can|could|would|please|need|want|let'?s)\b/i.test(x.raw));
  let t = (ask ?? sentences[0])?.clean ?? '';
  if (!t) return 'Client request';
  t = t.charAt(0).toUpperCase() + t.slice(1);
  return t.length > 64 ? `${t.slice(0, 62).trimEnd()}…` : t;
}
