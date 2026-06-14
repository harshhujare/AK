# Mock Test System v2 — Revised Multi-Phase Implementation Plan
### AjitSir Academy · Maharashtra TET Preparation
### Resource-Optimized · Mobile-First · Offline-Safe

> This plan supersedes `mock_test_implementation_plan.md`.
> Every improvement from the architecture review is incorporated with exact file paths, code snippets, and verification steps.
> Assumed constraints: **low-cost VPS / Neon free-tier Postgres, 2G/3G network targets, ₹8,000 Android devices.**

---

## What Is Already Built (Do Not Rebuild)

### Backend — `apps/api`

| Already exists | Notes |
|---|---|
| `prisma/schema.prisma` — `Test`, `Question`, `TestAttempt` | Missing indexes + 5 new columns needed |
| `src/routes/tests.ts` — 7 core routes | Needs filter params + 5 new routes |
| `packages/shared/src/types.ts` + `schemas.ts` | Needs new fields + Zod caps |
| Server-side scoring in `POST /:id/attempt` | Correct — never trust client score |
| `correctOption` excluded from `GET /:id` | Correct — do not change |

### Frontend — `apps/web`

| Already exists | Purpose |
|---|---|
| `lib/api-client.ts` | Axios + 401 interceptor + refresh queue |
| `lib/query-provider.tsx` | RQ persister with `PERSISTED_KEYS` + `TTL` maps |
| `hooks/useSubjects.ts` | Reused by test lobby subject filter |
| `hooks/useOnlineStatus.ts` | Network probe — extended for offline retry |
| `features/payment/` | Plan gate UI reused for paid test access |
| `lib/auth-store.ts` | Zustand auth store — plan check before paid tests |
| `components/layout/BottomNav.tsx` | Plans tab → Tests tab |
| `app/globals.css` | Token system — needs `--warn-*` tokens added |

---

## Open Questions

> [!IMPORTANT]
> Resolve these before Phase 1 begins.

1. **Will tests ever exceed 100 questions?** If yes, `GET /api/tests/:id` (~30 KB) should lazy-paginate. Current plan loads all questions at once and stores in RQ cache.
2. **Can a student retake a test they already submitted?** Schema allows unlimited attempts. Intentional for DAILY and SUBJECT tests?
3. **Admin mobile access?** Does Ajit Sir or the Content Manager ever manage tests from a phone/tablet? If yes, admin panel needs responsive stacked layout (Phase 4 covers this). If desktop-only, a `min-width: 900px` warning banner is sufficient.
4. **Streak definition:** Counted by daily test only (`DAILY` type), or any test attempt? This affects the `useStreak` hook logic.

---

## Part 1 — Database & Schema Changes

### 1.1 Migration — 5 new columns + 4 indexes on `Test`

**File:** `apps/api/prisma/schema.prisma`

```prisma
enum TestType {
  DAILY       // One per day, Ajit Sir sets scheduledAt = that day's date
  PREDEFINED  // Manually scheduled with a specific date window
  SUBJECT     // Always available, filtered by subject
}

model Test {
  // ── existing fields unchanged ──
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

  // ── NEW fields ──
  type         TestType  @default(SUBJECT)
  timeLimitSec Int?      // null = untimed. 1800 = 30 min, 2700 = 45 min
  scheduledAt  DateTime? // DAILY: date it is live. PREDEFINED: window start.
  expiresAt    DateTime? // PREDEFINED: when it closes.
  isPublished  Boolean   @default(false) // false = draft

  // ── NEW indexes (CRITICAL — without these, filter queries do a full table scan) ──
  @@index([type, scheduledAt])
  @@index([subjectId, isPublished])
}
```

**Migration SQL:**

```sql
CREATE TYPE "TestType" AS ENUM ('DAILY', 'PREDEFINED', 'SUBJECT');

ALTER TABLE "Test"
  ADD COLUMN "type"         "TestType" NOT NULL DEFAULT 'SUBJECT',
  ADD COLUMN "timeLimitSec" INTEGER,
  ADD COLUMN "scheduledAt"  TIMESTAMPTZ,
  ADD COLUMN "expiresAt"    TIMESTAMPTZ,
  ADD COLUMN "isPublished"  BOOLEAN NOT NULL DEFAULT false;

-- Add indexes AFTER the ALTER to avoid row-level locks on inserts
CREATE INDEX "Test_type_scheduledAt_idx"      ON "Test" ("type", "scheduledAt");
CREATE INDEX "Test_subjectId_isPublished_idx" ON "Test" ("subjectId", "isPublished");
```

### 1.2 `TestAttempt` — performance indexes + nullable `timeTaken`

```prisma
model TestAttempt {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id])
  testId      String
  test        Test     @relation(fields: [testId], references: [id])
  answers     Json
  score       Int
  totalMarks  Int
  timeTaken   Int?     // ← CHANGED: nullable — null for untimed test submissions
  completedAt DateTime @default(now())

  // ── NEW indexes ──
  @@index([testId, score])        // percentile query: WHERE testId=? ORDER BY score
  @@index([userId, completedAt])  // history query: WHERE userId=? ORDER BY completedAt DESC
}
```

**Migration SQL:**

```sql
ALTER TABLE "TestAttempt" ALTER COLUMN "timeTaken" DROP NOT NULL;
CREATE INDEX "TestAttempt_testId_score_idx"       ON "TestAttempt" ("testId", "score");
CREATE INDEX "TestAttempt_userId_completedAt_idx" ON "TestAttempt" ("userId", "completedAt" DESC);
```

---

## Part 2 — Shared Types & Schemas (`packages/shared`)

