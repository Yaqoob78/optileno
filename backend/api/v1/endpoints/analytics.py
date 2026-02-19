from fastapi import APIRouter, Depends, Query, HTTPException, status, Body
from typing import List, Optional, Dict, Any
from datetime import datetime
import logging
from backend.core.security import get_current_user
from backend.services.analytics_service import analytics_service
from backend.services.goal_analytics_service import goal_analytics_service
from backend.services.analytics_v2_service import analytics_v2_service
from backend.services.entitlements_service import normalize_plan_tier, require_ultra_feature
from backend.app.config import settings
from pydantic import BaseModel
from backend.types.events import AppEvent, UserMetrics, AnalyticsEvent
from backend.realtime.socket_manager import (
    broadcast_analytics_update,
    broadcast_insight_generated,
)

router = APIRouter()
logger = logging.getLogger(__name__)

class AnalyticsEventIn(BaseModel):
    event: str
    source: str
    metadata: dict = {}


def _plan_tier(user: Any) -> str:
    return normalize_plan_tier(
        plan_type=getattr(user, "plan_type", None),
        tier=getattr(user, "tier", None),
        role=getattr(user, "role", None),
        email=getattr(user, "email", None),
    )


def _require_ultra(user: Any, feature: str) -> None:
    require_ultra_feature(user, feature)


def _fallback_payload(message: str, **extra: Any) -> Dict[str, Any]:
    return {
        "error_fallback": True,
        "message": message,
        "generated_at": datetime.utcnow().isoformat(),
        **extra,
    }

@router.get("/metrics")
async def get_realtime_metrics(user = Depends(get_current_user)):
    """Get real-time computed metrics"""
    metrics = await analytics_service.get_realtime_metrics(user.id)
    return metrics

@router.get("/insights")
async def get_user_insights(
    user = Depends(get_current_user),
    limit: int = Query(10, ge=1, le=50)
):
    """Get user insights"""
    insights = await analytics_service.get_user_insights(user.id, limit)
    return {"insights": insights}

@router.get("/comprehensive")
async def get_comprehensive_analytics(user = Depends(get_current_user)):
    """Get complete analytics dashboard data"""
    # Initialize analytics for new users if needed
    await analytics_service.initialize_user_analytics(user.id)
    data = await analytics_service.get_comprehensive_analytics(user.id)
    return data

@router.get("/historical/{time_range}")
async def get_historical_analytics(
    time_range: str,
    user = Depends(get_current_user)
):
    """
    Get historical analytics for different time ranges.
    
    Args:
        time_range: "daily", "weekly", "monthly", or "yearly"
    """
    if time_range not in ["daily", "weekly", "monthly", "yearly"]:
        raise HTTPException(
            status_code=400,
            detail="Invalid time range. Use: daily, weekly, monthly, or yearly"
        )
    
    # Get comprehensive data and filter based on time range
    data = await analytics_service.get_comprehensive_analytics(user.id)
    
    # Return specific historical data based on time range
    historical = data.get("historical", {})
    
    if time_range == "daily":
        # Return daily history for the last 7 days
        focus_daily = historical.get("focus", {}).get("daily_history", [])[:7]
        tasks_daily = historical.get("tasks", {}).get("daily_history", {})
        return {
            "time_range": "daily",
            "focus_scores": focus_daily,
            "task_history": tasks_daily,
            "period": "last_7_days"
        }
    elif time_range == "weekly":
        # Return weekly averages
        focus_weekly = historical.get("focus", {}).get("weekly", {})
        return {
            "time_range": "weekly",
            "focus_average": focus_weekly,
            "period": "last_week"
        }
    elif time_range == "monthly":
        # Return monthly averages
        focus_monthly = historical.get("focus", {}).get("monthly", {})
        return {
            "time_range": "monthly",
            "focus_average": focus_monthly,
            "period": "last_month"
        }
    else:  # yearly
        # Return yearly summary
        return {
            "time_range": "yearly",
            "focus_trend": historical.get("focus", {}).get("daily_history", [])[:365],
            "period": "last_year"
        }

@router.post("/events/batch")
async def log_events_batch(
    payload: List[AnalyticsEventIn],
    user = Depends(get_current_user)
):
    """Log multiple events at once"""
    events = []
    for event_in in payload:
        events.append({
            "user_id": user.id,
            "event": event_in.event,
            "source": event_in.source,
            "metadata": event_in.metadata,
            "timestamp": datetime.utcnow().isoformat(),
        })
    
    saved_events = await analytics_service.save_event_batch(events)
    
    # Broadcast analytics update to connected clients
    await broadcast_analytics_update(user.id, {
        "event_count": len(saved_events),
        "events": [
            {
                "event": e.event_type,
                "source": e.event_source,
                "timestamp": e.timestamp.isoformat() if e.timestamp else None
            }
            for e in saved_events
        ]
    })
    
    return {
        "status": "batch_logged",
        "count": len(saved_events),
        "event_ids": [e.id for e in saved_events],
    }

