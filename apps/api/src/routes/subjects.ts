import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { requireAdmin } from '../middleware/auth';
import { CreateSubjectSchema } from '@ajitsir/shared';

export const subjectsRouter = Router();

// GET /api/subjects — public
subjectsRouter.get('/', async (_req: Request, res: Response) => {
  const subjects = await prisma.subject.findMany({
    orderBy: { name: 'asc' },
  });
  res.json({ data: subjects });
});

// POST /api/subjects — admin only
subjectsRouter.post('/', requireAdmin(), async (req: Request, res: Response) => {
  const parsed = CreateSubjectSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }
  const subject = await prisma.subject.create({ data: parsed.data });
  res.status(201).json({ data: subject });
});
