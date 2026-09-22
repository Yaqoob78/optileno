import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CalendarCheck2, CircleHelp, ShieldCheck, TriangleAlert } from 'lucide-react';
import { addDays, diffDays, formatDay, formatRelative, todayISO, weekday, type ISODate } from '../lib/dates';
import { evaluateOffer, formatHours, type Project } from '../lib/engine';
import { offerHeadline } from '../app/model';
import { Wordmark } from '../components/Wordmark';

/** Next occurrence of a weekday strictly after today. */
function nextDow(today: ISODate, dow: number): ISODate {
  return addDays(today, ((dow - weekday(today) + 7) % 7) || 7);
}

function useDemo() {
  const today = todayISO();
  return useMemo(() => {
    const projects: Project[] = [
      { id: 'd1', clientId: null, title: 'Pitch deck polish', hoursLeft: 6, deadline: nextDow(today, 3), createdAt: 1 },
      { id: 'd2', clientId: null, title: 'Landing page redesign', hoursLeft: 14, deadline: nextDow(today, 5), createdAt: 2 },
      { id: 'd3', clientId: null, title: 'Product launch video', hoursLeft: 18, deadline: addDays(nextDow(today, 4), 7), createdAt: 3 },
    ];
    const settings = { hoursByWeekday: [0, 5, 5, 5, 5, 5, 0], timeOff: {} };
    const deadlines = [
      { label: 'This Friday', date: nextDow(today, 5) },
      { label: 'Next Wednesday', date: addDays(nextDow(today, 3), 7) },
      { label: 'In 2 weeks', date: addDays(today, 14) },
    ];
    return { today, projects, settings, deadlines };
  }, [today]);
}

