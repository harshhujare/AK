# AjitSir Academy — Mobile App Implementation Plan (AI-Agent Execution Format)

> **Audience for this document:** AI coding agents (Claude Code, Cursor, etc.) executing phases sequentially, plus the human reviewer (you) gating each phase.
> **Source of truth for architecture decisions:** `rn_architecture.md` (already reviewed, approved with amendments below).
> **Source of truth for backend behavior:** the actual code in `apps/api`, not the README.

---

## How to use this document (read this first, agent)

1. Execute **one phase at a time**. Do not start Phase N+1 until Phase N's exit criteria are all checked off by the human.
2. Each phase lists: scope, files to create/modify, exact dependencies to install, the verification checklist, and explicit non-goals (things agents commonly over-build — do NOT do these).
3. Every phase has a **"STOP — backend check required"** block where applicable. Read the actual backend route file before writing client code against it. Do not assume the README's documented response shape is correct — verify against `apps/api/src/routes/*.ts`.
4. If a phase requires a backend change, that is called out explicitly as a separate sub-task with its own acceptance criteria. Backend changes are small and isolated — do not refactor unrelated backend code while making them.
5. Never invent an API endpoint that doesn't exist in the backend. If a needed endpoint is missing, stop and flag it rather than mocking it client-side.
6. Commit after each phase passes its checklist, with a message referencing the phase number (e.g. `mobile: phase 2 - notes list + PDF viewer`).

---

## Phase 0 — Foundation (no UI, no business logic)

**Goal:** A working Expo dev client that boots, connects to the monorepo, and proves the build pipeline works end to end. Nothing user-facing yet.

