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
 * Admins/Content Managers can pass ?published=false to see drafts — but ONLY
 * when authenticated with CONTENT_MANAGER or SUPER_ADMIN role.
 *
 * FIX (HIGH): showDrafts was previously based solely on the query string,
 * allowing any anonymous caller to list drafts.
 */
testsRouter.get('/', async (req: Request, res: Response) => {
  const { type, subjectId, date, published } = req.query;

  // Resolve the caller's role from the JWT (if present).
  // We don't use requireAuth() here so the list remains usable without login.
  let callerRole: string | null = null;
  try {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const { verifyAccessToken } = await import('../services/token');
      const payload = verifyAccessToken(authHeader.slice(7));
      callerRole = payload.role;
    }
  } catch {
    // Invalid / expired token → treat as unauthenticated
  }

  const isAdmin = callerRole === 'SUPER_ADMIN' || callerRole === 'CONTENT_MANAGER';

  // Only admins may request drafts — all other callers always get isPublished=true
  const showDrafts = isAdmin && published === 'false';

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
 * FIX (MEDIUM): cursor-based pagination now orders by [completedAt DESC, id DESC]
 * to give a stable total order even when multiple attempts share a timestamp.
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
    // FIX: secondary sort on id ensures stable pages when completedAt ties
    orderBy: [{ completedAt: 'desc' }, { id: 'desc' }],
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
 *
 * FIX (HIGH): now enforces isPublished=true and scheduledAt/expiresAt windows for
 * student roles — previously a student with the test ID could bypass draft visibility.
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

  const role = req.user!.role;
  const isAdmin = role === 'SUPER_ADMIN' || role === 'CONTENT_MANAGER';

  // FIX (HIGH): students may not access unpublished or time-windowed tests by ID.
  // Admins bypass these checks so they can preview draft/future tests.
  if (!isAdmin) {
    if (!test.isPublished) {
      res.status(404).json({ error: 'Test not found' });
      return;
    }

    const now = new Date();

    // For PREDEFINED tests: enforce the scheduledAt–expiresAt access window
    if (test.type === 'PREDEFINED') {
      if (test.scheduledAt && now < test.scheduledAt) {
        res.status(403).json({ error: 'This test is not yet available' });
        return;
      }
      if (test.expiresAt && now > test.expiresAt) {
        res.status(403).json({ error: 'This test has expired' });
        return;
      }
    }

    // For DAILY tests: enforce the scheduled calendar day only
    if (test.type === 'DAILY' && test.scheduledAt) {
      const testDay = new Date(test.scheduledAt);
      testDay.setUTCHours(0, 0, 0, 0);
      const nextDay = new Date(testDay);
      nextDay.setUTCDate(testDay.getUTCDate() + 1);
      if (now < testDay || now >= nextDay) {
        res.status(403).json({ error: 'This daily test is only available on its scheduled day' });
        return;
      }
    }
  }

  // Gate paid tests (admins bypass)
  if (
    test.isPaid &&
    req.user!.plan === 'FREE' &&
    !isAdmin
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
 *
 * FIX (HIGH): now enforces isPublished + scheduledAt/expiresAt before scoring,
 * so students cannot submit against unpublished or expired tests.
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
  const isAdmin = role === 'SUPER_ADMIN' || role === 'CONTENT_MANAGER';

  // FIX (HIGH): enforce published + time windows on submit (same rules as GET /:id)
  if (!isAdmin) {
    if (!test.isPublished) {
      res.status(404).json({ error: 'Test not found' });
      return;
    }

    const now = new Date();

    if (test.type === 'PREDEFINED') {
      if (test.scheduledAt && now < test.scheduledAt) {
        res.status(403).json({ error: 'This test is not yet available' });
        return;
      }
      if (test.expiresAt && now > test.expiresAt) {
        res.status(403).json({ error: 'This test has expired' });
        return;
      }
    }

    if (test.type === 'DAILY' && test.scheduledAt) {
      const testDay = new Date(test.scheduledAt);
      testDay.setUTCHours(0, 0, 0, 0);
      const nextDay = new Date(testDay);
      nextDay.setUTCDate(testDay.getUTCDate() + 1);
      if (now < testDay || now >= nextDay) {
        res.status(403).json({ error: 'This daily test is only available on its scheduled day' });
        return;
      }
    }
  }

  if (
    test.isPaid &&
    req.user!.plan === 'FREE' &&
    !isAdmin
  ) {
    res.status(403).json({ error: 'Paid subscription required' });
    return;
  }

  // ─── Server-side scoring (never trust client) ─────────────────────────────
  const { answers, timeTaken, clientAttemptId } = parsed.data;

  // ── Idempotency: return existing attempt if clientAttemptId was already used ──
  if (clientAttemptId) {
    const existing = await prisma.testAttempt.findUnique({
      where: { userId_clientAttemptId: { userId: req.user!.userId, clientAttemptId } },
      include: { test: { include: { questions: { orderBy: { order: 'asc' } } } } },
    });
    if (existing) {
      const existingAnswers = existing.answers as Record<string, string>;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const existingQs = (existing as any).test?.questions ?? [];
      const existingBreakdown = existingQs.map((q: Question) => ({
        questionId:   q.id,
        questionText: q.text,
        selected:     existingAnswers[q.id] ?? null,
        correct:      q.correctOption,
        explanation:  q.explanation ?? undefined,
        isCorrect:    existingAnswers[q.id] === q.correctOption,
      }));
      res.status(200).json({
        data: {
          ...existing,
          percentage: Math.round((existing.score / existing.totalMarks) * 100),
          breakdown: existingBreakdown,
        },
      });
      return;
    }
  }

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
      userId:          req.user!.userId,
      testId:          test.id,
      answers,
      score,
      totalMarks,
      timeTaken:       timeTaken !== undefined ? timeTaken : null,
      clientAttemptId: clientAttemptId ?? null,
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
 */
testsRouter.get('/:id/percentile', requireAuth(), async (req: Request, res: Response) => {
  const testId = req.params.id;

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
 * POST /api/tests/:id/questions/bulk
 * Imports multiple questions from a JSON array in one atomic transaction.
 *
 * Body: { questions: CreateQuestionInput[] }  (1–200 items)
 *
 * Behaviour:
 *  - Validates EVERY question with CreateQuestionSchema before touching the DB.
 *  - If any question fails, returns 400 with per-index error details (no DB write).
 *  - Auto-assigns `order` starting from (currentMaxOrder + 1) so imported
 *    questions always append after existing ones.
 *  - Wraps the createMany in a prisma.$transaction so it's all-or-nothing.
 */
testsRouter.post('/:id/questions/bulk', requireAdmin(), async (req: Request, res: Response) => {
  const testId = String(req.params.id);

  // ── 1. Basic shape check ─────────────────────────────────────────────────────
  const raw: unknown = req.body.questions;
  if (!Array.isArray(raw)) {
    res.status(400).json({ error: 'Body must contain a "questions" array.' });
    return;
  }
  if (raw.length === 0) {
    res.status(400).json({ error: 'questions array is empty.' });
    return;
  }
  if (raw.length > 200) {
    res.status(400).json({ error: 'Too many questions. Maximum 200 per import.' });
    return;
  }

  // ── 2. Validate every question with the shared schema ────────────────────────
  const validationErrors: { index: number; issues: string[] }[] = [];
  const validQuestions: ReturnType<typeof CreateQuestionSchema.parse>[] = [];

  for (let i = 0; i < raw.length; i++) {
    const result = CreateQuestionSchema.safeParse(raw[i]);
    if (result.success) {
      validQuestions.push(result.data);
    } else {
      validationErrors.push({
        index: i,
        issues: result.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`),
      });
    }
  }

  if (validationErrors.length > 0) {
    res.status(400).json({
      error: `${validationErrors.length} question(s) failed validation. No questions were saved.`,
      validationErrors,
    });
    return;
  }

  // ── 3. Verify the test exists ────────────────────────────────────────────────
  const test = await prisma.test.findUnique({ where: { id: testId }, select: { id: true } });
  if (!test) {
    res.status(404).json({ error: 'Test not found.' });
    return;
  }

  // ── 4. Determine starting order (append after existing questions) ─────────────
  const maxOrderRow = await prisma.question.findFirst({
    where:   { testId },
    orderBy: { order: 'desc' },
    select:  { order: true },
  });
  const startOrder = (maxOrderRow?.order ?? -1) + 1;

  // ── 5. Atomic insert ─────────────────────────────────────────────────────────
  const data = validQuestions.map((q, i) => ({
    ...q,
    testId,
    order: startOrder + i,
  }));

  const result = await prisma.$transaction(async (tx) => {
    return tx.question.createMany({ data });
  });

  res.status(201).json({ data: { count: result.count } });
});

/**
 * PUT /api/tests/:testId/questions/:qId
 * Edits an existing question (text, options, correctOption, explanation, order).
 *
 * FIX (HIGH): now scopes the update by both testId AND qId, preventing an admin
 * from updating a question that belongs to a different test via URL manipulation.
 */
testsRouter.put('/:testId/questions/:qId', requireAdmin(), async (req: Request, res: Response) => {
  const parsed = CreateQuestionSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  // FIX: scope by testId so a question ID from another test cannot be mutated
  const existing = await prisma.question.findFirst({
    where: { id: String(req.params.qId), testId: String(req.params.testId) },
  });
  if (!existing) {
    res.status(404).json({ error: 'Question not found' });
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
 *
 * FIX (HIGH): scoped by testId — prevents cross-test question deletion.
 */
testsRouter.delete('/:testId/questions/:qId', requireAdmin(), async (req: Request, res: Response) => {
  // FIX: scope by testId before deleting
  const existing = await prisma.question.findFirst({
    where: { id: String(req.params.qId), testId: String(req.params.testId) },
  });
  if (!existing) {
    res.status(404).json({ error: 'Question not found' });
    return;
  }

  await prisma.question.delete({ where: { id: String(req.params.qId) } });
  res.json({ data: { message: 'Question deleted' } });
});
