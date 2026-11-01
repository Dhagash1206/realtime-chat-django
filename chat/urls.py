from django.urls import path

from chat import views

urlpatterns = [
    path("auth/register/", views.RegisterView.as_view(), name="register"),
    path("auth/login/", views.LoginView.as_view(), name="login"),
    path("users/me/", views.MeView.as_view(), name="me"),
    path("users/online/", views.OnlineUsersView.as_view(), name="online-users"),
    path("rooms/", views.RoomListCreateView.as_view(), name="rooms"),
    path("rooms/<int:room_id>/messages/", views.RoomMessagesView.as_view(), name="room-messages"),
    path("rooms/<int:room_id>/online/", views.RoomOnlineUsersView.as_view(), name="room-online"),
]
