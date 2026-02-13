import React, { useState, useEffect } from 'react';
import { Trophy, CheckCircle, Target, TrendingUp } from 'lucide-react';
import { useAnalyticsStore } from '../../stores/analytics.store';

interface DailyAchievementData {
  tasksCompleted: number;
  tasksPlanned: number;
  habitsCompleted: number;
  habitsTotal: number;
  goalsProgress: number;
  weeklyAverage: number;
  comparedToYesterday: number;
}

const DailyAchievementScore: React.FC = () => {
  const { currentMetrics, dailyMetrics } = useAnalyticsStore();
  const [achievementData, setAchievementData] = useState<DailyAchievementData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate loading achievement data from store
    const loadAchievementData = async () => {
      setLoading(true);
      
      // Mock data - in real implementation, this would come from the analytics store
      const mockData: DailyAchievementData = {
        tasksCompleted: 8,
        tasksPlanned: 10,
        habitsCompleted: 6,
        habitsTotal: 7,
        goalsProgress: 78,
        weeklyAverage: 72,
        comparedToYesterday: 12 // percent difference
      };
      
      setAchievementData(mockData);
      setLoading(false);
    };

    loadAchievementData();
  }, []);

  if (loading || !achievementData) {
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

  const completionRate = Math.round((achievementData.tasksCompleted / achievementData.tasksPlanned) * 100);
  const habitRate = Math.round((achievementData.habitsCompleted / achievementData.habitsTotal) * 100);

  return (
    <div className="glass-card p-6 rounded-xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-r from-yellow-500 to-orange-600">
            <Trophy className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Daily Achievement Score</h3>
            <p className="text-sm text-gray-400">Today's performance metrics</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-white">
            {completionRate}%
          </div>
          <div className="text-xs text-gray-400">Task Completion</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="p-4 rounded-lg bg-gray-800/50">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-4 h-4 text-green-500" />
            <span className="text-sm text-gray-300">Tasks</span>
          </div>
          <div className="text-2xl font-bold text-white">
            {achievementData.tasksCompleted}/{achievementData.tasksPlanned}
          </div>
          <div className="text-xs text-gray-400">
            {completionRate}% completed
          </div>
        </div>

        <div className="p-4 rounded-lg bg-gray-800/50">
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-4 h-4 text-blue-500" />
            <span className="text-sm text-gray-300">Habits</span>
          </div>
          <div className="text-2xl font-bold text-white">
            {achievementData.habitsCompleted}/{achievementData.habitsTotal}
          </div>
          <div className="text-xs text-gray-400">
            {habitRate}% completed
          </div>
        </div>
      </div>

      <div className="mb-4">
        <div className="flex justify-between text-sm mb-1">
          <span className="text-gray-300">Goal Progress</span>
          <span className="text-gray-400">{achievementData.goalsProgress}%</span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-2">
          <div
            className="h-2 rounded-full bg-gradient-to-r from-yellow-500 to-orange-500"
            style={{ width: `${achievementData.goalsProgress}%` }}
          ></div>
        </div>
      </div>

      <div className="pt-4 border-t border-gray-700/50">
        <div className="flex justify-between">
          <div>
            <div className="text-xs text-gray-400">Weekly Average</div>
            <div className="text-sm font-medium text-white">{achievementData.weeklyAverage}%</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-400">Compared to Yesterday</div>
            <div className="flex items-center gap-1">
              {achievementData.comparedToYesterday >= 0 ? (
                <TrendingUp className="w-4 h-4 text-green-500" />
              ) : (
                <TrendingUp className="w-4 h-4 text-red-500 rotate-180" />
              )}
              <span className={`text-sm font-medium ${
                achievementData.comparedToYesterday >= 0 ? 'text-green-500' : 'text-red-500'
              }`}>
                {achievementData.comparedToYesterday >= 0 ? '+' : ''}{achievementData.comparedToYesterday}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DailyAchievementScore;