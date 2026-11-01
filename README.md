# Real-time Chat Server

WebSocket chat with rooms, message history and live presence.

![CI](https://github.com/Dhagash1206/realtime-chat-django/actions/workflows/ci.yml/badge.svg)

**Backend:** Django 5.2 LTS · Django REST Framework · Channels · Uvicorn · PostgreSQL · Redis
**Frontend:** React 18 · Vite 8 · Tailwind CSS (in `frontend/`), served by nginx in production

## Architecture

```
browser ──► nginx ──┬─ /            React build (static, cached)
                    ├─ /api, /admin, /static ─► Django (Uvicorn workers)
                    └─ /ws  (WebSocket upgrade) ─► Django Channels
                                                     │
                                  PostgreSQL ◄───────┤ users, rooms, messages, presence
                                  Redis      ◄───────┘ channel layer (broadcasts), throttle cache
```

- **Broadcasting:** each room is a Channels group on the Redis channel layer, so any number of workers/replicas share messages.
- **Presence:** one `Connection` row per open socket; a user is online while they have at least one. Multiple tabs don't duplicate join/leave events.
- **Release step:** `migrate` runs as a one-off container before `web` starts, and clears stale presence rows.
- **Known limitation:** if a worker process is killed outright (OOM, `SIGKILL`), its sockets' presence rows remain until the next release. Crashes inside the app are cleaned up immediately.

## Development

```bash
cp .env.example .env
docker compose up --build
docker compose exec web python manage.py seed_demo   # users alice/bob/charlie, password = DEMO_PASSWORD
```

- App (Vite, hot reload): http://localhost:5173
- API / admin: http://localhost:8000 (`docker compose exec web python manage.py createsuperuser`)
- After changing `frontend/package.json`, run `docker compose up -d --build -V frontend` (`-V` refreshes the container's `node_modules` volume)

## Tests

```bash
docker compose exec web pytest
```

API, auth, throttling, token expiry, WebSocket tickets, health, and WebSocket flows (presence, multi-tab, malformed frames, rate limiting, crash cleanup). CI runs the tests, a migrations check, `pip-audit` and `npm audit`, the frontend build and the production image builds on every push.

## Dependencies

Top-level versions live in `requirements.txt` / `requirements-dev.txt`; `constraints.txt` pins every transitive package so builds are reproducible. After editing a requirements file, regenerate it with the command at the top of `constraints.txt`.

## Production

```bash
cp .env.prod.example .env.prod      # set secret key, hosts, DB password
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml exec web python manage.py createsuperuser
```

nginx listens on `HTTP_PORT` (default 80). Terminate TLS in front of it (load balancer, Caddy, Cloudflare) and forward `X-Forwarded-Proto`; Django then enforces HTTPS redirects and secure cookies (`DJANGO_HTTPS=1`). Enable `DJANGO_HSTS_SECONDS` once HTTPS is confirmed.

**Client IPs behind a load balancer:** nginx ignores client-supplied `X-Forwarded-For` (otherwise anyone could fake an IP to dodge rate limits). If a load balancer sits in front, set `TRUSTED_PROXY_CIDR` to its address range so the real client IP is used; without it, every user shares the balancer's IP and its rate-limit budget:

```bash
HTTP_PORT=80 TRUSTED_PROXY_CIDR=10.0.0.0/16 docker compose -f docker-compose.prod.yml up -d --build
```

Health checks: `GET /healthz` (nginx) and `GET /api/health/` (database + Redis, returns 503 if either is down).

### Security & hardening

- `DEBUG` off by default; the app refuses to start without `DJANGO_SECRET_KEY`
- Django 5.2 LTS with every dependency pinned and audited in CI
- Auth tokens expire (`AUTH_TOKEN_TTL_SECONDS`, default 7 days); logout revokes them server-side
- WebSockets authenticate with single-use tickets that expire in 30s, so long-lived tokens never appear in URLs or access logs
- Login/registration: passwords used exactly as typed, case-insensitive unique usernames, password-similarity checks
- Rate limits: login/register 10/min, API 60/min anonymous and 600/min per user (Redis-backed, shared across workers, keyed on the real client IP); WebSocket max 10 messages / 5s per socket and 64 KB per frame
- Django password validators; message length capped at 2000 chars
- nginx: strict CSP (no inline scripts or styles), `X-Frame-Options`, `nosniff`, Referrer/Permissions policies, hidden server version; re-resolves the backend so restarts don't cause 502s
- The Django container runs as a non-root user; all containers have health checks; `seed_demo` refuses to run with DEBUG off

### Scaling

Raise `WEB_CONCURRENCY` (Uvicorn workers per container) or run more `web` replicas (`--scale web=3`); Redis and PostgreSQL keep state consistent across them, and nginx picks up new replicas via DNS within 10s.

## REST API (`Authorization: Token <key>`)

| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/register/` | `{username, password}` → `{token, user}` |
| POST | `/api/auth/login/` | `{username, password}` → `{token, user}` |
| POST | `/api/auth/logout/` | Revoke current token |
| POST | `/api/auth/ws-ticket/` | Single-use WebSocket ticket, valid 30s → `{ticket, expires_in}` |
| GET | `/api/users/me/` | Current user |
| GET | `/api/users/online/` | Users connected to any room |
| GET/POST | `/api/rooms/` | List / create rooms (`{name}`) |
| GET | `/api/rooms/<id>/messages/?limit=50&before_id=<id>` | Message history (paginated backwards) |
| GET | `/api/rooms/<id>/online/` | Users connected to the room |
| GET | `/api/health/` | Database + Redis status |

## WebSocket

1. Get a ticket: `POST /api/auth/ws-ticket/` (with `Authorization: Token <key>`)
2. Connect within 30s: `wss://<host>/ws/rooms/<room_id>/?ticket=<ticket>` (a ticket works once; get a new one to reconnect)
3. Send: `{"content": "hello"}`

Non-browser clients must send an `Origin` header matching `DJANGO_ALLOWED_HOSTS`.

Receive:
- `{"type": "presence", "online_users": [...]}` on connect
- `{"type": "message", "message": {id, room, user, content, created_at}}`
- `{"type": "user_joined" | "user_left", "user": {...}, "online_users": [...]}`
- `{"type": "error", "detail": "..."}` (validation, rate limit, binary frame, or delivery failure; the socket stays open)

Missing/used/expired ticket, bad origin or unknown room → handshake rejected (HTTP 403). Frames over 64 KB close the socket (code 1009).
