"use strict";
/* ---------------------------------------------------------------- storage */
const DB_NAME="reps-tracker", DB_VER=1;
let db=null;
function open(){return new Promise((res,rej)=>{
  const r=indexedDB.open(DB_NAME,DB_VER);
  r.onupgradeneeded=e=>{const d=e.target.result;
    if(!d.objectStoreNames.contains("sessions"))d.createObjectStore("sessions",{keyPath:"date"});
    if(!d.objectStoreNames.contains("meta"))d.createObjectStore("meta",{keyPath:"k"});
    if(!d.objectStoreNames.contains("weights"))d.createObjectStore("weights",{keyPath:"date"});};
  r.onsuccess=e=>{db=e.target.result;res();};r.onerror=()=>rej(r.error);});}
function tx(store,mode){return db.transaction(store,mode).objectStore(store);}
function put(store,val){return new Promise((res,rej)=>{const q=tx(store,"readwrite").put(val);
  q.onsuccess=()=>res();q.onerror=()=>rej(q.error);});}
function all(store){return new Promise((res,rej)=>{const q=tx(store,"readonly").getAll();
  q.onsuccess=()=>res(q.result||[]);q.onerror=()=>rej(q.error);});}
function get(store,key){return new Promise((res,rej)=>{const q=tx(store,"readonly").get(key);
  q.onsuccess=()=>res(q.result||null);q.onerror=()=>rej(q.error);});}

/* ------------------------------------------------------------------ state */
let SESSIONS={}, META={k:"app",poolSeen:[],lastBreak:-1,sound:true,vol:1,firstDay:null,lastStreak:0}, WEIGHTS=[];
const $=id=>document.getElementById(id);
const iso=d=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
const todayISO=()=>iso(new Date());
const fmt=s=>{s=Math.max(0,Math.round(s));return Math.floor(s/60)+":"+String(s%60).padStart(2,"0");};
function toast(msg){const t=$("toast");t.textContent=msg;t.classList.add("on");
  clearTimeout(t._h);t._h=setTimeout(()=>t.classList.remove("on"),2600);}

const APP_VERSION="v10";
const qualifies=s=>!!(s&&s.sets&&s.sets.length>=1);
function computeStreak(){
  let n=0,d=new Date();
  if(!qualifies(SESSIONS[iso(d)]))d.setDate(d.getDate()-1);
  while(qualifies(SESSIONS[iso(d)])){n++;d.setDate(d.getDate()-1);}
  return n;
}
function daysSinceStart(){
  if(!META.firstDay)return 0;
  return Math.round((new Date(todayISO())-new Date(META.firstDay))/864e5)+1;
}
const onRamp=()=>META.firstDay && daysSinceStart()<=ONRAMP_DAYS;

/* --------------------------------------------------------------- progress */
function setsFor(mKey,limit){
  const out=[];
  Object.values(SESSIONS).sort((a,b)=>b.date.localeCompare(a.date)).forEach(s=>{
    const mine=(s.sets||[]).filter(x=>x.m===mKey);
    if(mine.length)out.push({date:s.date,sets:mine});
  });
  return limit?out.slice(0,limit):out;
}
function prFor(mKey){
  let best=null;
  Object.values(SESSIONS).forEach(s=>(s.sets||[]).forEach(x=>{
    if(x.m===mKey&&(best===null||x.reps>best.reps))best={reps:x.reps,date:s.date};}));
  return best;
}
function progressionNudge(){
  if(onRamp())return null;
  for(const key of Object.keys(M)){
    const recent=setsFor(key,2);
    if(recent.length<2)continue;
    const topped=recent.every(r=>r.sets.length&&r.sets.every(x=>x.reps>=M[key].hi));
    if(topped)return {m:key,name:M[key].name,short:M[key].short.toLowerCase()};
  }
  return null;
}
const LADDER="Add reps, then lower over 3s, then pause 2s at the bottom, then the vest.";

