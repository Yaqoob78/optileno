import { useMemo, useState } from 'react';
import { Check, Copy, ExternalLink, FileSignature, Mail, ShieldCheck } from 'lucide-react';
import { Sheet } from '../components/Sheet';
import { useToast } from '../components/Toast';
import { changeOrderLink, changeOrderRef, coLabel, linesOf } from '../lib/changeOrder';
import { addWorkdays, formatLong } from '../lib/dates';
import { itemsOf, projectTotals } from '../lib/ledger';
import { formatMoney } from '../lib/money';
import type { Project } from '../lib/model';
import { actions, getState, useAppState } from '../lib/store';
import { copyText } from './clipboard';

/** Bundles the extras waiting on a client into one numbered change order they can sign. */
export function ChangeOrderSheet({ project, onClose }: { project: Project; onClose: () => void }) {
  const state = useAppState();
  const toast = useToast();
  const { profile } = state;
  const projectItems = useMemo(() => itemsOf(state.items, project.id), [state.items, project.id]);
  const waiting = useMemo(() => projectItems.filter((i) => i.kind === 'extra' && i.status === 'proposed').sort((a, b) => a.createdAt - b.createdAt), [projectItems]);
  const totals = projectTotals(project, projectItems);
  const money = (n: number) => formatMoney(n, profile.currency);

  const [selected, setSelected] = useState<Set<string>>(() => new Set(waiting.map((i) => i.id)));
  const [issued, setIssued] = useState<{ n: number; link: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const chosen = waiting.filter((i) => selected.has(i.id));
  const subtotal = chosen.reduce((s, i) => s + i.amount, 0);
  const days = chosen.reduce((s, i) => s + i.days, 0);

  const toggle = (id: string) =>
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const issue = async () => {
    setBusy(true);
    const n = actions.issueChangeOrder(project.id, [...selected]);
    const items = itemsOf(getState().items, project.id);
    const link = await changeOrderLink(project, items, getState().profile, n);
    setIssued({ n, link });
    setBusy(false);
  };

  if (issued) {
    const lines = linesOf(itemsOf(state.items, project.id), issued.n);
    const ref = changeOrderRef(issued.n, lines);
    const label = coLabel(issued.n);
    const mailto = `mailto:?subject=${encodeURIComponent(`${label}: ${project.name}`)}&body=${encodeURIComponent(
      `Hi${project.contact ? ` ${project.contact.split(/\s+/)[0]}` : ''},\n\nHere’s change order ${label} for ${project.name}: ${lines.length} ${lines.length === 1 ? 'addition' : 'additions'}, ${money(
        lines.reduce((s, i) => s + i.amount, 0),
      )} in total. Tick what you’d like, add your name, and it comes straight back to me.\n\n${issued.link}\n\n${profile.name}`,
    )}`;
    return (
      <Sheet
        open
        onClose={onClose}
        title={`${label} is ready`}
        footer={
          <>
            <a className="btn" href={issued.link} target="_blank" rel="noreferrer">
              <ExternalLink size={16} /> Preview
            </a>
            <a className="btn" href={mailto}>
              <Mail size={16} /> Email it
            </a>
            <button
              type="button"
              className="btn btn-primary"
              onClick={async () => {
                if (await copyText(issued.link)) toast({ message: `${label} link copied. Send it to your client.` });
              }}
            >
              <Copy size={16} /> Copy link
            </button>
          </>
        }
      >
        <p className="muted sheet-lede">
          Your client sees each addition with its price and effect on delivery, ticks what they want, and signs with their name. Their reply carries a link that marks it approved here, with their signature.
        </p>
        <div className="co-issued">
          <span className="eyebrow">Reference</span>
          <span className="co-ref num">
            {label} · {ref}
          </span>
        </div>
        <div className="share-link">
          <code>{issued.link.length > 90 ? `${issued.link.slice(0, 86)}…` : issued.link}</code>
        </div>
        <div className="share-privacy">
          <ShieldCheck size={18} />
          <p>
            <strong>The link is the document.</strong> Like your scope page, it lives inside the link, so nothing is uploaded. Change a price later and the reference changes, so you’ll know if an approval was for an older version.
          </p>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title="Change order"
      footer={
        <button type="button" className="btn btn-accent" onClick={issue} disabled={!chosen.length || busy}>
          <FileSignature size={16} /> Prepare change order · {money(subtotal)}
        </button>
      }
    >
      <p className="muted sheet-lede">
        One page with every addition, its price and the new delivery date. {project.contact ? project.contact.split(/\s+/)[0] : 'Your client'} ticks what they want and signs with their name.
      </p>
      {waiting.length === 0 ? (
        <p className="hint">Nothing is waiting on your client. Charge an extra first, and it shows up here.</p>
      ) : (
        <>
          <ul className="co-pick">
            {waiting.map((i) => (
              <li key={i.id}>
                <button type="button" className={`co-pick-row${selected.has(i.id) ? ' on' : ''}`} aria-pressed={selected.has(i.id)} onClick={() => toggle(i.id)}>
                  <span className="check" aria-hidden="true">
                    {selected.has(i.id) && <Check size={12} strokeWidth={3} />}
                  </span>
                  <span className="co-pick-title">
                    {i.title}
                    {i.co !== null && <span className="hint"> · in {coLabel(i.co)}</span>}
                  </span>
                  <span className="num">{money(i.amount)}</span>
                </button>
              </li>
            ))}
          </ul>
          <p className="verdict-impact co-impact">
            <span className="eyebrow">If approved</span>
            <span>
              {money(totals.total)} <span className="arrow">→</span> <strong>{money(totals.total + subtotal)}</strong>
              {totals.delivery && days > 0 && (
                <span className="muted">
                  {' '}
                  · delivery {formatLong(totals.delivery)} <span className="arrow">→</span> {formatLong(addWorkdays(totals.delivery, days))}
                </span>
              )}
            </span>
          </p>
        </>
      )}
    </Sheet>
  );
}
