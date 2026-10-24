// src/services/rateLimit.ts
// Sliding-window per-IP rate limiter backed by D1.
// Each (ip, route) pair has a count and a window_end timestamp.

export interface RateLimitOptions {
  windowSeconds: number;
  maxRequests: number;
}

const DEFAULTS: Record<string, RateLimitOptions> = {
  '/api/reports':  { windowSeconds: 3600, maxRequests: 10 },
  '/api/triage':   { windowSeconds: 3600, maxRequests: 20 },
  '/api/staff/login': { windowSeconds: 900, maxRequests: 5 },
};

/**
 * Check and increment the rate limit counter.
 * Returns true if the request is allowed, false if the limit is exceeded.
 */
export async function checkRateLimit(
  db: D1Database,
  ip: string,
  route: string,
  options?: RateLimitOptions,
): Promise<boolean> {
  const opts = options ?? DEFAULTS[route] ?? { windowSeconds: 3600, maxRequests: 60 };
  const key  = `${ip}:${route}`;
  const now  = new Date();

  const row = await db
    .prepare(`SELECT count, window_end FROM rate_limits WHERE key = ?1`)
    .bind(key)
    .first<{ count: number; window_end: string }>();

  if (!row || new Date(row.window_end) <= now) {
    // Start a new window
    const windowEnd = new Date(now.getTime() + opts.windowSeconds * 1000).toISOString();
    await db
      .prepare(`INSERT OR REPLACE INTO rate_limits (key, count, window_end) VALUES (?1, 1, ?2)`)
      .bind(key, windowEnd)
      .run();
    return true;
  }

  if (row.count >= opts.maxRequests) return false;

  await db
    .prepare(`UPDATE rate_limits SET count = count + 1 WHERE key = ?1`)
    .bind(key)
    .run();
  return true;
}

/** Build a 429 JSON response with Retry-After header. */
export function rateLimitResponse(): Response {
  return new Response(
    JSON.stringify({ error: 'Too many requests. Please try again later.' }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': '3600',
      },
    },
  );
}
