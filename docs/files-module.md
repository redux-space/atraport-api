# Files & Storage Management Module

## Overview

The files module provides single-shot and multi-part chunked upload processing, storage provider abstractions (local disk, AWS S3, Azure Blob Storage), virus scanning, and signed URL generation.

### Endpoints

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `POST` | `/api/files/upload` | Single-shot file upload with validation and scanning | Simulated (`x-user-id`) |
| `POST` | `/api/files/upload/initialize` | Initialize a multi-part chunked upload session | Simulated (`x-user-id`) |
| `POST` | `/api/files/upload/chunk` | Upload an individual chunk part for an active session | Simulated (`x-user-id`) |
| `POST` | `/api/files/upload/complete` | Finalize and assemble a multi-part chunked upload | Simulated (`x-user-id`) |
| `GET` | `/api/files/:id/url` | Retrieve a time-limited signed URL for a file | Simulated (`x-user-id`) |
| `DELETE` | `/api/files/:id` | Soft/hard delete a file and free quota | Simulated (`x-user-id`) |

---

## Authentication

> [!WARNING]
> **Simulated Authentication Warning**:
> User identification currently relies on the raw `x-user-id` HTTP request header, falling back to the hardcoded default `'test-user-id'` (`src/files/files.controller.ts:7-8`). This is a temporary placeholder and does not verify cryptographically signed tokens. Production migration to JWT Bearer authentication is tracked in companion security issue [#85](https://github.com/redux-space/atraport-api/issues/85).

All requests should supply:
```http
x-user-id: usr_01HZX87K9PQRS
```
If omitted, operations proceed under owner ID `test-user-id`.

---

## Single File Upload

### Endpoint
`POST /api/files/upload`

Uploads an entire file in a single multipart request. Enforces magic-byte validation and scans against virus signatures.

### Constraints
- **Max file size**: Controller pipe sets `25MB`; underlying `FileValidatorService` sets `100MB` (see [Limits and Validation](#limits-and-validation)).
- **Form field name**: `file`

### Example Request (`curl`)
```bash
curl -X POST http://localhost:3000/api/files/upload \
  -H "x-user-id: usr_12345" \
  -F "file=@document.pdf;type=application/pdf"
```

### Example Response
```json
{
  "success": true,
  "file": {
    "id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
    "userId": "usr_12345",
    "originalName": "document.pdf",
    "mimeType": "application/pdf",
    "size": 1048576,
    "storageProvider": "local",
    "storagePath": "users/usr_12345/7c9e6679-7425-40de-944b-e07fc1f90ae7.pdf",
    "cdnUrl": "/cdn/users/usr_12345/7c9e6679-7425-40de-944b-e07fc1f90ae7.pdf",
    "isCompressed": false,
    "isScanned": true,
    "isInfected": false,
    "createdAt": "2026-10-01T12:00:00.000Z"
  }
}
```

---

## Chunked Upload Workflow

Chunked uploads allow reliable streaming for large files across three sequential steps:

```
[Client] ---> POST /api/files/upload/initialize ---> Returns uploadId & storagePath
[Client] ---> POST /api/files/upload/chunk (part 1..N) ---> Returns part confirmation
[Client] ---> POST /api/files/upload/complete ---> Assembles file & saves FileRecord
```

### 1. Initialize Chunked Upload

#### Endpoint
`POST /api/files/upload/initialize`

#### Request Body (`application/json`)
| Field | Type | Required | Description |
|---|---|---|---|
| `originalName` | `string` | Yes | File name including extension (e.g., `"video.mp4"`) |
| `mimeType` | `string` | Yes | MIME content type (e.g., `"video/mp4"`, `"application/pdf"`) |
| `totalSize` | `number` | Yes | Total expected file size in bytes |

```bash
curl -X POST http://localhost:3000/api/files/upload/initialize \
  -H "Content-Type: application/json" \
  -H "x-user-id: usr_12345" \
  -d '{
    "originalName": "archive.zip",
    "mimeType": "application/pdf",
    "totalSize": 20971520
  }'
```

#### Response (`200 OK`)
```json
{
  "success": true,
  "uploadId": "3b241101-e7bb-412e-b6a3-f09b53de08d2",
  "storagePath": "users/usr_12345/3b241101-e7bb-412e-b6a3-f09b53de08d2.zip"
}
```

---

### 2. Upload Chunk Part

#### Endpoint
`POST /api/files/upload/chunk`

Uploads an individual chunk part. 

> [!NOTE]
> **Part Number Base**:
> - `partNumber` is **1-based** (`1`, `2`, `3`, ...).
> - Passed as a form text field and parsed with `parseInt(partNumber, 10)` in `src/files/files.controller.ts:61`. Ensure numeric integer strings are transmitted.

#### Multipart Form Fields
| Field | Type | Required | Description |
|---|---|---|---|
| `chunk` | `file (binary)` | Yes | Chunk binary payload (max 10MB/15MB) |
| `uploadId` | `string` | Yes | ID returned by `/upload/initialize` |
| `partNumber` | `string (integer)` | Yes | 1-based index of this chunk (`"1"`, `"2"`, etc.) |

```bash
curl -X POST http://localhost:3000/api/files/upload/chunk \
  -H "x-user-id: usr_12345" \
  -F "uploadId=3b241101-e7bb-412e-b6a3-f09b53de08d2" \
  -F "partNumber=1" \
  -F "chunk=@chunk_part_1.bin;type=application/octet-stream"
```

#### Response (`200 OK`)
```json
{
  "success": true,
  "part": {
    "partNumber": 1
  }
}
```

---

### 3. Complete Chunked Upload

#### Endpoint
`POST /api/files/upload/complete`

Finalizes the upload, merges all chunks in storage, and creates the persistent database entity.

#### Request Body (`application/json`)
| Field | Type | Required | Description |
|---|---|---|---|
| `uploadId` | `string` | Yes | Session ID from initialization |
| `storagePath` | `string` | Yes | Path from initialization |
| `originalName` | `string` | Yes | Original file name |
| `mimeType` | `string` | Yes | Validated MIME type |
| `totalSize` | `number` | Yes | Total assembled size in bytes |
| `parts` | `array` | Yes | List of completed parts (provider-specific) |

> [!IMPORTANT]
> **`parts` Array Structure**:
> - **Local Storage Provider**: The local provider appends chunks sequentially on disk during `uploadChunk`, so `parts` can be passed as `[]` or an array of objects `[{"partNumber": 1}, {"partNumber": 2}]`.
> - **S3 Storage Provider**: S3 expects an array of ETag objects: `[{"PartNumber": 1, "ETag": "\"etag-hash\""}]`. Note that S3 chunked uploads currently throw in `uploadChunk` (see [Known Limitations](#known-limitations)).

```bash
curl -X POST http://localhost:3000/api/files/upload/complete \
  -H "Content-Type: application/json" \
  -H "x-user-id: usr_12345" \
  -d '{
    "uploadId": "3b241101-e7bb-412e-b6a3-f09b53de08d2",
    "storagePath": "users/usr_12345/3b241101-e7bb-412e-b6a3-f09b53de08d2.zip",
    "originalName": "archive.zip",
    "mimeType": "application/pdf",
    "totalSize": 20971520,
    "parts": [
      { "partNumber": 1 },
      { "partNumber": 2 }
    ]
  }'
```

#### Response (`200 OK`)
```json
{
  "success": true,
  "file": {
    "id": "e0a6e0c6-302a-4318-8f55-15a3df3ec7bb",
    "userId": "usr_12345",
    "originalName": "archive.zip",
    "mimeType": "application/pdf",
    "size": 20971520,
    "storageProvider": "local",
    "storagePath": "users/usr_12345/3b241101-e7bb-412e-b6a3-f09b53de08d2.zip",
    "cdnUrl": "/cdn/users/usr_12345/3b241101-e7bb-412e-b6a3-f09b53de08d2.zip",
    "isCompressed": false,
    "isScanned": false
  }
}
```

---

## Limits and Validation

### Size Limit Discrepancy
There is currently an architectural inconsistency between the controller middleware pipes and the domain validator service:

| Stage | Single Upload Limit | Chunk Limit | Location |
|---|---|---|---|
| **Controller Pipe (`FileValidationPipe`)** | `25 MB` | `15 MB` | `src/files/files.controller.ts:19, 50` |
| **Service Layer (`FileValidatorService`)** | `100 MB` | `10 MB` | `src/files/services/file-validator.service.ts:16, 29` |

> [!WARNING]
> Because requests must pass both layers, the **effective single upload limit is 25 MB** (blocked by controller) and the **effective chunk limit is 10 MB** (blocked by validator service). Unified configuration is tracked in issue [#86](https://github.com/redux-space/atraport-api/issues/86).

### Allowed MIME Types
Supported file types are restricted by `FileValidatorService.allowedMimeTypes`:
- Images: `image/jpeg`, `image/png`, `image/webp`, `image/gif`
- Documents: `application/pdf`, `text/plain`, `application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
- Spreadsheets: `application/vnd.ms-excel`, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`

---

## Virus Scanning (`VirusScannerService`)

Uploaded files are inspected using ClamAV (`clamdscan` / `clamscan`) over unix sockets (`/var/run/clamav/clamd.ctl`) or TCP host/port (`CLAMAV_HOST:CLAMAV_PORT`, default `127.0.0.1:3310`).

> [!IMPORTANT]
> **Fail-Open Policy**: If ClamAV daemon is unreachable, offline, or uninitialized, `VirusScannerService.scanBuffer` logs a debug warning and **fails open** (`return { isInfected: false, viruses: [] }`). Enforcement of a strict fail-closed security boundary is tracked in issue [#84](https://github.com/redux-space/atraport-api/issues/84).

---

## Signed URLs

### Endpoint
`GET /api/files/:id/url`

Generates a pre-signed, time-limited download URL with an expiration period of **3600 seconds** (1 hour).

```bash
curl -X GET http://localhost:3000/api/files/e0a6e0c6-302a-4318-8f55-15a3df3ec7bb/url \
  -H "x-user-id: usr_12345"
```

```json
{
  "success": true,
  "url": "/api/files/download/users%2Fusr_12345%2F3b241101.zip?token=mock_signature&expires=1790856000000"
}
```

> [!NOTE]
> **Local Provider Route Seam**: The local storage provider generates a relative path `/api/files/download/...`. The dedicated download handler for this route is tracked in issue [#83](https://github.com/redux-space/atraport-api/issues/83).

---

## Storage Providers & Configuration

The active storage provider is determined by the `STORAGE_PROVIDER` environment variable:

| Value | Provider Class | Required Environment Variables | Notes |
|---|---|---|---|
| `local` (default) | `LocalStorageProvider` | `UPLOAD_DIR` (optional, defaults to `./uploads`) | Stores files in local filesystem |
| `s3` | `S3StorageProvider` | `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_BUCKET` | AWS S3 or S3-compatible bucket |
| `azure` | `AzureStorageProvider` | `AZURE_STORAGE_CONNECTION_STRING`, `AZURE_STORAGE_CONTAINER` | Azure Blob Storage |

---

## Known Limitations & Tracked Issues

1. **Simulated Auth Guard**: Authentication relies on client-provided `x-user-id` header ([#85](https://github.com/redux-space/atraport-api/issues/85)).
2. **Inconsistent File Limits**: Discrepancy between controller pipes and validator service limits ([#86](https://github.com/redux-space/atraport-api/issues/86)).
3. **ClamAV Fail-Open Behavior**: Virus scanning bypasses scan when daemon is offline ([#84](https://github.com/redux-space/atraport-api/issues/84)).
4. **Missing Local Download Route**: Local provider signed URL references unmapped `/download` route ([#83](https://github.com/redux-space/atraport-api/issues/83)).
5. **S3 Chunked Upload Incomplete**: `S3StorageProvider.uploadChunk` lacks `Key` mapping and throws error ([#82](https://github.com/redux-space/atraport-api/issues/82)).
