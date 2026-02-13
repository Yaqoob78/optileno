// types/analytics.types.ts

// Core metric types
export interface DailyMetrics {
  date: string; // YYYY-MM-DD
  productivity: number; // 0-100
  focus: number; // 0-100
  energy: number; // 0-100
  stress: number; // 0-100
  satisfaction: number; // 0-100
  tasksCompleted: number;
  deepWorkHours: number;
  meetingHours: number;
  breakTime: number;
}

export interface TimeRange {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  granularity: 'hourly' | 'daily' | 'weekly' | 'monthly';
}

// Trend data types
export interface TrendData {
  period: 'daily' | 'weekly' | 'monthly';
  data: DailyMetrics[];
  summary: {
    avgProductivity: number;
    avgFocus: number;
    avgEnergy: number;
    avgStress: number;
    avgSatisfaction: number;
    trend: 'improving' | 'declining' | 'stable';
    comparison?: {
      previousPeriod: number;
      percentageChange: number;
    };
  };
}

// Insight types
export type InsightType = 'positive' | 'warning' | 'suggestion' | 'achievement' | 'pattern';

export interface Insight {
  id: string;
  type: InsightType;
  title: string;
  description: string;
  confidence: number; // 0-100
  timestamp: Date;
  impact: 'high' | 'medium' | 'low';
  category: string;
  metadata?: {
    metricsAffected?: string[];
    timeframe?: string;
    recommendations?: string[];
    evidence?: Array<{
      metric: string;
      value: number;
      trend: 'up' | 'down' | 'stable';
    }>;
  };
}

// Pattern types
export interface Pattern {
  id: string;
  name: string;
  frequency: string;
  impact: number; // 0-100
  category: 'productivity' | 'wellness' | 'focus' | 'time' | 'behavior';
  description: string;
  trend: 'increasing' | 'decreasing' | 'stable';
  confidence: number;
  metadata?: {
    triggers?: string[];
    timeOfDay?: string[];
    daysOfWeek?: string[];
    correlationWith?: string[];
  };
}

// AI Analysis types
export interface AIAnalysis {
  analysisId: string;
  timestamp: Date;
  overallAssessment: {
    score: number; // 0-100
    status: 'excellent' | 'good' | 'fair' | 'needs_improvement';
    summary: string;
  };
  detailedInsights: Array<{
    category: string;
    strength: number; // 0-100
    weakness: number; // 0-100
    insights: string[];
    evidence: Array<{
      metric: string;
      value: number;
      trend: 'up' | 'down' | 'stable';
    }>;
  }>;
  predictions: Array<{
    metric: string;
    currentValue: number;
    predictedValue: number;
    confidence: number;
    timeframe: string;
    explanation: string;
  }>;
  actionableRecommendations: Array<{
    id: string;
    category: string;
    action: string;
    impact: 'high' | 'medium' | 'low';
    effort: 'low' | 'medium' | 'high';
    timeframe: 'immediate' | 'short_term' | 'long_term';
    metricsAffected: string[];
  }>;
  risks: Array<{
    type: 'burnout' | 'distraction' | 'inefficiency' | 'imbalance';
    probability: number; // 0-100
    impact: number; // 0-100
    warningSigns: string[];
    mitigation: string[];
  }>;
}

// Focus analysis types
export interface FocusSession {
  id: string;
  startTime: Date;
  endTime: Date;
  duration: number; // minutes
  focusScore: number; // 0-100
  interruptions: number;
  taskIds: string[];
  environment?: string;
  metadata?: {
    tools?: string[];
    music?: string;
    energyLevel?: 'low' | 'medium' | 'high';
  };
}

// Stress analysis types
export interface StressPattern {
  id: string;
  name: string;
  frequency: string;
  trigger: string;
  severity: 'low' | 'medium' | 'high';
  impact: number; // 0-100
  trend: 'increasing' | 'decreasing' | 'stable';
  copingMechanisms?: string[];
}

// Habit analysis types
export interface HabitAnalysis {
  id: string;
  name: string;
  streak: number;
  completionRate: number; // 0-100
  impact: {
    productivity: number;
    focus: number;
    energy: number;
    stress: number;
  };
  consistency: number; // 0-100
  bestTime?: string;
  triggers?: string[];
}

// Comparative analysis types
export interface ComparativeAnalysis {
  comparisons: Array<{
    metric: string;
    value1: number;
    value2: number;
    difference: number;
    percentageChange: number;
    significance: 'high' | 'medium' | 'low';
  }>;
  insights: string[];
  factors: Array<{
    factor: string;
    impact: number;
    explanation: string;
  }>;
}

// Dashboard types
export interface AnalyticsDashboard {
  overview: {
    productivityScore: number;
    focusScore: number;
    energyLevel: number;
    stressLevel: number;
    overallRating: number;
    trend: 'improving' | 'declining' | 'stable';
  };
  metrics: {
    daily: DailyMetrics[];
    weekly: TrendData;
    monthly: TrendData;
  };
  insights: Insight[];
  patterns: Pattern[];
  summary: {
    peakHours: string[];
    mostProductiveDay: string;
    averageDeepWorkHours: number;
    meetingEfficiency: number;
    breakEffectiveness: number;
  };
}

// Export types
export type AnalyticsExportFormat = 'csv' | 'json' | 'pdf';

export interface AnalyticsExport {
  url: string;
  expiresAt: Date;
  size: number;
  format: AnalyticsExportFormat;
}

// Quick summary types
export interface QuickSummary {
  today: {
    productivity: number;
    focus: number;
    tasksCompleted: number;
    deepWorkHours: number;
  };
  week: {
    productivity: number;
    focus: number;
    tasksCompleted: number;
    deepWorkHours: number;
  };
  trends: {
    productivity: 'up' | 'down' | 'stable';
    focus: 'up' | 'down' | 'stable';
    energy: 'up' | 'down' | 'stable';
  };
  alerts: Array<{
    type: 'warning' | 'suggestion' | 'achievement';
    message: string;
    priority: 'high' | 'medium' | 'low';
  }>;
}