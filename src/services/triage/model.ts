// src/services/triage/model.ts
// Calls Cloudflare Workers AI with a timeout and retry limit.
// Parses the JSON response and validates all fields.

import type { ReportType, ReportSize } from './rules.js';
import { coerce, clamp, VALID_TYPES, VALID_SIZES } from './rules.js';
import { findZone, type ZoneRecord } from './zone.js';

export interface ModelInput {
  id: string;
  text: string;
  lat: number;
  lng: number;
  reported_at: string;
  photo_url?: string | null;
}

export interface ModelResult {
  type: ReportType;
  size: ReportSize;
  priority: number;
  zone: string;
  confidence: number;
  reason: string;
}

// The prompt that guides the AI model. Kept as a pure string for testability.
function buildPrompt(input: ModelInput): string {
  return `You are a city maintenance report classifier for Colombo, Sri Lanka.

Classify the following citizen report. Respond ONLY with valid JSON — no markdown, no explanation.

Priority scale (use EXACTLY this):
5 = Danger to people NOW or main road blocked (deep flood, collapsed road, fallen pole, live wires)
4 = Likely injury or damage soon (near accident, hazard at school/hospital/bus stop, water rising toward homes)
3 = Clear problem on a busy route that needs a crew this week
2 = Minor, low traffic, or a recurring nuisance
1 = Cosmetic, still working, or unclear

Report: "${input.text}"
Location: lat=${input.lat}, lng=${input.lng}
Reported: ${input.reported_at}

Required JSON response (all fields required):
{
  "type": one of ["pothole","street_light","flooding","rubbish","not_relevant"],
  "size": one of ["small","medium","large"],
  "priority": integer 1 to 5,
  "confidence": float 0.0 to 1.0,
  "reason": "one sentence max 150 chars"
}`;
}

/** Extract the first JSON object from a string (model may wrap in prose). */
function extractJson(raw: string): unknown {
  const start = raw.indexOf('{');
  const end   = raw.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('No JSON object found in model response');
  return JSON.parse(raw.slice(start, end + 1));
}

/**
 * Call Workers AI with a configurable timeout and retry.
 * Returns null on any failure so the caller can fall back to keyword rules.
 */
export async function callModel(
  ai: Ai,
  input: ModelInput,
  zones: ZoneRecord[],
  timeoutMs: number,
  retries: number,
): Promise<ModelResult | null> {
  const prompt = buildPrompt(input);

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      let raw: string;
      try {
        const response = await ai.run('@cf/meta/llama-3.1-8b-instruct', {
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 200,
        }) as { response?: string };
        raw = response.response ?? '';
      } finally {
        clearTimeout(timer);
      }

      const parsed = extractJson(raw) as Record<string, unknown>;

      const type       = coerce(parsed.type,       VALID_TYPES, 'not_relevant');
      const size       = coerce(parsed.size,       VALID_SIZES, 'medium');
      const priority   = clamp(Math.round(Number(parsed.priority ?? 2)), 1, 5);
      const confidence = clamp(Number(parsed.confidence ?? 0.5), 0, 1);
      const reason     = String(parsed.reason ?? '').slice(0, 150) || 'Classified by AI model.';
      const zone       = findZone(input.lat, input.lng, zones);

      return { type, size, priority, zone, confidence, reason };
    } catch (err) {
      console.error(`[triage/model] attempt ${attempt + 1} failed:`, err instanceof Error ? err.message : err);
      if (attempt === retries) return null; // give up → caller uses fallback
    }
  }
  return null;
}
