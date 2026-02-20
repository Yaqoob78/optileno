import pytest
from backend.ai.tool_contracts import validate_tool_payload, ToolExecutionError

def test_explorer_cannot_create_deepwork():
    payload = {"duration_minutes": 60, "focus_goal": "Code"}
    with pytest.raises(ToolExecutionError) as exc:
        validate_tool_payload("START_DEEP_WORK", payload, "explorer")
    assert "Ultra tier" in str(exc.value)

def test_ultra_can_create_deepwork():
    payload = {"duration_minutes": 60, "focus_goal": "Code"}
    result = validate_tool_payload("START_DEEP_WORK", payload, "ultra")
    assert result["duration_minutes"] == 60

def test_explorer_cannot_pass_goal_link():
    payload = {"title": "Task 1", "goal_link": "some_goal"}
    with pytest.raises(ToolExecutionError) as exc:
        validate_tool_payload("CREATE_TASK", payload, "explorer")
    assert "goal_link" in str(exc.value)

def test_ultra_can_pass_goal_link():
    payload = {"title": "Task 1", "goal_link": "some_goal"}
    result = validate_tool_payload("CREATE_TASK", payload, "ultra")
    assert result["goal_link"] == "some_goal"