@router.post("/events")
async def log_event(
    event_in: AnalyticsEventIn,
    user = Depends(get_current_user)
):
    """Log a single event"""
    event_data = {
        "user_id": user.id,
        "event": event_in.event,
        "source": event_in.source,
        "metadata": event_in.metadata,
        "timestamp": datetime.utcnow().isoformat(),
    }
    
    saved_event = await analytics_service.save_event(event_data)
    
    # Broadcast analytics update
    await broadcast_analytics_update(user.id, {"event": event_in.event, "source": event_in.source})
    
    return {
        "status": "logged",
        "id": saved_event.id
    }

@router.post("/sync")
async def sync_analytics(
    payload: dict,
    user = Depends(get_current_user)
):
    """Sync frontend events and metrics"""
    # Simply log the batch for now
    if "events" in payload:
        events = []
        for e in payload["events"]:
            events.append({
                "user_id": user.id,
                "event": e.get("type", "unknown"),
                "source": e.get("source", "frontend"),
                "metadata": e.get("metadata", {}),
                "timestamp": e.get("timestamp", datetime.utcnow().isoformat()),
            })
        await analytics_service.save_event_batch(events)
    
    # Return latest insights
    insights = await analytics_service.get_user_insights(user.id, limit=5)
    return insights

@router.get("/predictions")
async def get_predictions(user = Depends(get_current_user)):
    """Get AI performance predictions"""
    try:
        # Wrapper for trajectory
        from backend.ai.tools.analytics import predict_user_trajectory
        trajectory = await predict_user_trajectory(str(user.id), "weekly")
        summary = "Stable"
        if isinstance(trajectory, dict):
            summary = str(trajectory.get("summary") or "Stable")
        return [
            {
                "type": "productivity",
                "confidence": 0.85,
                "description": f"Predicted trajectory: {summary}",
                "timeframe": "weekly"
            }
        ]
    except Exception as e:
        logger.error("Predictions failed for user %s: %s", user.id, e, exc_info=True)
        return [
            {
                "type": "productivity",
                "confidence": 0.2,
                "description": "Prediction is temporarily unavailable. Keep using planner data for accurate forecasts.",
                "timeframe": "weekly",
                "error_fallback": True,
            }
        ]

@router.get("/ai/insight")
async def get_ai_insight(
    user = Depends(get_current_user),
    focus_area: str = Query("productivity", pattern="^(productivity|focus|planning|consistency|wellbeing)$")
):
    """Get AI-generated insight for specific focus area"""
    from backend.ai.tools.analytics import generate_ai_insight
    insight = await generate_ai_insight(str(user.id), focus_area)
    
    # Broadcast insight to connected clients
    await broadcast_insight_generated(user.id, {
        "focus_area": focus_area,
        "insight": insight
    })
    
    return insight

@router.get("/ai/trajectory")
async def get_ai_trajectory(
    user = Depends(get_current_user),
    timeframe: str = Query("weekly", pattern="^(daily|weekly|monthly)$")
):
    """Get AI-predicted trajectory"""
    from backend.ai.tools.analytics import predict_user_trajectory
    trajectory = await predict_user_trajectory(str(user.id), timeframe)
    return trajectory


# ── Focus Heatmap Endpoints ──────────────────────────────────────────────

@router.get("/focus/today")
async def get_focus_today(user = Depends(get_current_user)):
    """Get today's focus score with breakdown"""
    try:
        from backend.services.attention_integrity_service import attention_integrity_service
        from datetime import date

        score_data = await attention_integrity_service.calculate_attention_integrity(user.id, date.today())
        return score_data
    except Exception as e:
        logger.error("Focus today failed for user %s: %s", user.id, e, exc_info=True)
        return _fallback_payload(
            "Focus score is temporarily unavailable.",
            date=datetime.utcnow().date().isoformat(),
            score=0,
            breakdown={},
            activities=[],
            color={"color": "#2a2a2a", "label": "Inactive"},
        )


@router.get("/focus/weekly")
async def get_focus_weekly(user = Depends(get_current_user)):
    """Get weekly focus scores (last 7 days)"""
    try:
        from backend.services.attention_integrity_service import attention_integrity_service

        weekly_data = await attention_integrity_service.get_weekly_average(user.id)
        return weekly_data
    except Exception as e:
        logger.error("Focus weekly failed for user %s: %s", user.id, e, exc_info=True)
        return _fallback_payload(
            "Weekly focus data is temporarily unavailable.",
            daily_scores=[],
            weekly_average=0,
            peak_day=None,
            lowest_day=None,
        )


