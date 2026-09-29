import { useEffect, useMemo, useState } from 'react';
import { Copy, ExternalLink, FileSignature, Gift, Link2, X } from 'lucide-react';
import { Sheet } from '../components/Sheet';
import { Stamp } from '../components/Stamp';
import { useToast } from '../components/Toast';
import { changeOrderLink, coLabel } from '../lib/changeOrder';
import { itemsOf, projectTotals } from '../lib/ledger';
import { draftBatchReply } from '../lib/messages';
import { currencySymbol, formatHoursShort, formatMoney, niceRound } from '../lib/money';
import type { ItemKind, Project, RequestItem } from '../lib/model';
import { actions, getState, useAppState, type ItemDraft } from '../lib/store';
import { roundInProgress, suggestAll, titleFrom, type Verdict } from '../lib/verdict';
import { copyText } from './clipboard';

interface BatchSheetProps {
  project: Project;
  text: string;
  asks: string[];
  onClose: () => void;
}

type Choice = ItemKind | 'skip';

interface Row {
  ask: string;
  verdict: Verdict;
  choice: Choice;
  title: string;
  hours: number;
  price: number;
  priceEdited: boolean;
}

const CHOICES: { value: ItemKind; label: string }[] = [
  { value: 'included', label: 'In scope' },
  { value: 'revision', label: 'Revision' },
  { value: 'extra', label: 'Extra' },
  { value: 'gift', label: 'Gift' },
];

const CONFIDENCE: Record<string, string> = { high: 'Fairly sure', medium: 'Best guess', low: 'Not sure. Your call' };

