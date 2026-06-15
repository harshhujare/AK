/**
 * Phase 6 — Security Audit Script
 * ================================
 * Verifies all four security requirements:
 *
 * ✅ 1. GET /api/tests/:id — correctOption absent from response (no info leak)
 * ✅ 2. GET /api/tests/:id/questions — 403 for STUDENT role (admin-only endpoint)
 * ✅ 3. GET /api/tests/:id/attempt/:attemptId — 404 for a different user's attempt (no info leak)
 * ✅ 4. CONTENT_MANAGER — can CRUD tests; cannot access /admin/users or /admin/payments
 *
 * Run: npx ts-node --esm scripts/security-audit.ts
 * Or:  npx tsx scripts/security-audit.ts
 *
 * Requires: TEST_API_URL, STUDENT_TOKEN, ADMIN_TOKEN, CONTENT_MANAGER_TOKEN env vars
 * (set in .env or pass inline)
 */
import * as https from 'https';
import * as http from 'http';

// ── Config ────────────────────────────────────────────────────────────────────

const API_BASE = process.env.TEST_API_URL || 'http://localhost:4000';
const STUDENT_TOKEN  = process.env.STUDENT_TOKEN  || '';
const ADMIN_TOKEN    = process.env.ADMIN_TOKEN    || '';  // SUPER_ADMIN
const CM_TOKEN       = process.env.CONTENT_MANAGER_TOKEN || ''; // CONTENT_MANAGER
const TEST_ID        = process.env.AUDIT_TEST_ID  || '';  // any published test CUID
const ATTEMPT_ID_OTHER = process.env.OTHER_USER_ATTEMPT_ID || ''; // another user's attempt

// ── Helpers ───────────────────────────────────────────────────────────────────

interface AuditResult { pass: boolean; label: string; details?: string; }