@router.get("/focus/heatmap")
async def get_focus_heatmap(
    user = Depends(get_current_user),
    year: Optional[int] = Query(None),
    month: Optional[int] = Query(None, ge=1, le=12),
    time_range: str = Query("monthly", pattern="^(daily|weekly|monthly)$"),
):
    """Get monthly focus heatmap (calendar grid)"""
    _require_ultra(user, "focus_heatmap")
    try:
        from backend.services.attention_integrity_service import attention_integrity_service

        heatmap_data = await attention_integrity_service.get_monthly_heatmap(user.id, year, month)
        window = await analytics_v2_service.resolve_window(user, time_range)
        if isinstance(heatmap_data, dict):
            heatmap_data.update(
                {
                    "time_range": window.time_range,
                    "period_start": window.period_start.isoformat(),
                    "period_end": window.period_end.isoformat(),
                    "score_version": analytics_v2_service.SCORE_VERSION,
                    "source": "heatmap",
                    "confidence": 0.8,
                    "generated_at": datetime.utcnow().isoformat(),
                }
            )
        return heatmap_data
    except Exception as e:
        logger.error("Focus heatmap failed for user %s: %s", user.id, e, exc_info=True)
        return _fallback_payload(
            "Focus heatmap is temporarily unavailable.",
            heatmap=[],
            time_range=time_range,
            score_version=analytics_v2_service.SCORE_VERSION,
            source="fallback",
            confidence=0.2,
        )


@router.get("/focus/stats")
async def get_focus_stats(
    user = Depends(get_current_user),
    time_range: str = Query("monthly", pattern="^(daily|weekly|monthly)$"),
):
    """Get comprehensive focus statistics for the stats panel"""
    _require_ultra(user, "focus_heatmap")
    try:
        from backend.services.attention_integrity_service import attention_integrity_service

        stats = await attention_integrity_service.get_focus_stats(user.id)
        window = await analytics_v2_service.resolve_window(user, time_range)
        if isinstance(stats, dict):
            stats.update(
                {
                    "time_range": window.time_range,
                    "period_start": window.period_start.isoformat(),
                    "period_end": window.period_end.isoformat(),
                    "score_version": analytics_v2_service.SCORE_VERSION,
                    "source": "heatmap",
                    "confidence": 0.75,
                    "generated_at": datetime.utcnow().isoformat(),
                }
            )
        return stats
    except Exception as e:
        logger.error("Focus stats failed for user %s: %s", user.id, e, exc_info=True)
        return _fallback_payload(
            "Focus stats are temporarily unavailable.",
            score=None,
            reason="TEMPORARILY_UNAVAILABLE",
            breakdown={},
            time_range=time_range,
            score_version=analytics_v2_service.SCORE_VERSION,
            source="fallback",
            confidence=0.2,
        )


@router.post("/focus/recalculate")
async def recalculate_focus_score(user = Depends(get_current_user)):
    """
    Trigger recalculation of today's focus score.
    Called when a productivity event occurs.
    """
    from backend.services.attention_integrity_service import attention_integrity_service
    from datetime import date
    
    score_data = await attention_integrity_service.calculate_attention_integrity(user.id, date.today())
    
    # Broadcast update to connected clients
    await broadcast_analytics_update(user.id, {
        "type": "focus_score_updated",
        "score": score_data["score"],
        "breakdown": score_data["breakdown"],
    })
    
    return score_data


# ─────────────────────────────────────────────────────────────────────
# MOOD TRACKER ENDPOINTS
# ─────────────────────────────────────────────────────────────────────

@router.get("/mood/current", response_model=Dict[str, Any])
async def get_current_mood(
    current_user = Depends(get_current_user)
):
    """Get current computed mood status."""
    try:
        from backend.services.mood_service import mood_service
        mood_data = await mood_service.calculate_current_mood(current_user.id)
        return mood_data
    except Exception as e:
        logger.error("Mood calculation failed for user %s: %s", current_user.id, e, exc_info=True)
        return _fallback_payload(
            "Mood insights are temporarily unavailable.",
            score=50,
            category="NEUTRAL",
            label="Neutral",
            emoji="🙂",
            hint="Keep going. Your latest mood insight will appear shortly.",
            breakdown={},
        )


class MoodCheckInRequest(BaseModel):
    mood: str
    context: Optional[str] = None


@router.post("/mood/check-in", response_model=Dict[str, Any])
async def mood_check_in(
    payload: MoodCheckInRequest,
    current_user = Depends(get_current_user)
):
    """
    User manually checking in or 'Talking about this mood'.
    This triggers a chat initiation implicitly.
    """
    # In a real implementation, this might trigger an AI message
    # For now, we just log it and return success
    await analytics_service.save_event({
        "user_id": current_user.id,
        "event": "mood_check_in",
        "source": "web_ui",
        "metadata": {
            "declared_mood": payload.mood,
            "context": payload.context
        }
    })
    
    
    return {"status": "success", "message": "Mood logged"}


# ─────────────────────────────────────────────────────────────────────
# TIME INTELLIGENCE ENDPOINTS
# ─────────────────────────────────────────────────────────────────────

@router.get("/time/overview", response_model=Dict[str, Any])
async def get_time_intelligence_overview(
    current_user = Depends(get_current_user)
):
    """Get aggregated time intelligence data for the dashboard."""
    try:
        from backend.services.temporal_performance_service import temporal_performance_service
        return await temporal_performance_service.get_intelligence(current_user.id)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch time intelligence: {str(e)}"
        )


