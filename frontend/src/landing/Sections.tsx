import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, Clapperboard, Code2, Feather, Laptop, Link2, MonitorSmartphone, PenTool, Plus, ServerOff, Sparkles, Smartphone } from 'lucide-react';
import { Wordmark } from '../components/Mark';
import { ClientPageMock } from './mockups';
import { onScrollFrame, useViewProgress } from './scroll';

/* ─── You've heard these ─── */

const ROW_A = ['Just one small thing…', 'Quick tweak?', 'Shouldn’t take long', 'While you’re in there…', 'It’s basically the same', 'Tiny favour'];
const ROW_B = ['Last change, promise', 'Can we just try…', 'Won’t take you five minutes', 'Nothing fancy', 'Real quick', 'One more round?'];

export function Phrases() {
  return (
    <section className="lp-phrases" aria-labelledby="phrases-title">
      <h2 id="phrases-title" className="eyebrow lp-phrases-kicker" data-reveal>
        You’ve heard these
      </h2>
      <div className="lp-marquee" aria-hidden="true">
        <div className="lp-marquee-track">
          {[...ROW_A, ...ROW_A].map((p, i) => (
            <span key={i} className="serif">
              {p}
              <i>✦</i>
            </span>
          ))}
        </div>
      </div>
      <div className="lp-marquee lp-marquee-rev" aria-hidden="true">
        <div className="lp-marquee-track">
          {[...ROW_B, ...ROW_B].map((p, i) => (
            <span key={i} className="serif">
              {p}
              <i>✦</i>
            </span>
          ))}
        </div>
      </div>
      <ul className="sr-only">
        {[...ROW_A, ...ROW_B].map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>
      <p className="lp-phrases-line serif" data-reveal>
        Each one is small. Together, they’re a <em className="pen">second project</em> nobody’s paying for.
      </p>
    </section>
  );
}

/* ─── The insight ─── */

export function Insight() {
  return (
    <section className="lp-section lp-insight" aria-labelledby="insight-title">
      <div className="lp-container">
        <h2 id="insight-title" className="serif lp-statement" data-reveal>
          Scope creep isn’t a <span className="lp-strike">client</span> problem.
          <br />
          It’s a <em className="pen">visibility</em> problem.
        </h2>
        <div className="lp-truths">
          {[
            ['01', 'They forgot what they signed.', 'After kickoff, the scope lives in a PDF nobody reopens. To your client, a pricing page genuinely feels small.'],
            ['02', 'You remember, but say nothing.', 'Asking for money mid-project feels petty, so you absorb it. Once. Then every time after that.'],
            ['03', 'So every “small thing” is decided by default.', 'Not by you. Not by them. By silence. That silence is where the money goes.'],
          ].map(([n, t, b]) => (
            <article key={n} className="lp-truth" data-reveal>
              <span className="lp-truth-n num">{n}</span>
              <h3 className="serif">{t}</h3>
              <p>{b}</p>
            </article>
          ))}
        </div>
        <p className="lp-source" data-reveal>
          Around half of all projects experience scope creep. <span className="muted">Project Management Institute, Pulse of the Profession (2018).</span>
        </p>
      </div>
    </section>
  );
}

/* ─── Charge it or gift it ─── */

export function ChargeOrGift() {
  const ref = useRef<HTMLElement>(null);
  useViewProgress(ref, (p) => ref.current?.style.setProperty('--p', p.toFixed(4)));

  return (
    <section ref={ref} className="lp-split" aria-labelledby="split-title">
      <h2 id="split-title" className="sr-only">
        Charge it or gift it
      </h2>
      <div className="lp-split-half lp-split-charge">
        <span className="stamp stamp-extra stamp-lg">Extra · $340</span>
        <h3 className="serif">Charge it.</h3>
        <p>A clear price and a new date, approved in one tap. No surprise invoice at the end, no quiet resentment in the middle.</p>
      </div>
      <div className="lp-split-or serif" aria-hidden="true">
        or
      </div>
      <div className="lp-split-half lp-split-gift">
        <span className="stamp stamp-gift stamp-lg">Gift · $60</span>
        <h3 className="serif">Gift it.</h3>
        <p>Sometimes generosity is the right move. Optileno shows it on your client’s page as a gift, with its value. Gifts people can see get remembered, and returned.</p>
      </div>
      <p className="lp-split-foot serif">
        The only bad option is the <span className="lp-strike">invisible</span> one.
      </p>
    </section>
  );
}

/* ─── For clients ─── */

export function ForClients() {
  const ref = useRef<HTMLDivElement>(null);
  useViewProgress(ref, (p) => ref.current?.style.setProperty('--p', p.toFixed(4)));

  return (
    <section id="clients" className="lp-section lp-clients" aria-labelledby="clients-title">
      <div className="lp-container lp-clients-grid">
        <div className="lp-clients-copy">
          <p className="eyebrow" data-reveal>
            The other side of the table
          </p>
          <h2 id="clients-title" className="serif lp-h2" data-reveal>
            A page your clients <em className="pen">actually read.</em>
          </h2>
          <p className="lp-lede" data-reveal>
            Clients don’t creep on purpose. They just can’t see the edges. Send one link and they can: what’s included, what’s done, what’s extra, what was a gift.
          </p>
          <ul className="lp-ticks">
            {[
              ['One link, nothing to install.', 'No login, no account, no app. It opens in any browser and prints to a tidy PDF.'],
              ['Revision rounds, visible.', '“1 of 2 used” changes how people give feedback. It gets batched, and it gets focused.'],
              ['Extras wait for a tap.', 'They approve, their email app writes to you, and one tap marks it approved in Optileno.'],
              ['Gifts show their value.', 'Complimentary work appears with its price struck through. Goodwill you can point to.'],
            ].map(([t, b]) => (
              <li key={t} data-reveal>
                <Check size={16} strokeWidth={2.4} />
                <div>
                  <strong>{t}</strong>
                  <span>{b}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className="lp-clients-visual" ref={ref}>
          <ClientPageMock />
        </div>
      </div>
    </section>
  );
}

/* ─── Privacy ─── */

export function Privacy() {
  return (
    <section className="lp-section lp-privacy" aria-labelledby="privacy-title">
      <div className="lp-container">
        <header className="lp-section-head lp-center" data-reveal>
          <p className="eyebrow">Private by design</p>
          <h2 id="privacy-title" className="serif lp-h2">
            Your clients’ business <em className="pen">stays yours.</em>
          </h2>
          <p className="lp-lede">No account. No database of your projects. Nothing to breach, sell or train on.</p>
        </header>
        <div className="lp-flow" data-reveal>
          <div className="lp-flow-node">
            <Laptop size={26} strokeWidth={1.5} />
            <strong>Your device</strong>
            <span>Projects, prices and clients live in your browser.</span>
          </div>
          <div className="lp-flow-line">
            <span className="lp-flow-link">
              <Link2 size={14} /> optileno.com/s#<i>the page itself</i>
            </span>
          </div>
          <div className="lp-flow-node">
            <Smartphone size={26} strokeWidth={1.5} />
            <strong>Your client</strong>
            <span>Opens the link. The page is rebuilt from the link itself.</span>
          </div>
          <div className="lp-flow-server">
            <ServerOff size={20} strokeWidth={1.6} />
            <span>Our servers never see what’s after the “#”. Browsers don’t send it.</span>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Who it's for ─── */

const PERSONAS = [
  { icon: MonitorSmartphone, who: 'Web designers & developers', quote: 'Can we add a page?', how: 'Checked against your page count, priced from your rate.' },
  { icon: PenTool, who: 'Brand & logo designers', quote: 'Could we see a few more options?', how: 'Concepts are counted. The fourth one has a price.' },
  { icon: Clapperboard, who: 'Video editors', quote: 'Can we get a vertical cut too?', how: 'Aspect ratios and cutdowns, flagged on sight.' },
  { icon: Feather, who: 'Writers', quote: 'Could you also do the social posts?', how: 'Your “not included” list does the talking.' },
  { icon: Code2, who: 'Freelance developers', quote: 'While you’re in there…', how: 'New features and bug fixes, told apart.' },
  { icon: Sparkles, who: 'Motion designers', quote: 'Could it bounce a little more?', how: 'Revision rounds counted, not guessed.' },
];

export function Personas() {
  return (
    <section className="lp-section lp-personas" aria-labelledby="personas-title">
      <div className="lp-container">
        <header className="lp-section-head" data-reveal>
          <p className="eyebrow">Who it’s for</p>
          <h2 id="personas-title" className="serif lp-h2">
            Built for people who <em className="pen">quote a fixed price.</em>
          </h2>
          <p className="lp-lede">Hourly work bills itself. Fixed-price work is where the free hours hide.</p>
        </header>
        <div className="lp-persona-grid">
          {PERSONAS.map(({ icon: Icon, who, quote, how }) => (
            <article key={who} className="lp-persona" data-reveal>
              <Icon size={20} strokeWidth={1.6} />
              <h3>{who}</h3>
              <p className="serif lp-persona-quote">“{quote}”</p>
              <p className="lp-persona-how">{how}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Pricing ─── */

export function Pricing() {
  return (
    <section id="pricing" className="lp-section lp-pricing" aria-labelledby="pricing-title">
      <div className="lp-container">
        <header className="lp-section-head lp-center" data-reveal>
          <p className="eyebrow">Pricing</p>
          <h2 id="pricing-title" className="serif lp-h2">
            Free while we’re in <em className="pen">early access.</em>
          </h2>
          <p className="lp-lede">Everything below works today, for free. A paid plan will come later for people who want more. We’ll say so here first.</p>
        </header>
        <div className="lp-plans">
          <article className="lp-plan lp-plan-main" data-reveal>
            <div className="lp-plan-head">
              <h3>Early access</h3>
              <span className="lp-plan-badge">Available now</span>
            </div>
            <p className="lp-plan-price">
              <span className="serif">$0</span>
              <span className="muted">no card, no account</span>
            </p>
            <ul>
              {['Unlimited projects and requests', 'Scope checks with reasons', 'Reply drafts, warm or brief', 'Client scope pages with one-tap approval', 'Gifts, shown with their value', 'Backup and restore'].map((f) => (
                <li key={f}>
                  <Check size={15} strokeWidth={2.4} /> {f}
                </li>
              ))}
            </ul>
            <Link to="/app" className="btn btn-primary btn-lg btn-block">
              Start free <ArrowRight size={18} />
            </Link>
          </article>
          <article className="lp-plan" data-reveal>
            <div className="lp-plan-head">
              <h3>Pro</h3>
              <span className="lp-plan-badge muted-badge">Planned</span>
            </div>
            <p className="lp-plan-price">
              <span className="serif">$12</span>
              <span className="muted">a month, when it launches</span>
            </p>
            <ul>
              {['Your logo and colors on client pages', 'Change orders as signed PDFs', 'Sync across your devices', 'Reminders for unapproved extras'].map((f) => (
                <li key={f}>
                  <Plus size={15} strokeWidth={2.4} /> {f}
                </li>
              ))}
            </ul>
            <p className="lp-plan-note">One approved extra a month pays for it several times over.</p>
          </article>
        </div>
      </div>
    </section>
  );
}

/* ─── FAQ ─── */

const FAQS = [
  ['Is it really free?', 'Yes. Everything on this page works today at no cost, with no account and no card. A paid Pro plan is planned for extras like branded client pages. If that changes anything for you, we’ll announce it on this site first, and your data is always yours to export.'],
  ['Does it use AI to read my contract?', 'No. You set up the scope in a minute from a template, and Optileno reads each request against it using plain, transparent rules that run in your browser. It always tells you why it thinks something is in scope or extra, and you always make the final call.'],
  ['Do my clients need an account?', 'No. They open a link. The page works in any browser, on any device, and can be saved as a PDF.'],
  ['Where is my data stored?', 'In your browser, on your device. Nothing about your projects is sent to us. Client pages carry their content inside the link itself. Download a backup from Settings now and then, because clearing your browser clears Optileno too.'],
  ['What if my client says no to an extra?', 'Then it doesn’t happen, and nobody’s upset: they saw a clear price and chose. Mark it declined, or turn it into a gift if you’d rather do it anyway. Either way, it’s a decision, not a leak.'],
  ['Won’t charging for small things annoy clients?', 'Surprises annoy clients. A calm, specific note (“that’s outside what we scoped, here’s what it would take”) reads as professional. And the gift option means you can still be generous, visibly.'],
  ['Does it work for hourly projects?', 'It’s built for fixed-price work, where free hours hide. Hourly freelancers still use it to get written approval before starting anything new.'],
  ['Which currencies?', 'US dollar, euro, British pound, Indian rupee, Canadian dollar and Australian dollar.'],
];

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="lp-section lp-faq" aria-labelledby="faq-title">
      <div className="lp-container lp-faq-grid">
        <header data-reveal>
          <p className="eyebrow">Questions</p>
          <h2 id="faq-title" className="serif lp-h2">
            Fair <em className="pen">questions.</em>
          </h2>
          <p className="lp-lede">
            Something else? <a href="mailto:optilenoai@gmail.com">Write to us</a>. A person reads every email.
          </p>
        </header>
        <div className="lp-faq-list">
          {FAQS.map(([q, a], i) => (
            <div key={q} className={`lp-faq-item${open === i ? ' open' : ''}`} data-reveal>
              <h3>
                <button type="button" aria-expanded={open === i} aria-controls={`faq-${i}`} onClick={() => setOpen(open === i ? null : i)}>
                  <span>{q}</span>
                  <Plus size={18} className="lp-faq-icon" />
                </button>
              </h3>
              <div id={`faq-${i}`} className="lp-faq-a" role="region">
                <div>
                  <p>{a}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Final call ─── */

export function FinalCta() {
  return (
    <section className="lp-final" aria-labelledby="final-title">
      <div className="lp-final-drift serif" aria-hidden="true">
        <span>quick tweak?</span>
        <span>one more thing</span>
        <span>nothing fancy</span>
      </div>
      <div className="lp-container lp-final-inner">
        <h2 id="final-title" className="serif" data-reveal>
          Your next “quick tweak”
          <br />
          is already on <em>its way.</em>
        </h2>
        <p data-reveal>Be ready for it. Set up your current project in a minute, and decide what every small change is worth.</p>
        <div data-reveal>
          <Link to="/app" className="btn btn-accent btn-lg">
            Open Optileno, it’s free <ArrowRight size={18} />
          </Link>
        </div>
      </div>
      <footer className="lp-footer">
        <div className="lp-container lp-footer-inner">
          <div className="lp-footer-brand">
            <Wordmark />
            <p className="serif">Charge it. Gift it. Never lose it.</p>
          </div>
          <nav className="lp-footer-links" aria-label="Footer">
            <Link to="/app">Open the app</Link>
            <Link to="/privacy">Privacy</Link>
            <Link to="/terms">Terms</Link>
            <a href="mailto:optilenoai@gmail.com">Contact</a>
          </nav>
          <p className="lp-footer-fine">© {new Date().getFullYear()} Optileno. Made for people who make things.</p>
        </div>
      </footer>
    </section>
  );
}

/* ─── Sticky mobile CTA ─── */

export function MobileCta() {
  const [show, setShow] = useState(false);
  useEffect(
    () =>
      onScrollFrame(() => {
        const nearEnd = window.scrollY + window.innerHeight > document.documentElement.scrollHeight - window.innerHeight * 1.2;
        setShow(window.scrollY > window.innerHeight * 0.9 && !nearEnd);
      }),
    [],
  );
  return (
    <div className={`lp-mobile-cta${show ? ' show' : ''}`} aria-hidden={!show}>
      <Link to="/app" className="btn btn-primary btn-block" tabIndex={show ? 0 : -1}>
        Start free, no signup <ArrowRight size={16} />
      </Link>
    </div>
  );
}
