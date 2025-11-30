# Frontend UI and Component Guide

This document provides an overview of the web UI architecture, breaking down the main pages, panels, and components defined in the `client/src/` directory.

## 1. High-Level Architecture

The frontend is a single-page application built with **React**. It uses `react-router-dom` for client-side routing and `axios` (via the `services/api.js` module) to communicate with the backend REST API. The application uses React hooks and local state management for component-level state, with event-based communication between components.

## 2. Main Pages (Views)

The application's primary navigation is defined in `App.js`, which sets up the following routes:

### `/trips` -> `TripsPage.js`

-   **File:** `client/src/components/views/TripsPage.js`
-   **Purpose:** This is the main landing page of the application, serving as the trips management hub.
-   **Functionality:**
    -   **Trip Display:** Fetches and displays all trips in either grid or list view mode
    -   **Search & Filter:** Provides search functionality and filters by difficulty, GPX availability, photos, and date range
    -   **Sorting:** Supports multiple sort options (newest, oldest, longest distance, highest elevation, etc.)
    -   **Bulk Operations:** Select mode allows users to select multiple trips for batch operations (archive, delete, export GPX, merge)
    -   **Cover Image Management:** Each trip card displays a cover image with overlay controls to change or set cover images from trip photos
    -   **Trip Cards:** Display trip metadata including name, dates, region, difficulty, distance, elevation, GPX status, and photo count
    -   **Navigation:** Each trip card provides links to view trip details or open the map directly
    -   **Create New Trip:** Opens the `CreateTripModal` for creating new trips
    -   **Import/Export:** Placeholder buttons for importing GPX history and exporting trips

### `/trips/:tripId` -> `TripDetailPage.js`

-   **File:** `client/src/components/views/TripDetailPage.js`
-   **Purpose:** This is the core interface of the application, where users interact with the data of a single trip.
-   **Functionality:**
    -   **Layout Management:** Serves as the main container integrating `TripSidebar`, `LeafletMapView`, and `TimelinePanel`
    -   **Trip Selector:** Header with quick-switch dropdown to navigate between trips and "Back to My Trips" link
    -   **State Management:** Manages photos, waypoints, GPX tracks, and timeline data with chronological sorting
    -   **Access Control:** Determines `readOnly` status based on authentication. Propagates this state to child components (`TripSidebar`, `LeafletMapView`, `TimelinePanel`) to disable editing features for guest users.
    -   **Responsive Timeline:** Adaptive timeline display with three modes:
        -   **Side mode** (>1180px): Fixed-width resizable side panel
        -   **Overlay mode** (1024-1180px): Floating overlay on the right
        -   **Sheet mode** (<1024px): Bottom sheet drawer
    -   **Photo Management:** Handles photo uploads, viewing, deletion, and note editing
    -   **GPX Integration:** Manages GPX file selection, track rendering, and waypoint extraction
    -   **Map Synchronization:** Coordinates photo/waypoint selection between timeline, map, and photo viewer
    -   **Photo Viewer:** Opens `PhotoViewerOverlay` for full-size image viewing with navigation
    -   **Event Communication:** Uses custom events for cross-component updates (imageUploaded, imageDeleted, photoNoteUpdated, centerMapOnLocation, mapImageSelected)

### `/login` -> `LoginPage.js`

-   **File:** `client/src/pages/LoginPage.js`
-   **Purpose:** Allows users to authenticate with the system.
-   **Functionality:**
    -   **Form:** Captures username and password.
    -   **Authentication:** Calls `authService.login` to retrieve a JWT.
    -   **Redirection:** Redirects to the trips page upon successful login.

### `/register` -> `RegisterPage.js`

-   **File:** `client/src/pages/RegisterPage.js`
-   **Purpose:** Allows new users to create an account.
-   **Functionality:**
    -   **Form:** Captures username, password, email, full name, and a registration key.
    -   **Registration:** Calls `authService.register` to create a new user.
    -   **Redirection:** Redirects to the login page upon successful registration.

## 3. Layout Components

The consistent structure of the application is maintained by these components found in `client/src/components/layout/`.

-   **`Header.js`**: The top navigation bar displaying the application title/logo. It dynamically renders authentication controls:
    -   **Guest**: Shows "Login" and "Register" links.
    -   **Authenticated**: Shows "Hi, [Username]" and a "Logout" button.
