# Real-Time Focus Score System

## Overview
The Focus Score system calculates a comprehensive 0-100 score based on deep work sessions, focus heatmap data, and distraction patterns. It's fully integrated with the Focus Heatmap component and provides real-time insights into concentration quality.

## Integration with Focus Heatmap

The Focus Score system is **directly connected** to the Focus Heatmap:
- Uses `FocusScore` table data for quality metrics
- Analyzes deep work sessions from `Plan` table
- Tracks distraction patterns from `AnalyticsEvent` table
- Provides statistical analysis of focus patterns

## Scoring Components

### 1. Session Duration (30% weight)
- **Purpose**: Reward sustained deep work
- **Logic**:
  - 0 minutes = 0 points
  - 30 minutes = 30 points
  - 60 minutes = 50 points
  - 120 minutes = 75 points
  - 180+ minutes = 100 points
- **Data Source**: Deep work plans duration

### 2. Session Quality (25% weight)
- **Purpose**: Measure concentration depth
- **Calculation**:
  - 40% from Focus Heatmap average score
  - 60% from session metadata (quality, interruptions)
- **Data Source**: FocusScore table + Plan metadata

### 3. Consistency (20% weight)
- **Purpose**: Encourage regular focus patterns
- **Metrics**:
  - Distribution of sessions across the day
  - Number of unique hours with focus work
  - Session count bonus
- **Target**: Multiple sessions spread throughout the day

### 4. Peak Performance (15% weight)
- **Purpose**: Reward exceptional focus states
- **Criteria**:
  - Peak session = 60+ minutes with 80%+ quality
  - 3+ peak sessions = 100 points
  - 2 peak sessions = 80 points
  - 1 peak session = 50 points
- **Data Source**: Deep work plans with quality metadata

### 5. Distraction Resistance (10% weight)
- **Purpose**: Penalize context switching
- **Tracking**:
  - Task switches during focus time
  - Interruption events
  - Context changes
- **Scoring**:
  - 0 distractions = 100 points
  - 1-2 distractions = 85 points
  - 3-5 distractions = 70 points
  - 6-10 distractions = 50 points
  - 10+ distractions = heavy penalty

## Quality Curve

Progressive difficulty curve for high scores:

```
0-85:   Linear (achievable with consistent focus)
85-92:  Slight compression (requires quality work)
92-100: Steep compression (requires exceptional focus)
```

### Score Benchmarks
- **0-20**: Unfocused (minimal deep work)
- **20-40**: Scattered (some focus attempts)
- **40-60**: Moderate (decent focus sessions)
- **60-75**: Focused (good deep work)
- **75-90**: Deep Work (excellent concentration)
- **90-100**: Peak Focus (exceptional performance)

## Time-Based Calculations

### Daily Score
- **Calculation**: Based on today's focus sessions
- **Includes**:
  - Total deep work minutes
  - Heatmap average for the day
  - Session quality and distribution
  - Distraction count

### Weekly Average
- **Period**: Last 7 days
- **Returns**:
  - Average score across 7 days
  - Average daily focus minutes
  - Trend analysis

### Monthly Average
- **Period**: Last 30 days
- **Returns**:
  - Average score across 30 days
  - Average daily focus minutes
  - Long-term patterns

## Connection to Intelligence Nexus

The Focus Score **automatically updates** when you change time range:

**Daily View:**
- Shows today's focus score
- Displays total minutes of deep work
- Shows current status (Peak Focus, Deep Work, etc.)

**Weekly View:**
- Shows 7-day average score
- Displays average daily focus minutes
- Trend indicator

**Monthly View:**
- Shows 30-day average score
- Displays average daily focus minutes
- Long-term performance

## API Endpoints

### Get Today's Focus Score
```
GET /api/v1/analytics/focus/score/today
```
Returns:
```json
{
  "score": 78.5,
  "date": "2026-01-29",
  "total_minutes": 145,
  "heatmap_average": 82.0,
  "breakdown": {
    "session_duration": 75.0,
    "session_quality": 82.0,
    "consistency": 70.0,
    "peak_performance": 80.0,
    "distraction_resistance": 85.0
  },
  "grade": "B+",
  "status": "Deep Work"
}
```

### Get Weekly Average
```
GET /api/v1/analytics/focus/score/weekly
```
Returns:
```json
{
  "average_score": 72.3,
  "average_minutes": 120,
  "period": "weekly",
  "days": 7
}
```

### Get Monthly Average
```
GET /api/v1/analytics/focus/score/monthly
```

## Frontend Integration

### Analytics Page Display
The Focus Score appears in the top stat cards:
- **Label**: "Focus Score" (not "Focus Time")
- **Value**: Actual score (0-100)
- **Change**: Status (Peak Focus, Deep Work, etc.) or total minutes
- **Subtitle**: Grade (A+, B, etc.)
- **Dynamic Colors**: Changes based on score with glows

### Color Coding 🎨

```
Score 0:      Extreme red with strong glow
Score 1-5:    Very strong red with glow
Score 6-15:   Strong red with medium glow
Score 16-30:  Medium reddish
Score 31-50:  Normal white/text color
Score 51-70:  Light cyan (focus theme)
Score 71-85:  Cyan with subtle glow
Score 86-95:  Purple with glow
Score 96-100: Gold with strong glow ✨
```

## How It Calculates

**Real-Time Process:**
1. Fetches deep work sessions from database
2. Gets heatmap score from FocusScore table
3. Analyzes session distribution and quality
4. Counts distraction events
5. Applies weighted formula
6. Applies quality curve
7. Returns score with breakdown

**Example Calculation:**
```
User has:
- 2 hours of deep work (duration: 75 points)
- Heatmap average: 80 (quality: 80 points)
- 3 sessions spread across day (consistency: 70 points)
- 1 peak session (peak: 50 points)
- 2 distractions (resistance: 85 points)

Weighted Score:
= (75 × 0.30) + (80 × 0.25) + (70 × 0.20) + (50 × 0.15) + (85 × 0.10)
= 22.5 + 20 + 14 + 7.5 + 8.5
= 72.5

After quality curve: ~72 (B-)
Status: "Focused"
```

## Data Sources

1. **FocusScore Table**: Heatmap quality data
2. **Plan Table**: Deep work sessions (plan_type='deep_work')
3. **AnalyticsEvent Table**: Distraction tracking
4. **Task Table**: Context for focus work

## Real-Time Updates

- **Every 5 minutes**: Auto-refresh
- **On session completion**: Updates when deep work ends
- **On heatmap update**: Syncs with heatmap changes
- **Time range change**: Switches between daily/weekly/monthly

## Motivational Design

The system is designed to:
1. ✅ **Start from 0**: No artificial baselines
2. ✅ **Reward quality**: Not just quantity of time
3. ✅ **Encourage consistency**: Multiple sessions better than one
4. ✅ **Penalize distractions**: Maintain focus integrity
5. ✅ **Visual feedback**: Dynamic colors show progress
6. ✅ **Clear goals**: Status labels guide improvement

## Improvement Tips

To increase your Focus Score:
- **30+ points**: Start any deep work session
- **50+ points**: Complete 1 hour of focused work
- **70+ points**: Multiple sessions + low distractions
- **85+ points**: 2+ hours + high quality + consistency
- **95+ points**: 3+ hours + peak sessions + zero distractions

## Future Enhancements

Potential improvements:
- Focus streak tracking
- Optimal time-of-day analysis
- Distraction pattern identification
- Personalized focus recommendations
- Integration with Pomodoro technique
- Focus session templates
