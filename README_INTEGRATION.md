# Frontend-Backend Integration Guide

This document provides a comprehensive overview of how the React frontend interacts with the Python/FastAPI backend. It details the API endpoints, data models, and communication flows that power the Travel Tracker application.

## 1. Architecture Overview

The application follows a standard client-server architecture:

-   **Frontend**: A single-page application (SPA) built with [React](https://reactjs.org/). 
    
    **Important Note on "Single-Page Application"**: The term "single-page" is a technical term that refers to the application architecture, NOT the number of views or pages the user sees. A SPA means:
    - The browser loads **one HTML file** (index.html) initially
    - React dynamically updates the content using JavaScript without full page reloads
    - The application uses client-side routing (`react-router-dom`) to navigate between different views
    - Users see different "pages" (like the trips list and trip detail pages), but technically they never leave the initial HTML page
    - Navigation between views is instant because it's handled by JavaScript, not by requesting new HTML from the server
    
    The application provides **multiple user-facing views/pages**:
    - **Trips List Page** (`/trips`): Browse, search, filter, and manage all trips
    - **Trip Detail Page** (`/trips/:tripId`): View and interact with a specific trip's map, photos, GPX tracks, and timeline
    
    All views share the same HTML document and use client-side navigation for instant transitions without page reloads. The frontend is responsible for all user interface rendering and state management, and communicates with the backend via RESTful API calls.

-   **Backend**: An API server built with [FastAPI](https://fastapi.tiangolo.com/). It handles business logic, data processing, and interactions with the storage layer (MinIO and MongoDB).

All communication happens over HTTP, with the frontend making asynchronous requests to the backend API endpoints.

### Frontend Routes and Navigation Flow

The application has the following client-side routes defined in `client/src/App.js`:

| Route | Component | Description | Navigation From |
|:------|:----------|:------------|:----------------|
| `/` | `Navigate` | Root path redirects to `/trips` | Browser address bar |
| `/trips` | `TripsPage` | List view of all trips with search, filter, sort, and bulk operations | Root redirect, "Back to My Trips" link in trip detail header, browser back button |
| `/trips/:tripId` | `TripDetailPage` | Detailed view of a single trip with interactive map, sidebar panels, and photo timeline | "View Trip" or "Open Map" buttons on trip cards, quick-switch dropdown in trip detail header |

**User Navigation Flow**:
```
Browser opens app → / → Redirects to /trips
                              ↓
                        TripsPage displays
                              ↓
                   User clicks "View Trip"
                              ↓
                    /trips/:tripId renders
                              ↓
                   TripDetailPage displays
                              ↓
              User clicks "Back to My Trips"
                              ↓
                     Returns to /trips
```

Each route renders a different React component, but all share the same HTML document (index.html). The browser's address bar updates to reflect the current route, and users can use browser back/forward buttons normally, but no new HTML pages are loaded from the server.

## 2. API Configuration

-   **Base URL**: The frontend directs all API calls to a base URL configured in `client/src/services/api.js`. This URL is determined by the `REACT_APP_API_BASE_URL` environment variable (set in `client/.env` and `client/.env.example`) and defaults to `http://localhost:5002/api`.
-   **Backend Server**: The FastAPI backend runs on `http://localhost:5002` by default (configured in `server/src/app.py` and `start-dev.sh`)
-   **CORS**: The FastAPI backend is configured with a liberal CORS (Cross-Origin Resource Sharing) policy to allow requests from any origin (`*`), which is suitable for development but should be restricted in a production environment.
-   **Data Format**: All API requests and responses use JSON format, with the exception of file uploads and multipart requests, which use `multipart/form-data`.
-   **Compression**: The backend uses GZip middleware (minimum size: 1000 bytes) to compress large responses, improving network performance for large JSON payloads and GeoJSON data.
-   **HTTP Client**: The frontend uses Axios with a configured base instance (`apiClient`) that automatically handles base URL, headers, and error handling.

## 3. API Endpoint Reference

The following sections detail the API endpoints exposed by the backend and consumed by the frontend.

### Trips API

-   **Prefix**: `/api/trips`
-   **Frontend Service**: `client/src/services/api.js` (e.g., `getTrips`, `createTrip`)
-   **Backend Router**: `server/src/routes/trip_routes.py`

| Method | Endpoint                    | Frontend Function         | Description                                                                                                        |
| :----- | :-------------------------- | :------------------------ | :----------------------------------------------------------------------------------------------------------------- |
| `POST` | `/`                         | `createTrip(tripData)`    | Creates a new trip. Expects a JSON body with trip details (`name`, `start_date`, etc.).                              |
| `POST` | `/with-gpx`                 | `createTripWithGpx(...)`  | Creates a new trip and simultaneously uploads a GPX file. The backend auto-fills trip dates from the GPX if not provided. |
| `GET`  | `/`                         | `getTrips()`              | Retrieves a list of all `Trip` objects.                                                                            |
| `GET`  | `/{trip_id}`                | `getTrip(tripId)`         | Retrieves a single `Trip` object by its ID.                                                                        |
| `PUT`  | `/{trip_id}`                | `updateTrip(id, data)`    | Updates an existing trip's details. Expects a JSON body with the fields to update.                                   |
| `DELETE` | `/{trip_id}`                | `deleteTrip(tripId)`      | Deletes a trip and all its associated files (from MinIO) and metadata (from MongoDB).                              |

### File and Data API

This covers file uploads, metadata management, and raw file retrieval.

-   **Prefixes**: `/api/map`, `/api`
-   **Frontend Service**: `client/src/services/api.js` (e.g., `uploadFile`, `listImageFiles`)
-   **Backend Routers**: `file_upload_routes.py`, `file_retrieval_routes.py`

| Method   | Endpoint                      | Frontend Function                 | Description                                                                                                                                                             |
| :------- | :---------------------------- | :-------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST`   | `/map/upload`                 | `uploadFile(file, tripId)`        | Uploads a file (image, GPX). Associates it with a `trip_id` query parameter if provided. Returns rich metadata (`UploadResponse` model) including EXIF, GPS, and analysis summaries. For GPX files, may auto-analyze and extract waypoints. |
| `GET`    | `/list-files/detail`          | `listImageFiles(tripId)`, `listGpxFilesWithMeta(tripId)` | Retrieves a detailed list of files (`FileListItem` model) for a given bucket and optional `trip_id` query parameter. Used to populate the image gallery and timeline. Required params: `bucket` (e.g., "images", "gps-data"). |
| `GET`    | `/list-files`                 | `listGpxFiles(tripId)` (internal) | Retrieves a simple list of file keys (strings) from MinIO for a given bucket. The frontend typically wraps this to use `/list-files/detail` for trip filtering. |
| `GET`    | `/images/geo`                 | `getGeotaggedImages(...)`         | Fetches a list of images (`GeotaggedImage` model) that have GPS coordinates. Query params: `bucket`, optional bounding box (`minLon`, `minLat`, `maxLon`, `maxLat`), and optional `trip_id`. Used to display photo markers on the map with optional viewport filtering. |
| `GET`    | `/files/{filename:path}`      | `getImageUrl(filename)` (constructs URL) | Retrieves the raw bytes of a file from storage. Query param: `bucket` (default: "images"). The frontend constructs direct image URLs for `<img>` tags using this endpoint pattern. |
| `GET`    | `/gpx/{filename:path}/analysis` | `fetchGpxAnalysis(filename, tripId)` | Retrieves the analyzed data for a GPX track, including the coordinate polyline, waypoints, rest points, and summary statistics (distance, elevation, etc.). Used to render the track on the map. Optional query param: `trip_id`. |
| `DELETE` | `/map/delete/{filename:path}` | `deleteFile(filename, bucket)`, `deleteImage(filename)`, `deleteGpxFile(filename)` | Deletes a file from storage (MinIO) and its associated metadata document (MongoDB). Query param: `bucket` (default: "images"). Also removes any related analysis files for GPX tracks. |
| `PATCH`  | `/photos/{metadata_id:path}/note` | `updatePhotoNote(id, noteData)` | Updates the `note` and `note_title` fields for a specific photo's metadata document. Request body: `{note: string, note_title: string}`. Used in the Timeline panel and ImageLayer popup. |
| `PATCH`  | `/photos/{metadata_id:path}/order` | `updatePhotoOrder(id, order_index)` | Updates the `order_index` for a photo's metadata, allowing for manual sorting. Request body: `{order_index: number}`. |
| `GET`    | `/map/metadata/{metadata_id:path}` | `getFileMetadata(metadataId)` | Retrieves a single `FileMetadata` document by its ID or object_key. Returns full metadata including EXIF, GPS, and custom fields. |

### GIS and Map API

-   **Prefix**: `/api/gis`
-   **Frontend Service**: `client/src/services/api.js`
-   **Backend Router**: `server/src/routes/gis_routes.py`

| Method | Endpoint         | Frontend Function  | Description                                                         |
| :----- | :--------------- | :----------------- | :------------------------------------------------------------------ |
| `GET`  | `/list_rivers`   | `listRivers()`     | Retrieves a list of available river names for the GIS map layer. Returns `List[str]`. Used to populate the checkbox list in the CategoriesPanel. |
| `GET`  | `/rivers_data`   | `riversData()`     | Retrieves a GeoJSON FeatureCollection containing all river geometries (polylines). Returns `Dict[str, Any]` with river names as keys and GeoJSON Feature objects as values. Used by LeafletMapView to render selected rivers. |
| `POST` | `/generate_gis_map` | `generateGisMap(layer, center, selectedRivers)` | (Legacy) Generates a backend-rendered map HTML with GIS overlays. Request body: `{layer: string, center: [lat, lon], selected_rivers: string[]}`. This endpoint is part of the older backend-rendering approach and may not be actively used by the current React-Leaflet implementation. |

**Note**: The current frontend implementation (`LeafletMapView.js`) uses client-side rendering with React-Leaflet. It fetches GeoJSON data via `/rivers_data` and renders it directly in the browser, rather than using `/generate_gis_map` for server-side rendering.

### Map Configuration and Utility API

-   **Prefix**: `/api/map`
-   **Frontend Service**: `client/src/services/api.js`
-   **Backend Router**: `server/src/routes/map_routes.py`

| Method | Endpoint         | Frontend Function  | Description                                                         |
| :----- | :--------------- | :----------------- | :------------------------------------------------------------------ |
| `GET`  | `/layers`        | `getMapLayers()`   | Retrieves a list of available base map tile layer names. Returns `["openstreetmap", "rudy map"]`. Used to populate layer selector in MapToolbar. |
| `GET`  | `/metadata`      | `getMapMetadata()` | Retrieves map configuration metadata including available layers and default center coordinates. Returns `{availableLayers: string[], defaultCenter: [lat, lon]}`. |
| `POST` | `/generate_map`  | `generateMap(layer, center)` | (Legacy) Generates backend-rendered map HTML using Folium. Request body: `{layer: string, center: [lat, lon]}`. This is part of the older backend-rendering approach using `MapContainer.js` and is not actively used by the current `LeafletMapView.js` implementation. |

**Note**: The legacy map generation endpoints (`/generate_map`, `/generate_gis_map`) were used in an earlier version of the application that relied on backend-rendered Folium maps. The current implementation uses React-Leaflet for client-side map rendering, which provides better interactivity and performance.

## 4. Key Interaction Flows

### Flow 0: Viewing the Trips List Page

1.  **User Action**: Navigates to `/trips` in the browser (or is redirected from `/`).
2.  **Frontend** (`TripsPage` component):
    -   Mounts and immediately calls `getTrips()` → `GET /api/trips/` to fetch all trips
    -   No initial trip_id filtering - retrieves complete list of all trips for the user/system
3.  **Backend**:
    -   `list_trips` endpoint in `trip_routes.py` calls `TripService.get_trips()`
    -   Queries the `trips` collection in MongoDB without filters
    -   Returns array of all `Trip` objects with basic metadata
4.  **Frontend** (Display and Interaction):
    -   **Trip Cards Display**: 
        -   Renders each trip as a card in grid or list view
        -   Displays trip name, dates, region, difficulty, distance, photo count, GPX status
        -   Shows cover image if set, or placeholder with "Add cover image" prompt
    -   **Search and Filter**: 
        -   Client-side filtering by name, location, notes (text search)
        -   Filters by difficulty, GPX availability, photo availability, date range
        -   All filtering happens in-browser without additional API calls for performance
    -   **Sort Options**: 
        -   Client-side sorting by newest, oldest, distance, elevation
        -   No backend API calls for sorting
    -   **Cover Image Management**:
        -   Clicking "Change cover" opens `CoverImageModal`
        -   Modal calls `listImageFiles(tripId)` → `/api/list-files/detail?bucket=images&trip_id={tripId}` to get trip photos
        -   User selects a photo, then calls `updateTrip(tripId, {cover_photo_id, cover_image_url})` → `PUT /api/trips/{tripId}` to save
    -   **Bulk Operations**:
        -   Select mode allows checking multiple trips
        -   Bulk delete calls `deleteTrip(tripId)` → `DELETE /api/trips/{tripId}` for each selected trip
        -   Archive, export, and merge operations are placeholders (not yet implemented in backend)
    -   **Navigation**: 
        -   "View Trip" button navigates to `/trips/{tripId}` using React Router's `Link` component
        -   "Open Map" button navigates to `/trips/{tripId}` with state `{focus: 'map'}`
        -   "Delete" button deletes the trip after confirmation

### Flow 1: Viewing the Trip Detail Page

1.  **User Action**: Navigates to `/trips/{tripId}` in the browser.
2.  **Frontend** (`TripDetailPage` component):
    -   Mounts and extracts `tripId` from the URL using React Router's `useParams()` hook
    -   Makes parallel API calls to fetch initial data:
        -   `getTrip(tripId)` → `/api/trips/{tripId}` to fetch the main trip details (name, dates, region, notes, etc.)
        -   `listImageFiles(tripId)` → `/api/list-files/detail?bucket=images&trip_id={tripId}` to get metadata for all images associated with the trip
        -   `listGpxFilesWithMeta(tripId)` → `/api/list-files/detail?bucket=gps-data&trip_id={tripId}` to find GPX tracks for the trip
3.  **Backend**: 
    -   `get_trip` service queries the `trips` collection in MongoDB
    -   `list_files_with_metadata` service queries the `file_metadata` collection with bucket and trip_id filters
    -   Returns JSON data to the frontend
4.  **Frontend** (Map and Timeline Rendering):
    -   **`LeafletMapView` Component**: 
        -   Receives the trip ID and initializes the interactive Leaflet map
        -   Calls `getGeotaggedImages(..., tripId)` → `/api/images/geo?bucket=images&trip_id={tripId}` to get a filterable list of geotagged images
        -   As the user pans and zooms, this function may be called again with bounding box parameters: `/api/images/geo?bucket=images&trip_id={tripId}&minLon={x1}&minLat={y1}&maxLon={x2}&maxLat={y2}` to fetch only visible markers (viewport optimization)
    -   **GPX Track Selection**: 
        -   When a GPX track is selected from the integrated GPX file list, the frontend calls `fetchGpxAnalysis(filename, tripId)` → `/api/gpx/{filename}/analysis?trip_id={tripId}` to get the parsed track data
        -   Returns: `{coordinates: [[lon, lat, elev], ...], waypoints: [...], summary: {...}, rest_points: [...]}`
    -   **`ImageLayer` Component**: 
        -   Renders photo markers on the map using the geotagged image data
        -   Each marker is clickable and displays a popup with photo thumbnail, notes, and edit controls
    -   **GPX Rendering**: 
        -   The LeafletMapView directly renders GPX tracks as React-Leaflet `<Polyline>` components using the coordinate data
        -   Waypoints are rendered as `<Marker>` components with custom icons
    -   **`TimelinePanel` Component**: 
        -   Merges photos and GPX waypoints from `gpxTracks` state into a unified chronological timeline
        -   Sorts all items by timestamp (photo capture time or waypoint time)
        -   Renders cards for each item with type icons (📷 for photos, 📍 for waypoints)
        -   Supports inline editing of notes with Markdown formatting

### Flow 2: Uploading a Photo

1.  **User Action**: On the `TripDetailPage`, the user clicks "Upload Photo" in the `UploadPanel` or "Add Photo" button in the `TimelinePanel` and selects a photo file from their computer.
2.  **Frontend**:
    -   The `UploadPanel` or `TimelinePanel` component triggers the `uploadFile(file, tripId)` function from `client/src/services/api.js`
    -   A `FormData` object is created containing the file
    -   The current `trip_id` is passed as a query parameter: `/api/map/upload?trip_id={tripId}`
    -   An HTTP `POST` request is sent to `/api/map/upload` with `Content-Type: multipart/form-data`
3.  **Backend** (`file_upload_routes.py` → `FileUploadService`):
    -   The `upload_file` endpoint receives the file and `trip_id` query parameter
    -   Calls `FileUploadService.save_file(file, trip_id)` to process the file:
        -   Detects file type (image vs. GPX) based on extension and MIME type
        -   For **images**:
            -   Extracts EXIF data including GPS coordinates (`GPSInfo`), capture timestamp (`DateTimeOriginal`), camera model, etc.
            -   Generates a unique object key (filename with UUID prefix)
            -   Saves the raw file to the `images` bucket in MinIO using boto3
            -   Creates a `FileMetadata` document with extracted information, `trip_id`, GPS coordinates, and original filename
            -   Saves metadata to the `file_metadata` collection in MongoDB
        -   For **GPX files**:
            -   Parses GPX XML to extract tracks, waypoints, and metadata
            -   Performs track analysis (distance, elevation, speed, rest points)
            -   Saves original GPX to `gps-data` bucket
            -   Saves analyzed data as JSON to `gps-analysis-data` bucket
            -   Creates metadata documents for both files with references
    -   Returns a JSON response with the newly created metadata, GPS info, and analysis summary
4.  **Frontend** (State Update and UI Refresh):
    -   Upon receiving a successful response (HTTP 200/201), the component:
        -   Updates local state with the new photo/file data
        -   Dispatches global DOM events to notify other components:
            -   `window.dispatchEvent(new CustomEvent('imageUploaded', {detail: {...}}))`
            -   `window.dispatchEvent(new CustomEvent('imageUploadedWithGPS', {detail: {...}}))` (if photo has GPS)
        -   Components listening for these events automatically refresh:
            -   `ImageGalleryPanel`: Reloads the photo grid
            -   `ImageLayer`: Adds a new marker to the map without page reload
            -   `TimelinePanel`: Inserts the new photo into the chronological timeline
        -   The trip statistics counter (photo count) is updated
        -   User sees immediate feedback with the new photo appearing in the gallery, on the map, and in the timeline

### Flow 3: Editing Photo Notes

1.  **User Action**: User clicks on a photo marker on the map or clicks "Edit" on a photo card in the timeline.
2.  **Frontend**:
    -   For **map popup editing** (`ImageLayer.js`):
        -   Popup displays a text area with existing note content
        -   User types or edits the note
        -   Clicks "Save" button in the popup
    -   For **timeline editing** (`TimelinePanel.js`):
        -   Card expands to show inline editor with title and note fields
        -   Note field supports Markdown formatting
        -   User clicks "Save" button on the card
    -   Either component calls `updatePhotoNote(metadataId, {note, note_title})` → `PATCH /api/photos/{metadataId}/note`
3.  **Backend** (`file_retrieval_routes.py` → `FileMetadataService`):
    -   Locates the `FileMetadata` document by `metadata_id` or `object_key`
    -   Updates the `note` and `note_title` fields using MongoDB `$set` operator
    -   Returns the updated metadata document
4.  **Frontend** (Cross-Component Synchronization):
    -   Updates local state with the new note content
    -   Dispatches `photoNoteUpdated` event: `window.dispatchEvent(new CustomEvent('photoNoteUpdated', {detail: {object_key, note, note_title}}))`
    -   Both `ImageLayer` and `TimelinePanel` listen for this event:
        -   **ImageLayer**: Updates the popup content for the marker if it's open
        -   **TimelinePanel**: Updates the card content to reflect the new note
    -   User sees the updated note immediately in both the map popup and timeline card without page reload

### Flow 4: Selecting and Displaying GPX Tracks

1.  **User Action**: On the `TripDetailPage`, user clicks on a GPX file checkbox in the map's GPX panel.
2.  **Frontend** (`LeafletMapView.js`):
    -   The `handleGpxSelect` callback is triggered with the GPX file's `object_key`
    -   Checks if the track is already selected:
        -   If selected: Removes it from `selectedGpxFiles` state and `gpxTracks` state, track disappears from map
        -   If not selected: Adds it to `selectedGpxFiles` state and fetches track data
    -   Calls `fetchGpxAnalysis(objectKey, tripId)` → `GET /api/gpx/{objectKey}/analysis?trip_id={tripId}`
3.  **Backend** (`file_retrieval_routes.py` → `GpxAnalysisService`):
    -   Looks up the GPX file metadata to find the associated analysis file
    -   Reads the analyzed JSON data from the `gps-analysis-data` bucket in MinIO
    -   Returns: `{coordinates: [[lon, lat, elev], ...], waypoints: [{lat, lon, elev, time, name, note}, ...], summary: {distance_km, duration_hours, avg_speed, elevation_gain, elevation_loss, highest_point, lowest_point}, rest_points: [{lat, lon, start_time, end_time, duration_minutes}, ...]}`
4.  **Frontend** (Map Rendering):
    -   Stores the track data in `gpxTracks` state: `{[objectKey]: {coordinates, waypoints, summary, rest_points, displayName}}`
    -   React-Leaflet automatically re-renders:
        -   **Track polyline**: `<Polyline positions={coordinates.map(([lon, lat]) => [lat, lon])} color={trackColor} />`
        -   **Waypoint markers**: For each waypoint, `<Marker position={[lat, lon]} icon={waypointIcon}><Popup>...</Popup></Marker>`
        -   **Auto-centering**: Calls `map.fitBounds()` to zoom the map to show the entire track
    -   **Timeline Integration**: Waypoints are automatically extracted and merged into the timeline:
        -   `trackWaypoints` memo computes waypoints from all loaded tracks
        -   `timelineItems` memo merges photos and waypoints, sorts chronologically
        -   Timeline displays waypoint cards with 📍 icon alongside photo cards

### Flow 5: Managing River Overlays

1.  **User Action**: Opens the `CategoriesPanel` in the sidebar and checks/unchecks river names.
2.  **Frontend** (`CategoriesPanel.js`):
    -   On mount, calls `listRivers()` → `GET /api/gis/list_rivers` to get available river names
    -   Displays rivers as a searchable checkbox list
    -   User checks/unchecks boxes, updating `selectedRivers` state (array of river names)
    -   This state is passed up to `TripDetailPage` and down to `LeafletMapView`
3.  **Backend** (Initial Load Only):
    -   `list_rivers` endpoint queries the GIS data source (hardcoded data or database) and returns a list of river names
    -   Frontend also calls `riversData()` → `GET /api/gis/rivers_data` once to fetch all river GeoJSON geometries
    -   Returns: `{riverName1: {type: "Feature", geometry: {...}, properties: {...}}, riverName2: {...}, ...}`
4.  **Frontend** (Client-Side Filtering and Rendering):
    -   `LeafletMapView` receives `selectedRivers` array and `riverGeoJSON` data
    -   Filters the GeoJSON to only include selected rivers: `selectedRivers.filter(name => riverGeoJSON[name])`
    -   For each selected river, renders a React-Leaflet `<GeoJSON>` component:
        ```jsx
        {selectedRivers.map(riverName => (
          riverGeoJSON[riverName] && 
          <GeoJSON key={riverName} data={riverGeoJSON[riverName]} style={{color: 'blue', weight: 2}} />
        ))}
        ```
    -   Rivers appear/disappear instantly as user checks/unchecks boxes (pure client-side rendering, no backend calls)

## 5. Data Models

### Trip Model
```json
{
  "id": "uuid-string",
  "name": "Trip Name",
  "start_date": "2025-01-01T00:00:00",
  "end_date": "2025-01-05T00:00:00",
  "region": "Region/Location Name",
  "notes": "Optional trip notes",
  "cover_photo_id": "optional-image-object-key",
  "cover_image_url": "optional-url",
  "cover_type": "custom|auto",
  "created_at": "2025-11-29T07:56:01.868013",
  "difficulty": "easy|moderate|hard",
  "distance_km": 25.5,
  "elevation_gain": 1200,
  "has_gpx": true,
  "photo_count": 42
}
```

### FileMetadata Model
```json
{
  "_id": "mongodb-object-id",
  "object_key": "unique-filename.jpg",
  "bucket": "images",
  "trip_id": "uuid-string",
  "original_filename": "IMG_1234.JPG",
  "content_type": "image/jpeg",
  "size_bytes": 2456789,
  "uploaded_at": "2025-01-15T10:30:00",
  "metadata": {
    "gps": {
      "latitude": 24.12345,
      "longitude": 121.54321,
      "altitude": 850.5
    },
    "captured_at": "2025-01-03T14:25:00",
    "date_taken": "2025-01-03T14:25:00",
    "camera_model": "iPhone 13 Pro",
    "image_width": 4032,
    "image_height": 3024,
    "note": "Beautiful mountain view",
    "note_title": "Summit Photo",
    "order_index": 5,
    "thumb_url": "optional-thumbnail-url",
    "analysis_object_key": "for-gpx-files.json",
    "analysis_bucket": "gps-analysis-data"
  }
}
```

### GeotaggedImage Model (API Response)
```json
{
  "object_key": "unique-filename.jpg",
  "original_filename": "IMG_1234.JPG",
  "lat": 24.12345,
  "lon": 121.54321,
  "metadata_id": "mongodb-object-id",
  "thumb_url": "optional-thumbnail-url",
  "captured_at": "2025-01-03T14:25:00",
  "note": "Beautiful mountain view"
}
```

### GPX Analysis Model (API Response)
```json
{
  "coordinates": [[121.54321, 24.12345, 850.5], ...],
  "waypoints": [
    {
      "lat": 24.12345,
      "lon": 121.54321,
      "elev": 850.5,
      "time": "2025-01-03T14:25:00",
      "name": "Summit",
      "note": "Highest point",
      "desc": "Description"
    }
  ],
  "summary": {
    "distance_km": 25.5,
    "duration_hours": 8.5,
    "avg_speed_kmh": 3.0,
    "elevation_gain_m": 1200,
    "elevation_loss_m": 1150,
    "highest_point_m": 3952,
    "lowest_point_m": 2800
  },
  "rest_points": [
    {
      "lat": 24.11111,
      "lon": 121.52222,
      "start_time": "2025-01-03T12:00:00",
      "end_time": "2025-01-03T12:45:00",
      "duration_minutes": 45
    }
  ],
  "source": "gps-data/filename.gpx",
  "display_name": "Morning Hike"
}
```

## 6. Event-Based Communication

The frontend uses custom DOM events for cross-component communication without tight coupling:

| Event Name | Dispatched By | Listened By | Payload | Purpose |
|:-----------|:--------------|:------------|:--------|:--------|
| `imageUploaded` | UploadPanel, TimelinePanel | ImageGalleryPanel, TimelinePanel | `{object_key, trip_id}` | Notify that a new image was uploaded |
| `imageUploadedWithGPS` | UploadPanel | ImageLayer | `{object_key, lat, lon, trip_id}` | Notify that a geotagged image was uploaded |
| `imageDeleted` | ImageGalleryPanel, TimelinePanel | ImageLayer, TimelinePanel | `{object_key}` | Notify that an image was deleted |
| `photoNoteUpdated` | ImageLayer, TimelinePanel | ImageLayer, TimelinePanel | `{object_key, note, note_title}` | Notify that a photo's note was updated |
| `centerMapOnLocation` | TimelinePanel, ImageGalleryPanel | LeafletMapView, ImageLayer | `{lat, lng, object_key}` | Request map to center on specific location |
| `mapImageSelected` | ImageLayer | TripDetailPage, TimelinePanel | `{object_key, lat, lon, metadata_id}` | Notify that a photo marker was clicked on map |

Example event dispatch:
```javascript
window.dispatchEvent(new CustomEvent('imageUploaded', {
  detail: { object_key: 'photo123.jpg', trip_id: 'trip-uuid' }
}));
```

Example event listener:
```javascript
useEffect(() => {
  const handler = (event) => {
    const { object_key, trip_id } = event.detail;
    // Handle the event
  };
  window.addEventListener('imageUploaded', handler);
  return () => window.removeEventListener('imageUploaded', handler);
}, []);
```

## 7. Error Handling

### Frontend Error Handling
-   All API calls in `client/src/services/api.js` are wrapped in try-catch blocks
-   Axios interceptors can be configured for global error handling
-   Individual components display user-friendly error messages via alerts or toast notifications
-   Network errors, timeout errors, and HTTP errors are logged to console for debugging

### Backend Error Handling
-   FastAPI automatically validates request data against Pydantic models and returns 422 Unprocessable Entity for validation errors
-   Custom exception handling for specific error cases (404 Not Found, 500 Internal Server Error)
-   File upload errors include detailed messages (unsupported format, missing EXIF, etc.)
-   MongoDB connection errors are caught and logged
-   MinIO/S3 errors (bucket not found, access denied) are wrapped in HTTPException with appropriate status codes

## 8. Performance Optimizations

### Backend
-   **GZip Compression**: Responses >1KB are automatically compressed
-   **MinIO Direct Access**: Files are served directly from MinIO storage with efficient streaming
-   **MongoDB Indexing**: Indexes on `trip_id`, `bucket`, `metadata.gps` for fast queries
-   **GPX Analysis Caching**: Analyzed GPX data is stored as JSON files, avoiding re-parsing on every request
-   **Bounding Box Filtering**: `/images/geo` endpoint supports spatial filtering to return only photos in the current map viewport

### Frontend
-   **Lazy Loading**: Timeline and gallery load images on-demand using intersection observer
-   **Viewport Optimization**: Map only fetches geotagged images within the visible bounding box when zooming/panning
-   **React Memoization**: `useMemo` and `useCallback` used extensively to prevent unnecessary re-renders
-   **Event Debouncing**: Map pan/zoom events are debounced to reduce API calls
-   **Client-Side Rendering**: GeoJSON rivers and GPX tracks are rendered client-side, avoiding server round-trips for layer toggles

## 9. Security Considerations

### Current Implementation (Development)
-   **CORS**: Allows all origins (`*`) - suitable for development only
-   **Authentication**: None implemented - all endpoints are publicly accessible
-   **File Upload**: Limited validation on file types and sizes

### Production Recommendations
-   Restrict CORS to specific frontend origins
-   Implement authentication (JWT, OAuth2, API keys)
-   Add rate limiting on upload endpoints
-   Validate and sanitize all file uploads (size limits, virus scanning)
-   Use HTTPS for all communication
-   Implement user-based authorization (trips belong to users, users can only access their own data)
-   Add input validation and sanitization for all user-provided text fields
-   Secure MinIO with proper IAM policies and bucket policies

## 10. Testing the Integration

### Manual API Testing with curl

You can test the backend API endpoints directly using curl:

```bash
# Test backend health (FastAPI docs)
curl http://localhost:5002/docs

# List all trips
curl http://localhost:5002/api/trips/

# Create a new trip
curl -X POST http://localhost:5002/api/trips/ \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Trip","start_date":"2025-01-01","end_date":"2025-01-05","region":"Taiwan"}'

# Get a specific trip (replace {trip_id} with actual ID)
curl http://localhost:5002/api/trips/{trip_id}

# Update a trip
curl -X PUT http://localhost:5002/api/trips/{trip_id} \
  -H "Content-Type: application/json" \
  -d '{"notes":"Updated notes"}'

# List geotagged images
curl "http://localhost:5002/api/images/geo?bucket=images"

# List image files with metadata
curl "http://localhost:5002/api/list-files/detail?bucket=images"

# List GPX files
curl "http://localhost:5002/api/list-files/detail?bucket=gps-data"

# Get GPX analysis
curl "http://localhost:5002/api/gpx/{filename}/analysis"

# List rivers
curl http://localhost:5002/api/gis/list_rivers

# Get map layers
curl http://localhost:5002/api/map/layers

# Upload a file (image or GPX)
curl -X POST "http://localhost:5002/api/map/upload?trip_id={trip_id}" \
  -F "file=@/path/to/image.jpg"

# Delete a file
curl -X DELETE "http://localhost:5002/api/map/delete/{filename}?bucket=images"
```

### Testing Full Integration

To test the complete frontend-backend integration:

1. **Start the development environment:**
   ```bash
   ./start-dev.sh
   ```

2. **Verify services are running:**
   - Backend API: http://localhost:5002/docs (FastAPI Swagger UI)
   - Frontend: http://localhost:3000
   - MongoDB: localhost:27017
   - MinIO: http://localhost:9000 (Console: http://localhost:9001)

3. **Test the complete user flow:**
   - Navigate to http://localhost:3000
   - Create a new trip from the trips list page
   - Open the trip detail page
   - Upload a GPX track file
   - Upload geotagged photos
   - Verify photos appear on the map and in the timeline
   - Click on photo markers on the map
   - Edit photo notes in the timeline or map popup
   - Toggle river overlays in the categories panel
   - Delete photos and verify they disappear from all views

4. **Monitor logs:**
   ```bash
   # Backend logs
   tail -f backend.log
   
   # Frontend logs
   tail -f frontend.log
   
   # Or view in real-time
   docker-compose logs -f
   ```

5. **Check database state:**
   ```bash
   # Connect to MongoDB
   docker exec -it mongodb mongosh travel_tracker
   
   # List trips
   db.trips.find()
   
   # List file metadata
   db.file_metadata.find()
   ```

6. **Check MinIO storage:**
   - Open http://localhost:9001 in browser
   - Login with minioadmin/minioadmin
   - Browse the `images`, `gps-data`, and `gps-analysis-data` buckets

### Common Integration Issues

1. **CORS Errors**: If you see CORS errors in the browser console, verify that:
   - Backend is running on port 5002
   - Frontend is configured to use `http://localhost:5002/api` as base URL
   - Backend CORS middleware is configured correctly

2. **404 Not Found**: If API calls return 404:
   - Check that the endpoint path matches the backend routes
   - Verify the API prefix (`/api`) is included in the URL
   - Check the backend logs for routing errors

3. **File Upload Failures**: If uploads fail:
   - Verify MinIO is running and accessible
   - Check that buckets exist (images, gps-data, gps-analysis-data)
   - Ensure file size is within limits
   - Check backend logs for EXIF parsing or MinIO connection errors

4. **Missing Photos on Map**: If photos don't appear on the map:
   - Verify photos have GPS coordinates in EXIF data
   - Check that `getGeotaggedImages` API returns the photos
   - Look for JavaScript errors in browser console
   - Verify ImageLayer component is mounted and listening for events

5. **Timeline Not Updating**: If timeline doesn't refresh after upload:
   - Check that `imageUploaded` events are being dispatched
   - Verify event listeners are attached in useEffect hooks
   - Check component mount/unmount lifecycle
   - Look for errors in the component's update logic
