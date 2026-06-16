/**
 * test-results-db.ts
 *
 * IndexedDB storage for two purposes:
 *   1. `results` store  — caches AttemptResult objects so the Result page
 *      works instantly without a network round-trip (IDB-first, API fallback).
 *   2. `pending-attempts` store — queues answers that could not be submitted
 *      because the device was offline. Replaced the fragile
 *      `localStorage.filter(k => k.startsWith('pending-attempt-'))` pattern
 *      which breaks when localStorage.clear() is called on logout.
 *
 * Design constraints for ₹8,000 Android WebViews:
 *  - Results are capped at 200 entries (LRU eviction) and 50 KB per entry.
 *
 * FIX (HIGH): pending-attempts are now user-scoped.
 *  - PendingAttempt stores userId so flushPendingAttempts only processes
 *    attempts belonging to the currently logged-in user.
 *  - clearPendingForUser() is called on logout so orphaned queued attempts
 *    from the previous user do not survive to the next login.
 */
import { openDB, type IDBPDatabase } from 'idb';
import type { AttemptResult } from '@ajitsir/shared';

// ─── DB constants ─────────────────────────────────────────────────────────────
const DB_NAME         = 'ajitsir-test-results';
const DB_VER          = 2;  // bumped: adds userId index on pending-attempts store
const RESULTS_STORE   = 'results';
const PENDING_STORE   = 'pending-attempts';
const MAX_RESULTS     = 200;
const MAX_BYTES       = 50_000; // skip entries > 50 KB — prevents OOM on low-RAM devices

// ─── Stored shape ────────────────────────────────────────────────────────────

/** What goes into the `results` IDB store. */
export interface StoredResult {
  id:         string;  // server-assigned attempt ID
  testId:     string;
  testTitle:  string;
  subjectId:  string;
  result:     AttemptResult;
  savedAt:    number;  // Date.now() — used for LRU eviction
  userId:     string;  // owner — used to clear on logout
}

/** What goes into the `pending-attempts` IDB store. */
export interface PendingAttempt {
  /** Local UUID — NOT the server attempt ID (assigned later). */
  id:               string;
  userId:           string;  // FIX: scope to user so flush only sends their attempts
  clientAttemptId:  string;  // FIX: carry the idempotency key so retries deduplicate
  testId:           string;
  answers:          Record<string, string>;
  timeTaken:        number | null;
  queuedAt:         number;  // Date.now()
}

// ─── DB singleton ─────────────────────────────────────────────────────────────
let _db: IDBPDatabase | null = null;

async function getDB(): Promise<IDBPDatabase> {
  if (!_db) {
    _db = await openDB(DB_NAME, DB_VER, {
      upgrade(db, oldVersion, _newVersion, tx) {
        // results store — keyed by attempt ID
        if (!db.objectStoreNames.contains(RESULTS_STORE)) {
          const rs = db.createObjectStore(RESULTS_STORE, { keyPath: 'id' });
          rs.createIndex('by_testId',  'testId');    // getResultsByTest()
          rs.createIndex('by_savedAt', 'savedAt');   // LRU eviction sort
          rs.createIndex('by_subject', 'subjectId'); // future subject history
          rs.createIndex('by_userId',  'userId');    // clearResultsForUser()
        }

        // pending-attempts store — keyed by local UUID
        if (!db.objectStoreNames.contains(PENDING_STORE)) {
          const ps = db.createObjectStore(PENDING_STORE, { keyPath: 'id' });
          // FIX: index by userId so we can flush/clear per-user
          ps.createIndex('by_userId', 'userId');
        } else if (oldVersion < 2) {
          // Upgrade path: v1 store exists but has no userId index — add it.
          // The upgrade transaction gives access to existing stores.
          const ps = tx.objectStore(PENDING_STORE);
          if (!ps.indexNames.contains('by_userId')) {
            ps.createIndex('by_userId', 'userId');
          }
        }
      },
    });
  }
  return _db;
}

// ─── Results store ────────────────────────────────────────────────────────────

/**
 * Saves an AttemptResult to IDB.
 * Silently skips if the serialised result exceeds MAX_BYTES.
 * Evicts the oldest entries if the store grows past MAX_RESULTS.
 */
