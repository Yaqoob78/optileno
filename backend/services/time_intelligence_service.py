# backend/services/time_intelligence_service.py
from datetime import datetime, timedelta, date, time
from typing import Dict, Any, List, Optional
from sqlalchemy import select, func, and_
from sqlalchemy.orm import Session
from collections import defaultdict
import logging

from backend.db.database import get_db
from backend.db.models import Task, FocusScore

logger = logging.getLogger(__name__)

class TimeIntelligenceService:
    async def get_intelligence(self, user_id: int) -> Dict[str, Any]:
        async for db in get_db():
            chronotype_data = await self._analyze_chronotype(db, user_id)
            estimation_data = await self._analyze_estimation(db, user_id)
            optimal_windows = self._calculate_optimal_windows(chronotype_data)
            
            return {
                "chronotype": chronotype_data,
                "estimation": estimation_data,
                "optimal_windows": optimal_windows,
                "efficiency": 85  # Placeholder or calculated metric
            }

    async def _analyze_chronotype(self, db: Session, user_id: int) -> Dict[str, Any]:
        # Fetch completed tasks in last 30 days
        thirty_days_ago = datetime.utcnow() - timedelta(days=30)
        result = await db.execute(
            select(Task).where(
                Task.user_id == user_id,
                Task.status == 'completed',
                Task.completed_at >= thirty_days_ago
            )
        )
        tasks = result.scalars().all()

        hourly_activity = defaultdict(int)
        for task in tasks:
            if task.completed_at:
                # Adjust to local time if possible, here using UTC assuming user context handled elsewhere or rough approx
                # Ideally we need user timezone offset. For now, assuming UTC or consistent server time.
                hour = task.completed_at.hour
                hourly_activity[hour] += 1

        # Determine Peak Hours (top 3)
        sorted_hours = sorted(hourly_activity.items(), key=lambda x: x[1], reverse=True)
        peak_hours = [h for h, count in sorted_hours[:3]]
        
        # Determine Low Energy (bottom 3 with non-zero activity, or just low activity times)
        # Simple heuristic: hours with least activity during "waking hours" (e.g. 8am-8pm)
        waking_hours = list(range(8, 20))
        waking_activity = [(h, hourly_activity[h]) for h in waking_hours]
        sorted_waking = sorted(waking_activity, key=lambda x: x[1])
        low_energy_hours = [h for h, count in sorted_waking[:3]]

        # Determine Chronotype Label
        # Morning: Peak 6-12, Afternoon: 12-17, Evening: 17-22, Night: 22-5
        morning_score = sum(hourly_activity[h] for h in range(6, 12))
        afternoon_score = sum(hourly_activity[h] for h in range(12, 17))
        evening_score = sum(hourly_activity[h] for h in range(17, 22))
        night_score = sum(hourly_activity[h] for h in list(range(22, 24)) + list(range(0, 6)))

        scores = {
            "Early Bird": morning_score,
            "Midday Warrior": afternoon_score,
            "Evening Focus": evening_score,
            "Night Owl": night_score
        }
        chronotype_type = max(scores, key=scores.get) if any(scores.values()) else "Undetermined"

        return {
            "type": chronotype_type,
            "peak_hours": sorted(peak_hours),
            "low_energy_hours": sorted(low_energy_hours),
            "hourly_activity": dict(hourly_activity)
        }

    async def _analyze_estimation(self, db: Session, user_id: int) -> Dict[str, Any]:
        # Analyze tasks with estimates
        result = await db.execute(
            select(Task).where(
                Task.user_id == user_id,
                Task.status == 'completed',
                Task.estimated_minutes.isnot(None),
                Task.actual_minutes.isnot(None)
            )
        )
        tasks = result.scalars().all()

        if not tasks:
            return {"overall_accuracy": 0, "categories": []}

        total_accuracy = 0
        categories_data = defaultdict(lambda: {"total_tasks": 0, "accuracy_sum": 0})

        for task in tasks:
            if task.estimated_minutes == 0: continue
            
            # Accuracy formula: 100 - error_percentage
            error = abs(task.actual_minutes - task.estimated_minutes)
            accuracy = max(0, 100 - (error / task.estimated_minutes * 100))
            
            total_accuracy += accuracy
            
            cat = task.category or "Uncategorized"
            categories_data[cat]["total_tasks"] += 1
            categories_data[cat]["accuracy_sum"] += accuracy

        overall_accuracy = round(total_accuracy / len(tasks)) if tasks else 0
        
        categories_list = []
        for cat, data in categories_data.items():
            if data["total_tasks"] > 0:
                categories_list.append({
                    "name": cat,
                    "accuracy": round(data["accuracy_sum"] / data["total_tasks"]),
                    "count": data["total_tasks"]
                })
        
        # Sort by count likely more interesting, or accuracy
        categories_list.sort(key=lambda x: x["count"], reverse=True)

        return {
            "overall_accuracy": overall_accuracy,
            "categories": categories_list[:5] # Top 5 categories
        }

    def _calculate_optimal_windows(self, chronotype_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        # Heuristic: Suggest Deep Work during peak hours
        # Suggest Admin/Meetings during low energy hours
        peak_hours = chronotype_data.get("peak_hours", [])
        low_energy = chronotype_data.get("low_energy_hours", [])
        
        windows = []
        
        if peak_hours:
            # Group contiguous peak hours
            # Simplified: just take the first peak hour block
            start = peak_hours[0]
            windows.append({
                "type": "Deep Work",
                "start": f"{start:02d}:00",
                "end": f"{start+2:02d}:00", # Suggest 2 hour block
                "reason": "Peak energy alignment",
                "day": "Today",
                "confidence": 95
            })
            
        if low_energy:
            start = low_energy[0]
            windows.append({
                "type": "Admin / Meetings",
                "start": f"{start:02d}:00",
                "end": f"{start+1:02d}:00",
                "reason": "Lower energy period",
                "day": "Today",
                "confidence": 80
            })
            
        return windows

time_intelligence_service = TimeIntelligenceService()
