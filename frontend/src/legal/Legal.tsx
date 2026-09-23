import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Wordmark } from '../components/Mark';
import '../styles/legal.css';

const UPDATED = 'September 23, 2026';

/** Short, plain-language policies. Optileno collects nothing, so there is little to say. */
export function Legal({ page }: { page: 'privacy' | 'terms' }) {
  useEffect(() => {
    document.title = page === 'privacy' ? 'Privacy · Optileno' : 'Terms · Optileno';
  }, [page]);

  return (
    <div className="legal">
      <header className="legal-bar">
        <Wordmark />
        <Link to="/app" className="btn btn-sm">
          Open Optileno
        </Link>
      </header>
      <main className="legal-doc">
        <p className="eyebrow">Updated {UPDATED}</p>
        {page === 'privacy' ? <Privacy /> : <Terms />}
        <p className="legal-contact">
          Questions? Write to <a href="mailto:optilenoai@gmail.com">optilenoai@gmail.com</a>.
        </p>
        <nav className="legal-nav">
          <Link to="/privacy">Privacy</Link>
          <Link to="/terms">Terms</Link>
          <Link to="/">Home</Link>
        </nav>
      </main>
    </div>
  );
}

function Privacy() {
  return (
    <>
      <h1 className="serif">Privacy</h1>
      <p className="legal-lede">The short version: your projects, clients and prices stay on your device. We don’t have them, so we can’t lose them, sell them or read them.</p>

      <h2>What we store</h2>
      <p>Nothing about your work. Optileno runs in your browser and saves everything in your browser’s local storage. There are no accounts, and there is no database of users.</p>

      <h2>Scope links</h2>
      <p>
        When you share a scope page, its content is packed into the link itself, after the “#”. Browsers never send that part of a link to a server, so the page’s content never reaches ours. Anyone you give the link to can read it, the same as an email. Treat it that way.
      </p>

      <h2>Approvals</h2>
      <p>When your client taps “Approve”, their own email app opens a message addressed to you. It travels through their email provider, not through us.</p>

      <h2>What our host sees</h2>
      <p>
        The site is served by Vercel, which, like any web host, processes basic request data (such as IP address and browser type) to deliver pages and keep them secure. Fonts load from Google Fonts.
      </p>

      <h2>Page counts</h2>
      <p>
        We use Vercel Web Analytics to count visits in aggregate: which pages are viewed, roughly where from, and on what kind of device. It uses no cookies and doesn’t identify you across sites. Before anything is counted, we strip everything after the “#” in the address and any request text you send to the app, so the content of scope pages and client messages is never included. No ads, no tracking pixels, no cookies.
      </p>

      <h2>Your control</h2>
      <p>You can download a backup, restore it, or erase everything from Settings at any time. Clearing your browser’s site data also removes it, so keep a backup.</p>
    </>
  );
}

function Terms() {
  return (
    <>
      <h1 className="serif">Terms</h1>
      <p className="legal-lede">Plain terms for a simple tool. By using Optileno you agree to them.</p>

      <h2>The service</h2>
      <p>
        Optileno helps you track what a project includes, log client requests, and share a summary with your client. It is free during early access. If we introduce paid plans, we’ll say so on this site before anything changes, and you can keep using, exporting or deleting your data.
      </p>

      <h2>Your data, your responsibility</h2>
      <p>Your data lives in your browser. We can’t recover it if it’s cleared, so please keep backups. You’re responsible for what you share with clients and for the agreements you make with them.</p>

      <h2>Not legal or financial advice</h2>
      <p>
        Optileno’s suggestions (whether a request is in scope, what it might cost) are rules of thumb to help you decide. You make the call. Your contract with your client is what counts, not Optileno’s read of it.
      </p>

      <h2>No warranty</h2>
      <p>Optileno is provided as is, without warranties of any kind. To the extent the law allows, we’re not liable for lost data, lost income or other indirect losses from using it.</p>

      <h2>Fair use</h2>
      <p>Don’t use Optileno to mislead or defraud anyone, or to break the law.</p>
    </>
  );
}