/* ------------------------------------------------------------------ today */
const DOW=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
function renderToday(){
  const now=new Date(), dk=now.getDay(), day=WEEK[dk];
  $("todayDate").textContent=DOW[dk]+" · "+now.toLocaleDateString(undefined,{month:"long",day:"numeric"});
  $("todayName").textContent=day.name;
  const streak=computeStreak();
  $("streakN").textContent=streak;
  $("streakN").classList.toggle("zero",streak===0);

  const msEl=$("mstone"), tzEl=$("tease");
  tzEl.style.display="none";
  if(streak>0){
    const soon=DAYS[streak+1];
    msEl.textContent=soon?("Tomorrow: "+soon):milestoneFor(streak,META.poolSeen).text;
    msEl.classList.toggle("ahead",!!soon);
    msEl.style.display="block";
  }else if(META.lastStreak>1){
    msEl.textContent=breakMessage(META.lastBreak).text;
    msEl.classList.remove("ahead"); msEl.style.display="block";
  }else{ msEl.style.display="none"; }

  const or=$("onramp");
  if(onRamp()){
    or.style.display="block";
    or.textContent="Easy weeks, "+daysSinceStart()+"/"+ONRAMP_DAYS+" · leave 3–4 in reserve, no vest";
  }else or.style.display="none";

  const nudge=progressionNudge(), nd=$("nudge");
  if(nudge){nd.style.display="block";
    nd.innerHTML="<b>"+nudge.short+": top of the range twice.</b> "+(M[nudge.m].next||LADDER);}
  else nd.style.display="none";

  const done=SESSIONS[todayISO()];
  $("startBtn").textContent=done?(done.complete?"Start again":"Resume"):"Start session";
  const ec=$("editToday");
  if(qualifies(done)){ec.style.display="block";ec.textContent="Edit today, "+done.sets.length+(done.sets.length===1?" set":" sets");}
  else ec.style.display="none";

  $("planList").innerHTML=day.blocks.map((b,i)=>{
    const m=M[b.m];
    return "<li><span class='n'>"+(i+1)+"</span><span class='nm'>"+m.name+"</span><span class='s'>"+
      b.sets+" × "+blockReps(b)+(b.rest?" · "+b.rest+"s":"")+"</span></li>";
  }).join("");
}

/* ---------------------------------------------------------------- routine */
function renderRoutine(){
  const order=[1,2,3,4,5,6,0];
  $("routineList").innerHTML=order.map(dk=>{
    const d=WEEK[dk];
    const rows=d.blocks.map((b,i)=>{const m=M[b.m];
      return "<li><span class='n'>"+(i+1)+"</span><span class='nm'>"+m.name+"</span><span class='s'>"+
        b.sets+" × "+blockReps(b)+(b.rest?" · "+b.rest+"s":"")+"</span></li>";}).join("");
    const cues=d.blocks.map(b=>"<p><b>"+M[b.m].short+".</b> "+M[b.m].cue+"</p>").join("");
    return "<div class='card'><h3>"+DOW[dk]+"</h3><ul class='plan'>"+rows+"</ul>"+
      "<details class='cue'><summary>How to</summary><div class='body'>"+cues+"</div></details></div>";
  }).join("");
}

/* ---------------------------------------------------------------- history */
let calCursor=new Date();
function renderHistory(){
  const y=calCursor.getFullYear(), mo=calCursor.getMonth();
  $("calMonth").textContent=calCursor.toLocaleDateString(undefined,{month:"long",year:"numeric"});
  const first=new Date(y,mo,1), start=first.getDay(), days=new Date(y,mo+1,0).getDate();
  let h=["S","M","T","W","T","F","S"].map(d=>"<div class='h'>"+d+"</div>").join("");
  for(let i=0;i<start;i++)h+="<div></div>";
  for(let d=1;d<=days;d++){
    const key=iso(new Date(y,mo,d)), s=SESSIONS[key];
    const future=new Date(y,mo,d)>new Date();
    let cls="c";
    if(s&&s.complete)cls+=" done"; else if(qualifies(s))cls+=" part";
    else if(!future&&META.firstDay&&key>=META.firstDay)cls+=" miss";
    if(future)cls+=" future";
    if(key===todayISO())cls+=" today";
    h+="<div class='"+cls+"'"+(qualifies(s)?" data-edit='"+key+"' style='cursor:pointer'":"")+">"+d+"</div>";
  }
  $("cal").innerHTML=h;

  const list=Object.values(SESSIONS).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,12);
  $("recent").innerHTML=list.length?list.map(s=>{
    const dt=new Date(s.date+"T12:00:00");
    const t=s.startedAt?new Date(s.startedAt).toLocaleTimeString(undefined,{hour:"2-digit",minute:"2-digit"}):"";
    return "<div class='stat' data-edit='"+s.date+"' style='cursor:pointer'><span>"+
      dt.toLocaleDateString(undefined,{month:"short",day:"numeric"})+
      " · "+WEEK[s.dayKey].name+"<br><span class='muted'>"+(s.sets||[]).length+((s.sets||[]).length===1?" set · ":" sets · ")+t+"</span></span>"+
      "<span class='v mono'>"+(s.actualSec?fmt(s.actualSec):"")+"</span></div>";
  }).join(""):"<p class='muted'>Nothing yet.</p>";
  document.querySelectorAll("[data-edit]").forEach(el=>{
    if(el._wired)return; el._wired=1;
    el.addEventListener("click",()=>openEditor(el.dataset.edit));
  });
}

