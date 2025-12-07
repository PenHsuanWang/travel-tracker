Core API Workflows
====================

This section provides a developer-focused guide to common workflows, demonstrating how to interact with the API to perform key tasks.

Workflow: Uploading a Geotagged Photo
-------------------------------------

This workflow adds a photo to a specific trip. The backend processes the image, extracts GPS data from EXIF metadata, and makes it available for display on the map.

1.  **Authenticate**: Obtain a JWT access token via ``POST /api/auth/login``. All subsequent requests must include the ``Authorization: Bearer <token>`` header.

2.  **Upload Image**: Send a ``POST`` request to ``/api/map/upload``.

    *   **Method**: ``POST``
    *   **Endpoint**: ``/api/map/upload?trip_id={trip_id}``
    *   **Body**: ``multipart/form-data`` with the image file.
    *   **Authorization**: Required.

3.  **Backend Processing**:
    *   The ``FileUploadService`` receives the file.
    *   ``ImageHandler`` extracts EXIF data, including GPS coordinates and capture timestamp.
    *   The image is saved to the ``images`` bucket in MinIO.
    *   A corresponding ``FileMetadata`` document is created in MongoDB, linking the image to the ``trip_id`` and storing its GPS data.

4.  **API Response**: The client receives a JSON object containing the new file's metadata, including its ``object_key`` and extracted GPS info. The frontend uses this to immediately display the photo on the map and in the trip timeline.

Workflow: Uploading a GPX Track
--------------------------------

This workflow adds a GPX track to a trip, which replaces any existing track for that trip. The backend analyzes the track to generate statistics.

1.  **Authenticate**: As above, ensure you have a valid JWT.

2.  **Upload GPX File**: Send a ``POST`` request to ``/api/map/upload``.

    *   **Method**: ``POST``
    *   **Endpoint**: ``/api/map/upload?trip_id={trip_id}``
    *   **Body**: ``multipart/form-data`` with the ``.gpx`` file.
    *   **Authorization**: Required.

3.  **Backend Processing**:
    *   ``FileUploadService`` detects the file is a GPX track and deletes any pre-existing GPX file and metadata for the given ``trip_id``.
    *   ``GpxHandler`` saves the raw file to the ``gps-data`` bucket in MinIO.
    *   ``GpxAnalysisService`` is invoked to parse the track, calculate statistics (distance, elevation gain, duration), and identify waypoints.
    *   The analysis result (a pickled object) is saved to the ``gps-analysis-data`` bucket.
    *   A ``FileMetadata`` document is saved in MongoDB, containing a summary of the analysis (``track_summary``) and a reference to the analysis object in MinIO.
    *   An event ``GPX_PROCESSED`` is published on the ``EventBus``, triggering services like ``AchievementEngine`` to update user stats.

4.  **API Response**: The client receives a JSON response containing the file metadata and the ``track_summary``.

Workflow: Retrieving Data for Trip Detail View
-----------------------------------------------

When a user navigates to the trip detail page, the frontend fetches all necessary data in parallel.

1.  **Authenticate**: (Optional for public trips, Required for private data)

2.  **Fetch Core Trip Data**:
    *   ``GET /api/trips/{trip_id}``: Retrieves the main ``Trip`` document, including name, dates, notes, and member information.

3.  **Fetch Associated Files**:
    *   ``GET /api/list-files/detail?bucket=images&trip_id={trip_id}``: Gets a list of all image metadata for the trip.
    *   ``GET /api/images/geo?trip_id={trip_id}``: Specifically fetches images with GPS data for displaying on the map.

4.  **Fetch GPX Track and Analysis**:
    *   ``GET /api/list-files/detail?bucket=gps-data&trip_id={trip_id}``: Identifies the GPX file associated with the trip.
    *   ``GET /api/gpx/{filename}/analysis``: Retrieves the processed track data, including the coordinate polyline, waypoints, and detailed statistics for rendering the elevation profile.

5.  **Frontend Rendering**: The frontend uses this data to render the map with the GPX track, photo markers, the sidebar with trip info, and the chronological timeline of photos and waypoints.