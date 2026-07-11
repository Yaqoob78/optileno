"""
Tests for Goal Progress V2 Engine, lifecycle hooks, and ULTRA gating.
"""

import pytest
import math
from datetime import date, datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch
from dataclasses import asdict

from fastapi import HTTPException


# ── Helpers ──────────────────────────────────────────────────────────────

def _make_goal(
    *,
    goal_id: int = 1,
    user_id: int = 42,
    scoring_version: str = "v2",
    trajectory_type: str = "linear",
    horizon_days: int = 30,
    current_progress: int = 0,
    target_date: datetime | None = None,
    created_at: datetime | None = None,
    ai_suggestions: list | None = None,
):
    goal = MagicMock()
    goal.id = goal_id
    goal.user_id = user_id
    goal.scoring_version = scoring_version
    goal.trajectory_type = trajectory_type
    goal.horizon_days = horizon_days
    goal.current_progress = current_progress
    goal.target_date = target_date or (datetime.now(timezone.utc) + timedelta(days=horizon_days))
    goal.created_at = created_at or (datetime.now(timezone.utc) - timedelta(days=5))
    goal.probability_status = "Medium"
    goal.last_analyzed_at = None
    goal.ai_suggestions = ai_suggestions
    goal.goal_type = "learning"
    goal.primary_metric_name = None
    goal.primary_metric_unit = None
    goal.baseline_value = None
    goal.target_value = None
    return goal


def _make_component(
    *,
    goal_id: int = 1,
    component_type: str = "task",
    source_id: int = 100,
    weight: float = 1.0,
    target_total: float = 1.0,
    current_total: float = 0.0,
    due_date: date | None = None,
    required: bool = False,
    quality_weight: float = 1.0,
    overdue_penalty_per_day: float = 0.02,
):
    comp = MagicMock()
    comp.goal_id = goal_id
    comp.component_type = component_type
    comp.source_id = source_id
    comp.weight = weight
    comp.target_total = target_total
    comp.current_total = current_total
    comp.due_date = due_date
    comp.required = required
    comp.quality_weight = quality_weight
    comp.overdue_penalty_per_day = overdue_penalty_per_day
    return comp


def _make_user(*, plan_tier: str = "explorer", user_id: int = 42):
    user = MagicMock()
    user.id = user_id
    user.plan_tier = plan_tier
    user.plan_type = plan_tier.upper()
    user.tier = plan_tier
    return user


# ═══════════════════════════════════════════════════════════════════════
# 1. Trajectory curves
# ═══════════════════════════════════════════════════════════════════════

class TestTrajectoryCurves:
    def test_linear_midpoint(self):
        from backend.services.goal_progress_engine_v2 import _expected_pct_at
        assert _expected_pct_at(0.5, "linear") == pytest.approx(50.0, abs=0.1)

    def test_linear_endpoints(self):
        from backend.services.goal_progress_engine_v2 import _expected_pct_at
        assert _expected_pct_at(0.0, "linear") == pytest.approx(0.0, abs=0.1)
        assert _expected_pct_at(1.0, "linear") == pytest.approx(100.0, abs=0.1)

    def test_front_loaded_is_above_linear(self):
        from backend.services.goal_progress_engine_v2 import _expected_pct_at
        fl = _expected_pct_at(0.5, "front_loaded")
        li = _expected_pct_at(0.5, "linear")
        assert fl > li, "front_loaded should be above linear at midpoint"

    def test_back_loaded_is_below_linear(self):
        from backend.services.goal_progress_engine_v2 import _expected_pct_at
        bl = _expected_pct_at(0.5, "back_loaded")
        li = _expected_pct_at(0.5, "linear")
        assert bl < li, "back_loaded should be below linear at midpoint"

    def test_milestone_quartile_steps(self):
        from backend.services.goal_progress_engine_v2 import _expected_pct_at
        assert _expected_pct_at(0.25, "milestone") == pytest.approx(25.0, abs=0.5)
        assert _expected_pct_at(0.5, "milestone") == pytest.approx(50.0, abs=0.5)
        assert _expected_pct_at(0.75, "milestone") == pytest.approx(75.0, abs=0.5)


