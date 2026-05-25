# AjitSir Academy — Platform README

> An ed-tech platform for TET exam preparation — built for Ajit Kambale sir's audience.
> Think Physics Wallah, but focused on Maharashtra TET/CTET with a strong community at its core.


## 1. Project Overview

AjitSir Academy is a full-stack web platform where students can:
- Solve TET question papers and mock tests (MCQ, timed, auto-scored)
- Download chapter-wise notes and study PDFs
- (Future) Watch recorded lectures and live classes
- (Future) Participate in leaderboards, doubt forums, and live quizzes

The platform has two user roles:
- **Student** — signs up, takes tests, downloads notes, manages their subscription
- **Admin (Ajit sir / team)** — uploads content, manages question banks, views analytics


## 2. Tech Stack

| Layer | Technology | Reason |
|---|---|---|
| Frontend | Next.js 14 (App Router) | SSR, SEO, fast page loads |
| Styling | Tailwind CSS + shadcn/ui | Consistent, accessible components |
| State | Zustand + React Query | Client state + server data caching |
| Backend | Node.js + Express  | REST API, lightweight, scalable |

| Database | PostgreSQL | Relational data — users, tests, results |
| File storage | Cloudflare R2 (S3-compatible) | PDFs, images; cheaper than S3 |
| Auth | NextAuth.js (or Clerk) | Google OAuth + email/password |
| Payments | Razorpay | UPI + card + wallet + subscriptions |
| Cache | Redis | Sessions, rate limiting, leaderboard cache |

| Hosting | Vercel (frontend) + Railway (backend) | Easy deploys, generous free tiers |
| CDN / DNS | Cloudflare | Global edge, DDoS protection |

---

## 3. Folder Structure

```
ajitsir-academy/
├── apps/
│   ├── web/                  # Next.js frontend
│   │   ├── app/              # App Router pages
│   │   │   ├── (auth)/       # Login, register, forgot password
│   │   │   ├── (student)/    # Dashboard, tests, notes, profile
│   │   │   ├── (admin)/      # Admin panel — upload content, analytics
│   │   │   └── api/          # Next.js API routes (auth, webhooks)
│   │   ├── components/       # Reusable UI components
│   │   │   ├── ui/           # shadcn/ui base components
│   │   │   ├── test/         # MCQ engine, timer, result card
│   │   │   ├── notes/        # PDF viewer, download button
│   │   │   └── layout/       # Navbar, sidebar, footer
│   │   ├── lib/              # Utilities, hooks, API clients
│   │   └── public/           # Static assets, icons
│   │
│   └── api/                  # Express backend
│       ├── src/
│       │   ├── routes/       # Auth, tests, notes, payments, admin
│       │   ├── controllers/  # Business logic per route
│       │   ├── middleware/    # Auth guard, rate limiter, file upload
│       │   ├── services/     # Razorpay, R2 storage, email
│       │   └── utils/        # Helpers, validators
│       └── prisma/
│           └── schema.prisma # Database schema
│
├── packages/
│   └── shared/               # Shared types and constants (TypeScript)
│
└── docker-compose.yml        # Local dev: Postgres + Redis
```

---

## 4. Database Schema (Prisma)

Key models — the agent should use these as the source of truth when generating backend code.

