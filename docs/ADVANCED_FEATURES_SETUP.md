# Advanced Features Setup Guide

This document provides instructions for setting up and using the new advanced features added to Concierge AI.

## Overview

### New Features Implemented

#### 1. **AI Agent Orchestration** ✨
- **Purpose**: Multi-mode AI assistant with planning, analysis, and task management
- **Location**: `backend/ai/agent.py`
- **Key Classes**: `AgentOrchestrator`, `AgentPlan`, `ConversationContext`

**Endpoints**:
```
POST /api/v1/agent/message
GET /api/v1/agent/state
```

**Usage Example**:
```python
# Send message to AI agent in planning mode
curl -X POST http://localhost:8000/api/v1/agent/message \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Help me plan my product launch",
    "mode": "PLAN"
  }'
```

**Available Modes**:
- `CHAT` - Natural conversation
- `PLAN` - Structured planning with steps
- `ANALYZE` - Data analysis and insights
- `TASK` - Task generation and recommendations

---

#### 2. **Advanced Analytics** 📊
- **Purpose**: Predictive analytics with trajectory forecasting and performance scoring
- **Location**: `backend/analytics/forecast.py`
- **Key Classes**: `TimeSeriesAnalyzer`, `TrajectoryForecaster`, `PerformanceScorer`

**Endpoints**:
```
POST /api/v1/analytics/forecast
POST /api/v1/analytics/goal-achievement
GET /api/v1/analytics/performance-score
GET /api/v1/analytics/wellness-score
```

**Usage Example - Forecast**:
```python
curl -X POST http://localhost:8000/api/v1/analytics/forecast \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "metric_type": "productivity",
    "days_ahead": 7
  }'

# Response:
{
  "metric": "productivity",
  "forecast": {
    "predicted_value": 85.5,
    "lower_bound": 78.2,
    "upper_bound": 92.8,
    "confidence": 0.92
  }
}
```

**Usage Example - Goal Achievement**:
```python
curl -X POST http://localhost:8000/api/v1/analytics/goal-achievement \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "current_value": 75,
    "goal_value": 90,
    "target_days": 30
  }'

# Response:
{
  "will_achieve": true,
  "estimated_days": 28,
  "confidence": 0.87,
  "recommendation": "On track to achieve goal"
}
```

---

#### 3. **Notifications System** 🔔
- **Purpose**: Multi-channel notifications (in-app, push, email)
- **Location**: `backend/services/notification_service.py`
- **Key Classes**: `NotificationService`, `Notification`, `NotificationPreferences`

**Endpoints**:
```
GET /api/v1/notifications
POST /api/v1/notifications/{notification_index}/read
PUT /api/v1/notifications/preferences
```

**Notification Types**:
- `TASK_CREATED` - New task created
- `TASK_COMPLETED` - Task marked complete
- `DEEP_WORK_REMINDER` - Time for deep work
- `ACHIEVEMENT` - Achievement unlocked
- `GOAL_MILESTONE` - Goal milestone reached
- `INSIGHT_GENERATED` - New insight available
- `TASK_SHARED` - Task shared with you
- `COLLABORATION_UPDATE` - Collaboration activity
- `SYSTEM_ALERT` - System notifications

**Usage Example - Get Notifications**:
```python
curl -X GET "http://localhost:8000/api/v1/notifications?unread_only=true&limit=50" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Response:
{
  "notifications": [
    {
      "id": "notif_123",
      "type": "ACHIEVEMENT",
      "title": "Productivity Master",
      "message": "Completed 10 tasks in one day!",
      "priority": "HIGH",
      "read": false,
      "created_at": "2024-01-20T10:30:00Z"
    }
  ],
  "unread_count": 5
}
```

**Usage Example - Update Preferences**:
```python
curl -X PUT http://localhost:8000/api/v1/notifications/preferences \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "quiet_hours_start": "22:00",
    "quiet_hours_end": "08:00",
    "enabled": true
  }'
```

---

#### 4. **Collaboration System** 👥
- **Purpose**: Task sharing, permissions, comments, real-time sessions
- **Location**: `backend/services/collaboration_service.py`
- **Key Classes**: `CollaborationService`, `TaskShare`, `TaskComment`

**Endpoints**:
```
POST /api/v1/tasks/share
GET /api/v1/tasks/shared-with-me
POST /api/v1/tasks/{task_id}/comments
GET /api/v1/tasks/{task_id}/comments
GET /api/v1/collaboration/stats
```

**Permission Levels**:
- `VIEW` - Read-only access
- `EDIT` - Modify task
- `COMMENT` - Add comments
- `DELETE` - Delete task
- `SHARE` - Share with others

**Usage Example - Share Task**:
```python
curl -X POST http://localhost:8000/api/v1/tasks/share \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "task_id": "task_123",
    "shared_with_user_id": 45,
    "permissions": ["view", "comment", "edit"],
    "message": "Check this out!"
  }'

# Response:
{
  "share_id": "share_456",
  "task_id": "task_123",
  "shared_with_id": 45,
  "permissions": ["VIEW", "COMMENT", "EDIT"],
  "created_at": "2024-01-20T10:30:00Z"
}
```

**Usage Example - Add Comment**:
```python
curl -X POST http://localhost:8000/api/v1/tasks/task_123/comments \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Great progress! Let\''s discuss next steps.",
    "parent_comment_id": null
  }'
```

---

## Mobile App Setup

### Prerequisites
- Node.js 16+
- Xcode (for iOS) or Android Studio (for Android)

