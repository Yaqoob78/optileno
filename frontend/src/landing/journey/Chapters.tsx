import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowRight, Check, ExternalLink, Gift, Hash, Mail, MessageCircle, Phone, Send } from 'lucide-react';
import { buildSample } from '../../lib/sample';
import { scopeLink } from '../../lib/share';
import { DEFAULT_STATE } from '../../lib/store';
import { ClientPageMock } from '../mockups';
import { scrollToId } from '../scroll';
import { ActionDemo } from './ActionDemo';
import { Note } from './Note';

function Eyebrow({ n, children }: { n: string; children: string }) {
  return (
    <p className="jr-eyebrow">
      <span className="jr-eyebrow-n">{n}</span>
      {children}
    </p>
  );
}

/* ─── 00 · Hero ─── */

export function HeroChapter() {
  return (
    <div className="jr-content jr-hero">
      <div className="jr-copy">
        <p className="jr-pill">
          <span className="jr-pill-dot" /> Scope protection for freelancers
        </p>
        <h1 className="jr-h1 serif">
          Clear scope.
          <br />
          Happier clients.
          <br />
          <em>A freer you.</em>
        </h1>
        <p className="jr-lede">
          Paste any client request. Optileno tells you if it’s in scope, a revision, or extra, then helps you <strong>charge it</strong> or <strong>gift it</strong>. No awkward conversations. No free work by accident.
        </p>
        <div className="jr-ctas">
          <Link to="/app" className="btn btn-primary btn-lg">
            Start for free <ArrowRight size={18} />
          </Link>
          <button type="button" className="btn btn-glass btn-lg" onClick={() => scrollToId('ch-problem')}>
            Follow the story <ArrowDown size={17} />
          </button>
        </div>
        <p className="jr-micro">Free during early access · No account · Your projects stay on your device</p>
      </div>
      <Note arrow="down-left" className="jr-note-hero">
        ideas
        <br />
        skills
        <br />
        fair work
        <br />
        freedom
      </Note>
      <div className="jr-scroll-cue" aria-hidden="true">
        <span />
      </div>
    </div>
  );
}

/* ─── 01 · The problem ─── */

const CREEP = [
  { text: 'Can we add a quick blog section?', when: 'Day 6' },
  { text: 'Can we change the illustrations to blue?', when: 'Day 9' },
  { text: 'One more round of revisions? 🙏', when: 'Day 14' },
  { text: 'Could you also make a mobile app?', when: 'Day 18' },
];

export function ProblemChapter() {
  return (
    <div className="jr-content">
      <div className="jr-copy">
        <Eyebrow n="01">The problem</Eyebrow>
        <h2 className="jr-h2 serif">
          It always starts with a <em>“small tweak.”</em>
        </h2>
        <p className="jr-lede">
          You agree on a $3,000 project. Then the small requests start. They add up. You do the extra work, and your profit quietly disappears.
        </p>
        <button type="button" className="btn btn-glass" onClick={() => scrollToId('ch-solution')}>
          This sounds familiar <ArrowRight size={16} />
        </button>
      </div>
      <div className="jr-visual jr-creep">
        <ul className="jr-chat">
          {CREEP.map((m, i) => (
            <li key={m.when} className="jr-chat-msg" data-step={i + 1}>
              <span className="jr-avatar">M</span>
              <span>
                <span className="jr-chat-text">{m.text}</span>
                <span className="jr-chat-when">{m.when}</span>
              </span>
            </li>
          ))}
        </ul>
        <div className="jr-books" data-step={5} aria-label="What it costs">
          {['Unpaid hours', 'Scope creep', 'Burnout', 'Lower profit'].map((b, i) => (
            <span key={b} className="jr-book" style={{ ['--i' as string]: i }}>
              {b}
            </span>
          ))}
        </div>
        <Note arrow="down-left" className="jr-note-problem" step={3}>
          Small requests.
          <br />
          Big impact.
        </Note>
      </div>
    </div>
  );
}

/* ─── 02 · The solution ─── */

const STEPS = [
  { n: '1', title: 'Set up', body: 'Define your scope in a minute, from a template.' },
  { n: '2', title: 'Get a verdict', body: 'Paste any request. See if it’s in scope, a revision, or extra.' },
  { n: '3', title: 'Charge or gift', body: 'Price it from your rate, or make it a visible gift.' },
  { n: '4', title: 'Keep everyone aligned', body: 'Share one client page. Everyone sees the same truth.' },
];

export function SolutionChapter() {
  return (
    <div className="jr-content">
      <div className="jr-copy">
        <Eyebrow n="02">The solution</Eyebrow>
        <h2 className="jr-h2 serif">
          Turn ambiguity into <em>clarity.</em>
        </h2>
        <p className="jr-lede">Set your scope, check every request, and decide with confidence. Charge it or gift it. Optileno handles the rest.</p>
        <button type="button" className="btn btn-glass" onClick={() => scrollToId('ch-action')}>
          See it work <ArrowRight size={16} />
        </button>
      </div>
      <div className="jr-visual jr-stairs">
        <svg className="jr-stairs-path" viewBox="0 0 600 420" preserveAspectRatio="none" aria-hidden="true">
          <path d="M470 405 C 430 360, 500 330, 470 290 S 440 220, 500 190 S 560 120, 520 30" pathLength={1} />
        </svg>
        {STEPS.map((s, i) => (
          <div key={s.n} className="jr-step" data-step={i + 1} style={{ ['--i' as string]: i }}>
            <span className="jr-step-n serif">{s.n}</span>
            <strong>{s.title}</strong>
            <span>{s.body}</span>
          </div>
        ))}
        <Note arrow="none" className="jr-note-solution" step={4}>
          Less confusion.
          <br />
          More progress.
        </Note>
      </div>
    </div>
  );
}

