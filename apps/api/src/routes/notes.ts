import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth, requireAdmin, requireSuperAdmin } from '../middleware/auth';
import { upload } from '../middleware/upload';
import { uploadFile, getSignedViewUrl, deleteFile } from '../services/storage';
import { CreateNoteSchema } from '@ajitsir/shared';
import { randomUUID } from 'crypto';
import { Readable } from 'stream';

export const notesRouter = Router();

// GET /api/notes — public list (no fileKey exposed)
notesRouter.get('/', async (req: Request, res: Response) => {
  const { subjectId } = req.query;

  const notes = await prisma.note.findMany({
    where: subjectId ? { subjectId: String(subjectId) } : undefined,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      title: true,
      description: true,
      isPaid: true,
      pageCount: true,
      createdAt: true,
      updatedAt: true,
      subjectId: true,
      subject: { select: { id: true, name: true, nameMarathi: true, order: true } },
      // fileKey deliberately excluded
      // thumbnailKey excluded (only used server-side)
    },
  });
  res.json({ data: notes });
});

// GET /api/notes/:id/view-token — authenticated, returns a 5-min signed URL
// The raw PDF is fetched as bytes by the frontend — URL never exposed in DOM
notesRouter.get('/:id/view-token', requireAuth(), async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const note = await prisma.note.findUnique({ where: { id } });
  if (!note) {
    res.status(404).json({ error: 'Note not found' });
    return;
  }

  // MVP: all authenticated users can view all notes (no plan gating)
  // Future: add plan check here for freemium model

  // Log the view for analytics / abuse detection
  await prisma.noteView.create({
    data: {
      userId: req.user!.userId,
      noteId: note.id,
    },
  });

  // Return a 5-minute signed URL — never stored, only in-memory
  const url = await getSignedViewUrl(note.fileKey, 300);
  res.json({ data: { url } });
});

// POST /api/notes — admin uploads PDF to S3
notesRouter.post(
  '/',
  requireAdmin(),
  upload.single('file'),
  async (req: Request, res: Response) => {
    if (!req.file) {
      res.status(400).json({ error: 'PDF file is required' });
      return;
    }

    const parsed = CreateNoteSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
      return;
    }

    const fileKey = `notes/${randomUUID()}.pdf`;

    // Stream buffer to S3 — never touch disk
    const stream = Readable.from(req.file.buffer);
    await uploadFile(stream, fileKey, 'application/pdf');

    const note = await prisma.note.create({
      data: {
        title: parsed.data.title,
        description: parsed.data.description,
        subjectId: parsed.data.subjectId,
        isPaid: parsed.data.isPaid,
        fileKey,
      },
    });

    res.status(201).json({
      data: {
        id: note.id,
        title: note.title,
        description: note.description,
        subjectId: note.subjectId,
        isPaid: note.isPaid,
        pageCount: note.pageCount,
        createdAt: note.createdAt,
        // fileKey NOT returned
      },
    });
  }
);

// PATCH /api/notes/:id — admin updates note metadata
notesRouter.patch('/:id', requireAdmin(), async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const note = await prisma.note.findUnique({ where: { id } });
  if (!note) {
    res.status(404).json({ error: 'Note not found' });
    return;
  }

  const { title, description, subjectId, isPaid, pageCount } = req.body;
  const updated = await prisma.note.update({
    where: { id },
    data: {
      ...(title && { title }),
      ...(description !== undefined && { description }),
      ...(subjectId && { subjectId }),
      ...(isPaid !== undefined && { isPaid }),
      ...(pageCount !== undefined && { pageCount }),
    },
  });

  res.json({
    data: {
      id: updated.id,
      title: updated.title,
      description: updated.description,
      subjectId: updated.subjectId,
      isPaid: updated.isPaid,
      pageCount: updated.pageCount,
      createdAt: updated.createdAt,
    },
  });
});

// DELETE /api/notes/:id — admin
notesRouter.delete('/:id', requireSuperAdmin(), async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const note = await prisma.note.findUnique({ where: { id } });
  if (!note) {
    res.status(404).json({ error: 'Note not found' });
    return;
  }

  await deleteFile(note.fileKey);
  await prisma.note.delete({ where: { id } });

  res.json({ data: { message: 'Note deleted' } });
});
