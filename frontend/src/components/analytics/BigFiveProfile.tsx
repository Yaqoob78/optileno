import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    TrendingUp,
    TrendingDown,
    Minus,
    RefreshCw,
    Fingerprint,
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

const BigFiveHand = () => (
    <div className="big-five-hand-container">
        <svg viewBox="0 0 128 160" className="big-five-hand-svg" aria-hidden="true">
            <defs>
                <linearGradient id="handGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#06b6d4" />
                    <stop offset="100%" stopColor="#22d3ee" />
                </linearGradient>
            </defs>

            <path
                d="M 35 104 C 35 92, 43 88, 54 88 H 78 C 88 88, 96 93, 96 104 V 124 C 96 136, 87 145, 75 145 H 53 C 42 145, 33 136, 33 124 V 107 Z"
                fill="url(#handGrad)"
                opacity="0.16"
                stroke="rgba(34,211,238,0.45)"
                strokeWidth="1"
            />

            {/* Thumb */}
            <g className="big-five-finger">
                <rect
                    x="26"
                    y="92"
                    width="12"
                    height="34"
                    rx="6"
                    transform="rotate(-30 32 109)"
                    fill="url(#handGrad)"
                    opacity="0.9"
                />
                <circle cx="22" cy="88" r="2.4" fill="#22d3ee" className="finger-tip-glow" />
            </g>

            {/* Index */}
            <g className="big-five-finger">
                <rect x="42" y="40" width="12" height="58" rx="6" fill="url(#handGrad)" opacity="0.95" />
                <circle cx="48" cy="36" r="2.6" fill="#22d3ee" className="finger-tip-glow" style={{ animationDelay: '0.12s' }} />
            </g>

            {/* Middle */}
            <g className="big-five-finger">
                <rect x="58" y="28" width="12" height="70" rx="6" fill="url(#handGrad)" />
                <circle cx="64" cy="24" r="2.8" fill="#22d3ee" className="finger-tip-glow" style={{ animationDelay: '0.24s' }} />
            </g>

            {/* Ring */}
            <g className="big-five-finger">
                <rect x="74" y="40" width="12" height="58" rx="6" fill="url(#handGrad)" opacity="0.95" />
                <circle cx="80" cy="36" r="2.6" fill="#22d3ee" className="finger-tip-glow" style={{ animationDelay: '0.36s' }} />
            </g>

            {/* Pinky */}
            <g className="big-five-finger">
                <rect x="90" y="52" width="12" height="46" rx="6" fill="url(#handGrad)" opacity="0.88" />
                <circle cx="96" cy="48" r="2.5" fill="#22d3ee" className="finger-tip-glow" style={{ animationDelay: '0.48s' }} />
            </g>

            <path d="M 45 111 H 83 M 64 102 V 131 M 51 122 H 77" stroke="rgba(255,255,255,0.36)" strokeWidth="0.75" />
            <circle cx="64" cy="117" r="7" fill="none" stroke="rgba(34,211,238,0.5)" strokeWidth="0.8" strokeDasharray="2.5 2.5" />
        </svg>
    </div>
);

type TestStatus = BigFiveTestStatus;

const TRAIT_INFO: Record<string, { name: string; description: string; colorClass: string; icon: string }> = {
    openness: {
        name: 'Openness',
        description: 'Curiosity, creativity, and openness to new experiences',
        colorClass: 'bar-openness',
        icon: '🎨'
    },
    conscientiousness: {
        name: 'Conscientiousness',
        description: 'Organization, discipline, and goal-oriented behavior',
        colorClass: 'bar-conscientiousness',
        icon: '📋'
    },
    extraversion: {
        name: 'Extraversion',
        description: 'Social energy, enthusiasm, and assertiveness',
        colorClass: 'bar-extraversion',
        icon: '💫'
    },
    agreeableness: {
        name: 'Agreeableness',
        description: 'Cooperation, trust, and consideration for others',
        colorClass: 'bar-agreeableness',
        icon: '🤝'
    },
    neuroticism: {
        name: 'Emotional Stability',
        description: 'Emotional resilience and stress management',
        colorClass: 'bar-neuroticism',
        icon: '⚖️'
    }
};

