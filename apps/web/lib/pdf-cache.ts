/**
 * pdf-cache.ts
 *
 * IndexedDB-backed cache for PDF binaries.
 * - TTL: 30 days from last read
 * - Storage cap: 600 MB (LRU eviction when exceeded)
 * - Completely transparent: any IndexedDB error silently falls back to a fresh download
 */

const DB_NAME = 'AjitSirPdfCache';
const DB_VERSION = 1;
const STORE_NAME = 'pdfs';

/** 30 days in milliseconds */
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** 600 MB in bytes */
const MAX_BYTES = 600 * 1024 * 1024;

interface CacheEntry {
  noteId: string;
  data: Uint8Array;
  cachedAt: number;
  lastRead: number;
  sizeBytes: number;
}

// ─── Singleton DB connection ───────────────────────────────────────────────────

let _dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (_dbPromise) return _dbPromise;

  _dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'noteId' });
        store.createIndex('lastRead', 'lastRead', { unique: false });
      }
    };

    request.onsuccess = (event) => resolve((event.target as IDBOpenDBRequest).result);
    request.onerror  = (event) => reject((event.target as IDBOpenDBRequest).error);
  });

  return _dbPromise;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function idbGet(db: IDBDatabase, noteId: string): Promise<CacheEntry | undefined> {
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req   = store.get(noteId);
    req.onsuccess = () => resolve(req.result as CacheEntry | undefined);
    req.onerror   = () => reject(req.error);
  });
}

function idbPut(db: IDBDatabase, entry: CacheEntry): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req   = store.put(entry);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

function idbDelete(db: IDBDatabase, noteId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req   = store.delete(noteId);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

function idbGetAll(db: IDBDatabase): Promise<CacheEntry[]> {
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req   = store.getAll();
    req.onsuccess = () => resolve(req.result as CacheEntry[]);
    req.onerror   = () => reject(req.error);
  });
}

function idbClearAll(db: IDBDatabase): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req   = store.clear();
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

// ─── Eviction — remove expired entries first, then LRU until under cap ────────

async function evict(db: IDBDatabase, incomingSizeBytes: number): Promise<void> {
  const now     = Date.now();
  let   entries = await idbGetAll(db);

  // 1. Delete expired entries (older than TTL from last read)
  const expired = entries.filter((e) => now - e.lastRead > TTL_MS);
  for (const e of expired) {
    await idbDelete(db, e.noteId);
  }

  // Re-read remaining after deletions
  entries = await idbGetAll(db);

  // 2. If still over cap, evict LRU (sort by lastRead ascending = oldest first)
  let totalUsed = entries.reduce((sum, e) => sum + e.sizeBytes, 0);
  if (totalUsed + incomingSizeBytes <= MAX_BYTES) return;

  entries.sort((a, b) => a.lastRead - b.lastRead);
  for (const e of entries) {
    if (totalUsed + incomingSizeBytes <= MAX_BYTES) break;
    await idbDelete(db, e.noteId);
    totalUsed -= e.sizeBytes;
  }
}

// ─── Public API ────────────────────────────────────────────────────────────────

const pdfCache = {
  /**
   * Returns cached PDF bytes for a note, or null on a cache miss / expired entry.
   * Also silently updates `lastRead` to keep the entry alive.
   */
  async get(noteId: string): Promise<Uint8Array | null> {
    if (typeof window === 'undefined') return null;
    try {
      const db    = await openDb();
      const entry = await idbGet(db, noteId);

      if (!entry) return null;

      // Check TTL
      if (Date.now() - entry.lastRead > TTL_MS) {
        await idbDelete(db, noteId);
        return null;
      }

      // Refresh lastRead so actively used entries don't expire
      await idbPut(db, { ...entry, lastRead: Date.now() });

      return entry.data;
    } catch {
      // IndexedDB unavailable (private mode, storage quota denied, etc.) — silent fallback
      return null;
    }
  },

  /**
   * Stores PDF bytes in IndexedDB.
   * Runs eviction first to respect the 600 MB cap.
   */
  async set(noteId: string, data: Uint8Array): Promise<void> {
    if (typeof window === 'undefined') return;
    try {
      const db   = await openDb();
      const now  = Date.now();

      // Don't cache files that would individually exceed the cap
      if (data.byteLength > MAX_BYTES) return;

      await evict(db, data.byteLength);

      const entry: CacheEntry = {
        noteId,
        data,
        cachedAt:  now,
        lastRead:  now,
        sizeBytes: data.byteLength,
      };

      await idbPut(db, entry);
    } catch {
      // Eviction or write failure — silently ignore
    }
  },

  /**
   * Force-removes a specific note from cache (e.g. after admin re-uploads).
   */
  async invalidate(noteId: string): Promise<void> {
    if (typeof window === 'undefined') return;
    try {
      const db = await openDb();
      await idbDelete(db, noteId);
    } catch {
      // Ignore
    }
  },

  /**
   * Wipes all cached PDFs — called on logout to protect shared devices.
   */
  async clearAll(): Promise<void> {
    if (typeof window === 'undefined') return;
    try {
      const db = await openDb();
      await idbClearAll(db);
    } catch {
      // Ignore
    }
  },
};

export default pdfCache;
