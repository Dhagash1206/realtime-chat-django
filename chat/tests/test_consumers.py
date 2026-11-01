import pytest
from channels.db import database_sync_to_async
from channels.routing import URLRouter
from channels.testing import WebsocketCommunicator
from django.contrib.auth import get_user_model
from django.db import DatabaseError

from chat.authentication import issue_websocket_ticket
from chat.consumers import CLOSE_ROOM_NOT_FOUND, CLOSE_UNAUTHORIZED, ChatConsumer
from chat.middleware import WebSocketTicketAuthMiddleware
from chat.models import Connection, Message, Room
from chat.routing import websocket_urlpatterns
from conftest import TEST_PASSWORD

pytestmark = [pytest.mark.asyncio, pytest.mark.django_db(transaction=True)]

# Origin validation is Channels' own code; these tests cover ticket auth and the consumer
application = WebSocketTicketAuthMiddleware(URLRouter(websocket_urlpatterns))


@database_sync_to_async
def create_user(username):
    return get_user_model().objects.create_user(username=username, password=TEST_PASSWORD)


@database_sync_to_async
def create_room(user, name="general"):
    return Room.objects.create(name=name, created_by=user)


@database_sync_to_async
def issue_ticket(user):
    return issue_websocket_ticket(user)


async def open_socket(room_id, ticket):
    communicator = WebsocketCommunicator(application, f"/ws/rooms/{room_id}/?ticket={ticket}")
    connected, close_code = await communicator.connect()
    return communicator, connected, close_code


async def join(room_id, user, expected_events):
    """Connect with a fresh ticket and consume the initial presence/join events."""
    communicator, connected, _ = await open_socket(room_id, await issue_ticket(user))
    assert connected
    received = [await communicator.receive_json_from() for _ in range(expected_events)]
    return communicator, received


def usernames(users):
    return [user["username"] for user in users]


async def test_rejects_connection_without_ticket():
    communicator = WebsocketCommunicator(application, "/ws/rooms/1/")
    connected, close_code = await communicator.connect()
    assert not connected
    assert close_code == CLOSE_UNAUTHORIZED


async def test_rejects_forged_ticket():
    alice = await create_user("alice")
    room = await create_room(alice)
    _, connected, close_code = await open_socket(room.id, "A" * 43)
    assert not connected
    assert close_code == CLOSE_UNAUTHORIZED


async def test_ticket_works_only_once():
    alice = await create_user("alice")
    room = await create_room(alice)
    ticket = await issue_ticket(alice)

    first_socket, connected, _ = await open_socket(room.id, ticket)
    assert connected
    _, replay_connected, close_code = await open_socket(room.id, ticket)
    assert not replay_connected
    assert close_code == CLOSE_UNAUTHORIZED
    await first_socket.disconnect()


async def test_expired_ticket_is_rejected(settings):
    settings.WEBSOCKET_TICKET_TTL_SECONDS = 0
    alice = await create_user("alice")
    room = await create_room(alice)
    _, connected, close_code = await open_socket(room.id, await issue_ticket(alice))
    assert not connected
    assert close_code == CLOSE_UNAUTHORIZED


async def test_rejects_unknown_room():
    alice = await create_user("alice")
    _, connected, close_code = await open_socket(9999, await issue_ticket(alice))
    assert not connected
    assert close_code == CLOSE_ROOM_NOT_FOUND


