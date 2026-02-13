/**
 * Goal Probability Engine
 * 
 * AI-powered probability analysis for goal completion.
 * Computes probability across 5 levels: Very High, High, Medium, Low, Very Low
 * 
 * Factors:
 *  - Task completion rate (primary signal, 40%)
 *  - Habit consistency/streaks (20%)
 *  - Deep work adherence (15%)
 *  - Time-based pace analysis (15%)
 *  - Momentum trend (10%)
 */

import type { Goal, Task, Habit } from '../types/planner.types';
import type { AppEvent } from '../types/events.types';

// ── Types ───────────────────────────────────────────────────────────

export type ProbabilityLevel = 'very_high' | 'high' | 'medium' | 'low' | 'very_low';

export interface ProbabilityResult {
    score: number;              // 0-100 raw probability
    level: ProbabilityLevel;
    label: string;              // Human-readable label
    color: string;              // CSS color
    bgColor: string;            // Background color for badges
    borderColor: string;        // Border color
    glowColor: string;          // Glow effect color
    icon: string;               // Emoji indicator
    insight: string;            // Short AI insight
}

export interface GoalBreakdown {
    tasks: TaskBreakdownItem[];
    habits: HabitBreakdownItem[];
    deepWork: DeepWorkBreakdownItem[];
}

export interface TaskBreakdownItem {
    id: string;
    title: string;
    status: string;
    priority: string;
    isCompleted: boolean;
    contributionWeight: number;  // How much this task contributes to the goal
    dueDate?: Date | null;
    isOverdue: boolean;
}

export interface HabitBreakdownItem {
    id: string;
    name: string;
    currentStreak: number;
    isCompletedToday: boolean;
    frequency: string;
    contributionScore: number;  // 0-100
    isAutoSuggested: boolean;   // Auto-incorporated habits
    category: string;
}

export interface DeepWorkBreakdownItem {
    title: string;
    scheduledMinutes: number;
    completedMinutes: number;
    isGoalRelated: boolean;
    date: string;
}

export interface GoalAnalysis {
    goal: Goal;
    probability: ProbabilityResult;
    breakdown: GoalBreakdown;
    dailyProgress: number;       // Progress made today
    weeklyTrend: 'improving' | 'stable' | 'declining';
    daysRemaining: number;
    requiredDailyRate: number;   // % per day needed to finish on time
    currentDailyRate: number;    // Current % per day
    consistencyScore: number;    // 0-100, how consistent user has been
    riskFactors: string[];       // What could derail the goal
    nextActions: string[];       // Suggested next actions
    dynamics?: {                 // Backend dynamics
        momentum_boost: number;
        inactivity_decay: number;
    };
}

// ── Constants ───────────────────────────────────────────────────────

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const PROBABILITY_THRESHOLDS: Record<ProbabilityLevel, { min: number; max: number }> = {
    very_high: { min: 80, max: 100 },
    high: { min: 60, max: 79.99 },
    medium: { min: 40, max: 59.99 },
    low: { min: 20, max: 39.99 },
    very_low: { min: 0, max: 19.99 },
};

const PROBABILITY_STYLES: Record<ProbabilityLevel, Omit<ProbabilityResult, 'score' | 'insight'>> = {
    very_high: {
        level: 'very_high',
        label: 'Very High',
        color: '#10b981',
        bgColor: 'rgba(16, 185, 129, 0.12)',
        borderColor: 'rgba(16, 185, 129, 0.4)',
        glowColor: '0 0 20px rgba(16, 185, 129, 0.3)',
        icon: '🟢',
    },
    high: {
        level: 'high',
        label: 'High',
        color: '#34d399',
        bgColor: 'rgba(52, 211, 153, 0.1)',
        borderColor: 'rgba(52, 211, 153, 0.35)',
        glowColor: '0 0 12px rgba(52, 211, 153, 0.2)',
        icon: '🔵',
    },
    medium: {
        level: 'medium',
        label: 'Medium',
        color: '#fbbf24',
        bgColor: 'rgba(251, 191, 36, 0.1)',
        borderColor: 'rgba(251, 191, 36, 0.35)',
        glowColor: '0 0 12px rgba(251, 191, 36, 0.2)',
        icon: '🟡',
    },
    low: {
        level: 'low',
        label: 'Low',
        color: '#f97316',
        bgColor: 'rgba(249, 115, 22, 0.1)',
        borderColor: 'rgba(249, 115, 22, 0.35)',
        glowColor: '0 0 12px rgba(249, 115, 22, 0.2)',
        icon: '🟠',
    },
    very_low: {
        level: 'very_low',
        label: 'Very Low',
        color: '#ef4444',
        bgColor: 'rgba(239, 68, 68, 0.1)',
        borderColor: 'rgba(239, 68, 68, 0.35)',
        glowColor: '0 0 15px rgba(239, 68, 68, 0.25)',
        icon: '🔴',
    },
};

