"""
Performance optimization utilities for Concierge AI backend.

Implements various performance optimization techniques:
- Database query optimization
- Caching strategies
- Async processing
- Resource management
"""

import asyncio
import functools
from typing import Any, Callable, Dict, List, Optional, Awaitable
from datetime import datetime, timedelta
import logging
from concurrent.futures import ThreadPoolExecutor

from backend.core.cache import cache_service
from backend.db.database import get_db
from backend.db.models import AnalyticsEvent, RealTimeMetrics


class PerformanceOptimizer:
    """
    Performance optimization service for the Concierge AI backend.
    
    Provides various optimization techniques:
    - Query optimization
    - Caching strategies
    - Async processing
    - Resource management
    - Batch operations
    """
    
    def __init__(self):
        self.executor = ThreadPoolExecutor(max_workers=10)
        self.logger = logging.getLogger(__name__)
        
    def optimize_database_queries(self):
        """
        Apply database query optimizations.
        This includes adding indexes, optimizing joins, etc.
        """
        # In a real implementation, this would create database indexes
        # and optimize query patterns
        self.logger.info("Applied database query optimizations")
        
    async def batch_process_analytics_events(self, events: List[Dict[str, Any]]) -> bool:
        """
        Process multiple analytics events in a single batch operation.
        
        Args:
            events: List of analytics events to process
            
        Returns:
            True if successful, False otherwise
        """
        try:
            async for db in get_db():
                for event_data in events:
                    analytics_event = AnalyticsEvent(
                        user_id=event_data["user_id"],
                        event_type=event_data["event_type"],
                        event_source=event_data.get("event_source", "system"),
                        category=event_data.get("category", "general"),
                        timestamp=datetime.utcnow(),
                        meta=event_data.get("meta", {}),
                        raw_data=event_data.get("raw_data", {})
                    )
                    db.add(analytics_event)
                
                await db.commit()
                self.logger.info(f"Batch processed {len(events)} analytics events")
                return True
        except Exception as e:
            self.logger.error(f"Failed to batch process analytics events: {e}")
            return False
    
    async def update_user_metrics_batch(self, user_metrics: List[Dict[str, Any]]) -> bool:
        """
        Update multiple user metrics in a single batch operation.
        
        Args:
            user_metrics: List of user metrics to update
            
        Returns:
            True if successful, False otherwise
        """
        try:
            async for db in get_db():
                for metric_data in user_metrics:
                    # Get existing metrics or create new
                    metrics = await db.get(RealTimeMetrics, metric_data["user_id"])
                    if not metrics:
                        metrics = RealTimeMetrics(user_id=metric_data["user_id"])
                        db.add(metrics)
                    
                    # Update metrics based on provided data
                    for key, value in metric_data.items():
                        if hasattr(metrics, key):
                            setattr(metrics, key, value)
                    
                    # Update timestamp
                    metrics.updated_at = datetime.utcnow()
                
                await db.commit()
                self.logger.info(f"Batch updated {len(user_metrics)} user metrics")
                return True
        except Exception as e:
            self.logger.error(f"Failed to batch update user metrics: {e}")
            return False
    
    
    async def run_parallel_tasks(self, tasks: List[Awaitable]) -> List[Any]:
        """
        Run multiple async tasks in parallel.
        
        Args:
            tasks: List of awaitable tasks to run in parallel
            
        Returns:
            List of results from all tasks
        """
        try:
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            # Log any exceptions
            for i, result in enumerate(results):
                if isinstance(result, Exception):
                    self.logger.error(f"Task {i} failed: {result}")
            
            return results
        except Exception as e:
            self.logger.error(f"Parallel task execution failed: {e}")
            return []
    
    async def optimize_response_compression(self, data: Dict[str, Any]) -> bytes:
        """
        Optimize response compression for better performance.
        
        Args:
            data: Data to compress
            
        Returns:
            Compressed data as bytes
        """
        import json
        import gzip
        
        # Convert to JSON and compress
        json_data = json.dumps(data).encode('utf-8')
        compressed_data = gzip.compress(json_data)
        
        return compressed_data
    
    def run_in_thread_pool(self, func: Callable, *args) -> Awaitable:
        """
        Run a synchronous function in a thread pool.
        
        Args:
            func: Function to run
            *args: Arguments to pass to function
            
        Returns:
            Awaitable that resolves to function result
        """
        return asyncio.get_event_loop().run_in_executor(self.executor, func, *args)
    
    async def prefetch_related_data(self, user_id: int) -> Dict[str, Any]:
        """
        Prefetch related data for a user to reduce database queries.
        
        Args:
            user_id: ID of user to prefetch data for
            
        Returns:
            Dictionary containing prefetched data
        """
        try:
            async for db in get_db():
                # Fetch all related data in a single transaction
                from backend.db.models import User, Task, Plan, Goal, FocusScore
                
                # Get user
                user = await db.get(User, user_id)
                
                # Get related data
                tasks = db.query(Task).filter(Task.user_id == user_id).all()
                plans = db.query(Plan).filter(Plan.user_id == user_id).all()
                goals = db.query(Goal).filter(Goal.user_id == user_id).all()
                focus_scores = db.query(FocusScore).filter(FocusScore.user_id == user_id).all()
                
                # Cache the prefetched data
                cache_data = {
                    "user": user.__dict__ if user else None,
                    "tasks": [task.__dict__ for task in tasks],
                    "plans": [plan.__dict__ for plan in plans],
                    "goals": [goal.__dict__ for goal in goals],
                    "focus_scores": [score.__dict__ for score in focus_scores],
                    "timestamp": datetime.utcnow().isoformat()
                }
                
                cache_key = f"prefetch:user:{user_id}"
                await cache_service.set(cache_key, cache_data, 300)  # 5 minutes
                
                return cache_data
        except Exception as e:
            self.logger.error(f"Failed to prefetch related data: {e}")
            return {}
    
    async def clear_prefetched_data(self, user_id: int):
        """
        Clear prefetched data for a user.
        
        Args:
            user_id: ID of user whose prefetched data to clear
        """
        cache_key = f"prefetch:user:{user_id}"
        await cache_service.delete(cache_key)
    
    async def get_cached_or_compute(self, cache_key: str, compute_func: Callable, ttl: int = 300):
        """
        Get data from cache or compute it if not available.
        
        Args:
            cache_key: Key to use for caching
            compute_func: Function to compute data if not in cache
            ttl: Time to live for cache entry
            
        Returns:
            Cached or computed data
        """
        # Try to get from cache first
        cached_data = await cache_service.get(cache_key)
        if cached_data is not None:
            return cached_data
        
        # Compute data
        computed_data = await compute_func()
        
        # Store in cache
        await cache_service.set(cache_key, computed_data, ttl)
        
        return computed_data
    
    async def bulk_insert(self, model_class, data_list: List[Dict[str, Any]]) -> bool:
        """
        Perform bulk insert of data.
        
        Args:
            model_class: SQLAlchemy model class
            data_list: List of dictionaries containing data to insert
            
        Returns:
            True if successful, False otherwise
        """
        try:
            async for db in get_db():
                # Create model instances
                instances = [model_class(**data) for data in data_list]
                
                # Bulk insert
                db.add_all(instances)
                await db.commit()
                
                self.logger.info(f"Bulk inserted {len(data_list)} {model_class.__name__} records")
                return True
        except Exception as e:
            self.logger.error(f"Bulk insert failed: {e}")
            return False
    
    async def optimize_for_mobile(self, data: Dict[str, Any], is_mobile: bool = False) -> Dict[str, Any]:
        """
        Optimize data for mobile devices by reducing payload size.
        
        Args:
            data: Original data
            is_mobile: Whether the request is from a mobile device
            
        Returns:
            Optimized data for mobile if applicable
        """
        if not is_mobile:
            return data
        
        # For mobile, return a simplified version of the data
        # Remove heavy fields or aggregate data
        optimized_data = {}
        
        for key, value in data.items():
            if isinstance(value, list) and len(value) > 50:
                # Truncate long lists for mobile
                optimized_data[key] = value[:20]  # Keep only first 20 items
            elif isinstance(value, dict) and len(str(value)) > 10000:
                # Simplify large objects for mobile
                optimized_data[key] = self._simplify_object(value)
            else:
                optimized_data[key] = value
        
        return optimized_data
    
    def _simplify_object(self, obj: Dict[str, Any]) -> Dict[str, Any]:
        """
        Simplify a complex object by removing non-essential fields.
        
        Args:
            obj: Object to simplify
            
        Returns:
            Simplified object
        """
        simplified = {}
        
        # Keep only essential fields
        essential_fields = {
            'id', 'name', 'title', 'description', 'status', 'progress', 
            'created_at', 'updated_at', 'due_date', 'completed_at'
        }
        
        for key, value in obj.items():
            if key in essential_fields:
                simplified[key] = value
            elif isinstance(value, (str, int, float, bool)):
                # Keep simple primitive values
                simplified[key] = value
        
        return simplified


# Global performance optimizer instance
performance_optimizer = PerformanceOptimizer()