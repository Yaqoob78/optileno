import type { ReactNode } from 'react';
import { Check, Gift, Mail } from 'lucide-react';
import { Mark } from '../components/Mark';

/* Product moments rendered as live HTML (never screenshots), so they stay
   crisp at any size and always match the real app's language. */

export function StampMock({ kind, children, delay = 0 }: { kind: 'included' | 'revision' | 'extra' | 'gift'; children: string; delay?: number }) {
  return (
    <span className={`stamp stamp-${kind} lm-stamp`} style={{ animationDelay: `${delay}ms` }}>
      {children}
    </span>
  );
}

export function Bubble({ text, from, stamp, className = '' }: { text: string; from: string; stamp?: ReactNode; className?: string }) {
  return (
    <div className={`lm-bubble ${className}`}>
      <span className="lm-bubble-from">{from}</span>
      <p className="lm-bubble-text">{text}</p>
      {stamp && <div className="lm-bubble-stamp">{stamp}</div>}
    </div>
  );
}

export function VerdictMock() {
  return (
    <div className="lm-card lm-verdict">
      <div className="lm-verdict-head">
        <span className="eyebrow">Northwind Coffee · Website</span>
        <span className="lm-dot-row" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
      </div>
      <p className="lm-verdict-quote serif">“Can we add a pricing page too? Nothing fancy.”</p>
      <div className="lm-read">
        <StampMock kind="extra" delay={900}>
          Extra
        </StampMock>
        <span>Your scope includes 5 pages. This goes beyond that.</span>
      </div>
      <div className="lm-price-row">
        <div>
          <span className="eyebrow">4 hours × $85</span>
          <span className="lm-price num">$340</span>
        </div>
        <div className="lm-date">
          <span className="eyebrow">Delivery</span>
          <span>
            Oct 9 <span className="lm-arrow">→</span> <strong>Oct 10</strong>
          </span>
        </div>
      </div>
      <div className="lm-actions">
        <span className="lm-btn lm-btn-gift">
          <Gift size={14} /> Gift it
        </span>
        <span className="lm-btn lm-btn-accent">Charge $340</span>
      </div>
    </div>
  );
}

export function ScopeMock() {
  return (
    <div className="lm-card lm-scope">
      <div className="lm-scope-head">
        <span className="eyebrow">The scope</span>
        <span className="lm-template">Website</span>
      </div>
      <h4 className="serif lm-scope-title">Website redesign</h4>
      <ul className="lm-list">
        {['Design for 5 pages', 'Responsive layouts', 'Build and launch', 'Contact form', 'Basic on-page SEO'].map((d, i) => (
          <li key={d} style={{ transitionDelay: `${150 + i * 70}ms` }}>
            <span className={`lm-check${i < 2 ? ' on' : ''}`}>{i < 2 && <Check size={10} strokeWidth={3.2} />}</span>
            {d}
          </li>
        ))}
      </ul>
      <div className="lm-rounds">
        <span>Revision rounds</span>
        <span className="pips">
          <span className="pip used" />
          <span className="pip" />
        </span>
      </div>
      <div className="lm-excluded">
        <span className="eyebrow">Not included</span>
        <ul>
          {['Copywriting', 'Additional pages', 'Stock photos', 'Hosting', 'Online store'].map((x, i) => (
            <li key={x} style={{ transitionDelay: `${500 + i * 60}ms` }}>
              {x}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function ComposerMock() {
  return (
    <div className="lm-card lm-composer">
      <span className="serif lm-composer-label">What did they ask for?</span>
      <div className="lm-composer-box">
        <span className="lm-typing">Could you write the copy for the About page?</span>
        <span className="lm-send" aria-hidden="true">
          ↑
        </span>
      </div>
      <div className="lm-read lm-read-late">
        <StampMock kind="extra" delay={2600}>
          Extra
        </StampMock>
        <span>“Copywriting” is listed as not included.</span>
      </div>
    </div>
  );
}

export function ReplyMock() {
  return (
    <div className="lm-card lm-reply">
      <div className="lm-reply-top">
        <StampMock kind="extra">Extra · $255</StampMock>
        <span className="lm-tone">
          <b>Warm</b> Brief
        </span>
      </div>
      <p className="lm-reply-text">
        Hi Maya, love this idea. It’s outside what we scoped, so here’s what it would take:
        <br />
        <br />• Write the copy for the About page
        <br />• $255, about 3 hours of work
        <br />• Moves delivery from Oct 9 to Oct 10
        <br />
        <br />
        If that works, you can approve it here and I’ll get started.
      </p>
      <div className="lm-actions">
        <span className="lm-btn">Copy link only</span>
        <span className="lm-btn lm-btn-ink">Copy reply</span>
      </div>
    </div>
  );
}

export function ClientPageMock() {
  return (
    <div className="lm-browser">
      <div className="lm-browser-bar">
        <span className="lm-lights" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span className="lm-url">optileno.com/s#…</span>
      </div>
      <div className="lm-client">
        <div className="lm-client-by">
          <span className="lm-avatar">S</span>
          <span>
            <strong>Sam Rivera</strong> <span className="muted">· Rivera Studio</span>
          </span>
        </div>
        <span className="eyebrow">Project scope for Northwind Coffee</span>
        <h4 className="serif lm-client-title">Website redesign</h4>
        <div className="lm-client-sums">
          <div>
            <span className="eyebrow">Agreed</span>
            <span className="num">$4,800</span>
          </div>
          <div>
            <span className="eyebrow">Added</span>
            <span className="num">+$340</span>
          </div>
          <div>
            <span className="eyebrow">Total</span>
            <span className="num">$5,140</span>
          </div>
        </div>
        <div className="lm-client-waiting">
          <div className="lm-client-waiting-head">
            <span className="serif">Waiting on you</span>
            <span className="lm-count">1</span>
          </div>
          <div className="lm-approval">
            <div>
              <strong>Write the copy for the About page</strong>
              <span className="hint">Adds about 1 working day</span>
            </div>
            <span className="num lm-approval-price">$255</span>
            <span className="lm-btn lm-btn-ink lm-approve">
              <Mail size={13} /> Approve $255
            </span>
          </div>
        </div>
        <div className="lm-client-row">
          <span>Revision rounds</span>
          <span className="pips">
            <span className="pip used" />
            <span className="pip" />
          </span>
          <span className="hint">1 of 2 used</span>
        </div>
        <div className="lm-client-gift">
          <span>
            <Gift size={14} /> Outline icons in the footer
          </span>
          <span>
            <s className="num">$60</s> <b>Gift</b>
          </span>
        </div>
        <div className="lm-client-made">
          <Mark size={12} /> Made with Optileno
        </div>
      </div>
    </div>
  );
}
