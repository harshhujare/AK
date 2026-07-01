# AjitSir Academy — Platform README

> An ed-tech platform for TET exam preparation — built for Ajit Kambale sir's audience.
> Think Physics Wallah, but focused on Maharashtra TET/CTET with a strong community at its core.

## 1. Project Overview

AjitSir Academy is a full-stack web platform where students can:
- Solve TET question papers and mock tests (MCQ, timed, auto-scored)
- Download chapter-wise notes and study PDFs
- (Future) Watch recorded lectures and live classes
- (Future) Participate in leaderboards, doubt forums, and live quizzes

The platform has multiple user roles:
- **Student** — signs up, takes tests, downloads notes, manages their subscription
- **Support Manager** — manages support tickets and user queries
- **Content Manager** — manages tests, notes, and subjects
- **Super Admin (Ajit sir / team)** — full access, analytics, user management

## 2. Tech Stack

| Layer | Technology | Reason |
|---|---|---|
| Frontend | Next.js 16 (App Router) | SSR, SEO, fast page loads |
| Styling | Tailwind CSS v4 + shadcn/ui | Consistent, accessible components |
| State | Zustand + React Query | Client state + server data caching |
| Backend | Node.js + Express | REST API, lightweight, scalable |
| Database | Neon Serverless Postgres | Relational data — users, tests, results |
| File storage | Cloudflare R2 (S3-compatible) | PDFs, images; cheaper than S3 |
| Auth | Google OAuth + email/password | JWT-based authentication |
| Payments | Razorpay | UPI + card + wallet + subscriptions |
| Cache | node-cache | In-memory cache for sessions and rate limiting |
| Hosting | Vercel (frontend) + Railway (backend) | Easy deploys, generous free tiers |
| CDN / DNS | Cloudflare | Global edge, DDoS protection |

---

## 3. Folder Structure

```text
ajitsir-academy/
├── apps/
│   ├── web/                  # Next.js frontend
│   │   ├── app/              # App Router pages
│   │   ├── components/       # Reusable UI components
│   │   ├── lib/              # Utilities, hooks, API clients
│   │   └── public/           # Static assets, icons
│   │
│   └── api/                  # Express backend
│       ├── src/
│       │   ├── routes/       # Auth, tests, notes, payments, admin, support, etc.
│       │   ├── controllers/  # Business logic per route
│       │   ├── middleware/   # Auth guard, rate limiter, file upload
│       │   ├── services/     # Razorpay, R2 storage, email
│       │   └── utils/        # Helpers, validators
│       └── prisma/
│           └── schema.prisma # Database schema
│
├── packages/
│   └── shared/               # Shared types and constants (TypeScript)
│
└── docker-compose.yml        # Local dev: Postgres
```

---

## 4. Database Schema (Prisma)

Key models — the agent should use these as the source of truth when generating backend code.

