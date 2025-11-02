# Requirement Specification: Image Pin & Thumbnail Popup (MVP)

## 1. Purpose

Deliver an MVP that places a **map marker** for each uploaded image that has **GPS coordinates**, and shows a **thumbnail popup** when the marker is clicked. Keep scope minimal to ship quickly.

## 2. Scope

**In scope**

* Render markers for GPS-tagged images.
* On marker click, show a popup with **thumbnail** and **image name**, with a **“View details”** action to open the existing image modal.
* Add/remove markers on image **upload**/**delete**.

**Out of scope (MVP)**

* Marker clustering, filters, search, timelines.
* Showing any additional metadata in the popup.
* Non-map features (exports, analytics, etc.).

## 3. Definitions & Actors

* **Marker / Pin**: Clickable point on the map at an image’s `(lat, lon)`.
* **Thumbnail**: Preview image (longest side ≈ 200–256 px).
* **object_key / metadata_id**: Unique id for image/metadata.
* **User**: Authenticated user who uploads/views/deletes images.

## 4. Assumptions

* EXIF → GPS extraction and MongoDB persistence already work for new uploads.
* Thumbnails are available via public or **presigned** URLs.
* The existing **Image Details modal** opens by `object_key` (or `metadata_id`).

## 5. High-Level Flow

1. User uploads an image. Backend extracts EXIF; if GPS is present, it is stored in `gps` (lat, lon, …).
2. Frontend fetches geotagged images and renders **markers**.
3. User clicks a marker → **popup** shows **thumbnail** + **image name**; user can open the full details modal.
4. On delete, the corresponding marker is removed immediately.

---

## 6. Functional Requirements

### FR-1 Data Retrieval (Geo endpoint)

* Provide an endpoint that returns **only images with GPS**:

  ```
  GET /api/images/geo?bbox=minLon,minLat,maxLon,maxLat
  ```
* **Response (array)** each item contains:

  * `object_key` (string)
  * `original_filename` (string)
  * `lat` (number)
  * `lon` (number)
  * `thumb_url` (string) — public or presigned, directly usable in `<img>`
* If `bbox` is omitted, the server may return a capped recent set to avoid overload.

### FR-2 Marker Rendering

* The UI **shall** render a **marker** at each `(lat, lon)` returned.
* The marker **shall** expose the image name (truncated) as a label/hover title.

### FR-3 Popup Content

* On marker **click**, the UI **shall** open a **popup** with:

  * **Thumbnail** (max width 200 px; keep aspect ratio).
  * **Image name** (truncated with ellipsis if needed).
  * **“View details”** control that opens the existing Image Details modal.

### FR-4 Upload Hook

* After a **successful upload** that yields GPS, the UI **shall** add a new marker without a full page reload.

### FR-5 Delete Hook

* After a **successful delete**, the UI **shall** remove the corresponding marker and close any open popup for that image.

### FR-6 **Non-GPS Images Must Not Render**

* **Backend rule:** The `/api/images/geo` endpoint **must exclude** any image whose database record lacks `gps.lat` and `gps.lon`.
* **Frontend rule:** The UI **must not** create markers for any item missing valid `lat`/`lon` (defensive check).
* **Upload rule:** If an uploaded image has **no GPS**, it is stored normally but **no marker** is rendered.

### FR-7 Accessibility

* Each marker has `title=original_filename`.
* Popup thumbnail has `alt=original_filename`.

---

## 7. UI/UX Requirements

### Map Layer

* “**Photos**” layer visible by default (layer toggle can be added later).

### Marker & Label

* Standard pin icon; filename shown as browser tooltip via `title`, and/or short label near the pin (truncated, e.g., 18 chars + `…`).

### Popup Layout

* Vertical stack:

  1. Thumbnail (≤ 200 px width)
  2. Image name
  3. “View details” button

### Interaction

* Click outside popup dismisses it.
* “View details” opens existing right-side modal (no page navigation).

---

## 8. Data & API Contract (Reference)

**Request**

```
GET /api/images/geo?bbox=minLon,minLat,maxLon,maxLat
```

**Response (200)**

```json
[
  {
    "object_key": "images/2025/11/uuid_IMG_3940.JPG",
    "original_filename": "IMG_3940.JPG",
    "lat": 40.632875,
    "lon": 140.889223,
    "thumb_url": "https://.../thumbnails/uuid_IMG_3940.jpg?X-Amz-Expires=1800"
  }
]
```

**Notes**

* The endpoint returns **GPS-only** items by contract.
* `thumb_url` must be renderable by `<img>` (CORS allowed if presigned).
* Suggested presigned TTL: **≥ 10 minutes**.

---

## 9. Non-Functional Requirements

* **Performance**: Smooth pan/zoom with up to **1000 markers** on a modern laptop.
* **Security**: HTTPS; short-lived presigned URLs; correct CORS.
* **Reliability**: If thumbnail fails to load, show a neutral placeholder; app must not crash.
* **Maintainability**: Keep map state keyed by `object_key` to support add/remove on upload/delete.

---

## 10. Error Handling

* Missing/invalid `lat`/`lon` → item skipped, no marker.
* `thumb_url` 403/404/expired → show placeholder; optional one-time refresh is acceptable but not required for MVP.
* `/api/images/geo` failure → show lightweight toast; map remains usable.

---

## 11. Acceptance Criteria (QA)

1. **Upload → marker appears**

   * Given an image **with GPS** is uploaded
   * When upload completes
   * Then a marker appears at the correct map location and shows the image name on hover.

2. **Click marker → popup**

   * Given a visible marker
   * When the marker is clicked
   * Then a popup displays a thumbnail (≤ 200 px width) and the image name.

3. **Open details**

   * Given the popup is open
   * When “View details” is clicked
   * Then the existing Image Details modal opens for that image.

4. **Delete → marker removed**

   * Given an image has a marker on the map
   * When the image is deleted
   * Then the corresponding marker disappears without page reload.

5. **Non-GPS upload → no marker**

   * Given an image **without GPS** is uploaded
   * Then **no marker** is rendered for that image.

6. **Database contains non-GPS images**

   * Given the database has images missing `gps`
   * When `/api/images/geo` is called
   * Then those images are **not returned** and no markers are drawn.

7. **Thumbnail failure**

   * Given a valid marker and an invalid `thumb_url`
   * When the popup opens
   * Then a neutral placeholder is shown instead of the image; no crash.

---

## 12. Dependencies

* Working EXIF/GPS extraction and `gps` persistence for new uploads.
* Thumbnail generation pipeline (on upload or pre-existing) that exposes a usable `thumb_url`.
* Existing Image Details modal callable by `object_key`/`metadata_id`.

---

## 13. Risks & Mitigations

* **Expired presigned URLs** → use TTL ≥ 10 min; optional single retry to refresh URL.
* **Large result sets** → server caps or requires `bbox` (frontend can pass current map bounds).

---

## 14. Release Plan (single iteration)

1. Implement `/api/images/geo` that **filters out non-GPS** and returns `{object_key, original_filename, lat, lon, thumb_url}`.
2. Frontend: render markers; on click show popup with thumbnail/name/“View details”.
3. Hook upload/delete to add/remove markers.
4. QA against Acceptance Criteria.
