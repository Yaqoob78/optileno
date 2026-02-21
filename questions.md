# Planner & Analytics Refactor Clarifications & Questions

Based on the audit of the planner and analytics systems, I've noted the following ambiguity points, risky assumptions, and concerns regarding bug/logic during the normalization process.

## 1. Task Status Vocabulary
Currently, the codebase uses a mix of task statuses (`pending`, `todo`, `planned`, `in-progress`, `completed`, `done`).
- **Risky Assumption**: I will map everything to a single canonical list: `todo`, `in-progress`, `done`. 
- **Question**: Are there any legacy AI prompts or backend endpoints that strictly depend on `pending` or `planned` instead of `todo` or `in-progress`? If they exist, I will normalize them as well, but this is a critical integration point.

## 2. Server-Derived Timing Behavior
The goal is to move timing authority to "Server First". The backend computes effective states based on Server UTC + stored timezone at read time, while the frontend solely displays that state and maintains client-side visual countdowns for deep work.
- **Ambiguity**: Should the frontend periodically poll the backend to sync task / deep work timing boundaries (e.g., auto-transitioning a task to "Overdue" when the clock crosses midnight locally), or should it strictly only show the backend values as of the last page load/refresh/socket event?
- **Assumption**: I will rely on realtime socket events for push updates and local page load state. The frontend should not auto-mutate the status locally without backend confirmation.

## 3. Analytics Heuristics vs. Backend Truth
The instruction dictates "Data-Only" analytics with V3 score endpoints as truth, removing misleading local heuristics (e.g., local 50/60 base scores or fallback values).
- **Bug/Logic Concern**: If the backend does not have sufficient data for a user to calculate meaningful scores for focus, burnout, or productivity, what should the explicit "insufficient data" state look like? 
- **Assumption**: I will display explicit empty states or `N/A` masks in the UI and disable any fallback mathematical heuristics in `analytics.store.ts`.

## 4. Modal Overlap & CSS Refactor
The intent is to scope modal styles strictly per-module using the shared `Modal.tsx` and Radix/Tailwind to remove conflicting legacy selectors (e.g., `planner.css`, `HabitTracker.css`, `GoalTimeline.css`).
- **Concern**: Removing global modal CSS selectors might break external parts of the app that haven't been migrated to Radix/Tailwind modalities yet but still rely on those global selectors inadvertently.
- **Assumption**: I will only scope or remove specific form-level modal classes clearly meant for Task/Habit/Goal/DeepWork that were directly replaced by `Modal.tsx`.

## 5. Random Key Fallbacks
Using `Math.random()` as IDs causes unstable rendering in React.
- **Question**: When a task or sub-item doesn't have an ID from the backend yet (e.g., during optimistic UI updates), what is the preferred fallback? Should we use a generated stable UUID (`crypto.randomUUID()`) or disable optimistic updates until the server responds?
- **Assumption**: Given the "Server First" strategy, optimistic updates are slightly risky. I will ensure we use robust UUIDs for temporary keys if necessary, but prioritize relying on real IDs returned from the backend creation endpoint.
