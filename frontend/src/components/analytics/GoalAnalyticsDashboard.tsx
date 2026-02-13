/**
 * GoalAnalyticsDashboard
 *
 * Premium real-time goal progress analysis component.
 * - Analyzes up to 3 goals (prioritized by deadline)
 * - Displays probability levels: Very High → Very Low
 * - Breaks down into Task Cards, Deep Work, and Habits
 * - Auto-incorporates wellness habits
 * - Ultra-only feature
 */

import React, { useMemo, useState } from 'react';
import {
    Target,
    ChevronRight,
    AlertTriangle,
    CheckCircle2,
    Clock,
    Flame,
    Zap,
    TrendingUp,
    TrendingDown,
    Minus,
    AlertCircle,
} from 'lucide-react';
import { usePlannerStore } from '../../stores/planner.store';
import { useAnalyticsStore } from '../../stores/analytics.store';
import {
    selectGoalsForAnalysis,
    analyzeGoal,
    type GoalAnalysis,
} from '../../utils/goalProbabilityEngine';
import '../../styles/components/analytics/goalAnalyticsDashboard.css';

// ── Component ───────────────────────────────────────────────────────

export default function GoalAnalyticsDashboard() {
    const goals = usePlannerStore((s) => s.goals);
    const tasks = usePlannerStore((s) => s.tasks);
    const habits = usePlannerStore((s) => s.habits);
    const analyticsEvents = useAnalyticsStore((s) => s.events);

    // Deep work count from planner store
    const deepWorkCount = usePlannerStore((s) => s.dailyDeepWorkCount ?? 0);

    // Select up to 3 goals
    const { selectedGoals, isMaxReached, totalGoals } = useMemo(
        () => selectGoalsForAnalysis(goals, 3),
        [goals]
    );

    // Analyze each selected goal
    const analyses: GoalAnalysis[] = useMemo(() => {
        if (!selectedGoals.length) return [];

        return selectedGoals.map((goal) =>
            analyzeGoal(goal, tasks, habits, analyticsEvents as any[], deepWorkCount)
        );
    }, [selectedGoals, tasks, habits, analyticsEvents, deepWorkCount]);

    // ── Empty State ──────────────────────────────────────────────────

    if (!goals.length || !selectedGoals.length) {
        return (
            <div className="goal-analytics-empty">
                <Target size={36} />
                <h4>No Active Goals</h4>
                <p>Create a goal in the Planner to see AI-powered probability analysis and progress tracking.</p>
            </div>
        );
    }

    // ── Render ───────────────────────────────────────────────────────

    return (
        <div className="goal-analytics-dashboard">
            {/* Max Goals Warning */}
            {isMaxReached && (
                <div className="goal-max-banner">
                    <AlertTriangle size={14} />
                    <span>
                        Analyzing top <span className="goal-max-count">3</span> goals by deadline.{' '}
                        You have <span className="goal-max-count">{totalGoals}</span> active goals —
                        complete current goals to analyze others.
                    </span>
                </div>
            )}

            {/* Goal Analysis Cards */}
            {analyses.map((analysis) => (
                <GoalAnalysisCard key={analysis.goal.id} analysis={analysis} />
            ))}
        </div>
    );
}

// ── Goal Analysis Card ──────────────────────────────────────────────

