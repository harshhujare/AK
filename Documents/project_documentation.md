# AjitSir Academy — Project Documentation (v1)

> **Last updated:** May 2026  
> **Status:** v1 successfully deployed

---

## 1. Project Overview

**AjitSir Academy** is a mobile-first ed-tech platform built for **Maharashtra TET (Teacher Eligibility Test)** aspirants. It provides:

- Secure PDF study notes viewable in-browser (never downloadable)
- Subject-filtered notes library
- Announcement carousel on the homepage
- Admin content management panel
- Payment-gated content (Razorpay integration)
- Role-based access (Super Admin / Content Manager / Student)

---

## 2. Monorepo Structure

```
ajit_sir/                          ← Turborepo root
├── apps/
│   ├── api/                       ← Express.js REST API (Node.js)
│   └── web/                       ← Next.js 16 frontend
├── packages/
│   └── shared/                    ← Shared TypeScript types & Zod schemas
├── Documents/                     ← Project documentation (this file)
├── docker-compose.yml             ← Local Postgres container
├── turbo.json                     ← Turborepo pipeline config
├── package.json                   ← Root workspaces config
└── vercel.json                    ← Vercel deployment config (frontend)
```

### Turborepo Tasks

| Command | Description |
|---|---|
| `npm run dev` | Run both `api` and `web` in parallel (hot reload) |
| `npm run build` | Production build of all packages |
| `npm run type-check` | TypeScript check across all workspaces |
| `npm run lint` | ESLint across all workspaces |

---

## 3. Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 16 (App Router), React 19, Vanilla CSS |
| **Backend** | Express.js 4, Node.js ≥ 20 |
| **Database** | PostgreSQL via **Neon** (serverless, scale-to-zero) |
| **ORM** | Prisma 6 |
| **File Storage** | AWS S3 (PDFs + thumbnails) |
| **Auth** | Google Sign-In (Google Identity Services) + JWT |
| **Payments** | Razorpay |
| **PDF Rendering** | PDF.js v5 (canvas-based, client-side) |
| **State Management** | Zustand (auth store) |
| **Data Fetching** | TanStack React Query v5 |
| **Carousel** | Embla Carousel v8 |
| **Fonts** | Playfair Display (serif) + DM Sans (sans) |
| **Package Manager** | npm workspaces + Turborepo |

---

## 4. Database Schema (Prisma)

**File:** `apps/api/prisma/schema.prisma`

### Enums

```prisma
enum Role {
  STUDENT
  CONTENT_MANAGER
  SUPER_ADMIN
}

enum Plan { FREE | PAID }
enum PaymentStatus { PENDING | SUCCESS | FAILED | REFUNDED }
enum AnnouncementType { TEXT | VIDEO }
```

### Models

#### `User`
| Field | Type | Notes |
|---|---|---|
| `id` | String (cuid) | Primary key |
| `name` | String | |
| `email` | String (unique) | |
| `passwordHash` | String? | `null` for Google-only users |
| `googleId` | String? (unique) | Google OAuth ID |
| `role` | Role | Default: `STUDENT` |
| `plan` | Plan | Default: `FREE` |
| `planExpiresAt` | DateTime? | Set when `plan = PAID` |
| `createdAt` / `updatedAt` | DateTime | Auto-managed |

#### `Subject`
| Field | Type | Notes |
|---|---|---|
| `id` | String (cuid) | |
| `name` | String (unique) | English name |
| `nameMarathi` | String? | Marathi translation |
| `order` | Int | Display order |

Default subjects: Child Development, Marathi, English, Maths, EVS

#### `Note`
| Field | Type | Notes |
|---|---|---|
| `id` | String (cuid) | |
| `title` | String | |
| `description` | String? | |
| `subjectId` | String | FK → Subject |
| `fileKey` | String | **AWS S3 key — NEVER sent to client** |
| `isPaid` | Boolean | Default: `false` |
| `pageCount` | Int? | |
| `thumbnailKey` | String? | S3 key of auto-generated JPEG thumbnail |
| Indexes | `subjectId` | |

