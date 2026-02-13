# AI-Powered Burnout Risk System

## Overview
The Burnout Risk system uses **AI-powered sentiment analysis** to predict burnout risk based on work patterns, chat conversations, and activity levels. It provides real-time monitoring with automatic updates from chat interactions.

## 🤖 AI Integration

### Chat Sentiment Analysis
The system **automatically analyzes** your conversations with Concierge AI to detect burnout indicators:

**Extreme Risk Keywords** (20 points each):
- "exhausted", "burned out", "burnout"
- "can't take it", "overwhelmed"
- "breaking down", "too much"

**High Risk Keywords** (10 points each):
- "tired", "stressed", "anxious"
- "pressure", "struggling", "difficult"
- "hard time", "overworked"

**Moderate Risk Keywords** (5 points each):
- "busy", "hectic", "rushed"
- "behind", "deadline", "worried"

**Recovery Keywords** (-10 points each):
- "rest", "break", "relax"
- "sleep", "vacation", "time off", "recharge"

### AI Full Access
The AI has **full access** to update burnout risk automatically:
- Monitors every chat message in real-time
- Detects stress patterns in your language
- Can override other metrics if severe stress detected
- Provides personalized insights and recommendations

## Risk Calculation Components

### 1. Time-Based Risk (35% weight)

**Logic:**
```
< 1 hour:     0% risk (safe zone)
1-5 hours:    Gradual increase (6.25% per hour)
5+ hours:     Rapid increase (1% per 4 minutes)
10+ hours:    Very high risk
```

**Example:**
- 0.5 hours → 0% risk
- 3 hours → 12.5% risk
- 5 hours → 25% risk
- 6 hours → 40% risk (25 + 15)
- 8 hours → 55% risk (25 + 30)
- 10 hours → 85% risk (25 + 60)

### 2. Workload Risk (25% weight)

**Task Completion:**
- Each completed task = +1% risk
- Caps at 50% from tasks alone

**Example:**
- 5 tasks → 5% risk
- 20 tasks → 20% risk
- 50+ tasks → 50% risk (capped)

### 3. Chat Sentiment Risk (30% weight) 🤖

**AI Analysis:**
- Scans last 50 user messages
- Counts burnout keywords
- Calculates sentiment score
- **Can push risk to 100%** if severe stress detected

**Example:**
- User says "I'm exhausted and overwhelmed" → +30 risk
- User says "feeling stressed and anxious" → +20 risk
- User says "need a break to rest" → -10 risk

### 4. Deep Work Intensity (10% weight)

**Deep Work Blocks:**
- Each completed deep work session = +15% risk
- Caps at 60% from deep work

**Logic:**
- Intense focus sessions can lead to burnout
- Multiple deep work blocks increase risk
- Balanced with recovery time

**Example:**
- 1 deep work block → 15% risk
- 2 blocks → 30% risk
- 4+ blocks → 60% risk (capped)

### 5. Recovery Bonus (reduces risk)

**Recovery Indicators:**
- Each break/rest plan → -5% risk
- Recovery keywords in chat → -3% risk per message
- Caps at -30% total reduction

**Example:**
- 3 scheduled breaks → -15% risk
- 2 messages about rest → -6% risk
- Total recovery bonus → -21% risk

## Time Range Behavior

### Daily View
- Shows today's real-time burnout risk
- Updates every 3 minutes
- AI monitors chat continuously
- Displays AI insights and recommendations

### Weekly View
- Shows 7-day average risk
- Helps identify burnout patterns
- Trend analysis

### Monthly View
- **Always shows 0%**
- Displays "N/A" for level
- Note: "Burnout risk is assessed daily/weekly only"
- **Reason**: Burnout is a short-term phenomenon, not monthly

## Risk Levels

```
0-20%:    Low Risk       ✅ "Healthy work pattern"
20-40%:   Moderate Risk  ⚠️  "Monitor your energy"
40-60%:   Elevated Risk  🔶 "Consider taking breaks"
60-80%:   High Risk      🔴 "Rest is recommended"
80-100%:  Critical Risk  🚨 "Immediate rest needed"
```

## AI Insights

The system provides **automatic AI insights**:

**Low Risk (< 20%):**
- "✅ Healthy work pattern detected"

**Moderate Risk (20-40%):**
- "⚠️ Moderate activity - monitor your energy"

**Elevated Risk (40-60%):**
- "🔶 Elevated risk - consider taking breaks"

**High Risk (60-80%):**
- "🔴 High burnout risk - rest is recommended"

