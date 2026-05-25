import { PrismaClient, Prisma } from '@prisma/client';

declare global {
  // Prevent multiple Prisma instances in development (hot reload)
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

// Build DATABASE_URL with Neon-specific params for cold-start tolerance
const rawUrl = process.env.DATABASE_URL || '';
// Ensure connect_timeout and pool_timeout are present
const dbUrl = (() => {
  try {
    const u = new URL(rawUrl);
    if (!u.searchParams.get('connect_timeout')) u.searchParams.set('connect_timeout', '30');
    if (!u.searchParams.get('pool_timeout')) u.searchParams.set('pool_timeout', '30');
    if (!u.searchParams.get('connection_limit')) u.searchParams.set('connection_limit', '5');
    return u.toString();
  } catch {
    return rawUrl;
  }
})();

export const prisma = global.__prisma || new PrismaClient({
  datasourceUrl: dbUrl,
  log: process.env.NODE_ENV === 'development' ? ['error'] : ['error'],
});

if (process.env.NODE_ENV !== 'production') {
  global.__prisma = prisma;
}

/**
 * withRetry — wraps a Prisma operation and retries once on Neon cold-start errors.
 * Neon wakes from scale-to-zero in ~2-4s; one retry is enough to handle this.
 */
export async function withRetry<T>(fn: () => Promise<T>, attempts = 2): Promise<T> {
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      const isNeonColdStart =
        err instanceof Prisma.PrismaClientInitializationError ||
        (err instanceof Error && err.message.includes("Can't reach database server"));

      if (isNeonColdStart && i < attempts - 1) {
        console.warn(`[DB] Neon cold-start detected, retrying in 3s… (attempt ${i + 1}/${attempts})`);
        await new Promise(r => setTimeout(r, 3000));
        continue;
      }
      throw err;
    }
  }
  throw new Error('withRetry: exhausted all attempts');
}