-   **`TripSidebar.js`**: The left-hand collapsible panel on the `TripDetailPage`. Contains:
    -   `TripSummaryCard`: Displays trip overview, name, region, dates, notes, and statistics (photo/track counts)
    -   `ImageGalleryPanel`: Photo browsing interface
    -   `TripStatsHUD`: A floating panel at the bottom of the map displaying trip statistics (distance, duration, elevation gain, max elevation) and an interactive elevation profile graph.
    -   `Footer.js`: Application footer with copyright information or links.

**Note:** The original documentation mentioned `Sidebar.js` and `MainArea.js`, but the actual implementation uses `TripSidebar.js` for the trip detail page sidebar, and the map view is handled by `LeafletMapView.js` rather than a generic `MainArea.js` component.

## 4. Panels and Core Components

These components provide the primary features of the application, mostly within the `TripDetailPage`.

### Trip Stats & Visualization

-   **`TripStatsHUD.js`**:
    -   **Purpose:** Displays a summary of the trip's statistics and elevation profile overlaying the map.
    -   **Functionality:**
        -   **Stats Cards:** Shows total distance, duration, elevation gain, and maximum elevation.
        -   **Elevation Profile:** Renders an interactive area chart of the trip's elevation profile.
        -   **Interactivity:** Hovering over the chart displays a tooltip with precise distance and elevation at that point, along with a corresponding indicator on the graph.
        -   **Collapsible:** Can be collapsed to save screen space.

### Map Components (`client/src/components/map/`)

-   **`LeafletMapView.js`** (Primary Map Component):
    -   **Purpose:** The main interactive map component using React-Leaflet library for real-time map rendering
    -   **Functionality & User Experience:**
        -   Renders an interactive Leaflet map with pan, zoom, and layer controls
        -   **Base Layer Switching:** Supports multiple tile layers (Rudy Map [Default], Happyman, OpenStreetMap) via `MapLayerController` sub-component
        -   **GPX Track Display:** Renders the single active GPX track as a polyline
        -   **Waypoint Markers:** Displays waypoints from GPX files as markers with popups
        -   **River Overlays:** Renders GeoJSON river data when selected (currently hidden)
        -   **Image Markers:** Integrates `ImageLayer` component to display geotagged photos
        -   **Auto-centering:** Centers map on GPX tracks when selected
        -   **Highlight Sync:** Highlights markers when items are hovered in the timeline panel
        -   Uses React-Leaflet components: `MapContainer`, `TileLayer`, `GeoJSON`, `Polyline`, `Marker`, `Popup`, `Tooltip`

-   **`ImageLayer.js`**:
    -   **Purpose:** A React-Leaflet component that fetches and displays geotagged image markers on the map
    -   **Functionality & User Experience:**
        -   Fetches geotagged image metadata from backend using `getGeotaggedImages` API
        -   Creates custom-styled circular markers (`.photo-marker`) with image thumbnails
        -   **User Interaction:**
            -   **Hover:** Displays tooltip with image filename
            -   **Click:** Opens popup with thumbnail, filename, coordinates, and note editor
            -   **Note Editing:** In-popup text area for adding/updating photo notes (hidden in read-only mode).
            -   **View Details:** Button to open full photo viewer
        -   **Real-time Updates:** Listens for global events:
            -   `imageUploaded`: Adds new markers for uploaded photos
            -   `imageDeleted`: Removes markers for deleted photos
            -   `centerMapOnLocation`: Centers map and opens popup for specific photo
            -   `photoNoteUpdated`: Updates popup content when notes are edited elsewhere
        -   **Trip Context:** Filters images by trip ID when provided

-   **`MapToolbar.js`**:
    -   **Purpose:** Provides UI controls for switching map base layers
    -   **Functionality:** Buttons or dropdown for selecting between different tile layer providers (OpenStreetMap, Rudy Map, Mapbox)

-   **`GPXDropdown.js`** (Legacy/Alternative Implementation):
    -   **Purpose:** An alternative GPX selection interface (note: functionality is now primarily in `LeafletMapView.js`)
    -   **Functionality:** Dropdown menu for selecting GPX files, triggers map regeneration with selected track
    -   **Note:** This appears to be an older implementation that worked with backend-rendered maps; current implementation uses direct Leaflet rendering

-   **`MapContainer.js`** (Legacy Component):
    -   **Note:** This appears to be an older backend-rendered map approach using `dangerouslySetInnerHTML`
    -   The current implementation uses `LeafletMapView.js` with client-side React-Leaflet rendering instead
    -   Kept for backward compatibility or alternative rendering approach

