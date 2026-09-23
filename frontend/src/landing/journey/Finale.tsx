import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Wordmark } from '../../components/Mark';
import { scrollToId, useViewProgress } from '../scroll';
import { DepthStage } from './DepthStage';
import { FINALE } from './scenes';

/** The last scene: the same freelancer, later, lighter. Then the footer. */
export function Finale() {
  const root = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const stage = useRef<DepthStage | null>(null);
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    const c = canvas.current;
    if (!c) return undefined;
    const s = DepthStage.create(c, [FINALE]);
    if (!s) {
      setFallback(true);
      return undefined;
    }
    stage.current = s;
    s.show(0, true);
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') s.setPointer((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
    };
    const onResize = () => s.resize();
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('resize', onResize);
    const io = new IntersectionObserver(([e]) => (e.isIntersecting ? s.play() : s.pause()), { rootMargin: '100px' });
    if (root.current) io.observe(root.current);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('resize', onResize);
      io.disconnect();
      s.dispose();
    };
  }, []);

  useViewProgress(root, (p) => stage.current?.setDolly(Math.min(1, p * 1.4)));

  return (
    <section ref={root} className="jr-finale" aria-labelledby="finale-title">
      <div className="jr-finale-stage" aria-hidden="true">
        {fallback ? <img src={FINALE.image} alt="" /> : <canvas ref={canvas} className="jr-canvas" />}
        <div className="jr-finale-scrim" />
      </div>
      <div className="jr-finale-inner">
        <p className="jr-finale-kicker" data-reveal>
          Same you.
          <br />A brighter tomorrow.
        </p>
        <h2 id="finale-title" className="serif" data-reveal>
          Protect your <em>scope</em> today.
        </h2>
        <p className="jr-finale-lede" data-reveal>
          Set up the project you’re on right now in about a minute. The next “quick tweak” will already have a price, or a bow on it.
        </p>
        <div className="jr-finale-ctas" data-reveal>
          <Link to="/app" className="btn btn-accent btn-lg">
            Start for free <ArrowRight size={18} />
          </Link>
          <button type="button" className="btn btn-glass-dark btn-lg" onClick={() => scrollToId('ch-problem')}>
            Replay the story
          </button>
        </div>
      </div>
      <footer className="jr-footer">
        <div className="lp-container jr-footer-inner">
          <div className="jr-footer-brand">
            <Wordmark />
            <p className="serif">Charge it. Gift it. Never lose it.</p>
          </div>
          <nav className="jr-footer-links" aria-label="Footer">
            <Link to="/app">Open the app</Link>
            <button type="button" onClick={() => scrollToId('pricing')}>
              Pricing
            </button>
            <button type="button" onClick={() => scrollToId('faq')}>
              FAQ
            </button>
            <Link to="/privacy">Privacy</Link>
            <Link to="/terms">Terms</Link>
            <a href="mailto:optilenoai@gmail.com">Contact</a>
          </nav>
          <p className="jr-footer-fine">© {new Date().getFullYear()} Optileno · Built for a fairer creative world.</p>
        </div>
      </footer>
    </section>
  );
}