#### `NoteView`
Audit log. One row per user × note view event.  
| `userId` | FK → User |  
| `noteId` | FK → Note |  
| `viewedAt` | DateTime |

> **Important:** Must be deleted before deleting a `Note` (foreign key constraint).

#### `Test` + `Question` + `TestAttempt`
Practice test system. `Test` → many `Question`s. Students submit `TestAttempt`s.  
- `TestAttempt` must be deleted before deleting a `Test`.
- `Questions` cascade-delete with `Test` (`onDelete: Cascade`).

#### `Announcement`
Hero slider content.  
| `type` | TEXT or VIDEO |  
| `youtubeUrl` | String? | Required when `type = VIDEO` |  
| `isActive` | Boolean | Only active ones shown on homepage |  
| `order` | Int | Display order |

#### `Payment`
Razorpay payment records.  
| `amount` | Int | In paise (₹1 = 100 paise) |  
| `planDuration` | Int | Days (30 / 180 / 365) |  
| `status` | PaymentStatus | |

---

## 5. Backend API (`apps/api/`)

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

### Middleware: Auth

```typescript
requireAuth()          // Any authenticated user (JWT required)
requireAdmin()         // SUPER_ADMIN or CONTENT_MANAGER
requireSuperAdmin()    // SUPER_ADMIN only
```

JWT payload:
```typescript
{ userId: string, role: Role, plan: Plan, iat: number, exp: number }
```

Access token: 15-minute TTL (configurable via `JWT_EXPIRES_IN`)  
Refresh token: 7-day TTL, stored as httpOnly cookie

### Neon / Database Connection

`withRetry(fn, attempts = 2)` — retries once on Neon cold-start errors  
(`PrismaClientInitializationError` or `"Can't reach database server"` → waits 3s, retries).

---

## 6. API Route Reference

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

---

## 7. Frontend (`apps/web/`)

**Framework:** Next.js 16 (App Router)  
**Port:** 3000 (development)

### Directory Structure

```
apps/web/
├── app/
│   ├── layout.tsx          ← Root layout (fonts, Navbar, ThemeProvider, QueryProvider)
│   ├── page.tsx            ← Homepage (Hero slider + Notes grid + About + Footer)
│   ├── globals.css         ← Global CSS + design tokens (CSS variables)
│   ├── (auth)/
│   │   └── login/page.tsx  ← Google Sign-In only login page
│   └── (admin)/
│       ├── layout.tsx      ← Admin shell (sidebar + mobile bottom bar, role guard)
│       └── admin/
│           ├── page.tsx          ← Dashboard (stats cards)
│           ├── notes/
│           │   ├── page.tsx      ← Notes management table (search, delete)
│           │   └── upload/page.tsx ← PDF upload with drag-and-drop + thumbnail preview
│           ├── subjects/page.tsx  ← Subjects CRUD
│           ├── announcements/page.tsx ← Announcements management
│           └── users/page.tsx    ← User management (role/plan changes)
├── components/
│   ├── layout/Navbar.tsx   ← Sticky navbar (auth state, theme toggle, admin link)
│   ├── notes/
│   │   ├── SecureViewer.tsx     ← Full-screen PDF viewer (PDF.js canvas)
│   │   ├── WatermarkCanvas.tsx  ← Diagonal watermark overlay (user name + masked email)
│   │   ├── NoteCard.tsx         ← Note card (thumbnail, title, subject badge, lock state)
│   │   └── SubjectFilter.tsx    ← Horizontal scrollable subject pill filter
│   ├── auth/
│   │   └── GoogleSignInButton.tsx ← GIS button wrapper
│   └── ui/
│       └── Slider.tsx           ← Embla Carousel announcement slider
├── hooks/
│   ├── useNotes.ts          ← React Query: GET /api/notes?subjectId=
│   ├── useAnnouncements.ts  ← React Query: GET /api/announcements
│   └── useSubjects.ts       ← React Query: GET /api/subjects
└── lib/
    ├── api-client.ts        ← Axios instance with auto Bearer injection + 401 refresh logic
    ├── auth-store.ts        ← Zustand store (user, accessToken, login, logout, initialize)
    ├── theme.tsx            ← ThemeContext (dark/light toggle, localStorage persist)
    └── query-provider.tsx   ← TanStack Query client provider
```

