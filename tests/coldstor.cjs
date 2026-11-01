const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const ctx = vm.createContext({ window: {}, console, Date, Map, Set, Intl, setInterval() {} });
vm.runInContext(fs.readFileSync(path.join(root, 'hold.js'), 'utf8').replace(/boot\(\);\s*$/, ''), ctx);
vm.runInContext(`
state.profileId = 'desk'; state.rooms = buildRooms('desk');
const sample = { schema:'coldems.coldstor.v1', sensor_count:4, mock:true, sensors:{
  compressor_temp:{modbus_address:50,temperature_c:7.5,humidity_pct:55,valid:true,mock:true,age_ms:12000},
  phase_contactor_temp:{modbus_address:51,temperature_c:31,humidity_pct:45,valid:true,mock:true,age_ms:12000},
  upper_storage_temp:{modbus_address:52,temperature_c:3.8,humidity_pct:72,valid:true,mock:true,age_ms:12000},
  lower_storage_temp:{modbus_address:53,temperature_c:2.6,humidity_pct:78,valid:true,mock:true,age_ms:12000}
}};
const readings = readStor(sample, 1000, 1000);
if (readings.upper !== 3.8 || readings.lower !== 2.6 || readings.comp !== 7.5 || readings.cont !== 31) throw Error('probe identities mixed');
if (readings.probes.length !== 4 || !readings.probes.every(p=>p.mock)) throw Error('SIM source lost');
const stale = readStor(sample, 1000, 51000);
if (stale.upper !== null || stale.probes[0].quality !== 'stale') throw Error('stale probe accepted');
const invalid = JSON.parse(JSON.stringify(sample)); invalid.sensors.upper_storage_temp.valid = false;
if (readStor(invalid).upper !== null) throw Error('invalid probe accepted');
const zero = JSON.parse(JSON.stringify(sample)); zero.sensors.upper_storage_temp.temperature_c = 0;
if (readStor(zero).upper !== 0) throw Error('real zero discarded');
const missing = readStor({sensors:{}});
if (missing.upper !== null || missing.probes[0].quality !== 'missing') throw Error('missing probe invented');
ingestCold(['nesl_coldems','test','COLDAMI','coldstor'], JSON.stringify(sample));
if (!state.coldems.coldstor.mock || state.deskStor.length !== 1) throw Error('coldstor not wired to selected history');
if (state.rooms[0].envLive) throw Error('mock coldstore became a measured room probe');
const table = deskProbeDetails(state.coldems);
if (!table.includes('Upper storage') || !table.includes('Phase contactor') || !table.includes('SIM')) throw Error('probe details missing');
const before = state.deskStor.length;
ingestCold(['nesl_coldems','other','COLDAMI','coldstor'], JSON.stringify(sample));
if (state.deskStor.length !== before) throw Error('other node polluted history');
console.log('Coldstor identities, mock labels, validity, freshness and node isolation passed');
`, ctx);
