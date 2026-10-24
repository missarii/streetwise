// src/index.ts
// Cloudflare Worker entry point.
// HTML pages are served as inline strings (bundled by wrangler at build time).
// API routes are handled by Hono.

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import type { Env } from './middleware/auth.js';

// Route modules
import triageRouter   from './routes/triage.js';
import reportsRouter  from './routes/reports.js';
import statsRouter    from './routes/stats.js';
import authRouter     from './routes/staff/auth.js';
import queueRouter    from './routes/staff/queue.js';
import reviewRouter   from './routes/staff/review.js';
import zonesRouter    from './routes/staff/zones.js';
import settingsRouter from './routes/staff/settings.js';
import auditRouter    from './routes/staff/audit.js';

// ── Static HTML (inlined via wrangler bundling) ──────────────────────────────
// Only the single frontend (index.html) is served at /.
// @ts-ignore — text import
import indexHtml from './public/index.html' with { type: 'text' };

const app = new Hono<{ Bindings: Env }>();

// ── Middleware ────────────────────────────────────────────────────────────────
app.use('*', logger());
app.use('/api/*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// ── Public zone data endpoint ─────────────────────────────────────────────────
app.get('/api/zones', async (c) => {
  const zones = await c.env.DB
    .prepare(`SELECT id, name, crew, polygon, status, pause_reason, paused_until FROM zones ORDER BY id`)
    .all<Record<string, unknown>>();
  return c.json({ zones: zones.results ?? [] });
});

// ── API routes ────────────────────────────────────────────────────────────────
app.route('/api/triage',         triageRouter);
app.route('/api/reports',        reportsRouter);
app.route('/api/stats',          statsRouter);
app.route('/api/staff',          authRouter);
app.route('/api/staff/queue',    queueRouter);
app.route('/api/staff/reports',  reviewRouter);
app.route('/api/staff/zones',    zonesRouter);
app.route('/api/staff/settings', settingsRouter);
app.route('/api/staff/audit',    auditRouter);

// ── HTML pages ────────────────────────────────────────────────────────────────
const html = (content: string) =>
  new Response(content, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });

app.get('/', () => html(indexHtml as string));

// ── Global error handlers ──────────────────────────────────────────────────────
app.onError((err, c) => {
  console.error('[worker] unhandled error:', err.message);
  return c.json({ error: 'Internal server error.' }, 500);
});

app.notFound((c) => c.json({ error: 'Not found.' }, 404));

export default app;
