import re
import secrets
from datetime import timedelta

from django.conf import settings
from django.core.cache import cache
from django.utils import timezone
from rest_framework.authentication import TokenAuthentication
from rest_framework.authtoken.models import Token
from rest_framework.exceptions import AuthenticationFailed

# secrets.token_urlsafe(32) always yields 43 URL-safe characters
WEBSOCKET_TICKET_PATTERN = re.compile(r"^[A-Za-z0-9_-]{43}$")


def token_is_expired(token):
    return timezone.now() - token.created > timedelta(seconds=settings.AUTH_TOKEN_TTL_SECONDS)


def issue_token(user):
    """Return the user's token, replacing it if it has expired."""
    token, created = Token.objects.get_or_create(user=user)
    if not created and token_is_expired(token):
        token.delete()
        token = Token.objects.create(user=user)
    return token


class ExpiringTokenAuthentication(TokenAuthentication):
    def authenticate_credentials(self, key):
        user, token = super().authenticate_credentials(key)
        if token_is_expired(token):
            token.delete()
            raise AuthenticationFailed("Token has expired")
        return user, token


def issue_websocket_ticket(user):
    """Create a short-lived, single-use credential for the WebSocket handshake.

    Browsers can't set an Authorization header on a WebSocket, so the credential must
    travel in the URL, where proxies and servers log it. A ticket that expires within
    seconds and works once makes those logged values worthless."""
    ticket = secrets.token_urlsafe(32)
    cache.set(_ticket_cache_key(ticket), user.pk, timeout=settings.WEBSOCKET_TICKET_TTL_SECONDS)
    return ticket


def redeem_websocket_ticket(ticket):
    """Return the id of the user the ticket was issued to, or None. Each ticket works once."""
    if not ticket or not WEBSOCKET_TICKET_PATTERN.match(ticket):
        return None
    cache_key = _ticket_cache_key(ticket)
    user_id = cache.get(cache_key)
    # delete() reports whether this call removed the key, so concurrent redemptions can't both succeed
    if user_id is None or not cache.delete(cache_key):
        return None
    return user_id


def _ticket_cache_key(ticket):
    return f"ws-ticket:{ticket}"
