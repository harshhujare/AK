# Mock Test System — Multiphase Implementation Plan
### AjitSir Academy · Maharashtra TET Preparation

---

## Part 1 — What Is Already Built

This section documents what exists in the codebase today, so no one rebuilds it.

### Backend (apps/api)

**Database schema — `prisma/schema.prisma`**

The core test models are fully defined and production-ready:

```
Test          — id, title, description, subjectId, isPaid, createdAt, updatedAt
Question      — id, testId, text, options (JSON), correctOption, explanation, order
TestAttempt   — id, userId, testId, answers (JSON), score, totalMarks, timeTaken, completedAt
```

The `Question.options` field stores `[{ id: "A", text: "..." }, ...]`. The `correctOption` field stores `"A" | "B" | "C" | "D"`. Explanations are optional per question.

**API routes — `apps/api/src/routes/tests.ts`**

All core routes exist and are wired to Express:

| Route | Auth | Notes |
|-------|------|-------|
| `GET /api/tests` | Public | Lists all tests. No filters yet. |
| `GET /api/tests/:id` | Student | Returns test + questions. `correctOption` deliberately excluded. Plan gate enforced. |
| `GET /api/tests/attempts/me` | Student | Returns student's full attempt history. |
| `POST /api/tests/:id/attempt` | Student | Scores server-side, returns breakdown. Never trusts client score. |
| `POST /api/tests` | Admin | Creates test with questions in one shot. |
| `PUT /api/tests/:id` | Admin | Updates test metadata. |
| `DELETE /api/tests/:id` | Admin | Deletes test and all its attempts. |

The scoring engine in `POST /api/tests/:id/attempt` is correct: it iterates every question, compares the student's `answers[q.id]` with `q.correctOption`, builds the full `breakdown[]` array with `questionText`, `selected`, `correct`, `explanation`, and `isCorrect`, and persists the attempt to Postgres. Score is never calculated on the frontend.

**Shared types — `packages/shared/src/types.ts`**

`Test`, `TestWithQuestions`, `Question`, `QuestionOption`, `TestAttempt`, `AttemptBreakdownItem`, `AttemptResult` are all defined. `correctOption` is intentionally absent from the `Question` interface — it is only present on the Prisma model, never sent to the client in GET responses.

**Shared schemas — `packages/shared/src/schemas.ts`**

`CreateTestSchema`, `UpdateTestSchema`, `CreateQuestionSchema`, `SubmitAttemptSchema` are defined and in use.

### Frontend (apps/web)

Nothing test-related exists on the frontend yet. No test pages, no hooks, no components, no session store.

**What does exist that tests will reuse:**

- `lib/api-client.ts` — axios instance with 401 interceptor + refresh queue. All test API calls use this.
- `lib/query-provider.tsx` — React Query provider with localStorage persister. Test list queries will be added to the persisted key allow-list.
- `hooks/useSubjects.ts` — Subject list hook. The test lobby reuses this for the subject filter.
- `hooks/useOnlineStatus.ts` — Network probe. The offline submission retry hooks into this.
- `features/payment/` — Payment flow. The plan gate UI reuses this.
- `lib/auth-store.ts` — Zustand auth store. Used for plan check before entering a paid test.
- `components/layout/BottomNav.tsx` — Current tabs: Home, Notes, Plans, Account. Plans tab will be removed and replaced with Tests.
- `app/globals.css` — Full dark/light token system (`--bg-page`, `--bg-surface`, `--bg-surface-2`, `--border`, `--accent-bg`, `--accent-text`, `--success-*`, `--danger-*`). All test UI uses these tokens exclusively.

---

## Part 2 — What Needs to Be Built

### 2.1 Database additions (one migration)

The current `Test` model has no concept of type, scheduling, time limits, or draft/published state. These five fields are required:

