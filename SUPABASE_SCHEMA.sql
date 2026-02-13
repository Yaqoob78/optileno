-- Supabase Migration Script for Optileno

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR UNIQUE NOT NULL,
    username VARCHAR UNIQUE,
    full_name VARCHAR,
    hashed_password VARCHAR NOT NULL,
    role VARCHAR DEFAULT 'user', -- user, premium, admin
    is_active BOOLEAN DEFAULT true,
    is_verified BOOLEAN DEFAULT false,
    is_superuser BOOLEAN DEFAULT false,
    tier VARCHAR DEFAULT 'free',  -- free, pro, elite
    plan_type VARCHAR DEFAULT 'BASIC', -- BASIC, PRO, ENTERPRISE
    stripe_customer_id VARCHAR,
    stripe_subscription_id VARCHAR,
    preferences JSONB DEFAULT '{}',
    daily_gemini_tokens INTEGER DEFAULT 0,
    daily_groq_tokens INTEGER DEFAULT 0,
    last_token_reset TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

-- Create tasks table
CREATE TABLE IF NOT EXISTS tasks (
    id SERIAL PRIMARY KEY,
    title VARCHAR NOT NULL,
    description TEXT,
    status VARCHAR DEFAULT 'pending', -- pending, in_progress, completed
    priority VARCHAR DEFAULT 'medium', -- low, medium, high, urgent
    category VARCHAR,
    estimated_minutes INTEGER,
    actual_minutes INTEGER,
    due_date TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    tags JSONB DEFAULT '[]',
    meta JSONB DEFAULT '{}',
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

-- Create plans table
CREATE TABLE IF NOT EXISTS plans (
    id SERIAL PRIMARY KEY,
    name VARCHAR NOT NULL,
    description TEXT,
    plan_type VARCHAR, -- daily, weekly, custom
    date TIMESTAMPTZ NOT NULL,
    duration_hours FLOAT DEFAULT 8.0,
    focus_areas JSONB DEFAULT '[]',
    stress_level VARCHAR,
    productivity_score INTEGER,
    schedule JSONB,
    recommendations JSONB DEFAULT '[]',
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create plan_tasks table (many-to-many between plans and tasks)
CREATE TABLE IF NOT EXISTS plan_tasks (
    id SERIAL PRIMARY KEY,
    plan_id INTEGER REFERENCES plans(id) ON DELETE CASCADE,
    task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
    scheduled_time VARCHAR,
    order_index INTEGER DEFAULT 0
);

-- Create chat_sessions table
CREATE TABLE IF NOT EXISTS chat_sessions (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR UNIQUE,
    title VARCHAR,
    context VARCHAR,
    mood VARCHAR,
    meta JSONB DEFAULT '{}',
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

-- Create chat_messages table
CREATE TABLE IF NOT EXISTS chat_messages (
    id SERIAL PRIMARY KEY,
    session_id INTEGER REFERENCES chat_sessions(id) ON DELETE CASCADE,
    role VARCHAR NOT NULL, -- user, assistant, system
    content TEXT NOT NULL,
    tokens INTEGER,
    meta JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create stress_logs table
CREATE TABLE IF NOT EXISTS stress_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    stress_level INTEGER NOT NULL,
    triggers JSONB DEFAULT '[]',
    coping_strategies JSONB DEFAULT '[]',
    notes TEXT,
    location VARCHAR,
    duration_minutes INTEGER,
    resolved BOOLEAN DEFAULT false
);

-- Create goals table
CREATE TABLE IF NOT EXISTS goals (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR NOT NULL,
    description TEXT,
    category VARCHAR,
    target_date TIMESTAMPTZ,
    current_progress INTEGER DEFAULT 0,
    milestones JSONB DEFAULT '[]',
    ai_suggestions JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

-- Create focus_scores table
CREATE TABLE IF NOT EXISTS focus_scores (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    date TIMESTAMPTZ NOT NULL,
    score INTEGER DEFAULT 0,
    breakdown JSONB DEFAULT '{}',
    activities JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

-- Create big_five_tests table
CREATE TABLE IF NOT EXISTS big_five_tests (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    -- Core Big Five Scores (0-100 scale)
    openness INTEGER DEFAULT 50,
    conscientiousness INTEGER DEFAULT 50,
    extraversion INTEGER DEFAULT 50,
    agreeableness INTEGER DEFAULT 50,
    neuroticism INTEGER DEFAULT 50, -- Note: Lower is better for emotional stability
    -- Test metadata
    questions_asked INTEGER DEFAULT 0, -- Total questions answered (20-44)
    test_completed BOOLEAN DEFAULT false,
    test_in_progress BOOLEAN DEFAULT false,
    -- Current question tracking for in-progress tests
    current_question_index INTEGER DEFAULT 0,
    question_responses JSONB DEFAULT '[]', -- Store individual question responses
    questions JSONB DEFAULT '[]', -- Store the specific generated questions for this test
    -- Behavioral adjustments (accumulated small changes from app usage)
    openness_adjustment FLOAT DEFAULT 0.0,
    conscientiousness_adjustment FLOAT DEFAULT 0.0,
    extraversion_adjustment FLOAT DEFAULT 0.0,
    agreeableness_adjustment FLOAT DEFAULT 0.0,
    neuroticism_adjustment FLOAT DEFAULT 0.0,
    -- Timestamps
    test_started_at TIMESTAMPTZ,
    test_completed_at TIMESTAMPTZ,
    next_test_available_at TIMESTAMPTZ, -- 14 days after completion
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

-- Create analytics_events table
CREATE TABLE IF NOT EXISTS analytics_events (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    event_type VARCHAR NOT NULL, -- task_created, deep_work_started, etc.
    event_source VARCHAR, -- planner, chat, system
    category VARCHAR, -- task, focus, habit, chat, planning, wellbeing
    timestamp TIMESTAMPTZ NOT NULL,
    meta JSONB DEFAULT '{}',
    raw_data JSONB DEFAULT '{}',
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create realtime_metrics table
CREATE TABLE IF NOT EXISTS realtime_metrics (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    -- Focus metrics
    focus_score INTEGER DEFAULT 50,
    focus_sessions_today INTEGER DEFAULT 0,
    total_focus_minutes INTEGER DEFAULT 0,
    -- Planning metrics
    planning_accuracy FLOAT DEFAULT 0.0,
    tasks_completed_today INTEGER DEFAULT 0,
    -- Consistency metrics
    current_habit_streak INTEGER DEFAULT 0,
    habits_completed_today INTEGER DEFAULT 0,
    -- Wellbeing metrics
    burnout_risk INTEGER DEFAULT 0,
    engagement_score INTEGER DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create user_insights table
CREATE TABLE IF NOT EXISTS user_insights (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR NOT NULL,
    description TEXT,
    insight_type VARCHAR, -- rule, pattern, ai
    category VARCHAR, -- focus, planning, consistency, wellbeing
    severity VARCHAR, -- info, low, medium, high, positive
    confidence FLOAT DEFAULT 0.7,
    action_items JSONB DEFAULT '[]',
    context JSONB DEFAULT '{}',
    generated_at TIMESTAMPTZ DEFAULT NOW(),
    read_at TIMESTAMPTZ,
    dismissed_at TIMESTAMPTZ
);

-- Create refresh_tokens table
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id SERIAL PRIMARY KEY,
    token VARCHAR UNIQUE NOT NULL,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    is_revoked BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create behavioral_patterns table
CREATE TABLE IF NOT EXISTS behavioral_patterns (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    pattern_type VARCHAR NOT NULL, -- frequency, timing, sequence
    event_type VARCHAR, -- task_created, deep_work_completed, etc.
    frequency INTEGER DEFAULT 1,
    significance VARCHAR, -- low, medium, high
    meta JSONB DEFAULT '{}',
    first_detected TIMESTAMPTZ DEFAULT NOW(),
    last_detected TIMESTAMPTZ DEFAULT NOW()
);

-- Create ai_analyses table
CREATE TABLE IF NOT EXISTS ai_analyses (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    event_type VARCHAR,
    analysis_type VARCHAR, -- pattern, insight, prediction
    content JSONB DEFAULT '{}',
    confidence FLOAT DEFAULT 0.5,
    generated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create user_analytics table
CREATE TABLE IF NOT EXISTS user_analytics (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    date TIMESTAMPTZ DEFAULT NOW(),
    tasks_completed INTEGER DEFAULT 0,
    total_focus_minutes INTEGER DEFAULT 0,
    hourly_productivity JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create daily_analytics table
CREATE TABLE IF NOT EXISTS daily_analytics (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    date TIMESTAMPTZ NOT NULL,
    -- Core metrics (0-100)
    productivity_score INTEGER DEFAULT 0,
    focus_score INTEGER DEFAULT 0,
    burnout_risk INTEGER DEFAULT 0,
    -- Activity counts
    tasks_completed INTEGER DEFAULT 0,
    tasks_created INTEGER DEFAULT 0,
    goals_progressed INTEGER DEFAULT 0,
    habits_completed INTEGER DEFAULT 0,
    -- Focus metrics
    total_focus_minutes INTEGER DEFAULT 0,
    deep_work_minutes INTEGER DEFAULT 0,
    interruptions INTEGER DEFAULT 0,
    avg_session_quality INTEGER DEFAULT 0,
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create ai_intelligence_scores table
CREATE TABLE IF NOT EXISTS ai_intelligence_scores (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    time_range VARCHAR NOT NULL, -- 'daily', 'weekly', 'monthly'
    -- Overall score
    overall_score INTEGER DEFAULT 0,
    category VARCHAR, -- 'Strategic Thinker', etc.
    -- 4 dimensions (0-100)
    planning_quality INTEGER DEFAULT 0,
    execution_intelligence INTEGER DEFAULT 0,
    adaptation_reflection INTEGER DEFAULT 0,
    behavioral_stability INTEGER DEFAULT 0,
    -- Metadata (detailed breakdowns)
    meta JSONB DEFAULT '{}',
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    title VARCHAR NOT NULL,
    message TEXT NOT NULL,
    notification_type VARCHAR NOT NULL, -- task_due, achievement, alert, etc.
    channel VARCHAR DEFAULT 'in_app', -- in_app, email, push, sms
    priority VARCHAR DEFAULT 'normal', -- low, normal, high, urgent
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMPTZ,
    -- Delivery tracking
    sent_at TIMESTAMPTZ DEFAULT NOW(),
    delivery_status VARCHAR DEFAULT 'pending', -- pending, sent, delivered, failed
    delivery_error TEXT,
    -- Data payload
    data JSONB DEFAULT '{}',
    action_url VARCHAR,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

-- Create task_shares table
CREATE TABLE IF NOT EXISTS task_shares (
    id SERIAL PRIMARY KEY,
    task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE NOT NULL,
    owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    shared_with_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    -- Permissions
    can_view BOOLEAN DEFAULT true,
    can_edit BOOLEAN DEFAULT false,
    can_comment BOOLEAN DEFAULT true,
    can_reshare BOOLEAN DEFAULT false,
    -- Access control
    access_level VARCHAR DEFAULT 'viewer', -- viewer, editor, manager
    expires_at TIMESTAMPTZ,
    shared_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

-- Create task_comments table
CREATE TABLE IF NOT EXISTS task_comments (
    id SERIAL PRIMARY KEY,
    task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE NOT NULL,
    author_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    parent_comment_id INTEGER REFERENCES task_comments(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    mentions JSONB DEFAULT '[]', -- @mentions
    is_edited BOOLEAN DEFAULT false,
    edited_at TIMESTAMPTZ,
    is_deleted BOOLEAN DEFAULT false,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

-- Create collaboration_sessions table
CREATE TABLE IF NOT EXISTS collaboration_sessions (
    id SERIAL PRIMARY KEY,
    task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE NOT NULL,
    session_id VARCHAR UNIQUE NOT NULL,
    -- Participants
    participants JSONB DEFAULT '[]', -- List of user IDs
    initiator_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    -- Session state
    is_active BOOLEAN DEFAULT true,
    mode VARCHAR DEFAULT 'editing', -- editing, commenting, brainstorming
    -- Tracking
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    -- Session data
    changes_log JSONB DEFAULT '[]', -- Track all changes
    meta_data JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

-- Create agent_conversations table
CREATE TABLE IF NOT EXISTS agent_conversations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    conversation_id VARCHAR UNIQUE NOT NULL,
    -- Mode tracking
    mode VARCHAR DEFAULT 'chat', -- chat, plan, analyze, task
    -- Context and history
    title VARCHAR,
    summary TEXT,
    messages JSONB DEFAULT '[]', -- Message history
    -- Agent state
    current_state VARCHAR DEFAULT 'idle', -- idle, thinking, executing, complete
    last_action JSONB DEFAULT '{}',
    -- Metadata
    meta_data JSONB DEFAULT '{}',
    tags JSONB DEFAULT '[]',
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_plans_user_id ON plans(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_stress_logs_user_id ON stress_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_goals_user_id ON goals(user_id);
CREATE INDEX IF NOT EXISTS idx_focus_scores_user_id ON focus_scores(user_id);
CREATE INDEX IF NOT EXISTS idx_big_five_tests_user_id ON big_five_tests(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_id ON analytics_events(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_analytics_user_id_date ON daily_analytics(user_id, date);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_task_shares_owner_id ON task_shares(owner_id);
CREATE INDEX IF NOT EXISTS idx_task_shares_shared_with_id ON task_shares(shared_with_id);