// frontend/src/components/dashboard/RecentActivityWidget.tsx
import React, { useState, useEffect } from 'react';
import { CheckCircle2, Target, Zap, Calendar, ArrowRight } from 'lucide-react';
import { usePlanner } from '../../hooks/usePlanner';

interface Activity {
  id: string;
  type: 'task_completed' | 'goal_updated' | 'habit_completed' | 'habit_streak';
  title: string;
  description?: string;
  timestamp: Date;
  value?: string | number;
}

export default function RecentActivityWidget() {
  const { tasks } = usePlanner();
  const [activities, setActivities] = useState<Activity[]>([]);

  useEffect(() => {
    // Build activities from recent tasks
    const recentActivities: Activity[] = [];

    // Add completed tasks
    tasks
      ?.filter(t => t.status === 'completed')
      ?.slice(0, 3)
      ?.forEach(task => {
        recentActivities.push({
          id: task.id,
          type: 'task_completed',
          title: task.title,
          timestamp: new Date(),
          description: task.category
        });
      });

    // Sort by timestamp descending
    setActivities(recentActivities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, 5));
  }, [tasks]);

  const getActivityIcon = (type: Activity['type']) => {
    switch (type) {
      case 'task_completed':
        return <CheckCircle2 size={16} className="text-green-400" />;
      case 'goal_updated':
        return <Target size={16} className="text-blue-400" />;
      case 'habit_completed':
        return <Zap size={16} className="text-yellow-400" />;
      case 'habit_streak':
        return <Calendar size={16} className="text-purple-400" />;
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
        <a href="/planner" className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1">
          View All <ArrowRight size={12} />
        </a>
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