/* ------------------------------------------------------------------ stats */
function renderStats(){
  const prs=Object.keys(M).map(k=>({k,pr:prFor(k)})).filter(x=>x.pr);
  $("prs").innerHTML=prs.length?prs.map(x=>"<div class='stat'><span>"+M[x.k].name+
    "<br><span class='muted'>"+new Date(x.pr.date+"T12:00:00").toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"})+"</span></span>"+
    "<span class='v mono'>"+x.pr.reps+" <small>"+(M[x.k].hold?"s":"reps")+"</small></span></div>").join("")
    :"<p class='muted'>Log a few sets and your best ones show up here.</p>";

  /* then and now */
  const cut=iso(new Date(Date.now()-60*864e5));
  const lines=[];
  Object.keys(M).forEach(k=>{
    const olds=[],news=[];
    Object.values(SESSIONS).forEach(s=>(s.sets||[]).forEach(x=>{
      if(x.m!==k)return;(s.date<cut?olds:news).push(x.reps);}));
    if(olds.length>=2&&news.length>=2){
      const a=Math.max(...olds), b=Math.max(...news);
      if(b!==a)lines.push("<div class='stat'><span>"+M[k].name+"</span><span class='v mono'>"+a+" → "+b+"</span></div>");
    }
  });
  if(lines.length){$("retroCard").style.display="block";
    $("retro").innerHTML="<p class='muted' style='margin-bottom:8px'>Your best set two months ago, against your best set now.</p>"+lines.join("");}
  else $("retroCard").style.display="none";

  /* hours */
  const hours=new Array(24).fill(0);
  Object.values(SESSIONS).forEach(s=>{if(s.startedAt)hours[new Date(s.startedAt).getHours()]++;});
  const mx=Math.max(1,...hours);
  $("hourBars").innerHTML=hours.map(v=>"<i style='height:"+Math.max(2,(v/mx)*100)+"%;opacity:"+(v?0.9:0.12)+"'></i>").join("");
  const busiest=hours.indexOf(Math.max(...hours));
  $("hourNote").textContent=Object.keys(SESSIONS).length?"You train most often around "+String(busiest).padStart(2,"0")+":00.":"";

  /* length */
  const ls=Object.values(SESSIONS).filter(s=>s.actualSec).sort((a,b)=>a.date.localeCompare(b.date)).slice(-30);
  const lmx=Math.max(900,...ls.map(s=>s.actualSec));
  $("lenSpark").innerHTML=ls.map(s=>"<i style='height:"+(s.actualSec/lmx*100)+"%;background:"+
    (s.actualSec>960?"var(--amber)":"var(--teal)")+"'></i>").join("");
  if(ls.length){const avg=ls.reduce((a,s)=>a+s.actualSec,0)/ls.length;
    $("lenNote").textContent="Average "+fmt(avg)+" over your last "+ls.length+" sessions.";}
  else $("lenNote").textContent="";

  /* weight */
  const w=WEIGHTS.slice().sort((a,b)=>a.date.localeCompare(b.date)).slice(-26);
  if(w.length){
    const lo=Math.min(...w.map(x=>x.w)), hi=Math.max(...w.map(x=>x.w)), span=Math.max(1,hi-lo);
    $("wtSpark").innerHTML=w.map(x=>"<i style='height:"+(12+((x.w-lo)/span)*88)+"%'></i>").join("");
    const first=w[0].w,last=w[w.length-1].w,dd=(last-first).toFixed(1);
    $("wtNote").textContent=last+" lb today. "+(dd>0?"Up ":(dd<0?"Down ":"Level, "))+(dd!=0?Math.abs(dd)+" lb ":"")+"across "+w.length+" weigh-ins.";
  }else{$("wtSpark").innerHTML="";$("wtNote").textContent="No entries yet.";}
}

/* ---------------------------------------------------------------- session */
let PH=[],idx=0,el=0,holding=false,done=false,dayKey=1,startedAt=0,drift=0,pendingWork=null;
let logged=[],repVal=0,sound=true,finishing=false,raf=null,tickMark=-1;
const THEME={work:{bg:"#33150A",ink:"#FFE9DA",mut:"#C79173",acc:"#FF8A4C"},
             rest:{bg:"#072421",ink:"#DEF6F0",mut:"#78AFA5",acc:"#54DFC3"}};
