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
  x: number; y: number; length: number; speed: number; opacity: number;
  width: number; hue: number; glowIntensity: number;
  rippleRadius: number; rippleOpacity: number;
  canvasHeight: number; canvasWidth: number;

  constructor(width: number, height: number) {
    this.canvasWidth = width; this.canvasHeight = height;
    this.x = Math.random() * width; this.y = Math.random() * -height;
    this.length = 15 + Math.random() * 25; this.speed = 3 + Math.random() * 4;
    this.opacity = 0.1 + Math.random() * 0.3; this.width = 1 + Math.random() * 1.5;
    this.hue = 210 + Math.random() * 20; this.glowIntensity = 0;
    this.rippleRadius = 0; this.rippleOpacity = 0;
  }

  update(mouse: { x: number, y: number, radius: number }) {
    this.y += this.speed;
    const dx = mouse.x - this.x, dy = mouse.y - this.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance < mouse.radius) {
      const force = (mouse.radius - distance) / mouse.radius;
      this.glowIntensity = Math.min(this.glowIntensity + force * 0.2, 1);
      this.speed += force * 0.5;
    } else { this.glowIntensity = Math.max(this.glowIntensity - 0.05, 0); }
    if (this.rippleRadius > 0) { this.rippleRadius += 4; this.rippleOpacity -= 0.05; if (this.rippleOpacity <= 0) this.rippleRadius = 0; }
    if (this.y > this.canvasHeight + this.length) { this.y = -this.length; this.x = Math.random() * this.canvasWidth; this.glowIntensity = 0; }
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.beginPath(); ctx.moveTo(this.x, this.y); ctx.lineTo(this.x, this.y + this.length);
    const grad = ctx.createLinearGradient(this.x, this.y, this.x, this.y + this.length);
    const lc = this.glowIntensity > 0 ? 100 : 70;
    grad.addColorStop(0, `hsla(${this.hue}, 80%, ${lc}%, 0)`);
    grad.addColorStop(1, `hsla(${this.hue}, 80%, ${lc}%, ${this.opacity + this.glowIntensity})`);
    ctx.strokeStyle = grad; ctx.lineWidth = this.width; ctx.lineCap = 'round'; ctx.stroke();
    if (this.rippleRadius > 0) {
      ctx.beginPath(); ctx.arc(this.x, this.y + this.length, this.rippleRadius, 0, Math.PI * 2, false);
      ctx.strokeStyle = `rgba(100, 200, 255, ${this.rippleOpacity})`; ctx.lineWidth = 1; ctx.stroke();
    }
  }
}

// ── Footstep Particle ───────────────────────────────────────────────────────
interface FootstepParticle { x: number; y: number; opacity: number; scale: number; }

