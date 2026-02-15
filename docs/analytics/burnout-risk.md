# Burnout Risk (Analytics V2)

Last validated against runtime code on 2026-02-15.

## Endpoint Surface
Source: `backend/api/v1/endpoints/analytics.py`

- `GET /api/v1/analytics/burnout/risk/today`
- `GET /api/v1/analytics/burnout/risk/weekly`
- `GET /api/v1/analytics/burnout/risk/monthly`

These routes are Ultra-only at route layer (`_require_ultra(..., "burnout_risk")`).
Explorer receives:
- HTTP `403`
- `{ "code": "PLAN_UPGRADE_REQUIRED", "feature": "burnout_risk" }`

## Inputs
Source: `backend/services/analytics_v2_service.py`

Inputs combined in the model:
- workload ratio from pending vs completed tasks
- deep work overload signal
- active-day ratio by selected window
- focus score variance from `FocusScore`
- goal progress pressure from goal summary
- deadline compression from active goals and days left
- engagement extremes from active minutes
- mood modulation from mood label
- inconsistency shock from daily workload variance

Active minutes are computed as:
```text
active_minutes = deep_work_minutes + tasks_completed*12 + chat_requests*2
```

## Exact Weighted Equation
```text
risk =
workload_strain*0.30 +
recovery_deficit*0.20 +
focus_volatility*0.10 +
goal_progress_pressure*0.10 +
deadline_compression*0.10 +
engagement_extremes*0.10 +
mood_modulation*0.05 +
inconsistency_shock*0.05
```

Risk is clamped to `[0,100]`.

## Level Bands
- `< 30`: `low`
- `< 55`: `moderate`
- `< 75`: `high`
- `>= 75`: `critical`

## Mood Modulation Behavior
The model calls mood service and interprets current mood label:
- energetic/calm/focused/positive -> lower modulation contribution
- stressed/anxious/sad/frustrated/negative -> higher modulation contribution
- other/unknown -> neutral baseline contribution

## Output Contract
Response includes:
- `risk`
- `level`
- `breakdown` (all weighted components)
- metadata fields:
  - `time_range`
  - `period_start`
  - `period_end`
  - `score_version`
  - `source`
  - `confidence`
  - `generated_at`
