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
// These are imported as raw text strings at build time.
// @ts-ignore — text import
import publicMapHtml  from './public/index.html' with { type: 'text' };
// @ts-ignore
import reportHtml     from './public/report.html' with { type: 'text' };
// @ts-ignore
import followHtml     from './public/follow.html' with { type: 'text' };
// @ts-ignore
import loginHtml      from './public/staff/login.html' with { type: 'text' };
// @ts-ignore
import queueHtml      from './public/staff/queue.html' with { type: 'text' };
// @ts-ignore
import reviewHtml     from './public/staff/review.html' with { type: 'text' };
// @ts-ignore
import zonesHtml      from './public/staff/zones.html' with { type: 'text' };
// @ts-ignore
import settingsHtml   from './public/staff/settings.html' with { type: 'text' };
// @ts-ignore
import auditHtml      from './public/staff/audit.html' with { type: 'text' };

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

app.get('/',               () => html(publicMapHtml as string));
app.get('/report',         () => html(reportHtml as string));
app.get('/follow',         () => html(followHtml as string));
app.get('/staff',          (c) => c.redirect('/staff/login', 302));
app.get('/staff/login',    () => html(loginHtml as string));
app.get('/staff/queue',    () => html(queueHtml as string));
app.get('/staff/review',   () => html(reviewHtml as string));
app.get('/staff/zones',    () => html(zonesHtml as string));
app.get('/staff/settings', () => html(settingsHtml as string));
app.get('/staff/audit',    () => html(auditHtml as string));

// ── Global error handlers ──────────────────────────────────────────────────────
app.onError((err, c) => {
  console.error('[worker] unhandled error:', err.message);
  return c.json({ error: 'Internal server error.' }, 500);
});

app.notFound((c) => c.json({ error: 'Not found.' }, 404));

export default app;