### 2.1 `packages/shared/src/types.ts`

```ts
export type TestType = 'DAILY' | 'PREDEFINED' | 'SUBJECT';

export interface Test {
  id:          string;
  title:       string;
  description: string | null;
  subjectId:   string;
  subject:     Subject;
  isPaid:      boolean;
  // NEW:
  type:         TestType;
  timeLimitSec: number | null;  // null = untimed
  scheduledAt:  string | null;  // ISO date string
  expiresAt:    string | null;
  isPublished:  boolean;
  createdAt:    string;
  updatedAt:    string;
  _count?:      { questions: number };
}

// correctOption deliberately absent — server only, never sent to client
export interface Question {
  id:      string;
  testId:  string;
  text:    string;
  options: QuestionOption[];
  order:   number;
}

export interface TestAttempt {
  id:          string;
  userId:      string;
  testId:      string;
  score:       number;
  totalMarks:  number;
  timeTaken:   number | null;  // ← nullable
  completedAt: string;
}
```

### 2.2 `packages/shared/src/schemas.ts`

```ts
import { z } from 'zod';

// Option size cap prevents bloated JSON blobs in the Question.options column
const QuestionOptionSchema = z.object({
  id:   z.enum(['A', 'B', 'C', 'D']),
  text: z.string().min(1).max(500),
});

export const CreateQuestionSchema = z.object({
  text:          z.string().min(1).max(2000),
  options:       z.array(QuestionOptionSchema).length(4), // exactly 4
  correctOption: z.enum(['A', 'B', 'C', 'D']),
  explanation:   z.string().max(2000).optional(),
  order:         z.number().int().min(0),
});

export const CreateTestSchema = z.object({
  title:        z.string().min(1).max(200),
  description:  z.string().max(1000).optional(),
  subjectId:    z.string().cuid(),
  isPaid:       z.boolean().default(false),
  type:         z.enum(['DAILY', 'PREDEFINED', 'SUBJECT']).default('SUBJECT'),
  timeLimitSec: z.number().int().positive().optional(),
  scheduledAt:  z.string().datetime().optional(),
  expiresAt:    z.string().datetime().optional(),
  isPublished:  z.boolean().default(false),
});

export const UpdateTestSchema = CreateTestSchema.partial();

export const SubmitAttemptSchema = z.object({
  answers:   z.record(z.string().cuid(), z.enum(['A', 'B', 'C', 'D'])),
  timeTaken: z.number().int().nonnegative().optional(), // optional for untimed tests
});
```

---

## Part 3 — Backend API Changes (`apps/api/src/routes/tests.ts`)

### 3.1 Update `GET /api/tests` — filter params

```ts
// GET /api/tests?type=DAILY&subjectId=xxx&date=2025-06-12&published=true
testsRouter.get('/', async (req: Request, res: Response) => {
  const { type, subjectId, date } = req.query;

  const where: Prisma.TestWhereInput = {
    isPublished: true, // students always see only published tests
  };

  if (type) where.type = type as TestType;
  if (subjectId) where.subjectId = String(subjectId);
  if (date && type === 'DAILY') {
    const day = new Date(String(date));
    const nextDay = new Date(day);
    nextDay.setDate(day.getDate() + 1);
    where.scheduledAt = { gte: day, lt: nextDay };
  }

  const tests = await prisma.test.findMany({
    where,
    include: { subject: true, _count: { select: { questions: true } } },
    orderBy: { scheduledAt: 'desc' },
  });

  res.json({ data: tests });
});
```

### 3.2 Paginate `GET /api/tests/attempts/me`

```ts
// GET /api/tests/attempts/me?limit=20&cursor=<cuid>
testsRouter.get('/attempts/me', requireAuth(), async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 20, 50);
  const cursor = req.query.cursor ? String(req.query.cursor) : undefined;

  const attempts = await prisma.testAttempt.findMany({
    where:   { userId: req.user!.userId },
    include: { test: { select: { id: true, title: true, subjectId: true } } },
    orderBy: { completedAt: 'desc' },
    take:    limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = attempts.length > limit;
  if (hasMore) attempts.pop();

  res.json({ data: attempts, nextCursor: hasMore ? attempts.at(-1)?.id : null, hasMore });
});
```

### 3.3 Add `GET /api/tests/:id/attempt/:attemptId` — result fallback

```ts
// Used when IndexedDB is empty on a new device — reconstructs breakdown server-side
testsRouter.get('/:id/attempt/:attemptId', requireAuth(), async (req, res) => {
  const attempt = await prisma.testAttempt.findFirst({
    where: { id: req.params.attemptId, testId: req.params.id, userId: req.user!.userId },
    include: { test: { include: { questions: { orderBy: { order: 'asc' } } } } },
  });

  if (!attempt) { res.status(404).json({ error: 'Attempt not found' }); return; }

  const answers = attempt.answers as Record<string, string>;
  const breakdown = attempt.test.questions.map(q => ({
    questionId:   q.id,
    questionText: q.text,
    selected:     answers[q.id] ?? null,
    correct:      q.correctOption,
    explanation:  q.explanation ?? undefined,
    isCorrect:    answers[q.id] === q.correctOption,
  }));

  res.json({ data: {
    ...attempt,
    percentage: Math.round((attempt.score / attempt.totalMarks) * 100),
    breakdown,
  }});
});
```

### 3.4 Per-question CRUD (admin only)

