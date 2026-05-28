# API Reference

## Backend API (`apps/api/`)

**Port:** 4000 (development)  
**Entry point:** `src/index.ts`  
**Build:** `tsc` → `dist/`

### Directory Structure

```
apps/api/src/
├── index.ts           ← Express app, CORS, route mounting
├── lib/
│   ├── prisma.ts      ← Prisma client singleton + withRetry()
│   └── asyncHandler.ts ← Wraps async handlers, forwards errors to Express
├── middleware/
│   ├── auth.ts        ← JWT verification, requireAuth/requireAdmin/requireSuperAdmin
│   ├── upload.ts      ← Multer (memory storage, 50 MB limit, PDF only)
│   └── error.ts       ← Global error handler (500 fallback)
├── routes/
│   ├── auth.ts        ← /api/auth/*
│   ├── notes.ts       ← /api/notes/*
│   ├── subjects.ts    ← /api/subjects/*
│   ├── announcements.ts ← /api/announcements/*
│   ├── tests.ts       ← /api/tests/*
│   ├── admin.ts       ← /api/admin/*
│   └── payments.ts    ← /api/payments/*
└── services/
    ├── token.ts       ← JWT sign/verify (access + refresh)
    ├── storage.ts     ← AWS S3 upload/delete/stream/signedUrl
    ├── r2.ts          ← Cloudflare R2 helpers (not used in prod)
    ├── google.ts      ← Google ID token verification
    └── razorpay.ts    ← Razorpay order creation + HMAC verification
```

---

## API Route Reference

### Auth (`/api/auth/`)

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/register` | Public | Email + password registration |
| POST | `/login` | Public | Email + password login |
| POST | `/google` | Public | Google ID token → issue JWT |
| POST | `/refresh` | Cookie | Rotate access token via refresh cookie |
| POST | `/logout` | — | Clear refresh cookie |
| GET | `/me` | Bearer | Fetch current user from DB |

### Notes (`/api/notes/`)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/` | Public | List all notes (no `fileKey` exposed). Filter with `?subjectId=` |
| GET | `/:id/stream` | Bearer | Stream PDF bytes from S3 (proxy — signed URL never leaves server). Logs a `NoteView`. |
| GET | `/:id/thumbnail` | Public | Stream JPEG thumbnail from S3 |
| POST | `/` | Admin | Upload note PDF + thumbnail. Uses `multipart/form-data`. Stores to S3, saves to DB. |
| PATCH | `/:id` | Admin | Update note metadata (title, description, subjectId, isPaid, pageCount) |
| DELETE | `/:id` | Admin | Delete S3 files + NoteView records + Note from DB |

### Subjects (`/api/subjects/`)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/` | Public | List all subjects ordered by `order` |
| POST | `/` | Admin | Create subject |
| DELETE | `/:id` | Admin | Delete subject (fails if notes are attached) |

### Announcements (`/api/announcements/`)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/` | Public | List **active** announcements ordered by `order` |
| GET | `/all` | Admin | List ALL announcements (including inactive) |
| POST | `/` | Admin | Create announcement |
| PATCH | `/:id` | Admin | Update / reorder / toggle active |
| DELETE | `/:id` | Admin | Delete announcement |

### Tests (`/api/tests/`)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/` | Public | List all tests |
| GET | `/:id` | Bearer | Get test with questions (`correctOption` excluded) |
| POST | `/:id/attempt` | Bearer | Submit answers → server scores → returns `TestAttempt` + breakdown |
| GET | `/attempts/me` | Bearer | Own attempt history |
| POST | `/` | Admin | Create test + questions |
| PUT | `/:id` | Admin | Update test metadata |
| DELETE | `/:id` | Admin | Delete TestAttempts + Test |

### Admin (`/api/admin/`) — All require at least `CONTENT_MANAGER`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/stats` | Admin | Platform stats (users, notes, announcements, views, revenue) |
| GET | `/users` | Admin | Paginated user list with search |
| PATCH | `/users/:id/plan` | Admin | Update user plan + expiry |
| PATCH | `/users/:id/role` | **SuperAdmin** | Change user role |

### Payments (`/api/payments/`)

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/create-order` | Bearer | Create Razorpay order (₹499/30d, ₹2499/180d, ₹3999/365d) |
| POST | `/verify` | Bearer | Verify HMAC signature → activate plan |
| POST | `/webhook` | Public | Razorpay async webhook (signature verified) |