### Routing

| Route | Component | Notes |
|---|---|---|
| `/` | `app/page.tsx` | Public homepage |
| `/login` | `app/(auth)/login/page.tsx` | Google Sign-In only |
| `/admin` | `app/(admin)/admin/page.tsx` | Dashboard — requires admin role |
| `/admin/notes` | `app/(admin)/admin/notes/page.tsx` | |
| `/admin/notes/upload` | `app/(admin)/admin/notes/upload/page.tsx` | |
| `/admin/subjects` | `app/(admin)/admin/subjects/page.tsx` | |
| `/admin/announcements` | `app/(admin)/admin/announcements/page.tsx` | |
| `/admin/users` | `app/(admin)/admin/users/page.tsx` | SUPER_ADMIN only |

### Auth Flow

1. User clicks "Sign in with Google" → GIS returns an ID token
2. Frontend POSTs token to `POST /api/auth/google`
3. API verifies with Google, upserts user, issues:
   - **Access token** (JWT, 15 min) → returned in response body
   - **Refresh token** (JWT, 7 days) → set as httpOnly cookie
4. Access token stored in `sessionStorage` (not localStorage)
5. Axios interceptor injects `Authorization: Bearer <token>` on every request
6. On 401, interceptor calls `POST /api/auth/refresh` (uses cookie) → retries original

### State: `useAuthStore` (Zustand)

```typescript
{
  user: User | null,
  accessToken: string | null,
  isLoading: boolean,
  isInitialized: boolean,
  login(accessToken, user): void,
  logout(): Promise<void>,
  initialize(): Promise<void>   // Called on page load, restores from sessionStorage
}
```

### Theme System

- CSS variables defined in `globals.css` under `[data-theme="light"]` and `[data-theme="dark"]`
- `ThemeProvider` reads from localStorage on mount, toggles `data-theme` on `<html>`
- Anti-flash script injected in `<head>` (inline `<script>`) before first paint

### Secure PDF Viewer (`SecureViewer.tsx`)

Security layers applied:
1. PDF bytes fetched via `GET /api/notes/:id/stream` (API proxies from S3 — raw S3 URL never sent to browser)
2. PDF.js renders each page onto a `<canvas>` element (not `<embed>` or `<iframe>`)
3. `user-select: none` and `-webkit-touch-callout: none` on the overlay
4. Context menu (`right-click`) blocked via `document.addEventListener('contextmenu', ...)`
5. Keyboard shortcuts blocked: `Ctrl+P`, `Ctrl+S`, `Ctrl+C`, `Ctrl+A`
6. `@media print { display: none !important }` — prevents browser print-to-PDF
7. **Dynamic watermark** overlaid on every page: `"Name · j***@gmail.com · 26 May 2026"`

### Note Upload Flow (`upload/page.tsx`)

1. User drags/drops or selects a PDF (max 50 MB)
2. **Client-side thumbnail generation**: PDF.js renders page 1 at 1.5× scale → `canvas.toBlob()` → JPEG preview shown instantly
3. User fills title, description, selects subject, toggles paid/free
4. Form submits `multipart/form-data` to `POST /api/notes`
5. API uploads PDF + thumbnail to AWS S3, saves metadata to DB
6. On success, redirects to `/admin/notes`

---

## 8. Shared Package (`packages/shared/`)

Contains types and Zod validation schemas shared between `api` and `web`.

**Key types exported:**
- `Role`, `Plan`, `PaymentStatus`, `AnnouncementType` (string literal unions)
- `User`, `Subject`, `Note`, `Test`, `Question`, `Announcement`, `Payment`, `NoteView`, `JwtPayload`
- `ADMIN_ROLES`, `isAdmin()`, `isSuperAdmin()` helpers

