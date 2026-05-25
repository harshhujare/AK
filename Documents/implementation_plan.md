# AjitSir Academy — Multi-Phase Build Plan

## Overview

**AjitSir Academy** is a freemium ed-tech platform for Maharashtra TET/CTET exam preparation, built for Ajit Kambale sir's YouTube audience. Think Physics Wallah, but laser-focused on TET with a community at its core.

**Stack:** Next.js 14 (App Router) · Tailwind CSS + shadcn/ui · Express API · PostgreSQL + Prisma · Cloudflare R2 · Razorpay · Redis · NextAuth.js

**Monorepo layout:** `apps/web` (Next.js) + `apps/api` (Express) + `packages/shared` (TypeScript types)

---

## Open Questions

> [!IMPORTANT]
> Please answer these before I start building so I can avoid rework:

1. **Auth strategy**: The README lists *NextAuth.js or Clerk* — which do you prefer? NextAuth is more customizable (and free); Clerk has a polished UI out of the box but has cost at scale.
2. **Monorepo tooling**: Should I use **Turborepo** (recommended for this stack) or keep it as a simple `npm workspaces` setup?
3. **Design language**: A design demo (`ajitsir_test_screen.html`) already exists — minimal, editorial, black-on-white with DM Serif Display. Should I match this style exactly across the entire platform, or is it just a prototype?
4. **Content language**: The README says content is in Marathi/Hindi but the UI is English. Should the UI support **i18n** (Marathi/English toggle) from Phase 1, or English-only for now?
5. **Redis**: Do you have a Redis instance (Upstash is free-tier friendly) or should I defer Redis and use in-memory caching for Phase 1?

---

## Phase 1 — MVP

> Goal: A working platform where students can register, take tests, download notes, and subscribe. Admin can manage all content.

**Estimated scope:** ~6–8 weeks of focused development.

---

### 1.1 — Monorepo & Project Scaffolding

Set up the full project skeleton before writing any feature code.

#### [NEW] `package.json` (root)
- Turborepo or npm workspaces config
- Scripts: `dev`, `build`, `lint`, `type-check`

#### [NEW] `apps/web/` — Next.js 14 (App Router)
- Init with `create-next-app` + TypeScript + Tailwind
- Install: `shadcn/ui`, `zustand`, `@tanstack/react-query`, `next-auth`, `axios`, `zod`
- Set up `tailwind.config.ts` with DM Serif Display + DM Sans fonts (matching existing design demo)

#### [NEW] `apps/api/` — Express backend
- Init with TypeScript, `ts-node`, `nodemon`
- Install: `express`, `prisma`, `@prisma/client`, `zod`, `bcryptjs`, `jsonwebtoken`, `cookie-parser`, `cors`, `multer`, `@aws-sdk/client-s3`, `razorpay`, `ioredis`

#### [NEW] `packages/shared/`
- Shared TypeScript types: `User`, `Test`, `Question`, `Note`, `Payment`, `TestAttempt`
- Shared Zod schemas for cross-validation

#### [NEW] `apps/api/prisma/schema.prisma`
- Full schema as defined in README (User, Subject, Test, Question, TestAttempt, Note, Payment)
- Enums: `Role`, `Plan`, `PaymentStatus`

#### [NEW] `docker-compose.yml`
- PostgreSQL + Redis for local dev

#### [NEW] `.env.example` files (web + api)
- All vars from Section 8 of README

---

### 1.2 — Backend: Auth System

#### [NEW] `apps/api/src/routes/auth.ts`
| Route | Description |
|---|---|
| `POST /register` | Hash password with bcrypt, create user, issue tokens |
| `POST /login` | Verify credentials, issue JWT access token (15m) + refresh token (7d, httpOnly cookie) |
| `POST /refresh` | Validate refresh token cookie, issue new access token |
| `POST /logout` | Clear refresh token cookie |
| `GET /google` | Passport.js Google OAuth redirect |
| `GET /google/callback` | OAuth callback → create/find user, issue tokens |

#### [NEW] `apps/api/src/middleware/auth.ts`
- `requireAuth(roles?, plan?)` middleware — validates JWT, checks role and plan access

#### [NEW] `apps/api/src/services/token.ts`
- `signAccessToken(userId)`, `signRefreshToken(userId)`, `verifyToken(token)`

---

### 1.3 — Backend: Tests & Question Bank

#### [NEW] `apps/api/src/routes/tests.ts`
| Route | Auth | Key Logic |
|---|---|---|
| `GET /` | Public | Return list — never include `correctOption` |
| `GET /:id` | Student | Return questions — **never** include `correctOption` |
| `POST /:id/attempt` | Student | Server-side scoring; return breakdown with explanations |
| `GET /attempts/me` | Student | User's own history |
| `POST /` | Admin | Create test + questions |
| `PUT /:id` | Admin | Update test |
| `DELETE /:id` | Admin | Delete test |

#### [NEW] `apps/api/src/controllers/tests.ts`
- `scoreAttempt()` — core scoring logic
- Result format: `{ score, totalMarks, percentage, breakdown: [{ questionId, selected, correct, explanation }] }`

