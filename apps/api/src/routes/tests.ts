import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth, requireAdmin } from '../middleware/auth';
import {
  CreateTestSchema,
  UpdateTestSchema,
  CreateQuestionSchema,
  SubmitAttemptSchema,
} from '@ajitsir/shared';
// Import Question for type annotation. TestType is imported directly to avoid
// the $Enums namespace which can fail in IDEs with a stale TS server cache.
import type { Question, Prisma, TestType } from '@prisma/client';


export const testsRouter = Router();

// ─── Public ───────────────────────────────────────────────────────────────────

/**
 * GET /api/tests
 * Lists tests visible to the caller.
 *
 * Query params:
 *   type=DAILY|PREDEFINED|SUBJECT
 *   subjectId=<cuid>
 *   date=YYYY-MM-DD   (for DAILY: returns test whose scheduledAt falls on that day)
 *
 * Students always receive only isPublished=true tests.
 * Admins/Content Managers can pass ?published=false to see drafts.
 */
testsRouter.get('/', async (req: Request, res: Response) => {
  const { type, subjectId, date, published } = req.query;

  // Determine whether to filter by isPublished.
  // Default: only published. Admin can explicitly request drafts via ?published=false.
  const showDrafts = published === 'false';

  const where: Prisma.TestWhereInput = {
    ...(showDrafts ? {} : { isPublished: true }),
  };

  if (type) {
    where.type = type as TestType;
  }

  if (subjectId) {
    where.subjectId = String(subjectId);
  }

  // Date filter for DAILY tests: find the test whose scheduledAt falls within that calendar day
  if (date && type === 'DAILY') {
    const day = new Date(String(date));
    if (!isNaN(day.getTime())) {
      const nextDay = new Date(day);
      nextDay.setUTCDate(day.getUTCDate() + 1);
      where.scheduledAt = { gte: day, lt: nextDay };
    }
  }

  const tests = await prisma.test.findMany({
    where,
    include: {
      subject: true,
      _count: { select: { questions: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  res.json({ data: tests });
});

// ─── Student ──────────────────────────────────────────────────────────────────

/**
 * GET /api/tests/attempts/me
 * Returns the authenticated student's attempt history — paginated.
 *
 * Query params:
 *   limit=20      (max 50)
 *   cursor=<cuid> (last id from previous page)
 */
testsRouter.get('/attempts/me', requireAuth(), async (req: Request, res: Response) => {
  const limit = Math.min(Number(req.query.limit) || 20, 50);
  const cursor = req.query.cursor ? String(req.query.cursor) : undefined;

  const attempts = await prisma.testAttempt.findMany({
    where:   { userId: req.user!.userId },
    include: { test: { select: { id: true, title: true, subjectId: true } } },
    orderBy: { completedAt: 'desc' },
    take:    limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = attempts.length > limit;
  if (hasMore) attempts.pop();
  const nextCursor = hasMore ? attempts.at(-1)?.id ?? null : null;

  res.json({ data: attempts, nextCursor, hasMore });
});

/**
 * GET /api/tests/:id
 * Returns test metadata + questions for students.
 * correctOption and explanation are deliberately excluded (server-side scoring only).
 * Enforces plan gate for paid tests.
 */
testsRouter.get('/:id', requireAuth(), async (req: Request, res: Response) => {
  const id = String(req.params.id);

  const test = await prisma.test.findUnique({
    where: { id },
    include: {
      subject: true,
      questions: {
        orderBy: { order: 'asc' },
        select: {
          id:      true,
          text:    true,
          options: true,
          order:   true,
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
  if (
    test.isPaid &&
    req.user!.plan === 'FREE' &&
    role !== 'SUPER_ADMIN' &&
    role !== 'CONTENT_MANAGER'
  ) {
    res.status(403).json({ error: 'This test requires a paid subscription' });
    return;
  }

  res.json({ data: test });
});

/**
 * GET /api/tests/:id/attempt/:attemptId
 * Fallback endpoint for the result page when IndexedDB is empty (e.g. new device).
 * Reconstructs the full breakdown server-side from stored answers + correctOption.
 * Only returns attempts belonging to the authenticated user.
 */
testsRouter.get('/:id/attempt/:attemptId', requireAuth(), async (req: Request, res: Response) => {
  const attempt = await prisma.testAttempt.findFirst({
    where: {
      id:     String(req.params.attemptId),
      testId: String(req.params.id),
      userId: req.user!.userId,
    },
    include: {
      test: {
        include: {
          questions: { orderBy: { order: 'asc' } },
        },
      },
    },
  });

  if (!attempt) {
    res.status(404).json({ error: 'Attempt not found' });
    return;
  }

  const answers = attempt.answers as Record<string, string>;

  // Reconstruct breakdown with correctOption (server-side only — never sent in GET /tests/:id)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const questions = (attempt as any).test?.questions ?? [];
  const breakdown = questions.map((q: Question) => ({
    questionId:   q.id,
    questionText: q.text,
    selected:     answers[q.id] ?? null,
    correct:      q.correctOption,
    explanation:  q.explanation ?? undefined,
    isCorrect:    answers[q.id] === q.correctOption,
  }));

  res.json({
    data: {
      ...attempt,
      percentage: Math.round((attempt.score / attempt.totalMarks) * 100),
      breakdown,
    },
  });
});

/**
 * POST /api/tests/:id/attempt
 * Scores a student's answers server-side and persists the TestAttempt.
 * Score is NEVER calculated on the frontend — this is the source of truth.
 */
testsRouter.post('/:id/attempt', requireAuth(), async (req: Request, res: Response) => {
  const parsed = SubmitAttemptSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  const id = String(req.params.id);
  const test = await prisma.test.findUnique({
    where:   { id },
    include: { questions: { orderBy: { order: 'asc' } } },
  });

  if (!test) {
    res.status(404).json({ error: 'Test not found' });
    return;
  }

  const role = req.user!.role;
  if (
    test.isPaid &&
    req.user!.plan === 'FREE' &&
    role !== 'SUPER_ADMIN' &&
    role !== 'CONTENT_MANAGER'
  ) {
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
      questionId:   q.id,
      questionText: q.text,
      selected,
      correct:      q.correctOption,
      explanation:  q.explanation ?? undefined,
      isCorrect,
    };
  });

  const attempt = await prisma.testAttempt.create({
    data: {
      userId:     req.user!.userId,
      testId:     test.id,
      answers,
      score,
      totalMarks,
      timeTaken:  timeTaken !== undefined ? timeTaken : null,
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

/**
 * GET /api/tests/:id/percentile
 * Returns the student's percentile for their best attempt on this test.
 * Server-side guard: returns { percentile: null } when total attempts < 10.
 * This prevents an expensive COUNT query for low-traffic tests.
 */
testsRouter.get('/:id/percentile', requireAuth(), async (req: Request, res: Response) => {
  const testId = req.params.id;

  // ── Server-side minimum threshold guard ──────────────────────────────────
  const total = await prisma.testAttempt.count({ where: { testId: String(req.params.id) } });
  if (total < 10) {
    res.json({ data: { percentile: null, reason: 'insufficient_data', total } });
    return;
  }

  const myAttempt = await prisma.testAttempt.findFirst({
    where:   { testId: String(req.params.id), userId: req.user!.userId },
    orderBy: { completedAt: 'desc' },
    select:  { score: true },
  });

  if (!myAttempt) {
    res.status(404).json({ error: 'No attempt found for this user on this test' });
    return;
  }

  const below = await prisma.testAttempt.count({
    where: { testId: String(req.params.id), score: { lt: myAttempt.score } },
  });

  res.json({ data: { percentile: Math.round((below / total) * 100), total } });
});

// ─── Admin ────────────────────────────────────────────────────────────────────

/**
 * POST /api/tests
 * Creates a test with optional questions in one request.
 */
testsRouter.post('/', requireAdmin(), async (req: Request, res: Response) => {
  const parsed = CreateTestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  const rawQuestions: unknown[] = req.body.questions || [];
  const parsedQs = rawQuestions.map((q) => CreateQuestionSchema.parse(q));

  const {
    title, description, subjectId, isPaid,
    type, timeLimitSec, scheduledAt, expiresAt, isPublished,
  } = parsed.data;

  const test = await prisma.test.create({
    data: {
      title,
      description,
      isPaid,
      type,
      timeLimitSec: timeLimitSec ?? null,
      scheduledAt:  scheduledAt ? new Date(scheduledAt) : null,
      expiresAt:    expiresAt   ? new Date(expiresAt)   : null,
      isPublished:  isPublished ?? false,
      subject: { connect: { id: subjectId } },
      questions: { create: parsedQs },
    },
    include: { questions: true },
  });

  res.status(201).json({ data: test });
});

/**
 * PUT /api/tests/:id
 * Full update of test metadata (replaces all updatable fields).
 */
testsRouter.put('/:id', requireAdmin(), async (req: Request, res: Response) => {
  const parsed = UpdateTestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  const { scheduledAt, expiresAt, ...rest } = parsed.data;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const test = await (prisma.test as any).update({
    where: { id: String(req.params.id) },
    data:  {
      ...rest,
      ...(scheduledAt !== undefined ? { scheduledAt: scheduledAt ? new Date(scheduledAt) : null } : {}),
      ...(expiresAt   !== undefined ? { expiresAt:   expiresAt   ? new Date(expiresAt)   : null } : {}),
    },
  });

  res.json({ data: test });
});

/**
 * PATCH /api/tests/:id
 * Inline publish/unpublish toggle — single-field update used by the admin list table.
 * Does not require a full PUT body.
 */
testsRouter.patch('/:id', requireAdmin(), async (req: Request, res: Response) => {
  if (typeof req.body.isPublished !== 'boolean') {
    res.status(400).json({ error: 'isPublished must be a boolean' });
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const test = await (prisma.test as any).update({
    where: { id: String(req.params.id) },
    data:  { isPublished: req.body.isPublished },
  });

  res.json({ data: test });
});

/**
 * DELETE /api/tests/:id
 * Deletes a test and all its attempts (cascades via Prisma).
 */
testsRouter.delete('/:id', requireAdmin(), async (req: Request, res: Response) => {
  const id = String(req.params.id);
  await prisma.testAttempt.deleteMany({ where: { testId: id } });
  await prisma.test.delete({ where: { id } });
  res.json({ data: { message: 'Test deleted' } });
});

// ─── Per-question CRUD (admin only) ──────────────────────────────────────────

/**
 * GET /api/tests/:id/questions
 * Admin-only: returns questions WITH correctOption (for the question editor).
 * Students never hit this route — GET /api/tests/:id excludes correctOption.
 */
testsRouter.get('/:id/questions', requireAdmin(), async (req: Request, res: Response) => {
  const questions = await prisma.question.findMany({
    where:   { testId: String(req.params.id) },
    orderBy: { order: 'asc' },
  });
  res.json({ data: questions });
});

/**
 * POST /api/tests/:id/questions
 * Adds a single question to an existing test.
 */
testsRouter.post('/:id/questions', requireAdmin(), async (req: Request, res: Response) => {
  const parsed = CreateQuestionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  const question = await prisma.question.create({
    data: { ...parsed.data, testId: String(req.params.id) },
  });

  res.status(201).json({ data: question });
});

/**
 * PUT /api/tests/:testId/questions/:qId
 * Edits an existing question (text, options, correctOption, explanation, order).
 */
testsRouter.put('/:testId/questions/:qId', requireAdmin(), async (req: Request, res: Response) => {
  const parsed = CreateQuestionSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  const question = await prisma.question.update({
    where: { id: String(req.params.qId) },
    data:  parsed.data,
  });

  res.json({ data: question });
});

/**
 * DELETE /api/tests/:testId/questions/:qId
 * Deletes a single question from a test.
 */
testsRouter.delete('/:testId/questions/:qId', requireAdmin(), async (req: Request, res: Response) => {
  await prisma.question.delete({ where: { id: String(req.params.qId) } });
  res.json({ data: { message: 'Question deleted' } });
});