export default function BigFiveProfile() {
    const navigate = useNavigate();
    const [testStatus, setTestStatus] = useState<TestStatus | null>(null);
    const [profileData, setProfileData] = useState<BigFiveProfileData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showTestModal, setShowTestModal] = useState(false);

    const fetchTestStatus = async () => {
        setLoading(true);
        setError(null);
        try {
            const status = await bigFiveTestService.getTestStatus();
            setTestStatus(status);
            // Also fetch full profile for trend data if test is completed
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

    useEffect(() => {
        fetchTestStatus();
    }, []);

    const handleStartTest = () => {
        setShowTestModal(true);
    };

    const handleTestComplete = (scores: Record<string, number>) => {
        setShowTestModal(false);
        // Refresh from backend so cooldown/status is accurate.
        fetchTestStatus();
    };

    const handleCloseModal = () => {
        setShowTestModal(false);
        // Refresh test status in case test was partially completed
        fetchTestStatus();
    };

    const getTrendIcon = (trait: string, trend?: string) => {
        const size = 12;
        const green = "#10b981";
        const red = "#f43f5e";
        const gray = "#9ca3af";

        if (!trend || trend === 'stable') return <Minus size={size} color={gray} />;

        // For neuroticism, lower is better
        if (trait === 'neuroticism') {
            if (trend === 'up') return <TrendingUp size={size} color={red} />;
            return <TrendingDown size={size} color={green} />;
        }
        if (trend === 'up') return <TrendingUp size={size} color={green} />;
        return <TrendingDown size={size} color={red} />;
    };

    const getScoreLevel = (score: number): string => {
        if (score >= 70) return 'High';
        if (score >= 40) return 'Moderate';
        return 'Low';
    };

    const renderTrait = (key: string, score: number, trend?: 'up' | 'down' | 'stable') => {
        const info = TRAIT_INFO[key];
        if (!info) return null;

        // For neuroticism, we display it as "Emotional Stability" (inverted)
        const displayScore = key === 'neuroticism' ? 100 - score : score;

        return (
            <div className="trait-row" key={key}>
                <div className="trait-header">
                    <span className="trait-name">
                        <span className="trait-icon-emoji">{info.icon}</span>
                        {info.name}
                        <span className="trait-trend">
                            {getTrendIcon(key, trend)}
                        </span>
                    </span>
                    <span className="trait-score-badge" data-level={getScoreLevel(displayScore)}>
                        {displayScore}%
                    </span>
                </div>
                <div className="trait-bar-bg">
                    <div
                        className={`trait-bar-fill ${info.colorClass}`}
                        style={{ width: `${displayScore}%` }}
                    />
                </div>
                <div className="trait-description-text">
                    {info.description}
                </div>
            </div>
        );
    };

    // Loading state
    if (loading) {
        return (
            <div className="loading-container" style={{ minHeight: '300px' }}>
                <RefreshCw size={24} className="spin" style={{ color: 'var(--primary)' }} />
                <span style={{ fontSize: '14px', marginTop: '10px' }}>Loading personality profile...</span>
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div className="error-container" style={{ padding: '20px', textAlign: 'center' }}>
                <div style={{ color: '#ef4444', marginBottom: '10px' }}>⚠️ {error}</div>
                <button
                    onClick={fetchTestStatus}
                    style={{
                        background: 'var(--primary)',
                        color: 'white',
                        border: 'none',
                        padding: '8px 20px',
                        borderRadius: '8px',
                        cursor: 'pointer'
                    }}
                >
                    Retry
                </button>
            </div>
        );
    }

    // No test completed - Show "Take Test" prompt
    if (!testStatus?.has_completed_test && !testStatus?.test_in_progress) {
        return (
            <>
                <div className="big-five-empty-state">
                    <div className="empty-state-content">
                        <div className="empty-state-icon">
                            <BigFiveHand />
                        </div>

                        <h3 className="empty-state-title">
                            Unlock Your Personality Profile
                        </h3>

                        <p className="empty-state-description">
                            Take the Big Five personality assessment to discover your unique behavioral
                            fingerprint. Your results will help personalize your experience and provide
                            deeper insights.
                        </p>

                        <div className="test-features">
                            <div className="feature-item">
                                <Clock size={16} />
                                <span>20-44 questions • 15-30 minutes</span>
                            </div>
                            <div className="feature-item">
                                <Award size={16} />
                                <span>Scientifically validated (BFI-44)</span>
                            </div>
                            <div className="feature-item">
                                <Sparkles size={16} />
                                <span>Detailed personality breakdown</span>
                            </div>
                        </div>

                        <button
                            className="take-test-button"
                            onClick={handleStartTest}
                        >
                            <Play size={18} />
                            <span>Take the Test</span>
                            <ChevronRight size={18} />
                        </button>
                    </div>
                </div>

                {showTestModal && (
                    <BigFiveTestModal
                        onClose={handleCloseModal}
                        onComplete={handleTestComplete}
                    />
                )}
            </>
        );
    }

    // Test in progress - Resume option
    if (testStatus?.test_in_progress && !testStatus?.has_completed_test) {
        return (
            <>
                <div className="big-five-empty-state">
                    <div className="empty-state-content">
                        <div className="empty-state-icon in-progress">
                            <BigFiveHand />
                        </div>

                        <h3 className="empty-state-title">
                            Test In Progress
                        </h3>

                        <p className="empty-state-description">
                            You have an incomplete personality assessment. Resume where you left off
                            to complete your Big Five profile.
                        </p>

                        <button
                            className="take-test-button resume"
                            onClick={handleStartTest}
                        >
                            <Play size={18} />
                            <span>Resume Test</span>
                            <ChevronRight size={18} />
                        </button>
                    </div>
                </div>

                {showTestModal && (
                    <BigFiveTestModal
                        onClose={handleCloseModal}
                        onComplete={handleTestComplete}
                    />
                )}
            </>
        );
    }

    // Test completed - Show results
    if (testStatus?.has_completed_test && testStatus?.current_scores) {
        const scores = testStatus.current_scores;
        const canRetake = testStatus.next_test_available;
        const daysUntilNext = testStatus.days_until_next_test;

        // Derive trends from behavioral adjustments
        const getTrend = (trait: string): 'up' | 'down' | 'stable' => {
            if (!profileData?.adjustments) return 'stable';
            const adj = profileData.adjustments[trait as keyof typeof profileData.adjustments];
            if (adj == null || adj === 0) return 'stable';
            return adj > 0 ? 'up' : 'down';
        };

        return (
            <>
                <div className="big-five-content">
                    {/* Scores Display */}
                    <div className="traits-list">
                        {renderTrait('openness', scores.openness, getTrend('openness'))}
                        {renderTrait('conscientiousness', scores.conscientiousness, getTrend('conscientiousness'))}
                        {renderTrait('extraversion', scores.extraversion, getTrend('extraversion'))}
                        {renderTrait('agreeableness', scores.agreeableness, getTrend('agreeableness'))}
                        {renderTrait('neuroticism', scores.neuroticism, getTrend('neuroticism'))}
                    </div>

                    {/* Next Test Info */}
                    <div className="next-test-info">
                        {canRetake ? (
                            <button
                                className="retake-test-button"
                                onClick={handleStartTest}
                            >
                                <RefreshCw size={14} />
                                <span>Retake Test</span>
                            </button>
                        ) : (
                            <div className="next-test-timer">
                                <Lock size={14} />
                                <span>Next test available in <strong>{daysUntilNext}</strong> days</span>
                            </div>
                        )}

                        <div className="last-test-date">
                            <Calendar size={12} />
                            <span>
                                Tested: {testStatus.test_completed_at
                                    ? new Date(testStatus.test_completed_at).toLocaleDateString()
                                    : 'Recently'}
                            </span>
                        </div>
                    </div>

                    {/* Behavioral Adjustment Note */}
                    <div className="adjustment-note">
                        <Sparkles size={12} />
                        <span>Scores adjust slightly based on your daily behavior patterns</span>
                    </div>
                </div>

                {showTestModal && (
                    <BigFiveTestModal
                        onClose={handleCloseModal}
                        onComplete={handleTestComplete}
                    />
                )}
            </>
        );
    }

    // Fallback
    return (
        <div className="no-data" style={{ padding: '20px', textAlign: 'center', opacity: 0.5 }}>
            No behavioral data available yet. Take the test to build your profile.
        </div>
    );
}
