# backend/services/predictive_trajectory_service.py
"""
Predictive Trajectory Service
Simple 2-week behavioral projection based on current trends.

Philosophy: Glanceable forecast, not precise prediction.
"""

from datetime import datetime, timedelta
from typing import Dict, Any, Optional
import logging
from sqlalchemy.orm import Session
import statistics

from backend.db.database import get_db

logger = logging.getLogger(__name__)


class PredictiveTrajectoryService:
    """
    Simple behavioral trajectory forecasting.
    Projects current trends forward 14 days.
    """

    PROJECTION_DAYS = 14

    async def get_trajectory(self, user_id: int) -> Dict[str, Any]:
        """
        Calculate current score and 2-week projection.
        
        Returns:
            Current score, projected score, trend, confidence, primary driver
        """
        try:
            async for db in get_db():
                # Calculate current predictive score
                current_score = await self._calculate_current_score(db, user_id)
                
                # Calculate 30-day trend slope
                trend_slope = await self._calculate_trend_slope(db, user_id)
                
                # Project 14 days forward
                projected_score = self._project_forward(current_score, trend_slope)
                
                # Determine trend direction
                trend_direction = self._get_trend_direction(trend_slope)
                
                # Calculate confidence
                confidence = await self._calculate_confidence(db, user_id)
                
                # Identify primary driver
                primary_driver = await self._identify_primary_driver(db, user_id)
                
                # Get color coding
                color_info = self._get_color_coding(projected_score)
                
                return {
                    'current_score': round(current_score, 1),
                    'projected_score': round(projected_score, 1),
                    'change': round(projected_score - current_score, 1),
                    'trend_direction': trend_direction,
                    'trend_slope': round(trend_slope, 2),
                    'confidence': confidence,
                    'primary_driver': primary_driver,
                    'color': color_info['color'],
                    'status': color_info['status'],
                    'projection_days': self.PROJECTION_DAYS
                }

        except Exception as e:
            logger.error(f"Error calculating trajectory: {e}")
            return {
                'current_score': 50,
                'projected_score': 50,
                'change': 0,
                'trend_direction': 'stable',
                'confidence': 'low',
                'primary_driver': None,
                'error': str(e)
            }

    async def _calculate_current_score(self, db: Session, user_id: int) -> float:
        """
        Calculate current predictive score from multiple sources.
        
        Weighted average of:
        - Behavior Timeline trend (40%)
        - Pattern Detector consistency (30%)
        - Focus momentum (20%)
        - Goal progression (10%)
        """
        # Import services
        from backend.services.behavior_timeline_service import behavior_timeline_service
        from backend.services.attention_integrity_service import attention_integrity_service
        
        # Get behavior timeline data (last 30 days)
        timeline_data = await behavior_timeline_service.get_timeline(user_id, "30d")
        
        # Calculate average of all 5 dimensions
        if timeline_data and timeline_data.get('current_values'):
            values = timeline_data['current_values']
            behavior_score = statistics.mean([
                values.get('discipline', 50),
                values.get('focus', 50),
                values.get('planning', 50),
                values.get('energy', 50),
                values.get('adaptability', 50)
            ])
        else:
            behavior_score = 50
        
        # Get focus momentum (last 7 days vs previous 7 days)
        focus_data = await attention_integrity_service.get_weekly_average(user_id)
        focus_momentum = focus_data.get('average_score', 50) if focus_data else 50
        
        # Simplified: Use behavior score as primary (70%) + focus (30%)
        current_score = (behavior_score * 0.7) + (focus_momentum * 0.3)
        
        return max(0, min(100, current_score))

    async def _calculate_trend_slope(self, db: Session, user_id: int) -> float:
        """
        Calculate 30-day trend slope across all dimensions.
        Positive = improving, Negative = declining
        """
        from backend.services.behavior_timeline_service import behavior_timeline_service
        
        timeline_data = await behavior_timeline_service.get_timeline(user_id, "30d")
        
        if not timeline_data or not timeline_data.get('dimensions'):
            return 0
        
        # Get discipline dimension as representative
        discipline_data = timeline_data['dimensions'].get('discipline', [])
        
        if len(discipline_data) < 14:
            return 0
        
        # Simple trend: compare first half to second half
        values = [d['value'] for d in discipline_data]
        first_half = values[:len(values)//2]
        second_half = values[len(values)//2:]
        
        if not first_half or not second_half:
            return 0
        
        first_avg = statistics.mean(first_half)
        second_avg = statistics.mean(second_half)
        
        # Slope per day
        days = len(values) / 2
        slope = (second_avg - first_avg) / days if days > 0 else 0
        
        return slope

    def _project_forward(self, current: float, slope: float) -> float:
        """
        Project score 14 days forward based on current trend.
        """
        projected = current + (slope * self.PROJECTION_DAYS)
        return max(0, min(100, projected))

    def _get_trend_direction(self, slope: float) -> str:
        """
        Determine trend direction from slope.
        """
        if slope > 0.5:
            return 'rising'
        elif slope < -0.5:
            return 'declining'
        else:
            return 'stable'

    async def _calculate_confidence(self, db: Session, user_id: int) -> str:
        """
        Calculate confidence based on data availability.
        """
        from backend.services.behavior_timeline_service import behavior_timeline_service
        
        timeline_data = await behavior_timeline_service.get_timeline(user_id, "30d")
        
        if not timeline_data:
            return 'low'
        
        data_quality = timeline_data.get('data_quality', {})
        days_available = data_quality.get('days_available', 0)
        
        if days_available > 20:
            return 'high'
        elif days_available >= 10:
            return 'medium'
        else:
            return 'low'

    async def _identify_primary_driver(self, db: Session, user_id: int) -> Optional[Dict[str, str]]:
        """
        Identify which behavioral dimension is the primary driver of the trend.
        """
        from backend.services.behavior_timeline_service import behavior_timeline_service
        
        timeline_data = await behavior_timeline_service.get_timeline(user_id, "30d")
        
        if not timeline_data or not timeline_data.get('dimensions'):
            return None
        
        # Calculate trend for each dimension
        dimensions_trends = {}
        for dim_name, dim_data in timeline_data['dimensions'].items():
            if len(dim_data) >= 14:
                values = [d['value'] for d in dim_data[-14:]]  # Last 2 weeks
                first_week = values[:7]
                second_week = values[7:]
                
                if first_week and second_week:
                    change = statistics.mean(second_week) - statistics.mean(first_week)
                    dimensions_trends[dim_name] = change
        
        if not dimensions_trends:
            return None
        
        # Find dimension with largest absolute change
        primary_dim = max(dimensions_trends, key=lambda k: abs(dimensions_trends[k]))
        change = dimensions_trends[primary_dim]
        
        # Map to short codes
        dim_codes = {
            'discipline': 'D',
            'focus': 'F',
            'planning': 'P',
            'energy': 'E',
            'adaptability': 'A'
        }
        
        dim_labels = {
            'discipline': 'Discipline',
            'focus': 'Focus',
            'planning': 'Planning',
            'energy': 'Energy',
            'adaptability': 'Adaptability'
        }
        
        direction = 'trending up' if change > 0 else 'needs attention' if change < -2 else 'stable'
        
        return {
            'code': dim_codes.get(primary_dim, 'D'),
            'name': dim_labels.get(primary_dim, 'Discipline'),
            'direction': direction,
            'change': round(change, 1)
        }

    def _get_color_coding(self, score: float) -> Dict[str, str]:
        """
        Get color and status based on projected score.
        """
        if score >= 86:
            return {
                'color': '#059669',  # Emerald
                'status': 'Excellent trajectory'
            }
        elif score >= 71:
            return {
                'color': '#10b981',  # Green
                'status': 'Strong progress'
            }
        elif score >= 51:
            return {
                'color': '#3b82f6',  # Blue
                'status': 'Stable growth'
            }
        elif score >= 31:
            return {
                'color': '#f59e0b',  # Amber
                'status': 'Needs attention'
            }
        else:
            return {
                'color': '#dc2626',  # Red
                'status': 'Concerning'
            }


# Singleton instance
predictive_trajectory_service = PredictiveTrajectoryService()
