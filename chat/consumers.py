import json

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from django.conf import settings

from chat import presence
from chat.models import Connection, Message, Room
from chat.serializers import MessageSerializer

CLOSE_UNAUTHORIZED = 4401
CLOSE_ROOM_NOT_FOUND = 4404


class ChatConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        self.user = self.scope["user"]
        self.room_id = self.scope["url_route"]["kwargs"]["room_id"]
        self.group_name = f"room_{self.room_id}"
        self.joined = False

        if not self.user.is_authenticated:
            await self.close(code=CLOSE_UNAUTHORIZED)
            return
        if not await self.room_exists():
            await self.close(code=CLOSE_ROOM_NOT_FOUND)
            return

        # Checked before registering, so a second tab doesn't announce the user twice
        was_already_in_room = await self.is_user_in_room()
        await self.register_connection()
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        self.joined = True
        await self.accept()

        await self.send_json({"type": "presence", "online_users": await self.room_online_users()})
        if not was_already_in_room:
            await self.broadcast_presence("user_joined")

    async def disconnect(self, code):
        if not self.joined:
            return
        await self.unregister_connection()
        await self.channel_layer.group_discard(self.group_name, self.channel_name)
        if not await self.is_user_in_room():
            await self.broadcast_presence("user_left")

    @classmethod
    async def decode_json(cls, text_data):
        try:
            return json.loads(text_data)
        except json.JSONDecodeError:
            return None

    async def receive_json(self, content, **kwargs):
        text = content.get("content") if isinstance(content, dict) else None
        text = text.strip() if isinstance(text, str) else ""
        if not text:
            await self.send_json({"type": "error", "detail": 'Send JSON like {"content": "hello"}'})
            return
        if len(text) > settings.CHAT_MAX_MESSAGE_LENGTH:
            await self.send_json(
                {"type": "error", "detail": f"Message exceeds {settings.CHAT_MAX_MESSAGE_LENGTH} characters"}
            )
            return

        message_data = await self.save_message(text)
        await self.channel_layer.group_send(self.group_name, {"type": "chat.message", "message": message_data})

    # Group event handlers: "chat.message" is dispatched to chat_message, etc.
    async def chat_message(self, event):
        await self.send_json({"type": "message", "message": event["message"]})

    async def presence_event(self, event):
        await self.send_json(
            {"type": event["event"], "user": event["user"], "online_users": event["online_users"]}
        )

    async def broadcast_presence(self, event_name):
        await self.channel_layer.group_send(
            self.group_name,
            {
                "type": "presence.event",
                "event": event_name,
                "user": {"id": self.user.id, "username": self.user.username},
                "online_users": await self.room_online_users(),
            },
        )

    @database_sync_to_async
    def room_exists(self):
        return Room.objects.filter(id=self.room_id).exists()

    @database_sync_to_async
    def is_user_in_room(self):
        return presence.is_user_in_room(self.user.id, self.room_id)

    @database_sync_to_async
    def room_online_users(self):
        return presence.online_users(self.room_id)

    @database_sync_to_async
    def register_connection(self):
        Connection.objects.create(channel_name=self.channel_name, user=self.user, room_id=self.room_id)

    @database_sync_to_async
    def unregister_connection(self):
        Connection.objects.filter(channel_name=self.channel_name).delete()

    @database_sync_to_async
    def save_message(self, text):
        message = Message.objects.create(room_id=self.room_id, user=self.user, content=text)
        # Round-trip to plain dicts, since DRF's ReturnDict isn't guaranteed to serialize over Redis
        return json.loads(json.dumps(MessageSerializer(message).data))