# ─────────────────────────────────────────────────────────────────────
# PRODUCTIVITY SCORE ENDPOINTS (V3 Engine)
# ─────────────────────────────────────────────────────────────────────

@router.get("/productivity/score/today", response_model=Dict[str, Any])
async def get_productivity_score_today(
    current_user = Depends(get_current_user)
):
    """Get today's productivity score with V3 context-aware breakdown."""
    try:
        return await analytics_v2_service.productivity_score(current_user, "daily")
    except Exception as e:
        logger.error("Productivity score (daily) failed for user %s: %s", current_user.id, e, exc_info=True)
        return _fallback_payload(
            "Productivity score is temporarily unavailable.",
            score=None,
            reason="TEMPORARILY_UNAVAILABLE",
            breakdown={},
            score_version=analytics_v2_service.SCORE_VERSION,
            source="fallback",
            confidence=0.2,
            time_range="daily",
        )


@router.get("/productivity/score/weekly", response_model=Dict[str, Any])
async def get_productivity_score_weekly(
    current_user = Depends(get_current_user)
):
    """Get weekly average productivity score."""
    try:
        result = await analytics_v2_service.productivity_score(current_user, "weekly")
        score = result.get("score")
        return {
            **result,
            "average": score,
            "period": "weekly",
            "days": 7,
        }
    except Exception as e:
        logger.error("Productivity score (weekly) failed for user %s: %s", current_user.id, e, exc_info=True)
        return _fallback_payload(
            "Weekly productivity score is temporarily unavailable.",
            score=None,
            average=None,
            period="weekly",
            days=7,
            reason="TEMPORARILY_UNAVAILABLE",
            breakdown={},
            score_version=analytics_v2_service.SCORE_VERSION,
            source="fallback",
            confidence=0.2,
            time_range="weekly",
        )


@router.get("/productivity/score/monthly", response_model=Dict[str, Any])
async def get_productivity_score_monthly(
    current_user = Depends(get_current_user)
):
    """Get monthly average productivity score."""
    try:
        result = await analytics_v2_service.productivity_score(current_user, "monthly")
        score = result.get("score")
        return {
            **result,
            "average": score,
            "period": "monthly",
            "days": 30,
        }
    except Exception as e:
        logger.error("Productivity score (monthly) failed for user %s: %s", current_user.id, e, exc_info=True)
        return _fallback_payload(
            "Monthly productivity score is temporarily unavailable.",
            score=None,
            average=None,
            period="monthly",
            days=30,
            reason="TEMPORARILY_UNAVAILABLE",
            breakdown={},
            score_version=analytics_v2_service.SCORE_VERSION,
            source="fallback",
            confidence=0.2,
            time_range="monthly",
        )


# ─────────────────────────────────────────────────────────────────────
# FOCUS SCORE ENDPOINTS
# ─────────────────────────────────────────────────────────────────────

@router.get("/focus/score/today", response_model=Dict[str, Any])
async def get_focus_score_today(
    current_user = Depends(get_current_user)
):
    """Get today's focus score with detailed breakdown from heatmap data."""
    try:
        return await analytics_v2_service.focus_score(current_user, _plan_tier(current_user), "daily")
    except Exception as e:
        logger.error("Focus score (daily) failed for user %s: %s", current_user.id, e, exc_info=True)
        return _fallback_payload(
            "Focus score is temporarily unavailable.",
            score=None,
            reason="TEMPORARILY_UNAVAILABLE",
            breakdown={},
            score_version=analytics_v2_service.SCORE_VERSION,
            source="fallback",
            confidence=0.2,
            time_range="daily",
        )


@router.get("/focus/score/weekly", response_model=Dict[str, Any])
async def get_focus_score_weekly(
    current_user = Depends(get_current_user)
):
    """Get weekly average focus score."""
    try:
        result = await analytics_v2_service.focus_score(current_user, _plan_tier(current_user), "weekly")
        score = result.get("score")
        return {
            **result,
            "average_score": score,
            "average_minutes": None,
            "period": "weekly",
            "days": 7,
        }
    except Exception as e:
        logger.error("Focus score (weekly) failed for user %s: %s", current_user.id, e, exc_info=True)
        return _fallback_payload(
            "Weekly focus score is temporarily unavailable.",
            score=None,
            average_score=None,
            average_minutes=None,
            period="weekly",
            days=7,
            reason="TEMPORARILY_UNAVAILABLE",
            breakdown={},
            score_version=analytics_v2_service.SCORE_VERSION,
            source="fallback",
            confidence=0.2,
            time_range="weekly",
        )


@router.get("/focus/score/monthly", response_model=Dict[str, Any])
async def get_focus_score_monthly(
    current_user = Depends(get_current_user)
):
    """Get monthly average focus score."""
    try:
        result = await analytics_v2_service.focus_score(current_user, _plan_tier(current_user), "monthly")
        score = result.get("score")
        return {
            **result,
            "average_score": score,
            "average_minutes": None,
            "period": "monthly",
            "days": 30,
        }
    except Exception as e:
        logger.error("Focus score (monthly) failed for user %s: %s", current_user.id, e, exc_info=True)
        return _fallback_payload(
            "Monthly focus score is temporarily unavailable.",
            score=None,
            average_score=None,
            average_minutes=None,
            period="monthly",
            days=30,
            reason="TEMPORARILY_UNAVAILABLE",
            breakdown={},
            score_version=analytics_v2_service.SCORE_VERSION,
            source="fallback",
            confidence=0.2,
            time_range="monthly",
        )


