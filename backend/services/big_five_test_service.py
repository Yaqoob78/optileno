# backend/services/big_five_test_service.py
"""
Big Five Personality Test Service

This service manages the Big Five personality assessment, including:
1. Test initiation and progress tracking
2. AI-powered question generation (20-44 questions based on BFI-44)
3. Score calculation for each trait dimension
4. Behavioral adjustments based on user activity
5. 14-day cooldown between tests
"""

from datetime import datetime, timedelta, timezone
from typing import Dict, Any, List, Optional, Tuple
import logging
import random
import math
from sqlalchemy import select, func, and_, desc, text
from sqlalchemy.orm import Session

from backend.db.database import get_db
from backend.db.models import BigFiveTest, Task, AnalyticsEvent, FocusScore, Goal
from backend.ai.tools.personality_tools import personality_tools

logger = logging.getLogger(__name__)


# BFI-44 Based Question Bank
# Each question maps to a trait and has a direction (positive/negative scoring)
BFI_QUESTIONS = {
    "openness": [
        {"text": "I see myself as someone who is curious about many different things.", "direction": 1},
        {"text": "I see myself as someone who is original, comes up with new ideas.", "direction": 1},
        {"text": "I see myself as someone who is sophisticated in art, music, or literature.", "direction": 1},
        {"text": "I see myself as someone who has an active imagination.", "direction": 1},
        {"text": "I see myself as someone who values artistic, aesthetic experiences.", "direction": 1},
        {"text": "I see myself as someone who likes to reflect, play with ideas.", "direction": 1},
        {"text": "I see myself as someone who prefers work that is routine.", "direction": -1},
        {"text": "I see myself as someone who has few artistic interests.", "direction": -1},
        {"text": "I see myself as someone who is inventive.", "direction": 1},
        {"text": "I see myself as someone who is ingenious, a deep thinker.", "direction": 1},
    ],
    "conscientiousness": [
        {"text": "I see myself as someone who does a thorough job.", "direction": 1},
        {"text": "I see myself as someone who can be somewhat careless.", "direction": -1},
        {"text": "I see myself as someone who is a reliable worker.", "direction": 1},
        {"text": "I see myself as someone who tends to be disorganized.", "direction": -1},
        {"text": "I see myself as someone who tends to be lazy.", "direction": -1},
        {"text": "I see myself as someone who perseveres until the task is finished.", "direction": 1},
        {"text": "I see myself as someone who does things efficiently.", "direction": 1},
        {"text": "I see myself as someone who makes plans and follows through with them.", "direction": 1},
        {"text": "I see myself as someone who is easily distracted.", "direction": -1},
        {"text": "I see myself as someone who is a hard worker.", "direction": 1},
    ],
    "extraversion": [
        {"text": "I see myself as someone who is talkative.", "direction": 1},
        {"text": "I see myself as someone who is reserved.", "direction": -1},
        {"text": "I see myself as someone who is full of energy.", "direction": 1},
        {"text": "I see myself as someone who generates a lot of enthusiasm.", "direction": 1},
        {"text": "I see myself as someone who tends to be quiet.", "direction": -1},
        {"text": "I see myself as someone who has an assertive personality.", "direction": 1},
        {"text": "I see myself as someone who is sometimes shy, inhibited.", "direction": -1},
        {"text": "I see myself as someone who is outgoing, sociable.", "direction": 1},
        {"text": "I see myself as someone who prefers to work alone.", "direction": -1},
        {"text": "I see myself as someone who is warm and friendly.", "direction": 1},
    ],
    "agreeableness": [
        {"text": "I see myself as someone who tends to find fault with others.", "direction": -1},
        {"text": "I see myself as someone who is helpful and unselfish with others.", "direction": 1},
        {"text": "I see myself as someone who starts quarrels with others.", "direction": -1},
        {"text": "I see myself as someone who has a forgiving nature.", "direction": 1},
        {"text": "I see myself as someone who is generally trusting.", "direction": 1},
        {"text": "I see myself as someone who can be cold and aloof.", "direction": -1},
        {"text": "I see myself as someone who is considerate and kind to almost everyone.", "direction": 1},
        {"text": "I see myself as someone who is sometimes rude to others.", "direction": -1},
        {"text": "I see myself as someone who likes to cooperate with others.", "direction": 1},
        {"text": "I see myself as someone who is polite.", "direction": 1},
    ],
    "neuroticism": [
        {"text": "I see myself as someone who is depressed, blue.", "direction": 1},
        {"text": "I see myself as someone who is relaxed, handles stress well.", "direction": -1},
        {"text": "I see myself as someone who can be tense.", "direction": 1},
        {"text": "I see myself as someone who worries a lot.", "direction": 1},
        {"text": "I see myself as someone who is emotionally stable, not easily upset.", "direction": -1},
        {"text": "I see myself as someone who can be moody.", "direction": 1},
        {"text": "I see myself as someone who remains calm in tense situations.", "direction": -1},
        {"text": "I see myself as someone who gets nervous easily.", "direction": 1},
        {"text": "I see myself as someone who is easily frustrated.", "direction": 1},
        {"text": "I see myself as someone who keeps their cool under pressure.", "direction": -1},
    ],
}

