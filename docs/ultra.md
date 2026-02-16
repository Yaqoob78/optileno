# Ultra Plan: Features, Limits, and Cost Model

This document describes the current-state Ultra plan in this codebase:
- included capabilities,
- where AI is used,
- hard limits and gating behavior,
- and likely per-user operating cost.

## 1. Runtime Source of Truth

Primary files:
- `backend/services/entitlements_service.py`
- `backend/utils/user_profile.py`
- `backend/api/v1/endpoints/analytics.py`
- `backend/api/v1/endpoints/goals.py`
- `backend/api/v1/endpoints/chat.py`
- `backend/ai/client.py`
- `backend/services/big_five_test_service.py`
- `backend/app/config.py`

## 2. Ultra Entitlements (Current Runtime)

From `ULTRA_ENTITLEMENTS`:
- `chat_requests_daily`: `150`
- `chat_overflow_model_enabled`: `true`
- `agentic_planner`: `true`
- `advanced_analytics`: `true`
- `focus_heatmap`: `true`
- `burnout_risk`: `true`
- `ai_insights`: `true`
- `ai_intelligence`: `true`
- `goal_progress_detailed`: `true`
- `mood_tracker`: `true`
- `productivity_score`: `true`
- `big_five_interval_days`: `7`

## 3. What Ultra Users Receive

- High-limit AI chat.
- Agentic planner capabilities and AI-assisted goal decomposition paths.
- Full analytics stack:
  - focus heatmap + focus stats
  - burnout risk
  - AI intelligence score
  - strategic insight and apply flow
  - detailed goal progress analytics
- Big Five retest interval every 7 days.
- Realtime planner/analytics updates over Socket.IO.

## 4. AI Usage Surfaces (Cost Drivers)

External model usage:
- Chat requests (`/api/v1/chat/send`).
- Goal AI breakdown / cascade paths:
  - `/api/v1/goals/{goal_id}/breakdown`
  - `/api/v1/plans/ai/create-goal-with-cascade`
- Big Five start flow attempts AI question generation before fallback.

Mostly deterministic (compute + DB heavy, not LLM-heavy):
- productivity score
- focus score and heatmap aggregation
- burnout risk
- strategic insight ranking engine
- behavior timeline
- AI intelligence score formula (derived from behavioral metrics)

## 5. Effective Limit Behavior (Important)

Declared entitlement:
- `150` chat requests/day for Ultra.

Current backend quota path (`DualAIClient`) uses provider counters:
Current backend quota path (`DualAIClient`) uses provider counters plus entitlement cap:
- Ultra limits from settings:
  - NVIDIA: `LIMIT_PRO_NVIDIA` default `5000`
  - Groq: `LIMIT_PRO_GROQ` default `1000`
- Increment per request is `+1` with legacy counter normalization.
- Entitlement cap is enforced directly at `150` requests/day.

## 6. Cost Model

Use this formula per Ultra active user per month:

```text
ultra_cost_per_user =
  fixed_infra_share
  + (chat_requests_monthly * blended_ai_cost_per_request)
  + (goal_ai_runs_monthly * goal_ai_cost_per_run)
  + (big_five_runs_monthly * big_five_ai_cost_per_run)
  + ultra_ops_overhead
```

Where:
- `fixed_infra_share = total_fixed_monthly_infra / active_users`
- `goal_ai_cost_per_run` covers decomposition/cascade AI calls
- `ultra_ops_overhead` includes heavier analytics compute/query load

## 7. Example Budget Assumptions (Editable)

Planning assumptions:
- fixed stack monthly cost: `$85`
- active users for allocation: `500`
- fixed infra share per user: `$0.17`
- blended chat AI cost/request: `$0.0015`
- goal AI breakdown/cascade run: `$0.005`
- Big Five AI generation run: `$0.02`
- ultra ops overhead: `$0.20`

## 8. Ultra Cost Scenarios (Per User / Month)

Scenario A: Light Ultra
- `400` chats, `2` goal-AI runs, `1` Big Five run
- cost: `0.17 + (400*0.0015) + (2*0.005) + (1*0.02) + 0.20 = $1.00`

Scenario B: Typical Ultra (within current effective backend cap profile)
- `1200` chats, `4` goal-AI runs, `2` Big Five runs
- cost: `0.17 + 1.80 + 0.02 + 0.04 + 0.20 = $2.23`

Scenario C: Heavy Ultra near current cap (~150/day -> ~4500/month)
- `4500` chats, `6` goal-AI runs, `4` Big Five runs
- cost: `0.17 + 6.75 + 0.03 + 0.08 + 0.25 = $7.28`

## 9. Pricing Read (Ultra)

If Ultra is sold at `$10/month`:
- Margin remains positive for typical usage under a strict `150/day` cap.
- Heavy users still require continuous monitoring and provider-cost optimization.

## 10. Endpoint Access Profile

Ultra should have access to:
- `/api/v1/analytics/focus/heatmap`
- `/api/v1/analytics/focus/stats`
- `/api/v1/analytics/burnout/risk/*`
- `/api/v1/analytics/ai-intelligence`
- `/api/v1/analytics/strategic-insight*`
- `/api/v1/analytics/goals/*`
- `/api/v1/goals/{goal_id}/toggle-tracking`
- `/api/v1/goals/{goal_id}/breakdown`

## 11. Known Runtime Mismatches and Risks

- Cost accounting is request-unit based and should still be reconciled to provider invoices for true gross-margin tracking.
