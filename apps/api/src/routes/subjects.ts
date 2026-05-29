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
  const { name, nameMarathi, order } = parsed.data;
  const subject = await prisma.subject.create({ data: { name, nameMarathi, order } });
  res.status(201).json({ data: subject });
}));

// PATCH /api/subjects/:id — admin only
subjectsRouter.patch('/:id', requireAdmin(), asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const subject = await prisma.subject.findUnique({ where: { id } });
  if (!subject) {
    res.status(404).json({ error: 'Subject not found' });
    return;
  }

  const { name, nameMarathi, order } = req.body;
  const data: { name?: string; nameMarathi?: string | null; order?: number } = {};
  if (name !== undefined) data.name = name;
  if (nameMarathi !== undefined) data.nameMarathi = nameMarathi || null;
  if (order !== undefined) data.order = parseInt(order);

  if (Object.keys(data).length === 0) {
    res.status(400).json({ error: 'No fields to update' });
    return;
  }

  const updated = await prisma.subject.update({ where: { id }, data });
  res.json({ data: updated });
}));

// DELETE /api/subjects/:id — admin only
subjectsRouter.delete('/:id', requireAdmin(), asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const noteCount = await prisma.note.count({ where: { subjectId: id } });
  if (noteCount > 0) {
    res.status(409).json({ error: `Cannot delete: ${noteCount} note(s) are attached to this subject. Delete the notes first.` });
    return;
  }
  await prisma.subject.delete({ where: { id } });
  res.json({ data: { message: 'Subject deleted' } });
}));
