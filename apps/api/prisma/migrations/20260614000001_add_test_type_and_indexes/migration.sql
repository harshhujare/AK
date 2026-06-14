-- Migration: add_test_type_and_indexes
-- Adds TestType enum, scheduling fields, publish flag, and performance indexes.

-- 1. Create the TestType enum
CREATE TYPE "TestType" AS ENUM ('DAILY', 'PREDEFINED', 'SUBJECT');

-- 2. Add new columns to Test
--    All nullable or have safe defaults so existing rows are not affected.
ALTER TABLE "Test"
  ADD COLUMN "type"         "TestType" NOT NULL DEFAULT 'SUBJECT',
  ADD COLUMN "timeLimitSec" INTEGER,
  ADD COLUMN "scheduledAt"  TIMESTAMPTZ,
  ADD COLUMN "expiresAt"    TIMESTAMPTZ,
  ADD COLUMN "isPublished"  BOOLEAN NOT NULL DEFAULT false;

-- 3. Make TestAttempt.timeTaken nullable
--    Existing rows keep their values; new untimed submissions can pass NULL.
ALTER TABLE "TestAttempt" ALTER COLUMN "timeTaken" DROP NOT NULL;

-- 4. Add composite indexes for filter performance
--    Done AFTER the ALTER to avoid row-level locks during index build on large tables.
CREATE INDEX "Test_type_scheduledAt_idx"      ON "Test" ("type", "scheduledAt");
CREATE INDEX "Test_subjectId_isPublished_idx" ON "Test" ("subjectId", "isPublished");

CREATE INDEX "TestAttempt_testId_score_idx"       ON "TestAttempt" ("testId", "score");
CREATE INDEX "TestAttempt_userId_completedAt_idx" ON "TestAttempt" ("userId", "completedAt" DESC);
