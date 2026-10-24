// src/routes/staff/auth.ts
// POST /api/staff/login  — sign in, set HttpOnly session cookie
// POST /api/staff/logout — clear session cookie

import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../../middleware/auth.js';
import { verifyPassword, createSession, buildSessionCookie } from '../../services/auth.js';
import { checkRateLimit, rateLimitResponse } from '../../services/rateLimit.js';
import { getClientIp } from '../../middleware/auth.js';

const router = new Hono<{ Bindings: Env }>();

const LoginSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(1),
});

// Constant-time generic error — same for unknown email and wrong password
const AUTH_ERROR = { error: 'Invalid email or password.' };

router.post('/login', async (c) => {
  const ip = getClientIp(c);

  // Rate limit: 5 attempts per IP per 15 minutes
  const allowed = await checkRateLimit(c.env.DB, ip, '/api/staff/login', {
    windowSeconds: 900,
    maxRequests: 5,
  });
  if (!allowed) return rateLimitResponse();

  let body: unknown;
  try { body = await c.req.json(); }
  catch { return c.json(AUTH_ERROR, 401); }

  const parsed = LoginSchema.safeParse(body);
  if (!parsed.success) return c.json(AUTH_ERROR, 401);

  const { email, password } = parsed.data;

  const user = await c.env.DB
    .prepare(`SELECT id, email, password_hash, role, active FROM users WHERE email = ?1`)
    .bind(email.toLowerCase())
    .first<{ id: string; email: string; password_hash: string; role: string; active: number }>();

  // Always run password check even for unknown users to prevent timing attacks
  const dummyHash = '$2a$12$invalidhashplaceholdertopreventtimingattacks000000000';
  const hashToCheck = user?.password_hash ?? dummyHash;
  const passwordOk  = await verifyPassword(password, hashToCheck);

  if (!user || !passwordOk || !user.active) {
    return c.json(AUTH_ERROR, 401);
  }

  const token  = await createSession(
    { id: user.id, email: user.email, role: user.role as 'staff' | 'admin' },
    c.env.JWT_SECRET,
  );
  const cookie = buildSessionCookie(token);

  return c.json({ ok: true, role: user.role }, 200, { 'Set-Cookie': cookie });
});

router.post('/logout', (c) => {
  const cookie = buildSessionCookie('', true);
  return c.json({ ok: true }, 200, { 'Set-Cookie': cookie });
});

export default router;
