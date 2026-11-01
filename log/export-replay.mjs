/* Local, ignored replay snapshot. Reads the archive without changing it. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
const here = path.dirname(fileURLToPath(import.meta.url));
const number = value => typeof value === 'number' && Number.isFinite(value) ? value : null;
const probe = (msg, name, key) => {
  const p = msg.sensors?.[name];
  return p && p.valid !== false && (p.age_ms == null || p.age_ms <= 60000) ? number(p[key]) : null;
};
export function selectHighlight(points) {
  let best = null;
  for (let i = 0; i < points.length; i++) {
    const from = points[i].ts, to = from + 600000;
    const window = points.slice(i).filter(p => p.ts <= to);
    const values = window.map(p => p.upper).filter(v => v != null);
    if (values.length < 12 || window.at(-1).ts - from < 450000) continue;
    let changes = 0;
    for (let j = 1; j < window.length; j++) {
      if (typeof window[j].door === 'boolean' && typeof window[j-1].door === 'boolean' && window[j].door !== window[j-1].door) changes++;
    }
    const min = Math.min(...values), max = Math.max(...values);
    const score = max - min + changes * .2;
    if (!best || score > best.score) best = { from, to: window.at(-1).ts, min, max, changes, count: window.length, score };
  }
  return best || (points.length ? { from: points[0].ts, to: points.at(-1).ts, count: points.length, changes: 0 } : null);
}
export function buildReplay(db, until) {
  const rows = db.prepare(`SELECT id,ts,device,kind,body FROM msg WHERE ts <= ? AND device LIKE 'nesl_coldems/%' AND kind IN ('environment','coldstor','mains','leakage','neutral') ORDER BY ts,id`).all(until);
  const nodes = new Map();
  for (const row of rows) {
    let m;
    try { m = JSON.parse(row.body); } catch { continue; }
    // The overnight presentation focuses on the explicitly marked mock runs.
    if (!m || m.mock !== true) continue;
    if (!nodes.has(row.device)) nodes.set(row.device, { id: row.device, rows: 0, environment: [], coldstor: [], mains: [], leakage: [], neutral: [] });
    const node = nodes.get(row.device);
    const sample = { ts: row.ts, row: row.id, mock: true };
    if (row.kind === 'environment' || row.kind === 'coldstor') {
      Object.assign(sample, { upper: probe(m,'upper_storage_temp','temperature_c'), lower: probe(m,'lower_storage_temp','temperature_c'), compressor: probe(m,'compressor_temp','temperature_c'), contactor: probe(m,'phase_contactor_temp','temperature_c'), humidity: probe(m,'upper_storage_temp','humidity_pct'), door: typeof m.doors?.cold_door?.open === 'boolean' ? m.doors.cold_door.open : null, service: typeof m.service_mode === 'string' ? m.service_mode : null });
    } else if (row.kind === 'mains') {
      // Skip late deliveries of old retained samples; receipt time is the chart axis.
      const stamp = number(m.ts);
      if (stamp && stamp > 1e9 && row.ts - (stamp > 1e12 ? stamp : stamp * 1000) > 300000) continue;
      for (const ph of ['A','B','C']) sample['v'+ph] = m.valid === false ? null : number(m.phases?.[ph]?.voltage_ln);
      const watts = ['A','B','C'].map(ph=>number(m.phases?.[ph]?.real_power_w));
      sample.watts = m.valid === false ? null : number(m.totals?.real_power_w) ?? (watts.every(v=>v!=null) ? watts.reduce((a,b)=>a+b,0) : null);
    } else if (row.kind === 'leakage') {
      for (const ph of ['A','B','C']) sample['m'+ph] = m.valid === false ? null : number(m.sensors?.[ph]?.leakage_ma);
    } else if (row.kind === 'neutral') {
      sample.imbalance = m.valid === false ? null : number(m.imbalance_percent);
      sample.neutral = m.valid === false ? null : number(m.neutral_current_a);
    }
    node[row.kind].push(sample); node.rows++;
  }
  const output = [...nodes.values()].filter(n=>n.environment.length >= 12);
  for (const node of output) {
    node.highlight = selectHighlight(node.environment);
    const all = ['environment','coldstor','mains','leakage','neutral'].flatMap(k=>node[k]);
    node.from = Math.min(...all.map(p=>p.ts)); node.to = Math.max(...all.map(p=>p.ts));
  }
  return { version: 1, generated: Date.now(), cutoff: until, timeZone: 'America/Los_Angeles', axis: 'recorder receipt time', source: 'Recorded MQTT; mock=true in source payloads', nodes: output.sort((a,b)=>b.rows-a.rows) };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const db = new DatabaseSync(path.join(here,'hold.sqlite'), { readOnly: true });
  const cutoff = Date.parse(process.argv[2] || '2026-11-01T08:30:00-08:00');
  if (!Number.isFinite(cutoff)) throw new Error('Invalid snapshot cutoff');
  const replay = buildReplay(db, cutoff); db.close();
  fs.writeFileSync(path.join(here,'overnight-replay.json'), JSON.stringify(replay));
  console.log(JSON.stringify({ nodes: replay.nodes.map(n=>({id:n.id,rows:n.rows,highlight:n.highlight})), cutoff: new Date(cutoff).toISOString() },null,2));
}
