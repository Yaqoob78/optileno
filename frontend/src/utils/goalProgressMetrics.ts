import type { AppEvent } from '../types/events.types';
import type { Goal, Habit, Task } from '../types/planner.types';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DEFAULT_GOAL_DAYS = 30;

const TASK_PRIORITY_WEIGHT: Record<string, number> = {
  low: 0.7,
  medium: 1,
  high: 1.4,
  urgent: 1.8,
};

export interface GoalProgressMetrics {
  planned_progress_today: number;
  actual_progress_today: number;
  pace_delta: number;
  estimated_finish_date: Date | null;
  confidence_level: 'high' | 'medium' | 'low';
  start_date: Date;
  end_date: Date;
  active_goal_title: string;
  time_left_days: number;
  pace_label: string;
  pace_status: 'ahead' | 'on_track' | 'behind';
  trajectory_insight: string;
  milestone_count: number;
  contribution_breakdown: {
    tasks: number;
    habits: number;
    deepWork: number;
  };
}

export interface GoalProgressInput {
  goal: Goal;
  tasks: Task[];
  habits: Habit[];
  events: AppEvent[];
  dailyDeepWorkCount: number;
  now?: Date;
}

export function selectActiveGoal(goals: Goal[]): Goal | null {
  if (!goals.length) {
    return null;
  }

  // Only consider goals that are NOT 100% complete
  const remainingGoals = goals.filter((goal) => (toNumber(goal.current_progress) ?? 0) < 100);
  if (!remainingGoals.length) {
    return null; // All goals completed — don't show a finished goal as "active"
  }

  return [...remainingGoals].sort((a, b) => {
    const aDate = toDate(a.target_date)?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const bDate = toDate(b.target_date)?.getTime() ?? Number.MAX_SAFE_INTEGER;
    return aDate - bDate;
  })[0];
}

export function computeGoalProgressMetrics(input: GoalProgressInput): GoalProgressMetrics {
  const now = input.now ?? new Date();
  const startDate = deriveGoalStartDate(input.goal, now);
  const endDate = deriveGoalEndDate(input.goal, startDate);
  const totalDays = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / MS_PER_DAY));
  const elapsedDays = Math.max(0, (now.getTime() - startDate.getTime()) / MS_PER_DAY);
  const elapsedRatio = clamp(elapsedDays / totalDays, 0, 1);
  const milestoneCount = Math.max(1, getMilestones(input.goal).length || 4);

  const plannedByTime = elapsedRatio * 100;
  const expectedMilestones = Math.floor(elapsedRatio * milestoneCount);
  const plannedByMilestones = (expectedMilestones / milestoneCount) * 100;
  const plannedProgress = clamp(plannedByTime * 0.65 + plannedByMilestones * 0.35, 0, 100);

  const linkedTasks = getLinkedTasks(input.tasks, input.goal, startDate, endDate);
  const linkedHabits = getLinkedHabits(input.habits, input.goal);

  const taskScore = computeTaskScore(linkedTasks);
  const milestoneScore = computeMilestoneScore(input.goal, linkedTasks);
  const habitScore = computeHabitScore(linkedHabits, now);
  const deepWork = computeDeepWorkScore(input.events, input.dailyDeepWorkCount, startDate, now);

  const weightedSignals = [
    { key: 'tasks', score: taskScore, weight: 0.55, active: linkedTasks.length > 0 },
    { key: 'timeline', score: milestoneScore, weight: 0.25, active: milestoneCount > 0 },
    { key: 'habits', score: habitScore, weight: 0.12, active: linkedHabits.length > 0 },
    { key: 'deepWork', score: deepWork.score, weight: 0.08, active: deepWork.targetMinutes > 0 },
  ];

  const activeWeight = weightedSignals.reduce((sum, signal) => sum + (signal.active ? signal.weight : 0), 0) || 1;
  const weightedPoints = weightedSignals.reduce((sum, signal) => {
    if (!signal.active) {
      return sum;
    }
    return sum + signal.score * (signal.weight / activeWeight);
  }, 0);

  const actualProgress = clamp(weightedPoints, 0, 100);
  const paceDelta = roundOneDecimal(actualProgress - plannedProgress);

  const expectedDailyProgress = 100 / totalDays;
  const daysAheadBehind = Math.round(paceDelta / Math.max(expectedDailyProgress, 0.01));
  const paceStatus = daysAheadBehind >= 2 ? 'ahead' : daysAheadBehind <= -2 ? 'behind' : 'on_track';
  const paceLabel = formatPaceLabel(paceStatus, daysAheadBehind);

  const progressRatePerDay = actualProgress / Math.max(elapsedDays, 1);
  // Reduced multiplier range [0.85-1.15] to prevent wild finish date swings
  const momentumMultiplier = clamp(1 + (habitScore - 50) / 800 + (deepWork.score - 50) / 600, 0.85, 1.15);
  const effectiveRate = Math.max(0.05, progressRatePerDay * momentumMultiplier);
  const estimatedFinishDate = actualProgress >= 100
    ? now
    : new Date(now.getTime() + ((100 - actualProgress) / effectiveRate) * MS_PER_DAY);

  const confidence = computeConfidenceLevel({
    linkedTasks: linkedTasks.length,
    linkedHabits: linkedHabits.length,
    deepWorkSessions: deepWork.sessions,
    paceDelta,
    elapsedDays,
  });

  const trajectoryInsight = buildTrajectoryInsight({
    estimatedFinishDate,
    goalEndDate: endDate,
    now,
    actualProgress,
    effectiveRate,
  });

  const contributionBreakdown = getContributionBreakdown({
    taskScore,
    habitScore,
    deepWorkScore: deepWork.score,
    activeTaskSignal: linkedTasks.length > 0,
    activeHabitSignal: linkedHabits.length > 0,
    activeDeepSignal: deepWork.targetMinutes > 0,
  });

  return {
    planned_progress_today: roundOneDecimal(plannedProgress),
    actual_progress_today: roundOneDecimal(actualProgress),
    pace_delta: paceDelta,
    estimated_finish_date: estimatedFinishDate,
    confidence_level: confidence,
    start_date: startDate,
    end_date: endDate,
    active_goal_title: input.goal.title,
    time_left_days: Math.ceil((endDate.getTime() - now.getTime()) / MS_PER_DAY),
    pace_label: paceLabel,
    pace_status: paceStatus,
    trajectory_insight: trajectoryInsight,
    milestone_count: milestoneCount,
    contribution_breakdown: contributionBreakdown,
  };
}

