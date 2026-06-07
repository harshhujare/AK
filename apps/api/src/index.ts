import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { authRouter } from './routes/auth';
import { testsRouter } from './routes/tests';
import { notesRouter } from './routes/notes';
import { paymentsRouter } from './routes/payments';
import { adminRouter } from './routes/admin';
import { subjectsRouter } from './routes/subjects';
import { announcementsRouter } from './routes/announcements';
import { supportRouter } from './routes/support';
import { faqsRouter } from './routes/faqs';
import { errorHandler } from './middleware/error';
import { captureRawBody } from './middleware/rawBody';
import { prisma } from './lib/prisma';

const app = express();
const PORT = process.env.PORT || 4000;

// ─── Global error guards (keep server alive on Neon cold-start timeouts) ──────
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection] Caught — server will continue:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException] Caught — server will continue:', err.message);
});

// ─── Middleware ───────────────────────────────────────────────────────────────
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:3000',
  'http://localhost:3001', // fallback when port 3000 is busy
];
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) cb(null, true);
    else cb(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
}));

// ─── Webhook raw body capture ──────────────────────────────────────────────────
// Must be registered BEFORE express.json() so the raw bytes are preserved.
// Razorpay computes HMAC over the exact bytes it sent; re-serializing with
// JSON.stringify after parsing would produce a different string → HMAC mismatch.
app.use('/api/payments/webhook', captureRawBody);

app.use(express.json());
app.use(cookieParser());

// ─── Health check (also pings DB to keep Neon awake) ──────────────────────────
// GET /health
// Returns { status: 'ok', db: 'ok'|'error', timestamp }
// A lightweight SELECT 1 is enough to prevent Neon scale-to-zero.
// The GitHub Actions keep-alive cron hits this endpoint every 14 min.
app.get('/health', async (_req, res) => {
  let dbStatus = 'error';
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbStatus = 'ok';
  } catch {
    // DB unreachable — still return 200 so Render doesn't mark the service unhealthy
    // (Neon may be in the middle of resuming; the next ping will catch it)
  }
  res.json({ status: 'ok', db: dbStatus, timestamp: new Date().toISOString() });
});

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth', authRouter);
app.use('/api/subjects', subjectsRouter);
app.use('/api/tests', testsRouter);
app.use('/api/notes', notesRouter);
app.use('/api/announcements', announcementsRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/admin', adminRouter);
app.use('/api/support', supportRouter);
app.use('/api/faqs', faqsRouter);

// ─── Error handler ────────────────────────────────────────────────────────────
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`🚀 AjitSir Academy API running on http://localhost:${PORT}`);
});

export default app;