const appEl=$("app"),ring=$("ring"),track=ring.querySelector(".track"),bar=ring.querySelector(".bar");
let RLEN=0;
function sizeRing(){
  const w=appEl.clientWidth,h=appEl.clientHeight;
  const rx=parseFloat(getComputedStyle(appEl).borderTopLeftRadius)||0;
  ring.setAttribute("viewBox","0 0 "+w+" "+h);ring.setAttribute("width",w);ring.setAttribute("height",h);
  [track,bar].forEach(r=>{r.setAttribute("x",2.5);r.setAttribute("y",2.5);
    r.setAttribute("width",Math.max(0,w-5));r.setAttribute("height",Math.max(0,h-5));
    r.setAttribute("rx",Math.max(0,rx-2.5));});
  RLEN=bar.getTotalLength();bar.style.strokeDasharray=RLEN;
}
if(window.ResizeObserver)new ResizeObserver(sizeRing).observe(appEl);else addEventListener("resize",sizeRing);

/* The tones are the ones you picked: sine, same pitches, same envelopes. What
   changed is level. The old .045 gain sat under any music playing alongside it.
   Everything here is roughly eleven times that, and the limiter only engages
   when the volume slider goes past 100%, so at 100% you hear the sine clean. */
let actx=null,lim=null,VOL=1;
function audio(){
  if(!actx){
    actx=new (window.AudioContext||window.webkitAudioContext)();
    lim=actx.createDynamicsCompressor();
    lim.threshold.value=-3;lim.knee.value=6;lim.ratio.value=12;
    lim.attack.value=.003;lim.release.value=.1;
    lim.connect(actx.destination);
  }
  if(actx.state==="suspended")actx.resume();
  return actx;
}
function tone(f,d,g,type){
  if(!sound)return;
  try{
    const a=audio(),t=a.currentTime,dur=d||.1;
    const o=a.createOscillator(),v=a.createGain();
    o.type=type||"sine";o.frequency.value=f;
    v.gain.value=0;o.connect(v);v.connect(lim);
    v.gain.linearRampToValueAtTime(Math.max(.0002,(g||.5)*VOL),t+.012);
    v.gain.exponentialRampToValueAtTime(.0001,t+dur);
    o.start(t);o.stop(t+dur+.02);
  }catch(e){}
}
/* the ramp: three soft ticks, then one bright tone. never an alarm. */
function tick(n){tone(880,.085,.5);if(navigator.vibrate)navigator.vibrate(14);}
function goTone(){tone(1320,.22,.77);if(navigator.vibrate)navigator.vibrate([26,50,26]);}

