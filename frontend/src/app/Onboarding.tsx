import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Mark } from '../components/Mark';
import { CURRENCIES, currencySymbol, isCurrency, type Currency } from '../lib/money';
import { actions, useAppState } from '../lib/store';

/** One screen, three answers, then straight to work. */
export function Onboarding({ onStart }: { onStart: (mode: 'new' | 'sample') => void }) {
  const { profile } = useAppState();
  const [name, setName] = useState(profile.name);
  const [rate, setRate] = useState(profile.rate ? String(profile.rate) : '');
  const [currency, setCurrency] = useState<Currency>(profile.currency);
  const [email, setEmail] = useState(profile.email);

  const finish = (mode: 'new' | 'sample') => {
    actions.completeOnboarding({
      name: name.trim(),
      rate: Math.max(1, Number(rate) || 75),
      currency,
      email: email.trim(),
    });
    if (mode === 'sample') actions.loadSample();
    onStart(mode);
  };

  return (
    <main className="onboarding">
      <div className="onboarding-card">
        <div className="onboarding-mark">
          <Mark size={30} />
        </div>
        <p className="eyebrow">Set up in 30 seconds · no account</p>
        <h1 className="serif onboarding-title">
          Let’s make sure you get paid for <em className="pen">every</em> hour.
        </h1>

        <form
          className="onboarding-form"
          onSubmit={(e) => {
            e.preventDefault();
            finish('new');
          }}
        >
          <div className="field">
            <label className="label" htmlFor="o-name">
              Your name, as clients see it
            </label>
            <input id="o-name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Sam Rivera" autoComplete="name" autoFocus />
          </div>

          <div className="field">
            <label className="label" htmlFor="o-rate">
              Your hourly rate
            </label>
            <div className="input-affix">
              <span className="affix">{currencySymbol(currency)}</span>
              <input
                id="o-rate"
                className="input num"
                inputMode="decimal"
                value={rate}
                onChange={(e) => setRate(e.target.value.replace(/[^\d.]/g, ''))}
                placeholder="75"
              />
              <select className="select affix-select" aria-label="Currency" value={currency} onChange={(e) => isCurrency(e.target.value) && setCurrency(e.target.value)}>
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code}
                  </option>
                ))}
              </select>
            </div>
            <span className="hint">Used to price extras. Even on fixed-price work, you have one. It’s just hidden.</span>
          </div>

          <div className="field">
            <label className="label" htmlFor="o-email">
              Email for approvals <span className="muted">(optional)</span>
            </label>
            <input id="o-email" className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@studio.com" autoComplete="email" />
            <span className="hint">When a client taps “Approve”, their email app writes to you. We never see it.</span>
          </div>

          <div className="onboarding-actions">
            <button type="submit" className="btn btn-primary btn-lg">
              Set up my first project <ArrowRight size={18} />
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => finish('sample')}>
              Explore a sample first
            </button>
          </div>
        </form>
        <p className="onboarding-foot hint">Everything stays in this browser. Nothing to sign up for.</p>
      </div>
    </main>
  );
}
