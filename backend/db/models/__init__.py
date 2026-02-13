from sqlalchemy import (
    Column,
    Integer,
    String,
    Float,
    Boolean,
    DateTime,
    Text,
    JSON,
    ForeignKey,
)
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from backend.db.database import Base


# ==================================================
# USER
# ==================================================
class User(Base):
    """User model for authentication and preferences."""

    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    username = Column(String, unique=True, index=True)
    full_name = Column(String)
    hashed_password = Column(String, nullable=False)
    role = Column(String, default="user") # user, premium, admin
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    is_superuser = Column(Boolean, default=False)
    tier = Column(String, default="free")  # free, pro, elite
    plan_type = Column(String, default="BASIC") # BASIC, PRO, ENTERPRISE
    
    # Razorpay payment fields
    razorpay_customer_id = Column(String, index=True, nullable=True)
    razorpay_subscription_id = Column(String, index=True, nullable=True)
    subscription_status = Column(String, default="free")  # free, trialing, active, cancelled, payment_failed
    trial_ends_at = Column(DateTime(timezone=True), nullable=True)
    subscription_starts_at = Column(DateTime(timezone=True), nullable=True)
    subscription_ends_at = Column(DateTime(timezone=True), nullable=True)
    
    preferences = Column(JSON, default=dict)
    
    # AI Token Tracking
    daily_gemini_tokens = Column(Integer, default=0)
    daily_groq_tokens = Column(Integer, default=0)
    last_token_reset = Column(DateTime(timezone=True), server_default=func.now())
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    tasks = relationship("Task", back_populates="owner", cascade="all, delete-orphan")
    plans = relationship("Plan", back_populates="owner", cascade="all, delete-orphan")
    chat_sessions = relationship(
        "ChatSession", back_populates="user", cascade="all, delete-orphan"
    )


# ==================================================
# TASK
# ==================================================
class Task(Base):
    """User tasks with AI scheduling and tracking."""

    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    title = Column(String, nullable=False)
    description = Column(Text)
    status = Column(String, nullable=False, default="pending")
    priority = Column(String, nullable=False, default="medium")
    category = Column(String)
    estimated_minutes = Column(Integer, default=60)
    actual_minutes = Column(Integer)
    due_date = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))
    tags = Column(JSON, default=list)
    meta = Column(JSON, default=dict)
    goal_id = Column(Integer, ForeignKey("goals.id", ondelete="SET NULL"), nullable=True, index=True)
    goal = relationship("Goal", back_populates="tasks")

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    owner = relationship("User", back_populates="tasks")
    plan_tasks = relationship(
        "PlanTask", back_populates="task", cascade="all, delete-orphan"
    )


# ==================================================
# PLAN
# ==================================================
class Plan(Base):
    """Daily / Weekly plan created by AI."""

    __tablename__ = "plans"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(Text)
    plan_type = Column(String)  # daily, weekly, custom
    date = Column(DateTime(timezone=True), nullable=False)
    duration_hours = Column(Float, default=8.0)
    focus_areas = Column(JSON, default=list)
    stress_level = Column(String)
    productivity_score = Column(Integer)
    schedule = Column(JSON)
    recommendations = Column(JSON, default=list)

    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    
    # Link Plans (Deep Work / Habits) to Goal
    goal_id = Column(Integer, ForeignKey("goals.id", ondelete="SET NULL"), nullable=True, index=True)
    goal = relationship("Goal", back_populates="plans")

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    owner = relationship("User", back_populates="plans")
    tasks = relationship(
        "PlanTask", back_populates="plan", cascade="all, delete-orphan"
    )


# ==================================================
# PLAN ↔ TASK (M2M)
# ==================================================
class PlanTask(Base):
    """Many-to-many relationship between plans and tasks."""

    __tablename__ = "plan_tasks"

    id = Column(Integer, primary_key=True, index=True)
    plan_id = Column(Integer, ForeignKey("plans.id", ondelete="CASCADE"))
    task_id = Column(Integer, ForeignKey("tasks.id", ondelete="CASCADE"))
    scheduled_time = Column(String)
    order_index = Column(Integer, default=0)

    plan = relationship("Plan", back_populates="tasks")
    task = relationship("Task", back_populates="plan_tasks")


# ==================================================
# CHAT SESSION
# ==================================================
class ChatSession(Base):
    """Chat session with Leno AI."""

    __tablename__ = "chat_sessions"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String, unique=True, index=True)
    title = Column(String)
    context = Column(String)
    mood = Column(String)
    meta = Column(JSON, default=dict)

    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    user = relationship("User", back_populates="chat_sessions")
    messages = relationship(
        "ChatMessage", back_populates="session", cascade="all, delete-orphan"
    )


# ==================================================
# CHAT MESSAGE
# ==================================================
class ChatMessage(Base):
    """Individual chat messages."""

    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("chat_sessions.id", ondelete="CASCADE"))
    role = Column(String, nullable=False)  # user, assistant, system
    content = Column(Text, nullable=False)
    tokens = Column(Integer)
    meta = Column(JSON, default=dict)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    session = relationship("ChatSession", back_populates="messages")


# ==================================================
# STRESS LOG
# ==================================================
class StressLog(Base):
    """Stress tracking entries."""

    __tablename__ = "stress_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    stress_level = Column(Integer, nullable=False)
    triggers = Column(JSON, default=list)
    coping_strategies = Column(JSON, default=list)
    notes = Column(Text)
    location = Column(String)
    duration_minutes = Column(Integer)
    resolved = Column(Boolean, default=False)


# ==================================================
# GOALS
# ==================================================
class Goal(Base):
    """Long-term goals set by user."""

    __tablename__ = "goals"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    title = Column(String, nullable=False)
    description = Column(Text)
    category = Column(String)
    target_date = Column(DateTime(timezone=True))
    current_progress = Column(Integer, default=0)
    milestones = Column(JSON, default=list)
    ai_suggestions = Column(JSON, default=list)

    # Goal Intelligence Fields
    is_tracked = Column(Boolean, default=False)  # Enforce max 3 via service logic
    probability_status = Column(String, default="Medium")  # Very Low, Low, Medium, High, Very High, Extremely High
    last_analyzed_at = Column(DateTime(timezone=True))

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    tasks = relationship("Task", back_populates="goal")
    plans = relationship("Plan", back_populates="goal")


# ==================================================
# FOCUS SCORE
# ==================================================
class FocusScore(Base):
    """Daily focus score records for heatmap visualization."""

    __tablename__ = "focus_scores"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    date = Column(DateTime(timezone=True), nullable=False)
    score = Column(Integer, default=0)
    breakdown = Column(JSON, default=dict)
    activities = Column(JSON, default=list)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


# ==================================================
# BIG FIVE TEST
# ==================================================
class BigFiveTest(Base):
    """Big Five Personality Test Results.
    
    Stores the results of the BFI-44 based personality assessment.
    Tests are available every 14 days. Scores are influenced by:
    1. Initial test (baseline)
    2. Behavioral adjustments from app usage (small increments)
    """

    __tablename__ = "big_five_tests"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Core Big Five Scores (0-100 scale)
    openness = Column(Integer, default=50)
    conscientiousness = Column(Integer, default=50)
    extraversion = Column(Integer, default=50)
    agreeableness = Column(Integer, default=50)
    neuroticism = Column(Integer, default=50)  # Note: Lower is better for emotional stability
    
    # Test metadata
    questions_asked = Column(Integer, default=0)  # Total questions answered (20-44)
    test_completed = Column(Boolean, default=False)
    test_in_progress = Column(Boolean, default=False)
    
    # Current question tracking for in-progress tests
    current_question_index = Column(Integer, default=0)
    question_responses = Column(JSON, default=list)  # Store individual question responses
    questions = Column(JSON, default=list)  # Store the specific generated questions for this test
    
    # Behavioral adjustments (accumulated small changes from app usage)
    openness_adjustment = Column(Float, default=0.0)
    conscientiousness_adjustment = Column(Float, default=0.0)
    extraversion_adjustment = Column(Float, default=0.0)
    agreeableness_adjustment = Column(Float, default=0.0)
    neuroticism_adjustment = Column(Float, default=0.0)
    
    # Timestamps
    test_started_at = Column(DateTime(timezone=True))
    test_completed_at = Column(DateTime(timezone=True))
    next_test_available_at = Column(DateTime(timezone=True))  # 14 days after completion
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


# ==================================================
# EXPORTS
# ==================================================
__all__ = [
    "User",
    "Task",
    "Plan",
    "PlanTask",
    "ChatSession",
    "ChatMessage",
    "StressLog",
    "Goal",
]
# Add these to your existing db/models/__init__.py

# ==================================================
# ANALYTICS EVENT
# ==================================================
class AnalyticsEvent(Base):
    """Analytics events from user activity."""

    __tablename__ = "analytics_events"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    event_type = Column(String, nullable=False)  # task_created, deep_work_started, etc.
    event_source = Column(String)  # planner, chat, system
    category = Column(String)  # task, focus, habit, chat, planning, wellbeing
    timestamp = Column(DateTime(timezone=True), nullable=False)
    meta = Column(JSON, default=dict)
    raw_data = Column(JSON, default=dict)
    processed_at = Column(DateTime(timezone=True))
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())

