import React, { useRef, useEffect, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';

interface CurvedString {
  id: number;
  baseYPercent: number; // Vertical position percentage across viewport
  amplitude: number;
  velocity: number;
  pluckX: number;
  pluckY: number;
  frequency: number;
  damping: number;
  wavePhase: number;
  isPlucked: boolean;
  stroke: string;
  glow: string;
  freqHz: number;
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

interface GuitarStringsBackgroundProps {
  onSoundToggle?: (isMuted: boolean) => void;
}

export const GuitarStringsBackground: React.FC<GuitarStringsBackgroundProps> = ({ onSoundToggle }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stringsRef = useRef<CurvedString[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const prevMouseRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const isMutedRef = useRef(false);
  const isAudioReadyRef = useRef(false);

  // Pentatonic acoustic guitar frequencies (warm, euphoric, harmonious)
  const STRING_FREQS = [164.81, 220.0, 293.66, 392.0, 493.88, 659.25, 783.99, 987.77];

  const initAudio = () => {
    if (!audioCtxRef.current) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        audioCtxRef.current = new AudioCtx();
      }
    }
    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume().catch(() => {});
    }
    isAudioReadyRef.current = true;
  };

  const playGuitarPluck = (freqHz: number, velocity: number) => {
    if (isMutedRef.current) return;
    try {
      initAudio();
      const ctx = audioCtxRef.current;
      if (!ctx || ctx.state !== 'running') return;

      const now = ctx.currentTime;
      const fundamental = ctx.createOscillator();
      const overtone = ctx.createOscillator();
      const gainNode = ctx.createGain();
      const filterNode = ctx.createBiquadFilter();

      // Fundamental acoustic pluck (triangle/sine blend)
      fundamental.type = 'triangle';
      fundamental.frequency.setValueAtTime(freqHz, now);

      // 2nd harmonic for rich acoustic resonance
      overtone.type = 'sine';
      overtone.frequency.setValueAtTime(freqHz * 2, now);

      // Physical string dampening low-pass filter
      filterNode.type = 'lowpass';
      filterNode.frequency.setValueAtTime(Math.min(freqHz * 4, 3000), now);
      filterNode.frequency.exponentialRampToValueAtTime(160, now + 1.2);

      // Velocity-scaled volume (ultra-subtle luxury ambient touch)
      const volume = Math.min(Math.max(Math.abs(velocity) / 40, 0.015), 0.065);
      gainNode.gain.setValueAtTime(volume, now);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 1.4);

      fundamental.connect(filterNode);
      overtone.connect(filterNode);
      filterNode.connect(gainNode);
      gainNode.connect(ctx.destination);

      fundamental.start(now);
      overtone.start(now);
      fundamental.stop(now + 1.4);
      overtone.stop(now + 1.4);
    } catch {
      // Audio fallback silent
    }
  };

  const toggleSound = () => {
    const nextState = !isMuted;
    setIsMuted(nextState);
    isMutedRef.current = nextState;
    if (onSoundToggle) {
      onSoundToggle(nextState);
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    const setupStrings = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.scale(dpr, dpr);

      const colorPalette = [
        { stroke: 'rgba(96, 165, 250, 0.32)', glow: 'rgba(96, 165, 250, 0.75)' },
        { stroke: 'rgba(147, 197, 253, 0.28)', glow: 'rgba(147, 197, 253, 0.65)' },
        { stroke: 'rgba(251, 191, 36, 0.35)', glow: 'rgba(251, 191, 36, 0.85)' },
        { stroke: 'rgba(217, 119, 6, 0.30)', glow: 'rgba(217, 119, 6, 0.75)' },
        { stroke: 'rgba(59, 130, 246, 0.32)', glow: 'rgba(59, 130, 246, 0.75)' },
        { stroke: 'rgba(245, 158, 11, 0.30)', glow: 'rgba(245, 158, 11, 0.75)' },
      ];

      // 6 flowing dynamic strings across the background
      stringsRef.current = [
        { id: 0, baseYPercent: 0.16, amplitude: 0, velocity: 0, pluckX: 0, pluckY: 0, frequency: 0.09, damping: 0.94, wavePhase: 0, isPlucked: false, stroke: colorPalette[0].stroke, glow: colorPalette[0].glow, freqHz: STRING_FREQS[0] },
        { id: 1, baseYPercent: 0.30, amplitude: 0, velocity: 0, pluckX: 0, pluckY: 0, frequency: 0.10, damping: 0.942, wavePhase: 0.8, isPlucked: false, stroke: colorPalette[1].stroke, glow: colorPalette[1].glow, freqHz: STRING_FREQS[1] },
        { id: 2, baseYPercent: 0.45, amplitude: 0, velocity: 0, pluckX: 0, pluckY: 0, frequency: 0.11, damping: 0.945, wavePhase: 1.6, isPlucked: false, stroke: colorPalette[2].stroke, glow: colorPalette[2].glow, freqHz: STRING_FREQS[2] },
        { id: 3, baseYPercent: 0.60, amplitude: 0, velocity: 0, pluckX: 0, pluckY: 0, frequency: 0.12, damping: 0.943, wavePhase: 2.4, isPlucked: false, stroke: colorPalette[3].stroke, glow: colorPalette[3].glow, freqHz: STRING_FREQS[3] },
        { id: 4, baseYPercent: 0.74, amplitude: 0, velocity: 0, pluckX: 0, pluckY: 0, frequency: 0.13, damping: 0.941, wavePhase: 3.2, isPlucked: false, stroke: colorPalette[4].stroke, glow: colorPalette[4].glow, freqHz: STRING_FREQS[4] },
        { id: 5, baseYPercent: 0.88, amplitude: 0, velocity: 0, pluckX: 0, pluckY: 0, frequency: 0.14, damping: 0.938, wavePhase: 4.0, isPlucked: false, stroke: colorPalette[5].stroke, glow: colorPalette[5].glow, freqHz: STRING_FREQS[5] },
      ];
    };

    setupStrings();

    const spawnSparks = (x: number, y: number, color: string, count = 10) => {
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 3.5 + 1.0;
        particlesRef.current.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 0.5,
          alpha: 1,
          size: Math.random() * 2.8 + 1.2,
          color,
        });
      }
    };

    // Calculate Y on the curved baseline for a given X coordinate
    const getCurveY = (x: number, baseY: number, width: number, phase: number) => {
      const normalizedX = x / width;
      const wave = Math.sin(normalizedX * Math.PI * 1.8 + phase) * (window.innerHeight * 0.08);
      const slant = (normalizedX - 0.5) * (window.innerHeight * 0.06);
      return baseY + wave + slant;
    };

    const handlePointerMove = (e: MouseEvent | TouchEvent) => {
      let clientX = 0;
      let clientY = 0;

      if ('touches' in e && e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else if ('clientX' in e) {
        clientX = e.clientX;
        clientY = e.clientY;
      } else {
        return;
      }

      const now = performance.now();

      if (prevMouseRef.current) {
        const prevX = prevMouseRef.current.x;
        const prevY = prevMouseRef.current.y;
        const dt = Math.max((now - prevMouseRef.current.time) / 1000, 0.001);
        const vy = (clientY - prevY) / dt;
        const vx = (clientX - prevX) / dt;
        const totalVelocity = Math.sqrt(vx * vx + vy * vy);

        const width = window.innerWidth;
        const height = window.innerHeight;

        stringsRef.current.forEach((str) => {
          const restingY = getCurveY(clientX, height * str.baseYPercent, width, str.wavePhase);
          const prevRestingY = getCurveY(prevX, height * str.baseYPercent, width, str.wavePhase);

          // Check if cursor crossed the string vertically
          const crossed = (prevY <= prevRestingY && clientY >= restingY) || (prevY >= prevRestingY && clientY <= restingY);
          const distance = Math.abs(clientY - restingY);

          if (crossed || (distance < 24 && totalVelocity > 120)) {
            const pluckStrength = Math.min(Math.max((vy * 0.06) || 12, -45), 45);
            str.velocity += pluckStrength;
            str.pluckX = clientX;
            str.pluckY = clientY;
            str.amplitude = Math.abs(pluckStrength);
            str.isPlucked = true;

            spawnSparks(clientX, restingY, str.glow, 8);
            playGuitarPluck(str.freqHz, totalVelocity);
          }
        });
      }

      prevMouseRef.current = { x: clientX, y: clientY, time: now };
    };

    const handleResize = () => {
      setupStrings();
    };

    window.addEventListener('mousemove', handlePointerMove, { passive: true });
    window.addEventListener('touchmove', handlePointerMove, { passive: true });
    window.addEventListener('resize', handleResize);

    // 60FPS Harmonic Physics Render Loop
    const render = () => {
      const displayW = window.innerWidth;
      const displayH = window.innerHeight;

      ctx.clearRect(0, 0, displayW, displayH);

      // Render Each Living Guitar String
      stringsRef.current.forEach((str) => {
        // Spring harmonic decay: F = -k*x - c*v
        const springForce = -0.075 * str.amplitude;
        str.velocity += springForce;
        str.velocity *= str.damping;
        str.amplitude += str.velocity;

        const isVibrating = Math.abs(str.amplitude) > 0.08 || Math.abs(str.velocity) > 0.08;
        const glowBoost = Math.min(Math.abs(str.amplitude) / 12, 1);

        ctx.save();
        ctx.beginPath();

        // Sample points across the string to create organic wave deformation
        const steps = 40;
        for (let i = 0; i <= steps; i++) {
          const x = (displayW / steps) * i;
          let y = getCurveY(x, displayH * str.baseYPercent, displayW, str.wavePhase);

          if (isVibrating) {
            // Pluck Gaussian wave dispersion from touch point
            const distFromPluck = Math.abs(x - (str.pluckX || displayW * 0.5));
            const dispersion = Math.exp(-Math.pow(distFromPluck / (displayW * 0.28), 2));
            const vibrationWave = Math.sin((x / displayW) * Math.PI * 4 + performance.now() * 0.015) * (str.amplitude * 0.35);
            y += (str.amplitude * dispersion) + vibrationWave;
          }

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }

        if (isVibrating) {
          // Plucked Harmonic Laser Glow
          ctx.shadowColor = str.glow;
          ctx.shadowBlur = 10 + glowBoost * 18;
          ctx.strokeStyle = str.glow;
          ctx.lineWidth = 1.8 + glowBoost * 1.6;
        } else {
          // Resting Luxury Ambient Thread
          ctx.shadowColor = 'transparent';
          ctx.shadowBlur = 0;
          ctx.strokeStyle = str.stroke;
          ctx.lineWidth = 1.1;
        }

        ctx.stroke();
        ctx.restore();
      });

      // Render & Update Spark Particles
      for (let i = particlesRef.current.length - 1; i >= 0; i--) {
        const p = particlesRef.current[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.05;
        p.alpha -= 0.024;

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
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('touchmove', handlePointerMove);
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        audioCtxRef.current.close().catch(() => {});
      }
    };
  }, []);

  return (
    <>
      <canvas
        ref={canvasRef}
        className="guitar-strings-canvas"
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          zIndex: 1,
        }}
      />
      {/* Discreet Glassmorphic Sound Controller */}
      <button
        type="button"
        className={`guitar-sound-toggle ${isMuted ? 'muted' : 'active'}`}
        onClick={toggleSound}
        aria-label={isMuted ? 'Unmute guitar string resonance' : 'Mute guitar string resonance'}
        title={isMuted ? 'Unmute Strings' : 'Interactive Strings Audio Active'}
      >
        <span className="sound-pulse-dot" />
        {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
        <span className="sound-toggle-text">{isMuted ? 'Sound Off' : 'Strings Audio On'}</span>
      </button>
    </>
  );
};