function toDate(value: unknown): Date | null {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) {
    return Number(value);
  }
  return null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

function deriveGoalStartDate(goal: Goal, now: Date): Date {
  //Use the actual creation date from the goal
  const createdAt = toDate((goal as any).created_at ?? goal.created_at);
  if (createdAt) {
    return createdAt;
  }

  // If no created_at, use a sensible default based on target date
  const targetDate = toDate(goal.target_date);
  if (targetDate) {
    // Default to 30 days before target for planning
    return new Date(targetDate.getTime() - DEFAULT_GOAL_DAYS * MS_PER_DAY);
  }

  // Last resort: assume goal was created recently (today)
  return now;
}

function deriveGoalEndDate(goal: Goal, startDate: Date): Date {
  const targetDate = toDate(goal.target_date);
  if (targetDate) {
    return targetDate;
  }
  return new Date(startDate.getTime() + DEFAULT_GOAL_DAYS * MS_PER_DAY);
}

function getMilestones(goal: Goal): any[] {
  if (!Array.isArray(goal.milestones)) {
    return [];
  }
  return goal.milestones.filter(Boolean);
}

function getLinkedTasks(tasks: Task[], goal: Goal, startDate: Date, endDate: Date): Task[] {
  // 1. Prefer explicitly tagged tasks
  const goalTag = `goal:${goal.id}`;
  const tagged = tasks.filter((task) => hasTag(task, goalTag));
  if (tagged.length) {
    return tagged;
  }

  // 2. Fall back to tasks created/due within the goal's date range
  const ranged = tasks.filter((task) => {
    const dueDate = toDate((task as any).dueDate ?? (task as any).due_date);
    const createdAt = toDate((task as any).createdAt ?? (task as any).created_at);
    if (dueDate && dueDate >= startDate && dueDate <= endDate) {
      return true;
    }
    if (createdAt && createdAt >= startDate && createdAt <= endDate) {
      return true;
    }
    return false;
  });

  if (ranged.length) {
    return ranged;
  }

  // 3. Return EMPTY — never use unrelated tasks as a proxy for goal progress
  return [];
}

