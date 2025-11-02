# File Operations Architecture Review & Corrections

**Date**: 2025-11-02  
**Context**: Review against actual codebase to ensure UI can display rich image metadata (location, date taken, camera info) during upload, deletion, and list operations.

## Overall Assessment

The proposed SRP-first refactor design is architecturally sound, but **the current implementation already provides most of the metadata infrastructure needed**. The main gap is **not architectural but operational**: UI needs to fetch and display rich metadata alongside file operations, and the current flow does this well for upload/fetch/list, but delete lacks informative feedback to the user.

---

## Cross-Check: Design vs. Current Implementation

### Upload Path ✅ (Already Good)

**Current flow**:
1. Frontend: `POST /api/map/upload` (multipart file) → Backend `FileUploadController.upload_file()`
2. Backend calls `FileUploadService.save_file()` which:
   - Uses `ImageHandler.handle()` to extract EXIF (GPS, date_taken, camera_make/model)
   - Uploads to MinIO via `ImageHandler`'s own `StorageManager`
   - Saves metadata to MongoDB via `FileUploadService`'s `StorageManager`
3. Returns rich `UploadResponse` with metadata: `{filename, gps, date_taken, camera_make, camera_model, size, mime_type, ...}`
4. Frontend stores this response and displays location/date immediately

**Design proposal alignment**: ✅ Upload already streams (via `UploadFile.file` → temp file → MinIO), extracts EXIF, and returns presignedable metadata.

**Correction needed**: Document that you already have **metadata-rich upload response**; the design's presigned PUT mode is optional (good-to-have for scale, not required now).

### Fetch / List Path ⚠️ (Partial)

**Current flow for LIST**:
- Frontend: `listImageFiles()` → `GET /list-files?bucket=images` → returns only `List[str]` (filenames/object_keys)
- **Problem**: Returns only keys, NO metadata. Frontend then does `N` separate calls to `/api/map/metadata/{key}` per image (waterfall).

**Current flow for FETCH display**:
- Frontend: `getImageUrl(filename)` returns `http://localhost:5002/api/files/{filename}?bucket=images` (direct proxy)
- **Problem**: No presigned URLs; app server proxies all GET traffic.

**Design proposal**: 
- List should return `[{id, key, owner_id, created_at, size, content_type, gps?, date_taken?, ...}]` (rich DTOs)
- Fetch should use presigned GET URLs (optional; current proxy works but less scalable)

**Correction**: Current implementation is **functional but inefficient**—list returns only keys, forcing frontend to fetch metadata separately. This is acceptable for small datasets but creates 1+N queries (N = number of images). **To better support UX with rich preview**, modify `/list-files` endpoint to include key metadata fields.

### Delete Path 🔴 (Design is Better)

**Current flow**:
1. Frontend: `DELETE /api/map/delete/{filename}?bucket=images`
2. Backend calls `FileUploadService.delete_file()` which:
   - Tries to delete from MinIO
   - Tries to delete from MongoDB metadata
   - Returns 404 if neither exists OR 200 if either succeeds
3. **Problem for UX**: 
   - No presign support; hard delete only
   - If metadata not found during list but delete still works, user sees no "before" info
   - Delete response is terse (just success/error message)

**Design proposal**: Delete should be:
- Idempotent (200 even if already gone)
- Support soft-delete + async hard-delete
- Return what was actually deleted (with metadata before deletion)

**Challenge**: Current hard-delete-only is fine if you don't need audit trail. But if you want users to understand "what are you deleting?", add a **prefetch** step: before delete, fetch metadata to show user ("Delete image from 2024-01-15 at 51.5°N, 0.1°W?").

### Metadata Retrieval ✅ (Works well)

**Current**: `GET /api/map/metadata/{metadata_id}` returns full `FileMetadata` doc with GPS, EXIF, date, camera info.  
**Frontend**: Calls this on image click (hover or modal open).  
**Assessment**: ✅ Works. Frontend loads metadata lazily; good UX.

---

## Key Findings & Recommendations

# Goals