export async function saveResult(stored: Omit<StoredResult, 'savedAt'>): Promise<void> {
  const entry: StoredResult = { ...stored, savedAt: Date.now() };
  const blob = JSON.stringify(entry);

  if (blob.length > MAX_BYTES) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[IDB] Result too large, skipping:', blob.length, 'bytes');
    }
    return;
  }

  const db = await getDB();
  await db.put(RESULTS_STORE, entry);

  // LRU eviction: keep at most MAX_RESULTS entries
  const allKeys = await db.getAllKeys(RESULTS_STORE);
  if (allKeys.length > MAX_RESULTS) {
    const withDates: { k: IDBValidKey; t: number }[] = await Promise.all(
      allKeys.map(async (k) => {
        const row = await db.get(RESULTS_STORE, k) as StoredResult;
        return { k, t: row.savedAt };
      })
    );
    // Sort oldest-first, evict the surplus
    withDates.sort((a, b) => a.t - b.t);
    const toEvict = withDates.slice(0, allKeys.length - MAX_RESULTS);
    const tx = db.transaction(RESULTS_STORE, 'readwrite');
    await Promise.all(toEvict.map(({ k }) => tx.store.delete(k)));
    await tx.done;
  }
}

/** Returns all stored results for a given test (most recent first). */
export async function getResultsByTest(testId: string): Promise<StoredResult[]> {
  const db = await getDB();
  const rows = await db.getAllFromIndex(RESULTS_STORE, 'by_testId', testId);
  return rows.sort((a, b) => b.savedAt - a.savedAt);
}

/** Returns all stored results across all tests. */
export async function getAllResults(): Promise<StoredResult[]> {
  const db = await getDB();
  return db.getAll(RESULTS_STORE);
}

/**
 * Clears results belonging to a specific user.
 * Called on logout to prevent cross-user leakage on shared devices.
 *
 * FIX: replaces clearResults() (which cleared ALL results regardless of owner).
 */
export async function clearResultsForUser(userId: string): Promise<void> {
  const db = await getDB();
  const rows = await db.getAllFromIndex(RESULTS_STORE, 'by_userId', userId);
  const tx = db.transaction(RESULTS_STORE, 'readwrite');
  await Promise.all(rows.map((r) => tx.store.delete(r.id)));
  await tx.done;
}

/**
 * @deprecated Use clearResultsForUser(userId) instead.
 * Kept for backwards compatibility — clears ALL results (original behaviour).
 */
export async function clearResults(): Promise<void> {
  const db = await getDB();
  await db.clear(RESULTS_STORE);
}

// ─── Pending-attempts store ───────────────────────────────────────────────────

/**
 * Enqueues an attempt that could not be submitted because the device was offline.
 * The runner calls this instead of showing a generic error, then
 * useOnlineStatus calls flushPendingAttempts() when connectivity returns.
 */
export async function queuePendingAttempt(attempt: PendingAttempt): Promise<void> {
  const db = await getDB();
  await db.put(PENDING_STORE, attempt);
}

/**
 * Returns all queued pending attempts for a specific user.
 * FIX: was getAllPending() with no user filter — now scoped by userId.
 */
export async function getPendingForUser(userId: string): Promise<PendingAttempt[]> {
  const db = await getDB();
  return db.getAllFromIndex(PENDING_STORE, 'by_userId', userId);
}

/**
 * @deprecated Use getPendingForUser(userId) instead.
 * Kept for flush-on-login code that already has the userId from auth store.
 */
export async function getAllPending(): Promise<PendingAttempt[]> {
  const db = await getDB();
  return db.getAll(PENDING_STORE);
}

/**
 * Deletes a single pending attempt by its local ID.
 * IMPORTANT: call this BEFORE the POST, not after — prevents double-submit
 * even if the POST hangs and the user kills the page mid-flight.
 */
export async function deletePending(id: string): Promise<void> {
  const db = await getDB();
  await db.delete(PENDING_STORE, id);
}

/**
 * Clears all pending attempts for a specific user.
 * FIX (HIGH): called on logout so a previous user's offline submissions are not
 * flushed under the next user's JWT.
 */
export async function clearPendingForUser(userId: string): Promise<void> {
  const db = await getDB();
  const rows = await db.getAllFromIndex(PENDING_STORE, 'by_userId', userId);
  const tx = db.transaction(PENDING_STORE, 'readwrite');
  await Promise.all(rows.map((r) => tx.store.delete(r.id)));
  await tx.done;
}
