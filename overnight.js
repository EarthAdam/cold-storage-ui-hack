/* Replays a local snapshot of saved rows; never generates or publishes MQTT. */
(function () {
  'use strict';
  const host = document.getElementById('overnight-display');
  if (!host) return;
  let data = null, node = null, enabled = false, playing = false, cursor = 0, windowFrom = 0, windowTo = 1, frame = null, lastFrame = 0, lastPaint = 0;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clock = ts => new Intl.DateTimeFormat('en-US',{timeZone:'America/Los_Angeles',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false,timeZoneName:'short'}).format(new Date(ts));
  const shortTime = ts => new Intl.DateTimeFormat('en-US',{timeZone:'America/Los_Angeles',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(ts));
  const latest = (points, ts, maxAge=120000) => { let hit=null; for (const p of points || []) { if(p.ts>ts)break;hit=p; } return hit && ts-hit.ts<=maxAge ? hit : null; };
  const value = (n, suffix, digits=1) => n == null ? '—' : n.toFixed(digits)+suffix;
  const active = () => enabled && document.body.dataset.trade === 'desk';
  function stop() { playing=false;cancelAnimationFrame(frame);frame=null;const b=document.getElementById('ov-play');if(b)b.textContent='Play recording'; }
  function setMode(on) {
    enabled=on;document.body.dataset.deskView=on?'overnight':'live';
    document.getElementById('ov-open').textContent=on?'Return to live Desk':'Overnight recording';
    if(on){ const button=document.querySelector('[data-profile="desk"]');if(button)button.click(); }
    else stop();
    if(window.HoldRepaint)window.HoldRepaint();
  }
  window.HoldOvernight={active,headline:()=>node?'RECORDED · '+node.id.split('/').pop()+' · '+clock(cursor)+' · SIM at source':'Loading overnight recording',latest};
  const open=document.createElement('button');open.type='button';open.className='text-btn';open.id='ov-open';open.textContent='Overnight recording';
  document.querySelector('.menu').appendChild(open);open.addEventListener('click',()=>setMode(!active()));
  host.innerHTML='<div class="ov-heading"><div><p class="ov-eyebrow">RECORDED OVERNIGHT · SIM AT SOURCE</p><h2>What the nodes actually sent</h2></div><span class="ov-badge">Local archive · 1 Nov 2026</span></div><p id="ov-loading">Loading the saved overnight capture…</p>';
  function seriesChart(points, series, unit, gap, door) {
    const from=windowFrom,to=windowTo,span=Math.max(1,to-from),w=1000,h=210,L=64,R=20,T=16,B=36,pw=w-L-R,ph=h-T-B;
    const inside=(points||[]).filter(p=>p.ts>=from&&p.ts<=to);
    const values=inside.flatMap(p=>series.map(s=>p[s.key])).filter(v=>typeof v==='number'&&Number.isFinite(v));
    if(!values.length)return '<p class="ov-empty">No samples recorded for this trace in the selected interval.</p>';
    let low=Math.min(...values),high=Math.max(...values);const padding=Math.max((high-low)*.12,high===low?Math.max(1,Math.abs(high)*.05):.1);low-=padding;high+=padding;
    if(unit!=='°C')low=Math.max(0,low);
    const x=t=>L+(t-from)/span*pw,y=v=>T+(high-v)/(high-low)*ph;
    let svg='<svg viewBox="0 0 '+w+' '+h+'" role="img" aria-label="Recorded '+esc(unit)+' samples; gaps are not interpolated">';
    if(door)for(let i=0;i<door.length;i++){const p=door[i];if(p.door!==true)continue;const a=Math.max(from,p.ts),b=Math.min(to,door[i+1]?.ts??to,p.ts+120000);if(b>a)svg+='<rect class="ov-door-band" x="'+x(a)+'" y="'+T+'" width="'+(x(b)-x(a))+'" height="'+ph+'"/>';}
    for(let i=0;i<4;i++){const v=low+(high-low)*i/3,cy=y(v);svg+='<path class="ov-grid" d="M'+L+' '+cy+' H'+(w-R)+'"/><text class="ov-axis" x="'+(L-8)+'" y="'+(cy+4)+'" text-anchor="end">'+v.toFixed(high-low<10?1:0)+'</text>';}
    for(let i=0;i<5;i++){const t=from+span*i/4;svg+='<text class="ov-axis" x="'+x(t)+'" y="'+(h-9)+'" text-anchor="middle">'+esc(shortTime(t))+'</text>';}
    for(const s of series){let d='',last=null;for(const p of inside){const v=p[s.key];if(v==null){last=null;continue;}d+=(last&&p.ts-last.ts<=gap?'L':'M')+x(p.ts).toFixed(2)+' '+y(v).toFixed(2)+' ';last=p;}svg+='<path fill="none" stroke="'+s.color+'" stroke-width="2.5" d="'+d+'"/>';}
    svg+='<line class="ov-cursor" x1="'+L+'" x2="'+L+'" y1="'+T+'" y2="'+(h-B)+'"/></svg>';
    return svg;
  }
  function renderCharts() {
    if(!node)return;
    document.getElementById('ov-thermal').innerHTML=seriesChart(node.environment,[{key:'upper',color:'#8bd6b0'},{key:'lower',color:'#78b9e5'}],'°C',120000,node.environment);
    const trace=document.getElementById('ov-trace').value;
    const settings={power:[node.mains,[{key:'watts',color:'#ead08b'}],'W',120000],voltage:[node.mains,[{key:'vA',color:'#ead08b'},{key:'vB',color:'#8bd6b0'},{key:'vC',color:'#78b9e5'}],'V',120000],leakage:[node.leakage,[{key:'mA',color:'#ead08b'},{key:'mB',color:'#8bd6b0'},{key:'mC',color:'#78b9e5'}],'mA',360000],balance:[node.neutral,[{key:'imbalance',color:'#c1a6e7'}],'%',360000]};
    const [pts,lines,unit,gap]=settings[trace];
    document.getElementById('ov-electrical').innerHTML=seriesChart(pts,lines,unit,gap);
    document.getElementById('ov-electric-legend').textContent=trace==='power'?'Total recorded real power · W':trace==='voltage'?'A · gold     B · green     C · blue · V':trace==='leakage'?'A · gold     B · green     C · blue · mA':'Recorded phase-current imbalance · %';
    updateCursor();
  }
  function updateCursor() {
    if(!node)return;
    const t=latest(node.environment,cursor),m=latest(node.mains,cursor),l=latest(node.leakage,cursor,600000);
    document.getElementById('ov-time').textContent=clock(cursor);
    document.getElementById('ov-scrub').value=Math.round((cursor-windowFrom)/(windowTo-windowFrom)*1000);
    const cx=64+(cursor-windowFrom)/Math.max(1,windowTo-windowFrom)*916;
    host.querySelectorAll('.ov-cursor').forEach(el=>{el.setAttribute('x1',cx);el.setAttribute('x2',cx);});
    document.getElementById('ov-upper').textContent=value(t?.upper,' °C');document.getElementById('ov-lower').textContent=value(t?.lower,' °C');
    document.getElementById('ov-door').textContent=t?.door==null?'Unknown':t.door?'Open':'Closed';
    document.getElementById('ov-watts').textContent=value(m?.watts,' W',0);
    document.getElementById('ov-equipment').textContent='Compressor '+value(t?.compressor,' °C')+' · contactor '+value(t?.contactor,' °C')+' · upper RH '+value(t?.humidity,'%',0)+' · leakage A '+value(l?.mA,' mA',2);
    document.getElementById('ov-door-card').classList.toggle('open',t?.door===true);
    if(active()) {document.getElementById('strip').textContent=window.HoldOvernight.headline();}
  }
  function chooseWindow() {
    stop();const full=document.getElementById('ov-window').value==='all';
    windowFrom=full?node.from:node.highlight.from;windowTo=full?node.to:node.highlight.to;cursor=windowFrom;
    document.getElementById('ov-range').textContent=clock(windowFrom)+' — '+clock(windowTo)+' · recorder receipt times';
    const h=node.highlight;
    document.getElementById('ov-story').textContent=full?'Full saved capture for this node. Blank intervals remain gaps; playback never invents intervening readings.':h.min==null?'Captured environment samples for this node.':'Strongest recorded storage-temperature change: '+h.min.toFixed(1)+'–'+h.max.toFixed(1)+' °C upper probe, '+h.changes+' door-state changes across '+h.count+' environment packets.';
    document.getElementById('ov-speed').value=full?'300':'20';renderCharts();
  }
  function play() {
    if(playing){stop();return;}if(cursor>=windowTo)cursor=windowFrom;playing=true;lastFrame=performance.now();document.getElementById('ov-play').textContent='Pause';
    function tick(now){if(!playing)return;cursor=Math.min(windowTo,cursor+(now-lastFrame)*Number(document.getElementById('ov-speed').value));lastFrame=now;if(now-lastPaint>100 || cursor>=windowTo){updateCursor();lastPaint=now;}if(cursor>=windowTo){stop();return;}frame=requestAnimationFrame(tick);}frame=requestAnimationFrame(tick);
  }
  fetch('log/overnight-replay.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('No saved snapshot');return r.json();}).then(snapshot=>{
    data=snapshot;if(!data.nodes?.length)throw Error('No recorded node data');node=data.nodes[0];
    host.innerHTML='<div class="ov-heading"><div><p class="ov-eyebrow">RECORDED OVERNIGHT · SIM AT SOURCE</p><h2>What the nodes actually sent</h2></div><span class="ov-badge">Local archive · 1 Nov 2026</span></div>'+ 
      '<div class="ov-controls"><label>Recorded node<select id="ov-node">'+data.nodes.map((n,i)=>'<option value="'+i+'">'+esc(n.id.split('/').pop())+' · '+n.rows.toLocaleString()+' packets</option>').join('')+'</select></label><label>Interval<select id="ov-window"><option value="highlight">Most eventful 10 minutes</option><option value="all">Full overnight capture</option></select></label><button type="button" id="ov-play">Play recording</button><label>Speed<select id="ov-speed"><option value="20">20×</option><option value="60">60×</option><option value="300">300×</option></select></label><span id="ov-time" class="ov-time"></span></div>'+ 
      '<label class="ov-slider">Recording position<input type="range" id="ov-scrub" min="0" max="1000" value="0"></label><p id="ov-range" class="ov-caption"></p>'+ 
      '<div class="ov-facts"><div><span>Upper storage</span><strong id="ov-upper">—</strong></div><div><span>Lower storage</span><strong id="ov-lower">—</strong></div><div id="ov-door-card"><span>Cold-room door</span><strong id="ov-door">—</strong></div><div><span>Power draw</span><strong id="ov-watts">—</strong></div></div>'+ 
      '<p id="ov-story" class="ov-story"></p><div class="ov-chart"><div class="ov-chart-heading"><h3>Storage temperature + door</h3><span><i class="ov-key upper"></i>Upper <i class="ov-key lower"></i>Lower <i class="ov-key door"></i>Door open</span></div><div id="ov-thermal"></div></div>'+ 
      '<div class="ov-chart"><div class="ov-chart-heading"><label>Electrical trace <select id="ov-trace"><option value="power">Power draw</option><option value="voltage">Three-phase voltage</option><option value="leakage">Leakage by phase</option><option value="balance">Phase imbalance</option></select></label><span id="ov-electric-legend"></span></div><div id="ov-electrical"></div></div>'+ 
      '<p id="ov-equipment" class="ov-caption"></p><p class="ov-footnote">Actual saved MQTT rows, not regenerated simulator values. Source messages mark these readings mock. The cursor holds the latest recorded sample; missing intervals stay blank. No physical switching or DTM dispatch is claimed.</p>';
    document.getElementById('ov-node').addEventListener('change',e=>{node=data.nodes[Number(e.target.value)];chooseWindow();});
    document.getElementById('ov-window').addEventListener('change',chooseWindow);document.getElementById('ov-play').addEventListener('click',play);document.getElementById('ov-trace').addEventListener('change',renderCharts);
    document.getElementById('ov-scrub').addEventListener('input',e=>{stop();cursor=windowFrom+Number(e.target.value)/1000*(windowTo-windowFrom);updateCursor();});
    chooseWindow();if(new URLSearchParams(location.search).get('desk')==='overnight')setMode(true);
  }).catch(()=>{document.getElementById('ov-loading')?.replaceChildren(document.createTextNode('The overnight capture is not available on this local server.'));});
})();
