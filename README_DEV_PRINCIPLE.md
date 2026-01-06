# Developer Principles & Architecture Guide

This document outlines the architectural patterns, design choices, and coding standards for the Travel Tracker codebase. It serves as a guide for maintaining consistency and understanding the system's core principles.

## 1. Backend Architecture (`server/`)

**Framework:** Python 3.11+ with **FastAPI**.

### Core Architecture: Layered & Event-Driven
The backend follows a strict **Layered Architecture** to separate concerns, utilizing an **Adapter Pattern** for infrastructure abstraction and an in-process **Event Bus** for decoupling domains.

#### 1.1. Layers
*   **Routes (`src/routes/`)**:
    *   **Responsibility**: Stateless HTTP endpoints. Handle request parsing, input validation (via Pydantic), and auth dependency injection.
    *   **Principle**: Minimal logic. Routes should immediately delegate to Controllers or Services. (Today, some routes such as auth and trip call services or adapters directly; new code should favor controllers for consistency.)
*   **Controllers (`src/controllers/`)**:
    *   **Responsibility**: Facade layer between Routes and Services. Adapts web-specific primitives (like `UploadFile`) into domain-agnostic data structures. File upload/retrieval routes already use controllers; other routes should follow this pattern over time.
*   **Services (`src/services/`)**:
    *   **Responsibility**: Core business logic (CRUD, computations, gamification).
    *   **Key Services**: `TripService`, `GpxAnalysisService`, `AchievementEngine`.
    *   **Principle**: Services must remain storage-agnostic by using the `StorageManager`.
*   **Data Access (The Adapter Pattern)**:
    *   **Responsibility**: Direct interaction with infrastructure (MongoDB, MinIO).
    *   **Components**:
        *   `StorageAdapter` (Interface): Defines contract (`save_data`, `load_data`).
        *   `MongoDBAdapter` & `MinIOAdapter`: Concrete implementations.
        *   `StorageManager`: Coordinator allowing services to access adapters by name.

#### 1.2. Design Patterns
*   **Adapter Pattern**: Used for DB/Storage abstraction (`src/utils/dbbutler`). Allows switching storage backends without changing business logic.
*   **Factory Pattern**:
    *   `AdapterFactory`: Centralizes creation of storage adapters from environment variables.
    *   `HandlerFactory`: Selects file upload strategies (`GPXHandler`, `ImageHandler`) based on file extension.
*   **Observer Pattern**: Implemented via `EventBus` (`src/events/event_bus.py`). Decouples side effects (e.g., "Award Badge") from core actions (e.g., "Upload GPX"). The Event Bus is synchronous and in-process; long-running handlers should be offloaded to async tasks or queues to avoid blocking requests.
*   **Strategy Pattern**: Used in `src/services/data_io_handlers` to vary processing logic for different file types.

#### 1.3. Coding Standards (Python)
*   **Style**: PEP 8 compliant.
*   **Typing**: Extensive use of Python Type Hints (`typing` module).
*   **Docstrings**: Strict **Google Style** format.
    ```python
    """One-line summary.

    Extended description.

    Args:
        param_name (type): Description.

    Returns:
        ReturnType: Description.
    """
    ```
*   **Models**: Heavy reliance on **Pydantic** (`src/models/`) for schema definition, validation, and serialization.
*   **GPX Analysis**: `GpxAnalysisService` uses `gpxana`, writes uploads to temp files for parsing, serializes analyzed tracks (pickled) for caching, and surfaces summaries (distance, gain, bounds, elevation profile). Treat this dependency as required for GPX workflows.
*   **MinIO Optionality**: Services initialize MongoDB first and attempt MinIO; MinIO failures are logged but do not block MongoDB CRUD. GPX/photo features require MinIO healthy.
*   **Registration Key**: `REGISTRATION_KEY` in auth routes defaults to a dev value; deployments must override via environment.

---

## 2. Frontend Architecture (`client/`)

**Framework:** React 18 (Create React App structure).

### Core Architecture: Component-Based SPA
A Single Page Application (SPA) structured around **Functional Components** and **Hooks**.

#### 2.1. Structure
*   **Views/Pages**: Top-level route containers (e.g., `TripDetailPage.js`, `TripsPage.js`). These act as **Containers**: handling data fetching and state orchestration.
*   **Components**:
    *   `layout/`: Structural shells (`Header`, `TripSidebar`).
    *   `map/`: Specialized map logic (`LeafletMapView.js`, `ImageLayer.js`).
    *   `panels/`: Interactive UI panels (`TimelinePanel.js`, `ImageGalleryPanel.js`).
*   **State Management**:
    *   **Context API**: Used for global, app-wide state like Authentication (`AuthContext.js`).
    *   **Local State**: `useState` / `useReducer` for component-specific logic.
    *   **Custom Event Bus**: The application uses native DOM events (`window.dispatchEvent`) for horizontal communication between sibling components (e.g., Timeline notifying Map).

#### 2.2. Design Patterns
*   **Container/Presentation Pattern**: Pages fetch data; child components render it.
*   **Service Module Pattern**: API logic is encapsulated in `src/services/api.js`. Components call service methods, not `axios` directly.
*   **HOC / Wrapper**: `ProtectedRoute` wraps components to enforce authentication.

#### 2.3. Coding Standards (React/JS)
*   **Components**: Functional components with Hooks (`useEffect`, `useCallback`, `useMemo`).
*   **Communication**: Use `window.dispatchEvent(new CustomEvent(...))` for decoupling Map and Sidebar interactions (e.g., `centerMapOnLocation`, `imageUploaded`).
*   **Styling**: Hybrid approach.
    *   **Tailwind CSS**: Preferred for new components (`TimelinePanel.js`).
    *   **CSS Modules/Global**: Legacy support for existing styles (`src/styles/*.css`).
*   **Event Names in Use**: `timelineScrollToItem`, `waypointNoteUpdated`, map/photo selection events (e.g., `imageUploaded`, `imageDeleted`) coordinate TripDetailPage, LeafletMapView, and panels.
*   **GPX/Timeline**: Frontend assumes one GPX per trip; TripDetailPage auto-loads the first GPX, fetches analyzed data, and merges waypoints with photos into a unified timeline.
*   **Map Layers & Rivers**: Leaflet map supports tile options (rudy map, happyman, openstreetmap). River GeoJSON loads lazily after a river selection to control payload size.

---

## 3. Key Development Guidelines

1.  **Event Bus is Critical**:
    *   **Backend**: Do not couple domains tightly. If `TripService` needs to update user stats, emit an event (`GPX_PROCESSED`) rather than importing `UserStatsService` directly if possible.
    *   **Frontend**: The Map and Sidebar are siblings. Do not lift state unnecessarily. Use custom events (`mapImageSelected`) to coordinate selection.

2.  **Hybrid Storage Management**:
    *   File operations almost always involve **two** steps: storing the blob (MinIO) and storing the metadata (MongoDB).
    *   Always use `FileUploadService` or `FileRetrievalService` which orchestrate both. Never access adapters directly from a Controller.

3.  **Safety & Persistence**:
    *   **Do not revert changes** unless explicitly requested.
    *   Tests and new files are permanent artifacts.
    *   Always verify changes with `npm start` / `uvicorn` logic or relevant tests.
    *   Validate uploads (MIME, size) and preserve user data isolation. Use FileUploadService/FileRetrievalService rather than direct adapter calls for blob + metadata flows.
