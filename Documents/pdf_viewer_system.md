# PDF Viewer System

## 1. Secure PDF Viewer (`SecureViewer.tsx`)

The platform implements a highly secure, non-downloadable PDF viewer using PDF.js v5.

### Security Layers Applied

1. **Proxy Streaming:** PDF bytes fetched via `GET /api/notes/:id/stream` (API proxies from S3 — raw S3 URL never sent to browser).
2. **Canvas Rendering:** PDF.js renders each page onto a `<canvas>` element (not `<embed>` or `<iframe>`), making extraction difficult.
3. **No Selection:** `user-select: none` and `-webkit-touch-callout: none` applied on the overlay.
4. **Context Menu Blocked:** Context menu (`right-click`) blocked via `document.addEventListener('contextmenu', ...)`.
5. **Shortcuts Blocked:** Keyboard shortcuts blocked: `Ctrl+P`, `Ctrl+S`, `Ctrl+C`, `Ctrl+A`.
6. **Print Protection:** `@media print { display: none !important }` — prevents browser print-to-PDF.
7. **Dynamic Watermark:** A watermark is overlaid on every page dynamically: `"Name · j***@gmail.com · 26 May 2026"`.

## 2. Note Upload Flow (`upload/page.tsx`)

1. User drags/drops or selects a PDF (max 50 MB).
2. **Client-side thumbnail generation**: PDF.js renders page 1 at 1.5× scale → `canvas.toBlob()` → JPEG preview shown instantly. This prevents the server from needing heavy tools like ImageMagick.
3. User fills title, description, selects subject, toggles paid/free.
4. Form submits `multipart/form-data` to `POST /api/notes`. Files are processed in backend via Multer memory storage (never written to disk).
5. API uploads PDF + thumbnail to AWS S3, saves metadata to DB.
6. On success, redirects to `/admin/notes`.

## 3. File Storage (AWS S3)

- **PDFs** stored as: `notes/<uuid>.pdf`
- **Thumbnails** stored as: `notes/thumbnails/<uuid>.jpg`
- Bucket is **private** — files are never directly accessed via presigned URLs from the browser.
- The API proxies all file access via `GET /api/notes/:id/stream` and `GET /api/notes/:id/thumbnail`.

## 4. PDF.js Worker Configuration

- PDF.js v5 uses `.mjs` worker format (which wasn't available on CDN at the time of build).
- The worker file is copied to `apps/web/public/pdf.worker.min.mjs`.
- It is loaded securely via: `pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'`.
- The upload page uses a CDN worker (less strict, temporary fallback): `cdnjs.cloudflare.com/ajax/libs/pdf.js/${version}/pdf.worker.min.mjs`.

## 5. Future Architectural Improvements

### Direct S3 PDF Fetching via Signed URLs

Currently, secure PDF streaming works as a proxy: `User -> Vercel -> Render API (Auth check + Proxy) -> S3 -> Render API -> User`. This means all heavy file traffic flows through the server's memory, which could become a significant bandwidth bottleneck at a high scale (e.g., 1000 users opening 200MB PDFs simultaneously).

**Suggested Approach (When bandwidth costs/latency become an issue):**
1. Instead of streaming bytes, `GET /api/notes/:id/stream` becomes `GET /api/notes/:id/signed-url`.
2. The API performs the standard authentication and subscription check.
3. If authorized, the API returns a short-lived (e.g., 15-minute) pre-signed URL for the S3 object (`{ url: "https://s3.amazonaws.com/...", expiresAt: "..." }`).
4. `SecureViewer.tsx` fetches the PDF directly from this signed URL and caches it in IndexedDB.

**Pros:**
- Completely offloads heavy bandwidth from the Render API to S3.
- Maintains strict authentication enforcement.

**Security Trade-offs:**
- The short-lived S3 URL becomes visible in the network tab and can technically be shared for the 15-minute window, slightly compromising the "zero local copy" strictness, though the risk is minimized by the short TTL and the existing local caching implementation.