/* ─── 03 · See it in action ─── */

export function ActionChapter() {
  return (
    <div className="jr-content jr-content-wide">
      <div className="jr-copy">
        <Eyebrow n="03">See it in action</Eyebrow>
        <h2 className="jr-h2 serif">
          From client request to <em>clear next step.</em>
        </h2>
        <p className="jr-lede">Paste a request from email, Slack, WhatsApp or your call notes. Get an instant verdict, a fair price, and a reply that sounds like you.</p>
        <div className="jr-channels" aria-label="Works with requests from">
          <span>
            <Mail size={15} /> Email
          </span>
          <span>
            <Hash size={15} /> Slack
          </span>
          <span>
            <MessageCircle size={15} /> WhatsApp
          </span>
          <span>
            <Phone size={15} /> Calls
          </span>
        </div>
      </div>
      <div className="jr-visual">
        <ActionDemo />
        <Note arrow="up-left" className="jr-note-action" step={2}>
          No more awkward
          <br />
          conversations.
        </Note>
      </div>
    </div>
  );
}

/* ─── 04 · Charge it or gift it ─── */

export function ChoiceChapter() {
  const [picked, setPicked] = useState<'charge' | 'gift' | null>(null);
  return (
    <div className="jr-content jr-content-wide">
      <div className="jr-copy">
        <Eyebrow n="04">Charge it or gift it</Eyebrow>
        <h2 className="jr-h2 serif">
          Same work. Different outcome. <em>You’re in control.</em>
        </h2>
        <p className="jr-lede">If it’s extra, your client approves the cost in one tap. Or do it for free, recorded as a visible gift they can see.</p>
      </div>
      <div className="jr-visual jr-choice">
        <div className={`jr-card jr-option jr-option-charge${picked === 'charge' ? ' picked' : ''}`} data-step={1}>
          <span className="jr-option-icon">$</span>
          <h3 className="serif">Charge it</h3>
          <ul>
            <li>
              <Check size={15} /> One-tap client approval
            </li>
            <li>
              <Check size={15} /> Price and new date worked out
            </li>
            <li>
              <Check size={15} /> A clear record, no surprise invoice
            </li>
          </ul>
          <button type="button" className="btn btn-accent btn-block" onClick={() => setPicked('charge')}>
            <Send size={15} /> Send for approval · $350
          </button>
          {picked === 'charge' && <span className="stamp stamp-extra stamp-lg pressing jr-option-stamp">Approved · $350</span>}
        </div>
        <div className={`jr-card jr-option jr-option-gift${picked === 'gift' ? ' picked' : ''}`} data-step={2}>
          <span className="jr-option-icon">
            <Gift size={20} />
          </span>
          <h3 className="serif">Gift it</h3>
          <ul>
            <li>
              <Check size={15} /> Mark it as a gift, on purpose
            </li>
            <li>
              <Check size={15} /> Your client sees its value
            </li>
            <li>
              <Check size={15} /> Goodwill you can point to
            </li>
          </ul>
          <button type="button" className="btn btn-gift btn-block" onClick={() => setPicked('gift')}>
            <Gift size={15} /> Mark as a gift
          </button>
          {picked === 'gift' && <span className="stamp stamp-gift stamp-lg pressing jr-option-stamp">Gift · $350 value</span>}
        </div>
        <Note arrow="down-left" className="jr-note-choice" step={3}>
          A small gesture
          <br />
          goes a long way.
        </Note>
      </div>
    </div>
  );
}

/* ─── 05 · The client page ─── */

async function openExample() {
  const profile = { ...DEFAULT_STATE.profile, name: 'Sam Rivera', business: 'Rivera Studio', rate: 85 };
  const { projects, items } = buildSample(profile);
  const p = projects[0];
  const url = await scopeLink(p, items.filter((i) => i.projectId === p.id), profile);
  window.open(url, '_blank', 'noopener');
}

export function ClientChapter() {
  return (
    <div className="jr-content jr-content-wide">
      <div className="jr-copy">
        <Eyebrow n="05">A client page that builds trust</Eyebrow>
        <h2 className="jr-h2 serif">
          Transparency for <em>happier clients.</em>
        </h2>
        <p className="jr-lede">Share one clean link. Your client sees deliverables, revision rounds left, approved extras and gifts. No login, no confusion, no disputes.</p>
        <button type="button" className="btn btn-primary" onClick={openExample}>
          See a live example <ExternalLink size={15} />
        </button>
      </div>
      <div className="jr-visual jr-client" data-step={1}>
        <ClientPageMock />
        <Note arrow="down-right" className="jr-note-client" step={2}>
          Maya sees exactly
          <br />
          where things stand.
        </Note>
      </div>
    </div>
  );
}
