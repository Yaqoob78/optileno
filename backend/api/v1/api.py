from fastapi import APIRouter
from backend.auth import auth_router
from backend.api.v1.endpoints import chat, plans, analytics, system as system_endpoint, advanced_features, goals, subscriptions, agentic, health
from backend.payments.razorpay_routes import router as razorpay_router
from backend.payments.webhooks import router as webhook_router
from backend.api.v1.endpoints import legal

api_router = APIRouter()

# Include all endpoint routers
api_router.include_router(auth_router, prefix="/auth", tags=["Authentication"])
api_router.include_router(razorpay_router, tags=["Payments"])  # Prefix is already /payments in the router
api_router.include_router(webhook_router, prefix="/webhooks", tags=["Webhooks"])
api_router.include_router(legal.router, tags=["Legal"])  # Prefix is already /legal in the router
api_router.include_router(chat.router, prefix="/chat", tags=["Chat"])
api_router.include_router(plans.router, prefix="/plans", tags=["Plans"])
api_router.include_router(goals.router, prefix="/goals", tags=["Goals"])
api_router.include_router(analytics.router, prefix="/analytics", tags=["Analytics"])
api_router.include_router(health.router, tags=["Health"])
api_router.include_router(system_endpoint.router, prefix="/system", tags=["System"])
api_router.include_router(advanced_features.router, tags=["Advanced Features"])
api_router.include_router(subscriptions.router, prefix="/subscriptions", tags=["Subscriptions"])
api_router.include_router(agentic.router, prefix="/agentic", tags=["Agentic"])

from backend.api.v1.endpoints import users
api_router.include_router(users.router, prefix="/users", tags=["Users"])
