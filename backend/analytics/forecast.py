# backend/analytics/forecast.py
"""
Advanced Analytics - Predictive forecasting and trajectory analysis
"""

import logging
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime, timedelta
import statistics
import math

logger = logging.getLogger(__name__)


class DataPoint:
    """Single data point for analytics"""
    
    def __init__(self, timestamp: datetime, value: float, metadata: Optional[Dict] = None):
        self.timestamp = timestamp
        self.value = value
        self.metadata = metadata or {}


class TimeSeriesAnalyzer:
    """Analyzes time series data for patterns and trends"""
    
    def __init__(self, data_points: List[DataPoint]):
        self.data_points = sorted(data_points, key=lambda x: x.timestamp)
        self.values = [p.value for p in self.data_points]
    
    def calculate_trend(self, window_size: int = 7) -> Dict[str, Any]:
        """Calculate trend over a time window"""
        if len(self.values) < 2:
            return {"trend": "insufficient_data"}
        
        # Use linear regression for trend
        n = len(self.values)
        x = list(range(n))
        y = self.values
        
        x_mean = statistics.mean(x)
        y_mean = statistics.mean(y)
        
        numerator = sum((x[i] - x_mean) * (y[i] - y_mean) for i in range(n))
        denominator = sum((x[i] - x_mean) ** 2 for i in range(n))
        
        if denominator == 0:
            slope = 0
        else:
            slope = numerator / denominator
        
        # Determine trend direction
        if slope > 0.05:
            trend_direction = "increasing"
        elif slope < -0.05:
            trend_direction = "decreasing"
        else:
            trend_direction = "stable"
        
        return {
            "trend": trend_direction,
            "slope": slope,
            "current_value": self.values[-1],
            "previous_value": self.values[-2] if len(self.values) > 1 else None,
            "change_percent": ((self.values[-1] - self.values[-2]) / self.values[-2] * 100) if len(self.values) > 1 and self.values[-2] != 0 else 0
        }
    
    def detect_patterns(self) -> Dict[str, Any]:
        """Detect patterns in the data"""
        if len(self.values) < 3:
            return {"patterns": []}
        
        patterns = []
        
        # Check for cyclical patterns
        if len(self.values) >= 7:
            weekly_pattern = self._check_weekly_pattern()
            if weekly_pattern:
                patterns.append(weekly_pattern)
        
        # Check for anomalies
        anomalies = self._detect_anomalies()
        if anomalies:
            patterns.append({
                "type": "anomalies",
                "count": len(anomalies),
                "indices": anomalies
            })
        
        return {"patterns": patterns}
    
    def _check_weekly_pattern(self) -> Optional[Dict[str, Any]]:
        """Check for weekly cyclical pattern"""
        if len(self.values) < 14:
            return None
        
        # Compare weeks
        week1 = self.values[-14:-7]
        week2 = self.values[-7:]
        
        if not week1 or not week2:
            return None
        
        # Calculate correlation
        w1_mean = statistics.mean(week1)
        w2_mean = statistics.mean(week2)
        
        w1_std = statistics.stdev(week1) if len(week1) > 1 else 0
        w2_std = statistics.stdev(week2) if len(week2) > 1 else 0
        
        if w1_std == 0 or w2_std == 0:
            return None
        
        correlation = sum(
            ((week1[i] - w1_mean) / w1_std) * ((week2[i] - w2_mean) / w2_std)
            for i in range(min(len(week1), len(week2)))
        ) / min(len(week1), len(week2))
        
        if correlation > 0.6:
            return {
                "type": "weekly_cycle",
                "correlation": correlation,
                "strength": "strong" if correlation > 0.8 else "moderate"
            }
        
        return None
    
    def _detect_anomalies(self, sensitivity: float = 2.0) -> List[int]:
        """Detect anomalous values using Z-score"""
        if len(self.values) < 2:
            return []
        
        mean = statistics.mean(self.values)
        std = statistics.stdev(self.values) if len(self.values) > 1 else 0
        
        if std == 0:
            return []
        
        anomalies = []
        for i, value in enumerate(self.values):
            z_score = abs((value - mean) / std)
            if z_score > sensitivity:
                anomalies.append(i)
        
        return anomalies


