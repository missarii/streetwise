// src/routes/staff/queue.ts
// GET /api/staff/queue — reports requiring human review, sorted by priority then age.
// Accessible by all staff.

import { Hono } from 'hono';
import type { Env } from '../../middleware/auth.js';
import { requireAuth } from '../../middleware/auth.js';

const router = new Hono<{ Bindings: Env }>();

router.use('*', requireAuth);

router.get('/', async (c) => {
  const db = c.env.DB;

  // All reports in needs_review status, most urgent first
  const reports = await db
    .prepare(`
      SELECT id, text, lat, lng, type, size, priority, zone,
             confidence, reason, triaged_by, route, status, created_at
      FROM reports
      WHERE status = 'needs_review'
      ORDER BY priority DESC, created_at ASC
    `)
    .all<Record<string, unknown>>();

  // Summary counts by review reason
  const highPriority = (reports.results ?? []).filter(r => Number(r.priority) >= 4).length;
  const lowConfidence = (reports.results ?? []).filter(
    r => Number(r.confidence) < 0.7 && Number(r.priority) < 4,
  ).length;
  const notRelevant   = (reports.results ?? []).filter(r => r.type === 'not_relevant').length;
  // Possible duplicate detection (reports within 100m of an existing published report)
  const possibleDuplicate = 0; // computed per-report in review screen

  return c.json({
    counts: { highPriority, lowConfidence, notRelevant, possibleDuplicate },
    reports: reports.results ?? [],
  });
});

export default router;
