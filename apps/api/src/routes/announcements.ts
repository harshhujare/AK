import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { requireAdmin, requireSuperAdmin } from '../middleware/auth';
import { AnnouncementType } from '@prisma/client';
import { asyncHandler } from '../lib/asyncHandler';
import { uploadImage } from '../middleware/upload';
import { uploadFile, getFileStream, deleteFile } from '../services/storage';
import { randomUUID } from 'crypto';

export const announcementsRouter = Router();

// GET /api/announcements — public, returns active announcements ordered by `order` field
announcementsRouter.get('/', asyncHandler(async (_req: Request, res: Response) => {
  const announcements = await prisma.announcement.findMany({
    where: { isActive: true },
    orderBy: { order: 'asc' },
    select: {
      id: true,
      title: true,
      description: true,
      type: true,
      youtubeUrl: true,
      isActive: true,
      order: true,
      createdAt: true,
      // imageKey is  deliberately NOT returned to the client, they use the /image endpoint
    },
  });
  res.json({ data: announcements });
}));

// GET /api/announcements/all — admin, returns ALL announcements including inactive
announcementsRouter.get('/all', requireAdmin(), asyncHandler(async (_req: Request, res: Response) => {
  const announcements = await prisma.announcement.findMany({
    orderBy: { order: 'asc' },
  });
  res.json({ data: announcements });
}));

// GET /api/announcements/:id/image — public streaming of announcement image
announcementsRouter.get('/:id/image', asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const ann = await prisma.announcement.findUnique({ where: { id } });
  
  if (!ann || !ann.imageKey) {
    res.status(404).json({ error: 'Image not found' });
    return;
  }

  const s3Object = await getFileStream(ann.imageKey);

  if (!s3Object.Body) {
    res.status(404).json({ error: 'Image not found in storage' });
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

// POST /api/announcements — admin creates announcement
announcementsRouter.post('/', requireAdmin(), uploadImage.single('file'), asyncHandler(async (req: Request, res: Response) => {
  // Use req.body for form fields (FormData sends strings)
  const title = req.body.title;
  const description = req.body.description;
  const type = req.body.type;
  const youtubeUrl = req.body.youtubeUrl;
  const isActive = req.body.isActive === 'true' || req.body.isActive === true;
  const order = req.body.order !== undefined ? parseInt(req.body.order) : 0;
  
  const file = req.file;

  if (!title) {
    res.status(400).json({ error: 'Title is required' });
    return;
  }

  if (type === 'VIDEO' && !youtubeUrl) {
    res.status(400).json({ error: 'youtubeUrl is required for VIDEO type announcements' });
    return;
  }

  if (type === 'IMAGE' && !file) {
    res.status(400).json({ error: 'Image file is required for IMAGE type announcements' });
    return;
  }

  let imageKey: string | undefined;

  if (type === 'IMAGE' && file) {
    imageKey = `announcements/${randomUUID()}.jpg`;
    await uploadFile(file.buffer, imageKey, file.mimetype);
  }

  const announcement = await prisma.announcement.create({
    data: {
      title,
      description: description || null,
      type: type || 'IMAGE',
      youtubeUrl: youtubeUrl || null,
      imageKey: imageKey || null,
      isActive: isActive,
      order: order,
    },
  });

  res.status(201).json({ data: announcement });
}));

// PATCH /api/announcements/:id — admin updates / reorders / toggles active
announcementsRouter.patch('/:id', requireAdmin(), uploadImage.single('file'), asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const existing = await prisma.announcement.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: 'Announcement not found' });
    return;
  }

  const { title, description, type, youtubeUrl } = req.body;
  const isActive = req.body.isActive !== undefined ? (req.body.isActive === 'true' || req.body.isActive === true) : undefined;
  const order = req.body.order !== undefined ? parseInt(req.body.order) : undefined;
  const file = req.file;

  // Build update payload — only include provided fields
  const data: {
    title?: string;
    description?: string | null;
    type?: AnnouncementType;
    youtubeUrl?: string | null;
    imageKey?: string | null;
    isActive?: boolean;
    order?: number;
  } = {};

  if (title !== undefined) data.title = title;
  if (description !== undefined) data.description = description;
  if (type !== undefined) data.type = type as AnnouncementType;
  if (youtubeUrl !== undefined) data.youtubeUrl = youtubeUrl;
  if (isActive !== undefined) data.isActive = isActive;
  if (order !== undefined) data.order = order;

  if (file) {
    // If updating the image, delete old one and upload new
    if (existing.imageKey) {
      await deleteFile(existing.imageKey).catch(() => {});
    }
    const imageKey = `announcements/${randomUUID()}.jpg`;
    await uploadFile(file.buffer, imageKey, file.mimetype);
    data.imageKey = imageKey;
  }

  if (Object.keys(data).length === 0) {
    res.status(400).json({ error: 'No fields provided to update' });
    return;
  }

  const updated = await prisma.announcement.update({
    where: { id },
    data,
  });

  res.json({ data: updated });
}));

// DELETE /api/announcements/:id — admin only
announcementsRouter.delete('/:id', requireAdmin(), asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const existing = await prisma.announcement.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: 'Announcement not found' });
    return;
  }

  if (existing.imageKey) {
    await deleteFile(existing.imageKey).catch(() => {});
  }

  await prisma.announcement.delete({ where: { id } });
  res.json({ data: { message: 'Announcement deleted' } });
}));
