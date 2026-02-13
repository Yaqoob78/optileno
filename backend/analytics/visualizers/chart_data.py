"""
Chart data formatter.

Prepares chart-compatible data structures from analytics events.
Read-only. No random data. No DB access.
"""

from typing import Dict, Any, List


def generate_productivity_chart(events: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Generate productivity chart structure from analytics events.
    Currently returns an empty dataset placeholder.
    """
    return {
        "type": "line",
        "data": {
            "labels": [],
            "datasets": []
        },
        "options": {
            "responsive": True
        }
    }


def generate_stress_chart(events: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Generate stress chart structure from analytics events.
    Placeholder until real mapping logic is added.
    """
    return {
        "type": "bar",
        "data": {
            "labels": [],
            "datasets": []
        },
        "options": {
            "responsive": True
        }
    }


def generate_task_distribution(events: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Generate task distribution chart structure.
    Placeholder only.
    """
    return {
        "type": "doughnut",
        "data": {
            "labels": [],
            "datasets": []
        },
        "options": {
            "responsive": True
        }
    }
