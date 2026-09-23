import { useRef, useState } from 'react';
import { CountUp } from '../components/CountUp';
import { useSectionProgress } from './scroll';

const RATE = 85;

const MESSAGES = [
  { day: 'Day 6', text: 'Love the direction! Could we add a pricing page too? Nothing fancy.', hours: 4, kind: 'extra', label: 'Extra · $340' },
  { day: 'Day 9', text: 'Quick one: can you write the About copy? We’re a bit stuck.', hours: 3, kind: 'extra', label: 'Extra · $255' },
  { day: 'Day 12', text: 'While you’re in there, could the blog have categories?', hours: 2, kind: 'gift', label: 'Gift · $170' },
  { day: 'Day 15', text: 'Could you whip up a few launch graphics for Instagram?', hours: 3, kind: 'extra', label: 'Extra · $255' },
  { day: 'Day 18', text: 'Last thing, promise 🙏 One more round on the homepage?', hours: 1, kind: 'extra', label: 'Extra round · $85' },
] as const;

const CHAPTERS = [
  { tag: 'Day 1', title: 'It starts clean.', body: 'Five pages, two revision rounds, $4,800. You both signed. Everyone’s happy.' },
  { tag: 'Day 6', title: '“Nothing fancy.”', body: 'A pricing page. It honestly sounds small. You say “sure!” because you like them.' },
  { tag: 'Day 9', title: '“Quick one.”', body: 'Copywriting was never part of the deal. But they’re stuck, and you’re nice.' },
  { tag: 'Day 12', title: '“While you’re in there…”', body: 'Categories mean templates, filters and testing. An afternoon, gone quietly.' },
  { tag: 'Day 15', title: '“Could you whip up…”', body: 'Social graphics. A different job entirely, arriving dressed as a favour.' },
  { tag: 'Day 18', title: '“Last thing, promise.”', body: 'Round three of two. Nobody’s counting. Except you, silently, at 11pm.' },
  { tag: 'Day 21', title: '13 hours. $1,105.', body: 'Nobody decided to give that away. Not you, not them. It leaked, one reasonable request at a time.' },
  { tag: 'With Optileno', title: 'Now, on purpose.', body: 'Same client, same requests, same friendly tone. Each one read against the scope, then charged or gifted. Maya approved every extra in one tap.' },
];

const money = (n: number) => `$${n.toLocaleString('en-US')}`;

export function Story() {
  const ref = useRef<HTMLElement>(null);
  const [step, setStep] = useState(0);

  useSectionProgress(ref, (p) => {
    const next = Math.min(CHAPTERS.length - 1, Math.floor(p * CHAPTERS.length * 0.999));
    setStep((s) => (s === next ? s : next));
  });

  const shown = Math.min(step, MESSAGES.length);
  const unpaidHours = MESSAGES.slice(0, shown).reduce((s, m) => s + m.hours, 0);
  const resolved = step === CHAPTERS.length - 1;
  const recovered = MESSAGES.filter((m) => m.kind === 'extra').reduce((s, m) => s + m.hours * RATE, 0);
  const gifted = MESSAGES.filter((m) => m.kind === 'gift').reduce((s, m) => s + m.hours * RATE, 0);

  return (
    <section id="story" ref={ref} className="lp-story" aria-label="How a quick tweak turns into free work" style={{ ['--steps' as string]: CHAPTERS.length }}>
      <div className="lp-story-sticky">
        <div className="lp-story-grid">
          <div className="lp-story-text">
            <p className="eyebrow lp-story-kicker">Anatomy of a quick tweak</p>
            <div className="lp-chapters">
              {CHAPTERS.map((c, i) => (
                <div key={c.tag} className={`lp-chapter${i === step ? ' on' : ''}${i < step ? ' past' : ''}`} aria-hidden={i !== step}>
                  <span className={`lp-chapter-tag${i === CHAPTERS.length - 1 ? ' good' : ''}`}>{c.tag}</span>
                  <h2 className={`serif lp-chapter-title${i === 6 ? ' leak' : ''}`}>{c.title}</h2>
                  <p className="lp-chapter-body">{c.body}</p>
                </div>
              ))}
            </div>
            <ol className="lp-story-dots" aria-hidden="true">
              {CHAPTERS.map((c, i) => (
                <li key={c.tag} className={i <= step ? 'on' : ''} />
              ))}
            </ol>
          </div>

          <div className={`lp-phone${resolved ? ' resolved' : ''}`}>
            <div className="lp-phone-bar">
              <span className="lp-phone-avatar">M</span>
              <div>
                <strong>Maya</strong>
                <span>Northwind Coffee</span>
              </div>
            </div>
            <div className="lp-phone-thread">
              <div className="lp-phone-scope">
                <span className="eyebrow">Signed · Day 1</span>
                <strong>Website redesign</strong>
                <span>5 pages · 2 revision rounds · $4,800</span>
              </div>
              {MESSAGES.map((m, i) => (
                <div key={m.day} className={`lp-msg${i < shown ? ' in' : ''}`}>
                  <span className="lp-msg-day">{m.day}</span>
                  <p>{m.text}</p>
                  <span className={`stamp stamp-${m.kind} lp-msg-stamp${resolved ? ' pressing' : ''}`} style={{ animationDelay: `${i * 140}ms` }}>
                    {m.label}
                  </span>
                  {resolved && m.kind === 'extra' && (
                    <span className="lp-msg-approved" style={{ animationDelay: `${700 + i * 140}ms` }}>
                      Approved ✓
                    </span>
                  )}
                </div>
              ))}
            </div>
            <div className="lp-meter">
              {resolved ? (
                <>
                  <div>
                    <span className="eyebrow">Recovered</span>
                    <span className="num lp-meter-good">
                      <CountUp value={recovered} format={money} />
                    </span>
                  </div>
                  <div>
                    <span className="eyebrow">Gifted, on purpose</span>
                    <span className="num lp-meter-gift">
                      <CountUp value={gifted} format={money} />
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <span className="eyebrow">Unpaid work so far</span>
                    <span className={`num lp-meter-bad${unpaidHours ? ' hot' : ''}`}>
                      <CountUp value={unpaidHours * RATE} format={money} />
                    </span>
                  </div>
                  <div className="lp-meter-hours">
                    <span className="eyebrow">Hours</span>
                    <span className="num">
                      <CountUp value={unpaidHours} format={(n) => `${n}h`} duration={600} />
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
