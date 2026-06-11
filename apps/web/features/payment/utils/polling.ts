const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

/**
 * Polls the /api/auth/me endpoint to check if the user's plan has been upgraded to PAID.
 *
 * WHY 20 attempts × 5 s = 100 s window?
 * ────────────────────────────────────────
 * This is the fallback path taken when verifyPaymentAPI exhausts all retries.
 * At this point we are waiting for the Razorpay WEBHOOK to fire and update the
 * plan server-side. Razorpay webhooks typically arrive within 30–90 seconds of
 * a successful capture event. A 100 s window reliably catches all real-world cases.
 *
 * The old window (10 × 3 s = 30 s) was too short — it always ended before the
 * webhook arrived, causing every timed-out verify to show the user an error even
 * though the payment was actually successful and the plan would be upgraded shortly.
 */
export async function pollForPlanUpgrade(
  getAccessToken: () => string,
  maxAttempts = 20,
  intervalMs = 5000
): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    // Wait first — give the server a moment before the first check
    await new Promise(r => setTimeout(r, intervalMs));
    
    try {
      const res = await fetch(`${API_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${getAccessToken()}` }
      });
      
      if (!res.ok) continue; // 401/500 — keep trying
      
      const body = await res.json();
      if (body.data?.plan === 'PAID') {
        return true;
      }
    } catch {
      // Network error — keep polling silently
    }
  }
  return false;
}
