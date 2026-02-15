# AI Intelligence Score (Analytics V2)

Last validated against runtime code on 2026-02-15.

## Endpoint Surface
Source: `backend/api/v1/endpoints/analytics.py`

- `GET /api/v1/analytics/ai-intelligence`

Route-level guard:
- Ultra-only (`_require_ultra(..., "ai_intelligence")`)
- Explorer gets HTTP `403` with `PLAN_UPGRADE_REQUIRED` payload.

## Input Components
Source: `backend/services/analytics_v2_service.py`

1. Planning quality
- based on task creation volume
- goal presence bonus
- deep work session bonus

2. Execution quality
- task completion ratio
- fallback branch when created=0 and completed>0

3. Adaptation to insights
- event count for:
  - `insight_applied`
  - `strategy_applied`
  - `plan_adjusted`
  - `goal_replanned`
- plus goal score coupling

4. Consistency
- active days ratio in range
- blended with habit completion ratio when habits exist

5. Cognitive profile
- derived from latest completed Big Five test
- if none exists, baseline value is used

## Exact Weighted Equation
```text
score =
planning_quality*0.25 +
execution_quality*0.30 +
adaptation_to_insights*0.20 +
consistency*0.15 +
cognitive_profile*0.10
```

## Big Five Contribution Detail
When latest completed Big Five exists:
```text
emotional_stability = 100 - neuroticism
cognitive_profile =
  openness*0.35 +
  conscientiousness*0.45 +
  emotional_stability*0.20
```

If no completed Big Five exists:
- `cognitive_profile = 50`

## Category Labels
- `>= 85`: Strategic Operator
- `>= 70`: Focused Executor
- `>= 55`: Adaptive Builder
- `>= 40`: Developing Rhythm
- else: Early Momentum

## No-Data Behavior
If no meaningful activity exists in range:
- `score: null`
- `reason: "NO_DATA"`
- category still returned from computed score branch
- metadata still returned

## Output Contract
Response includes:
- `score`
- `category`
- `metrics` object with each component
- metadata fields:
  - `time_range`
  - `period_start`
  - `period_end`
  - `score_version`
  - `source`
  - `confidence`
  - `generated_at`
