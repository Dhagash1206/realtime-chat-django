from django.core.management.base import BaseCommand

from chat.models import Connection


class Command(BaseCommand):
    help = "Remove stale WebSocket connection rows (run on server start, after a crash or restart)."

    def handle(self, *args, **options):
        deleted_count, _ = Connection.objects.all().delete()
        self.stdout.write(f"Cleared {deleted_count} stale connections")
