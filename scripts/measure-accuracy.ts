#!/usr/bin/env node
// scripts/measure-accuracy.ts
// Run triage on all 40 labelled reports and compare to expected answers.
// Usage: npx tsx scripts/measure-accuracy.ts [--url http://localhost:8787]

import { fallbackTriage } from '../src/services/triage/fallback.js';
import { applyRoutingRules } from '../src/services/triage/rules.js';
import { findZone, parseZonePolygon } from '../src/services/triage/zone.js';
import zonesData   from '../data/zones.json' assert { type: 'json' };
import labelled    from '../data/labelled-reports.json' assert { type: 'json' };

// ── Copy data files from the starter pack ────────────────────────────────────
// Run: cp -r /path/to/starter/data ./data

const args   = process.argv.slice(2);
const urlIdx = args.indexOf('--url');
const BASE   = urlIdx !== -1 ? args[urlIdx + 1] : null;

const zones = (zonesData as any).zones.map((z: any) => ({
  id: z.id,
  polygon: parseZonePolygon(JSON.stringify(z.polygon)),
}));

const DEFAULT_RULES = {
  approval_priority_at_or_above: 4,
  approval_confidence_below: 0.7,
  reject_types: ['not_relevant'] as string[],
};

interface Report {
  id: string;
  text: string;
  lat: number;
  lng: number;
  reported_at: string;
  photo_url: string | null;
  expected: { type: string; size: string; priority: number; zone: string };
}

interface Result {
  id: string;
  expected: Report['expected'];
  got: { type: string; priority: number; zone: string; confidence: number; route: string };
  typeOk: boolean;
  priorityOk: boolean;
  zoneOk: boolean;
}

async function triageReport(r: Report): Promise<{ type: string; size: string; priority: number; zone: string; confidence: number; reason: string; route: string; triaged_by: string }> {
  if (BASE) {
    // Call the live API
    const res = await fetch(`${BASE}/api/triage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: r.id, text: r.text, lat: r.lat, lng: r.lng, reported_at: r.reported_at, photo_url: r.photo_url }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json() as any;
  }

  // Local fallback-only mode (no AI)
  const result = fallbackTriage({ text: r.text, lat: r.lat, lng: r.lng, zones });
  const route  = applyRoutingRules(result, DEFAULT_RULES);
  return { ...result, route, triaged_by: 'rules' };
}

async function main() {
  console.log(`\n🔍 Streetwise Accuracy Measurement`);
  console.log(`   Mode: ${BASE ? `Live API at ${BASE}` : 'Local fallback-only'}`);
  console.log(`   Reports: ${(labelled as any).reports.length}\n`);

  const reports: Report[] = (labelled as any).reports;
  const results: Result[] = [];
  const failures: Result[] = [];

  for (const r of reports) {
    try {
      const got = await triageReport(r);
      const result: Result = {
        id: r.id,
        expected: r.expected,
        got: { type: got.type, priority: got.priority, zone: got.zone, confidence: got.confidence, route: got.route },
        typeOk:     got.type     === r.expected.type,
        priorityOk: got.priority === r.expected.priority,
        zoneOk:     got.zone     === r.expected.zone,
      };
      results.push(result);
      if (!result.typeOk || !result.priorityOk) failures.push(result);

      const mark = (result.typeOk && result.priorityOk) ? '✓' : '✗';
      console.log(`${mark} ${r.id}  type: ${got.type}/${r.expected.type} (${result.typeOk?'OK':'FAIL'})  priority: ${got.priority}/${r.expected.priority} (${result.priorityOk?'OK':'FAIL'})`);
    } catch (err) {
      console.error(`  ERROR ${r.id}: ${err instanceof Error ? err.message : err}`);
    }
  }

  const typeCorrect     = results.filter(r => r.typeOk).length;
  const priorityCorrect = results.filter(r => r.priorityOk).length;
  const total           = results.length;

  console.log('\n─────────────────────────────────────────');
  console.log(`Type accuracy:     ${typeCorrect}/${total} = ${Math.round(100*typeCorrect/total)}%`);
  console.log(`Priority accuracy: ${priorityCorrect}/${total} = ${Math.round(100*priorityCorrect/total)}%`);
  console.log(`Zone accuracy:     ${results.filter(r=>r.zoneOk).length}/${total} = ${Math.round(100*results.filter(r=>r.zoneOk).length/total)}%`);
  console.log('─────────────────────────────────────────');

  if (failures.length > 0) {
    console.log('\n❌ Failed reports (first 5):');
    failures.slice(0, 5).forEach(f => {
      console.log(`\n  ${f.id}`);
      console.log(`    Type:     expected=${f.expected.type}, got=${f.got.type}`);
      console.log(`    Priority: expected=${f.expected.priority}, got=${f.got.priority}`);
    });
  }

  console.log('\nCopy these to README:\n');
  console.log(`- Type accuracy: ${Math.round(100*typeCorrect/total)}%`);
  console.log(`- Priority accuracy: ${Math.round(100*priorityCorrect/total)}%`);
}

main().catch(console.error);
