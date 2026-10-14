import { finite, isFresh, chartPoints, mergeSeconds } from './data.js';
const $=selector=>document.querySelector(selector);
const number=(value,digits=2)=>finite(value)?value.toLocaleString('en-US',{maximumFractionDigits:digits,minimumFractionDigits:digits}):'—';
const utc=(time,seconds=true)=>finite(time)?new Date(time).toISOString().slice(11,seconds?19:16):'—';
const timestamp=time=>finite(time)?new Date(time).toISOString().replace('T',' ').slice(0,19)+' UTC':'unavailable';
const ageText=ms=>ms<0?'clock mismatch':ms<1000?'under 1s ago':ms<60000?`${Math.floor(ms/1000)}s ago`:`${Math.floor(ms/60000)}m ago`;

export function initializeChart(){
  const canvas=$('#traffic-chart'),ctx=canvas.getContext('2d');
  if(!ctx){$('#chart-empty').textContent='Chart rendering unavailable. Measurements are available in the table below.';}
  const state={range:2592000,revision:0,points:new Map(),history:[],live:null,liveAt:0,serverAt:Date.now(),receivedAt:performance.now(),chartAt:0,chartGenerated:0,historyAt:0,historyGenerated:0,historyTo:0,historyStep:3600000,historyLatest:0,visible:false,proofVisible:true,busy:false,generation:0,selected:null,chartError:false,liveError:false};
  const serverNow=()=>state.serverAt+(performance.now()-state.receivedAt);
  let width=600,height=310,geometry=null;
  const historyUnit=()=>state.range===2592000?'MB/hour':'MB/minute';
  const displayValue=value=>value;
  const rows=()=>state.range>=86400?state.history:[...state.points.values()].sort((a,b)=>a.t-b.t);
  const metricAnimations = new Map(), animatedMetrics = new Set();
  const initialMetrics = new Map();
  document.querySelectorAll('[data-metric][data-initial-value]').forEach(element => {
    const value = Number(element.dataset.initialValue);
    if (finite(value)) {
      initialMetrics.set(element.dataset.metric, value);
      animatedMetrics.add(element.dataset.metric);
    }
  });
  function renderMetric(key, value, digits) {
    // Preserve server-rendered measurements until the first API response arrives.
    if (!state.live && initialMetrics.has(key)) return;
    const elements = document.querySelectorAll(`[data-metric="${key}"]`);
    const write = current => elements.forEach(element => { element.textContent = number(current, digits); });
    const running = metricAnimations.get(key);
    if (running) { running.target = value; return; }
    if (!finite(value) || animatedMetrics.has(key) || !state.proofVisible || document.documentElement.dataset.introActive || document.body.classList.contains('motion-paused') || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      write(value); return;
    }
    animatedMetrics.add(key);
    const animation = { target: value, start: performance.now() };
    metricAnimations.set(key, animation);
    function frame(now) {
      const fraction = document.body.classList.contains('motion-paused') || matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : Math.min(1, (now-animation.start)/1100);
      write(animation.target*(1-(1-fraction)**3));
      if (fraction < 1) requestAnimationFrame(frame);
      else { write(animation.target); metricAnimations.delete(key); }
    }
    requestAnimationFrame(frame);
  }
  function renderLive(){
    const d=state.live,elapsed=performance.now()-state.liveAt;
    const fresh=!state.liveError&&isFresh(d,elapsed);
    const status=$('#live-status');
    status.classList.toggle('live',fresh);status.classList.toggle('delayed',!!d&&!fresh);
    status.querySelector('span').textContent=fresh?'Live':state.liveError?'Unavailable':d?'Delayed':'Connecting';
    $('#current-rate').textContent=fresh?number(d.current_mb_per_min):'—';
    $('#reporting').textContent=fresh&&finite(d.active_nodes)?number(d.active_nodes,0):'—';
    for(const [key,value,digits] of [['30d',d&&finite(d.traffic_30d_mb)?d.traffic_30d_mb/1e6:null,2],['24h',d&&finite(d.traffic_24h_mb)?d.traffic_24h_mb/1000:null,2],['ips',d?.total_unique_ips,0],['countries',d?.total_countries,0]]){
      renderMetric(key,value,digits);
    }
    $('#ip-clock').textContent=d&&finite(d.total_unique_ips_observed_ms)?`IP records checked: ${utc(d.total_unique_ips_observed_ms)} UTC`:'IP record timestamp unavailable';
    $('#total-unit').textContent=d&&finite(d.window_until_ms)?`GB · through ${timestamp(d.window_until_ms)}`:'GB · recorded traffic';
    $('#live-clock').textContent=d&&finite(d.observed_ms)?`Source: ${timestamp(d.observed_ms)} · ${ageText(d.generated_ms-d.observed_ms+elapsed)}`:'Source time unavailable';
    const historyAge=d&&finite(d.totals_observed_ms)?d.generated_ms-d.totals_observed_ms+elapsed:Infinity;
    $('#history-clock').textContent=d&&finite(d.totals_observed_ms)?`History published: ${utc(d.totals_observed_ms)} UTC · ${ageText(historyAge)}${historyAge>120000?' · delayed':''}`:'Historical publication unavailable';
    $('#history-clock').classList.toggle('delayed',historyAge>120000);
    $('#total-30').textContent=d&&finite(d.traffic_30d_mb)?`30-day recorded total: ${number(d.traffic_30d_mb/1000)} GB. History through ${timestamp(d.window_until_ms)}. `:'30-day recorded total: unavailable.';
  }
  function renderTable(){
    const until=state.range>=86400&&finite(state.historyTo)&&state.historyTo>0?state.historyTo:serverNow();
    const list=rows().filter(p=>p.t>=until-state.range*1000&&p.t<=until).slice(-10).reverse(),body=$('#readings-body');
    body.replaceChildren();
    for(const p of list){const tr=document.createElement('tr');for(const value of [state.range>=86400?timestamp(p.t):utc(p.t),number(displayValue(p.rx),4),number(displayValue(p.tx),4),state.range>=86400?historyUnit():'MB/second']){const td=document.createElement('td');td.textContent=value;tr.append(td);}body.append(tr);}
    if(!list.length){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=4;td.textContent='No observations available for this range.';tr.append(td);body.append(tr);}
  }
  function draw(){
    if(!ctx)return;
    const rawRows=rows(),end=state.range>=86400&&finite(state.historyTo)&&state.historyTo>0?state.historyTo:serverNow(),start=end-state.range*1000;
    const all=rawRows;
    const list=all.filter(p=>p.t>=start&&p.t<=end),step=state.range>=86400?state.historyStep:1000;
    const pad={left:48,right:9,top:20,bottom:29},w=width-pad.left-pad.right,h=height-pad.top-pad.bottom;
    const peak=list.reduce((m,p)=>Math.max(m,p.rx,p.tx),0);
    const raw=(peak||1)*1.1,magnitude=10**Math.floor(Math.log10(raw));
    const maximum=([1,1.2,1.5,2,2.5,3,4,5,6,8,10].find(n=>n>=raw/magnitude)||10)*magnitude;
    const x=t=>pad.left+(t-start)/(end-start)*w,y=v=>pad.top+h-v/maximum*h;
    ctx.clearRect(0,0,width,height);ctx.font='11px Manrope, Arial, sans-serif';ctx.lineWidth=1;
    for(let i=0;i<=4;i++){
      const yy=pad.top+i*h/4,val=maximum*(1-i/4);
      ctx.strokeStyle='#3e5648';ctx.setLineDash([2,4]);ctx.beginPath();ctx.moveTo(pad.left,yy+.5);ctx.lineTo(width-pad.right,yy+.5);ctx.stroke();ctx.setLineDash([]);
      ctx.fillStyle='#c9d9c5';ctx.textAlign='right';ctx.fillText(val===0?'0':val<.01?val.toPrecision(1):number(displayValue(val),val<1?3:val<10?1:0),pad.left-9,yy+3);
    }
    const ticks=width<600?3:5;
    ctx.textAlign='center';
    for(let i=0;i<=ticks;i++){
      const t=start+(end-start)*i/ticks,xx=x(t);
      ctx.textAlign=i===0?'left':i===ticks?'right':'center';ctx.fillText(state.range===2592000?new Date(t).toLocaleDateString('en-US',{month:'short',day:'numeric',timeZone:'UTC'}):utc(t,false),xx,height-8);
    }
    function series(key,color,fill){
      let segment=[];
      const flush=()=>{
        if(!segment.length)return;
        if(fill&&segment.length>1){const gradient=ctx.createLinearGradient(0,pad.top,0,pad.top+h);gradient.addColorStop(0,'rgba(213,255,97,.07)');gradient.addColorStop(1,'rgba(213,255,97,0)');ctx.fillStyle=gradient;ctx.beginPath();ctx.moveTo(x(segment[0].t),pad.top+h);for(const p of segment)ctx.lineTo(x(p.t),y(p[key]));ctx.lineTo(x(segment.at(-1).t),pad.top+h);ctx.closePath();ctx.fill();}
        ctx.strokeStyle=color;ctx.lineWidth=1.2;ctx.beginPath();segment.forEach((p,i)=>{if(i===0)ctx.moveTo(x(p.t),y(p[key]));else ctx.lineTo(x(p.t),y(p[key]));});ctx.stroke();
        if(segment.length===1){ctx.fillStyle=color;ctx.fillRect(x(segment[0].t)-1,y(segment[0][key])-1,2,2);}segment=[];
      };
      for(const p of list){if(segment.length&&p.t-segment.at(-1).t>step*1.6)flush();segment.push(p);}flush();
    }
    series('rx','#d5ff61',true);series('tx','#a4cbbb',false);
    geometry={start,end,x,y,pad,w,h,list};
    if(state.selected!==null&&list.length){
      const p=list.reduce((best,p)=>Math.abs(p.t-state.selected)<Math.abs(best.t-state.selected)?p:best,list[0]);
      ctx.strokeStyle='#bfd5b1';ctx.setLineDash([3,3]);ctx.beginPath();ctx.moveTo(x(p.t),pad.top);ctx.lineTo(x(p.t),pad.top+h);ctx.stroke();ctx.setLineDash([]);
      for(const [key,color] of [['rx','#d5ff61'],['tx','#a4cbbb']]){ctx.fillStyle=color;ctx.beginPath();ctx.arc(x(p.t),y(p[key]),3.5,0,Math.PI*2);ctx.fill();}
    }
    const empty=$('#chart-empty');empty.hidden=!!list.length;
    empty.textContent=state.chartError?'Measurements unavailable. Retrying automatically…':state.chartAt?'No observations returned for this time range.':'Connecting to the measurement source…';
    const lastPoint=list.at(-1),latest=lastPoint?.t,observed=state.range>=86400?state.historyLatest:latest;
    const delay=lastPoint&&(state.chartError||serverNow()-observed>(state.range>=86400?180000:15000));
    if(state.selected===null)$('#chart-selection').textContent=lastPoint?`${number(displayValue(lastPoint.rx+lastPoint.tx),3)} ${state.range>=86400?historyUnit():'MB/s'}${delay?' · delayed':''}`:'';
    $('#chart-freshness').textContent=observed?`${state.chartError?'Last available reading':state.range>=86400?'Recorded through':'Latest reading'}: ${state.range>=86400?timestamp(observed):utc(observed)+' UTC'}${state.range<86400&&serverNow()-observed>15000?' · delayed':''}`:state.chartError?'Source unavailable':'Source time —';
  }
  function showReading(at){
    const g=geometry;if(!g?.list.length)return;
    const p=g.list.reduce((best,p)=>Math.abs(p.t-at)<Math.abs(best.t-at)?p:best,g.list[0]);
    state.selected=p.t;const unit=state.range>=86400?historyUnit():'MB/second';
    const text=`${state.range>=86400?timestamp(p.t):utc(p.t)+' UTC'} · In ${number(displayValue(p.rx),3)} · Out ${number(displayValue(p.tx),3)} ${unit}`;
    $('#chart-reading').textContent=text;$('#chart-selection').textContent=text;
    const tip=$('#chart-tooltip');tip.hidden=false;tip.textContent=text;
    // Anchored tooltips keep the same position for pointer and keyboard users.
    draw();
  }
  canvas.addEventListener('pointermove',event=>{if(!geometry)return;const rect=canvas.getBoundingClientRect();const fraction=Math.max(0,Math.min(1,(event.clientX-rect.left-geometry.pad.left)/geometry.w));showReading(geometry.start+fraction*(geometry.end-geometry.start));});
  canvas.addEventListener('pointerleave',()=>{state.selected=null;$('#chart-tooltip').hidden=true;draw();});
  canvas.addEventListener('blur',()=>{state.selected=null;$('#chart-tooltip').hidden=true;draw();});
  canvas.addEventListener('keydown',event=>{
    if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();
    const list=geometry?.list;if(!list?.length)return;
    let index=list.findIndex(p=>p.t===state.selected);if(index<0)index=list.length-1;
    index=event.key==='Home'?0:event.key==='End'?list.length-1:Math.max(0,Math.min(list.length-1,index+(event.key==='ArrowLeft'?-1:1)));
    showReading(list[index].t);
  });
  function resize(){const r=canvas.getBoundingClientRect();width=r.width;height=r.height;const dpr=Math.min(devicePixelRatio,2);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx?.setTransform(dpr,0,0,dpr,0,0);draw();}
  new ResizeObserver(resize).observe(canvas);
  async function request(path){const response=await fetch(path,{cache:'no-store',signal:AbortSignal.timeout(8000)});if(!response.ok)throw new Error(`HTTP ${response.status}`);return response.json();}
  async function tick(){
    if((!state.visible&&!state.proofVisible)||document.hidden||state.busy)return;
    state.busy=true;const generation=state.generation,range=state.range;
    try{
      const tasks=[request('/api/live').then(d=>{
        if(generation!==state.generation)return;
        if(d.schema_version!==2||!finite(d.generated_ms))throw new Error('Unexpected schema');
        state.live=d;state.liveAt=performance.now();state.serverAt=d.generated_ms;state.receivedAt=performance.now();state.liveError=false;
        renderLive();
      }).catch(()=>{state.liveError=true;})];
      if(state.visible&&range>=86400){
        if(performance.now()-state.historyAt>60000||!state.historyAt)tasks.push(request('/api/minutes?window='+range).then(d=>{
          if(generation!==state.generation)return;
          if(!Array.isArray(d.points)||!finite(d.generated_ms))throw new Error('Unexpected schema');
          state.history=chartPoints(d.points,true);state.historyStep=d.step_ms||60000;state.historyLatest=d.latest_observed_ms||d.points.at(-1)?.[0]||0;state.historyAt=performance.now();state.historyGenerated=d.generated_ms;state.historyTo=d.to_ms;state.chartAt=performance.now();state.chartError=false;
        }).catch(()=>{state.chartError=true;}));
      }else if(state.visible){
        const end=Math.floor(serverNow()),start=end-range*1000,revision=state.revision;
        const q=new URLSearchParams({detail_from:String(start),detail_to:String(end),since_rev:String(revision)});
        tasks.push(request('/api/seconds?'+q).then(d=>{
          if(generation!==state.generation)return;
          if(!Array.isArray(d.points)||!finite(d.revision)||!finite(d.generated_ms))throw new Error('Unexpected schema');
          state.points=mergeSeconds(state.points,d,revision,start);state.revision=d.revision;state.chartAt=performance.now();state.chartGenerated=d.generated_ms;state.chartError=false;
        }).catch(()=>{state.chartError=true;}));
      }
      await Promise.all(tasks);
      if(generation===state.generation){renderLive();draw();renderTable();}
    }finally{state.busy=false;}
  }
  function updateView(){
    $('#chart-unit').textContent=state.range>=86400?historyUnit():'MB/s';
    $('#chart-scope').textContent=state.range===2592000?'Recorded traffic · hourly totals (MB)':state.range>=86400?'Recorded traffic · minute totals (MB)':'Current app feeds · MB/second';
    $('#chart-tooltip').hidden=true;state.selected=null;
  }
  document.querySelectorAll('[data-range]').forEach(button=>button.addEventListener('click',()=>{
    const next=Number(button.dataset.range);if(next===state.range)return;
    state.range=next;state.history=[];state.historyAt=0;state.historyTo=0;state.historyStep=next===2592000?3600000:60000;updateView();state.generation++;state.revision=0;state.points.clear();state.selected=null;state.chartAt=0;state.chartError=false;
    document.querySelectorAll('[data-range]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
    updateView();
    $('#chart-reading').textContent='';$('#chart-tooltip').hidden=true;
    draw();renderTable();tick();
  }));
  new IntersectionObserver(([entry])=>{state.visible=entry.isIntersecting;if(state.visible)tick();},{rootMargin:'100px'}).observe($('#activity'));
  new IntersectionObserver(([entry])=>{state.proofVisible=entry.isIntersecting;if(state.proofVisible)tick();},{threshold:.15}).observe($('#proof-strip'));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)tick();});
  document.addEventListener('wdi:intro-complete',renderLive);
  setInterval(()=>{if((state.visible||state.proofVisible)&&!document.hidden){renderLive();if(state.visible)draw();tick();}},1000);
  updateView();resize();tick();
}
