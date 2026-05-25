import { Router, Request, Response } from 'express';
import { prisma, withRetry } from '../lib/prisma';
import { requireAuth, requireAdmin, requireSuperAdmin } from '../middleware/auth';
import { upload } from '../middleware/upload';
import { uploadFile, getFileStream, deleteFile } from '../services/storage';
import { CreateNoteSchema } from '@ajitsir/shared';
import { asyncHandler } from '../lib/asyncHandler';
import { randomUUID } from 'crypto';

export const notesRouter = Router();

// GET /api/notes — public list (no fileKey exposed)
notesRouter.get('/', asyncHandler(async (req: Request, res: Response) => {
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
}));

// GET /api/notes/:id/stream — authenticated, streams PDF bytes through the API
// This avoids CORS issues with direct S3 access. The S3 URL is never sent to the browser.
notesRouter.get('/:id/stream', requireAuth(), asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const note = await withRetry(() => prisma.note.findUnique({ where: { id } }));
  if (!note) {
    res.status(404).json({ error: 'Note not found' });
    return;
  }

  // Log the view for analytics
  await withRetry(() => prisma.noteView.create({
    data: { userId: req.user!.userId, noteId: note.id },
  })).catch(() => { /* non-critical, don't fail the stream */ });

  // Fetch from S3 and pipe directly to the response
  const s3Object = await getFileStream(note.fileKey);

  if (!s3Object.Body) {
    res.status(404).json({ error: 'File not found in storage' });
    return;
  }

  // Set headers so the browser treats it as a PDF but won't cache the URL
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (s3Object.ContentLength) {
    res.setHeader('Content-Length', s3Object.ContentLength);
  }

  // Stream S3 body directly to HTTP response
  const { Readable } = await import('stream');
  const readable = s3Object.Body as unknown as AsyncIterable<Uint8Array>;
  Readable.from(readable).pipe(res);
}));

// POST /api/notes — admin uploads PDF to S3
notesRouter.post(
  '/',
  requireAdmin(),
  upload.single('file'),
  asyncHandler(async (req: Request, res: Response) => {
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

    // Pass the Buffer directly — AWS SDK v3 sets Content-Length automatically for Buffers.
    // Do NOT convert to Readable.from() without Content-Length; the SDK will throw.
    await uploadFile(req.file.buffer, fileKey, 'application/pdf');

    // Save metadata to DB — wrapped in withRetry to handle Neon cold-start
    const note = await withRetry(() => prisma.note.create({
      data: {
        title: parsed.data.title,
        description: parsed.data.description,
        subjectId: parsed.data.subjectId,
        isPaid: parsed.data.isPaid,
        fileKey,
      },
    }));

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
  })
);

// PATCH /api/notes/:id — admin updates note metadata
notesRouter.patch('/:id', requireAdmin(), asyncHandler(async (req: Request, res: Response) => {
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
}));

// DELETE /api/notes/:id — admin
notesRouter.delete('/:id', requireSuperAdmin(), asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const note = await prisma.note.findUnique({ where: { id } });
  if (!note) {
    res.status(404).json({ error: 'Note not found' });
    return;
  }

  await deleteFile(note.fileKey);
  await prisma.note.delete({ where: { id } });

  res.json({ data: { message: 'Note deleted' } });
}));