function Demo() {
  const { today, projects, settings, deadlines } = useDemo();
  const [hours, setHours] = useState(12);
  const [deadline, setDeadline] = useState(deadlines[1].date);
  const byId = new Map(projects.map((p) => [p.id, p]));

  const result = useMemo(
    () => evaluateOffer({ projects, settings, today }, { hours, deadline }),
    [projects, settings, today, hours, deadline],
  );
  const h = result ? offerHeadline(result, deadline, today) : null;

  return (
    <div className="demo" aria-label="Live demo with a sample week">
      <div className="demo-head">
        <span className="demo-badge">Live demo</span>
        <span className="muted">Sample week · 5 focused hours a day</span>
      </div>

      <ul className="demo-week">
        {projects.map((p, i) => (
          <li key={p.id}>
            <span className="demo-dot" style={{ background: `var(--c${i})` }} />
            <span>{p.title}</span>
            <span className="muted">
              {formatHours(p.hoursLeft)} · due {formatRelative(p.deadline, today)}
            </span>
          </li>
        ))}
      </ul>

      <div className="demo-ask">
        <p className="demo-ask-label">A client asks for another project:</p>
        <label className="demo-slider">
          <span>
            <strong>{hours}h</strong> of work
          </span>
          <input type="range" min={4} max={40} step={2} value={hours} onChange={(e) => setHours(Number(e.target.value))} aria-label="Hours of work requested" />
        </label>
        <div className="chips" role="group" aria-label="Requested deadline">
          {deadlines.map((d) => (
            <button key={d.label} type="button" className={`chip${deadline === d.date ? ' is-on' : ''}`} onClick={() => setDeadline(d.date)}>
              {d.label}
            </button>
          ))}
        </div>
      </div>

      {result && h && (
        <div className={`offer tone-${h.tone} demo-offer`} aria-live="polite" key={`${result.verdict}-${hours}-${deadline}`}>
          <p className="offer-title serif">{h.title}</p>
          <p className="offer-detail">{h.detail}</p>
          {result.displaced.length > 0 && (
            <p className="demo-slip">
              Would slip: {result.displaced.map((d) => `${byId.get(d.projectId)?.title} (${formatHours(d.extraShort)} short)`).join(', ')}
            </p>
          )}
          {result.verdict === 'no' && result.safeDate && (
            <p className="demo-counter">
              Promise <strong>{formatDay(result.safeDate)}</strong> instead —{' '}
              {diffDays(deadline, result.safeDate)} day{diffDays(deadline, result.safeDate) === 1 ? '' : 's'} later, and nothing else moves.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function Landing() {
  useEffect(() => {
    document.title = 'Optileno — Know if you can say yes';
  }, []);

  return (
    <div className="landing">
      <header className="l-nav">
        <Link to="/" className="brand" aria-label="Optileno home">
          <Wordmark />
        </Link>
        <nav className="l-nav-links" aria-label="Page">
          <a href="#how">How it works</a>
          <Link to="/app" className="btn btn-primary btn-sm">
            Open Optileno
          </Link>
        </nav>
      </header>

      <main>
        <section className="l-hero">
          <div className="l-hero-copy">
            <p className="l-eyebrow">For freelancers juggling client work</p>
            <h1 className="serif l-title">Know if you can say yes.</h1>
            <p className="l-lead">
              Before you answer the next client, Optileno checks the request against your real week — and tells you if it fits, what would slip, and the date you can safely promise.
            </p>
            <div className="l-cta">
              <Link to="/app" className="btn btn-primary btn-lg">
                Try it free — no signup <ArrowRight size={16} />
              </Link>
              <span className="l-cta-note">
                <ShieldCheck size={15} /> Your projects stay in your browser.
              </span>
            </div>
          </div>
          <Demo />
        </section>

        <section className="l-problem">
          <p className="serif l-pull">
            You said yes on Monday. By Thursday, three deadlines are fighting over the same six hours.
          </p>
          <div className="l-pains">
            <div>
              <h3>Yes, from memory</h3>
              <p>“Can you start next week?” gets answered on gut feel — while you're on a call, without looking at anything.</p>
            </div>
            <div>
              <h3>Invisible overload</h3>
              <p>Your calendar shows meetings, not the forty hours of work hiding between them.</p>
            </div>
            <div>
              <h3>The bill comes later</h3>
              <p>Rushed work, awkward “small delay” emails, and another weekend spent catching up.</p>
            </div>
          </div>
        </section>

        <section className="l-how" id="how">
          <h2 className="serif l-h2">Three minutes to set up. Seconds to answer.</h2>
          <ol className="l-steps">
            <li>
              <span className="l-step-n serif">1</span>
              <h3>Tell it your real hours</h3>
              <p>Five focused hours a day? Four? Optileno plans around the truth, not an ideal week.</p>
            </li>
            <li>
              <span className="l-step-n serif">2</span>
              <h3>Add projects in plain words</h3>
              <p>
                <em>“Acme — landing page, 12h, Friday.”</em> Client, hours and deadline are picked up for you.
              </p>
            </li>
            <li>
              <span className="l-step-n serif">3</span>
              <h3>Ask before you answer</h3>
              <p>Every request gets a straight answer — yes, tight, or not by then — with a date you can promise and a reply ready to send.</p>
            </li>
          </ol>
        </section>

        <section className="l-features">
          <div className="l-feature">
            <CircleHelp size={22} />
            <h3>Can I say yes?</h3>
            <p>An instant verdict on any new request, including exactly which projects would slip and by how many hours.</p>
          </div>
          <div className="l-feature">
            <TriangleAlert size={22} />
            <h3>Trouble, a week early</h3>
            <p>See which deadline is at risk while there's still time to move it — not the night before it's due.</p>
          </div>
          <div className="l-feature">
            <CalendarCheck2 size={22} />
            <h3>A day you can finish</h3>
            <p>Today's work in deadline order. Log an hour and the whole plan re-flows around it.</p>
          </div>
        </section>

        <section className="l-diff">
          <h2 className="serif l-h2">Built for one person with many clients.</h2>
          <div className="l-diff-grid">
            <p>
              <strong>It shows the math and lets you decide.</strong> Nothing gets silently reshuffled. Every answer comes from your hours, your deadlines and your estimates — so you can trust it and explain it to a client.
            </p>
            <p>
              <strong>Nothing to set up, nothing to leak.</strong> No account, no meeting bots, no chat window. It opens instantly, works offline, and keeps client details on your own device.
            </p>
          </div>
        </section>

        <section className="l-final">
          <h2 className="serif l-final-title">The next client will ask. Know your answer.</h2>
          <p className="l-lead">Free while in early access. No card, no account.</p>
          <Link to="/app" className="btn btn-primary btn-lg">
            Open Optileno <ArrowRight size={16} />
          </Link>
        </section>
      </main>

      <footer className="l-footer">
        <Wordmark />
        <p className="muted">Your data never leaves your browser. Questions or ideas: <a href="mailto:optilenoai@gmail.com">optilenoai@gmail.com</a></p>
        <p className="muted">© {new Date().getFullYear()} Optileno</p>
      </footer>
    </div>
  );
}