// Auto-suggested habits that contribute to any goal
const AUTO_HABITS = [
    { name: 'Wake Up Early', category: 'Wellness', contributionBase: 8 },
    { name: 'Exercise', category: 'Wellness', contributionBase: 10 },
    { name: 'Meditate', category: 'Wellness', contributionBase: 7 },
];

const TASK_PRIORITY_WEIGHT: Record<string, number> = {
    low: 0.6,
    medium: 1.0,
    high: 1.5,
    urgent: 2.0,
};

// ── Main Functions ──────────────────────────────────────────────────

/**
 * Select up to 3 goals for analysis, prioritized by urgency (time-based).
 * Returns goals sorted by closest deadline first.
 */
export function selectGoalsForAnalysis(goals: Goal[], maxGoals: number = 3): {
    selectedGoals: Goal[];
    isMaxReached: boolean;
    totalGoals: number;
} {
    // Filter out completed goals
    const activeGoals = goals.filter(g => (toNumber(g.current_progress) ?? 0) < 100);

    // Sort by target_date (closest deadline first)
    const sorted = [...activeGoals].sort((a, b) => {
        const aDate = toDate(a.target_date)?.getTime() ?? Number.MAX_SAFE_INTEGER;
        const bDate = toDate(b.target_date)?.getTime() ?? Number.MAX_SAFE_INTEGER;
        return aDate - bDate;
    });

    const selected = sorted.slice(0, maxGoals);

    return {
        selectedGoals: selected,
        isMaxReached: activeGoals.length > maxGoals,
        totalGoals: activeGoals.length,
    };
}

/**
 * Compute full probability analysis for a single goal.
 */
