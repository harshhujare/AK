import { Router, Request, Response } from 'express';
import { prisma, withRetry } from '../lib/prisma';
import { requireAdmin, requireSuperAdmin, requireSupport } from '../middleware/auth';
import { UpdateUserPlanSchema } from '@ajitsir/shared';
import { Role, Plan } from '@prisma/client';

export const adminRouter = Router();

// GET /api/admin/users/:id/lookup — Limited lookup for SUPPORT_MANAGER
adminRouter.get('/users/:id/lookup', requireSupport(), async (req: Request, res: Response) => {
  const user = await withRetry(() => prisma.user.findUnique({
    where: { id: String(req.params.id) },
    select: {
      id: true,
      name: true,
      email: true,
      plan: true,
      planExpiresAt: true,
      createdAt: true,
    }
  }));
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  res.json({ data: user });
});

// All subsequent admin routes require at least CONTENT_MANAGER role
adminRouter.use(requireAdmin());

// GET /api/admin/stats — full platform statistics
adminRouter.get('/stats', async (_req: Request, res: Response) => {
  const [totalUsers, totalNotes, activeAnnouncements, todayViews, revenueResult] =
    await withRetry(() => Promise.all([
      prisma.user.count(),
      prisma.note.count(),
      prisma.announcement.count({ where: { isActive: true } }),
      prisma.noteView.count({
        where: {
          viewedAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
      }),
      prisma.payment.aggregate({
        where: { status: 'SUCCESS' },
        _sum: { amount: true },
      }),
    ]));

  res.json({
    data: {
      totalUsers,
      totalNotes,
      activeAnnouncements,
      todayViews,
      revenueInPaise: revenueResult._sum.amount || 0,
      revenueInRupees: ((revenueResult._sum.amount || 0) / 100).toFixed(2),
    },
  });
});

// GET /api/admin/users?page=1&limit=20&search=
adminRouter.get('/users', async (req: Request, res: Response) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, parseInt(req.query.limit as string) || 20);
  const search = (req.query.search as string) || '';

  const where = search
    ? {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { email: { contains: search, mode: 'insensitive' as const } },
        ],
      }
    : {};

  const [users, total] = await withRetry(() => Promise.all([
    prisma.user.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        plan: true,
        planExpiresAt: true,
        createdAt: true,
      },
    }),
    prisma.user.count({ where }),
  ]));

  res.json({ data: { users, total, page, limit, totalPages: Math.ceil(total / limit) } });
});

// PATCH /api/admin/users/:id/plan — update user plan (any admin)
adminRouter.patch('/users/:id/plan', async (req: Request, res: Response) => {
  const parsed = UpdateUserPlanSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  const { plan, planDuration } = parsed.data;
  let planExpiresAt: Date | null = null;

  if (plan === 'PAID' && planDuration) {
    planExpiresAt = new Date();
    planExpiresAt.setDate(planExpiresAt.getDate() + planDuration);
  }

  const user = await withRetry(() => prisma.user.update({
    where: { id: String(req.params.id) },
    data: { plan: plan as Plan, planExpiresAt },
    select: { id: true, name: true, email: true, plan: true, planExpiresAt: true },
  }));

  res.json({ data: user });
});

// PATCH /api/admin/users/:id/role — change user role (SUPER_ADMIN only)
adminRouter.patch('/users/:id/role', requireSuperAdmin(), async (req: Request, res: Response) => {
  const { role } = req.body as { role: string };
  const validRoles = ['STUDENT', 'SUPPORT_MANAGER', 'CONTENT_MANAGER'];

  if (!role || !validRoles.includes(role)) {
    res.status(400).json({ error: `role must be one of: ${validRoles.join(', ')}` });
    return;
  }

  const user = await withRetry(() => prisma.user.update({
    where: { id: String(req.params.id) },
    data: { role: role as Role },
    select: { id: true, name: true, email: true, role: true, plan: true },
  }));

  res.json({ data: user });
});

// ─── Payment Management Endpoints ────────────────────────────────────────────