# ─────────────────────────────────────────────────────────────────────
# BURNOUT RISK ENDPOINTS (V3 Engine - AI-Powered)
# ─────────────────────────────────────────────────────────────────────

@router.get("/burnout/risk/today", response_model=Dict[str, Any])
async def get_burnout_risk_today(
    current_user = Depends(get_current_user)
):
    """Get today's burnout risk with V3 strain velocity and offline gap analysis."""
    _require_ultra(current_user, "burnout_risk")
    try:
        return await analytics_v2_service.burnout_risk(current_user, "daily")
    except Exception as e:
        logger.error("Burnout risk (daily) failed for user %s: %s", current_user.id, e, exc_info=True)
        return _fallback_payload(
            "Burnout risk is temporarily unavailable.",
            risk=35.0,
            level="low",
            reason_codes=["TEMPORARILY_UNAVAILABLE"],
            score_version=analytics_v2_service.SCORE_VERSION,
            source="fallback",
            confidence=0.2,
            time_range="daily",
        )


@router.get("/burnout/risk/weekly", response_model=Dict[str, Any])
async def get_burnout_risk_weekly(
    current_user = Depends(get_current_user)
):
    """Get weekly average burnout risk."""
    _require_ultra(current_user, "burnout_risk")
    try:
        result = await analytics_v2_service.burnout_risk(current_user, "weekly")
        return {
            **result,
            "average_risk": result.get("risk"),
            "period": "weekly",
            "days": 7,
        }
    except Exception as e:
        logger.error("Burnout risk (weekly) failed for user %s: %s", current_user.id, e, exc_info=True)
        return _fallback_payload(
            "Weekly burnout risk is temporarily unavailable.",
            risk=35.0,
            average_risk=35.0,
            level="low",
            period="weekly",
            days=7,
            reason_codes=["TEMPORARILY_UNAVAILABLE"],
            score_version=analytics_v2_service.SCORE_VERSION,
            source="fallback",
            confidence=0.2,
            time_range="weekly",
        )


@router.get("/burnout/risk/monthly", response_model=Dict[str, Any])
async def get_burnout_risk_monthly(
    current_user = Depends(get_current_user)
):
    """Get monthly burnout risk."""
    _require_ultra(current_user, "burnout_risk")
    try:
        result = await analytics_v2_service.burnout_risk(current_user, "monthly")
        return {
            **result,
            "average_risk": result.get("risk"),
            "period": "monthly",
            "days": 30,
        }
    except Exception as e:
        logger.error("Burnout risk (monthly) failed for user %s: %s", current_user.id, e, exc_info=True)
        return _fallback_payload(
            "Monthly burnout risk is temporarily unavailable.",
            risk=35.0,
            average_risk=35.0,
            level="low",
            period="monthly",
            days=30,
            reason_codes=["TEMPORARILY_UNAVAILABLE"],
            score_version=analytics_v2_service.SCORE_VERSION,
            source="fallback",
            confidence=0.2,
            time_range="monthly",
        )


# ─────────────────────────────────────────────────────────────────────
# PATTERN DETECTOR ENDPOINTS (AI-Powered)
# ─────────────────────────────────────────────────────────────────────

@router.get("/patterns/all", response_model=Dict[str, Any])
async def get_all_patterns(
    current_user = Depends(get_current_user)
):
    """
    Get all AI-detected behavioral patterns across all categories.
    Only returns patterns with 75%+ confidence.
    Requires minimum 30 days of data.
    """
    try:
        from backend.services.pattern_detector_service import pattern_detector_service
        return await pattern_detector_service.detect_all_patterns(current_user.id)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to detect patterns: {str(e)}"
        )


# ─────────────────────────────────────────────────────────────────────
# BEHAVIOR TIMELINE ENDPOINTS
# ─────────────────────────────────────────────────────────────────────

@router.get("/behavior-timeline", response_model=Dict[str, Any])
async def get_behavior_timeline(
    days: int = Query(30, ge=7, le=365),
    current_user = Depends(get_current_user)
):
    """
    Get observational behavior timeline.
    Visualizes engagement, effort, emotion, resistance, and recovery.
    
    Args:
        days: Number of days to look back (default 30)
    """
    try:
        from backend.services.behavior_timeline_service import behavior_timeline_service
        return await behavior_timeline_service.get_timeline(current_user.id, days)
    except Exception as e:
        logger.error("Behavior timeline failed for user %s: %s", current_user.id, e, exc_info=True)
        return _fallback_payload(
            "Behavior timeline is temporarily unavailable.",
            timeline=[],
            summary={
                "active_days": 0,
                "absent_days": max(days, 0),
                "engagement_rate": 0,
                "longest_streak": 0,
                "current_streak": 0,
                "flow_days": 0,
                "interventions_triggered": 0,
                "dominant_pattern": "Insufficient data",
                "anti_quit": {
                    "profile": "maker",
                    "current_state": "STABLE",
                    "quit_probability": 0,
                    "risk_level": "low",
                    "warning_label": "Behavior is stable.",
                    "confidence": 0.2,
                    "evidence": [],
                },
            },
            meta={
                "start_date": datetime.utcnow().date().isoformat(),
                "end_date": datetime.utcnow().date().isoformat(),
                "days": days,
                "score_version": "v3",
                "source": "fallback",
                "generated_at": datetime.utcnow().isoformat(),
            },
        )