# ═══════════════════════════════════════════════════════════════════════
# 2. Completion score
# ═══════════════════════════════════════════════════════════════════════

class TestCompletionScore:
    def test_empty_components(self):
        from backend.services.goal_progress_engine_v2 import GoalProgressEngineV2
        assert GoalProgressEngineV2._completion_score([]) == 0.0

    def test_all_complete(self):
        from backend.services.goal_progress_engine_v2 import GoalProgressEngineV2
        comps = [
            _make_component(target_total=1.0, current_total=1.0, weight=1.0),
            _make_component(target_total=1.0, current_total=1.0, weight=2.0),
        ]
        score = GoalProgressEngineV2._completion_score(comps)
        assert score == pytest.approx(100.0, abs=0.1)

    def test_partial_completion_weighted(self):
        from backend.services.goal_progress_engine_v2 import GoalProgressEngineV2
        comps = [
            _make_component(target_total=1.0, current_total=1.0, weight=1.0),  # 100%
            _make_component(target_total=1.0, current_total=0.0, weight=1.0),  # 0%
        ]
        score = GoalProgressEngineV2._completion_score(comps)
        assert score == pytest.approx(50.0, abs=0.1)

    def test_heavy_weight_component_dominates(self):
        from backend.services.goal_progress_engine_v2 import GoalProgressEngineV2
        comps = [
            _make_component(target_total=1.0, current_total=1.0, weight=9.0),  # 90% weight
            _make_component(target_total=1.0, current_total=0.0, weight=1.0),  # 10% weight
        ]
        score = GoalProgressEngineV2._completion_score(comps)
        assert score == pytest.approx(90.0, abs=0.1)


# ═══════════════════════════════════════════════════════════════════════
# 3. Pace score
# ═══════════════════════════════════════════════════════════════════════

class TestPaceScore:
    def test_ahead_of_schedule(self):
        from backend.services.goal_progress_engine_v2 import GoalProgressEngineV2
        # 60% done but expected 30%
        pace = GoalProgressEngineV2._pace_score(60.0, 0.3, "linear")
        assert pace > 50.0, "Should show good pace when ahead"

    def test_behind_schedule(self):
        from backend.services.goal_progress_engine_v2 import GoalProgressEngineV2
        # 10% done but expected 50%
        pace = GoalProgressEngineV2._pace_score(10.0, 0.5, "linear")
        assert pace < 50.0, "Should show poor pace when behind"


# ═══════════════════════════════════════════════════════════════════════
# 4. Risk score
# ═══════════════════════════════════════════════════════════════════════

class TestRiskScore:
    def test_no_risk_at_start(self):
        from backend.services.goal_progress_engine_v2 import GoalProgressEngineV2
        comps = [_make_component(current_total=0.0, required=False)]
        goal = _make_goal(horizon_days=60)
        risk = GoalProgressEngineV2._risk_score(comps, date.today(), 0.1, goal)
        assert risk < 30, "Risk should be low at the start"

    def test_high_risk_past_deadline(self):
        from backend.services.goal_progress_engine_v2 import GoalProgressEngineV2
        comps = [_make_component(current_total=0.0, required=True)]
        goal = _make_goal(
            target_date=datetime.now(timezone.utc) - timedelta(days=10),
            horizon_days=30,
        )
        risk = GoalProgressEngineV2._risk_score(comps, date.today(), 1.2, goal)
        assert risk > 50, "Risk should be high past deadline with 0% completion"


# ═══════════════════════════════════════════════════════════════════════
# 5. Confidence model
# ═══════════════════════════════════════════════════════════════════════

