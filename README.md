# Travel Tracker

Travel Tracker lets outdoor enthusiasts upload trips, visualize GPX tracks, overlay rich GIS layers, and manage photo timelines from one browser-based workspace. The stack pairs a React SPA with a FastAPI backend, MongoDB metadata store, and MinIO object storage—packaged for both host-based development and fully containerized deployments.

## Table of Contents

1. [Features](#features)
2. [Architecture](#architecture)
3. [Repository Layout](#repository-layout)
4. [Development Workflows](#development-workflows)
5. [Configuration](#configuration)
6. [Database & Storage Setup](#database--storage-setup)
7. [Testing](#testing)
8. [API Documentation](#api-documentation)
9. [Operations Reference](#operations-reference)
10. [Troubleshooting](#troubleshooting)
11. [Roadmap](#roadmap)
12. [Contributing & License](#contributing--license)

## Features

### GPX Track Visualization

- Upload GPX files (via UI or API) and render interactive polylines on the Leaflet map.
- Auto-center to track extents, inspect distance, elevation gain, and elevation profiles via the `TripStatsHUD` overlay.
- Persist processed GPX analysis artifacts for fast reloads.

### River Network Display

- Ship with a 1,600+ river dataset stored in MinIO `gis-data`.
- Search, multi-select, and color code rivers client-side without extra API calls.
- Toggle overlays alongside GPX tracks for combined analysis.

### Map Experience

- Multiple base layers (OpenStreetMap, Taiwan-focused Rudy Map, Mapbox tokenized styles).
- Layer switcher, zoom/pan, responsive layout, and custom markers.
- Optional cached GeoJSON endpoints for fast GIS overlays.

### Photo & Timeline Tools

- Upload, geotag, and view photos directly on the map and in gallery/timeline panels.
- Manage notes, metadata, and ordering with inline edits.
- Fullscreen viewer with keyboard navigation and map syncing.

### Status & Health

- Swagger docs exposed at `/docs` with <100 ms response times for most endpoints.
- MinIO console at `:9001` for storage inspection; scripts available for health verification.

### Not Yet Implemented (Tracked Work)

- In-map GPX polyline styling from EXIF timestamps.
- Automatic photo markers + thumbnails.
- Authenticated user flows and upload size limits.

## Architecture

- **Frontend (React/Leaflet/Tailwind)** → served via Vite dev server locally or Nginx in Docker.
- **Backend (FastAPI + Uvicorn)** → REST API, GPX parsing, EXIF extraction, stats, and event bus.
- **MongoDB** → trip metadata, user profiles, file metadata, photo notes.
- **MinIO S3 storage** → buckets for `gps-data`, `gps-analysis-data`, `images`, `gis-data`.
- **Storage adapters** → AdapterFactory issues MongoDB/MinIO clients wrapped by `StorageManager`.
- **Docker network (`travel-tracker-network`)** → isolates backend, DB, storage; only frontend port 80 exposed in full stack mode while backend stays internal.

## Repository Layout

```text
travel-tracker/
├── client/                  # React SPA (src/components, contexts, services, styles)
├── server/                  # FastAPI app (routes, services, adapters, tests)
├── databases/               # MinIO + Mongo DB setup scripts & docs
├── docker-compose.dbonly.yml# MongoDB+MinIO only (host-run backend/frontend)
├── docker-compose.build.yml # Full stack build for local prod-like testing
├── docker-compose.prod.yml  # Production deployment baseline
├── start-dev.sh / stop-dev.sh / verify-setup.sh
├── README_*.md              # Deep dives per subsystem
└── ...
```

## Development Workflows

### Option A – `./start-dev.sh`

Runs the batteries-included flow:

```bash
./start-dev.sh
```

What it does:

- Verifies Docker is running and launches MongoDB + MinIO (reuses containers if already created).
- Waits for ports `27017` and `9000`, then bootstraps buckets (via `minio-setup`).
- Starts FastAPI via `uvicorn src.app:app --port 5002 --reload` (background, logs in `backend.log`).
- Starts React dev server on port `3000` (logs in `frontend.log`).
- Writes `backend.pid`/`frontend.pid` for `stop-dev.sh`.

URLs: `http://localhost:3000` (UI) and `http://localhost:5002/docs` (API docs).

### Option B – Host Backend/Frontend + Dockerized Datastores

1. Start MongoDB + MinIO only:

   ```bash
   docker-compose -f docker-compose.dbonly.yml up -d
   ```

2. Seed buckets (once):

   ```bash
   cd databases/minio && ./setup-buckets.sh && cd ../..
   ```

3. Backend (from `server/`):

   ```bash
   python -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   uvicorn src.app:app --host 0.0.0.0 --port 5002 --reload
   ```

4. Frontend (from `client/`):

   ```bash
   npm install
   npm start  # http://localhost:3000 talks to http://localhost:5002/api
   ```

### Option C – Full Containerized Stack (local)

Build and run everything (frontend served via Nginx on host port 80, backend/internal 8000):

```bash
docker-compose -f docker-compose.build.yml up -d --build
```

- Named volumes: `mongo_data`, `mongo_config`, `minio_data`.
- Health checks gate backend until MongoDB + MinIO + bucket job are ready.
- MinIO console exposed on `${MINIO_CONSOLE_PORT:-9001}` for convenience.
- Tear down: `docker-compose -f docker-compose.build.yml down` (add `-v` to wipe data).

### Option D – Production Compose

For CI/CD or server deployments:

1. Prepare `.env.production` (sample: `.env.production.example`). Needs `MONGODB_USERNAME/Password`, `MINIO_ACCESS_KEY/SECRET_KEY`, `FRONTEND_PORT`, `VERSION` tag, etc.
2. Build & deploy:

   ```bash
   ./build.sh --version 1.0.0
   ./deploy.sh --version 1.0.0          # local
   ./deploy.sh --remote user@host --version 1.0.0
   ```

3. Compose file: `docker-compose.prod.yml` (MinIO console closed by default—uncomment ports if needed).

## Configuration

### Backend (`server/.env`)

```env
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_SECURE=false
MONGODB_HOST=localhost
MONGODB_PORT=27017
MONGODB_DATABASE=travel_tracker
SECRET_KEY=change_me
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REGISTRATION_KEY=admin_secret_key
ALLOWED_ORIGINS=*
```

`AdapterFactory` consumes these values to configure MongoDB and MinIO clients. Override via env vars when running in Docker.

### Frontend (`client/.env`)

```env
REACT_APP_API_BASE_URL=http://localhost:5002/api
REACT_APP_MAPBOX_TOKEN=your_optional_token
```

When building Docker images, `REACT_APP_API_BASE_URL` is set to `/api` so Nginx can reverse-proxy to FastAPI internally.

### Compose Overrides

- `FRONTEND_PORT` → host port for Nginx (defaults to 80).
- `MINIO_CONSOLE_PORT` → host port for MinIO console (defaults to 9001 in build file, disabled in prod).
- `MONGODB_USERNAME/MONGODB_PASSWORD` → seeded admin credentials for MongoDB container.

## Database & Storage Setup

1. **Buckets**: run `databases/minio/setup-buckets.sh` (calls `mc alias set ...`, creates `gps-data`, `gps-analysis-data`, `images`, `gis-data`, applies anonymous read policies, optionally uploads reference GIS pickles).
2. **Verification**:

   ```bash
   mc ls myminio/
   curl http://localhost:9000/minio/health/live
   docker exec -it mongodb mongosh --eval "db.adminCommand('ping')"
   ```

3. **Backend config**: ensure `.env` points at `localhost` endpoints when running outside Docker or `storage:9000`/`database:27017` in containers.

## Testing

- **Backend**:

   ```bash
   cd server
   source venv/bin/activate
   pytest
   ```

- **Frontend**:

   ```bash
   cd client
   npm test
   ```

- **End-to-end / scripts**: see `verify-setup.sh`, `test_annotation_feature.sh`, `test_search_feature.sh`, `TEST_RESULTS_20251030.md` for curated scenarios.

## API Documentation

The backend API reference is automatically generated from docstrings using [Sphinx](https://www.sphinx-doc.org/).

To build the documentation locally:

1.  **Install dependencies:**

    ```bash
    pip install -r docs/requirements.txt
    ```

2.  **Build the HTML site:**

    ```bash
    python3 -m sphinx -b html docs docs/build
    ```

The generated documentation will be available in the `docs/build` directory. You can open `docs/build/index.html` in your browser to view it.

## Operations Reference

- **Health check**:

   ```bash
   curl -s http://localhost:5002/api/map/layers && \
   curl -s http://localhost:3000 | grep -q "React" && \
   docker ps | grep -q minio && \
   echo "✅ All services are running!"
   ```

- **Useful compose commands**:
   - `docker-compose -f docker-compose.build.yml logs -f backend`
   - `docker-compose -f docker-compose.build.yml ps`
   - `docker-compose -f docker-compose.dbonly.yml down -v` (full reset)

- **MinIO client**:

   ```bash
   mc ls myminio/images/
   mc cp photo.jpg myminio/images/
   mc du myminio/gis-data
   mc rm myminio/images/photo.jpg
   ```

- **Scripts**: `stop-dev.sh` (kills pid files, stops npm/uvicorn), `security-verify.sh` (baseline security scan), `deploy.sh` (local/remote), `build.sh` (versioned image build).

## Troubleshooting

- **Backend port busy (5002)** → `lsof -i :5002` to find stray uvicorn.
- **MinIO console “Network Error”** → wait for health endpoint or check container logs `docker logs minio`.
- **Bucket setup fails** → ensure `mc` installed and reachable, or pass custom path to `setup-buckets.sh`.
- **Frontend cannot reach API** → confirm `REACT_APP_API_BASE_URL`, check browser console CORS messages, verify FastAPI CORS config allows origin.
- **Docker build cache issues** → `docker-compose -f docker-compose.build.yml build --no-cache`.

## Roadmap

- ✅ Docker-based infrastructure & health guards.
- ✅ MinIO adapters + MongoDB storage pattern.
- ✅ GPX upload + EXIF parsing.
- ⚙ Photo markers + gallery revamp.
- ⚙ GPX editing tools and export pipelines.
- 🔐 Authentication and user limits.
- 📱 Future: mobile client, real-time tracking, cloud storage integrations.

## Contributing & License

Contributions welcome! Please:

1. Fork and branch (`git checkout -b feature/awesome`).
2. Add tests/docs.
3. Submit PR with clear description + screenshots/logs when relevant.

Licensed under the MIT License. See `LICENSE` for details.

## Support & Links

- Issues: <https://github.com/PenHsuanWang/travel-tracker/issues>
- Docs: `QUICK_START.md`, `README_BACKEND_DB.md`, `README_FRONTEND.md`, `README_INTEGRATION.md`, `DOCKER_ARCHITECTURE_DIAGRAM.md`
- Scripts & automation: `start-dev.sh`, `stop-dev.sh`, `verify-setup.sh`

**Last Updated:** December 4, 2025 – aligned with Docker Compose build/prod files, MinIO bucket automation, and current frontend/backend defaults.