### Sidebar Panels (`client/src/components/panels/`)

-   **`ImageGalleryPanel.js`**:
    -   **Purpose:** Displays a comprehensive, interactive gallery of all images for the current trip
    -   **Information & User Steps:**
        1.  Collapsible panel with "Show Images" / "Hide Images" toggle
        2.  Loads and displays image thumbnails in a responsive grid layout
        3.  Each thumbnail shows:
            -   Image preview
            -   "View on Map" button (if photo has GPS coordinates)
            -   Delete button
        4.  **Hover Interaction:** Displays detailed tooltip with file info, GPS coordinates, and EXIF camera metadata
        5.  **Click Interaction:** Opens full-size image viewer modal with metadata sidebar
        6.  **Map Synchronization:** 
            -   Clicking thumbnail scrolls to and highlights the photo
            -   "View on Map" centers map on photo location
            -   Clicking map marker scrolls gallery to corresponding thumbnail
        7.  **Deletion:** Click delete button to remove photo (with confirmation)
    -   **Expected Experience:** Professional photo management interface similar to Google Photos or Lightroom, with seamless map integration for geotagged photos

-   **`TimelinePanel.js`** (Replaces `PhotoTimelinePanel.js`):
    -   **Purpose:** Unified chronological timeline combining photos and GPX waypoints into a single narrative view
    -   **Information & User Steps:**
        1.  Vertical scrollable timeline with date separators
        2.  Each item displays as a card with:
            -   Type icon (📷 for photos, 📍 for waypoints)
            -   Timestamp (date and time)
            -   Title (auto-generated or user-edited)
            -   Thumbnail (for photos)
            -   Note/description field
        3.  **User Interactions:**
            -   **Click photo card:** Opens full photo viewer
            -   **Click waypoint card:** Centers map on waypoint location
            -   **Hover:** Highlights corresponding marker on map
            -   **Edit button:** Opens inline editor for title and note (supports Markdown)
            -   **Delete button:** Removes item (photos only; waypoints are from GPX)
        4.  **Add Actions:** (Hidden in read-only mode)
            -   "Add Photo" button to upload new images
            -   "Add URL" button (placeholder for future web image import)
        5.  **Chronological Sorting:** Items automatically sorted by capture/waypoint timestamp
        6.  **Markdown Support:** Notes can include formatting like **bold**, *italic*, `code`, links, etc.
    -   **Expected Experience:** Story-like journey view that weaves together photos and location waypoints, allowing users to document their trip as a narrative timeline

### Common Components (`client/src/components/common/`)

This directory contains reusable UI elements shared across the application.

-   **`CreateTripModal.js`**: Modal dialog for creating a new trip. Contains a form capturing trip name, start date, end date, region, and notes. Calls the `createTrip` API to save the new trip record.
-   **`PhotoViewerOverlay.js`**: Full-screen overlay that appears when a user clicks on a photo thumbnail. Displays the image in a larger view with:
    -   Navigation controls (previous/next arrows)
    -   Image counter (e.g., "3 / 24")
    -   Close button
    -   Keyboard navigation support (arrow keys, Escape)
-   **`TripStatsHUD.js`**: Heads-up display component showing real-time trip statistics (photo count, track count, etc.)
-   **`Button.js`**, **`Input.js`**, **`Checkbox.js`**: Styled form elements providing consistent UI across the application with standardized props and styling

## 4. Additional Component Directories

-   **`client/src/components/categories/`**: Contains category-related UI components
-   **`client/src/components/sidebar/`**: Alternative sidebar panel implementations (may overlap with `panels/`)
-   **`client/src/components/upload/`**: Upload-related component variations
-   **`client/src/components/lists/`**: List view components (e.g., `DataListComponent.js`)
-   **`client/src/components/operations/`**: Legacy or alternative map and upload components (`MapComponent.js`, `MapToolbox.js`, `UploadComponent.js`)

## 5. Styling Architecture

The application uses a combination of:
-   **CSS Modules**: Component-specific styles (`.css` files in component directories)
-   **Tailwind CSS**: Utility-first CSS framework (configured in `tailwind.config.js`)
-   **Custom CSS**: Global styles in `client/src/styles/` directory
    -   `App.css`: Main application styles
    -   `Sidebar.css`: Sidebar panel styles
    -   `MapContainer.css`, `LeafletMapView.css`: Map component styles
    -   `ImageLayer.css`: Image marker styles
    -   `PhotoTimelinePanel.css`: Timeline component styles
    -   `TripDetailPage.css`, `MainBlock.css`: Page layout styles

