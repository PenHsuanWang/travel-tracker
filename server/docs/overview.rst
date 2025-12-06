Welcome to the Travel Tracker Backend
=====================================

This documentation provides a technical guide for developers working with or consuming the Travel Tracker backend API.

The backend is a `FastAPI <https://fastapi.tiangolo.com/>`_ application that serves as the brain for the Travel Tracker project, handling data processing, storage, and business logic. It provides a comprehensive REST API consumed by the React-based frontend.

Core Technologies
-----------------

*   **Framework**: `FastAPI <https://fastapi.tiangolo.com/>`_ for high-performance, asynchronous request handling.
*   **Data Models**: `Pydantic <https://docs.pydantic.dev/>`_ for robust data validation and serialization.
*   **Metadata Storage**: `MongoDB <https://www.mongodb.com/>`_ for storing structured data like trip details, user profiles, and file metadata.
*   **File Storage**: `MinIO <https://min.io/>`_ (S3-compatible) for storing binary objects like GPX tracks and images.
*   **Authentication**: JWT-based authentication using `python-jose <https://python-jose.readthedocs.io/>`_.

How to Use This Documentation
-----------------------------

*   **:doc:`api_workflows`**: Provides practical, step-by-step guides for executing common tasks using the API, such as uploading files or creating trips. This is the best place to start for frontend developers.
*   **:doc:`backend_logic`**: A deep-dive into the internal architecture of the backend, explaining the service layer, storage adapters, and core design patterns. Ideal for new backend developers.
*   **:doc:`api/index`**: The complete, auto-generated API reference, with details on every endpoint, model, and function, extracted directly from the source code's docstrings. Use this for specific details and parameter reference.