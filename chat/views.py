import logging

from django.conf import settings
from django.contrib.auth import authenticate
from django.core.cache import cache
from django.db import connection
from django.shortcuts import get_object_or_404
from rest_framework import generics, status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from chat.authentication import issue_token, issue_websocket_ticket
from chat.models import Message, Room
from chat.presence import online_users
from chat.serializers import (
    LoginSerializer,
    MessageSerializer,
    RegisterSerializer,
    RoomSerializer,
    UserSerializer,
)


logger = logging.getLogger(__name__)


def token_response(user, response_status=status.HTTP_200_OK):
    token = issue_token(user)
    return Response({"token": token.key, "user": UserSerializer(user).data}, status=response_status)


class RegisterView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_scope = "auth"

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return token_response(user, status.HTTP_201_CREATED)


class LoginView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_scope = "auth"

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        username = serializer.validated_data["username"]
        user = authenticate(request=request, username=username, password=serializer.validated_data["password"])
        if user is None:
            logger.info("Failed login attempt for username=%r", username)
            return Response({"detail": "Invalid username or password"}, status=status.HTTP_401_UNAUTHORIZED)
        return token_response(user)


class LogoutView(APIView):
    def post(self, request):
        if request.auth is not None:
            request.auth.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class WebSocketTicketView(APIView):
    """Issues a single-use ticket for opening a chat WebSocket (see issue_websocket_ticket)."""

    def post(self, request):
        return Response(
            {"ticket": issue_websocket_ticket(request.user), "expires_in": settings.WEBSOCKET_TICKET_TTL_SECONDS},
            status=status.HTTP_201_CREATED,
        )


class HealthView(APIView):
    """Liveness/readiness probe: verifies the database and Redis are reachable."""

    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_classes = []

    def get(self, request):
        checks = {}
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
            checks["database"] = "ok"
        except Exception:
            logger.exception("Health check: database unreachable")
            checks["database"] = "error"
        try:
            cache.set("health-check", "ok", timeout=5)
            checks["redis"] = "ok" if cache.get("health-check") == "ok" else "error"
        except Exception:
            logger.exception("Health check: redis unreachable")
            checks["redis"] = "error"

        healthy = all(result == "ok" for result in checks.values())
        return Response(
            {"status": "ok" if healthy else "error", "checks": checks},
            status=status.HTTP_200_OK if healthy else status.HTTP_503_SERVICE_UNAVAILABLE,
        )


class MeView(APIView):
    def get(self, request):
        return Response(UserSerializer(request.user).data)


class OnlineUsersView(APIView):
    def get(self, request):
        return Response(online_users())


class RoomListCreateView(generics.ListCreateAPIView):
    queryset = Room.objects.select_related("created_by")
    serializer_class = RoomSerializer

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class RoomMessagesView(APIView):
    """Message history, newest page first. Pass ?before_id=<id> to load older messages."""

    default_page_size = 50
    max_page_size = 100

    def get(self, request, room_id):
        room = get_object_or_404(Room, id=room_id)
        try:
            limit = int(request.query_params.get("limit", self.default_page_size))
            before_id = request.query_params.get("before_id")
            before_id = int(before_id) if before_id else None
        except ValueError:
            return Response({"detail": "limit and before_id must be integers"}, status=status.HTTP_400_BAD_REQUEST)
        if limit < 1:
            return Response({"detail": "limit must be a positive integer"}, status=status.HTTP_400_BAD_REQUEST)
        limit = min(limit, self.max_page_size)

        messages = Message.objects.filter(room=room).select_related("user")
        if before_id is not None:
            messages = messages.filter(id__lt=before_id)
        newest_first = list(messages.order_by("-id")[:limit])
        # Returned oldest-to-newest so clients can render the page top to bottom
        return Response(MessageSerializer(reversed(newest_first), many=True).data)


class RoomOnlineUsersView(APIView):
    def get(self, request, room_id):
        get_object_or_404(Room, id=room_id)
        return Response(online_users(room_id))
