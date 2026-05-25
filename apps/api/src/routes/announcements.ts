import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { requireAdmin, requireSuperAdmin } from '../middleware/auth';
import { AnnouncementType } from '@prisma/client';
import { asyncHandler } from '../lib/asyncHandler';

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

// POST /api/announcements — admin creates announcement
announcementsRouter.post('/', requireAdmin(), asyncHandler(async (req: Request, res: Response) => {
  const { title, description, type, youtubeUrl, isActive, order } = req.body;

  if (!title) {
    res.status(400).json({ error: 'Title is required' });
    return;
  }

  if (type === 'VIDEO' && !youtubeUrl) {
    res.status(400).json({ error: 'youtubeUrl is required for VIDEO type announcements' });
    return;
  }

  const announcement = await prisma.announcement.create({
    data: {
      title,
      description: description || null,
      type: type || 'TEXT',
      youtubeUrl: youtubeUrl || null,
      isActive: isActive !== undefined ? isActive : true,
      order: order !== undefined ? order : 0,
    },
  });

  res.status(201).json({ data: announcement });
}));

// PATCH /api/announcements/:id — admin updates / reorders / toggles active
announcementsRouter.patch('/:id', requireAdmin(), asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const existing = await prisma.announcement.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: 'Announcement not found' });
    return;
  }

  const { title, description, type, youtubeUrl, isActive, order } = req.body;

  // Build update payload — only include provided fields
  const data: {
    title?: string;
    description?: string | null;
    type?: AnnouncementType;
    youtubeUrl?: string | null;
    isActive?: boolean;
    order?: number;
  } = {};

  if (title !== undefined) data.title = title;
  if (description !== undefined) data.description = description;
  if (type !== undefined) data.type = type as AnnouncementType;
  if (youtubeUrl !== undefined) data.youtubeUrl = youtubeUrl;
  if (isActive !== undefined) data.isActive = isActive;
  if (order !== undefined) data.order = order;

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

// DELETE /api/announcements/:id — super admin only
announcementsRouter.delete('/:id', requireSuperAdmin(), asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const existing = await prisma.announcement.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: 'Announcement not found' });
    return;
  }

  await prisma.announcement.delete({ where: { id } });
  res.json({ data: { message: 'Announcement deleted' } });
}));
