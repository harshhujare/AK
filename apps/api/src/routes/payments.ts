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


// Plan pricing config (paise)
const PLAN_PRICING: Record<string, number> = {
  '365': 9900, // ₹99 / year
};

// POST /api/payments/create-order
paymentsRouter.post('/create-order', requireAuth(), async (req: Request, res: Response) => {
  const parsed = CreateOrderSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  const planDuration = parseInt(parsed.data.planDuration);
  const amount = PLAN_PRICING[parsed.data.planDuration];
  if (!amount) {
    res.status(400).json({ error: 'Invalid plan duration' });
    return;
  }

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
    receipt: `rcpt_${req.user!.userId}_${Date.now()}`,
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

  // Upgrade plan
  const planExpiresAt = new Date();
  planExpiresAt.setDate(planExpiresAt.getDate() + payment.planDuration);

  await prisma.$transaction([
    prisma.payment.update({
      where: { razorpayOrderId },
      data: { razorpayPaymentId, status: 'SUCCESS' },
    }),
    prisma.user.update({
      where: { id: req.user!.userId },
      data: { plan: 'PAID', planExpiresAt },
    }),
  ]);

  res.json({ data: { message: 'Payment successful. Subscription activated.', planExpiresAt } });
});

// POST /api/payments/webhook — Razorpay async events
paymentsRouter.post('/webhook', async (req: Request, res: Response) => {
  const signature = req.headers['x-razorpay-signature'] as string;
  if (!signature) {
    res.status(400).json({ error: 'Missing webhook signature' });
    return;
  }

  const rawBody = JSON.stringify(req.body);
  const valid = verifyWebhookSignature(rawBody, signature);
  if (!valid) {
    res.status(400).json({ error: 'Invalid webhook signature' });
    return;
  }

  const event = req.body.event;
  const orderId = req.body.payload?.payment?.entity?.order_id;

  if (event === 'payment.captured' && orderId) {
    const payment = await prisma.payment.findUnique({ where: { razorpayOrderId: orderId } });
    
    // Idempotency: only apply if PENDING
    if (payment && payment.status === 'PENDING') {
      const planExpiresAt = new Date();
      planExpiresAt.setDate(planExpiresAt.getDate() + payment.planDuration);
      
      await prisma.$transaction([
        prisma.payment.update({
          where: { razorpayOrderId: orderId },
          data: { status: 'SUCCESS' },
        }),
        prisma.user.update({
          where: { id: payment.userId },
          data: { plan: 'PAID', planExpiresAt },
        }),
      ]);
    }
  }

  if (event === 'payment.failed' && orderId) {
    await prisma.payment.updateMany({
      where: { razorpayOrderId: orderId, status: 'PENDING' },
      data: { status: 'FAILED' },
    });
  }

  res.json({ status: 'ok' });
});
