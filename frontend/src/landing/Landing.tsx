import { useEffect, useRef } from 'react';
import { Calculator } from './Calculator';
import { Finale } from './journey/Finale';
import { Journey } from './journey/Journey';
import { Nav } from './Nav';
import { useReveal, useSmoothScroll } from './scroll';
import { Faq, MobileCta, Personas, Pricing, Privacy } from './Sections';
import '../styles/landing.css';
import '../styles/journey.css';

/**
 * A story in six scenes (the freelancer, the creep, the fix, the tool, the
 * choice, the client), then the numbers, trust, fit, price and doubts, and
 * one last scene to close on.
 */
export function Landing() {
  const root = useRef<HTMLDivElement>(null);
  useSmoothScroll();
  useReveal(root);

  useEffect(() => {
    document.title = 'Optileno — Clear scope. Happier clients. A freer you.';
  }, []);

  return (
    <div className="lp" ref={root}>
      <div className="lp-grain" aria-hidden="true" />
      <Nav />
      <main>
        <Journey />
        <Calculator />
        <Privacy />
        <Personas />
        <Pricing />
        <Faq />
      </main>
      <Finale />
      <MobileCta />
    </div>
  );
}
