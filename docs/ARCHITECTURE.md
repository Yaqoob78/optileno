# Concierge AI – Architecture

Concierge AI follows a clean layered architecture:

Frontend
→ API Layer (FastAPI)
→ Services Layer
→ AI Orchestrator
→ Tools (Planner, Analytics)
→ Database

Key principles:
- Services own business logic
- AIClient orchestrates memory, tools, and LLM
- Tools execute side effects asynchronously
- Frontend reacts only to unified AI responses

This architecture is designed to scale without refactors.
