# backend/services/time_intelligence.py
"""
Time Intelligence Service - AI-powered temporal analytics.
"""

from datetime import datetime, timedelta, time
from typing import Dict, Any, List, Optional
import logging
from sqlalchemy import select, func, and_
from sqlalchemy.orm import Session

from backend.db.database import get_db
from backend.db.models import Task, AnalyticsEvent, UserInsight
# Avoid circular import by not importing FocusScoreService here directly unless needed inside methods

logger = logging.getLogger(__name__)

class TimeIntelligenceService:
    """
    Self-learning temporal analytics system.
    """

    # ─────────────────────────────────────────────────────────────────────
    # 1. PERSONAL CHRONOTYPE DETECTION
    # ─────────────────────────────────────────────────────────────────────
    
    async def detect_chronotype(self, user_id: int) -> Dict[str, Any]:
        """
        Analyze user activity over last 30 days to determine chronotype.
        """
        try:
            async for db in get_db():
                # Analyze task completions by hour
                start_date = datetime.utcnow() - timedelta(days=30)
                
                # Get completion timestamps
                result = await db.execute(
                    select(func.extract('hour', Task.completed_at).label('hour'), func.count(Task.id))
                    .where(
                        Task.user_id == user_id,
                        Task.status == 'completed',
                        Task.completed_at >= start_date
                    )
                    .group_by('hour')
                )
                
                hour_counts = {int(row[0]): row[1] for row in result.fetchall() if row[0] is not None}
                
                if not hour_counts:
                    return {
                        "type": "Adaptive",
                        "description": "Not enough data yet", 
                        "peak_hours": [],
                        "low_energy_hours": []
                    }

                # Identify peak windows (simple clustering)
                morning_score = sum(hour_counts.get(h, 0) for h in range(5, 12))
                afternoon_score = sum(hour_counts.get(h, 0) for h in range(12, 17))
                evening_score = sum(hour_counts.get(h, 0) for h in range(17, 23))
                late_score = sum(hour_counts.get(h, 0) for h in [23, 0, 1, 2, 3, 4])
                
                total = sum(hour_counts.values())
                
                chronotype = "Adaptive"
                description = "Balanced activity pattern"
                
                scores = [
                    ("Early Riser", morning_score),
                    ("Midday Power", afternoon_score), 
                    ("Evening Focus", evening_score),
                    ("Night Owl", late_score)
                ]
                scores.sort(key=lambda x: x[1], reverse=True)
                
                primary = scores[0]
                secondary = scores[1]
                
                # Logic for classification
                if primary[1] > total * 0.5:
                    chronotype = primary[0]
                elif (primary[1] + secondary[1]) > total * 0.7:
                    chronotype = f"Dual Phase ({primary[0].split()[0]}/{secondary[0].split()[0]})"
                else:
                    chronotype = primary[0] # Default to strongest signal
                
                # Peak hours detail
                sorted_hours = sorted(hour_counts.items(), key=lambda x: x[1], reverse=True)
                peak_hours = [h[0] for h in sorted_hours[:3]]
                
                # Low energy (hours with 0 or very low activity during day)
                # Filter for "waking hours" 8am-8pm
                waking_hours = range(8, 20)
                low_energy = [h for h in waking_hours if hour_counts.get(h, 0) < total * 0.05]
                
                return {
                    "type": chronotype,
                    "peak_hours": sorted(peak_hours),
                    "low_energy_hours": low_energy,
                    "hourly_activity": hour_counts, # Granular data for heat strip
                    "distribution": {
                        "morning": morning_score,
                        "afternoon": afternoon_score,
                        "evening": evening_score,
                        "night": late_score
                    }
                }
        except Exception as e:
            logger.error(f"Error classifying chronotype: {e}")
            return {"type": "Adaptive", "error": str(e)}

    # ─────────────────────────────────────────────────────────────────────
    # 2. TIME ESTIMATION ACCURACY
    # ─────────────────────────────────────────────────────────────────────

    async def calculate_estimation_accuracy(self, user_id: int) -> Dict[str, Any]:
        """
        Compare estimated vs actual duration.
        """
        try:
            async for db in get_db():
                # Get completed tasks with both estimated and actual minutes
                result = await db.execute(
                    select(Task)
                    .where(
                        Task.user_id == user_id,
                        Task.status == 'completed',
                        Task.estimated_minutes.isnot(None),
                        Task.actual_minutes.isnot(None)
                    )
                    .limit(100) # Analyze last 100 tasks
                )
                tasks = result.scalars().all()
                
                if not tasks:
                    return {"overall_accuracy": 0, "categories": []}
                
                category_stats = {}
                total_accuracy = 0
                count = 0
                
                for task in tasks:
                    if task.estimated_minutes == 0: continue
                    
                    deviation = abs(task.actual_minutes - task.estimated_minutes) / task.estimated_minutes
                    # Cap deviation impact (if task took 10x longer, accuracy is 0, not negative)
                    accuracy = max(0, 100 * (1 - deviation))
                    
                    cat = task.category or "Uncategorized"
                    if cat not in category_stats:
                        category_stats[cat] = {"sum": 0, "count": 0}
                    
                    category_stats[cat]["sum"] += accuracy
                    category_stats[cat]["count"] += 1
                    
                    total_accuracy += accuracy
                    count += 1
                
                categories = []
                for cat, stats in category_stats.items():
                    categories.append({
                        "name": cat,
                        "accuracy": round(stats["sum"] / stats["count"]),
                        "count": stats["count"]
                    })
                
                overall = round(total_accuracy / count) if count > 0 else 0
                
                # Insight generation
                insight = "Keep tracking to improve."
                if overall < 60:
                    insight = "You tend to underestimate tasks."
                elif overall > 80:
                    insight = "Excellent time prediction skills."
                else:
                    insight = "Good estimation, slightly optimistic."

                return {
                    "overall_accuracy": overall,
                    "insight": insight,
                    "categories": categories
                }
        except Exception as e:
            logger.error(f"Error calculating accuracy: {e}")
            return {"error": str(e)}

    # ─────────────────────────────────────────────────────────────────────
    # 3. OPTIMAL WINDOW PREDICTOR
    # ─────────────────────────────────────────────────────────────────────

    async def get_optimal_windows(self, user_id: int) -> List[Dict[str, Any]]:
        """
        Predict top 3 optimal windows for next 48h.
        """
        # In a real AI implementation, this would use a learned model.
        # Here we use the detected chronotype and simple heuristics.
        chronotype_data = await self.detect_chronotype(user_id)
        if "error" in chronotype_data: return []
        
        peak_hours = chronotype_data.get("peak_hours", [])
        if not peak_hours:
            # Default to 9-11am if no data
            peak_hours = [9, 10, 11]
            
        windows = []
        
        # Today
        now = datetime.now()
        current_hour = now.hour
        
        # Check today's remaining peak hours
        for h in peak_hours:
            if h > current_hour:
                windows.append({
                    "start": f"{h}:00",
                    "end": f"{h+2}:00", # Assume 2h block
                    "day": "Today",
                    "confidence": 85 + (5 if h in peak_hours else 0),
                    "reason": "Matches your daily peak energy"
                })
                if len(windows) >= 1: break # Just one for today
        
        # If no window found for today (late in day), look for evening slot if meaningful
        if not windows and current_hour < 18:
             # Fallback "Recovery/Admin" slot in late afternoon
             windows.append({
                 "start": "16:00",
                 "end": "17:00",
                 "day": "Today",
                 "confidence": 65,
                 "reason": "Good for low-energy admin tasks"
             })

        # Tomorrow
        # Add the absolute best slot for tomorrow
        best_hour = peak_hours[0] if peak_hours else 10
        windows.append({
            "start": f"{best_hour:02d}:00",
            "end": f"{best_hour+2:02d}:00",
            "day": "Tomorrow",
            "confidence": 92,
            "reason": "Historical peak productivity window"
        })
        
        # Add a secondary slot tomorrow
        second_best = peak_hours[1] if len(peak_hours) > 1 else (best_hour + 4) % 24
        # Ensure it's reasonable (working hours)
        if second_best < 7: second_best = 14
        
        windows.append({
            "start": f"{second_best:02d}:00",
            "end": f"{second_best+1:02d}:30",
            "day": "Tomorrow",
            "confidence": 78,
            "reason": "Backup focus slot"
        })
        
        return windows[:3]

    # ─────────────────────────────────────────────────────────────────────
    # 4. EFFICIENCY METRICS
    # ─────────────────────────────────────────────────────────────────────

    async def get_efficiency_insights(self, user_id: int) -> Dict[str, Any]:
        """
        Calculate context switching cost, planning overhead etc.
        """
        # Simplified simulation based on completed tasks pattern
        # "Context Switching": adjacent tasks with different categories
        try:
            async for db in get_db():
                # Get tasks completed today
                today = datetime.now().date()
                result = await db.execute(
                    select(Task)
                    .where(
                        Task.user_id == user_id,
                        Task.status == 'completed',
                        func.date(Task.completed_at) == today
                    )
                    .order_by(Task.completed_at)
                )
                tasks = result.scalars().all()
                
                switches = 0
                last_cat = None
                for t in tasks:
                    if last_cat and t.category != last_cat:
                        switches += 1
                    last_cat = t.category
                
                # Planning overhead: mock or minimal for now. 
                # Real implementation would diff created_at vs started_at timestamps if valid
                
                return {
                    "context_switching_loss_hours": round(switches * 0.25, 1), # Assume 15 min loss per switch
                    "planning_overhead_minutes": 15, # Placeholder
                    "recovery_needed_minutes": 30 if len(tasks) > 5 else 0
                }
        except Exception:
            return {}

    async def get_dashboard_data(self, user_id: int) -> Dict[str, Any]:
        """Aggregated data for the dashboard component."""
        return {
            "chronotype": await self.detect_chronotype(user_id),
            "estimation": await self.calculate_estimation_accuracy(user_id),
            "optimal_windows": await self.get_optimal_windows(user_id),
            "efficiency": await self.get_efficiency_insights(user_id)
        }

time_intelligence_service = TimeIntelligenceService()
