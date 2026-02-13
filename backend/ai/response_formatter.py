"""
AI Response Formatter - Ensures consistent, user-friendly responses
and prevents raw JSON outputs to users.
"""

import json
import logging
from typing import Dict, Any, List
from datetime import datetime

logger = logging.getLogger(__name__)

class AIResponseFormatter:
    """Formats AI responses to be user-friendly and prevents JSON dumps"""
    
    @staticmethod
    def format_creation_response(
        action_type: str,
        result: Dict[str, Any],
        is_confirmation: bool = False
    ) -> str:
        """Format task/habit/goal creation responses"""
        
        if not result or result.get("error"):
            return f"❌ I couldn't create the {action_type.lower()}. Please try again."
        
        # Extract meaningful information
        title = result.get("title") or result.get("name") or "Untitled"
        message = result.get("message", "")
        
        # Build user-friendly response
        if is_confirmation:
            response = f"✅ **{action_type} Created Successfully!**\n\n"
            response += f"📝 **{title}**\n"
            
            # Add relevant details based on type
            if action_type == "TASK":
                priority = result.get("priority", "medium")
                due_date = result.get("due_date")
                category = result.get("category", "work")
                
                response += f"🎯 **Priority:** {priority.capitalize()}\n"
                response += f"📂 **Category:** {category.capitalize()}\n"
                if due_date:
                    response += f"⏰ **Due:** {due_date}\n"
                    
            elif action_type == "HABIT":
                frequency = result.get("frequency", "daily")
                category = result.get("category", "Wellness")
                
                response += f"🔄 **Frequency:** {frequency.capitalize()}\n"
                response += f"📂 **Category:** {category}\n"
                
            elif action_type == "GOAL":
                category = result.get("category", "Personal")
                target_date = result.get("target_date")
                
                response += f"📂 **Category:** {category}\n"
                if target_date:
                    response += f"🎯 **Target Date:** {target_date}\n"
            
            # Add success message if available
            if message and message != f"{action_type} '{title}' created successfully":
                response += f"\n💬 {message}"
                
        else:
            # Suggestion format (requires confirmation)
            response = f"🤔 **I suggest creating this {action_type.lower()}:**\n\n"
            response += f"📝 **{title}**\n"
            
            # Add key details
            if action_type == "TASK":
                priority = result.get("priority", "medium")
                response += f"🎯 **Priority:** {priority.capitalize()}\n"
                
            elif action_type == "HABIT":
                frequency = result.get("frequency", "daily")
                response += f"🔄 **Frequency:** {frequency.capitalize()}\n"
            
            response += f"\nWould you like me to create this {action_type.lower()}? Just say 'yes' or 'confirm'!"
        
        return response
    
    @staticmethod
    def format_analytics_insight(insight_data: Dict[str, Any]) -> str:
        """Format analytics insights for user consumption"""
        
        if not insight_data:
            return "📊 I don't have enough data to provide insights yet. Keep using the app and check back soon!"
        
        response = "📊 **Your Analytics Insights**\n\n"
        
        # Productivity insights
        if "productivity_score" in insight_data:
            score = insight_data["productivity_score"]
            trend = insight_data.get("productivity_trend", "stable")
            response += f"🚀 **Productivity Score:** {score}/100\n"
            response += f"📈 **Trend:** {trend.capitalize()}\n\n"
        
        # Focus insights
        if "focus_score" in insight_data:
            score = insight_data["focus_score"]
            response += f"🎯 **Focus Score:** {score}/100\n"
            
            if "focus_patterns" in insight_data:
                patterns = insight_data["focus_patterns"]
                if patterns.get("best_time"):
                    response += f"⏰ **Best Focus Time:** {patterns['best_time']}\n"
                if patterns.get("average_session"):
                    response += f"⏱️ **Avg Session:** {patterns['average_session']} minutes\n"
            response += "\n"
        
        # Goal progress
        if "goal_progress" in insight_data:
            goals = insight_data["goal_progress"]
            if goals:
                response += "🎯 **Goal Progress:**\n"
                for goal in goals[:3]:  # Show top 3
                    response += f"• {goal.get('title', 'Untitled')}: {goal.get('progress', 0)}%\n"
                response += "\n"
        
        # Recommendations
        if "recommendations" in insight_data:
            response += "💡 **Recommendations:**\n"
            for rec in insight_data["recommendations"][:3]:
                response += f"• {rec}\n"
        
        return response
    
    @staticmethod
    def format_goal_progress_update(goal_data: Dict[str, Any]) -> str:
        """Format real-time goal progress updates"""
        
        title = goal_data.get("title", "Untitled")
        progress = goal_data.get("progress", 0)
        previous_progress = goal_data.get("previous_progress", 0)
        
        # Calculate change
        change = progress - previous_progress
        change_emoji = "📈" if change > 0 else "📉" if change < 0 else "➡️"
        
        response = f"🎯 **Goal Progress Update**\n\n"
        response += f"📝 **{title}**\n"
        response += f"📊 **Progress:** {progress}%\n"
        
        if change != 0:
            response += f"{change_emoji} **Change:** {change:+d}%\n"
        
        # Add milestone notification if applicable
        if progress >= 25 and previous_progress < 25:
            response += "🎉 **Quarter Milestone Reached!**\n"
        elif progress >= 50 and previous_progress < 50:
            response += "🎊 **Halfway There!**\n"
        elif progress >= 75 and previous_progress < 75:
            response += "🔥 **75% Complete!**\n"
        elif progress >= 100 and previous_progress < 100:
            response += "🏆 **Goal Completed! Congratulations!**\n"
        
        return response
    
    @staticmethod
    def sanitize_response(response_text: str) -> str:
        """
        Remove raw JSON and technical artifacts from responses while preserving Markdown.
        Uses a robust stack-based approach to identify and remove JSON blocks.
        """
        import re

        # 1. Remove Markdown Code Blocks (e.g. ```json ... ```)
        # We do this first because they are easy to identify
        # Handle inline blocks where newlines might be missing or collapsed
        response_text = re.sub(r'```(?:\s*json)?.*?```', '', response_text, flags=re.DOTALL | re.IGNORECASE)

        # 2. Stack-Based JSON Removal
        # This handles nested objects/arrays that regex struggles with.
        # We look for the outermost { ... } or [ ... ] and remove them if they look like JSON data.
        
        def remove_json_structures(text):
            # We will rebuild text without the JSON parts
            output = []
            i = 0
            n = len(text)
            
            while i < n:
                char = text[i]
                
                # Check for start of potential JSON object/array
                if char in ('{', '['):
                    # Attempt to parse this block to see if it's valid JSON-like structure
                    stack = [char]
                    j = i + 1
                    is_in_string = False
                    string_char = None
                    
                    while j < n and stack:
                        c = text[j]
                        
                        # Handle strings (ignore braces inside strings)
                        if c in ('"', "'") and (j == 0 or text[j-1] != '\\'):
                            if not is_in_string:
                                is_in_string = True
                                string_char = c
                            elif c == string_char:
                                is_in_string = False
                                string_char = None
                        
                        if not is_in_string:
                            if c == '{' or c == '[':
                                stack.append(c)
                            elif c == '}' or c == ']':
                                if not stack:
                                    break # Should not happen if logic is correct
                                last = stack[-1]
                                if (c == '}' and last == '{') or (c == ']' and last == '['):
                                    stack.pop()
                                else:
                                    # Mismatched braces - probably not JSON or broken JSON
                                    # We treat it as normal text
                                    break
                        j += 1
                    
                    if not stack:
                        # We found a complete block from i to j-1
                        block = text[i:j]
                        # Heuristic: Is this likely to be an API payload or a JSON object dump?
                        # Check if it has quoted keys (e.g. "key":)
                        if '"' in block and ':' in block:
                             # It has quotes and colons, likely JSON.
                             # We can try to be safer by checking if it parses as JSON? 
                             # Or just trust that we identified a block.
                             
                             # Let's check for at least ONE quoted key pattern like "key":
                             import re
                             if re.search(r'"[^"]+"\s*:', block):
                                 # It has a JSON-key structure. Remove it.
                                 i = j
                                 continue
                
                # If not skipped, append current char
                output.append(char)
                i += 1
            
            return "".join(output)

        cleaned_text = remove_json_structures(response_text)

        # 3. Cleanup Residual Artifacts
        artifacts_to_remove = [
            r'"intent":\s*"[^"]*"',
            r'"actions":\s*\[[^\]]*\]',
            r'"payload":\s*\{[^}]*\}',
            r'"requires_confirmation":\s*(true|false)', 
            r'undefined',
            r'null',
            r'NaN'
        ]
        
        for artifact in artifacts_to_remove:
            cleaned_text = re.sub(artifact, '', cleaned_text, flags=re.IGNORECASE)

        # 4. Fix Formatting (Preserve Markdown)
        # Remove multiple empty lines but KEEP single newlines for lists/paragraphs
        cleaned_text = re.sub(r'\n{3,}', '\n\n', cleaned_text)
        cleaned_text = cleaned_text.strip()
        
        return cleaned_text
    
    @staticmethod
    def format_error_response(error: str, context: str = "") -> str:
        """Format error responses in a user-friendly way"""
        
        friendly_errors = {
            "Failed to create task": "I couldn't create the task. Please check the details and try again.",
            "Failed to create habit": "I couldn't create the habit. Please check the details and try again.",
            "Failed to create goal": "I couldn't create the goal. Please check the details and try again.",
            "User not found": "There was an issue with your account. Please try logging in again.",
            "Invalid input": "The information provided wasn't quite right. Could you clarify?",
            "Database error": "There's a temporary issue with the system. Please try again in a moment.",
        }
        
        # Check for known error patterns
        for error_pattern, friendly_message in friendly_errors.items():
            if error_pattern.lower() in error.lower():
                return f"❌ {friendly_message}"
        
        # Default error message
        if context:
            return f"❌ Something went wrong while {context}. Please try again."
        else:
            return "❌ Something went wrong. Please try again."
    
    @staticmethod
    def format_deep_work_suggestion(session_data: Dict[str, Any]) -> str:
        """Format deep work session suggestions"""
        
        duration = session_data.get("duration_minutes", 25)
        focus_goal = session_data.get("focus_goal", "Focus on priority tasks")
        best_time = session_data.get("suggested_time", "now")
        
        response = f"🧘 **Deep Work Session Suggestion**\n\n"
        response += f"⏱️ **Duration:** {duration} minutes\n"
        response += f"🎯 **Focus Goal:** {focus_goal}\n"
        response += f"⏰ **Best Time:** {best_time}\n\n"
        response += "This would be a great time for focused work. Would you like me to start this session?"
        
        return response

# Global formatter instance
response_formatter = AIResponseFormatter()
