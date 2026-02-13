// src/components/planner/PlannerDashboard.tsx
import React from 'react';
import { CheckCircle, Clock, Battery, Smile, Activity, Flame, TrendingUp, BarChart, Target, Zap, Brain } from 'lucide-react';
import '../../styles/components/planner/plannerDashboard.css';

interface PlannerDashboardProps {
  totalTasks?: number;
  completedTasks?: number;
  tasksOverdue?: number;
  tasksLeft?: number;
  totalHabits?: number;
  completedHabits?: number;
  deepWorkSessions?: number;
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
  deepWorkSessions = 0,
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
      label: "Deep Work",
      value: `${deepWorkSessions}`,
      icon: Brain,
      color: "info",
      description: "Sessions today"
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

      {/* Motivation Section */}
      <div className="motivation-section" style={{ marginTop: '1.5rem', padding: '1rem', background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
        <div className="flex items-center gap-3 mb-2">
          <Zap size={18} className="text-yellow-500 fill-yellow-500" />
          <h4 className="font-semibold text-main">Keep the momentum!</h4>
        </div>
        <p className="text-sm text-secondary leading-relaxed">
          "Small steps every day add up to big results. Focus on one task at a time."
        </p>
        <div className="flex items-center gap-2 mt-3 text-xs text-secondary opacity-80">
          <TrendingUp size={12} />
          <span>You have {deepWorkSessions} deep work sessions today!</span>
        </div>
      </div>
    </div>
  );
}// If you're using the PlannerDashboard in a parent component, wrap it like this:
<div className="planner-dashboard-container" style={{ width: '450px', flexShrink: 0 }}>
  <PlannerDashboard />
</div>