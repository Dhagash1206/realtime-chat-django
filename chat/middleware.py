from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from channels.middleware import BaseMiddleware
from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser

from chat.authentication import redeem_websocket_ticket


@database_sync_to_async
def get_user_for_ticket(ticket):
    user_id = redeem_websocket_ticket(ticket)
    if user_id is None:
        return AnonymousUser()
    return get_user_model().objects.filter(pk=user_id, is_active=True).first() or AnonymousUser()


class WebSocketTicketAuthMiddleware(BaseMiddleware):
    """Authenticates WebSockets via ?ticket=<ticket> from POST /api/auth/ws-ticket/."""

    async def __call__(self, scope, receive, send):
        query_params = parse_qs(scope["query_string"].decode("latin-1"))
        ticket = query_params.get("ticket", [None])[0]
        user = await get_user_for_ticket(ticket) if ticket else AnonymousUser()
        return await super().__call__({**scope, "user": user}, receive, send)
