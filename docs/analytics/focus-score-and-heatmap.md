# Focus Score and Focus Heatmap

Last validated against runtime code on 2026-02-15.

## Endpoint Surface
Source: `backend/api/v1/endpoints/analytics.py`

Focus score endpoints:
- `GET /api/v1/analytics/focus/score/today`
- `GET /api/v1/analytics/focus/score/weekly`
- `GET /api/v1/analytics/focus/score/monthly`

Heatmap endpoints (Ultra only):
- `GET /api/v1/analytics/focus/heatmap`
- `GET /api/v1/analytics/focus/stats`

## Focus Score V2 Logic
Source: `backend/services/analytics_v2_service.py`

Derived components:
```text
task_component = completed/created*100 (or 80 if created=0 and completed>0)
deep_work_component = deep_work_minutes/120*100
goal_alignment = goal_progress_summary.score
derived_score = deep_work_component*0.55 + task_component*0.30 + goal_alignment*0.15
```

Plan-tier behavior:
- Explorer:
  - returns derived score
  - `source = "derived"`

- Ultra:
  - tries FocusScore samples in window
  - if samples exist: average sample score is used
    - `source = "heatmap"`
  - if no samples: derived fallback used
    - `source = "fallback"`

No-data behavior:
- returns `score: null` and `reason: "NO_DATA"` when derived score is zero and no heatmap samples.

## Heatmap Service Math
Source: `backend/services/attention_integrity_service.py`

Daily raw focus before disruption:
```text
raw_focus =
  deep_work*0.40 +
  task_based*0.25 +
  habit_consistency*0.15 +
  ai_engagement*0.10 +
  goal_momentum*0.10
```

Then disruption multiplier applies:
```text
final_score = raw_focus * disruption_multiplier
```

Disruption multiplier tiers are based on disruption-event count (`tab_switch`, `task_switch`, `context_switch`, `early_exit`, `interruption`).

Inactive threshold:
- if `raw_focus < 5`, score is `null` and status is inactive.

## Monthly Heatmap Behavior
Source: `attention_integrity_service.get_monthly_heatmap(...)`

- Computes daily scores for calendar cells.
- Applies daily volatility cap between consecutive active days:
  - max delta per day: plus/minus 35 points.
- Returns monthly stats:
  - `monthly_average`
  - `previous_month_average`
  - `rise_percentage`
  - `consistency_score`
  - `peak_day`
  - `lowest_day`

## Metadata Contract
Heatmap and stats endpoints append v2-style metadata fields:
- `time_range`
- `period_start`
- `period_end`
- `score_version`
- `source`
- `confidence`
- `generated_at`

## Realtime and Refresh Triggers
Source: `frontend/src/components/analytics/FocusHeatmap.tsx`

FocusHeatmap re-fetches on:
- `analytics:focus:updated`
- `analytics:update`
- `planner:task:updated`
- `planner:habit:completed`
- `planner:deepwork:completed`

Additional refresh behavior:
- debounced realtime refresh
- periodic polling every 2 minutes
- fetches heatmap and stats in parallel

## Plan Gating
Route-level guard for heatmap/stats uses Ultra gate:
- Explorer gets HTTP `403` with `PLAN_UPGRADE_REQUIRED` detail payload.