function hasTag(task: Task, tag: string): boolean {
  const tags = (task as any).tags;
  if (!Array.isArray(tags)) {
    return false;
  }
  return tags.some((entry: unknown) => typeof entry === 'string' && entry.toLowerCase() === tag.toLowerCase());
}

function getLinkedHabits(habits: Habit[], goal: Goal): Habit[] {
  // Only return habits explicitly linked to this goal — never use unrelated habits
  return habits.filter((habit) => {
    const direct = (habit as any).goal_link ?? (habit as any).goalLink;
    const scheduleLink = (habit as any).schedule?.goal_link ?? (habit as any).schedule?.goalLink;
    return String(direct ?? scheduleLink ?? '') === String(goal.id);
  });
}

function isTaskCompleted(task: Task): boolean {
  const status = String((task as any).status ?? '').toLowerCase();
  return status === 'completed' || status === 'done';
}

function computeTaskScore(tasks: Task[]): number {
  if (!tasks.length) {
    return 0;
  }

  const weighted = tasks.map((task) => {
    const priority = String((task as any).priority ?? 'medium').toLowerCase();
    return TASK_PRIORITY_WEIGHT[priority] ?? 1;
  });

  const totalWeight = weighted.reduce((sum, value) => sum + value, 0);
  const completedWeight = tasks.reduce((sum, task, index) => (
    sum + (isTaskCompleted(task) ? weighted[index] : 0)
  ), 0);

  if (!totalWeight) {
    return 0;
  }

  return clamp((completedWeight / totalWeight) * 100, 0, 100);
}

function computeMilestoneScore(goal: Goal, tasks: Task[]): number {
  const milestones = getMilestones(goal);
  if (!milestones.length) {
    return tasks.length ? clamp((tasks.filter(isTaskCompleted).length / tasks.length) * 100, 0, 100) : 0;
  }

  const explicitDone = milestones.filter((milestone: any) => typeof milestone === 'object' && milestone?.completed === true).length;
  if (explicitDone > 0) {
    return clamp((explicitDone / milestones.length) * 100, 0, 100);
  }

  const completedTasks = tasks.filter(isTaskCompleted).length;
  return clamp((Math.min(completedTasks, milestones.length) / milestones.length) * 100, 0, 100);
}

function computeHabitScore(habits: Habit[], now: Date): number {
  if (!habits.length) {
    return 0;
  }

  const scores = habits.map((habit) => {
    const cadenceDays = getHabitCadenceDays(String((habit as any).frequency ?? 'daily'));
    const lastCompleted = toDate((habit as any).lastCompleted ?? (habit as any).last_completed);
    const streak = toNumber((habit as any).currentStreak ?? (habit as any).streak) ?? 0;

    const daysSinceCompletion = lastCompleted
      ? Math.max(0, (now.getTime() - lastCompleted.getTime()) / MS_PER_DAY)
      : Number.POSITIVE_INFINITY;

    const recencyRatio = daysSinceCompletion / cadenceDays;
    const recencyScore = recencyRatio <= 1 ? 100 : recencyRatio <= 1.5 ? 70 : recencyRatio <= 2 ? 40 : 15;
    const streakScore = clamp((Math.min(streak, 14) / 14) * 100, 0, 100);

    return recencyScore * 0.7 + streakScore * 0.3;
  });

  return scores.reduce((sum, score) => sum + score, 0) / scores.length;
}

function getHabitCadenceDays(frequency: string): number {
  if (frequency === 'weekly') {
    return 7;
  }
  if (frequency === 'monthly') {
    return 30;
  }
  return 1;
}

function computeDeepWorkScore(events: AppEvent[], dailyDeepWorkCount: number, startDate: Date, now: Date): {
  score: number;
  sessions: number;
  targetMinutes: number;
} {
  const deepWorkEvents = events.filter((event: any) => {
    if (event?.type !== 'deep_work_event') {
      return false;
    }
    const timestamp = toDate(event.timestamp);
    return !!timestamp && timestamp >= startDate && timestamp <= now;
  });

  const completedDeepEvents = deepWorkEvents.filter((event: any) => event.subtype === 'deep_work_completed');
  const minutesFromEvents = completedDeepEvents.reduce((sum: number, event: any) => {
    const eventMinutes = toNumber(event?.metrics?.duration) ?? toNumber(event?.metadata?.duration) ?? 0;
    return sum + Math.max(0, eventMinutes);
  }, 0);

  // dailyDeepWorkCount is the NUMBER of sessions, not minutes.
  // Use 25 min/session as a conservative default (aligned with typical deep work blocks).
  const fallbackMinutes = dailyDeepWorkCount > 0 ? dailyDeepWorkCount * 25 : 0;
  const totalMinutes = Math.max(minutesFromEvents, fallbackMinutes);
  const elapsedDays = Math.max(1, Math.ceil((now.getTime() - startDate.getTime()) / MS_PER_DAY));
  const targetMinutes = elapsedDays * 45;
  const score = clamp((totalMinutes / Math.max(targetMinutes, 1)) * 100, 0, 100);

  return {
    score,
    sessions: Math.max(completedDeepEvents.length, dailyDeepWorkCount),
    targetMinutes,
  };
}