```prisma
model User {
  id            String       @id @default(cuid())
  name          String
  email         String       @unique
  passwordHash  String?
  googleId      String?      @unique
  role          Role         @default(STUDENT)
  plan          Plan         @default(FREE)
  planExpiresAt DateTime?
  createdAt     DateTime     @default(now())
  attempts      TestAttempt[]
  payments      Payment[]
}

enum Role  { STUDENT ADMIN }
enum Plan  { FREE PAID }

model Subject {
  id        String    @id @default(cuid())
  name      String                          // e.g. "Child Development"
  tests     Test[]
  notes     Note[]
}

model Test {
  id          String       @id @default(cuid())
  title       String
  description String?
  subjectId   String
  subject     Subject      @relation(fields: [subjectId], references: [id])
  isPaid      Boolean      @default(false)
  questions   Question[]
  attempts    TestAttempt[]
  createdAt   DateTime     @default(now())
}

model Question {
  id            String   @id @default(cuid())
  testId        String
  test          Test     @relation(fields: [testId], references: [id])
  text          String
  options       Json     // [{ id: "A", text: "..." }, ...]
  correctOption String   // "A" | "B" | "C" | "D"
  explanation   String?
  order         Int
}

model TestAttempt {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id])
  testId      String
  test        Test     @relation(fields: [testId], references: [id])
  answers     Json     // { questionId: selectedOption }
  score       Int
  totalMarks  Int
  timeTaken   Int      // seconds
  completedAt DateTime @default(now())
}

model Note {
  id        String   @id @default(cuid())
  title     String
  subjectId String
  subject   Subject  @relation(fields: [subjectId], references: [id])
  fileKey   String   // Cloudflare R2 object key
  isPaid    Boolean  @default(false)
  createdAt DateTime @default(now())
}

model Payment {
  id                String        @id @default(cuid())
  userId            String
  user              User          @relation(fields: [userId], references: [id])
  razorpayOrderId   String        @unique
  razorpayPaymentId String?
  amount            Int           // in paise
  status            PaymentStatus @default(PENDING)
  planDuration      Int           // days (e.g. 30, 365)
  createdAt         DateTime      @default(now())
}

enum PaymentStatus { PENDING SUCCESS FAILED REFUNDED }
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
| POST | `/` | Admin | Create new test |
| PUT | `/:id` | Admin | Update test |
| DELETE | `/:id` | Admin | Delete test |

### Notes  `/api/notes`
| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/` | Public | List notes (title, subject, isPaid) |
| GET | `/:id/download` | Student | Generate signed R2 URL (gated if isPaid) |
| POST | `/` | Admin | Upload PDF to R2, save metadata |
| DELETE | `/:id` | Admin | Delete note |

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

---

## 6. Key Feature Specs

### 6.1 Mock Test Engine

The test-taking flow works as follows:

1. Student opens a test → frontend fetches questions (options only, no correct answer).
2. A countdown timer runs client-side. If time runs out, answers are auto-submitted.
3. On submit, POST `/api/tests/:id/attempt` sends `{ answers: { [questionId]: selectedOption } }`.
4. Backend scores the attempt server-side (never trust client-side scoring).
5. Response includes: score, total, percentage, per-question breakdown with explanation.
6. Result is saved to `TestAttempt` table.
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
7. If valid, update `user.plan = PAID` and `user.planExpiresAt = now + planDuration days`.
8. Also handle `payment.captured` and `payment.failed` events via the Razorpay webhook.

### 6.4 Admin Content Upload

- Admin uploads a PDF via the admin panel.
- Frontend sends the file to `POST /api/notes` as `multipart/form-data`.
- Backend uses `multer` + a Cloudflare R2 SDK (AWS SDK v3 with custom endpoint) to stream the file directly to R2.
- Only the `fileKey` (R2 object key) is stored in the database — not a public URL.

---

## 7. Auth & Authorization Rules

| Resource | FREE student | PAID student | Admin |
|---|---|---|---|
| List tests | ✅ | ✅ | ✅ |
| Take free test | ✅ | ✅ | ✅ |
| Take paid test | ❌ | ✅ | ✅ |
| Download free notes | ✅ | ✅ | ✅ |
| Download paid notes | ❌ | ✅ | ✅ |
| View own attempts | ✅ | ✅ | ✅ |
| Admin panel | ❌ | ❌ | ✅ |

Use a middleware `requireAuth(roles?: Role[], plan?: Plan)` on protected routes.

---

## 8. Environment Variables

```env
# App
NODE_ENV=development
PORT=4000
FRONTEND_URL=http://localhost:3000

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/ajitsir_academy

# Redis
REDIS_URL=redis://localhost:6379

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

# 3. Start Postgres + Redis locally
docker-compose up -d

# 4. Copy env files
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env

# 5. Run DB migrations
cd apps/api
npx prisma migrate dev

# 6. Seed test data (optional)
npx prisma db seed

# 7. Start both apps
cd ../../
npm run dev   # runs web on :3000 and api on :4000
```

---

## 10. Phase Roadmap

### Phase 1 — MVP (Build this first)
- [ ] User auth (Google + email/password)
- [ ] Subject & test management (admin)
- [ ] MCQ test engine with timer and auto-scoring
- [ ] Test attempt history + result review
- [ ] Notes upload (admin) + download (student)
- [ ] Free vs paid content gating
- [ ] Razorpay subscription payment
- [ ] Basic student dashboard
- [ ] Basic admin dashboard with stats

### Phase 2 — Growth
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
