import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth, requireAdmin } from '../middleware/auth';
import {
  CreateTestSchema,
  UpdateTestSchema,
  CreateQuestionSchema,
  SubmitAttemptSchema,
} from '@ajitsir/shared';
import type { Question } from '@prisma/client';

export const testsRouter = Router();

// ─── Public ───────────────────────────────────────────────────────────────────

// GET /api/tests — list all tests
testsRouter.get('/', async (_req: Request, res: Response) => {
  const tests = await prisma.test.findMany({
    include: {
      subject: true,
      _count: { select: { questions: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ data: tests });
});

// ─── Student ──────────────────────────────────────────────────────────────────

// GET /api/tests/attempts/me — own history
testsRouter.get('/attempts/me', requireAuth(), async (req: Request, res: Response) => {
  const attempts = await prisma.testAttempt.findMany({
    where: { userId: req.user!.userId },
    include: { test: { select: { id: true, title: true, subjectId: true } } },
    orderBy: { completedAt: 'desc' },
  });
  res.json({ data: attempts });
});

// GET /api/tests/:id — get test with questions (NO correctOption)
testsRouter.get('/:id', requireAuth(), async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const test = await prisma.test.findUnique({
    where: { id },
    include: {
      subject: true,
      questions: {
        orderBy: { order: 'asc' },
        select: {
          id: true,
          text: true,
          options: true,
          order: true,
          // ⚠️ correctOption and explanation deliberately EXCLUDED here
        },
      },
    },
  });

  if (!test) {
    res.status(404).json({ error: 'Test not found' });
    return;
  }

  // Gate paid tests (admins bypass)
  const role = req.user!.role;
  if (test.isPaid && req.user!.plan === 'FREE' && role !== 'SUPER_ADMIN' && role !== 'CONTENT_MANAGER') {
    res.status(403).json({ error: 'This test requires a paid subscription' });
    return;
  }

  res.json({ data: test });
});

// POST /api/tests/:id/attempt — submit answers
testsRouter.post('/:id/attempt', requireAuth(), async (req: Request, res: Response) => {
  const parsed = SubmitAttemptSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  const id = String(req.params.id);
  const test = await prisma.test.findUnique({
    where: { id },
    include: { questions: { orderBy: { order: 'asc' } } },
  });

  if (!test) {
    res.status(404).json({ error: 'Test not found' });
    return;
  }

  const role = req.user!.role;
  if (test.isPaid && req.user!.plan === 'FREE' && role !== 'SUPER_ADMIN' && role !== 'CONTENT_MANAGER') {
    res.status(403).json({ error: 'Paid subscription required' });
    return;
  }

  // ─── Server-side scoring (never trust client) ─────────────────────────────
  const { answers, timeTaken } = parsed.data;
  let score = 0;
  const totalMarks = test.questions.length;

  const breakdown = test.questions.map((q: Question) => {
    const selected = answers[q.id] || null;
    const isCorrect = selected === q.correctOption;
    if (isCorrect) score++;
    return {
      questionId: q.id,
      questionText: q.text,
      selected,
      correct: q.correctOption,
      explanation: q.explanation ?? undefined,
      isCorrect,
    };
  });

  const attempt = await prisma.testAttempt.create({
    data: {
      userId: req.user!.userId,
      testId: test.id,
      answers,
      score,
      totalMarks,
      timeTaken,
    },
  });

  res.status(201).json({
    data: {
      ...attempt,
      percentage: Math.round((score / totalMarks) * 100),
      breakdown,
    },
  });
});

// ─── Admin ────────────────────────────────────────────────────────────────────

// POST /api/tests — create test with questions
testsRouter.post('/', requireAdmin(), async (req: Request, res: Response) => {
  const parsed = CreateTestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  const questions: typeof req.body.questions = req.body.questions || [];
  const parsedQs = questions.map((q: unknown) => CreateQuestionSchema.parse(q));

  const { title, description, subjectId, isPaid } = parsed.data;

  const test = await prisma.test.create({
    data: {
      title,
      description,
      isPaid,
      subject: {
        connect: { id: subjectId },
      },
      questions: {
        create: parsedQs,
      },
    },
    include: { questions: true },
  });

  res.status(201).json({ data: test });
});

// PUT /api/tests/:id — update test metadata
testsRouter.put('/:id', requireAdmin(), async (req: Request, res: Response) => {
  const parsed = UpdateTestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  const test = await prisma.test.update({
    where: { id: String(req.params.id) },
    data: parsed.data,
  });

  res.json({ data: test });
});

// DELETE /api/tests/:id
testsRouter.delete('/:id', requireAdmin(), async (req: Request, res: Response) => {
  const id = String(req.params.id);
  await prisma.testAttempt.deleteMany({ where: { testId: id } });
  await prisma.test.delete({ where: { id } });
  res.json({ data: { message: 'Test deleted' } });
});
