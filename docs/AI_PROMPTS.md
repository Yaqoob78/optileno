# Concierge AI – Prompt System

Prompts are file-based and loaded at runtime.

Locations:
- backend/ai/prompts/system/     → system behavior
- backend/ai/prompts/template/   → message templates

Rules:
- Prompts are NOT hardcoded in services
- Context and memory are injected dynamically
- Prompts define behavior, not logic

This allows safe prompt iteration without code changes.