> [!WARNING]
> `correctOption` must **never** appear in the `GET /:id` response. Only in the attempt result. This is a hard security rule.

---

### 1.4 — Backend: Notes & File Storage

#### [NEW] `apps/api/src/routes/notes.ts`
| Route | Auth | Key Logic |
|---|---|---|
| `GET /` | Public | List notes (no file URL) |
| `GET /:id/download` | Student | Check plan gating → generate signed R2 URL (5 min TTL) |
| `POST /` | Admin | Multer stream → R2 upload → save fileKey in DB |
| `DELETE /:id` | Admin | Delete from R2 + DB |

#### [NEW] `apps/api/src/services/r2.ts`
- `uploadToR2(stream, key)` — AWS SDK v3 S3Client with R2 endpoint
- `getSignedUrl(key, expiresIn)` — presigned GET URL
- `deleteFromR2(key)`

> [!IMPORTANT]
> Never save files to disk. Always stream directly from multer to R2.

---

### 1.5 — Backend: Payments (Razorpay)

#### [NEW] `apps/api/src/routes/payments.ts`
| Route | Auth | Key Logic |
|---|---|---|
| `POST /create-order` | Student | Create Razorpay order, save pending Payment record |
| `POST /verify` | Student | HMAC signature verification → upgrade `user.plan` + set `planExpiresAt` |
| `POST /webhook` | Public | HMAC-verified webhook → handle `payment.captured` / `payment.failed` |

#### [NEW] `apps/api/src/services/razorpay.ts`
- `createOrder(amount, currency, receipt)`
- `verifySignature(orderId, paymentId, signature)` — `crypto.createHmac`

---

### 1.6 — Backend: Admin Routes

#### [NEW] `apps/api/src/routes/admin.ts`
| Route | Description |
|---|---|
| `GET /stats` | Total users, revenue (sum of successful payments), test attempts |
| `GET /users` | Paginated user list with plan/role info |
| `PATCH /users/:id/plan` | Manually upgrade/downgrade plan |

---

### 1.7 — Frontend: Auth Pages

#### [NEW] `apps/web/app/(auth)/login/page.tsx`
- Email/password form + "Continue with Google" button
- Zod validation, error states, loading spinner

#### [NEW] `apps/web/app/(auth)/register/page.tsx`
- Name, email, password, confirm password
- Same validation pattern

#### [NEW] `apps/web/lib/auth.ts`
- NextAuth config: Google provider + Credentials provider
- Session callbacks — attach `role` and `plan` to session

---

### 1.8 — Frontend: Student-Facing Pages

#### [NEW] `apps/web/app/(student)/dashboard/page.tsx`
- Welcome card with name and plan badge
- Quick stats: tests taken, avg score, notes downloaded
- CTA: "Browse Tests" and "View Notes"

#### [NEW] `apps/web/app/(student)/tests/page.tsx`
- Grid of test cards (subject, title, question count, FREE/PAID badge)
- Filter by subject

#### [NEW] `apps/web/app/(student)/tests/[id]/page.tsx`
- Test start screen (instructions, timer info)
- **MCQ Engine** — the core feature:
  - Question display with A/B/C/D options
  - Sidebar question navigator (answered/current/unanswered dots)
  - Countdown timer — auto-submits on timeout
  - "Save & exit" — saves progress locally
  - On submit → calls `POST /api/tests/:id/attempt`

#### [NEW] `apps/web/app/(student)/tests/[id]/result/page.tsx`
- Score summary card (score, percentage, time taken)
- Per-question breakdown: ✅ correct / ❌ wrong with explanation shown
- "Retake" and "Back to tests" actions

#### [NEW] `apps/web/app/(student)/notes/page.tsx`
- Notes list with subject filter and FREE/PAID indicators
- Download button — calls backend for signed URL, opens in new tab

#### [NEW] `apps/web/app/(student)/profile/page.tsx`
- Profile info, plan status, expiry date
- "Upgrade Plan" CTA → triggers Razorpay modal

#### [NEW] `apps/web/components/test/McqEngine.tsx`
- Core test-taking component (reusable)
- Timer hook: `useCountdownTimer(seconds)`
- State: current question index, answers map, submitted flag

#### [NEW] `apps/web/components/test/ResultCard.tsx`
- Score display with animated percentage ring

---

### 1.9 — Frontend: Admin Panel

#### [NEW] `apps/web/app/(admin)/admin/dashboard/page.tsx`
- Stats cards: total users, revenue, test attempts
- Charts: signups over time, revenue by month (recharts or Chart.js)

#### [NEW] `apps/web/app/(admin)/admin/tests/page.tsx`
- Table of all tests with edit/delete actions

#### [NEW] `apps/web/app/(admin)/admin/tests/new/page.tsx`
- Form: title, subject, isPaid toggle
- Question builder: add/edit/reorder questions with options + correct answer + explanation

#### [NEW] `apps/web/app/(admin)/admin/notes/page.tsx`
- Upload PDF form (drag-and-drop) with title, subject, isPaid toggle
- Table of existing notes with delete

