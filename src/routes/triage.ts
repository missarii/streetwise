// src/routes/triage.ts
// POST /api/triage — open contract endpoint.
// Rate-limited per IP. Never persists the report. Returns decision within 10s.

import { Hono } from 'hono';
import type { Env } from '../middleware/auth.js';
import { TriageRequestSchema } from '../validators/triage.js';
import { callModel } from '../services/triage/model.js';
import { fallbackTriage } from '../services/triage/fallback.js';
import { applyRoutingRules } from '../services/triage/rules.js';
import { parseZonePolygon } from '../services/triage/zone.js';
import { checkRateLimit, rateLimitResponse } from '../services/rateLimit.js';
import { getClientIp } from '../middleware/auth.js';

const router = new Hono<{ Bindings: Env }>();

router.post('/', async (c) => {
  // Rate limit: 20 requests per IP per hour
  const ip = getClientIp(c);
  const allowed = await checkRateLimit(c.env.DB, ip, '/api/triage');
  if (!allowed) return rateLimitResponse();

  // Validate request body
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Request body must be valid JSON.' }, 400);
  }

  const parsed = TriageRequestSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid request.', details: parsed.error.flatten() }, 400);
  }

  const input = parsed.data;

  // Load zones for location assignment
  const zonesRows = await c.env.DB
    .prepare(`SELECT id, polygon FROM zones`)
    .all<{ id: string; polygon: string }>();

  const zones = (zonesRows.results ?? []).map(z => ({
    id: z.id,
    polygon: parseZonePolygon(z.polygon),
  }));

  // Load triage config from settings
  const triageSetting = await c.env.DB
    .prepare(`SELECT value FROM settings WHERE key = 'triage'`)
    .first<{ value: string }>();
  const triageCfg = JSON.parse(triageSetting?.value ?? '{}') as {
    model_timeout_ms?: number;
    model_retries?: number;
  };
  const timeoutMs = triageCfg.model_timeout_ms ?? 8000;
  const retries   = triageCfg.model_retries   ?? 1;

  // Load routing thresholds from settings
  const rulesSetting = await c.env.DB
    .prepare(`SELECT value FROM settings WHERE key = 'rules'`)
    .first<{ value: string }>();
  const thresholds = JSON.parse(rulesSetting?.value ?? '{}');

  // Try AI model, fall back to keyword rules
  let result;
  let triagedBy: 'model' | 'rules' = 'model';

  const modelResult = await callModel(c.env.AI, input, zones, timeoutMs, retries);

  if (modelResult) {
    result = modelResult;
  } else {
    triagedBy = 'rules';
    result = fallbackTriage({ text: input.text, lat: input.lat, lng: input.lng, zones });
  }

  // Apply deterministic routing rules (these override the model)
  const route = applyRoutingRules(result, thresholds);

  return c.json({
    id:          input.id,
    type:        result.type,
    size:        result.size,
    priority:    result.priority,
    zone:        result.zone,
    confidence:  result.confidence,
    reason:      result.reason,
    route,
    triaged_by:  triagedBy,
  });
});

export default router;