```prisma
enum TestType {
  DAILY       // One per day, Ajit Sir assigns scheduledAt = that day's date
  PREDEFINED  // Manually scheduled with a specific date window
  SUBJECT     // Always available, filtered by subject
}

model Test {
  // existing fields unchanged...
  type         TestType  @default(SUBJECT)
  timeLimitSec Int?      // null = untimed. 1800 = 30 min, 2700 = 45 min
  scheduledAt  DateTime? // DAILY: date it is live. PREDEFINED: window start.
  expiresAt    DateTime? // PREDEFINED: when it closes. DAILY: end of that day.
  isPublished  Boolean   @default(false)  // false = draft, invisible to students
}
```

Migration file:
```sql
CREATE TYPE "TestType" AS ENUM ('DAILY', 'PREDEFINED', 'SUBJECT');
ALTER TABLE "Test" ADD COLUMN "type"         "TestType" NOT NULL DEFAULT 'SUBJECT';
ALTER TABLE "Test" ADD COLUMN "timeLimitSec" INTEGER;
ALTER TABLE "Test" ADD COLUMN "scheduledAt"  TIMESTAMPTZ;
ALTER TABLE "Test" ADD COLUMN "expiresAt"    TIMESTAMPTZ;
ALTER TABLE "Test" ADD COLUMN "isPublished"  BOOLEAN NOT NULL DEFAULT false;
```

### 2.2 Backend additions

**Update `GET /api/tests` — add filter params**
```
?type=DAILY|PREDEFINED|SUBJECT
?subjectId=<cuid>
?date=2025-06-12        (for DAILY: returns test whose scheduledAt is that day)
?published=true         (default: only return isPublished=true for students)
```

**Add `GET /api/tests/:id/attempt/:attemptId`**
Needed for the result page fallback (when IndexedDB is empty on a new device).
Returns the stored `TestAttempt` + reconstructed `breakdown` for that student.
Only returns attempts belonging to `req.user.userId`.

**Add per-question CRUD**
The current API only supports creating questions as part of test creation. The admin question builder needs to add/edit/delete individual questions post-creation:
- `GET /api/tests/:id/questions` — returns questions WITH `correctOption` (admin only)
- `POST /api/tests/:id/questions` — add one question
- `PUT /api/tests/:testId/questions/:qId` — edit question text, options, correctOption, explanation, order
- `DELETE /api/tests/:testId/questions/:qId` — delete one question

**Add `GET /api/tests/:id/percentile`**
Returns `{ percentile: 72 }` based on `SELECT COUNT(*) WHERE testId = ? AND score > ?` divided by total attempts. Used on the result page. Only called when ≥ 10 attempts exist.

### 2.3 Frontend file structure to create

```
apps/web/
├── features/tests/
│   ├── hooks/
│   │   ├── useTests.ts              React Query — test list with filters
│   │   ├── useTest.ts               React Query — single test + questions
│   │   └── useTestAttempts.ts       React Query — student's attempt history
│   ├── store/
│   │   └── test-session.ts          Zustand + persist — in-progress session
│   ├── lib/
│   │   └── test-results-db.ts       IndexedDB — on-device result storage
│   └── components/
│       ├── TestCard.tsx             Card used in lobby list
│       ├── DailyHeroCard.tsx        Hero card for the daily test
│       ├── QuestionDotGrid.tsx      Dot navigator shown during runner
│       ├── CountdownTimer.tsx       Animated countdown, turns amber/red
│       ├── ScoreRing.tsx            Animated SVG ring for result page
│       └── BreakdownItem.tsx        Single Q row in result breakdown
│
├── app/
│   ├── tests/
│   │   ├── page.tsx                 Test lobby (3 tabs)
│   │   └── [id]/
│   │       ├── page.tsx             Test runner
│   │       └── result/
│   │           └── page.tsx         Result + breakdown
│   └── (admin)/admin/
│       └── tests/
│           ├── page.tsx             Admin test list + create/edit/delete
│           └── [id]/
│               └── questions/
│                   └── page.tsx     Question editor for a specific test
```

### 2.4 Navigation changes

**Remove Plans tab from BottomNav, add Tests tab**

In `components/layout/BottomNav.tsx`, replace the Plans entry:

```tsx
// REMOVE:
{ label: 'Plans', href: '/plans', ... }

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

**Move Plans content to Account page**

In `app/account/page.tsx`, add a "Subscription" section that renders what `/plans` currently renders — the `PlanConfig` pricing cards and Razorpay checkout flow. The `/plans` route can redirect to `/account#subscription` or be kept as a standalone page that deep-links into account. Either works; redirect is simpler.

**Desktop Navbar**

Add "Tests" to the desktop `navbar-links` in `Navbar.tsx`:
```tsx
<Link href="/tests" className="navbar-link">Mock Tests</Link>
```

**Admin sidebar**

In `app/(admin)/layout.tsx`, add to the admin nav:
```ts
{ href: '/admin/tests', label: 'Tests', icon: <ClipboardList size={18} />, roles: ['SUPER_ADMIN', 'CONTENT_MANAGER'] }
```

---

## Part 3 — Frontend Architecture

### Session store — `features/tests/store/test-session.ts`

The most important piece. Handles the entire in-progress test state.

```ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { TestWithQuestions } from '@ajitsir/shared';

interface TestSession {
  testId:    string | null;
  test:      TestWithQuestions | null;
  answers:   Record<string, string>;   // { questionId: 'A'|'B'|'C'|'D' }
  startedAt: number | null;            // Date.now() when session started
  currentQ:  number;                   // 0-based index
  submitted: boolean;

  startSession:  (test: TestWithQuestions) => void;
  setAnswer:     (questionId: string, option: string) => void;
  goToQuestion:  (index: number) => void;
  markSubmitted: () => void;
  clearSession:  () => void;
}

export const useTestSession = create<TestSession>()(
  persist(
    (set) => ({
      testId: null, test: null, answers: {}, startedAt: null, currentQ: 0, submitted: false,
      startSession: (test) => set({
        testId: test.id, test, answers: {},
        startedAt: Date.now(), currentQ: 0, submitted: false,
      }),
      setAnswer: (qId, opt) =>
        set((s) => ({ answers: { ...s.answers, [qId]: opt } })),
      goToQuestion: (i) => set({ currentQ: i }),
      markSubmitted: () => set({ submitted: true }),
      clearSession: () => set({
        testId: null, test: null, answers: {},
        startedAt: null, currentQ: 0, submitted: false,
      }),
    }),
    {
      name: 'test-session',
      // Don't persist submitted sessions — auto-clear on next mount
      partialize: (s) => (s.submitted ? {} : s),
    }
  )
);
```

**Why this matters:** If a student's phone dies mid-test or they close the browser, their answers and current question index are in localStorage. On next open, the runner page detects `session.testId === routeId && !session.submitted` and resumes exactly where they left off. Timer resumes from `Date.now() - session.startedAt`.

### On-device result storage — `features/tests/lib/test-results-db.ts`

```ts
import { openDB } from 'idb';
import type { AttemptResult } from '@ajitsir/shared';

const DB = 'ajitsir-test-results';
const VER = 1;
const STORE = 'results';
const MAX = 200; // keep last 200 results on device

interface StoredResult {
  id:        string;   // TestAttempt.id from server
  testId:    string;
  testTitle: string;
  subjectId: string;
  result:    AttemptResult;
  savedAt:   number;
}

// openDB, saveResult, getResultsByTest, getResultsBySubject,
// getAllResults, clearResults
// — standard IndexedDB via `idb` package, LRU eviction at MAX
// — indexes on testId, subjectId, savedAt
// — clearResults() called from auth-store.logout()
```

Install `idb`:
```bash
cd apps/web && npm install idb
```

### React Query hooks

**`features/tests/hooks/useTests.ts`**
```ts
export function useTests(params: { type?: TestType; subjectId?: string } = {}) {
  return useQuery({
    queryKey: ['tests', params.type, params.subjectId],
    networkMode: 'offlineFirst',  // ← same as useNotes, useSubjects
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const p = new URLSearchParams();
      if (params.type)      p.set('type', params.type);
      if (params.subjectId) p.set('subjectId', params.subjectId);
      const { data } = await apiClient.get(`/api/tests?${p}`);
      return data.data as Test[];
    },
  });
}
```