**Key Zod schemas:**
- `RegisterSchema`, `LoginSchema`, `GoogleAuthSchema`
- `CreateNoteSchema`, `CreateSubjectSchema`
- `CreateTestSchema`, `UpdateTestSchema`, `CreateQuestionSchema`, `SubmitAttemptSchema`
- `CreateOrderSchema`, `VerifyPaymentSchema`, `UpdateUserPlanSchema`

---

## 9. Role System

| Role | Permissions |
|---|---|
| `STUDENT` | View homepage, browse notes (logged in), stream PDFs, take tests |
| `CONTENT_MANAGER` | + Upload/edit/delete notes, manage subjects and announcements |
| `SUPER_ADMIN` | + Everything: manage users, change roles |

**Important:** Users page (`/admin/users`) is SUPER_ADMIN only in the frontend nav too.

### Current Accounts (as of v1 launch)

| Email | Role |
|---|---|
| `harshhujare5124@gmail.com` | SUPER_ADMIN |
| `subhashhujare5147@gmail.com` | SUPER_ADMIN |
| `prathmeshnk9158@gmail.com` | CONTENT_MANAGER |

---

## 10. Environment Variables

### Backend (`apps/api/.env`)

```env
# App
NODE_ENV=development | production
PORT=4000
FRONTEND_URL=http://localhost:3000   # Used for CORS

# Database
DATABASE_URL=postgresql://...        # Neon connection string (includes connect_timeout, pool_timeout)

# JWT
JWT_SECRET=<long random string>
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_SECRET=<another long random string>

# Google OAuth
GOOGLE_CLIENT_ID=<project>.apps.googleusercontent.com

# Razorpay
RAZORPAY_KEY_ID=rzp_live_...
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...

# AWS S3
AWS_REGION=ap-southeast-2
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_BUCKET_NAME=aws-bucket-for-ajitsir
```

### Frontend (`apps/web/.env.local`)

```env
NEXT_PUBLIC_API_URL=http://localhost:4000   # In prod: your Render/Railway API URL
NEXT_PUBLIC_GOOGLE_CLIENT_ID=<same as backend GOOGLE_CLIENT_ID>
```

---

## 11. Infrastructure & Deployment

### Frontend (Vercel)
- **Build command:** `npm run build --workspace=@ajitsir/shared && npm run build --workspace=web`
- **Output directory:** `apps/web/.next`
- **Framework:** Next.js

**`vercel.json`:**
```json
{
  "buildCommand": "npm run build --workspace=@ajitsir/shared && npm run build --workspace=web",
  "outputDirectory": "apps/web/.next",
  "installCommand": "npm install",
  "framework": "nextjs"
}
```

### Backend (Manual / Render / Railway)
- Run `npm run build` in `apps/api/` → outputs to `dist/`
- Start: `node dist/index.js`
- Set all environment variables from section 10 above

### Database (Neon)
- Serverless PostgreSQL — auto-scales to zero
- Connection string format: `postgresql://user:pass@ep-xxx.region.aws.neon.tech/neondb?sslmode=require&connect_timeout=30&pool_timeout=30`
- The `withRetry()` helper handles the Neon cold-start delay (~2-4 seconds)

### File Storage (AWS S3)
- **PDFs** stored as: `notes/<uuid>.pdf`
- **Thumbnails** stored as: `notes/thumbnails/<uuid>.jpg`
- Bucket is **private** — files are never directly accessed via presigned URLs from the browser
- The API proxies all file access via `GET /api/notes/:id/stream` and `GET /api/notes/:id/thumbnail`

### PDF.js Worker
- PDF.js v5 uses `.mjs` worker format (not available on CDN at time of build)
- Worker file copied to `apps/web/public/pdf.worker.min.mjs`
- Loaded via: `pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'`
- Upload page uses CDN worker (less strict, temporary): `cdnjs.cloudflare.com/ajax/libs/pdf.js/${version}/pdf.worker.min.mjs`

---

## 12. Local Development

### Prerequisites
- Node.js ≥ 20
- npm ≥ 10
- Docker (for local Postgres, optional — can use Neon directly)

