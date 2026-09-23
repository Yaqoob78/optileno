import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, Gift, RotateCcw } from 'lucide-react';
import { CountUp } from '../components/CountUp';
import { Pips } from '../components/Stamp';
import { addWorkdays, formatLong, todayISO } from '../lib/dates';
import { roundsUsed } from '../lib/ledger';
import { draftReply } from '../lib/messages';
import { formatMoney, niceRound } from '../lib/money';
import type { ItemKind, Project, RequestItem } from '../lib/model';
import { templateById } from '../lib/templates';
import { suggest, titleFrom, type Verdict } from '../lib/verdict';
import { scrollToElement } from './scroll';

const RATE = 85;
const HOUR = 3_600_000;

const PROMPTS = [
  'Can we add a pricing page too?',
  'Could the headline be a bit bigger?',
  'Could you write the About page copy?',
  'The form isn’t sending on my phone',
  'Can you set up a little shop for our beans?',
  'Could you make the buttons rounder?',
];

function demoProject(): Project {
  const t = templateById('website');
  return {
    id: 'demo',
    client: 'Northwind Coffee',
    contact: 'Maya',
    name: 'Website redesign',
    template: 'website',
    fee: 4800,
    deadline: addWorkdays(todayISO(), 12),
    deliverables: t.deliverables.map((title, i) => ({ id: `d${i}`, title, done: i < 2 })),
    excluded: t.excluded,
    revisions: 2,
    createdAt: 0,
    archivedAt: null,
  };
}

function seedItems(): RequestItem[] {
  return [
    {
      id: 'seed',
      projectId: 'demo',
      text: 'Could the hero image be warmer?',
      title: 'Warmer hero image',
      kind: 'revision',
      hours: 0,
      amount: 0,
      days: 0,
      status: null,
      round: 1,
      createdAt: Date.now() - 96 * HOUR,
      decidedAt: null,
    },
  ];
}

interface Pending {
  text: string;
  verdict: Verdict;
}

interface Outcome {
  item: RequestItem;
  reply: string;
  overRounds: boolean;
}

