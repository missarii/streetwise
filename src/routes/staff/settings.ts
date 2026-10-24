// src/routes/staff/settings.ts
// GET /api/staff/settings — read all settings (admin)
// PUT /api/staff/settings — save settings (admin)

import { Hono } from 'hono';
import type { Env } from '../../middleware/auth.js';
import { requireAuth, requireAdmin } from '../../middleware/auth.js';

const router = new Hono<{ Bindings: Env }>();
router.use('*', requireAuth, requireAdmin);

router.get('/', async (c) => {
  const rows = await c.env.DB
    .prepare(`SELECT key, value FROM settings`)
    .all<{ key: string; value: string }>();

  const settings: Record<string, unknown> = {};
  for (const row of rows.results ?? []) {
    try { settings[row.key] = JSON.parse(row.value); }
    catch { settings[row.key] = row.value; }
  }

  return c.json({ settings });
});

router.put('/', async (c) => {
  let body: unknown;
  try { body = await c.req.json(); }
  catch { return c.json({ error: 'Invalid JSON.' }, 400); }

  const updates = body as Record<string, unknown>;
  const allowed = ['map','report_types','sizes','metrics','rules','triage'];

  const stmts = [];
  for (const [key, value] of Object.entries(updates)) {
    if (!allowed.includes(key)) continue; // silently skip unknown keys
    stmts.push(
      c.env.DB
        .prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2)`)
        .bind(key, JSON.stringify(value))
    );
  }

  if (stmts.length > 0) {
    await c.env.DB.batch(stmts);
  }

  return c.json({ ok: true, updated: stmts.length });
});

export default router;
