"""Centralized dependency-injection providers for the Travel Tracker backend.

This module contains functions that are used with FastAPI's `Depends` system
to provide singleton instances of services and other dependencies to the API
routes. Using `lru_cache` on these functions ensures that each dependency
is created only once per application lifecycle.
"""

from __future__ import annotations

from functools import lru_cache
from typing import TYPE_CHECKING

from src.events.event_bus import EventBus
from src.services.achievement_engine import achievement_engine
from src.services.file_retrieval_service import FileRetrievalService
from src.services.file_upload_service import FileUploadService
from src.services.gpx_analysis_retrieval_service import GpxAnalysisRetrievalService
from src.services.photo_note_service import PhotoNoteService
from src.services.trip_service import TripService
from src.services.user_stats_service import UserStatsService
from src.utils.adapter_factory import AdapterFactory
from src.utils.dbbutler.mongodb_adapter import MongoDBAdapter
from src.utils.dbbutler.storage_manager import StorageManager

if TYPE_CHECKING:
    from src.auth import User


# -- Adapter & Manager Providers --

@lru_cache()
def get_mongo_adapter() -> MongoDBAdapter:
    """Provide a singleton MongoDB adapter instance."""
    return AdapterFactory.create_mongodb_adapter()


@lru_cache()
def get_storage_manager() -> StorageManager:
    """Provide a singleton StorageManager configured with all adapters."""
    manager = StorageManager()
    manager.add_adapter("mongodb", get_mongo_adapter())
    # This might raise an error if keys are not set, which is desired
    # at startup.
    manager.add_adapter("minio", AdapterFactory.create_minio_adapter())
    return manager


# -- Service Providers --


@lru_cache()
def get_user_stats_service() -> UserStatsService:
    """Provide a singleton UserStatsService instance."""
    return UserStatsService(mongo_adapter=get_mongo_adapter())


@lru_cache()
def get_trip_service() -> TripService:
    """Provide a singleton TripService instance."""
    return TripService(
        storage_manager=get_storage_manager(),
        stats_service=get_user_stats_service(),
        event_bus=EventBus,
    )


@lru_cache()
def get_file_upload_service() -> FileUploadService:
    """Provide a singleton FileUploadService instance."""
    return FileUploadService(
        storage_manager=get_storage_manager(),
        trip_service=get_trip_service(),
        event_bus=EventBus,
    )


@lru_cache()
def get_file_retrieval_service() -> FileRetrievalService:
    """Provide a singleton FileRetrievalService instance."""
    return FileRetrievalService(storage_manager=get_storage_manager())


@lru_cache()
def get_gpx_analysis_retrieval_service() -> GpxAnalysisRetrievalService:
    """Provide a singleton GpxAnalysisRetrievalService instance."""
    return GpxAnalysisRetrievalService(storage_manager=get_storage_manager())


@lru_cache()
def get_photo_note_service() -> PhotoNoteService:
    """Provide a singleton PhotoNoteService instance."""
    return PhotoNoteService(storage_manager=get_storage_manager())


# -- Event Bus Wiring --

@lru_cache()
def get_wired_event_bus() -> type[EventBus]:
    """
    Return the EventBus class after ensuring subscribers are wired.

    This is a bit of a hack to ensure that module-level singletons like
    'achievement_engine' are subscribed during the first request that
    needs the event bus. In a more advanced setup, this would be handled
    in a FastAPI startup event.
    """
    # achievement_engine is a module-level singleton that needs to be subscribed.
    # We reference it here to ensure its module is loaded and subscribers are attached.
    if achievement_engine:
        # This check is trivial, but it forces the import and execution of the
        # achievement_engine module, which contains the EventBus.subscribe calls.
        pass
    return EventBus
