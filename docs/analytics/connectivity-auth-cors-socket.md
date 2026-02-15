# Connectivity, Auth, CORS, and Socket Contract

Last validated against runtime code on 2026-02-15.

## Frontend Environment Resolution
Source: `frontend/src/config/env.ts`

Resolution rules:
1. `rawApiBaseUrl = VITE_API_BASE_URL.trim()`
2. `rawApiUrl = VITE_API_URL.trim()`
3. `rawSocketUrl = VITE_SOCKET_URL.trim()`
4. `API_URL` is forced to end with `/api/v1`.
5. `API_BASE_URL` is origin without `/api/v1` suffix.
6. `SOCKET_URL` defaults to `VITE_SOCKET_URL`, else API origin, else `http://localhost:8000`.

Effective contract:
- HTTP uses `env.API_URL`.
- Socket uses `env.SOCKET_URL` with path `/socket.io`.

## API Client Contract
Source: `frontend/src/services/api/client.ts`

Axios instance defaults:
- `baseURL: env.API_URL`
- `withCredentials: true`
- JSON headers

Request interceptor behavior:
- Adds `X-Request-ID`, `X-Client-Version`, `X-Client-Platform`, `X-Requested-With`.
- For `POST/PUT/PATCH/DELETE`, reads `csrf_token` cookie and sets `X-CSRF-Token`.

Response interceptor behavior:
- Single refresh flow on `401` (`_retry` flag prevents loops).
- Refresh endpoint: `POST {env.API_URL}/auth/refresh` with `withCredentials: true`.
- On refresh failure, user store logout is triggered and `auth:logout` event is dispatched.

## Backend CORS and Cookie Rules
Sources:
- `backend/app/config.py`
- `backend/app/main.py`
- `backend/auth/auth_routes.py`

CORS origin parsing (`_env_list`):
- Accepts comma/newline/semicolon separators.
- Trims items, strips wrapping quotes, removes empty entries, deduplicates.
- In production, canonical origins `https://optileno.com` and `https://www.optileno.com` are ensured.
- Optional `CORS_ALLOW_ORIGIN_REGEX` is supported.

CORS middleware:
- `allow_origins=settings.CORS_ORIGINS`
- `allow_origin_regex=settings.CORS_ALLOW_ORIGIN_REGEX`
- `allow_credentials=True`
- `allow_methods=["*"]`
- `allow_headers=["*"]`

Cookie settings:
- `secure = settings.COOKIE_SECURE`
- `samesite = settings.COOKIE_SAMESITE.lower()`
- optional `domain = settings.COOKIE_DOMAIN`
- auth cookies set:
  - `access_token` on `/`
  - `refresh_token` scoped to `/api/v1/auth/refresh`
  - `csrf_token` non-HttpOnly

## WebSocket Handshake Flow
Sources:
- `frontend/src/services/realtime/socket-client.ts`
- `backend/realtime/socket_manager.py`

Client connection options:
- `path: /socket.io`
- `transports: ['websocket', 'polling']`
- `withCredentials: true`
- reconnection enabled

Handshake sequence:
1. Client opens socket to `env.SOCKET_URL`.
2. Backend `connect` attempts cookie auth using `access_token` cookie.
3. If cookie auth succeeds, backend emits `authenticated`.
4. Client optionally emits `authenticate` with token fallback when token is present.
5. Backend `authenticate` validates token and joins `user_<id>` room.

## Canonical and Legacy Event Names
Source: `backend/realtime/socket_manager.py`

Canonical events:
- `analytics:update`
- `analytics:focus:updated`
- `notification:new`

Legacy aliases (one-release compatibility):
- `analytics:update` -> `analytics:updated`
- `analytics:focus:updated` -> `focus_score_updated`
- `notification:new` -> `notification:received`

## Failure Modes to Watch
1. CORS missing `Access-Control-Allow-Origin`:
- Usually origin not included in `CORS_ORIGINS` and no regex match.
- Can appear as blocked `users/me` in browser despite endpoint existing.

2. Cookie-domain/samesite mismatch:
- Cross-subdomain session cookies require correct secure and samesite setup.
- Production usually expects secure cookies and compatible domain policy.

3. Socket fallback behavior:
- Websocket transport can fail and fall back to polling.
- Client has timeout logic that can resolve connection even if explicit `authenticated` event is delayed.

4. Duplicate analytics listener naming:
- Some frontend code listens to `analytics:updated`; canonical event is `analytics:update`.
- Alias support currently masks this mismatch.