# ==================================================
# REAL-TIME METRICS
# ==================================================
class RealTimeMetrics(Base):
    """Real-time computed metrics for users."""

    __tablename__ = "realtime_metrics"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    
    # Focus metrics
    focus_score = Column(Integer, default=50)
    focus_sessions_today = Column(Integer, default=0)
    total_focus_minutes = Column(Integer, default=0)
    
    # Planning metrics
    planning_accuracy = Column(Float, default=0.0)
    tasks_completed_today = Column(Integer, default=0)
    
    # Consistency metrics
    current_habit_streak = Column(Integer, default=0)
    habits_completed_today = Column(Integer, default=0)
    
    # Wellbeing metrics
    burnout_risk = Column(Integer, default=0)
    engagement_score = Column(Integer, default=0)
    
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

# ==================================================
# USER INSIGHT
# ==================================================
class UserInsight(Base):
    """Insights generated for users."""

    __tablename__ = "user_insights"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"))
    title = Column(String, nullable=False)
    description = Column(Text)
    insight_type = Column(String)  # rule, pattern, ai
    category = Column(String)  # focus, planning, consistency, wellbeing
    severity = Column(String)  # info, low, medium, high, positive
    confidence = Column(Float, default=0.7)
    action_items = Column(JSON, default=list)
    context = Column(JSON, default=dict)
    generated_at = Column(DateTime(timezone=True), server_default=func.now())
    
    read_at = Column(DateTime(timezone=True))
    dismissed_at = Column(DateTime(timezone=True))

# ==================================================
# REFRESH TOKEN
# ==================================================
class RefreshToken(Base):
    """Secure refresh tokens for authentication."""

    __tablename__ = "refresh_tokens"

    id = Column(Integer, primary_key=True, index=True)
    token = Column(String, index=True, unique=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    is_revoked = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


# ==================================================
# BEHAVIORAL PATTERN
# ==================================================
class BehavioralPattern(Base):
    """Detected behavioral patterns."""

    __tablename__ = "behavioral_patterns"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"))
    pattern_type = Column(String, nullable=False)  # frequency, timing, sequence
    event_type = Column(String)  # task_created, deep_work_completed, etc.
    frequency = Column(Integer, default=1)
    significance = Column(String)  # low, medium, high
    meta = Column(JSON, default=dict)
    first_detected = Column(DateTime(timezone=True), server_default=func.now())
    last_detected = Column(DateTime(timezone=True), server_default=func.now())

# ==================================================
# AI ANALYSIS
# ==================================================
class AIAnalysis(Base):
    """AI analysis results."""

    __tablename__ = "ai_analyses"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"))
    event_type = Column(String)
    analysis_type = Column(String)  # pattern, insight, prediction
    content = Column(JSON, default=dict)
    confidence = Column(Float, default=0.5)
    generated_at = Column(DateTime(timezone=True), server_default=func.now())

# ==================================================
# USER ANALYTICS (Existing - keep for backward compatibility)
# ==================================================
class UserAnalytics(Base):
    """Existing analytics model for backward compatibility."""

    __tablename__ = "user_analytics"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"))
    date = Column(DateTime(timezone=True), server_default=func.now())
    tasks_completed = Column(Integer, default=0)
    total_focus_minutes = Column(Integer, default=0)
    hourly_productivity = Column(JSON, default=dict)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())


# ==================================================
# DAILY ANALYTICS (NEW - Week 1)
# ==================================================
class DailyAnalytics(Base):
    """Daily analytics snapshot for real-time metrics."""

    __tablename__ = "daily_analytics"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    date = Column(DateTime(timezone=True), nullable=False, index=True)
    
    # Core metrics (0-100)
    productivity_score = Column(Integer, default=0)
    focus_score = Column(Integer, default=0)
    burnout_risk = Column(Integer, default=0)
    
    # Activity counts
    tasks_completed = Column(Integer, default=0)
    tasks_created = Column(Integer, default=0)
    goals_progressed = Column(Integer, default=0)
    habits_completed = Column(Integer, default=0)
    
    # Focus metrics
    total_focus_minutes = Column(Integer, default=0)
    deep_work_minutes = Column(Integer, default=0)
    interruptions = Column(Integer, default=0)
    avg_session_quality = Column(Integer, default=0)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Unique constraint: one record per user per day
    __table_args__ = (
        {"sqlite_autoincrement": True},
    )


# ==================================================
# AI INTELLIGENCE SCORE (NEW - Week 1)
# ==================================================
class AIIntelligenceScore(Base):
    """AI Intelligence Score calculated periodically."""

    __tablename__ = "ai_intelligence_scores"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    calculated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    time_range = Column(String, nullable=False)  # 'daily', 'weekly', 'monthly'
    
    # Overall score
    overall_score = Column(Integer, default=0)
    category = Column(String)  # 'Strategic Thinker', etc.
    
    # 4 dimensions (0-100)
    planning_quality = Column(Integer, default=0)
    execution_intelligence = Column(Integer, default=0)
    adaptation_reflection = Column(Integer, default=0)
    behavioral_stability = Column(Integer, default=0)
    
    # Metadata (detailed breakdowns)
    meta = Column(JSON, default=dict)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())


