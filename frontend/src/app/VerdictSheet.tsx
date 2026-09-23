import { useEffect, useMemo, useState } from 'react';
import { Check, Copy, Gift, Link2 } from 'lucide-react';
import { Sheet } from '../components/Sheet';
import { Stamp } from '../components/Stamp';
import { useToast } from '../components/Toast';
import { addWorkdays, formatLong } from '../lib/dates';
import { itemsOf, projectTotals } from '../lib/ledger';
import { draftReply } from '../lib/messages';
import { currencySymbol, formatHoursShort, formatMoney, niceRound } from '../lib/money';
import type { ItemKind, Project, RequestItem } from '../lib/model';
import { scopeLink } from '../lib/share';
import { actions, getState, useAppState } from '../lib/store';
import { suggest, titleFrom } from '../lib/verdict';
import { copyText } from './clipboard';

interface VerdictSheetProps {
  project: Project;
  text: string;
  onClose: () => void;
}

type Choice = 'included' | 'revision' | 'extra';

const CONFIDENCE: Record<string, string> = { high: 'Fairly sure', medium: 'Best guess', low: 'Not sure. Your call' };

/** The moment of truth: in scope, a revision, or extra, and then what to say. */
export function VerdictSheet({ project, text, onClose }: VerdictSheetProps) {
  const state = useAppState();
  const { profile, settings } = state;
  const projectItems = useMemo(() => itemsOf(state.items, project.id), [state.items, project.id]);
  const verdict = useMemo(() => suggest(text, project, projectItems), [text, project, projectItems]);
  const totals = projectTotals(project, projectItems);

  const [choice, setChoice] = useState<Choice>(verdict.kind);
  const [title, setTitle] = useState(() => titleFrom(text));
  const [round, setRound] = useState<number>(verdict.round ?? totals.roundsUsed + 1);
  const [hours, setHours] = useState(verdict.hours);
  const [price, setPrice] = useState<number>(() => niceRound(verdict.hours * profile.rate));
  const [priceEdited, setPriceEdited] = useState(false);
  const [saved, setSaved] = useState<RequestItem | null>(null);

  const perDay = profile.hoursPerDay || 6;
  const days = Math.max(1, Math.ceil(hours / perDay));
  const nextRound = totals.roundsUsed + 1;
  const roundsLeft = project.revisions - totals.roundsUsed;
  const revisionBlocked = choice === 'revision' && round > project.revisions;

  useEffect(() => {
    if (!priceEdited) setPrice(niceRound(hours * profile.rate));
  }, [hours, profile.rate, priceEdited]);

  const save = (kind: ItemKind) => {
    const id = actions.addItem({
      projectId: project.id,
      text,
      title,
      kind,
      hours: kind === 'extra' || kind === 'gift' ? hours : 0,
      amount: kind === 'extra' || kind === 'gift' ? price : 0,
      days: kind === 'extra' ? days : 0,
      round: kind === 'revision' ? round : null,
    });
    setSaved(getState().items.find((i) => i.id === id) ?? null);
  };

  const hourChips = [0.5, 1, 2, 3, 4, perDay, perDay * 2];

  if (saved) {
    return <ReplyStage project={project} item={saved} fix={verdict.kind === 'included' && verdict.confidence === 'high'} overRounds={verdict.overRounds && saved.kind === 'extra'} onClose={onClose} tone={settings.tone} />;
  }

  const footer =
    choice === 'extra' ? (
      <>
        <button type="button" className="btn btn-gift" onClick={() => save('gift')}>
          <Gift size={16} /> Gift it
        </button>
        <button type="button" className="btn btn-accent" onClick={() => save('extra')} disabled={price <= 0}>
          Charge {formatMoney(price, profile.currency)}
        </button>
      </>
    ) : choice === 'revision' && revisionBlocked ? (
      <button type="button" className="btn btn-accent" onClick={() => setChoice('extra')}>
        Price it as an extra
      </button>
    ) : (
      <button type="button" className="btn btn-primary" onClick={() => save(choice)}>
        <Check size={16} /> Log it
      </button>
    );

  return (
    <Sheet open onClose={onClose} title="New request" hideTitle footer={footer}>
      <figure className="verdict-quote">
        <blockquote className="serif">“{text}”</blockquote>
        <figcaption className="muted">
          {project.client ? `${project.client} · ` : ''}
          {project.name}
        </figcaption>
      </figure>

      <div className="verdict-read">
        <div className="verdict-read-head">
          <span className="eyebrow">Optileno’s read</span>
          <span className={`confidence confidence-${verdict.confidence}`}>{CONFIDENCE[verdict.confidence]}</span>
        </div>
        <div className="verdict-read-body">
          <Stamp variant={verdict.kind} large press>
            {verdict.kind === 'included' ? 'In scope' : verdict.kind === 'revision' ? `Round ${verdict.round} of ${project.revisions}` : 'Extra'}
          </Stamp>
          <p>{verdict.reason}</p>
        </div>
      </div>

      <div className="field">
        <span className="label">How will you treat it?</span>
        <div className="segmented segmented-wide" role="group" aria-label="How to treat this request">
          {(['included', 'revision', 'extra'] as Choice[]).map((c) => (
            <button key={c} type="button" aria-pressed={choice === c} onClick={() => setChoice(c)}>
              {c === 'included' ? 'In scope' : c === 'revision' ? 'Revision' : 'Extra'}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <label className="label" htmlFor="v-title">
          Label
        </label>
        <input id="v-title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
      </div>

      {choice === 'included' && <p className="verdict-note">No charge and no change to the timeline. It’s logged, so you both have a record.</p>}

      {choice === 'revision' && (
        <div className="verdict-panel">
          {project.revisions === 0 ? (
            <p className="verdict-note warn">This project has no revision rounds included. Changes are extras.</p>
          ) : (
            <>
              <div className="chips" role="group" aria-label="Revision round">
                {totals.roundsUsed > 0 && (
                  <button type="button" className="chip" aria-pressed={round === totals.roundsUsed} onClick={() => setRound(totals.roundsUsed)}>
                    Part of round {totals.roundsUsed}
                  </button>
                )}
                <button type="button" className="chip" aria-pressed={round === nextRound} onClick={() => setRound(nextRound)}>
                  Start round {nextRound}
                </button>
              </div>
              <p className={`verdict-note${revisionBlocked ? ' warn' : ''}`}>
                {revisionBlocked
                  ? `All ${project.revisions} included rounds are used. Round ${nextRound} would be extra work.`
                  : round === totals.roundsUsed
                    ? 'Folded into the round in progress. No new round used.'
                    : `Uses round ${round} of ${project.revisions}. ${roundsLeft - 1 > 0 ? `${roundsLeft - 1} left after this.` : 'That’s the last one included.'}`}
              </p>
            </>
          )}
        </div>
      )}

      {choice === 'extra' && (
        <div className="verdict-panel">
          <div className="field">
            <span className="label">How long will it take?</span>
            <div className="chips" role="group" aria-label="Estimated time">
              {[...new Set(hourChips)].map((h) => (
                <button key={h} type="button" className="chip" aria-pressed={hours === h} onClick={() => setHours(h)}>
                  {h === perDay ? '1 day' : h === perDay * 2 ? '2 days' : formatHoursShort(h)}
                </button>
              ))}
            </div>
          </div>
          <div className="row">
            <div className="field">
              <label className="label" htmlFor="v-price">
                Price
              </label>
              <div className="input-affix">
                <span className="affix">{currencySymbol(profile.currency)}</span>
                <input
                  id="v-price"
                  className="input num"
                  inputMode="decimal"
                  value={price || ''}
                  onChange={(e) => {
                    setPriceEdited(true);
                    setPrice(Math.max(0, Number(e.target.value.replace(/[^\d.]/g, '')) || 0));
                  }}
                />
              </div>
              <span className="hint">
                {formatHoursShort(hours)} × {formatMoney(profile.rate, profile.currency)}/h
                {priceEdited && (
                  <>
                    {' · '}
                    <button type="button" className="link-btn" onClick={() => setPriceEdited(false)}>
                      use my rate
                    </button>
                  </>
                )}
              </span>
            </div>
          </div>
          <p className="verdict-impact">
            <span className="eyebrow">Delivery</span>
            {totals.delivery ? (
              <span>
                {formatLong(totals.delivery)} <span className="arrow">→</span> <strong>{formatLong(addWorkdays(totals.delivery, days))}</strong>
                <span className="muted"> · +{days} working {days === 1 ? 'day' : 'days'}</span>
              </span>
            ) : (
              <span>
                +{days} working {days === 1 ? 'day' : 'days'}
              </span>
            )}
          </p>
          <p className="verdict-note">
            <strong>Charge it</strong> and your client gets a clear price to approve. <strong>Gift it</strong> and they see it as a gift worth{' '}
            {formatMoney(price, profile.currency)}, given on purpose.
          </p>
        </div>
      )}
    </Sheet>
  );
}

function ReplyStage({ project, item, fix, overRounds, onClose, tone: initialTone }: { project: Project; item: RequestItem; fix: boolean; overRounds: boolean; onClose: () => void; tone: 'warm' | 'brief' }) {
  const state = useAppState();
  const toast = useToast();
  const [tone, setTone] = useState(initialTone);
  const [link, setLink] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [edited, setEdited] = useState(false);
  const live = state.items.find((i) => i.id === item.id) ?? item;
  const projectItems = itemsOf(state.items, project.id);
  const totals = projectTotals(project, projectItems);

  useEffect(() => {
    if (item.kind !== 'extra') return;
    let cancelled = false;
    scopeLink(project, projectItems, state.profile).then((l) => !cancelled && setLink(l));
    return () => {
      cancelled = true;
    };
    // Built once, right after saving, so it includes this request
  }, []);

  useEffect(() => {
    if (edited) return;
    setDraft(
      draftReply({
        kind: live.kind,
        tone,
        contact: project.contact,
        title: live.title,
        currency: state.profile.currency,
        amount: live.amount,
        hours: live.hours,
        days: live.days,
        round: live.round,
        roundsIncluded: project.revisions,
        overRounds,
        // Before this extra is approved, delivery is the current date
        delivery: totals.delivery,
        fix,
        link,
        signature: state.profile.name,
      }),
    );
  }, [tone, link, edited, live, project, state.profile, totals.delivery, fix, overRounds]);

  const headline =
    live.kind === 'extra'
      ? `${formatMoney(live.amount, state.profile.currency)}, on the table.`
      : live.kind === 'gift'
        ? 'Gifted, on purpose.'
        : live.kind === 'revision'
          ? `Round ${live.round} of ${project.revisions}.`
          : 'In scope. Logged.';

  const sub =
    live.kind === 'extra'
      ? 'Send this and they can approve it in one tap. You’ll see it land here.'
      : live.kind === 'gift'
        ? 'Your client will see it on their scope page as a gift. Generosity works best when it’s visible.'
        : live.kind === 'revision'
          ? 'Counted, so neither of you has to keep track in your head.'
          : 'A record for both of you, in case it comes up later.';

  const copyReply = async () => {
    if (await copyText(draft)) toast({ message: 'Reply copied. Paste it wherever you talk to them.' });
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title={headline}
      hideTitle
      footer={
        <>
          {live.kind === 'extra' && (
            <button
              type="button"
              className="btn"
              disabled={!link}
              onClick={async () => {
                if (link && (await copyText(link))) toast({ message: 'Approval link copied.' });
              }}
            >
              <Link2 size={16} /> Copy link only
            </button>
          )}
          <button type="button" className="btn" onClick={onClose}>
            Done
          </button>
          <button type="button" className="btn btn-primary" onClick={copyReply}>
            <Copy size={16} /> Copy reply
          </button>
        </>
      }
    >
      <div className="reply-hero">
        <ItemStampLarge item={live} rounds={project.revisions} currency={state.profile.currency} />
        <h2 className="reply-headline serif">{headline}</h2>
        <p className="muted">{sub}</p>
      </div>
      <div className="field">
        <div className="reply-label-row">
          <label className="label" htmlFor="reply">
            Your reply
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
          id="reply"
          className="textarea reply-text"
          rows={9}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setEdited(true);
          }}
        />
        {live.kind === 'extra' && !state.profile.email && (
          <p className="hint">Add your email in Settings so approvals come straight to your inbox.</p>
        )}
      </div>
    </Sheet>
  );
}

function ItemStampLarge({ item, rounds, currency }: { item: RequestItem; rounds: number; currency: Parameters<typeof formatMoney>[1] }) {
  const label =
    item.kind === 'extra'
      ? `Extra · ${formatMoney(item.amount, currency)}`
      : item.kind === 'gift'
        ? `Gift · ${formatMoney(item.amount, currency)}`
        : item.kind === 'revision'
          ? `Round ${item.round} of ${rounds}`
          : 'Included';
  return (
    <Stamp variant={item.kind} large press>
      {label}
    </Stamp>
  );
}
