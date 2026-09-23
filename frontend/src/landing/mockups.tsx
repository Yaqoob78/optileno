import { Gift, Mail } from 'lucide-react';
import { Mark } from '../components/Mark';

/* The client's scope page as live HTML (never a screenshot), so it stays crisp
   at any size and always matches the real page's language. */

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
