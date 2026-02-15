# Mood Tracker Logic

Last validated against runtime code on 2026-02-15.

## Endpoint Surface
Source: `backend/api/v1/endpoints/analytics.py`

- `GET /api/v1/analytics/mood/current`
- `POST /api/v1/analytics/mood/check-in`

## Core Calculation
Source: `backend/services/mood_service.py`

Mood uses component scores plus momentum:
```text
raw_score =
  chat_sentiment*0.35 +
  planner_engagement*0.30 +
  productivity_flow*0.25 +
  temporal_adjustment

final_score = clamp(raw_score + momentum_bonus, 0, 100)
```

Momentum bonus:
- based on recent task and habit completion events in last 2 hours
- capped at `+15`

## Component Details
1. Chat sentiment:
- uses recent analytics event metadata text and keyword scoring
- positive and negative keyword sets

2. Planner engagement:
- tasks completed today
- deep work sessions today
- weighted with baseline

3. Productivity flow:
- derived from planner engagement bucket (high/mid/low style mapping)

4. Temporal adjustment:
- hour-based adjustment
- includes reduced late-night penalty and mild day-part boosts/penalties

## Frustration Override
A frustration check can force category `FRUSTRATED` regardless of numeric band.

## Mood Categories
Standard categories are threshold-based bands from energetic to sad, with labels, emoji rotation, and hint messages.

## Connection to Burnout V2
Burnout v2 reads current mood category/label and maps it into the burnout mood modulation component:
- positive states lower burnout contribution
- negative states increase burnout contribution
- neutral/unknown uses midpoint contribution

## Planner and Chat Connectivity
Planner inputs:
- completed tasks
- deep work activity
- habit-related analytics events

Chat inputs:
- user text signals from analytics events and message metadata

## Notes
1. Mood tracker itself is available to both explorer and ultra.
2. Mood output is consumed by other analytics (burnout risk) in ultra path.