```ts
// GET /api/tests/:id/questions — admin only, includes correctOption
testsRouter.get('/:id/questions', requireAdmin(), async (req, res) => {
  const questions = await prisma.question.findMany({
    where: { testId: req.params.id }, orderBy: { order: 'asc' },
  });
  res.json({ data: questions });
});

// POST /api/tests/:id/questions
testsRouter.post('/:id/questions', requireAdmin(), async (req, res) => {
  const parsed = CreateQuestionSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() }); return; }
  const q = await prisma.question.create({ data: { ...parsed.data, testId: req.params.id } });
  res.status(201).json({ data: q });
});

// PUT /api/tests/:testId/questions/:qId
testsRouter.put('/:testId/questions/:qId', requireAdmin(), async (req, res) => {
  const parsed = CreateQuestionSchema.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() }); return; }
  const q = await prisma.question.update({ where: { id: req.params.qId }, data: parsed.data });
  res.json({ data: q });
});

// DELETE /api/tests/:testId/questions/:qId
testsRouter.delete('/:testId/questions/:qId', requireAdmin(), async (req, res) => {
  await prisma.question.delete({ where: { id: req.params.qId } });
  res.json({ data: { message: 'Question deleted' } });
});
```

### 3.5 `GET /api/tests/:id/percentile` — server-side minimum guard

```ts
testsRouter.get('/:id/percentile', requireAuth(), async (req, res) => {
  const { id: testId } = req.params;

  // ── Server-side guard: refuse expensive COUNT for low-traffic tests ──
  const total = await prisma.testAttempt.count({ where: { testId } });
  if (total < 10) {
    res.json({ data: { percentile: null, reason: 'insufficient_data', total } });
    return;
  }

  const myAttempt = await prisma.testAttempt.findFirst({
    where: { testId, userId: req.user!.userId },
    orderBy: { completedAt: 'desc' },
    select: { score: true },
  });
  if (!myAttempt) { res.status(404).json({ error: 'No attempt found' }); return; }

  const below = await prisma.testAttempt.count({ where: { testId, score: { lt: myAttempt.score } } });
  res.json({ data: { percentile: Math.round((below / total) * 100), total } });
});
```

### 3.6 `PATCH /api/tests/:id` — inline publish toggle

```ts
testsRouter.patch('/:id', requireAdmin(), async (req, res) => {
  if (typeof req.body.isPublished !== 'boolean') {
    res.status(400).json({ error: 'isPublished must be boolean' }); return;
  }
  const test = await prisma.test.update({
    where: { id: req.params.id }, data: { isPublished: req.body.isPublished },
  });
  res.json({ data: test });
});
```

---

## Part 4 — Frontend Architecture (`apps/web`)

### 4.1 CSS tokens — add missing `--warn-*` set

**File:** `apps/web/app/globals.css`

```css
/* ADD inside :root, [data-theme="dark"] { ... } */
--warn-bg:     rgba(251, 191, 36, 0.12);
--warn-text:   #fde68a;
--warn-border: rgba(251, 191, 36, 0.3);

/* ADD inside [data-theme="light"] { ... } */
--warn-bg:     rgba(217, 119, 6, 0.1);
--warn-text:   #d97706;
--warn-border: rgba(217, 119, 6, 0.25);
```

### 4.2 Session store — lean persist (no question payload)

**File:** `apps/web/features/tests/store/test-session.ts` [NEW]

> **Key architecture decision:** Only the minimal resume state is persisted.
> `TestWithQuestions` is intentionally excluded — saves ~14 KB of localStorage writes on every answer tap.
> On resume, questions reload from the React Query in-memory cache (already there from the pre-flight fetch).

```ts
'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface PersistedSession {
  testId:    string | null;
  answers:   Record<string, string>; // { questionId: 'A'|'B'|'C'|'D' }
  startedAt: number | null;          // Date.now() when session began
  currentQ:  number;                 // 0-based index
}

interface SessionActions {
  isSubmitting: boolean;
  startSession:   (testId: string) => void;
  setAnswer:      (questionId: string, option: string) => void;
  goToQuestion:   (index: number) => void;
  markSubmitting: () => void;   // set BEFORE the POST — prevents double-submit
  clearSession:   () => void;
}

const EMPTY: PersistedSession = {
  testId: null, answers: {}, startedAt: null, currentQ: 0,
};

export const useTestSession = create<PersistedSession & SessionActions>()(
  persist(
    (set) => ({
      ...EMPTY,
      isSubmitting: false,
      startSession: (testId) => set({ testId, answers: {}, startedAt: Date.now(), currentQ: 0 }),
      setAnswer:    (qId, opt) => set((s) => ({ answers: { ...s.answers, [qId]: opt } })),
      goToQuestion: (i) => set({ currentQ: i }),
      markSubmitting: () => set({ isSubmitting: true }),
      clearSession: () => set({ ...EMPTY, isSubmitting: false }),
    }),
    {
      name: 'test-session',
      // Only persist the resume-critical fields — no in-memory action state
      partialize: (s): PersistedSession => ({
        testId: s.testId, answers: s.answers, startedAt: s.startedAt, currentQ: s.currentQ,
      }),
    }
  )
);
```

### 4.3 On-device result storage — `test-results-db.ts`

**File:** `apps/web/features/tests/lib/test-results-db.ts` [NEW]

> **Key change from original plan:** Adds a `pending-attempts` IDB store to replace the fragile `localStorage` key scanning (`Object.keys(localStorage).filter(k => k.startsWith('pending-attempt-'))`).
> IDB survives `localStorage.clear()` during logout and does not scan the entire RQ cache.