function startSession(){
  dayKey=new Date().getDay();
  /* Stamp day one before the phases are built, or the very first session is the
     one session the on-ramp never applies to. */
  if(!META.firstDay){META.firstDay=todayISO();put("meta",META);}
  PH=buildPhases(dayKey,onRamp());
  idx=0;el=0;holding=false;done=false;finishing=false;drift=0;pendingWork=null;tickMark=-1;
  const existing=SESSIONS[todayISO()];
  logged=existing&&!existing.complete?existing.sets.slice():[];
  startedAt=existing&&existing.startedAt?existing.startedAt:Date.now();
  $("sStreak").textContent=computeStreak();
  $("doneview").classList.remove("on");
  $("log").classList.remove("on");
  $("sess").classList.add("on");
  sizeRing();render();
  if(!raf)raf=requestAnimationFrame(loop);
}
function plannedTotal(){return PH.reduce((a,p)=>a+p.dur,0);}
function remaining(){let r=Math.max(0,PH[idx].dur-el);for(let i=idx+1;i<PH.length;i++)r+=PH[i].dur;return r;}
const setLbl=p=>p.sets>1?"Set "+p.set+" of "+p.sets:"Single set";
const rirLbl=r=>r[0]===r[1]?String(r[0]):r[0]+"–"+r[1];
function setPips(n,cur){let h="";for(let i=1;i<=n;i++)h+='<i class="'+(i<cur?"done":(i===cur?"cur":""))+'"></i>';$("pips").innerHTML=h;}
let deltaTimer=null;
function flashDelta(sec){
  const d=$("delta"),n=Math.round(Math.abs(sec));
  if(n<2){d.classList.remove("on");return;}
  d.textContent=(sec<0?"−":"+")+n+" s "+(sec<0?"early":"long")+" · schedule shifted";
  d.classList.add("on");clearTimeout(deltaTimer);deltaTimer=setTimeout(()=>d.classList.remove("on"),4200);
}
function render(){
  if(done)return;
  const p=PH[idx],m=M[p.m],work=p.type==="work",th=work?THEME.work:THEME.rest;
  appEl.style.setProperty("--bg",th.bg);appEl.style.setProperty("--ink",th.ink);
  appEl.style.setProperty("--mut",th.mut);appEl.style.setProperty("--acc",th.acc);
  const left=p.dur-el,over=work&&left<0;
  let nextW=null;for(let i=idx+1;i<PH.length;i++){if(PH[i].type==="work"){nextW=PH[i];break;}}
  $("phaseLbl").textContent=work?"Working":(holding?"Resting · set not logged":"Resting");
  const ct=over?("+"+fmt(-left)):fmt(left);
  $("clock").textContent=ct;
  $("clock").className="big mono"+(over?" over":"")+(ct.length>=5?" wide":"");
  const show=work?p:(nextW||p),sm=M[show.m];
  $("exName").textContent=work?m.name:(nextW?sm.name:"Session ends");
  setPips(show.sets,show.set);
  $("setNow").textContent=show.sets>1?"Set "+show.set+" of "+show.sets:"";
  $("target").innerHTML="<b>"+show.reps+"</b>"+(sm.side?" "+sm.side:(sm.hold?"":" reps"))+" · <b>"+sm.load+"</b>";
  $("effort").innerHTML=show.rir
    ?(onRamp()?"Easy weeks · ":"")+"stop <b>"+rirLbl(show.rir)+"</b> short of failure"
    :"";
  $("nextLbl").textContent=work
    ?(PH[idx+1]?"Rest "+fmt(PH[idx+1].dur)+(nextW?", then "+M[nextW.m].short+" · "+setLbl(nextW):""):"Last set")
    :(nextW?M[nextW.m].short+" · "+setLbl(nextW):"Session ends");
  const end=new Date(Date.now()+remaining()*1000);
  $("endAt").textContent=String(end.getHours()).padStart(2,"0")+":"+String(end.getMinutes()).padStart(2,"0");
  const green=Object.keys(SESSIONS).length<4;
  $("hint").firstChild.nodeValue=holding?"Log the set · ends "
    :(green?(work?"Tap anywhere when the set is done · ends ":"Tap anywhere to start early · ends "):"Ends ");
  const prog=Math.min(1,Math.max(0,el/p.dur));
  bar.style.strokeDashoffset=over?0:RLEN*prog;
  ring.classList.toggle("over",!!over);
  $("logRest").textContent=fmt(Math.max(0,PH[idx].dur-el));
}
function endWork(){
  const p=PH[idx],delta=el-p.dur;
  p.actual=el;drift+=delta;flashDelta(delta);
  pendingWork={m:p.m,set:p.set,sets:p.sets,def:p.def,rir:p.rir};
  idx++;el=0;
  if(idx>=PH.length){finishing=true;openLog();tone(520,.14,.66);return;}
  holding=true;openLog();tone(520,.14,.66);render();
}
function endRest(){
  const p=PH[idx];p.actual=el;drift+=(el-p.dur);idx++;el=0;tickMark=-1;
  if(idx>=PH.length){finish();return;}
  goTone();render();
}
/* Seed the counter with what you did last time, not a static default. Skips
   today, which is already in SESSIONS as the session writes itself. */
