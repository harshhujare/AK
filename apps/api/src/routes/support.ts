import { Router, Request, Response } from 'express';
import { prisma, withRetry } from '../lib/prisma';
import { requireAuth, requireSupport, requireSuperAdmin } from '../middleware/auth';
import { CreateTicketSchema, ReplyTicketSchema } from '@ajitsir/shared';

export const supportRouter = Router();

// ─── User Routes ─────────────────────────────────────────────────────────────

// POST /api/support/ — Create ticket
supportRouter.post('/', requireAuth(), async (req: Request, res: Response) => {
  const parsed = CreateTicketSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  // Check rate limit: Max 5 open tickets per user
  const openTickets = await prisma.supportTicket.count({
    where: {
      userId: req.user!.userId,
      status: { in: ['OPEN', 'IN_PROGRESS'] }
    }
  });

  if (openTickets >= 5) {
    res.status(429).json({ error: 'You have 5 open tickets. Please wait for a resolution before submitting more.' });
    return;
  }

  const ticket = await withRetry(() => prisma.supportTicket.create({
    data: {
      userId: req.user!.userId,
      type: parsed.data.type,
      subject: parsed.data.subject,
      message: parsed.data.message,
    }
  }));

  res.json({ data: ticket });
});

// GET /api/support/mine — Get user's tickets
supportRouter.get('/mine', requireAuth(), async (req: Request, res: Response) => {
  const tickets = await withRetry(() => prisma.supportTicket.findMany({
    where: { userId: req.user!.userId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      type: true,
      status: true,
      subject: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { replies: true } }
    }
  }));

  res.json({ data: tickets });
});

// GET /api/support/mine/:id — Get user ticket detail
supportRouter.get('/mine/:id', requireAuth(), async (req: Request, res: Response) => {
  const ticketId = String(req.params.id);
  const userId = req.user!.userId;

  const ticket = await withRetry(() => prisma.supportTicket.findFirst({
    where: { id: ticketId, userId },
    include: {
      replies: {
        orderBy: { createdAt: 'asc' },
        include: { author: { select: { name: true, role: true } } }
      }
    }
  }));

  if (!ticket) {
    res.status(404).json({ error: 'Ticket not found' });
    return;
  }

  // Anonymise staff names for the student
  const formattedReplies = (ticket as any).replies.map((reply: any) => ({
    ...reply,
    author: reply.isStaffReply ? { name: 'Support Team' } : { name: reply.author.name }
  }));

  res.json({ data: { ...ticket, replies: formattedReplies } });
});

// POST /api/support/mine/:id/reply — User replies to their ticket
supportRouter.post('/mine/:id/reply', requireAuth(), async (req: Request, res: Response) => {
  const parsed = ReplyTicketSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  const ticketId = String(req.params.id);
  const userId = req.user!.userId;

  const ticket = await prisma.supportTicket.findFirst({
    where: { id: ticketId, userId }
  });

  if (!ticket) {
    res.status(404).json({ error: 'Ticket not found' });
    return;
  }

  const reply = await withRetry(() => prisma.$transaction(async (tx) => {
    const newReply = await tx.ticketReply.create({
      data: {
        ticketId: ticket.id,
        authorId: userId,
        message: parsed.data.message,
        isStaffReply: false
      }
    });

    if (ticket.status === 'RESOLVED') {
      await tx.supportTicket.update({
        where: { id: ticket.id },
        data: { status: 'OPEN' }
      });
    }

    return newReply;
  }));

  res.json({ data: reply });
});

// ─── Staff Routes ────────────────────────────────────────────────────────────

// GET /api/support/ — List all tickets
supportRouter.get('/', requireSupport(), async (req: Request, res: Response) => {
  const status = req.query.status as string;
  const type = req.query.type as string;
  const search = req.query.search as string;

  const where: any = {};
  if (status && status !== 'All') where.status = status;
  if (type && type !== 'All') where.type = type;
  if (search) {
    where.OR = [
      { subject: { contains: search, mode: 'insensitive' } },
      { user: { email: { contains: search, mode: 'insensitive' } } }
    ];
  }

  const tickets = await withRetry(() => prisma.supportTicket.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      user: { select: { name: true, email: true } },
      _count: { select: { replies: true } }
    }
  }));

  // Strip payment details from list for safety
  const safeTickets = tickets.map(({ paymentId, orderId, ...rest }) => rest);

  res.json({ data: safeTickets });
});

// GET /api/support/:id — Ticket detail (Admin)
supportRouter.get('/:id', requireSupport(), async (req: Request, res: Response) => {
  const ticket = await withRetry(() => prisma.supportTicket.findUnique({
    where: { id: String(req.params.id) },
    include: {
      replies: {
        orderBy: { createdAt: 'asc' },
        include: { author: { select: { name: true, role: true } } }
      },
      user: { select: { name: true, email: true } }
    }
  }));

  if (!ticket) {
    res.status(404).json({ error: 'Ticket not found' });
    return;
  }

  // Strip payment fields for SUPPORT_MANAGER
  const isLimitedRole = req.user!.role === 'SUPPORT_MANAGER';
  const response = {
    ...ticket,
    paymentId: isLimitedRole ? undefined : ticket.paymentId,
    orderId: isLimitedRole ? undefined : ticket.orderId,
  };

  res.json({ data: response });
});

// POST /api/support/:id/reply — Staff reply
supportRouter.post('/:id/reply', requireSupport(), async (req: Request, res: Response) => {
  const parsed = ReplyTicketSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  const ticket = await prisma.supportTicket.findUnique({ where: { id: String(req.params.id) } });
  if (!ticket) {
    res.status(404).json({ error: 'Ticket not found' });
    return;
  }

  const reply = await withRetry(() => prisma.$transaction(async (tx) => {
    const newReply = await tx.ticketReply.create({
      data: {
        ticketId: ticket.id,
        authorId: req.user!.userId,
        message: parsed.data.message,
        isStaffReply: true
      },
      include: { author: { select: { name: true, role: true } } }
    });

    if (ticket.status === 'OPEN') {
      await tx.supportTicket.update({
        where: { id: ticket.id },
        data: { status: 'IN_PROGRESS' }
      });
    }

    return newReply;
  }));

  res.json({ data: reply });
});

// PATCH /api/support/:id/status — Staff update status
supportRouter.patch('/:id/status', requireSupport(), async (req: Request, res: Response) => {
  const { status } = req.body;
  if (!['OPEN', 'IN_PROGRESS', 'RESOLVED'].includes(status)) {
    res.status(400).json({ error: 'Invalid status' });
    return;
  }

  const ticket = await withRetry(() => prisma.supportTicket.update({
    where: { id: String(req.params.id) },
    data: { status }
  }));

  res.json({ data: ticket });
});

// DELETE /api/support/:id — Super Admin hard delete
supportRouter.delete('/:id', requireSuperAdmin(), async (req: Request, res: Response) => {
  await withRetry(() => prisma.supportTicket.delete({
    where: { id: String(req.params.id) }
  }));
  res.json({ success: true });
});