```ts
import { openDB, type IDBPDatabase } from 'idb';
import type { AttemptResult } from '@ajitsir/shared';

const DB_NAME = 'ajitsir-test-results';
const DB_VER  = 1;
const RESULTS_STORE    = 'results';
const PENDING_STORE    = 'pending-attempts';
const MAX_RESULTS      = 200;
const MAX_RESULT_BYTES = 50_000; // skip storing results > 50 KB

interface StoredResult {
  id: string; testId: string; testTitle: string;
  subjectId: string; result: AttemptResult; savedAt: number;
}

export interface PendingAttempt {
  id: string;                        // local UUID, NOT the server attempt ID yet
  testId: string;
  answers: Record<string, string>;
  timeTaken: number | null;
  queuedAt: number;
}

let _db: IDBPDatabase | null = null;
async function getDB() {
  if (!_db) {
    _db = await openDB(DB_NAME, DB_VER, {
      upgrade(db) {
        const rs = db.createObjectStore(RESULTS_STORE, { keyPath: 'id' });
        rs.createIndex('by_testId',  'testId');
        rs.createIndex('by_savedAt', 'savedAt');
        rs.createIndex('by_subject', 'subjectId');
        db.createObjectStore(PENDING_STORE, { keyPath: 'id' });
      },
    });
  }
  return _db;
}

// ── Result storage ────────────────────────────────────────────────────────────

export async function saveResult(stored: StoredResult): Promise<void> {
  const blob = JSON.stringify(stored);
  if (blob.length > MAX_RESULT_BYTES) {
    console.warn('[IDB] Result too large, skipping:', blob.length, 'bytes');
    return;
  }
  const db = await getDB();
  await db.put(RESULTS_STORE, { ...stored, savedAt: Date.now() });
  // Evict oldest entries if over MAX
  const all = await db.getAllKeys(RESULTS_STORE);
  if (all.length > MAX_RESULTS) {
    const withDates = await Promise.all(
      all.map(async k => ({ k, t: (await db.get(RESULTS_STORE, k)).savedAt as number }))
    );
    withDates.sort((a, b) => a.t - b.t);
    const tx = db.transaction(RESULTS_STORE, 'readwrite');
    await Promise.all(withDates.slice(0, all.length - MAX_RESULTS).map(({ k }) => tx.store.delete(k)));
    await tx.done;
  }
}

export async function getResultsByTest(testId: string): Promise<StoredResult[]> {
  return (await getDB()).getAllFromIndex(RESULTS_STORE, 'by_testId', testId);
}

export async function getAllResults(): Promise<StoredResult[]> {
  return (await getDB()).getAll(RESULTS_STORE);
}

export async function clearResults(): Promise<void> {
  await (await getDB()).clear(RESULTS_STORE);
  // Note: deliberately does NOT clear pending-attempts store
}

// ── Pending offline submission queue ─────────────────────────────────────────

export async function queuePendingAttempt(attempt: PendingAttempt): Promise<void> {
  await (await getDB()).put(PENDING_STORE, attempt);
}

export async function getAllPending(): Promise<PendingAttempt[]> {
  return (await getDB()).getAll(PENDING_STORE);
}

export async function deletePending(id: string): Promise<void> {
  await (await getDB()).delete(PENDING_STORE, id);
}
```

Install dependency:
```bash
cd apps/web && npm install idb
```

### 4.4 `useOnlineStatus.ts` — add IDB-based offline retry

**File:** `apps/web/hooks/useOnlineStatus.ts` (extend existing file)

```ts
// Add at top of file (new imports):
import { getAllPending, deletePending, queuePendingAttempt, saveResult } from '@/features/tests/lib/test-results-db';
import { apiClient } from '@/lib/api-client';

// Add this function before the hook:
async function flushPendingAttempts(): Promise<void> {
  const pending = await getAllPending();
  for (const item of pending) {
    // Delete BEFORE posting — prevents double-submit even if POST hangs
    await deletePending(item.id);
    try {
      const { data } = await apiClient.post(
        `/api/tests/${item.testId}/attempt`,
        { answers: item.answers, timeTaken: item.timeTaken }
      );
      await saveResult({
        id: data.data.id, testId: item.testId,
        testTitle: '', subjectId: '', result: data.data, savedAt: Date.now(),
      });
    } catch {
      // Network still down or server error — re-queue for next reconnect
      await queuePendingAttempt(item);
    }
  }
}

// In runProbe callback, add after setIsOnline(result):
if (result) {
  flushPendingAttempts(); // fire-and-forget — non-blocking
}
```

### 4.5 `query-provider.tsx` — add `tests` TTL + dehydrate rules

**File:** `apps/web/lib/query-provider.tsx`

```ts
// Update TTL map:
const TTL = {
  subjects:      7 * 24 * 60 * 60 * 1000,
  notes:              60 * 60 * 1000,
  announcements:      30 * 60 * 1000,
  faqs:          7 * 24 * 60 * 60 * 1000,
  tests:          5 * 60 * 1000,   // ← ADD: 5 min (lobby can change during the day)
} as const;

// Update PERSISTED_KEYS:
const PERSISTED_KEYS = new Set<string>(['subjects', 'notes', 'announcements', 'faqs', 'tests']);

// Update shouldDehydrateQuery — add after the notes page-cap block:
// Never persist single-test queries (contains all questions — too large + must be fresh)
if (key === 'test') return false;

// Only persist top-level lobby list queries for 'tests' — not paginated sub-queries
if (key === 'tests') {
  if (query.queryKey.length > 3) return false; // paginated sub-query
}
```

### 4.6 Service Worker — corrected patterns

**File:** `apps/web/public/sw.js`