export function analyzeGoal(
    goal: Goal,
    allTasks: Task[],
    allHabits: Habit[],
    events: AppEvent[],
    deepWorkCount: number,
    now: Date = new Date()
): GoalAnalysis {
    const startDate = deriveStartDate(goal, now);
    const endDate = deriveEndDate(goal, startDate);
    const totalDays = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / MS_PER_DAY));
    const elapsedDays = Math.max(0.5, (now.getTime() - startDate.getTime()) / MS_PER_DAY);
    const daysRemaining = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / MS_PER_DAY));

    // Get linked items
    const linkedTasks = findLinkedTasks(allTasks, goal, startDate, endDate);
    const linkedHabits = findLinkedHabits(allHabits, goal);
    const autoHabits = findAutoHabits(allHabits);
    const allLinkedHabits = [...linkedHabits, ...autoHabits];

    // Calculate component scores
    const taskScore = calculateTaskScore(linkedTasks);
    const habitScore = calculateHabitScore(allLinkedHabits, now);
    const deepWorkScore = calculateDeepWorkScore(events, deepWorkCount, startDate, now);
    const paceScore = calculatePaceScore(taskScore, elapsedDays, totalDays, daysRemaining, linkedTasks.length);
    const momentumScore = calculateMomentumScore(linkedTasks, allLinkedHabits, now);

    // Check if user has done ANY real work toward this goal (Local heuristics)
    const hasAnyLinkedTasks = linkedTasks.length > 0;
    const hasAnyCompletedTasks = linkedTasks.some(t => isCompleted(t));
    const hasAnyHabitActivity = allLinkedHabits.some(h => {
        const streak = toNumber((h as any).currentStreak ?? (h as any).current_streak) ?? 0;
        return streak > 0;
    });
    const hasAnyDeepWork = deepWorkScore > 0;
    const hasAnyActivity = hasAnyCompletedTasks || hasAnyHabitActivity || hasAnyDeepWork;

    // --- PROBABILITY CALCULATION ---
    let rawProbability = 0;
    let probability: ProbabilityResult;

    // Prefer Backend AI Probability if available
    if (goal.ai_probability !== undefined) {
        rawProbability = goal.ai_probability;
        probability = buildProbabilityResult(rawProbability, goal, daysRemaining, taskScore);

        // If insights exist, override the generated one
        if (goal.ai_insights && goal.ai_insights.length > 0) {
            probability.insight = goal.ai_insights[0];
        }
    } else {
        // Fallback to Local Engine
        rawProbability = clamp(
            taskScore * 0.40 +
            habitScore * 0.20 +
            deepWorkScore * 0.15 +
            paceScore * 0.15 +
            momentumScore * 0.10,
            0, 100
        );

        if (!hasAnyActivity) {
            rawProbability = Math.min(rawProbability, hasAnyLinkedTasks ? 3 : 1);
        }

        probability = buildProbabilityResult(rawProbability, goal, daysRemaining, taskScore);
    }

    // Build breakdown
    const breakdown = buildGoalBreakdown(linkedTasks, linkedHabits, autoHabits, events, startDate, now);

    // Calculate rates
    const requiredDailyRate = daysRemaining > 0
        ? (100 - (toNumber(goal.current_progress) ?? 0)) / daysRemaining
        : 100;
    const currentDailyRate = elapsedDays > 0 ? taskScore / elapsedDays : 0;

    // Consistency score
    const consistencyScore = calculateConsistency(linkedTasks, allLinkedHabits, now);

    // Risk factors & next actions
    const riskFactors = identifyRisks(taskScore, habitScore, deepWorkScore, paceScore, daysRemaining, hasAnyLinkedTasks);
    const nextActions = suggestActions(taskScore, habitScore, deepWorkScore, linkedTasks, daysRemaining);

    // Append Dynamics info to risk factors or next actions if relevant
    if (goal.dynamics?.momentum_boost && goal.dynamics.momentum_boost > 0) {
        // Beneficial dynamic
        // Maybe we don't add to risks
    }
    if (goal.dynamics?.inactivity_decay && goal.dynamics.inactivity_decay > 0) {
        riskFactors.push(`Inactivity Decay: -${goal.dynamics.inactivity_decay}%`);
    }

    // Weekly trend — only "improving" if there's actual recent completion
    const weeklyTrend = !hasAnyActivity ? 'declining'
        : momentumScore >= 60 ? 'improving'
            : momentumScore >= 35 ? 'stable'
                : 'declining';

    return {
        goal,
        probability,
        breakdown,
        dailyProgress: clamp(currentDailyRate, 0, 100),
        weeklyTrend,
        daysRemaining,
        requiredDailyRate: clamp(requiredDailyRate, 0, 100),
        currentDailyRate: clamp(currentDailyRate, 0, 100),
        consistencyScore: clamp(consistencyScore, 0, 100),
        riskFactors,
        nextActions,
        dynamics: goal.dynamics
    };
}

// ── Score Calculators ──────────────────────────────────────────────

function calculateTaskScore(tasks: Task[]): number {
    if (!tasks.length) return 0;

    let totalWeight = 0;
    let completedWeight = 0;

    for (const task of tasks) {
        const priority = String((task as any).priority ?? 'medium').toLowerCase();
        const weight = TASK_PRIORITY_WEIGHT[priority] ?? 1;
        totalWeight += weight;

        if (isCompleted(task)) {
            completedWeight += weight;
        }
    }

    return totalWeight > 0 ? clamp((completedWeight / totalWeight) * 100, 0, 100) : 0;
}

