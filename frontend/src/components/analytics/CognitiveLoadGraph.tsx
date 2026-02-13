import React, { useState } from 'react';
import { 
  Brain, 
  AlertTriangle, 
  Zap, 
  Coffee, 
  TrendingDown,
  TrendingUp,
  Clock,
  Activity
} from 'lucide-react';

interface LoadPoint {
  time: string;
  load: number; // 0-100
  type: 'work' | 'break' | 'meeting' | 'deep-work' | 'creative';
  duration: number; // minutes
  task?: string;
}

interface CognitiveLoadGraphProps {
  data?: LoadPoint[];
  timeRange?: string;
}

export default function CognitiveLoadGraph({ data, timeRange = 'Today' }: CognitiveLoadGraphProps) {
  const [hoveredPoint, setHoveredPoint] = useState<LoadPoint | null>(null);
  
  const defaultData: LoadPoint[] = [
    { time: '08:00', load: 20, type: 'work', duration: 30, task: 'Morning planning' },
    { time: '08:30', load: 65, type: 'deep-work', duration: 45, task: 'Report writing' },
    { time: '09:15', load: 85, type: 'deep-work', duration: 45, task: 'Complex analysis' },
    { time: '10:00', load: 25, type: 'break', duration: 15, task: 'Coffee break' },
    { time: '10:15', load: 70, type: 'meeting', duration: 30, task: 'Team sync' },
    { time: '10:45', load: 90, type: 'creative', duration: 60, task: 'Design work' },
    { time: '11:45', load: 95, type: 'deep-work', duration: 45, task: 'Problem solving' },
    { time: '12:30', load: 15, type: 'break', duration: 60, task: 'Lunch break' },
    { time: '13:30', load: 75, type: 'work', duration: 30, task: 'Email catch-up' },
    { time: '14:00', load: 80, type: 'meeting', duration: 45, task: 'Client call' },
    { time: '14:45', load: 60, type: 'work', duration: 30, task: 'Documentation' },
    { time: '15:15', load: 25, type: 'break', duration: 15, task: 'Quick break' },
    { time: '15:30', load: 85, type: 'creative', duration: 90, task: 'Strategy planning' },
    { time: '17:00', load: 40, type: 'work', duration: 30, task: 'Wrap up' }
  ];

  const displayData = data || defaultData;

  const getLoadColor = (load: number) => {
    if (load >= 80) return 'from-red-500 to-rose-500';
    if (load >= 60) return 'from-orange-500 to-amber-500';
    if (load >= 40) return 'from-yellow-500 to-amber-400';
    if (load >= 20) return 'from-blue-500 to-cyan-400';
    return 'from-green-500 to-emerald-400';
  };

  const getLoadLabel = (load: number) => {
    if (load >= 80) return 'Very High';
    if (load >= 60) return 'High';
    if (load >= 40) return 'Moderate';
    if (load >= 20) return 'Light';
    return 'Very Light';
  };

  const getTypeIcon = (type: LoadPoint['type']) => {
    switch (type) {
      case 'deep-work': return <Brain className="w-4 h-4" />;
      case 'creative': return <Zap className="w-4 h-4" />;
      case 'meeting': return <Activity className="w-4 h-4" />;
      case 'break': return <Coffee className="w-4 h-4" />;
      default: return <Activity className="w-4 h-4" />;
    }
  };

  const getTypeColor = (type: LoadPoint['type']) => {
    switch (type) {
      case 'deep-work': return 'text-purple-400 bg-purple-500/20 border-purple-500/30';
      case 'creative': return 'text-yellow-400 bg-yellow-500/20 border-yellow-500/30';
      case 'meeting': return 'text-blue-400 bg-blue-500/20 border-blue-500/30';
      case 'break': return 'text-green-400 bg-green-500/20 border-green-500/30';
      default: return 'text-gray-400 bg-gray-500/20 border-gray-500/30';
    }
  };

  // Calculate statistics
  const calculateStats = () => {
    const loads = displayData.map(d => d.load);
    const avgLoad = loads.reduce((a, b) => a + b, 0) / loads.length;
    const maxLoad = Math.max(...loads);
    const minLoad = Math.min(...loads);
    
    // Count high load periods (load >= 70)
    const highLoadPeriods = displayData.filter(d => d.load >= 70).length;
    
    // Calculate recovery periods (load <= 30 after high load)
    let recoveryOpportunities = 0;
    for (let i = 1; i < displayData.length; i++) {
      if (displayData[i-1].load >= 70 && displayData[i].load <= 30) {
        recoveryOpportunities++;
      }
    }
    
    return {
      avgLoad: Math.round(avgLoad),
      maxLoad,
      minLoad,
      highLoadPeriods,
      recoveryOpportunities,
      totalTime: displayData.reduce((sum, d) => sum + d.duration, 0)
    };
  };

  const stats = calculateStats();

  // Find optimal break times
  const findOptimalBreaks = () => {
    const optimalBreaks: { time: string; reason: string }[] = [];
    
    // Look for consecutive high load periods
    for (let i = 0; i < displayData.length - 1; i++) {
      const current = displayData[i];
      const next = displayData[i + 1];
      
      if (current.load >= 70 && next.load >= 70) {
        optimalBreaks.push({
          time: current.time,
          reason: 'Consecutive high-load sessions detected'
        });
      }
    }
    
    // Look for sustained high load
    for (let i = 0; i < displayData.length - 2; i++) {
      if (displayData[i].load >= 60 && displayData[i+1].load >= 60 && displayData[i+2].load >= 60) {
        optimalBreaks.push({
          time: displayData[i+1].time,
          reason: 'Sustained moderate-high load'
        });
      }
    }
    
    return optimalBreaks.slice(0, 3); // Return top 3
  };

  const optimalBreaks = findOptimalBreaks();

  return (
    <div className="p-6 rounded-xl bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-indigo-500/20 to-purple-500/20">
            <Brain className="w-6 h-6 text-indigo-400" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">Cognitive Load Monitor</h3>
            <p className="text-sm text-gray-400 mt-1">Visualizes mental load to help AI suggest optimal breaks</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Clock className="w-4 h-4" />
          <span>{timeRange}</span>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Main Graph */}
        <div className="flex-1">
          <div className="relative h-64">
            {/* Load level indicators */}
            <div className="absolute inset-0 flex flex-col justify-between py-4">
              {[100, 75, 50, 25, 0].map((level) => (
                <div key={level} className="flex items-center">
                  <div className="w-8 text-xs text-gray-500 text-right pr-2">{level}%</div>
                  <div className="flex-1 border-t border-gray-800"></div>
                </div>
              ))}
            </div>
            
            {/* Load bars */}
            <div className="absolute inset-0 pl-8 pr-4 py-4">
              <div className="flex items-end h-full gap-1">
                {displayData.map((point, index) => (
                  <div
                    key={index}
                    className="relative flex-1 group"
                    onMouseEnter={() => setHoveredPoint(point)}
                    onMouseLeave={() => setHoveredPoint(null)}
                  >
                    <div
                      className={`w-full rounded-t-lg transition-all duration-300 hover:opacity-90 ${
                        hoveredPoint?.time === point.time 
                          ? 'ring-2 ring-white ring-offset-1 ring-offset-gray-900' 
                          : ''
                      }`}
                      style={{ 
                        height: `${point.load}%`,
                        background: `linear-gradient(to top, ${
                          point.load >= 80 ? '#ef4444' :
                          point.load >= 60 ? '#f97316' :
                          point.load >= 40 ? '#eab308' :
                          point.load >= 20 ? '#3b82f6' :
                          '#10b981'
                        }, ${point.load >= 80 ? '#f43f5e' :
                          point.load >= 60 ? '#fb923c' :
                          point.load >= 40 ? '#fbbf24' :
                          point.load >= 20 ? '#60a5fa' :
                          '#34d399'})`
                      }}
                    >
                      {/* Load value inside bar */}
                      <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 text-xs font-medium text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity">
                        {point.load}%
                      </div>
                      
                      {/* Time label */}
                      <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 text-xs text-gray-500">
                        {point.time}
                      </div>
                    </div>
                    
                    {/* Type indicator */}
                    <div className="absolute -top-10 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className={`p-1 rounded ${getTypeColor(point.type).split(' ')[0]}`}>
                        {getTypeIcon(point.type)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          {/* Legend */}
          <div className="flex items-center justify-between mt-12 text-xs">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-gradient-to-b from-red-500 to-rose-500"></div>
                <span className="text-gray-400">Very High (80-100%)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-gradient-to-b from-orange-500 to-amber-500"></div>
                <span className="text-gray-400">High (60-79%)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-gradient-to-b from-yellow-500 to-amber-400"></div>
                <span className="text-gray-400">Moderate (40-59%)</span>
              </div>
            </div>
            <div className="text-gray-500">Hover bars for details</div>
          </div>
        </div>

        {/* Insights Panel */}
        <div className="w-80 flex-shrink-0">
          <div className="p-4 rounded-xl bg-gray-800/50 border border-gray-700 mb-4">
            <h4 className="font-semibold text-white mb-4">Load Statistics</h4>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">Average Load</span>
                <div className="flex items-center gap-2">
                  <span className={`text-lg font-bold ${
                    stats.avgLoad >= 70 ? 'text-red-400' :
                    stats.avgLoad >= 50 ? 'text-yellow-400' :
                    'text-green-400'
                  }`}>
                    {stats.avgLoad}%
                  </span>
                  <div className={`text-xs px-2 py-1 rounded-full ${
                    stats.avgLoad >= 70 ? 'bg-red-500/20 text-red-400' :
                    stats.avgLoad >= 50 ? 'bg-yellow-500/20 text-yellow-400' :
                    'bg-green-500/20 text-green-400'
                  }`}>
                    {getLoadLabel(stats.avgLoad)}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">Peak Load</span>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-white">{stats.maxLoad}%</span>
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">High Load Sessions</span>
                <span className="text-lg font-bold text-white">{stats.highLoadPeriods}</span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">Total Focus Time</span>
                <span className="text-lg font-bold text-white">{Math.floor(stats.totalTime / 60)}h {stats.totalTime % 60}m</span>
              </div>
            </div>
          </div>
          
          {/* AI Recommendations */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-blue-900/30 to-purple-900/30 border border-blue-800/30">
            <h4 className="font-semibold text-white mb-3">AI Recommendations</h4>
            
            {optimalBreaks.length > 0 ? (
              <div className="space-y-3">
                <div className="text-sm text-blue-300">
                  Optimal break opportunities detected:
                </div>
                {optimalBreaks.map((breakPoint, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <Coffee className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="text-sm font-medium text-white">{breakPoint.time}</div>
                      <div className="text-xs text-gray-300">{breakPoint.reason}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-green-300">
                Good load management detected. Your current break pattern is effective.
              </div>
            )}
            
            <div className="mt-4 pt-3 border-t border-blue-800/30">
              <div className="text-xs text-blue-400">
                {stats.recoveryOpportunities > 0 
                  ? `${stats.recoveryOpportunities} effective recovery periods detected`
                  : 'Consider adding more recovery periods'}
              </div>
            </div>
          </div>
          
          {/* Load Type Distribution */}
          <div className="mt-4 p-4 rounded-xl bg-gray-800/50 border border-gray-700">
            <h4 className="font-semibold text-white mb-3">Activity Distribution</h4>
            <div className="space-y-2">
              {['deep-work', 'creative', 'meeting', 'work', 'break'].map((type) => {
                const count = displayData.filter(d => d.type === type).length;
                const percentage = (count / displayData.length) * 100;
                
                return (
                  <div key={type} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`p-1 rounded ${getTypeColor(type as LoadPoint['type']).split(' ')[0]}`}>
                        {getTypeIcon(type as LoadPoint['type'])}
                      </div>
                      <span className="text-sm text-gray-300 capitalize">{type.replace('-', ' ')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                        <div 
                          className={`h-full ${
                            type === 'deep-work' ? 'bg-purple-500' :
                            type === 'creative' ? 'bg-yellow-500' :
                            type === 'meeting' ? 'bg-blue-500' :
                            type === 'break' ? 'bg-green-500' :
                            'bg-gray-500'
                          }`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <span className="text-sm text-gray-400">{count}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}