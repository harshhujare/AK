import { canAccessNote } from '../accessControl';
import type { User } from '@ajitsir/shared';

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** Default note fixtures — always include accessType */
const freeNote     = { isPaid: false, accessType: 'TIMED'    as const };
const timedNote    = { isPaid: true,  accessType: 'TIMED'    as const };
const lifetimeNote = { isPaid: true,  accessType: 'LIFETIME' as const };

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    userId: 'user-1',
    name: 'Test User',
    email: 'test@example.com',
    role: 'STUDENT',
    plan: 'FREE',
    planExpiresAt: null,
    paidAt: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function futureDate(daysFromNow = 30): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString();
}

function pastDate(daysAgo = 1): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString();
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('canAccessNote', () => {
  // ── Rule 1: Free notes ─────────────────────────────────────────────────────
  describe('free notes', () => {
    test('unauthenticated user can access a free note', () => {
      expect(canAccessNote(null, freeNote)).toBe(true);
    });

    test('FREE plan user can access a free note', () => {
      expect(canAccessNote(makeUser({ plan: 'FREE' }), freeNote)).toBe(true);
    });

    test('PAID plan user can access a free note', () => {
      expect(canAccessNote(makeUser({ plan: 'PAID', planExpiresAt: futureDate() }), freeNote)).toBe(true);
    });
  });

  // ── Rule 2: Paid notes — unauthenticated ───────────────────────────────────
  describe('paid notes — unauthenticated', () => {
    test('null user cannot access a timed paid note', () => {
      expect(canAccessNote(null, timedNote)).toBe(false);
    });

    test('null user cannot access a lifetime paid note', () => {
      expect(canAccessNote(null, lifetimeNote)).toBe(false);
    });
  });

  // ── Rule 3: Admin roles bypass ─────────────────────────────────────────────
  describe('paid notes — admin bypass', () => {
    test('SUPER_ADMIN can access a paid note regardless of plan', () => {
      expect(canAccessNote(makeUser({ role: 'SUPER_ADMIN', plan: 'FREE' }), timedNote)).toBe(true);
    });

    test('CONTENT_MANAGER can access a paid note regardless of plan', () => {
      expect(canAccessNote(makeUser({ role: 'CONTENT_MANAGER', plan: 'FREE' }), timedNote)).toBe(true);
    });

    test('SUPPORT_MANAGER with FREE plan cannot access a paid note (no bypass)', () => {
      expect(canAccessNote(makeUser({ role: 'SUPPORT_MANAGER', plan: 'FREE' }), timedNote)).toBe(false);
    });
  });

  // ── Rule 4: LIFETIME access ────────────────────────────────────────────────
  describe('lifetime notes', () => {
    test('12. paidAt set + expired plan → still has lifetime access', () => {
      const user = makeUser({
        plan: 'FREE',           // plan expired and was downgraded
        planExpiresAt: pastDate(10),
        paidAt: pastDate(100), // but they paid 100 days ago
      });
      expect(canAccessNote(user, lifetimeNote)).toBe(true);
    });

    test('13. paidAt = null → no lifetime access', () => {
      const user = makeUser({ plan: 'FREE', paidAt: null });
      expect(canAccessNote(user, lifetimeNote)).toBe(false);
    });

    test('14. FREE plan + paidAt set → lifetime access granted', () => {
      const user = makeUser({ plan: 'FREE', paidAt: pastDate(30) });
      expect(canAccessNote(user, lifetimeNote)).toBe(true);
    });

    test('15. TIMED note + expired plan + paidAt set → no access (paidAt only helps LIFETIME)', () => {
      const user = makeUser({
        plan: 'PAID',
        planExpiresAt: pastDate(1),
        paidAt: pastDate(30),
      });
      expect(canAccessNote(user, timedNote)).toBe(false);
    });
  });

  // ── Rule 5: TIMED — active paid plan ──────────────────────────────────────
  describe('timed notes — PAID plan', () => {
    test('PAID plan with future expiry grants access', () => {
      expect(
        canAccessNote(makeUser({ plan: 'PAID', planExpiresAt: futureDate(30) }), timedNote)
      ).toBe(true);
    });

    test('PAID plan with null planExpiresAt grants access (indefinite)', () => {
      expect(
        canAccessNote(makeUser({ plan: 'PAID', planExpiresAt: null }), timedNote)
      ).toBe(true);
    });

    test('PAID plan with expired date denies access', () => {
      expect(
        canAccessNote(makeUser({ plan: 'PAID', planExpiresAt: pastDate(1) }), timedNote)
      ).toBe(false);
    });
  });

  // ── Rule 6: FREE plan ──────────────────────────────────────────────────────
  describe('timed notes — FREE plan', () => {
    test('FREE plan student cannot access a timed paid note', () => {
      expect(canAccessNote(makeUser({ plan: 'FREE' }), timedNote)).toBe(false);
    });
  });
});
