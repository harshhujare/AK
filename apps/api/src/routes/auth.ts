import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma, withRetry } from '../lib/prisma';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../services/token';
import { verifyGoogleIdToken } from '../services/google';
import { RegisterSchema, LoginSchema, GoogleAuthSchema } from '@ajitsir/shared';
import { asyncHandler } from '../lib/asyncHandler';

export const authRouter = Router();

const isProduction = process.env.NODE_ENV === 'production';

const COOKIE_OPTS = {
  httpOnly: true,
  secure: isProduction,
  // 'none' is required when frontend (Vercel) and API are on different domains.
  // 'lax' blocks cross-origin POST cookies (Chrome 80+, Safari), breaking token refresh.
  // 'none' REQUIRES secure:true — only active in production (HTTPS).
  sameSite: (isProduction ? 'none' : 'lax') as 'none' | 'lax',
  path: '/',
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days — keeps users signed in
};

const CLEAR_COOKIE_OPTS = {
  httpOnly: COOKIE_OPTS.httpOnly,
  secure: COOKIE_OPTS.secure,
  sameSite: COOKIE_OPTS.sameSite,
  path: COOKIE_OPTS.path,
};

// POST /api/auth/register
authRouter.post('/register', asyncHandler(async (req: Request, res: Response) => {
  const parsed = RegisterSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }
  const { name, email, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    res.status(409).json({ error: 'Email already registered' });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { name, email, passwordHash },
  });

  const accessToken = signAccessToken({ userId: user.id, role: user.role, plan: user.plan });
  const refreshToken = signRefreshToken(user.id);
  res.cookie('refreshToken', refreshToken, COOKIE_OPTS);

  res.status(201).json({
    data: { accessToken, user: { id: user.id, name: user.name, email: user.email, role: user.role, plan: user.plan } },
  });
}));

// POST /api/auth/login
authRouter.post('/login', asyncHandler(async (req: Request, res: Response) => {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }
  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.passwordHash) {
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }

  const accessToken = signAccessToken({ userId: user.id, role: user.role, plan: user.plan });
  const refreshToken = signRefreshToken(user.id);
  res.cookie('refreshToken', refreshToken, COOKIE_OPTS);

  res.json({
    data: { accessToken, user: { id: user.id, name: user.name, email: user.email, role: user.role, plan: user.plan } },
  });
}));

// POST /api/auth/google — verify Google ID token from GIS
authRouter.post('/google', asyncHandler(async (req: Request, res: Response) => {
  const parsed = GoogleAuthSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'idToken is required' });
    return;
  }

  let googleUser;
  try {
    googleUser = await verifyGoogleIdToken(parsed.data.idToken);
  } catch {
    res.status(401).json({ error: 'Invalid Google token' });
    return;
  }

  // Upsert user — create if first time, find if returning
  const user = await withRetry(() => prisma.user.upsert({
    where: { googleId: googleUser.googleId },
    update: { name: googleUser.name },
    create: {
      name: googleUser.name,
      email: googleUser.email,
      googleId: googleUser.googleId,
    },
  }));

  const accessToken = signAccessToken({ userId: user.id, role: user.role, plan: user.plan });
  const refreshToken = signRefreshToken(user.id);
  res.cookie('refreshToken', refreshToken, COOKIE_OPTS);

  res.json({
    data: { accessToken, user: { id: user.id, name: user.name, email: user.email, role: user.role, plan: user.plan } },
  });
}));

// POST /api/auth/refresh
authRouter.post('/refresh', asyncHandler(async (req: Request, res: Response) => {
  const token = req.cookies?.refreshToken;
  if (!token) {
    res.status(401).json({ error: 'No refresh token' });
    return;
  }

  try {
    const { userId } = verifyRefreshToken(token);
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      res.status(401).json({ error: 'User not found' });
      return;
    }

    const accessToken = signAccessToken({ userId: user.id, role: user.role, plan: user.plan });
    res.json({ data: { accessToken } });
  } catch {
    res.status(401).json({ error: 'Invalid or expired refresh token' });
  }
}));

// POST /api/auth/logout
authRouter.post('/logout', (_req: Request, res: Response) => {
  res.clearCookie('refreshToken', CLEAR_COOKIE_OPTS);
  res.json({ data: { message: 'Logged out successfully' } });
});

// GET /api/auth/me
authRouter.get('/me', asyncHandler(async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const { verifyAccessToken } = await import('../services/token');
  try {
    const payload = verifyAccessToken(authHeader.slice(7));
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, name: true, email: true, role: true, plan: true, planExpiresAt: true, createdAt: true },
    });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json({ data: { ...user, userId: user.id } });
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}));