* Separate responsibilities: **ports (interfaces)**, **adapters (infra)**, **use-cases (business)**, **routers (HTTP)**.
* Support **streaming uploads**, **pre-signed URLs**, **idempotent deletes**, and **safe key naming** consistent with S3/MinIO behavior.
* Keep FastAPI routes thin; wire dependencies centrally.
* Allow optional **MongoDB transactions** (when available) and a **non-transactional fallback**.

---

# 1) Package layout (SRP)

```
server/src/services/
  files/                             # NEW, replaces data_io_handlers
    domain/
      models.py                      # FileMeta, ThumbMeta
      key_builder.py                 # UUID-based keys, safe prefixes
      errors.py                      # domain errors
    ports/                           # pure interfaces
      storage_port.py                # S3/MinIO-like storage ops
      repo_port.py                   # FileRepository (DB metadata)
      uow_port.py                    # (optional) UnitOfWork for tx
      authorizer_port.py             # can(user, action, resource)
      jobs_port.py                   # enqueue background jobs
    adapters/
      minio_storage.py               # MinIO client: put/stat/presign/remove
      mongo_file_repo.py             # Mongo repo (+ session support)
    usecases/
      upload_file.py                 # server-proxy upload (stream) or presign PUT
      fetch_url.py                   # presigned GET
      list_files.py                  # paginate by prefix/owner/track_id
      delete_file.py                 # idempotent delete + outbox event
    router.py                        # /api/files endpoints
```

> Keep image-specific code (e.g., thumbnailing) in `services/images/` that **builds on `files`**; `files` stays generic.

---

# 2) Contracts (ports)

### `storage_port.py`

```python
from typing import Protocol, Iterable, BinaryIO
from dataclasses import dataclass

@dataclass(frozen=True)
class ObjectInfo:
    key: str
    size: int | None = None
    content_type: str | None = None
    etag: str | None = None
    metadata: dict[str, str] | None = None

class StoragePort(Protocol):
    def put_stream(self, bucket: str, key: str, stream: BinaryIO, length: int,
                   *, content_type: str, metadata: dict[str, str] | None = None) -> ObjectInfo: ...
    def presign_put(self, bucket: str, key: str, *, expires_seconds: int) -> str: ...
    def presign_get(self, bucket: str, key: str, *, expires_seconds: int) -> str: ...
    def head(self, bucket: str, key: str) -> ObjectInfo: ...
    def delete(self, bucket: str, key: str) -> None: ...
    def delete_many(self, bucket: str, keys: list[str]) -> None: ...
```

* **Why**: aligns with MinIO Python SDK shape—`put_object` (stream + required length or `length=-1` with a multipart `part_size`), `presigned_get_object`, `presigned_put_object`, `stat_object`, `remove_object(s)`. ([AIStor Object Store Documentation][2])

### `repo_port.py` (Mongo/SQL)

```python
from typing import Protocol, Iterable, Optional
from dataclasses import dataclass
from datetime import datetime

@dataclass
class FileMeta:
    id: str
    key: str
    bucket: str
    owner_id: str
    content_type: str
    size: int | None
    created_at: datetime
    deleted_at: datetime | None
    extra: dict

class FileRepository(Protocol):
    def create(self, meta: FileMeta) -> FileMeta: ...
    def get(self, file_id: str) -> FileMeta: ...
    def get_optional(self, file_id: str) -> Optional[FileMeta]: ...
    def soft_delete(self, file_id: str) -> None: ...
    def hard_delete_by_key(self, key: str) -> None: ...
    def list(self, owner_id: str | None, prefix: str | None, limit: int, offset: int) -> Iterable[FileMeta]: ...
```

### `uow_port.py`

```python
from typing import Protocol, ContextManager

class UnitOfWork(Protocol, ContextManager["UnitOfWork"]):
    def files(self) -> FileRepository: ...
    def outbox(self): ...                     # append(domain_event)
    def commit(self) -> None: ...
    def rollback(self) -> None: ...
```

* **Mongo transactions**: only available on **replica sets**; offer `TransactionalUoW` (with sessions) and `NoTxUoW` fallback. ([MongoDB][3])

---

# 3) Adapters

### `minio_storage.py`

