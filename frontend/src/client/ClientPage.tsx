import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Copy, Gift, Mail, MessageCircle, Printer } from 'lucide-react';
import { copyText } from '../app/clipboard';
import { Mark } from '../components/Mark';
import { Pips } from '../components/Stamp';
import { formatFull, formatLong, toISO } from '../lib/dates';
import { formatMoney } from '../lib/money';
import { approvalLink, decodeSnapshot, type Snapshot } from '../lib/share';
import '../styles/client.css';

type Load = { status: 'loading' } | { status: 'ok'; snap: Snapshot } | { status: 'bad' };

/** What the client sees: a calm, printable page. No login, no app, no tracking. */
export function ClientPage() {
  const [load, setLoad] = useState<Load>({ status: 'loading' });

  useEffect(() => {
    const read = () => {
      const hash = window.location.hash.slice(1);
      if (!hash) return setLoad({ status: 'bad' });
      decodeSnapshot(hash).then((snap) => setLoad(snap ? { status: 'ok', snap } : { status: 'bad' }));
    };
    read();
    window.addEventListener('hashchange', read);
    const robots = document.createElement('meta');
    robots.name = 'robots';
    robots.content = 'noindex, nofollow';
    document.head.appendChild(robots);
    return () => {
      window.removeEventListener('hashchange', read);
      robots.remove();
    };
  }, []);

  useEffect(() => {
    if (load.status === 'ok') document.title = `${load.snap.project.name} · Scope`;
  }, [load]);

  if (load.status === 'loading') return <div className="client-page client-loading" aria-busy="true" />;

  if (load.status === 'bad') {
    return (
      <div className="client-page">
        <main className="client-doc client-bad">
          <Mark size={30} />
          <h1 className="serif">This link looks incomplete.</h1>
          <p className="muted">Scope links carry the whole page inside them, so a link cut off by an email or chat app won’t open. Ask for it to be sent again, ideally as a button or a shorter message.</p>
          <Link to="/" className="btn">
            What is Optileno?
          </Link>
        </main>
      </div>
    );
  }

  return <ScopeDocument snap={load.snap} />;
}

