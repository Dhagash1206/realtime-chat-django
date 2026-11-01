from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from channels.middleware import BaseMiddleware
from django.contrib.auth.models import AnonymousUser
from rest_framework.authtoken.models import Token


@database_sync_to_async
def get_user_for_token(token_key):
    try:
        return Token.objects.select_related("user").get(key=token_key).user
    except Token.DoesNotExist:
        return AnonymousUser()


class TokenAuthMiddleware(BaseMiddleware):
    """Authenticates WebSockets via ?token=<key>, since browsers can't set
    an Authorization header on a WebSocket handshake."""

    async def __call__(self, scope, receive, send):
        query_params = parse_qs(scope["query_string"].decode())
        token_key = query_params.get("token", [None])[0]
        if token_key:
            scope["user"] = await get_user_for_token(token_key)
        return await super().__call__(scope, receive, send)
