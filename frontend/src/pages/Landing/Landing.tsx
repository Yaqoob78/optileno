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

  // Stickman walk logic - smooth long run-in, then precise sword pointing at CTA
  useEffect(() => {
    let animationId = 0;
    const timers: number[] = [];
    const startX = -420;
    const startY = window.innerHeight * 0.8;
    const walkDelayMs = 1300;
    const walkDurationMs = 8200;

    const easeInOutSine = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2;

    setStickmanState('walking');
    setPointerLine(null);
    setLightningActive(false);
    setStickmanPos({ x: startX, y: startY });
    setStickmanPose({ scale: 0.54, opacity: 0.4 });

    const startWalk = () => {
      if (!buttonRef.current) return;

      const btnRect = buttonRef.current.getBoundingClientRect();
      const targetX = btnRect.left - 170;
      const targetY = btnRect.top - 72;
      const walkStartTime = performance.now();

      const animateWalk = (now: number) => {
        const elapsed = now - walkStartTime;
        const t = Math.min(elapsed / walkDurationMs, 1);
        const eased = easeInOutSine(t);

        setStickmanPos({
          x: startX + (targetX - startX) * eased,
          y: startY + (targetY - startY) * eased
        });
        setStickmanPose({
          scale: 0.54 + eased * 0.4,
          opacity: 0.4 + eased * 0.6
        });

        if (t < 1) {
          animationId = requestAnimationFrame(animateWalk);
          return;
        }

        setStickmanState('pointing');

        const swordBaseX = targetX + 153;
        const swordBaseY = targetY + 74;
        const ctaX = btnRect.left + btnRect.width * 0.5;
        const ctaY = btnRect.top + btnRect.height * 0.55;
        const lineDX = ctaX - swordBaseX;
        const lineDY = ctaY - swordBaseY;
        setPointerLine({
          left: swordBaseX,
          top: swordBaseY,
          width: Math.hypot(lineDX, lineDY),
          angle: Math.atan2(lineDY, lineDX) * (180 / Math.PI)
        });

        timers.push(window.setTimeout(() => {
          setLightningActive(true);
          timers.push(window.setTimeout(() => setLightningActive(false), 260));
          timers.push(window.setTimeout(() => {
            setStickmanState('hidden');
            setPointerLine(null);
          }, 2500));
        }, 420));
      };

      animationId = requestAnimationFrame(animateWalk);
    };

    timers.push(window.setTimeout(startWalk, walkDelayMs));

    return () => {
      timers.forEach((timerId) => clearTimeout(timerId));
      if (animationId) cancelAnimationFrame(animationId);
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

      {/* Stickman Character */}
      <div
        className={`stickman-container ${stickmanState}`}
        style={{
          transform: `translate(${stickmanPos.x}px, ${stickmanPos.y}px) scale(${stickmanState === 'hidden' ? 0.72 : stickmanPose.scale})`,
          opacity: stickmanState === 'hidden' ? undefined : stickmanPose.opacity,
          ['--step-seconds' as string]: stickmanState === 'walking' ? '1.24s' : '1.5s'
        }}
      >
        <div className="stickman-wrapper warrior-shell">
          <svg
            className="warrior-svg"
            viewBox="0 0 240 180"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <g className="warrior-glow">
              <g className="warrior-body">
                <circle className="warrior-stroke" cx="92" cy="44" r="16" />
                <line className="warrior-stroke" x1="92" y1="60" x2="92" y2="108" />
                <circle className="warrior-fill" cx="92" cy="110" r="4" />

                <path className="warrior-stroke" d="M78 60 C86 54, 98 54, 106 60" />
                <path className="warrior-stroke warrior-scarf" d="M82 64 C70 80, 70 92, 84 98" />
                <path className="warrior-stroke warrior-scarf" d="M102 64 C118 78, 120 88, 110 96" />
              </g>

              <g className="warrior-arms">
                <g className="warrior-arm warrior-arm-right">
                  <line className="warrior-stroke" x1="92" y1="76" x2="132" y2="80" />
                  <line className="warrior-stroke" x1="132" y1="80" x2="160" y2="78" />
                  <g className="warrior-sword">
                    <line className="warrior-stroke" x1="160" y1="78" x2="210" y2="72" />
                    <line className="warrior-stroke" x1="156" y1="80" x2="162" y2="74" />
                    <line className="warrior-stroke" x1="158" y1="78" x2="168" y2="84" />
                  </g>
                </g>

                <g className="warrior-arm warrior-arm-left">
                  <line className="warrior-stroke" x1="92" y1="74" x2="110" y2="52" />
                  <line className="warrior-stroke" x1="110" y1="52" x2="122" y2="34" />
                  <g className="warrior-umbrella">
                    <line className="warrior-stroke" x1="122" y1="34" x2="122" y2="18" />
                    <path className="warrior-stroke" d="M122 18 C120 16, 120 14, 122 12" />
                    <path
                      className="warrior-stroke warrior-canopy"
                      d="M64 18 C78 2, 98 2, 122 12 C146 2, 166 2, 180 18"
                    />
                    <path
                      className="warrior-stroke warrior-canopy"
                      d="M64 18 C74 28, 88 28, 96 20 C104 28, 118 28, 122 20 C126 28, 140 28, 148 20 C156 28, 170 28, 180 18"
                    />
                  </g>
                </g>
              </g>

              <g className="warrior-legs">
                <g className="warrior-leg warrior-leg-front">
                  <line className="warrior-stroke" x1="92" y1="110" x2="112" y2="140" />
                  <line className="warrior-stroke" x1="112" y1="140" x2="98" y2="160" />
                  <line className="warrior-stroke" x1="94" y1="160" x2="114" y2="160" />
                </g>
                <g className="warrior-leg warrior-leg-back">
                  <line className="warrior-stroke" x1="92" y1="110" x2="78" y2="142" />
                  <line className="warrior-stroke" x1="78" y1="142" x2="86" y2="162" />
                  <line className="warrior-stroke" x1="78" y1="162" x2="96" y2="162" />
                </g>
              </g>
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

      {/* Sword (Pointing) */}
      {stickmanState === 'pointing' && pointerLine && (
        <div className="sword-pointer" style={{
          left: pointerLine.left,
          top: pointerLine.top,
          width: pointerLine.width,
          transform: `rotate(${pointerLine.angle}deg)`
        }}>
          <span className="sword-guard"></span>
          <span className="sword-tip"></span>
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