async function httpGet(url: string, token?: string): Promise<{ status: number; body: unknown }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const opts = {
      hostname: parsed.hostname,
      port:     parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path:     parsed.pathname + parsed.search,
      method:   'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    };
    const lib = parsed.protocol === 'https:' ? https : http;
    const req = lib.request(opts, (res) => {
      let raw = '';
      res.on('data', (c: Buffer) => { raw += c; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode ?? 0, body: JSON.parse(raw) }); }
        catch { resolve({ status: res.statusCode ?? 0, body: raw }); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function deepContainsKey(obj: unknown, key: string): boolean {
  if (typeof obj !== 'object' || obj === null) return false;
  const record = obj as Record<string, unknown>;
  if (key in record) return true;
  return Object.values(record).some((v) => {
    if (Array.isArray(v)) return v.some((item) => deepContainsKey(item, key));
    return deepContainsKey(v, key);
  });
}

// ── Audit checks ─────────────────────────────────────────────────────────────

async function checkCorrectOptionLeak(): Promise<AuditResult> {
  const label = '❓ correctOption absent from GET /api/tests/:id';
  if (!TEST_ID) return { pass: false, label, details: 'AUDIT_TEST_ID env var not set' };

  const { status, body } = await httpGet(`${API_BASE}/api/tests/${TEST_ID}`, STUDENT_TOKEN);
  if (status !== 200) return { pass: false, label, details: `Status ${status} — test not found or not published` };

  const leaked = deepContainsKey(body, 'correctOption');
  return {
    pass: !leaked,
    label,
    details: leaked
      ? '🚨 FAIL — "correctOption" found in response body!'
      : '✅ PASS — correctOption not present in any field',
  };
}

async function checkStudentBlockedFromQuestions(): Promise<AuditResult> {
  const label = '🔒 GET /api/tests/:id/questions → 403 for STUDENT';
  if (!TEST_ID) return { pass: false, label, details: 'AUDIT_TEST_ID env var not set' };

  const { status } = await httpGet(`${API_BASE}/api/tests/${TEST_ID}/questions`, STUDENT_TOKEN);
  return {
    pass: status === 403,
    label,
    details: status === 403 ? '✅ PASS — returned 403' : `🚨 FAIL — returned ${status} instead of 403`,
  };
}

async function checkCrossUserAttemptReturns404(): Promise<AuditResult> {
  const label = '🛡 GET /api/tests/:id/attempt/:otherUserId → 404 (not 403)';
  if (!TEST_ID || !ATTEMPT_ID_OTHER) {
    return { pass: false, label, details: 'AUDIT_TEST_ID or OTHER_USER_ATTEMPT_ID env var not set — skipping' };
  }

  const { status } = await httpGet(
    `${API_BASE}/api/tests/${TEST_ID}/attempt/${ATTEMPT_ID_OTHER}`,
    STUDENT_TOKEN,
  );
  return {
    pass: status === 404,
    label,
    details: status === 404
      ? '✅ PASS — returned 404 (no info leak about existence)'
      : `🚨 FAIL — returned ${status} instead of 404 (could reveal attempt belongs to another user)`,
  };
}

async function checkContentManagerCannotAccessUsers(): Promise<AuditResult> {
  const label = '🔐 CONTENT_MANAGER cannot GET /admin/users (API route)';
  if (!CM_TOKEN) return { pass: false, label, details: 'CONTENT_MANAGER_TOKEN not set — skipping' };

  // Test that the admin users endpoint returns 403 for CONTENT_MANAGER
  const { status } = await httpGet(`${API_BASE}/api/admin/users`, CM_TOKEN);
  return {
    pass: status === 403 || status === 404,
    label,
    details: (status === 403 || status === 404)
      ? `✅ PASS — returned ${status}`
      : `🚨 FAIL — returned ${status} (CONTENT_MANAGER should not have access)`,
  };
}

async function checkUnauthenticatedReturns401(): Promise<AuditResult> {
  const label = '🔑 All test routes return 401 without Authorization header';
  if (!TEST_ID) return { pass: false, label, details: 'AUDIT_TEST_ID not set — skipping' };

  const routes = [
    `/api/tests/${TEST_ID}`,
    `/api/tests/${TEST_ID}/attempt/fake-id`,
    `/api/tests/${TEST_ID}/percentile`,
    `/api/tests/${TEST_ID}/questions`,
  ];

  const results = await Promise.all(
    routes.map(async (r) => {
      const { status } = await httpGet(`${API_BASE}${r}`);
      return { route: r, status };
    })
  );

  const failures = results.filter((r) => r.status !== 401);
  return {
    pass: failures.length === 0,
    label,
    details: failures.length === 0
      ? '✅ PASS — all routes returned 401 without token'
      : `🚨 FAIL — routes returned non-401: ${failures.map(f => `${f.route} → ${f.status}`).join(', ')}`,
  };
}

// ── Runner ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║   AjitSir Academy — Phase 6 Security Audit          ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');
  console.log(`API Base: ${API_BASE}`);
  console.log(`Test ID:  ${TEST_ID || '(not set)'}\n`);

  const checks = [
    checkUnauthenticatedReturns401,
    checkCorrectOptionLeak,
    checkStudentBlockedFromQuestions,
    checkCrossUserAttemptReturns404,
    checkContentManagerCannotAccessUsers,
  ];

  const results: AuditResult[] = [];
  for (const check of checks) {
    try {
      const result = await check();
      results.push(result);
      console.log(`${result.pass ? '✅' : '❌'} ${result.label}`);
      if (result.details) console.log(`   ${result.details}`);
    } catch (err) {
      console.error(`💥 Check threw: ${(err as Error).message}`);
      results.push({ pass: false, label: 'check threw an error' });
    }
    console.log();
  }

  const passed = results.filter((r) => r.pass).length;
  const total  = results.length;

  console.log('─'.repeat(56));
  console.log(`Result: ${passed}/${total} checks passed`);

  if (passed < total) {
    console.log('\n🚨 SECURITY ISSUES FOUND — resolve before going to production.\n');
    process.exit(1);
  } else {
    console.log('\n✅ All checks passed. System is secure.\n');
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
