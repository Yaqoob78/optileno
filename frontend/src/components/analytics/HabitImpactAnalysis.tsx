import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Target, Activity, BarChart3 } from 'lucide-react';
import { useAnalyticsStore } from '../../stores/analytics.store';

interface HabitImpactData {
  id: string;
  name: string;
  impactScore: number; // 0-100
  correlation: number; // -1 to 1
  productivityIncrease: number; // percentage
  consistency: number; // 0-100
  category: string;
}

const HabitImpactAnalysis: React.FC = () => {
  const { currentMetrics, dailyMetrics } = useAnalyticsStore();
  const [habits, setHabits] = useState<HabitImpactData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate loading habit impact data from store
    const loadHabits = async () => {
      setLoading(true);
      
      // Mock data - in real implementation, this would come from the analytics store
      const mockHabits: HabitImpactData[] = [
        {
          id: '1',
          name: 'Morning Meditation',
          impactScore: 85,
          correlation: 0.72,
          productivityIncrease: 23,
          consistency: 95,
          category: 'Mindfulness'
        },
        {
          id: '2',
          name: 'Daily Exercise',
          impactScore: 78,
          correlation: 0.65,
          productivityIncrease: 18,
          consistency: 87,
          category: 'Health'
        },
        {
          id: '3',
          name: 'Early Morning Work',
          impactScore: 92,
          correlation: 0.81,
          productivityIncrease: 35,
          consistency: 91,
          category: 'Productivity'
        },
        {
          id: '4',
          name: 'Digital Detox Evenings',
          impactScore: 65,
          correlation: 0.45,
          productivityIncrease: 12,
          consistency: 73,
          category: 'Focus'
        },
        {
          id: '5',
          name: 'Weekly Planning',
          impactScore: 88,
          correlation: 0.78,
          productivityIncrease: 28,
          consistency: 89,
          category: 'Organization'
        }
      ];
      
      setHabits(mockHabits);
      setLoading(false);
    };

    loadHabits();
  }, []);

  const getImpactColor = (score: number) => {
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getCorrelationIcon = (correlation: number) => {
    if (correlation > 0.5) return <TrendingUp className="w-4 h-4 text-green-500" />;
    if (correlation > 0) return <TrendingUp className="w-4 h-4 text-yellow-500" />;
    if (correlation < -0.5) return <TrendingDown className="w-4 h-4 text-red-500" />;
    if (correlation < 0) return <TrendingDown className="w-4 h-4 text-orange-500" />;
    return <TrendingUp className="w-4 h-4 text-gray-500" />;
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
          <div className="p-2 rounded-lg bg-gradient-to-r from-purple-500 to-pink-600">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Habit Impact Analysis</h3>
            <p className="text-sm text-gray-400">How your habits affect productivity</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-white">
            {habits.length}
          </div>
          <div className="text-xs text-gray-400">Tracked Habits</div>
        </div>
      </div>

      <div className="space-y-4">
        {habits.map((habit) => (
          <div key={habit.id} className="p-4 rounded-lg bg-gray-800/50 hover:bg-gray-800 transition-colors">
            <div className="flex justify-between items-start mb-3">
              <h4 className="font-medium text-white truncate max-w-[70%]">{habit.name}</h4>
              <div className="flex items-center gap-1">
                {getCorrelationIcon(habit.correlation)}
                <span className={`text-xs ${getImpactColor(habit.impactScore)}`}>
                  {habit.impactScore}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
              <div className="text-center">
                <div className="text-xs text-gray-400">Impact</div>
                <div className={`text-sm font-medium ${getImpactColor(habit.impactScore)}`}>
                  {habit.impactScore}/100
                </div>
              </div>
              <div className="text-center">
                <div className="text-xs text-gray-400">Correlation</div>
                <div className="text-sm font-medium text-white">
                  {(habit.correlation * 100).toFixed(0)}%
                </div>
              </div>
              <div className="text-center">
                <div className="text-xs text-gray-400">Productivity</div>
                <div className="text-sm font-medium text-green-400">
                  +{habit.productivityIncrease}%
                </div>
              </div>
              <div className="text-center">
                <div className="text-xs text-gray-400">Consistency</div>
                <div className="text-sm font-medium text-white">
                  {habit.consistency}%
                </div>
              </div>
            </div>

            <div className="w-full bg-gray-700 rounded-full h-2">
              <div
                className="h-2 rounded-full bg-gradient-to-r from-purple-500 to-pink-500"
                style={{ width: `${habit.impactScore}%` }}
              ></div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 pt-4 border-t border-gray-700/50">
        <div className="flex justify-between text-xs text-gray-400">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-3 h-3 text-green-500" />
            <span>Positive correlation</span>
          </div>
          <div className="flex items-center gap-2">
            <TrendingDown className="w-3 h-3 text-red-500" />
            <span>Negative correlation</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HabitImpactAnalysis;