### Backend check required before starting
Read `apps/api/src/index.ts` and confirm:
- The exact base URL path prefix (e.g. `/api` vs none)
- Whether a `/health` endpoint exists (used later for connectivity probing — confirm exact path, do not assume `/health` is correct, the architecture doc's note about Bug #1 exists specifically because this was wrong once before)
- CORS config — confirm it doesn't block non-browser clients (mobile requests don't send an Origin header the same way; verify this won't 403 mobile requests)

Record findings in `apps/mobile/BACKEND_NOTES.md` (create this file — it's the running log of verified backend facts, append to it in every phase, never assume from memory in a later phase).

### Tasks
1. `npx create-expo-app apps/mobile --template blank-typescript` from monorepo root
2. Install core deps:
   ```
   npx expo install expo-router expo-secure-store expo-constants
   npm install zustand @tanstack/react-query axios
   npm install --save-dev typescript
   ```
3. Create `apps/mobile/metro.config.js` exactly as specified in `rn_architecture.md` section 1 (workspace root resolution)
4. Add `"mobile"` awareness to root `turbo.json` if not already covered by the `apps/*` wildcard — verify, don't assume
5. Create `apps/mobile/.env.example` and `apps/mobile/.env` with:
   ```
   EXPO_PUBLIC_API_URL=<value from backend check above>
   ```
6. Create minimal `app/_layout.tsx` and `app/index.tsx` that render plain text "AjitSir Academy" — no auth, no navigation complexity yet
7. Set up `eas.json` with `development`, `preview`, `production` profiles (copy from `rn_architecture.md` section 18)
8. Run `eas build:configure`, then `eas build --platform android --profile development` to produce the first dev client APK

### Explicit non-goals for this phase
- Do not install MMKV, SQLite, react-native-pdf, or razorpay yet — those come in their respective feature phases, not upfront. Installing native modules before they're needed makes Phase 0's build harder to debug if something breaks.
- Do not write any Zustand store yet.
- Do not set up React Navigation tabs yet — that's Phase 1.

### Exit criteria (human verifies)
- [ ] `eas build --profile development` completes successfully and produces an installable APK
- [ ] APK installs on a real Android phone (not just emulator)
- [ ] App opens and shows "AjitSir Academy" placeholder text
- [ ] `apps/mobile/BACKEND_NOTES.md` exists with confirmed API base URL, health check path, and CORS confirmation

---

## Phase 1 — Network layer + Authentication

**Goal:** A user can register, log in, stay logged in across app restarts, and log out. No other features yet.

### Backend check required before starting
Read `apps/api/src/routes/auth.ts` (or equivalent) and confirm, recording in `BACKEND_NOTES.md`:
- Exact request/response shape for `POST /auth/register` and `POST /auth/login`
- Exact mechanism for refresh tokens — is it an httpOnly cookie (won't work the same way on mobile — `withCredentials` cookie jars behave differently in React Native) or a token returned in the response body? **This determines the entire refresh strategy below — do not write the refresh interceptor until this is confirmed.**
- What does the JWT payload contain (to confirm `userId` can be decoded client-side per the architecture doc's `hydrate()` function)
- Token expiry duration for access token

If the refresh token is currently httpOnly-cookie-based (likely, since that's the standard web pattern), this is a **required backend change**: add a mobile-compatible refresh flow where the refresh token is returned in the JSON response body for mobile clients to store in SecureStore, OR add a separate mobile-specific endpoint. Do not attempt to make React Native fetch/axios handle httpOnly cookies the way a browser does — it does not work reliably across Android WebView/native networking layers. Flag this to the human before proceeding if it requires backend work.

### Tasks
1. Install: `npx expo install expo-secure-store`
2. Create `apps/mobile/src/lib/secure-storage.ts` — thin wrapper around `expo-secure-store` (`getSecure`, `setSecure`, `deleteSecure`)
3. Create `apps/mobile/src/api/client.ts` — axios instance with request/response interceptors exactly as specified in `rn_architecture.md` section 4, adapted to the actual refresh mechanism confirmed above
4. Create `apps/mobile/src/store/auth-store.ts` — Zustand store per `rn_architecture.md` section 5, using AsyncStorage (not MMKV yet — see Phase 2 note on why MMKV is deferred to Phase 2, not introduced here)
5. Build screens:
   - `app/(auth)/login.tsx`
   - `app/(auth)/register.tsx`
   - `app/_layout.tsx` with auth gate (`isHydrated` check before rendering navigation, per architecture doc section 14)
6. Wire up `hydrate()` on app launch
7. Build a placeholder authenticated screen (`app/(student)/index.tsx`) showing the logged-in user's name and a logout button — this is the only screen needed to prove auth works, do not build the full dashboard yet

### Explicit non-goals for this phase
- Do not build Google Sign-In yet (defer to a later phase, it needs SHA-1 fingerprint registration which is its own checklist)
- Do not build the bottom tab navigator yet — one placeholder screen is enough to prove the auth gate works
- Do not add MMKV yet — AsyncStorage is fine for this phase's scope (just user object caching, not performance-critical yet)

### Exit criteria (human verifies)
- [ ] Register a new account from the mobile app, confirm the user appears in the Neon database
- [ ] Log out, kill the app fully (swipe away from recents), reopen — user is still logged in (proves SecureStore + hydrate works)
- [ ] Force an expired access token (or wait out the expiry) and confirm a subsequent API call triggers silent refresh without logging the user out
- [ ] Log out explicitly — confirm SecureStore is cleared (check via a second login that no stale token leaks in)
- [ ] `BACKEND_NOTES.md` updated with the confirmed refresh token mechanism and any backend changes made

---

## Phase 2 — Notes + PDF viewing (offline caching foundation)

**Goal:** Browse notes, view PDFs, with the PDF cached locally after first view. This phase is intentionally the proving ground for caching patterns reused in Phase 3.

### Backend check required before starting
Read `apps/api/src/routes/notes.ts` and confirm in `BACKEND_NOTES.md`:
- Exact response shape of `GET /notes` (list) — does it include `isPaid`, `subjectId`, file size?
- Exact endpoint and response shape for getting a signed download URL — confirm the actual URL TTL (the earlier conversation assumed 5 minutes, verify the real value in the R2 signing code, do not assume)
- Confirm whether the signed URL endpoint requires auth for both free and paid notes, or only paid ones

### Sub-phase 2a — List screen, no caching
1. Create `apps/mobile/src/api/notes.ts` — `getNotes()`, `getNoteDownloadUrl(noteId)`
2. Build `app/(student)/notes/index.tsx` — fetch via TanStack Query, render cards, lock icon on paid notes for FREE-plan users
3. No file system code yet. Tapping a note just shows a "coming soon" placeholder — this isolates "does the list and auth integration work" from "does file download work"

**Exit check:** Notes list loads, paid/free distinction renders correctly, pull-to-refresh works.

### Sub-phase 2b — PDF viewer, no cache (network every time)
1. Install: `npx expo install expo-file-system react-native-pdf react-native-blob-util`

   **Note for agent:** `react-native-pdf` requires `react-native-blob-util` as a peer dependency and BOTH require a rebuild of the dev client (native code change). Run `eas build --profile development` again after this install — the existing Phase 0/1 dev client APK will NOT have these native modules and the app will crash on launch if you just reload JS without rebuilding.
2. Build `app/(student)/notes/[id].tsx`:
   - On mount: fetch signed URL, pass directly to `<Pdf source={{ uri: signedUrl }}>` — no local download step yet
   - Show loading state while fetching
3. Confirm `react-native-pdf` renders correctly with a real R2-hosted PDF

**Exit check:** Tapping a note opens a real PDF, renders correctly, paging works. This isolates "does the native PDF module work at all" before adding caching complexity on top.

### Sub-phase 2c — Add local caching layer
1. Create `apps/mobile/src/lib/pdf-cache.ts` exactly per `rn_architecture.md` section 9 — **critical requirement: the download must be fully `await`ed, never fire-and-forget** (this is the direct fix for the web's Bug #4)
2. **Amendment to the architecture doc, apply this:** the cache key must NOT be `noteId` alone. Use `${noteId}_${updatedAt}` (or equivalent version/timestamp field from the API response) as the hash input, so that re-uploading a corrected PDF under the same note ID invalidates the old cache automatically. Confirm the notes API response includes an `updatedAt` or `version` field — if it doesn't, this is a small required backend addition (add `updatedAt` to the notes list/detail response). Flag to human if missing.
3. Update `[id].tsx` to: check cache → if miss, fetch signed URL → download (awaited) → render from local path
4. Add a visible download progress indicator using the `onProgress` callback already specified in the architecture doc

### Sub-phase 2d — Connectivity + cache edge cases
1. Install: `npx expo install @react-native-community/netinfo`
2. Create `apps/mobile/src/hooks/useOnlineStatus.ts` per `rn_architecture.md` section 6, using the confirmed `/health` path from Phase 0's backend check, **not** an assumed path
3. Test and handle explicitly:
   - Airplane mode after a note is cached → PDF still opens
   - Airplane mode before first view of a note → show a clear "no internet, can't download this note yet" message, not a silent failure
   - Background the app mid-download → on foreground, either resume or restart the download cleanly, never leave a corrupt partial file that `isCached()` incorrectly reports as valid
4. Add a "Clear downloaded notes" button in the account screen (placeholder account screen is fine — full account screen is a later phase) wired to `pdfCache.clearCache()`. This must be reachable in the UI, not just exist as a function — this was an explicit caveat we agreed needed addressing.

### Explicit non-goals for this phase
- Do not build the full account screen — just one button for cache clearing is enough
- Do not add MMKV-backed query persistence yet — defer to Phase 2.5 boundary or fold into the general persistence work if time allows, but it is not required for notes/PDF to function correctly
- Do not build search/filter on the notes list — out of scope for MVP

### Exit criteria (human verifies)
- [ ] Notes list loads with correct paid/free states
- [ ] PDF opens and renders correctly for both a small and a large PDF file
- [ ] After viewing once, airplane mode + reopening the same note still works
- [ ] A note never viewed before, opened in airplane mode, shows a clear error — not a crash or infinite spinner
- [ ] Backgrounding mid-download does not produce a corrupted cached file that silently fails later
- [ ] Cache can be cleared from the UI and re-downloads correctly afterward
- [ ] `BACKEND_NOTES.md` updated with confirmed signed URL TTL and whether `updatedAt` exists on notes (and whether it had to be added)

---

## Phase 3 — Mock test engine + offline submission queue

**Goal:** Full test-taking flow, with offline-safe submission. This is the highest-stakes phase — treat it accordingly.

### STOP — backend check required, do not skip

This is the single most important verification in the entire plan. Read the actual `apps/api/src/routes/tests.ts` attempt submission handler and confirm in `BACKEND_NOTES.md`:

1. **Does `POST /tests/:id/attempt` already accept and deduplicate on a `clientAttemptId` (or equivalent idempotency key)?**
   - If yes: confirm the exact field name and dedup behavior (does it return the existing result on a duplicate, or a 409, or silently ignore?)
   - If no: **this is a required backend change before Phase 3 client work can safely begin.** Add a `clientAttemptId` field to the request body, with a unique constraint in the database (or an in-memory/Redis dedup check if no persistent uniqueness constraint exists) such that a retried submission with the same `clientAttemptId` returns the original result instead of creating a second attempt record. This must be done and verified with a manual duplicate-request test (send the same `clientAttemptId` twice via curl/Postman, confirm only one row is created) before any mobile offline-queue code is written against it.
2. Confirm the exact response shape of a successful attempt submission (does it return score immediately, or just an attempt ID requiring a follow-up fetch for the graded result?)
3. Confirm what `GET /tests/:id` returns — specifically confirm it does NOT include `correctOption` in the question payload (security check, not just a shape check)
4. Confirm whether mock test questions/answers branch (mentioned as not-yet-merged-to-main in earlier context) has landed by the time this phase starts. If it has, re-verify all of the above against the now-current main branch, do not rely on this document's earlier assumptions.

### Sub-phase 3a — Test list + test detail fetch (no submission yet)
1. Create `apps/mobile/src/api/tests.ts` — `getTests()`, `getTestById(id)`
2. Build `app/(student)/tests/index.tsx` — list screen, same pattern as notes list
3. Build the question-loading half of `app/(student)/tests/[id].tsx` — fetch and render questions, MCQ options, navigation between questions, question palette. No timer, no submit button wired yet.

**Exit check:** A test's questions render correctly, answer selection updates local state, navigating between questions preserves answers.

### Sub-phase 3b — Timer + submission (online only first)
1. Create `apps/mobile/src/store/test-session-store.ts` per `rn_architecture.md` section 12 — all hooks at the top of the component, explicit loading/error exits, exactly as specified (this is the direct fix for the web's hooks-order and infinite-skeleton bugs)
2. Add the countdown timer using `AppState` tracking for backgrounding (per the earlier plan's note — track `backgroundedAt`, subtract elapsed time on foreground, do not let backgrounding pause the timer)
3. Wire submit to call `POST /tests/:id/attempt` directly (online-only for now, no offline queue yet) using the confirmed `clientAttemptId` field from the backend check above — **even in this online-only sub-phase, generate and send `clientAttemptId` from day one**, so the offline queue in 3c is a pure addition, not a retrofit
4. Build the result screen showing score and per-question breakdown

**Exit check:** Full test flow works online: take test, timer counts down correctly, backgrounding the app doesn't lose time, submit shows correct results, results match what the backend actually graded (cross-check a known set of answers manually).

### Sub-phase 3c — Offline queue
1. Install: `npx expo install expo-sqlite`
2. Create `apps/mobile/src/lib/offline-queue.ts` exactly per `rn_architecture.md` section 8 — SQLite schema with `user_id` column, `clientAttemptId` UNIQUE constraint, `clearForUser()` wired into logout
3. Create `apps/mobile/src/hooks/useOfflineQueueFlusher.ts` per the same section — **critical logic to preserve exactly as specified: only `ERR_NETWORK` / `ECONNABORTED` errors trigger queueing; any 4xx/5xx response means do NOT queue, surface the error instead.** This distinction is the single most important piece of logic in this phase — verify it with explicit test cases below, not just by reading the code.
4. Wire the flusher into the authenticated layout (starts when user is logged in, per `rn_architecture.md` section 11)

### Explicit non-goals for this phase
- Do not build a leaderboard or analytics on top of test results — out of scope
- Do not attempt to let students review/edit answers after submission — out of scope for MVP
- Do not build admin-side test creation in the mobile app — that stays web-only

### Exit criteria (human verifies) — test each scenario explicitly, do not just code-review
- [ ] Online: full test flow works, results are accurate
- [ ] Backend duplicate-submission test passed (same `clientAttemptId` sent twice via curl returns the same result, only one DB row)
- [ ] Airplane mode during submission → attempt is queued, user sees a clear "saved, will submit when online" message, NOT an error
- [ ] Re-enable network → queued attempt auto-submits within the flush interval, user's result becomes available
- [ ] Simulate a 403 (e.g. expired token edge case or a deliberately invalid test ID) during submission → confirm this does NOT get queued, user sees an actual error
- [ ] Two different user accounts on the same physical device (login as A, queue an offline attempt, log out, log in as B) → B never sees A's queued attempt, and it doesn't fire under B's session
- [ ] Force-kill the app with a pending queued attempt, reopen, reconnect → queued attempt still flushes correctly (proves SQLite persistence survives app kill, not just backgrounding)

---

## Phase 4 — Payments

**Goal:** Razorpay checkout that reliably reflects in the user's plan status, with mobile-specific failure modes explicitly handled.

### STOP — backend check required, do not skip

Read the actual `apps/api/src/routes/payments.ts` webhook and verify handler. Confirm in `BACKEND_NOTES.md`:

1. **Does the webhook handler independently flip `plan` to `PAID` in the database, or does only the client-initiated `/verify` route do this?** This is the most important fact in this phase, established in the earlier architecture discussion. If only `/verify` does it (client-dependent), this is a required backend change: the webhook must independently update plan status on a successful Razorpay payment event, regardless of whether the client ever calls verify. Mobile clients have a meaningfully higher chance of being killed mid-flow than web tabs — without this, "charged but never verified" becomes a real, recurring support burden in production, not a theoretical edge case.
2. Confirm exact request/response shape of `POST /payments/create-order` and `POST /payments/verify`
3. Confirm whether there's an existing endpoint to check "do I have a pending/recent payment that hasn't reflected in my plan yet" — if not, and if the webhook fix above is implemented, `GET /auth/me` returning the current accurate plan status after a `refreshUser()` call is sufficient reconciliation and no new endpoint is needed
4. Confirm the Razorpay key_id source — is it returned from `create-order`, or is it a separate public env var the mobile app needs bundled at build time? Get the actual production key_id and confirm it's different from any test/sandbox key currently used in web dev

### Tasks
1. Install: `npm install react-native-razorpay`

   **Note for agent:** Like Phase 2's PDF module, this is a native module requiring a dev client rebuild — `eas build --profile development` again after this install.
2. Register SHA-1 fingerprints with Razorpay for BOTH the development/debug build and the eventual production/release build. Get the debug SHA-1 via `eas credentials` (development profile) and add it to Razorpay dashboard alongside the existing web key config. The production SHA-1 won't exist until Phase 5's release build is generated — flag this as a Phase 5 dependency, do not block Phase 4 development on it, but do not consider Phase 4 fully done until the production fingerprint is also registered.
3. Create `apps/mobile/src/api/payments.ts` — `createOrder()`, `verifyPayment()`
4. Create `apps/mobile/src/features/payment/hooks/useCheckout.ts` per `rn_architecture.md` section 10, with this amendment:
   - If `RazorpayCheckout.open()` resolves successfully but the subsequent `verifyPayment()` call throws a network error (not a 4xx — distinguish exactly like the offline queue does in Phase 3), do NOT show a generic failure message. Show "Payment received — confirming your upgrade" and retry the verify call up to 3 times with exponential backoff before falling back to "we're confirming your payment, check back in a minute" rather than implying failure.
   - On `refreshUser()` after successful verify, also invalidate the relevant TanStack Query caches for any paid-content screens (notes list, tests list) so locked content unlocks immediately without requiring app restart.
5. Build `app/(student)/payment/plans.tsx` and a success/pending state screen
6. Wire the "Upgrade" prompt into the notes and tests screens for FREE-plan users tapping locked content (a bottom sheet or simple navigation to the plans screen is sufficient — do not over-design this)

### Explicit non-goals for this phase
- Do not build multiple plan tiers/discount codes unless the backend already supports this — match existing backend capability exactly, do not add client-side logic for pricing the backend doesn't support
- Do not store any payment/card data client-side ever, in any form — this should be obvious but stating it explicitly for the agent
- Do not build a payment history screen in this phase — account screen enhancements are a later phase if needed

### Exit criteria (human verifies)
- [ ] Backend webhook independently updates plan status, confirmed by testing a payment and checking the DB before the client's verify call could possibly have completed (or by temporarily disabling the client verify call in a test build and confirming the webhook alone still updates the plan)
- [ ] Full payment flow on a development build: tap upgrade, complete Razorpay checkout, plan updates, locked content unlocks immediately without app restart
- [ ] Cancel mid-checkout (back button or close the Razorpay sheet) → app returns to a sane state, no partial/broken UI, user can retry cleanly
- [ ] Force-kill the app immediately after completing payment in the Razorpay sheet but before returning to the app → reopen the app, confirm `refreshUser()` on next launch correctly reflects the upgraded plan (this proves the webhook-independent-of-client-verify fix works)
- [ ] SHA-1 fingerprint for the debug build is registered and payments work on a real device using the development build, not just Expo Go simulation claims (Expo Go can't test this at all — must be a dev client build)
- [ ] `BACKEND_NOTES.md` updated confirming the webhook fix was implemented and tested

---

## Phase 5 — Polish, error handling, and release

**Goal:** Production-ready build submitted to Play Store.

### Tasks
1. Add the 3-level error boundary system per `rn_architecture.md` section 13
2. Add explicit loading/error/empty states to every screen built in Phases 1–4 — audit each screen against this checklist, do not assume earlier phases already handled this comprehensively
3. Build out the full account screen: profile info, plan status + expiry, attempt history summary, logout, clear cache (already exists from Phase 2, just relocate if needed)
4. Build the bottom tab navigator (Home / Notes / Tests / Account) — this was deferred from Phase 1's single placeholder screen, build it properly now that all four destination screens exist
5. App icon, splash screen, `app.json` branding per the earlier plan's spec
6. Run `eas build --platform android --profile production` — generates the production-signed AAB
7. Get the production SHA-1 fingerprint from this build, register it with Razorpay (completing Phase 4's deferred requirement)
8. Re-run Phase 4's full payment exit checklist against this production build specifically — debug-build success does not guarantee production-build success given the separate fingerprint
9. Play Store Console setup: developer account, store listing assets, content rating, submit to Internal Testing track first

### Explicit non-goals for this phase
- Do not add push notifications, analytics, or live classes — these are explicitly future-phase per the architecture doc's "future feature readiness" section, not MVP scope
- Do not add certificate pinning or root detection in this phase — these are correctly deferred per the architecture doc's security checklist, revisit only after MVP ships and has real users
- Do not add Google Sign-In in this phase unless it was already a hard requirement — if email/password auth from Phase 1 is sufficient for launch, ship without it and add later

### Exit criteria (human verifies)
- [ ] Every screen has been manually tested for: slow network (throttle to 3G), no network, and a backend 500 error — confirm no screen shows an infinite spinner or white screen in any of these states
- [ ] Production AAB builds successfully via EAS
- [ ] Payment flow re-verified end to end on the production build specifically
- [ ] App submitted to Play Store Internal Testing track and installable via the testing link
- [ ] `BACKEND_NOTES.md` is complete and could be handed to a new developer as an accurate reference of the mobile-relevant backend contract

---

## Cross-cutting rules for every phase (agent: re-read before starting each phase)

- **Never assume an API response shape.** Always verify against the actual route handler code, not the README, not an earlier phase's notes if the backend has changed since.
- **Never queue a failed request unless it's a true network failure** (`ERR_NETWORK`, `ECONNABORTED`, or equivalent timeout). A 4xx/5xx is a real error and must surface as one.
- **Every async operation that writes to disk or cache must be fully awaited** — no fire-and-forget, anywhere, in any phase.
- **All hooks go at the top of every component, unconditionally** — no hooks inside `if` blocks or after early returns.
- **Every loading state must have an explicit error exit** — `isLoading` checks must be paired with `isError` checks, never just a bare loading spinner with no failure path.
- **All persisted local data (SQLite, MMKV, AsyncStorage user caches) must be scoped by `userId` and cleared on logout** — test this explicitly with a two-account test on the same device in any phase that adds new persisted data.
- **A native module install (anything not pure JS) requires a dev client rebuild** before it can be tested — reloading JS alone will crash the app. Flag this every time it applies, don't assume the agent executing the next phase remembers.
- **When in doubt about a backend behavior, stop and ask rather than guessing** — guessing produces code that looks correct, passes a cursory review, and fails in production in a way that's expensive to trace back to a wrong assumption made three phases earlier.