/** A message that asks for several things: every ask gets its own verdict, and the extras become one change order. */
export function BatchSheet({ project, text, asks, onClose }: BatchSheetProps) {
  const state = useAppState();
  const { profile } = state;
  const projectItems = useMemo(() => itemsOf(state.items, project.id), [state.items, project.id]);
  const totals = projectTotals(project, projectItems);
  const perDay = profile.hoursPerDay || 6;

  const [rows, setRows] = useState<Row[]>(() =>
    suggestAll(asks, project, projectItems).map((verdict, i) => {
      // A tweak turned into a gift or extra is usually smaller than new work
      const hours = verdict.kind === 'extra' ? verdict.hours : Math.max(0.5, verdict.hours / 2);
      return {
        ask: asks[i],
        verdict,
        choice: verdict.kind,
        title: verdict.overRounds ? `Revision round ${project.revisions + 1} (beyond the ${project.revisions} included)` : titleFrom(asks[i]),
        hours,
        price: niceRound(hours * profile.rate),
        priceEdited: false,
      };
    }),
  );
  const [saved, setSaved] = useState<{ ids: string[]; co: number | null } | null>(null);

  // Every change in this message shares one round: the one Optileno picked, or the next one
  const batchRound = rows.find((r) => r.verdict.kind === 'revision' && r.verdict.round)?.verdict.round ?? roundInProgress(projectItems) ?? totals.roundsUsed + 1;
  const live = rows.filter((r) => r.choice !== 'skip');
  const extras = live.filter((r) => r.choice === 'extra');
  const extraTotal = extras.reduce((s, r) => s + r.price, 0);
  const paidRound = live.some((r) => r.verdict.overRounds && r.choice === 'extra');
  const counts = CHOICES.map((c) => ({ ...c, n: live.filter((r) => r.choice === c.value).length })).filter((c) => c.n > 0);

  const update = (i: number, patch: Partial<Row>) =>
    setRows((rs) =>
      rs.map((r, j) => {
        if (j !== i) return r;
        const next = { ...r, ...patch };
        if (!next.priceEdited) next.price = niceRound(next.hours * profile.rate);
        return next;
      }),
    );

  const save = () => {
    const paidRoundAsks = rows.filter((r) => r.choice === 'revision' && batchRound > project.revisions).map((r) => r.ask);
    const drafts: ItemDraft[] = live.map((r) => {
      const kind = r.choice as ItemKind;
      const priced = kind === 'extra' || kind === 'gift';
      return {
        projectId: project.id,
        // A paid extra round carries every change it covers, so the client sees what they're paying for
        text: r.verdict.overRounds && kind === 'extra' && paidRoundAsks.length ? [r.ask, ...paidRoundAsks].join(' · ') : r.ask,
        title: r.title,
        kind,
        hours: priced ? r.hours : 0,
        amount: priced ? r.price : 0,
        days: kind === 'extra' ? Math.max(1, Math.ceil(r.hours / perDay)) : 0,
        round: kind === 'revision' ? batchRound : null,
      };
    });
    const ids = actions.addItems(drafts);
    const extraIds = ids.filter((_, i) => drafts[i].kind === 'extra');
    const co = extraIds.length ? actions.issueChangeOrder(project.id, extraIds) : null;
    setSaved({ ids, co });
  };

  if (saved) return <BatchReply project={project} ids={saved.ids} co={saved.co} onClose={onClose} />;

  const who = project.contact.trim().split(/\s+/)[0] || project.client || 'Your client';

  return (
    <Sheet
      open
      onClose={onClose}
      title={`${live.length} requests in one message`}
      hideTitle
      width={680}
      footer={
        extras.length ? (
          <button type="button" className="btn btn-accent" onClick={save} disabled={extras.some((r) => r.price <= 0)}>
            <FileSignature size={16} /> Log {live.length} and price {formatMoney(extraTotal, profile.currency)}
          </button>
        ) : (
          <button type="button" className="btn btn-primary" onClick={save} disabled={!live.length}>
            Log {live.length} {live.length === 1 ? 'request' : 'requests'}
          </button>
        )
      }
    >
      <header className="batch-head">
        <p className="eyebrow">
          {project.client ? `${project.client} · ` : ''}
          {project.name}
        </p>
        <h2 className="serif batch-headline">
          {who} asked for {rows.length} {rows.length === 1 ? 'thing' : 'things'}.
        </h2>
        <p className="muted batch-lede">Optileno pulled each ask out of the message and read it against the scope. Check each one, then log them together.</p>
        <details className="batch-original">
          <summary>Their message</summary>
          <p>{text}</p>
        </details>
      </header>

      <ol className="batch-list">
        {rows.map((r, i) => (
          <li key={i} className={`batch-row batch-${r.choice}`}>
            <div className="batch-row-head">
              <span className="batch-index num" aria-hidden="true">
                {i + 1}
              </span>
              <p className="batch-ask serif">“{r.ask}”</p>
              <button
                type="button"
                className="icon-btn batch-skip-btn"
                aria-label={r.choice === 'skip' ? `Bring back request ${i + 1}` : `Skip request ${i + 1}`}
                aria-pressed={r.choice === 'skip'}
                onClick={() => update(i, { choice: r.choice === 'skip' ? r.verdict.kind : 'skip' })}
              >
                <X size={15} />
              </button>
            </div>

            {r.choice === 'skip' ? (
              <p className="hint batch-skipped">
                Skipped, not logged.{' '}
                <button type="button" className="link-btn" onClick={() => update(i, { choice: r.verdict.kind })}>
                  Bring it back
                </button>
              </p>
            ) : (
              <>
                <p className="batch-read">
                  <Stamp variant={r.verdict.kind}>{stampLabel(r.verdict, project.revisions)}</Stamp>
                  <span>{r.verdict.reason}</span>
                  <span className={`confidence confidence-${r.verdict.confidence}`}>{CONFIDENCE[r.verdict.confidence]}</span>
                </p>

                <div className="batch-controls">
                  <div className="segmented segmented-sm batch-kinds" role="group" aria-label={`How to treat request ${i + 1}`}>
                    {CHOICES.map((c) => (
                      <button key={c.value} type="button" aria-pressed={r.choice === c.value} onClick={() => update(i, { choice: c.value })}>
                        {c.label}
                      </button>
                    ))}
                  </div>
                  <input className="input batch-title" aria-label={`Label for request ${i + 1}`} value={r.title} maxLength={120} onChange={(e) => update(i, { title: e.target.value })} />
                </div>

                {(r.choice === 'extra' || r.choice === 'gift') && (
                  <div className="batch-price">
                    <label className="batch-mini">
                      <span className="label">Hours</span>
                      <input
                        className="input num"
                        inputMode="decimal"
                        value={r.hours || ''}
                        onChange={(e) => update(i, { hours: Math.min(1000, Math.max(0, Number(e.target.value.replace(/[^\d.]/g, '')) || 0)) })}
                      />
                    </label>
                    <label className="batch-mini">
                      <span className="label">{r.choice === 'gift' ? 'Worth' : 'Price'}</span>
                      <span className="input-affix">
                        <span className="affix">{currencySymbol(profile.currency)}</span>
                        <input
                          className="input num"
                          inputMode="decimal"
                          value={r.price || ''}
                          onChange={(e) => update(i, { priceEdited: true, price: Math.max(0, Number(e.target.value.replace(/[^\d.]/g, '')) || 0) })}
                        />
                      </span>
                    </label>
                    <span className="hint batch-price-note">
                      {formatHoursShort(r.hours)} × {formatMoney(profile.rate, profile.currency)}/h
                      {r.choice === 'extra' && ` · +${Math.max(1, Math.ceil(r.hours / perDay))} working ${Math.ceil(r.hours / perDay) > 1 ? 'days' : 'day'}`}
                      {r.priceEdited && (
                        <>
                          {' · '}
                          <button type="button" className="link-btn" onClick={() => update(i, { priceEdited: false })}>
                            use my rate
                          </button>
                        </>
                      )}
                    </span>
                  </div>
                )}

                {r.choice === 'revision' && (
                  <p className={`hint batch-round${batchRound > project.revisions && !paidRound ? ' warn' : ''}`}>
                    {batchRound > project.revisions && paidRound
                      ? 'Covered by the extra round priced in this message.'
                      : batchRound > project.revisions
                      ? `Past the ${project.revisions} included ${project.revisions === 1 ? 'round' : 'rounds'}. Charge for the extra round, or treat this as extra.`
                      : `Round ${batchRound} of ${project.revisions}, shared by every change in this message.`}
                  </p>
                )}
              </>
            )}
          </li>
        ))}
      </ol>

      <div className="batch-summary" aria-live="polite">
        <div className="batch-counts">
          {counts.map((c) => (
            <span key={c.value} className={`batch-count batch-count-${c.value}`}>
              <strong className="num">{c.n}</strong> {c.label.toLowerCase()}
            </span>
          ))}
          {!counts.length && <span className="muted">Nothing to log</span>}
        </div>
        {extras.length > 0 && (
          <p className="batch-co">
            <FileSignature size={15} /> The {extras.length === 1 ? 'extra goes' : `${extras.length} extras go`} into one change order your client can sign in a tap.
          </p>
        )}
      </div>
    </Sheet>
  );
}

