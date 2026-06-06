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

export function isTransientDatabaseError(err: unknown): boolean {
  if (err instanceof Prisma.PrismaClientInitializationError) return true;
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    return ['P1001', 'P1002', 'P2024'].includes(err.code);
  }

  if (!(err instanceof Error)) return false;

  return [
    "Can't reach database server",
    'Timed out fetching a new connection',
    'Connection terminated',
    'connection timed out',
    'ECONNRESET',
    'ETIMEDOUT',
  ].some((message) => err.message.includes(message));
}

export async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      if (isTransientDatabaseError(err) && i < attempts - 1) {
        const delayMs = 1500 * (i + 1);
        console.warn(`[DB] Transient database connection error, retrying in ${delayMs}ms (attempt ${i + 1}/${attempts})`);
        await new Promise(r => setTimeout(r, delayMs));
        continue;
      }
      throw err;
    }
  }
  throw new Error('withRetry: exhausted all attempts');
}