```js
// ── CORRECTED ────────────────────────────────────────────────────────────────
// Original plan blocked ALL /api/tests/ in the SW cache.
// This was wrong — it prevented the runner from loading questions offline,
// breaking session resume after a phone dies mid-test.
//
// correctOption is NEVER in GET responses (server deliberately excludes it),
// so serving cached questions is safe. Only the submit POST needs to hit server.
//
// Rule: GET requests to /api/tests/* CAN be served from cache.
//       POST requests always bypass SW (default SW behavior for most fetch handlers).

const NETWORK_ONLY_PATTERNS = [
  '/api/auth/',      // auth must always hit server
  '/api/payments/',  // payments always network
  // '/api/tests/'   ← REMOVED — was killing offline question loading
];

// Add tests lobby shell:
const SHELL_ROUTES = ['/', '/notes', '/tests', '/account'];
```

### 4.7 `useStreak` hook — IDB-based with sessionStorage cache

**File:** `apps/web/hooks/useStreak.ts` [NEW]

```ts
'use client';
import { useState, useEffect } from 'react';
import { getAllResults } from '@/features/tests/lib/test-results-db';

const SESSION_KEY = 'streak-cache';

function computeStreak(results: { savedAt: number }[]): number {
  if (!results.length) return 0;
  const days = [...new Set(
    results.map(r => new Date(r.savedAt).toISOString().slice(0, 10))
  )].sort().reverse();

  let streak = 0;
  let expected = new Date();
  expected.setHours(0, 0, 0, 0);

  for (const day of days) {
    const diff = Math.round((expected.getTime() - new Date(day).getTime()) / 86_400_000);
    if (diff === 0 || diff === 1) { streak++; expected = new Date(day); }
    else break;
  }
  return streak;
}

export function useStreak(): number {
  const [streak, setStreak] = useState<number>(() => {
    if (typeof window === 'undefined') return 0;
    return Number(sessionStorage.getItem(SESSION_KEY) ?? 0);
  });

  useEffect(() => {
    getAllResults().then(results => {
      const s = computeStreak(results);
      setStreak(s);
      sessionStorage.setItem(SESSION_KEY, String(s));
    });
  }, []); // once per tab open

  return streak;
}
```

### 4.8 File structure to create

```
apps/web/
├── features/tests/
│   ├── hooks/
│   │   ├── useTests.ts            React Query — test list with filters
│   │   ├── useTest.ts             React Query — single test (NOT persisted to localStorage)
│   │   └── useTestAttempts.ts     React Query — paginated attempt history
│   ├── store/
│   │   └── test-session.ts        Zustand + persist — lean resume state only
│   ├── lib/
│   │   └── test-results-db.ts     IndexedDB — results + pending offline queue
│   └── components/
│       ├── TestCard.tsx           Card with inline attempted state
│       ├── DailyHeroCard.tsx      Hero card with gradient + streak dot
│       ├── QuestionDotGrid.tsx    5-column vertical grid (NOT horizontal scroll)
│       ├── CountdownTimer.tsx     CSS class colour states (--warn-text / --danger-text)
│       ├── ScoreRing.tsx          CSS stroke-dashoffset animation (compositor thread)
│       └── BreakdownItem.tsx      Single Q row — explanation only on wrong/skipped
│
├── hooks/
│   ├── useStreak.ts               [NEW] IDB streak with sessionStorage cache
│   └── useOnlineStatus.ts         [EXTEND] + flushPendingAttempts
│
└── app/
    ├── tests/
    │   ├── page.tsx               Lobby (Daily / Scheduled / By Subject tabs)
    │   └── [id]/
    │       ├── page.tsx           Runner (resume-aware, lean session store)
    │       └── result/
    │           └── page.tsx       Result (IDB-first, API fallback)
    └── (admin)/admin/
        └── tests/
            ├── page.tsx           Test list + inline publish toggle
            └── [id]/
                └── questions/
                    └── page.tsx   Responsive question editor (2-panel desktop, stacked mobile)
```

---

## Part 5 — UI / UX Specifications

### 5.1 Responsive breakpoints

| Screen width | Lobby | Runner | Result | Admin editor |
|---|---|---|---|---|
| ≤ 375px (iPhone SE) | Single col, chip scroll | Single col, dot grid 5-col | Single col | Stacked panel |
| 376–767px | Single col | Single col | Single col | Stacked panel |
| 768–1023px (iPad) | Two-col card grid | Dot panel (280px left) + content | Centred 600px | Stacked panel |
| ≥ 1024px (Desktop) | Sidebar + two-col grid | Left panel 320px + content | Centred 720px | Two-panel side-by-side |

### 5.2 `QuestionDotGrid` — 5-column vertical grid

```css
/* Replaces horizontal scroll strip — gives spatial overview of entire test */
.dot-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 6px;
  max-height: 140px;   /* ~5 rows visible on mobile */
  overflow-y: auto;
  padding: 4px;
  scrollbar-width: thin;
}
@media (min-width: 768px) {
  .dot-grid {
    max-height: none;   /* sidebar: show all rows */
    overflow-y: visible;
  }
}
/* Each dot: 32×32px, border-radius: 8px */
/* Unanswered: --bg-surface-2, --text-muted */
/* Answered:   --bg-active, --border-strong, --text-secondary */
/* Current:    --accent-bg, --accent-text */
```

### 5.3 `CountdownTimer` — CSS class colour transitions

```css
/* No JS re-renders for colour changes — just class swap */
.timer              { color: var(--text-secondary); }
.timer--warn        { color: var(--warn-text); border-color: var(--warn-border); }
.timer--danger      { color: var(--danger-text); border-color: var(--danger-border);
                      animation: timer-pulse 1s ease-in-out infinite; }

@keyframes timer-pulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.55; }
}

/* Apply class based on secsLeft:
   > 300s (5 min):   'timer'
   120–300s (2–5 min): 'timer timer--warn'
   < 120s (< 2 min): 'timer timer--danger'
*/
```