#### [NEW] `apps/web/app/(admin)/admin/users/page.tsx`
- Paginated user list with search
- Inline plan upgrade/downgrade control

---

### 1.10 — Payments Frontend

#### [NEW] `apps/web/components/payment/RazorpayModal.tsx`
- Loads Razorpay SDK script dynamically
- Opens checkout modal with `orderId`, `amount`, `currency`
- On success → calls `/api/payments/verify` → updates session

#### [NEW] `apps/web/app/(student)/upgrade/page.tsx`
- Plan comparison table (FREE vs PAID)
- Pricing card with "Buy Now" CTA

---

### Phase 1 Verification Plan

- **API tests**: Postman/Thunder Client collection covering every route
- **Auth flow**: Register → login → access protected route → token refresh → logout
- **MCQ engine**: Submit test → verify server-side scoring is correct
- **Payment flow**: Test with Razorpay test keys → verify plan upgrade
- **Access control**: Verify FREE student cannot access paid content
- **Security**: Confirm `correctOption` never appears in `GET /api/tests/:id` response

---

## Phase 2 — Growth

> Goal: Retention, engagement, and virality features. Build on top of the working MVP.

**Estimated scope:** ~4 weeks after Phase 1 stabilization.

### Features

| Feature | Technical Approach |
|---|---|
| **Leaderboard** | Redis `ZSET` per test — store `userId → score`; expose top-N via `ZREVRANGE` |
| **Email notifications** | Nodemailer or Resend (transactional email): welcome email, payment receipt, test result summary |
| **Student performance analytics** | Aggregate `TestAttempt` data → subject-wise accuracy chart, score trend over time |
| **Question bookmarks** | New `Bookmark` Prisma model (`userId`, `questionId`); student saves questions for later review |
| **Referral system** | `referralCode` on User; track conversions; reward with plan credit |

### New files (additions, not modifications)

- `apps/api/src/routes/leaderboard.ts`
- `apps/api/src/services/email.ts` (Resend SDK or Nodemailer)
- `apps/web/app/(student)/leaderboard/page.tsx`
- `apps/web/app/(student)/analytics/page.tsx`
- `apps/web/app/(student)/bookmarks/page.tsx`
- `apps/api/prisma/migrations/` — add `Bookmark`, `ReferralCode` models

---

## Phase 3 — Video & Community

> Goal: Make AjitSir Academy a complete learning ecosystem — recorded lectures, live classes, doubt forum.

**Estimated scope:** ~6–10 weeks, likely requires additional infrastructure.

### Features

| Feature | Technical Approach |
|---|---|
| **Recorded lectures** | Upload to **Bunny.net** or **Cloudflare Stream**; embed player (HLS) in Next.js |
| **Live class scheduling** | Store schedule in DB; integrate **Daily.co** or **100ms** for WebRTC streaming |
| **Doubt forum / Q&A** | New `Post`, `Reply`, `Vote` models; threaded discussion UI (similar to Reddit) |
| **Push notifications** | Next.js PWA manifest + service worker; Web Push API with VAPID keys |
| **Mobile app** | React Native (Expo) — reuse API, Zustand stores, and design system |

### New files (additions)

- `apps/web/app/(student)/lectures/page.tsx` + `[id]/page.tsx`
- `apps/web/app/(student)/forum/page.tsx` + `[postId]/page.tsx`
- `apps/api/src/routes/lectures.ts`
- `apps/api/src/routes/forum.ts`
- `apps/api/src/services/stream.ts` (Bunny.net / Cloudflare Stream SDK)
- `apps/mobile/` (React Native / Expo app — Phase 3 end)

---

## Key Conventions (from README §11)

> [!NOTE]
> These rules apply to **every line of code** generated for this project.

- TypeScript everywhere — frontend and backend
- REST + JSON; standard HTTP status codes
- Error format: `{ error: string, details?: any }`
- JWT access tokens (15m) + refresh tokens (7d, httpOnly cookie)
- Zod validation on all request bodies (backend)
- Prisma for all DB access — no raw SQL
- Stream files to R2 — never write to disk
- Verify Razorpay signature server-side before any plan upgrade
- `correctOption` never in `GET /api/tests/:id`
- camelCase vars, PascalCase components/types, kebab-case filenames
- Conventional commits: `feat:`, `fix:`, `chore:`, `docs:`
- No hardcoded secrets — always `process.env`

---

## Suggested Build Order (Phase 1)

```
1. Monorepo scaffold → Docker → Prisma schema + migrations
2. Auth backend (JWT + Google OAuth)
3. Tests backend (CRUD + attempt scoring engine)
4. Notes backend (R2 integration + signed URLs)
5. Payments backend (Razorpay)
6. Admin routes
7. Frontend auth pages (login/register)
8. MCQ engine component (the hardest frontend piece)
9. Student dashboard + tests + notes pages
10. Admin panel (tests, notes, users)
11. Razorpay checkout modal
12. End-to-end QA
```
