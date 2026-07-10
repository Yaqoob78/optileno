from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Any, Dict, List


HIGH_IMPACT_TERMS = {
    "launch",
    "ship",
    "publish",
    "customer",
    "client",
    "user",
    "revenue",
    "payment",
    "checkout",
    "sales",
    "demo",
    "proposal",
    "email",
    "call",
    "signup",
    "register",
    "bug",
    "fix",
    "broken",
    "seo",
    "traffic",
    "deadline",
    "urgent",
}

LOW_LEVERAGE_TERMS = {
    "research",
    "maybe",
    "someday",
    "organize",
    "clean",
    "rename",
    "polish",
    "scroll",
    "watch",
    "read",
}


def _clean_task(value: str) -> str:
    cleaned = re.sub("^\\s*(?:[-*\\u2022]|\\d+[.)\\]])\\s*", "", value or "").strip()
    cleaned = re.sub(r"\s+", " ", cleaned)
    return cleaned[:180]


def _split_tasks(tasks_text: str) -> List[str]:
    raw_parts = re.split(r"[\n;]+", tasks_text or "")
    if len(raw_parts) <= 1:
        raw_parts = re.split(r"(?<=[.!?])\s+", tasks_text or "")

    tasks: List[str] = []
    seen_tasks = set()
    for part in raw_parts:
        cleaned = _clean_task(part)
        normalized = cleaned.lower()
        if len(cleaned) >= 3 and normalized not in seen_tasks:
            tasks.append(cleaned)
            seen_tasks.add(normalized)
        if len(tasks) >= 40:
            break
    return tasks


def _score_task(task: str, index: int) -> Dict[str, Any]:
    words = re.findall(r"[a-z0-9]+", task.lower())
    word_set = set(words)
    impact_hits = sorted(word_set & HIGH_IMPACT_TERMS)
    low_hits = sorted(word_set & LOW_LEVERAGE_TERMS)
    has_date_pressure = bool(re.search(r"\b(today|tomorrow|this week|deadline|asap|urgent|now)\b", task, re.I))
    has_external_pressure = bool(
        re.search(
            r"\b(customer|client|user|payment|checkout|signup|launch|demo|proposal|sales|call)\b",
            task,
            re.I,
        )
    )

    score = 40
    score += len(impact_hits) * 9
    score += 15 if has_date_pressure else 0
    score += 14 if has_external_pressure else 0
    score -= len(low_hits) * 5
    score -= min(18, max(0, len(words) - 14))
    score -= index * 0.5
    score = max(5, min(100, int(round(score))))

    estimated_minutes = 25
    if len(words) > 18:
        estimated_minutes = 60
    elif len(words) > 10:
        estimated_minutes = 45
    if any(term in word_set for term in {"launch", "fix", "payment", "checkout", "bug"}):
        estimated_minutes += 15

    return {
        "task": task,
        "score": score,
        "impact_hits": impact_hits,
        "low_leverage_hits": low_hits,
        "estimated_minutes": min(90, estimated_minutes),
        "reason": _reason_for_task(impact_hits, has_date_pressure, has_external_pressure, low_hits),
    }


def _reason_for_task(
    impact_hits: List[str],
    has_date_pressure: bool,
    has_external_pressure: bool,
    low_hits: List[str],
) -> str:
    if has_external_pressure:
        return "It touches users, revenue, signups, or launch momentum."
    if has_date_pressure:
        return "It has time pressure, so delaying it creates avoidable drag."
    if impact_hits:
        return f"It contains leverage signals: {', '.join(impact_hits[:3])}."
    if low_hits:
        return "It looks lower leverage unless it unblocks a higher priority."
    return "It is clear enough to execute without more planning."


