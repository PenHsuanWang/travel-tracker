from datetime import timezone

from src.models.trip import Trip, TripResponse
from src.models.user import UserSummary


def test_trip_member_defaults_are_isolated():
    first = Trip(name="Snowy Peak")
    second = Trip(name="Foggy Ridge")

    first.member_ids.append("user-1")

    assert not second.member_ids


def test_trip_created_at_is_timezone_aware():
    trip = Trip(name="Everest Prep")

    assert trip.created_at.tzinfo is timezone.utc


def test_trip_response_members_default():
    response = TripResponse(name="Local Trail")

    assert response.members == []
    response.members.append(
        UserSummary(id="user-1", username="alice", total_distance_km=0.0, total_trips=0)
    )
    other = TripResponse(name="Remote Trail")

    assert not other.members
