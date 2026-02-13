import React, { useState, useEffect } from 'react';
import { Target, Calendar, TrendingUp, Clock, CheckCircle, AlertTriangle } from 'lucide-react';
import { useAnalyticsStore } from '../../stores/analytics.store';
import { useUser } from '../../hooks/useUser';

interface GoalProgressData {
  id: string;
  title: string;
  progress: number;
  targetDate?: string;
  daysRemaining?: number;
  tasksCompleted: number;
  tasksTotal: number;
  status: 'on_track' | 'at_risk' | 'behind' | 'completed';
  estimatedCompletion?: string;
}

const GoalProgressDashboard: React.FC = () => {
  const { currentMetrics, dailyMetrics } = useAnalyticsStore();
  const { user } = useUser();
  const [goals, setGoals] = useState<GoalProgressData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate loading goals from store
    const loadGoals = async () => {
      setLoading(true);
      
      // Mock data - in real implementation, this would come from the analytics store
      const mockGoals: GoalProgressData[] = [
        {
          id: '1',
          title: 'Complete Project Alpha',
          progress: 75,
          targetDate: '2026-03-15',
          daysRemaining: 38,
          tasksCompleted: 12,
          tasksTotal: 16,
          status: 'on_track',
          estimatedCompletion: '2026-03-10'
        },
        {
          id: '2',
          title: 'Learn TypeScript',
          progress: 45,
          targetDate: '2026-02-28',
          daysRemaining: 23,
          tasksCompleted: 9,
          tasksTotal: 20,
          status: 'at_risk',
          estimatedCompletion: '2026-03-15'
        },
        {
          id: '3',
          title: 'Exercise 5x per week',
          progress: 90,
          targetDate: '2026-12-31',
          daysRemaining: 329,
          tasksCompleted: 45,
          tasksTotal: 50,
          status: 'on_track',
          estimatedCompletion: '2026-11-30'
        },
        {
          id: '4',
          title: 'Read 24 books this year',
          progress: 12,
          targetDate: '2026-12-31',
          daysRemaining: 329,
          tasksCompleted: 3,
          tasksTotal: 24,
          status: 'behind',
          estimatedCompletion: '2026-12-31'
        }
      ];
      
      setGoals(mockGoals);
      setLoading(false);
    };

    loadGoals();
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'on_track': return 'text-green-500';
      case 'at_risk': return 'text-yellow-500';
      case 'behind': return 'text-red-500';
      case 'completed': return 'text-blue-500';
      default: return 'text-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'on_track': return <TrendingUp className="w-4 h-4 text-green-500" />;
      case 'at_risk': return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'behind': return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case 'completed': return <CheckCircle className="w-4 h-4 text-blue-500" />;
      default: return <div className="w-4 h-4" />;
    }
  };

  if (loading) {
    return (
      <div className="glass-card p-6 rounded-xl">
        <div className="animate-pulse flex flex-col space-y-4">
          <div className="h-6 bg-gray-700 rounded w-1/3"></div>
          <div className="h-4 bg-gray-700 rounded w-1/4"></div>
          <div className="h-4 bg-gray-700 rounded w-2/3"></div>
          <div className="h-4 bg-gray-700 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card p-6 rounded-xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-r from-blue-500 to-purple-600">
            <Target className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Goal Progress</h3>
            <p className="text-sm text-gray-400">Track your objectives and milestones</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-white">
            {goals.filter(g => g.status !== 'completed').length}
          </div>
          <div className="text-xs text-gray-400">Active Goals</div>
        </div>
      </div>

      <div className="space-y-4">
        {goals.map((goal) => (
          <div key={goal.id} className="p-4 rounded-lg bg-gray-800/50 hover:bg-gray-800 transition-colors">
            <div className="flex justify-between items-start mb-2">
              <h4 className="font-medium text-white truncate max-w-[70%]">{goal.title}</h4>
              <div className="flex items-center gap-1">
                {getStatusIcon(goal.status)}
                <span className={`text-xs capitalize ${getStatusColor(goal.status)}`}>
                  {goal.status.replace('_', ' ')}
                </span>
              </div>
            </div>

            <div className="mb-2">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-300">{goal.progress}% complete</span>
                <span className="text-gray-400">
                  {goal.tasksCompleted}/{goal.tasksTotal} tasks
                </span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${
                    goal.status === 'on_track' ? 'bg-green-500' :
                    goal.status === 'at_risk' ? 'bg-yellow-500' :
                    goal.status === 'behind' ? 'bg-red-500' : 'bg-blue-500'
                  }`}
                  style={{ width: `${goal.progress}%` }}
                ></div>
              </div>
            </div>

            <div className="flex justify-between text-xs text-gray-400">
              {goal.estimatedCompletion && (
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>Est. {new Date(goal.estimatedCompletion).toLocaleDateString()}</span>
                </div>
              )}
              {goal.daysRemaining !== undefined && goal.daysRemaining >= 0 && (
                <div className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  <span>{goal.daysRemaining} days left</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 pt-4 border-t border-gray-700/50">
        <div className="flex justify-between text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span className="text-gray-400">On Track</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <span className="text-gray-400">At Risk</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <span className="text-gray-400">Behind</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GoalProgressDashboard;