```prisma
// This is the Prisma schema for AjitSir Academy
// Source of truth for all database models

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ─── Enums ─────────────────────────────────────────────────────────────────────

enum Role {
  STUDENT
  SUPPORT_MANAGER
  CONTENT_MANAGER
  SUPER_ADMIN
}

enum Plan {
  FREE
  PAID
}

enum PaymentStatus {
  PENDING
  SUCCESS
  FAILED
  REFUNDED
}

enum AnnouncementType {
  IMAGE
  VIDEO
}

enum TestType {
  DAILY       // One per day — scheduledAt = that calendar day
  PREDEFINED  // Manually scheduled with a specific date window
  SUBJECT     // Always available, filtered by subject
}

enum NoteAccessType {
  TIMED     // access expires with user's planExpiresAt
  LIFETIME  // access granted forever once user has ever successfully paid
}

// ─── Models ────────────────────────────────────────────────────────────────────

model User {
  id            String        @id @default(cuid())
  name          String
  email         String        @unique
  passwordHash  String?
  googleId      String?       @unique
  role          Role          @default(STUDENT)
  plan          Plan          @default(FREE)
  planExpiresAt DateTime?
  paidAt        DateTime?     // set once on first successful payment, never cleared
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt
  attempts       TestAttempt[]
  payments       Payment[]
  noteViews      NoteView[]
  supportTickets SupportTicket[]
  ticketReplies  TicketReply[]
}

model Subject {
  id            String         @id @default(cuid())
  name          String         @unique
  nameMarathi   String?        // Marathi translation of subject name
  order         Int            @default(0)
  tests         Test[]
  notes         Note[]
}

model Test {
  id          String        @id @default(cuid())
  title       String
  description String?
  subjectId   String
  subject     Subject       @relation(fields: [subjectId], references: [id])
  isPaid      Boolean       @default(false)
  questions   Question[]
  attempts    TestAttempt[]
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt

  // ── Test type & scheduling ──────────────────────────────────────────────────
  type         TestType  @default(SUBJECT)
  timeLimitSec Int?      // null = untimed. 1800 = 30 min, 2700 = 45 min
  scheduledAt  DateTime? // DAILY: date it is live. PREDEFINED: window start.
  expiresAt    DateTime? // PREDEFINED only: when the window closes.
  isPublished  Boolean   @default(false) // false = draft, invisible to students

  // ── Performance indexes ─────────────────────────────────────────────────────
  @@index([type, scheduledAt])
  @@index([subjectId, isPublished])
}

model Question {
  id            String  @id @default(cuid())
  testId        String
  test          Test    @relation(fields: [testId], references: [id], onDelete: Cascade)
  text          String
  options       Json    // [{ id: "A", text: "..." }, ...]
  correctOption String  // "A" | "B" | "C" | "D"
  explanation   String?
  order         Int
}

model TestAttempt {
  id               String   @id @default(cuid())
  userId           String
  user             User     @relation(fields: [userId], references: [id])
  testId           String
  test             Test     @relation(fields: [testId], references: [id])
  answers          Json     // { questionId: selectedOption }
  score            Int
  totalMarks       Int
  timeTaken        Int?     // seconds — null for untimed test submissions
  completedAt      DateTime @default(now())

  clientAttemptId  String?  // nullable — idempotency key

  @@index([testId, score])
  @@index([userId, completedAt])
  @@unique([userId, clientAttemptId])
}

model Note {
  id           String         @id @default(cuid())
  title        String
  description  String?
  subjectId    String
  subject      Subject        @relation(fields: [subjectId], references: [id])
  fileKey      String         // AWS S3 object key
  isPaid       Boolean        @default(false)
  accessType   NoteAccessType @default(TIMED)
  pageCount    Int?
  thumbnailKey String?        // S3 key of thumbnail image
  createdAt    DateTime       @default(now())
  updatedAt    DateTime       @updatedAt
  views        NoteView[]

  @@index([subjectId])
}

model NoteView {
  id       String   @id @default(cuid())
  userId   String
  user     User     @relation(fields: [userId], references: [id])
  noteId   String
  note     Note     @relation(fields: [noteId], references: [id])
  viewedAt DateTime @default(now())

  @@index([noteId])
  @@index([userId])
}

model Announcement {
  id          String           @id @default(cuid())
  title       String
  description String?
  type        AnnouncementType @default(IMAGE)
  youtubeUrl  String?
  imageKey    String?
  isActive    Boolean          @default(true)
  order       Int              @default(0)
  createdAt   DateTime         @default(now())
  updatedAt   DateTime         @updatedAt
}

model Payment {
  id                String        @id @default(cuid())
  userId            String
  user              User          @relation(fields: [userId], references: [id])
  razorpayOrderId   String        @unique
  razorpayPaymentId String?
  amount            Int           // in paise
  status            PaymentStatus @default(PENDING)
  planDuration      Int           // days
  createdAt         DateTime      @default(now())
}

model PlanConfig {
  id           String   @id @default(cuid())
  planDuration Int      @unique
  price        Int
  label        String
  description  String?
  isActive     Boolean  @default(true)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@map("plan_config")
}

model FAQ {
  id        String   @id @default(cuid())
  question  String
  answer    String
  category  String
  order     Int      @default(0)
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([category])
  @@index([isActive])
}

enum TicketType {
  BUG_REPORT
  PAYMENT_ISSUE
  CONTENT_QUERY
  GENERAL
}

enum TicketStatus {
  OPEN
  IN_PROGRESS
  RESOLVED
}

model SupportTicket {
  id        String        @id @default(cuid())
  type      TicketType
  status    TicketStatus  @default(OPEN)
  subject   String
  message   String
  paymentId String?
  orderId   String?
  userId    String
  user      User          @relation(fields: [userId], references: [id])
  replies   TicketReply[]
  createdAt DateTime      @default(now())
  updatedAt DateTime      @updatedAt

  @@index([userId])
  @@index([status])
  @@index([type])
}

model TicketReply {
  id           String        @id @default(cuid())
  message      String
  isStaffReply Boolean       @default(false)
  ticketId     String
  ticket       SupportTicket @relation(fields: [ticketId], references: [id], onDelete: Cascade)
  authorId     String
  author       User          @relation(fields: [authorId], references: [id])
  createdAt    DateTime      @default(now())
}
```

