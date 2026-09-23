import { useEffect, useMemo, useState } from 'react';
import { Copy, ExternalLink, Mail, ShieldCheck } from 'lucide-react';
import { Sheet } from '../components/Sheet';
import { useToast } from '../components/Toast';
import { itemsOf } from '../lib/ledger';
import type { Project } from '../lib/model';
import { scopeLink } from '../lib/share';
import { actions, useAppState } from '../lib/store';
import { copyText } from './clipboard';

/** One link, no login for the client: what's included, what's used, what's extra. */
export function ShareSheet({ project, onClose }: { project: Project; onClose: () => void }) {
  const state = useAppState();
  const toast = useToast();
  const [link, setLink] = useState<string | null>(null);
  const [email, setEmail] = useState(state.profile.email);
  const projectItems = useMemo(() => itemsOf(state.items, project.id), [state.items, project.id]);

  useEffect(() => {
    let cancelled = false;
    scopeLink(project, projectItems, state.profile).then((l) => !cancelled && setLink(l));
    return () => {
      cancelled = true;
    };
  }, [project, projectItems, state.profile]);

  const mailto = link
    ? `mailto:?subject=${encodeURIComponent(`${project.name}: where things stand`)}&body=${encodeURIComponent(
        `Hi${project.contact ? ` ${project.contact}` : ''},\n\nHere’s a live summary of ${project.name}: what’s included, what’s done, and anything waiting on your approval.\n\n${link}\n\n${state.profile.name}`,
      )}`
    : undefined;

  return (
    <Sheet
      open
      onClose={onClose}
      title="Share the scope page"
      footer={
        <>
          <a className={`btn${link ? '' : ' disabled'}`} href={link ?? undefined} target="_blank" rel="noreferrer">
            <ExternalLink size={16} /> Preview
          </a>
          <a className="btn" href={mailto}>
            <Mail size={16} /> Email it
          </a>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!link}
            onClick={async () => {
              if (link && (await copyText(link))) toast({ message: 'Link copied. Send it to your client.' });
            }}
          >
            <Copy size={16} /> Copy link
          </button>
        </>
      }
    >
      <p className="muted sheet-lede">
        Your client sees what’s included, how many revision rounds are used, what’s been added, and what was gifted. Anything waiting on them gets an Approve button.
      </p>
      <div className="share-link" aria-live="polite">
        {link ? <code>{link.length > 90 ? `${link.slice(0, 86)}…` : link}</code> : <span className="muted">Preparing link…</span>}
      </div>

      <div className="share-privacy">
        <ShieldCheck size={18} />
        <p>
          <strong>The link is the page.</strong> Everything it shows is packed into the link itself, after the “#”, a part browsers never send to any server. Nothing is uploaded.
          After changes, send a fresh link.
        </p>
      </div>

      {!state.profile.email && (
        <div className="field share-email">
          <label className="label" htmlFor="s-email">
            Where should approvals go?
          </label>
          <div className="row">
            <input id="s-email" className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@studio.com" />
            <button
              type="button"
              className="btn"
              style={{ flex: '0 0 auto' }}
              disabled={!/^\S+@\S+\.\S+$/.test(email)}
              onClick={() => {
                actions.updateProfile({ email: email.trim() });
                toast({ message: 'Saved. Approvals will come to your inbox.' });
              }}
            >
              Save
            </button>
          </div>
          <span className="hint">Without it, clients can still approve by copying a short message to you.</span>
        </div>
      )}
    </Sheet>
  );
}
