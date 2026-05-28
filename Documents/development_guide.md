# Development Guide

## 1. Environment Variables

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

## 2. Local Development

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

## 3. Known Gotchas & Decisions

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

## 4. Future Work (v2 Ideas)

- [ ] Email/password auth (schema already supports `passwordHash`)
- [ ] Freemium gating (some notes paid-only)
- [ ] Full-text search across notes
- [ ] Student progress tracking
- [ ] Multiple-choice test results analytics for admins
- [ ] Push notifications for new uploads
- [ ] WhatsApp integration (share notes link)
- [ ] Mobile app (React Native) using the same API