function GoalAnalysisCard({ analysis }: { analysis: GoalAnalysis }) {
    const [expanded, setExpanded] = useState(false);
    const { goal, probability, breakdown, daysRemaining, weeklyTrend, consistencyScore } = analysis;

    const daysClass = daysRemaining <= 3 ? 'days-urgent'
        : daysRemaining <= 7 ? 'days-warning'
            : 'days-normal';

    const TrendIcon = weeklyTrend === 'improving' ? TrendingUp
        : weeklyTrend === 'declining' ? TrendingDown
            : Minus;

    return (
        <div
            className="goal-analysis-card"
            style={{ borderColor: `${probability.borderColor}` }}
        >
            {/* Header */}
            <div className="goal-card-header">
                <div className="goal-card-info">
                    {goal.category && (
                        <div className="goal-card-category">
                            <Target size={10} />
                            {goal.category}
                        </div>
                    )}
                    <h4 className="goal-card-title" title={goal.title}>
                        {goal.title}
                    </h4>
                    <div className="goal-card-deadline">
                        <Clock size={11} />
                        <span className={daysClass}>
                            {daysRemaining <= 0
                                ? 'Deadline passed'
                                : `${daysRemaining} day${daysRemaining === 1 ? '' : 's'} left`}
                        </span>
                    </div>
                </div>

                {/* Probability Badge */}
                <div
                    className="probability-badge"
                    style={{
                        background: probability.bgColor,
                        borderColor: probability.borderColor,
                        boxShadow: probability.glowColor,
                    }}
                >
                    <span className="probability-score" style={{ color: probability.color }}>
                        {Math.round(probability.score)}%
                    </span>
                    <span className="probability-label" style={{ color: probability.color }}>
                        {probability.label}
                    </span>
                    {analysis.dynamics?.momentum_boost && analysis.dynamics.momentum_boost > 0 && (
                        <div style={{ marginLeft: '6px', fontSize: '0.65rem', background: probability.color, color: '#000', borderRadius: '4px', padding: '1px 4px', fontWeight: 'bold' }}>
                            +{Math.round(analysis.dynamics.momentum_boost)}% Boost
                        </div>
                    )}
                </div>
            </div>

            {/* Probability Bar */}
            <div className="probability-bar-section">
                <div className="probability-bar-container">
                    <div
                        className="probability-bar-fill"
                        style={{
                            width: `${probability.score}%`,
                            background: `linear-gradient(90deg, ${probability.color}66, ${probability.color})`,
                            color: probability.color,
                        }}
                    />
                </div>
                <div className="probability-bar-markers">
                    <span className="probability-marker">0%</span>
                    <span className="probability-marker">50%</span>
                    <span className="probability-marker">100%</span>
                </div>
            </div>

            {/* Stats Row */}
            <div className="goal-stats-row">
                <div className="goal-stat-item">
                    <span className="goal-stat-value">{Math.round(consistencyScore)}%</span>
                    <span className="goal-stat-label">Consistency</span>
                </div>
                <div className="goal-stat-item">
                    <span className="goal-stat-value">
                        <span className={`trend-badge ${weeklyTrend}`}>
                            <TrendIcon size={10} />
                            {weeklyTrend === 'improving' ? 'Up' : weeklyTrend === 'declining' ? 'Down' : 'Stable'}
                        </span>
                    </span>
                    <span className="goal-stat-label">Trend</span>
                </div>
                <div className="goal-stat-item">
                    <span className="goal-stat-value">
                        {breakdown.tasks.filter((t) => t.isCompleted).length}/{breakdown.tasks.length}
                    </span>
                    <span className="goal-stat-label">Tasks</span>
                </div>
            </div>

            {/* Risk Factors */}
            {analysis.riskFactors.length > 0 && (
                <div className="goal-risks">
                    {analysis.riskFactors.map((risk, i) => (
                        <span key={i} className="risk-tag">
                            <AlertCircle size={10} />
                            {risk}
                        </span>
                    ))}
                </div>
            )}

            {/* Breakdown Toggle */}
            <div className="goal-breakdown">
                <button
                    className={`breakdown-toggle ${expanded ? 'expanded' : ''}`}
                    onClick={() => setExpanded(!expanded)}
                >
                    <ChevronRight size={12} />
                    <span>Goal Breakdown</span>
                    <span style={{ marginLeft: 'auto', opacity: 0.6, fontWeight: 400, textTransform: 'none' }}>
                        {breakdown.tasks.length} tasks · {breakdown.habits.length} habits · {breakdown.deepWork.length} sessions
                    </span>
                </button>

                {/* Expandable Breakdown Content */}
                <div className={`breakdown-content ${expanded ? 'visible' : ''}`}>
                    {/* Task Cards (Primary) */}
                    {breakdown.tasks.length > 0 && (
                        <div>
                            <div className="breakdown-category-title">
                                <CheckCircle2 size={12} />
                                Task Cards
                            </div>
                            <div className="breakdown-task-list">
                                {breakdown.tasks.slice(0, 8).map((task) => (
                                    <div key={task.id} className="breakdown-task-item">
                                        <div
                                            className={`task-status-dot ${task.isCompleted ? 'completed' : task.isOverdue ? 'overdue' : 'pending'
                                                }`}
                                        />
                                        <span className={`task-item-title ${task.isCompleted ? 'completed' : ''}`}>
                                            {task.title}
                                        </span>
                                        <span className={`task-priority-tag ${task.priority.toLowerCase()}`}>
                                            {task.priority}
                                        </span>
                                    </div>
                                ))}
                                {breakdown.tasks.length > 8 && (
                                    <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', padding: '0.2rem 0.5rem' }}>
                                        +{breakdown.tasks.length - 8} more tasks
                                    </span>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Habits */}
                    {breakdown.habits.length > 0 && (
                        <div>
                            <div className="breakdown-category-title">
                                <Flame size={12} />
                                Habits & Routines
                            </div>
                            <div className="breakdown-task-list">
                                {breakdown.habits.map((habit) => (
                                    <div key={habit.id} className="breakdown-habit-item">
                                        <div className={`habit-check ${habit.isCompletedToday ? 'done' : 'pending'}`} />
                                        <span
                                            className={`habit-streak-badge ${habit.currentStreak === 0 ? 'zero' : ''}`}
                                        >
                                            🔥 {habit.currentStreak}
                                        </span>
                                        <span className="habit-name">{habit.name}</span>
                                        {habit.isAutoSuggested && <span className="habit-auto-tag">Auto</span>}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Deep Work */}
                    {breakdown.deepWork.length > 0 && (
                        <div>
                            <div className="breakdown-category-title">
                                <Zap size={12} />
                                Deep Work Blocks
                            </div>
                            <div className="breakdown-task-list">
                                {breakdown.deepWork.map((dw, i) => (
                                    <div key={i} className="breakdown-deepwork-item">
                                        <span className="deepwork-duration">{dw.completedMinutes}m</span>
                                        <span className="deepwork-title">{dw.title}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* No breakdown data */}
                    {breakdown.tasks.length === 0 &&
                        breakdown.habits.length === 0 &&
                        breakdown.deepWork.length === 0 && (
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'center', padding: '0.5rem' }}>
                                No linked items yet. Create tasks or tag them with this goal to see breakdown.
                            </div>
                        )}
                </div>
            </div>
        </div>
    );
}
