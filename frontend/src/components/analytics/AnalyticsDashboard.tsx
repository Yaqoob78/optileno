import React, { useState, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, Target, AlertCircle } from 'lucide-react';
import { socket } from '../../services/realtime/socket-client';

interface AnalyticsDatum {
  date: string;
  productivity: number;
  focus: number;
  wellness: number;
}

interface Forecast {
  metric: string;
  current: number;
  predicted: number;
  confidence: number;
  trend: 'up' | 'down' | 'stable';
}

interface AnalyticsDashboardProps {
  userId?: number;
}

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ userId }) => {
  const [data, setData] = useState<AnalyticsDatum[]>([]);
  const [forecasts, setForecasts] = useState<Forecast[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'quarter'>('week');

  useEffect(() => {
    fetchAnalytics();

    // Listen for analytics updates
    socket.on('analytics:updated', (data: any) => {
      setData((prev) => [...prev.slice(-6), data.analytics_data]);
    });

    socket.on('forecast:available', (data: any) => {
      setForecasts(data.forecasts || []);
    });

    return () => {
      socket.off('analytics:updated');
      socket.off('forecast:available');
    };
  }, [timeRange]);

  const fetchAnalytics = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/v1/analytics?timeRange=${timeRange}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('access_token')}`,
        },
      });
      const result = await response.json();
      setData(result.data || []);
      setForecasts(result.forecasts || []);
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getTrendIcon = (trend: string) => {
    if (trend === 'up') return '📈';
    if (trend === 'down') return '📉';
    return '➡️';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96 text-gray-500">
        Loading analytics...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Analytics</h2>
        <div className="flex gap-2">
          {['week', 'month', 'quarter'].map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range as any)}
              className={`px-4 py-2 rounded-md capitalize font-medium transition ${
                timeRange === range
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {/* Forecast Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {forecasts.map((forecast) => (
          <div
            key={forecast.metric}
            className="bg-white p-6 rounded-lg shadow border border-gray-200"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 capitalize">
                {forecast.metric}
              </h3>
              <span className="text-2xl">{getTrendIcon(forecast.trend)}</span>
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-600">Current</p>
                <p className="text-2xl font-bold text-gray-900">{forecast.current}</p>
              </div>

              <div>
                <p className="text-sm text-gray-600">Predicted (7 days)</p>
                <p className="text-2xl font-bold text-blue-600">{forecast.predicted}</p>
              </div>

              <div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Confidence</span>
                  <span className="font-medium text-gray-900">
                    {(forecast.confidence * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                  <div
                    className="bg-blue-600 h-2 rounded-full"
                    style={{ width: `${forecast.confidence * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Line Chart */}
        <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Trend Over Time
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="productivity"
                stroke="#3b82f6"
                name="Productivity"
              />
              <Line
                type="monotone"
                dataKey="focus"
                stroke="#10b981"
                name="Focus"
              />
              <Line
                type="monotone"
                dataKey="wellness"
                stroke="#f59e0b"
                name="Wellness"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Bar Chart */}
        <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Daily Scores
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.slice(-7)}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="productivity" fill="#3b82f6" name="Productivity" />
              <Bar dataKey="focus" fill="#10b981" name="Focus" />
              <Bar dataKey="wellness" fill="#f59e0b" name="Wellness" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Performance Tips */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <div className="flex items-start gap-4">
          <AlertCircle className="w-6 h-6 text-blue-600 flex-shrink-0 mt-1" />
          <div>
            <h3 className="font-semibold text-blue-900 mb-2">
              Performance Insights
            </h3>
            <ul className="space-y-2 text-sm text-blue-800">
              <li>• Your focus is trending up - keep the momentum!</li>
              <li>• Consider taking breaks to improve wellness scores</li>
              <li>• Best productivity hours: 9 AM - 12 PM</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