function lastReps(mKey,set){
  const prev=setsFor(mKey).filter(r=>r.date!==todayISO())[0];
  if(!prev)return null;
  const exact=prev.sets.find(x=>x.set===set);
  return (exact||prev.sets[prev.sets.length-1]).reps;
}
function openLog(){
  const m=M[pendingWork.m];
  repVal=lastReps(pendingWork.m,pendingWork.set)||pendingWork.def||m.def;
  $("repVal").textContent=repVal;
  $("repUnit").textContent=m.hold?"seconds":(m.side?"reps / side":"reps");
  $("logName").textContent=m.name;
  $("logSet").textContent="Set "+pendingWork.set+" of "+pendingWork.sets;
  $("rirLbl").textContent=pendingWork.rir
    ?"Reps left in the tank · aim for "+rirLbl(pendingWork.rir)
    :"Reps left in the tank";
  const pr=prFor(pendingWork.m);
  $("prTag").classList.remove("on");
  const rir=$("rir");rir.innerHTML="";
  for(let n=0;n<=4;n++){
    const b=document.createElement("button");
    b.innerHTML="<b>"+(n===4?"4+":n)+"</b>";
    b.setAttribute("aria-label",n+" reps in reserve");
    const t=pendingWork.rir;
    if(t&&n>=t[0]&&n<=t[1])b.classList.add("tgt");
    b.addEventListener("click",()=>commitLog(n));
    rir.appendChild(b);
  }
  $("prCheck")&&0;
  $("log").classList.add("on");$("log").setAttribute("aria-hidden","false");
  updatePrTag(pr);
}
function updatePrTag(pr){
  const on=pr&&repVal>pr.reps;
  $("prTag").classList.toggle("on",!!on);
}
function bumpRep(delta){
  const m=M[pendingWork.m];
  repVal=Math.max(0,Math.min(m.hold?600:60,repVal+delta));
  $("repVal").textContent=repVal;
  updatePrTag(prFor(pendingWork.m));
}
function commitLog(rir){
  const pr=prFor(pendingWork.m), isPr=pr&&repVal>pr.reps;
  logged.push({m:pendingWork.m,set:pendingWork.set,reps:repVal,rir:rir,ts:Date.now()});
  holding=false;pendingWork=null;
  $("log").classList.remove("on");$("log").setAttribute("aria-hidden","true");
  tone(isPr?990:880,.12,.66);
  saveSession(false);
  if(finishing){finish();return;}
  render();
}
function finish(){
  done=true;
  const actual=plannedTotal()+drift;
  $("doneview").classList.add("on");
  $("doneTime").textContent=fmt(actual);
  saveSession(true,actual);
  const streak=computeStreak();
  $("sStreak").textContent=streak;
  $("doneNote").textContent=logged.length+(logged.length===1?" set logged. ":" sets logged. ")+
    (streak>0?("Day "+streak+" in a row."):"");
  const ms=streak>0?milestoneFor(streak,META.poolSeen):null;
  $("doneMs").textContent=ms?ms.text:"";
  if(ms&&!ms.keyed&&typeof ms.poolIndex==="number"&&!META.poolSeen.includes(ms.poolIndex)){
    META.poolSeen.push(ms.poolIndex);
    if(META.poolSeen.length>=POOL.length)META.poolSeen=[];
    put("meta",META);
  }
}
async function saveSession(complete,actual){
  const date=todayISO();
  const rec={date,dayKey,startedAt,endedAt:Date.now(),
    plannedSec:plannedTotal(),actualSec:actual||null,sets:logged.slice(),complete:!!complete};
  SESSIONS[date]=rec;
  if(!META.firstDay){META.firstDay=date;}
  const st=computeStreak();
  if(st===0&&META.lastStreak>1){META.lastBreak=breakMessage(META.lastBreak).index;}
  META.lastStreak=st;
  await put("sessions",rec);await put("meta",META);
}
function leaveSession(){
  $("sess").classList.remove("on");
  /* `done` means finish() already stored the session complete. Saving again
     here would overwrite that flag and drop actualSec. That is exactly what
     the Done button used to do. */
  if(logged.length&&!done)saveSession(false);
  renderToday();renderHistory();renderStats();
}
function loop(now){
  if(!loop.last)loop.last=now;
  const dt=(now-loop.last)/1000;loop.last=now;
  if($("sess").classList.contains("on")&&!done&&!finishing){
    const p=PH[idx];
    if(p.type==="rest"&&holding){el=Math.min(el+dt,p.dur);}else{el+=dt;}
    if(p.type==="rest"&&!holding&&el>=p.dur){endRest();}
    else{
      if(p.type==="rest"&&!holding){
        const lft=Math.ceil(p.dur-el);
        if(lft<=3&&lft>0&&lft!==tickMark){tickMark=lft;tick(lft);}
        if(lft>3)tickMark=-1;
      }
      render();
    }
  }
  raf=requestAnimationFrame(loop);
}


