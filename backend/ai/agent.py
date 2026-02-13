# backend/ai/agent.py
"""
AI Agent Orchestration System
Handles agent planning, execution, and decision-making
"""

import logging
from typing import Any, Dict, List, Optional, Callable
from datetime import datetime
from enum import Enum
import json

logger = logging.getLogger(__name__)


class AgentState(str, Enum):
    """Agent execution states"""
    IDLE = "idle"
    THINKING = "thinking"
    EXECUTING = "executing"
    WAITING = "waiting"
    COMPLETED = "completed"
    FAILED = "failed"


class AgentPlan:
    """Represents a plan created by the agent"""
    
    def __init__(self, user_id: int, goal: str, steps: List[str], reasoning: str):
        self.user_id = user_id
        self.goal = goal
        self.steps = steps
        self.reasoning = reasoning
        self.created_at = datetime.utcnow()
        self.completed_steps: List[str] = []
        self.current_step_index = 0
    
    def mark_step_complete(self, step_index: int):
        """Mark a step as completed"""
        if 0 <= step_index < len(self.steps):
            self.completed_steps.append(self.steps[step_index])
            self.current_step_index = step_index + 1
    
    def is_complete(self) -> bool:
        """Check if all steps are completed"""
        return len(self.completed_steps) == len(self.steps)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "goal": self.goal,
            "steps": self.steps,
            "reasoning": self.reasoning,
            "completed_steps": self.completed_steps,
            "progress": f"{len(self.completed_steps)}/{len(self.steps)}",
            "created_at": self.created_at.isoformat()
        }


class ConversationContext:
    """Maintains conversation context for multi-turn interactions"""
    
    def __init__(self, user_id: int, max_history: int = 20):
        self.user_id = user_id
        self.messages: List[Dict[str, str]] = []
        self.max_history = max_history
        self.context_topics: List[str] = []
        self.user_preferences: Dict[str, Any] = {}
        self.last_interaction = datetime.utcnow()
    
    def add_message(self, role: str, content: str, metadata: Optional[Dict] = None):
        """Add a message to conversation history"""
        message = {
            "role": role,
            "content": content,
            "timestamp": datetime.utcnow().isoformat(),
            "metadata": metadata or {}
        }
        self.messages.append(message)
        
        # Keep only recent messages
        if len(self.messages) > self.max_history:
            self.messages = self.messages[-self.max_history:]
        
        self.last_interaction = datetime.utcnow()
    
    def get_recent_context(self, num_messages: int = 5) -> List[Dict[str, str]]:
        """Get recent conversation messages for context"""
        return self.messages[-num_messages:] if self.messages else []
    
    def extract_topics(self) -> List[str]:
        """Extract conversation topics from history"""
        return self.context_topics
    
    def set_preference(self, key: str, value: Any):
        """Set user preference during conversation"""
        self.user_preferences[key] = value
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "user_id": self.user_id,
            "message_count": len(self.messages),
            "topics": self.context_topics,
            "preferences": self.user_preferences,
            "last_interaction": self.last_interaction.isoformat()
        }


class ToolCall:
    """Represents a tool function call"""
    
    def __init__(self, tool_name: str, parameters: Dict[str, Any]):
        self.tool_name = tool_name
        self.parameters = parameters
        self.result: Optional[Any] = None
        self.error: Optional[str] = None
        self.executed_at: Optional[datetime] = None
    
    def execute(self, tool_function: Callable) -> bool:
        """Execute the tool function"""
        try:
            self.result = tool_function(**self.parameters)
            self.executed_at = datetime.utcnow()
            logger.info(f"✓ Tool executed: {self.tool_name}")
            return True
        except Exception as e:
            self.error = str(e)
            logger.error(f"✗ Tool execution failed: {self.tool_name} - {e}")
            return False
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "tool": self.tool_name,
            "parameters": self.parameters,
            "result": self.result,
            "error": self.error,
            "executed_at": self.executed_at.isoformat() if self.executed_at else None
        }


