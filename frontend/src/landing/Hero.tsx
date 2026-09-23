import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Wordmark } from '../components/Mark';
import { Bubble, StampMock, VerdictMock } from './mockups';
import { onScrollFrame, prefersReducedMotion, scrollToId } from './scroll';

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => onScrollFrame(() => setScrolled(window.scrollY > 24)), []);

  return (
    <header className={`lp-nav${scrolled ? ' scrolled' : ''}`}>
      <div className="lp-nav-inner">
        <Wordmark />
        <nav className="lp-nav-links" aria-label="Sections">
          <button type="button" onClick={() => scrollToId('how')}>
            How it works
          </button>
          <button type="button" onClick={() => scrollToId('clients')}>
            For clients
          </button>
          <button type="button" onClick={() => scrollToId('pricing')}>
            Pricing
          </button>
          <button type="button" onClick={() => scrollToId('faq')}>
            FAQ
          </button>
        </nav>
        <Link to="/app" className="btn btn-primary btn-sm lp-nav-cta">
          Open Optileno
        </Link>
      </div>
    </header>
  );
}

/** Every small change has a price. The hero shows four client messages getting their verdict. */
export function Hero() {
  const stage = useRef<HTMLDivElement>(null);

  // Depth: bubbles drift at different speeds as you scroll, and lean toward the cursor
  useEffect(() => {
    const el = stage.current;
    if (!el || prefersReducedMotion()) return undefined;
    let mx = 0;
    let my = 0;
    const apply = () => {
      const y = Math.min(window.scrollY, window.innerHeight * 1.2);
      el.style.setProperty('--sy', `${y}`);
      el.style.setProperty('--mx', `${mx}`);
      el.style.setProperty('--my', `${my}`);
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      mx = e.clientX / window.innerWidth - 0.5;
      my = e.clientY / window.innerHeight - 0.5;
      apply();
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    const off = onScrollFrame(apply);
    return () => {
      window.removeEventListener('pointermove', onMove);
      off();
    };
  }, []);

  return (
    <section className="lp-hero" aria-labelledby="hero-title">
      <div className="lp-hero-copy">
        <p className="lp-pill">
          <span className="lp-pill-dot" /> For freelancers on fixed-price projects
        </p>
        <h1 id="hero-title" className="lp-hero-title serif">
          Every{' '}
          <span className="lp-circled">
            <em>small change</em>
            <svg className="lp-circle" viewBox="0 0 420 120" preserveAspectRatio="none" aria-hidden="true">
              <path pathLength={1} d="M22 70 C 20 30, 140 10, 230 14 C 330 18, 408 38, 402 70 C 396 104, 280 114, 190 110 C 100 106, 26 98, 30 64 C 33 44, 90 26, 150 22" />
            </svg>
          </span>
          <br />
          has a price.
        </h1>
        <p className="lp-hero-sub">
          Optileno checks every client request against what you agreed. Then you <strong>charge it</strong>, or <strong>gift it</strong>, on purpose. Your client sees exactly where things stand, so you never have the awkward
          conversation again.
        </p>
        <div className="lp-hero-ctas">
          <Link to="/app" className="btn btn-primary btn-lg">
            Start free, no signup <ArrowRight size={18} />
          </Link>
          <button type="button" className="btn btn-ghost btn-lg" onClick={() => scrollToId('story')}>
            See what it catches
          </button>
        </div>
        <p className="lp-hero-micro">Free during early access · Nothing leaves your device · Set up in a minute</p>
      </div>

      <div className="lp-stage" ref={stage} aria-hidden="true">
        <div className="lp-frame">
          <span className="lp-crop tl" />
          <span className="lp-crop tr" />
          <span className="lp-crop bl" />
          <span className="lp-crop br" />
        </div>
        <div className="lp-layer lp-layer-center">
          <VerdictMock />
        </div>
        <div className="lp-layer lp-b1" style={{ ['--d' as string]: 0.35 }}>
          <Bubble from="Maya · Northwind" text="Could the headline be a bit bigger?" stamp={<StampMock kind="revision" delay={1500}>Round 1 of 2</StampMock>} />
        </div>
        <div className="lp-layer lp-b2" style={{ ['--d' as string]: 0.55 }}>
          <Bubble from="Maya · Northwind" text="The form isn’t sending on my phone 😬" stamp={<StampMock kind="included" delay={2100}>Included</StampMock>} />
        </div>
        <div className="lp-layer lp-b3" style={{ ['--d' as string]: 0.25 }}>
          <Bubble from="Maya · Northwind" text="Quick one: outline icons in the footer?" stamp={<StampMock kind="gift" delay={2700}>Gift · $60</StampMock>} />
        </div>
        <div className="lp-layer lp-b4" style={{ ['--d' as string]: 0.45 }}>
          <Bubble from="Maya · Northwind" text="Could you write the About page copy?" stamp={<StampMock kind="extra" delay={3300}>Extra · $255</StampMock>} />
        </div>
      </div>
    </section>
  );
}
