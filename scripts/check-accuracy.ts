import { fallbackTriage } from '../src/services/triage/fallback.js';
import { parseZonePolygon } from '../src/services/triage/zone.js';
import zonesData   from '../data/zones.json' assert { type: 'json' };
import labelled    from '../data/labelled-reports.json' assert { type: 'json' };

interface ZoneEntry { id: string; polygon: [number,number][] }
const zones = (zonesData as any).zones.map((z: any) => ({
  id: z.id,
  polygon: parseZonePolygon(JSON.stringify(z.polygon)),
}));

const reports = (labelled as any).reports;
let typeOk = 0, prioOk = 0;
const fails: any[] = [];

reports.forEach((r: any) => {
  const got = fallbackTriage({ text: r.text, lat: r.lat, lng: r.lng, zones });
  const tOk = got.type === r.expected.type;
  const pOk = got.priority === r.expected.priority;
  if (tOk) typeOk++;
  if (pOk) prioOk++;
  if (!tOk || !pOk) {
    fails.push({ id: r.id, expType: r.expected.type, gotType: got.type, expPri: r.expected.priority, gotPri: got.priority, text: r.text.slice(0,60) });
  }
});

console.log(`Type:     ${typeOk}/${reports.length} = ${Math.round(100*typeOk/reports.length)}%`);
console.log(`Priority: ${prioOk}/${reports.length} = ${Math.round(100*prioOk/reports.length)}%`);
console.log(`\nFirst 5 failures:`);
fails.slice(0,5).forEach(f => {
  console.log(`  ${f.id}: type ${f.expType}→${f.gotType}, pri ${f.expPri}→${f.gotPri}  "${f.text}"`);
});
