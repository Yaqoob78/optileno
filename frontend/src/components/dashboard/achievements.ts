// Achievement catalog and unlock logic for the Dashboard.
// Every achievement is earned from real usage data only — progress is
// recomputed live from the planner/chat/user stores, never stored as a flag.
import type { LucideIcon } from 'lucide-react';
import {
  Brain,
  CalendarCheck,
  CheckCircle,
  Flame,
  Hourglass,
  MessageSquare,
  Medal,
  Moon,
  Rocket,
  Sun,
  Sunrise,
  Target,
  TrendingUp,
  Trophy,
  Clock,
  Zap,
  Gauge,
} from 'lucide-react';

export type AchievementTier = 'bronze' | 'silver' | 'gold';

export interface AchievementInputs {
  completedTasks: number;
  highPriorityDone: number;
  earlyBirdDone: boolean;
  nightOwlDone: boolean;
  timeSpentToday: number; // minutes
  totalTimeSpent: number; // minutes
  accountAgeDays: number;
  bestHabitStreak: number; // days
  goalsStarted: number;
  bestGoalProgress: number; // 0-100
  goalsCompleted: number;
  productivityScore: number | null;
  conversationCount: number;
}

interface AchievementDef {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  tier: AchievementTier;
  target: number;
  unit: string;
  current: (inputs: AchievementInputs) => number;
}

export interface AchievementStatus extends Omit<AchievementDef, 'current'> {
  current: number;
  earned: boolean;
  percent: number; // 0-100 progress toward target
}