**Critical Risk (80-100%):**
- "🚨 Critical burnout risk - immediate rest needed"

**Sentiment-Specific:**
- "🤖 AI detected stress indicators in your messages"
- "💬 Your language suggests increased pressure"

## Recommendations

Based on risk level:

**Low (< 20%):**
- "Keep up the balanced pace"

**Moderate (20-40%):**
- "Consider scheduling short breaks"

**Elevated (40-60%):**
- "Take a 15-minute break soon"

**High (60-80%):**
- "Stop and rest - burnout prevention needed"

**Critical (80-100%):**
- "Immediate rest required - step away from work"

## API Endpoints

### Get Today's Burnout Risk
```
GET /api/v1/analytics/burnout/risk/today
```
Returns:
```json
{
  "risk": 45.3,
  "date": "2026-01-29",
  "level": "Elevated",
  "breakdown": {
    "time_based": 25.0,
    "workload": 12.0,
    "chat_sentiment": 30.0,
    "deep_work_intensity": 15.0,
    "recovery_bonus": 10.0
  },
  "ai_insights": [
    "🔶 Elevated risk - consider taking breaks",
    "🤖 AI detected stress indicators in your messages"
  ],
  "recommendation": "Take a 15-minute break soon"
}
```

### Get Weekly Average
```
GET /api/v1/analytics/burnout/risk/weekly
```

### Get Monthly Data (Always 0)
```
GET /api/v1/analytics/burnout/risk/monthly
```

## Frontend Display

### Stat Card
- **Label**: "Burnout Risk"
- **Value**: Percentage (0-100%)
- **Change**: Risk level (Low, Moderate, High, etc.)
- **Subtitle**: First AI insight
- **Monthly**: Shows "0%" and "N/A"

### Color Coding 🎨

**Inverted colors** (low risk = green, high risk = red):
```
0%:       Green with glow (excellent)
1-20%:    Light green (low risk)
21-40%:   Normal white (moderate)
41-60%:   Orange/yellow (elevated)
61-80%:   Red with glow (high risk)
81-100%:  Dark red with strong glow (critical)
```

## Real-Time Updates

**Update Frequency:**
- Every 3 minutes (more frequent than other metrics)
- Immediate update after chat messages
- Continuous AI monitoring

**Triggers:**
- New chat message sent
- Task completed
- Deep work session finished
- Break scheduled
- Time threshold crossed

## Example Scenarios

### Scenario 1: Healthy Day
```
Activity:
- 2 hours on platform
- 3 tasks completed
- Chat: "feeling good today"
- 1 deep work session
- 2 scheduled breaks

Calculation:
Time:      12.5% (2 hours)
Workload:  3%    (3 tasks)
Sentiment: 0%    (positive chat)
Deep Work: 15%   (1 session)
Recovery:  -10%  (2 breaks)
─────────────────────────
Total: 20.5% → "Low Risk" ✅
```

### Scenario 2: Burnout Warning
```
Activity:
- 7 hours on platform
- 15 tasks completed
- Chat: "exhausted and overwhelmed"
- 3 deep work sessions
- No breaks

Calculation:
Time:      55%  (7 hours, rapid increase)
Workload:  15%  (15 tasks)
Sentiment: 50%  (AI detected extreme stress)
Deep Work: 45%  (3 sessions)
Recovery:  0%   (no breaks)
─────────────────────────
Total: 82.5% → "Critical Risk" 🚨
AI Override: "Immediate rest required"
```

### Scenario 3: Monthly View
```
User selects "Monthly" time range:
- Value: 0%
- Change: N/A
- Subtitle: "Monthly N/A"
- Color: Green (0 risk)
- Note: Burnout is short-term only
```

## How AI Updates Automatically

1. **User sends chat message** to Concierge AI
2. **Message saved** to ChatMessage table
3. **Burnout service** scans message for keywords
4. **Sentiment analysis** calculates risk contribution
5. **Risk score updates** in real-time
6. **Frontend refreshes** every 3 minutes
7. **AI insights generated** based on patterns
8. **Recommendations provided** automatically

## Integration with Chat

The system has **full access** to chat data:
- Reads all user messages (not AI responses)
- Analyzes last 50 messages for patterns
- Detects stress language automatically
- Can override other metrics if severe stress found
- Provides context-aware recommendations

## Future Enhancements

Potential improvements:
- Machine learning for personalized keyword detection
- Burnout prediction (forecast risk 24 hours ahead)
- Integration with calendar for meeting overload
- Sleep quality correlation
- Recovery plan suggestions
- Stress pattern visualization