* `put_stream` → `Minio.put_object(bucket, key, stream, length, content_type=..., metadata=...)`. If `length` is unknown, call with `length=-1` and set a valid **multipart** `part_size ≥ 5 MiB`. ([AIStor Object Store Documentation][2])
* `presign_get` / `presign_put` → `presigned_get_object` / `presigned_put_object` with configurable expiry. **Ensure bucket CORS** allows your frontend origin and methods/headers, otherwise the browser will fail the presigned requests. ([AIStor Object Store Documentation][2])
* `head` → `stat_object`, `delete` / `delete_many` → `remove_object(s)`. Map MinIO “NoSuchKey” to Python `FileNotFoundError`. ([AIStor Object Store Documentation][2])
* **Threading note**: the MinIO client is **thread-safe** for threads, not for multi-process—don’t share across processes. ([AIStor Object Store Documentation][2])

### `mongo_file_repo.py`

* Use a collection with indexes on `{owner_id, key, created_at, deleted_at}`.
* If `TransactionalUoW`, wrap in `ClientSession` and `with session.start_transaction(): ...` (replica set required). ([MongoDB][3])

---

# 4) Use-cases (one class = one job)

### Upload (server-proxy path)

* Accept `UploadFile` and **stream to MinIO** using `file.file` (a `SpooledTemporaryFile`), passing `length` when known; avoid loading the whole file into RAM. FastAPI supports non-JSON responses and streaming I/O. ([fastapi.tiangolo.com][4])
* Build **UUID-based keys** (ignore raw filename in path; store original filename in metadata). Keep keys UTF-8 but prefer safe ASCII and reasonable length. ([docs.aws.amazon.com][5])
* Optionally support **presigned PUT** upload mode (browser → MinIO directly) by returning the presigned URL + headers. Ensure CORS is set on the bucket. ([AIStor Object Store Documentation][2])

### Fetch URL

* Return **presigned GET** so the browser fetches directly from storage. ([AIStor Object Store Documentation][2])

### List

* Query the repo; optionally add presigned thumbnail URLs if you have an images module.

### Delete (idempotent)

* **Semantics**: Return **204** even if the object is already absent (S3/MinIO behavior: delete of a non-existent key is reported as “deleted”). ([docs.aws.amazon.com][6])
* Pattern:

  1. `files.soft_delete(file_id)` + outbox event (`file.deleted`).
  2. Background worker consumes outbox → `storage.delete(key)` (and thumb key if any).
  3. On success, `hard_delete_by_key(key)`; on failure, retry with backoff.

---

# 5) FastAPI router (thin)

* **Paths**:

  * `POST /api/files/upload` (multipart) — server-proxy upload.
  * `POST /api/files/presign` (JSON `{contentType, trackId?}`) — return presigned PUT for browser-direct uploads.
  * `GET /api/files/{file_id}/url` — presigned GET.
  * `GET /api/files` — list (filters: `ownerId`, `prefix`, `page`).
  * `DELETE /api/files/{file_id}` — idempotent delete → 204.

* If you ever need to pass **object keys** through a path, use `{object_key:path}` so keys with `/` don’t 404. ([fastapi.tiangolo.com][7])

* Return `Response(status_code=204, headers={"X-Idempotent": "true"})` for deletes.

* **Auth**: inject `get_current_user()` and check `AuthorizerPort.can(user_id, "files:delete", file.owner_id)` before deletes.

---

# 6) Domain rules

* **Key scheme**
  `files/{owner_id}/{yyyy}/{mm}/{dd}/{uuid}.{ext}`
  (for images: `images/{track_id or unassigned}/...`) — predictable prefixes for listing; never trust user-provided paths.

* **CORS**
  Apply per-bucket rules: allow origins for your UI, `GET, PUT, DELETE` as needed, and headers you send. Use `mc cors set` to apply XML/JSON. ([AIStor Object Store Documentation][8])

* **Multipart thresholds**
  If you don’t know the length at call time, use `length=-1` with `part_size >= 5 MiB`. Tune part size for fewer parts on large uploads. ([AIStor Object Store Documentation][2])

