from django.contrib.auth import authenticate
from django.shortcuts import get_object_or_404
from rest_framework import generics, status
from rest_framework.authtoken.models import Token
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from chat.models import Message, Room
from chat.presence import online_users
from chat.serializers import MessageSerializer, RegisterSerializer, RoomSerializer, UserSerializer


def token_response(user, response_status=status.HTTP_200_OK):
    token, _ = Token.objects.get_or_create(user=user)
    return Response({"token": token.key, "user": UserSerializer(user).data}, status=response_status)


class RegisterView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return token_response(user, status.HTTP_201_CREATED)


class LoginView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        user = authenticate(username=request.data.get("username"), password=request.data.get("password"))
        if user is None:
            return Response({"detail": "Invalid username or password"}, status=status.HTTP_401_UNAUTHORIZED)
        return token_response(user)


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

    max_page_size = 100

    def get(self, request, room_id):
        room = get_object_or_404(Room, id=room_id)
        try:
            limit = min(int(request.query_params.get("limit", 50)), self.max_page_size)
            before_id = request.query_params.get("before_id")
            before_id = int(before_id) if before_id else None
        except ValueError:
            return Response({"detail": "limit and before_id must be integers"}, status=status.HTTP_400_BAD_REQUEST)

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
