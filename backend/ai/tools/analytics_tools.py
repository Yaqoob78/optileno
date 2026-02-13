"""
Analytics AI Tools - Enable AI agent to analyze and provide insights on user productivity
"""

from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
import logging
from statistics import mean, median

from backend.db.database import get_db

logger = logging.getLogger(__name__)


class AnalyticsToolSet:
    """Tools for AI to analyze and provide productivity insights"""

    @staticmethod
    async def get_productivity_score(
        user_id: str,
        days: int = 1
    ) -> Dict[str, Any]:
        """
        Get productivity score for specified period
        
        Args:
            user_id: User ID
            days: Number of days to look back (1=today, 7=week, 30=month)
        
        Returns:
            Productivity score and breakdown
        """
        try:
            async for db in get_db():
                cutoff_date = datetime.utcnow() - timedelta(days=days)

                # Get task completion rate
                tasks_query = """
                    SELECT 
                        COUNT(*) as total,
                        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed
                    FROM tasks
                    WHERE user_id = $1 AND created_at >= $2
                """
                task_result = await db.fetch(tasks_query, int(user_id), cutoff_date)
                
                task_total = task_result[0]['total'] if task_result else 0
                task_completed = task_result[0]['completed'] if task_result else 0
                task_rate = (task_completed / task_total * 100) if task_total > 0 else 0

                # Get habit completion rate
                habits_query = """
                    SELECT 
                        COUNT(DISTINCT h.id) as total,
                        COUNT(DISTINCT CASE WHEN h.last_completed IS NOT NULL 
                                           AND h.last_completed >= $2 THEN h.id END) as completed
                    FROM habits h
                    WHERE h.user_id = $1
                """
                habit_result = await db.fetch(habits_query, int(user_id), cutoff_date)
                
                habit_total = habit_result[0]['total'] if habit_result else 0
                habit_completed = habit_result[0]['completed'] if habit_result else 0
                habit_rate = (habit_completed / habit_total * 100) if habit_total > 0 else 0

                # Get goal progress
                goals_query = """
                    SELECT AVG(progress) as avg_progress
                    FROM goals
                    WHERE user_id = $1 AND created_at >= $2
                """
                goal_result = await db.fetch(goals_query, int(user_id), cutoff_date)
                goal_progress = goal_result[0]['avg_progress'] or 0 if goal_result else 0

                # Calculate weighted score
                score = (task_rate * 0.4) + (habit_rate * 0.35) + (goal_progress * 0.25)

                return {
                    "success": True,
                    "period_days": days,
                    "score": round(score, 2),
                    "breakdown": {
                        "task_completion": round(task_rate, 2),
                        "habit_completion": round(habit_rate, 2),
                        "goal_progress": round(goal_progress, 2)
                    },
                    "stats": {
                        "tasks_total": task_total,
                        "tasks_completed": task_completed,
                        "habits_total": habit_total,
                        "habits_completed": habit_completed,
                        "goals_total": goal_result[0]['total'] if goal_result else 0
                    }
                }

        except Exception as e:
            logger.error(f"Error getting productivity score: {str(e)}")
            return {"error": str(e)}

    @staticmethod
    async def get_task_metrics(user_id: str) -> Dict[str, Any]:
        """Get detailed task metrics and analytics"""
        try:
            async for db in get_db():
                query = """
                    SELECT 
                        COUNT(*) as total,
                        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
                        COUNT(CASE WHEN status = 'in-progress' THEN 1 END) as in_progress,
                        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
                        AVG(estimated_duration_minutes) as avg_duration,
                        COUNT(CASE WHEN priority = 'high' THEN 1 END) as high_priority,
                        COUNT(CASE WHEN priority = 'urgent' THEN 1 END) as urgent
                    FROM tasks
                    WHERE user_id = $1
                """
                result = await db.fetch(query, int(user_id))

                if result:
                    row = result[0]
                    return {
                        "success": True,
                        "metrics": {
                            "total_tasks": row['total'],
                            "completed": row['completed'],
                            "in_progress": row['in_progress'],
                            "pending": row['pending'],
                            "completion_rate": round((row['completed'] / row['total'] * 100) if row['total'] > 0 else 0, 2),
                            "high_priority": row['high_priority'],
                            "urgent": row['urgent'],
                            "average_duration_minutes": round(row['avg_duration'], 2) if row['avg_duration'] else 0
                        }
                    }
                else:
                    return {"success": True, "metrics": {}}

        except Exception as e:
            logger.error(f"Error getting task metrics: {str(e)}")
            return {"error": str(e)}

    @staticmethod
    async def get_habit_metrics(user_id: str) -> Dict[str, Any]:
        """Get habit tracking metrics"""
        try:
            async for db in get_db():
                query = """
                    SELECT 
                        COUNT(*) as total,
                        AVG(streak) as avg_streak,
                        MAX(streak) as best_streak,
                        COUNT(CASE WHEN last_completed IS NOT NULL 
                                  AND last_completed::date = CURRENT_DATE THEN 1 END) as completed_today,
                        COUNT(CASE WHEN frequency = 'daily' THEN 1 END) as daily,
                        COUNT(CASE WHEN frequency = 'weekly' THEN 1 END) as weekly
                    FROM habits
                    WHERE user_id = $1
                """
                result = await db.fetch(query, int(user_id))

                if result:
                    row = result[0]
                    return {
                        "success": True,
                        "metrics": {
                            "total_habits": row['total'],
                            "completed_today": row['completed_today'],
                            "average_streak": round(row['avg_streak'], 2) if row['avg_streak'] else 0,
                            "best_streak": row['best_streak'] or 0,
                            "daily_habits": row['daily'],
                            "weekly_habits": row['weekly'],
                            "consistency": round((row['completed_today'] / row['total'] * 100) if row['total'] > 0 else 0, 2)
                        }
                    }
                else:
                    return {"success": True, "metrics": {}}

        except Exception as e:
            logger.error(f"Error getting habit metrics: {str(e)}")
            return {"error": str(e)}

    @staticmethod
    async def get_goal_metrics(user_id: str) -> Dict[str, Any]:
        """Get goal progress metrics"""
        try:
            async for db in get_db():
                query = """
                    SELECT 
                        COUNT(*) as total,
                        AVG(progress) as avg_progress,
                        MAX(progress) as max_progress,
                        COUNT(CASE WHEN progress >= 75 THEN 1 END) as almost_done,
                        COUNT(CASE WHEN progress >= 50 AND progress < 75 THEN 1 END) as halfway,
                        COUNT(CASE WHEN progress < 50 THEN 1 END) as just_started
                    FROM goals
                    WHERE user_id = $1
                """
                result = await db.fetch(query, int(user_id))

                if result:
                    row = result[0]
                    return {
                        "success": True,
                        "metrics": {
                            "total_goals": row['total'],
                            "average_progress": round(row['avg_progress'], 2) if row['avg_progress'] else 0,
                            "max_progress": row['max_progress'] or 0,
                            "almost_done": row['almost_done'],
                            "halfway": row['halfway'],
                            "just_started": row['just_started'],
                            "on_track": round((row['avg_progress'] / 100 * 100) if row['avg_progress'] else 0, 2)
                        }
                    }
                else:
                    return {"success": True, "metrics": {}}

        except Exception as e:
            logger.error(f"Error getting goal metrics: {str(e)}")
            return {"error": str(e)}

    @staticmethod
    async def get_trend_analysis(
        user_id: str,
        days: int = 7
    ) -> Dict[str, Any]:
        """
        Analyze productivity trends over time
        
        Args:
            user_id: User ID
            days: Number of days to analyze
        
        Returns:
            Trend data showing improvement/decline
        """
        try:
            async for db in get_db():
                # Get daily productivity scores
                query = """
                    SELECT 
                        DATE(created_at) as date,
                        COUNT(CASE WHEN status = 'completed' THEN 1 END)::float / 
                        COUNT(*)::float as daily_completion_rate
                    FROM tasks
                    WHERE user_id = $1 
                      AND created_at >= NOW() - INTERVAL '1 day' * $2
                    GROUP BY DATE(created_at)
                    ORDER BY date ASC
                """
                results = await db.fetch(query, int(user_id), days)

                if results:
                    rates = [dict(row) for row in results]
                    completion_values = [r['daily_completion_rate'] * 100 for r in rates]
                    
                    # Calculate trend
                    if len(completion_values) >= 2:
                        first_half = completion_values[:len(completion_values)//2]
                        second_half = completion_values[len(completion_values)//2:]
                        
                        avg_first = mean(first_half) if first_half else 0
                        avg_second = mean(second_half) if second_half else 0
                        
                        trend = "improving" if avg_second > avg_first else "declining" if avg_second < avg_first else "stable"
                        change = round(avg_second - avg_first, 2)
                    else:
                        trend = "insufficient_data"
                        change = 0

                    return {
                        "success": True,
                        "period_days": days,
                        "trend": trend,
                        "change": change,
                        "daily_rates": rates,
                        "average": round(mean(completion_values), 2) if completion_values else 0
                    }
                else:
                    return {
                        "success": True,
                        "period_days": days,
                        "trend": "no_data",
                        "daily_rates": []
                    }

        except Exception as e:
            logger.error(f"Error analyzing trends: {str(e)}")
            return {"error": str(e)}

    @staticmethod
    async def get_recommendations(user_id: str) -> Dict[str, Any]:
        """
        Generate AI recommendations based on productivity data
        """
        try:
            # Get all metrics
            prod_score = await AnalyticsToolSet.get_productivity_score(user_id, days=7)
            task_metrics = await AnalyticsToolSet.get_task_metrics(user_id)
            habit_metrics = await AnalyticsToolSet.get_habit_metrics(user_id)
            goal_metrics = await AnalyticsToolSet.get_goal_metrics(user_id)
            trend = await AnalyticsToolSet.get_trend_analysis(user_id, days=7)

            recommendations = []

            # Task recommendations
            if task_metrics.get('success'):
                metrics = task_metrics.get('metrics', {})
                if metrics.get('urgent', 0) > 3:
                    recommendations.append({
                        "type": "urgent_overload",
                        "message": f"You have {metrics['urgent']} urgent tasks. Consider breaking them into smaller subtasks.",
                        "priority": "high"
                    })
                
                if metrics.get('completion_rate', 0) < 50:
                    recommendations.append({
                        "type": "low_completion",
                        "message": "Your task completion rate is low. Try reducing task complexity or increasing daily targets.",
                        "priority": "high"
                    })

            # Habit recommendations
            if habit_metrics.get('success'):
                metrics = habit_metrics.get('metrics', {})
                if metrics.get('total_habits', 0) == 0:
                    recommendations.append({
                        "type": "no_habits",
                        "message": "You don't have any habits yet. Consider adding daily habits to boost consistency.",
                        "priority": "medium"
                    })
                elif metrics.get('consistency', 0) < 60:
                    recommendations.append({
                        "type": "low_habit_consistency",
                        "message": f"Your habit consistency is {metrics['consistency']}%. Try to complete your daily habits.",
                        "priority": "medium"
                    })

            # Trend recommendations
            if trend.get('success') and trend.get('trend') == 'declining':
                recommendations.append({
                    "type": "declining_trend",
                    "message": f"Your productivity is declining by {abs(trend['change'])}% this week. Let's get back on track!",
                    "priority": "high"
                })
            elif trend.get('trend') == 'improving':
                recommendations.append({
                    "type": "positive_trend",
                    "message": f"Great! Your productivity is improving by {trend['change']}% this week. Keep it up!",
                    "priority": "positive"
                })

            # Goal recommendations
            if goal_metrics.get('success'):
                metrics = goal_metrics.get('metrics', {})
                if metrics.get('total_goals', 0) > 0 and metrics.get('average_progress', 0) < 25:
                    recommendations.append({
                        "type": "low_goal_progress",
                        "message": "Your goals are progressing slowly. Set milestones to track progress better.",
                        "priority": "medium"
                    })

            return {
                "success": True,
                "recommendations": recommendations,
                "count": len(recommendations)
            }

        except Exception as e:
            logger.error(f"Error generating recommendations: {str(e)}")
            return {"error": str(e)}

    @staticmethod
    async def get_comprehensive_report(user_id: str) -> Dict[str, Any]:
        """Get comprehensive productivity report"""
        try:
            # Get all analytics
            prod_score = await AnalyticsToolSet.get_productivity_score(user_id, days=7)
            task_metrics = await AnalyticsToolSet.get_task_metrics(user_id)
            habit_metrics = await AnalyticsToolSet.get_habit_metrics(user_id)
            goal_metrics = await AnalyticsToolSet.get_goal_metrics(user_id)
            trend = await AnalyticsToolSet.get_trend_analysis(user_id, days=7)
            recommendations = await AnalyticsToolSet.get_recommendations(user_id)

            return {
                "success": True,
                "report": {
                    "productivity_score": prod_score.get('score', 0),
                    "tasks": task_metrics.get('metrics', {}),
                    "habits": habit_metrics.get('metrics', {}),
                    "goals": goal_metrics.get('metrics', {}),
                    "trend": {
                        "direction": trend.get('trend', 'unknown'),
                        "change": trend.get('change', 0)
                    },
                    "recommendations": recommendations.get('recommendations', [])
                }
            }

        except Exception as e:
            logger.error(f"Error generating comprehensive report: {str(e)}")
            return {"error": str(e)}


# Initialize for use
analytics_tools = AnalyticsToolSet()