**`features/tests/hooks/useTest.ts`**
```ts
export function useTest(testId: string | null) {
  return useQuery({
    queryKey: ['test', testId],
    enabled: !!testId,
    networkMode: 'offlineFirst',
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data } = await apiClient.get(`/api/tests/${testId}`);
      return data.data as TestWithQuestions;
    },
  });
}
```

**Add to `query-provider.tsx` persisted keys:**
```ts
const PERSISTED_KEYS = ['notes', 'subjects', 'announcements', 'faqs', 'tests'];
// and add: shouldDehydrateQuery: (q) => PERSISTED_KEYS.some(k => q.queryKey[0] === k)
```

### Offline submission retry

Add to `useOnlineStatus.ts`, after probe returns `true`:
```ts
async function flushPendingAttempts() {
  const keys = Object.keys(localStorage)
    .filter(k => k.startsWith('pending-attempt-'));
  for (const key of keys) {
    try {
      const { testId, answers, timeTaken } = JSON.parse(localStorage.getItem(key)!);
      const { data } = await apiClient.post(`/api/tests/${testId}/attempt`, { answers, timeTaken });
      await saveResult(data.data.id, testId, '', '', data.data);
      localStorage.removeItem(key);
    } catch {
      // still offline or server error — leave it, retry next reconnect
    }
  }
}
```

### Service Worker update

In `apps/web/public/sw.js`, add to `NETWORK_ONLY_PATTERNS`:
```js
'/api/tests/',   // questions must always be fresh — no stale correctOption risk
```

Add `/tests` to `SHELL_ROUTES` so the lobby page shell is cached offline:
```js
const SHELL_ROUTES = ['/', '/notes', '/tests', '/account'];
```

---

## Part 4 — UI/UX Design

### Design language

Everything uses the existing token system from `globals.css`. No new CSS variables are introduced. The design is dark-first (matching the existing app) with light mode support via the same `[data-theme="light"]` overrides.

**Marathi content:** All question text, option text, and explanations are authored in Marathi (Devanagari script) by the content manager. The UI itself uses English labels (`Question 3 of 25`, `Submit`, `Next`) because the admin and navigation chrome are in English. The question card area uses `font-size: 1rem; line-height: 1.7` — Devanagari characters are taller than Latin, so line-height must be at least 1.6 or text will clip.

**Responsive breakpoints:** Mobile-first. The bottom nav is already hidden at `> 768px`. Test pages follow the same pattern: single-column on mobile, two-column on desktop (sidebar + main).

---

### Screen 1 — Test Lobby (`/tests`)

**Mobile layout:**

```
┌─────────────────────────────────┐
│ Mock Tests          🔥 7-day streak│
│ Maharashtra TET Preparation      │
├─────────────────────────────────┤
│ [Daily] [Scheduled] [By Subject] │  ← tab strip
├─────────────────────────────────┤
│                                  │
│  ┌──────────────────────────┐   │
│  │ ● TODAY · JUNE 12        │   │  ← animated live dot
│  │ बालमानसशास्त्र            │   │
│  │ Daily Practice Test       │   │
│  │ 📋 25 Questions  ⏱ 30 Min│   │
│  │ ▶  चाचणी सुरू करा         │   │  ← "Start Test" in Marathi
│  └──────────────────────────┘   │
│                                  │
│  Subject Tests              All →│
│  [सर्व][मराठी][बालविकास][English]  │  ← horizontal scroll chips
│                                  │
│  ┌──────────────────────────┐   │
│  │ Child Dev. Paper I   FREE│   │
│  │ 30 Qs · 45 min           │   │
│  │ ✅ Best: 24/30 · 80%     │   │
│  └──────────────────────────┘   │
│  ┌──────────────────────────┐   │
│  │ Marathi Language    PAID │   │
│  │ 50 Qs · 60 min           │   │
│  └──────────────────────────┘   │
└─────────────────────────────────┘
```

**Desktop layout (> 768px):**

Left sidebar (260px): subject filter list (vertical, not horizontal chips).
Main area: two-column grid of `TestCard` components. Daily hero spans full width at top.

**Key UI decisions:**

