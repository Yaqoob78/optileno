import React from 'react';
import { Calendar, TrendingUp, Target, Clock } from 'lucide-react';
import '../../styles/components/dashboard/MonthlyOverview.css';

interface OverviewItem {
  id: number;
  label: string;
  value: string;
  icon: React.ReactNode;
  description: string;
}

export default function MonthlyOverview() {
  const overviewItems: OverviewItem[] = [
    {
      id: 1,
      label: 'Focus Hours',
      value: '42h',
      icon: <Clock size={20} />,
      description: 'Productive time this month'
    },
    {
      id: 2,
      label: 'Goals Progress',
      value: '78%',
      icon: <Target size={20} />,
      description: 'Monthly targets achieved'
    },
    {
      id: 3,
      label: 'Consistency',
      value: '21 days',
      icon: <Calendar size={20} />,
      description: 'Active planning streak'
    },
    {
      id: 4,
      label: 'Trend',
      value: '+12%',
      icon: <TrendingUp size={20} />,
      description: 'Improved from last month'
    }
  ];

  return (
    <div className="monthly-overview">
      <div className="section-header">
        <div className="section-title">
          <Calendar size={20} />
          <h2>Monthly Overview</h2>
        </div>
        <div className="section-subtitle">
          A high-level view of your monthly progress
        </div>
      </div>
      
      <div className="overview-grid">
        {overviewItems.map((item) => (
          <div key={item.id} className="overview-card">
            <div className="card-icon">
              {item.icon}
            </div>
            <div className="card-content">
              <div className="card-value">{item.value}</div>
              <div className="card-label">{item.label}</div>
              <div className="card-description">{item.description}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}