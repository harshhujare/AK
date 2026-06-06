const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

/**
 * Polls the /api/auth/me endpoint to check if the user's plan has been upgraded to PAID.
 * Useful as a fallback if the verification API times out, but the webhook successfully updates the plan.
 */
export async function pollForPlanUpgrade(
  getAccessToken: () => string,
  maxAttempts = 10,
  intervalMs = 3000
): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    // Wait for the interval
    await new Promise(r => setTimeout(r, intervalMs));
    
    try {
      const res = await fetch(`${API_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${getAccessToken()}` }
      });
      
      if (!res.ok) continue; // If 401/500, just keep trying or let it fail
      
      const body = await res.json();
      if (body.data?.plan === 'PAID') {
        return true;
      }
    } catch (e) {
      // Network error, ignore and retry
      console.warn('Polling error:', e);
    }
  }
  return false;
}
