import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../services/token';
import { prisma } from '../lib/prisma';
import type { Role, Plan, JwtPayload } from '@ajitsir/shared';

// Extend Express Request to carry the authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

/**
 * requireAuth middleware
 * - Validates the JWT from the Authorization header
 * - Optionally checks role and/or plan
 *
 * Usage:
 *   requireAuth()                              → any authenticated user
 *   requireAuth(['SUPER_ADMIN'])               → super admin only
 *   requireAuth(['SUPER_ADMIN', 'CONTENT_MANAGER']) → any admin role
 *   requireAuth(['STUDENT'], 'PAID')           → paid students only
 */
export function requireAuth(roles?: Role[], plan?: Plan) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Missing or invalid authorization header' });
        return;
      }

      const token = authHeader.slice(7);
      const payload = verifyAccessToken(token);

      // Check role
      if (roles && roles.length > 0 && !roles.includes(payload.role)) {
        res.status(403).json({ error: 'Insufficient permissions' });
        return;
      }

      // Check plan (SUPER_ADMIN bypasses plan checks)
      if (plan && payload.plan !== plan && payload.role !== 'SUPER_ADMIN') {
        res.status(403).json({ error: 'This content requires a paid subscription' });
        return;
      }

      // Verify plan is still active (check expiry from DB on sensitive routes)
      if (payload.plan === 'PAID') {
        const user = await prisma.user.findUnique({
          where: { id: payload.userId },
          select: { plan: true, planExpiresAt: true, role: true },
        });
        if (
          user &&
          user.plan === 'PAID' &&
          user.planExpiresAt &&
          user.planExpiresAt < new Date() &&
          user.role === 'STUDENT'
        ) {
          // Plan expired — downgrade in DB silently
          await prisma.user.update({
            where: { id: payload.userId },
            data: { plan: 'FREE', planExpiresAt: null },
          });
          payload.plan = 'FREE';

          if (plan === 'PAID') {
            res.status(403).json({ error: 'Your subscription has expired. Please renew.' });
            return;
          }
        }
      }

      req.user = payload;
      next();
    } catch {
      res.status(401).json({ error: 'Invalid or expired token' });
    }
  };
}

/**
 * requireAdmin — shorthand for SUPER_ADMIN or CONTENT_MANAGER
 */
export function requireAdmin() {
  return requireAuth(['SUPER_ADMIN', 'CONTENT_MANAGER']);
}

/**
 * requireSuperAdmin — shorthand for SUPER_ADMIN only
 */
export function requireSuperAdmin() {
  return requireAuth(['SUPER_ADMIN']);
}