/* ----------------------------------------------------------------- editor */
let edDate=null;
function openEditor(date){
  const s=SESSIONS[date]; if(!s)return;
  edDate=date;
  const d=new Date(date+"T12:00:00");
  $("edDate").textContent=d.toLocaleDateString(undefined,{weekday:"long",month:"long",day:"numeric"});
  $("edDay").textContent=WEEK[s.dayKey].name;
  $("edMove").innerHTML=WEEK[s.dayKey].blocks.map(b=>"<option value='"+b.m+"'>"+M[b.m].name+"</option>").join("");
  renderEdList();
  $("editor").classList.add("on");
}
function renderEdList(){
  const s=SESSIONS[edDate];
  if(!s.sets.length){$("edList").innerHTML="<p class='muted'>No sets left on this day.</p>";return;}
  let h="<div class='edlab'><span>Reps</span><span>RIR</span></div>";
  const tally={};s.sets.forEach(x=>tally[x.m]=(tally[x.m]||0)+1);
  h+=s.sets.map((x,i)=>{
    const m=M[x.m],n=tally[x.m];
    return "<div class='edrow'><span class='who'>"+m.name+"<small>Set "+x.set+(n>1?" of "+n:"")+"</small></span>"+
      "<input type='number' inputmode='numeric' value='"+x.reps+"' data-i='"+i+"' data-f='reps'>"+
      "<select data-i='"+i+"' data-f='rir'>"+[0,1,2,3,4].map(n=>
        "<option value='"+n+"'"+(x.rir===n?" selected":"")+">"+(n===4?"4+":n)+"</option>").join("")+"</select>"+
      "<button class='x' data-del='"+i+"' aria-label='Remove set'>"+
      "<svg viewBox='0 0 24 24' width='16' height='16' fill='none' stroke='currentColor' stroke-width='1.9' stroke-linecap='round'><path d='M6 6l12 12M18 6L6 18'/></svg></button></div>";
  }).join("");
  $("edList").innerHTML=h;
  $("edList").querySelectorAll("input[data-f],select[data-f]").forEach(el=>{
    el.addEventListener("change",async()=>{
      const i=+el.dataset.i, f=el.dataset.f, v=parseInt(el.value,10);
      if(isNaN(v))return;
      SESSIONS[edDate].sets[i][f]=Math.max(0,v);
      await persistEdit();
    });
  });
  $("edList").querySelectorAll("button[data-del]").forEach(b=>{
    b.addEventListener("click",async()=>{
      SESSIONS[edDate].sets.splice(+b.dataset.del,1);
      await persistEdit(); renderEdList();
    });
  });
}
async function persistEdit(){
  const s=SESSIONS[edDate];
  s.complete=s.complete&&s.sets.length>0;
  await put("sessions",s);
  META.lastStreak=computeStreak(); await put("meta",META);
  renderToday();renderHistory();renderStats();
}
$("edAdd").addEventListener("click",async()=>{
  const s=SESSIONS[edDate], mk=$("edMove").value;
  const n=s.sets.filter(x=>x.m===mk).length+1;
  s.sets.push({m:mk,set:n,reps:M[mk].def,rir:2,ts:Date.now()});
  await persistEdit(); renderEdList();
});
$("edDel").addEventListener("click",async()=>{
  if(!edDate)return;
  const d=edDate;
  delete SESSIONS[d];
  await new Promise((res,rej)=>{const q=tx("sessions","readwrite").delete(d);q.onsuccess=()=>res();q.onerror=()=>rej();});
  META.lastStreak=computeStreak(); await put("meta",META);
  $("editor").classList.remove("on"); edDate=null;
  renderToday();renderHistory();renderStats();toast("Session deleted");
});
$("edClose").addEventListener("click",()=>{$("editor").classList.remove("on");edDate=null;});
$("editor").addEventListener("click",e=>{if(e.target.id==="editor"){$("editor").classList.remove("on");edDate=null;}});

/* ------------------------------------------------------------------- wire */
$("field").addEventListener("click",()=>{
  if(done||holding)return;
  if(sound){try{audio();}catch(e){}}
  if(PH[idx].type==="work")endWork();else endRest();
});
$("repMinus").addEventListener("click",()=>bumpRep(-1));
$("repPlus").addEventListener("click",()=>bumpRep(1));
function setSound(on){
  sound=on;
  $("sndBtn").setAttribute("aria-pressed",on?"true":"false");
  $("sndToggle").textContent=on?"Cues on":"Cues off";
  META.sound=on;put("meta",META);
  if(on)tone(660,.08,.55);
}
$("sndBtn").addEventListener("click",()=>setSound(!sound));
$("sndToggle").addEventListener("click",()=>setSound(!sound));
$("quitBtn").addEventListener("click",leaveSession);
$("doneBtn").addEventListener("click",leaveSession);
$("startBtn").addEventListener("click",startSession);
$("editToday").addEventListener("click",()=>openEditor(todayISO()));
document.querySelectorAll("nav button").forEach(b=>b.addEventListener("click",()=>{
  document.querySelectorAll("nav button").forEach(x=>x.classList.toggle("on",x===b));
  document.querySelectorAll(".page").forEach(p=>p.classList.remove("on"));
  $("p-"+b.dataset.go).classList.add("on");
  if(b.dataset.go==="history")renderHistory();
  if(b.dataset.go==="stats")renderStats();
  scrollTo(0,0);
}));
$("calPrev").addEventListener("click",()=>{calCursor.setMonth(calCursor.getMonth()-1);renderHistory();});
$("calNext").addEventListener("click",()=>{calCursor.setMonth(calCursor.getMonth()+1);renderHistory();});
$("wtSave").addEventListener("click",async()=>{
  const v=parseFloat($("wtIn").value);if(!v)return;
  const rec={date:todayISO(),w:v};await put("weights",rec);
  WEIGHTS=WEIGHTS.filter(x=>x.date!==rec.date);WEIGHTS.push(rec);
  $("wtIn").value="";renderStats();toast("Saved");
});
const dump=()=>JSON.stringify({sessions:Object.values(SESSIONS),meta:META,weights:WEIGHTS},null,2);
$("expBtn").addEventListener("click",()=>{
  const a=document.createElement("a");
  a.href=URL.createObjectURL(new Blob([dump()],{type:"application/json"}));
  a.download="reps-"+todayISO()+".json";a.click();URL.revokeObjectURL(a.href);
});
/* Reading the clipboard needs a permission Android quietly refuses inside an
   installed app, and it fails silently. A box you paste into always works. */