function computeConfidenceLevel(input: {
  linkedTasks: number;
  linkedHabits: number;
  deepWorkSessions: number;
  paceDelta: number;
  elapsedDays: number;
}): 'high' | 'medium' | 'low' {
  const coverageSignals = [
    input.linkedTasks > 0,
    input.linkedHabits > 0,
    input.deepWorkSessions > 0,
    input.elapsedDays >= 3,
  ];
  const coverage = coverageSignals.filter(Boolean).length / coverageSignals.length;
  const sampleSize = Math.min(40, input.linkedTasks * 2 + input.linkedHabits * 4 + input.deepWorkSessions * 3);
  const stability = Math.max(0, 20 - Math.abs(input.paceDelta)) * 2;
  const score = coverage * 40 + sampleSize + stability;

  if (score >= 70) {
    return 'high';
  }
  if (score >= 45) {
    return 'medium';
  }
  return 'low';
}

function formatPaceLabel(status: 'ahead' | 'on_track' | 'behind', daysAheadBehind: number): string {
  if (status === 'ahead') {
    return `Ahead by ${Math.abs(daysAheadBehind)} day${Math.abs(daysAheadBehind) === 1 ? '' : 's'}`;
  }
  if (status === 'behind') {
    return `Behind by ${Math.abs(daysAheadBehind)} day${Math.abs(daysAheadBehind) === 1 ? '' : 's'}`;
  }
  return 'On track';
}

function buildTrajectoryInsight(input: {
  estimatedFinishDate: Date | null;
  goalEndDate: Date;
  now: Date;
  actualProgress: number;
  effectiveRate: number;
}): string {
  if (!input.estimatedFinishDate || input.actualProgress <= 0) {
    return 'Log a few sessions to generate a reliable finish forecast.';
  }

  const dayDifference = Math.round((input.goalEndDate.getTime() - input.estimatedFinishDate.getTime()) / MS_PER_DAY);

  if (dayDifference >= 2) {
    return `At this pace, you'll finish ${dayDifference} days early.`;
  }

  if (dayDifference <= -2) {
    const remainingDays = Math.max(1, (input.goalEndDate.getTime() - input.now.getTime()) / MS_PER_DAY);
    const remainingProgress = Math.max(0, 100 - input.actualProgress);
    const requiredRate = remainingProgress / remainingDays;
    const extraRateNeeded = Math.max(0, requiredRate - input.effectiveRate);
    const extraMinutes = Math.max(15, Math.round(extraRateNeeded * 40));
    return `Increase focus by ~${extraMinutes} min/day to stay on track.`;
  }

  return 'Maintain current habits to finish on time.';
}

function getContributionBreakdown(input: {
  taskScore: number;
  habitScore: number;
  deepWorkScore: number;
  activeTaskSignal: boolean;
  activeHabitSignal: boolean;
  activeDeepSignal: boolean;
}): { tasks: number; habits: number; deepWork: number } {
  const weighted = {
    tasks: input.activeTaskSignal ? input.taskScore * 0.6 : 0,
    habits: input.activeHabitSignal ? input.habitScore * 0.25 : 0,
    deepWork: input.activeDeepSignal ? input.deepWorkScore * 0.15 : 0,
  };

  const total = weighted.tasks + weighted.habits + weighted.deepWork;
  if (total <= 0) {
    return { tasks: 0, habits: 0, deepWork: 0 };
  }

  return {
    tasks: Math.round((weighted.tasks / total) * 100),
    habits: Math.round((weighted.habits / total) * 100),
    deepWork: Math.round((weighted.deepWork / total) * 100),
  };
}