### 5.4 `ScoreRing` — compositor-thread CSS animation

```css
/* SVG circle: r=45, circumference = 2π × 45 ≈ 283 */
.score-ring__progress {
  stroke-dasharray: 283;
  stroke-dashoffset: 283;    /* starts at 0% on mount */
  transition: stroke-dashoffset 0.6s ease-out,
              stroke 0.3s ease;
}
```

```ts
// Set via useEffect after mount — animation runs on compositor thread
useEffect(() => {
  if (!progressRef.current) return;
  const pct = score / totalMarks;
  progressRef.current.style.strokeDashoffset = String(283 - pct * 283);
  progressRef.current.style.stroke =
    pct < 0.4 ? 'var(--danger-text)' :
    pct < 0.7 ? 'var(--warn-text)'   :
                'var(--success-text)';
}, [score, totalMarks]);
```

### 5.5 Submit bottom sheet — mobile-safe

```css
.submit-sheet {
  position: fixed;
  inset: auto 0 0 0;
  background: var(--bg-surface);
  border-top: 1px solid var(--border-strong);
  border-radius: 20px 20px 0 0;
  max-height: 70dvh;     /* dvh excludes browser chrome — no overflow on iPhone */
  overflow-y: auto;
  padding: 20px 16px;
  padding-bottom: calc(16px + env(safe-area-inset-bottom, 0px));
}
```

### 5.6 Option rows — full-row tap target

```css
/* onClick is on this outer div — entire row is the tap target */
.option-row {
  display: flex;
  align-items: flex-start;  /* NOT center — Marathi text can wrap to 3 lines */
  gap: 12px;
  min-height: 52px;
  padding: 12px 16px;
  cursor: pointer;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--bg-surface);
  transition: background 0.12s, border-color 0.12s;
  font-size: 1rem;
  line-height: 1.7;   /* CRITICAL for Devanagari — must be ≥ 1.6 or text clips */
  user-select: none;
}
.option-row--selected {
  background: var(--bg-active);
  border-color: var(--border-strong);
}
```

### 5.7 Admin panel responsive layout

```
Desktop (≥ 900px):
┌──────────────────┬──────────────────────────────────────────────┐
│  Question list   │  Question form (text, options, answer, expl) │
│  (left 280px)    │  (right, flex)                               │
└──────────────────┴──────────────────────────────────────────────┘

Mobile/Tablet (< 900px):
┌──────────────────────────────────────────────────────────────────┐
│  Question form (takes full width)                                │
│                                                                  │
│  [📋 Questions (8)]  ← drawer trigger pill at bottom            │
└──────────────────────────────────────────────────────────────────┘
  ↓ tap pill → bottom drawer slides up
┌──────────────────────────────────────────────────────────────────┐
│  Q1 ✅  Q2 ✅  Q3 □  Q4 □   [+ Add]                             │
│  ─────────────────────────────────────────────────────────────  │
│  [tap Q3 → drawer closes, form shows Q3]                         │
└──────────────────────────────────────────────────────────────────┘
```

---

## Part 6 — Navigation Changes

### 6.1 `BottomNav.tsx` — Plans → Tests

```tsx
// REMOVE: { label: 'Plans', href: '/plans', ... }
// ADD:
{
  label: 'Tests',
  href: '/tests',
  icon: (active: boolean) => (
    <svg width="22" height="22" viewBox="0 0 24 24"
      fill={active ? 'currentColor' : 'none'}
      stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
      <rect x="9" y="3" width="6" height="4" rx="1"/>
      <path d="M9 12l2 2 4-4"/>
    </svg>
  ),
  isActive: (pathname: string) => pathname.startsWith('/tests'),
},
```

### 6.2 Desktop `Navbar.tsx`

```tsx
<Link href="/tests" className="navbar-link">Mock Tests</Link>
```

### 6.3 Admin sidebar — `app/(admin)/layout.tsx`

```ts
{ href: '/admin/tests', label: 'Tests', icon: <ClipboardList size={18} />, roles: ['SUPER_ADMIN', 'CONTENT_MANAGER'] }
```

### 6.4 Plans redirect

```tsx
// app/plans/page.tsx
import { redirect } from 'next/navigation';
export default function PlansPage() { redirect('/account#subscription'); }
```

Move `PlanConfig` pricing cards + Razorpay flow into `app/account/page.tsx` under `id="subscription"`.

---

## Part 7 — Phased Implementation Schedule

### Phase 1 — Foundation: Schema + API *(Week 1–2)*

**Goal:** Backend complete and Postman-verified. Zero student-visible changes.

**Week 1:**
- [ ] Write and apply Prisma migration (5 new Test fields + 4 indexes + nullable timeTaken)
- [ ] Update `packages/shared/src/types.ts` — `TestType`, new Test fields, nullable `timeTaken`
- [ ] Update `packages/shared/src/schemas.ts` — Zod option size cap (500 chars / 4 options exactly)
- [ ] Update `GET /api/tests` — add filter params (`type`, `subjectId`, `date`)
- [ ] Paginate `GET /api/tests/attempts/me` — cursor-based, cap at 50

**Week 2:**
- [ ] Add `GET /api/tests/:id/attempt/:attemptId` — result fallback
- [ ] Add per-question CRUD (4 routes: `GET/POST/PUT/DELETE /api/tests/:id/questions`)
- [ ] Add `GET /api/tests/:id/percentile` — server-side ≥10 guard
- [ ] Add `PATCH /api/tests/:id` — inline publish toggle
- [ ] Postman test suite for all new routes

