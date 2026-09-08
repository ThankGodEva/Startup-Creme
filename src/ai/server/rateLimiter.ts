import { Request, Response, NextFunction } from 'express';
import { AIErrorCodes } from './automationContract';

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

export interface RateLimitOptions {
  windowMs: number; // e.g., 60,000 ms (1 minute)
  maxRequests: number; // e.g., 60 requests per window
  endpointIdentifier?: string;
}

export function createRateLimiter(options: RateLimitOptions) {
  const records = new Map<string, RateLimitRecord>();

  // Periodically clean up expired records
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of records.entries()) {
      if (record.resetAt <= now) {
        records.delete(key);
      }
    }
  }, Math.max(options.windowMs, 30000)).unref();

  return (req: Request, res: Response, next: NextFunction) => {
    // Identify client by token or IP
    const clientKey = (
      req.headers['x-automation-secret'] ||
      req.headers.authorization ||
      req.ip ||
      req.socket.remoteAddress ||
      'unknown_client'
    ) as string;

    const key = `${options.endpointIdentifier || 'global'}:${clientKey}`;
    const now = Date.now();
    let record = records.get(key);

    if (!record || record.resetAt <= now) {
      record = {
        count: 1,
        resetAt: now + options.windowMs
      };
      records.set(key, record);
    } else {
      record.count += 1;
    }

    const remaining = Math.max(0, options.maxRequests - record.count);
    const resetSeconds = Math.max(1, Math.ceil((record.resetAt - now) / 1000));

    res.setHeader('X-RateLimit-Limit', options.maxRequests);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetAt / 1000));

    if (record.count > options.maxRequests) {
      res.setHeader('Retry-After', resetSeconds);
      return res.status(429).json({
        error: `Rate limit exceeded. Maximum ${options.maxRequests} requests per ${Math.round(options.windowMs / 1000)}s allowed.`,
        code: AIErrorCodes.RATE_LIMIT_EXCEEDED,
        retryable: true,
        retryAfterSeconds: resetSeconds
      });
    }

    next();
  };
}