// GET /api/admin/payments/stats — revenue & payment stats (detailed)
adminRouter.get('/payments/stats', async (_req: Request, res: Response) => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

  const [
    totalRevenue,
    revenueThisMonth,
    revenueLastMonth,
    totalPaidUsers,
    totalPayments,
    successPayments,
    failedPayments,
    pendingPayments,
  ] = await withRetry(() => Promise.all([
    prisma.payment.aggregate({ where: { status: 'SUCCESS' }, _sum: { amount: true } }),
    prisma.payment.aggregate({ where: { status: 'SUCCESS', createdAt: { gte: startOfMonth } }, _sum: { amount: true } }),
    prisma.payment.aggregate({ where: { status: 'SUCCESS', createdAt: { gte: startOfLastMonth, lte: endOfLastMonth } }, _sum: { amount: true } }),
    prisma.user.count({ where: { plan: 'PAID' } }),
    prisma.payment.count(),
    prisma.payment.count({ where: { status: 'SUCCESS' } }),
    prisma.payment.count({ where: { status: 'FAILED' } }),
    prisma.payment.count({ where: { status: 'PENDING' } }),
  ]));

  const totalRevenuePaise = totalRevenue._sum.amount || 0;
  const successRate = totalPayments > 0
    ? ((successPayments / totalPayments) * 100).toFixed(1)
    : '0.0';

  res.json({
    data: {
      totalRevenuePaise,
      totalRevenueRupees: (totalRevenuePaise / 100).toFixed(2),
      revenueThisMonthPaise: revenueThisMonth._sum.amount || 0,
      revenueThisMonthRupees: ((revenueThisMonth._sum.amount || 0) / 100).toFixed(2),
      revenueLastMonthPaise: revenueLastMonth._sum.amount || 0,
      revenueLastMonthRupees: ((revenueLastMonth._sum.amount || 0) / 100).toFixed(2),
      totalPaidUsers,
      totalPayments,
      successPayments,
      failedPayments,
      pendingPayments,
      successRate,
    },
  });
});

// GET /api/admin/payments?page=1&limit=20&status=&search=
adminRouter.get('/payments', async (req: Request, res: Response) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, parseInt(req.query.limit as string) || 20);
  const status = req.query.status as string | undefined;
  const search = (req.query.search as string) || '';

  const where: any = {};

  if (status && ['PENDING', 'SUCCESS', 'FAILED', 'REFUNDED'].includes(status)) {
    where.status = status;
  }

  if (search) {
    where.OR = [
      { razorpayOrderId: { contains: search, mode: 'insensitive' } },
      { user: { name: { contains: search, mode: 'insensitive' } } },
      { user: { email: { contains: search, mode: 'insensitive' } } },
    ];
  }

  const [payments, total] = await withRetry(() => Promise.all([
    prisma.payment.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        razorpayOrderId: true,
        razorpayPaymentId: true,
        amount: true,
        status: true,
        planDuration: true,
        createdAt: true,
        user: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.payment.count({ where }),
  ]));

  res.json({
    data: { payments, total, page, limit, totalPages: Math.ceil(total / limit) },
  });
});

// GET /api/admin/plan-config — get current plan configuration
adminRouter.get('/plan-config', async (_req: Request, res: Response) => {
  const configs = await withRetry(() => prisma.planConfig.findMany({
    orderBy: { planDuration: 'asc' },
  }));
  res.json({ data: configs });
});

// PATCH /api/admin/plan-config/:planDuration — update plan price (SUPER_ADMIN only)
adminRouter.patch('/plan-config/:planDuration', requireSuperAdmin(), async (req: Request, res: Response) => {
  const planDuration = parseInt(String(req.params.planDuration));
  const { price, label, description, isActive } = req.body;

  if (price !== undefined && (typeof price !== 'number' || price < 100)) {
    res.status(400).json({ error: 'price must be a number >= 100 (paise). Minimum ₹1.' });
    return;
  }

  const config = await withRetry(() => prisma.planConfig.upsert({
    where: { planDuration },
    create: {
      planDuration,
      price: price ?? 49900,
      label: label ?? 'Premium Access',
      description: description ?? null,
      isActive: isActive ?? true,
    },
    update: {
      ...(price !== undefined && { price }),
      ...(label !== undefined && { label }),
      ...(description !== undefined && { description }),
      ...(isActive !== undefined && { isActive }),
    },
  }));

  res.json({ data: config });
});

