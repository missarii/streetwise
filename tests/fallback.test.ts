import { describe, it, expect } from 'vitest';
import { fallbackTriage } from '../src/services/triage/fallback.js';
import { applyRoutingRules } from '../src/services/triage/rules.js';

// Minimal zone set for tests
const TEST_ZONES = [
  { id: 'Z-01', polygon: [[79.842,6.929],[79.862,6.929],[79.862,6.944],[79.842,6.944],[79.842,6.929]] as [number,number][] },
  { id: 'Z-03', polygon: [[79.868,6.906],[79.889,6.906],[79.889,6.925],[79.868,6.925],[79.868,6.906]] as [number,number][] },
  { id: 'Z-04', polygon: [[79.856,6.868],[79.871,6.868],[79.871,6.898],[79.856,6.898],[79.856,6.868]] as [number,number][] },
  { id: 'Z-05', polygon: [[79.873,6.884],[79.894,6.884],[79.894,6.903],[79.873,6.903],[79.873,6.884]] as [number,number][] },
];

const DEFAULT_RULES = {
  approval_priority_at_or_above: 4,
  approval_confidence_below: 0.7,
  reject_types: ['not_relevant'] as string[],
};

describe('fallbackTriage', () => {
  it('returns a valid result without throwing', () => {
    const result = fallbackTriage({ text: 'Big pothole on the road', lat: 6.91, lng: 79.87, zones: TEST_ZONES });
    expect(result).toHaveProperty('type');
    expect(result).toHaveProperty('size');
    expect(result).toHaveProperty('priority');
    expect(result).toHaveProperty('zone');
    expect(result).toHaveProperty('confidence');
    expect(result).toHaveProperty('reason');
  });

  it('detects flooding from keywords', () => {
    const r = fallbackTriage({ text: 'Flood water on the road near my house', lat: 6.91, lng: 79.88, zones: TEST_ZONES });
    expect(r.type).toBe('flooding');
  });

  it('detects pothole from keywords', () => {
    const r = fallbackTriage({ text: 'Deep pothole at the junction', lat: 6.91, lng: 79.88, zones: TEST_ZONES });
    expect(r.type).toBe('pothole');
  });

  it('detects street light from keywords', () => {
    const r = fallbackTriage({ text: 'Street lamp is out near the bus stop', lat: 6.91, lng: 79.87, zones: TEST_ZONES });
    expect(r.type).toBe('street_light');
  });

  it('detects rubbish from keywords', () => {
    const r = fallbackTriage({ text: 'Garbage dumped behind the shop', lat: 6.91, lng: 79.87, zones: TEST_ZONES });
    expect(r.type).toBe('rubbish');
  });

  it('marks not_relevant for clearly irrelevant short text', () => {
    const r = fallbackTriage({ text: 'hi', lat: 6.91, lng: 79.87, zones: TEST_ZONES });
    expect(r.type).toBe('not_relevant');
  });

  it('sets confidence below 0.7 (triggers review in rules)', () => {
    const r = fallbackTriage({ text: 'Something on the road', lat: 6.91, lng: 79.88, zones: TEST_ZONES });
    expect(r.confidence).toBeLessThan(0.7);
  });

  it('routes fallback result to needs_approval (low confidence)', () => {
    const r = fallbackTriage({ text: 'Something on the road', lat: 6.91, lng: 79.88, zones: TEST_ZONES });
    const route = applyRoutingRules(r, DEFAULT_RULES);
    expect(route).toBe('needs_approval');
  });

  it('assigns a valid zone ID from the zone list', () => {
    const r = fallbackTriage({ text: 'Pothole on the road', lat: 6.93, lng: 79.85, zones: TEST_ZONES });
    const validZones = TEST_ZONES.map(z => z.id);
    expect(validZones).toContain(r.zone);
  });

  it('priority escalates for emergency keywords', () => {
    const r = fallbackTriage({ text: 'Danger! live wire sparking on the road', lat: 6.91, lng: 79.87, zones: TEST_ZONES });
    expect(r.priority).toBeGreaterThanOrEqual(4);
  });

  it('priority escalates for sensitive locations', () => {
    const r = fallbackTriage({ text: 'Water flooding the hospital entrance', lat: 6.91, lng: 79.87, zones: TEST_ZONES });
    expect(r.priority).toBeGreaterThanOrEqual(4);
  });

  it('priority is a number 1-5', () => {
    const r = fallbackTriage({ text: 'Small crack in the pavement', lat: 6.91, lng: 79.87, zones: TEST_ZONES });
    expect(r.priority).toBeGreaterThanOrEqual(1);
    expect(r.priority).toBeLessThanOrEqual(5);
  });

  it('never throws when given empty text', () => {
    expect(() => fallbackTriage({ text: '', lat: 6.9, lng: 79.87, zones: TEST_ZONES })).not.toThrow();
  });

  it('never throws for out-of-city coordinates (uses nearest zone)', () => {
    expect(() => fallbackTriage({ text: 'Pothole', lat: 0, lng: 0, zones: TEST_ZONES })).not.toThrow();
  });
});