### Steps

```bash
# 1. Clone and install
git clone <repo>
cd ajit_sir
npm install

# 2. Copy env files
cp apps/api/.env.example apps/api/.env
# Fill in the values (see section 10)

# apps/web/.env.local already has localhost defaults

# 3. (Optional) Start local Postgres
docker compose up -d

# 4. Run DB migrations
cd apps/api
npx prisma migrate dev

# 5. (Optional) Seed subjects
npx ts-node prisma/seed.ts

# 6. Start development servers
cd ../..
npm run dev   # Starts both api (port 4000) and web (port 3000) via Turborepo
```

### Prisma Commands (from `apps/api/`)

```bash
npx prisma studio          # GUI to browse/edit DB
npx prisma migrate dev     # Apply pending migrations
npx prisma generate        # Re-generate Prisma client after schema changes
npx prisma db push         # Push schema to DB without migration (dev only)
```

---

## 13. Payments (Razorpay)

### Plan Pricing

| Duration | Price |
|---|---|
| 30 days | ₹499 |
| 180 days | ₹2,499 |
| 365 days | ₹3,999 |

### Flow
1. `POST /api/payments/create-order` → creates Razorpay order + pending `Payment` DB record
2. Frontend opens Razorpay checkout modal
3. User pays
4. Frontend POSTs `POST /api/payments/verify` with `razorpayOrderId`, `razorpayPaymentId`, `razorpaySignature`
5. API verifies HMAC signature server-side
6. On success: `Payment.status = SUCCESS`, `User.plan = PAID`, `User.planExpiresAt` set
7. Razorpay also fires webhooks to `POST /api/payments/webhook` (async fallback)

### Plan Expiry
- Access tokens embed `plan` at time of signing
- On each request with `requireAuth(['STUDENT'], 'PAID')`, the middleware checks `user.planExpiresAt` from DB
- If expired: silently downgrades `plan = FREE` in DB and rejects the request

---

## 14. Known Gotchas & Decisions

| Issue | Resolution |
|---|---|
| **NoteView FK constraint** | `NoteView` rows must be deleted before `Note`. Route handles this: `deleteMany({ noteId })` then `delete({ id })`. |
| **TestAttempt FK constraint** | Same pattern: delete `TestAttempt`s before `Test`. |
| **Neon cold start** | `withRetry()` in `prisma.ts` retries once after 3 seconds on initialization errors. |
| **PDF.js v5 worker** | Worker `.mjs` file must be served locally from `/public/` — CDN doesn't host v5 yet. |
| **No presigned URLs in browser** | S3 raw URLs never leave the server. API streams bytes directly from S3 to the browser response. |
| **sessionStorage over localStorage** | Access tokens stored in `sessionStorage` so they're cleared on tab close (security). |
| **Refresh token as httpOnly cookie** | Prevents JavaScript access to refresh tokens (XSS protection). |
| **Google Sign-In only** | Email/password auth is stubbed in the DB schema (`passwordHash` field) but not exposed in the UI. |
| **Razorpay lazy init** | `getRazorpayClient()` is a lazy singleton — Razorpay constructor is only called if keys exist, preventing startup crash in dev. |
| **CORS** | Allows only `FRONTEND_URL` and `http://localhost:3001`. |
| **Multer memory storage** | Files are never written to disk — streamed directly from memory to S3. |
| **Thumbnail generation client-side** | Done in the browser on upload (page 1 → JPEG blob) so the server doesn't need ImageMagick or headless Chrome. |

---

## 15. Future Work (v2 Ideas)

- [ ] Email/password auth (schema already supports `passwordHash`)
- [ ] Freemium gating (some notes paid-only)
- [ ] Full-text search across notes
- [ ] Student progress tracking
- [ ] Multiple-choice test results analytics for admins
- [ ] Push notifications for new uploads
- [ ] WhatsApp integration (share notes link)
- [ ] Mobile app (React Native) using the same API

---

*End of documentation. For questions contact the development team.*
