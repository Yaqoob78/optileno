import React from 'react';
import { CheckCircle2, Target, Zap, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAnalyticsStore } from '../../stores/analytics.store';
import type { AppEvent } from '../../types/events.types';

interface Activity {
  id: string;
  type: 'task' | 'goal' | 'habit';
  title: string;
  description?: string;
  timestamp: Date;
}

const toDate = (value: Date): Date => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date(0) : parsed;
};

const buildActivity = (event: AppEvent): Activity | null => {
  if (event.type === 'task_event') {
    if (event.subtype === 'task_completed') {
      return {
        id: event.id,
        type: 'task',
        title: event.task.title,
        description: `Completed ${event.task.category} task`,
        timestamp: toDate(event.timestamp),
      };
    }

    if (event.subtype === 'task_created') {
      return {
        id: event.id,
        type: 'task',
        title: event.task.title,
        description: 'Task added to planner',
        timestamp: toDate(event.timestamp),
      };
    }
  }

  if (event.type === 'goal_event' && ['goal_created', 'goal_progressed', 'goal_completed'].includes(event.subtype)) {
    const progress = Math.round(event.goal.progress ?? 0);
    return {
      id: event.id,
      type: 'goal',
      title: event.goal.title,
      description: event.subtype === 'goal_created'
        ? 'Goal added to planner'
        : `Progress updated to ${progress}%`,
      timestamp: toDate(event.timestamp),
    };
  }

  if (event.type === 'habit_event' && ['habit_created', 'habit_completed'].includes(event.subtype)) {
    const streakCount = event.metrics.streakCount ?? 0;
    return {
      id: event.id,
      type: 'habit',
      title: event.habit.title,
      description: event.subtype === 'habit_created'
        ? 'Habit added to tracker'
        : streakCount > 1
          ? `${streakCount}-day streak`
          : 'Habit completed',
      timestamp: toDate(event.timestamp),
    };
  }

  return null;
};

export default function RecentActivityWidget() {
  const events = useAnalyticsStore((state) => state.events);

  const activities = events
    .map(buildActivity)
    .filter((activity): activity is Activity => activity !== null)
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, 5);

  const getActivityIcon = (type: Activity['type']) => {
    switch (type) {
      case 'task':
        return <CheckCircle2 size={16} className="text-green-400" />;
      case 'goal':
        return <Target size={16} className="text-blue-400" />;
      case 'habit':
        return <Zap size={16} className="text-yellow-400" />;
      default:
        return null;
    }
  };

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  return (
    <div className="bg-gradient-to-br from-gray-900/50 to-black/50 border border-white/10 rounded-xl p-6 backdrop-blur-sm">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold text-white">Recent Activity</h3>
        <Link to="/planner" className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1">
          View All <ArrowRight size={12} />
        </Link>
      </div>

      {activities.length === 0 ? (
        <div className="flex items-center justify-center py-8 text-gray-500">
          <p className="text-sm">No recent activity</p>
        </div>
      ) : (
        <div className="space-y-3">
          {activities.map((activity) => (
            <div
              key={activity.id}
              className="flex items-start gap-3 p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
            >
              <div className="mt-1">{getActivityIcon(activity.type)}</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{activity.title}</p>
                {activity.description && (
                  <p className="text-xs text-gray-400 mt-0.5">{activity.description}</p>
                )}
              </div>
              <span className="text-xs text-gray-500 whitespace-nowrap">{formatTime(activity.timestamp)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
