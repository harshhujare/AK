import { Router, Request, Response, NextFunction } from 'express';
import { prisma, withRetry } from '../lib/prisma';
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

  // ── Fix G: wrap planConfig fetch in withRetry() ───────────────────────────
  // A Neon cold-start here returns null planConfig → triggers a misleading 400
  // "Invalid plan duration" error even for a valid plan. withRetry() retries
  // up to 3 times on transient DB connection errors (P1001, P1002, ETIMEDOUT).
  const planConfig = await withRetry(() =>
    prisma.planConfig.findFirst({ where: { planDuration, isActive: true } })
  );
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

  // ── Fix A: wrap createRazorpayOrder + prisma.payment.create in try/catch ──
  // createRazorpayOrder() is a raw HTTP call to Razorpay's API. If Razorpay is
  // down or returns a non-2xx, orders.create() throws an unhandled rejection.
  // The global unhandledRejection handler in index.ts swallows it, no response
  // is sent, and the frontend's AbortController fires after 20 s — showing the
  // user an error when no order was created.
  // prisma.payment.create is also unguarded, so a Neon transient error here
  // would leave the user stranded mid-checkout.
  let order: Awaited<ReturnType<typeof createRazorpayOrder>>;
  try {
    order = await createRazorpayOrder({
      amount,
      // Razorpay max receipt length is 40. CUID is 25 chars.
      // rcpt (4) + _ (1) + short_uid (8) + _ (1) + timestamp (13) = 27 chars.
      receipt: `rcpt_${req.user!.userId.substring(0, 8)}_${Date.now()}`,
    });
  } catch (err) {
    console.error('[create-order] Razorpay API error:', err);
    res.status(503).json({ error: 'Payment gateway unavailable. Please try again in a moment.' });
    return;
  }

  try {
    // Use withRetry so a Neon cold-start at this exact moment doesn't orphan the order
    await withRetry(() =>
      prisma.payment.create({
        data: {
          userId: req.user!.userId,
          razorpayOrderId: order.id,
          amount,
          status: 'PENDING',
          planDuration,
        },
      })
    );
  } catch (err) {
    console.error('[create-order] DB error saving pending payment:', err);
    // The Razorpay order exists but our DB record doesn't — the order is now
    // an orphan. This is recoverable: if the user retries, the idempotency
    // check will NOT find a PENDING record and will create a fresh order.
    // The orphaned Razorpay order will expire automatically (Razorpay TTL: 15 min).
    res.status(503).json({ error: 'Could not save order. Please try again.' });
    return;
  }

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

  // ── Fix B (verify side): use updateMany with a status filter for the payment row ──
  // The webhook can race with this verify call — both may read status === 'PENDING'
  // and both try to write SUCCESS. Using updateMany with { status: 'PENDING' } in
  // the where clause gives CAS (compare-and-swap) semantics: exactly one writer wins,
  // the other's updateMany matches 0 rows and is a no-op. This prevents double-writes
  // on the payment row. The user.update is idempotent (same expiry both times).
  await prisma.$transaction([
    prisma.payment.updateMany({
      where: { razorpayOrderId, status: 'PENDING' },
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
    try {
      // ── Fix E: wrap webhook DB operations in withRetry() ──────────────────
      // prisma.ts defines withRetry() for exactly this — Neon cold-start transient
      // errors. Without it, a brief connection drop during a burst of webhooks
      // exhausts Razorpay's retry window and leaves payments PENDING permanently.
      // withRetry() retries internally on transient errors so the try/catch only
      // sees real permanent failures.
      await withRetry(async () => {
        // ── Fix B (webhook side): use updateMany with status: 'PENDING' filter ──
        // The /verify endpoint races with this webhook — both may read PENDING and
        // both try to write SUCCESS. updateMany with { status: 'PENDING' } gives
        // CAS semantics: only one writer transitions the row, the other matches 0
        // rows and is a no-op. This replaces the old findUnique + update pattern
        // which had a TOCTOU gap between the read and the write.
        //
        // ── Fix F (capture path): updateMany instead of findUnique + update ──
        // Combined with the payment.failed branch also using updateMany (below),
        // both capture and fail paths are now fully atomic by CAS semantics —
        // no read-then-write race between the two event types.
        const result = await prisma.payment.updateMany({
          where: { razorpayOrderId: orderId, status: 'PENDING' },
          data: {
            status: 'SUCCESS',
            // Persist the payment ID from the webhook so reconciliation queries
            // work even when the frontend verify flow never completed (e.g. UPI
            // redirect on Android destroys the page before handler() fires).
            ...(razorpayPaymentId && { razorpayPaymentId }),
          },
        });

        // Only update the user if we actually transitioned the payment row.
        // If result.count === 0, another writer already set it to SUCCESS.
        if (result.count > 0) {
          // Re-fetch planDuration — needed to compute the correct expiry
          const payment = await prisma.payment.findUnique({
            where: { razorpayOrderId: orderId },
            select: { planDuration: true, userId: true },
          });

          if (payment) {
            const planExpiresAt = new Date();
            planExpiresAt.setDate(planExpiresAt.getDate() + payment.planDuration);

            const existingUser = await prisma.user.findUnique({
              where: { id: payment.userId },
              select: { paidAt: true },
            });

            await prisma.user.update({
              where: { id: payment.userId },
              data: {
                plan: 'PAID',
                planExpiresAt,
                ...(existingUser?.paidAt == null && { paidAt: new Date() }),
              },
            });

            console.log(`[Webhook] Payment ${orderId} → SUCCESS via ${event}`);
          }
        } else {
          console.log(`[Webhook] Payment ${orderId} already SUCCESS (skipped) via ${event}`);
        }
      });
    } catch (err) {
      console.error('[Webhook] DB error processing payment event:', err);
      // Return 500 for permanent/unrecoverable errors → Razorpay will retry.
      // withRetry() already exhausted retries for transient errors before throwing here.
      res.status(500).json({ error: 'Webhook processing failed — will retry' });
      return;
    }
  }

  if (event === 'payment.failed' && orderId) {
    try {
      await withRetry(() =>
        // ── Fix F (failed path): updateMany is already CAS-safe ───────────────
        // If payment.captured arrives concurrently, its updateMany transitions to
        // SUCCESS first. This updateMany then matches 0 rows (status is already
        // SUCCESS, not PENDING) and is a no-op — preventing a captured payment
        // from being incorrectly marked FAILED.
        prisma.payment.updateMany({
          where: { razorpayOrderId: orderId, status: 'PENDING' },
          data: { status: 'FAILED' },
        })
      );
    } catch (err) {
      console.error('[Webhook] DB error processing payment.failed event:', err);
      res.status(500).json({ error: 'Webhook processing failed — will retry' });
      return;
    }
  }

  res.json({ status: 'ok' });
});
