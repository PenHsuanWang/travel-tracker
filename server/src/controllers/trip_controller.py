"""Controller for trip-related operations."""

from typing import Optional, List, Dict, Any

from src.models.trip import Trip, TripResponse
from src.services.trip_service import TripService


class TripController:
    """Controller for handling trip-related functionalities."""

    def __init__(self):
        """Initializes the TripController."""
        self.trip_service = TripService()

    def get_trip(self, trip_id: str) -> Optional[TripResponse]:
        """
        Retrieves a single trip by its ID.

        :param trip_id: The ID of the trip to retrieve.
        :return: The trip response, or None if not found.
        """
        return self.trip_service.get_trip(trip_id)

    def get_trips(self, user_id: Optional[str] = None) -> List[TripResponse]:
        """
        Retrieves trips, optionally filtering by user ID.

        :param user_id: Optional user ID to filter trips by.
        :return: A list of trip responses.
        """
        return self.trip_service.get_trips(user_id)

    def create_trip(self, trip_data: Trip) -> Trip:
        """
        Creates a new trip.

        :param trip_data: The data for the new trip.
        :return: The created trip.
        """
        return self.trip_service.create_trip(trip_data)

    def update_trip(self, trip_id: str, update_data: Dict[str, Any]) -> Optional[Trip]:
        """
        Updates a trip.

        :param trip_id: The ID of the trip to update.
        :param update_data: The data to update.
        :return: The updated trip, or None if not found.
        """
        return self.trip_service.update_trip(trip_id, update_data)

    def delete_trip(self, trip_id: str) -> bool:
        """
        Deletes a trip by its ID.

        :param trip_id: The ID of the trip to delete.
        :return: True if the trip was deleted, False otherwise.
        """
        return self.trip_service.delete_trip(trip_id)
