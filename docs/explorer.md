# Explorer Plan: Features, Limits, and Cost Model

This document describes the current-state Explorer plan in this codebase:
- what users get,
- what is locked,
- where AI is actually used,
- and likely per-user cost.

## 1. Runtime Source of Truth

Primary files:
- `backend/services/entitlements_service.py`
- `backend/utils/user_profile.py`
- `backend/api/v1/endpoints/analytics.py`
- `backend/ai/client.py`
- `backend/services/big_five_test_service.py`
- `frontend/src/pages/Chat/chat.tsx`
- `backend/app/config.py`

## 2. Explorer Entitlements (Current Runtime)

From `EXPLORER_ENTITLEMENTS`:
- `chat_requests_daily`: `15`
- `agentic_planner`: `false`
- `advanced_analytics`: `false`
- `focus_heatmap`: `false`
- `burnout_risk`: `false`
- `ai_insights`: `false`
- `ai_intelligence`: `false`
- `goal_progress_detailed`: `false`
- `mood_tracker`: `true`
- `productivity_score`: `true`
- `big_five_interval_days`: `14`

## 3. What Explorer Users Receive

- AI chat access with daily cap behavior.
- Manual planner: tasks, habits, goals, deep work flows.
- Basic analytics:
  - productivity score
  - focus score (derived path)
  - mood tracker
  - Big Five profile and test flow (cooldown-limited)
- Personal dashboard/profile and session flow.

## 4. What Is Locked for Explorer

At route layer (`403 PLAN_UPGRADE_REQUIRED`):
- `/api/v1/analytics/focus/heatmap`
- `/api/v1/analytics/focus/stats`
- `/api/v1/analytics/burnout/risk/*`
- `/api/v1/analytics/ai-intelligence`
- `/api/v1/analytics/strategic-insight`
- `/api/v1/analytics/strategic-insight/apply`
- `/api/v1/analytics/goals/*` (detailed goal analytics endpoints)
- `/api/v1/goals/{goal_id}/toggle-tracking`
- `/api/v1/goals/{goal_id}/breakdown`

## 5. AI Usage Surfaces (Cost Drivers)

Explorer still uses external AI in these places:
- Chat requests: `/api/v1/chat/send` -> `DualAIClient` (NVIDIA primary, Groq fallback).
- Big Five start flow: AI-generated question set attempt, with fallback to static question bank.

Mostly deterministic (no external model call per request):
- productivity score
- focus score/derived analytics
- mood tracker
- strategic deterministic services when not invoked through gated endpoints.

## 6. Effective Limit Behavior (Important)

Two layers are active:
- Product entitlement layer: `15` requests/day.
- Provider quota layer in `DualAIClient`:
  - Explorer limits from `settings.get_plan_limits("explorer")`:
    - NVIDIA: `LIMIT_BASIC_NVIDIA` (default `2000`)
    - Groq: `LIMIT_BASIC_GROQ` (default `500`)
  - Usage increment is per request (`+1`) with legacy counter normalization.
  - Daily cap is enforced directly from entitlements at `15` requests/day.

Frontend also enforces a local Explorer cap in `frontend/src/pages/Chat/chat.tsx`.

## 7. Cost Model

Use this formula per Explorer active user per month:

```text
explorer_cost_per_user =
  fixed_infra_share
  + (chat_requests_monthly * blended_ai_cost_per_request)
  + (big_five_runs_monthly * big_five_ai_cost_per_run)
  + explorer_ops_overhead
```

Where:
- `fixed_infra_share = total_fixed_monthly_infra / active_users`
- `blended_ai_cost_per_request` is your observed weighted average from provider invoices
- `big_five_ai_cost_per_run` should include multi-prompt generation attempts

## 8. Example Budget Assumptions (Editable)

These are planning assumptions, not billing truth:
- fixed stack monthly cost (frontend + backend + db + redis + monitoring + domain): `$85`
- active users for allocation: `500`
- fixed infra share per user: `$85 / 500 = $0.17`
- blended chat AI cost/request: `$0.0015`
- Big Five AI cost/run: `$0.02`
- explorer ops overhead (DB writes, cache, websocket, logs): `$0.05`

## 9. Explorer Cost Scenarios (Per User / Month)

- Light usage:
  - `120` chats, `0.5` Big Five runs
  - cost: `0.17 + (120*0.0015) + (0.5*0.02) + 0.05 = $0.41`
- Typical usage:
  - `240` chats, `1` Big Five run
  - cost: `0.17 + 0.36 + 0.02 + 0.05 = $0.60`
- Heavy usage (near cap):
  - `450` chats, `2` Big Five runs
  - cost: `0.17 + 0.675 + 0.04 + 0.05 = $0.94`

## 10. Practical Pricing Read

If Explorer is sold at:
- `$1.00` promo: margin is thin/negative for heavy users.
- `$2.00` baseline: healthy margin in light/typical behavior, still positive for heavy profile.

## 11. Known Runtime Mismatches

- Chat quota accounting is request-based and capped by entitlements; provider invoices should still be used for ongoing calibration.
