# Real-time Chat Server (Django + Channels)

WebSocket chat with rooms, message history and online presence.

**Backend:** Django 5 · Django REST Framework · Channels (Daphne) · PostgreSQL · Redis

**Frontend:** React 18 · Vite · Tailwind CSS (in `frontend/`)

## Run

```bash
cp .env.example .env        # then set DJANGO_SECRET_KEY
docker compose up --build
```

- App: http://localhost:5173/ (Vite proxies `/api` and `/ws` to Django)
- Demo data: `docker compose exec web python manage.py seed_demo` (users alice/bob/charlie, password = `DEMO_PASSWORD`)
- Admin: http://localhost:8000/admin/ (`docker compose exec web python manage.py createsuperuser`)

## REST API (`Authorization: Token <key>`)

| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/register/` | `{username, password}` → `{token, user}` |
| POST | `/api/auth/login/` | `{username, password}` → `{token, user}` |
| GET | `/api/users/me/` | Current user |
| GET | `/api/users/online/` | Users connected to any room |
| GET/POST | `/api/rooms/` | List / create rooms (`{name}`) |
| GET | `/api/rooms/<id>/messages/?limit=50&before_id=<id>` | Message history (paginated backwards) |
| GET | `/api/rooms/<id>/online/` | Users connected to the room |

## WebSocket

Connect: `ws://localhost:8000/ws/rooms/<room_id>/?token=<key>`

Send: `{"content": "hello"}`

Receive:
- `{"type": "presence", "online_users": [...]}` — on connect
- `{"type": "message", "message": {id, room, user, content, created_at}}`
- `{"type": "user_joined" | "user_left", "user": {...}, "online_users": [...]}`
- `{"type": "error", "detail": "..."}`

Invalid token or unknown room → handshake rejected (HTTP 403).

## How it works

- **Broadcasting:** each room is a Channels group; Redis is the channel layer, so multiple server processes share messages.
- **Presence:** one `Connection` row per open socket. A user is online while they have at least one row, so multiple tabs don't cause duplicate join/leave events. Stale rows are cleared on startup (`manage.py clear_connections`).

## Ideas to extend

Typing indicators · read receipts · private DMs · rate limiting · tests with `channels.testing.WebsocketCommunicator` · JWT auth
