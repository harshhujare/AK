import type { VerifyPaymentInput } from '@ajitsir/shared';
import type { PlanDuration } from '../hooks/useCheckout';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface CreateOrderResponse {
  data: {
    orderId: string;
    amount: number;
    currency: string;
    keyId: string;
  };
}

interface VerifyPaymentResponse {
  data: {
    message: string;
    planExpiresAt: string;
  };
}

/**
 * Creates a Razorpay order in the backend.
 * Uses AbortController to support timeouts for cold starts.
 */
export async function createOrderAPI(
  planDuration: PlanDuration,
  token: string
): Promise<CreateOrderResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s — enough for Render cold start

  try {
    const res = await fetch(`${API_URL}/api/payments/create-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ planDuration }),
      signal: controller.signal,
    });

    if (!res.ok) {
      if (res.status === 401) throw new Error('Unauthorized');
      throw new Error(`Failed to create order: ${res.statusText}`);
    }

    return await res.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Verifies the Razorpay payment signature in the backend.
 *
 * WHY 45s timeout + 3 retries?
 * ─────────────────────────────
 * On a mobile connection the verify call hits:
 *   • Render.com free-tier cold start:  10–15 s
 *   • Neon DB scale-to-zero wake:        2– 5 s
 *   Total worst case:                   ~30 s
 *
 * A 15 s timeout (old value) fires before the server can respond on mobile,
 * leaving the payment in PENDING forever. 45 s covers the worst-case path
 * with a 50% headroom buffer.
 *
 * Retrying is SAFE because /verify is idempotent on the server:
 *   • If the payment is already SUCCESS → returns 200 immediately.
 *   • Signature mismatch (400) → non-retryable, thrown immediately.
 *   • Auth error (401) → non-retryable, thrown immediately.
 */
export async function verifyPaymentAPI(
  data: VerifyPaymentInput,
  token: string,
  maxRetries = 3
): Promise<VerifyPaymentResponse> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    // 45 s per attempt — generous enough for Render cold start + Neon wake on mobile
    const timeoutId = setTimeout(() => controller.abort(), 45000);

    try {
      const res = await fetch(`${API_URL}/api/payments/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Non-retryable HTTP errors — throw immediately, no further attempts
      if (res.status === 401) throw new Error('Unauthorized');
      if (res.status === 400) {
        const errorData = await res.json().catch(() => null);
        throw new Error(errorData?.error || 'Verification failed');
      }

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        // 5xx errors are retryable (server crash / DB hiccup)
        lastError = new Error(errorData?.error || 'Verification failed');
        // fall through to retry logic below
      } else {
        // 2xx — success, return immediately
        return await res.json();
      }
    } catch (err) {
      clearTimeout(timeoutId);

      // Non-retryable errors — bubble up immediately
      if (err instanceof Error && err.message === 'Unauthorized') throw err;
      if (err instanceof Error && err.message === 'Verification failed') throw err;

      lastError = err;
      // AbortError (timeout) or network TypeError — retryable
    }

    // Don't wait after the last attempt
    if (attempt < maxRetries) {
      // Exponential backoff: 2s, 4s, 8s ...
      const backoffMs = Math.min(2000 * Math.pow(2, attempt - 1), 10000);
      await new Promise(r => setTimeout(r, backoffMs));
    }
  }

  // All retries exhausted — throw the last captured error
  throw lastError;
}
