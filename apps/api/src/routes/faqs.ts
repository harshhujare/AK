import { Router, Request, Response } from 'express';
import { prisma, withRetry } from '../lib/prisma';
import { requireSupport } from '../middleware/auth';
import { CreateFAQSchema, UpdateFAQSchema } from '@ajitsir/shared';

export const faqsRouter = Router();

// GET /api/faqs/ — Public list of active FAQs
faqsRouter.get('/', async (_req: Request, res: Response) => {
  const faqs = await withRetry(() => prisma.fAQ.findMany({
    where: { isActive: true },
    orderBy: [
      { category: 'asc' },
      { order: 'asc' }
    ]
  }));
  res.json({ data: faqs });
});

// GET /api/faqs/all — Staff list of all FAQs
faqsRouter.get('/all', requireSupport(), async (_req: Request, res: Response) => {
  const faqs = await withRetry(() => prisma.fAQ.findMany({
    orderBy: [
      { category: 'asc' },
      { order: 'asc' }
    ]
  }));
  res.json({ data: faqs });
});

// POST /api/faqs/ — Create FAQ (Staff)
faqsRouter.post('/', requireSupport(), async (req: Request, res: Response) => {
  const parsed = CreateFAQSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  const faq = await withRetry(() => prisma.fAQ.create({
    data: parsed.data
  }));
  
  res.json({ data: faq });
});

// PATCH /api/faqs/:id — Update FAQ (Staff)
faqsRouter.patch('/:id', requireSupport(), async (req: Request, res: Response) => {
  const parsed = UpdateFAQSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  const faq = await withRetry(() => prisma.fAQ.update({
    where: { id: String(req.params.id) },
    data: parsed.data
  }));

  res.json({ data: faq });
});

// DELETE /api/faqs/:id — Delete FAQ (Staff)
faqsRouter.delete('/:id', requireSupport(), async (req: Request, res: Response) => {
  await withRetry(() => prisma.fAQ.delete({
    where: { id: String(req.params.id) }
  }));
  res.json({ success: true });
});
