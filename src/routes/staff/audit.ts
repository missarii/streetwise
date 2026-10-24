// src/routes/staff/audit.ts
// GET /api/staff/audit — audit log, newest first, filterable by actor and report ID.
// Admin only.

import { Hono } from 'hono';
import type { Env } from '../../middleware/auth.js';
import { requireAuth, requireAdmin } from '../../middleware/auth.js';

const router = new Hono<{ Bindings: Env }>();
router.use('*', requireAuth, requireAdmin);

router.get('/', async (c) => {
  const { actor, report_id, limit = '100', offset = '0' } = c.req.query();

  let query = `
    SELECT e.id, e.report_id, e.actor, e.field, e.old_value, e.new_value, e.created_at
    FROM report_events e
    WHERE 1=1
  `;
  const params: (string | number)[] = [];

  if (actor) {
    query += ` AND e.actor = ?${params.length + 1}`;
    params.push(actor);
  }
  if (report_id) {
    query += ` AND e.report_id = ?${params.length + 1}`;
    params.push(report_id);
  }

  query += ` ORDER BY e.created_at DESC LIMIT ?${params.length + 1} OFFSET ?${params.length + 2}`;
  params.push(Number(limit), Number(offset));

  const events = await c.env.DB
    .prepare(query)
    .bind(...params)
    .all<Record<string, unknown>>();

  // Get unique actors for filter dropdown
  const actors = await c.env.DB
    .prepare(`SELECT DISTINCT actor FROM report_events ORDER BY actor`)
    .all<{ actor: string }>();

  return c.json({
    events:  events.results  ?? [],
    actors:  actors.results  ?? [],
    total:   events.results?.length ?? 0,
  });
});

export default router;