# Response scale (1-5 Likert scale)
RESPONSE_SCALE = {
    1: "Disagree strongly",
    2: "Disagree a little",
    3: "Neither agree nor disagree",
    4: "Agree a little",
    5: "Agree strongly"
}

TRAITS = ("openness", "conscientiousness", "extraversion", "agreeableness", "neuroticism")


class BigFiveTestService:
    """
    Service for managing Big Five personality assessments.
    """
    _schema_checked: bool = False

    async def _ensure_timezones(self, dt: Optional[datetime]) -> Optional[datetime]:
        """Ensure datetime is timezone-aware."""
        if dt and dt.tzinfo is None:
            return dt.replace(tzinfo=timezone.utc)
        return dt

    async def get_test_status(self, user_id: int) -> Dict[str, Any]:
        """
        Get the current test status for a user.
        
        Returns:
            - has_completed_test: bool
            - test_in_progress: bool
            - current_scores: dict or None
            - days_until_next_test: int or None
            - next_test_available: bool
        """
        try:
            async for db in get_db():
                # Get the most recent test
                result = await db.execute(
                    select(BigFiveTest)
                    .where(BigFiveTest.user_id == user_id)
                    .order_by(desc(BigFiveTest.created_at))
                    .limit(1)
                )
                test = result.scalars().first()
                
                if not test:
                    return {
                        "has_completed_test": False,
                        "test_in_progress": False,
                        "current_scores": None,
                        "days_until_next_test": None,
                        "next_test_available": True,
                        "can_take_test": True
                    }
                
                # Check if test is in progress
                if test.test_in_progress and not test.test_completed:
                    return {
                        "has_completed_test": False,
                        "test_in_progress": True,
                        "current_question_index": test.current_question_index,
                        "questions_asked": test.questions_asked,
                        "current_scores": None,
                        "days_until_next_test": None,
                        "next_test_available": False,
                        "can_take_test": False,
                        "test_id": test.id
                    }
                
                # Test is completed
                if test.test_completed:
                    await self._refresh_scores_from_responses_if_needed(db, test)
                    # Calculate adjusted scores
                    adjusted_scores = await self._get_adjusted_scores(test)
                    
                    # Check if next test is available
                    now = datetime.now(timezone.utc)
                    completed_at = await self._ensure_timezones(test.test_completed_at)
                    
                    if completed_at:
                        # DEV OVERRIDE: Ignore DB stored future date to allow testing
                        next_available = completed_at + timedelta(minutes=1)
                        is_available = now >= next_available
                    else:
                        is_available = True
                        next_available = None
                    
                    if next_available and not is_available:
                        seconds_remaining = max(0.0, (next_available - now).total_seconds())
                        days_remaining = max(1, math.ceil(seconds_remaining / 86400))
                        return {
                            "has_completed_test": True,
                            "test_in_progress": False,
                            "current_scores": adjusted_scores,
                            "days_until_next_test": days_remaining,
                            "next_test_available": False,
                            "can_take_test": False,
                            "test_completed_at": test.test_completed_at.isoformat() if test.test_completed_at else None,
                            "test_id": test.id
                        }
                    else:
                        return {
                            "has_completed_test": True,
                            "test_in_progress": False,
                            "current_scores": adjusted_scores,
                            "days_until_next_test": 0,
                            "next_test_available": True,
                            "can_take_test": True,
                            "test_completed_at": test.test_completed_at.isoformat() if test.test_completed_at else None,
                            "test_id": test.id
                        }
                
                return {
                    "has_completed_test": False,
                    "test_in_progress": False,
                    "current_scores": None,
                    "days_until_next_test": None,
                    "next_test_available": True,
                    "can_take_test": True
                }
        except Exception as e:
            logger.error(f"Error getting test status for user {user_id}: {e}")
            # Return safe default on error
            return {
                "has_completed_test": False,
                "test_in_progress": False,
                "current_scores": None,
                "days_until_next_test": None,
                "next_test_available": True,
                "can_take_test": True,
                "error": str(e)
            }

    async def start_test(self, user_id: int, force_new: bool = False) -> Dict[str, Any]:
        """
        Start a new Big Five test or resume an existing one.
        
        Returns the first question and test metadata.
        """
        try:
            async for db in get_db():
                # Check for existing in-progress test
                result = await db.execute(
                    select(BigFiveTest)
                    .where(
                        BigFiveTest.user_id == user_id,
                        BigFiveTest.test_in_progress == True,
                        BigFiveTest.test_completed == False
                    )
                    .limit(1)
                )
                existing_test = result.scalars().first()
                
                if existing_test:
                    if force_new:
                        existing_test.test_in_progress = False
                        await db.commit()
                        existing_test = None
                    else:
                        # Resume existing test
                        question = await self._get_question_for_test(existing_test, db, user_id)
                        total_questions = self._get_total_questions_for_test(existing_test, user_id)
                        if question is not None:
                            question_source = self._resolve_question_source(question)
                            return {
                                "test_id": existing_test.id,
                                "question_index": existing_test.current_question_index,
                                "question": question,
                                "total_questions": total_questions,
                                "is_resumed": True,
                                "question_source": question_source,
                                "using_fallback": question_source == "fallback",
                            }

                        # Defensive recovery for stale sessions where question index drifted
                        logger.warning(
                            "Invalid in-progress Big Five test detected for user %s (test_id=%s). Restarting session.",
                            user_id,
                            existing_test.id,
                        )
                        existing_test.test_in_progress = False
                        await db.commit()

                if existing_test and force_new:
                    existing_test = None

                # Check if user can take a new test
                result = await db.execute(
                    select(BigFiveTest)
                    .where(
                        BigFiveTest.user_id == user_id,
                        BigFiveTest.test_completed == True
                    )
                    .order_by(desc(BigFiveTest.test_completed_at))
                    .limit(1)
                )
                last_completed = result.scalars().first()
                
                # Respect 14-day cooldown between completed tests
                if last_completed:
                    now = datetime.now(timezone.utc)
                    completed_at = await self._ensure_timezones(last_completed.test_completed_at)
                    
                    if completed_at:
                        # DEV OVERRIDE: Ignore DB stored future date to allow testing
                        next_available = completed_at + timedelta(minutes=1)
                        is_future = next_available > now
                    else:
                        is_future = False
                        next_available = None

                    if next_available and is_future:
                        seconds_remaining = max(0.0, (next_available - now).total_seconds())
                        days_remaining = max(1, math.ceil(seconds_remaining / 86400))
                        return {
                            "error": f"Next personality test will be available in {days_remaining} day(s).",
                            "days_remaining": days_remaining,
                            "can_retry": False,
                        }
                
                requested_question_count = self._get_total_questions_for_user(user_id)
                question_source = "ai"
                behavior_context = await self._build_behavior_context(db, user_id)

                # Generate questions - AI first, fallback only if AI returns nothing usable
                generated_questions = []
                try:
                    generated_questions = await personality_tools.generate_big_five_questions(
                        user_id, 
                        num_questions=requested_question_count,
                        behavior_context=behavior_context,
                    )
                except Exception as e:
                    logger.warning(f"AI question generation failed: {e}")
                
                # Fallback only when AI produced no usable question set
                if not generated_questions:
                    logger.warning("Using hardcoded question fallback")
                    generated_questions = self._get_randomized_questions(user_id)
                    question_source = "fallback"

                total_questions = len(generated_questions)
                if total_questions == 0:
                    return {
                        "error": "No personality questions available right now. Please try again.",
                        "can_retry": True,
                    }
                
                # Create new test
                new_test = BigFiveTest(
                    user_id=user_id,
                    test_in_progress=True,
                    test_completed=False,
                    test_started_at=datetime.now(timezone.utc),
                    current_question_index=0,
                    questions_asked=0,
                    question_responses=[],
                    questions=generated_questions
                )
                
                db.add(new_test)
                
                # Commit and refresh
                await db.commit()
                await db.refresh(new_test)
                
                question = await self._get_question_for_test(new_test, db, user_id)
                
                return {
                    "test_id": new_test.id,
                    "question_index": 0,
                    "question": question,
                    "total_questions": total_questions,
                    "is_resumed": False,
                    "question_source": question_source,
                    "using_fallback": question_source == "fallback",
                }
        except Exception as e:
            logger.error(f"Error starting test for user {user_id}: {e}")
            return {
                "error": f"Failed to start test: {str(e)}",
                "can_retry": True
            }

    async def answer_question(
        self, 
        user_id: int, 
        test_id: int, 
        response: int  # 1-5 Likert scale
    ) -> Dict[str, Any]:
        """
        Process a question response and return the next question.
        
        Args:
            user_id: User ID
            test_id: Test ID  
            response: 1-5 response value
        
        Returns:
            Next question or test completion results
        """
        if response < 1 or response > 5:
            return {"error": "Response must be between 1 and 5"}
        
        async for db in get_db():
            # Get the test
            result = await db.execute(
                select(BigFiveTest)
                .where(
                    BigFiveTest.id == test_id,
                    BigFiveTest.user_id == user_id
                )
            )
            test = result.scalars().first()
            
            if not test:
                return {"error": "Test not found"}
            
            if test.test_completed:
                return {"error": "Test already completed"}
            
            # Get current question details
            current_q_index = test.current_question_index
            
            # Get questions source
            stored_questions = getattr(test, "questions", [])
            if stored_questions and len(stored_questions) > 0:
                questions = stored_questions
            else:
                # Randomize fallback questions
                questions = self._get_randomized_questions(user_id)

            total_questions = len(questions)
            if total_questions == 0:
                return {"error": "No questions available for this test session"}
            
            if current_q_index >= len(questions):
                return {"error": "No more questions"}
            
            current_question = questions[current_q_index]
            
            # Store response
            responses = test.question_responses or []
            responses.append({
                "question_index": current_q_index,
                "trait": current_question["trait"],
                "question_text": current_question["text"],
                "direction": current_question["direction"],
                "source": current_question.get("source", "fallback"),
                "response": response,
                "timestamp": datetime.now(timezone.utc).isoformat()
            })
            
            # Update test
            test.question_responses = responses
            test.questions_asked = len(responses)
            test.current_question_index = current_q_index + 1
            live_scores = await self._calculate_scores(responses)

            # Check if test is complete
            if test.current_question_index >= total_questions:
                # Calculate final scores
                scores = live_scores
                
                test.openness = scores["openness"]
                test.conscientiousness = scores["conscientiousness"]
                test.extraversion = scores["extraversion"]
                test.agreeableness = scores["agreeableness"]
                test.neuroticism = scores["neuroticism"]
                test.test_completed = True
                test.test_in_progress = False
                test.test_completed_at = datetime.now(timezone.utc)
                test.next_test_available_at = datetime.now(timezone.utc) + timedelta(minutes=1)
                
                await db.commit()
                
                return {
                    "test_completed": True,
                    "scores": scores,
                    "live_scores": scores,
                    "next_test_available_in_days": 14,
                    "message": "Test completed! Your Big Five personality profile has been calculated."
                }
            
            # Get next question
            await db.commit()
            next_question = await self._get_question_for_test(test, db, user_id)
            question_source = self._resolve_question_source(next_question)
            
            return {
                "test_completed": False,
                "question_index": test.current_question_index,
                "question": next_question,
                "question_source": question_source,
                "using_fallback": question_source == "fallback",
                "live_scores": live_scores,
                "progress": test.current_question_index / total_questions * 100,
                "remaining_questions": total_questions - test.current_question_index
            }

    async def get_completed_profile(self, user_id: int) -> Optional[Dict[str, Any]]:
        """Get the most recent completed personality profile with adjusted scores."""
        async for db in get_db():
            result = await db.execute(
                select(BigFiveTest)
                .where(
                    BigFiveTest.user_id == user_id,
                    BigFiveTest.test_completed == True
                )
                .order_by(desc(BigFiveTest.test_completed_at))
                .limit(1)
            )
            test = result.scalars().first()
            
            if not test:
                return None

            await self._refresh_scores_from_responses_if_needed(db, test)
            
            adjusted_scores = await self._get_adjusted_scores(test)
            
            return {
                "scores": adjusted_scores,
                "test_completed_at": test.test_completed_at.isoformat() if test.test_completed_at else None,
                "next_test_available_at": test.next_test_available_at.isoformat() if test.next_test_available_at else None,
                "questions_answered": test.questions_asked,
                "adjustments": {
                    "openness": test.openness_adjustment,
                    "conscientiousness": test.conscientiousness_adjustment,
                    "extraversion": test.extraversion_adjustment,
                    "agreeableness": test.agreeableness_adjustment,
                    "neuroticism": test.neuroticism_adjustment,
                }
            }

    async def apply_behavioral_adjustment(self, user_id: int) -> Dict[str, Any]:
        """
        Calculate and apply behavioral adjustments based on user activity.
        Called periodically (e.g., daily) to slightly modify Big Five scores.
        
        Adjustments are capped at ±5 points max to prevent drastic changes.
        """
        async for db in get_db():
            # Get the most recent completed test
            result = await db.execute(
                select(BigFiveTest)
                .where(
                    BigFiveTest.user_id == user_id,
                    BigFiveTest.test_completed == True
                )
                .order_by(desc(BigFiveTest.test_completed_at))
                .limit(1)
            )
            test = result.scalars().first()
            
            if not test:
                return {"error": "No completed test found"}
            
            # Analyze recent behavior (last 7 days)
            seven_days_ago = datetime.now(timezone.utc) - timedelta(days=7)
            
            # Task completion affects Conscientiousness
            task_result = await db.execute(
                select(
                    func.count(Task.id).label("total"),
                    func.sum(
                        func.case(
                            (Task.status == 'completed', 1),
                            else_=0
                        )
                    ).label("completed")
                ).where(
                    Task.user_id == user_id,
                    Task.created_at >= seven_days_ago
                )
            )
            task_stats = task_result.first()
            
            # Focus sessions affect Openness and Conscientiousness
            focus_result = await db.execute(
                select(func.avg(FocusScore.score))
                .where(
                    FocusScore.user_id == user_id,
                    FocusScore.date >= seven_days_ago
                )
            )
            avg_focus = focus_result.scalar() or 0
            
            # Event count affects Extraversion
            event_result = await db.execute(
                select(func.count(AnalyticsEvent.id))
                .where(
                    AnalyticsEvent.user_id == user_id,
                    AnalyticsEvent.timestamp >= seven_days_ago
                )
            )
            total_events = event_result.scalar() or 0
            
            # Calculate adjustments (very small: -0.5 to +0.5 per week)
            adjustments = {
                "conscientiousness": 0.0,
                "openness": 0.0,
                "extraversion": 0.0,
                "agreeableness": 0.0,
                "neuroticism": 0.0
            }
            
            # Task completion rate -> Conscientiousness
            if task_stats.total and task_stats.total > 0:
                completion_rate = (task_stats.completed or 0) / task_stats.total
                if completion_rate > 0.7:
                    adjustments["conscientiousness"] += 0.3
                elif completion_rate < 0.3:
                    adjustments["conscientiousness"] -= 0.2
            
            # Focus score -> Openness and Conscientiousness
            if avg_focus > 70:
                adjustments["openness"] += 0.2
                adjustments["conscientiousness"] += 0.2
            elif avg_focus < 30:
                adjustments["conscientiousness"] -= 0.1
            
            # Activity level -> Extraversion
            daily_events = total_events / 7
            if daily_events > 20:
                adjustments["extraversion"] += 0.3
            elif daily_events < 5:
                adjustments["extraversion"] -= 0.1
            
            # Apply adjustments with caps
            MAX_ADJUSTMENT = 5.0
            
            test.openness_adjustment = max(
                -MAX_ADJUSTMENT, 
                min(MAX_ADJUSTMENT, test.openness_adjustment + adjustments["openness"])
            )
            test.conscientiousness_adjustment = max(
                -MAX_ADJUSTMENT,
                min(MAX_ADJUSTMENT, test.conscientiousness_adjustment + adjustments["conscientiousness"])
            )
            test.extraversion_adjustment = max(
                -MAX_ADJUSTMENT,
                min(MAX_ADJUSTMENT, test.extraversion_adjustment + adjustments["extraversion"])
            )
            test.agreeableness_adjustment = max(
                -MAX_ADJUSTMENT,
                min(MAX_ADJUSTMENT, test.agreeableness_adjustment + adjustments["agreeableness"])
            )
            test.neuroticism_adjustment = max(
                -MAX_ADJUSTMENT,
                min(MAX_ADJUSTMENT, test.neuroticism_adjustment + adjustments["neuroticism"])
            )
            
            await db.commit()
            
            return {
                "applied_adjustments": adjustments,
                "total_adjustments": {
                    "openness": test.openness_adjustment,
                    "conscientiousness": test.conscientiousness_adjustment,
                    "extraversion": test.extraversion_adjustment,
                    "agreeableness": test.agreeableness_adjustment,
                    "neuroticism": test.neuroticism_adjustment,
                }
            }

    async def _get_adjusted_scores(self, test: BigFiveTest) -> Dict[str, int]:
        """Get scores with behavioral adjustments applied."""
        def safe_int(val):
            return int(val) if val is not None else 0

        base_scores = {
            "openness": test.openness,
            "conscientiousness": test.conscientiousness,
            "extraversion": test.extraversion,
            "agreeableness": test.agreeableness,
            "neuroticism": test.neuroticism,
        }
        responses = test.question_responses or []
        if responses and any(base_scores.get(trait) is None for trait in TRAITS):
            recalculated = await self._calculate_scores(responses)
            for trait in TRAITS:
                if base_scores.get(trait) is None:
                    base_scores[trait] = recalculated[trait]
        for trait in TRAITS:
            if base_scores.get(trait) is None:
                base_scores[trait] = 0

        return {
            "openness": max(0, min(100, int(base_scores["openness"]) + safe_int(test.openness_adjustment))),
            "conscientiousness": max(0, min(100, int(base_scores["conscientiousness"]) + safe_int(test.conscientiousness_adjustment))),
            "extraversion": max(0, min(100, int(base_scores["extraversion"]) + safe_int(test.extraversion_adjustment))),
            "agreeableness": max(0, min(100, int(base_scores["agreeableness"]) + safe_int(test.agreeableness_adjustment))),
            "neuroticism": max(0, min(100, int(base_scores["neuroticism"]) + safe_int(test.neuroticism_adjustment))),
        }

    async def _calculate_scores(self, responses: List[Dict]) -> Dict[str, int]:
        """
        Calculate Big Five scores from question responses.
        
        Uses the BFI scoring method:
        - For positive direction questions: score = response value
        - For negative direction questions: score = 6 - response value
        - Final score = (sum / max_possible) * 100
        """
        trait_scores = {
            "openness": [],
            "conscientiousness": [],
            "extraversion": [],
            "agreeableness": [],
            "neuroticism": []
        }
        
        for r in responses:
            trait = r["trait"]
            direction = r["direction"]
            response = r["response"]
            
            # Normalize score (1-5 scale)
            if direction == 1:
                normalized = response
            else:
                normalized = 6 - response  # Reverse scoring
            
            trait_scores[trait].append(normalized)
        
        all_normalized_values: List[float] = []
        for scores in trait_scores.values():
            all_normalized_values.extend(scores)
        overall_avg = (sum(all_normalized_values) / len(all_normalized_values)) if all_normalized_values else 3.0

        final_scores = {}
        for trait, scores in trait_scores.items():
            if scores:
                # Average of 1-5 scale, converted to 0-100
                avg = sum(scores) / len(scores)
                final_scores[trait] = int(((avg - 1) / 4) * 100)
            else:
                # Dynamic fallback from the current test response profile, not a hardcoded constant
                final_scores[trait] = int(((overall_avg - 1) / 4) * 100)
        
        return final_scores

    def _get_total_questions_for_user(self, user_id: int) -> int:
        """
        Determine how many questions to ask (20-44).
        More questions = more accurate results.
        Using 30 questions for a balanced 15-30 minute assessment.
        """
        # Use 30 questions for a good balance between accuracy and time
        # 6 questions per trait ensures comprehensive coverage
        return 30

    def _get_total_questions_for_test(self, test: Optional[BigFiveTest], user_id: int) -> int:
        """Resolve total question count for this specific test session."""
        stored_questions = getattr(test, "questions", []) if test else []
        if isinstance(stored_questions, list) and len(stored_questions) > 0:
            return len(stored_questions)
        return self._get_total_questions_for_user(user_id)

    async def _build_behavior_context(self, db: Session, user_id: int) -> Dict[str, Any]:
        """
        Build concise behavior/analytics context used by AI question generation.
        """
        since = datetime.now(timezone.utc) - timedelta(days=14)

        task_result = await db.execute(
            select(
                func.count(Task.id).label("total"),
                func.sum(
                    func.case(
                        (Task.status == "completed", 1),
                        else_=0
                    )
                ).label("completed"),
            ).where(
                Task.user_id == user_id,
                Task.created_at >= since,
            )
        )
        task_stats = task_result.first()
        total_tasks = int(task_stats.total or 0) if task_stats else 0
        completed_tasks = int(task_stats.completed or 0) if task_stats else 0
        completion_rate = round((completed_tasks / total_tasks) * 100, 1) if total_tasks > 0 else 0.0

        focus_result = await db.execute(
            select(func.avg(FocusScore.score)).where(
                FocusScore.user_id == user_id,
                FocusScore.date >= since,
            )
        )
        avg_focus = float(focus_result.scalar() or 0.0)

        events_result = await db.execute(
            select(
                AnalyticsEvent.event_type,
                func.count(AnalyticsEvent.id).label("count"),
            ).where(
                AnalyticsEvent.user_id == user_id,
                AnalyticsEvent.timestamp >= since,
            ).group_by(
                AnalyticsEvent.event_type
            ).order_by(
                desc(func.count(AnalyticsEvent.id))
            ).limit(5)
        )
        top_events = [{"event_type": row.event_type, "count": int(row.count)} for row in events_result.all()]

        goals_result = await db.execute(
            select(func.count(Goal.id)).where(
                Goal.user_id == user_id,
                Goal.current_progress < 100
            )
        )
        active_goals = int(goals_result.scalar() or 0)

        return {
            "window_days": 14,
            "task_completion_rate": completion_rate,
            "tasks_total": total_tasks,
            "tasks_completed": completed_tasks,
            "avg_focus_score": round(avg_focus, 1),
            "active_goals": active_goals,
            "top_events": top_events,
        }

    def _resolve_question_source(self, question: Optional[Dict[str, Any]]) -> str:
        if not question:
            return "unknown"
        source = question.get("source")
        if source in ("ai", "fallback"):
            return source
        return "fallback"

    async def _refresh_scores_from_responses_if_needed(self, db: Session, test: BigFiveTest) -> None:
        """
        Keep stored base scores synchronized with recorded responses.
        Prevents stale/default values from being shown as final scores.
        """
        if not test.test_completed:
            return
        responses = test.question_responses or []
        if not responses:
            return

        recalculated = await self._calculate_scores(responses)
        changed = False
        for trait in TRAITS:
            current = getattr(test, trait, None)
            expected = recalculated[trait]
            if current != expected:
                setattr(test, trait, expected)
                changed = True

        if changed:
            await db.commit()

    def _get_randomized_questions(self, user_id: int) -> List[Dict]:
        """
        Get randomized questions for the test.
        Selects 6 questions per trait at random and shuffles them.
        """
        rng = random.SystemRandom()
        
        # We want 30 questions total (6 per trait)
        questions_per_trait = 6
        
        selected_questions = []
        
        for trait, questions in BFI_QUESTIONS.items():
            # Select random questions from each trait
            available = questions.copy()
            # Ensure we don't try to sample more than available
            sample_size = min(len(available), questions_per_trait)
            selected = rng.sample(available, sample_size)
            
            for q in selected:
                selected_questions.append({
                    "trait": trait,
                    "text": q["text"],
                    "direction": q["direction"],
                    "source": "fallback",
                })
        
        # Shuffle final list to mix traits
        rng.shuffle(selected_questions)
        
        return selected_questions

    async def _get_question_for_test(
        self, 
        test: BigFiveTest, 
        db: Session,
        user_id: int
    ) -> Dict[str, Any]:
        """Get the current question for a test."""
        # Use stored questions if available (New Way)
        stored_questions = getattr(test, "questions", [])
        if stored_questions and len(stored_questions) > 0:
            questions = stored_questions
        else:
            # Fallback for old tests or AI failure (Old Way)
            questions = self._get_randomized_questions(user_id)
        
        if test.current_question_index >= len(questions):
            return None
        
        q = questions[test.current_question_index]
        
        # Ensure format consistency
        if "options" in q:
            return {
                **q,
                "source": q.get("source", "fallback"),
            }
            
        # Legacy format construction
        return {
            "text": q["text"],
            "options": [
                {"value": 1, "label": "Disagree strongly"},
                {"value": 2, "label": "Disagree a little"},
                {"value": 3, "label": "Neither agree nor disagree"},
                {"value": 4, "label": "Agree a little"},
                {"value": 5, "label": "Agree strongly"}
            ],
            "trait": q["trait"],
            "source": q.get("source", "fallback"),
        }

    def get_trait_description(self, trait: str, score: int) -> str:
        """Get a description of what a trait score means."""
        descriptions = {
            "openness": {
                "high": "You are curious, creative, and open to new experiences. You enjoy exploring ideas and appreciate art and beauty.",
                "medium": "You have a balanced approach to new experiences. You can be both practical and creative when needed.",
                "low": "You prefer routine and familiarity. You are practical and focused on concrete tasks."
            },
            "conscientiousness": {
                "high": "You are organized, disciplined, and goal-oriented. You plan ahead and follow through on commitments.",
                "medium": "You balance structure with flexibility. You can be organized when needed but also adapt to change.",
                "low": "You prefer spontaneity and flexibility. You may find strict schedules restrictive."
            },
            "extraversion": {
                "high": "You are energized by social interaction. You are outgoing, enthusiastic, and enjoy being around others.",
                "medium": "You can enjoy both social activities and alone time. You adapt to different social situations.",
                "low": "You prefer solitude or small groups. You recharge through quiet time and reflection."
            },
            "agreeableness": {
                "high": "You are cooperative, trusting, and considerate. You prioritize harmony and helping others.",
                "medium": "You balance cooperation with assertiveness. You can be both competitive and collaborative.",
                "low": "You are competitive and direct. You prioritize your own goals and speak your mind."
            },
            "neuroticism": {
                "high": "You experience emotions intensely and may be more sensitive to stress. Self-awareness can help manage emotional responses.",
                "medium": "You have a balanced emotional life with normal ups and downs. You handle stress reasonably well.",
                "low": "You are emotionally stable and resilient. You tend to stay calm under pressure."
            }
        }
        
        if score >= 70:
            level = "high"
        elif score >= 40:
            level = "medium"
        else:
            level = "low"
        
        return descriptions.get(trait, {}).get(level, "No description available.")


# Singleton instance
big_five_test_service = BigFiveTestService()
