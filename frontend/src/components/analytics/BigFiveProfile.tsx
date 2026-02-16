import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
    TrendingUp,
    TrendingDown,
    Minus,
    RefreshCw,
    Play,
    Lock,
    Calendar,
    Sparkles,
    ChevronRight,
    Award,
    Clock
} from 'lucide-react';
import '../../styles/components/analytics/BigFiveProfile.css';
import BigFiveTestModal from './BigFiveTestModal';
import { bigFiveTestService, BigFiveTestStatus, BigFiveProfile as BigFiveProfileData } from '../../services/api/bigFiveTest.service';

// ── Animated Fingerprint SVG ──────────────────────────────────────
const FingerprintIcon: React.FC<{ animate?: boolean }> = ({ animate = true }) => (
    <div className={`fingerprint-icon-container ${animate ? 'animate' : ''}`}>
        <svg viewBox="0 0 120 120" className="fingerprint-svg" aria-hidden="true">
            <defs>
                <linearGradient id="fpGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#06b6d4" />
                    <stop offset="50%" stopColor="#22d3ee" />
                    <stop offset="100%" stopColor="#67e8f9" />
                </linearGradient>
                <filter id="fpGlow">
                    <feGaussianBlur stdDeviation="2" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
            </defs>
            {/* Concentric arcs forming a fingerprint pattern */}
            <g filter="url(#fpGlow)" fill="none" stroke="url(#fpGrad)" strokeLinecap="round">
                {/* Core */}
                <ellipse cx="60" cy="62" rx="6" ry="8" strokeWidth="1.8" className="fp-ring fp-r1" />
                {/* Ring 2 */}
                <path d="M 48 62 Q 48 48, 60 48 Q 72 48, 72 62 Q 72 76, 60 78" strokeWidth="1.6" className="fp-ring fp-r2" />
                {/* Ring 3 */}
                <path d="M 42 65 Q 40 42, 60 40 Q 80 42, 78 65 Q 76 82, 58 85" strokeWidth="1.5" className="fp-ring fp-r3" />
                {/* Ring 4 */}
                <path d="M 36 68 Q 34 36, 60 33 Q 86 36, 84 68 Q 82 88, 55 92" strokeWidth="1.4" className="fp-ring fp-r4" />
                {/* Ring 5 — outer */}
                <path d="M 30 72 Q 28 28, 60 26 Q 92 28, 90 72 Q 88 96, 52 98" strokeWidth="1.3" className="fp-ring fp-r5" />
                {/* Partial arcs for realism */}
                <path d="M 26 55 Q 24 24, 60 20 Q 96 24, 94 55" strokeWidth="1.2" className="fp-ring fp-r6" opacity="0.6" />
                <path d="M 34 80 Q 32 96, 48 102" strokeWidth="1.1" className="fp-ring fp-r7" opacity="0.5" />
            </g>
            {/* Center dot */}
            <circle cx="60" cy="62" r="2" fill="#22d3ee" className="fp-center-dot" />
        </svg>
    </div>
);

// ── Pentagon Radar Chart ──────────────────────────────────────────
interface RadarProps {
    scores: Record<string, number>;
}

const RADAR_TRAITS = ['openness', 'conscientiousness', 'extraversion', 'agreeableness', 'neuroticism'] as const;
const RADAR_LABELS = ['Open', 'Consc', 'Extra', 'Agree', 'Stability'];
const RADAR_CX = 140;
const RADAR_CY = 130;
const RADAR_R = 100;

function polarToXY(cx: number, cy: number, r: number, index: number, total: number) {
    const angle = (Math.PI * 2 * index) / total - Math.PI / 2;
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
}

function buildPolygon(cx: number, cy: number, r: number, count: number): string {
    return Array.from({ length: count }, (_, i) => {
        const p = polarToXY(cx, cy, r, i, count);
        return `${p.x},${p.y}`;
    }).join(' ');
}

