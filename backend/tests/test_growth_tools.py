from backend.services.growth_tools import generate_task_prioritizer, generate_weekly_planner


def test_task_prioritizer_returns_consistent_empty_bridge_key():
    result = generate_task_prioritizer("   ")

    assert "optileno_bridge" in result
    assert "optageno_bridge" not in result
    assert result["top_priorities"] == []


def test_task_prioritizer_cleans_bullets_and_prioritizes_external_work():
    result = generate_task_prioritizer(
        """
        • Research color palettes
        1. Fix checkout bug before demo
        - Clean old notes
        """,
        work_hours=4,
    )

    assert result["top_priorities"][0]["task"] == "Fix checkout bug before demo"
    assert result["top_priorities"][0]["score"] > result["top_priorities"][-1]["score"]
    assert result["time_blocks"][0]["minutes"] >= 25


def test_weekly_planner_clamps_hours_and_keeps_goal_visible():
    result = generate_weekly_planner("Launch the beta onboarding flow", hours_per_day=10)

    assert len(result["days"]) == 7
    assert result["days"][0]["focus_block_minutes"] == 180
    assert "Launch the beta onboarding flow" in result["weekly_theme"]
