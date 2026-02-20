import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, Target, AlertCircle, MessageSquare } from 'lucide-react';
import { socket } from '../../services/realtime/socket-client';
import { api } from '../../services/api/client';
import { useChatStore } from '../../stores/chat.store';

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
  const { addMessage, createConversation, setActiveConversation } = useChatStore();
  const navigate = useNavigate();

  useEffect(() => {
    fetchAnalytics();

    // Listen for analytics updates
    const onAnalyticsUpdate = (data: any) => {
      setData((prev) => [...prev.slice(-6), data.analytics_data]);
    };
    socket.on('analytics:update', onAnalyticsUpdate);

    const onForecast = (data: any) => {
      setForecasts(data.forecasts || []);
    };
    socket.on('forecast:available', onForecast);

    return () => {
      socket.off('analytics:update', onAnalyticsUpdate);
      socket.off('forecast:available', onForecast);
    };
  }, [timeRange]);

  const fetchAnalytics = async () => {
    try {
      setIsLoading(true);
      const mappedRange = timeRange === 'week' ? 'weekly' : timeRange === 'month' ? 'monthly' : 'yearly';
      const response = await api.get<any>(`/analytics/historical/${mappedRange}`);
      if (response.success && response.data) {
        setData(response.data.data || response.data.focus_scores || []);
        setForecasts(response.data.forecasts || []);
      } else {
        setData([]);
        setForecasts([]);
      }
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

  const handleAskLeno = () => {
    const latest = data.length > 0 ? data[data.length - 1] : null;
    let context = 'my recent performance';
    if (latest) {
      context = `my productivity at ${latest.productivity ?? 0}% and focus at ${latest.focus ?? 0}%`;
    }

    // Create new conversation specialized for analysis
    const conversation = createConversation(`Analytics Review`, "analyst");
    setActiveConversation(conversation.id);

    // Initial user message to kick it off
    addMessage({
      role: 'user',
      content: `I'm looking at my analytics dashboard. Can we talk about ${context}?`
    });

    // Navigate to chat
    navigate('/chat');
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
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-gray-900">Analytics</h2>
        <div className="flex flex-col sm:flex-row gap-4 items-center w-full md:w-auto">
          <button
            onClick={handleAskLeno}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md font-medium hover:bg-indigo-700 transition w-full sm:w-auto min-h-[44px]"
          >
            <MessageSquare size={16} />
            Ask Leno
          </button>
          <div className="flex gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
            {['week', 'month', 'quarter'].map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range as any)}
                className={`px-4 py-2 rounded-md capitalize font-medium transition ${timeRange === range
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
              >
                {range}
              </button>
            ))}
          </div>
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
          <div className="overflow-x-auto pb-2">
            <div className="min-w-[450px]">
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
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
          </div>
        </div>

        {/* Bar Chart */}
        <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Daily Scores
          </h3>
          <div className="overflow-x-auto pb-2">
            <div className="min-w-[450px]">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.slice(-7)}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="productivity" fill="#3b82f6" name="Productivity" />
                  <Bar dataKey="focus" fill="#10b981" name="Focus" />
                  <Bar dataKey="wellness" fill="#f59e0b" name="Wellness" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
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
