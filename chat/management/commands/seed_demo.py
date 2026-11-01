import os

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError

from chat.models import Message, Room

DEMO_USERNAMES = ["alice", "bob", "charlie"]
DEMO_ROOMS = ["general", "random", "backend-dev"]
DEMO_CONVERSATION = [
    ("alice", "Hey everyone! Welcome to the chat 👋"),
    ("bob", "Hi Alice! This is looking great."),
    ("charlie", "Messages arrive over WebSockets, history comes from the REST API."),
    ("alice", "And presence is tracked per connection, so multiple tabs work."),
    ("bob", "Nice. Next up: typing indicators?"),
]


class Command(BaseCommand):
    help = "Create demo users, rooms and messages for local development."

    def add_arguments(self, parser):
        parser.add_argument("--force", action="store_true", help="Allow running with DEBUG off")

    def handle(self, *args, **options):
        if not settings.DEBUG and not options["force"]:
            raise CommandError("Refusing to create demo users with DEBUG off (use --force to override)")
        password = os.environ.get("DEMO_PASSWORD", "demo-pass-123")
        User = get_user_model()

        users = {}
        for username in DEMO_USERNAMES:
            user, created = User.objects.get_or_create(username=username)
            if created:
                user.set_password(password)
                user.save()
            users[username] = user

        rooms = [Room.objects.get_or_create(name=name, defaults={"created_by": users["alice"]})[0] for name in DEMO_ROOMS]

        general = rooms[0]
        if not general.messages.exists():
            Message.objects.bulk_create(
                Message(room=general, user=users[username], content=content) for username, content in DEMO_CONVERSATION
            )

        self.stdout.write(f"Demo data ready: users {', '.join(DEMO_USERNAMES)} (password from DEMO_PASSWORD)")