---

## 5. API Routes

### Auth  `/api/auth`
| Method | Route | Description |
|---|---|---|
| POST | `/register` | Email + password signup |
| POST | `/login` | Email + password login, returns JWT |
| GET | `/google` | Google OAuth redirect |
| GET | `/google/callback` | Google OAuth callback |
| POST | `/logout` | Invalidate session |
| POST | `/refresh` | Refresh access token |

### Tests  `/api/tests`
| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/` | Public | List all tests (title, subject, isPaid) |
| GET | `/:id` | Student | Get test with questions (gated if isPaid) |
| POST | `/:id/attempt` | Student | Submit answers, receive score + breakdown |
| GET | `/attempts/me` | Student | Student's own attempt history |
| POST | `/` | Content Manager/Admin | Create new test |
| PUT | `/:id` | Content Manager/Admin | Update test |
| DELETE | `/:id` | Content Manager/Admin | Delete test |

### Notes  `/api/notes`
| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/` | Public | List notes (title, subject, isPaid) |
| GET | `/:id/download` | Student | Generate signed R2 URL (gated if isPaid) |
| POST | `/` | Content Manager/Admin | Upload PDF to R2, save metadata |
| DELETE | `/:id` | Content Manager/Admin | Delete note |

### Payments  `/api/payments`
| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/create-order` | Student | Create Razorpay order |
| POST | `/verify` | Student | Verify payment signature, upgrade plan |
| POST | `/webhook` | Public (HMAC) | Razorpay webhook — handle async events |

### Admin  `/api/admin`
| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/stats` | Admin | Total users, revenue, test attempts |
| GET | `/users` | Admin | Paginated user list |
| PATCH | `/users/:id/plan` | Admin | Manually upgrade/downgrade plan |

### Other Endpoints
- `/api/announcements` — Manage and fetch announcements.
- `/api/faqs` — Manage and fetch FAQs.
- `/api/subjects` — Manage test/note subjects.
- `/api/support` — Create and reply to support tickets.

---

## 6. Key Feature Specs

### 6.1 Mock Test Engine

The test-taking flow works as follows:

1. Student opens a test → frontend fetches questions (options only, no correct answer).
2. A countdown timer runs client-side. If time runs out, answers are auto-submitted.
3. On submit, POST `/api/tests/:id/attempt` sends `{ answers: { [questionId]: selectedOption } }`.
4. Backend scores the attempt server-side (never trust client-side scoring).
5. Response includes: score, total, percentage, per-question breakdown with explanation.
6. Result is saved to `TestAttempt` table. Includes an idempotency key to prevent double submits.
7. Student can review their past attempts from the dashboard.

**Important:** Correct answers must never be sent to the frontend before submission. Only send them in the attempt result response.

### 6.2 Notes / PDF Downloads

- PDFs are stored in Cloudflare R2 under a private bucket (no public access).
- When a student requests a download, backend checks their plan (`FREE` vs `PAID`) against `note.isPaid`.
- If allowed, backend generates a **signed URL** (valid for 5 minutes) and returns it to the frontend.
- Frontend opens the signed URL in a new tab — browser handles the download.
- Never expose the raw R2 file key or bucket URL to the client.

### 6.3 Subscriptions & Payments (Razorpay)

1. Student clicks "Buy Plan" → frontend calls `POST /api/payments/create-order`.
2. Backend creates a Razorpay order and returns `{ orderId, amount, currency }`.
3. Frontend opens Razorpay checkout modal with the order details.
4. On success, Razorpay returns `{ razorpayPaymentId, razorpayOrderId, razorpaySignature }`.
5. Frontend sends these to `POST /api/payments/verify`.
6. Backend verifies HMAC signature using the Razorpay secret key.
7. If valid, update `user.plan = PAID`, set `user.paidAt`, and update `user.planExpiresAt`.
8. Also handle `payment.captured` and `payment.failed` events via the Razorpay webhook.

### 6.4 Content Upload (Notes & Announcements)

- Admin/Content Manager uploads files (PDF/Images) via the panel.
- Frontend sends the file as `multipart/form-data`.
- Backend uses `multer` + `@aws-sdk/client-s3` to stream the file directly to R2.
- Only the `fileKey` (R2 object key) is stored in the database — not a public URL.

---

## 7. Auth & Authorization Rules