def generate_task_prioritizer(tasks_text: str, audience: str = "founder", work_hours: int = 6) -> Dict[str, Any]:
    tasks = _split_tasks(tasks_text)
    if not tasks:
        return {
            "summary": "Add at least three real tasks to get a useful priority plan.",
            "top_priorities": [],
            "time_blocks": [],
            "not_to_do_today": [],
            "optileno_bridge": "Optileno can turn these priorities into a planner after signup.",
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }

    scored = sorted(
        (_score_task(task, index) for index, task in enumerate(tasks)),
        key=lambda item: item["score"],
        reverse=True,
    )
    top = scored[:3]
    remaining = scored[3:]
    work_minutes = max(60, min(720, int(work_hours or 6) * 60))

    time_blocks = []
    cursor_minutes = 9 * 60
    for index, item in enumerate(top, start=1):
        duration = min(item["estimated_minutes"], max(25, work_minutes // max(3, len(top))))
        start_hour = cursor_minutes // 60
        start_minute = cursor_minutes % 60
        cursor_minutes += duration + 15
        end_hour = cursor_minutes // 60
        end_minute = cursor_minutes % 60
        time_blocks.append(
            {
                "label": f"Block {index}",
                "task": item["task"],
                "time": f"{start_hour:02d}:{start_minute:02d}-{end_hour:02d}:{end_minute:02d}",
                "minutes": duration,
            }
        )

    not_to_do = [
        {
            "task": item["task"],
            "reason": "Lower score than today's top priorities; park it unless it becomes a blocker.",
        }
        for item in sorted(remaining, key=lambda item: item["score"])[:4]
    ]

    return {
        "summary": f"Focus on {len(top)} priority tasks for a {audience or 'founder'} execution day.",
        "top_priorities": [
            {
                "rank": index,
                "task": item["task"],
                "score": item["score"],
                "estimated_minutes": item["estimated_minutes"],
                "why_now": item["reason"],
                "next_action": f"Open a 25-minute focus block and make visible progress on: {item['task']}",
            }
            for index, item in enumerate(top, start=1)
        ],
        "time_blocks": time_blocks,
        "not_to_do_today": not_to_do,
        "focus_rule": "Do priority 1 before opening messages, analytics, or social feeds.",
        "share_hook": "I pasted my messy task list into Optileno and it told me what not to do today.",
        "optileno_bridge": "Create a free Optileno account to turn these priorities into tasks, goals, and focus sessions.",
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


def generate_weekly_planner(goal: str, audience: str = "creator", hours_per_day: int = 2) -> Dict[str, Any]:
    cleaned_goal = re.sub(r"\s+", " ", (goal or "").strip())[:220]
    if not cleaned_goal:
        cleaned_goal = "make meaningful progress on one important project"

    hours = max(1, min(8, int(hours_per_day or 2)))
    phases = [
        ("Clarify the win", "Define the measurable outcome and the smallest useful version."),
        ("Break into tasks", "List the tasks that directly move the goal forward."),
        ("Build the first asset", "Create the first draft, workflow, page, offer, or deliverable."),
        ("Remove blockers", "Fix the issue most likely to stop execution."),
        ("Publish or test", "Put the work in front of users, readers, or customers."),
        ("Measure signal", "Review responses, traffic, replies, signups, or usage."),
        ("Improve and ship again", "Double down on what worked and cut what did not."),
    ]

    days = []
    for index, (focus, metric) in enumerate(phases, start=1):
        days.append(
            {
                "day": index,
                "focus": focus,
                "tasks": [
                    f"Spend {hours} hour{'s' if hours != 1 else ''} on: {cleaned_goal}",
                    f"Create one visible artifact for '{focus.lower()}'.",
                    "Write a 3-line update describing what changed.",
                ],
                "focus_block_minutes": min(180, hours * 50),
                "success_metric": metric,
                "avoid": "Do not add a second goal unless today's artifact is complete.",
            }
        )

    return {
        "weekly_theme": f"Make visible progress on: {cleaned_goal}",
        "audience": audience or "creator",
        "days": days,
        "review_questions": [
            "What created the most visible progress?",
            "What task looked useful but did not move the goal?",
            "What should become a recurring Optileno task next week?",
        ],
        "share_hook": "I turned one goal into a 7-day execution plan with Optileno.",
        "optileno_bridge": "Save this plan in Optileno to track tasks, focus blocks, and goal progress.",
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }
