// src/components/planner/PlannerDashboard.tsx
import React from 'react';
import { CheckCircle, Clock, Battery, Smile, Activity, Flame, TrendingUp, BarChart, Target, Zap, Brain } from 'lucide-react';
import '../../styles/components/planner/Plannerdashboard.css';

interface PlannerDashboardProps {
  totalTasks?: number;
  completedTasks?: number;
  tasksOverdue?: number;
  tasksLeft?: number;
  totalHabits?: number;
  completedHabits?: number;
  continuousHabits?: number;
  totalGoals?: number;
}

export default function PlannerDashboard({
  totalTasks = 0,
  completedTasks = 0,
  tasksOverdue = 0,
  tasksLeft = 0,
  totalHabits = 0,
  completedHabits = 0,
  continuousHabits = 0,
  totalGoals = 0
}: PlannerDashboardProps) {

  // Calculate progress percentage
  const taskProgress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Stats data
  const stats = [
    {
      label: "Tasks Done",
      value: `${completedTasks}/${totalTasks}`,
      icon: CheckCircle,
      color: "success",
      progress: taskProgress,
      description: "Completion rate"
    },
    {
      label: "Pending",
      value: `${tasksLeft}`,
      icon: Clock,
      color: "warning",
      description: "Tasks remaining"
    },
    {
      label: "Overdue",
      value: `${tasksOverdue}`,
      icon: Activity,
      color: tasksOverdue > 0 ? "danger" : "success",
      description: "Needs attention"
    },
    {
      label: "Habits",
      value: `${completedHabits}/${totalHabits}`,
      icon: Flame,
      color: "purple",
      description: "Daily routine"
    },
    {
      label: "Goals",
      value: `${totalGoals}`,
      icon: Target,
      color: "accent",
      description: "Active targets"
    },
  ];

  return (
    <div className="planner-dashboard">
      {/* Header */}
      <div className="dashboard-header">
        <div className="header-title">
          <Target size={20} />
          <div>
            <h3>Daily Overview</h3>
            <p className="header-subtitle">Your productivity at a glance</p>
          </div>
        </div>
      </div>

      {/* Stats Grid - 6 main metrics */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
        {stats.map((stat: any, index) => {
          const Icon = stat.icon;
          return (
            <div key={index} className={`stat-card stat-${stat.color}`}>
              <div className="stat-icon">
                <Icon size={16} />
              </div>
              <div className="stat-content">
                <div className="stat-value">{stat.value}</div>
                <div className="stat-label">{stat.label}</div>
                {stat.showProgress && (
                  <div className="stat-progress">
                    <div className="progress-bar">
                      <div
                        className="progress-fill"
                        style={{ width: `${stat.progress}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Header and Stats are above */}
    </div>
  );
}
