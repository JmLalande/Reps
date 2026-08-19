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
let SESSIONS={}, META={k:"app",poolSeen:[],lastBreak:-1,sound:true,firstDay:null,lastStreak:0}, WEIGHTS=[];
const $=id=>document.getElementById(id);
const iso=d=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
const todayISO=()=>iso(new Date());
const fmt=s=>{s=Math.max(0,Math.round(s));return Math.floor(s/60)+":"+String(s%60).padStart(2,"0");};
function toast(msg){const t=$("toast");t.textContent=msg;t.classList.add("on");
  clearTimeout(t._h);t._h=setTimeout(()=>t.classList.remove("on"),2600);}

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
  $("streakN").classList.toggle("live",streak>0);

  const msEl=$("mstone"), tzEl=$("tease");
  if(streak>0){
    const ms=milestoneFor(streak,META.poolSeen);
    msEl.textContent=ms.text; msEl.style.display="block";
    const t=teaseFor(streak);
    tzEl.textContent=t||""; tzEl.style.display=t?"block":"none";
  }else if(META.lastStreak>1){
    msEl.textContent=breakMessage(META.lastBreak).text; msEl.style.display="block";
    tzEl.style.display="none";
  }else{
    msEl.style.display="none"; tzEl.style.display="none";
  }

  const or=$("onramp");
  if(onRamp()){
    or.style.display="block";
    or.innerHTML="<b>Day "+daysSinceStart()+" of "+ONRAMP_DAYS+".</b> Leave 3 or 4 in the tank. No vest.";
  }else or.style.display="none";

  const nudge=progressionNudge(), nd=$("nudge");
  if(nudge){nd.style.display="block";
    nd.innerHTML="<b>"+nudge.short+": top of the range twice.</b> "+LADDER;}
  else nd.style.display="none";

  const done=SESSIONS[todayISO()];
  $("startBtn").textContent=done?(done.complete?"Start again":"Resume"):"Start session";

  $("planList").innerHTML=day.blocks.map((b,i)=>{
    const m=M[b.m];
    return "<li><span class='n'>"+(i+1)+"</span><span class='nm'>"+m.name+"</span><span class='s'>"+
      b.sets+" × "+m.reps+(b.rest?" · "+b.rest+"s":"")+"</span></li>";
  }).join("");
}

