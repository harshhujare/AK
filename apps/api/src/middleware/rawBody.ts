import express, { Request, Response, NextFunction } from 'express';

// Extend the Express Request type to carry raw bytes for HMAC verification
declare global {
  namespace Express {
    interface Request {
      /**
       * Raw request body bytes, captured before express.json() parses them.
       * Only populated on routes that use captureRawBody middleware.
       * Required for Razorpay webhook HMAC signature verification.
       */
      rawBody?: Buffer;
    }
  }
}

/**
 * Middleware array that captures the raw request bytes into `req.rawBody`
 * BEFORE parsing the JSON body into `req.body`.
 *
 * Mount ONLY on the webhook route, BEFORE the global express.json() middleware:
 *   app.use('/api/payments/webhook', captureRawBody);
 *   app.use(express.json()); // all other routes
 *
 * Why: Razorpay computes HMAC over the raw byte string it sends. If we let
 * express.json() parse the body first and then re-serialize with JSON.stringify,
 * the resulting string may differ (key order, whitespace) causing HMAC mismatch.
 */
export const captureRawBody = [
  // Step 1: Read raw bytes (bypasses express.json() for this route)
  express.raw({ type: 'application/json' }),

  // Step 2: Save the buffer, then parse JSON into req.body for handler use
  (req: Request, _res: Response, next: NextFunction): void => {
    if (Buffer.isBuffer(req.body)) {
      req.rawBody = req.body;
      try {
        req.body = JSON.parse(req.body.toString('utf8'));
      } catch {
        // If JSON parse fails, leave req.body as the Buffer; handler will 400
      }
    }
    next();
  },
];
