# Productivity Score (Analytics V2)

Last validated against runtime code on 2026-02-15.

## Endpoint Surface
Source: `backend/api/v1/endpoints/analytics.py`

- `GET /api/v1/analytics/productivity/score/today`
- `GET /api/v1/analytics/productivity/score/weekly`
- `GET /api/v1/analytics/productivity/score/monthly`

When `ANALYTICS_V2_ENABLED` is true, all map to `analytics_v2_service.productivity_score(...)`.

## Time Range Window
Source: `backend/services/analytics_v2_service.py`

Window resolver uses user timezone from `user.preferences.timezone` (fallback `UTC`).
- daily: current local day
- weekly: current day and previous 6 days
- monthly: current day and previous 29 days

Returned metadata always includes:
- `time_range`
- `period_start`
- `period_end`
- `score_version` (`v2`)
- `generated_at`
- `source`
- `confidence`

## Inputs Used
`_usage_inputs(...)` gathers:
- tasks created/completed
- goal-linked completed tasks
- deep work minutes/sessions
- habits total/completed
- chat requests
- active days
- pending tasks

Goal contribution is read from `_goal_progress_summary(...).score`.

## Exact Formula
Source literal (v2):

```text
task_component = completed/created*100 (or 85 if created=0 and completed>0)
habit_component = habits_completed/habits_total*100
deep_work_component = deep_work_minutes/120*100
execution = task*0.45 + habit*0.25 + deep_work*0.30

goal_progress = goal_progress_summary.score
active_minutes = deep_work_minutes + tasks_completed*12 + chat_requests*2
engagement = (min(chat,50)/50)*40 + (min(active_minutes,180)/180)*60

bonus = +2 if chat>10
bonus += +2 if active_minutes>=50
bonus += +4 if chat>40 and active_minutes>=100
bonus capped at +6

score = clamp(execution*0.70 + goal_progress*0.25 + engagement*0.05 + bonus, 0, 100)
```

## No-Data Behavior
If there is no meaningful activity in the window (tasks, deep work, habits, chat all absent):
- `score: null`
- `reason: "NO_DATA"`
- still returns breakdown and metadata

## Planner and Chat Connectivity
Planner-related signals:
- tasks and goal-linked tasks
- deep work sessions
- habits completion in plan schedule

Chat-related signals:
- user message count contributes to `chat_requests`
- chat count also contributes to bonus and engagement block

## Notes
1. This score is deterministic in backend v2.
2. Frontend displays and time-range selection do not override backend math.
3. Weekly/monthly endpoints add helper fields (`average`, `period`, `days`) around the same v2 score output.