/* ---------------------------------------------------------------- routine */
function renderRoutine(){
  const order=[1,2,3,4,5,6,0];
  $("routineList").innerHTML=order.map(dk=>{
    const d=WEEK[dk];
    const rows=d.blocks.map((b,i)=>{const m=M[b.m];
      return "<li><span class='n'>"+(i+1)+"</span><span class='nm'>"+m.name+"</span><span class='s'>"+
        b.sets+" × "+m.reps+(b.rest?" · "+b.rest+"s":"")+"</span></li>";}).join("");
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
    h+="<div class='"+cls+"'>"+d+"</div>";
  }
  $("cal").innerHTML=h;

  const list=Object.values(SESSIONS).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,12);
  $("recent").innerHTML=list.length?list.map(s=>{
    const dt=new Date(s.date+"T12:00:00");
    const t=s.startedAt?new Date(s.startedAt).toLocaleTimeString(undefined,{hour:"2-digit",minute:"2-digit"}):"—";
    return "<div class='stat'><span>"+dt.toLocaleDateString(undefined,{month:"short",day:"numeric"})+
      " · "+WEEK[s.dayKey].name+"<br><span class='muted'>"+(s.sets||[]).length+" sets · "+t+"</span></span>"+
      "<span class='v mono'>"+(s.actualSec?fmt(s.actualSec):"—")+"</span></div>";
  }).join(""):"<p class='muted'>Nothing yet.</p>";
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

let actx=null;
function tone(f,d,g,type){
  if(!sound)return;
  try{
    if(!actx)actx=new (window.AudioContext||window.webkitAudioContext)();
    if(actx.state==="suspended")actx.resume();
    const o=actx.createOscillator(),v=actx.createGain();
    o.type=type||"sine";o.frequency.value=f;v.gain.value=0;o.connect(v);v.connect(actx.destination);
    const t=actx.currentTime;
    v.gain.linearRampToValueAtTime(g||.07,t+.012);
    v.gain.exponentialRampToValueAtTime(.0001,t+(d||.1));
    o.start(t);o.stop(t+(d||.1)+.02);
  }catch(e){}
}
/* the ramp: five soft ticks rising, then one low tone. never an alarm. */
const TICK=[392,440,494,554,622];
function tick(n){tone(TICK[5-n]||440,.055,.035);if(navigator.vibrate)navigator.vibrate(12);}
function goTone(){tone(294,.34,.075,"triangle");if(navigator.vibrate)navigator.vibrate([26,50,26]);}

function startSession(){
  dayKey=new Date().getDay();
  PH=buildPhases(dayKey);
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
  $("target").innerHTML="<b>"+sm.reps+"</b>"+(sm.side?" "+sm.side:(sm.hold?"":" reps"))+" · <b>"+sm.load+"</b>";
  $("nextLbl").textContent=work
    ?(PH[idx+1]?"Rest "+fmt(PH[idx+1].dur)+(nextW?", then "+M[nextW.m].short+" "+nextW.set:""):"Last set")
    :(nextW?M[nextW.m].short+" set "+nextW.set:"Session ends");
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
  pendingWork={m:p.m,set:p.set};
  idx++;el=0;
  if(idx>=PH.length){finishing=true;openLog();tone(520,.14,.06);return;}
  holding=true;openLog();tone(520,.14,.06);render();
}
function endRest(){
  const p=PH[idx];p.actual=el;drift+=(el-p.dur);idx++;el=0;tickMark=-1;
  if(idx>=PH.length){finish();return;}
  goTone();render();
}
function openLog(){
  const m=M[pendingWork.m];
  repVal=m.def;
  $("repVal").textContent=repVal;
  $("repUnit").textContent=m.hold?"seconds":(m.side?"reps / side":"reps");
  $("logWho").textContent="Set "+pendingWork.set;
  $("logName").textContent=m.name;
  const pr=prFor(pendingWork.m);
  $("prTag").classList.remove("on");
  const rir=$("rir");rir.innerHTML="";
  for(let n=0;n<=4;n++){
    const b=document.createElement("button");
    b.innerHTML="<b>"+n+"</b><i>"+(n===0?"none":(n===4?"4+":"&nbsp;"))+"</i>";
    b.setAttribute("aria-label",n+" reps in reserve");
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
  tone(isPr?990:880,.12,.06);
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
  $("doneNote").textContent=logged.length+" sets logged. "+
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
  if(logged.length)saveSession(false);
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
        if(lft<=5&&lft>0&&lft!==tickMark){tickMark=lft;tick(lft);}
        if(lft>5)tickMark=-1;
      }
      render();
    }
  }
  raf=requestAnimationFrame(loop);
}

/* ------------------------------------------------------------------- wire */
$("field").addEventListener("click",()=>{
  if(done||holding)return;
  if(!actx&&sound){try{actx=new (window.AudioContext||window.webkitAudioContext)();}catch(e){}}
  if(PH[idx].type==="work")endWork();else endRest();
});
$("repMinus").addEventListener("click",()=>bumpRep(-1));
$("repPlus").addEventListener("click",()=>bumpRep(1));
$("sndBtn").addEventListener("click",function(){sound=!sound;this.setAttribute("aria-pressed",sound?"true":"false");
  META.sound=sound;put("meta",META);if(sound)tone(660,.08,.05);});
$("quitBtn").addEventListener("click",leaveSession);
$("doneBtn").addEventListener("click",leaveSession);
$("startBtn").addEventListener("click",startSession);
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
$("expBtn").addEventListener("click",()=>{
  const blob=new Blob([JSON.stringify({sessions:Object.values(SESSIONS),meta:META,weights:WEIGHTS},null,2)],
    {type:"application/json"});
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);
  a.download="reps-"+todayISO()+".json";a.click();URL.revokeObjectURL(a.href);
});
$("impBtn").addEventListener("click",()=>$("impFile").click());
$("impFile").addEventListener("change",async e=>{
  const f=e.target.files[0];if(!f)return;
  try{
    const d=JSON.parse(await f.text());
    for(const s of (d.sessions||[]))await put("sessions",s);
    for(const w of (d.weights||[]))await put("weights",w);
    if(d.meta){META=Object.assign(META,d.meta,{k:"app"});await put("meta",META);}
    await load();toast("Imported");
  }catch(err){toast("Could not read that file");}
  e.target.value="";
});

async function load(){
  const s=await all("sessions");SESSIONS={};s.forEach(x=>SESSIONS[x.date]=x);
  const m=await get("meta","app");if(m)META=Object.assign(META,m);
  sound=META.sound!==false;$("sndBtn").setAttribute("aria-pressed",sound?"true":"false");
  WEIGHTS=await all("weights");
  renderToday();renderRoutine();renderHistory();renderStats();
}
open().then(load).catch(()=>{toast("This browser will not let the app save anything");renderToday();renderRoutine();});
if("serviceWorker" in navigator)addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));