# ─────────────────────────────────────────────────────────────────────
# PREDICTIVE TRAJECTORY ENDPOINT
# ─────────────────────────────────────────────────────────────────────

@router.get("/predictive-trajectory", response_model=Dict[str, Any])
async def get_predictive_trajectory(
    current_user = Depends(get_current_user)
):
    """
    Get 2-week behavioral projection based on current trends.
    Simple forecast showing where current behavior is leading.
    """
    try:
        from backend.services.predictive_trajectory_service import predictive_trajectory_service
        return await predictive_trajectory_service.get_trajectory(current_user.id)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get predictive trajectory: {str(e)}"
        )


# ─────────────────────────────────────────────────────────────────────
# TIME INTELLIGENCE ENDPOINT
# ─────────────────────────────────────────────────────────────────────

@router.get("/time-intelligence", response_model=Dict[str, Any])
async def get_time_intelligence(
    current_user = Depends(get_current_user)
):
    """
    Get comprehensive time intelligence metrics.
    - Chronotype analysis
    - Peak performance hours
    - Estimation accuracy
    - Optimal work windows
    """
    try:
        from backend.services.temporal_performance_service import temporal_performance_service
        return await temporal_performance_service.get_intelligence(current_user.id)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get time intelligence: {str(e)}"
        )


# ─────────────────────────────────────────────────────────────────────
# AI INTELLIGENCE SCORE ENDPOINT
# ─────────────────────────────────────────────────────────────────────

@router.get("/ai-intelligence", response_model=Dict[str, Any])
async def get_ai_intelligence(
    current_user = Depends(get_current_user),
    time_range: str = Query("daily", pattern="^(daily|weekly|monthly)$")
):
    """
    Get real-time cognitive analytic score.
    Supports daily, weekly, and monthly contexts.
    """
    _require_ultra(current_user, "ai_intelligence")
    try:
        if settings.ANALYTICS_V2_ENABLED:
            return await analytics_v2_service.ai_intelligence(current_user, time_range)
        from backend.services.enhanced_ai_intelligence_service import enhanced_ai_intelligence_service
        result = await enhanced_ai_intelligence_service.get_score(current_user.id, time_range)
        if isinstance(result, dict):
            result.setdefault("score_version", analytics_v2_service.SCORE_VERSION)
            result.setdefault("time_range", time_range)
            result.setdefault("source", "derived")
            result.setdefault("confidence", 0.6)
            result.setdefault("generated_at", datetime.utcnow().isoformat())
        return result
    except Exception as e:
        logger.error("Error calculating AI intelligence for user %s: %s", current_user.id, e, exc_info=True)
        # Return fallback data to prevent frontend crash
        return {
            "ready": False,
            "status": "pending",
            "message": "AI will load your intelligence score soon. Keep working.",
            "last_updated": datetime.utcnow().isoformat(),
            "error_fallback": True
        }


# ─────────────────────────────────────────────────────────────────────
# STRATEGIC INSIGHT ENDPOINTS
# ─────────────────────────────────────────────────────────────────────

@router.get("/strategic-insight", response_model=Dict[str, Any])
async def get_strategic_insight(
    current_user = Depends(get_current_user)
):
    """
    Get the single most impactful behavioral insight for the user.
    """
    _require_ultra(current_user, "ai_insights")
    try:
        from backend.services.strategic_insight_service import strategic_insight_service
        return await strategic_insight_service.get_active_insight(current_user.id)
    except Exception as e:
        logger.error("Strategic insight failed for user %s: %s", current_user.id, e, exc_info=True)
        return {
            "insights": [
                {
                    "id": 0,
                    "title": "Strategic insights are calibrating",
                    "description": "Keep using planner and chat activity. Your next high-impact insight will appear shortly.",
                    "confidence": 0,
                    "applied_at": None,
                    "type": "awaiting_data",
                    "severity": "info",
                    "category": "planning",
                    "generated_at": datetime.utcnow().isoformat(),
                    "evidence": [],
                    "data_points": 0,
                }
            ],
            "count": 1,
            "error_fallback": True,
        }

