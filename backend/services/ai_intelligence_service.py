# backend/services/ai_intelligence_service.py
from datetime import datetime, timedelta, time
from typing import Dict, Any, List, Optional
from sqlalchemy import select, func, and_, or_, case, extract
from sqlalchemy.orm import Session
import logging

from backend.db.database import get_db
from backend.db.models import (
    Task, 
    Plan, 
    Goal, 
    UserInsight, 
    AnalyticsEvent, 
    ChatMessage,
    ChatSession,
    RealTimeMetrics
)

logger = logging.getLogger(__name__)

class AIIntelligenceService:
    """
    AI Intelligence Score Service (Refactored)
    Measures "Quality of decisions and alignment over time."
    
    Formula:
    Score = 0.30 * Planning Quality
          + 0.30 * Execution Intelligence
          + 0.20 * Adaptation & Reflection
          + 0.20 * Behavioral Stability
    """

    async def get_score(self, user_id: int, time_range: str = 'daily') -> Dict[str, Any]:
        """
        Get AI Intelligence Score based on time range.
        supported ranges: 'daily', 'weekly', 'monthly'
        """
        try:
            async for db in get_db():
                if time_range == 'weekly':
                    return await self._calculate_weekly_score(db, user_id)
                elif time_range == 'monthly':
                    return await self._calculate_monthly_score(db, user_id)
                else:
                    return await self._calculate_daily_score(db, user_id)
        except Exception as e:
            logger.error(f"Error calculating AI intelligence score: {e}", exc_info=True)
            return {
                "score": 50,
                "category": "Calibration Needed",
                "metrics": {
                    "planning_quality": 50,
                    "execution_intelligence": 50,
                    "adaptation_reflection": 50,
                    "behavioral_stability": 50
                },
                "last_updated": datetime.utcnow().isoformat(),
                "error": str(e)
            }

    async def _calculate_daily_score(self, db: Session, user_id: int, target_date: datetime = None) -> Dict[str, Any]:
        """Calculate score for a specific day (default today)."""
        if not target_date:
            target_date = datetime.utcnow()
            
        start_of_day = datetime.combine(target_date.date(), time.min)
        end_of_day = datetime.combine(target_date.date(), time.max)

        # 1. Planning Quality (30%)
        planning_score = await self._calculate_planning_quality(db, user_id, start_of_day, end_of_day)
        
        # 2. Execution Intelligence (30%)
        execution_score = await self._calculate_execution_intelligence(db, user_id, start_of_day, end_of_day)
        
        # 3. Adaptation & Reflection (20%)
        adaptation_score = await self._calculate_adaptation_reflection(db, user_id, start_of_day, end_of_day)
        
        # 4. Behavioral Stability (20%)
        stability_score = await self._calculate_behavioral_stability(db, user_id, start_of_day)

        # Final Weighted Score
        raw_score = (
            (planning_score * 0.30) +
            (execution_score * 0.30) +
            (adaptation_score * 0.20) +
            (stability_score * 0.20)
        )
        
        final_score = max(0, min(100, round(raw_score)))
        
        return {
            "score": final_score,
            "category": self._get_category(final_score),
            "metrics": {
                "planning_quality": round(planning_score),
                "execution_intelligence": round(execution_score),
                "adaptation_reflection": round(adaptation_score),
                "behavioral_stability": round(stability_score)
            },
            "last_updated": datetime.utcnow().isoformat()
        }

    async def _calculate_weekly_score(self, db: Session, user_id: int) -> Dict[str, Any]:
        """Arithmetic mean of last 7 days."""
        scores = []
        metric_samples: List[Dict[str, int]] = []
        today = datetime.utcnow()
        
        for i in range(7):
            date_val = today - timedelta(days=i)
            day_result = await self._calculate_daily_score(db, user_id, date_val)
            scores.append(day_result["score"])
            if day_result.get("metrics"):
                metric_samples.append(day_result["metrics"])
             
        avg_score = sum(scores) / len(scores) if scores else 0
        final_score = round(avg_score)
        recent_avg = sum(scores[:3]) / 3 if len(scores) >= 3 else avg_score
        previous_avg = sum(scores[3:6]) / 3 if len(scores) >= 6 else avg_score
        trend_delta = recent_avg - previous_avg
        trend_percent = round(trend_delta, 1)

        if trend_delta > 0.5:
            trend = "up"
        elif trend_delta < -0.5:
            trend = "down"
        else:
            trend = "stable"

        if metric_samples:
            metrics = {
                "planning_quality": round(sum(m["planning_quality"] for m in metric_samples) / len(metric_samples)),
                "execution_intelligence": round(sum(m["execution_intelligence"] for m in metric_samples) / len(metric_samples)),
                "adaptation_reflection": round(sum(m["adaptation_reflection"] for m in metric_samples) / len(metric_samples)),
                "behavioral_stability": round(sum(m["behavioral_stability"] for m in metric_samples) / len(metric_samples)),
            }
        else:
            metrics = None
        
        return {
            "score": final_score,
            "category": self._get_category(final_score),
            "context_label": self._get_weekly_context_label(scores),
            "trend": trend,
            "trend_percent": trend_percent,
            "metrics": metrics,
            "last_updated": datetime.utcnow().isoformat(),
        }

    async def _calculate_monthly_score(self, db: Session, user_id: int) -> Dict[str, Any]:
        """Monthly stats and trend."""
        scores = []
        metric_samples: List[Dict[str, int]] = []
        today = datetime.utcnow()
        
        # Sample every day for last 30 days
        for i in range(30):
            date_val = today - timedelta(days=i)
            day_result = await self._calculate_daily_score(db, user_id, date_val)
            scores.append(day_result["score"])
            if day_result.get("metrics"):
                metric_samples.append(day_result["metrics"])
        
        avg_score = sum(scores) / len(scores) if scores else 0
        final_score = round(avg_score)
        
        # Volatility: Standard deviation-ish (max diff)
        volatility = max(scores) - min(scores) if scores else 0
        recent_avg = sum(scores[:7]) / 7 if len(scores) >= 7 else avg_score
        previous_avg = sum(scores[7:14]) / 7 if len(scores) >= 14 else avg_score
        trend_delta = recent_avg - previous_avg

        if trend_delta > 0.5:
            trend = "up"
        elif trend_delta < -0.5:
            trend = "down"
        else:
            trend = "stable"

        if metric_samples:
            metrics = {
                "planning_quality": round(sum(m["planning_quality"] for m in metric_samples) / len(metric_samples)),
                "execution_intelligence": round(sum(m["execution_intelligence"] for m in metric_samples) / len(metric_samples)),
                "adaptation_reflection": round(sum(m["adaptation_reflection"] for m in metric_samples) / len(metric_samples)),
                "behavioral_stability": round(sum(m["behavioral_stability"] for m in metric_samples) / len(metric_samples)),
            }
        else:
            metrics = None
        
        return {
            "score": final_score,
            "category": self._get_category(final_score),
            "volatility": volatility,
            "best_day_score": max(scores) if scores else 0,
            "worst_day_score": min(scores) if scores else 0,
            "trend": trend,
            "trend_percent": round(trend_delta, 1),
            "context_label": self._get_weekly_context_label(scores),
            "metrics": metrics,
            "last_updated": datetime.utcnow().isoformat(),
        }

    # -------------------------------------------------------------------------
    # COMPONENT CALCULATIONS
    # -------------------------------------------------------------------------

    async def _calculate_planning_quality(self, db: Session, user_id: int, start: datetime, end: datetime) -> float:
        """
        Planning Quality (30%):
        - Tasks created before execution (proactive vs reactive)
        - Reasonable task count (avoid overload)
        - Tasks linked to goals (usage of tags/categories)
        """
        # Get tasks active today (created today OR completed today OR pending)
        # Actually, let's look at tasks created today or due today
        
        # 1. Proactivity: Tasks active today that were created BEFORE today
        #    vs Tasks created today and done today (reactive)
        
        result = await db.execute(
            select(Task).where(
                and_(
                    Task.user_id == user_id,
                    # Task interaction today (created or completed)
                    or_(
                        and_(Task.created_at >= start, Task.created_at <= end),
                        and_(Task.completed_at >= start, Task.completed_at <= end)
                    )
                )
            )
        )
        tasks = result.scalars().all()
        
        if not tasks:
            return 50.0 # Neutral baseline if no activity
            
        proactive_tasks = [t for t in tasks if t.created_at < start]
        reactive_tasks = [t for t in tasks if t.created_at >= start]
        
        total_active_count = len(tasks)
        
        # Score 1: Proactivity Ratio
        # Ideally, you want a mix, but too much reactivity is bad.
        # If > 50% tasks are pre-planned, that's good.
        if total_active_count > 0:
            proactivity_ratio = len(proactive_tasks) / total_active_count
            proactivity_score = min(100, proactivity_ratio * 150) # Boost simple ratio
        else:
            proactivity_score = 50.0
            
        # Score 2: Overload Penalty
        # If today's due/active tasks > 15, logic penalty
        overload_penalty = 1.0
        if total_active_count > 15:
            overload_penalty = 0.7
        elif total_active_count > 10:
            overload_penalty = 0.9
            
        # Score 3: Goal Linkage (Tags check)
        # Check if tasks have tags (proxy for organization/goal linking)
        tagged_tasks = [t for t in tasks if t.tags and len(t.tags) > 0]
        linkage_score = (len(tagged_tasks) / total_active_count * 100) if total_active_count > 0 else 0
        
        # Combine
        # 50% Proactivity, 50% Linkage, then applied penalty
        raw_planning = (proactivity_score * 0.5) + (linkage_score * 0.5)
        return raw_planning * overload_penalty

    async def _calculate_execution_intelligence(self, db: Session, user_id: int, start: datetime, end: datetime) -> float:
        """
        Execution Intelligence (30%):
        - High priority tasks completed
        - Deep work blocks used
        - Time accuracy
        """
        # Get completed tasks for today
        result = await db.execute(
            select(Task).where(
                Task.user_id == user_id,
                Task.status == 'completed',
                Task.completed_at >= start,
                Task.completed_at <= end
            )
        )
        completed_tasks = result.scalars().all()
        
        if not completed_tasks:
            # Check if they had tasks to do? If they had tasks but did 0 => 0 score.
            # If no tasks scheduled, neutral.
            return 0.0 # Tough love: 0 execution if nothing done.
            
        # 1. Priority Impact
        # High/Urgent tasks count more
        weighted_sum = 0
        for t in completed_tasks:
            if t.priority == 'urgent': weighted_sum += 3
            elif t.priority == 'high': weighted_sum += 2
            else: weighted_sum += 1
            
        # Max reasonable score ~ 5 high tasks = 10 pts. Normalize to 100.
        # Let's say 10 points = 100.
        priority_score = min(100, weighted_sum * 10)
        
        # 2. Deep Work Usage
        # Check if deep work was planned and executed
        dw_result = await db.execute(
            select(Plan).where(
                Plan.user_id == user_id,
                Plan.plan_type == 'deep_work',
                Plan.date >= start,
                Plan.date <= end
            )
        )
        deep_works = dw_result.scalars().all()
        dw_score = 50.0 # Default if no deep work planned
        
        if deep_works:
            blocks_completed = 0
            for dw in deep_works:
                # Check schedule json for completion status or heuristic
                if dw.schedule:
                    if isinstance(dw.schedule, dict) and dw.schedule.get('completed', False):
                        blocks_completed += 1
                    elif isinstance(dw.schedule, list):
                        # If list of blocks, check if *any* block is marked done or if plan itself is 'completed'?
                        # Fallback: check focus_score or just assume 50% if present
                        # For now, simplistic check: valid non-empty schedule = good effort
                        blocks_completed += 0.5 
            
            dw_score = min(100, (blocks_completed / len(deep_works)) * 100)
        
        # Combine
        return (priority_score * 0.6) + (dw_score * 0.4)

    async def _calculate_adaptation_reflection(self, db: Session, user_id: int, start: datetime, end: datetime) -> float:
        """
        Adaptation & Reflection (20%):
        - Insights view rate
        - Chat reflection keywords
        - Plan modifications (adaptability)
        """
        # 1. Insight Interaction
        insight_res = await db.execute(
            select(func.count(UserInsight.id)).where(
                UserInsight.user_id == user_id,
                UserInsight.generated_at >= start,
                UserInsight.read_at != None
            )
        )
        insights_read = insight_res.scalar() or 0
        insight_score = min(100, insights_read * 50) # 2 insights read = 100%
        
        # 2. Chat Reflection
        # Keywords: failure, why, adjust, change, plan
        reflection_keywords = ["why", "fail", "adjust", "change", "plan", "review", "wrong"]
        # Join through ChatSession to get user_id (ChatMessage only has session_id)
        chat_res = await db.execute(
            select(ChatMessage.content)
            .join(ChatSession, ChatMessage.session_id == ChatSession.id)
            .where(
                ChatSession.user_id == user_id,
                ChatMessage.role == 'user',
                ChatMessage.created_at >= start,
                ChatMessage.created_at <= end
            )
        )
        messages = chat_res.scalars().all()
        reflection_count = 0
        for msg in messages:
            text = (msg or "").lower()
            if any(k in text for k in reflection_keywords):
                reflection_count += 1
        
        chat_score = min(100, reflection_count * 30) # ~3 reflective messages = near 100
        
        # Combine (if no chat, rely on insights, and vice versa)
        if not messages and insights_read == 0:
            return 45.0 # Baseline
            
        return max(insight_score, chat_score) # Take the best signal

    async def _calculate_behavioral_stability(self, db: Session, user_id: int, today_start: datetime) -> float:
        """
        Behavioral Stability (20%):
        - Consistency with yesterday
        - No 0 -> 100 swings
        """
        yesterday_start = today_start - timedelta(days=1)
        yesterday_end = today_start - timedelta(seconds=1)
        
        # Get Task completion counts for Today vs Yesterday
        today_res = await db.execute(
            select(func.count(Task.id)).where(
                Task.user_id == user_id,
                Task.status == 'completed',
                Task.completed_at >= today_start
            )
        )
        today_count = today_res.scalar() or 0
        
        yesterday_res = await db.execute(
            select(func.count(Task.id)).where(
                Task.user_id == user_id,
                Task.status == 'completed',
                Task.completed_at.between(yesterday_start, yesterday_end)
            )
        )
        yesterday_count = yesterday_res.scalar() or 0
        
        # Stability Logic
        if yesterday_count == 0 and today_count == 0:
            return 20.0 # Low activity stability
            
        if yesterday_count == 0 and today_count > 0:
            return 80.0 # Recovery bonus!
            
        if yesterday_count > 0 and today_count == 0:
            return 40.0 # Dropoff
            
        # Variance check
        # If counts are similar, high stability
        diff = abs(today_count - yesterday_count)
        max_val = max(today_count, yesterday_count)
        
        stability_ratio = 1.0 - (diff / max_val) # 1.0 = perfect match
        return stability_ratio * 100

    def _get_category(self, score: int) -> str:
        if score < 45: return "Developing Awareness"
        if score < 65: return "Conscious Planner"
        if score < 85: return "Strategic Thinker"
        return "Master Optimizer"

    def _get_weekly_context_label(self, scores: List[int]) -> str:
        if not scores: return "No data"
        avg = sum(scores) / len(scores)
        
        if avg > 80: return "High Performance"
        if avg > 60: return "Stable Execution"
        if avg > 40: return "Building Consistency"
        return "Needs Calibration"

ai_intelligence_service = AIIntelligenceService()
