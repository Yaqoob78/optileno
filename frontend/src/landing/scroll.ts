import { useEffect, useRef, type RefObject } from 'react';
import Lenis from 'lenis';

/* One scroll loop for the whole landing page. Lenis smooths the wheel;
   sections subscribe to a single per-frame callback instead of each adding
   their own listeners, so the page stays at 60fps on modest laptops. */

type Listener = () => void;
const listeners = new Set<Listener>();
let lenis: Lenis | null = null;

export const prefersReducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function emit() {
  listeners.forEach((l) => l());
}

export function onScrollFrame(listener: Listener): () => void {
  listeners.add(listener);
  listener();
  return () => listeners.delete(listener);
}

export function useSmoothScroll() {
  useEffect(() => {
    let raf = 0;
    let pending = false;
    const onNativeScroll = () => {
      if (pending) return;
      pending = true;
      raf = requestAnimationFrame(() => {
        pending = false;
        emit();
      });
    };

    if (!prefersReducedMotion()) {
      lenis = new Lenis({ lerp: 0.085, smoothWheel: true, wheelMultiplier: 0.95, touchMultiplier: 1.4 });
      lenis.on('scroll', emit);
      const loop = (t: number) => {
        lenis?.raf(t);
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    } else {
      window.addEventListener('scroll', onNativeScroll, { passive: true });
    }
    window.addEventListener('resize', onNativeScroll);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onNativeScroll);
      window.removeEventListener('resize', onNativeScroll);
      lenis?.destroy();
      lenis = null;
    };
  }, []);
}

export function scrollToElement(el: HTMLElement, offset = -72) {
  if (lenis) lenis.scrollTo(el, { offset, duration: 1.2 });
  else window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY + offset, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
}

export function scrollToId(id: string) {
  const el = document.getElementById(id);
  if (el) scrollToElement(el);
}

/** Adds `is-in` to every [data-reveal] element the first time it scrolls into view. */
export function useReveal(root: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = root.current;
    if (!el) return undefined;
    const targets = el.querySelectorAll<HTMLElement>('[data-reveal]');
    if (!('IntersectionObserver' in window) || prefersReducedMotion()) {
      targets.forEach((t) => t.classList.add('is-in'));
      return undefined;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add('is-in');
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.08 },
    );
    targets.forEach((t) => io.observe(t));
    return () => io.disconnect();
  }, [root]);
}

/**
 * Calls back with how far the viewport has travelled through a tall section:
 * 0 when its top meets the top of the screen, 1 when its bottom meets the bottom.
 */
export function useSectionProgress(ref: RefObject<HTMLElement | null>, onProgress: (p: number) => void) {
  const cb = useRef(onProgress);
  cb.current = onProgress;
  useEffect(() => {
    return onScrollFrame(() => {
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const span = r.height - window.innerHeight;
      const p = span > 0 ? -r.top / span : r.top < 0 ? 1 : 0;
      cb.current(Math.min(1, Math.max(0, p)));
    });
  }, [ref]);
}

/** Like useSectionProgress, but for an element passing through the viewport (0 entering, 1 leaving). */
export function useViewProgress(ref: RefObject<HTMLElement | null>, onProgress: (p: number) => void) {
  const cb = useRef(onProgress);
  cb.current = onProgress;
  useEffect(() => {
    return onScrollFrame(() => {
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const p = (vh - r.top) / (vh + r.height);
      cb.current(Math.min(1, Math.max(0, p)));
    });
  }, [ref]);
}
