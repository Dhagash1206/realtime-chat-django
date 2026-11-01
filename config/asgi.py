import os

from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
# Django must be set up before importing anything that touches models
django_asgi_app = get_asgi_application()

from channels.routing import ProtocolTypeRouter, URLRouter  # noqa: E402
from channels.security.websocket import AllowedHostsOriginValidator  # noqa: E402

from chat.middleware import WebSocketTicketAuthMiddleware  # noqa: E402
from chat.routing import websocket_urlpatterns  # noqa: E402

application = ProtocolTypeRouter(
    {
        "http": django_asgi_app,
        # Ticket auth only: no session cookies on sockets, so cross-site pages can't ride a login
        "websocket": AllowedHostsOriginValidator(WebSocketTicketAuthMiddleware(URLRouter(websocket_urlpatterns))),
    }
)