### Installation

```bash
cd mobile

# Install dependencies
npm install

# Setup environment
cp .env.example .env

# Configure your API URL
# Edit .env: EXPO_PUBLIC_API_URL=http://your-backend:8000
```

### Development

```bash
# Start development server
npm start

# Run on iOS simulator
npm run ios

# Run on Android emulator
npm run android
```

### Features Included

- ✅ Real-time Socket.IO integration
- ✅ Offline operation with auto-sync
- ✅ Multi-mode AI chat
- ✅ Task management
- ✅ Deep work sessions
- ✅ Analytics dashboard
- ✅ Collaboration features
- ✅ Push notifications
- ✅ Dark theme (Material Design 3)

### Key Services

**RealtimeService** - WebSocket management
```typescript
import { RealtimeService } from './services/RealtimeService';

RealtimeService.connect();
RealtimeService.on('task:completed', (data) => {
  console.log('Task completed:', data);
});
```

**OfflineSyncManager** - Offline queue
```typescript
import { OfflineSyncManager } from './services/OfflineSyncManager';

// Automatically queues when offline
OfflineSyncManager.queueOperation('create', 'tasks', taskData);

// Auto-syncs when connection restored
OfflineSyncManager.startPeriodicSync(5 * 60 * 1000);
```

**AuthService** - Authentication
```typescript
import { AuthService } from './services/AuthService';

const response = await AuthService.login({ email, password });
const user = await AuthService.getCurrentUser();
```

---

## Integration Checklist

- [x] Backend AI agent system
- [x] Backend analytics system
- [x] Backend notification service
- [x] Backend collaboration service
- [x] API endpoints for all features
- [x] React Native mobile app structure
- [x] Mobile real-time service
- [x] Mobile offline sync
- [x] Mobile authentication
- [ ] Database migrations
- [ ] Real-time broadcasting
- [ ] Email service integration (SendGrid)
- [ ] Push notification integration (Firebase)
- [ ] Frontend UI components
- [ ] Comprehensive testing

---

## Database Migrations

Before running the app, you need to create database tables for new features:

```bash
# Generate migrations
alembic revision --autogenerate -m "Add advanced features tables"

# Review the generated migration file
# Then apply migrations
alembic upgrade head
```

**Required Tables**:
- `notifications` - Notification records
- `notification_preferences` - User preferences
- `task_shares` - Task sharing records
- `task_comments` - Comment threads
- `collaboration_sessions` - Active sessions
- `agent_conversations` - Chat history

---

## Real-time Broadcasting

To enable real-time updates, integrate with Socket.IO:

```python
# In your API endpoints
from backend.realtime import socketio

# Broadcast task update
socketio.emit('task:updated', {
    'task_id': task.id,
    'status': task.status,
    'updated_at': task.updated_at.isoformat()
})

# Broadcast collaboration event
socketio.emit('collaboration:shared', {
    'task_id': task_id,
    'shared_by': user_id,
    'shared_with': recipient_id
})
```

---

## Email & Push Notifications

### SendGrid (Email)

```bash
# Install SendGrid
pip install sendgrid

# Set environment variable
export SENDGRID_API_KEY="your-api-key"
```

Update `backend/services/notification_service.py`:
```python
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail

async def _deliver_email(self, notification: Notification):
    sg = SendGridAPIClient(os.environ.get('SENDGRID_API_KEY'))
    
    message = Mail(
        from_email='noreply@concierge.ai',
        to_emails=notification.recipient_email,
        subject=notification.title,
        html_content=notification.message
    )
    
    sg.send(message)
```

### Firebase (Push Notifications)

```bash
# Install Firebase Admin SDK
pip install firebase-admin

# Set environment variable
export GOOGLE_APPLICATION_CREDENTIALS="path/to/service-account.json"
```

Update `backend/services/notification_service.py`:
```python
import firebase_admin
from firebase_admin import messaging

async def _deliver_push(self, notification: Notification):
    message = messaging.Message(
        notification=messaging.Notification(
            title=notification.title,
            body=notification.message
        ),
        token=user_fcm_token
    )
    
    messaging.send(message)
```

---

## Testing

```bash
# Backend tests
pytest backend/tests/

# Mobile tests
cd mobile
npm test

# Type checking
npm run type-check
```

---

## Deployment

### Backend
```bash
# Docker
docker-compose up -d

# Manual
python -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000
```

### Mobile
```bash
# iOS
npm run build:ios

# Android
npm run build:android
```

---

## Troubleshooting

### Agent not responding
- Check that `backend/ai/agent.py` is imported correctly
- Verify token is being passed to endpoint
- Check logs for errors in `/logs`

### Analytics not forecasting
- Ensure historical data exists (need at least 30 data points)
- Check data format in `TimeSeriesAnalyzer`
- Verify metric type is valid

### Notifications not sending
- Set up email/push services first
- Check notification preferences for user
- Verify quiet hours setting
- Check service keys in environment

### Mobile sync not working
- Check `API_BASE_URL` in `.env`
- Verify backend is accessible from device/emulator
- Check offline queue in AsyncStorage
- Review `OfflineSyncManager` logs

---

## Next Steps

1. **Database Setup** - Run migrations to create tables
2. **Service Integration** - Configure email (SendGrid) and push (Firebase)
3. **Frontend UI** - Build React components for new features
4. **Testing** - Write comprehensive test suite
5. **Deployment** - Deploy mobile and backend to production

For more info, see [README.md](../README.md)
