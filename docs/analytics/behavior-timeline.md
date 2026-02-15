# Behavior Timeline Logic

Last validated against runtime code on 2026-02-15.

## Endpoint Surface
Source: `backend/api/v1/endpoints/analytics.py`

- `GET /api/v1/analytics/behavior-timeline?days=<7..365>`

## Service Strategy
Source: `backend/services/behavior_timeline_service.py`

Performance shape:
- batch-fetch model (5 query groups)
- process daily states in memory
- avoids per-day query loops

## Data Dependencies
Batch sources:
1. Tasks by date
- completed count
- high-priority completed
- due totals and misses

2. Focus score by date
- score and minutes

3. Analytics activity events by date
- event volume

4. Stress logs by date
- average stress
- max stress
- entry count

5. Chat messages by date
- user message count

## Daily Computed States
For each day, service derives:
- `engagement`: active/partial/absent
- `effort`: high/medium/low/none
- `emotion`: flow/calm/strained/frustrated/drained
- `resistance`: list of micro-signals
- `recovery`: boolean comeback indicator
- `intervention`: prioritized micro-action suggestion

### Engagement logic
Weighted activity score from tasks, chat, and events.

### Effort logic
Combined signal from focus score, high-priority completions, and total completions.

### Emotion logic
Health-first ordering:
- high stress can force drained/frustrated
- task miss patterns can set strained
- high effort plus low stress (or high output without stress logs) can set flow

### Resistance logic
Detects avoidance/skipped-all patterns from due vs missed behavior.

### Recovery logic
True when previous day was absent and current day is active/partial.

### Intervention logic
Priority order:
1. health
2. emotional support
3. behavioral nudge
4. reinforcement

## Summary Outputs
Returned summary includes:
- active days
- absent days
- engagement rate
- longest streak
- current streak
- flow days
- intervention count
- dominant pattern label

Dominant pattern is inferred from recent 7-day state patterns.

## Planner and Chat Connectivity
Planner/task impact:
- completion state
- missed due tasks
- high-priority completion

Chat impact:
- message count contributes to engagement state

Focus and stress impact:
- focus score contributes to effort
- stress logs strongly shape emotion state
