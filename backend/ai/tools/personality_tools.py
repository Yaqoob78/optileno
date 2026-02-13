
"""
Personality Tools - AI-powered personality assessment generation
"""
from typing import List, Dict, Any, Optional
import logging
import json
import random
import re

from backend.ai.client import DualAIClient

logger = logging.getLogger(__name__)

VALID_TRAITS = {
    "openness",
    "conscientiousness",
    "extraversion",
    "agreeableness",
    "neuroticism",
}

LIKERT_OPTIONS = [
    {"value": 1, "label": "Disagree strongly"},
    {"value": 2, "label": "Disagree a little"},
    {"value": 3, "label": "Neither agree nor disagree"},
    {"value": 4, "label": "Agree a little"},
    {"value": 5, "label": "Agree strongly"},
]
TRAITS = ["openness", "conscientiousness", "extraversion", "agreeableness", "neuroticism"]

class PersonalityTools:
    """Tools for AI to generate personality assessments"""

    @staticmethod
    def _strip_code_fences(text: str) -> str:
        cleaned = text.strip()
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"\s*```$", "", cleaned)
        return cleaned.strip()

    @staticmethod
    def _extract_json_payload(text: str) -> Optional[Any]:
        """
        Parse AI text response into JSON.
        Supports direct JSON, markdown code fences, and text-wrapped JSON blocks.
        """
        if not text:
            return None

        cleaned = PersonalityTools._strip_code_fences(text)

        # 1) Try full string as JSON
        try:
            return json.loads(cleaned)
        except json.JSONDecodeError:
            pass

        # 2) Try extracting JSON object/list from mixed text
        candidates = []
        candidates.extend(re.findall(r"\{[\s\S]*\}", cleaned))
        candidates.extend(re.findall(r"\[[\s\S]*\]", cleaned))
        for candidate in candidates:
            try:
                return json.loads(candidate)
            except json.JSONDecodeError:
                continue

        return None

    @staticmethod
    def _extract_questions(payload: Any) -> List[Dict[str, Any]]:
        if isinstance(payload, dict):
            raw = payload.get("questions", [])
        elif isinstance(payload, list):
            raw = payload
        else:
            raw = []

        return [q for q in raw if isinstance(q, dict)]

    @staticmethod
    def _normalize_questions(raw_questions: List[Dict[str, Any]], max_count: int) -> List[Dict[str, Any]]:
        normalized: List[Dict[str, Any]] = []
        seen_texts = set()

        for item in raw_questions:
            text = item.get("text") or item.get("question")
            trait = item.get("trait")
            direction = item.get("direction", 1)

            if not isinstance(text, str):
                continue
            text = " ".join(text.split()).strip()
            if not text:
                continue

            text_key = text.lower()
            if text_key in seen_texts:
                continue

            if not isinstance(trait, str):
                continue
            trait = trait.strip().lower()
            if trait not in VALID_TRAITS:
                continue

            try:
                direction_int = int(direction)
            except (TypeError, ValueError):
                continue
            if direction_int not in (1, -1):
                continue

            normalized.append(
                {
                    "text": text,
                    "trait": trait,
                    "direction": direction_int,
                    "options": LIKERT_OPTIONS,
                    "source": "ai",
                }
            )
            seen_texts.add(text_key)

            if len(normalized) >= max_count:
                break

        return normalized

    @staticmethod
    def _build_balanced_question_set(
        questions: List[Dict[str, Any]],
        num_questions: int
    ) -> List[Dict[str, Any]]:
        """
        Ensure each trait is represented so scoring is response-driven,
        not default-filled for missing traits.
        """
        traits = sorted(VALID_TRAITS)
        trait_count = len(traits)
        if num_questions <= 0 or trait_count == 0:
            return []

        per_trait_target = max(1, num_questions // trait_count)
        by_trait: Dict[str, List[Dict[str, Any]]] = {trait: [] for trait in traits}
        for q in questions:
            trait = q.get("trait")
            if trait in by_trait:
                by_trait[trait].append(q)

        # If any trait is missing required coverage, treat AI output as unusable.
        if any(len(by_trait[trait]) < per_trait_target for trait in traits):
            return []

        rng = random.SystemRandom()
        selected: List[Dict[str, Any]] = []

        for trait in traits:
            pool = by_trait[trait][:]
            rng.shuffle(pool)
            selected.extend(pool[:per_trait_target])

        remainder = num_questions - len(selected)
        if remainder > 0:
            used_texts = {q["text"].lower() for q in selected}
            leftovers: List[Dict[str, Any]] = []
            for trait in traits:
                for q in by_trait[trait]:
                    key = q["text"].lower()
                    if key not in used_texts:
                        leftovers.append(q)
                        used_texts.add(key)
            rng.shuffle(leftovers)
            selected.extend(leftovers[:remainder])

        rng.shuffle(selected)
        return selected[:num_questions]

    @staticmethod
    def _is_ai_unavailable_response(text: str) -> bool:
        lower = text.lower()
        known_failures = [
            "daily limit reached",
            "trouble connecting to ai services",
            "quota resets at midnight",
            "api key missing",
            "user not found",
        ]
        return any(marker in lower for marker in known_failures)

    @staticmethod
    def _format_behavior_context(behavior_context: Optional[Dict[str, Any]]) -> str:
        if not behavior_context:
            return "No recent behavioral context is available."

        top_events = behavior_context.get("top_events", [])
        top_events_text = ", ".join(
            f"{evt.get('event_type', 'unknown')} ({evt.get('count', 0)})"
            for evt in top_events[:5]
        ) or "none"

        return (
            f"- Window: last {behavior_context.get('window_days', 14)} days\n"
            f"- Task completion rate: {behavior_context.get('task_completion_rate', 0)}%\n"
            f"- Tasks completed: {behavior_context.get('tasks_completed', 0)}/{behavior_context.get('tasks_total', 0)}\n"
            f"- Average focus score: {behavior_context.get('avg_focus_score', 0)}\n"
            f"- Active goals: {behavior_context.get('active_goals', 0)}\n"
            f"- Top events: {top_events_text}"
        )

    @staticmethod
    async def _generate_trait_questions(
        client: DualAIClient,
        trait: str,
        count: int,
        behavior_text: str,
    ) -> List[Dict[str, Any]]:
        """
        Generate questions for one trait to guarantee balanced trait coverage.
        """
        if count <= 0:
            return []

        collected: List[Dict[str, Any]] = []
        seen_texts = set()

        for attempt in range(4):
            variation_key = random.randint(100000, 999999)
            prompt = f"""
Generate exactly {count} Big Five test statements for the trait: {trait}.
Variation key: {variation_key}
Attempt: {attempt + 1}

USER BEHAVIOR CONTEXT (tailor wording, do not mention these metrics directly):
{behavior_text}

RULES:
1. Every question must have trait="{trait}".
2. Include both direction=1 and direction=-1 items when count > 1.
3. Keep statements clear, first-person, and suitable for Likert scale responses.
4. Return ONLY valid JSON in this format:
{{
  "questions": [
    {{
      "text": "I see myself as someone who ...",
      "trait": "{trait}",
      "direction": 1
    }}
  ]
}}
"""
            response = await client.generate_response(prompt)
            if not response or PersonalityTools._is_ai_unavailable_response(response):
                logger.warning("AI unavailable for trait question generation: %s", trait)
                continue

            payload = PersonalityTools._extract_json_payload(response)
            if payload is None:
                continue

            raw_questions = PersonalityTools._extract_questions(payload)
            normalized = PersonalityTools._normalize_questions(raw_questions, max_count=count * 3)

            for q in normalized:
                if q.get("trait") != trait:
                    continue
                key = q["text"].lower()
                if key in seen_texts:
                    continue
                collected.append(q)
                seen_texts.add(key)
                if len(collected) >= count:
                    break

            if len(collected) >= count:
                break

        if len(collected) < count:
            return []

        rng = random.SystemRandom()
        rng.shuffle(collected)
        return collected[:count]

    @staticmethod
    async def generate_big_five_questions(
        user_id: int,
        num_questions: int = 30,
        behavior_context: Optional[Dict[str, Any]] = None,
    ) -> List[Dict[str, Any]]:
        """
        Generate dynamic Big Five personality questions based on user context.
        
        Args:
            user_id: User to generate questions for
            num_questions: Total questions to generate (default 30)
            
        Returns:
            List of question objects with proper structure
        """
        try:
            client = DualAIClient(str(user_id))
            behavior_text = PersonalityTools._format_behavior_context(behavior_context)
            trait_count = len(TRAITS)
            base_count = num_questions // trait_count
            remainder = num_questions % trait_count

            targets = {
                trait: base_count + (1 if idx < remainder else 0)
                for idx, trait in enumerate(TRAITS)
            }

            all_questions: List[Dict[str, Any]] = []
            for trait in TRAITS:
                trait_questions = await PersonalityTools._generate_trait_questions(
                    client=client,
                    trait=trait,
                    count=targets[trait],
                    behavior_text=behavior_text,
                )
                if len(trait_questions) < targets[trait]:
                    logger.warning(
                        "AI did not generate enough %s questions (%s/%s).",
                        trait,
                        len(trait_questions),
                        targets[trait],
                    )
                    return []
                all_questions.extend(trait_questions)

            rng = random.SystemRandom()
            rng.shuffle(all_questions)
            return all_questions[:num_questions]

        except Exception as e:
            logger.error(f"Error generating personality questions: {str(e)}")
            # Fallback will be handled by the service (using hardcoded list)
            return []

personality_tools = PersonalityTools()