async def test_messages_and_presence_flow():
    alice = await create_user("alice")
    bob = await create_user("bob")
    room = await create_room(alice)

    alice_socket, alice_events = await join(room.id, alice, expected_events=2)
    assert [event["type"] for event in alice_events] == ["presence", "user_joined"]

    bob_socket, bob_events = await join(room.id, bob, expected_events=2)
    assert usernames(bob_events[0]["online_users"]) == ["alice", "bob"]
    bob_joined = await alice_socket.receive_json_from()
    assert bob_joined["type"] == "user_joined"
    assert bob_joined["user"]["username"] == "bob"

    await alice_socket.send_json_to({"content": "  hello bob  "})
    for socket in (alice_socket, bob_socket):
        event = await socket.receive_json_from()
        assert event["type"] == "message"
        assert event["message"]["content"] == "hello bob"
        assert event["message"]["user"]["username"] == "alice"
    assert await database_sync_to_async(Message.objects.filter(room=room, content="hello bob").exists)()

    await bob_socket.disconnect()
    bob_left = await alice_socket.receive_json_from()
    assert bob_left["type"] == "user_left"
    assert usernames(bob_left["online_users"]) == ["alice"]

    await alice_socket.disconnect()
    assert await database_sync_to_async(Connection.objects.count)() == 0


async def test_second_tab_does_not_duplicate_presence_events():
    alice = await create_user("alice")
    room = await create_room(alice)

    first_tab, _ = await join(room.id, alice, expected_events=2)
    second_tab, second_tab_events = await join(room.id, alice, expected_events=1)
    assert second_tab_events[0]["type"] == "presence"
    assert await first_tab.receive_nothing(timeout=0.2)

    await second_tab.disconnect()
    assert await first_tab.receive_nothing(timeout=0.2)
    await first_tab.disconnect()


async def test_invalid_frames_return_errors_and_keep_socket_open(settings):
    alice = await create_user("alice")
    room = await create_room(alice)
    socket, _ = await join(room.id, alice, expected_events=2)

    await socket.send_to(text_data="not json")
    await socket.send_to(text_data="[" * 5000)
    await socket.send_json_to({"content": "   "})
    await socket.send_json_to({"content": "x" * (settings.CHAT_MAX_MESSAGE_LENGTH + 1)})
    await socket.send_input({"type": "websocket.receive", "text": ""})
    await socket.send_to(bytes_data=b"\x00\x01")
    for _ in range(6):
        assert (await socket.receive_json_from())["type"] == "error"

    await socket.send_json_to({"content": "still here"})
    assert (await socket.receive_json_from())["message"]["content"] == "still here"
    assert await database_sync_to_async(Message.objects.count)() == 1
    await socket.disconnect()


async def test_rate_limit_blocks_message_floods(settings):
    settings.CHAT_RATE_LIMIT_MESSAGES = 3
    alice = await create_user("alice")
    room = await create_room(alice)
    socket, _ = await join(room.id, alice, expected_events=2)

    for number in range(4):
        await socket.send_json_to({"content": f"message {number}"})
    # Error replies are sent directly while broadcasts go via the channel layer, so order can vary
    event_types = sorted([(await socket.receive_json_from())["type"] for _ in range(4)])
    assert event_types == ["error", "message", "message", "message"]
    assert await database_sync_to_async(Message.objects.count)() == 3
    await socket.disconnect()


async def test_failed_save_reports_error_without_dropping_socket(monkeypatch):
    async def failing_save(self, text):
        raise DatabaseError("database unavailable")

    monkeypatch.setattr(ChatConsumer, "save_message", failing_save)
    alice = await create_user("alice")
    room = await create_room(alice)
    socket, _ = await join(room.id, alice, expected_events=2)

    await socket.send_json_to({"content": "hello"})
    event = await socket.receive_json_from()
    assert event == {"type": "error", "detail": "Message could not be sent. Please try again."}
    await socket.disconnect()
    assert await database_sync_to_async(Connection.objects.count)() == 0


async def test_crashed_consumer_does_not_leave_user_online(monkeypatch):
    async def crash(self, content, **kwargs):
        raise RuntimeError("unexpected bug")

    monkeypatch.setattr(ChatConsumer, "receive_json", crash)
    alice = await create_user("alice")
    room = await create_room(alice)
    socket, _ = await join(room.id, alice, expected_events=2)

    await socket.send_json_to({"content": "hello"})
    with pytest.raises(RuntimeError):
        await socket.receive_output()
    assert await database_sync_to_async(Connection.objects.count)() == 0