const RadarChart: React.FC<RadarProps> = ({ scores }) => {
    const [visible, setVisible] = useState(false);
    const ref = useRef<SVGSVGElement>(null);

    useEffect(() => {
        const t = setTimeout(() => setVisible(true), 150);
        return () => clearTimeout(t);
    }, []);

    const n = RADAR_TRAITS.length;
    // For neuroticism, invert to "Emotional Stability"
    const values = RADAR_TRAITS.map(t =>
        t === 'neuroticism' ? 100 - (scores[t] || 0) : (scores[t] || 0)
    );

    const dataPoints = values.map((v, i) => {
        const frac = v / 100;
        return polarToXY(RADAR_CX, RADAR_CY, RADAR_R * frac, i, n);
    });
    const dataPolygon = dataPoints.map(p => `${p.x},${p.y}`).join(' ');

    return (
        <svg
            ref={ref}
            viewBox="0 0 280 260"
            className="radar-chart-svg"
            aria-label="Big Five personality radar chart"
        >
            <defs>
                <linearGradient id="radarFill" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="#22d3ee" stopOpacity="0.15" />
                </linearGradient>
                <linearGradient id="radarStroke" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#06b6d4" />
                    <stop offset="100%" stopColor="#67e8f9" />
                </linearGradient>
            </defs>

            {/* Grid rings */}
            {[0.25, 0.5, 0.75, 1].map((frac) => (
                <polygon
                    key={frac}
                    points={buildPolygon(RADAR_CX, RADAR_CY, RADAR_R * frac, n)}
                    fill="none"
                    stroke="rgba(255,255,255,0.06)"
                    strokeWidth="1"
                />
            ))}

            {/* Axis lines */}
            {Array.from({ length: n }, (_, i) => {
                const p = polarToXY(RADAR_CX, RADAR_CY, RADAR_R, i, n);
                return (
                    <line
                        key={i}
                        x1={RADAR_CX} y1={RADAR_CY}
                        x2={p.x} y2={p.y}
                        stroke="rgba(255,255,255,0.06)"
                        strokeWidth="1"
                    />
                );
            })}

            {/* Data polygon */}
            <polygon
                points={dataPolygon}
                fill="url(#radarFill)"
                stroke="url(#radarStroke)"
                strokeWidth="2"
                className={`radar-data-polygon ${visible ? 'visible' : ''}`}
            />

            {/* Data dots */}
            {dataPoints.map((p, i) => (
                <circle
                    key={i}
                    cx={p.x} cy={p.y} r="4"
                    fill="#22d3ee"
                    stroke="#0e7490"
                    strokeWidth="1.5"
                    className={`radar-dot ${visible ? 'visible' : ''}`}
                    style={{ transitionDelay: `${i * 80 + 300}ms` }}
                />
            ))}

            {/* Labels */}
            {RADAR_LABELS.map((label, i) => {
                const p = polarToXY(RADAR_CX, RADAR_CY, RADAR_R + 22, i, n);
                return (
                    <text
                        key={i}
                        x={p.x} y={p.y}
                        textAnchor="middle"
                        dominantBaseline="central"
                        className="radar-label"
                    >
                        {label}
                    </text>
                );
            })}

            {/* Score values next to dots */}
            {dataPoints.map((p, i) => {
                const labelP = polarToXY(RADAR_CX, RADAR_CY, RADAR_R + 10, i, n);
                const dx = labelP.x > RADAR_CX ? 6 : labelP.x < RADAR_CX ? -6 : 0;
                const dy = labelP.y > RADAR_CY ? 6 : -6;
                return (
                    <text
                        key={`v${i}`}
                        x={p.x + dx}
                        y={p.y + dy}
                        textAnchor="middle"
                        dominantBaseline="central"
                        className={`radar-value ${visible ? 'visible' : ''}`}
                        style={{ transitionDelay: `${i * 80 + 500}ms` }}
                    >
                        {values[i]}%
                    </text>
                );
            })}
        </svg>
    );
};

// ── Trait Config ──────────────────────────────────────────────────
const TRAIT_INFO: Record<string, {
    name: string;
    description: string;
    colorFrom: string;
    colorTo: string;
    icon: string;
}> = {
    openness: {
        name: 'Openness',
        description: 'Curiosity, creativity, and openness to new experiences',
        colorFrom: '#0ea5e9',
        colorTo: '#0284c7',
        icon: '🎨',
    },
    conscientiousness: {
        name: 'Conscientiousness',
        description: 'Organization, discipline, and goal-oriented behavior',
        colorFrom: '#10b981',
        colorTo: '#059669',
        icon: '📋',
    },
    extraversion: {
        name: 'Extraversion',
        description: 'Social energy, enthusiasm, and assertiveness',
        colorFrom: '#f59e0b',
        colorTo: '#d97706',
        icon: '💫',
    },
    agreeableness: {
        name: 'Agreeableness',
        description: 'Cooperation, trust, and consideration for others',
        colorFrom: '#34d399',
        colorTo: '#10b981',
        icon: '🤝',
    },
    neuroticism: {
        name: 'Emotional Stability',
        description: 'Emotional resilience and stress management',
        colorFrom: '#8b5cf6',
        colorTo: '#7c3aed',
        icon: '⚖️',
    },
};

const TRAIT_ORDER = ['openness', 'conscientiousness', 'extraversion', 'agreeableness', 'neuroticism'] as const;

type TestStatus = BigFiveTestStatus;

