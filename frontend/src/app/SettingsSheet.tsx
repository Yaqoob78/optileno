import { useEffect, useRef, useState } from 'react';
import { Bookmark, Download, Upload } from 'lucide-react';
import { Sheet } from '../components/Sheet';
import { useToast } from '../components/Toast';
import { CURRENCIES, currencySymbol, isCurrency } from '../lib/money';
import type { Theme, Tone } from '../lib/model';
import { siteOrigin } from '../lib/share';
import { actions, exportData, useAppState } from '../lib/store';
import { bookmarkletSource } from './capture';

export function SettingsSheet({ onClose }: { onClose: () => void }) {
  const { profile, settings } = useAppState();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirmErase, setConfirmErase] = useState(false);

  const download = () => {
    const blob = new Blob([exportData()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `optileno-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ message: 'Backup downloaded.' });
  };

  const upload = async (file: File) => {
    try {
      const ok = actions.importData(JSON.parse(await file.text()));
      toast({ message: ok ? 'Backup restored.' : 'That file isn’t an Optileno backup.' });
    } catch {
      toast({ message: 'Couldn’t read that file.' });
    }
  };

  return (
    <Sheet open onClose={onClose} title="Settings" width={560}>
      <section className="settings-section">
        <h3 className="settings-title">You</h3>
        <div className="row">
          <div className="field">
            <label className="label" htmlFor="st-name">
              Name clients see
            </label>
            <input id="st-name" className="input" value={profile.name} onChange={(e) => actions.updateProfile({ name: e.target.value })} />
          </div>
          <div className="field">
            <label className="label" htmlFor="st-business">
              Studio or business <span className="muted">(optional)</span>
            </label>
            <input id="st-business" className="input" value={profile.business} onChange={(e) => actions.updateProfile({ business: e.target.value })} />
          </div>
        </div>
        <div className="field">
          <label className="label" htmlFor="st-email">
            Email for approvals
          </label>
          <input id="st-email" className="input" type="email" value={profile.email} onChange={(e) => actions.updateProfile({ email: e.target.value.trim() })} placeholder="you@studio.com" />
        </div>
      </section>

      <section className="settings-section">
        <h3 className="settings-title">Pricing extras</h3>
        <div className="row">
          <div className="field">
            <label className="label" htmlFor="st-rate">
              Hourly rate
            </label>
            <div className="input-affix">
              <span className="affix">{currencySymbol(profile.currency)}</span>
              <input
                id="st-rate"
                className="input num"
                inputMode="decimal"
                value={profile.rate || ''}
                onChange={(e) => actions.updateProfile({ rate: Math.max(0, Number(e.target.value.replace(/[^\d.]/g, '')) || 0) })}
              />
              <select
                className="select affix-select"
                aria-label="Currency"
                value={profile.currency}
                onChange={(e) => isCurrency(e.target.value) && actions.updateProfile({ currency: e.target.value })}
              >
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="field">
            <label className="label" htmlFor="st-hours">
              Focused hours a day
            </label>
            <input
              id="st-hours"
              className="input num"
              inputMode="decimal"
              value={profile.hoursPerDay || ''}
              onChange={(e) => actions.updateProfile({ hoursPerDay: Math.min(16, Math.max(1, Number(e.target.value) || 6)) })}
            />
            <span className="hint">Turns hours of extra work into days of delay.</span>
          </div>
        </div>
      </section>

      <CaptureSection onDragHint={() => toast({ message: 'Drag this button to your bookmarks bar.' })} />

      <section className="settings-section">
        <h3 className="settings-title">Feel</h3>
        <div className="settings-line">
          <span>Reply tone</span>
          <div className="segmented segmented-sm" role="group" aria-label="Reply tone">
            {(['warm', 'brief'] as Tone[]).map((t) => (
              <button key={t} type="button" aria-pressed={settings.tone === t} onClick={() => actions.setTone(t)}>
                {t === 'warm' ? 'Warm' : 'Brief'}
              </button>
            ))}
          </div>
        </div>
        <div className="settings-line">
          <span>Appearance</span>
          <div className="segmented segmented-sm" role="group" aria-label="Appearance">
            {(['system', 'light', 'dark'] as Theme[]).map((t) => (
              <button key={t} type="button" aria-pressed={settings.theme === t} onClick={() => actions.setTheme(t)}>
                {t === 'system' ? 'Auto' : t === 'light' ? 'Light' : 'Dark'}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="settings-section">
        <h3 className="settings-title">Your data</h3>
        <p className="hint settings-copy">
          Everything lives in this browser. Nothing is sent anywhere. Download a backup now and then, especially before clearing your browser.
        </p>
        <div className="settings-actions">
          <button type="button" className="btn btn-sm" onClick={download}>
            <Download size={15} /> Download backup
          </button>
          <button type="button" className="btn btn-sm" onClick={() => fileRef.current?.click()}>
            <Upload size={15} /> Restore
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload(f);
              e.target.value = '';
            }}
          />
          {confirmErase ? (
            <span className="erase-confirm">
              <span className="hint">Erase all projects and settings?</span>
              <button
                type="button"
                className="btn btn-sm btn-accent"
                onClick={() => {
                  actions.eraseEverything();
                  onClose();
                }}
              >
                Erase
              </button>
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => setConfirmErase(false)}>
                Keep
              </button>
            </span>
          ) : (
            <button type="button" className="btn btn-sm btn-ghost danger-text" onClick={() => setConfirmErase(true)}>
              Erase everything
            </button>
          )}
        </div>
      </section>

      <p className="settings-about hint">
        Optileno 3.0 ·{' '}
        <a href="/privacy" className="link-btn">
          Privacy
        </a>{' '}
        ·{' '}
        <a href="mailto:optilenoai@gmail.com" className="link-btn">
          Contact
        </a>
      </p>
    </Sheet>
  );
}

/** A bookmark that sends selected text from Gmail, Slack or any page straight into Optileno. */
function CaptureSection({ onDragHint }: { onDragHint: () => void }) {
  const link = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    // React blocks javascript: URLs in props, so the bookmark's address is set directly
    link.current?.setAttribute('href', bookmarkletSource(siteOrigin()));
  }, []);
  return (
    <section className="settings-section">
      <h3 className="settings-title">Capture from anywhere</h3>
      <p className="hint settings-copy">
        Drag this button to your bookmarks bar. Select a client’s message in Gmail, Slack or anywhere, click the bookmark, and it lands in Optileno, ready to check.
      </p>
      <a
        ref={link}
        className="btn btn-sm bookmarklet"
        draggable
        onClick={(e) => {
          e.preventDefault();
          onDragHint();
        }}
      >
        <Bookmark size={15} /> Check with Optileno
      </a>
      <p className="hint settings-copy" style={{ marginTop: 12 }}>
        On Android, add Optileno to your home screen (browser menu → Install app) and it can appear in the Share menu.
      </p>
    </section>
  );
}
