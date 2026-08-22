import React, { useRef, useEffect } from 'react';

interface GuitarString {
  x: number; // Base resting X position
  currentX: number; // Current displacement at control point
  targetX: number;
  velocity: number;
  pluckY: number; // Y coordinate where string was plucked
  amplitude: number;
  frequency: number;
  damping: number;
  color: string;
  glowColor: string;
  isPlucked: boolean;
  wavePhase: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  alpha: number;
  size: number;
  color: string;
}

export const GuitarStrings: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stringsRef = useRef<GuitarString[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const prevMouseRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const isAudioInitRef = useRef(false);

  // Frequencies for pentatonic harmonic sound (E, A, D, G, B, E)
  const PENTATONIC_FREQS = [164.81, 220.0, 293.66, 392.0, 493.88, 659.25, 783.99, 987.77];

  const playHarmonicSound = (stringIndex: number, velocity: number) => {
    try {
      if (!audioCtxRef.current) {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioCtx) {
          audioCtxRef.current = new AudioCtx();
        }
      }

      if (!audioCtxRef.current || audioCtxRef.current.state === 'suspended') {
        return;
      }

      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      const baseFreq = PENTATONIC_FREQS[stringIndex % PENTATONIC_FREQS.length];
      osc.type = 'sine';
      osc.frequency.setValueAtTime(baseFreq, ctx.currentTime);

      // Warm acoustic harmonics
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1200, ctx.currentTime);
      filter.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.8);

      const intensity = Math.min(Math.max(Math.abs(velocity) / 25, 0.02), 0.08); // Ultra-gentle luxury volume
      gain.gain.setValueAtTime(intensity, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.2);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 1.2);
    } catch {
      // Audio playback silently ignored if blocked by browser policy
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    const initStrings = () => {
      canvas.width = window.innerWidth * (window.devicePixelRatio || 1);
      canvas.height = window.innerHeight * (window.devicePixelRatio || 1);
      ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);

      const displayWidth = window.innerWidth;
      const numStrings = Math.min(Math.max(Math.floor(displayWidth / 180), 5), 8);
      const margin = displayWidth * 0.08;
      const spacing = (displayWidth - margin * 2) / (numStrings - 1);

      const colors = [
        { stroke: 'rgba(96, 165, 250, 0.28)', glow: 'rgba(96, 165, 250, 0.6)' },
        { stroke: 'rgba(147, 197, 253, 0.24)', glow: 'rgba(147, 197, 253, 0.5)' },
        { stroke: 'rgba(251, 191, 36, 0.28)', glow: 'rgba(251, 191, 36, 0.65)' },
        { stroke: 'rgba(217, 119, 6, 0.25)', glow: 'rgba(217, 119, 6, 0.55)' },
        { stroke: 'rgba(59, 130, 246, 0.28)', glow: 'rgba(59, 130, 246, 0.6)' },
        { stroke: 'rgba(245, 158, 11, 0.26)', glow: 'rgba(245, 158, 11, 0.6)' },
        { stroke: 'rgba(129, 140, 248, 0.25)', glow: 'rgba(129, 140, 248, 0.55)' },
        { stroke: 'rgba(251, 191, 36, 0.28)', glow: 'rgba(251, 191, 36, 0.65)' },
      ];

      stringsRef.current = Array.from({ length: numStrings }, (_, i) => {
        const x = margin + i * spacing;
        const colorPair = colors[i % colors.length];
        return {
          x,
          currentX: x,
          targetX: x,
          velocity: 0,
          pluckY: window.innerHeight * 0.5,
          amplitude: 0,
          frequency: 0.08 + (i * 0.012),
          damping: 0.945,
          color: colorPair.stroke,
          glowColor: colorPair.glow,
          isPlucked: false,
          wavePhase: 0,
        };
      });
    };

    initStrings();

    const spawnParticles = (x: number, y: number, color: string, count = 6) => {
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 2.5 + 0.8;
        particlesRef.current.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          alpha: 1,
          size: Math.random() * 2.5 + 1.2,
          color,
        });
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      // First user interaction unlocks AudioContext
      if (!isAudioInitRef.current) {
        if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
          audioCtxRef.current.resume();
        }
        isAudioInitRef.current = true;
      }

      const mouseX = e.clientX;
      const mouseY = e.clientY;
      const now = performance.now();

      if (prevMouseRef.current) {
        const prevX = prevMouseRef.current.x;
        const dt = Math.max((now - prevMouseRef.current.time) / 1000, 0.001);
        const vx = (mouseX - prevX) / dt;

        stringsRef.current.forEach((str, index) => {
          // Check if cursor crossed the string
          const crossed = (prevX <= str.x && mouseX >= str.x) || (prevX >= str.x && mouseX <= str.x);
          const distance = Math.abs(mouseX - str.x);

          if (crossed || (distance < 20 && Math.abs(vx) > 100)) {
            const pluckForce = Math.min(Math.max(vx * 0.04, -38), 38);
            str.velocity += pluckForce;
            str.pluckY = mouseY;
            str.amplitude = Math.abs(pluckForce);
            str.isPlucked = true;

            spawnParticles(str.x, mouseY, str.glowColor, 8);
            playHarmonicSound(index, vx);
          }
        });
      }

      prevMouseRef.current = { x: mouseX, y: mouseY, time: now };
    };

    const handleResize = () => {
      initStrings();
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('resize', handleResize);

    // Animation Loop with Spring Harmonic Physics
    const render = () => {
      const displayW = window.innerWidth;
      const displayH = window.innerHeight;

      ctx.clearRect(0, 0, displayW, displayH);

      // Render & Update Strings
      stringsRef.current.forEach((str) => {
        // Spring physics equation: F = -k*x - c*v
        const displacement = str.currentX - str.x;
        const springForce = -0.065 * displacement;
        str.velocity += springForce;
        str.velocity *= str.damping;
        str.currentX += str.velocity;
        str.wavePhase += 0.08;

        const isVibrating = Math.abs(displacement) > 0.1 || Math.abs(str.velocity) > 0.1;
        const glowIntensity = Math.min(Math.abs(displacement) / 14, 1);

        ctx.save();

        // Ambient string line
        ctx.beginPath();
        ctx.moveTo(str.x, 0);

        if (isVibrating) {
          // Draw smooth vibration curve
          const midY = str.pluckY || displayH * 0.5;
          const waveOffset = Math.sin(str.wavePhase) * (displacement * 0.15);

          ctx.bezierCurveTo(
            str.x + waveOffset,
            midY * 0.45,
            str.currentX,
            midY,
            str.x - waveOffset,
            displayH * 0.85
          );
          ctx.lineTo(str.x, displayH);

          // Harmonic Pluck Glow
          ctx.shadowColor = str.glowColor;
          ctx.shadowBlur = 12 + glowIntensity * 16;
          ctx.strokeStyle = str.glowColor;
          ctx.lineWidth = 1.6 + glowIntensity * 1.4;
        } else {
          // Resting clean laser string
          ctx.lineTo(str.x, displayH);
          ctx.shadowColor = 'transparent';
          ctx.shadowBlur = 0;
          ctx.strokeStyle = str.color;
          ctx.lineWidth = 1;
        }

        ctx.stroke();
        ctx.restore();
      });

      // Render & Update Micro Particles
      for (let i = particlesRef.current.length - 1; i >= 0; i--) {
        const p = particlesRef.current[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.04; // Gentle gravity
        p.alpha -= 0.025;

        if (p.alpha <= 0) {
          particlesRef.current.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        audioCtxRef.current.close().catch(() => {});
      }
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="guitar-strings-canvas"
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        zIndex: 1,
      }}
    />
  );
};