function stampLabel(v: Verdict, rounds: number): string {
  if (v.kind === 'included') return 'In scope';
  if (v.kind === 'extra') return v.overRounds ? 'Extra round' : 'Extra';
  if (v.round && v.round > rounds) return 'Extra round';
  return `Round ${v.round} of ${rounds}`;
}

function BatchReply({ project, ids, co, onClose }: { project: Project; ids: string[]; co: number | null; onClose: () => void }) {
  const state = useAppState();
  const toast = useToast();
  const { profile } = state;
  const [tone, setTone] = useState(state.settings.tone);
  const [link, setLink] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [edited, setEdited] = useState(false);
  const money = (n: number) => formatMoney(n, profile.currency);

  const logged = useMemo(() => ids.map((id) => state.items.find((i) => i.id === id)).filter((i): i is RequestItem => !!i), [ids, state.items]);
  const extras = logged.filter((i) => i.kind === 'extra');
  const gifts = logged.filter((i) => i.kind === 'gift');
  const extraTotal = extras.reduce((s, i) => s + i.amount, 0);
  const days = extras.reduce((s, i) => s + i.days, 0);

  useEffect(() => {
    if (co === null) return undefined;
    let cancelled = false;
    // Built once, right after saving, so it holds exactly these extras
    changeOrderLink(project, itemsOf(getState().items, project.id), getState().profile, co).then((l) => !cancelled && setLink(l));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (edited) return;
    const rounds = [...new Set(logged.filter((i) => i.kind === 'revision').map((i) => i.round ?? 1))];
    setDraft(
      draftBatchReply({
        tone,
        contact: project.contact,
        currency: profile.currency,
        included: logged.filter((i) => i.kind === 'included').map((i) => i.title),
        revisions: rounds.map((round) => ({ round, titles: logged.filter((i) => i.kind === 'revision' && i.round === round).map((i) => i.title) })),
        roundsIncluded: project.revisions,
        extras: extras.map((i) => ({ title: i.title, amount: i.amount })),
        gifts: gifts.map((i) => ({ title: i.title, amount: i.amount })),
        days,
        // Delivery before these extras are approved
        delivery: projectTotals(project, itemsOf(getState().items, project.id)).delivery,
        changeOrder: co === null ? null : coLabel(co),
        link,
        signature: profile.name,
      }),
    );
  }, [tone, link, edited, logged, project, profile, co, days]);

  const headline = extras.length ? `${money(extraTotal)}, on the table.` : `All ${logged.length} logged.`;
  const sub = extras.length
    ? `${coLabel(co ?? 1)} is ready: your client ticks what they want, types their name, and it lands back here, signed.`
    : 'Every ask is on the record, so neither of you has to keep track in your head.';

  return (
    <Sheet
      open
      onClose={onClose}
      title={headline}
      hideTitle
      width={620}
      footer={
        <>
          {co !== null && (
            <>
              <a className={`btn${link ? '' : ' disabled'}`} href={link ?? undefined} target="_blank" rel="noreferrer">
                <ExternalLink size={16} /> Preview
              </a>
              <button
                type="button"
                className="btn"
                disabled={!link}
                onClick={async () => {
                  if (link && (await copyText(link))) toast({ message: `${coLabel(co)} link copied.` });
                }}
              >
                <Link2 size={16} /> Copy link only
              </button>
            </>
          )}
          <button type="button" className="btn" onClick={onClose}>
            Done
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={async () => {
              if (await copyText(draft)) toast({ message: 'Reply copied. Paste it wherever you talk to them.' });
            }}
          >
            <Copy size={16} /> Copy reply
          </button>
        </>
      }
    >
      <div className="reply-hero">
        <div className="batch-stamps">
          {co !== null && (
            <Stamp variant="extra" large press>
              {coLabel(co)} · {money(extraTotal)}
            </Stamp>
          )}
          {gifts.length > 0 && (
            <Stamp variant="gift" large press>
              <Gift size={14} /> {money(gifts.reduce((s, g) => s + g.amount, 0))}
            </Stamp>
          )}
          {co === null && gifts.length === 0 && (
            <Stamp variant="included" large press>
              {logged.length} logged
            </Stamp>
          )}
        </div>
        <h2 className="reply-headline serif">{headline}</h2>
        <p className="muted">{sub}</p>
      </div>
      <div className="field">
        <div className="reply-label-row">
          <label className="label" htmlFor="batch-reply">
            One reply for all of it
          </label>
          <div className="segmented segmented-sm" role="group" aria-label="Tone">
            {(['warm', 'brief'] as const).map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={tone === t}
                onClick={() => {
                  setTone(t);
                  setEdited(false);
                  actions.setTone(t);
                }}
              >
                {t === 'warm' ? 'Warm' : 'Brief'}
              </button>
            ))}
          </div>
        </div>
        <textarea
          id="batch-reply"
          className="textarea reply-text"
          rows={12}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setEdited(true);
          }}
        />
        {co !== null && !profile.email && <p className="hint">Add your email in Settings so signed change orders come straight to your inbox.</p>}
      </div>
    </Sheet>
  );
}