function ScopeDocument({ snap }: { snap: Snapshot }) {
  const { freelancer: f, project: p } = snap;
  const money = (n: number) => formatMoney(n, snap.currency);
  const pending = snap.extras.filter((e) => e.status === 'proposed');
  const approved = snap.extras.filter((e) => e.status === 'approved');
  const declined = snap.extras.filter((e) => e.status === 'declined');
  const approvedTotal = approved.reduce((s, e) => s + e.amount, 0);
  const giftTotal = snap.gifts.reduce((s, g) => s + g.amount, 0);
  const done = p.deliverables.filter((d) => d.done).length;
  const who = f.name || 'your freelancer';
  const firstName = (f.name || '').split(/\s+/)[0] || 'them';
  const updated = new Date(snap.t);

  return (
    <div className="client-page">
      <main className="client-doc">
        <header className="client-head">
          <div className="client-by">
            <span className="client-avatar" aria-hidden="true">
              {(f.name || '?').trim().charAt(0).toUpperCase()}
            </span>
            <span>
              <strong>{f.name || 'Your freelancer'}</strong>
              {f.business && <span className="muted"> · {f.business}</span>}
            </span>
          </div>
          <span className="hint">Updated {formatFull(toISO(updated))}</span>
        </header>

        <div className="client-title-block">
          <p className="eyebrow">{p.client ? `Project scope for ${p.client}` : 'Project scope'}</p>
          <h1 className="serif client-title">{p.name}</h1>
        </div>

        <section className="client-sums" aria-label="Summary">
          <div>
            <span className="eyebrow">Agreed fee</span>
            <span className="num">{money(p.fee)}</span>
          </div>
          <div>
            <span className="eyebrow">Approved additions</span>
            <span className="num">{approvedTotal ? `+${money(approvedTotal)}` : money(0)}</span>
          </div>
          <div className="client-sum-total">
            <span className="eyebrow">Project total</span>
            <span className="num">{money(p.fee + approvedTotal)}</span>
          </div>
          <div>
            <span className="eyebrow">Delivery</span>
            <span>{p.delivery ? formatLong(p.delivery) : 'To be agreed'}</span>
          </div>
        </section>

        {pending.length > 0 && (
          <section className="client-section client-waiting">
            <h2 className="client-h2">
              Waiting on you <span className="client-count">{pending.length}</span>
            </h2>
            <p className="muted client-lede">
              These go beyond what we originally agreed, so {firstName} needs your OK before starting. Approve what you’d like; anything you skip simply won’t be done.
            </p>
            <ul className="client-approvals">
              {pending.map((e) => (
                <ApprovalCard key={e.id} snap={snap} extra={e} />
              ))}
            </ul>
          </section>
        )}

        <section className="client-section">
          <div className="client-h2-row">
            <h2 className="client-h2">What’s included</h2>
            <span className="hint num">
              {done} of {p.deliverables.length} done
            </span>
          </div>
          <ul className="client-deliverables">
            {p.deliverables.map((d, i) => (
              <li key={i} className={d.done ? 'done' : ''}>
                <span className="client-check" aria-hidden="true">
                  {d.done && <Check size={12} strokeWidth={3} />}
                </span>
                <span>{d.title}</span>
                {d.done && <span className="client-done-label">Done</span>}
              </li>
            ))}
          </ul>
          <div className="client-rounds">
            <div>
              <span className="client-rounds-label">Revision rounds</span>
              <span className="hint">
                A round is one batch of feedback. {Math.min(p.roundsUsed, p.roundsIncluded)} of {p.roundsIncluded} used
                {p.roundsIncluded - p.roundsUsed > 0
                  ? `, ${p.roundsIncluded - p.roundsUsed} left.`
                  : '. Further rounds are quoted separately.'}
              </span>
            </div>
            <Pips used={p.roundsUsed} included={p.roundsIncluded} />
          </div>
        </section>

        {approved.length > 0 && (
          <section className="client-section">
            <h2 className="client-h2">Added along the way</h2>
            <ul className="client-lines">
              {approved.map((e) => (
                <li key={e.id}>
                  <span>{e.title}</span>
                  <span className="num">{money(e.amount)}</span>
                </li>
              ))}
              {declined.map((e) => (
                <li key={e.id} className="declined">
                  <span>{e.title}</span>
                  <span className="hint">Not going ahead</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {snap.gifts.length > 0 && (
          <section className="client-section client-gifts">
            <h2 className="client-h2">
              <Gift size={18} strokeWidth={1.8} /> On the house
            </h2>
            <p className="muted client-lede">
              Small extras {firstName} included at no charge, worth {money(giftTotal)} in total.
            </p>
            <ul className="client-lines">
              {snap.gifts.map((g, i) => (
                <li key={i}>
                  <span>{g.title}</span>
                  <span className="client-gift-value">
                    <s className="num">{money(g.amount)}</s> <span>Gift</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {p.excluded.length > 0 && (
          <section className="client-section">
            <h2 className="client-h2">Not included, but available</h2>
            <p className="muted client-lede">Happy to quote any of these if you need them.</p>
            <ul className="client-excluded">
              {p.excluded.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </section>
        )}

        <footer className="client-foot">
          <p className="hint">
            A snapshot as of {formatFull(toISO(updated))}. {who} will send a fresh link when things change.
          </p>
          <div className="client-foot-actions">
            <button type="button" className="btn btn-sm" onClick={() => window.print()}>
              <Printer size={15} /> Save as PDF
            </button>
          </div>
          <Link to="/?ref=scope-page" className="client-made">
            <Mark size={16} /> Made with Optileno
          </Link>
        </footer>
      </main>
    </div>
  );
}

function ApprovalCard({ snap, extra }: { snap: Snapshot; extra: Snapshot['extras'][number] }) {
  const [state, setState] = useState<'idle' | 'emailed' | 'copied'>('idle');
  const f = snap.freelancer;
  const price = formatMoney(extra.amount, snap.currency);
  const timing = extra.days > 0 ? `adds about ${extra.days} working ${extra.days === 1 ? 'day' : 'days'}` : 'no change to delivery';
  const approval = `Hi ${(f.name || '').split(/\s+/)[0] || 'there'},\n\nApproved: ${extra.title} (${price}, ${timing}). Go ahead.\n\n(One-tap confirm for your Optileno: ${approvalLink(snap.project.id, extra.id)})`;
  const subject = `Approved: ${extra.title} (${price})`;

  const approve = async () => {
    if (f.email) {
      window.location.href = `mailto:${encodeURIComponent(f.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(approval)}`;
      setState('emailed');
    } else if (await copyText(approval)) {
      setState('copied');
    }
  };

  const ask = f.email
    ? `mailto:${encodeURIComponent(f.email)}?subject=${encodeURIComponent(`Question about: ${extra.title}`)}`
    : undefined;

  return (
    <li className={`approval-card${state !== 'idle' ? ' approved' : ''}`}>
      <div className="approval-main">
        <h3 className="approval-title">{extra.title}</h3>
        <p className="hint">{timing.charAt(0).toUpperCase() + timing.slice(1)}</p>
      </div>
      <div className="approval-price num">{price}</div>
      <div className="approval-actions">
        {state === 'idle' ? (
          <>
            {ask && (
              <a className="btn btn-sm btn-ghost" href={ask}>
                <MessageCircle size={15} /> Ask a question
              </a>
            )}
            <button type="button" className="btn btn-sm btn-primary" onClick={approve}>
              {f.email ? <Mail size={15} /> : <Copy size={15} />} Approve {price}
            </button>
          </>
        ) : (
          <p className="approval-done">
            <Check size={15} />
            {state === 'emailed'
              ? 'Your email app should have opened with the approval ready. Just press send.'
              : `Approval copied. Paste it into your chat with ${(f.name || 'them').split(/\s+/)[0]}.`}
            <button type="button" className="link-btn" onClick={() => setState('idle')}>
              Undo
            </button>
          </p>
        )}
      </div>
    </li>
  );
}