$("pstBtn").addEventListener("click",()=>{
  const b=$("pasteBox"),shown=b.style.display==="block";
  b.style.display=shown?"none":"block";
  if(!shown)$("pasteIn").focus();
});
$("pasteGo").addEventListener("click",async()=>{
  const raw=$("pasteIn").value.trim().replace(/^```[a-z]*/i,"").replace(/```$/,"").trim();
  if(!raw){toast("The box is empty");return;}
  let d;
  try{d=JSON.parse(raw);}catch(e){toast("That text is not valid JSON");return;}
  try{await ingest(d);}catch(e){toast("Valid JSON, but not a Reps export");return;}
  $("pasteIn").value="";$("pasteBox").style.display="none";toast("Imported");
});
$("cpyBtn").addEventListener("click",async()=>{
  try{await navigator.clipboard.writeText(dump());toast("Copied");}
  catch(e){toast("Your browser blocked the clipboard");}
});
$("volIn").addEventListener("input",e=>{
  VOL=(+e.target.value)/100;$("volNote").textContent=e.target.value+"%";});
$("volIn").addEventListener("change",async e=>{
  META.vol=(+e.target.value)/100;await put("meta",META);tone(880,.085,.6);});
$("volTest").addEventListener("click",()=>{
  tick(3);setTimeout(()=>tick(2),800);setTimeout(()=>tick(1),1600);setTimeout(goTone,2400);});
$("impBtn").addEventListener("click",()=>$("impFile").click());
$("impFile").addEventListener("change",async e=>{
  const f=e.target.files[0];if(!f)return;
  try{
    await ingest(JSON.parse(await f.text()));toast("Imported");
  }catch(err){toast("Could not read that file");}
  e.target.value="";
});

async function ingest(d){
  if(!d||!Array.isArray(d.sessions))throw new Error("not an export");
  for(const s of d.sessions)await put("sessions",s);
  for(const w of (d.weights||[]))await put("weights",w);
  if(d.meta){META=Object.assign(META,d.meta,{k:"app"});await put("meta",META);}
  await load();
}
async function load(){
  const s=await all("sessions");SESSIONS={};s.forEach(x=>SESSIONS[x.date]=x);
  const m=await get("meta","app");if(m)META=Object.assign(META,m);
  sound=META.sound!==false;
  $("sndBtn").setAttribute("aria-pressed",sound?"true":"false");
  $("sndToggle").textContent=sound?"Cues on":"Cues off";
  VOL=typeof META.vol==="number"?META.vol:1;
  $("volIn").value=Math.round(VOL*100);$("volNote").textContent=Math.round(VOL*100)+"%";
  WEIGHTS=await all("weights");
  $("verNote").textContent=APP_VERSION;
  renderToday();renderRoutine();renderHistory();renderStats();
}
open().then(load).catch(()=>{toast("This browser will not let the app save anything");renderToday();renderRoutine();});
if("serviceWorker" in navigator)addEventListener("load",async()=>{
  const had=!!navigator.serviceWorker.controller;
  let reloading=false;
  navigator.serviceWorker.addEventListener("controllerchange",()=>{
    if(!had||reloading)return;
    reloading=true;location.reload();
  });
  try{
    const reg=await navigator.serviceWorker.register("./sw.js");
    reg.update();
    addEventListener("visibilitychange",()=>{if(!document.hidden)reg.update();});
  }catch(e){}
});
