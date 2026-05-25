import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { requireAdmin, requireSuperAdmin } from '../middleware/auth';
import { CreateSubjectSchema } from '@ajitsir/shared';
import { asyncHandler } from '../lib/asyncHandler';

export const subjectsRouter = Router();

// GET /api/subjects — public
subjectsRouter.get('/', asyncHandler(async (_req: Request, res: Response) => {
  const subjects = await prisma.subject.findMany({
    orderBy: { order: 'asc' },
  });
  res.json({ data: subjects });
}));

// POST /api/subjects — admin only
subjectsRouter.post('/', requireAdmin(), asyncHandler(async (req: Request, res: Response) => {
  const parsed = CreateSubjectSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }
  const subject = await prisma.subject.create({ data: parsed.data });
  res.status(201).json({ data: subject });
}));

// DELETE /api/subjects/:id — super admin only
subjectsRouter.delete('/:id', requireSuperAdmin(), asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const noteCount = await prisma.note.count({ where: { subjectId: id } });
  if (noteCount > 0) {
    res.status(409).json({ error: `Cannot delete: ${noteCount} note(s) are attached to this subject. Delete the notes first.` });
    return;
  }
  await prisma.subject.delete({ where: { id } });
  res.json({ data: { message: 'Subject deleted' } });
}));
