# Concierge AI – API Overview

Base URL:

Core endpoints:
- POST /chat        → AI interaction
- POST /plans       → Planner actions
- GET  /analytics   → Dashboard & insights
- POST /auth/login  → Authentication
- POST /auth/register

All AI responses follow a unified contract:
- message
- intent
- actions
- ui
- data

The frontend never calls planner or analytics directly.
