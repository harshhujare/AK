'use client';

// ─── IndexedDB PDF Cache ────────────────────────────────────────────────────
// Stores raw PDF bytes keyed by noteId.
// Schema per entry:
//   { noteId(keyPath), data: Uint8Array, updatedAt: string, sizeBytes: number, lastRead: number }
//
// Eviction policy:
//   - No TTL — cache persists until the user logs out.
//   - Storage cap: 600 MB. Evicts least-recently-used entries when exceeded.
//
// Security note:
//   Raw bytes live on disk in the user's IndexedDB. A DevTools-savvy user
//   could extract them. Watermarks are still applied at render time.
//   This mirrors how Scribd / Coursera handle premium content caching.

const DB_NAME = 'AjitSirPdfCache';
const DB_VERSION = 2; // bump from 1 → 2 to trigger onupgradeneeded with new schema
const STORE_NAME = 'pdfs';
const STORAGE_CAP_BYTES = 600 * 1024 * 1024; // 600 MB

// ─── Open / upgrade DB ────────────────────────────────────────────────────────
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Drop old store if it exists (migration from v1)
      if (db.objectStoreNames.contains(STORE_NAME)) {
        db.deleteObjectStore(STORE_NAME);
      }

      // Create with keyPath so IDB manages the primary key
      const store = db.createObjectStore(STORE_NAME, { keyPath: 'noteId' });
      // Index for LRU eviction — sort by lastRead ascending
      store.createIndex('lastRead', 'lastRead', { unique: false });
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns cached PDF bytes if present and matching updatedAt, otherwise null.
 * Also updates `lastRead` timestamp (LRU bookkeeping).
 */
export async function pdfCacheGet(noteId: string, updatedAt: string): Promise<Uint8Array | null> {
  try {
    const db = await openDB();
    const entry = await idbGet<PdfCacheEntry>(db, noteId);

    if (!entry) return null;

    // Invalidate if the note was updated since we cached it
    if (entry.updatedAt !== updatedAt) {
      // Async delete stale entry — fire-and-forget
      idbDelete(db, noteId).catch(() => {});
      return null;
    }

    // Update lastRead (LRU bookkeeping) — fire-and-forget
    idbPut(db, { ...entry, lastRead: Date.now() }).catch(() => {});

    return entry.data;
  } catch {
    return null;
  }
}

/**
 * Stores PDF bytes in IndexedDB.
 * Evicts least-recently-used entries if total size would exceed 600 MB.
 */
export async function pdfCacheSet(noteId: string, data: Uint8Array, updatedAt: string): Promise<void> {
  try {
    const db = await openDB();
    const sizeBytes = data.byteLength;

    // Evict LRU entries until we have room
    await evictIfNeeded(db, sizeBytes);

    const entry: PdfCacheEntry = {
      noteId,
      data,
      updatedAt,
      sizeBytes,
      lastRead: Date.now(),
    };

    await idbPut(db, entry);
  } catch {
    // Storage full or IDB unavailable — silently continue without caching
  }
}

/**
 * Removes a single note's cache entry (e.g., after admin re-upload).
 */
export async function pdfCacheInvalidate(noteId: string): Promise<void> {
  try {
    const db = await openDB();
    await idbDelete(db, noteId);
  } catch {
    // ignore
  }
}

/**
 * Wipes ALL cached PDFs. Called on logout to protect shared devices.
 */
export async function pdfCacheClearAll(): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const request = tx.objectStore(STORE_NAME).clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch {
    // ignore
  }
}

// ─── Internal types ───────────────────────────────────────────────────────────

interface PdfCacheEntry {
  noteId: string;
  data: Uint8Array;
  updatedAt: string;
  sizeBytes: number;
  lastRead: number;
}

// ─── Internal IDB helpers ─────────────────────────────────────────────────────

function idbGet<T>(db: IDBDatabase, key: string): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).get(key);
    request.onsuccess = () => resolve(request.result as T | undefined);
    request.onerror = () => reject(request.error);
  });
}

function idbPut(db: IDBDatabase, value: PdfCacheEntry): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const request = tx.objectStore(STORE_NAME).put(value);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function idbDelete(db: IDBDatabase, key: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const request = tx.objectStore(STORE_NAME).delete(key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// ─── LRU Eviction ─────────────────────────────────────────────────────────────

async function evictIfNeeded(db: IDBDatabase, incomingSizeBytes: number): Promise<void> {
  // Read all entries sorted by lastRead ascending (oldest first)
  const allEntries = await new Promise<PdfCacheEntry[]>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const index = tx.objectStore(STORE_NAME).index('lastRead');
    const request = index.getAll();
    request.onsuccess = () => resolve(request.result as PdfCacheEntry[]);
    request.onerror = () => reject(request.error);
  });

  const totalCurrentBytes = allEntries.reduce((sum, e) => sum + e.sizeBytes, 0);

  if (totalCurrentBytes + incomingSizeBytes <= STORAGE_CAP_BYTES) return;

  // Delete LRU entries until we have room
  let freed = 0;
  const needed = (totalCurrentBytes + incomingSizeBytes) - STORAGE_CAP_BYTES;

  for (const entry of allEntries) {
    if (freed >= needed) break;
    await idbDelete(db, entry.noteId);
    freed += entry.sizeBytes;
  }
}
