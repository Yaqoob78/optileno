import pytest
import pytest_asyncio
from datetime import datetime, timezone, timedelta
from backend.services.goal_progress_engine import GoalProgressEngine, GoalProgressResult
from backend.db.models import Goal, Task, Plan

class MockSession:
    def __init__(self, items):
        self.items = items
    async def execute(self, stmt):
        return MockResult(self.items.get(stmt.froms[0].name, []))
    async def commit(self):
        pass
    async def refresh(self, obj):
        pass

class MockResult:
    def __init__(self, data):
        self.data = data
    def scalar_one_or_none(self):
        return self.data[0] if self.data else None
    def scalars(self):
        return self
    def all(self):
        return self.data

@pytest.mark.asyncio
async def test_goal_progress_engine_fallback_non_ultra():
    """Fallback to simple progress if not ultra"""
    db = MockSession({})
    res = await GoalProgressEngine.calculate_progress(db, 1, 1, is_ultra=False)
    assert res.completion_progress == 0
    assert res.confidence == 0

@pytest.mark.asyncio
async def test_goal_progress_engine_no_linked_items():
    """Should keep old progress if no linked items and low confidence"""
    now = datetime.now(timezone.utc)
    goal = Goal(id=1, user_id=1, current_progress=40, target_date=now + timedelta(days=10), created_at=now)
    db = MockSession({"goals": [goal], "tasks": [], "plans": []})
    
    res = await GoalProgressEngine.calculate_progress(db, 1, 1, is_ultra=True)
    assert res.completion_progress == 40
    assert res.confidence == 0.1
    assert res.confidence_state == "calibrating"

@pytest.mark.asyncio
async def test_goal_progress_engine_manual_mode_stability():
    """Manual mode should not swing wildly per day"""
    now = datetime.now(timezone.utc)
    goal = Goal(id=1, user_id=1, current_progress=50, target_date=now + timedelta(days=10), created_at=now - timedelta(days=5))
    
    # 2 tasks completed out of 10
    tasks = [Task(id=i, user_id=1, goal_id=1, status="completed" if i < 2 else "pending", priority="medium") for i in range(10)]
    
    db = MockSession({"goals": [goal], "tasks": tasks, "plans": []})
    res = await GoalProgressEngine.calculate_progress(db, 1, 1, is_ultra=True)
    
    # Completed is 20%. Old progress was 50%.
    # Smoothed progress = 0.3 * 20 + 0.7 * 50 = 6 + 35 = 41
    # Delta = -9. Max drop is -4. So ~46
    assert 46 <= res.completion_progress <= 49, f"Progress swung wildly to {res.completion_progress}"
    assert res.confidence_state == "established"

@pytest.mark.asyncio
async def test_goal_progress_engine_ai_mode_penalties():
    """AI mode reflects task completion exactly but PV/EV ratio determines probability"""
    now = datetime.now(timezone.utc)
    # AI goals have ai_suggestions
    goal = Goal(id=1, user_id=1, current_progress=50, target_date=now + timedelta(days=10), created_at=now - timedelta(days=5), ai_suggestions=[{"test": 1}])
    
    # 2 tasks completed out of 10
    tasks = [Task(id=i, user_id=1, goal_id=1, status="completed" if i < 2 else "pending", priority="medium") for i in range(10)]
    
    db = MockSession({"goals": [goal], "tasks": tasks, "plans": []})
    res = await GoalProgressEngine.calculate_progress(db, 1, 1, is_ultra=True)
    
    # SPI = 20% / 80% = 0.25 -> prob = 20. But bounded min 10
    assert res.success_probability < 50
    assert res.confidence_state == "established"

