// src/services/triage/rules.ts
// Deterministic routing rules that OVERRIDE the AI model.
// These are tested independently and never change based on model output alone.

export type ReportType = 'pothole' | 'street_light' | 'flooding' | 'rubbish' | 'not_relevant';
export type ReportSize = 'small' | 'medium' | 'large';
export type Route = 'publish' | 'needs_approval' | 'reject';

export interface TriageResult {
  type: ReportType;
  size: ReportSize;
  priority: number;
  zone: string;
  confidence: number;
  reason: string;
  route: Route;
  triaged_by: 'model' | 'rules';
}

export interface RoutingThresholds {
  approval_priority_at_or_above: number; // default 4
  approval_confidence_below: number;     // default 0.7
  reject_types: string[];                // default ['not_relevant']
}

const DEFAULT_THRESHOLDS: RoutingThresholds = {
  approval_priority_at_or_above: 4,
  approval_confidence_below: 0.7,
  reject_types: ['not_relevant'],
};

/**
 * Apply the fixed routing rules to a triage result.
 * The rules override anything the AI model suggests.
 *
 * Rule order (first match wins):
 *   1. Type in reject_types        → reject
 *   2. Priority >= approval_priority → needs_approval
 *   3. Confidence < approval_confidence → needs_approval
 *   4. Otherwise                   → publish
 */
export function applyRoutingRules(
  result: Pick<TriageResult, 'type' | 'priority' | 'confidence'>,
  thresholds: RoutingThresholds = DEFAULT_THRESHOLDS,
): Route {
  if (thresholds.reject_types.includes(result.type)) return 'reject';
  if (result.priority >= thresholds.approval_priority_at_or_above) return 'needs_approval';
  if (result.confidence < thresholds.approval_confidence_below) return 'needs_approval';
  return 'publish';
}

/** Clamp a number to a valid range. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Ensure a value is one of a set of allowed strings, returning the default if not. */
export function coerce<T extends string>(value: unknown, allowed: T[], fallback: T): T {
  if (typeof value === 'string' && allowed.includes(value as T)) return value as T;
  return fallback;
}

export const VALID_TYPES: ReportType[] = ['pothole', 'street_light', 'flooding', 'rubbish', 'not_relevant'];
export const VALID_SIZES: ReportSize[] = ['small', 'medium', 'large'];
