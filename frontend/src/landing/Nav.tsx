import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Wordmark } from '../components/Mark';
import { onScrollFrame, scrollToId } from './scroll';

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => onScrollFrame(() => setScrolled(window.scrollY > 24)), []);

  return (
    <header className={`lp-nav${scrolled ? ' scrolled' : ''}`}>
      <div className="lp-nav-inner">
        <Wordmark />
        <nav className="lp-nav-links" aria-label="Sections">
          <button type="button" onClick={() => scrollToId('ch-problem')}>
            The story
          </button>
          <button type="button" onClick={() => scrollToId('ch-action')}>
            Try it
          </button>
          <button type="button" onClick={() => scrollToId('pricing')}>
            Pricing
          </button>
          <button type="button" onClick={() => scrollToId('faq')}>
            FAQ
          </button>
        </nav>
        <Link to="/app" className="btn btn-primary btn-sm lp-nav-cta">
          Start for free <ArrowRight size={15} />
        </Link>
      </div>
    </header>
  );
}