* **Transactions**
  If you require atomic DB changes with storage side-effects, run Mongo as a **replica set** and use transactions; single-node RS is fine for dev/CI. Otherwise, rely on the outbox/worker pattern. ([MongoDB][3])

* **Delete policy**
  Idempotent (S3-style): deleting a missing object is treated as success; reserve 404 for “file_id not found”. ([docs.aws.amazon.com][6])

---

# 7) Migration plan (from `data_io_handlers`)

1. **Introduce `services/files`** alongside current code; keep legacy endpoints active.
2. Implement `minio_storage.py` and refactor *existing* handlers to use this shared adapter (no behavior change)—quick win.
3. Add **new** `/api/files/*` router and flip the UI delete/list to it (stop calling map/metadata routes).
4. Add Mongo repo + UoW; enable outbox + worker for deletes.
5. Move upload to the new service (streaming or presign).
6. Remove legacy `data_io_handlers` once stable.

---

# 8) Testing & Observability

* **Unit tests**: mock `StoragePort` and `RepoPort` to test each use-case in isolation.
* **Adapter tests**: run **MinIO** in CI and validate `put/stat/presign/remove`. (Remember client thread-safety constraints.) ([AIStor Object Store Documentation][2])
* **HTTP tests**: FastAPI `TestClient` to verify routes, codes, and DTOs.
* **Metrics**: counters (`files_upload_total`, `files_delete_total`), histogram (`upload_bytes`).
* **Logs**: include `request_id`, `user_id`, `file_id`, `key`, and full exception stack on errors.

---

# 9) Example method signatures (concise)

```python
# usecases/upload_file.py
@dataclass
class UploadCmd:
    owner_id: str
    filename: str
    content_type: str
    length: int
    stream: BinaryIO
    track_id: str | None = None

class UploadFileService:
    def __init__(self, storage: StoragePort, repo: FileRepository, uow: UnitOfWork, bucket: str): ...
    def execute(self, cmd: UploadCmd) -> dict: ...  # {id, key, bucket, url?}
```

```python
# usecases/delete_file.py
class DeleteFileService:
    def __init__(self, storage: StoragePort, uow: UnitOfWork, bucket: str): ...
    def execute(self, file_id: str, user_id: str) -> None: ...  # 204 idempotent
```

---

# 10) What this fixes (relative to today)

* **404/500 on deletes** → gone (idempotent semantics + correct path handling + storage error mapping). ([docs.aws.amazon.com][6])
* **OOM/slow uploads** → avoided (streaming `UploadFile.file` into MinIO with correct `length`/multipart usage). ([AIStor Object Store Documentation][2])
* **Browser CORS failures** with presigned URLs → prevented (bucket CORS set via `mc cors set`). ([AIStor Object Store Documentation][8])
* **Ambiguous responsibilities** → eliminated (clear ports/adapters/use-cases/routers layout).

---


[1]: https://github.com/PenHsuanWang/travel-tracker "GitHub - PenHsuanWang/travel-tracker"
[2]: https://docs.min.io/enterprise/aistor-object-store/developers/sdk/python/api/?utm_source=chatgpt.com "Python Client API Reference"
[3]: https://www.mongodb.com/docs/manual/replication/?utm_source=chatgpt.com "Replication - Database Manual - MongoDB Docs"
[4]: https://fastapi.tiangolo.com/advanced/custom-response/?utm_source=chatgpt.com "Custom Response - HTML, Stream, File, others - FastAPI"
[5]: https://docs.aws.amazon.com/AmazonS3/latest/API/API_DeleteObject.html?utm_source=chatgpt.com "DeleteObject - Amazon Simple Storage Service"
[6]: https://docs.aws.amazon.com/AmazonS3/latest/API/API_DeleteObjects.html?utm_source=chatgpt.com "DeleteObjects - Amazon Simple Storage Service"
[7]: https://fastapi.tiangolo.com/tutorial/path-params/?utm_source=chatgpt.com "Path Parameters"
[8]: https://docs.min.io/enterprise/aistor-object-store/reference/cli/mc-cors/mc-cors-set/?utm_source=chatgpt.com "mc cors set | AIStor Object Store Documentation"
