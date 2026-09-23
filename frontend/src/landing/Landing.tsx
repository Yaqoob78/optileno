import { useEffect, useRef } from 'react';
import { Calculator } from './Calculator';
import { Demo } from './Demo';
import { Hero, Nav } from './Hero';
import { HowItWorks } from './HowItWorks';
import { useReveal, useSmoothScroll } from './scroll';
import { ChargeOrGift, Faq, FinalCta, ForClients, Insight, MobileCta, Personas, Phrases, Pricing, Privacy } from './Sections';
import { Story } from './Story';
import '../styles/landing.css';

/**
 * The story, in order: recognition (hero, phrases), the wound (the quick
 * tweak that became 13 free hours), the insight, the fix, proof you can
 * touch (live demo), the philosophy, the client's side, the number, trust,
 * fit, price, doubts, and the last push.
 */
export function Landing() {
  const root = useRef<HTMLDivElement>(null);
  useSmoothScroll();
  useReveal(root);

  useEffect(() => {
    document.title = 'Optileno — Every small change has a price';
  }, []);

  return (
    <div className="lp" ref={root}>
      <div className="lp-grain" aria-hidden="true" />
      <Nav />
      <main>
        <Hero />
        <Phrases />
        <Story />
        <Insight />
        <HowItWorks />
        <Demo />
        <ChargeOrGift />
        <ForClients />
        <Calculator />
        <Privacy />
        <Personas />
        <Pricing />
        <Faq />
      </main>
      <FinalCta />
      <MobileCta />
    </div>
  );
}
