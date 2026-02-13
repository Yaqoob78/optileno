"""
Intent Parser - Parse user intent from natural language for planner operations
"""

import re
from typing import Dict, List, Optional
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)


class PlannerIntentParser:
    """Parse user intent for planner operations"""

    # Keywords for different operations
    TASK_KEYWORDS = ['create', 'add', 'make', 'new', 'schedule', 'plan', 'task', 'todo', 'work on']
    GOAL_KEYWORDS = ['goal', 'target', 'achieve', 'complete', 'finish', 'accomplish', 'objective']
    HABIT_KEYWORDS = ['habit', 'build', 'develop', 'start', 'track', 'routine', 'daily']
    PRIORITY_KEYWORDS = {'urgent': 'urgent', 'asap': 'urgent', 'high': 'high', 'medium': 'medium', 'low': 'low'}
    DURATION_KEYWORDS = {'hour': 60, 'hr': 60, 'minute': 1, 'min': 1, 'second': 0.017}

    @staticmethod
    def parse_task_creation(user_input: str) -> Optional[Dict]:
        """
        Parse task creation intent from user input
        
        Example inputs:
        - "Create a high priority task for deep work, 2 hours"
        - "Add task: finish report for client #urgent"
        - "New task to review code for 30 minutes"
        
        Returns:
            Dictionary with extracted task data or None
        """
        # Check if this is a task creation intent
        if not any(keyword in user_input.lower() for keyword in PlannerIntentParser.TASK_KEYWORDS):
            return None

        extracted = {'title': None}

        # Extract title using regex
        # Try to find pattern: "task/todo [for/to/is] <title>"
        patterns = [
            r'(?:task|todo|item|work)\s+(?:to|for|is)?:?\s*["\']?([^"\'\.!?,\n]+?)(?:\s+(?:for|duration|in)|\s*[\.,!?]|$)',
            r'(?:add|create|make|new|schedule)\s+(?:a\s+)?(?:task|todo|item)?:?\s*["\']?([^"\'\.!?,\n]+?)(?:\s+(?:for|duration|in|priority)|\s*[\.,!?]|$)',
            r'(?:plan)\s+(?:to\s+)?["\']?([^"\'\.!?,\n]+?)(?:\s+(?:for|duration|in)|\s*[\.,!?]|$)',
        ]

        title = None
        for pattern in patterns:
            match = re.search(pattern, user_input, re.IGNORECASE)
            if match:
                title = match.group(1).strip()
                break

        if not title or len(title) < 2:
            return None

        extracted['title'] = title

        # Extract priority
        for keyword, priority_level in PlannerIntentParser.PRIORITY_KEYWORDS.items():
            if keyword in user_input.lower():
                extracted['priority'] = priority_level
                break

        # Extract duration
        duration_match = re.search(r'(\d+\.?\d*)\s*(hour|hr|minute|min|second)', user_input, re.IGNORECASE)
        if duration_match:
            amount = float(duration_match.group(1))
            unit = duration_match.group(2).lower()
            
            multiplier = PlannerIntentParser.DURATION_KEYWORDS.get(unit, 1)
            minutes = int(amount * multiplier)
            extracted['duration_minutes'] = minutes

        # Extract category
        categories = ['work', 'meeting', 'break', 'health', 'learning', 'routine', 'personal']
        for category in categories:
            if category in user_input.lower():
                extracted['category'] = category
                break

        # Extract tags (words starting with #)
        tags = re.findall(r'#(\w+)', user_input)
        if tags:
            extracted['tags'] = tags

        # Extract energy level
        if 'high energy' in user_input.lower() or 'high-energy' in user_input.lower():
            extracted['energy_level'] = 'high'
        elif 'low energy' in user_input.lower() or 'low-energy' in user_input.lower():
            extracted['energy_level'] = 'low'

        return extracted

    @staticmethod
    def parse_goal_creation(user_input: str) -> Optional[Dict]:
        """
        Parse goal creation intent from user input
        
        Example inputs:
        - "Set goal to learn TypeScript in 60 days"
        - "I want to complete backend refactor"
        - "Target: Ship new feature by end of month"
        
        Returns:
            Dictionary with extracted goal data or None
        """
        # Check if this is a goal creation intent
        if not any(keyword in user_input.lower() for keyword in PlannerIntentParser.GOAL_KEYWORDS):
            return None

        extracted = {'title': None}

        # Extract title
        patterns = [
            r'(?:goal|target|achieve|complete|finish|accomplish)\s+(?:is|to|:|of)?:?\s*["\']?([^"\'\.!?,\n]+?)(?:\s+(?:in|within|by|with)|\s*[\.,!?]|$)',
            r'(?:i\s+want\s+to|get|reach)\s+["\']?([^"\'\.!?,\n]+?)(?:\s+(?:in|within|by)|\s*[\.,!?]|$)',
        ]

        title = None
        for pattern in patterns:
            match = re.search(pattern, user_input, re.IGNORECASE)
            if match:
                title = match.group(1).strip()
                break

        if not title or len(title) < 3:
            return None

        extracted['title'] = title

        # Extract duration/target date
        # Look for: "in X days/weeks/months", "by [date]"
        duration_patterns = [
            r'(?:in|within)\s+(\d+)\s+(?:days?|d)',
            r'(?:in|within)\s+(\d+)\s+(?:weeks?|w)',
            r'(?:in|within)\s+(\d+)\s+(?:months?|m)',
        ]

        for pattern in duration_patterns:
            match = re.search(pattern, user_input, re.IGNORECASE)
            if match:
                amount = int(match.group(1))
                
                if 'week' in pattern:
                    days = amount * 7
                elif 'month' in pattern:
                    days = amount * 30
                else:
                    days = amount

                target_date = (datetime.now() + timedelta(days=days)).date().isoformat()
                extracted['target_date'] = target_date
                break

        # Extract milestones
        # Look for numbered items or "step/phase/stage" keywords
        milestone_pattern = r'(?:step|phase|milestone|stage|part)s?:?\s*([^,\.!?\n]+)'
        milestones = re.findall(milestone_pattern, user_input, re.IGNORECASE)
        if milestones:
            extracted['milestones'] = [m.strip() for m in milestones if m.strip()]

        # Try to extract numbered milestones: "1. X 2. Y 3. Z"
        if not milestones:
            numbered = re.findall(r'\d+\.\s+([^,\n]+)', user_input)
            if numbered:
                extracted['milestones'] = [m.strip() for m in numbered]

        return extracted

    @staticmethod
    def parse_habit_creation(user_input: str) -> Optional[Dict]:
        """
        Parse habit creation intent from user input
        
        Example inputs:
        - "Build a daily meditation habit"
        - "Create habit to read 30 minutes daily"
        - "Start tracking water intake"
        
        Returns:
            Dictionary with extracted habit data or None
        """
        # Check if this is a habit creation intent
        if not any(keyword in user_input.lower() for keyword in PlannerIntentParser.HABIT_KEYWORDS):
            return None

        extracted = {'name': None}

        # Extract habit name
        patterns = [
            r'(?:habit|build|develop|start|create|track)\s+(?:of|to|a|the)?:?\s*["\']?([^"\'\.!?,\n]+?)(?:\s+(?:daily|weekly|monthly|habit)|\s*[\.,!?]|$)',
            r'(?:track|tracking)\s+["\']?([^"\'\.!?,\n]+?)(?:\s*[\.,!?]|$)',
        ]

        name = None
        for pattern in patterns:
            match = re.search(pattern, user_input, re.IGNORECASE)
            if match:
                name = match.group(1).strip()
                break

        if not name or len(name) < 2:
            return None

        extracted['name'] = name

        # Extract frequency
        frequencies = ['daily', 'weekly', 'monthly']
        for freq in frequencies:
            if freq in user_input.lower():
                extracted['frequency'] = freq
                break

        # Extract category
        categories = {
            'wellness': 'Wellness',
            'health': 'Health',
            'fitness': 'Health',
            'exercise': 'Health',
            'learning': 'Learning',
            'read': 'Learning',
            'study': 'Learning',
            'productivity': 'Productivity',
            'work': 'Productivity',
            'focus': 'Productivity',
            'meditation': 'Wellness',
            'yoga': 'Health',
            'sleep': 'Health',
            'hydration': 'Health',
            'water': 'Health'
        }

        for keyword, category in categories.items():
            if keyword in user_input.lower():
                extracted['category'] = category
                break

        return extracted

    @staticmethod
    def parse_status_query(user_input: str) -> Optional[Dict]:
        """
        Parse queries about planner status
        
        Example inputs:
        - "How many tasks do I have?"
        - "What's my productivity score?"
        - "Show me my stats"
        - "How am I doing?"
        
        Returns:
            Dictionary with query type or None
        """
        query_patterns = {
            'productivity': r'(?:productivity|score|productive|performance)',
            'tasks': r'(?:tasks?|todos?|how many|count)',
            'habits': r'(?:habits?|streaks?|consistency)',
            'goals': r'(?:goals?|targets?|progress)',
            'overall': r'(?:how.*doing|stats?|overview|summary)',
        }

        for query_type, pattern in query_patterns.items():
            if re.search(pattern, user_input, re.IGNORECASE):
                return {'query_type': query_type}

        return None

    @staticmethod
    def parse_status_update(user_input: str) -> Optional[Dict]:
        """
        Parse task/goal status updates
        
        Example inputs:
        - "Mark task as complete"
        - "Complete my morning meditation"
        - "Finish the report task"
        
        Returns:
            Dictionary with update info or None
        """
        extracted = {}

        # Check for completion intent
        if any(word in user_input.lower() for word in ['complete', 'done', 'finished', 'mark', 'check']):
            extracted['action'] = 'complete'
        elif any(word in user_input.lower() for word in ['start', 'begin', 'doing']):
            extracted['action'] = 'start'
        elif any(word in user_input.lower() for word in ['cancel', 'skip', 'remove']):
            extracted['action'] = 'cancel'
        else:
            return None

        # Try to extract task/goal/habit name
        pattern = r'(?:task|goal|habit)\s+(?:to\s+)?["\']?([^"\'\.!?,\n]+?)[\'".]?$'
        match = re.search(pattern, user_input, re.IGNORECASE)
        if match:
            extracted['name'] = match.group(1).strip()

        return extracted if extracted.get('action') else None

    @staticmethod
    def parse_user_input(user_input: str) -> Optional[Dict]:
        """
        Main parsing method - determine intent and extract data
        
        Returns:
            Dictionary with intent type and extracted data
        """
        if not user_input or len(user_input.strip()) < 3:
            return None

        # Try parsing in order of likelihood
        
        # Check task creation
        task_data = PlannerIntentParser.parse_task_creation(user_input)
        if task_data:
            return {'type': 'create_task', 'data': task_data}

        # Check goal creation
        goal_data = PlannerIntentParser.parse_goal_creation(user_input)
        if goal_data:
            return {'type': 'create_goal', 'data': goal_data}

        # Check habit creation
        habit_data = PlannerIntentParser.parse_habit_creation(user_input)
        if habit_data:
            return {'type': 'create_habit', 'data': habit_data}

        # Check status queries
        query_data = PlannerIntentParser.parse_status_query(user_input)
        if query_data:
            return {'type': 'query_status', 'data': query_data}

        # Check status updates
        update_data = PlannerIntentParser.parse_status_update(user_input)
        if update_data:
            return {'type': 'update_status', 'data': update_data}

        return None


# Test function
def test_parser():
    """Test the parser with sample inputs"""
    test_inputs = [
        "Create a high priority task for deep work, 2 hours",
        "Add task: finish report for client #urgent",
        "Set goal to learn TypeScript in 60 days with these steps: basics, advanced, project",
        "Build a daily meditation habit",
        "How many tasks do I have today?",
        "Complete my morning meditation habit",
    ]

    for input_text in test_inputs:
        result = PlannerIntentParser.parse_user_input(input_text)
        print(f"\nInput: {input_text}")
        print(f"Result: {result}")


if __name__ == "__main__":
    test_parser()
