Backend Developer Guide
=======================

This guide provides a technical overview of the backend's internal architecture, design patterns, and service responsibilities.

Core Architectural Principles
-----------------------------

1.  **Decoupled Client-Server Model**: The backend is a stateless API server. The `React frontend <../../README_FRONTEND.md>`_ is a separate Single-Page Application (SPA) that consumes this API. This separation allows for independent development, deployment, and scaling.

2.  **Hybrid Data Storage**: The application uses two storage systems for efficiency:
    *   **MongoDB**: Serves as the primary metadata store for structured, JSON-like documents (e.g., user profiles, trip details, file metadata).
    *   **MinIO (S3-Compatible)**: Acts as the object store for large binary files (GPX tracks, images, and cached analysis data).

3.  **Storage Adapter Pattern**: To decouple business logic from the underlying database implementations, the backend uses a Storage Adapter Pattern.
    *   An abstract class, ``StorageAdapter``, defines a common interface (e.g., ``save_data``, ``load_data``).
    *   ``MongoDBAdapter`` and ``MinIOAdapter`` provide the concrete implementations for each storage system.
    *   The ``AdapterFactory`` is a singleton responsible for instantiating and configuring these adapters from environment variables. Services request adapters from the factory, ensuring storage logic is centralized and easy to manage or mock for testing.

Service Layer Responsibilities
------------------------------

The business logic is organized into a service layer, where each service encapsulates a distinct domain of responsibility.

*   **`TripService`**: Manages the CRUD lifecycle for trips. It handles creating, reading, updating, and deleting trip documents in MongoDB. When a trip is deleted, it's responsible for orchestrating the deletion of all associated files in MinIO and metadata in MongoDB.

*   **`FileUploadService`**: This is the gateway for all file uploads. It inspects the file type and delegates to a specific handler (e.g., `GpxHandler`, `ImageHandler`). It orchestrates the entire upload process: metadata extraction (EXIF, etc.), storage to both MinIO and MongoDB, and triggering post-processing events via the `EventBus`.

*   **`FileRetrievalService`**: Provides a unified API for querying and retrieving files and their metadata. It can list all files for a trip or perform geospatial queries to find geotagged images within a specific map viewport.

*   **`GpxAnalysisService` & `GpxAnalysisRetrievalService`**: These services are dedicated to GPX file processing. `GpxAnalysisService` parses the raw GPX, calculates statistics (distance, elevation, speed), and identifies waypoints. The result is cached as a pickle object in MinIO. `GpxAnalysisRetrievalService` efficiently loads this pre-analyzed data, avoiding costly re-computation on every request.

*   **`auth.py` & `user_routes.py`**: These modules manage user identity, authentication (login, registration, token generation), and user profiles.

*   **`UserStatsService` & `AchievementEngine`**: These services provide user engagement features. They listen for events like `GPX_PROCESSED` on an in-memory `EventBus` to update a user's aggregate statistics (total distance, etc.) and award badges for milestones, keeping profiles up-to-date in near real-time.