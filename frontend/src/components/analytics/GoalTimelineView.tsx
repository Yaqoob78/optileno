import React, { useState, useEffect } from 'react';
import { Calendar, Target, Clock, CheckCircle, AlertTriangle } from 'lucide-react';
import { useAnalyticsStore } from '../../stores/analytics.store';

interface GoalTimelineItem {
  id: string;
  title: string;
  targetDate: string;
  daysRemaining: number;
  progress: number;
  status: 'on_track' | 'at_risk' | 'overdue' | 'completed';
  milestones: Array<{
    id: string;
    title: string;
    completed: boolean;
    date: string;
  }>;
}

const GoalTimelineView: React.FC = () => {
  const { currentMetrics, dailyMetrics } = useAnalyticsStore();
  const [timeline, setTimeline] = useState<GoalTimelineItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate loading timeline data from store
    const loadTimeline = async () => {
      setLoading(true);
      
      // Mock data - in real implementation, this would come from the analytics store
      const mockTimeline: GoalTimelineItem[] = [
        {
          id: '1',
          title: 'Complete Project Alpha',
          targetDate: '2026-03-15',
          daysRemaining: 38,
          progress: 75,
          status: 'on_track',
          milestones: [
            { id: 'm1', title: 'Research phase', completed: true, date: '2026-01-15' },
            { id: 'm2', title: 'Design phase', completed: true, date: '2026-02-01' },
            { id: 'm3', title: 'Development phase', completed: false, date: '2026-02-28' },
            { id: 'm4', title: 'Testing phase', completed: false, date: '2026-03-10' },
            { id: 'm5', title: 'Final delivery', completed: false, date: '2026-03-15' }
          ]
        },
        {
          id: '2',
          title: 'Learn TypeScript',
          targetDate: '2026-02-28',
          daysRemaining: 23,
          progress: 45,
          status: 'at_risk',
          milestones: [
            { id: 'm6', title: 'Basics', completed: true, date: '2026-01-31' },
            { id: 'm7', title: 'Intermediate concepts', completed: true, date: '2026-02-15' },
            { id: 'm8', title: 'Advanced patterns', completed: false, date: '2026-02-25' },
            { id: 'm9', title: 'Practice projects', completed: false, date: '2026-02-28' }
          ]
        },
        {
          id: '3',
          title: 'Exercise 5x per week',
          targetDate: '2026-12-31',
          daysRemaining: 329,
          progress: 90,
          status: 'on_track',
          milestones: [
            { id: 'm10', title: 'Establish routine', completed: true, date: '2025-12-31' },
            { id: 'm11', title: 'Maintain 3x/week', completed: true, date: '2026-01-31' },
            { id: 'm12', title: 'Increase to 4x/week', completed: true, date: '2026-02-28' },
            { id: 'm13', title: 'Achieve 5x/week', completed: false, date: '2026-03-31' }
          ]
        }
      ];
      
      setTimeline(mockTimeline);
      setLoading(false);
    };

    loadTimeline();
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'on_track': return 'text-green-500';
      case 'at_risk': return 'text-yellow-500';
      case 'overdue': return 'text-red-500';
      case 'completed': return 'text-blue-500';
      default: return 'text-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'on_track': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'at_risk': return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'overdue': return <AlertTriangle className="w-4 h-4 text-red-500" />;
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
          <div className="p-2 rounded-lg bg-gradient-to-r from-blue-500 to-teal-600">
            <Calendar className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Goal Timeline</h3>
            <p className="text-sm text-gray-400">Visualize your goals and milestones</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-white">
            {timeline.length}
          </div>
          <div className="text-xs text-gray-400">Active Goals</div>
        </div>
      </div>

      <div className="space-y-6">
        {timeline.map((item) => (
          <div key={item.id} className="relative pl-8 pb-6">
            {/* Timeline connector */}
            <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gradient-to-b from-blue-500 to-transparent"></div>
            
            {/* Timeline marker */}
            <div className="absolute left-0 top-2 w-4 h-4 rounded-full bg-blue-500 border-4 border-gray-800"></div>
            
            <div className="bg-gray-800/50 rounded-lg p-4 ml-4">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h4 className="font-medium text-white flex items-center gap-2">
                    <Target className="w-4 h-4" />
                    {item.title}
                  </h4>
                  <div className="flex items-center gap-4 mt-1">
                    <div className="flex items-center gap-1 text-sm text-gray-300">
                      <Calendar className="w-3 h-3" />
                      <span>{new Date(item.targetDate).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center gap-1 text-sm text-gray-300">
                      <Clock className="w-3 h-3" />
                      <span>{item.daysRemaining} days left</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {getStatusIcon(item.status)}
                  <span className={`text-xs capitalize ${getStatusColor(item.status)}`}>
                    {item.status.replace('_', ' ')}
                  </span>
                </div>
              </div>

              <div className="mb-3">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-300">Progress</span>
                  <span className="text-gray-400">{item.progress}%</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      item.status === 'on_track' ? 'bg-green-500' :
                      item.status === 'at_risk' ? 'bg-yellow-500' :
                      item.status === 'overdue' ? 'bg-red-500' : 'bg-blue-500'
                    }`}
                    style={{ width: `${item.progress}%` }}
                  ></div>
                </div>
              </div>

              <div className="mt-4">
                <h5 className="text-sm font-medium text-gray-300 mb-2">Milestones</h5>
                <div className="space-y-2">
                  {item.milestones.map((milestone) => (
                    <div key={milestone.id} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        {milestone.completed ? (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : (
                          <div className="w-4 h-4 rounded-full border border-gray-500" />
                        )}
                        <span className={milestone.completed ? 'text-green-300' : 'text-gray-400'}>
                          {milestone.title}
                        </span>
                      </div>
                      <span className="text-xs text-gray-500">
                        {new Date(milestone.date).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default GoalTimelineView;