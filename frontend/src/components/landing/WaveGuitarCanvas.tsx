import React, { useRef, useEffect } from 'react';

export const WaveGuitarCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const lastPluckTimesRef = useRef<number[]>(new Array(42).fill(0));

  // Musical, warm acoustic pentatonic scale frequencies (E minor / G Major pentatonic across 3 octaves)
  // Low E, G, A, B, D, E, G, A, B, d, e, g, a, b, d', e'
  const ACOUSTIC_FREQS = [
    82.41, 98.0, 110.0, 123.47, 146.83, 164.81, 196.0, 220.0, 246.94, 293.66,
    329.63, 392.0, 440.0, 493.88, 587.33, 659.25, 783.99, 880.0, 987.77, 1174.66,
    1318.51, 1567.98
  ];

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
  };

  const playAcousticGuitarNote = (lineIndex: number, velocity: number, panX: number) => {
    try {
      initAudio();
      const ctx = audioCtxRef.current;
      if (!ctx || ctx.state !== 'running') return;

      const now = ctx.currentTime;
      // Debounce rapid repeat plucks on same string (min 60ms)
      if (now - lastPluckTimesRef.current[lineIndex] < 0.06) return;
      lastPluckTimesRef.current[lineIndex] = now;

      const baseFreq = ACOUSTIC_FREQS[lineIndex % ACOUSTIC_FREQS.length];

      // 1. Fundamental Body Resonance (Triangle wave for rich wood body)
      const osc1 = ctx.createOscillator();
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(baseFreq, now);

      // 2. Harmonic Overtone (Sine wave 2x freq for bell sparkle)
      const osc2 = ctx.createOscillator();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(baseFreq * 2, now);

      // 3. Subtle Chime Ring (Sine wave 3x freq at lower gain)
      const osc3 = ctx.createOscillator();
      osc3.type = 'sine';
      osc3.frequency.setValueAtTime(baseFreq * 3, now);

      // 4. Acoustic Body Low-Pass Filter
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(Math.min(baseFreq * 5, 2800), now);
      filter.frequency.exponentialRampToValueAtTime(140, now + 1.2);

      // 5. Volume Gain Envelope
      const gain = ctx.createGain();
      const gain2 = ctx.createGain();
      const gain3 = ctx.createGain();

      const intensity = Math.min(Math.max(Math.abs(velocity) / 50, 0.015), 0.07);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(intensity, now + 0.018); // Smooth soft attack (no click)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.3);

      gain2.gain.setValueAtTime(intensity * 0.45, now);
      gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.9);

      gain3.gain.setValueAtTime(intensity * 0.2, now);
      gain3.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);

      // 6. Stereo Panning based on cursor horizontal position
      let panner: StereoPannerNode | null = null;
      if (ctx.createStereoPanner) {
        panner = ctx.createStereoPanner();
        const panVal = Math.min(Math.max((panX - 0.5) * 1.6, -0.85), 0.85);
        panner.pan.setValueAtTime(panVal, now);
      }

      // Connect graph
      osc1.connect(filter);
      osc2.connect(gain2);
      gain2.connect(filter);
      osc3.connect(gain3);
      gain3.connect(filter);

      if (panner) {
        filter.connect(gain);
        gain.connect(panner);
        panner.connect(ctx.destination);
      } else {
        filter.connect(gain);
        gain.connect(ctx.destination);
      }

      osc1.start(now);
      osc2.start(now);
      osc3.start(now);

      osc1.stop(now + 1.35);
      osc2.stop(now + 1.35);
      osc3.stop(now + 1.35);
    } catch {
      // Audio playback fails gracefully if blocked
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let animationFrameId: number;
    let time = 0;
    let isVisible = true;
    let prevMouseY = 0;
    let prevMouseTime = performance.now();

    const isMobile = window.innerWidth < 768;
    const NUM_LINES = isMobile ? 32 : 42; // Mobile optimized line count

    // Spring harmonic physics for each line
    const stringPhysics = Array.from({ length: NUM_LINES }, () => ({
      displacement: 0,
      velocity: 0,
      glowBoost: 0,
    }));

    const resizeCanvas = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Optimized 60–120 FPS GPU 2D Canvas Render Loop
    const render = () => {
      if (!isVisible) return;
      time += 0.003;

      const rect = canvas.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;

      ctx.clearRect(0, 0, width, height);

      // Coordinate scaling from SVG 1440x1000 base to viewport
      const scaleX = width / 1440;
      const scaleY = height / 1000;

      // Base gradient colors (Blue to Gold)
      const grad = ctx.createLinearGradient(0, 0, width, 0);
      grad.addColorStop(0, 'rgba(96, 165, 250, 0.45)');
      grad.addColorStop(0.5, 'rgba(59, 130, 246, 0.7)');
      grad.addColorStop(1, 'rgba(251, 191, 36, 0.75)');

      const restingGrad = ctx.createLinearGradient(0, 0, width, 0);
      restingGrad.addColorStop(0, 'rgba(96, 165, 250, 0.16)');
      restingGrad.addColorStop(0.5, 'rgba(59, 130, 246, 0.22)');
      restingGrad.addColorStop(1, 'rgba(251, 191, 36, 0.25)');

      for (let i = 0; i < NUM_LINES; i++) {
        const y = (40 + i * 26) * scaleY;
        const phaseRow = i * 0.3;
        const waveSpeed = time * 2;

        // Spring harmonic physics: F = -k*x - c*v
        const str = stringPhysics[i];
        str.velocity += -0.075 * str.displacement;
        str.velocity *= 0.942;
        str.displacement += str.velocity;
        str.glowBoost *= 0.93;

        const isVibrating = Math.abs(str.displacement) > 0.05 || str.glowBoost > 0.05;

        const cy1 = (40 + i * 26 - 130 + Math.sin(phaseRow + waveSpeed) * 80) * scaleY + str.displacement * 0.85;
        const cy2 = (40 + i * 26 + 130 + Math.sin(phaseRow + waveSpeed - 1.2) * 80) * scaleY - str.displacement * 0.65;
        const cy3 = (40 + i * 26 + Math.sin(phaseRow + waveSpeed - 2.4) * 60) * scaleY + str.displacement * 0.45;

        const startX = -100 * scaleX;
        const cp1X = 480 * scaleX;
        const cp2X = 1020 * scaleX;
        const endX = 1600 * scaleX;

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(startX, y);
        ctx.bezierCurveTo(cp1X, cy1, cp2X, cy2, endX, cy3);

        if (isVibrating) {
          const glow = Math.min(Math.abs(str.displacement) / 10 + str.glowBoost, 1);
          ctx.strokeStyle = grad;
          ctx.lineWidth = 1.6 + glow * 1.2;
          ctx.shadowColor = 'rgba(251, 191, 36, 0.8)';
          ctx.shadowBlur = 8 + glow * 14;
        } else {
          ctx.strokeStyle = restingGrad;
          ctx.lineWidth = 1.0;
          ctx.shadowColor = 'transparent';
          ctx.shadowBlur = 0;
        }

        ctx.stroke();
        ctx.restore();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    const handlePointerMove = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;

      const now = performance.now();
      const dt = Math.max((now - prevMouseTime) / 1000, 0.001);
      const vy = (y - prevMouseY) / dt;

      const scaleY = rect.height / 1000;
      const normalizedPanX = Math.min(Math.max(x / rect.width, 0), 1);

      for (let i = 0; i < NUM_LINES; i++) {
        const lineBaseY = (40 + i * 26) * scaleY;
        const crossed = (prevMouseY <= lineBaseY && y >= lineBaseY) || (prevMouseY >= lineBaseY && y <= lineBaseY);
        const dist = Math.abs(y - lineBaseY);

        if (crossed || (dist < 14 && Math.abs(vy) > 70)) {
          const pluckForce = Math.min(Math.max(vy * 0.06, -32), 32);
          stringPhysics[i].velocity += pluckForce;
          stringPhysics[i].glowBoost = 1.0;
          playAcousticGuitarNote(i, vy, normalizedPanX);
        }
      }

      prevMouseY = y;
      prevMouseTime = now;
    };

    const onMouseMove = (e: MouseEvent) => {
      handlePointerMove(e.clientX, e.clientY);
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        handlePointerMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    };

    // IntersectionObserver to pause render loop when offscreen
    let observer: IntersectionObserver | undefined;
    if (typeof IntersectionObserver !== 'undefined') {
      observer = new IntersectionObserver(([entry]) => {
        const wasVisible = isVisible;
        isVisible = entry.isIntersecting;
        if (isVisible && !wasVisible) {
          animationFrameId = requestAnimationFrame(render);
        }
      });
      observer.observe(canvas);
    }

    window.addEventListener('mousemove', onMouseMove, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('touchmove', onTouchMove);
      cancelAnimationFrame(animationFrameId);
      observer?.disconnect();
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        audioCtxRef.current.close().catch(() => {});
      }
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="waves-canvas-guitar"
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: 'min(100vh, 1200px)',
        pointerEvents: 'none',
        zIndex: 1,
      }}
    />
  );
};