@router.post("/strategic-insight/apply", response_model=Dict[str, Any])
async def apply_strategic_insight(
    insight_data: Dict[str, Any],
    current_user = Depends(get_current_user)
):
    """
    Apply the strategic insight to the user's workflow.
    Automatically implements the recommendation.
    """
    _require_ultra(current_user, "ai_insights")
    try:
        from backend.services.strategic_insight_service import strategic_insight_service
        insight_id_raw = insight_data.get("insight_id")
        if insight_id_raw is None:
            raise HTTPException(status_code=400, detail="insight_id is required")
        try:
            insight_id = int(insight_id_raw)
        except (TypeError, ValueError):
            raise HTTPException(status_code=400, detail="insight_id must be an integer")
        return await strategic_insight_service.apply_insight(current_user.id, insight_id)
    except HTTPException:
        raise
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to apply insight: {str(e)}"
        )


# ─────────────────────────────────────────────────────────────────────
# GOAL-BASED PROFESSIONAL ANALYTICS (NEW)
# ─────────────────────────────────────────────────────────────────────

@router.get("/goals/progress", response_model=Dict[str, Any])
async def get_goal_progress_report(
    current_user = Depends(get_current_user),
    goal_id: Optional[int] = Query(None, description="Specific goal ID, or all goals if not provided"),
    time_range: str = Query("weekly", pattern="^(daily|weekly|monthly)$"),
):
    """
    Get comprehensive goal progress report.

    Returns:
    - Progress percentages with trends
    - Velocity metrics (tasks/day)
    - Risk assessment (on_track, at_risk, overdue)
    - Predicted completion dates
    - Habit contribution scores
    """
    _require_ultra(current_user, "goal_progress_detailed")
    try:
        if settings.ANALYTICS_V2_ENABLED:
            return await analytics_v2_service.goal_progress(current_user, time_range, goal_id=goal_id)

        from backend.services.enhanced_goal_analytics_service import enhanced_goal_analytics_service
        report = await enhanced_goal_analytics_service.get_goal_progress_report(
            str(current_user.id),
            str(goal_id) if goal_id else None
        )
        return report
    except HTTPException as exc:
        if exc.status_code < 500:
            raise
        logger.error("Goal progress failed for user %s: %s", current_user.id, exc, exc_info=True)
        return _fallback_payload(
            "Goal progress is temporarily unavailable.",
            goals=[],
            summary={
                "total_goals": 0,
                "completed_goals": 0,
                "overall_progress": 0,
                "avg_confidence": 0,
            },
            score_version=analytics_v2_service.SCORE_VERSION,
            source="fallback",
            confidence=0.2,
            time_range=time_range,
        )
    except Exception as e:
        logger.error("Goal progress failed for user %s: %s", current_user.id, e, exc_info=True)
        return _fallback_payload(
            "Goal progress is temporarily unavailable.",
            goals=[],
            summary={
                "total_goals": 0,
                "completed_goals": 0,
                "overall_progress": 0,
                "avg_confidence": 0,
            },
            score_version=analytics_v2_service.SCORE_VERSION,
            source="fallback",
            confidence=0.2,
            time_range=time_range,
        )


@router.get("/goals/daily-score", response_model=Dict[str, Any])
async def get_daily_achievement_score(
    current_user = Depends(get_current_user)
):
    """
    Get daily achievement score with breakdown.

    Components:
    - Task completion vs planned
    - Habit maintenance
    - Focus time
    - Comparison to weekly average
    """
    _require_ultra(current_user, "goal_progress_detailed")
    try:
        from backend.services.enhanced_goal_analytics_service import enhanced_goal_analytics_service
        score = await enhanced_goal_analytics_service.get_daily_achievement_score(
            str(current_user.id)
        )
        return score
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get daily score: {str(e)}"
        )


@router.get("/goals/timeline", response_model=List[Dict[str, Any]])
async def get_goal_timeline(
    current_user = Depends(get_current_user)
):
    """
    Get visual timeline data for goals.

    Returns:
    - Goal deadlines with urgency levels
    - Milestone markers
    - Progress overlay data
    """
    _require_ultra(current_user, "goal_progress_detailed")
    try:
        from backend.services.enhanced_goal_analytics_service import enhanced_goal_analytics_service
        timeline = await enhanced_goal_analytics_service.get_goal_timeline(
            str(current_user.id)
        )
        return timeline
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get goal timeline: {str(e)}"
        )


@router.get("/goals/{goal_id}/health", response_model=Dict[str, Any])
async def get_goal_health(
    goal_id: int,
    current_user = Depends(get_current_user)
):
    """
    Get health metrics for a specific goal.

    Returns detailed analysis including:
    - Velocity vs required velocity
    - On-time probability
    - Contributing habits impact
    - Trend analysis
    """
    _require_ultra(current_user, "goal_progress_detailed")
    try:
        from backend.services.enhanced_goal_analytics_service import enhanced_goal_analytics_service
        report = await enhanced_goal_analytics_service.get_goal_progress_report(
            str(current_user.id),
            str(goal_id)
        )

        if not report.get("goals"):
            raise HTTPException(status_code=404, detail="Goal not found")

        return report["goals"][0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get goal health: {str(e)}"
        )

