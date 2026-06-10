// AjitSir Academy — Minimal Service Worker
// Version: bump SHELL_VERSION when deploying new Next.js build to force cache refresh
const SHELL_VERSION = 'v3';
const SHELL_CACHE = `ajitsir-shell-${SHELL_VERSION}`;
const THUMB_CACHE = 'ajitsir-thumbs-v1';
const OFFLINE_CACHE = 'ajitsir-offline-v1';

// ─── Routes that must NEVER be served from cache ─────────────────────────────
// These are security-critical: auth, payments, premium PDF bytes, and admin data.
const NETWORK_ONLY_PATTERNS = [
  /\/api\/auth\//,
  /\/api\/notes\/[^/]+\/stream/,   // PDF bytes — server enforces paid plan check
  /\/api\/payments\//,
  /\/api\/razorpay\//,
  /\/api\/support\//,
  /\/api\/admin\//,
];

// ─── App shell pages to pre-cache on install ─────────────────────────────────
const SHELL_PAGES = ['/', '/notes', '/plans', '/account', '/help', '/offline.html'];

// ─── Install: cache offline fallback and shell pages immediately ───────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    Promise.all([
      caches.open(OFFLINE_CACHE).then((cache) => cache.add('/offline.html')),
      caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_PAGES))
    ])
  );
  // Take control immediately — don't wait for old SW to die
  self.skipWaiting();
});

// ─── Activate: wipe outdated shell caches ─────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          // Delete old shell caches (different version) but keep thumbs + offline
          if (key.startsWith('ajitsir-shell-') && key !== SHELL_CACHE) {
            return caches.delete(key);
          }
        })
      )
    ).then(() => self.clients.claim()) // take control of all open tabs
  );
});

// ─── Fetch: intercept all requests ────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin requests AND allowed CDNs
  const isSameOrigin = url.origin === self.location.origin;
  const isUnpkg = url.hostname === 'unpkg.com';
  
  if (!isSameOrigin && !isUnpkg) return;

  const pathname = url.pathname;

  // 0. CDN Assets (like pdf.worker.min.mjs) — Cache-First
  if (isUnpkg) {
    event.respondWith(cacheFirst(request, SHELL_CACHE));
    return;
  }

  // 1. NetworkOnly — security-critical routes, never touch cache
  if (NETWORK_ONLY_PATTERNS.some((pattern) => pattern.test(pathname))) {
    // Pass through unchanged — SW has zero involvement
    return;
  }

  // 2. Thumbnails — NetworkFirst with long-lived cache fallback
  if (pathname.match(/\/api\/notes\/[^/]+\/thumbnail/)) {
    event.respondWith(networkFirstWithCache(request, THUMB_CACHE, 30 * 24 * 60 * 60));
    return;
  }

  // 3. Next.js static assets — Cache-First (immutable, versioned by Next.js hash)
  if (pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(request, SHELL_CACHE));
    return;
  }

  // 4. App shell pages — NetworkFirst, fall back to cache, then offline.html
  if (request.mode === 'navigate') {
    event.respondWith(navigationHandler(request));
    return;
  }

  // 5. Everything else (other API endpoints, fonts, etc.) — network only
  // Do not intercept — let the browser handle normally
});

// ─── Strategy: Cache-First ─────────────────────────────────────────────────────
// Used for Next.js static assets (/_next/static/) — these are content-hash named
// so they are safe to serve from cache indefinitely.
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) {
    cache.put(request, response.clone()); // fire-and-forget
  }
  return response;
}

// ─── Strategy: NetworkFirst with cache fallback ────────────────────────────────
// Used for thumbnails — prefer fresh network, fall back to cache if offline.
// maxAgeSeconds: stored entries older than this are considered stale and refreshed.
async function networkFirstWithCache(request, cacheName, maxAgeSeconds) {
  const cache = await caches.open(cacheName);

  try {
    const response = await fetch(request);
    if (response.ok) {
      // Store with a timestamp header so we can check age later
      const responseToCache = response.clone();
      const headers = new Headers(responseToCache.headers);
      headers.set('sw-cached-at', Date.now().toString());

      const modifiedResponse = new Response(await responseToCache.blob(), {
        status: responseToCache.status,
        statusText: responseToCache.statusText,
        headers,
      });
      cache.put(request, modifiedResponse); // fire-and-forget
    }
    return response;
  } catch {
    // Offline — try cache
    const cached = await cache.match(request);
    if (cached) {
      const cachedAt = parseInt(cached.headers.get('sw-cached-at') || '0');
      const ageSeconds = (Date.now() - cachedAt) / 1000;
      if (ageSeconds < maxAgeSeconds) return cached;
    }
    // No cache or stale — return a 503 so the img onError handler fires
    return new Response('Offline', { status: 503 });
  }
}

// ─── Strategy: Navigation handler ─────────────────────────────────────────────
// For page navigations: try network, fall back to cached page, then offline.html.
async function navigationHandler(request) {
  const cache = await caches.open(SHELL_CACHE);

  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone()); // update shell cache while online
    }
    return response;
  } catch {
    // Offline — try exact URL match first
    const cachedPage = await cache.match(request);
    if (cachedPage) return cachedPage;

    // Do NOT fall back to `/` (Home) because Next.js HTML is route-specific.
    // Serving home HTML for `/notes` causes hydration bugs.
    // Instead, fall back to the dedicated offline page.
    const offline = await caches.match('/offline.html');
    return offline || new Response('You are offline', {
      status: 503,
      headers: { 'Content-Type': 'text/plain' },
    });
  }
}
