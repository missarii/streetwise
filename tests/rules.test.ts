import { describe, it, expect } from 'vitest';
import { applyRoutingRules, type RoutingThresholds } from '../src/services/triage/rules.js';

const DEFAULT: RoutingThresholds = {
  approval_priority_at_or_above: 4,
  approval_confidence_below: 0.7,
  reject_types: ['not_relevant'],
};

describe('applyRoutingRules', () => {
  // ── Reject rules ──────────────────────────────────────────────────────────
  it('rejects not_relevant type regardless of priority', () => {
    expect(applyRoutingRules({ type: 'not_relevant', priority: 1, confidence: 0.95 }, DEFAULT))
      .toBe('reject');
  });

  it('rejects not_relevant even when high priority', () => {
    expect(applyRoutingRules({ type: 'not_relevant', priority: 5, confidence: 0.95 }, DEFAULT))
      .toBe('reject');
  });

  // ── Needs approval rules ──────────────────────────────────────────────────
  it('needs_approval when priority equals threshold (4)', () => {
    expect(applyRoutingRules({ type: 'pothole', priority: 4, confidence: 0.9 }, DEFAULT))
      .toBe('needs_approval');
  });

  it('needs_approval when priority exceeds threshold (5)', () => {
    expect(applyRoutingRules({ type: 'flooding', priority: 5, confidence: 0.95 }, DEFAULT))
      .toBe('needs_approval');
  });

  it('needs_approval when confidence below threshold (0.65)', () => {
    expect(applyRoutingRules({ type: 'rubbish', priority: 2, confidence: 0.65 }, DEFAULT))
      .toBe('needs_approval');
  });

  it('needs_approval when confidence exactly at 0.0', () => {
    expect(applyRoutingRules({ type: 'pothole', priority: 2, confidence: 0 }, DEFAULT))
      .toBe('needs_approval');
  });

  it('needs_approval when confidence at boundary (0.699)', () => {
    expect(applyRoutingRules({ type: 'pothole', priority: 2, confidence: 0.699 }, DEFAULT))
      .toBe('needs_approval');
  });

  // ── Publish rules ─────────────────────────────────────────────────────────
  it('publishes when priority 3 and confidence 0.7', () => {
    expect(applyRoutingRules({ type: 'pothole', priority: 3, confidence: 0.7 }, DEFAULT))
      .toBe('publish');
  });

  it('publishes when priority 1 and high confidence', () => {
    expect(applyRoutingRules({ type: 'rubbish', priority: 1, confidence: 0.95 }, DEFAULT))
      .toBe('publish');
  });

  it('publishes when priority 3 and confidence exactly 0.7', () => {
    expect(applyRoutingRules({ type: 'street_light', priority: 3, confidence: 0.7 }, DEFAULT))
      .toBe('publish');
  });

  // ── Custom thresholds ─────────────────────────────────────────────────────
  it('respects custom priority threshold', () => {
    const custom: RoutingThresholds = { ...DEFAULT, approval_priority_at_or_above: 5 };
    // priority 4 should now publish (below custom threshold)
    expect(applyRoutingRules({ type: 'pothole', priority: 4, confidence: 0.9 }, custom))
      .toBe('publish');
    // priority 5 should still need approval
    expect(applyRoutingRules({ type: 'pothole', priority: 5, confidence: 0.9 }, custom))
      .toBe('needs_approval');
  });

  it('respects custom confidence threshold', () => {
    const custom: RoutingThresholds = { ...DEFAULT, approval_confidence_below: 0.5 };
    // confidence 0.6 should now publish (above custom threshold)
    expect(applyRoutingRules({ type: 'pothole', priority: 2, confidence: 0.6 }, custom))
      .toBe('publish');
  });

  it('not_relevant rule first — overrides priority', () => {
    // Even if priority would trigger needs_approval, not_relevant → reject wins
    const result = applyRoutingRules({ type: 'not_relevant', priority: 5, confidence: 0.0 }, DEFAULT);
    expect(result).toBe('reject');
  });
});