function calculateHabitScore(habits: Habit[], now: Date): number {
    // No habits = no contribution (0, not 50)
    if (!habits.length) return 0;

    const scores = habits.map(h => {
        const streak = toNumber((h as any).currentStreak ?? (h as any).current_streak) ?? 0;
        const lastCompleted = toDate((h as any).lastCompleted ?? (h as any).last_completed);
        const cadenceDays = getCadence(String(h.frequency ?? 'daily'));

        // If habit has never been completed, it contributes 0
        if (!lastCompleted && streak === 0) return 0;

        const daysSince = lastCompleted
            ? Math.max(0, (now.getTime() - lastCompleted.getTime()) / MS_PER_DAY)
            : Infinity;

        const recencyRatio = daysSince / cadenceDays;
        const recencyScore = recencyRatio <= 1 ? 100
            : recencyRatio <= 1.5 ? 75
                : recencyRatio <= 2 ? 45
                    : recencyRatio <= 3 ? 20
                        : 5;

        const streakScore = clamp((Math.min(streak, 21) / 21) * 100, 0, 100);

        return recencyScore * 0.65 + streakScore * 0.35;
    });

    return scores.reduce((a, b) => a + b, 0) / scores.length;
}

function calculateDeepWorkScore(events: AppEvent[], dailyCount: number, startDate: Date, now: Date): number {
    const deepEvents = events.filter((e: any) =>
        e?.type === 'deep_work_event' &&
        toDate(e.timestamp)! >= startDate &&
        toDate(e.timestamp)! <= now
    );

    const completedEvents = deepEvents.filter((e: any) => e.subtype === 'deep_work_completed');
    const totalMinutes = completedEvents.reduce((sum: number, e: any) => {
        return sum + (toNumber((e as any)?.metrics?.duration) ?? toNumber((e as any)?.metadata?.duration) ?? 0);
    }, 0);

    const fallbackMinutes = dailyCount > 0 ? dailyCount * 30 : 0;
    const actualMinutes = Math.max(totalMinutes, fallbackMinutes);
    const elapsedDays = Math.max(1, Math.ceil((now.getTime() - startDate.getTime()) / MS_PER_DAY));
    const targetMinutes = elapsedDays * 45;

    return clamp((actualMinutes / Math.max(targetMinutes, 1)) * 100, 0, 100);
}

function calculatePaceScore(taskScore: number, elapsedDays: number, totalDays: number, daysRemaining: number, linkedTaskCount: number): number {
    // If there are NO linked tasks at all, pace is meaningless — return 0
    if (linkedTaskCount === 0) return 0;

    // If no tasks have been completed (taskScore === 0), pace is very bad
    if (taskScore === 0) return 2;

    const expectedProgress = (elapsedDays / totalDays) * 100;
    const paceDelta = taskScore - expectedProgress;

    // If ahead: boost. If behind: penalize proportionally
    if (paceDelta >= 15) return 95;
    if (paceDelta >= 5) return 80;
    if (paceDelta >= -5) return 65;
    if (paceDelta >= -15) return 40;
    if (paceDelta >= -30) return 20;
    return 5;
}

function calculateMomentumScore(tasks: Task[], habits: Habit[], now: Date): number {
    const threeDaysAgo = new Date(now.getTime() - 3 * MS_PER_DAY);
    const sevenDaysAgo = new Date(now.getTime() - 7 * MS_PER_DAY);

    // Recent task completions (last 3 days vs last 7 days)
    const recentCompletions = tasks.filter(t => {
        const completedAt = toDate((t as any).completedAt ?? (t as any).completed_at);
        return isCompleted(t) && completedAt && completedAt >= threeDaysAgo;
    }).length;

    const weekCompletions = tasks.filter(t => {
        const completedAt = toDate((t as any).completedAt ?? (t as any).completed_at);
        return isCompleted(t) && completedAt && completedAt >= sevenDaysAgo;
    }).length;

    // If NO completions at all in the past week, momentum is 0
    if (weekCompletions === 0 && recentCompletions === 0) {
        // Check if habits have any active streaks
        const anyHabitActive = habits.some(h => {
            const streak = toNumber((h as any).currentStreak ?? (h as any).current_streak) ?? 0;
            return streak > 0;
        });
        return anyHabitActive ? 10 : 0;
    }

    const weeklyRate = weekCompletions / 7;
    const recentRate = recentCompletions / 3;

    const ratio = weeklyRate > 0 ? recentRate / weeklyRate : (recentCompletions > 0 ? 1.5 : 0);

    // Also factor in habit consistency
    const habitMomentum = habits.reduce((sum, h) => {
        const streak = toNumber((h as any).currentStreak ?? (h as any).current_streak) ?? 0;
        return sum + (streak >= 3 ? 1 : streak >= 1 ? 0.5 : 0);
    }, 0);

    const habitFactor = habits.length > 0 ? (habitMomentum / habits.length) * 100 : 0;

    return clamp((ratio * 50 + habitFactor * 0.5), 0, 100);
}