**Verification checklist:**
```
✅ GET /api/tests?type=DAILY&date=2025-06-12 returns only today's DAILY test
✅ GET /api/tests/:id — zero occurrences of "correctOption" in any response field
✅ GET /api/tests/:id/percentile with 9 attempts → { percentile: null, reason: 'insufficient_data' }
✅ POST /api/tests/:id/attempt with timeTaken omitted → 201 success (nullable)
✅ All new routes return 401 without Authorization header
✅ GET /api/tests/:id/questions returns 403 for STUDENT role
✅ GET /api/tests/:id/attempt/:attemptId for another user's attempt → 404
✅ EXPLAIN ANALYZE on GET /api/tests?type=DAILY → confirms index scan, not seq scan
```

---

### Phase 2 — Storage Layer *(Week 2–3)*

**Goal:** All on-device storage working and unit-tested before any UI is built.

- [ ] `npm install idb` in `apps/web`
- [ ] Build `features/tests/lib/test-results-db.ts`:
  - `results` store: LRU eviction at 200, 50 KB size cap
  - `pending-attempts` store: replaces localStorage key scanning
  - Full API: `saveResult`, `getResultsByTest`, `getAllResults`, `clearResults`, `queuePendingAttempt`, `getAllPending`, `deletePending`
- [ ] Build `features/tests/store/test-session.ts`:
  - Persist only `{ testId, answers, startedAt, currentQ }`
  - `markSubmitting()` as double-submit guard (set flag BEFORE POST)
- [ ] Add `clearResults()` to `auth-store.ts` logout function
- [ ] Extend `hooks/useOnlineStatus.ts` with `flushPendingAttempts()`
- [ ] Update `lib/query-provider.tsx`:
  - Add `tests: 5 * 60 * 1000` to TTL map
  - Add `tests` to `PERSISTED_KEYS`
  - Add dehydrate guard: `if (key === 'test') return false`
- [ ] Build `hooks/useStreak.ts` — IDB + sessionStorage cache
- [ ] Unit tests for `test-results-db.ts`:
  - `saveResult` → `getAllResults` roundtrip
  - LRU eviction fires when count > 200
  - 51 KB result is skipped (size cap)
  - `queuePendingAttempt` → `getAllPending` → `deletePending` flow
  - `clearResults` does NOT clear pending store

---

### Phase 3 — Student Frontend *(Week 3–6)*

**Goal:** Students can take tests end-to-end including offline scenarios.

**Week 3 — Lobby:**
- [ ] Add `--warn-*` tokens to `apps/web/app/globals.css`
- [ ] Build `features/tests/hooks/useTests.ts` (`networkMode: 'offlineFirst'`, `staleTime: 5 min`)
- [ ] Build `features/tests/hooks/useTest.ts` (`networkMode: 'offlineFirst'`, `staleTime: 3 min`)
- [ ] Build `features/tests/hooks/useTestAttempts.ts` (paginated with `useInfiniteQuery`)
- [ ] Update `components/layout/BottomNav.tsx` — Plans → Tests
- [ ] Build `features/tests/components/TestCard.tsx`:
  - Inline attempted state: `✅ Best: 24/30 · 80%` from IDB
  - PAID badge; tapping PAID test as FREE shows upgrade sheet
- [ ] Build `features/tests/components/DailyHeroCard.tsx`:
  - `linear-gradient(135deg, #1a1a2e, #0f3460)` background
  - Animated live dot + `चाचणी सुरू करा` / `पुन्हा करा` based on IDB history
- [ ] Build `app/tests/page.tsx`:
  - Mobile: tab strip (Daily / Scheduled / By Subject) + single-column list
  - Desktop: left sidebar subject filter + two-column test card grid
  - Streak badge in header from `useStreak()`

**Week 4 — Runner:**
- [ ] Build `features/tests/components/QuestionDotGrid.tsx` — 5-col vertical grid
- [ ] Build `features/tests/components/CountdownTimer.tsx` — CSS class transitions
- [ ] Build `app/tests/[id]/page.tsx`:
  - Plan gate: FREE + paid test → redirect `/account#subscription`
  - Session resume: `session.testId === routeId && !isSubmitting` → show resume banner
  - Questions from `useTest()` cache (NOT from session store)
  - Option rows: full-row `onClick`, `min-height: 52px`, `line-height: 1.7`
  - Dot grid: 5-column vertical, scrollable on mobile
  - Timer: CSS class colour states, auto-submit at `secsLeft === 0`
  - Submit: `markSubmitting()` first → `POST .../attempt` → `saveResult()` → navigate to result
  - Offline submit: `queuePendingAttempt()` → toast "Saved locally" → navigate to result
  - Submit confirmation: bottom sheet (mobile) / modal (desktop), `max-height: 70dvh`, safe-area padding
- [ ] Update `apps/web/public/sw.js`:
  - Add `/tests` to `SHELL_ROUTES`
  - Remove `/api/tests/` from `NETWORK_ONLY_PATTERNS`

**Week 5–6 — Result Page:**
- [ ] Build `features/tests/components/ScoreRing.tsx` — CSS `stroke-dashoffset` transition
- [ ] Build `features/tests/components/BreakdownItem.tsx`:
  - Correct `✅`: no explanation
  - Wrong `❌` + Skipped `⬜`: explanation box (Marathi, `line-height: 1.7`)
