const vm = require('node:vm');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const path = require("node:path").resolve(__dirname, "..");
const ctx = vm.createContext({window:{},console, Date, Map, Set, Intl, setInterval(){}});
vm.runInContext(fs.readFileSync(path+'/telemetry.js','utf8'),ctx);
vm.runInContext(fs.readFileSync(path+'/hold.js','utf8').replace(/boot\(\);\s*$/,''),ctx);
vm.runInContext(`
state.profileId = 'packhouse'; state.rooms = buildRooms('packhouse');
function send(id,leaf,msg) { ingestCold(['nesl_coldems', id, 'COLDAMI', leaf],JSON.stringify(msg)); }
send('one','mains',{valid:true,phases:{A:{voltage_ln:230},B:{voltage_ln:12},C:{voltage_ln:229}}});
if (!state.coldems.mainsValid) throw Error('phase drop missed');
send('one','leakage',{sensors:{A:{alarm:true,leakage_ma:35}}});
send('one','alerts',{severity:'normal',leakage_alarm_active:false});
if (!state.coldems.leakageAlarm) throw Error('normal alert cleared measured leakage');
send('two','mains',{phases:{A:{voltage_ln:200}}});
if (state.coldems.deviceId !== 'one' || state.coldems.volts[0] !== 230) throw Error('devices mixed');
send('one','leakage',{sensors:{A:{alarm:false}}});
if (state.coldems.leakageAlarm) throw Error('alarm did not clear');
send('one','mains',{valid:false,phases:{A:{voltage_ln:230}}});
if (state.coldems.mainsValid) throw Error('invalid accepted');
send('one','mains',{valid:true,phases:{A:{voltage_ln:230}}});
state.coldems.mainsSeen = Date.now()-61000;
if (liveFeed().mainsValid) throw Error('stale mains shown valid');
if (finiteNum(null)!==null || finiteNum('')!==null || finiteNum(0)!==0) throw Error('null became zero');
const t=window.HoldTelemetry;
t.capture('probe','{"probes":[{"temperature_C":4},{"temperature_C":7}],"mock":true}');
if (t.fields(t.topics.get('probe').data,'',[]).length!==3) throw Error('probe fields dropped');
if (!t.status(t.topics.get('probe'), Date.now()).includes('SIM')) throw Error('sim not labelled');
t.capture('old',JSON.stringify({ts:Date.now()-70000,ttl_s:60}),{retain:true});
if (!t.status(t.topics.get('old'),Date.now()).includes('STALE')) throw Error('retained stale missed');
send('one','status',null);
console.log('MQTT regression checks passed');
`,ctx);

// Run the real day clock through the complete transfer without waiting 30 seconds.
ctx.requestAnimationFrame = function () {};
vm.runInContext(fs.readFileSync(path+'/day.js','utf8'),ctx);
ctx.HoldDay = ctx.window.HoldDay;
vm.runInContext(`
const realNow = Date.now;
let replayNow = realNow();
Date.now = function () { return replayNow; };
try {
  state.profileId = 'packhouse'; state.coldems = null;
  state.rooms = buildRooms('packhouse');
  const cooler = state.rooms.find(function (r) { return r.id === 'out'; });
  HoldDay.playTransfer();
  let previous = HoldDay.hour();
  const visited = new Set();
  for (let second=0; second<=30; second++) {
    const h = HoldDay.hour();
    const supply = packSupply(h);
    visited.add(supply.step);
    state.rooms.forEach(function (r) { applyDay(r, previous, h, Math.max(0,h-previous)*60); });
    const leaf = state.rooms.find(function (r) { return r.id === "leaf"; });
    if (judge(leaf).level !== "safe") throw Error("unrelated leafy-room fault leaked into transfer replay");
    if (supply.step === 'break' && (cooler.watts !== 0 || cooler.feed !== 'open')) throw Error('break must isolate the load');
    if (supply.step === 'fault' && cooler.watts !== 0) throw Error('lost phase must stop cooler');
    previous = h;
    if (second<30) replayNow += 1000;
  }
  if (['hold','fault','break','make','run'].some(function (s) { return !visited.has(s); })) throw Error('replay skipped a transfer stage');
  if (cooler.feed !== 'A' || cooler.volts !== 230 || cooler.watts <= 0 || cooler.temp > cooler.band.max) throw Error('cooler never recovered');
  if (!HoldDay.replayState().done) throw Error('replay has no ending');
  const finalHour = HoldDay.hour(); replayNow += 60000;
  if (HoldDay.hour() !== finalHour || packSupply(HoldDay.hour()).step !== 'run') throw Error('ending rolled into a new fault');
  if (packSupply(finalHour).volts[1] >= 40) throw Error('transfer must not pretend B was repaired');
  console.log('Packhouse full transfer and held recovery checks passed');
} finally { Date.now = realNow; }
`,ctx);

// Check complete route segments, including closure and turning clearance.
const dollSource = fs.readFileSync(path+'/doll.js','utf8');
const routesMatch = dollSource.match(/const FARM_TRACTOR_ROUTES = (\[[\s\S]*?\n\]);/);
assert(routesMatch, 'tractor routes must be inspectable');
const routes = vm.runInNewContext(routesMatch[1]);
const obstacles = [
  { name: 'packinghouse', minX: -1.87, maxX: 8.27, minZ: 4.13, maxZ: 9.6 },
  { name: 'grinder and drum', minX: -10.6, maxX: -6.4, minZ: 4.65, maxZ: 8.6 },
  { name: 'battery bank', minX: 9.38, maxX: 13.8, minZ: 4.84, maxZ: 6.36 }
];
const clearance = 1.5;
for (const route of routes) {
  for (let i=0; i<route.length; i++) {
    const a = route[i], b = route[(i+1)%route.length];
    assert(a[0] === b[0] || a[1] === b[1], 'access lanes must be axis-aligned');
    for (const obstacle of obstacles) {
      const crosses = Math.max(a[0], b[0]) >= obstacle.minX-clearance && Math.min(a[0],b[0]) <= obstacle.maxX+clearance &&
        Math.max(a[1],b[1]) >= obstacle.minZ-clearance && Math.min(a[1],b[1]) <= obstacle.maxZ+clearance;
      assert(!crosses, 'tractor route intersects '+obstacle.name+' including turning clearance');
    }
  }
}
console.log('Tractor routes clear buildings and equipment');
