import { useMemo, useState } from 'react';
import { Check, Copy, Hash, Mail, MessageCircle, Sparkles } from 'lucide-react';
import { copyText } from '../../app/clipboard';
import { addWorkdays, formatShort, todayISO } from '../../lib/dates';
import { draftReply } from '../../lib/messages';
import { formatMoney, niceRound } from '../../lib/money';
import type { Project } from '../../lib/model';
import { templateById } from '../../lib/templates';
import { suggest, titleFrom, type Verdict } from '../../lib/verdict';

const RATE = 85;

const SAMPLES = [
  { icon: Mail, source: 'Email', from: 'Maya · Northwind Coffee', text: 'Hey! Can we also add a quick blog section? Maybe one more round of revisions on the homepage too?' },
  { icon: Hash, source: 'Slack', from: 'Maya · #northwind-site', text: 'Could the headline on the homepage be a bit punchier and the buttons slightly rounder?' },
  { icon: MessageCircle, source: 'WhatsApp', from: 'Maya', text: 'Could you also write the copy for the About page? We’re a bit stuck on it 🙏' },
];

function demoProject(): Project {
  const t = templateById('website');
  return {
    id: 'journey-demo',
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

const LABEL: Record<Verdict['kind'], string> = { included: 'In scope', revision: 'Revision', extra: 'Extra' };

/** The real engine, on a sample project: paste, analyze, reply. */
export function ActionDemo() {
  const project = useMemo(demoProject, []);
  const [sample, setSample] = useState(0);
  const [text, setText] = useState(SAMPLES[0].text);
  const [result, setResult] = useState<{ v: Verdict; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const pick = (i: number) => {
    setSample(i);
    setText(SAMPLES[i].text);
    setResult(null);
  };

  const analyze = () => {
    const clean = text.trim();
    if (!clean) return;
    setResult({ v: suggest(clean, project, []), text: clean });
    setCopied(false);
  };

  const v = result?.v;
  const hours = v ? (v.kind === 'extra' ? v.hours : 0.5) : 0;
  const price = niceRound(hours * RATE);
  const days = Math.max(1, Math.ceil(hours / 6));
  const reply = v
    ? draftReply({
        kind: v.kind,
        tone: 'warm',
        contact: 'Maya',
        title: titleFrom(result.text),
        currency: 'USD',
        amount: price,
        hours,
        days,
        round: v.round,
        roundsIncluded: project.revisions,
        overRounds: v.overRounds,
        delivery: project.deadline,
        fix: v.kind === 'included' && v.confidence === 'high',
        link: null,
        signature: 'Sam',
      })
    : '';
  const Src = SAMPLES[sample].icon;

  return (
    <div className="jr-demo">
      <div className="jr-card jr-request" data-step={1}>
        <div className="jr-card-head">
          <span className="jr-card-title">Client request</span>
          <div className="jr-sources" role="group" aria-label="Sample requests">
            {SAMPLES.map((s, i) => (
              <button key={s.source} type="button" aria-pressed={sample === i} onClick={() => pick(i)}>
                <s.icon size={13} /> {s.source}
              </button>
            ))}
          </div>
        </div>
        <div className="jr-bubble-from">
          <Src size={13} /> {SAMPLES[sample].from}
        </div>
        <textarea
          className="jr-request-text"
          value={text}
          rows={4}
          aria-label="Client request"
          onChange={(e) => {
            setText(e.target.value);
            setResult(null);
          }}
        />
        <button type="button" className="btn btn-primary jr-analyze" onClick={analyze} disabled={!text.trim()}>
          <Sparkles size={15} /> Analyze request
        </button>
      </div>

      <div className={`jr-card jr-verdict${v ? ' has-result' : ''}`} data-step={2} aria-live="polite">
        <div className="jr-card-head">
          <span className="jr-card-title">Optileno verdict</span>
          <span className="hint">Website redesign · $85/h</span>
        </div>
        {!v ? (
          <p className="jr-verdict-empty">Pick a request, or type your own, then press Analyze.</p>
        ) : (
          <div key={result.text} className="jr-verdict-body">
            <div className="jr-verdict-top">
              <span className={`stamp stamp-lg stamp-${v.kind} pressing`}>{v.kind === 'revision' ? `Round ${v.round} of 2` : LABEL[v.kind]}</span>
              <p>{v.reason}</p>
            </div>
            <dl className="jr-verdict-facts">
              <div>
                <dt>Estimated time</dt>
                <dd>{v.kind === 'extra' ? `${hours} h` : 'Covered'}</dd>
              </div>
              <div>
                <dt>Price</dt>
                <dd className={v.kind === 'extra' ? 'jr-accent' : ''}>{v.kind === 'extra' ? formatMoney(price, 'USD') : 'Included'}</dd>
              </div>
              <div>
                <dt>Delivery</dt>
                <dd>{v.kind === 'extra' ? `${formatShort(project.deadline!)} → ${formatShort(addWorkdays(project.deadline!, days))}` : 'No change'}</dd>
              </div>
            </dl>
            <div className="jr-reply">
              <span className="jr-card-title">Suggested reply</span>
              <p>{reply}</p>
              <button
                type="button"
                className="btn btn-sm"
                onClick={async () => {
                  if (await copyText(reply)) setCopied(true);
                }}
              >
                {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy reply'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