function calculateConsistency(tasks: Task[], habits: Habit[], now: Date): number {
    let signals = 0;
    let total = 0;

    // Task completion consistency (last 7 days)
    for (let i = 0; i < 7; i++) {
        const dayStart = new Date(now.getTime() - (i + 1) * MS_PER_DAY);
        const dayEnd = new Date(now.getTime() - i * MS_PER_DAY);

        const dayTasks = tasks.filter(t => {
            const completedAt = toDate((t as any).completedAt ?? (t as any).completed_at);
            return completedAt && completedAt >= dayStart && completedAt < dayEnd;
        });

        if (dayTasks.length > 0) signals++;
        total++;
    }

    // Habit streak factor
    const avgStreak = habits.length > 0
        ? habits.reduce((sum, h) => sum + (toNumber((h as any).currentStreak ?? 0) ?? 0), 0) / habits.length
        : 0;

    const streakBonus = clamp((avgStreak / 14) * 30, 0, 30);

    return clamp((signals / Math.max(total, 1)) * 70 + streakBonus, 0, 100);
}

// ── Probability Builder ─────────────────────────────────────────────

function buildProbabilityResult(score: number, goal: Goal, daysRemaining: number, taskScore: number): ProbabilityResult {
    const level = getProbabilityLevel(score);
    const styles = PROBABILITY_STYLES[level];
    const insight = generateInsight(level, daysRemaining, taskScore, goal);

    return {
        ...styles,
        score: Math.round(score * 10) / 10,
        insight,
    };
}

function getProbabilityLevel(score: number): ProbabilityLevel {
    if (score >= 80) return 'very_high';
    if (score >= 60) return 'high';
    if (score >= 40) return 'medium';
    if (score >= 20) return 'low';
    return 'very_low';
}

function generateInsight(level: ProbabilityLevel, daysRemaining: number, taskScore: number, goal: Goal): string {
    const title = goal.title?.slice(0, 30) || 'this goal';

    switch (level) {
        case 'very_high':
            return `Outstanding pace! You're on track to crush "${title}" well before the deadline.`;
        case 'high':
            return `Strong progress on "${title}". Keep the momentum going with consistent daily effort.`;
        case 'medium':
            return `You're making progress on "${title}", but ${daysRemaining} days left — focus on completing more tasks.`;
        case 'low':
            return `"${title}" needs attention. With ${daysRemaining} days left, increase daily task completion.`;
        case 'very_low':
            if (taskScore === 0) {
                return `No progress yet on "${title}". Create tasks linked to this goal and start completing them to build momentum.`;
            }
            return `Critical: "${title}" is at risk with ${daysRemaining} days left. Focus on high-impact tasks immediately.`;
    }
}

// ── Breakdown Builders ──────────────────────────────────────────────

