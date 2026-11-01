from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework.authtoken.models import Token

from chat.authentication import issue_token, redeem_websocket_ticket
from chat.models import Message, Room
from conftest import TEST_PASSWORD

pytestmark = pytest.mark.django_db


def test_register_returns_token(api_client):
    response = api_client.post(
        "/api/auth/register/", {"username": "newuser", "password": TEST_PASSWORD}, format="json"
    )
    assert response.status_code == 201
    assert response.data["user"]["username"] == "newuser"
    assert Token.objects.filter(key=response.data["token"]).exists()


def test_register_rejects_weak_password(api_client):
    response = api_client.post("/api/auth/register/", {"username": "newuser", "password": "12345678"}, format="json")
    assert response.status_code == 400
    assert "password" in response.data


def test_register_rejects_username_differing_only_in_case(api_client, make_user):
    make_user("alice")
    response = api_client.post("/api/auth/register/", {"username": "Alice", "password": TEST_PASSWORD}, format="json")
    assert response.status_code == 400
    assert "username" in response.data


def test_register_rejects_password_similar_to_username(api_client):
    response = api_client.post(
        "/api/auth/register/", {"username": "chatterbox", "password": "chatterbox1"}, format="json"
    )
    assert response.status_code == 400
    assert "password" in response.data


def test_password_surrounding_whitespace_is_preserved(api_client):
    credentials = {"username": "spacey", "password": f"  {TEST_PASSWORD}  "}
    assert api_client.post("/api/auth/register/", credentials, format="json").status_code == 201
    assert api_client.post("/api/auth/login/", credentials, format="json").status_code == 200
    trimmed = {"username": "spacey", "password": TEST_PASSWORD}
    assert api_client.post("/api/auth/login/", trimmed, format="json").status_code == 401


@pytest.mark.parametrize("body", [[1, 2], {"username": "alice"}, {}, "just a string"])
def test_login_rejects_malformed_body(api_client, body):
    assert api_client.post("/api/auth/login/", body, format="json").status_code == 400


def test_login_succeeds_with_valid_credentials(api_client, make_user):
    make_user()
    response = api_client.post("/api/auth/login/", {"username": "alice", "password": TEST_PASSWORD}, format="json")
    assert response.status_code == 200
    assert response.data["token"]


def test_login_fails_with_wrong_password(api_client, make_user):
    make_user()
    response = api_client.post("/api/auth/login/", {"username": "alice", "password": "wrong-pass"}, format="json")
    assert response.status_code == 401


def test_login_is_throttled(api_client, make_user):
    make_user()
    statuses = [
        api_client.post("/api/auth/login/", {"username": "alice", "password": "wrong"}, format="json").status_code
        for _ in range(11)
    ]
    assert statuses[:10] == [401] * 10
    assert statuses[10] == 429


def test_endpoints_require_authentication(api_client):
    assert api_client.get("/api/rooms/").status_code == 401
    assert api_client.get("/api/users/me/").status_code == 401


def test_create_and_list_rooms(auth_client):
    created = auth_client.post("/api/rooms/", {"name": "general"}, format="json")
    assert created.status_code == 201
    assert created.data["created_by"]["username"] == "alice"

    duplicate = auth_client.post("/api/rooms/", {"name": "general"}, format="json")
    assert duplicate.status_code == 400

    listed = auth_client.get("/api/rooms/")
    assert [room["name"] for room in listed.data] == ["general"]


def test_message_history_paginates_backwards(auth_client):
    room = Room.objects.create(name="general", created_by=auth_client.user)
    Message.objects.bulk_create(
        Message(room=room, user=auth_client.user, content=f"message {number}") for number in range(60)
    )

    latest_page = auth_client.get(f"/api/rooms/{room.id}/messages/").data
    assert len(latest_page) == 50
    assert latest_page[0]["content"] == "message 10"
    assert latest_page[-1]["content"] == "message 59"

    older_page = auth_client.get(f"/api/rooms/{room.id}/messages/?before_id={latest_page[0]['id']}").data
    assert [message["content"] for message in older_page] == [f"message {number}" for number in range(10)]


@pytest.mark.parametrize("query", ["limit=abc", "limit=-1", "limit=0", "before_id=xyz"])
def test_message_history_rejects_invalid_params(auth_client, query):
    room = Room.objects.create(name="general", created_by=auth_client.user)
    assert auth_client.get(f"/api/rooms/{room.id}/messages/?{query}").status_code == 400


def test_message_history_for_unknown_room_is_404(auth_client):
    assert auth_client.get("/api/rooms/9999/messages/").status_code == 404


def test_message_history_page_size_is_capped(auth_client):
    room = Room.objects.create(name="general", created_by=auth_client.user)
    Message.objects.bulk_create(Message(room=room, user=auth_client.user, content="hi") for _ in range(120))
    assert len(auth_client.get(f"/api/rooms/{room.id}/messages/?limit=500").data) == 100


def test_expired_token_is_rejected_and_deleted(api_client, make_user, settings):
    token = issue_token(make_user())
    expired_at = timezone.now() - timedelta(seconds=settings.AUTH_TOKEN_TTL_SECONDS + 1)
    Token.objects.filter(key=token.key).update(created=expired_at)

    api_client.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")
    assert api_client.get("/api/users/me/").status_code == 401
    assert not Token.objects.filter(key=token.key).exists()


def test_logout_revokes_token(auth_client):
    assert auth_client.post("/api/auth/logout/").status_code == 204
    assert auth_client.get("/api/users/me/").status_code == 401


def test_health_check_reports_ok(api_client):
    response = api_client.get("/api/health/")
    assert response.status_code == 200
    assert response.data == {"status": "ok", "checks": {"database": "ok", "redis": "ok"}}


def test_websocket_ticket_requires_authentication(api_client):
    assert api_client.post("/api/auth/ws-ticket/").status_code == 401


def test_websocket_ticket_is_single_use(auth_client, settings):
    response = auth_client.post("/api/auth/ws-ticket/")
    assert response.status_code == 201
    assert response.data["expires_in"] == settings.WEBSOCKET_TICKET_TTL_SECONDS

    ticket = response.data["ticket"]
    assert redeem_websocket_ticket(ticket) == auth_client.user.id
    assert redeem_websocket_ticket(ticket) is None


@pytest.mark.parametrize("ticket", [None, "", "short", "x" * 43 + "!", "../" * 20])
def test_malformed_websocket_tickets_are_rejected(ticket):
    assert redeem_websocket_ticket(ticket) is None
