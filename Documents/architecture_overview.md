# Architecture Overview

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
├── Documents/                     ← Project documentation
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

## 5. Shared Package (`packages/shared/`)

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

## 6. Infrastructure & Deployment

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
- Set all environment variables (see `development_guide.md`)

### Database (Neon)
- Serverless PostgreSQL — auto-scales to zero
- Connection string format: `postgresql://user:pass@ep-xxx.region.aws.neon.tech/neondb?sslmode=require&connect_timeout=30&pool_timeout=30`
- The `withRetry()` helper handles the Neon cold-start delay (~2-4 seconds)