function buildGoalBreakdown(
    tasks: Task[],
    linkedHabits: Habit[],
    autoHabits: Habit[],
    events: AppEvent[],
    startDate: Date,
    now: Date
): GoalBreakdown {
    const taskBreakdown: TaskBreakdownItem[] = tasks.map(t => {
        const dueDate = toDate((t as any).dueDate ?? (t as any).due_date);
        return {
            id: t.id,
            title: t.title,
            status: String((t as any).status ?? 'pending'),
            priority: String((t as any).priority ?? 'medium'),
            isCompleted: isCompleted(t),
            contributionWeight: TASK_PRIORITY_WEIGHT[String((t as any).priority ?? 'medium').toLowerCase()] ?? 1,
            dueDate,
            isOverdue: dueDate ? dueDate < now && !isCompleted(t) : false,
        };
    });

    const habitBreakdown: HabitBreakdownItem[] = [
        ...linkedHabits.map(h => ({
            id: h.id,
            name: h.name,
            currentStreak: toNumber((h as any).currentStreak ?? (h as any).current_streak) ?? 0,
            isCompletedToday: isHabitCompletedToday(h, now),
            frequency: String(h.frequency ?? 'daily'),
            contributionScore: calculateSingleHabitScore(h, now),
            isAutoSuggested: false,
            category: (h as any).category ?? 'General',
        })),
        ...autoHabits.map(h => ({
            id: h.id,
            name: h.name,
            currentStreak: toNumber((h as any).currentStreak ?? (h as any).current_streak) ?? 0,
            isCompletedToday: isHabitCompletedToday(h, now),
            frequency: String(h.frequency ?? 'daily'),
            contributionScore: calculateSingleHabitScore(h, now) * 0.5, // Auto habits contribute less
            isAutoSuggested: true,
            category: (h as any).category ?? 'Wellness',
        })),
    ];

    const deepWorkBreakdown: DeepWorkBreakdownItem[] = events
        .filter((e: any) => e?.type === 'deep_work_event' && e?.subtype === 'deep_work_completed')
        .slice(-5)
        .map((e: any) => ({
            title: (e as any)?.metadata?.focus_goal || 'Deep Work Session',
            scheduledMinutes: toNumber((e as any)?.metadata?.planned_duration) ?? 45,
            completedMinutes: toNumber((e as any)?.metrics?.duration ?? (e as any)?.metadata?.duration) ?? 0,
            isGoalRelated: true,
            date: String((e as any).timestamp ?? ''),
        }));

    return { tasks: taskBreakdown, habits: habitBreakdown, deepWork: deepWorkBreakdown };
}

// ── Risk & Action Generators ────────────────────────────────────────

function identifyRisks(taskScore: number, habitScore: number, deepWorkScore: number, paceScore: number, daysRemaining: number, hasLinkedTasks: boolean): string[] {
    const risks: string[] = [];

    if (!hasLinkedTasks) risks.push('No tasks linked to this goal');
    if (hasLinkedTasks && taskScore === 0) risks.push('No tasks completed yet');
    else if (taskScore < 30) risks.push('Low task completion rate');
    if (habitScore < 10 && habitScore !== undefined) risks.push('No habit progress');
    if (deepWorkScore < 5) risks.push('No deep work sessions logged');
    if (paceScore < 10) risks.push('Falling behind schedule');
    if (daysRemaining <= 3) risks.push('Very little time remaining');
    if (daysRemaining <= 7 && taskScore < 50) risks.push('Approaching deadline with incomplete tasks');

    return risks.slice(0, 3);
}

function suggestActions(taskScore: number, habitScore: number, deepWorkScore: number, tasks: Task[], daysRemaining: number): string[] {
    const actions: string[] = [];

    if (taskScore < 50) {
        const pendingTasks = tasks.filter(t => !isCompleted(t));
        const highPriority = pendingTasks.filter(t => String((t as any).priority).toLowerCase() === 'high' || String((t as any).priority).toLowerCase() === 'urgent');
        if (highPriority.length > 0) {
            actions.push(`Complete "${highPriority[0].title}" (high priority)`);
        } else if (pendingTasks.length > 0) {
            actions.push(`Work on "${pendingTasks[0].title}"`);
        }
    }

    if (habitScore < 50) actions.push('Complete your daily habits to boost consistency');
    if (deepWorkScore < 30) actions.push('Schedule a deep work block today');
    if (daysRemaining <= 7) actions.push('Focus exclusively on this goal this week');

    return actions.slice(0, 3);
}

// ── Helper Functions ────────────────────────────────────────────────