| Resource | FREE student | PAID student | Support Manager | Content Manager | Super Admin |
|---|---|---|---|---|---|
| List tests/notes | ✅ | ✅ | ✅ | ✅ | ✅ |
| Take paid test / Paid Notes| ❌ | ✅ | ✅ | ✅ | ✅ |
| View own attempts | ✅ | ✅ | ✅ | ✅ | ✅ |
| Reply to support tickets | ❌ | ❌ | ✅ | ❌ | ✅ |
| Manage tests/notes/subjects | ❌ | ❌ | ❌ | ✅ | ✅ |
| Admin panel / Stats | ❌ | ❌ | ❌ | ❌ | ✅ |

Use a middleware `requireAuth(roles?: Role[])` on protected routes.

---

## 8. Environment Variables

```env
# App
NODE_ENV=development
PORT=4000
FRONTEND_URL=http://localhost:3000

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/ajitsir_academy

# JWT
JWT_SECRET=your_jwt_secret_here
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_SECRET=your_refresh_secret_here

# Google OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=http://localhost:4000/api/auth/google/callback

# Razorpay
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=

# Cloudflare R2
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=ajitsir-academy
R2_ENDPOINT=https://<account_id>.r2.cloudflarestorage.com
```

---

## 9. Local Development Setup

```bash
# 1. Clone the repo
git clone https://github.com/yourorg/ajitsir-academy.git
cd ajitsir-academy

# 2. Install dependencies
npm install

# 3. Start Postgres locally (or use Neon Postgres remote URL)
docker-compose up -d

# 4. Copy env files
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env

# 5. Run DB migrations
cd apps/api
npx prisma migrate dev

# 6. Seed test data (optional)
npm run db:seed

# 7. Start both apps
cd ../../
npm run dev   # runs web on :3000 and api on :4000
```

---

## 10. Phase Roadmap

### Phase 1 — MVP (Completed)
- [x] User auth (Google + email/password)
- [x] Subject & test management (admin)
- [x] MCQ test engine with timer and auto-scoring
- [x] Test attempt history + result review
- [x] Notes upload (admin) + download (student)
- [x] Free vs paid content gating
- [x] Razorpay subscription payment
- [x] Basic student dashboard
- [x] Basic admin dashboard with stats

### Phase 2 — Growth & Management (Current)
- [x] Multiple admin roles (Content Manager, Support Manager)
- [x] Support ticket system
- [x] Announcements and FAQs
- [ ] Leaderboard (top scorers per test)
- [ ] Email notifications (welcome, payment receipt, test result)
- [ ] Performance analytics per student (weak topics, progress over time)
- [ ] Bookmarks (save questions for later)
- [ ] Referral system

### Phase 3 — Video & Community
- [ ] Recorded lecture uploads (Bunny.net or Cloudflare Stream)
- [ ] Live class scheduling and streaming
- [ ] Doubt forum / Q&A section
- [ ] Push notifications (PWA)
- [ ] Mobile app (React Native or Flutter)

---

## 11. Conventions for AI Agents

When generating code for this project, follow these rules:

1. **Language:** TypeScript everywhere — frontend and backend.
2. **API style:** REST with JSON. Use standard HTTP status codes.
3. **Error format:** All errors return `{ error: string, details?: any }`.
4. **Auth:** Use JWT access tokens (15 min expiry) + refresh tokens (7 days). Store refresh token in httpOnly cookie.
5. **Validation:** Use `zod` for all request body validation on the backend.
6. **Database:** Always go through Prisma — no raw SQL unless absolutely necessary.
7. **File uploads:** Stream to R2 directly; do not save files to disk on the server.
8. **Payments:** Always verify Razorpay signature server-side before upgrading a user's plan. Never trust the client.
9. **Correct answers:** Never include `correctOption` in the GET `/api/tests/:id` response. Only return it in the attempt result.
10. **Naming:** camelCase for variables/functions, PascalCase for components and types, kebab-case for file names.
11. **Commits:** Conventional commits — `feat:`, `fix:`, `chore:`, `docs:` prefixes.
12. **No hardcoded secrets** — always read from `process.env`.

---

## 12. Contact & Context

- **Platform:** AjitSir Academy
- **Creator:** Ajit Kambale sir — Maharashtra TET educator on YouTube
- **Target audience:** Students preparing for TET (Primary + Upper Primary) in Maharashtra
- **Primary language of content:** Marathi + Hindi (UI can be English)
- **Business model:** Freemium — free tests + notes preview; paid subscription unlocks everything

---

*This README is the single source of truth for the project. Update it as the platform evolves.*