class TestConfidenceModel:
    def test_zero_components(self):
        from backend.services.goal_progress_engine_v2 import GoalProgressEngineV2
        conf, state = GoalProgressEngineV2._confidence_model([], 5, 30)
        assert state == "calibrating"
        assert conf <= 0.2

    def test_many_active_components(self):
        from backend.services.goal_progress_engine_v2 import GoalProgressEngineV2
        comps = [_make_component(current_total=0.5) for _ in range(8)]
        conf, state = GoalProgressEngineV2._confidence_model(comps, 15, 30)
        assert conf > 0.5
        assert state in ("established", "high")


# ═══════════════════════════════════════════════════════════════════════
# 6. ULTRA gating (Explorer blocked)
# ═══════════════════════════════════════════════════════════════════════

class TestUltraGatingV2:
    def test_explorer_gets_fallback_result(self):
        from backend.services.goal_progress_engine_v2 import GoalProgressEngineV2
        import asyncio

        async def _run():
            db = AsyncMock()
            result = await GoalProgressEngineV2.calculate(
                db, goal_id=1, user_id=42, is_ultra=False,
            )
            assert result.explanation.get("blocked") == "ULTRA_REQUIRED"
            assert result.confidence_state == "calibrating"
            assert result.composite_score == 0.0

        asyncio.run(_run())

    def test_api_gate_blocks_explorer(self):
        from backend.services.entitlements_service import require_ultra_feature
        explorer = _make_user(plan_tier="explorer")
        with pytest.raises(HTTPException) as exc:
            require_ultra_feature(explorer, "goal_progress_detailed")
        assert exc.value.status_code == 403
        assert exc.value.detail["code"] == "PLAN_UPGRADE_REQUIRED"

    def test_api_gate_allows_ultra(self):
        from backend.services.entitlements_service import require_ultra_feature
        ultra = _make_user(plan_tier="ultra")
        require_ultra_feature(ultra, "goal_progress_detailed")  # no raise

    @pytest.mark.asyncio
    async def test_service_level_blocks_explorer(self):
        from backend.services.planner_service import planner_service
        with patch.object(
            planner_service, "_is_ultra_user_by_id",
            new_callable=AsyncMock, return_value=False,
        ):
            with pytest.raises(HTTPException) as exc:
                await planner_service.update_goal_progress("99", "1", 50)
            assert exc.value.status_code == 403


# ═══════════════════════════════════════════════════════════════════════
# 7. Success probability
# ═══════════════════════════════════════════════════════════════════════

class TestSuccessProbability:
    def test_completed_goal_near_100(self):
        from backend.services.goal_progress_engine_v2 import GoalProgressEngineV2
        prob = GoalProgressEngineV2._success_probability(
            completion=100.0, pace=100.0, risk=0.0,
            elapsed_frac=0.5, horizon_days=30, elapsed_days=15,
        )
        assert prob >= 95.0

    def test_past_deadline_low_completion(self):
        from backend.services.goal_progress_engine_v2 import GoalProgressEngineV2
        prob = GoalProgressEngineV2._success_probability(
            completion=10.0, pace=10.0, risk=90.0,
            elapsed_frac=1.2, horizon_days=30, elapsed_days=36,
        )
        assert prob < 30.0


# ═══════════════════════════════════════════════════════════════════════
# 7.5 Adaptive Smoothing
# ═══════════════════════════════════════════════════════════════════════

