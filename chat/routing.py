from django.urls import path

from chat.consumers import ChatConsumer

websocket_urlpatterns = [
    path("ws/rooms/<int:room_id>/", ChatConsumer.as_asgi()),
]
