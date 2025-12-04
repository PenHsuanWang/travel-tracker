# Travel Tracker Backend

This is the backend for the Travel Tracker application, built with Python and FastAPI. It handles data processing, storage, and serves the REST API consumed by the frontend.

## 1. Project Structure

```
server/
├── Dockerfile
├── pyproject.toml
├── requirements.txt
├── .env.example
├── .env
├── src/
│   ├── app.py            # FastAPI application entry point
│   ├── auth.py           # Authentication logic
│   ├── routes/           # API endpoint definitions
│   │   ├── trip_routes.py
│   │   └── ...
│   ├── services/         # Business logic
│   │   ├── trip_service.py
│   │   ├── file_upload_service.py
│   │   └── ...
│   ├── models/           # Pydantic data models
│   │   ├── trip.py
│   │   └── ...
│   └── utils/            # Utility modules
│       ├── adapter_factory.py
│       └── dbbutler/
│           ├── minio_adapter.py
│           └── mongodb_adapter.py
└── tests/
```

## 2. Setup and Running

There are two primary ways to run the backend: as a standalone service for development or as part of a Dockerized stack.

### A. Local Development

This method is recommended for backend development, as it allows for hot-reloading.

**Prerequisites:**
- Python 3.9+
- An active virtual environment (`python -m venv venv`)

**Steps:**

1.  **Install Dependencies:**
    ```bash
    pip install -r requirements.txt
    ```

2.  **Configure Environment:**
    Copy the environment variable template and fill in the required values.
    ```bash
    cp .env.example .env
    ```
    Ensure your `.env` file contains the correct credentials, especially for MinIO:
    ```dotenv
    MINIO_ENDPOINT=localhost:9000
    MINIO_ACCESS_KEY=minioadmin
    MINIO_SECRET_KEY=minioadmin
    MINIO_SECURE=False
    ```

3.  **Run the Server:**
    From the `server/` directory, run:
    ```bash
    uvicorn src.app:app --host 0.0.0.0 --port 5002 --reload
    ```
    The API will be available at `http://localhost:5002`.

### B. Docker

The backend can also be run as a Docker container, which is how it operates in the production-like environment.

1.  **Build the Image:**
    From the project root (`travel-tracker/`), run:
    ```bash
    docker-compose -f docker-compose.build.yml build backend
    ```

2.  **Run the Full Stack:**
    The backend is designed to run as part of the full stack defined in `docker-compose.build.yml`.
    ```bash
    docker-compose -f docker-compose.build.yml up -d
    ```
    In this setup, the backend is not exposed directly to the host. It communicates with the other services over the internal Docker network.

## 3. Environment Variables

The backend is configured via environment variables, loaded from `server/.env` during local development.

| Variable | Description | Default (Dev) |
|---|---|---|
| `PORT` | The port the server listens on. | `5002` |
| `MINIO_ENDPOINT` | The address of the MinIO server. | `localhost:9000` |
| `MINIO_ACCESS_KEY` | The access key for MinIO. | `minioadmin` |
| `MINIO_SECRET_KEY` | The secret key for MinIO. | `minioadmin` |
| `MINIO_SECURE` | Whether to use HTTPS for MinIO. | `False` |
| `MONGODB_HOST` | The hostname of the MongoDB server. | `localhost` |
| `MONGODB_PORT` | The port for the MongoDB server. | `27017` |
| `MONGODB_DATABASE` | The name of the database to use. | `travel_tracker` |
| `SECRET_KEY` | A secret string for signing JWTs. | `your_super_secret_key...` |
| `ALGORITHM` | The algorithm for JWT signing. | `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | The lifespan of a JWT access token. | `30` |
| `REGISTRATION_KEY`| Secret key required for user registration. |`admin_secret_key`|

## 4. API Endpoints

The API is self-documenting. Once the server is running, you can access the interactive Swagger UI documentation at:

**http://localhost:5002/docs**

This interface provides a complete and detailed list of all available endpoints, their parameters, and response models.

## 5. Dependencies

All project dependencies are listed in `requirements.txt`. Key libraries include:
- `fastapi`: The web framework.
- `uvicorn`: The ASGI server.
- `python-dotenv`: For loading environment variables.
- `pymongo`: The driver for MongoDB.
- `minio`: The official client for MinIO/S3.
- `gpxpy`: For parsing GPX files.
- `passlib`: For password hashing.
- `python-jose`: For JWT handling.
