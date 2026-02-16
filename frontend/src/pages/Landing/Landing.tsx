import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Zap,
  Calendar,
  BarChart2,
  Bot,
  Smile,
  Clock,
  Cpu,
  Layout,
  CheckCircle,
  Flag,
  Lock
} from 'lucide-react';
import './landing.css';

type PointerLine = {
  left: number;
  top: number;
  width: number;
  angle: number;
};

// ── CONSTANTS & CONFIG ──────────────────────────────────────────────────────
const FEATURES = [
  { id: 'ai', title: 'Live Leno AI', description: 'Your personal AI assistant available 24/7.', icon: <Bot size={24} />, color: '#60a5fa' },
  { id: 'analytics', title: 'Realtime Analytics', description: 'Track efficiency and output as it happens.', icon: <BarChart2 size={24} />, color: '#8b5cf6' },
  { id: 'mood', title: 'Mood Tracker', description: 'Correlate your energy with productivity.', icon: <Smile size={24} />, color: '#ec4899' },
  { id: 'timeline', title: 'Behavior Timeline', description: 'Visualize your daily habits and patterns.', icon: <Clock size={24} />, color: '#10b981' },
  { id: 'time', title: 'Time Intelligence', description: 'Smart scheduling that adapts to you.', icon: <Cpu size={24} />, color: '#3b82f6' },
  { id: 'planning', title: 'Real Time Planning', description: 'Dynamic adjustments to your day.', icon: <Calendar size={24} />, color: '#f59e0b' },
  { id: 'task', title: 'Extraordinary Task Card', description: 'Rich details, subtasks, and context in one view.', icon: <Layout size={24} />, color: '#6366f1' },
  { id: 'deepwork', title: 'Advanced Deep Work', description: 'Immersive focus blocks with protection.', icon: <Zap size={24} />, color: '#f59e0b' },
  { id: 'habit', title: 'Consistent Habit Tracker', description: 'Build streaks that last.', icon: <CheckCircle size={24} />, color: '#10b981' },
  { id: 'goal', title: 'Goal Timeline', description: 'Map your long-term vision to daily actions.', icon: <Flag size={24} />, color: '#ef4444' },
];

// ── RAIN COMPONENT ──────────────────────────────────────────────────────────
class Raindrop {
  x: number;
  y: number;
  length: number;
  speed: number;
  opacity: number;
  width: number;
  hue: number;
  glowIntensity: number;
  rippleRadius: number;
  rippleOpacity: number;
  canvasHeight: number;
  canvasWidth: number;

  constructor(width: number, height: number) {
    this.canvasWidth = width;
    this.canvasHeight = height;
    this.x = Math.random() * width;
    this.y = Math.random() * -height;
    this.length = 15 + Math.random() * 25;
    this.speed = 3 + Math.random() * 4;
    this.opacity = 0.1 + Math.random() * 0.3;
    this.width = 1 + Math.random() * 1.5;
    this.hue = 210 + Math.random() * 20;
    this.glowIntensity = 0;
    this.rippleRadius = 0;
    this.rippleOpacity = 0;
  }

  update(mouse: { x: number, y: number, radius: number }) {
    this.y += this.speed;

    const dx = mouse.x - this.x;
    const dy = mouse.y - this.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < mouse.radius) {
      const force = (mouse.radius - distance) / mouse.radius;
      this.glowIntensity = Math.min(this.glowIntensity + force * 0.2, 1);
      this.speed += force * 0.5;
    } else {
      this.glowIntensity = Math.max(this.glowIntensity - 0.05, 0);
    }

    // Ripple logic
    if (this.rippleRadius > 0) {
      this.rippleRadius += 4;
      this.rippleOpacity -= 0.05;
      if (this.rippleOpacity <= 0) {
        this.rippleRadius = 0;
      }
    }