// ── Main Component ───────────────────────────────────────────────
export default function BigFiveProfile() {
    const [testStatus, setTestStatus] = useState<TestStatus | null>(null);
    const [profileData, setProfileData] = useState<BigFiveProfileData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showTestModal, setShowTestModal] = useState(false);
    const [barsVisible, setBarsVisible] = useState(false);

    const fetchTestStatus = async () => {
        setLoading(true);
        setError(null);
        try {
            const status = await bigFiveTestService.getTestStatus();
            setTestStatus(status);
            if (status.has_completed_test) {
                try {
                    const profile = await bigFiveTestService.getProfile();
                    setProfileData(profile);
                } catch { /* Profile may not be available yet */ }
            }
        } catch (e: any) {
            console.error('Failed to fetch test status', e);
            setError(e?.message || 'Connection error. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchTestStatus(); }, []);

    // Stagger bar animations after data loads
    useEffect(() => {
        if (testStatus?.has_completed_test && testStatus?.current_scores) {
            const t = setTimeout(() => setBarsVisible(true), 200);
            return () => clearTimeout(t);
        }
    }, [testStatus]);

    const handleStartTest = () => setShowTestModal(true);

    const handleTestComplete = () => {
        setShowTestModal(false);
        fetchTestStatus();
    };

    const handleCloseModal = () => {
        setShowTestModal(false);
        fetchTestStatus();
    };

    const getScoreLevel = (score: number): 'high' | 'moderate' | 'low' => {
        if (score >= 70) return 'high';
        if (score >= 40) return 'moderate';
        return 'low';
    };

    const getTrendIcon = (trait: string, trend?: string) => {
        const size = 12;
        if (!trend || trend === 'stable') return <Minus size={size} color="var(--text-muted)" />;
        if (trait === 'neuroticism') {
            return trend === 'up'
                ? <TrendingUp size={size} color="#f43f5e" />
                : <TrendingDown size={size} color="#10b981" />;
        }
        return trend === 'up'
            ? <TrendingUp size={size} color="#10b981" />
            : <TrendingDown size={size} color="#f43f5e" />;
    };

    const getTrend = (trait: string): 'up' | 'down' | 'stable' => {
        if (!profileData?.adjustments) return 'stable';
        const adj = profileData.adjustments[trait as keyof typeof profileData.adjustments];
        if (adj == null || adj === 0) return 'stable';
        return adj > 0 ? 'up' : 'down';
    };

    // Identify strongest & weakest traits
    const traitRanking = useMemo(() => {
        if (!testStatus?.current_scores) return { strongest: '', weakest: '' };
        const scores = testStatus.current_scores;
        const entries = TRAIT_ORDER.map(t => ({
            key: t,
            display: t === 'neuroticism' ? 100 - scores[t] : scores[t],
        }));
        entries.sort((a, b) => b.display - a.display);
        return { strongest: entries[0].key, weakest: entries[entries.length - 1].key };
    }, [testStatus?.current_scores]);

    // ── LOADING ──
    if (loading) {
        return (
            <div className="bf-loading-state">
                <RefreshCw size={24} className="spin" style={{ color: 'var(--primary)' }} />
                <span>Loading personality profile...</span>
            </div>
        );
    }

    // ── ERROR ──
    if (error) {
        return (
            <div className="bf-error-state">
                <div className="bf-error-icon">⚠️</div>
                <p>{error}</p>
                <button onClick={fetchTestStatus} className="bf-retry-btn">
                    <RefreshCw size={14} /> Retry
                </button>
            </div>
        );
    }

    // ── NO TEST — Take Test CTA ──
    if (!testStatus?.has_completed_test && !testStatus?.test_in_progress) {
        return (
            <>
                <div className="bf-empty-state">
                    <div className="bf-empty-visual">
                        <FingerprintIcon />
                    </div>

                    <div className="bf-empty-info">
                        <h3 className="bf-empty-title">
                            Unlock Your Personality Profile
                        </h3>
                        <p className="bf-empty-desc">
                            Discover your unique behavioral fingerprint with the scientifically
                            validated BFI-44 assessment. Results personalize your entire experience.
                        </p>

                        <div className="bf-features-row">
                            <div className="bf-feature-chip">
                                <Clock size={14} />
                                <span>~15 min</span>
                            </div>
                            <div className="bf-feature-chip">
                                <Award size={14} />
                                <span>BFI-44 Validated</span>
                            </div>
                            <div className="bf-feature-chip">
                                <Sparkles size={14} />
                                <span>5 Trait Breakdown</span>
                            </div>
                        </div>

                        <button className="bf-start-btn" onClick={handleStartTest}>
                            <Play size={16} />
                            <span>Begin Assessment</span>
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </div>

                {showTestModal && (
                    <BigFiveTestModal onClose={handleCloseModal} onComplete={handleTestComplete} />
                )}
            </>
        );
    }

    // ── IN PROGRESS — Resume ──
    if (testStatus?.test_in_progress && !testStatus?.has_completed_test) {
        return (
            <>
                <div className="bf-empty-state">
                    <div className="bf-empty-visual">
                        <FingerprintIcon animate />
                    </div>

                    <div className="bf-empty-info">
                        <h3 className="bf-empty-title">Test In Progress</h3>
                        <p className="bf-empty-desc">
                            You have an incomplete assessment. Resume where you left off
                            to complete your personality profile.
                        </p>
                        <button className="bf-start-btn resume" onClick={handleStartTest}>
                            <Play size={16} />
                            <span>Resume Test</span>
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </div>

                {showTestModal && (
                    <BigFiveTestModal onClose={handleCloseModal} onComplete={handleTestComplete} />
                )}
            </>
        );
    }

    // ── COMPLETED — Results ──
    if (testStatus?.has_completed_test && testStatus?.current_scores) {
        const scores = testStatus.current_scores;
        const canRetake = testStatus.next_test_available;
        const daysUntilNext = testStatus.days_until_next_test;

        return (
            <>
                <div className="bf-results">
                    {/* Top Row: Radar Chart + Trait Bars */}
                    <div className="bf-results-grid">
                        {/* Left: Radar Chart */}
                        <div className="bf-radar-section">
                            <RadarChart scores={scores} />
                        </div>

                        {/* Right: Trait Bars */}
                        <div className="bf-traits-section">
                            {TRAIT_ORDER.map((key, idx) => {
                                const info = TRAIT_INFO[key];
                                const raw = scores[key];
                                const display = key === 'neuroticism' ? 100 - raw : raw;
                                const trend = getTrend(key);
                                const level = getScoreLevel(display);
                                const isStrongest = traitRanking.strongest === key;
                                const isWeakest = traitRanking.weakest === key;

                                return (
                                    <div
                                        className={`bf-trait-row ${barsVisible ? 'visible' : ''} ${isStrongest ? 'strongest' : ''} ${isWeakest ? 'weakest' : ''}`}
                                        key={key}
                                        style={{ transitionDelay: `${idx * 80}ms` }}
                                    >
                                        <div className="bf-trait-header">
                                            <span className="bf-trait-name">
                                                <span className="bf-trait-emoji">{info.icon}</span>
                                                {info.name}
                                                <span className="bf-trait-trend">{getTrendIcon(key, trend)}</span>
                                                {isStrongest && <span className="bf-trait-badge strongest">Strongest</span>}
                                                {isWeakest && <span className="bf-trait-badge weakest">Growth Area</span>}
                                            </span>
                                            <span className={`bf-trait-score-badge ${level}`}>
                                                {display}%
                                            </span>
                                        </div>
                                        <div className="bf-trait-bar-bg">
                                            <div
                                                className="bf-trait-bar-fill"
                                                style={{
                                                    width: barsVisible ? `${display}%` : '0%',
                                                    background: `linear-gradient(90deg, ${info.colorFrom}, ${info.colorTo})`,
                                                    transitionDelay: `${idx * 80 + 100}ms`,
                                                }}
                                            />
                                        </div>
                                        <p className="bf-trait-desc">{info.description}</p>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Bottom: Meta Row */}
                    <div className="bf-results-meta">
                        <div className="bf-meta-left">
                            {canRetake ? (
                                <button className="bf-retake-btn" onClick={handleStartTest}>
                                    <RefreshCw size={14} />
                                    <span>Retake Test</span>
                                </button>
                            ) : (
                                <div className="bf-cooldown">
                                    <Lock size={13} />
                                    <span>Next test in <strong>{daysUntilNext}</strong> days</span>
                                </div>
                            )}
                        </div>

                        <div className="bf-meta-right">
                            <div className="bf-test-date">
                                <Calendar size={12} />
                                <span>
                                    Tested: {testStatus.test_completed_at
                                        ? new Date(testStatus.test_completed_at).toLocaleDateString()
                                        : 'Recently'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Adjustment Note */}
                    <div className="bf-adjustment-note">
                        <Sparkles size={12} />
                        <span>Scores adjust slightly based on your daily behavior patterns</span>
                    </div>
                </div>

                {showTestModal && (
                    <BigFiveTestModal onClose={handleCloseModal} onComplete={handleTestComplete} />
                )}
            </>
        );
    }

    // ── Fallback ──
    return (
        <div className="bf-empty-fallback">
            No behavioral data available yet. Take the test to build your profile.
        </div>
    );
}
