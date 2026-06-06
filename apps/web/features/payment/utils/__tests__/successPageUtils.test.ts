import {
  parseSuccessParams,
  formatExpiryDate,
  planDurationToLabel,
} from '../successPageUtils';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeParams(entries: Record<string, string>): URLSearchParams {
  return new URLSearchParams(entries);
}

function futureISO(daysFromNow = 30): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString();
}

function pastISO(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString();
}

// ─── parseSuccessParams ────────────────────────────────────────────────────────

describe('parseSuccessParams', () => {
  // ── Valid cases ────────────────────────────────────────────────────────────
  test('1. valid plan + future expires → returns SuccessParams', () => {
    const params = makeParams({ plan: 'Monthly', expires: futureISO(30) });
    const result = parseSuccessParams(params);

    expect(result).not.toBeNull();
    expect(result!.planLabel).toBe('Monthly');
    expect(result!.expiresAt).toBeInstanceOf(Date);
    expect(result!.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  test('2. plan=Annual + expires in past but within 1 year → returns valid (plan not expired from guard perspective)', () => {
    // A plan that expired 5 days ago is still within the 1-year sanity window
    const params = makeParams({ plan: 'Annual', expires: pastISO(5) });
    const result = parseSuccessParams(params);

    expect(result).not.toBeNull();
    expect(result!.planLabel).toBe('Annual');
  });

  test('3. whitespace is trimmed from params', () => {
    const params = makeParams({ plan: '  6-Month  ', expires: futureISO() });
    const result = parseSuccessParams(params);

    expect(result).not.toBeNull();
    expect(result!.planLabel).toBe('6-Month');
  });

  // ── Missing params ─────────────────────────────────────────────────────────
  test('4. missing plan param → returns null', () => {
    const params = makeParams({ expires: futureISO() });
    expect(parseSuccessParams(params)).toBeNull();
  });

  test('5. missing expires param → returns null', () => {
    const params = makeParams({ plan: 'Monthly' });
    expect(parseSuccessParams(params)).toBeNull();
  });

  test('6. both params missing → returns null', () => {
    expect(parseSuccessParams(new URLSearchParams())).toBeNull();
  });

  // ── Invalid expires ────────────────────────────────────────────────────────
  test('7. expires is not a valid date string → returns null', () => {
    const params = makeParams({ plan: 'Monthly', expires: 'not-a-date' });
    expect(parseSuccessParams(params)).toBeNull();
  });

  test('8. expires is empty string → returns null', () => {
    const params = makeParams({ plan: 'Monthly', expires: '' });
    expect(parseSuccessParams(params)).toBeNull();
  });

  test('9. expires is more than 1 year in the past → returns null (stale URL guard)', () => {
    const params = makeParams({ plan: 'Monthly', expires: pastISO(400) });
    expect(parseSuccessParams(params)).toBeNull();
  });
});

// ─── formatExpiryDate ─────────────────────────────────────────────────────────

describe('formatExpiryDate', () => {
  test('10. valid Date → returns formatted "DD MMM YYYY" string', () => {
    // Use a fixed date to avoid locale/timezone flakiness
    const date = new Date('2025-08-30T12:00:00Z');
    const result = formatExpiryDate(date);

    // Should contain "Aug" and "2025" — exact format is locale-dependent
    // but en-IN should produce "30 Aug 2025"
    expect(result).toMatch(/Aug/);
    expect(result).toMatch(/2025/);
    expect(result).toMatch(/30/);
  });

  test('11. null → returns empty string', () => {
    expect(formatExpiryDate(null)).toBe('');
  });

  test('12. invalid Date (NaN) → returns empty string', () => {
    expect(formatExpiryDate(new Date('invalid-date'))).toBe('');
  });
});

// ─── planDurationToLabel ──────────────────────────────────────────────────────

describe('planDurationToLabel', () => {
  test('13. 30 → "Monthly"', () => {
    expect(planDurationToLabel(30)).toBe('Monthly');
  });

  test('14. 180 → "6-Month"', () => {
    expect(planDurationToLabel(180)).toBe('6-Month');
  });

  test('15. 365 → "Annual"', () => {
    expect(planDurationToLabel(365)).toBe('Annual');
  });

  test('16. null → "Premium" (fallback)', () => {
    expect(planDurationToLabel(null)).toBe('Premium');
  });

  test('17. undefined → "Premium" (fallback)', () => {
    expect(planDurationToLabel(undefined)).toBe('Premium');
  });

  test('18. unknown duration (e.g. 90) → "Premium" (fallback)', () => {
    expect(planDurationToLabel(90)).toBe('Premium');
  });
});
