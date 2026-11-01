import pytest
from django.contrib.auth import get_user_model
from django.core.cache import cache
from rest_framework.test import APIClient

from chat.authentication import issue_token

TEST_PASSWORD = "s3cure-pass-123"


@pytest.fixture(autouse=True)
def clear_cache():
    # Throttle counters live in the cache; reset them so tests don't affect each other
    cache.clear()


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def make_user(db):
    def create(username="alice", password=TEST_PASSWORD):
        return get_user_model().objects.create_user(username=username, password=password)

    return create


@pytest.fixture
def auth_client(make_user):
    user = make_user()
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Token {issue_token(user).key}")
    client.user = user
    return client
