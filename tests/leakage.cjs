const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const ctx = vm.createContext({window:{},console,Date,Map,Set,Intl,setInterval(){}});
vm.runInContext(fs.readFileSync(path.join(__dirname,'../hold.js'),'utf8').replace(/boot\(\);\s*$/,''),ctx);
vm.runInContext(`
state.profileId = 'desk'; state.rooms = buildRooms('desk');
const topic = ['nesl_coldems','test','COLDAMI','leakage'];
ingestCold(topic, JSON.stringify({valid:true,sensors:{A:{leakage_ma:3.2,alarm:false},B:null,C:null}}));
const node=state.coldems;
if (node.leak[0].ma !== 3.2 || node.leak[1].ma !== null || node.leak[2].alarm !== null) throw Error('unavailable phases fabricated');
if (isolationText(node) !== 'not reported') throw Error('unreported isolation invented');
ingestCold(topic, JSON.stringify({valid:true,isolation_feedback:{state:'open'},sensors:{A:{leakage_ma:0,alarm:false},B:null,C:null}}));
if (node.leak[0].ma !== 0 || !isolationText(node).includes('open')) throw Error('zero or feedback lost');
ingestCold(topic, JSON.stringify({mock:true,valid:true,sensors:{A:{leakage_ma:31,alarm:true},B:null,C:null}}));
if (!leakageStatus(node).includes('SIM') || !node.leakageAlarm) throw Error('mock source or alarm lost');
console.log('Null leakage channels and reported isolation feedback checks passed');
`,ctx);
