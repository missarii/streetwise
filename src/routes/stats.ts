// src/routes/stats.ts
// GET /api/stats — live totals for the public map counters.
// Also returns the 30-day daily series for the chart.

import { Hono } from 'hono';
import type { Env } from '../middleware/auth.js';

const router = new Hono<{ Bindings: Env }>();

router.get('/', async (c) => {
  const db = c.env.DB;

  // Live totals (public-safe statuses only)
  const totals = await db
    .prepare(`
      SELECT
        COUNT(CASE WHEN status IN ('published','in_progress') THEN 1 END)                          AS open_count,
        COUNT(CASE WHEN status = 'fixed' AND updated_at >= datetime('now','-30 days') THEN 1 END)  AS fixed_30d,
        COUNT(CASE WHEN status = 'fixed' THEN 1 END)                                               AS fixed_total
      FROM reports
    `)
    .first<{ open_count: number; fixed_30d: number; fixed_total: number }>();

  // Per-zone open counts
  const zonesResult = await db
    .prepare(`
      SELECT zone, COUNT(*) AS open_count
      FROM reports
      WHERE status IN ('published','in_progress')
      GROUP BY zone
    `)
    .all<{ zone: string; open_count: number }>();

  // 30-day daily series (for chart)
  const seriesResult = await db
    .prepare(`
      SELECT
        date(created_at) AS day,
        COUNT(*) AS reported
      FROM reports
      WHERE created_at >= datetime('now','-30 days')
        AND status IN ('published','in_progress','fixed')
      GROUP BY date(created_at)
      ORDER BY day ASC
    `)
    .all<{ day: string; reported: number }>();

  const fixedSeriesResult = await db
    .prepare(`
      SELECT
        date(updated_at) AS day,
        COUNT(*) AS fixed
      FROM reports
      WHERE status = 'fixed'
        AND updated_at >= datetime('now','-30 days')
      GROUP BY date(updated_at)
      ORDER BY day ASC
    `)
    .all<{ day: string; fixed: number }>();

  return c.json({
    totals: {
      open:        totals?.open_count  ?? 0,
      fixed_30d:   totals?.fixed_30d   ?? 0,
      fixed_total: totals?.fixed_total ?? 0,
    },
    zones: zonesResult.results ?? [],
    series: {
      reported: seriesResult.results    ?? [],
      fixed:    fixedSeriesResult.results ?? [],
    },
  });
});

export default router;
