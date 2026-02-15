# Big Five Test Lifecycle and Scoring

Last validated against runtime code on 2026-02-15.

## Endpoint Lifecycle
Source: `backend/api/v1/endpoints/analytics.py`

- `GET /api/v1/analytics/big-five-test/status`
- `POST /api/v1/analytics/big-five-test/start`
- `POST /api/v1/analytics/big-five-test/answer`
- `GET /api/v1/analytics/big-five-test/profile`
- `POST /api/v1/analytics/big-five-test/adjust`

Frontend callers:
- `frontend/src/services/api/bigFiveTest.service.ts`
- `frontend/src/components/analytics/BigFiveProfile.tsx`
- `frontend/src/components/analytics/BigFiveTestModal.tsx`

## Cooldown by Plan Tier
Sources:
- `backend/services/entitlements_service.py`
- `backend/services/big_five_test_service.py`

Cooldown interval uses entitlements limits:
- Explorer: every 14 days
- Ultra: every 7 days

Status payload includes:
- `can_take_test`
- `days_until_next_test`
- `next_test_available`
- `test_interval_days`

## Start Behavior
`start_test(user_id, force_new=False)` behavior:
1. If in-progress test exists:
- `force_new=false`: resume existing session
- `force_new=true`: mark existing session closed and start fresh
2. If completed test exists and still in cooldown:
- return error with `days_remaining` and `can_retry=false`
3. Question set generation:
- AI generation first
- fallback randomized BFI set if AI generation yields nothing usable
4. Create new test session and return first question metadata

## Start Endpoint Status Paths
`POST /big-five-test/start` route behavior:
- cooldown/business rule block -> HTTP `429`
- service start failures (`Failed to start test:` prefix) -> HTTP `500`
- other business/input errors -> HTTP `400`

## Answer Behavior and Status Paths
`POST /big-five-test/answer`:
- validates response range (1..5)
- stores response
- returns next question or completion payload
- service error field maps to HTTP `400`
- unexpected exception maps to HTTP `500`

## Scoring Math
Big Five scoring model in service:
- trait-level Likert responses (1..5)
- reverse-key items use inversion:
```text
reversed_score = 6 - response
```
- trait score normalization maps to 0..100 range from item averages
- missing-trait fallback uses overall response profile baseline

## Behavioral Adjustment Drift
After completion, slight behavior-based adjustments can apply:
- based on recent usage/task/focus/event patterns
- adjustments are bounded (small drift, capped around plus/minus 5)

## Frontend Runtime Notes
`BigFiveProfile`:
- renders lock timer from backend status fields
- shows retake button only when backend says available

`BigFiveTestModal`:
- starts or resumes test
- supports `force_new` refresh question set
- shows source indicator (`ai` vs `fallback`)
