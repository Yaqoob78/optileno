import React from 'react';
import { Clock, TrendingUp, Zap, Target, AlertCircle, RefreshCw, Activity, Layers, Cpu } from 'lucide-react';
import { useTimeIntelligence } from '../../hooks/useTimeIntelligence';
import '../../styles/components/analytics/TimeIntelligence.css';

const TimeIntelligence: React.FC = () => {
  const { data, isLoading, error } = useTimeIntelligence();

  if (isLoading || error || !data) {
    return (
      <div className="time-intelligence-container loading-state glass-card">
        <div className="temporal-scanning-ui">
          <div className="scanner-radar">
            <div className="radar-sweep" />
            <Clock size={40} className="radar-icon" />
          </div>
          <div className="scanning-details">
            <h3 className="scanning-title">INITIALIZING SYSTEM...</h3>
            <p className="scanning-desc">
              {isLoading ? "SYNCING CHRONOTYPE DATA..." : "AWAITING NEURAL LINK..."}
            </p>
            <div className="scanning-progress-bar">
              <div className="scanning-progress-fill" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  const { chronotype, estimation, optimal_windows, efficiency } = data;

  // --- Futuristic Sub-Components ---

  // 1. Arc Reactor Chart for Accuracy
  const ReactorChart = ({ percentage, color, label }: { percentage: number, color: string, label: string }) => {
    const radius = 30;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (percentage / 100) * circumference;

    return (
      <div className="reactor-node">
        <div className="reactor-ring-container">
          <svg width="80" height="80" viewBox="0 0 80 80" className="reactor-svg">
            {/* Base Ring */}
            <circle cx="40" cy="40" r={radius} stroke="rgba(255,255,255,0.1)" strokeWidth="4" fill="none" />
            {/* Glow Ring */}
            <circle
              cx="40" cy="40" r={radius}
              stroke={color}
              strokeWidth="4"
              fill="none"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              strokeLinecap="round"
              transform="rotate(-90 40 40)"
              style={{ filter: `drop-shadow(0 0 4px ${color})` }}
            />
            {/* Inner Glow */}
            <circle cx="40" cy="40" r="2" fill={color} className="reactor-core-pulse" />
          </svg>
          <div className="reactor-value" style={{ color: color }}>{percentage}%</div>
        </div>
        <div className="reactor-label">{label}</div>
      </div>
    );
  };

  // 2. Cyber Timeline
  const CyberTimeline = () => {
    if (!optimal_windows.length) return <div className="no-data">System Standby...</div>;

    return (
      <div className="cyber-timeline">
        {optimal_windows.slice(0, 3).map((win, idx) => (
          <div key={idx} className="timeline-event">
            <div className="event-marker">
              <div className="marker-dot" />
              <div className="marker-line" />
            </div>
            <div className="event-content glass-panel-sm">
              <div className="event-time">
                <Clock size={12} className="text-accent" />
                <span>{win.start}</span>
              </div>
              <div className="event-label is-neon">{win.reason.split(' ')[0]} WINDOW</div>
              <div className="event-confidence">{(win.confidence)}% PROBABILITY</div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="time-intelligence-container futuristic-ui">
      {/* Header */}
      <div className="ti-header">
        <div className="ti-title-group">
          <div className="tech-icon-box">
            <Cpu size={18} className="spin-slow" />
          </div>
          <div className="header-text-col">
            <h3 className="neon-text">TEMPORAL INTELLIGENCE</h3>
            <span className="mono-caption">SYS.OPTIMIZATION.V4</span>
          </div>
        </div>
        <div className="ti-signal">
          <span className="signal-bars">
            <span className="bar b1"></span>
            <span className="bar b2"></span>
            <span className="bar b3"></span>
          </span>
          <span className="signal-text">LIVE</span>
        </div>
      </div>

      {/* Main Grid */}
      <div className="ti-grid-layout">

        {/* Left Col: Chronotype & Estimation */}
        <div className="ti-col-main">

          {/* Reaction Core (Estimation) */}
          <div className="sector-box">
            <div className="sector-header">
              <Target size={14} />
              <span>PREDICTION ACCURACY CORE</span>
            </div>
            <div className="reactor-grid">
              <ReactorChart
                percentage={estimation.overall_accuracy}
                color="var(--primary)"
                label="OVERALL"
              />
              {estimation.categories.slice(0, 2).map((cat, i) => (
                <ReactorChart
                  key={i}
                  percentage={cat.accuracy}
                  color={cat.accuracy > 70 ? 'var(--success)' : 'var(--warning)'}
                  label={cat.name.toUpperCase()}
                />
              ))}
            </div>
            <div className="sector-insight mono-text">
              &gt; SYSTEM ANALYSIS: {estimation.insight || "Calibration in progress..."}
            </div>
          </div>

          {/* Chronotype Strip */}
          <div className="sector-box glow-border">
            <div className="sector-header">
              <Activity size={14} />
              <span>CIRCADIAN RHYTHM: {chronotype.type.toUpperCase()}</span>
            </div>
            <div className="rhythm-visualizer">
              {/* 24 bars simulating the day */}
              {(chronotype as any).hourly_activity ? Array.from({ length: 24 }).map((_, i) => {
                const val = ((chronotype as any).hourly_activity[i] || 0);
                const max = Math.max(...Object.values((chronotype as any).hourly_activity as Record<string, number> || { 0: 1 }));
                const height = Math.max(20, (val / (max || 1)) * 100);
                const isPeak = chronotype.peak_hours.includes(i);

                return (
                  <div key={i} className={`rhythm-bar ${isPeak ? 'peak' : ''}`} style={{ height: `${height}%` }} title={`${i}:00`}></div>
                )
              }) : <div className="no-data-text">GATHERING BIOMETRICS...</div>}
            </div>
            <div className="rhythm-legend">
              <span>00:00</span>
              <span>12:00</span>
              <span>23:59</span>
            </div>
          </div>

        </div>

        {/* Right Col: Timeline & Stats */}
        <div className="ti-col-side">

          {/* Optimal Windows */}
          <div className="sector-box">
            <div className="sector-header">
              <Zap size={14} />
              <span>OPTIMAL WINDOWS</span>
            </div>
            <CyberTimeline />
          </div>

          {/* Diagnostics Grid */}
          <div className="sector-box">
            <div className="sector-header">
              <Layers size={14} />
              <span>DIAGNOSTICS</span>
            </div>
            <div className="diagnostics-grid">
              <div className="diag-item">
                <span className="diag-label">CTX SWITCH</span>
                <span className="diag-value danger">
                  {efficiency.context_switching_loss_hours || 0}<span>h</span>
                </span>
              </div>
              <div className="diag-item">
                <span className="diag-label">PLAN DELAY</span>
                <span className="diag-value warning">
                  {efficiency.planning_overhead_minutes || 0}<span>m</span>
                </span>
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};

export default TimeIntelligence;