class AgentOrchestrator:
    """
    Main orchestrator for AI agent operations
    Manages state, planning, execution, and memory
    """
    
    def __init__(self, user_id: int, ai_client: Any):
        self.user_id = user_id
        self.ai_client = ai_client
        self.state = AgentState.IDLE
        self.current_plan: Optional[AgentPlan] = None
        self.conversation_context = ConversationContext(user_id)
        self.tool_registry: Dict[str, Callable] = {}
        self.execution_history: List[Dict[str, Any]] = []
        self.created_at = datetime.utcnow()
    
    def register_tool(self, name: str, func: Callable, description: str = ""):
        """Register a tool function for the agent to use"""
        self.tool_registry[name] = {
            "function": func,
            "description": description
        }
        logger.info(f"📌 Tool registered: {name}")
    
    async def process_user_input(
        self, 
        user_message: str, 
        mode: str = "CHAT"
    ) -> Dict[str, Any]:
        """
        Process user input and determine agent response
        
        Returns:
            - response: AI-generated response
            - tools_used: List of tools called
            - plan: If planning mode, returns AgentPlan
            - next_action: Suggested next action
        """
        self.state = AgentState.THINKING
        
        # Add to context
        self.conversation_context.add_message("user", user_message)
        
        # Get relevant context
        recent_context = self.conversation_context.get_recent_context()
        
        try:
            # Route to appropriate handler
            if mode == "PLAN":
                return await self._handle_planning_mode(user_message, recent_context)
            elif mode == "ANALYZE":
                return await self._handle_analysis_mode(user_message, recent_context)
            elif mode == "TASK":
                return await self._handle_task_mode(user_message, recent_context)
            else:  # CHAT
                return await self._handle_chat_mode(user_message, recent_context)
        
        except Exception as e:
            self.state = AgentState.FAILED
            logger.error(f"❌ Agent processing failed: {e}")
            return {
                "response": f"I encountered an error: {str(e)}",
                "error": str(e),
                "mode": mode
            }
    
    async def _handle_planning_mode(
        self, 
        user_message: str, 
        context: List[Dict]
    ) -> Dict[str, Any]:
        """Plan a series of actions to accomplish a goal"""
        logger.info(f"📋 Planning mode activated")
        
        # Get AI planning response
        plan_prompt = f"""
        The user wants to: {user_message}
        
        Create a detailed plan with 3-5 specific steps. For each step, explain what needs to be done.
        Also provide your reasoning for this plan.
        
        Format your response as JSON with:
        {{
            "goal": "...",
            "steps": ["step 1", "step 2", ...],
            "reasoning": "..."
        }}
        """
        
        plan_response = await self.ai_client.generate_response(plan_prompt)
        
        try:
            plan_data = json.loads(plan_response)
            self.current_plan = AgentPlan(
                user_id=self.user_id,
                goal=plan_data.get("goal", user_message),
                steps=plan_data.get("steps", []),
                reasoning=plan_data.get("reasoning", "")
            )
            self.state = AgentState.EXECUTING
            
            return {
                "response": f"I've created a plan with {len(self.current_plan.steps)} steps",
                "plan": self.current_plan.to_dict(),
                "mode": "PLAN"
            }
        except json.JSONDecodeError:
            return {
                "response": plan_response,
                "plan": None,
                "mode": "PLAN"
            }
    
    async def _handle_analysis_mode(
        self,
        user_message: str,
        context: List[Dict]
    ) -> Dict[str, Any]:
        """Analyze data and provide insights"""
        logger.info(f"📊 Analysis mode activated")
        
        analysis_prompt = f"""
        Analyze this: {user_message}
        
        Provide:
        1. Key findings
        2. Patterns or trends
        3. Recommendations
        
        Be concise and actionable.
        """
        
        response = await self.ai_client.generate_response(analysis_prompt)
        self.state = AgentState.COMPLETED
        
        return {
            "response": response,
            "mode": "ANALYZE",
            "analysis_type": "user_requested"
        }
    
    async def _handle_task_mode(
        self,
        user_message: str,
        context: List[Dict]
    ) -> Dict[str, Any]:
        """Create or suggest tasks"""
        logger.info(f"📝 Task mode activated")
        
        task_prompt = f"""
        Based on: {user_message}
        
        Suggest 2-3 specific, actionable tasks to accomplish this.
        For each task, provide:
        - title
        - estimated duration in minutes
        - priority (low/medium/high)
        - category (work/personal/health/learning)
        
        Format as JSON with "tasks" array.
        """
        
        response = await self.ai_client.generate_response(task_prompt)
        self.state = AgentState.COMPLETED
        
        return {
            "response": response,
            "mode": "TASK",
            "action": "create_tasks"
        }
    
    async def _handle_chat_mode(
        self,
        user_message: str,
        context: List[Dict]
    ) -> Dict[str, Any]:
        """Regular conversational mode"""
        logger.info(f"💬 Chat mode activated")
        
        response = await self.ai_client.generate_response(user_message)
        self.state = AgentState.COMPLETED
        
        # Add response to context
        self.conversation_context.add_message("assistant", response)
        
        return {
            "response": response,
            "mode": "CHAT",
            "conversation": self.conversation_context.to_dict()
        }
    
    async def execute_tool(self, tool_name: str, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Execute a registered tool"""
        if tool_name not in self.tool_registry:
            return {
                "success": False,
                "error": f"Tool '{tool_name}' not registered"
            }
        
        tool_info = self.tool_registry[tool_name]
        tool_call = ToolCall(tool_name, parameters)
        
        success = tool_call.execute(tool_info["function"])
        
        # Track execution
        self.execution_history.append(tool_call.to_dict())
        
        return {
            "success": success,
            "tool": tool_name,
            "result": tool_call.result,
            "error": tool_call.error
        }
    
    def get_agent_state(self) -> Dict[str, Any]:
        """Get current agent state"""
        return {
            "user_id": self.user_id,
            "state": self.state.value,
            "current_plan": self.current_plan.to_dict() if self.current_plan else None,
            "conversation": self.conversation_context.to_dict(),
            "tools_registered": list(self.tool_registry.keys()),
            "executions": len(self.execution_history),
            "created_at": self.created_at.isoformat()
        }
    
    def reset_conversation(self):
        """Reset conversation context but keep preferences"""
        old_prefs = self.conversation_context.user_preferences.copy()
        self.conversation_context = ConversationContext(self.user_id)
        self.conversation_context.user_preferences = old_prefs
        logger.info(f"🔄 Conversation reset for user {self.user_id}")
    
    async def shutdown(self):
        """Graceful shutdown"""
        logger.info(f"🛑 Shutting down agent for user {self.user_id}")
        self.state = AgentState.IDLE
