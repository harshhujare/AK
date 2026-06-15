-- Phase 6: Add clientAttemptId idempotency key to TestAttempt
-- This prevents double-submit at the database level.
-- Safe to run multiple times (IF NOT EXISTS guards).

ALTER TABLE "TestAttempt" ADD COLUMN IF NOT EXISTS "clientAttemptId" TEXT;

-- Unique index only fires when clientAttemptId IS NOT NULL
-- (NULL values are not compared in unique indexes in PostgreSQL)
CREATE UNIQUE INDEX IF NOT EXISTS "TestAttempt_userId_clientAttemptId_key"
  ON "TestAttempt"("userId", "clientAttemptId");
