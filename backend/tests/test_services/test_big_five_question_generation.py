from types import SimpleNamespace

import pytest

from backend.ai.tools.personality_tools import PersonalityTools
from backend.services.big_five_test_service import BigFiveTestService


def test_extract_json_payload_from_code_fence():
    payload = PersonalityTools._extract_json_payload(
        """```json
        {"questions":[{"text":"I see myself as someone who adapts quickly.","trait":"openness","direction":1}]}
        ```"""
    )
    assert isinstance(payload, dict)
    assert "questions" in payload


def test_extract_questions_accepts_dict_and_list():
    from_dict = PersonalityTools._extract_questions(
        {"questions": [{"text": "Q1", "trait": "openness", "direction": 1}]}
    )
    from_list = PersonalityTools._extract_questions(
        [{"text": "Q2", "trait": "conscientiousness", "direction": -1}]
    )

    assert len(from_dict) == 1
    assert len(from_list) == 1


def test_normalize_questions_filters_invalid_entries():
    raw = [
        {"text": "Valid openness question", "trait": "openness", "direction": 1},
        {"text": "Valid openness question", "trait": "openness", "direction": 1},  # duplicate
        {"text": "Bad trait", "trait": "unknown", "direction": 1},
        {"text": "Bad direction", "trait": "agreeableness", "direction": 0},
        {"text": "Valid neuroticism question", "trait": "neuroticism", "direction": -1},
    ]

    normalized = PersonalityTools._normalize_questions(raw, max_count=10)

    assert len(normalized) == 2
    assert all("options" in item for item in normalized)
    assert all(item.get("source") == "ai" for item in normalized)
    assert {q["trait"] for q in normalized} == {"openness", "neuroticism"}


def test_build_balanced_question_set_rejects_unbalanced_pool():
    questions = [
        {"text": f"Open Q{i}", "trait": "openness", "direction": 1, "source": "ai", "options": []}
        for i in range(10)
    ]
    balanced = PersonalityTools._build_balanced_question_set(questions, num_questions=30)
    assert balanced == []


def test_get_total_questions_for_test_uses_stored_questions():
    service = BigFiveTestService()

    test_with_stored = SimpleNamespace(questions=[{"text": "q1"}, {"text": "q2"}])
    count = service._get_total_questions_for_test(test_with_stored, user_id=1)
    assert count == 2

    empty_test = SimpleNamespace(questions=[])
    default_count = service._get_total_questions_for_test(empty_test, user_id=1)
    assert default_count == service._get_total_questions_for_user(1)


def test_resolve_question_source():
    service = BigFiveTestService()

    assert service._resolve_question_source({"text": "Q", "source": "ai"}) == "ai"
    assert service._resolve_question_source({"text": "Q", "source": "fallback"}) == "fallback"
    assert service._resolve_question_source({"text": "Q"}) == "fallback"
    assert service._resolve_question_source(None) == "unknown"


@pytest.mark.asyncio
async def test_calculate_scores_missing_trait_uses_dynamic_average():
    service = BigFiveTestService()
    responses = [
        {"trait": "openness", "direction": 1, "response": 5},
        {"trait": "openness", "direction": 1, "response": 5},
        {"trait": "openness", "direction": 1, "response": 5},
    ]

    scores = await service._calculate_scores(responses)
    # With all responses at max, missing traits should follow dynamic average,
    # not a hardcoded neutral 50.
    assert scores["openness"] == 100
    assert scores["conscientiousness"] == 100
