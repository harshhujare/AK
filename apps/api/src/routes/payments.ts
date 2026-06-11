import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';
import { createRazorpayOrder, verifyRazorpaySignature, verifyWebhookSignature, isRazorpayConfigured } from '../services/razorpay';
import { CreateOrderSchema, VerifyPaymentSchema } from '@ajitsir/shared';

export const paymentsRouter = Router();

// Guard: if Razorpay keys are missing return 503 instead of crashing
paymentsRouter.use((_req: Request, res: Response, next: NextFunction) => {
  if (!isRazorpayConfigured()) {
    res.status(503).json({ error: 'Payment service is not available' });
    return;
  }
  next();
});
// GET /api/payments/plan-config — Publicly available pricing info
paymentsRouter.get('/plan-config', async (_req: Request, res: Response) => {
  const configs = await prisma.planConfig.findMany({
    where: { isActive: true },
    orderBy: { planDuration: 'asc' },
    select: {
      planDuration: true,
      price: true,
      label: true,
      description: true,
    }
  });
  res.json({ data: configs });
});


// POST /api/payments/create-order
paymentsRouter.post('/create-order', requireAuth(), async (req: Request, res: Response) => {
  const parsed = CreateOrderSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  // Block mid-plan purchase — user cannot buy again while their plan is active
  const currentUser = await prisma.user.findUnique({
    where: { id: req.user!.userId },
    select: { plan: true, planExpiresAt: true },
  });
  if (
    currentUser?.plan === 'PAID' &&
    currentUser.planExpiresAt &&
    currentUser.planExpiresAt > new Date()
  ) {
    res.status(409).json({
      error: 'You already have an active plan. You can purchase again after it expires.',
      planExpiresAt: currentUser.planExpiresAt,
    });
    return;
  }

  const planDuration = parseInt(parsed.data.planDuration);

  // ── Fetch price from DB (admin-configurable) ──────────────────────────────
  const planConfig = await prisma.planConfig.findFirst({
    where: { planDuration, isActive: true },
  });
  if (!planConfig) {
    res.status(400).json({ error: 'Invalid plan duration or plan is not available' });
    return;
  }
  const { price: amount, label: planLabel } = planConfig;

  // Idempotency: return existing PENDING order if created within the last 30 minutes
  const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000);
  const existingOrder = await prisma.payment.findFirst({
    where: {
      userId: req.user!.userId,
      status: 'PENDING',
      planDuration,
      createdAt: { gte: thirtyMinsAgo }
    },
    orderBy: { createdAt: 'desc' }
  });

  if (existingOrder) {
    res.json({
      data: {
        orderId: existingOrder.razorpayOrderId,
        amount: existingOrder.amount,
        currency: 'INR',
        keyId: process.env.RAZORPAY_KEY_ID,
      },
    });
    return;
  }

  const order = await createRazorpayOrder({
    amount,
    // Razorpay max receipt length is 40. CUID is 25 chars.
    // rcpt (4) + _ (1) + short_uid (8) + _ (1) + timestamp (13) = 27 chars.
    receipt: `rcpt_${req.user!.userId.substring(0, 8)}_${Date.now()}`,
  });

  // Save pending payment record
  await prisma.payment.create({
    data: {
      userId: req.user!.userId,
      razorpayOrderId: order.id,
      amount,
      status: 'PENDING',
      planDuration,
    },
  });

  res.json({
    data: {
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
      planLabel,   // forward label so frontend can show correct plan name on success page
    },
  });
});

// POST /api/payments/verify
paymentsRouter.post('/verify', requireAuth(), async (req: Request, res: Response) => {
  const parsed = VerifyPaymentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = parsed.data;

  // Server-side HMAC verification — never trust client
  const valid = verifyRazorpaySignature(razorpayOrderId, razorpayPaymentId, razorpaySignature);
  if (!valid) {
    res.status(400).json({ error: 'Payment verification failed — invalid signature' });
    return;
  }

  const payment = await prisma.payment.findUnique({ where: { razorpayOrderId } });
  if (!payment || payment.userId !== req.user!.userId) {
    res.status(404).json({ error: 'Order not found' });
    return;
  }

  // Idempotency: if already SUCCESS, don't extend expiry again
  if (payment.status === 'SUCCESS') {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId }, select: { planExpiresAt: true } });
    res.json({ data: { message: 'Payment already verified.', planExpiresAt: user?.planExpiresAt } });
    return;
  }

  // Calculate expiry from today (no stacking — user cannot buy while plan is active)
  const planExpiresAt = new Date();
  planExpiresAt.setDate(planExpiresAt.getDate() + payment.planDuration);

  // Fetch current paidAt to avoid overwriting an earlier timestamp
  const existingUser = await prisma.user.findUnique({
    where: { id: req.user!.userId },
    select: { paidAt: true },
  });

  await prisma.$transaction([
    prisma.payment.update({
      where: { razorpayOrderId },
      data: { razorpayPaymentId, status: 'SUCCESS' },
    }),
    prisma.user.update({
      where: { id: req.user!.userId },
      data: {
        plan: 'PAID',
        planExpiresAt,
        // paidAt: set once on first payment, never overwritten
        ...(existingUser?.paidAt == null && { paidAt: new Date() }),
      },
    }),
  ]);

  res.json({ data: { message: 'Payment successful. Subscription activated.', planExpiresAt } });
});