- [ ] Build `app/tests/[id]/result/page.tsx`:
  - Primary: read from IDB (instant, no network)
  - Fallback: `GET /api/tests/:id/attempt/:attemptId` (new device / IDB cleared)
  - Score ring: CSS animation on mount
  - Grade label: `अजून प्रयत्न करा` / `चांगला प्रयत्न!` / `उत्कृष्ट काम!` / `अप्रतिम!`
  - Percentile: fire-and-forget, only renders if `total ≥ 10`
  - `timeTaken`: show `—` for null (untimed test)
  - CTA: `पुन्हा करा` (Retake) + `चाचण्यांकडे जा` (Back to Tests)

---

### Phase 4 — Admin Panel *(Week 6–7)*

**Goal:** Content Manager can create, edit, and publish tests from any device.

- [ ] Build `app/(admin)/admin/tests/page.tsx`:
  - Table: Title, Type, Subject, Question count, Time limit, Scheduled, Status (Draft/Live), Actions
  - Inline `isPublished` toggle via `PATCH /api/tests/:id`
  - Bulk delete (checkbox select)
  - Create modal: type, subject, time limit, schedule date, access (Free/Paid)
- [ ] Build `app/(admin)/admin/tests/[id]/questions/page.tsx`:
  - Desktop (≥ 900px): left list + right form (two-panel)
  - Mobile/tablet (< 900px): stacked form + bottom drawer for question list
  - Drawer trigger: `[📋 Questions (8)]` pill, slides up on tap
  - Form: Marathi textarea, 4 option inputs (500 char counter), correct answer picker, optional explanation
  - `Save & Next` — saves + auto-advances to next unanswered question
  - `Publish Test` — only active when all questions have `correctOption` set
- [ ] Add Tests to admin sidebar nav in `app/(admin)/layout.tsx`
- [ ] Move Plans section into `app/account/page.tsx#subscription`
- [ ] Redirect `app/plans/page.tsx` → `/account#subscription`

---

### Phase 5 — Polish & Responsive QA *(Week 7–8)*

**Goal:** Ship-quality on all target screen sizes.

- [ ] Responsive QA matrix:
  - 375px (iPhone SE) — most constrained
  - 390px (iPhone 14)
  - 768px (iPad portrait)
  - 1024px (iPad landscape / small desktop)
  - 1280px (desktop)
- [ ] Devanagari rendering: confirm `line-height: 1.7` on question text, options, explanations in Chrome Android + Safari iOS
- [ ] Timer edge cases: auto-submit at 0, `isSubmitting` guard blocks double-tap, 1-min test smoke test
- [ ] Offline scenario: airplane mode mid-test → submit → "saved locally" toast → come online → retry fires once → result syncs
- [ ] Plan gate: FREE + paid test → upgrade sheet. Expired plan → same gate. Admin bypasses.
- [ ] Light mode: all test screens with `[data-theme="light"]`
- [ ] Performance (₹8,000 Android): score ring (CSS, not JS timer), dot grid 5-col scroll, option selection instant

---

### Phase 6 — Security & Performance Hardening *(Week 8–9)*

**Goal:** Verify nothing leaks before going live.

- [ ] **Security audit:**
  - `GET /api/tests/:id` — `correctOption` absent in response body (run string search on full JSON)
  - `GET /api/tests/:id/questions` — 403 for STUDENT role
  - `GET /api/tests/:id/attempt/:attemptId` for another user's attempt — 404, not 403 (no info leak)
  - Content Manager: can CRUD tests, cannot access `/admin/users` or `/admin/payments`
- [ ] **Double-submit protection end-to-end test:**
  - Submit → disconnect mid-flight → reconnect → only one `TestAttempt` row created
  - Tap Submit twice rapidly → `isSubmitting` blocks second tap
- [ ] **Database performance (`EXPLAIN ANALYZE`):**
  - `SELECT ... WHERE type='DAILY' AND "scheduledAt" BETWEEN ... ` — uses `Test_type_scheduledAt_idx`
  - `SELECT COUNT(*) WHERE "testId"=? AND score < ?` — uses `TestAttempt_testId_score_idx`
  - `SELECT * WHERE "userId"=? ORDER BY "completedAt" DESC` — uses `TestAttempt_userId_completedAt_idx`

---

## Part 8 — Realistic Timeline

| Phase | Scope | Duration | Key Risk |
|---|---|---|---|
| 1 — Foundation | Schema + all API routes | Week 1–2 | Low |
| 2 — Storage | IDB + session store + unit tests | Week 2–3 | Low |
| 3 — Student UI | Lobby + Runner + Result | Week 3–6 | **High** — timer + offline edge cases take longer than estimated |
| 4 — Admin | Question builder + publish flow | Week 6–7 | Medium |
| 5 — Polish | Responsive QA + Devanagari | Week 7–8 | Medium — Devanagari rendering on real Android always has surprises |
| 6 — QA Hardening | Security + DB performance | Week 8–9 | Low |

**Total: 9 weeks.** The original plan estimated 7. Two extra weeks account for offline-submit correctness testing, admin mobile layout, and `EXPLAIN ANALYZE` verification.

---

## Part 9 — What Not to Build Yet

| Feature | Build when | Data available today |
|---|---|---|
| **Leaderboard** | 50+ students have taken a test | `ORDER BY score DESC, timeTaken ASC WHERE testId=?` |
| **Analytics dashboard** | After Phase 5 stable | All from `TestAttempt` |
| **CSV/Excel question import** | After 1 manual-editor test cycle | Same `CreateQuestionSchema` |
| **Admin test preview** | Nice-to-have | Admin can visit `/tests/:id` on a draft directly |
| **Push notifications (daily reminder)** | After system is stable | Requires SW push + cron + permission UX |