# ==================================================
# NOTIFICATION
# ==================================================
class Notification(Base):
    """User notifications with multi-channel support."""

    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    notification_type = Column(String, nullable=False)  # task_due, achievement, alert, etc.
    channel = Column(String, default="in_app")  # in_app, email, push, sms
    priority = Column(String, default="normal")  # low, normal, high, urgent
    
    is_read = Column(Boolean, default=False)
    read_at = Column(DateTime(timezone=True))
    
    # Delivery tracking
    sent_at = Column(DateTime(timezone=True), server_default=func.now())
    delivery_status = Column(String, default="pending")  # pending, sent, delivered, failed
    delivery_error = Column(Text)
    
    # Data payload
    data = Column(JSON, default=dict)
    action_url = Column(String)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


# ==================================================
# TASK SHARE
# ==================================================
class TaskShare(Base):
    """Shared tasks for collaboration."""

    __tablename__ = "task_shares"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False)
    owner_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    shared_with_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    # Permissions
    can_view = Column(Boolean, default=True)
    can_edit = Column(Boolean, default=False)
    can_comment = Column(Boolean, default=True)
    can_reshare = Column(Boolean, default=False)
    
    # Access control
    access_level = Column(String, default="viewer")  # viewer, editor, manager
    expires_at = Column(DateTime(timezone=True))
    
    shared_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


# ==================================================
# TASK COMMENT
# ==================================================
class TaskComment(Base):
    """Comments on shared tasks."""

    __tablename__ = "task_comments"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False)
    author_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    parent_comment_id = Column(Integer, ForeignKey("task_comments.id", ondelete="CASCADE"))
    
    content = Column(Text, nullable=False)
    mentions = Column(JSON, default=list)  # @mentions
    
    is_edited = Column(Boolean, default=False)
    edited_at = Column(DateTime(timezone=True))
    
    is_deleted = Column(Boolean, default=False)
    deleted_at = Column(DateTime(timezone=True))
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


# ==================================================
# COLLABORATION SESSION
# ==================================================
class CollaborationSession(Base):
    """Real-time collaboration sessions."""

    __tablename__ = "collaboration_sessions"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False)
    session_id = Column(String, unique=True, index=True, nullable=False)
    
    # Participants
    participants = Column(JSON, default=list)  # List of user IDs
    initiator_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    # Session state
    is_active = Column(Boolean, default=True)
    mode = Column(String, default="editing")  # editing, commenting, brainstorming
    
    # Tracking
    started_at = Column(DateTime(timezone=True), server_default=func.now())
    ended_at = Column(DateTime(timezone=True))
    
    # Session data
    changes_log = Column(JSON, default=list)  # Track all changes
    meta_data = Column(JSON, default=dict)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


# ==================================================
# AGENT CONVERSATION
# ==================================================
class AgentConversation(Base):
    """AI agent conversations for multi-mode interactions."""

    __tablename__ = "agent_conversations"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    conversation_id = Column(String, unique=True, index=True, nullable=False)
    
    # Mode tracking
    mode = Column(String, default="chat")  # chat, plan, analyze, task
    
    # Context and history
    title = Column(String)
    summary = Column(Text)
    messages = Column(JSON, default=list)  # Message history
    
    # Agent state
    current_state = Column(String, default="idle")  # idle, thinking, executing, complete
    last_action = Column(JSON, default=dict)
    
    # Metadata
    meta_data = Column(JSON, default=dict)
    tags = Column(JSON, default=list)
    
    started_at = Column(DateTime(timezone=True), server_default=func.now())
    ended_at = Column(DateTime(timezone=True))
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


# Update your __all__ list to include new models:
__all__ = [
    "User",
    "Task", 
    "Plan",
    "PlanTask",
    "ChatSession",
    "ChatMessage",
    "StressLog",
    "Goal",
    "FocusScore",
    "BigFiveTest",
    # Add analytics models
    "AnalyticsEvent",
    "RealTimeMetrics", 
    "UserInsight",
    "BehavioralPattern",
    "AIAnalysis",
    "UserAnalytics",
    "DailyAnalytics",  # NEW
    "AIIntelligenceScore",  # NEW
    "RefreshToken",
    # Phase 3 models
    "Notification",
    "TaskShare",
    "TaskComment",
    "CollaborationSession",
    "AgentConversation",
]