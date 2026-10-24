// src/middleware/auth.ts
// Hono middleware: extract + verify JWT from cookie, attach user to context.

import type { MiddlewareHandler } from 'hono';
import { verifyJwt, extractSessionToken, type JwtPayload } from '../services/auth.js';

export type Env = {
  DB: D1Database;
  AI: Ai;
  JWT_SECRET: string;
};

// Extend Hono context with the authenticated user
declare module 'hono' {
  interface ContextVariableMap {
    user: JwtPayload;
  }
}

/** Require a valid session. Returns 401 if missing or invalid. */
export const requireAuth: MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
  const cookie = c.req.header('Cookie') ?? null;
  const token  = extractSessionToken(cookie);

  if (!token) {
    return c.json({ error: 'Authentication required.' }, 401);
  }

  const payload = await verifyJwt(token, c.env.JWT_SECRET);
  if (!payload) {
    return c.json({ error: 'Session expired or invalid.' }, 401);
  }

  c.set('user', payload);
  await next();
};

/** Require the 'admin' role. Must be used after requireAuth. */
export const requireAdmin: MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
  const user = c.get('user');
  if (user.role !== 'admin') {
    return c.json({ error: 'Admin access required.' }, 403);
  }
  await next();
};

/** Extract the client IP from CF headers. */
export function getClientIp(c: { req: { header: (name: string) => string | undefined } }): string {
  return (
    c.req.header('CF-Connecting-IP') ??
    c.req.header('X-Forwarded-For')?.split(',')[0]?.trim() ??
    'unknown'
  );
}
