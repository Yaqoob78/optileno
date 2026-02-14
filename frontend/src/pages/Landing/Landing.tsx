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
  const [stickmanPos, setStickmanPos] = useState({ x: -100, y: 0 });
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

  // Stickman walk logic - smoother movement with better easing
  useEffect(() => {
    let animationId: number;
    let hasArrived = false;

    const moveStickman = () => {
      if (!buttonRef.current || hasArrived) return;

      const btnRect = buttonRef.current.getBoundingClientRect();
      // Target position: Left of the button, lower to point down at it
      const targetX = btnRect.left - 120;
      // Position stickman higher so he points DOWN at button
      const groundLevel = btnRect.top - 80;

      setStickmanPos(prev => {
        const dx = targetX - prev.x;
        const dy = groundLevel - prev.y;

        // Check if arrived
        if (Math.abs(dx) < 5 && Math.abs(dy) < 5) {
          if (!hasArrived) {
            hasArrived = true;
            setStickmanState('pointing');

            // Lightning strikes when pointing - lasts 1 second
            setTimeout(() => {
              setLightningActive(true);
              setTimeout(() => {
                setLightningActive(false);
                // Disappear 3 seconds after pointing
                setTimeout(() => setStickmanState('hidden'), 3000);
              }, 1000);
            }, 200);
          }
          return { x: targetX, y: groundLevel };
        }

        // Even slower, smoother easing movement
        return {
          x: prev.x + dx * 0.008,
          y: prev.y + dy * 0.008
        };
      });

      animationId = requestAnimationFrame(moveStickman);
    };

    // Start walking after initial load
    const timeout = setTimeout(() => {
      moveStickman();
    }, 800);

    return () => {
      clearTimeout(timeout);
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
          transform: `translate(${stickmanPos.x}px, ${stickmanPos.y}px)`
        }}
      >
        <div className="stickman-wrapper">
          {/* Hat */}
          <div className="top-hat">
            <div className="hat-base"></div>
            <div className="hat-top"></div>
          </div>
          {/* Head */}
          <div className="head"></div>
          {/* Body */}
          <div className="torso">
            <div className="coat-tail"></div>
          </div>
          {/* Arms */}
          <div className="arm left"></div>
          <div className="arm right"></div>
          {/* Legs */}
          <div className="leg left"></div>
          <div className="leg right"></div>
        </div>

        {/* Umbrella (only visible when walking) */}
        {stickmanState === 'walking' && (
          <div className="stickman-umbrella">
            <div className="umbrella-dome"></div>
            <div className="umbrella-handle"></div>
          </div>
        )}
      </div>

      {/* Lightning Effect */}
      {lightningActive && (
        <div className="lightning-flash-container">
          <Zap size={200} className="giant-bolt" />
          <div className="screen-flash"></div>
        </div>
      )}

      {/* Helper Line (Pointing) */}
      {stickmanState === 'pointing' && (
        <div className="pointing-connector" style={{
          left: stickmanPos.x + 45,
          top: stickmanPos.y + 40,
          width: 80,
          transform: 'rotate(35deg)'
        }}></div>
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
              People are getting ahead. Start today.
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