import Razorpay from 'razorpay';
import crypto from 'crypto';

// ─── Lazy singleton ───────────────────────────────────────────────────────────
// Do NOT instantiate at module load time — if the env vars are missing the
// Razorpay constructor throws and crashes the whole server on startup.
let _client: Razorpay | null = null;

function getRazorpayClient(): Razorpay {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    throw new Error('Razorpay is not configured: RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are required');
  }
  if (!_client) {
    _client = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
  }
  return _client;
}

export interface CreateOrderOptions {
  amount: number;   // paise
  currency?: string;
  receipt: string;
}

export async function createRazorpayOrder(options: CreateOrderOptions) {
  return getRazorpayClient().orders.create({
    amount: options.amount,
    currency: options.currency || 'INR',
    receipt: options.receipt,
  });
}

/**
 * Verify Razorpay payment signature server-side.
 * Returns true if signature is valid.
 */
export function verifyRazorpaySignature(
  orderId: string,
  paymentId: string,
  signature: string
): boolean {
  if (!process.env.RAZORPAY_KEY_SECRET) {
    throw new Error('Razorpay is not configured: RAZORPAY_KEY_SECRET is required');
  }
  const body = `${orderId}|${paymentId}`;
  const expectedSig = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(body)
    .digest('hex');
  return expectedSig === signature;
}

/**
 * Verify Razorpay webhook signature.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signature: string
): boolean {
  if (!process.env.RAZORPAY_WEBHOOK_SECRET) {
    throw new Error('Razorpay is not configured: RAZORPAY_WEBHOOK_SECRET is required');
  }
  const expectedSig = crypto
    .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');
  return expectedSig === signature;
}

/** Returns true if Razorpay keys are present in the environment. */
export function isRazorpayConfigured(): boolean {
  return !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}
