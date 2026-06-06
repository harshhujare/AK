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
  const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout for Neon/Render cold starts

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
 */
export async function verifyPaymentAPI(
  data: VerifyPaymentInput,
  token: string
): Promise<VerifyPaymentResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

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

    if (!res.ok) {
      if (res.status === 401) throw new Error('Unauthorized');
      const errorData = await res.json().catch(() => null);
      throw new Error(errorData?.error || 'Verification failed');
    }

    return await res.json();
  } finally {
    clearTimeout(timeoutId);
  }
}
