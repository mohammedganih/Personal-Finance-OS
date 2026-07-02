import rateLimit from 'express-rate-limit';

/**
 * Factory mirroring validate.middleware.ts's shape: call once per route with
 * the limits that route needs, rather than one global limiter for everything.
 */
export function createRateLimiter(windowMs: number, limit: number, message: string) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json({ success: false, message });
    },
  });
}
