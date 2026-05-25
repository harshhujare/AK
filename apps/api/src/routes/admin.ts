import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { requireAdmin, requireSuperAdmin } from '../middleware/auth';
import { UpdateUserPlanSchema } from '@ajitsir/shared';
import { Role, Plan } from '@prisma/client';

export const adminRouter = Router();

// All admin routes require at least CONTENT_MANAGER role
adminRouter.use(requireAdmin());

// GET /api/admin/stats — full platform statistics
adminRouter.get('/stats', async (_req: Request, res: Response) => {
  const [totalUsers, totalNotes, activeAnnouncements, todayViews, revenueResult] =
    await Promise.all([
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
    ]);

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

  const [users, total] = await Promise.all([
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
  ]);

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

  const user = await prisma.user.update({
    where: { id: String(req.params.id) },
    data: { plan: plan as Plan, planExpiresAt },
    select: { id: true, name: true, email: true, plan: true, planExpiresAt: true },
  });

  res.json({ data: user });
});

// PATCH /api/admin/users/:id/role — change user role (SUPER_ADMIN only)
adminRouter.patch('/users/:id/role', requireSuperAdmin(), async (req: Request, res: Response) => {
  const { role } = req.body as { role: string };
  const validRoles = ['STUDENT', 'CONTENT_MANAGER', 'SUPER_ADMIN'] as const;

  if (!role || !validRoles.includes(role as Role)) {
    res.status(400).json({ error: `role must be one of: ${validRoles.join(', ')}` });
    return;
  }

  const user = await prisma.user.update({
    where: { id: String(req.params.id) },
    data: { role: role as Role },
    select: { id: true, name: true, email: true, role: true, plan: true },
  });

  res.json({ data: user });
});
