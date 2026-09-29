import { looksLikeAsk } from './verdict';

/* Clients rarely send one request at a time. This pulls the separate asks out
   of a pasted email or chat thread: it drops quoted history, signatures and
   small talk, then splits lists, sentences and "…and also…" into one ask each.
   Plain rules again, so it runs instantly and nothing leaves the device. */

const MAX_ASKS = 12;

/** Where the previous message in a thread starts. Everything below it is history. */
const HISTORY = [
  /^on .{4,200}wrote:?\s*$/i,
  /^-{2,}\s*(original|forwarded) message/i,
  /^_{8,}\s*$/,
  /^sent from my /i,
  /^get outlook for /i,
];
const HEADER = /^(from|to|cc|bcc|sent|date|subject):\s/i;
const SIGNATURE = /^(--|—|–)\s*$/;
const SIGN_OFF =
  /^(thanks|thank you|thanks so much|thank you so much|many thanks|thx|ty|cheers|best|best regards|kind regards|regards|warm regards|warmly|all the best|speak soon|talk soon|ta|xx?)\b[\s,!.]*(\p{L}+[\s.!]*){0,2}$/iu;
const GREETING = /^(hi|hey|hello|dear|hiya|yo|morning|good (morning|afternoon|evening))\b[^.!?]{0,30}[,!.:]?\s*$/i;
const BULLET = /^\s*(?:[-*•·–—]+|\(?\d{1,2}[.):]|\(?[a-h][.)])\s+/;

/** Sentences that only point at the ask next to them ("Can you take a look?"). */
const FOLLOW_UP = new RegExp(
  '^(?:(?:and|so|also|oh and)\\s+)?(?:(?:can|could|would|will)\\s+(?:you|we|u)\\s+(?:please\\s+)?)?(?:' +
    [
      '(?:take|have) a (?:quick )?look(?: at (?:it|this|that|these))?',
      'check (?:it|this|that)(?: out)?',
      'look into (?:it|this|that)',
      'sort (?:it|this|that)(?: out)?',
      '(?:fix|do) (?:it|this|that)',
      'let (?:me|us) know.*',
      'what do you think',
      'thoughts',
      'does (?:that|this) (?:make sense|work)(?: for you)?',
      'is (?:that|this) (?:ok|okay|possible|doable|alright|fine)',
      'would (?:that|this) be (?:ok|okay|possible|doable)',
      'no rush.*',
      'if (?:possible|you can)',
      '(?:thanks|thank you)(?: so much)?(?: in advance)?',
      'when you (?:get|have) a (?:chance|sec|second|minute|moment)',
    ].join('|') +
    ')$',
);

/** Praise and thanks read as small talk unless they also ask for something. */
const PRAISE =
  /^(?:(?:oh|ok|okay|wow|so),?\s+)?(?:thanks|thank you|love|loving|loved|looks|looking|great|nice|awesome|amazing|perfect|brilliant|beautiful|gorgeous|fantastic|well done|good work|great work|(?:i|we|the team|everyone)\s+(?:really\s+)?(?:love|loves|like|likes))\b/i;
const ASKING = /\?|\b(can|could|would|please|pls|need|want|let'?s)\b/i;

function body(text: string): string[] {
  const out: string[] = [];
  for (const raw of text.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trim();
    const started = out.some((l) => l !== '');
    if (HISTORY.some((re) => re.test(line))) {
      if (started) break;
      continue;
    }
    if (HEADER.test(line)) {
      if (started) break;
      continue;
    }
    if (line.startsWith('>')) continue;
    if (SIGNATURE.test(line)) break;
    if (started && SIGN_OFF.test(line)) break;
    if (!started && GREETING.test(line)) continue;
    out.push(line);
  }
  return out;
}

/** Bullets stand alone; wrapped lines of plain text join back into paragraphs. */
function blocks(lines: string[]): string[] {
  const out: string[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) out.push(para.join(' '));
    para = [];
  };
  for (const line of lines) {
    if (!line) {
      flush();
    } else if (BULLET.test(line)) {
      flush();
      out.push(line.replace(BULLET, ''));
    } else {
      para.push(line);
    }
  }
  flush();
  return out;
}

function sentences(block: string): string[] {
  return block
    .split(/(?<=[!?…])\s+|(?<=\.)\s+(?=["“(\p{Lu}\d])/u)
    .flatMap((s) =>
      s.split(
        /\s*;\s+|,\s+(?:and\s+)?also[,:]?\s+|\s+and\s+also\s+|\s+and\s+(?=(?:could|can|would|will)\s+(?:you|we|u)\b)|,?\s+(?:oh\s+)?and\s+(?=(?:one|another)\s+(?:more|last)\s+thing)/i,
      ),
    )
    .map((s) => s.trim())
    .filter(Boolean);
}

/** "One more thing, …" introduces an ask; it isn't asking for "one more" of anything. */
const LEAD_IN =
  /^(?:(?:oh|and|also|plus|so|ok|okay|oh and)[\s,]+)*(?:(?:one|another)\s+(?:more|last|other|final)\s+thing|(?:last|final|small|little|other)\s+thing|quick one|quick question|p\.?\s?s\.?)\s*[,:;—–-]+\s*/i;

function stripLeadIn(sentence: string): string {
  const rest = sentence.replace(LEAD_IN, '');
  return rest === sentence ? sentence : rest.charAt(0).toUpperCase() + rest.slice(1);
}

function isFollowUp(sentence: string): boolean {
  const s = sentence
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[\p{Extended_Pictographic}‍️]/gu, '')
    .replace(/[\s?!.…:)]+$/, '')
    .replace(/^[\s(]+/, '')
    .replace(/\s+/g, ' ');
  return FOLLOW_UP.test(s);
}

/** The separate asks in a message, in the order the client wrote them. */
export function splitAsks(text: string): string[] {
  const asks: string[] = [];
  const seen = new Set<string>();
  for (const block of blocks(body(text))) {
    for (const s of sentences(block).map(stripLeadIn)) {
      if (isFollowUp(s) || !looksLikeAsk(s) || (PRAISE.test(s) && !ASKING.test(s))) continue;
      const key = s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      asks.push(s);
      if (asks.length === MAX_ASKS) return asks;
    }
  }
  return asks;
}
