# Strategic Insight Logic

Last validated against runtime code on 2026-02-15.

## Endpoint Surface
Source: `backend/api/v1/endpoints/analytics.py`

- `GET /api/v1/analytics/strategic-insight`
- `POST /api/v1/analytics/strategic-insight/apply`

## Service Behavior
Source: `backend/services/strategic_insight_service.py`

Design goals in code:
- deterministic, data-backed candidate generation
- no random confidence values
- no generic placeholder when enough data exists

Minimum data gate:
- requires at least 5 completed tasks in last 30 days
- otherwise returns awaiting-data response

## Candidate Types
1. Peak window protection
- finds strongest completion hour/day window
- computes support, lift, confidence, impact score

2. Priority firewall
- compares open high-priority backlog vs high-priority completion ratio
- recommends start-of-day high-impact guardrail

3. Consistency recovery
- detects week-over-week completion drop
- recommends recovery block

Candidate with max `impact_score` is selected.

## Confidence and Impact
Confidence and impact are deterministic formulas using:
- support ratios
- lift vs baseline
- backlog size
- completion mix
- week-over-week drop magnitude

## Apply Flow
`apply_insight(user_id, insight_id)`:
- marks insight as applied (`read_at`)
- can create strategic task automatically if missing
- emits notification record

Task creation templates include:
- protected deep work block
- priority firewall task
- consistency recovery sprint task

## Output Contract
Formatted insight includes:
- `id`, `title`, `description`
- `confidence` (percent)
- `type`
- `evidence`
- `data_points`
- timestamps

## Planner and Analytics Connectivity
- Uses task completion and backlog state as core inputs.
- Can create actionable planner tasks when user applies insight.
- Analytics page component refreshes insight via API and realtime triggers.
