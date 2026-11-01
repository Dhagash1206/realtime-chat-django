from django.contrib import admin

from chat.models import Connection, Message, Room


@admin.register(Room)
class RoomAdmin(admin.ModelAdmin):
    list_display = ["id", "name", "created_by", "created_at"]
    search_fields = ["name"]


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ["id", "room", "user", "content", "created_at"]
    list_filter = ["room"]
    search_fields = ["content"]


@admin.register(Connection)
class ConnectionAdmin(admin.ModelAdmin):
    list_display = ["channel_name", "user", "room", "connected_at"]