function findLinkedTasks(tasks: Task[], goal: Goal, _startDate: Date, _endDate: Date): Task[] {
    // 1. Explicitly tagged
    const goalTag = `goal:${goal.id}`;
    const tagged = tasks.filter(t => hasTag(t, goalTag));
    if (tagged.length) return tagged;

    // 2. Linked via goalId
    const byGoalId = tasks.filter(t => String((t as any).goalId ?? (t as any).goal_id ?? '') === String(goal.id));
    if (byGoalId.length) return byGoalId;

    // 3. Category match (only if goal has a category set)
    if (goal.category) {
        const categoryMatch = tasks.filter(t => {
            const taskCat = String((t as any).category ?? '').toLowerCase();
            return taskCat !== '' && taskCat === goal.category!.toLowerCase();
        });
        if (categoryMatch.length) return categoryMatch;
    }

    // NO date-range fallback — we don't want to link random tasks to this goal
    // If nothing is explicitly linked, return empty array
    return [];
}

function findLinkedHabits(habits: Habit[], goal: Goal): Habit[] {
    return habits.filter(h => {
        const direct = (h as any).goal_link ?? (h as any).goalLink;
        const scheduleLink = (h as any).schedule?.goal_link ?? (h as any).schedule?.goalLink;
        return String(direct ?? scheduleLink ?? '') === String(goal.id);
    });
}

function findAutoHabits(habits: Habit[]): Habit[] {
    const autoNames = AUTO_HABITS.map(a => a.name.toLowerCase());
    return habits.filter(h => {
        const name = h.name.toLowerCase();
        return autoNames.some(auto => name.includes(auto) || auto.includes(name));
    });
}

function isCompleted(task: Task): boolean {
    const status = String((task as any).status ?? '').toLowerCase();
    return status === 'completed' || status === 'done';
}

function isHabitCompletedToday(habit: Habit, now: Date): boolean {
    const today = now.toISOString().split('T')[0];
    const lastCompleted = toDate((habit as any).lastCompleted ?? (habit as any).last_completed);
    if (!lastCompleted) return false;
    return lastCompleted.toISOString().split('T')[0] === today;
}

function calculateSingleHabitScore(habit: Habit, now: Date): number {
    const streak = toNumber((habit as any).currentStreak ?? (habit as any).current_streak) ?? 0;
    const lastCompleted = toDate((habit as any).lastCompleted ?? (habit as any).last_completed);
    const cadence = getCadence(String(habit.frequency ?? 'daily'));

    const daysSince = lastCompleted
        ? Math.max(0, (now.getTime() - lastCompleted.getTime()) / MS_PER_DAY)
        : Infinity;

    const recency = daysSince / cadence;
    const recencyScore = recency <= 1 ? 100 : recency <= 2 ? 60 : 20;
    const streakScore = clamp((Math.min(streak, 14) / 14) * 100, 0, 100);

    return recencyScore * 0.6 + streakScore * 0.4;
}

function hasTag(task: Task, tag: string): boolean {
    const tags = (task as any).tags;
    return Array.isArray(tags) && tags.some((t: unknown) => typeof t === 'string' && t.toLowerCase() === tag.toLowerCase());
}

function getCadence(frequency: string): number {
    if (frequency === 'weekly') return 7;
    if (frequency === 'monthly') return 30;
    return 1;
}

function deriveStartDate(goal: Goal, now: Date): Date {
    const created = toDate((goal as any).created_at ?? goal.created_at);
    if (created) return created;
    const target = toDate(goal.target_date);
    if (target) return new Date(target.getTime() - 30 * MS_PER_DAY);
    return now;
}

function deriveEndDate(goal: Goal, startDate: Date): Date {
    const target = toDate(goal.target_date);
    if (target) return target;
    return new Date(startDate.getTime() + 30 * MS_PER_DAY);
}

function toDate(value: unknown): Date | null {
    if (!value) return null;
    if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
    if (typeof value === 'string' || typeof value === 'number') {
        const d = new Date(value);
        return isNaN(d.getTime()) ? null : d;
    }
    return null;
}

function toNumber(value: unknown): number | null {
    if (typeof value === 'number' && isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() !== '' && !isNaN(Number(value))) return Number(value);
    return null;
}

function clamp(val: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, val));
}
