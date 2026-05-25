import Razorpay from 'razorpay';
import crypto from 'crypto';

export const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

export interface CreateOrderOptions {
  amount: number;   // paise
  currency?: string;
  receipt: string;
}

export async function createRazorpayOrder(options: CreateOrderOptions) {
  return razorpay.orders.create({
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
  const body = `${orderId}|${paymentId}`;
  const expectedSig = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
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
  const expectedSig = crypto
    .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET!)
    .update(rawBody)
    .digest('hex');
  return expectedSig === signature;
}
