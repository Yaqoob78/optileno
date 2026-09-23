import { useEffect, useRef, useState } from 'react';

const reduced = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Animates a number toward its new value, so a change you caused is a change you see. */
export function useCountUp(value: number, duration = 900): number {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  const raf = useRef(0);

  useEffect(() => {
    if (reduced() || from.current === value) {
      from.current = value;
      setShown(value);
      return undefined;
    }
    const start = performance.now();
    const a = from.current;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 4);
      setShown(a + (value - a) * eased);
      if (p < 1) raf.current = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf.current);
      from.current = value;
    };
  }, [value, duration]);

  return shown;
}

export function CountUp({ value, format, duration }: { value: number; format: (n: number) => string; duration?: number }) {
  const shown = useCountUp(value, duration);
  return <>{format(Math.round(shown))}</>;
}
