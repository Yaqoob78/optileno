# Real-Time Productivity Scoring System

## Overview
The productivity scoring system calculates a comprehensive 0-100 score based on actual user activity across the Concierge platform. The system is designed to be motivating yet challenging, with intelligent difficulty curves that make high scores (95+) truly exceptional.

## Scoring Components

### 1. Base Usage (15% weight)
- **Purpose**: Reward users for simply engaging with the platform
- **Logic**: 
  - 1 hour of usage = 50 points (baseline)
  - 3+ hours of usage = 100 points
  - Linear scaling between 0-3 hours
- **Motivation**: Easy to achieve baseline score, encourages daily engagement

### 2. Task Completion (25% weight)
- **Purpose**: Measure actual work accomplished
- **Factors**:
  - Quantity: 20 points per task (max 5 tasks = 100)
  - Priority bonus: High priority tasks worth more
  - On-time completion bonus: Meeting deadlines adds extra points
- **Calculation**: 60% quantity + 30% priority + 10% on-time

### 3. Focus Quality (20% weight)
- **Purpose**: Reward deep work and concentration
- **Metrics**:
  - Duration of focus sessions
  - Number of deep work sessions
  - Quality indicators from FocusScore table
- **Target**: 2+ hours of deep work = 100 points

### 4. Habit Consistency (15% weight)
- **Purpose**: Encourage routine and consistency
- **Logic**: Completion rate of tracked habits
- **Neutral baseline**: 50 points if no habits tracked (doesn't penalize)

### 5. Planning Accuracy (15% weight)
- **Purpose**: Improve time estimation skills
- **Calculation**: Compares estimated vs actual time for tasks
- **Neutral baseline**: 70 points (doesn't penalize beginners)

### 6. Engagement Depth (10% weight)
- **Purpose**: Encourage exploration of platform features
- **Metric**: Diversity of features used
- **Target**: 5+ different features = 100 points

## Difficulty Curve

The system applies a progressive difficulty curve to make high scores meaningful:

```
0-90:   Linear (achievable with consistent effort)
90-95:  Slight compression (requires good performance)
95-100: Steep compression (requires exceptional performance)
```

### Score Benchmarks
- **50**: Basic daily usage (1 hour)
- **70**: Good productivity day
- **85**: Excellent productivity day
- **90**: Outstanding performance
- **95**: Exceptional (8+ hours focused work)
- **98-99**: Elite (10+ hours, perfect execution)
- **100**: Perfect day (extremely rare)

## Time-Based Calculations

### Daily Score
- **Calculation Window**: 12:00 AM - 11:59 PM
- **Update Time**: 9:00 PM (available until next day 11 AM)
- **Purpose**: Provides end-of-day summary

### Weekly Average
- **Period**: Last 7 days
- **Calculation**: Sum of daily scores / 7
- **Display**: Shows in "Weekly" view

### Monthly Average
- **Period**: Last 30 days
- **Calculation**: Sum of daily scores / 30
- **Display**: Shows in "Monthly" view

## Real-Time Updates

The system refreshes automatically:
- **Every 5 minutes**: During active use
- **On activity**: When tasks/habits are completed
- **On page load**: Fresh calculation

## API Endpoints

### Get Today's Score
```
GET /api/v1/analytics/productivity/score/today
```
Returns:
```json
{
  "score": 75.3,
  "date": "2026-01-29",
  "breakdown": {
    "base_usage": 60.0,
    "task_completion": 80.0,
    "focus_quality": 70.0,
    "habit_consistency": 85.0,
    "planning_accuracy": 75.0,
    "engagement_depth": 90.0
  },
  "grade": "B",
  "next_update": "09:00 PM"
}
```

### Get Weekly Average
```
GET /api/v1/analytics/productivity/score/weekly
```

### Get Monthly Average
```
GET /api/v1/analytics/productivity/score/monthly
```

## Frontend Integration

The Analytics page displays productivity scores in the top stat cards:
- **Daily View**: Shows today's score with grade
- **Weekly View**: Shows 7-day average
- **Monthly View**: Shows 30-day average

The score updates in real-time as users:
- Complete tasks
- Finish focus sessions
- Track habits
- Use different features

## Motivational Design

The system is designed to be:
1. **Accessible**: Easy to reach 50+ with basic usage
2. **Motivating**: Clear path to improvement
3. **Challenging**: High scores require genuine effort
4. **Fair**: Doesn't penalize beginners or casual users
5. **Transparent**: Detailed breakdown shows what to improve

## Future Enhancements

Potential improvements:
- Streak bonuses for consecutive high-scoring days
- Personalized targets based on user patterns
- Achievement badges for milestones
- Comparative analytics (vs. your own history)
- AI-powered recommendations for score improvement
