from django.contrib.auth import get_user_model

from chat.models import Connection

User = get_user_model()


def online_users(room_id=None):
    connections = Connection.objects.all()
    if room_id is not None:
        connections = connections.filter(room_id=room_id)
    users = User.objects.filter(id__in=connections.values("user_id")).order_by("username")
    return [{"id": user.id, "username": user.username} for user in users]


def is_user_in_room(user_id, room_id):
    return Connection.objects.filter(user_id=user_id, room_id=room_id).exists()
