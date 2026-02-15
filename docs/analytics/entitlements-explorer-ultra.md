# Entitlements Model (Explorer and Ultra)

Last validated against runtime code on 2026-02-15.

## Canonical Plan Tiers
Source: `backend/services/entitlements_service.py`

Only two runtime tiers are canonical:
- `explorer`
- `ultra`

Normalization function: `normalize_plan_tier(...)`
- uses `plan_tier`, `plan_type`, `tier`, and `role`
- `role=admin` is normalized to `ultra`

## Legacy Mapping Rules
`tier` mapping:
- `free`, `basic`, `trial`, `explorer` -> `explorer`
- `pro`, `premium`, `enterprise`, `elite`, `ultra` -> `ultra`

`plan_type` mapping:
- `basic`, `explorer` -> `explorer`
- `pro`, `premium`, `enterprise`, `ultra` -> `ultra`

## Entitlements Matrix
| Feature | Explorer | Ultra |
|---|---:|---:|
| Chat daily requests | 25 | 500 |
| Chat overflow model | No | Yes |
| Agentic planner | No | Yes |
| Advanced analytics | No | Yes |
| Focus heatmap | No | Yes |
| Burnout risk | No | Yes |
| AI insights | No | Yes |
| AI intelligence | No | Yes |
| Detailed goal progress | No | Yes |
| Mood tracker | Yes | Yes |
| Productivity score | Yes | Yes |
| Big Five interval (days) | 14 | 7 |

## Limits Contract
`get_limits(plan_tier)` returns:
- `chat_daily_limit`
- `big_five_interval_days`

`/api/v1/users/me` payload (via `build_user_profile`) includes:
- `plan_tier`
- `entitlements`
- `limits`

## Gated Endpoint Contract
Ultra-only feature guard uses `require_ultra_feature(user, feature)` and returns:
- HTTP `403`
- body detail: `{ "code": "PLAN_UPGRADE_REQUIRED", "feature": "<feature_name>" }`

Examples of gated analytics routes:
- `/api/v1/analytics/focus/heatmap`
- `/api/v1/analytics/focus/stats`
- `/api/v1/analytics/burnout/risk/*`
- `/api/v1/analytics/ai-intelligence`
- `/api/v1/analytics/goals/progress`