## 6. Key User Flows

### Authentication
1.  **Guest Access (View-Only):**
    -   Users can view all trips, maps, and photos without logging in.
    -   Editing controls (upload, delete, edit notes) are hidden.
2.  **Login:**
    -   User navigates to `/login`.
    -   Enters credentials.
    -   Upon success, is redirected to `/trips` with "Edit Mode" enabled.
3.  **Registration:**
    -   User navigates to `/register`.
    -   Enters details and the required registration key.
    -   Upon success, can proceed to login.

### Creating and Managing Trips
1. User visits `/trips` and sees the trips list
2. Clicks "+ New Trip" to open the creation modal
3. Fills in trip details (name, dates, region, notes)
4. New trip appears in the list with placeholder cover image
5. User can set cover image by selecting from trip photos or uploading new image
6. Search, filter, and sort trips using toolbar controls
7. Use select mode for bulk operations (delete, archive, export, merge)

### Working with a Trip
1. Click on a trip card to navigate to `/trips/:tripId`
2. See trip detail page with sidebar (left) and map (center) and timeline (right, on wide screens)
3. Upload GPX tracks via Upload Panel - tracks appear in GPX selector on map
4. Upload photos via Upload Panel or Timeline - photos appear in gallery, timeline, and map (if geotagged)
5. Select GPX tracks to display on map - tracks render as colored polylines
6. Waypoints from GPX automatically appear in timeline
7. Click photo markers on map to view details and add notes
8. Use timeline to browse trip chronologically and add narrative notes
9. Toggle river overlays and other GIS layers via Categories Panel
10. Use responsive timeline (side panel, overlay, or bottom sheet depending on screen size)

### Photo and Timeline Workflow
1. Photos appear in three places: Gallery Panel, Timeline, and Map (if geotagged)
2. Click photo in any location to open full-size viewer
3. Navigate between photos using arrow keys or navigation buttons
4. Click "View on Map" to center map on photo location
5. Edit photo notes directly in timeline or map popup
6. Notes support Markdown formatting for rich text
7. Delete photos from gallery or timeline (with confirmation)
8. Timeline merges photos and waypoints chronologically for story-like view

## 7. Technical Notes

### State Management
-   **Global Auth State:** `AuthContext.js` provides `user` and `isAuthenticated` state to the entire app via the Context API.
-   **Local Component State:** Most components use React `useState` and `useEffect` hooks
-   **Props Drilling:** Parent-to-child communication via props
-   **Event-Based Communication**: Cross-component updates using custom DOM events:
    -   `imageUploaded`, `imageUploadedWithGPS`: Notify components of new photos
    -   `imageDeleted`: Trigger marker and gallery removal
    -   `photoNoteUpdated`: Sync note changes across components
    -   `centerMapOnLocation`: Center map on specific coordinates
    -   `mapImageSelected`: Notify when photo marker is clicked

### API Integration
-   All backend communication goes through `client/src/services/api.js`
-   Uses axios for HTTP requests
-   Key API endpoints:
    -   Trip CRUD: `getTrips`, `getTrip`, `createTrip`, `updateTrip`, `deleteTrip`
    -   File operations: `uploadFile`, `deleteFile`, `deleteImage`
    -   GPX: `listGpxFiles`, `listGpxFilesWithMeta`, `fetchGpxAnalysis`, `fetchGpxFile`
    -   Images: `listImageFiles`, `getGeotaggedImages`, `getImageUrl`, `updatePhotoNote`
    -   GIS: `riversData`, `listRivers`

### Map Implementation Evolution
The application has evolved from backend-rendered maps to client-side Leaflet:
-   **Legacy Approach** (`MapContainer.js`, `GPXDropdown.js`): Backend generates map HTML, frontend displays via `dangerouslySetInnerHTML`
-   **Current Approach** (`LeafletMapView.js`, `ImageLayer.js`): React-Leaflet components for interactive, real-time map rendering
-   Both approaches coexist in the codebase for backward compatibility

### Responsive Design
-   **Desktop (>1180px)**: Full three-column layout (sidebar, map, timeline)
-   **Tablet (1024-1180px)**: Sidebar + map with floating timeline overlay
-   **Mobile (<1024px)**: Sidebar + map with bottom sheet timeline drawer
-   Timeline width is resizable and persisted to localStorage on desktop