// POST /api/payments/webhook — Razorpay async events
// Note: req.rawBody is populated by captureRawBody middleware (registered in index.ts)
// before express.json() so the HMAC is computed over the original bytes Razorpay sent.
paymentsRouter.post('/webhook', async (req: Request, res: Response) => {
  const signature = req.headers['x-razorpay-signature'] as string;
  if (!signature) {
    res.status(400).json({ error: 'Missing webhook signature' });
    return;
  }

  // Use raw bytes for HMAC — never re-serialize the parsed JSON object
  const rawBody = req.rawBody?.toString('utf8') ?? JSON.stringify(req.body);
  const valid = verifyWebhookSignature(rawBody, signature);
  if (!valid) {
    res.status(400).json({ error: 'Invalid webhook signature' });
    return;
  }

  const event = req.body.event;
  // payment.captured fires for card/wallet; order.paid fires for UPI/net-banking
  const orderId = req.body.payload?.payment?.entity?.order_id
    ?? req.body.payload?.order?.entity?.id;

  // Extract razorpayPaymentId from webhook payload so we can persist it.
  // The /verify endpoint sets this when the frontend flow works; the webhook
  // is the fallback for UPI redirect flows where the page is destroyed.
  const razorpayPaymentId: string | undefined =
    req.body.payload?.payment?.entity?.id;

  if ((event === 'payment.captured' || event === 'order.paid') && orderId) {
    // ── CRITICAL: wrap all DB operations in try/catch ─────────────────────────
    // Without this, any Prisma error causes an unhandled promise rejection.
    // The global unhandledRejection handler in index.ts swallows it silently,
    // no response is sent to Razorpay, Razorpay times out and marks delivery
    // as failed, then retries — all retries fail the same way.
    // Payment stays PENDING forever even though money was captured.
    try {
      const payment = await prisma.payment.findUnique({ where: { razorpayOrderId: orderId } });

      // Idempotency: only apply if PENDING
      if (payment && payment.status === 'PENDING') {
        const planExpiresAt = new Date();
        planExpiresAt.setDate(planExpiresAt.getDate() + payment.planDuration);

        // Fetch current paidAt to avoid overwriting an earlier timestamp
        const existingUser = await prisma.user.findUnique({
          where: { id: payment.userId },
          select: { paidAt: true },
        });

        await prisma.$transaction([
          prisma.payment.update({
            where: { razorpayOrderId: orderId },
            data: {
              status: 'SUCCESS',
              // Persist the payment ID from the webhook so reconciliation queries
              // work even when the frontend verify flow never completed (e.g. UPI
              // redirect on Android destroys the page before handler() fires).
              ...(razorpayPaymentId && { razorpayPaymentId }),
            },
          }),
          prisma.user.update({
            where: { id: payment.userId },
            data: {
              plan: 'PAID',
              planExpiresAt,
              // paidAt: set once on first payment, never overwritten
              ...(existingUser?.paidAt == null && { paidAt: new Date() }),
            },
          }),
        ]);

        console.log(`[Webhook] Payment ${orderId} → SUCCESS via ${event}`);
      }
    } catch (err) {
      // Log the error but still respond 200 so Razorpay doesn't keep retrying
      // a webhook that will fail for the same structural reason (e.g., DB
      // constraint). For transient errors (connection drop), Razorpay will
      // retry automatically on a 5xx — so return 500 only for those.
      console.error('[Webhook] DB error processing payment event:', err);

      // Respond 500 for transient errors → Razorpay will retry
      res.status(500).json({ error: 'Webhook processing failed — will retry' });
      return;
    }
  }

  if (event === 'payment.failed' && orderId) {
    try {
      await prisma.payment.updateMany({
        where: { razorpayOrderId: orderId, status: 'PENDING' },
        data: { status: 'FAILED' },
      });
    } catch (err) {
      console.error('[Webhook] DB error processing payment.failed event:', err);
      res.status(500).json({ error: 'Webhook processing failed — will retry' });
      return;
    }
  }

  res.json({ status: 'ok' });
});
