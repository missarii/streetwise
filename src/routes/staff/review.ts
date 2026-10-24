// src/routes/staff/review.ts
// Report review actions: approve, reject, merge, edit, mark in_progress/fixed.
// Every action is logged to report_events.

import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../../middleware/auth.js';
import { requireAuth } from '../../middleware/auth.js';
import { appendEvent } from '../../services/events.js';
import { VALID_TYPES, VALID_SIZES } from '../../services/triage/rules.js';

const router = new Hono<{ Bindings: Env }>();
router.use('*', requireAuth);

/** Helper to get a report, returning 404 if not found. */
async function getReport(db: D1Database, id: string) {
  return db
    .prepare(`SELECT * FROM reports WHERE id = ?1`)
    .bind(id)
    .first<Record<string, unknown>>();
}

/** Update a report field and log the event. */
async function updateField(
  db: D1Database,
  reportId: string,
  actor: string,
  field: string,
  oldValue: unknown,
  newValue: unknown,
  sqlField?: string,
): Promise<void> {
  await db
    .prepare(`UPDATE reports SET ${sqlField ?? field} = ?1, updated_at = datetime('now') WHERE id = ?2`)
    .bind(String(newValue), reportId)
    .run();
  await appendEvent({
    db, reportId, actor, field,
    oldValue: oldValue != null ? String(oldValue) : null,
    newValue: newValue != null ? String(newValue) : null,
  });
}

// GET /api/staff/reports/:id — full report detail with events and duplicates
router.get('/:id', async (c) => {
  const { id } = c.req.param();
  const report = await getReport(c.env.DB, id);
  if (!report) return c.json({ error: 'Report not found.' }, 404);

  const events = await c.env.DB
    .prepare(`SELECT * FROM report_events WHERE report_id = ?1 ORDER BY created_at ASC`)
    .bind(id)
    .all<Record<string, unknown>>();

  // Find nearby open reports (possible duplicates): within ~0.5km
  const lat = Number(report.lat);
  const lng = Number(report.lng);
  const duplicates = await c.env.DB
    .prepare(`
      SELECT id, text, type, priority, status, created_at,
        ((?1 - lat)*(?1 - lat) + (?2 - lng)*(?2 - lng)) AS dist_sq
      FROM reports
      WHERE id != ?3
        AND status IN ('published','in_progress','needs_review')
        AND ((?1 - lat)*(?1 - lat) + (?2 - lng)*(?2 - lng)) < 0.00002
      ORDER BY dist_sq ASC
      LIMIT 5
    `)
    .bind(lat, lng, id)
    .all<Record<string, unknown>>();

  return c.json({
    report,
    events:     events.results     ?? [],
    duplicates: duplicates.results ?? [],
  });
});

// POST /api/staff/reports/:id/approve
router.post('/:id/approve', async (c) => {
  const { id } = c.req.param();
  const user   = c.get('user');
  const report = await getReport(c.env.DB, id);
  if (!report) return c.json({ error: 'Report not found.' }, 404);

  await updateField(c.env.DB, id, user.email, 'status', report.status, 'published');
  return c.json({ ok: true, status: 'published' });
});

// POST /api/staff/reports/:id/reject
router.post('/:id/reject', async (c) => {
  const { id } = c.req.param();
  const user   = c.get('user');

  let body: unknown;
  try { body = await c.req.json(); } catch { body = {}; }
  const { reason } = (body as Record<string, string>) ?? {};

  const report = await getReport(c.env.DB, id);
  if (!report) return c.json({ error: 'Report not found.' }, 404);

  if (reason) {
    await c.env.DB
      .prepare(`UPDATE reports SET reason = ?1, updated_at = datetime('now') WHERE id = ?2`)
      .bind(String(report.reason ?? '') + ` Rejected: ${reason}`, id)
      .run();
  }
  await updateField(c.env.DB, id, user.email, 'status', report.status, 'rejected');
  return c.json({ ok: true, status: 'rejected' });
});

// POST /api/staff/reports/:id/merge
router.post('/:id/merge', async (c) => {
  const { id } = c.req.param();
  const user   = c.get('user');

  let body: unknown;
  try { body = await c.req.json(); } catch { body = {}; }
  const { into } = (body as Record<string, string>) ?? {};
  if (!into) return c.json({ error: '"into" report ID is required.' }, 400);

  const target = await getReport(c.env.DB, into);
  if (!target) return c.json({ error: 'Target report not found.' }, 404);

  const report = await getReport(c.env.DB, id);
  if (!report) return c.json({ error: 'Report not found.' }, 404);

  await c.env.DB
    .prepare(`UPDATE reports SET merged_into = ?1, status = 'merged', updated_at = datetime('now') WHERE id = ?2`)
    .bind(into, id)
    .run();
  await appendEvent({
    db: c.env.DB, reportId: id, actor: user.email,
    field: 'merged_into', oldValue: null, newValue: into,
  });
  await appendEvent({
    db: c.env.DB, reportId: id, actor: user.email,
    field: 'status', oldValue: String(report.status), newValue: 'merged',
  });
  return c.json({ ok: true, merged_into: into });
});

// PATCH /api/staff/reports/:id — edit type, priority, or status
router.patch('/:id', async (c) => {
  const { id } = c.req.param();
  const user   = c.get('user');

  const PatchSchema = z.object({
    type:     z.enum(['pothole','street_light','flooding','rubbish','not_relevant']).optional(),
    size:     z.enum(['small','medium','large']).optional(),
    priority: z.number().int().min(1).max(5).optional(),
    status:   z.enum(['published','in_progress','fixed','needs_review','rejected']).optional(),
  });

  let body: unknown;
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON.' }, 400); }

  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Invalid fields.', details: parsed.error.flatten() }, 400);

  const report = await getReport(c.env.DB, id);
  if (!report) return c.json({ error: 'Report not found.' }, 404);

  const updates = parsed.data;
  for (const [field, value] of Object.entries(updates)) {
    if (value !== undefined) {
      await updateField(c.env.DB, id, user.email, field, report[field], value);
    }
  }

  return c.json({ ok: true });
});

export default router;
