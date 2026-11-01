import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { buildReplay, selectHighlight } from '../log/export-replay.mjs';
const db=new DatabaseSync(':memory:');
db.exec('CREATE TABLE msg(id INTEGER PRIMARY KEY,ts INTEGER,device TEXT,kind TEXT,body TEXT)');
const insert=db.prepare('INSERT INTO msg(ts,device,kind,body) VALUES(?,?,?,?)');
for(const [device,seed] of [['nesl_coldems/one',1],['nesl_coldems/two',2]]) {
 for(let i=0;i<30;i++)insert.run(1793529600000+i*30000,device,'environment',JSON.stringify({mock:true,doors:{cold_door:{open:i%6<3}},sensors:{upper_storage_temp:{temperature_c:seed+i%6,valid:true},lower_storage_temp:{temperature_c:seed,valid:true},compressor_temp:{temperature_c:7.5,valid:true},phase_contactor_temp:{temperature_c:31,valid:true}}}));
 insert.run(1793529600000,device,'leakage',JSON.stringify({mock:true,sensors:{A:{leakage_ma:3},B:null,C:null}}));
}
insert.run(1793529600000,'nesl_dtmems/lost','state','lost');
insert.run(1793529600000,'nesl_coldems/one','environment',JSON.stringify({mock:false,sensors:{upper_storage_temp:{temperature_c:999}}}));
const snapshot=buildReplay(db,1793530600000);
assert.equal(snapshot.nodes.length,2);
for(const node of snapshot.nodes){assert.equal(node.environment.length,30);assert.equal(node.leakage[0].mB,null);assert(node.highlight.changes>0);assert(node.highlight.max<999);assert.equal(node.highlight.to-node.highlight.from,600000);}
assert.equal(selectHighlight([]),null);
assert.equal(selectHighlight([{ts:1,upper:3}]).from,1);
console.log('Recorded replay preserves node IDs, source values, null channels and highlight selection');
db.close();
