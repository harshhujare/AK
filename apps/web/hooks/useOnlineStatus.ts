'use client';

import { useState, useEffect, useCallback } from 'react';

// How long to wait for the probe response before treating as offline (ms)
const PROBE_TIMEOUT_MS = 5000;

// Minimum gap between back-to-back probes (ms) — avoids hammering on flaky links
const PROBE_DEBOUNCE_MS = 3000;

/**
 * Probes real connectivity by fetching a tiny, no-cache endpoint.
 *
 * Why not navigator.onLine?
 * On Android/Chrome in PWA or on mobile data, navigator.onLine only reflects
 * whether the OS has a radio link — it does NOT verify actual internet reachability.
 * The browser can also fire the "offline" event and then never fire "online" again
 * even after the connection recovers, leaving navigator.onLine stale-false for the
 * entire session. A real HTTP probe is the only reliable cross-platform check.
 */
async function probeConnectivity(): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);

  try {
    // Fetch the SW itself — it's a small, same-origin file that always exists.
    // cache: 'no-store' forces a real network round-trip even if SW intercepts it.
    const res = await fetch('/sw.js', {
      method: 'HEAD',
      cache: 'no-store',
      signal: controller.signal,
    });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Reactive online/offline status backed by a real HTTP connectivity probe.
 *
 * - Initialises to true (optimistic) to avoid a flash-of-offline on load.
 * - On mount, immediately runs a probe to correct the initial state.
 * - Re-probes whenever the browser fires "online" or "offline" events.
 * - Debounces rapid consecutive probes (e.g. network handover on mobile).
 */
export function useOnlineStatus(): boolean {
  // Start optimistic — avoids incorrectly blocking the UI on first render.
  // The mount-time probe corrects this within milliseconds.
  const [isOnline, setIsOnline] = useState(true);

  const runProbe = useCallback(async () => {
    const result = await probeConnectivity();
    setIsOnline(result);
  }, []);

  useEffect(() => {
    // Probe immediately on mount so the initial state is accurate
    runProbe();

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const scheduleProbe = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(runProbe, PROBE_DEBOUNCE_MS);
    };

    // When the browser fires "online" don't trust it blindly — probe first.
    // When the browser fires "offline" we can trust it immediately (the OS
    // is certain there's no link), but we still probe to be sure.
    window.addEventListener('online', scheduleProbe);
    window.addEventListener('offline', scheduleProbe);

    return () => {
      window.removeEventListener('online', scheduleProbe);
      window.removeEventListener('offline', scheduleProbe);
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  }, [runProbe]);

  return isOnline;
}