@router.get("/big-five", response_model=Dict[str, Any])
async def get_big_five_profile(current_user = Depends(get_current_user)):
    """Get Big Five Behavioral Profile (rolling behavioral average)"""
    try:
        from backend.services.big_five_service import big_five_service
        return await big_five_service.get_profile(current_user.id)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to calculate Big Five profile: {str(e)}"
        )


# ─────────────────────────────────────────────────────────────────────
# BIG FIVE PERSONALITY TEST ENDPOINTS
# ─────────────────────────────────────────────────────────────────────

@router.get("/big-five-test/status", response_model=Dict[str, Any])
async def get_big_five_test_status(current_user = Depends(get_current_user)):
    """
    Get the current status of the Big Five personality test.
    
    Returns:
        - has_completed_test: Whether user has completed a test
        - test_in_progress: Whether there's an active test session
        - current_scores: Latest personality scores (if available)
        - days_until_next_test: Days until next test is available
        - can_take_test: Whether user can start a new test
    """
    try:
        from backend.services.big_five_test_service import big_five_test_service
        return await big_five_test_service.get_test_status(current_user.id)
    except Exception as e:
        logger.error("Big Five status failed for user %s: %s", current_user.id, e, exc_info=True)
        return {
            "has_completed_test": False,
            "test_in_progress": False,
            "current_scores": None,
            "days_until_next_test": 0,
            "next_test_available": True,
            "can_take_test": True,
            "error_fallback": True,
        }


@router.post("/big-five-test/start", response_model=Dict[str, Any])
async def start_big_five_test(
    payload: Optional[Dict[str, Any]] = Body(default=None),
    current_user = Depends(get_current_user)
):
    """
    Start a new Big Five personality test or resume an existing one.
    
    Returns the first question and test metadata.
    `force_new=true` restarts with a fresh question set.
    """
    try:
        from backend.services.big_five_test_service import big_five_test_service
        force_new = bool((payload or {}).get("force_new", False))
        result = await big_five_test_service.start_test(current_user.id, force_new=force_new)
        
        if "error" in result:
            detail = result["error"]
            # Cooldown/business-rule block: retry after plan interval window.
            if result.get("can_retry") is False and result.get("days_remaining") is not None:
                raise HTTPException(status_code=429, detail=detail)

            # Service-level failures should surface as server errors, not bad requests.
            if isinstance(detail, str) and detail.startswith("Failed to start test:"):
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=detail,
                )

            raise HTTPException(status_code=400, detail=detail)
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to start test: {str(e)}"
        )


class BigFiveAnswerRequest(BaseModel):
    test_id: int
    response: int  # 1-5 Likert scale


@router.post("/big-five-test/answer", response_model=Dict[str, Any])
async def answer_big_five_question(
    payload: BigFiveAnswerRequest,
    current_user = Depends(get_current_user)
):
    """
    Submit an answer for the current Big Five test question.
    
    Args:
        test_id: The test ID
        response: User's response (1-5 scale)
            1 = Disagree strongly
            2 = Disagree a little
            3 = Neither agree nor disagree
            4 = Agree a little
            5 = Agree strongly
    
    Returns:
        - If more questions: Next question
        - If complete: Final scores and profile
    """
    try:
        from backend.services.big_five_test_service import big_five_test_service
        result = await big_five_test_service.answer_question(
            user_id=current_user.id,
            test_id=payload.test_id,
            response=payload.response
        )
        
        if "error" in result:
            raise HTTPException(status_code=400, detail=result["error"])
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process answer: {str(e)}"
        )


@router.get("/big-five-test/profile", response_model=Dict[str, Any])
async def get_big_five_test_profile(current_user = Depends(get_current_user)):
    """
    Get the completed Big Five personality profile from the test.
    
    Returns scores with behavioral adjustments applied.
    Includes trait descriptions and insights.
    """
    try:
        from backend.services.big_five_test_service import big_five_test_service
        
        profile = await big_five_test_service.get_completed_profile(current_user.id)
        
        if not profile:
            raise HTTPException(
                status_code=404,
                detail="No completed personality test found. Take the test to unlock your Big Five profile."
            )
        
        # Add trait descriptions
        scores = profile["scores"]
        descriptions = {}
        for trait, score in scores.items():
            descriptions[trait] = big_five_test_service.get_trait_description(trait, score)
        
        profile["descriptions"] = descriptions
        
        return profile
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get profile: {str(e)}"
        )


@router.post("/big-five-test/adjust", response_model=Dict[str, Any])
async def apply_behavioral_adjustments(current_user = Depends(get_current_user)):
    """
    Apply behavioral adjustments to Big Five scores based on recent activity.
    
    This is typically called automatically but can be triggered manually.
    Adjustments are capped at ±5 points to prevent drastic changes.
    """
    try:
        from backend.services.big_five_test_service import big_five_test_service
        result = await big_five_test_service.apply_behavioral_adjustment(current_user.id)
        
        if "error" in result:
            raise HTTPException(status_code=400, detail=result["error"])
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to apply adjustments: {str(e)}"
        )
