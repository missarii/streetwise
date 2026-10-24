// src/routes/reports.ts
// POST /api/reports — citizen report submission
// GET  /api/reports — public reports list (published, in_progress, fixed only)
// GET  /api/reports/:id/follow — follow page (requires token)

import { Hono } from 'hono';
import type { Env } from '../middleware/auth.js';
import { ReportSubmitSchema } from '../validators/report.js';
import { callModel } from '../services/triage/model.js';
import { fallbackTriage } from '../services/triage/fallback.js';
import { applyRoutingRules } from '../services/triage/rules.js';
import { parseZonePolygon } from '../services/triage/zone.js';
import { appendEvent } from '../services/events.js';
import { checkRateLimit, rateLimitResponse } from '../services/rateLimit.js';
import { getClientIp } from '../middleware/auth.js';

const router = new Hono<{ Bindings: Env }>();

/** Generate a random URL-safe ID or token. */
function randomId(prefix: string, len = 8): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const arr   = crypto.getRandomValues(new Uint8Array(len));
  return prefix + Array.from(arr, b => chars[b % chars.length]).join('');
}

// ─── GET /api/reports ────────────────────────────────────────────────────────

router.get('/', async (c) => {
  const { type, zone, status } = c.req.query();

  // Only show reports that are safe for public viewing
  const publicStatuses = ['published', 'in_progress', 'fixed'];

  let query = `
    SELECT id, text, lat, lng, type, size, priority, zone, reason, triaged_by, status, created_at, updated_at
    FROM reports
    WHERE status IN ('published','in_progress','fixed')
  `;
  const params: string[] = [];

  if (type && type !== 'all') {
    query += ` AND type = ?${params.length + 1}`;
    params.push(type);
  }
  if (zone && zone !== 'all') {
    query += ` AND zone = ?${params.length + 1}`;
    params.push(zone);
  }
  if (status && publicStatuses.includes(status)) {
    query += ` AND status = ?${params.length + 1}`;
    params.push(status);
  }

  query += ' ORDER BY priority DESC, created_at DESC LIMIT 500';

  const stmt   = c.env.DB.prepare(query);
  const result = await stmt.bind(...params).all();

  return c.json({ reports: result.results ?? [] });
});

// ─── POST /api/reports ───────────────────────────────────────────────────────

router.post('/', async (c) => {
  const ip = getClientIp(c);
  const allowed = await checkRateLimit(c.env.DB, ip, '/api/reports');
  if (!allowed) return rateLimitResponse();

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Request body must be valid JSON.' }, 400);
  }

  const parsed = ReportSubmitSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Validation failed.', details: parsed.error.flatten() }, 400);
  }

  const { text, lat, lng, photo } = parsed.data;

  // Load zones
  const zonesRows = await c.env.DB
    .prepare(`SELECT id, polygon FROM zones`)
    .all<{ id: string; polygon: string }>();
  const zones = (zonesRows.results ?? []).map(z => ({
    id: z.id,
    polygon: parseZonePolygon(z.polygon),
  }));

  // Load settings
  const triageSetting = await c.env.DB
    .prepare(`SELECT value FROM settings WHERE key = 'triage'`)
    .first<{ value: string }>();
  const triageCfg = JSON.parse(triageSetting?.value ?? '{}') as {
    model_timeout_ms?: number;
    model_retries?: number;
  };
  const rulesSetting = await c.env.DB
    .prepare(`SELECT value FROM settings WHERE key = 'rules'`)
    .first<{ value: string }>();
  const thresholds = JSON.parse(rulesSetting?.value ?? '{}');

  // Triage
  const id          = randomId('r-');
  const reportedAt  = new Date().toISOString();
  const modelInput  = { id, text, lat, lng, reported_at: reportedAt, photo_url: null };

  let triageResult;
  let triagedBy: 'model' | 'rules' = 'model';

  const modelResult = await callModel(
    c.env.AI,
    modelInput,
    zones,
    triageCfg.model_timeout_ms ?? 8000,
    triageCfg.model_retries ?? 1,
  );

  if (modelResult) {
    triageResult = modelResult;
  } else {
    triagedBy    = 'rules';
    triageResult = fallbackTriage({ text, lat, lng, zones });
  }

  const route = applyRoutingRules(triageResult, thresholds);

  // Map route to initial status
  const statusMap: Record<string, string> = {
    publish:        'published',
    needs_approval: 'needs_review',
    reject:         'rejected',
  };
  const status       = statusMap[route] ?? 'received';
  const followToken  = randomId('t-', 32);

  // Check for paused zone
  const zoneRow = await c.env.DB
    .prepare(`SELECT status, pause_reason FROM zones WHERE id = ?1`)
    .bind(triageResult.zone)
    .first<{ status: string; pause_reason: string | null }>();
  const zoneNote = zoneRow?.status === 'paused'
    ? ` Zone ${triageResult.zone} is currently paused: ${zoneRow.pause_reason ?? 'reason unavailable'}.`
    : '';

  // Insert report
  await c.env.DB.prepare(`
    INSERT INTO reports
      (id, text, lat, lng, photo, type, size, priority, zone, confidence, reason, route, triaged_by, status, follow_token)
    VALUES
      (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15)
  `).bind(
    id, text, lat, lng,
    photo ?? null,
    triageResult.type, triageResult.size, triageResult.priority,
    triageResult.zone, triageResult.confidence,
    triageResult.reason + zoneNote,
    route, triagedBy, status, followToken,
  ).run();

  // Log events
  await appendEvent({ db: c.env.DB, reportId: id, actor: 'system', field: 'status', oldValue: null, newValue: 'received' });
  await appendEvent({ db: c.env.DB, reportId: id, actor: 'system', field: 'status', oldValue: 'received', newValue: status });

  const baseUrl = new URL(c.req.url).origin;
  return c.json({
    id,
    follow_link: `${baseUrl}/follow?id=${id}&token=${followToken}`,
    status,
    zone: triageResult.zone + zoneNote,
  }, 201);
});

// ─── GET /api/reports/:id/follow ─────────────────────────────────────────────

router.get('/:id/follow', async (c) => {
  const { id }    = c.req.param();
  const { token } = c.req.query();

  if (!token) {
    return c.json({ error: 'Follow token is required.' }, 400);
  }

  const report = await c.env.DB
    .prepare(`SELECT * FROM reports WHERE id = ?1 AND follow_token = ?2`)
    .bind(id, token)
    .first<Record<string, unknown>>();

  if (!report) {
    return c.json({ error: 'Report not found or invalid token.' }, 404);
  }

  const events = await c.env.DB
    .prepare(`SELECT field, old_value, new_value, created_at FROM report_events WHERE report_id = ?1 ORDER BY created_at ASC`)
    .bind(id)
    .all<{ field: string; old_value: string; new_value: string; created_at: string }>();

  // If merged, get main report info
  let mergedInto = null;
  if (report.merged_into) {
    const main = await c.env.DB
      .prepare(`SELECT id, text, status FROM reports WHERE id = ?1`)
      .bind(report.merged_into)
      .first<{ id: string; text: string; status: string }>();
    mergedInto = main;
  }

  // Return safe fields only (no personal data, no internal tokens)
  return c.json({
    id:         report.id,
    type:       report.type,
    size:       report.size,
    priority:   report.priority,
    zone:       report.zone,
    reason:     report.reason,
    triaged_by: report.triaged_by,
    status:     report.status,
    created_at: report.created_at,
    updated_at: report.updated_at,
    merged_into: mergedInto,
    timeline:   events.results ?? [],
  });
});

export default router;
