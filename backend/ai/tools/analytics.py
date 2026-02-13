# backend/ai/tools/analytics.py
"""
Enhanced analytics tool with AI-powered analysis and insights.
"""

from typing import Dict, Any, List, Optional
import logging
from datetime import datetime, timedelta
import asyncio

from backend.services.analytics_service import analytics_service
from backend.ai.memory.context_builder import build_analytics_context
from backend.services.mood_service import mood_service
from backend.services.ai_intelligence_service import ai_intelligence_service

logger = logging.getLogger(__name__)

async def log_event(user_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Enhanced event logging with immediate AI analysis for significant events.
    """
    try:
        # Add server-side timestamp and ensure user_id
        event = {
            "user_id": user_id,
            "event": payload.get("event", "unknown"),
            "source": payload.get("source", "unknown"),
            "timestamp": datetime.utcnow().isoformat(),
            "metadata": payload.get("metadata", {}),
            **{k: v for k, v in payload.items() if k not in ["event", "source", "metadata"]}
        }

        # Persist event
        saved_event = await analytics_service.save_event(event)
        
        # Check if event is significant for immediate AI analysis
        if _is_ai_significant_event(event):
            asyncio.create_task(
                _analyze_event_with_ai(user_id, event, saved_event.id)
            )
        
        logger.info(f"Event logged for user {user_id}: {event['event']}")
        
        return {
            "status": "logged",
            "event_id": getattr(saved_event, "id", None),
            "timestamp": event["timestamp"],
            "ai_analysis": "queued" if _is_ai_significant_event(event) else "skipped",
        }

    except Exception as e:
        logger.error(f"Failed to log event for user {user_id}: {str(e)}")
        return {
            "status": "error",
            "message": str(e)
        }

async def analyze_behavior_patterns(
    user_id: str, 
    events: Optional[List[Dict[str, Any]]] = None,
    sessions: Optional[List[Dict[str, Any]]] = None,
    plans: Optional[List[Dict[str, Any]]] = None,
    context: str = "general"
) -> Dict[str, Any]:
    """
    Analyze behavior patterns using AI.
    Can be called with specific data or fetches from service.
    """
    try:
        # If no events provided, fetch recent ones
        if events is None:
            events = await analytics_service.get_recent_events(user_id, limit=100)
        
        # Build context for AI
        ai_context = await build_analytics_context(
            user_id=user_id,
            events=events,
            sessions=sessions,
            plans=plans,
            context_type=context
        )
        
        # Get AI client
        from backend.ai.client import get_ai_client
        ai_client = get_ai_client()
        
        # Prepare prompt for pattern analysis
        prompt = f"""
        Analyze this user's behavior patterns and provide insights:
        
        Context: {context}
        
        Recent Activity Summary:
        {_summarize_events_for_ai(events)}
        
        Please analyze and provide:
        1. Key behavioral patterns detected
        2. Productivity insights
        3. Potential areas for improvement
        4. Personalized recommendations
        
        Be concise and actionable.
        """
        
        # Call AI
        ai_response = await ai_client.analyze(
            prompt=prompt,
            context=ai_context,
            analysis_type="behavior_patterns"
        )
        
        # Parse AI response
        insights = _parse_ai_insights(ai_response)
        
        # Save AI analysis
        if insights:
            await analytics_service.save_ai_analysis(user_id, {"event": "ai_analysis"}, insights)
        
        logger.info(f"AI behavior analysis completed for user {user_id}")
        
        return {
            "status": "success",
            "insights": insights.get("insights", []),
            "patterns": insights.get("patterns", []),
            "recommendations": insights.get("recommendations", []),
            "summary": insights.get("summary", ""),
        }
        
    except Exception as e:
        logger.error(f"AI behavior analysis failed for user {user_id}: {str(e)}")
        return {
            "status": "error",
            "message": str(e),
            "insights": [],
            "patterns": [],
            "recommendations": [
                "Review your task completion patterns",
                "Schedule focus sessions during peak hours",
                "Break large goals into weekly milestones"
            ],
        }

async def generate_ai_insight(
    user_id: str,
    focus_area: str = "productivity"
) -> Dict[str, Any]:
    """
    Generate AI-powered insight for a specific focus area.
    """
    try:
        # Get comprehensive analytics
        analytics_data = await analytics_service.get_comprehensive_analytics(user_id)
        
        # Get AI client
        from backend.ai.client import get_ai_client
        ai_client = get_ai_client()
        
        # Prepare focused prompt
        prompt = f"""
        Generate a personalized insight for this user focusing on {focus_area}.
        
        User Analytics Summary:
        - Focus Score: {analytics_data['metrics']['focus']['score']}
        - Planning Accuracy: {analytics_data['metrics']['planning']['accuracy']:.1f}%
        - Habit Consistency: {analytics_data['metrics']['consistency']['consistency_score']:.1f}%
        - Recent Patterns: {[p['type'] for p in analytics_data['patterns'][:3]]}
        
        Please provide:
        1. One key insight about their {focus_area}
        2. Why this matters
        3. One actionable recommendation
        4. Confidence level (0-100%)
        
        Keep it concise and encouraging.
        """
        
        ai_response = await ai_client.generate_insight(
            prompt=prompt,
            user_context={"user_id": user_id, "focus_area": focus_area}
        )
        
        # Parse response
        insight = _parse_ai_insight_response(ai_response)
        insight["focus_area"] = focus_area
        insight["generated_at"] = datetime.utcnow().isoformat()
        
        # Save insight
        await analytics_service.save_insight(user_id, {
            "title": insight.get("title", f"{focus_area.title()} Insight"),
            "description": insight.get("description", ""),
            "type": "ai_generated",
            "category": focus_area,
            "severity": "info",
            "confidence": insight.get("confidence", 70),
            "action_items": [insight.get("recommendation", "")] if insight.get("recommendation") else [],
        })
        
        return insight
        
    except Exception as e:
        logger.error(f"AI insight generation failed: {e}")
        return {
            "title": f"{focus_area.title()} Insight",
            "description": f"Focus on improving your {focus_area} through consistent practice.",
            "confidence": 50,
            "recommendation": "Review your recent activity and identify one small improvement.",
        }

async def predict_user_trajectory(
    user_id: str,
    timeframe: str = "weekly"
) -> Dict[str, Any]:
    """
    Predict user's productivity trajectory using AI.
    """
    try:
        # Get historical data
        events = await analytics_service.get_recent_events(user_id, limit=200)
        analytics_data = await analytics_service.get_comprehensive_analytics(user_id)
        
        analytics_data = await analytics_service.get_comprehensive_analytics(user_id)
        
        # Get AI client
        from backend.ai.client import get_ai_client
        ai_client = get_ai_client()
        
        prompt = f"""
        Predict this user's productivity trajectory for the next {timeframe}.
        
        Current Status:
        - Focus: {analytics_data['metrics']['focus']['score']}/100
        - Planning: {analytics_data['metrics']['planning']['accuracy']:.1f}%
        - Consistency: {analytics_data['metrics']['consistency']['consistency_score']:.1f}%
        
        Recent Trends:
        {_summarize_trends_for_ai(events)}
        
        Please predict:
        1. Likely trajectory (improving/stable/declining)
        2. Key factors influencing this
        3. Probability (0-100%)
        4. Suggested interventions if negative
        
        Be realistic and data-informed.
        """
        
        ai_response = await ai_client.predict(
            prompt=prompt,
            prediction_type="trajectory"
        )
        
        prediction = _parse_prediction_response(ai_response)
        prediction["timeframe"] = timeframe
        prediction["generated_at"] = datetime.utcnow().isoformat()
        
        return prediction
        
    except Exception as e:
        logger.error(f"Trajectory prediction failed: {e}")
        return {
            "trajectory": "stable",
            "confidence": 50,
            "factors": ["Insufficient data for prediction"],
            "recommendation": "Continue current patterns and check back next week.",
        }

async def get_analytics_summary(user_id: str) -> Dict[str, Any]:
    """
    Get a concise summary of all analytics metrics for the AI to query.
    Used for answering "How am I doing?" or "What are my scores?".
    """
    try:
        # Get comprehensive data from services
        comprehensive = await analytics_service.get_comprehensive_analytics(int(user_id))
        mood_data = await mood_service.calculate_current_mood(int(user_id))
        intel_data = await ai_intelligence_service.get_score(int(user_id))
        
        metrics = comprehensive.get("metrics", {})
        
        return {
            "status": "success",
            "scores": {
                "focus": metrics.get("focus", {}).get("score", 0),
                "productivity": metrics.get("productivity", {}).get("score", 0),
                "consistency": metrics.get("consistency", {}).get("consistency_score", 0),
                "mood": mood_data.get("score", 0),
                "intelligence": intel_data.get("score", 0),
                "burnout_risk": metrics.get("wellbeing", {}).get("burnout_risk", 0)
            },
            "labels": {
                "mood_label": mood_data.get("label", "Neutral"),
                "status": intel_data.get("category", "Getting Started")
            },
            "patterns": [p.get("type", "unknown") for p in comprehensive.get("patterns", [])[:3]],
            "last_updated": comprehensive.get("last_updated")
        }
    except Exception as e:
        logger.error(f"Failed to get analytics summary: {e}")
        return {"status": "error", "message": str(e)}

async def _analyze_event_with_ai(user_id: str, event: Dict[str, Any], event_id: int):
    """Analyze significant event with AI"""
    try:
        from backend.ai.client import get_ai_client
        ai_client = get_ai_client()
        
        prompt = f"""
        Analyze this user event and provide immediate insight:
        
        Event: {event['event']}
        Source: {event['source']}
        Metadata: {event.get('metadata', {})}
        Time: {event['timestamp']}
        
        Please provide:
        1. Brief analysis of what this event indicates
        2. One immediate insight
        3. Suggested follow-up action (if any)
        
        Keep it very concise (1-2 sentences each).
        """
        
        ai_response = await ai_client.analyze_immediate(
            prompt=prompt,
            event_context=event
        )
        
        # Save AI analysis
        if ai_response:
            await analytics_service.save_ai_analysis(user_id, event, {
                "type": "event_analysis",
                "content": ai_response,
                "event_id": event_id,
            })
            
    except Exception as e:
        logger.error(f"Event AI analysis failed: {e}")

def _is_ai_significant_event(event: Dict[str, Any]) -> bool:
    """Determine if event warrants immediate AI analysis"""
    significant_events = [
        "task_completed",
        "deep_work_completed",
        "habit_streak_broken",
        "habit_streak_extended", 
        "vent_detected",
        "planning_session",
        "reflection_session",
        "goal_achieved",
        "goal_abandoned",
    ]
    return event.get("event") in significant_events

def _summarize_events_for_ai(events: List[Dict[str, Any]]) -> str:
    """Summarize events for AI consumption"""
    if not events:
        return "No recent events"
    
    # Group by type
    event_counts = {}
    for event in events:
        event_type = event.get("event", "unknown")
        event_counts[event_type] = event_counts.get(event_type, 0) + 1
    
    summary = []
    for event_type, count in sorted(event_counts.items(), key=lambda x: x[1], reverse=True)[:5]:
        summary.append(f"- {event_type}: {count} times")
    
    return "\n".join(summary)

def _summarize_trends_for_ai(events: List[Dict[str, Any]]) -> str:
    """Extract trends from events for AI"""
    if len(events) < 10:
        return "Insufficient data for trend analysis"
    
    # Get events from last 7 days vs previous 7 days
    recent_cutoff = datetime.utcnow() - timedelta(days=7)
    older_cutoff = recent_cutoff - timedelta(days=7)
    
    recent_events = [e for e in events if _parse_timestamp(e) > recent_cutoff]
    older_events = [e for e in events if older_cutoff < _parse_timestamp(e) <= recent_cutoff]
    
    trends = []
    
    # Compare counts
    if len(recent_events) > len(older_events) * 1.5:
        trends.append("Increasing activity levels")
    elif len(recent_events) < len(older_events) * 0.7:
        trends.append("Decreasing activity levels")
    
    # Check for specific patterns
    recent_task_completions = len([e for e in recent_events if e.get("event") == "task_completed"])
    older_task_completions = len([e for e in older_events if e.get("event") == "task_completed"])
    
    if recent_task_completions > older_task_completions:
        trends.append("Improving task completion")
    elif recent_task_completions < older_task_completions:
        trends.append("Declining task completion")
    
    return "\n".join(trends) if trends else "Stable patterns observed"

def _parse_timestamp(event: Dict[str, Any]) -> datetime:
    """Parse timestamp from event"""
    try:
        return datetime.fromisoformat(event["timestamp"].replace('Z', '+00:00'))
    except:
        return datetime.utcnow()

def _parse_ai_insights(ai_response: Dict[str, Any]) -> Dict[str, Any]:
    """Parse AI response into structured insights"""
    # This would depend on your AI's response format
    # Here's a generic parser
    if not ai_response or "content" not in ai_response:
        return {"insights": [], "patterns": [], "recommendations": []}
    
    content = ai_response["content"]
    
    # Extract sections (this is simplified)
    insights = []
    if "insights" in content:
        insights = content["insights"]
    
    patterns = []
    if "patterns" in content:
        patterns = content["patterns"]
    
    recommendations = []
    if "recommendations" in content:
        recommendations = content["recommendations"]
    
    return {
        "insights": insights,
        "patterns": patterns,
        "recommendations": recommendations,
        "summary": content.get("summary", ""),
    }

def _parse_ai_insight_response(ai_response: Dict[str, Any]) -> Dict[str, Any]:
    """Parse AI insight response"""
    if not ai_response or "content" not in ai_response:
        return {
            "title": "Productivity Insight",
            "description": "Focus on consistent daily progress.",
            "confidence": 50,
            "recommendation": "Review your goals weekly.",
        }
    
    content = ai_response["content"]
    
    return {
        "title": content.get("title", "Insight"),
        "description": content.get("description", ""),
        "confidence": content.get("confidence", 70),
        "recommendation": content.get("recommendation", ""),
    }

def _parse_prediction_response(ai_response: Dict[str, Any]) -> Dict[str, Any]:
    """Parse prediction response"""
    if not ai_response or "content" not in ai_response:
        return {
            "trajectory": "stable",
            "confidence": 50,
            "factors": ["Limited data available"],
            "recommendation": "Continue current patterns",
        }
    
    content = ai_response["content"]
    
    return {
        "trajectory": content.get("trajectory", "stable"),
        "confidence": content.get("confidence", 50),
        "factors": content.get("factors", []),
        "recommendation": content.get("recommendation", ""),
    }

# Maintain backward compatibility
async def log_event_simple(user_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    """Simple version for backward compatibility"""
    return await log_event(user_id, payload)