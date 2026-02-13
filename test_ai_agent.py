#!/usr/bin/env python3
"""
Test script to verify AI agent functionality for creating goals, tasks, and habits.
"""

import asyncio
import json
from datetime import datetime

# Import the necessary modules
from backend.ai.client import DualAIClient
from backend.services.planner_service import planner_service
from backend.services.analytics_service import analytics_service

async def test_ai_agent():
    print("🧪 Testing AI Agent Functionality")
    print("=" * 50)
    
    # Initialize AI client with a test user ID
    user_id = "1"  # Using a test user ID
    ai_client = DualAIClient(user_id=user_id)
    
    print("✅ AI Client Initialized")
    
    # Test 1: Create a goal
    print("\n📝 Testing Goal Creation...")
    try:
        goal_response = await ai_client.handle_message(
            message="Create a goal to learn TypeScript in 30 days",
            mode="PLAN",
            history=[],
            session_id=None
        )
        print(f"✅ Goal creation response: {json.dumps(goal_response, indent=2)[:200]}...")
    except Exception as e:
        print(f"❌ Goal creation failed: {e}")
    
    # Test 2: Create a task
    print("\n📋 Testing Task Creation...")
    try:
        task_response = await ai_client.handle_message(
            message="Create a task to study TypeScript basics for 2 hours",
            mode="TASK",
            history=[],
            session_id=None
        )
        print(f"✅ Task creation response: {json.dumps(task_response, indent=2)[:200]}...")
    except Exception as e:
        print(f"❌ Task creation failed: {e}")
    
    # Test 3: Create a habit
    print("\n🔄 Testing Habit Creation...")
    try:
        habit_response = await ai_client.handle_message(
            message="Create a daily habit to practice TypeScript for 30 minutes",
            mode="PLAN",
            history=[],
            session_id=None
        )
        print(f"✅ Habit creation response: {json.dumps(habit_response, indent=2)[:200]}...")
    except Exception as e:
        print(f"❌ Habit creation failed: {e}")
    
    # Test 4: Get analytics
    print("\n📊 Testing Analytics Retrieval...")
    try:
        analytics_response = await ai_client.handle_message(
            message="Show my analytics",
            mode="ANALYZE",
            history=[],
            session_id=None
        )
        print(f"✅ Analytics response: {json.dumps(analytics_response, indent=2)[:200]}...")
    except Exception as e:
        print(f"❌ Analytics retrieval failed: {e}")
    
    # Test 5: Get goals
    print("\n🎯 Testing Goal Retrieval...")
    try:
        goals_response = await ai_client.handle_message(
            message="Show my goals",
            mode="CHAT",
            history=[],
            session_id=None
        )
        print(f"✅ Goals response: {json.dumps(goals_response, indent=2)[:200]}...")
    except Exception as e:
        print(f"❌ Goals retrieval failed: {e}")
    
    print("\n🎉 All tests completed!")
    print("=" * 50)

if __name__ == "__main__":
    asyncio.run(test_ai_agent())