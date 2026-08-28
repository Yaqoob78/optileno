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


def generate_schedule_generator(
    tasks_text: str,
    start_hour: int = 9,
    work_hours: int = 8,
    audience: str = "operator"
) -> Dict[str, Any]:
    tasks = _split_tasks(tasks_text)
    if not tasks:
        tasks = [
            "Deep focus on primary deliverable",
            "Client / team communications & inbox zero",
            "System refinement & bug fixes",
            "Planning tomorrow's sprint"
        ]

    start_h = max(6, min(14, int(start_hour or 9)))
    duration_h = max(2, min(12, int(work_hours or 8)))

    schedule_slots = []
    current_h = start_h
    current_m = 0

    def format_time(h: int, m: int) -> str:
        suffix = "AM" if h < 12 else "PM"
        disp_h = h if h <= 12 else h - 12
        if disp_h == 0:
            disp_h = 12
        return f"{disp_h:02d}:{m:02d} {suffix}"

    # Morning Focus Block (90-120 min)
    primary_task = tasks[0]
    schedule_slots.append({
        "type": "deep_work",
        "time": f"{format_time(current_h, current_m)} - {format_time(current_h + 1, current_m + 30)}",
        "title": f"Deep Work: {primary_task}",
        "duration_minutes": 90,
        "energy": "High Peak",
        "recommendation": "Turn off notifications. Zero task switching."
    })
    current_h += 1
    current_m += 30

    # Short Recharge Break
    schedule_slots.append({
        "type": "break",
        "time": f"{format_time(current_h, current_m)} - {format_time(current_h, current_m + 15)}",
        "title": "Hydration & Cognitive Reset",
        "duration_minutes": 15,
        "energy": "Recovery",
        "recommendation": "Step away from screens. Hydrate and stretch."
    })
    current_m += 15

    # Secondary Tasks
    for i, t in enumerate(tasks[1:4], start=2):
        task_min = 45 if i < 4 else 30
        end_m = current_m + task_min
        end_h = current_h + (end_m // 60)
        end_m = end_m % 60
        schedule_slots.append({
            "type": "task_sprint",
            "time": f"{format_time(current_h, current_m)} - {format_time(end_h, end_m)}",
            "title": f"Sprint {i}: {t}",
            "duration_minutes": task_min,
            "energy": "Medium",
            "recommendation": "Execute without perfectionism."
        })
        current_h = end_h
        current_m = end_m

    # Daily Shutdown & Wrap-up
    schedule_slots.append({
        "type": "shutdown",
        "time": f"{format_time(current_h, current_m)} - {format_time(current_h, current_m + 20)}",
        "title": "Daily Debrief & Tomorrow Planning",
        "duration_minutes": 20,
        "energy": "Low Reflection",
        "recommendation": "Review completed tasks in Optileno and set tomorrow's top 3."
    })

    return {
        "schedule_theme": f"Energy-Optimized {duration_h}-Hour Time Blocked Schedule",
        "total_focus_minutes": sum(s["duration_minutes"] for s in schedule_slots if s["type"] != "break"),
        "slots": schedule_slots,
        "top_rule": "Protect your 90-minute morning deep work block at all costs.",
        "share_hook": "I generated a time-blocked daily calendar in under 5 seconds with Optileno.",
        "optileno_bridge": "Export this schedule to Google Calendar with 1 click in Optileno.",
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


def generate_burnout_calculator(
    weekly_hours: int = 55,
    daily_context_switches: int = 20,
    weekly_meeting_hours: int = 15,
    sleep_hours: float = 6.5,
    weekend_work: bool = True
) -> Dict[str, Any]:
    hours = max(20, min(100, int(weekly_hours or 50)))
    switches = max(1, min(60, int(daily_context_switches or 15)))
    meetings = max(0, min(40, int(weekly_meeting_hours or 10)))
    sleep = max(3.0, min(12.0, float(sleep_hours or 7.0)))

    # Compute risk score (0-100)
    hour_factor = max(0, (hours - 40) * 1.5)
    switch_factor = min(30, switches * 1.2)
    meeting_factor = min(25, meetings * 1.0)
    sleep_penalty = max(0, (7.5 - sleep) * 8.0)
    weekend_penalty = 15 if weekend_work else 0

    raw_score = hour_factor + switch_factor + meeting_factor + sleep_penalty + weekend_penalty
    risk_score = int(max(10, min(99, raw_score)))

    if risk_score >= 75:
        tier = "Critical Risk"
        color = "#ef4444"
        summary = "Severe cognitive fatigue warning. You are operating in an unsustainable depletion zone."
    elif risk_score >= 50:
        tier = "Moderate Strain"
        color = "#f59e0b"
        summary = "Elevated workload friction. High context switching is fragmenting deep work windows."
    else:
        tier = "Sustainable Velocity"
        color = "#10b981"
        summary = "Healthy pace. Workload and recovery rhythms are balanced."

    recovery_actions = [
        f"Cap daily deep work at 4 hours and defend a sacred 90-minute morning block.",
        f"Batch meeting load into designated afternoons to reduce {switches} daily context switches.",
        f"Institute a hard daily shutdown ritual 60 minutes before bedtime.",
        f"Turn off non-essential notifications during active focus blocks."
    ]

    return {
        "burnout_score": risk_score,
        "tier": tier,
        "color": color,
        "summary": summary,
        "recovery_actions": recovery_actions,
        "metrics_breakdown": {
            "weekly_hours": hours,
            "daily_switches": switches,
            "meeting_hours": meetings,
            "sleep_hours": sleep,
            "weekend_work": weekend_work
        },
        "share_hook": f"My burnout risk score was {risk_score}/100 on Optileno's cognitive telemetry calculator.",
        "optileno_bridge": "Optileno's live burnout telemetry continuously alerts you before cognitive fatigue impacts your output.",
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }

