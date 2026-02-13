// frontend/src/components/analytics/BigFiveTestModal.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Fingerprint,
    ChevronRight,
    RefreshCw,
    CheckCircle,
    X,
    Heart,
    Sparkles
} from 'lucide-react';
import { bigFiveTestService, BigFiveQuestion, QuestionSource } from '../../services/api/bigFiveTest.service';
import '../../styles/components/analytics/BigFiveTestModal.css';

interface Props {
    onClose: () => void;
    onComplete: (scores: Record<string, number>) => void;
}

export default function BigFiveTestModal({ onClose, onComplete }: Props) {
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [testId, setTestId] = useState<number | null>(null);
    const [currentQuestion, setCurrentQuestion] = useState<BigFiveQuestion | null>(null);
    const [questionIndex, setQuestionIndex] = useState(0);
    const [totalQuestions, setTotalQuestions] = useState(30);
    const [selectedOption, setSelectedOption] = useState<number | null>(null);
    const [questionSource, setQuestionSource] = useState<QuestionSource>('unknown');
    const [liveScores, setLiveScores] = useState<Record<string, number> | null>(null);

    const [testComplete, setTestComplete] = useState(false);
    const [finalScores, setFinalScores] = useState<Record<string, number> | null>(null);

    useEffect(() => {
        startTest(false);
    }, []);

    useEffect(() => {
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = previousOverflow;
        };
    }, []);

    const startTest = async (forceNew = false) => {
        setLoading(true);
        setError(null);
        setLiveScores(null);
        try {
            const result = await bigFiveTestService.startTest(forceNew);

            if (result.error) {
                setError(result.error);
                return;
            }
            if (!result.question) {
                setError('No questions available. Please try again.');
                return;
            }

            setTestId(result.test_id);
            setCurrentQuestion(result.question);
            setQuestionIndex(result.question_index);
            setTotalQuestions(result.total_questions || 1);
            setQuestionSource(result.question_source || result.question.source || 'unknown');
            setSelectedOption(null);
        } catch (err: any) {
            setError(err.message || 'Failed to start test');
        } finally {
            setLoading(false);
        }
    };

    const handleOptionSelect = (value: number) => {
        setSelectedOption(value);
    };

    const handleSubmitAnswer = async () => {
        if (selectedOption === null || testId === null) return;

        setSubmitting(true);
        try {
            const result = await bigFiveTestService.submitAnswer(testId, selectedOption);

            if (result.error) {
                setError(result.error);
                return;
            }

            if (result.test_completed && result.scores) {
                setTestComplete(true);
                setFinalScores(result.scores);
                setLiveScores(result.live_scores || result.scores);
                onComplete(result.scores);
            } else if (result.question) {
                setCurrentQuestion(result.question);
                setQuestionIndex(result.question_index || 0);
                setQuestionSource(result.question_source || result.question.source || questionSource);
                if (result.live_scores) {
                    setLiveScores(result.live_scores);
                }
                setSelectedOption(null);
            } else {
                setError('Unable to load the next question. Please try again.');
            }
        } catch (err: any) {
            setError(err.message || 'Failed to submit answer');
        } finally {
            setSubmitting(false);
        }
    };

    const handleExitTest = () => {
        if (submitting) return;
        const confirmed = window.confirm(
            'Exit this test? Your progress is saved and you can resume later.'
        );
        if (confirmed) {
            onClose();
        }
    };

    const progress = (questionIndex / Math.max(totalQuestions, 1)) * 100;

    // Loading state
    if (loading) {
        return (
            <div className="bf-test-modal-overlay">
                <div className="bf-test-modal">
                    <div className="bf-test-loading">
                        <RefreshCw size={32} className="spin" />
                        <p>Preparing your personality assessment...</p>
                    </div>
                </div>
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div className="bf-test-modal-overlay">
                <div className="bf-test-modal">
                    <div className="bf-test-error">
                        <div className="error-icon">⚠️</div>
                        <h3>Something went wrong</h3>
                        <p>{error}</p>
                        <div className="error-actions">
                            <button onClick={() => startTest(false)} className="retry-btn">
                                <RefreshCw size={16} />
                                Try Again
                            </button>
                            <button onClick={onClose} className="close-btn">
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Test complete state
    if (testComplete && finalScores) {
        return (
            <div className="bf-test-modal-overlay">
                <div className="bf-test-modal complete">
                    <div className="bf-test-complete">
                        <div className="complete-icon">
                            <CheckCircle size={64} />
                            <Sparkles className="sparkle s1" size={20} />
                            <Sparkles className="sparkle s2" size={16} />
                            <Sparkles className="sparkle s3" size={14} />
                        </div>

                        <h2>Profile Complete!</h2>
                        <p>Your Big Five personality profile has been calculated.</p>

                        <div className="scores-preview">
                            {Object.entries(finalScores).map(([trait, score]) => (
                                <div key={trait} className="score-item">
                                    <span className="trait-name">
                                        {trait.charAt(0).toUpperCase() + trait.slice(1)}
                                    </span>
                                    <div className="score-bar">
                                        <div
                                            className="score-fill"
                                            style={{ width: `${trait === 'neuroticism' ? 100 - score : score}%` }}
                                        />
                                    </div>
                                    <span className="score-value">{score}%</span>
                                </div>
                            ))}
                        </div>

                        <p className="tip">
                            <Heart size={14} />
                            Your scores will slightly adjust based on your behavior over time.
                        </p>

                        <button
                            className="view-profile-btn"
                            onClick={() => {
                                onClose();
                                navigate('/analytics');
                            }}
                        >
                            View Full Profile
                            <ChevronRight size={18} />
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Question display
    return (
        <div className="bf-test-modal-overlay">
            <div className="bf-test-modal">
                <button className="bf-close-btn" onClick={onClose}>
                    <X size={20} />
                </button>
                <div className="bf-test-scroll">

                    {/* Header */}
                    <div className="bf-test-header">
                        <div className="bf-test-icon">
                            <Fingerprint size={28} />
                        </div>
                        <div className="bf-test-title">
                            <h2>Personality Assessment</h2>
                            <span className="question-counter">
                                Question {questionIndex + 1} of {totalQuestions}
                            </span>
                        </div>
                    </div>

                    <div className="bf-test-toolbar">
                        <span className={`bf-source-pill ${questionSource}`}>
                            {questionSource === 'ai' ? 'AI-generated questions' : questionSource === 'fallback' ? 'Fallback question bank' : 'Unknown source'}
                        </span>
                        <button
                            className="bf-refresh-btn"
                            onClick={() => startTest(true)}
                            disabled={submitting}
                            type="button"
                        >
                            <RefreshCw size={14} />
                            Refresh Questions
                        </button>
                    </div>

                    {/* Progress bar */}
                    <div className="bf-progress-container">
                        <div className="bf-progress-bar">
                            <div
                                className="bf-progress-fill"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                        <span className="bf-progress-text">{Math.round(progress)}%</span>
                    </div>

                    {/* Question */}
                    <div className="bf-question-container">
                        <p className="bf-question-text">
                            {currentQuestion?.text}
                        </p>
                    </div>

                    {liveScores && (
                        <div className="bf-question-container" style={{ paddingTop: 0 }}>
                            <p className="bf-live-scores">
                                Live scores: O {liveScores.openness}% | C {liveScores.conscientiousness}% | E {liveScores.extraversion}% | A {liveScores.agreeableness}% | N {liveScores.neuroticism}%
                            </p>
                        </div>
                    )}

                    {/* Options */}
                    <div className="bf-options-container">
                        {currentQuestion?.options.map((option) => (
                            <button
                                key={option.value}
                                className={`bf-option-btn ${selectedOption === option.value ? 'selected' : ''}`}
                                onClick={() => handleOptionSelect(option.value)}
                            >
                                <div className="option-radio">
                                    {selectedOption === option.value && <div className="radio-dot" />}
                                </div>
                                <span className="option-label">{option.label}</span>
                            </button>
                        ))}
                    </div>

                    {/* Navigation */}
                    <div className="bf-nav-container">
                        <button
                            className="bf-exit-btn"
                            onClick={handleExitTest}
                            disabled={submitting}
                            type="button"
                        >
                            Exit Test
                        </button>
                        <button
                            className="bf-next-btn"
                            onClick={handleSubmitAnswer}
                            disabled={selectedOption === null || submitting}
                        >
                            {submitting ? (
                                <>
                                    <RefreshCw size={16} className="spin" />
                                    <span>Saving...</span>
                                </>
                            ) : questionIndex === totalQuestions - 1 ? (
                                <>
                                    <span>Complete Test</span>
                                    <CheckCircle size={18} />
                                </>
                            ) : (
                                <>
                                    <span>Next Question</span>
                                    <ChevronRight size={18} />
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
