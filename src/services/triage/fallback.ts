// src/services/triage/fallback.ts
// Keyword + location based triage used when the AI model fails, times out,
// or has no allowance. Reports are never lost — this always returns a result.

import type { ReportType, ReportSize } from './rules.js';
import { findZone, type ZoneRecord } from './zone.js';

interface FallbackInput {
  text: string;
  lat: number;
  lng: number;
  zones: ZoneRecord[];
}

interface FallbackResult {
  type: ReportType;
  size: ReportSize;
  priority: number;
  zone: string;
  confidence: number;
  reason: string;
}

// Keywords mapped to report types (order matters: first match wins)
const TYPE_KEYWORDS: Record<ReportType, string[]> = {
  flooding:     ['flood','water','drain','wathura','wet','rain','pool','inundated','submerged','overflow','canal','rivulet','rising','waterlogged'],
  pothole:      ['pothole','hole','crater','crack','broken road','road broken','uneven','subsidence','collapse','manhole','railing','bridge','bump','bumps','old repair','scraping'],
  street_light: ['light','lamp','dark','bulb','wire','electricity','electric','sparking','flicker','outage','stays on','wasting power'],
  rubbish:      ['rubbish','garbage','trash','dump','waste','bin','litter','debris','junk','burning','rotting','nails','glass','mattress','scraps','metal scrap'],
  not_relevant: ['timetable','bus schedule','job','wallet','lost','rude','shop','apply','test test','hello','hi '],
};

// Context words that boost priority
const PRIORITY_5_WORDS  = ['danger','emergency','live wire','ambulance blocked','road blocked','cannot pass','unconscious','major accident'];
const PRIORITY_4_WORDS  = ['urgent','accident','nearly fell','stalled','fire','burning','smoke','nails','metal scrap','scraps across','sharp','injury','blocking ambulance','cannot cross'];
const SENSITIVE_PLACES  = ['school','hospital','clinic','bus stop','bus stand','bus halt','ambulance','police','market'];
// Flooding that completely blocks movement → P5
const FLOOD_P5_WORDS    = ['full on the road','cannot cross','cannot pass','blocking'];
// Street lights still operating (wrong schedule) → cosmetic P1
const LIGHT_P1_WORDS    = ['stays on','wasting power','all day','daytime','still on'];

/** Count how many keywords from the list appear in the text (case-insensitive). */
function countMatches(text: string, keywords: string[]): number {
  const lower = text.toLowerCase();
  return keywords.filter(k => lower.includes(k)).length;
}

/** Choose the type with the most keyword matches. */
function detectType(text: string): ReportType {
  const scores = Object.entries(TYPE_KEYWORDS).map(([type, kws]) => ({
    type: type as ReportType,
    score: countMatches(text, kws),
  }));
  scores.sort((a, b) => b.score - a.score);
  // If top score is 0 and text is very short, mark not_relevant
  if (scores[0].score === 0 && text.trim().length < 15) return 'not_relevant';
  return scores[0].score > 0 ? scores[0].type : 'rubbish'; // default guess
}

/** Estimate priority from context words and type. */
function estimatePriority(text: string, type: ReportType): number {
  const lower = text.toLowerCase();

  if (type === 'not_relevant') return 1;

  // Street light still on during the day = cosmetic (P1)
  if (type === 'street_light' && LIGHT_P1_WORDS.some(w => lower.includes(w))) return 1;

  // Absolute danger signals → P5
  if (PRIORITY_5_WORDS.some(w => lower.includes(w))) return 5;

  // Flooding that blocks movement → P5
  if (type === 'flooding' && FLOOD_P5_WORDS.some(w => lower.includes(w))) return 5;

  // Injury-risk or hazardous materials signals → P4
  if (PRIORITY_4_WORDS.some(w => lower.includes(w))) return 4;

  // Near a sensitive place → P4
  if (SENSITIVE_PLACES.some(w => lower.includes(w))) return 4;

  // Type-based defaults
  if (type === 'flooding')     return 3;
  if (type === 'street_light') return 2;
  if (type === 'pothole')      return 2;
  return 2;
}

/** Estimate size from context. */
function estimateSize(text: string, priority: number): ReportSize {
  const lower = text.toLowerCase();
  if (priority >= 5 || lower.includes('large') || lower.includes('big') || lower.includes('full') || lower.includes('all')) return 'large';
  if (priority <= 1 || lower.includes('small') || lower.includes('little') || lower.includes('one lamp') || lower.includes('single')) return 'small';
  return 'medium';
}

/**
 * Produce a triage result using only keywords and location.
 * Always succeeds. Sets confidence to 0.55 to signal rule-based routing.
 */
export function fallbackTriage(input: FallbackInput): FallbackResult {
  const type     = detectType(input.text);
  const priority = estimatePriority(input.text, type);
  const size     = estimateSize(input.text, priority);
  const zone     = findZone(input.lat, input.lng, input.zones);

  return {
    type,
    size,
    priority,
    zone,
    confidence: 0.55, // below threshold → will trigger needs_approval review
    reason: `Classified by keyword analysis (AI unavailable). Type detected: ${type}.`,
  };
}
