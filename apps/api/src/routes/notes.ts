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
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, parseInt(req.query.limit as string) || 20);
  const search = (req.query.search as string) || '';

  const where: any = {};
  if (subjectId) where.subjectId = String(subjectId);
  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
      { subject: { name: { contains: search, mode: 'insensitive' } } }
    ];
  }

  const [notes, total] = await withRetry(() => Promise.all([
    prisma.note.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        description: true,
        isPaid: true,
        accessType: true,
        pageCount: true,
        createdAt: true,
        updatedAt: true,
        subjectId: true,
        subject: { select: { id: true, name: true, nameMarathi: true, order: true } },
        // fileKey deliberately excluded
        // thumbnailKey excluded (only used server-side)
      },
    }),
    prisma.note.count({ where }),
  ]));

  res.json({ data: { notes, total, page, limit, totalPages: Math.ceil(total / limit) } });
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

  if (note.isPaid) {
    const { role, plan } = req.user!;
    const isAdmin = role === 'SUPER_ADMIN' || role === 'CONTENT_MANAGER';

    if (!isAdmin) {
      const dbUser = await withRetry(() =>
        prisma.user.findUnique({
          where: { id: req.user!.userId },
          select: { plan: true, planExpiresAt: true, paidAt: true },
        })
      );

      if (note.accessType === 'LIFETIME') {
        // LIFETIME notes: check if the user has ever paid (paidAt is set permanently)
        if (!dbUser?.paidAt) {
          res.status(403).json({ error: 'This note requires a paid subscription' });
          return;
        }
      } else {
        // TIMED notes: active paid plan required. Check DB truth as well as JWT
        // so a just-paid user with an older FREE token is not incorrectly denied.
        const hasLivePaidPlan =
          dbUser?.plan === 'PAID' &&
          (!dbUser.planExpiresAt || dbUser.planExpiresAt > new Date());

        if (plan !== 'PAID' && !hasLivePaidPlan) {
          res.status(403).json({ error: 'This note requires an active paid subscription' });
          return;
        }
      }
    }
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
  // ETag lets the client detect if the admin has re-uploaded this note
  res.setHeader('ETag', `"note-${note.id}-${note.updatedAt.getTime()}"`);
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
  upload.fields([{ name: 'file', maxCount: 1 }, { name: 'thumbnail', maxCount: 1 }]),
  asyncHandler(async (req: Request, res: Response) => {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const file = files?.['file']?.[0];
    const thumbnail = files?.['thumbnail']?.[0];

    if (!file) {
      res.status(400).json({ error: 'PDF file is required' });
      return;
    }

    const parsed = CreateNoteSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
      return;
    }

    const noteId = randomUUID();
    const fileKey = `notes/${noteId}.pdf`;
    let thumbnailKey: string | undefined;

    // Pass the Buffer directly — AWS SDK v3 sets Content-Length automatically for Buffers.
    // Do NOT convert to Readable.from() without Content-Length; the SDK will throw.
    await uploadFile(file.buffer, fileKey, 'application/pdf');

    if (thumbnail) {
      thumbnailKey = `notes/thumbnails/${noteId}.jpg`;
      await uploadFile(thumbnail.buffer, thumbnailKey, 'image/jpeg');
    }

    // Save metadata to DB — wrapped in withRetry to handle Neon cold-start
    const note = await withRetry(() => prisma.note.create({
      data: {
        title: parsed.data.title,
        description: parsed.data.description,
        subjectId: parsed.data.subjectId,
        isPaid: parsed.data.isPaid,
        accessType: (parsed.data as any).accessType ?? 'TIMED',
        fileKey,
        thumbnailKey,
      },
    }));

    res.status(201).json({
      data: {
        id: note.id,
        title: note.title,
        description: note.description,
        subjectId: note.subjectId,
        isPaid: note.isPaid,
        accessType: note.accessType,
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

  const { title, description, subjectId, isPaid, accessType, pageCount } = req.body;
  const updated = await prisma.note.update({
    where: { id },
    data: {
      ...(title && { title }),
      ...(description !== undefined && { description }),
      ...(subjectId && { subjectId }),
      ...(isPaid !== undefined && { isPaid }),
      ...(accessType !== undefined && { accessType }),
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
      accessType: updated.accessType,
      pageCount: updated.pageCount,
      createdAt: updated.createdAt,
    },
  });
}));

// DELETE /api/notes/:id — admin
notesRouter.delete('/:id', requireAdmin(), asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const note = await prisma.note.findUnique({ where: { id } });
  if (!note) {
    res.status(404).json({ error: 'Note not found' });
    return;
  }

  await deleteFile(note.fileKey);
  if (note.thumbnailKey) {
    await deleteFile(note.thumbnailKey);
  }
  await prisma.noteView.deleteMany({ where: { noteId: id } });
  await prisma.note.delete({ where: { id } });

  res.json({ data: { message: 'Note deleted' } });
}));

// GET /api/notes/:id/thumbnail — public streaming of thumbnail
notesRouter.get('/:id/thumbnail', asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const note = await withRetry(() => prisma.note.findUnique({ where: { id } }));
  if (!note || !note.thumbnailKey) {
    res.status(404).json({ error: 'Thumbnail not found' });
    return;
  }

  const s3Object = await getFileStream(note.thumbnailKey);

  if (!s3Object.Body) {
    res.status(404).json({ error: 'Thumbnail not found in storage' });
    return;
  }

  res.setHeader('Content-Type', s3Object.ContentType || 'image/jpeg');
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  if (s3Object.ContentLength) {
    res.setHeader('Content-Length', s3Object.ContentLength);
  }

  const { Readable } = await import('stream');
  const readable = s3Object.Body as unknown as AsyncIterable<Uint8Array>;
  Readable.from(readable).pipe(res);
}));
