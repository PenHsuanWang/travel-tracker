import pytest
from fastapi.testclient import TestClient
from unittest.mock import MagicMock, patch
from src.app import app
from src.auth import get_current_user, get_password_hash
from src.models.user import UserInDB
from src.models.trip import TripResponse

@pytest.fixture
def client():
    # Client without auth override
    app.dependency_overrides = {}
    return TestClient(app)

@pytest.fixture
def mock_user():
    return UserInDB(
        username="testuser",
        email="test@example.com",
        hashed_password=get_password_hash("password"),
        id="user1"
    )

@pytest.fixture
def mock_user_2():
    return UserInDB(
        username="otheruser",
        email="other@example.com",
        hashed_password=get_password_hash("password2"),
        id="user2"
    )

@pytest.fixture
def mock_trip(mock_user):
    return TripResponse(id="trip1", name="My Trip", owner_id=mock_user.id)

@pytest.fixture
def auth_headers(mock_user):
    # This fixture provides an authenticated client for mock_user
    app.dependency_overrides[get_current_user] = lambda: mock_user
    yield {"Authorization": "Bearer mock_token_for_user1"}
    app.dependency_overrides = {}

class TestTripRoutes:
    
    def test_get_trips_unauthenticated(self, client):
        # Let's test a protected endpoint, e.g., create trip
        payload = {"name": "New Trip"}
        response = client.post("/api/trips/", json=payload)
        assert response.status_code == 401 # Expecting 401 for protected route

    @patch('src.services.trip_service.TripService.get_trips')
    def test_get_trips(self, mock_get_trips, client, auth_headers):
        mock_get_trips.return_value = []
        response = client.get("/api/trips/", headers=auth_headers)
        assert response.status_code == 200
        assert response.json() == []

    @patch('src.services.trip_service.TripService.create_trip')
    def test_create_trip(self, mock_create, client, auth_headers, mock_user):
        # The service returns a Trip object, not MagicMock
        from src.models.trip import Trip
        mock_create.return_value = Trip(id="trip1", name="New Trip", owner_id=mock_user.id)
        
        payload = {"name": "New Trip", "start_date": "2023-01-01T00:00:00"}
        response = client.post("/api/trips/", json=payload, headers=auth_headers)
        
        assert response.status_code == 201
        assert response.json()['id'] == "trip1"

    @patch('src.services.trip_service.TripService.get_trip')
    def test_get_trip_found(self, mock_get, client, auth_headers, mock_trip):
        mock_get.return_value = mock_trip
        response = client.get(f"/api/trips/{mock_trip.id}", headers=auth_headers)
        assert response.status_code == 200
        assert response.json()['name'] == "My Trip"

    @patch('src.services.trip_service.TripService.get_trip')
    def test_get_trip_not_found(self, mock_get, client, auth_headers):
        mock_get.return_value = None
        response = client.get("/api/trips/missing", headers=auth_headers)
        assert response.status_code == 404

    @patch('src.services.trip_service.TripService.get_trip')
    @patch('src.services.trip_service.TripService.update_trip')
    def test_update_trip_not_owner(self, mock_update, mock_get, client, mock_trip, mock_user_2):
        # The trip is owned by user1 (from mock_trip fixture)
        # We are authenticated as user2
        app.dependency_overrides[get_current_user] = lambda: mock_user_2
        
        mock_get.return_value = mock_trip # Service finds the trip
        
        response = client.put(
            f"/api/trips/{mock_trip.id}",
            json={"name": "New Name"},
            headers={"Authorization": "Bearer mock_token_for_user2"}
        )
        
        assert response.status_code == 403
        assert "Not authorized" in response.json()['detail']
        mock_update.assert_not_called()
        
        # Cleanup override
        app.dependency_overrides = {}


class TestAuthRoutes:
    
    @patch('src.utils.adapter_factory.AdapterFactory.create_mongodb_adapter')
    def test_login_success(self, mock_adapter_factory, client, mock_user):
        mock_col = MagicMock()
        # Use the hashed password from the fixture
        mock_col.find_one.return_value = mock_user.model_dump()
        mock_adapter = MagicMock()
        mock_adapter.get_collection.return_value = mock_col
        mock_adapter_factory.return_value = mock_adapter
        
        response = client.post("/api/auth/login", data={"username": "testuser", "password": "password"})
        assert response.status_code == 200
        assert "access_token" in response.json()

    @patch('src.utils.adapter_factory.AdapterFactory.create_mongodb_adapter')
    def test_login_failure(self, mock_adapter_factory, client, mock_user):
        mock_col = MagicMock()
        mock_col.find_one.return_value = mock_user.model_dump()
        mock_adapter = MagicMock()
        mock_adapter.get_collection.return_value = mock_col
        mock_adapter_factory.return_value = mock_adapter
        
        response = client.post("/api/auth/login", data={"username": "testuser", "password": "wrong"})
        assert response.status_code == 401

class TestFileRetrievalRoutes:

    @patch('src.services.photo_note_service.PhotoNoteService.update_waypoint_note')
    def test_update_waypoint_note(self, mock_update, client, auth_headers):
        metadata_id = "gpx1"
        waypoint_index = 0
        payload = {"note": "New Test Note", "note_title": "Test Title"}
        
        mock_update.return_value = {"success": True, **payload}

        response = client.patch(
            f"/api/gpx/metadata/{metadata_id}/waypoint/{waypoint_index}",
            json=payload,
            headers=auth_headers
        )

        assert response.status_code == 200
        assert response.json()["note"] == "New Test Note"
        mock_update.assert_called_once_with(
            metadata_id,
            waypoint_index,
            note=payload["note"],
            note_title=payload["note_title"]
        )
