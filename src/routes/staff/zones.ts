// src/routes/staff/zones.ts
// GET  /api/staff/zones       — list all zones with open report counts (admin)
// PATCH /api/staff/zones/:id  — pause or unpause a zone (admin)

import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../../middleware/auth.js';
import { requireAuth, requireAdmin } from '../../middleware/auth.js';

const router = new Hono<{ Bindings: Env }>();
router.use('*', requireAuth, requireAdmin);

router.get('/', async (c) => {
  const zones = await c.env.DB
    .prepare(`
      SELECT z.id, z.name, z.crew, z.status, z.pause_reason, z.paused_until,
        COUNT(r.id) AS open_count
      FROM zones z
      LEFT JOIN reports r ON r.zone = z.id AND r.status IN ('published','in_progress','needs_review')
      GROUP BY z.id
      ORDER BY z.id
    `)
    .all<Record<string, unknown>>();

  return c.json({ zones: zones.results ?? [] });
});

const ZonePatchSchema = z.object({
  status:       z.enum(['active', 'paused']),
  pause_reason: z.string().max(300).optional().nullable(),
  paused_until: z.string().optional().nullable(), // ISO date string
});

router.patch('/:id', async (c) => {
  const { id } = c.req.param();

  let body: unknown;
  try { body = await c.req.json(); }
  catch { return c.json({ error: 'Invalid JSON.' }, 400); }

  const parsed = ZonePatchSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Invalid fields.', details: parsed.error.flatten() }, 400);

  const { status, pause_reason, paused_until } = parsed.data;

  const zone = await c.env.DB
    .prepare(`SELECT id FROM zones WHERE id = ?1`)
    .bind(id)
    .first<{ id: string }>();
  if (!zone) return c.json({ error: 'Zone not found.' }, 404);

  await c.env.DB
    .prepare(`
      UPDATE zones
      SET status = ?1, pause_reason = ?2, paused_until = ?3, updated_at = datetime('now')
      WHERE id = ?4
    `)
    .bind(status, pause_reason ?? null, paused_until ?? null, id)
    .run();

  return c.json({ ok: true, id, status });
});

export default router;