    // Reset when off screen
    if (this.y > this.canvasHeight + this.length) {
      this.y = -this.length;
      this.x = Math.random() * this.canvasWidth;
      this.glowIntensity = 0;
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(this.x, this.y + this.length);

    // Gradient stroke
    const grad = ctx.createLinearGradient(this.x, this.y, this.x, this.y + this.length);
    const lightColor = this.glowIntensity > 0 ? 100 : 70;
    grad.addColorStop(0, `hsla(${this.hue}, 80%, ${lightColor}%, 0)`);
    grad.addColorStop(1, `hsla(${this.hue}, 80%, ${lightColor}%, ${this.opacity + this.glowIntensity})`);

    ctx.strokeStyle = grad;
    ctx.lineWidth = this.width;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Ripple draw
    if (this.rippleRadius > 0) {
      ctx.beginPath();
      ctx.arc(this.x, this.y + this.length, this.rippleRadius, 0, Math.PI * 2, false);
      ctx.strokeStyle = `rgba(100, 200, 255, ${this.rippleOpacity})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }
}

// ── Footstep Trail Particle ─────────────────────────────────────────────────
interface FootstepParticle {
  x: number;
  y: number;
  opacity: number;
  scale: number;
  life: number;
}

// ── MAIN COMPONENT ──────────────────────────────────────────────────────────
export default function Landing() {
  const navigate = useNavigate();

  // State
  const [activeFeature, setActiveFeature] = useState(0);
  const [stickmanState, setStickmanState] = useState<'walking' | 'pointing' | 'hidden'>('walking');
  const [stickmanPos, setStickmanPos] = useState({ x: -420, y: 0 });
  const [stickmanPose, setStickmanPose] = useState({ scale: 0.54, opacity: 0.4 });
  const [pointerLine, setPointerLine] = useState<PointerLine | null>(null);
  const [lightningActive, setLightningActive] = useState(false);
  const [btnHovered, setBtnHovered] = useState(false);
  const [footsteps, setFootsteps] = useState<FootstepParticle[]>([]);
  const [walkProgress, setWalkProgress] = useState(0);

  // Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const raindropsRef = useRef<Raindrop[]>([]);
  const mouseRef = useRef({ x: 0, y: 0, radius: 150 });

  // Feature Rotation Timer
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveFeature(prev => (prev + 1) % FEATURES.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Stickman walk logic
  useEffect(() => {
    let animationId = 0;
    const timers: number[] = [];
    const startX = -420;
    const startY = window.innerHeight * 0.8;
    const walkDelayMs = 1800;
    const walkDurationMs = 10000; // Slower, more elegant walk

    const easeInOutCubic = (t: number) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

    setStickmanState('walking');
    setPointerLine(null);
    setLightningActive(false);
    setStickmanPos({ x: startX, y: startY });
    setStickmanPose({ scale: 0.54, opacity: 0.4 });

    const startWalk = () => {
      if (!buttonRef.current) return;

      const btnRect = buttonRef.current.getBoundingClientRect();
      const targetX = btnRect.left - 200;
      const targetY = btnRect.top - 90;
      const walkStartTime = performance.now();
      let lastFootstepTime = 0;

      const animateWalk = (now: number) => {
        const elapsed = now - walkStartTime;
        const t = Math.min(elapsed / walkDurationMs, 1);
        const eased = easeInOutCubic(t);

        const currentX = startX + (targetX - startX) * eased;
        const currentY = startY + (targetY - startY) * eased;

        setStickmanPos({ x: currentX, y: currentY });
        setStickmanPose({
          scale: 0.54 + eased * 0.46,
          opacity: 0.4 + eased * 0.6
        });
        setWalkProgress(t);

        // Add footstep particles every ~600ms
        if (t > 0.05 && t < 0.95 && now - lastFootstepTime > 600) {
          lastFootstepTime = now;
          setFootsteps(prev => [...prev.slice(-12), {
            x: currentX + 95,
            y: currentY + 185,
            opacity: 0.6,
            scale: 0.4 + eased * 0.4,
            life: 1
          }]);
        }

        if (t < 1) {
          animationId = requestAnimationFrame(animateWalk);
          return;
        }

        // Arrived — switch to pointing
        setStickmanState('pointing');

        const caneBaseX = targetX + 170;
        const caneBaseY = targetY + 100;
        const ctaX = btnRect.left + btnRect.width * 0.5;
        const ctaY = btnRect.top + btnRect.height * 0.55;
        const lineDX = ctaX - caneBaseX;
        const lineDY = ctaY - caneBaseY;
        setPointerLine({
          left: caneBaseX,
          top: caneBaseY,
          width: Math.hypot(lineDX, lineDY),
          angle: Math.atan2(lineDY, lineDX) * (180 / Math.PI)
        });

        timers.push(window.setTimeout(() => {
          setLightningActive(true);
          timers.push(window.setTimeout(() => setLightningActive(false), 260));
          timers.push(window.setTimeout(() => {
            setStickmanState('hidden');
            setPointerLine(null);
            setFootsteps([]);
          }, 3000));
        }, 500));
      };

      animationId = requestAnimationFrame(animateWalk);
    };

    timers.push(window.setTimeout(startWalk, walkDelayMs));

    // Fade out footsteps over time
    const footstepInterval = setInterval(() => {
      setFootsteps(prev => prev
        .map(f => ({ ...f, opacity: f.opacity - 0.02, life: f.life - 0.02 }))
        .filter(f => f.opacity > 0)
      );
    }, 100);

    return () => {
      timers.forEach((timerId) => clearTimeout(timerId));
      if (animationId) cancelAnimationFrame(animationId);
      clearInterval(footstepInterval);
    };
  }, []);

  // Rain Canvas Logic
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      raindropsRef.current = Array.from({ length: 150 }, () => new Raindrop(canvas.width, canvas.height));
    };
    resize();
    window.addEventListener('resize', resize);

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      raindropsRef.current.forEach(drop => {
        drop.update(mouseRef.current);
        drop.draw(ctx);
      });
      requestAnimationFrame(animate);
    };
    animate();

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY, radius: 150 };
    };
    window.addEventListener('mousemove', handleMouseMove);

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  return (
    <div className="landing-page futuristic">
      {/* Background Canvas */}
      <canvas ref={canvasRef} className="rain-canvas" />

      {/* Navigation */}
      <nav className="landing-nav">
        <div className="nav-container">
          <div className="nav-logo">
            <img src="/logo-light.svg" alt="Optileno" className="logo-image" />
            <span className="logo-text">optileno.com</span>
          </div>
          <div className="nav-actions">
            <button className="nav-link" onClick={() => navigate('/login')}>Login</button>
            <button className="nav-btn-primary" onClick={() => navigate('/register')}>Get Access</button>
          </div>
        </div>
      </nav>

      {/* Massive Background Text (Preserved) */}
      <div className="concierge-heading">
        <div className="concierge-text-glow">
          {'OPTILENO'.split('').map((char, i) => (
            <span key={i} className={`concierge-letter char-${i}`}>{char}</span>
          ))}
        </div>
        <div className="concierge-subtitle">Your Personal Leno AI</div>
      </div>

      {/* Footstep Trail */}
      {footsteps.map((step, i) => (
        <div
          key={i}
          className="footstep-particle"
          style={{
            left: step.x,
            top: step.y,
            opacity: step.opacity,
            transform: `scale(${step.scale})`
          }}
        />
      ))}

      {/* ═══ GENTLEMAN STICKMAN CHARACTER ═══ */}
      <div
        className={`stickman-container ${stickmanState}`}
        style={{
          transform: `translate(${stickmanPos.x}px, ${stickmanPos.y}px) scale(${stickmanState === 'hidden' ? 0.72 : stickmanPose.scale})`,
          opacity: stickmanState === 'hidden' ? undefined : stickmanPose.opacity,
          ['--step-seconds' as string]: '1.6s'
        }}
      >
        <div className="stickman-wrapper gentleman-shell">
          <svg
            className="gentleman-svg"
            viewBox="0 0 280 220"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <defs>
              {/* Glow filter for the character */}
              <filter id="char-glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
              {/* Soft shadow */}
              <filter id="soft-shadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="rgba(99,102,241,0.3)" />
              </filter>
              {/* Umbrella gradient */}
              <linearGradient id="umbrella-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="rgba(99,102,241,0.6)" />
                <stop offset="50%" stopColor="rgba(139,92,246,0.5)" />
                <stop offset="100%" stopColor="rgba(59,130,246,0.4)" />
              </linearGradient>
              {/* Body glow gradient */}
              <linearGradient id="body-grad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#e2e8f0" />
                <stop offset="100%" stopColor="#94a3b8" />
              </linearGradient>
              {/* Cane gradient */}
              <linearGradient id="cane-grad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#c4b5fd" />
                <stop offset="40%" stopColor="#a78bfa" />
                <stop offset="100%" stopColor="#7c3aed" />
              </linearGradient>
            </defs>

            <g className="gentleman-glow" filter="url(#soft-shadow)">
              {/* ─── HEAD: Hat + Face ─── */}
              <g className="gentleman-head">
                {/* Top Hat */}
                <rect className="hat-brim" x="70" y="28" width="56" height="5" rx="2.5"
                  fill="rgba(255,255,255,0.9)" stroke="rgba(255,255,255,0.95)" strokeWidth="1.5" />
                <rect className="hat-crown" x="78" y="6" width="40" height="24" rx="4"
                  fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.9)" strokeWidth="2" />
                <line x1="80" y1="24" x2="116" y2="24" stroke="rgba(139,92,246,0.7)" strokeWidth="2" />

                {/* Face */}
                <circle className="gent-face" cx="98" cy="46" r="15"
                  fill="rgba(255,255,255,0.06)" stroke="url(#body-grad)" strokeWidth="2.5" />
                {/* Eyes - subtle dots */}
                <circle cx="93" cy="44" r="1.5" fill="rgba(255,255,255,0.8)" />
                <circle cx="103" cy="44" r="1.5" fill="rgba(255,255,255,0.8)" />
                {/* Slight smile */}
                <path d="M93 50 Q98 54 103 50" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.2" strokeLinecap="round" />
              </g>

              {/* ─── BODY: Torso ─── */}
              <g className="gentleman-body">
                {/* Neck */}
                <line x1="98" y1="61" x2="98" y2="68" stroke="url(#body-grad)" strokeWidth="3" strokeLinecap="round" />
                {/* Shoulders */}
                <path d="M72 72 Q85 66 98 68 Q111 66 124 72" fill="none" stroke="url(#body-grad)" strokeWidth="2.5" strokeLinecap="round" />
                {/* Torso - slightly tapered */}
                <path d="M78 72 L82 120 L98 124 L114 120 L118 72" fill="rgba(255,255,255,0.04)"
                  stroke="url(#body-grad)" strokeWidth="2" strokeLinejoin="round" />
                {/* Belt line */}
                <line x1="84" y1="112" x2="112" y2="112" stroke="rgba(139,92,246,0.5)" strokeWidth="1.8" strokeLinecap="round" />
                {/* Belt buckle */}
                <rect x="94" y="109" width="8" height="6" rx="1.5" fill="none" stroke="rgba(167,139,250,0.7)" strokeWidth="1.2" />
                {/* Coat tails / jacket split */}
                <line x1="98" y1="112" x2="98" y2="124" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
              </g>

              {/* ─── LEFT ARM (Umbrella arm) ─── */}
              <g className="gentleman-arm-left">
                {/* Upper arm */}
                <line x1="78" y1="74" x2="62" y2="56" stroke="url(#body-grad)" strokeWidth="2.5" strokeLinecap="round" />
                {/* Lower arm */}
                <line x1="62" y1="56" x2="56" y2="36" stroke="url(#body-grad)" strokeWidth="2.2" strokeLinecap="round" />
                {/* Hand grip */}
                <circle cx="56" cy="34" r="3" fill="rgba(255,255,255,0.15)" stroke="url(#body-grad)" strokeWidth="1.5" />

                {/* ═══ UMBRELLA ═══ */}
                <g className="gentleman-umbrella">
                  {/* Umbrella pole */}
                  <line x1="56" y1="34" x2="56" y2="-4" stroke="rgba(255,255,255,0.85)" strokeWidth="2" strokeLinecap="round" />
                  {/* Umbrella tip */}
                  <circle cx="56" cy="-6" r="2" fill="rgba(139,92,246,0.8)" />
                  {/* Canopy - elegant dome shape */}
                  <path d="M16 0 Q24 -22 38 -26 Q48 -28 56 -28 Q64 -28 74 -26 Q88 -22 96 0"
                    fill="url(#umbrella-grad)" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" />
                  {/* Canopy scallops */}
                  <path d="M16 0 Q24 8 32 0 Q40 8 48 0 Q52 4 56 0 Q60 4 64 0 Q72 8 80 0 Q88 8 96 0"
                    fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" />
                  {/* Ribs */}
                  <line x1="56" y1="-28" x2="32" y2="0" stroke="rgba(255,255,255,0.25)" strokeWidth="0.8" />
                  <line x1="56" y1="-28" x2="56" y2="0" stroke="rgba(255,255,255,0.25)" strokeWidth="0.8" />
                  <line x1="56" y1="-28" x2="80" y2="0" stroke="rgba(255,255,255,0.25)" strokeWidth="0.8" />
                  {/* Handle hook at bottom */}
                  <path d="M56 34 Q56 40 52 42 Q48 44 48 40" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" strokeLinecap="round" />
                </g>
              </g>

              {/* ─── RIGHT ARM (Cane / Walking Stick arm) ─── */}
              <g className="gentleman-arm-right">
                {/* Upper arm */}
                <line x1="118" y1="74" x2="138" y2="90" stroke="url(#body-grad)" strokeWidth="2.5" strokeLinecap="round" />
                {/* Lower arm */}
                <line x1="138" y1="90" x2="148" y2="108" stroke="url(#body-grad)" strokeWidth="2.2" strokeLinecap="round" />
                {/* Hand grip */}
                <circle cx="148" cy="110" r="3" fill="rgba(255,255,255,0.15)" stroke="url(#body-grad)" strokeWidth="1.5" />

                {/* ═══ WALKING CANE ═══ */}
                <g className="gentleman-cane">
                  {/* Cane shaft */}
                  <line x1="148" y1="110" x2="158" y2="200" stroke="url(#cane-grad)" strokeWidth="2.8" strokeLinecap="round" />
                  {/* Cane handle - curved hook */}
                  <path d="M148 110 Q144 104 140 106 Q136 108 140 112"
                    fill="none" stroke="rgba(167,139,250,0.9)" strokeWidth="2.5" strokeLinecap="round" />
                  {/* Cane tip */}
                  <circle cx="158" cy="202" r="2.5" fill="rgba(167,139,250,0.6)" />
                  {/* Decorative ring on cane */}
                  <ellipse cx="152" cy="140" rx="3" ry="1.5" fill="none" stroke="rgba(139,92,246,0.5)" strokeWidth="1" />
                  <ellipse cx="154" cy="160" rx="2.5" ry="1.2" fill="none" stroke="rgba(139,92,246,0.35)" strokeWidth="0.8" />
                </g>
              </g>

              {/* ─── LEGS ─── */}
              <g className="gentleman-legs">
                {/* Front leg */}
                <g className="gentleman-leg-front">
                  {/* Thigh */}
                  <line x1="104" y1="124" x2="120" y2="160" stroke="url(#body-grad)" strokeWidth="2.8" strokeLinecap="round" />
                  {/* Shin */}
                  <line x1="120" y1="160" x2="112" y2="194" stroke="url(#body-grad)" strokeWidth="2.4" strokeLinecap="round" />
                  {/* Shoe */}
                  <path d="M106 194 L112 194 L122 196 L122 200 L104 200 L104 196 Z"
                    fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" strokeLinejoin="round" />
                </g>
                {/* Back leg */}
                <g className="gentleman-leg-back">
                  {/* Thigh */}
                  <line x1="92" y1="124" x2="76" y2="162" stroke="url(#body-grad)" strokeWidth="2.8" strokeLinecap="round" />
                  {/* Shin */}
                  <line x1="76" y1="162" x2="82" y2="196" stroke="url(#body-grad)" strokeWidth="2.4" strokeLinecap="round" />
                  {/* Shoe */}
                  <path d="M76 196 L82 196 L92 198 L92 202 L74 202 L74 198 Z"
                    fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.55)" strokeWidth="1.5" strokeLinejoin="round" />
                </g>
              </g>

              {/* ─── COAT TAILS (flowing behind) ─── */}
              <g className="gentleman-coattails">
                <path className="coattail-left" d="M84 120 Q78 140 70 155"
                  fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" strokeLinecap="round" />
                <path className="coattail-right" d="M112 120 Q118 140 124 155"
                  fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" strokeLinecap="round" />
              </g>

              {/* ─── SHADOW on ground ─── */}
              <ellipse className="gentleman-shadow" cx="98" cy="205" rx="35" ry="4"
                fill="rgba(99,102,241,0.1)" />
            </g>
          </svg>
        </div>
      </div>

      {/* Lightning / Glow Effect */}
      {lightningActive && (
        <div className="lightning-flash-container">
          <Zap size={128} className="giant-bolt" />
          <div className="screen-flash"></div>
        </div>
      )}

      {/* Cane Pointer Line (Pointing) */}
      {stickmanState === 'pointing' && pointerLine && (
        <div className="cane-pointer" style={{
          left: pointerLine.left,
          top: pointerLine.top,
          width: pointerLine.width,
          transform: `rotate(${pointerLine.angle}deg)`
        }}>
          <span className="cane-pointer-tip"></span>
          <span className="cane-pointer-glow"></span>
        </div>
      )}

      {/* Main Content Area */}
      <main className="hero-section">
        <div className="hero-content">

          <div className="text-center mb-12">
            <h2 className="hero-title">
              Orchestrate Your Life
            </h2>
            <p className="hero-subtitle">
              Precision tools for the modern achiever.
              <br />Stop managing tasks. Start designing success.
            </p>
          </div>

          {/* Feature Showcase Box (Replaces Quotes) */}
          <div className="feature-showcase">
            <div className="feature-carousel" style={{ transform: `translateY(-${activeFeature * 140}px)` }}>
              {FEATURES.map((feat) => (
                <div key={feat.id} className="feature-slide">
                  <div className="feature-icon" style={{ borderColor: feat.color, color: feat.color }}>
                    {feat.icon}
                  </div>
                  <div className="feature-text">
                    <h3>{feat.title}</h3>
                    <p>{feat.description}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="feature-indicators">
              {FEATURES.map((_, idx) => (
                <div
                  key={idx}
                  className={`indicator ${idx === activeFeature ? 'active' : ''}`}
                  onClick={() => setActiveFeature(idx)}
                />
              ))}
            </div>
          </div>

          {/* CTA */}
          <div className="cta-wrapper">
            <button
              ref={buttonRef}
              className={`cta-button-premium ${btnHovered ? 'hovered' : ''}`}
              onMouseEnter={() => setBtnHovered(true)}
              onMouseLeave={() => setBtnHovered(false)}
              onClick={() => navigate('/register')}
            >
              <span className="btn-text">Begin Journey</span>
              <div className="btn-icon">
                <ArrowRight size={20} />
              </div>
              <div className="btn-glow"></div>
            </button>
            <p className="cta-subtext">
              Join today for launch pricing. First 100 users get a limited discount.
              <br />
              Get 7 days free trial. <span className="secure-badge"><Lock size={12} style={{ display: 'inline', verticalAlign: 'middle' }} /> Payment secure with Stripe</span>
            </p>
          </div>

        </div>
      </main>

      {/* Landing Footer */}
      <footer className="landing-footer" style={{
        position: 'relative',
        zIndex: 10,
        padding: '2rem',
        textAlign: 'center',
        borderTop: '1px solid rgba(255, 255, 255, 0.05)',
        background: 'rgba(2, 6, 23, 0.8)',
        backdropFilter: 'blur(10px)'
      }}>
        <div className="footer-links" style={{ display: 'flex', justifyContent: 'center', gap: '2rem', marginBottom: '1rem' }}>
          <a href="/terms" target="_blank" rel="noopener noreferrer" style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem', textDecoration: 'none', transition: 'color 0.2s' }}>Terms of Service</a>
          <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem', textDecoration: 'none', transition: 'color 0.2s' }}>Privacy Policy</a>
          <a href="mailto:support@optileno.com" style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem', textDecoration: 'none', transition: 'color 0.2s' }}>Support</a>
        </div>
        <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.7rem' }}>
          &copy; 2026 Optileno. Built for the modern high achiever.
        </div>
      </footer>
    </div>
  );
}