class TrajectoryForecaster:
    """Predicts future trajectory based on historical data"""
    
    def __init__(self, data_points: List[DataPoint], lookback_days: int = 30):
        self.data_points = data_points
        self.lookback_days = lookback_days
        self.analyzer = TimeSeriesAnalyzer(data_points)
    
    def forecast(self, days_ahead: int = 7) -> Dict[str, Any]:
        """
        Forecast trajectory for specified days ahead
        
        Uses simple exponential smoothing + trend analysis
        """
        if len(self.analyzer.values) < 2:
            return {"forecast": [], "confidence": 0.0}
        
        values = self.analyzer.values
        n = len(values)
        
        # Calculate trend
        x = list(range(n))
        slope = self._calculate_slope(x, values)
        
        # Exponential smoothing parameters
        alpha = 0.3  # Smoothing factor
        
        # Initial smoothing level
        level = values[-1]
        
        forecast = []
        
        for t in range(1, days_ahead + 1):
            # Simple exponential forecast with trend
            predicted = level + (slope * t)
            
            # Add some variance (confidence interval)
            # Calculate historical volatility
            returns = [values[i] / values[i-1] if values[i-1] != 0 else 1 for i in range(1, len(values))]
            volatility = statistics.stdev(returns) if len(returns) > 1 else 0.1
            
            confidence_interval = predicted * volatility * math.sqrt(t)
            
            forecast.append({
                "day": t,
                "predicted_value": max(0, predicted),  # Ensure non-negative
                "lower_bound": max(0, predicted - confidence_interval),
                "upper_bound": predicted + confidence_interval,
                "confidence": max(0, min(1.0, 1.0 - (0.1 * t)))  # Decreasing confidence over time
            })
        
        return {
            "forecast": forecast,
            "confidence": forecast[0]["confidence"] if forecast else 0.0,
            "trend_slope": slope,
            "last_value": values[-1]
        }
    
    def _calculate_slope(self, x: List[int], y: List[float]) -> float:
        """Calculate linear regression slope"""
        if len(x) < 2 or len(y) < 2:
            return 0.0
        
        x_mean = statistics.mean(x)
        y_mean = statistics.mean(y)
        
        numerator = sum((x[i] - x_mean) * (y[i] - y_mean) for i in range(len(x)))
        denominator = sum((x[i] - x_mean) ** 2 for i in range(len(x)))
        
        return numerator / denominator if denominator != 0 else 0.0
    
    def predict_goal_achievement(
        self, 
        current_value: float, 
        goal_value: float,
        target_days: int = 30
    ) -> Dict[str, Any]:
        """Predict if goal will be achieved within target timeframe"""
        forecast = self.forecast(days_ahead=target_days)
        
        if not forecast["forecast"]:
            return {
                "will_achieve": False,
                "confidence": 0.0,
                "estimated_days": None
            }
        
        # Check if any forecast point exceeds goal
        for point in forecast["forecast"]:
            if point["predicted_value"] >= goal_value:
                return {
                    "will_achieve": True,
                    "confidence": point["confidence"],
                    "estimated_days": point["day"],
                    "predicted_value": point["predicted_value"]
                }
        
        return {
            "will_achieve": False,
            "confidence": forecast["confidence"],
            "estimated_days": None,
            "last_predicted": forecast["forecast"][-1]["predicted_value"] if forecast["forecast"] else current_value
        }


class PerformanceScorer:
    """Scores user performance across different dimensions"""
    
    @staticmethod
    def calculate_productivity_score(
        tasks_completed: int,
        deep_work_minutes: int,
        focus_quality: float,  # 0-100
        consistency: float  # 0-100
    ) -> Dict[str, Any]:
        """
        Calculate overall productivity score
        
        Score breakdown:
        - Task completion: 30%
        - Deep work: 30%
        - Focus quality: 20%
        - Consistency: 20%
        """
        
        # Normalize components (0-100)
        task_score = min(100, (tasks_completed / 10) * 100)  # Max 10 tasks = 100
        deep_work_score = min(100, (deep_work_minutes / 120) * 100)  # Max 120 min = 100
        focus_score = min(100, focus_quality)
        consistency_score = min(100, consistency)
        
        # Weighted average
        overall_score = (
            (task_score * 0.30) +
            (deep_work_score * 0.30) +
            (focus_score * 0.20) +
            (consistency_score * 0.20)
        )
        
        # Determine grade
        if overall_score >= 90:
            grade = "A+"
            status = "Exceptional"
        elif overall_score >= 80:
            grade = "A"
            status = "Excellent"
        elif overall_score >= 70:
            grade = "B"
            status = "Good"
        elif overall_score >= 60:
            grade = "C"
            status = "Fair"
        else:
            grade = "D"
            status = "Needs Improvement"
        
        return {
            "overall_score": round(overall_score, 1),
            "grade": grade,
            "status": status,
            "components": {
                "task_completion": round(task_score, 1),
                "deep_work": round(deep_work_score, 1),
                "focus_quality": round(focus_score, 1),
                "consistency": round(consistency_score, 1)
            }
        }
    
    @staticmethod
    def calculate_wellness_score(
        sleep_hours: float,
        exercise_minutes: int,
        stress_level: float,  # 0-100 (0=relaxed, 100=stressed)
        break_frequency: int  # breaks per day
    ) -> Dict[str, Any]:
        """Calculate wellness and wellbeing score"""
        
        # Normalize components
        sleep_score = min(100, (sleep_hours / 8) * 100) if sleep_hours > 0 else 0
        exercise_score = min(100, (exercise_minutes / 60) * 100)  # 60 min target
        stress_score = max(0, 100 - stress_level)  # Invert stress
        break_score = min(100, (break_frequency / 8) * 100)  # 8 breaks target
        
        overall_score = (
            (sleep_score * 0.35) +
            (exercise_score * 0.25) +
            (stress_score * 0.25) +
            (break_score * 0.15)
        )
        
        return {
            "wellness_score": round(overall_score, 1),
            "components": {
                "sleep": round(sleep_score, 1),
                "exercise": round(exercise_score, 1),
                "stress_management": round(stress_score, 1),
                "rest_breaks": round(break_score, 1)
            }
        }
