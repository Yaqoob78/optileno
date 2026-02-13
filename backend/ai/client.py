import logging
import asyncio
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone

# Providers
from openai import AsyncOpenAI
from groq import AsyncGroq
# import google.generativeai as genai # Uncomment when using real Gemini lib

from backend.app.config import settings
from backend.services.user_service import user_service
from backend.ai.response_formatter import response_formatter
from backend.analytics.insights.insight_engine import generate_insights

# NEW: Full AI agent access
from backend.ai.context_builder import ai_context_builder
from backend.ai.agent_actions import ai_agent_actions, ActionType

logger = logging.getLogger(__name__)


class DualAIClient:
    """
    Intelligent AI Client that manages:
    1. Dual Provider Switching (NVIDIA -> Groq)
    2. Token Limit Enforcement based on Plan (Basic/Pro)
    3. Daily Quota Reset Logic
    """

    def __init__(self, user_id: str):
        self.user_id = user_id
        
        # Initialize Clients
        # Secondary: Groq
        self.groq_client = AsyncGroq(api_key=settings.GROQ_API_KEY)
        
        # Primary: NVIDIA (via OpenAI compatible endpoint)
        self.nvidia_client = AsyncOpenAI(
            api_key=settings.NVIDIA_API_KEY,
            base_url="https://integrate.api.nvidia.com/v1"
        )
        
        self.primary_provider = "nvidia" 
        self.secondary_provider = "groq"

    async def _execute_tool(self, tool, payload):
        """
        Execute a tool with flexible payload handling.
        Supports both (user_id, payload_dict) and (user_id, **payload) signatures.
        """
        if isinstance(payload, dict):
            try:
                return await tool(self.user_id, **payload)
            except TypeError:
                return await tool(self.user_id, payload)
        return await tool(self.user_id, payload)

    async def _get_user_quota_status(self, user: Any) -> Dict[str, Any]:
        """Check which providers are available based on user plan and daily usage."""
        
        # 🛡️ ADMIN BYPASS: No limits for owner
        if getattr(user, "email", None) == "khan011504@gmail.com":
            return {
                "primary_available": True,
                "secondary_available": True,
                "usage_primary": 0,
                "usage_secondary": 0,
                "limit_primary": 999999,
                "limit_secondary": 999999
            }

        # Determine Limits
        if user.plan_type == "PRO":
            limit_primary = settings.LIMIT_PRO_NVIDIA
            limit_secondary = settings.LIMIT_PRO_GROQ
        else:
            limit_primary = settings.LIMIT_BASIC_NVIDIA
            limit_secondary = settings.LIMIT_BASIC_GROQ

        # Check Reset (Simple daily check)
        now = datetime.now(timezone.utc)
        if user.last_token_reset and user.last_token_reset.date() < now.date():
            # Reset logic should happen in DB update, but we'll flag it here
            await user_service.reset_daily_tokens(user.id)
            usage_primary = 0
            usage_secondary = 0
        else:
            # usage_gemini field in DB we will reuse as primary (nvidia) usage for now to avoid DB migration in this step
            # ideally we rename columns later. "daily_gemini_tokens" -> "daily_primary_tokens"
            usage_primary = user.daily_gemini_tokens or 0 
            usage_secondary = user.daily_groq_tokens or 0

        return {
            "primary_available": usage_primary < limit_primary,
            "secondary_available": usage_secondary < limit_secondary,
            "usage_primary": usage_primary,
            "usage_secondary": usage_secondary,
            "limit_primary": limit_primary,
            "limit_secondary": limit_secondary
        }

    async def chat_completion(self, messages: List[Dict[str, str]], mode: str = "CHAT") -> Dict[str, Any]:
        """
        Orchestrates the failover logic with Multi-Model routing.
        Returns dict: { "text": str, "provider": str, "model": str }
        """
        user = await user_service.get_user_by_id(int(self.user_id))
        if not user:
            return {"text": "Error: User not found.", "provider": "system", "model": "none"}

        quota = await self._get_user_quota_status(user)

        # Determine which model to use based on mode
        # "Brain" models for reasoning/chat, "Agent" models for tools/json
        if mode in ["PLAN", "ANALYZE", "TASK"]:
            primary_model = settings.NVIDIA_AGENT_MODEL
        else:
            primary_model = settings.NVIDIA_BRAIN_MODEL

        # 1. Try Primary (NVIDIA)
        if quota["primary_available"]:
            try:
                response_text = await self._call_nvidia(messages, model=primary_model)
                
                # Update Usage
                await user_service.increment_token_usage(user.id, "gemini", 100) 
                return {"text": response_text, "provider": "NVIDIA", "model": primary_model}
            except Exception as e:
                logger.error(f"NVIDIA (Primary) failed with model {primary_model}: {e}. Failing over to Groq.")
        
        # 2. Try Secondary (Groq)
        if quota["secondary_available"]:
            try:
                # Use Llama 3 70B on Groq for better reasoning if available
                model_to_use = "llama-3.3-70b-versatile"
                response_text = await self._call_groq(messages, model=model_to_use)
                await user_service.increment_token_usage(user.id, "groq", 100)
                return {"text": response_text, "provider": "Groq", "model": model_to_use}
            except Exception as e:
                logger.error(f"Groq (Secondary) failed: {e}")
                return {"text": "I apologize, but I'm having trouble connecting to AI services right now.", "provider": "system", "model": "none"}

        # 3. Mock Provider (Development Only)
        if settings.ENVIRONMENT == "development" and not settings.NVIDIA_API_KEY and not settings.GROQ_API_KEY:
             try:
                logger.info("⚠️ DEV MODE: Using Mock AI Provider (No headers/keys)")
                response_text = await self._call_mock(messages)
                return {"text": response_text, "provider": "MOCK", "model": "mock-gpt-4"}
             except Exception as e:
                logger.error(f"Mock provider failed: {e}")

        # 4. Blocked
        msg = (
            "🚫 **Daily Limit Reached**\n\n"
            "You have used your daily AI allowance for both Primary (NVIDIA) and Backup (Groq) models.\n"
            "Upgrade to Pro for higher limits.\n\n"
            "Your quota resets at midnight UTC."
        )
        return {"text": msg, "provider": "system", "model": "limit_reached"}

    async def _call_nvidia(self, messages: List[Dict[str, str]], model: str = None) -> str:
        if not settings.NVIDIA_API_KEY:
            # If no key, force failover by raising error
            raise ValueError("NVIDIA API Key missing")
            
        completion = await self.nvidia_client.chat.completions.create(
            model=model or settings.NVIDIA_BRAIN_MODEL, # Use passed, setting, or default
            messages=messages,
            temperature=0.7,
            max_tokens=2048
        )
        return completion.choices[0].message.content

    async def _call_groq(self, messages: List[Dict[str, str]], model: str = "llama-3.3-70b-versatile") -> str:
        if not settings.GROQ_API_KEY:
            raise ValueError("Groq API Key missing")
            
        completion = await self.groq_client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=0.7,
            max_tokens=2048
        )
        return completion.choices[0].message.content

    async def _call_mock(self, messages: List[Dict[str, str]]) -> str:
        """
        Mock AI provider for development when no API keys are configured.
        Generates context-aware responses based on the user's message.
        """
        user_msg = ""
        system_context = ""
        for m in messages:
            if m["role"] == "user":
                user_msg = m["content"]
            elif m["role"] == "system":
                system_context = m["content"]

        user_lower = user_msg.lower().strip()

        # Simulate thinking delay
        await asyncio.sleep(0.3)

        # Context-aware responses
        if any(kw in user_lower for kw in ["hello", "hi", "hey", "good morning", "good evening"]):
            return (
                "Hey! 👋 I'm Leno, your AI productivity assistant. "
                "I can help you manage goals, tasks, and habits. "
                "Try saying things like:\n"
                "- **\"Create a goal to learn Python\"**\n"
                "- **\"Add a task to review project docs\"**\n"
                "- **\"Show my goals\"**\n"
                "- **\"How am I doing?\"**\n\n"
                "What would you like to work on today?"
            )

        if any(kw in user_lower for kw in ["my goals", "show goals", "goal progress", "what goals"]):
            return (
                "📊 **Your Goals Overview:**\n\n"
                "I have access to your current goals and can see your progress. "
                "Based on your activity, here's what I can help with:\n"
                "- Review and update existing goals\n"
                "- Create new goals with milestones\n"
                "- Suggest supporting tasks and habits\n\n"
                "Would you like me to create a new goal or review your current ones?"
            )

        if any(kw in user_lower for kw in ["my tasks", "today's tasks", "show tasks", "what should i do"]):
            return (
                "📋 **Your Tasks:**\n\n"
                "I can see your task list and help you prioritize. "
                "Here's what I suggest:\n"
                "1. Focus on high-priority tasks first\n"
                "2. Break large tasks into smaller steps\n"
                "3. Schedule deep work blocks for focused effort\n\n"
                "Want me to help prioritize or create new tasks?"
            )

        if any(kw in user_lower for kw in ["create goal", "add goal", "new goal", "set goal"]):
            # Extract goal name from message
            goal_name = user_msg
            for prefix in ["create goal", "create a goal", "add goal", "add a goal", "new goal", "set goal", "set a goal", "i want to"]:
                if prefix in user_lower:
                    goal_name = user_msg[user_lower.index(prefix) + len(prefix):].strip().strip('"\'')
                    break
            return (
                f"🎯 I'll create a goal for you: **\"{goal_name or 'New Goal'}\"**\n\n"
                f"I'm setting this up with milestones to track your progress. "
                f"Would you also like me to:\n"
                f"- Add supporting tasks?\n"
                f"- Create related habits?\n"
                f"- Schedule deep work sessions?\n\n"
                f"⚠️ *Note: Running in development mode. Connect an AI provider (Groq/NVIDIA) for full capabilities.*"
            )

        if any(kw in user_lower for kw in ["create task", "add task", "new task"]):
            return (
                "✅ I'll create that task for you! "
                "I've added it to your planner.\n\n"
                "⚠️ *Note: Running in development mode. Connect an AI provider for full capabilities.*"
            )

        if any(kw in user_lower for kw in ["create habit", "add habit", "new habit", "track habit"]):
            return (
                "🔄 Great choice! Building habits is key to long-term success. "
                "I'll set up tracking for this habit.\n\n"
                "⚠️ *Note: Running in development mode. Connect an AI provider for full capabilities.*"
            )

        if any(kw in user_lower for kw in ["how am i doing", "analytics", "progress", "stats", "performance"]):
            return (
                "📈 **Your Performance Summary:**\n\n"
                "Based on your recent activity:\n"
                "- **Engagement:** You've been active and consistent\n"
                "- **Task Completion:** Tracking well on daily tasks\n"
                "- **Focus:** Good deep work sessions logged\n\n"
                "Keep up the momentum! Would you like detailed analytics or specific improvement suggestions?"
            )

        if any(kw in user_lower for kw in ["help", "what can you do", "capabilities"]):
            return (
                "🤖 **Here's what I can do:**\n\n"
                "**📌 Goal Management:**\n"
                "- Create goals with milestones\n"
                "- Track progress and suggest improvements\n\n"
                "**✅ Task Management:**\n"
                "- Create, prioritize, and organize tasks\n"
                "- Suggest task breakdowns\n\n"
                "**🔄 Habit Tracking:**\n"
                "- Create habits with daily/weekly tracking\n"
                "- Monitor streaks and consistency\n\n"
                "**📊 Analytics:**\n"
                "- View productivity insights\n"
                "- Get personalized recommendations\n\n"
                "**🎯 Planning:**\n"
                "- Create action plans for goals\n"
                "- Schedule deep work sessions\n\n"
                "Just tell me what you need!"
            )

        # Default conversational response
        return (
            f"I understand you're asking about: *\"{user_msg[:100]}\"*\n\n"
            "I'm here to help with your productivity! I can:\n"
            "- Create and manage **goals**, **tasks**, and **habits**\n"
            "- Analyze your **productivity patterns**\n"
            "- Suggest **improvements** based on your data\n\n"
            "What would you like me to help with?\n\n"
            "⚠️ *Running in dev mode without AI keys. Add GROQ_API_KEY or NVIDIA_API_KEY to your .env for full AI capabilities.*"
        )

    async def handle_message(
        self, 
        message: str, 
        mode: str = "CHAT", 
        history: List[Dict[str, str]] = [],
        session_id: str = None
    ) -> Dict[str, Any]:
        """
        Handle incoming messages with FULL CONTEXT and intent detection.
        
        ENHANCED: Now builds complete context from user's planner and analytics
        so AI has access to goals, tasks, habits, and productivity data.
        """
        # 1. Build FULL context for AI access
        try:
            full_context = await ai_context_builder.build_full_context(self.user_id)
            context_prompt = ai_context_builder.format_for_prompt(full_context)
            logger.info(f"🧠 AI Context built with {full_context.get('summary', {}).get('active_goals', 0)} goals, {full_context.get('tasks', {}).get('counts', {}).get('pending', 0)} pending tasks")
        except Exception as e:
            logger.warning(f"Context building failed: {e}")
            full_context = {}
            context_prompt = "Context unavailable - please try again."
        
        # 2. Build enhanced system prompt with full context
        system_prompt = self._get_system_prompt_with_context(mode, context_prompt)
        
        # 3. Generate AI response
        provider_info = {"provider": "unknown", "model": "unknown"}
        try:
            # Construct the full message list for the AI
            full_messages = [
                {"role": "system", "content": system_prompt},
                *history[-5:],
                {"role": "user", "content": message}
            ]
            # 3. Call chat_completion with mode-aware routing
            completion_result = await self.chat_completion(full_messages, mode=mode)
            
            # Unpack response
            response_text = completion_result.get("text", "")
            provider_info["provider"] = completion_result.get("provider", "system")
            provider_info["model"] = completion_result.get("model", "none")
            
        except Exception as e:
            logger.error(f"AI completion failed: {e}")
            response_text = f"I apologize, I'm having trouble connecting right now. Error: {str(e)}"
            provider_info = {"provider": "system", "model": "error"}
        
        # 4. Detect intent and extract actions
        intent, actions, pending_confirmations = await self._extract_intent_and_actions_v2(
            message, response_text, mode, full_context
        )
        
        # 5. Execute any detected actions (only non-confirmation ones)
        executed_actions = []
        if actions:
            # Import tools registry
            from backend.ai.tools import TOOL_REGISTRY

            for action in actions:
                # Skip actions that are already executed (e.g. from confirmation flow)
                if action.get("status") in ["success", "error", "executed"]:
                    executed_actions.append(action)
                    continue

                tool_name = action.get("type")

                # 🛑 SAFETY CHECK: Intercept actions that need confirmation
                # If the AI suggests creating something, we MUST ask first
                # BUT: If user explicitly asks to create something, execute directly
                requires_confirmation = action.get("requires_confirmation", True)
                
                # Check if user explicitly requested creation (no confirmation needed)
                user_message_lower = message.lower()
                
                creation_phrases = [
                    "create goal", "add goal", "make goal", "create task", "add task", "make task", 
                    "create habit", "add habit", "make habit", "create a goal", "add a goal", 
                    "create a task", "add a task", "create a habit", "add a habit",
                    "set goal", "new goal", "new task", "new habit", "track habit", "start habit",
                    "i want to", "i need to", "remind me to", "schedule", "focus on", "aim to"
                ]
                
                confirmation_phrases = [
                    "yes", "sure", "ok", "okay", "yep", "yeah", "go ahead", "do it", "confirm", 
                    "create it", "add it", "please", "would be great", "sounds good", "proceed",
                    "correct", "right", "approve"
                ]

                is_explicit_creation = any(p in user_message_lower for p in creation_phrases)
                is_confirmation = any(p in user_message_lower for p in confirmation_phrases)
                
                # Trust the AI if it explicitly says no confirmation needed (based on its understanding of context)
                ai_says_safe = action.get("requires_confirmation") is False

                # Handle creation actions based on whether user explicitly requested them or confirmed
                if tool_name in ["CREATE_GOAL", "CREATE_HABIT", "CREATE_TASK"]:
                    # Check if this is a confirmation response to a pending action
                    pending_actions = await ai_agent_actions.get_pending_actions(self.user_id)
                    is_pending_confirmation = any(
                        p.get("action_type") == tool_name and 
                        p.get("payload", {}).get("title") == action.get("payload", {}).get("title")
                        for p in pending_actions
                    )
                    
                    if is_explicit_creation or is_confirmation or ai_says_safe or is_pending_confirmation:
                        # Execute directly when user explicitly requests creation or confirms pending action
                        tool = TOOL_REGISTRY.get(tool_name)
                        if tool:
                            try:
                                logger.info(f"🚀 Direct execution of {tool_name} (user requested/confirmed)")
                                result = await self._execute_tool(tool, action.get("payload", {}))
                                executed_actions.append({
                                    "type": tool_name,
                                    "status": "success",
                                    "result": result
                                })
                                logger.info(f"✅ Direct execution success: {tool_name}")
                                
                                # Update response to reflect successful creation
                                creation_response = response_formatter.format_creation_response(
                                    tool_name.split('_')[1], result, is_confirmation=True
                                )
                                response_text += f"\n\n{creation_response}"
                            except Exception as e:
                                executed_actions.append({
                                    "type": tool_name,
                                    "status": "error",
                                    "error": str(e)
                                })
                                logger.error(f"❌ Direct execution failure: {tool_name} - {str(e)}")
                                response_text += f"\n\n❌ Failed to create {tool_name.split('_')[1].lower()}: {str(e)}"
                        
                        # Skip the standard execution below since we already executed
                        continue
                    else:
                        # Require confirmation for AI-suggested creations
                        try:
                            logger.info(f"🛡️ Intercepting {tool_name} for user confirmation (AI suggested)")
                            req_result = None

                            if tool_name == "CREATE_GOAL":
                                req_result = await ai_agent_actions.request_create_goal(self.user_id, action.get("payload", {}))
                            elif tool_name == "CREATE_HABIT":
                                req_result = await ai_agent_actions.request_create_habit(self.user_id, action.get("payload", {}))
                            elif tool_name == "CREATE_TASK":
                                req_result = await ai_agent_actions.request_create_task(self.user_id, action.get("payload", {}))

                            if req_result:
                                # Add to pending confirmations so frontend can display UI
                                pending_confirmations.append(req_result)
                                
                                # Also append the confirmation request message to the chat response
                                # This ensures the user sees the question even if UI cards are subtle
                                if req_result.get("message"):
                                    response_text += f"\n\n{req_result['message']}"
                                    
                                continue # Skip immediate execution

                        except Exception as e:
                            logger.error(f"Error requesting confirmation for {tool_name}: {e}")
                            # Fallback: don't execute if confirmation failed
                            continue

                # Standard Execution (for safe tools like GET_DASHBOARD etc)
                # OR direct execution when user explicitly requests creation
                tool = TOOL_REGISTRY.get(tool_name)
                if tool:
                    try:
                        logger.info(f"🛠️ Executing tool: {tool_name}")
                        result = await self._execute_tool(tool, action.get("payload", {}))
                        executed_actions.append({
                            "type": tool_name,
                            "status": "success",
                            "result": result
                        })
                        logger.info(f"✅ Tool success: {tool_name}")
                        
                        # If this was a creation action, update the response to reflect successful creation with REAL data
                        if tool_name in ["CREATE_GOAL", "CREATE_TASK", "CREATE_HABIT"]:
                            item_name = result.get('title', result.get('name', 'Untitled'))
                            response_text += f"\n\n✅ **Success!** {tool_name.split('_')[1].capitalize()} \"{item_name}\" has been created and added to your planner."
                            
                            # Add habit specific details
                            if tool_name == "CREATE_HABIT":
                                response_text += f"\n- Frequency: {result.get('frequency', 'daily')}"
                                response_text += f"\n- Category: {result.get('category', 'Wellness')}"
                        elif tool_name.startswith("DELETE_"):
                            response_text += f"\n\n✅ {tool_name.split('_', 1)[1].capitalize()} deleted successfully."
                    except Exception as e:
                        executed_actions.append({
                            "type": tool_name,
                            "status": "error",
                            "error": str(e)
                        })
                        logger.error(f"❌ Tool failure: {tool_name} - {str(e)}")
                        # Don't add error to response text for better UX - let AI handle it
                        # response_text += f"\n\n❌ Failed to execute {tool_name}: {str(e)}"
        
        # 7. Sanitize response to remove any JSON artifacts
        final_response = response_formatter.sanitize_response(response_text)
        
        return {
            "message": final_response,
            "intent": intent,
            "actions": executed_actions,
            "pending_confirmations": pending_confirmations,
            "session_id": session_id,
            "ui": self._get_ui_hints(intent),
            "data": {
                "context_summary": full_context.get("summary", {}),
            },
            "provider": provider_info["provider"],
            "model": provider_info["model"],
            "has_full_context": bool(full_context.get("goals")),
        }
    
    def _get_system_prompt_with_context(self, mode: str, context_prompt: str) -> str:
        """Build system prompt with FULL user context for AI agent."""
        
        base_agent_prompt = """You are Leno, an AI productivity agent with FULL ACCESS to the user's data.

## YOUR REAL-TIME KNOWLEDGE:
{context}

## YOUR CAPABILITIES:
1. VIEW all goals, tasks, habits, and analytics (you have this data above)
2. SUGGEST new goals, tasks, or habits based on patterns
3. ANALYZE their productivity and provide insights
4. HELP plan goal achievement strategies
5. REFERENCE specific items by name (use the data above)
6. CREATE goals, tasks, habits, and schedule deep work sessions
7. TRACK progress and update goal/task statuses
8. PROVIDE real-time analytics and progress reports
9. GENERATE goal roadmaps and action plans

## CRITICAL RULES:
1. **WHEN USER EXPLICITLY ASKS TO CREATE**, you MUST generate a JSON action (see Output Format).
2. **WHEN YOU SUGGEST** (without explicit request), ask for confirmation first.
3. **Use REAL data** from the context above - reference specific goals, tasks by name
4. **Explain your reasoning** when making suggestions
5. **Be concise** but thorough

## RESPONSE STYLE (CRITICAL):
1. **SHORT & CONVERSATIONAL**: Default to short, punchy replies (1-2 sentences).
2. **NO LECTURES**: Do not give long lessons or big explanations unless explicitly asked.
3. **ACTIVE CONVERSATION**: Reply, then wait for the user. Do not dump information.
4. **MEDIUM LENGTH**: Only when explaining a complex plan or breakdown.
5. **LONG LENGTH**: RESERVED for extreme cases or when user says "explain in detail".

## CLASSIFICATION RULES (Task vs. Habit):
1. **TASK**: 
   - Big, one-off, or project-related work.
   - Tied to a specific Goal (e.g., "Write Chapter 1").
   - Long duration (1 hour, 2 hours, 4 hours).
   - Requires "Deep Work" or focused attention.
   - Examples: "Finish report", "Code new feature", "Study for exam (2hrs)".

2. **HABIT**:
   - Small, repetitive, lifestyle or routine actions.
   - Short duration (usually < 30 mins) OR specific training routines.
   - Keywords: "Daily", "Every morning", "Practice", "Read", "Meditate", "Run".
   - Examples: "Wake up early", "Read book (15m)", "Meditation", "Running", "Exercise".
   - **EXCEPTION**: Large repetitive training (e.g., "Play football 2hrs daily", "Hockey practice 3hrs") can be a HABIT if it's a routine/lifestyle thing.

3. **USER OVERRIDE**:
   - If user says "Add habit to...", always make it a HABIT.
   - If user says "Add task to...", always make it a TASK.

```json
{{
  "intent": "INTENT_NAME",
  "actions": [
    {{
      "type": "TOOL_NAME",
      "payload": {{ ...args... }},
      "requires_confirmation": false
    }}
  ]
}}
```

## AVAILABLE TOOLS (Use these "type" names):

1. **CREATE_GOAL**
   - payload: {{ "title": "str", "description": "str", "category": "str", "milestones": ["str"] }}
   
2. **CREATE_TASK**
   - payload: {{ "title": "str", "duration_minutes": int, "priority": "high/medium/low", "goal_link": "str (optional goal ID or title)" }}

3. **CREATE_HABIT**
   - payload: {{ "name": "str", "frequency": "daily/weekly", "category": "str", "goal_link": "str (optional)" }}

4. **START_DEEP_WORK**
   - payload: {{ "duration_minutes": int, "focus_goal": "str" }}

## EXAMPLE INTERACTIONS:

User: "Create a goal to Learn Rust"
AI: I've created a new goal for you to Learn Rust. I've also added some initial milestones.
```json
{{
  "intent": "CREATE_GOAL",
  "actions": [
    {{
      "type": "CREATE_GOAL",
      "payload": {{
        "title": "Learn Rust",
        "category": "Skills",
        "milestones": ["Complete Rust Book", "Build CLI Tool"]
      }},
      "requires_confirmation": false
    }}
  ]
}}
```

User: "Add a task to read Chapter 1"
AI: Added "Read Chapter 1" to your tasks.
```json
{{
  "intent": "CREATE_TASK",
  "actions": [
    {{
      "type": "CREATE_TASK",
      "payload": {{ "title": "Read Chapter 1", "duration_minutes": 60, "priority": "medium" }},
      "requires_confirmation": false
    }}
  ]
}}
```

## CURRENT MODE: {mode}

Now help the user with their request. Use the real data above to give personalized, accurate responses.
"""
        
        mode_additions = {
            "CHAT": "Be helpful and conversational.",
            "PLAN": "Focus on planning and goal breakdown.",
            "TASK": "Help with task management and prioritization.",
            "ANALYZE": "Provide data-driven insights from their analytics.",
        }
        
        return base_agent_prompt.format(
            context=context_prompt,
            mode=mode + " - " + mode_additions.get(mode, "")
        )

    
    def _get_system_prompt(self, mode: str, context: Dict[str, Any] = {}) -> str:
        """Get context-aware system prompt based on mode."""

        # Extract context variables safely
        app_state = context.get("app_state", {})
        planner_state = app_state.get("planner", {})
        analytics_state = app_state.get("analytics", {})
        user_name = "User" # Could fetch from settings if available

        # Format context strings
        active_tasks_count = len(planner_state.get("active_tasks", []))
        focus_score = analytics_state.get("focus_score", "N/A")

        base_prompt = (
            f"You are Leno, an advanced AI productivity assistant. "
            f"Current Context: User has {active_tasks_count} active tasks. Focus Score: {focus_score}. "
        )

        prompts = {
            "CHAT": (
                f"{base_prompt}"
                "Help users with tasks, planning, and productivity advice. "
                "Be concise, friendly, and actionable."
            ),
            "PLAN": (
                f"{base_prompt}"
                "You are a planning assistant. Help users create actionable plans. "
                "Break down goals into specific, time-bound steps. "
                f"Consider their current load of {active_tasks_count} tasks."
            ),
            "TASK": (
                f"{base_prompt}"
                "You are a task management assistant. Help users define, "
                "prioritize, and organize their tasks efficiently."
            ),
            "ANALYZE": (
                f"{base_prompt}"
                "You are an analytics assistant. Help users understand their "
                "productivity patterns and provide data-driven insights."
            )
        }
        return prompts.get(mode, prompts["CHAT"])
    
    def _extract_intent_and_actions(
        self, 
        user_message: str, 
        ai_response: str, 
        mode: str
    ) -> tuple:
        """
        Extract intent and actionable items.
        
        CRITICAL UPGRADE:
        Now prioritizes the AI's explicit JSON output over hardcoded keywords.
        This allows the AI to "ask for details" before acting.
        """
        import json
        import re

        user_lower = user_message.lower()
        actions = []
        intent = mode or "CHAT"

        # 1. Try to parse AI Response as JSON (The "Advanced" Way)
        try:
            # Look for JSON block in case there's text around it
            json_match = re.search(r'\{.*\}', ai_response, re.DOTALL)
            if json_match:
                data = json.loads(json_match.group(0))
                
                # Extract Intent
                if "intent" in data:
                    intent = data["intent"]
                
                # Extract Actions
                if "actions" in data and isinstance(data["actions"], list):
                    logger.info(f"🧠 AI-Driven Logic: Found {len(data['actions'])} actions in response.")
                    actions.extend(data["actions"])
                    return intent, actions, []

        except Exception as e:
            logger.warning(f"Failed to parse AI JSON response: {e}. Falling back to basic detection.")

        # 2. Fallback: Keyword Detection (Safety Net)
        # We REMOVED the aggressive "Create Task" logic here to prevent 
        # the AI from creating empty tasks when it should be asking questions.

        # ─── NAVIGATION REQUESTS (Safe to trigger immediately) ──────────────────
        if any(kw in user_lower for kw in ["dashboard", "overview", "status", "summary"]):
            intent = "DASHBOARD"
            actions.append({"type": "PLANNER_GET_DASHBOARD", "payload": {}})
            return intent, actions, []
        
        # ─── ANALYTICS REQUESTS (Safe) ────────────────────────────────────────
        if any(kw in user_lower for kw in ["analyze", "insights", "how am i doing", "stats"]):
            intent = "ANALYZE"
            # Let AI handle the analysis via tool if it didn't already
            if not actions: 
                actions.append({"type": "ANALYTICS_ANALYZE_PATTERNS", "payload": {}})
            return intent, actions, []

        # ─── DEEP WORK (Safe-ish) ─────────────────────────────────────────────
        if any(kw in user_lower for kw in ["start focus", "deep work", "start timer"]):
            intent = "START_DEEP_WORK"
             # Only add if AI didn't catch it
            if not actions:
                actions.append({"type": "PLANNER_START_DEEP_WORK", "payload": {"duration": 25}})
            return intent, actions, []

        return intent, actions, []
    

    async def generate_response(self, message: str) -> str:
        """Simple wrapper for text-only response"""
        result = await self.chat_completion([{"role": "user", "content": message}])
        return result["text"]

    async def _extract_intent_and_actions_v2(
        self,
        user_message: str,
        ai_response: str,
        mode: str,
        context: Dict[str, Any]
    ) -> tuple:
        """
        Enhanced intent extraction with confirmation flow.

        Returns: (intent, actions, pending_confirmations)
        - actions: Immediate actions to execute
        - pending_confirmations: Actions that need user confirmation
        """
        import json
        import re

        user_lower = user_message.lower()
        actions = []
        pending_confirmations = []
        intent = mode or "CHAT"

        # 1. Try to parse JSON from AI response (Primary Method)
        # This handles explicit tool calls or structured data returned by LLM
        try:
            def extract_all_json_safely(text):
                """Find ALL valid JSON blocks in text, not just the first one."""
                found_data = [] # List of parsed dicts
                
                # Check for code blocks first (most reliable)
                code_blocks = re.findall(r'```(?:json)?\s*(\{.*?\})\s*```', text, re.DOTALL)
                for block in code_blocks:
                    try:
                        found_data.append(json.loads(block))
                    except json.JSONDecodeError:
                        pass
                
                # If code blocks found, return them
                if found_data:
                    return found_data

                # Fallback: Brute force find all outer braces
                stack = []
                start_index = -1
                for i, char in enumerate(text):
                    if char == '{':
                        if not stack:
                            start_index = i
                        stack.append(char)
                    elif char == '}':
                        if stack:
                            stack.pop()
                            if not stack and start_index != -1:
                                # Found a complete outer block
                                candidate = text[start_index:i+1]
                                try:
                                    parsed = json.loads(candidate)
                                    # Basic validation: likely an action payload
                                    if "intent" in parsed or "actions" in parsed or "type" in parsed:
                                        found_data.append(parsed)
                                except json.JSONDecodeError:
                                    pass
                                start_index = -1 # Reset
                return found_data

            all_data_blocks = extract_all_json_safely(ai_response)
            
            for data in all_data_blocks:
                # Extract Intent (Use the last valid one if multiple, or specific logic)
                if "intent" in data:
                    intent = data["intent"]

                # Extract Actions
                if "actions" in data and isinstance(data["actions"], list):
                    logger.info(f"🧠 AI-Driven Logic: Found {len(data['actions'])} actions in block.")
                    actions.extend(data["actions"])
                    
        except Exception as e:
            logger.debug(f"AI JSON parsing skipped or failed: {e}")

        # 2. Check for confirmation keywords (user responding to AI suggestion)
        # More precise confirmation detection
        confirmation_keywords = ["yes", "sure", "okay", "ok", "yep", "yeah", "go ahead", "do it", "confirm", "create it", "add it", "please", "would be great", "sounds good", "proceed", "correct", "approve", "let's do it", "i agree"]
        rejection_keywords = ["no", "cancel", "don't", "stop", "nevermind", "nope", "not now", "maybe later", "skip", "pass"]

        # Check for explicit confirmation (user saying yes to pending actions)
        is_confirmation = any(kw in user_lower for kw in confirmation_keywords)
        is_rejection = any(kw in user_lower for kw in rejection_keywords)

        if is_confirmation or is_rejection:
            # Check for pending actions to confirm/reject
            user_pending = await ai_agent_actions.get_pending_actions(self.user_id)
            if user_pending:
                if is_confirmation:
                    intent = "CONFIRM_ACTION"
                    for pending in user_pending:
                        result = await ai_agent_actions.confirm_action(
                            pending["action_id"], self.user_id
                        )
                        actions.append({
                            "type": pending["action_type"],
                            "status": result.get("status"),
                            "result": result,
                        })
                    return intent, actions, []
                elif is_rejection:
                    intent = "REJECT_ACTION"
                    for pending in user_pending:
                        await ai_agent_actions.reject_action(pending["action_id"], self.user_id)
                    return intent, [], []

        # 2. Detect goal creation intent with more comprehensive triggers
        goal_triggers = [
            "i want to", "my goal is", "set a goal", "create a goal", "new goal", "i aim to",
            "i need to achieve", "i want to achieve", "i want to accomplish", "my objective is",
            "i'm working toward", "i'm trying to", "i want to improve", "i want to gain",
            "i want to lose", "i want to learn", "i want to master", "i want to build"
        ]
        if any(trigger in user_lower for trigger in goal_triggers):
            intent = "SUGGEST_GOAL"
            # Don't create immediately - AI should ask for details first
            # The AI response likely already contains the suggestion

        # 3. Detect task creation intent with more comprehensive triggers
        task_triggers = [
            "add task", "create task", "new task", "remind me to", "i need to",
            "i should", "i have to", "i must", "i need to do", "plan to", "schedule",
            "i want to do", "i want to complete", "i want to finish"
        ]
        if any(trigger in user_lower for trigger in task_triggers):
            intent = "SUGGEST_TASK"

        # 4. Detect habit creation intent with more comprehensive triggers
        habit_triggers = [
            "add habit", "create habit", "new habit", "track habit", "start tracking",
            "i want to develop", "i want to build", "i want to form", "i want to establish",
            "i want to start doing", "i want to make a habit", "i want to practice"
        ]
        if any(trigger in user_lower for trigger in habit_triggers):
            intent = "SUGGEST_HABIT"

        # 5. Detect deep work scheduling intent
        deep_work_triggers = [
            "start deep work", "focus time", "schedule focus", "block time", "time block",
            "start working", "begin deep work", "focus session", "working session"
        ]
        if any(trigger in user_lower for trigger in deep_work_triggers):
            intent = "START_DEEP_WORK"

        # 6. Navigation/analysis intents (safe to execute immediately)
        if any(kw in user_lower for kw in ["dashboard", "overview", "status", "summary", "analytics", "report", "progress"]):
            intent = "DASHBOARD"
            actions.append({"type": "GET_DAILY_ACHIEVEMENT_SCORE", "payload": {}})

        if any(kw in user_lower for kw in ["analyze", "insights", "how am i doing", "stats", "progress", "review", "evaluate"]):
            intent = "ANALYZE"
            actions.append({"type": "GET_GOAL_PROGRESS_REPORT", "payload": {}})

        if any(kw in user_lower for kw in ["start focus", "deep work", "start timer", "pomodoro", "focus session"]):
            intent = "START_DEEP_WORK"
            actions.append({"type": "START_DEEP_WORK", "payload": {"duration_minutes": 25, "focus_goal": "Focus on priority tasks"}})

        # 7. Goal-specific queries (use context to provide real data)
        if any(kw in user_lower for kw in ["my goals", "goal progress", "how are my goals", "show goals", "what goals"]):
            intent = "GOAL_STATUS"
            # AI already has context, will respond with real data

        if any(kw in user_lower for kw in ["my tasks", "today's tasks", "what should i do", "show tasks", "what tasks"]):
            intent = "TASK_STATUS"

        if any(kw in user_lower for kw in ["my habits", "habit streak", "habits today", "show habits", "what habits"]):
            intent = "HABIT_STATUS"

        # 8. Analytics queries
        if any(kw in user_lower for kw in ["my analytics", "show analytics", "performance", "productivity", "focus score", "burnout risk"]):
            intent = "ANALYTICS_OVERVIEW"
            actions.append({"type": "GET_DAILY_ACHIEVEMENT_SCORE", "payload": {}})

        # 9. Goal-specific analytics
        if any(kw in user_lower for kw in ["how am i progressing", "progress report", "how am i doing", "am i on track", "am i achieving"]):
            intent = "GOAL_PROGRESS_CHECK"
            actions.append({"type": "GET_GOAL_PROGRESS_REPORT", "payload": {}})

        # 10. Habit analytics
        if any(kw in user_lower for kw in ["how are my habits", "habit progress", "am i consistent", "habit tracking"]):
            intent = "HABIT_ANALYTICS"
            actions.append({"type": "GET_HABITS", "payload": {}})

        # 11. Explicit CRUD fallbacks when AI didn't emit tool actions
        try:
            from backend.ai.intent_parser import PlannerIntentParser
            from backend.ai.tools.goal_automation import detect_goal_intent
            parsed = PlannerIntentParser.parse_user_input(user_message)
        except Exception:
            parsed = None
            detect_goal_intent = None  # type: ignore

        # Explicit create phrases (only auto-execute when user clearly asks)
        explicit_task = any(p in user_lower for p in [
            "create task", "create a task", "add task", "add a task", "make task", "make a task", "new task"
        ])
        explicit_goal = any(p in user_lower for p in [
            "create goal", "create a goal", "add goal", "add a goal", "make goal", "make a goal", "set goal", "set a goal", "new goal"
        ])
        explicit_habit = any(p in user_lower for p in [
            "create habit", "create a habit", "add habit", "add a habit", "make habit", "make a habit",
            "new habit", "track habit", "start habit"
        ])

        # Detect delete intent (explicit)
        delete_action = self._detect_delete_action(user_message)
        if delete_action and not any(a.get("type") == delete_action.get("type") for a in actions):
            actions.append(delete_action)

        # Create task fallback
        if explicit_task and parsed and parsed.get("type") == "create_task":
            if not any(a.get("type") == "CREATE_TASK" for a in actions):
                task_payload = parsed.get("data", {})
                actions.append({
                    "type": "CREATE_TASK",
                    "payload": {
                        "title": task_payload.get("title"),
                        "priority": task_payload.get("priority", "medium"),
                        "description": task_payload.get("description", ""),
                        "duration_minutes": task_payload.get("duration_minutes", 60),
                        "category": task_payload.get("category", "work"),
                        "tags": task_payload.get("tags", []),
                    }
                })

        # Create habit fallback
        if explicit_habit and parsed and parsed.get("type") == "create_habit":
            if not any(a.get("type") == "CREATE_HABIT" for a in actions):
                habit_payload = parsed.get("data", {})
                actions.append({
                    "type": "CREATE_HABIT",
                    "payload": {
                        "name": habit_payload.get("name"),
                        "description": habit_payload.get("description", ""),
                        "frequency": habit_payload.get("frequency", "daily"),
                        "category": habit_payload.get("category", "Wellness"),
                    }
                })

        # Create goal fallback (optionally cascade)
        if explicit_goal and parsed and parsed.get("type") == "create_goal":
            if not any(a.get("type") in ["CREATE_GOAL", "CREATE_GOAL_CASCADE"] for a in actions):
                goal_payload = parsed.get("data", {})
                goal_intent = detect_goal_intent(user_message) if detect_goal_intent else {}
                category = goal_intent.get("category", "personal")
                timeframe = goal_intent.get("timeframe", "month")
                complexity = goal_intent.get("complexity", "medium")

                wants_breakdown = any(p in user_lower for p in [
                    "plan", "roadmap", "steps", "milestones", "break down", "breakdown",
                    "with tasks", "task list", "tasks for", "action plan"
                ])
                wants_habits = "habit" in user_lower or "habits" in user_lower

                if wants_breakdown:
                    actions.append({
                        "type": "CREATE_GOAL_CASCADE",
                        "payload": {
                            "title": goal_payload.get("title"),
                            "description": goal_payload.get("description", ""),
                            "category": category,
                            "timeframe": timeframe,
                            "complexity": complexity,
                            "target_date": goal_payload.get("target_date"),
                            "auto_create_tasks": True,
                            "auto_create_habits": wants_habits,
                            "propose_deep_work": True,
                        }
                    })
                else:
                    actions.append({
                        "type": "CREATE_GOAL",
                        "payload": {
                            "title": goal_payload.get("title"),
                            "description": goal_payload.get("description", ""),
                            "category": category,
                            "target_date": goal_payload.get("target_date"),
                            "milestones": goal_payload.get("milestones", []),
                        }
                    })

        return intent, actions, pending_confirmations

    def _detect_delete_action(self, user_message: str) -> Optional[Dict[str, Any]]:
        """Detect explicit delete/remove commands for tasks, goals, habits."""
        import re

        text = user_message.strip()
        lower = text.lower()
        if not any(k in lower for k in ["delete", "remove", "archive"]):
            return None

        def extract_name(keyword: str) -> Optional[str]:
            # delete task "Title" / remove habit Title
            pattern = rf"(?:delete|remove|archive)\s+(?:the\s+)?{keyword}\s+['\"]?([^'\"\n\r]+?)['\"]?(?:\s*$)"
            match = re.search(pattern, lower)
            if match:
                return match.group(1).strip()
            return None

        def build_action(kind: str) -> Optional[Dict[str, Any]]:
            name = extract_name(kind)
            payload: Dict[str, Any] = {}
            if name:
                # Trim polite suffixes if present
                for suffix in ["please", "now", "today"]:
                    if name.endswith(f" {suffix}"):
                        name = name[: -len(suffix) - 1].strip()
                if name.isdigit():
                    payload[f"{kind}_id"] = name
                else:
                    payload["title"] = name
            if not payload:
                return None
            return {
                "type": f"DELETE_{kind.upper()}",
                "payload": payload
            }

        for kind in ["task", "goal", "habit"]:
            if kind in lower:
                action = build_action(kind)
                if action:
                    return action
        return None
    
    def _get_ui_hints(self, intent: str) -> Dict[str, Any]:
        """Get UI hints based on intent for frontend rendering."""
        hints = {
            "CREATE_TASK": {"showTaskForm": True, "highlight": "planner"},
            "START_DEEP_WORK": {"showTimer": True, "highlight": "deepwork"},
            "ANALYZE": {"showAnalytics": True, "highlight": "analytics"},
            "PLAN": {"showPlanner": True, "highlight": "planner"},
            "SUGGEST_GOAL": {"showConfirmation": True, "type": "goal"},
            "SUGGEST_TASK": {"showConfirmation": True, "type": "task"},
            "SUGGEST_HABIT": {"showConfirmation": True, "type": "habit"},
            "GOAL_STATUS": {"highlight": "planner", "scrollTo": "goals"},
            "TASK_STATUS": {"highlight": "planner", "scrollTo": "tasks"},
            "HABIT_STATUS": {"highlight": "planner", "scrollTo": "habits"},
        }
        return hints.get(intent, {})
