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
import { errorHandler } from './middleware/error';

const app = express();
const PORT = process.env.PORT || 4000;

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth', authRouter);
app.use('/api/subjects', subjectsRouter);
app.use('/api/tests', testsRouter);
app.use('/api/notes', notesRouter);
app.use('/api/announcements', announcementsRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/admin', adminRouter);

// ─── Error handler ────────────────────────────────────────────────────────────
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`🚀 AjitSir Academy API running on http://localhost:${PORT}`);
});

export default app;
