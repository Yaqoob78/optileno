# Goal Progress Deep Dive (Backend V2 and Frontend Engine)

Last validated against runtime code on 2026-02-15.

This is the deepest analytics component document because goal progress is used by multiple score systems and currently has both backend and frontend computation paths.

## 1) Architecture Overview
Backend path exists:
- endpoint: `GET /api/v1/analytics/goals/progress`
- service: `analytics_v2_service.goal_progress(...)`
- model: `_goal_progress_summary(...)`

Frontend analytics card path currently used in UI:
- component: `GoalProgress` -> `GoalAnalyticsDashboard`
- engine: `frontend/src/utils/goalProbabilityEngine.ts`
- data sources: planner store goals/tasks/habits + analytics events + deep work count

## 2) Backend Goal Probability Model (V2)
Source: `backend/services/analytics_v2_service.py`

For each goal:
1. Read `goal.current_progress` as current progress percent.
2. Compute expected progress from `created_at` to `target_date` timeline.
3. Compute pace delta:
```text
pace_delta = current_progress - expected_progress
```
4. Count linked tasks in selected time window:
- `linked_tasks_created`
- `linked_tasks_completed`
5. Compute consistency:
- `linked_completed/linked_created*100` when created > 0
- `80` when created == 0 and completed > 0

Per-goal completion probability:
```text
completion_probability =
  progress*0.50 +
  clamp(50 + pace_delta*1.2)*0.35 +
  consistency*0.15
```

Band mapping:
- `<20`: `very_low`
- `<40`: `low`
- `<60`: `mid`
- `<80`: `high`
- `>=80`: `very_high`

Overall score:
- arithmetic average of per-goal completion probability values
- same band mapping for overall band

Response includes goal-level entries with:
- `progress`
- `expected_progress`
- `pace_delta`
- `completion_probability`
- `probability_band`
- linked task counts
- `target_date`

## 3) Frontend Goal Probability Engine (Current Card Path)
Source: `frontend/src/utils/goalProbabilityEngine.ts`

Selected goals:
- filters active goals (`current_progress < 100`)
- sorts by nearest deadline
- takes top 3 goals

Primary local fallback score:
```text
rawProbability =
  taskScore*0.40 +
  habitScore*0.20 +
  deepWorkScore*0.15 +
  paceScore*0.15 +
  momentumScore*0.10
```

If no activity:
- cap to `3` if linked tasks exist
- otherwise cap to `1`

When backend AI fields exist on goal:
- if `goal.ai_probability` exists, use it directly
- if `goal.ai_insights` exists, use first insight as message override
- if `goal.dynamics.inactivity_decay > 0`, append risk factor line
- if `goal.dynamics.momentum_boost > 0`, show boost badge

Frontend probability levels:
- `>=80`: `very_high`
- `>=60`: `high`
- `>=40`: `medium`
- `>=20`: `low`
- else: `very_low`

## 4) Frontend Component Internals

### Task score
- weighted completion ratio by priority:
  - low `0.6`
  - medium `1.0`
  - high `1.5`
  - urgent `2.0`

### Habit score
- based on recency and streak
- no habits means zero contribution

### Deep work score
- uses analytics events of `deep_work_completed`
- uses duration from event metrics/metadata
- fallback minutes from `dailyDeepWorkCount * 30`
- target minutes = `45 * elapsedDays`

### Pace score
- compares task score vs expected timeline progress
- discrete buckets (very good to very poor)
- no linked tasks returns zero pace score

### Momentum score
- compares completion rate last 3 days vs last 7 days
- blends in habit momentum from streak activity

### Consistency score
- signal over last 7 days + streak bonus

### Risk and action generation
Risk examples:
- no tasks linked
- no tasks completed
- low task completion
- no habit progress
- no deep work
- behind schedule
- deadline near

Action examples:
- complete highest-priority pending task
- complete daily habits
- schedule deep work block
- focus this week near deadline

## 5) Linking Hierarchy (Critical)
Source: `goalProbabilityEngine.ts`

Task-to-goal linking order:
1. Task tag exact match: `goal:<goalId>`
2. Task field: `goalId` or `goal_id`
3. Category match (only when goal has category)
4. No random date-range fallback for tasks

Habit linking:
- `habit.goal_link` or `habit.goalLink`
- or `habit.schedule.goal_link` / `goalLink`

Auto habits (cross-goal supportive signals):
- wake up early
- exercise
- meditate

## 6) Realtime Connectivity to Goal Card
Sources:
- `frontend/src/components/analytics/GoalProgress.tsx`
- `frontend/src/hooks/useRealtime.ts`

Goal card re-fetches planner state on realtime events:
- `planner:goal:created`
- `planner:goal:updated`
- `planner:goal:progress_changed`
- `planner:task:created`
- `planner:task:updated`
- `planner:task:deleted`
- `planner:habit:created`
- `planner:habit:completed`
- `planner:deepwork:completed`

## 7) Critical Mismatch (Current Runtime Reality)
Analytics page Goal card currently computes values from frontend local engine and planner store data. It does not primarily render backend `/analytics/goals/progress` output.

Implication:
- backend goal progress can influence other backend v2 scores
- UI goal card can still show a different value if local engine and backend model diverge

## 8) AI Role in Goal Progress
Backend AI role:
- currently in this path, backend v2 goal summary is deterministic and formula-based
- not calling LLM for probability in `analytics_v2_service`

Frontend AI role:
- if planner goal payload already includes `ai_probability`, `ai_insights`, and `dynamics`, UI consumes those fields
- otherwise UI falls back to deterministic local heuristic engine

## 9) Time Range and Metadata
Backend `/goals/progress` response includes:
- `time_range`
- `period_start`
- `period_end`
- `score_version`
- `source`
- `confidence`
- `generated_at`

Frontend goal card currently does not use this metadata because it is store-driven.

## 10) Planner, Chat, and Deep Work Connectivity Summary
Planner:
- goal definitions and progress fields
- tasks and goal linkage
- habit completion and streak signals

Deep work:
- planner deep work + analytics deep work events are used in local engine

Chat:
- chat is not a direct weighted term in current frontend goal probability engine
- chat can affect other backend scores and can indirectly influence planner behavior
