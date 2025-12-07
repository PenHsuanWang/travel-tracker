from datetime import timezone

from src.models.user import PublicUserProfile, User


def test_user_defaults_are_isolated():
    first = User(username="alice", email="alice@example.com")
    second = User(username="bob", email="bob@example.com")

    first.pinned_trip_ids.append("trip-123")
    first.earned_badges.append("summit")

    assert not second.pinned_trip_ids
    assert not second.earned_badges


def test_user_created_at_is_timezone_aware():
    user = User(username="carol", email="carol@example.com")

    assert user.created_at.tzinfo is timezone.utc


def test_public_profile_pinned_trips_default():
    user_created_at = User(username="tmp").created_at
    profile = PublicUserProfile(
        id="user-1",
        username="alice",
        created_at=user_created_at,
        total_distance_km=0.0,
        total_elevation_gain_m=0.0,
        total_trips=0,
        earned_badges=[],
    )

    assert profile.pinned_trips == []
    profile.pinned_trips.append({"trip_id": "trip-1"})
    other_profile = PublicUserProfile(
        id="user-2",
        username="bob",
        created_at=user_created_at,
        total_distance_km=0.0,
        total_elevation_gain_m=0.0,
        total_trips=0,
        earned_badges=[],
    )

    assert not other_profile.pinned_trips
