# Analytics Logic Pack (Current State)

Last validated against runtime code on 2026-02-15.

## Purpose
This pack documents how analytics and connectivity work today in code. It is not a product roadmap. It is a source-of-truth reference for formulas, data flow, entitlement gates, and realtime behavior.

## Reading Order
1. `docs/analytics/connectivity-auth-cors-socket.md`
2. `docs/analytics/entitlements-explorer-ultra.md`
3. `docs/analytics/productivity-score.md`
4. `docs/analytics/focus-score-and-heatmap.md`
5. `docs/analytics/burnout-risk.md`
6. `docs/analytics/ai-intelligence-score.md`
7. `docs/analytics/goal-progress-deep-dive.md`
8. `docs/analytics/mood-tracker.md`
9. `docs/analytics/strategic-insight.md`
10. `docs/analytics/behavior-timeline.md`
11. `docs/analytics/big-five-test.md`

## System Map
```text
Analytics page (frontend/src/pages/Analytics/Analytics.tsx)
  -> hooks/services call /api/v1 analytics endpoints
  -> API client (withCredentials + CSRF + single refresh flow)
  -> backend endpoint layer (backend/api/v1/endpoints/analytics.py)
  -> backend services (analytics_v2_service + component-specific services)
  -> optional websocket updates (socket.io)
  -> frontend components re-fetch/refresh from realtime and polling
```

## Component Catalog
| Component | Primary Backend Service | Primary UI Consumer | Explorer vs Ultra |
|---|---|---|---|
| Productivity Score | `analytics_v2_service.productivity_score` | Analytics top stat cards | Explorer and Ultra |
| Focus Score | `analytics_v2_service.focus_score` | Analytics top stat cards | Explorer and Ultra (Ultra can use heatmap source) |
| Focus Heatmap | `attention_integrity_service` via `/focus/heatmap` and `/focus/stats` | `FocusHeatmap.tsx` | Ultra only |
| Burnout Risk | `analytics_v2_service.burnout_risk` | Analytics top card | Ultra only |
| AI Intelligence Score | `analytics_v2_service.ai_intelligence` | `AIIntelligenceScore` | Ultra only |
| Goal Progress | `analytics_v2_service.goal_progress` exists; UI card uses local engine by default | `GoalAnalyticsDashboard` | Ultra only in UI |
| Mood Tracker | `mood_service` | `MoodTracker.tsx` | Explorer and Ultra |
| Strategic Insight | `strategic_insight_service` | `StrategicInsight.tsx` | Ultra-only card in analytics page |
| Behavior Timeline | `behavior_timeline_service` | `BehaviorTimeline.tsx` | Ultra-only card in analytics page |
| Big Five Test | `big_five_test_service` | `BigFiveProfile` and `BigFiveTestModal` | Explorer and Ultra, different cooldown |

## What Is Computed Where
| Area | Computed in Backend | Computed in Frontend | Notes |
|---|---|---|---|
| Productivity score value | Yes | Only display/transforms | Backend v2 formula is canonical |
| Focus score value | Yes | Only display/transforms | Ultra may use heatmap sample average |
| Burnout risk | Yes | Display/transforms | Ultra endpoint gate |
| AI intelligence | Yes | Display/transforms | Ultra endpoint gate |
| Goal probability card | Partly | Yes (primary in card) | Current card uses `goalProbabilityEngine.ts` unless goal has backend AI fields |
| Big Five cooldown and status | Yes | UI renders status | Backend enforces plan interval |

## Current Known Mismatches
1. Goal Progress card in analytics is currently frontend-local heuristic first, not direct render from `/analytics/goals/progress`.
2. `analytics.store.ts` subscribes to `analytics:updated`; backend canonical emit is `analytics:update` with one-release alias compatibility.
3. Analytics page supports yearly selector in UI, but score hooks use monthly fallback for yearly.

## Source Index
Core connectivity and auth:
- `frontend/src/config/env.ts`
- `frontend/src/services/api/client.ts`
- `frontend/src/services/realtime/socket-client.ts`
- `backend/app/config.py`
- `backend/app/main.py`
- `backend/auth/auth_routes.py`
- `backend/realtime/socket_manager.py`

Core analytics endpoints/services:
- `backend/api/v1/endpoints/analytics.py`
- `backend/services/analytics_v2_service.py`
- `backend/services/attention_integrity_service.py`
- `backend/services/mood_service.py`
- `backend/services/strategic_insight_service.py`
- `backend/services/behavior_timeline_service.py`
- `backend/services/big_five_test_service.py`
- `backend/services/entitlements_service.py`
- `backend/utils/user_profile.py`

Core frontend component wiring:
- `frontend/src/pages/Analytics/Analytics.tsx`
- `frontend/src/components/analytics/GoalProgress.tsx`
- `frontend/src/components/analytics/GoalAnalyticsDashboard.tsx`
- `frontend/src/utils/goalProbabilityEngine.ts`
- `frontend/src/components/analytics/FocusHeatmap.tsx`
- `frontend/src/components/analytics/BigFiveProfile.tsx`
- `frontend/src/components/analytics/BigFiveTestModal.tsx`