// ── MAIN COMPONENT ──────────────────────────────────────────────────────────
export default function Landing() {
  const navigate = useNavigate();
  const [activeFeature, setActiveFeature] = useState(0);
  const [stickmanState, setStickmanState] = useState<'walking' | 'pointing' | 'hidden'>('walking');
  const [stickmanPos, setStickmanPos] = useState({ x: -300, y: 0 });
  const [stickmanScale, setStickmanScale] = useState(0.7);
  const [stickmanOpacity, setStickmanOpacity] = useState(0);
  const [pointerLine, setPointerLine] = useState<PointerLine | null>(null);
  const [lightningActive, setLightningActive] = useState(false);
  const [btnHovered, setBtnHovered] = useState(false);
  const [footsteps, setFootsteps] = useState<FootstepParticle[]>([]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const raindropsRef = useRef<Raindrop[]>([]);
  const mouseRef = useRef({ x: 0, y: 0, radius: 150 });

  // Feature Rotation
  useEffect(() => {
    const interval = setInterval(() => setActiveFeature(p => (p + 1) % FEATURES.length), 5000);
    return () => clearInterval(interval);
  }, []);

  // ── Stickman Walk Logic ─────────────────────────────────────────────────
  useEffect(() => {
    let animId = 0;
    const timers: number[] = [];

    // Character walks HORIZONTALLY at a fixed Y near the CTA button
    const walkDelayMs = 2000;
    const walkDurationMs = 13000; // Very slow, elegant

    const easeInOutQuart = (t: number) => t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2;

    setStickmanState('walking');
    setPointerLine(null);
    setLightningActive(false);
    setStickmanOpacity(0);

    const startWalk = () => {
      if (!buttonRef.current) return;

      const btnRect = buttonRef.current.getBoundingClientRect();
      // Walk at the same vertical level as the button, horizontally from left edge
      const walkY = btnRect.top + btnRect.height / 2 - 105; // Center character vertically with btn
      const startX = -300;
      const targetX = btnRect.left - 160; // Stop just to the left of the button
      const walkStart = performance.now();
      let lastStepTime = 0;

      setStickmanPos({ x: startX, y: walkY });

      const animate = (now: number) => {
        const elapsed = now - walkStart;
        const t = Math.min(elapsed / walkDurationMs, 1);
        const eased = easeInOutQuart(t);

        // Pure horizontal movement - constant Y
        const currentX = startX + (targetX - startX) * eased;
        setStickmanPos({ x: currentX, y: walkY });

        // Fade in during first 10%, then full opacity
        const fadeIn = Math.min(t / 0.1, 1);
        setStickmanOpacity(fadeIn);

        // Scale grows slightly as character approaches
        setStickmanScale(0.7 + eased * 0.25);

        // Footstep particles every ~700ms during active walking
        if (t > 0.05 && t < 0.92 && now - lastStepTime > 700) {
          lastStepTime = now;
          setFootsteps(prev => [...prev.slice(-15), {
            x: currentX + 75,
            y: walkY + 200,
            opacity: 0.5,
            scale: 0.3 + eased * 0.3,
          }]);
        }

        if (t < 1) { animId = requestAnimationFrame(animate); return; }

        // ── Arrived: Point at button ──
        setStickmanState('pointing');

        // The cane tip in the SVG is approximately at (185, 175) in viewBox coords
        // The SVG is 200x220, rendered at stickmanScale
        const svgRenderW = 200 * (0.7 + 0.25);
        const svgRenderH = 220 * (0.7 + 0.25);
        // Cane tip relative position in SVG: roughly x=185/200, y=175/220
        const caneTipScreenX = targetX + (185 / 200) * svgRenderW;
        const caneTipScreenY = walkY + (115 / 220) * svgRenderH;

        const ctaCenterX = btnRect.left + btnRect.width / 2;
        const ctaCenterY = btnRect.top + btnRect.height / 2;
        const dx = ctaCenterX - caneTipScreenX;
        const dy = ctaCenterY - caneTipScreenY;

        setPointerLine({
          left: caneTipScreenX,
          top: caneTipScreenY,
          width: Math.hypot(dx, dy),
          angle: Math.atan2(dy, dx) * (180 / Math.PI)
        });

        timers.push(window.setTimeout(() => {
          setLightningActive(true);
          timers.push(window.setTimeout(() => setLightningActive(false), 300));
          timers.push(window.setTimeout(() => {
            setStickmanState('hidden');
            setPointerLine(null);
            setFootsteps([]);
          }, 3500));
        }, 600));
      };

      animId = requestAnimationFrame(animate);
    };

    timers.push(window.setTimeout(startWalk, walkDelayMs));

    // Fade footsteps
    const fsInterval = setInterval(() => {
      setFootsteps(prev => prev.map(f => ({ ...f, opacity: f.opacity - 0.015 })).filter(f => f.opacity > 0));
    }, 100);

    return () => { timers.forEach(clearTimeout); cancelAnimationFrame(animId); clearInterval(fsInterval); };
  }, []);

  // Rain Canvas
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; raindropsRef.current = Array.from({ length: 150 }, () => new Raindrop(canvas.width, canvas.height)); };
    resize(); window.addEventListener('resize', resize);
    const anim = () => { ctx.clearRect(0, 0, canvas.width, canvas.height); raindropsRef.current.forEach(d => { d.update(mouseRef.current); d.draw(ctx); }); requestAnimationFrame(anim); };
    anim();
    const onMouse = (e: MouseEvent) => { mouseRef.current = { x: e.clientX, y: e.clientY, radius: 150 }; };
    window.addEventListener('mousemove', onMouse);
    return () => { window.removeEventListener('resize', resize); window.removeEventListener('mousemove', onMouse); };
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div className="landing-page futuristic">
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

      {/* Background Text */}
      <div className="concierge-heading">
        <div className="concierge-text-glow">
          {'OPTILENO'.split('').map((c, i) => <span key={i} className={`concierge-letter char-${i}`}>{c}</span>)}
        </div>
        <div className="concierge-subtitle">Your Personal Leno AI</div>
      </div>

      {/* Footstep Trail */}
      {footsteps.map((s, i) => (
        <div key={i} className="footstep-particle" style={{ left: s.x, top: s.y, opacity: s.opacity, transform: `scale(${s.scale})` }} />
      ))}

      {/* ═══════════════════════════════════════
          SIDE-PROFILE GENTLEMAN STICKMAN
          ═══════════════════════════════════════ */}
      <div
        className={`stickman-container ${stickmanState}`}
        style={{
          transform: `translate(${stickmanPos.x}px, ${stickmanPos.y}px) scale(${stickmanScale})`,
          opacity: stickmanState === 'hidden' ? undefined : stickmanOpacity,
        }}
      >
        <div className="stickman-wrapper gentleman-shell">
          <svg className="gentleman-svg" viewBox="0 0 200 220" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <defs>
              {/* Multi-layer glow */}
              <filter id="gent-glow" x="-60%" y="-60%" width="220%" height="220%">
                <feGaussianBlur in="SourceAlpha" stdDeviation="4" result="blur1" />
                <feFlood floodColor="#818cf8" floodOpacity="0.35" result="color1" />
                <feComposite in="color1" in2="blur1" operator="in" result="glow1" />
                <feGaussianBlur in="SourceAlpha" stdDeviation="12" result="blur2" />
                <feFlood floodColor="#6366f1" floodOpacity="0.15" result="color2" />
                <feComposite in="color2" in2="blur2" operator="in" result="glow2" />
                <feMerge>
                  <feMergeNode in="glow2" />
                  <feMergeNode in="glow1" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              {/* Umbrella fill */}
              <linearGradient id="umb-fill" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="rgba(129,140,248,0.55)" />
                <stop offset="100%" stopColor="rgba(99,102,241,0.3)" />
              </linearGradient>
              {/* Body stroke */}
              <linearGradient id="body-stroke" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#e2e8f0" />
                <stop offset="100%" stopColor="#a5b4fc" />
              </linearGradient>
              {/* Cane */}
              <linearGradient id="cane-g" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#c4b5fd" />
                <stop offset="100%" stopColor="#7c3aed" />
              </linearGradient>
            </defs>

            <g filter="url(#gent-glow)">
              {/* ── HEAD (side profile facing right) ── */}
              <g className="gent-head">
                {/* Top Hat */}
                <rect x="62" y="10" width="36" height="22" rx="3" fill="rgba(255,255,255,0.08)" stroke="url(#body-stroke)" strokeWidth="2.2" />
                <rect x="55" y="30" width="52" height="5" rx="2.5" fill="rgba(255,255,255,0.85)" stroke="url(#body-stroke)" strokeWidth="1.2" />
                {/* Hat band */}
                <line x1="64" y1="28" x2="96" y2="28" stroke="rgba(139,92,246,0.8)" strokeWidth="2.2" />

                {/* Head - slightly oval, side profile */}
                <ellipse cx="80" cy="48" rx="14" ry="15" fill="rgba(255,255,255,0.05)" stroke="url(#body-stroke)" strokeWidth="2.5" />
                {/* Eye */}
                <circle cx="88" cy="45" r="2" fill="rgba(255,255,255,0.85)" />
                <circle cx="88" cy="45" r="0.8" fill="rgba(99,102,241,0.9)" />
                {/* Nose hint */}
                <path d="M93 48 Q95 50 93 52" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1.2" strokeLinecap="round" />
                {/* Mouth */}
                <path d="M87 54 Q90 56 93 54" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1" strokeLinecap="round" />
              </g>

              {/* ── BODY (side profile) ── */}
              <g className="gent-body">
                {/* Neck */}
                <line x1="80" y1="63" x2="80" y2="72" stroke="url(#body-stroke)" strokeWidth="3" strokeLinecap="round" />
                {/* Torso - jacket shape, side view */}
                <path d="M68 74 L66 122 L80 126 L94 122 L92 74 Z"
                  fill="rgba(255,255,255,0.04)" stroke="url(#body-stroke)" strokeWidth="2.2" strokeLinejoin="round" />
                {/* Shoulder */}
                <path d="M68 74 Q76 68 80 72 Q84 68 92 74" fill="none" stroke="url(#body-stroke)" strokeWidth="2.2" strokeLinecap="round" />
                {/* Jacket lapel line */}
                <line x1="80" y1="74" x2="80" y2="108" stroke="rgba(255,255,255,0.12)" strokeWidth="0.8" />
                {/* Belt */}
                <line x1="68" y1="114" x2="92" y2="114" stroke="rgba(139,92,246,0.6)" strokeWidth="2" strokeLinecap="round" />
                <rect x="76" y="111" width="8" height="6" rx="1.5" fill="none" stroke="rgba(167,139,250,0.7)" strokeWidth="1.2" />
                {/* Pocket square hint */}
                <path d="M87 82 L90 80 L93 83 L90 86 Z" fill="rgba(139,92,246,0.3)" stroke="rgba(139,92,246,0.5)" strokeWidth="0.8" />
              </g>

              {/* ── BACK ARM (Left arm - holds umbrella, behind body) ── */}
              <g className="gent-arm-back">
                {/* Upper arm */}
                <line x1="72" y1="76" x2="60" y2="62" stroke="url(#body-stroke)" strokeWidth="2.8" strokeLinecap="round" />
                {/* Forearm */}
                <line x1="60" y1="62" x2="58" y2="40" stroke="url(#body-stroke)" strokeWidth="2.4" strokeLinecap="round" />
                {/* Hand */}
                <circle cx="58" cy="38" r="3.5" fill="rgba(255,255,255,0.08)" stroke="url(#body-stroke)" strokeWidth="1.5" />
              </g>

              {/* ── UMBRELLA (held by back arm, overhead) ── */}
              <g className="gent-umbrella">
                {/* Pole */}
                <line x1="58" y1="38" x2="58" y2="2" stroke="rgba(255,255,255,0.8)" strokeWidth="2" strokeLinecap="round" />
                {/* Canopy dome */}
                <path d="M22 6 Q30 -16 44 -20 Q52 -22 58 -22 Q64 -22 72 -20 Q86 -16 94 6"
                  fill="url(#umb-fill)" stroke="rgba(255,255,255,0.65)" strokeWidth="1.8" />
                {/* Scalloped edge */}
                <path d="M22 6 Q30 14 38 6 Q46 14 54 6 Q58 10 62 6 Q70 14 78 6 Q86 14 94 6"
                  fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" />
                {/* Ribs */}
                <line x1="58" y1="-22" x2="38" y2="6" stroke="rgba(255,255,255,0.2)" strokeWidth="0.7" />
                <line x1="58" y1="-22" x2="58" y2="6" stroke="rgba(255,255,255,0.2)" strokeWidth="0.7" />
                <line x1="58" y1="-22" x2="78" y2="6" stroke="rgba(255,255,255,0.2)" strokeWidth="0.7" />
                {/* Tip ornament */}
                <circle cx="58" cy="-24" r="2.5" fill="rgba(139,92,246,0.7)" stroke="rgba(255,255,255,0.5)" strokeWidth="0.8" />
                {/* Hook handle */}
                <path d="M58 38 Q58 44 54 46 Q50 48 50 44" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="1.8" strokeLinecap="round" />
              </g>

              {/* ── BACK LEG ── */}
              <g className="gent-leg-back">
                <line x1="76" y1="126" x2="68" y2="162" stroke="url(#body-stroke)" strokeWidth="2.8" strokeLinecap="round" />
                <line x1="68" y1="162" x2="72" y2="196" stroke="url(#body-stroke)" strokeWidth="2.4" strokeLinecap="round" />
                {/* Shoe */}
                <path d="M66 196 L72 196 L84 198 L84 203 L64 203 L64 198 Z"
                  fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" strokeLinejoin="round" />
              </g>

              {/* ── FRONT LEG ── */}
              <g className="gent-leg-front">
                <line x1="84" y1="126" x2="96" y2="160" stroke="url(#body-stroke)" strokeWidth="3" strokeLinecap="round" />
                <line x1="96" y1="160" x2="90" y2="196" stroke="url(#body-stroke)" strokeWidth="2.6" strokeLinecap="round" />
                {/* Shoe */}
                <path d="M84 196 L90 196 L102 198 L102 203 L82 203 L82 198 Z"
                  fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.65)" strokeWidth="1.5" strokeLinejoin="round" />
              </g>

              {/* ── FRONT ARM (Right arm - holds cane, in front of body) ── */}
              <g className="gent-arm-front">
                {/* Upper arm */}
                <line x1="88" y1="76" x2="104" y2="92" stroke="url(#body-stroke)" strokeWidth="2.8" strokeLinecap="round" />
                {/* Forearm */}
                <line x1="104" y1="92" x2="112" y2="110" stroke="url(#body-stroke)" strokeWidth="2.4" strokeLinecap="round" />
                {/* Hand */}
                <circle cx="112" cy="112" r="3.5" fill="rgba(255,255,255,0.08)" stroke="url(#body-stroke)" strokeWidth="1.5" />
              </g>

              {/* ── WALKING CANE ── */}
              <g className="gent-cane">
                {/* Handle - elegant curved crook */}
                <path d="M112 112 Q108 104 104 106 Q100 108 104 114"
                  fill="none" stroke="rgba(167,139,250,0.95)" strokeWidth="2.8" strokeLinecap="round" />
                {/* Shaft */}
                <line x1="112" y1="112" x2="120" y2="200" stroke="url(#cane-g)" strokeWidth="2.8" strokeLinecap="round" />
                {/* Decorative rings */}
                <ellipse cx="115" cy="140" rx="3.5" ry="1.5" fill="none" stroke="rgba(139,92,246,0.5)" strokeWidth="1" />
                <ellipse cx="117" cy="165" rx="3" ry="1.2" fill="none" stroke="rgba(139,92,246,0.35)" strokeWidth="0.8" />
                {/* Tip */}
                <circle cx="120" cy="202" r="2.5" fill="rgba(167,139,250,0.5)" />
              </g>

              {/* ── COAT TAIL (flowing behind) ── */}
              <g className="gent-coattail">
                <path className="coattail-flow" d="M68 122 Q58 142 50 160"
                  fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="1.8" strokeLinecap="round" />
                <path className="coattail-flow-2" d="M72 122 Q64 138 58 152"
                  fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1.2" strokeLinecap="round" />
              </g>

              {/* ── GROUND SHADOW ── */}
              <ellipse className="gent-shadow" cx="85" cy="207" rx="40" ry="4" fill="rgba(99,102,241,0.12)" />
            </g>
          </svg>
        </div>
      </div>

      {/* Lightning Effect */}
      {lightningActive && (
        <div className="lightning-flash-container">
          <Zap size={128} className="giant-bolt" />
          <div className="screen-flash"></div>
        </div>
      )}

      {/* Cane Pointer Line */}
      {stickmanState === 'pointing' && pointerLine && (
        <div className="cane-pointer" style={{
          left: pointerLine.left, top: pointerLine.top,
          width: pointerLine.width,
          transform: `rotate(${pointerLine.angle}deg)`
        }}>
          <span className="cane-pointer-tip"></span>
          <span className="cane-pointer-glow"></span>
        </div>
      )}

      {/* Main Content */}
      <main className="hero-section">
        <div className="hero-content">
          <div className="text-center mb-12">
            <h2 className="hero-title">Orchestrate Your Life</h2>
            <p className="hero-subtitle">
              Precision tools for the modern achiever.
              <br />Stop managing tasks. Start designing success.
            </p>
          </div>

          <div className="feature-showcase">
            <div className="feature-carousel" style={{ transform: `translateY(-${activeFeature * 140}px)` }}>
              {FEATURES.map(feat => (
                <div key={feat.id} className="feature-slide">
                  <div className="feature-icon" style={{ borderColor: feat.color, color: feat.color }}>{feat.icon}</div>
                  <div className="feature-text"><h3>{feat.title}</h3><p>{feat.description}</p></div>
                </div>
              ))}
            </div>
            <div className="feature-indicators">
              {FEATURES.map((_, i) => <div key={i} className={`indicator ${i === activeFeature ? 'active' : ''}`} onClick={() => setActiveFeature(i)} />)}
            </div>
          </div>

          <div className="cta-wrapper">
            <button ref={buttonRef} className={`cta-button-premium ${btnHovered ? 'hovered' : ''}`}
              onMouseEnter={() => setBtnHovered(true)} onMouseLeave={() => setBtnHovered(false)}
              onClick={() => navigate('/register')}>
              <span className="btn-text">Begin Journey</span>
              <div className="btn-icon"><ArrowRight size={20} /></div>
              <div className="btn-glow"></div>
            </button>
            <p className="cta-subtext">
              Join today for launch pricing. First 100 users get a limited discount.
              <br />Get 3 days free trial. <span className="secure-badge"><Lock size={12} style={{ display: 'inline', verticalAlign: 'middle' }} /> Secure payments with Cashfree</span>
            </p>
          </div>
        </div>
      </main>

      <footer className="landing-footer" style={{ position: 'relative', zIndex: 10, padding: '2rem', textAlign: 'center', borderTop: '1px solid rgba(255, 255, 255, 0.05)', background: 'rgba(2, 6, 23, 0.8)', backdropFilter: 'blur(10px)' }}>
        <div className="footer-links" style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <a href="/terms" target="_blank" rel="noopener noreferrer" style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem', textDecoration: 'none' }}>Terms & Conditions</a>
          <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem', textDecoration: 'none' }}>Privacy Policy</a>
          <a href="/refund" target="_blank" rel="noopener noreferrer" style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem', textDecoration: 'none' }}>Refund Policy</a>
          <a href="/cookies" target="_blank" rel="noopener noreferrer" style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem', textDecoration: 'none' }}>Cookies Policy</a>
          <a href="mailto:optilenoai@gmail.com" style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem', textDecoration: 'none' }}>Contact</a>
        </div>

        {/* Social Follow Links */}
        <div className="footer-social" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1.25rem', marginBottom: '1rem' }}>
          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.75rem', letterSpacing: '0.05em' }}>Follow us</span>
          <a
            href="https://www.instagram.com/optilenoai?igsh=MXRyaWI5cXc3bHlhcg=="
            target="_blank"
            rel="noopener noreferrer"
            className="footer-social-link"
            aria-label="Follow us on Instagram"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'rgba(255,255,255,0.45)', fontSize: '0.8rem', textDecoration: 'none', padding: '0.35rem 0.7rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)', transition: 'all 0.3s ease' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
              <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
              <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
            </svg>
            <span>@optilenoai</span>
          </a>
          <a
            href="https://x.com/optilenoai"
            target="_blank"
            rel="noopener noreferrer"
            className="footer-social-link"
            aria-label="Follow us on X"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'rgba(255,255,255,0.45)', fontSize: '0.8rem', textDecoration: 'none', padding: '0.35rem 0.7rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)', transition: 'all 0.3s ease' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
            <span>@optilenoai</span>
          </a>
        </div>

        <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.7rem' }}>&copy; 2026 Optileno. Built for the modern high achiever.</div>
      </footer>
    </div>
  );
}
