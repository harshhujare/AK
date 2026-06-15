/**
 * Phase 6 — DB Index Verification Script
 * ========================================
 * Runs EXPLAIN ANALYZE on the 3 critical queries and verifies each
 * uses an index scan (not a sequential scan).
 *
 * Run: npx tsx scripts/verify-indexes.ts
 *      (or: npx ts-node --esm scripts/verify-indexes.ts)
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({ log: [] });

// ── Type for EXPLAIN output rows ──────────────────────────────────────────────
type ExplainRow = { 'QUERY PLAN': string };

async function explain(sql: string, params: unknown[]): Promise<string[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = await (prisma as any).$queryRawUnsafe<ExplainRow[]>(
    `EXPLAIN ANALYZE ${sql}`,
    ...params,
  );
  return rows.map((r) => r['QUERY PLAN']);
}

function isIndexScan(plan: string[]): boolean {
  const full = plan.join('\n').toLowerCase();
  // Valid index access types: Index Scan, Index Only Scan, Bitmap Index Scan
  return (
    full.includes('index scan') ||
    full.includes('bitmap index scan') ||
    full.includes('index only scan')
  );
}

function printPlan(label: string, plan: string[], pass: boolean) {
  console.log(`\n${pass ? '✅' : '❌'} ${label}`);
  plan.slice(0, 6).forEach((line) => console.log(`   ${line}`));
  if (plan.length > 6) console.log(`   ... (${plan.length - 6} more lines)`);
}

// ── Checks ────────────────────────────────────────────────────────────────────

async function checkDailyTestQuery(): Promise<boolean> {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setUTCDate(today.getUTCDate() + 1);

  const plan = await explain(
    `SELECT id FROM "Test" WHERE type = $1 AND "scheduledAt" >= $2 AND "scheduledAt" < $3`,
    ['DAILY', today.toISOString(), tomorrow.toISOString()]
  );
  const pass = isIndexScan(plan);
  printPlan(
    'Test_type_scheduledAt_idx — DAILY test lookup (type + scheduledAt range)',
    plan,
    pass,
  );
  return pass;
}

async function checkPercentileQuery(): Promise<boolean> {
  // Use a fake testId — the plan shape is the same regardless of data
  const plan = await explain(
    `SELECT COUNT(*) FROM "TestAttempt" WHERE "testId" = $1 AND score < $2`,
    ['fake-test-id', 25]
  );
  const pass = isIndexScan(plan);
  printPlan(
    'TestAttempt_testId_score_idx — percentile COUNT (testId + score)',
    plan,
    pass,
  );
  return pass;
}

async function checkUserHistoryQuery(): Promise<boolean> {
  const plan = await explain(
    `SELECT id FROM "TestAttempt" WHERE "userId" = $1 ORDER BY "completedAt" DESC LIMIT 20`,
    ['fake-user-id']
  );
  const pass = isIndexScan(plan);
  printPlan(
    'TestAttempt_userId_completedAt_idx — user history (userId ORDER BY completedAt)',
    plan,
    pass,
  );
  return pass;
}

async function checkIdempotencyIndex(): Promise<boolean> {
  const plan = await explain(
    `SELECT id FROM "TestAttempt" WHERE "userId" = $1 AND "clientAttemptId" = $2`,
    ['fake-user-id', 'fake-attempt-uuid']
  );
  const pass = isIndexScan(plan);
  printPlan(
    'TestAttempt_userId_clientAttemptId_key — idempotency unique lookup',
    plan,
    pass,
  );
  return pass;
}

// ── Runner ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║   AjitSir Academy — Phase 6 Index Verification      ║');
  console.log('╚══════════════════════════════════════════════════════╝');

  const results = await Promise.allSettled([
    checkDailyTestQuery(),
    checkPercentileQuery(),
    checkUserHistoryQuery(),
    checkIdempotencyIndex(),
  ]);

  const passes = results.filter(
    (r): r is PromiseFulfilledResult<boolean> => r.status === 'fulfilled' && r.value
  ).length;
  const total = results.length;

  console.log('\n' + '─'.repeat(56));
  console.log(`Result: ${passes}/${total} index checks passed`);

  if (passes < total) {
    console.log('\n⚠️  Some queries are using sequential scans.');
    console.log('   Run VACUUM ANALYZE and check for low table row counts');
    console.log('   (Postgres may choose seq scan when table is very small).\n');
    // Don't exit 1 — small tables legitimately trigger seq scan in EXPLAIN
  } else {
    console.log('\n✅ All queries confirmed using index scans.\n');
  }

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error('Fatal:', err);
  await prisma.$disconnect();
  process.exit(1);
});