const CATALOG: AchievementDef[] = [
  // — Tasks —
  {
    id: 'first-step',
    title: 'First Step',
    description: 'Complete your first task.',
    icon: CheckCircle,
    tier: 'bronze',
    target: 1,
    unit: 'task',
    current: (s) => s.completedTasks,
  },
  {
    id: 'momentum-builder',
    title: 'Momentum Builder',
    description: 'Complete 10 tasks in total.',
    icon: Zap,
    tier: 'silver',
    target: 10,
    unit: 'tasks',
    current: (s) => s.completedTasks,
  },
  {
    id: 'task-machine',
    title: 'Task Machine',
    description: 'Complete 50 tasks in total.',
    icon: Rocket,
    tier: 'gold',
    target: 50,
    unit: 'tasks',
    current: (s) => s.completedTasks,
  },
  {
    id: 'priority-slayer',
    title: 'Priority Slayer',
    description: 'Finish 5 high-priority or urgent tasks.',
    icon: Flame,
    tier: 'silver',
    target: 5,
    unit: 'tasks',
    current: (s) => s.highPriorityDone,
  },
  {
    id: 'early-bird',
    title: 'Early Bird',
    description: 'Complete a task before 9 AM.',
    icon: Sunrise,
    tier: 'bronze',
    target: 1,
    unit: 'task',
    current: (s) => (s.earlyBirdDone ? 1 : 0),
  },
  {
    id: 'night-owl',
    title: 'Night Owl',
    description: 'Complete a task after 10 PM.',
    icon: Moon,
    tier: 'bronze',
    target: 1,
    unit: 'task',
    current: (s) => (s.nightOwlDone ? 1 : 0),
  },
  // — Focus time —
  {
    id: 'warmed-up',
    title: 'Warmed Up',
    description: 'Spend 30 focused minutes in a single day.',
    icon: Clock,
    tier: 'bronze',
    target: 30,
    unit: 'min',
    current: (s) => s.timeSpentToday,
  },
  {
    id: 'deep-focus',
    title: 'Deep Focus',
    description: 'Spend 2 focused hours in a single day.',
    icon: Brain,
    tier: 'silver',
    target: 120,
    unit: 'min',
    current: (s) => s.timeSpentToday,
  },
  {
    id: 'time-titan',
    title: 'Time Titan',
    description: 'Invest 20 hours of total focus time.',
    icon: Hourglass,
    tier: 'gold',
    target: 1200,
    unit: 'min',
    current: (s) => s.totalTimeSpent,
  },
  // — Consistency —
  {
    id: 'week-strong',
    title: 'One Week Strong',
    description: 'Stay active for your first 7 days.',
    icon: Sun,
    tier: 'bronze',
    target: 7,
    unit: 'days',
    current: (s) => s.accountAgeDays,
  },
  {
    id: 'monthly-regular',
    title: 'Monthly Regular',
    description: 'Reach 30 days on Optileno.',
    icon: CalendarCheck,
    tier: 'silver',
    target: 30,
    unit: 'days',
    current: (s) => s.accountAgeDays,
  },
  {
    id: 'streak-keeper',
    title: 'Streak Keeper',
    description: 'Hold a 7-day habit streak.',
    icon: Flame,
    tier: 'silver',
    target: 7,
    unit: 'days',
    current: (s) => s.bestHabitStreak,
  },
  {
    id: 'unbreakable',
    title: 'Unbreakable',
    description: 'Hold a 30-day habit streak.',
    icon: Trophy,
    tier: 'gold',
    target: 30,
    unit: 'days',
    current: (s) => s.bestHabitStreak,
  },
  // — Goals —
  {
    id: 'goal-setter',
    title: 'Goal Setter',
    description: 'Create your first goal.',
    icon: Target,
    tier: 'bronze',
    target: 1,
    unit: 'goal',
    current: (s) => s.goalsStarted,
  },
  {
    id: 'halfway-there',
    title: 'Halfway There',
    description: 'Push any goal past 50% progress.',
    icon: TrendingUp,
    tier: 'silver',
    target: 50,
    unit: '%',
    current: (s) => s.bestGoalProgress,
  },
  {
    id: 'goal-crusher',
    title: 'Goal Crusher',
    description: 'Take a goal all the way to 100%.',
    icon: Medal,
    tier: 'gold',
    target: 1,
    unit: 'goal',
    current: (s) => s.goalsCompleted,
  },
  // — Performance & AI —
  {
    id: 'peak-performer',
    title: 'Peak Performer',
    description: 'Reach a productivity score of 70 or higher.',
    icon: Gauge,
    tier: 'silver',
    target: 70,
    unit: 'score',
    current: (s) => Math.round(s.productivityScore ?? 0),
  },
  {
    id: 'thinking-partner',
    title: 'Thinking Partner',
    description: 'Start 5 conversations with Leno.',
    icon: MessageSquare,
    tier: 'bronze',
    target: 5,
    unit: 'chats',
    current: (s) => s.conversationCount,
  },
];

const TIER_ORDER: Record<AchievementTier, number> = { gold: 0, silver: 1, bronze: 2 };

export function computeAchievements(inputs: AchievementInputs): AchievementStatus[] {
  return CATALOG.map(({ current, ...def }) => {
    const value = Math.max(0, current(inputs));
    const capped = Math.min(value, def.target);
    return {
      ...def,
      current: capped,
      earned: value >= def.target,
      percent: Math.round((capped / def.target) * 100),
    };
  });
}

/** Earned first (gold → bronze), then locked by closest-to-unlock. */
export function sortForDisplay(list: AchievementStatus[]): AchievementStatus[] {
  return [...list].sort((a, b) => {
    if (a.earned !== b.earned) return a.earned ? -1 : 1;
    if (a.earned) return TIER_ORDER[a.tier] - TIER_ORDER[b.tier];
    return b.percent - a.percent;
  });
}

/** The locked achievement closest to unlocking, for the "Next up" nudge. */
export function nextToUnlock(list: AchievementStatus[]): AchievementStatus | null {
  const locked = list.filter((a) => !a.earned);
  if (locked.length === 0) return null;
  return locked.reduce((best, a) => (a.percent > best.percent ? a : best), locked[0]);
}