The daily test gets a hero card with a gradient background (`linear-gradient(135deg, #1a1a2e, #0f3460)`) — distinct from the regular test cards. The "Start Test" button copy is `चाचणी सुरू करा` (Marathi). If the student has already taken today's test, the Start button becomes `पुन्हा करा` (Retake) and shows their score inline on the card.

The streak counter (🔥 7) is top-right in the header. Calculated from consecutive days where `TestAttempt.completedAt` exists — client-side from IndexedDB `getAllResults()`. No server round-trip needed for this.

Test cards show attempted state inline — a green `✅ Best: 24/30` row at the bottom — so students don't have to tap into a test to know if they've done it.

---

### Screen 2 — Test Runner (`/tests/[id]`)

**Mobile layout:**

```
┌─────────────────────────────────┐
│ ←  बालमानसशास्त्र Daily Test    │
│     Question 3 of 25    ⏱ 23:14 │
├─────────────────────────────────┤
│ ██░░░░░░░░░░░░░░░░  2/25        │  ← progress bar
├─────────────────────────────────┤
│ [1✓][2✓][3●][4][5][6][7][8]... │  ← question dot grid, scroll-x
├─────────────────────────────────┤
│                                  │
│  प्रश्न ३                        │
│                                  │
│  पिआजेच्या सिद्धांतानुसार,       │
│  ऑब्जेक्ट परमनन्स कोणत्या        │
│  अवस्थेत विकसित होते?            │
│                                  │
│  ┌─────────────────────────┐    │
│  │ A  पूर्व-क्रियात्मक अवस्था │    │
│  └─────────────────────────┘    │
│  ┌─────────────────────────┐    │
│  │ B  संवेदी-गतिज अवस्था  ●│    │  ← selected
│  └─────────────────────────┘    │
│  ┌─────────────────────────┐    │
│  │ C  मूर्त क्रियात्मक     │    │
│  └─────────────────────────┘    │
│  ┌─────────────────────────┐    │
│  │ D  औपचारिक क्रियात्मक  │    │
│  └─────────────────────────┘    │
│                                  │
├─────────────────────────────────┤
│ [← मागे]              [पुढे →]  │
└─────────────────────────────────┘
```

**Desktop layout (> 768px):**

Left panel (320px, fixed): question dot grid (5 per row), test info, Submit button.
Right panel (flex): question text + options. No bottom nav bar on desktop.

**Key UI decisions:**

