import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Copy, Mail, MessageCircle, PenLine, Printer, RotateCcw } from 'lucide-react';
import { copyText } from '../app/clipboard';
import { Mark } from '../components/Mark';
import { approvalMessage, changeOrderRef, changeOrderTotals, coLabel, decodeChangeOrder, type ChangeOrder } from '../lib/changeOrder';
import { formatFull, formatLong, toISO } from '../lib/dates';
import { formatHours, formatMoney } from '../lib/money';
import '../styles/client.css';

type Load = { status: 'loading' } | { status: 'ok'; co: ChangeOrder } | { status: 'bad' };

interface Signed {
  by: string;
  at: number;
  ids: string[];
  via: 'email' | 'copy';
}

/** What the client sees: a numbered change order they tick, sign with their name, and send back. */
export function ChangeOrderPage() {
  const [load, setLoad] = useState<Load>({ status: 'loading' });

  useEffect(() => {
    const read = () => {
      const hash = window.location.hash.slice(1);
      if (!hash) return setLoad({ status: 'bad' });
      decodeChangeOrder(hash).then((co) => setLoad(co ? { status: 'ok', co } : { status: 'bad' }));
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
    if (load.status === 'ok') document.title = `${coLabel(load.co.n)} · ${load.co.project.name}`;
  }, [load]);

  if (load.status === 'loading') return <div className="client-page client-loading" aria-busy="true" />;

  if (load.status === 'bad') {
    return (
      <div className="client-page">
        <main className="client-doc client-bad">
          <Mark size={30} />
          <h1 className="serif">This change order link looks incomplete.</h1>
          <p className="muted">The whole document travels inside the link, so a link cut off by an email or chat app won’t open. Ask for it to be sent again.</p>
          <Link to="/" className="btn">
            What is Optileno?
          </Link>
        </main>
      </div>
    );
  }

  return <ChangeOrderDocument co={load.co} />;
}

function storageKey(co: ChangeOrder, ref: string) {
  return `optileno.co.${co.project.id}.${co.n}.${ref}`;
}

function readSigned(key: string): Signed | null {
  try {
    const raw = localStorage.getItem(key);
    const v = raw ? (JSON.parse(raw) as Signed) : null;
    return v && typeof v.by === 'string' && Array.isArray(v.ids) ? v : null;
  } catch {
    return null;
  }
}

function writeSigned(key: string, value: Signed | null) {
  try {
    if (value) localStorage.setItem(key, JSON.stringify(value));
    else localStorage.removeItem(key);
  } catch {
    /* private mode: the page still works, it just won't remember */
  }
}

function ChangeOrderDocument({ co }: { co: ChangeOrder }) {
  const { freelancer: f, project: p } = co;
  const money = (n: number) => formatMoney(n, co.currency);
  const ref = useMemo(() => changeOrderRef(co.n, co.lines), [co]);
  const key = storageKey(co, ref);
  const label = coLabel(co.n);
  const first = f.name.trim().split(/\s+/)[0] || 'your freelancer';

  const [signed, setSigned] = useState<Signed | null>(() => readSigned(key));
  const [selected, setSelected] = useState<Set<string>>(() => new Set(signed?.ids ?? co.lines.map((l) => l.id)));
  const [name, setName] = useState(signed?.by ?? '');
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const t = changeOrderTotals(co, selected);
  const none = selected.size === 0;
  const issued = new Date(co.t);

  const toggle = (id: string) => {
    if (signed) return;
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const send = async (by: string, ids: Set<string>) => {
    const at = new Date();
    const { subject, body } = approvalMessage(co, ids, by, at);
    let via: Signed['via'];
    if (f.email) {
      window.location.href = `mailto:${encodeURIComponent(f.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      via = 'email';
    } else if (await copyText(`${subject}\n\n${body}`)) {
      via = 'copy';
    } else {
      setError('Couldn’t copy automatically. Please try again, or reply to the message this link came in.');
      return;
    }
    const record: Signed = { by, at: at.getTime(), ids: [...ids], via };
    writeSigned(key, record);
    setSigned(record);
  };

  const sign = () => {
    const by = name.trim().replace(/\s+/g, ' ');
    if (by.length < 2) return setError('Type your full name to sign.');
    if (!agree) return setError(none ? 'Tick the box to confirm.' : 'Tick the box to confirm you approve.');
    setError(null);
    void send(by, selected);
  };

  const undo = () => {
    writeSigned(key, null);
    setSigned(null);
    setAgree(false);
  };

  const ask = f.email ? `mailto:${encodeURIComponent(f.email)}?subject=${encodeURIComponent(`Question about ${label} (${p.name})`)}` : undefined;

  return (
    <div className="client-page">
      <main className="client-doc co-doc">
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
          <span className="co-number num">{label}</span>
        </header>

        <div className="client-title-block">
          <p className="eyebrow">{p.client ? `Change order for ${p.client}` : 'Change order'}</p>
          <h1 className="serif client-title">{p.name}</h1>
          <p className="muted co-lede">
            {signed
              ? signed.ids.length
                ? `Approved and signed by ${signed.by}. The ticked additions below are now part of the project.`
                : `${signed.by} decided not to go ahead with these additions for now.`
              : `${co.lines.length === 1 ? 'One addition' : `${co.lines.length} additions`} to what we originally agreed, each with its price and what it does to the delivery date. Tick the ones you’d like and sign below. Anything you leave unticked simply won’t be done.`}
          </p>
        </div>

        <dl className="co-meta">
          <div>
            <dt className="eyebrow">Issued</dt>
            <dd>{formatFull(toISO(issued))}</dd>
          </div>
          <div>
            <dt className="eyebrow">Prepared by</dt>
            <dd>{f.name || '—'}</dd>
          </div>
          <div>
            <dt className="eyebrow">For</dt>
            <dd>{[p.contact, p.client].filter(Boolean).join(', ') || '—'}</dd>
          </div>
          <div>
            <dt className="eyebrow">Reference</dt>
            <dd className="num">{ref}</dd>
          </div>
        </dl>

        <section className="client-section" aria-label="Additions">
          <ol className="co-lines">
            {co.lines.map((l, i) => {
              const on = selected.has(l.id);
              return (
                <li key={l.id} className={on ? 'on' : 'off'}>
                  <label className="co-line">
                    <input type="checkbox" className="co-box" checked={on} disabled={!!signed} onChange={() => toggle(l.id)} />
                    <span className="co-tick" aria-hidden="true">
                      {on && <Check size={13} strokeWidth={3} />}
                    </span>
                    <span className="co-line-main">
                      <span className="co-line-title">
                        <span className="co-line-n num">{String(i + 1).padStart(2, '0')}</span>
                        {l.title}
                      </span>
                      {l.asked && <span className="co-asked">You asked: “{l.asked}”</span>}
                      <span className="hint">
                        {l.hours > 0 ? `About ${formatHours(l.hours)}` : 'Fixed price'}
                        {' · '}
                        {l.days > 0 ? `+${l.days} working ${l.days === 1 ? 'day' : 'days'}` : 'no change to delivery'}
                      </span>
                    </span>
                    <span className="co-line-price num">{money(l.amount)}</span>
                  </label>
                </li>
              );
            })}
          </ol>
        </section>

        <section className="co-totals" aria-label="Totals">
          <div>
            <span>Agreed fee</span>
            <span className="num">{money(p.fee)}</span>
          </div>
          {p.approved > 0 && (
            <div>
              <span>Additions approved earlier</span>
              <span className="num">+{money(p.approved)}</span>
            </div>
          )}
          <div className="co-this">
            <span>
              This change order <span className="hint">({selected.size} of {co.lines.length})</span>
            </span>
            <span className="num">+{money(t.subtotal)}</span>
          </div>
          <div className="co-grand">
            <span>New project total</span>
            <span className="num">{money(t.after)}</span>
          </div>
          {p.delivery && (
            <div className="co-delivery">
              <span>Delivery</span>
              <span>
                {t.days > 0 ? (
                  <>
                    <s className="muted">{formatLong(p.delivery)}</s> <span className="arrow">→</span> <strong>{formatLong(t.deliveryAfter ?? p.delivery)}</strong>
                  </>
                ) : (
                  formatLong(p.delivery)
                )}
              </span>
            </div>
          )}
        </section>

        <section className="co-terms" aria-label="Terms">
          <h2 className="eyebrow">Terms</h2>
          <ul>
            <li>Prices are fixed for the work described above.</li>
            <li>Work on the ticked items starts once this is approved, and the delivery date moves as shown.</li>
            <li>Unticked items stay out of scope and can be quoted again later.</li>
            <li>Everything else in the original agreement stays the same.</li>
          </ul>
        </section>

        <section className={`co-sign${signed ? ' is-signed' : ''}`} aria-label="Approval">
          {signed ? (
            <>
              <div className="co-signature">
                <span className="co-signature-name">{signed.by}</span>
                <span className="co-signature-line" />
                <span className="hint">
                  {signed.ids.length ? `Approved ${signed.ids.length} of ${co.lines.length}` : 'Declined'} · signed {formatFull(toISO(new Date(signed.at)))} · ref {ref}
                </span>
              </div>
              <p className="approval-done co-done">
                <Check size={15} />
                {signed.via === 'email'
                  ? 'Your email app should have opened with your approval ready. Just press send.'
                  : `Approval copied. Paste it into your chat with ${first}.`}
              </p>
              <div className="co-actions">
                <button type="button" className="btn btn-sm" onClick={() => window.print()}>
                  <Printer size={15} /> Save signed PDF
                </button>
                <button type="button" className="btn btn-sm btn-ghost" onClick={() => void send(signed.by, new Set(signed.ids))}>
                  {f.email ? <Mail size={15} /> : <Copy size={15} />} Send again
                </button>
                <button type="button" className="btn btn-sm btn-ghost" onClick={undo}>
                  <RotateCcw size={15} /> Change my answer
                </button>
              </div>
            </>
          ) : (
            <>
              <h2 className="client-h2">
                <PenLine size={20} strokeWidth={1.8} /> {none ? 'Not going ahead?' : 'Approve and sign'}
              </h2>
              <div className="co-sign-grid">
                <label className="co-name">
                  <span className="label">Your full name</span>
                  <input
                    className="input co-name-input"
                    value={name}
                    autoComplete="name"
                    maxLength={80}
                    placeholder={p.contact || 'Your name'}
                    onChange={(e) => {
                      setName(e.target.value);
                      setError(null);
                    }}
                  />
                </label>
                <label className="co-agree">
                  <input
                    type="checkbox"
                    checked={agree}
                    onChange={(e) => {
                      setAgree(e.target.checked);
                      setError(null);
                    }}
                  />
                  <span>
                    {none
                      ? `I don’t want any of these for now. The project stays at ${money(t.before)}.`
                      : `I approve the ${selected.size === co.lines.length ? '' : 'ticked '}${selected.size === 1 ? 'item' : `${selected.size} items`} above for ${money(t.subtotal)}, bringing the project total to ${money(t.after)}.`}
                  </span>
                </label>
              </div>
              {error && (
                <p className="co-error" role="alert">
                  {error}
                </p>
              )}
              <div className="co-actions">
                {ask && (
                  <a className="btn btn-ghost" href={ask}>
                    <MessageCircle size={16} /> Ask a question
                  </a>
                )}
                <button type="button" className={`btn ${none ? 'btn-primary' : 'btn-accent'}`} onClick={sign}>
                  {f.email ? <Mail size={16} /> : <Copy size={16} />} {none ? 'Send my answer' : `Approve & sign · ${money(t.subtotal)}`}
                </button>
              </div>
              <p className="hint co-how">
                {f.email
                  ? `This opens your email with the approval written out, addressed to ${first}. Nothing is sent until you press send.`
                  : `This copies the approval so you can paste it to ${first} wherever you talk.`}
              </p>
              <div className="co-paper-sign" aria-hidden="true">
                <span>Signature</span>
                <span>Date</span>
              </div>
            </>
          )}
        </section>

        <footer className="client-foot">
          <p className="hint">
            {label} · ref {ref}. The reference changes if any price changes, so you both know you’re looking at the same document.
          </p>
          <Link to="/?ref=change-order" className="client-made">
            <Mark size={16} /> Made with Optileno
          </Link>
        </footer>
      </main>
    </div>
  );
}