class TestAdaptiveSmoothing:
    @pytest.mark.asyncio
    async def test_adaptive_smoothing_short_interval(self):
        from backend.services.goal_progress_engine_v2 import GoalProgressEngineV2
        # Set up a goal analyzed just 1 hour ago
        now = datetime.now(timezone.utc)
        goal = _make_goal(current_progress=10)
        goal.last_analyzed_at = now - timedelta(hours=1)
        
        db = AsyncMock()
        db.execute.return_value.scalar_one_or_none.return_value = goal
        
        # A huge jump in completion
        with patch.object(GoalProgressEngineV2, "_completion_score", return_value=90.0), \
             patch.object(GoalProgressEngineV2, "_expected_pct_at", return_value=50.0):
            result = await GoalProgressEngineV2.calculate(db, 1, 42, is_ultra=True)
            
            # Short delta limit is +5 for 1 hour interval
            assert goal.current_progress == 15, "Should cap jump at +5 for short intervals"

    @pytest.mark.asyncio
    async def test_adaptive_smoothing_long_interval(self):
        from backend.services.goal_progress_engine_v2 import GoalProgressEngineV2
        # Set up a goal analyzed 48 hours ago
        now = datetime.now(timezone.utc)
        goal = _make_goal(current_progress=10)
        goal.last_analyzed_at = now - timedelta(hours=48)
        
        db = AsyncMock()
        db.execute.return_value.scalar_one_or_none.return_value = goal
        
        # A huge jump in completion
        with patch.object(GoalProgressEngineV2, "_completion_score", return_value=90.0), \
             patch.object(GoalProgressEngineV2, "_expected_pct_at", return_value=50.0):
            result = await GoalProgressEngineV2.calculate(db, 1, 42, is_ultra=True)
            
            # Long delta limit is higher (base 5 + 48*0.4 = 24.2)
            assert goal.current_progress == 34, "Should allow larger jump (+24) for long intervals"


# ═══════════════════════════════════════════════════════════════════════
# 8. Backward compatibility (v1 scoring_version)
# ═══════════════════════════════════════════════════════════════════════

class TestBackwardCompatibility:
    @pytest.mark.asyncio
    async def test_v1_goal_routes_to_old_engine(self):
        from backend.services.goal_lifecycle import recompute_if_linked

        ultra_user = _make_user(plan_tier="ultra", user_id=42)
        goal = _make_goal(scoring_version="v1")

        db = AsyncMock()
        # Mock db.execute to return user, then goal
        call_count = 0
        async def fake_execute(stmt):
            nonlocal call_count
            call_count += 1
            result = MagicMock()
            if call_count == 1:
                result.scalar_one_or_none.return_value = ultra_user
            elif call_count == 2:
                result.scalar_one_or_none.return_value = goal
            return result

        db.execute = fake_execute

        with patch("backend.services.entitlements_service.is_ultra_user", return_value=True), \
             patch("backend.services.goal_progress_engine.GoalProgressEngine.calculate_progress",
                   new_callable=AsyncMock) as mock_v1:
            await recompute_if_linked(db, 42, 1)
            mock_v1.assert_awaited_once_with(db, 1, 42, is_ultra=True)


# ═══════════════════════════════════════════════════════════════════════
# 9. Probability label
# ═══════════════════════════════════════════════════════════════════════

class TestProbabilityLabel:
    def test_all_labels(self):
        from backend.services.goal_progress_engine_v2 import GoalProgressEngineV2
        assert GoalProgressEngineV2._prob_label(10) == "Very Low"
        assert GoalProgressEngineV2._prob_label(30) == "Low"
        assert GoalProgressEngineV2._prob_label(50) == "Medium"
        assert GoalProgressEngineV2._prob_label(70) == "High"
        assert GoalProgressEngineV2._prob_label(85) == "Very High"
        assert GoalProgressEngineV2._prob_label(98) == "Extremely High"


# ═══════════════════════════════════════════════════════════════════════
# 10. Quality score
# ═══════════════════════════════════════════════════════════════════════

class TestQualityScore:
    def test_all_on_time(self):
        from backend.services.goal_progress_engine_v2 import GoalProgressEngineV2
        comps = [
            _make_component(current_total=1.0, target_total=1.0, quality_weight=1.0),
            _make_component(current_total=1.0, target_total=1.0, quality_weight=1.0),
        ]
        score = GoalProgressEngineV2._quality_score(comps, date.today())
        assert score == pytest.approx(100.0, abs=0.1)

    def test_overdue_penalty(self):
        from backend.services.goal_progress_engine_v2 import GoalProgressEngineV2
        comps = [
            _make_component(
                current_total=0.0,
                target_total=1.0,
                due_date=date.today() - timedelta(days=10),
                overdue_penalty_per_day=0.05,
            ),
        ]
        score = GoalProgressEngineV2._quality_score(comps, date.today())
        assert score < 50.0, "Overdue should heavily penalize quality"