**Timer colour states:**
- > 5 min remaining: `--text-secondary` (neutral)
- 2–5 min: `--warn-text` (#fde68a amber)
- < 2 min: `--danger-text` (#fca5a5 red) + subtle pulse animation on the timer pill

**Question dot grid:** Each dot is 28×28px, `border-radius: 8px`. States:
- Empty (unanswered): `--bg-surface-2`, `--text-muted`
- Answered: `--bg-active`, `--border-strong`, `--text-secondary`
- Current: `--accent-bg` (white in dark mode), `--accent-text` (black)

**Option selection:** Tap-to-select, no confirm dialog. Selecting a different option on the same question simply updates `answers[q.id]`. The label badge (`A`, `B`, `C`, `D`) fills with `--accent-bg` when selected. Full-row background changes to `--bg-active`. No animation delay — must feel instant.

**Submit confirmation:** On the last question, "Next" becomes "सबमिट करा" (Submit). Tapping it opens a bottom sheet (mobile) or modal (desktop) that shows: `X answered, Y unanswered — Are you sure?` Two buttons: "परत जा" (Go Back) and "सबमिट करा" (Submit). This prevents accidental submit.

**Session resume banner:** If the Zustand store has a partial session for this test on mount, show a banner at top: `तुम्ही प्रश्न X वर थांबलात — पुढे चालू ठेवा` (You stopped at question X — continue). Tapping it scrolls to that question dot and restores the view state.

---

### Screen 3 — Result Page (`/tests/[id]/result`)

**Mobile layout:**

```
┌─────────────────────────────────┐
│                                  │
│         ╭───────────╮            │
│         │   75%     │            │  ← animated SVG ring
│         │  19 / 25  │            │
│         ╰───────────╯            │
│                                  │
│    उत्कृष्ट काम! 🎉               │  ← "Great Work!" in Marathi
│  68% विद्यार्थ्यांपेक्षा चांगले   │  ← percentile
│                                  │
├──────────┬──────────┬────────────┤
│  19      │  4       │  2         │
│  बरोबर   │  चुकीचे  │  सोडलेले   │  ← Correct / Wrong / Skipped
├──────────┴──────────┴────────────┤
│  ⏱ वेळ: 24 मिनिटे 12 सेकंद      │
├─────────────────────────────────┤
│ उत्तर विश्लेषण (Answer Breakdown)│
├─────────────────────────────────┤
│ ✅ Q1 — पिआजेचा...              │
│    B — बरोबर                    │
├─────────────────────────────────┤
│ ❌ Q3 — ऑब्जेक्ट परमनन्स...     │
│    A — तुमचे · B — बरोबर        │
│    ┌───────────────────────┐   │
│    │ ऑब्जेक्ट परमनन्स हे   │   │  ← explanation, Marathi
│    │ संवेदी-गतिज अवस्थेत...│   │
│    └───────────────────────┘   │
├─────────────────────────────────┤
│ [पुन्हा करा]    [चाचण्यांकडे जा]│
└─────────────────────────────────┘
```

**Key UI decisions:**

The SVG ring animates from 0% to the actual score on mount — 600ms ease-out. This is the one moment of delight in the flow. The ring stroke colour maps to score: `--danger-text` below 40%, `--warn-text` 40–70%, `--success-text` above 70%.

Grade label (Marathi):
- < 40%: `अजून प्रयत्न करा` (Keep trying)
- 40–70%: `चांगला प्रयत्न!` (Good effort!)
- 70–90%: `उत्कृष्ट काम!` (Great work!)
- > 90%: `अप्रतिम!` (Brilliant!)

Percentile line only renders if ≥ 10 attempts exist in DB. The `GET /api/tests/:id/percentile` call is fire-and-forget — result page does not block on it.

Breakdown: Only shows explanation box on wrong and skipped questions — not on correct ones. This is intentional. Students need to understand their mistakes, not re-read what they already know. Explanation text is in Marathi as authored by Ajit Sir.

The breakdown loads from IndexedDB — it is instant, no network needed. This is the primary benefit of the on-device storage architecture.

---

### Screen 4 — Admin Test Builder (`/admin/tests/[id]/questions`)

**Desktop layout (min-width: 900px required for admin):**

```
┌──────────────────────────────────────────────────────────────────────┐
│ बालमानसशास्त्र Daily Test · 8 Questions · Draft       [Publish Test] │
├──────────────────┬───────────────────────────────────────────────────┤
│  Questions       │  [Question] [Settings]                            │
│  ─────────────── │                                                   │
│  ✅ 1 — Which... │  Question Text (Marathi)                          │
│  ✅ 2 — Vygotsk  │  ┌───────────────────────────────────────────┐   │
│  ● 3 — Accordin  │  │ पिआजेच्या सिद्धांतानुसार, ऑब्जेक्ट     │   │
│  □ 4 — Jean P... │  │ परमनन्स कोणत्या अवस्थेत विकसित होते?   │   │
│  □ 5 — Howard...│  └───────────────────────────────────────────┘   │
│                  │                                                   │
│  + Add Question  │  Options                                         │
│                  │  [A] पूर्व-क्रियात्मक अवस्था                    │
│  ─────────────── │  [B] संवेदी-गतिज अवस्था          ← correct      │
│  Test Settings   │  [C] मूर्त क्रियात्मक अवस्था                   │
│  Type: DAILY     │  [D] औपचारिक क्रियात्मक अवस्था                 │
│  Time: 30 min    │                                                   │
│  Free            │  Correct Answer: [A] [B●] [C] [D]               │
│                  │                                                   │
│                  │  Explanation (optional, Marathi)                  │
│                  │  ┌───────────────────────────────────────────┐   │
│                  │  │ ऑब्जेक्ट परमनन्स म्हणजे वस्तू दिसत       │   │
│                  │  │ नसली तरी अस्तित्वात आहे हे समजणे...     │   │
│                  │  └───────────────────────────────────────────┘   │
│                  │                                                   │
│                  │  [← Previous]                  [Save & Next →]  │
└──────────────────┴───────────────────────────────────────────────────┘
```

**Test Settings tab (second tab):**

```
Type:        [DAILY ●] [PREDEFINED] [SUBJECT]
Scheduled:   [Date picker — shows when DAILY or PREDEFINED]
Expires:     [Date picker — shows when PREDEFINED]
Time Limit:  [None] [30 min] [45 min] [60 min] [Custom]
Access:      [Free ●] [Premium]
Subject:     [dropdown]
Description: [textarea — shown on test card]
```

**Admin test list page (`/admin/tests`):**

Same table pattern as `admin/notes/page.tsx`. Columns: Title, Type, Subject, Questions, Time, Scheduled, Status (Draft/Live), Actions.

The Status column has an inline toggle — single `PATCH { isPublished: true/false }` call. The admin can publish/unpublish without opening the full editor. This is the most-used admin action once tests are built.

Bulk actions: Select multiple → Delete. No bulk publish (too risky).

---

## Part 5 — Marathi Content Guidelines

Since the target audience is Maharashtra TET students, all question and explanation text must follow these rules:

**Language:** Standard written Marathi (प्रमाण मराठी). Not colloquial. Not translated English.

**Question format examples:**
```
पिआजेच्या सिद्धांतानुसार, संवेदी-गतिज अवस्था कोणत्या वयापर्यंत असते?
वायगोत्स्कीच्या ZPD संकल्पनेनुसार, प्रत्यक्ष आणि संभाव्य विकासामधील अंतर म्हणजे काय?
बालविकासाच्या कोणत्या तत्त्वानुसार विकास सामान्य ते विशिष्ट दिशेने होतो?
```

**Option format:** Each option is a complete phrase, not a single word. All four options should be grammatically parallel.

**Explanation format:** 2–3 sentences. States the correct fact, explains why the other options are wrong if non-obvious. Written at the level of a TET student who got it wrong — pedagogical, not academic.

**Subject names in the filter chips:** Show both Marathi and English:
- `बालविकास` (Child Dev.)
- `मराठी भाषा` (Marathi)
- `इंग्रजी` (English)
- `गणित` (Maths)
- `पर्यावरण` (EVS)

The `Subject.nameMarathi` field already exists in the schema. Use it.

---

## Part 6 — Phased Implementation

### Phase 1 — Foundation (Week 1–2)

**Goal:** Schema + API complete and tested. Nothing visible to students yet.

1. Write and run the Prisma migration (5 new fields on Test)
2. Update `packages/shared/src/types.ts` — add `TestType`, `timeLimitSec`, `scheduledAt`, `expiresAt`, `isPublished` to `Test` interface
3. Update `packages/shared/src/schemas.ts` — extend `CreateTestSchema` and `UpdateTestSchema`
4. Update `GET /api/tests` — add `type`, `subjectId`, `date`, filter params
5. Add `GET /api/tests/:id/attempt/:attemptId`
6. Add per-question CRUD routes (`GET/POST/PUT/DELETE /api/tests/:id/questions/:qId`)
7. Add `GET /api/tests/:id/percentile`
8. Test all new routes with Postman — especially the `correctOption` exclusion check

**Verification:** `GET /api/tests/:id` must never return `correctOption` in any question. Run a direct Postman check. This is the most critical security requirement.

### Phase 2 — On-device storage + session (Week 2–3)

**Goal:** Storage layer working before any UI is built.

1. `npm install idb` in `apps/web`
2. Build `features/tests/lib/test-results-db.ts` — IndexedDB with LRU, indexes on `testId`, `subjectId`, `savedAt`
3. Build `features/tests/store/test-session.ts` — Zustand + persist, partialize to exclude submitted sessions
4. Add `clearResults()` call to `auth-store.logout()`
5. Wire offline submission retry into `useOnlineStatus.ts`
6. Write unit tests for `test-results-db.ts` — save, retrieve, LRU eviction, clear

### Phase 3 — Student frontend (Week 3–5)

**Goal:** Students can take tests end-to-end.

**Week 3:**
1. Build `features/tests/hooks/useTests.ts`, `useTest.ts`, `useTestAttempts.ts`
2. Add `tests` to RQ persister allow-list in `query-provider.tsx`
3. Update `BottomNav.tsx` — remove Plans, add Tests
4. Build `features/tests/components/TestCard.tsx` and `DailyHeroCard.tsx`
5. Build `app/tests/page.tsx` — lobby with Daily / Scheduled / By Subject tabs

**Week 4:**
6. Build `features/tests/components/QuestionDotGrid.tsx` and `CountdownTimer.tsx`
7. Build `app/tests/[id]/page.tsx` — full runner
   - Pre-flight fetch + session start
   - Dot grid navigation
   - Countdown timer with colour states
   - Offline-safe submit with localStorage pending queue
   - Auto-submit on timer expiry
   - Session resume banner

**Week 5:**
8. Build `features/tests/components/ScoreRing.tsx` and `BreakdownItem.tsx`
9. Build `app/tests/[id]/result/page.tsx`
   - Online mode: read from AttemptResult returned on submit (stored in IndexedDB)
   - Offline mode: read from IndexedDB
   - Animated ring on mount
   - Marathi grade label
   - Percentile (fire-and-forget)
   - Full breakdown with Marathi explanations
10. Update SW `SHELL_ROUTES` to include `/tests`
11. Update SW `NETWORK_ONLY_PATTERNS` to include `/api/tests/`

### Phase 4 — Admin panel (Week 5–6)

**Goal:** Content Manager can create and publish tests without developer help.

1. Build `app/(admin)/admin/tests/page.tsx` — test list table, inline publish toggle, delete
2. Build test creation flow — modal with test metadata form (type, subject, time limit, schedule, access)
3. Build `app/(admin)/admin/tests/[id]/questions/page.tsx` — two-panel question editor
   - Left: question list with done/pending state
   - Right: question form with Marathi textarea, 4 option inputs, correct answer picker, explanation textarea
   - Save & Next flow
4. Add Tests to admin sidebar nav
5. Move Plans/pricing section into `app/account/page.tsx`

### Phase 5 — Polish + QA (Week 6–7)

1. Responsive QA — test every screen at 375px (iPhone SE), 390px (iPhone 14), 768px (iPad), 1280px (desktop)
2. Devanagari text rendering — verify `line-height: 1.7` on all question/option text
3. Timer auto-submit — test with a 1-minute test, verify no double submission
4. Offline scenario — airplane mode during test, verify session persists and result appears correctly
5. Plan gate — verify paid tests show upgrade prompt for FREE users
6. Admin content manager role — verify CONTENT_MANAGER can CRUD tests but cannot access users/payments
7. Light mode — verify all test screens respect `[data-theme="light"]` tokens
8. Performance — test on a ₹8,000 Android device (Redmi/Realme), verify no jank on question transitions

---

## Part 7 — What Not to Build (Yet)

These are logical next features but should not be in this release:

**Leaderboard:** The data (`TestAttempt.score`) is there. A leaderboard query is `ORDER BY score DESC, timeTaken ASC WHERE testId = ?`. Add it after 50+ students have taken tests — a leaderboard with 3 entries is discouraging, not motivating.

**Analytics dashboard:** Total attempts, average score, drop-off by question number — all computable from `TestAttempt`. Build after Phase 5 once the content side is stable.

**CSV/Excel question import:** Useful for bulk upload of 100+ questions. Build after the Content Manager has used the per-question editor for one test cycle and can give real feedback on format.

**Test preview mode (admin):** The runner page at `/tests/:id` already works. An admin with a `CONTENT_MANAGER` role can visit that URL directly to preview a draft test. A dedicated preview mode is a nice-to-have.

**Push notifications for daily test reminder:** Requires a Service Worker push subscription, a cron job, and a notification permission prompt. High value for daily retention. Plan after the test system is stable.