export function Demo() {
  const project = useMemo(demoProject, []);
  const [items, setItems] = useState<RequestItem[]>(seedItems);
  const [custom, setCustom] = useState('');
  const [pending, setPending] = useState<Pending | null>(null);
  const [hours, setHours] = useState(2);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const used = roundsUsed(items);
  const recovered = items.filter((i) => i.kind === 'extra').reduce((s, i) => s + i.amount, 0);
  const gifted = items.filter((i) => i.kind === 'gift').reduce((s, i) => s + i.amount, 0);
  const price = niceRound(hours * RATE);
  const days = Math.max(1, Math.ceil(hours / 6));

  const check = (text: string) => {
    const clean = text.trim();
    if (!clean) return;
    const verdict = suggest(clean, project, items);
    setPending({ text: clean, verdict });
    setHours(verdict.hours);
    setOutcome(null);
    revealResult();
  };

  // On small screens the result lands below the fold; bring it up
  const resultRef = useRef<HTMLDivElement>(null);
  const revealResult = () =>
    window.requestAnimationFrame(() => {
      const el = resultRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (r.top > window.innerHeight * 0.55) scrollToElement(el, -96);
    });

  const decide = (kind: ItemKind) => {
    if (!pending) return;
    const v = pending.verdict;
    const item: RequestItem = {
      id: String(Date.now()),
      projectId: 'demo',
      text: pending.text,
      title: titleFrom(pending.text),
      kind,
      hours,
      amount: kind === 'extra' || kind === 'gift' ? price : 0,
      days: kind === 'extra' ? days : 0,
      status: kind === 'extra' ? 'proposed' : null,
      round: kind === 'revision' ? v.round : null,
      createdAt: Date.now() - 48 * HOUR,
      decidedAt: null,
    };
    const reply = draftReply({
      kind,
      tone: 'warm',
      contact: 'Maya',
      title: item.title,
      currency: 'USD',
      amount: item.amount,
      hours: item.hours,
      days: item.days,
      round: item.round,
      roundsIncluded: project.revisions,
      overRounds: v.overRounds && kind === 'extra',
      delivery: project.deadline,
      fix: v.kind === 'included' && v.confidence === 'high',
      link: kind === 'extra' ? 'optileno.com/s#…' : null,
      signature: 'Sam',
    });
    setItems((xs) => [...xs, item]);
    setOutcome({ item, reply, overRounds: v.overRounds });
    setPending(null);
    revealResult();
  };

  const reset = () => {
    setItems(seedItems());
    setPending(null);
    setOutcome(null);
  };

  const v = pending?.verdict;

  return (
    <section id="demo" className="lp-section lp-demo" aria-labelledby="demo-title">
      <div className="lp-container">
        <header className="lp-section-head" data-reveal>
          <p className="eyebrow">Try it · this is the real engine</p>
          <h2 id="demo-title" className="serif lp-h2">
            You’re Maya’s freelancer. <em className="pen">She has a few requests.</em>
          </h2>
          <p className="lp-lede">Pick one, or type your own. Optileno reads it against Maya’s deal, the same way it will for your clients.</p>
        </header>

        <div className="lp-demo-grid" data-reveal>
          <aside className="lp-deal">
            <div className="lp-deal-head">
              <span className="eyebrow">The deal</span>
              <span className="num">{formatMoney(project.fee, 'USD')}</span>
            </div>
            <h3 className="serif lp-deal-title">
              Website redesign <span className="muted">for Northwind Coffee</span>
            </h3>
            <ul className="lp-deal-list">
              {project.deliverables.map((d) => (
                <li key={d.id}>
                  <Check size={13} strokeWidth={2.6} /> {d.title.replace(': Home, About, Services, Work, Contact', '')}
                </li>
              ))}
            </ul>
            <div className="lp-deal-rounds">
              <span>Revision rounds</span>
              <Pips used={used} included={project.revisions} />
              <span className="hint">
                {Math.min(used, 2)} of 2 used
              </span>
            </div>
            <div className="lp-deal-excluded">
              <span className="eyebrow">Not included</span>
              <div>
                {project.excluded.map((x) => (
                  <span key={x}>{x}</span>
                ))}
              </div>
            </div>
            <div className="lp-deal-tally">
              <div>
                <span className="eyebrow">Recovered here</span>
                <span className="num lp-tally-good">
                  <CountUp value={recovered} format={(n) => formatMoney(n, 'USD')} />
                </span>
              </div>
              <div>
                <span className="eyebrow">Gifted</span>
                <span className="num lp-tally-gift">
                  <CountUp value={gifted} format={(n) => formatMoney(n, 'USD')} />
                </span>
              </div>
              {items.length > 1 && (
                <button type="button" className="icon-btn" onClick={reset} aria-label="Reset demo">
                  <RotateCcw size={15} />
                </button>
              )}
            </div>
          </aside>

          <div className="lp-demo-play">
            <div className="lp-prompts" role="group" aria-label="Sample client requests">
              {PROMPTS.map((p) => (
                <button key={p} type="button" className={`lp-prompt${pending?.text === p ? ' on' : ''}`} onClick={() => check(p)}>
                  “{p}”
                </button>
              ))}
            </div>
            <form
              className="lp-demo-input"
              onSubmit={(e) => {
                e.preventDefault();
                check(custom);
              }}
            >
              <input className="input" value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Or type what a client once asked you…" aria-label="Type a client request" />
              <button type="submit" className="btn btn-primary" disabled={!custom.trim()}>
                Check
              </button>
            </form>

            <div className="lp-demo-result" aria-live="polite" ref={resultRef}>
              {!pending && !outcome && (
                <div className="lp-demo-empty">
                  <span className="serif">Pick a request above.</span>
                  <span className="muted">You’ll see Optileno’s read, the price, and the reply it drafts.</span>
                </div>
              )}

              {pending && v && (
                <div className="lp-demo-card" key={pending.text}>
                  <p className="serif lp-demo-quote">“{pending.text}”</p>
                  <div className="lp-demo-read">
                    <span className={`stamp stamp-lg stamp-${v.kind} pressing`}>
                      {v.kind === 'included' ? 'In scope' : v.kind === 'revision' ? `Round ${v.round} of 2` : 'Extra'}
                    </span>
                    <p>{v.reason}</p>
                  </div>
                  {v.kind === 'extra' ? (
                    <>
                      <div className="lp-demo-price">
                        <div className="chips" role="group" aria-label="Estimated time">
                          {[1, 2, 3, 4, 6].map((h) => (
                            <button key={h} type="button" className="chip" aria-pressed={hours === h} onClick={() => setHours(h)}>
                              {h}h
                            </button>
                          ))}
                        </div>
                        <span className="hint">
                          {hours}h × $85 · delivery {formatLong(project.deadline!)} → {formatLong(addWorkdays(project.deadline!, days))}
                        </span>
                      </div>
                      <div className="lp-demo-actions">
                        <button type="button" className="btn btn-gift" onClick={() => decide('gift')}>
                          <Gift size={16} /> Gift it
                        </button>
                        <button type="button" className="btn btn-accent" onClick={() => decide('extra')}>
                          Charge {formatMoney(price, 'USD')}
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="lp-demo-actions">
                      <button type="button" className="btn btn-primary" onClick={() => decide(v.kind)}>
                        <Check size={16} /> Log it
                      </button>
                    </div>
                  )}
                </div>
              )}

              {outcome && (
                <div className="lp-demo-card lp-demo-outcome" key={outcome.item.id}>
                  <div className="lp-demo-outcome-head">
                    <span className={`stamp stamp-${outcome.item.kind} pressing`}>
                      {outcome.item.kind === 'extra'
                        ? `Extra · ${formatMoney(outcome.item.amount, 'USD')}`
                        : outcome.item.kind === 'gift'
                          ? `Gift · ${formatMoney(outcome.item.amount, 'USD')}`
                          : outcome.item.kind === 'revision'
                            ? `Round ${outcome.item.round} of 2`
                            : 'Included'}
                    </span>
                    <span className="hint">Your reply, drafted</span>
                  </div>
                  <p className="lp-demo-reply">{outcome.reply}</p>
                  <div className="lp-demo-next">
                    <span className="hint">Try another request, or push past the revision rounds and see what happens.</span>
                    <Link to="/app" className="btn btn-sm btn-primary">
                      Use it for real <ArrowRight size={14} />
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
