'use client';
/**
 * useOnlineStatus.ts
 *
 * Returns the real network connectivity status — not just navigator.onLine.
 * navigator.onLine returns true even on captive portals and Wi-Fi with no
 * internet. We probe /api/ping with a HEAD request to get a real answer.
 *
 * When connectivity is restored, `flushPendingAttempts()` is called once to
 * drain the IDB offline submission queue — no user action required.
 */
import { useState, useEffect, useRef } from 'react';
import { getAllPending, deletePending, queuePendingAttempt, saveResult } from '@/features/tests/lib/test-results-db';
import useAuthStore from '@/lib/auth-store';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
/** How often to re-probe while the device reports online (ms). */
const PROBE_INTERVAL_MS = 30_000; // 30 s
/** Timeout for a single probe request before we treat it as offline (ms). */
const PROBE_TIMEOUT_MS  = 5_000;  // 5 s

// ─── Offline attempt flush ────────────────────────────────────────────────────

/**
 * Drains the IDB `pending-attempts` store by posting each queued attempt to
 * the server. Called once when the device transitions from offline → online.
 *
 * Critical ordering guarantee:
 *  - `deletePending(id)` is called BEFORE the POST, not after.
 *    This prevents a double-submit even if the POST hangs and the user kills
 *    the page between the delete and the server response.
 *  - On network failure the attempt is re-queued for the next reconnect.
 */
async function flushPendingAttempts(): Promise<void> {
  const pending = await getAllPending();
  if (pending.length === 0) return;

  const token = useAuthStore.getState().accessToken;
  if (!token) return; // not logged in — skip flush, queue will be drained after next login

  for (const item of pending) {
    // Delete-before-POST: prevents double-submit on page kill mid-flight
    await deletePending(item.id);

    try {
      const res = await fetch(`${API_URL}/api/tests/${item.testId}/attempt`, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          Authorization:   `Bearer ${token}`,
        },
        body: JSON.stringify({ answers: item.answers, timeTaken: item.timeTaken }),
      });

      if (res.ok) {
        const body = await res.json();
        const result = body.data;
        // Save the now-confirmed result to IDB for the Result page
        await saveResult({
          id:        result.id,
          testId:    item.testId,
          testTitle: '',         // will be filled in by the Result page from RQ cache
          subjectId: '',
          result,
        });
      }
      // If res.not-ok (e.g. 403 paid gate expired): silently drop — re-queuing
      // would loop forever. The student loses that submit, which is acceptable.
    } catch {
      // Network still down or transient error — re-queue for next reconnect
      await queuePendingAttempt(item);
    }
  }
}

// ─── Real HTTP connectivity probe ─────────────────────────────────────────────

async function probeConnectivity(): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS);
    const res = await fetch(`${API_URL}/api/ping`, {
      method: 'HEAD',
      signal: ctrl.signal,
      // Bypass any service worker cache — we need a real network round-trip
      cache: 'no-store',
    });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}

// ─── Hook ────────────────────────────────────────────────────────────────────

/**
 * Returns the live network connectivity status.
 *
 * Uses a two-layer approach:
 *  1. `window` online/offline events for instant responsiveness.
 *  2. Periodic HEAD probe to /api/ping for accuracy (captive portal detection).
 *
 * On the first transition to `true`, pending offline attempts are flushed.
 */
export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  // Track previous online state to detect the offline → online transition
  const prevOnlineRef = useRef(isOnline);

  useEffect(() => {
    let probeTimer: ReturnType<typeof setTimeout> | null = null;

    async function runProbe() {
      const result = await probeConnectivity();

      // Detect offline → online transition and flush the queue
      if (result && !prevOnlineRef.current) {
        // Fire-and-forget: don't block the UI on pending flushes
        flushPendingAttempts().catch(() => {/* ignore flush errors */});
      }

      prevOnlineRef.current = result;
      setIsOnline(result);

      // Schedule next probe only if navigator still thinks we're online
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        probeTimer = setTimeout(runProbe, PROBE_INTERVAL_MS);
      }
    }

    const handleOnline = () => {
      setIsOnline(true);
      // Immediately probe instead of waiting for the next scheduled cycle
      runProbe();
    };

    const handleOffline = () => {
      setIsOnline(false);
      prevOnlineRef.current = false;
      if (probeTimer) { clearTimeout(probeTimer); probeTimer = null; }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial probe on mount
    runProbe();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (probeTimer) clearTimeout(probeTimer);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return isOnline;
}
