"use strict";
/* ---------------------------------------------------------------- storage */
const DB_NAME="reps-tracker", DB_VER=2;
let db=null;
function open(){return new Promise((res,rej)=>{
  const r=indexedDB.open(DB_NAME,DB_VER);
  r.onupgradeneeded=e=>{const d=e.target.result;
    if(!d.objectStoreNames.contains("sessions"))d.createObjectStore("sessions",{keyPath:"date"});
    if(!d.objectStoreNames.contains("meta"))d.createObjectStore("meta",{keyPath:"k"});
    if(!d.objectStoreNames.contains("weights"))d.createObjectStore("weights",{keyPath:"date"});
    if(!d.objectStoreNames.contains("freezes"))d.createObjectStore("freezes",{keyPath:"date"});};
  r.onsuccess=e=>{db=e.target.result;res();};r.onerror=()=>rej(r.error);});}
function tx(store,mode){return db.transaction(store,mode).objectStore(store);}
function put(store,val){return new Promise((res,rej)=>{const q=tx(store,"readwrite").put(val);
  q.onsuccess=()=>res();q.onerror=()=>rej(q.error);});}
function all(store){return new Promise((res,rej)=>{const q=tx(store,"readonly").getAll();
  q.onsuccess=()=>res(q.result||[]);q.onerror=()=>rej(q.error);});}
function get(store,key){return new Promise((res,rej)=>{const q=tx(store,"readonly").get(key);
  q.onsuccess=()=>res(q.result||null);q.onerror=()=>rej(q.error);});}
function del(store,key){return new Promise((res,rej)=>{const q=tx(store,"readwrite").delete(key);
  q.onsuccess=()=>res();q.onerror=()=>rej(q.error);});}

/* ------------------------------------------------------------------ state */
let SESSIONS={}, META={k:"app",poolSeen:[],lastBreak:-1,sound:true,vol:1,firstDay:null,lastStreak:0,facts:null}, WEIGHTS=[], FREEZES={};
const $=id=>document.getElementById(id);
const iso=d=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
/* The day ends at 4 in the morning, not at midnight. A session at 2am after a
   late night belongs to that evening, and a midnight cutoff filed it under the
   next day and broke the streak for a day that was not missed. Everything that
   asks "what day is it" goes through appNow; timestamps stay on the real clock. */
const ROLLOVER_H=4;
function appNow(){const d=new Date();if(d.getHours()<ROLLOVER_H)d.setDate(d.getDate()-1);return d;}
const todayISO=()=>iso(appNow());
/* Three ways to read a clock, and they are not interchangeable. A countdown is
   ceil, so "4" means four seconds or less are left and the digit changes at the
   same instant the beep for it fires. It used to be round, which flipped the
   display to 4 at 4.5 while the tick waited for 4.0, and every beep in the
   countdown landed half a second after its own number. A stopwatch is floor,
   for the same reason in the other direction. Round is for a finished duration,
   where there is nothing to line up against. */
const clock=(s,f)=>{s=Math.max(0,f(s));return Math.floor(s/60)+":"+String(s%60).padStart(2,"0");};
const fmt=s=>clock(s,Math.round);
const cdn=s=>clock(s,v=>Math.ceil(v-1e-6));
const upn=s=>clock(s,Math.floor);
function toast(msg){const t=$("toast");t.textContent=msg;t.classList.add("on");
  clearTimeout(t._h);t._h=setTimeout(()=>t.classList.remove("on"),2600);}

const APP_VERSION="v30";
const qualifies=s=>!!(s&&s.sets&&s.sets.length>=1);
/* A movement done one side at a time writes a row per side, so a row is not a
   set. Everything that counts sets out loud counts them this way. */
const setCount=a=>new Set((a||[]).map(x=>x.m+"#"+x.set)).size;
/* A day holds the chain if you trained or if you froze. Only training counts
   toward the number on screen, so the streak reads as sessions done and the
   milestone keyed to it stays true. */
const held=k=>qualifies(SESSIONS[k])||!!FREEZES[k];
function computeStreak(){
  let n=0,d=appNow();
  if(!held(iso(d)))d.setDate(d.getDate()-1);
  while(held(iso(d))){if(qualifies(SESSIONS[iso(d)]))n++;d.setDate(d.getDate()-1);}
  return n;
}

/* The budget is derived from the dates, never stored. The Monday of the week a
   day falls in names that week, so a freeze always bills the week it sits in. */
function weekOf(k){const d=new Date(k+"T12:00:00");d.setDate(d.getDate()-(d.getDay()+6)%7);return iso(d);}
const freezesIn=w=>Object.keys(FREEZES).filter(k=>weekOf(k)===w).length;
const freezesLeft=()=>Math.max(0,FREEZES_PER_WEEK-freezesIn(weekOf(todayISO())));

/* The days between the last day you held and yesterday. Today is never in here:
   today is not missed until it is over. The longest gap that can ever be covered
   is the tail of one week and the head of the next. */
function openGap(){
  if(!Object.values(SESSIONS).some(qualifies))return [];
  const gap=[],d=appNow();d.setDate(d.getDate()-1);
  while(gap.length<=2*FREEZES_PER_WEEK&&!held(iso(d))){gap.push(iso(d));d.setDate(d.getDate()-1);}
  return held(iso(d))?gap:null;   /* null means the gap runs off the end, too long to cover */
}
async function spendFreeze(date,auto){
  const rec={date,auto:!!auto};
  FREEZES[date]=rec;await put("freezes",rec);
}
/* Nothing runs at midnight in a page that is closed, so a missed day is only
   found when you open the app again. Cover the whole gap or none of it, each
   day out of its own week's budget. Half a gap covered still breaks the streak
   and burns a freeze you could have used later. */
async function autoCover(){
  const gap=openGap();
  if(!gap||!gap.length)return 0;
  const need={};
  for(const k of gap)need[weekOf(k)]=(need[weekOf(k)]||0)+1;
  if(Object.keys(need).some(w=>need[w]>FREEZES_PER_WEEK-freezesIn(w)))return 0;
  for(const k of gap)await spendFreeze(k,true);
  return gap.length;
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


/* The main line is keyed to the day count and has to stay that way, or the
   number on the screen stops matching the number in the sentence. Everything
   worth reading that has no duration in it goes on the bonus line instead. */
function showBonus(el,text){
  el.textContent="";
  const lbl=document.createElement("b");
  lbl.textContent="Bonus";
  el.appendChild(lbl);
  el.appendChild(document.createTextNode(text));
  el.style.display="block";
}

/* The done screen and the home screen have to show the same two facts for the
   same day. Which ones come up depends on what the pool has already spent, and
   finishing a session spends them, so picking twice would quietly swap the
   bonus out from under you the moment the modal closed. Pick once a day. */
function dayFacts(day){
  if(META.facts&&META.facts.day===day)return META.facts;
  const ms=milestoneFor(day,META.poolSeen);
  const bn=bonusFor(day,META.poolSeen,ms.poolIndex);
  META.facts={day:day,text:ms.text,
    mainIndex:typeof ms.poolIndex==="number"?ms.poolIndex:null,
    bonus:bn.text,bonusIndex:bn.poolIndex};
  put("meta",META);
  return META.facts;
}

/* ------------------------------------------------------------------ today */
const DOW=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
function renderToday(){
  const now=appNow(), dk=now.getDay(), day=WEEK[dk];
  $("todayDate").textContent=DOW[dk]+" · "+now.toLocaleDateString(undefined,{month:"long",day:"numeric"});
  $("todayName").textContent=day.name;
  const streak=computeStreak();
  $("streakN").textContent=streak;
  $("streakN").classList.toggle("zero",streak===0);

  const msEl=$("mstone"), bnEl=$("bonus");
  bnEl.style.display="none";
  /* The day you are on, never the day after. The fact is the reward for having
     got here, and it is handed over first on the done screen at the end of the
     session that earned it. Showing tomorrow's here spoiled that. */
  if(streak>0){
    const f=dayFacts(streak);
    msEl.textContent=f.text;
    msEl.style.display="block";
    showBonus(bnEl,f.bonus);
  }else if(META.lastStreak>1){
    msEl.textContent=breakMessage(META.lastBreak).text;
    msEl.style.display="block";
  }else{ msEl.style.display="none"; }

  const or=$("onramp");
  if(onRamp()){
    or.style.display="block";
    or.textContent="Easy weeks, "+daysSinceStart()+"/"+ONRAMP_DAYS+" · leave 3–4 in reserve, no vest";
  }else or.style.display="none";

  const done=SESSIONS[todayISO()];
  $("startBtn").textContent=done?(done.complete?"Start again":"Resume"):"Start session";
  const ec=$("editToday");
  if(qualifies(done)){const n=setCount(done.sets);
    ec.style.display="block";ec.textContent="Edit today, "+n+(n===1?" set":" sets");}
  else ec.style.display="none";

  renderFreeze();
  renderWeighPill();

  $("planList").innerHTML=planHtml(day);
}
/* A superset reads as 1A, 1B: the letters are the order you alternate in. */
function planHtml(day){
  return planRows(day).map(r=>"<li><span class='n'>"+r.tag+"</span><span class='nm'>"+M[r.m].name+
    (r.how?"<small>"+r.how+"</small>":"")+"</span><span class='s'>"+r.rounds+" × "+r.reps+(r.rest?" · "+r.rest+"s":"")+"</span></li>").join("");
}
const dayMoves=day=>[...new Set(day.blocks.flatMap(b=>b.items.map(it=>it.m)))];

/* ---------------------------------------------------------------- routine */
function renderRoutine(){
  const order=[1,2,3,4,5,6,0];
  $("routineList").innerHTML=order.map(dk=>{
    const d=WEEK[dk];
    const cues=dayMoves(d).map(m=>"<p><b>"+M[m].short+".</b> "+M[m].cue+"</p>").join("");
    return "<div class='card'><h3>"+DOW[dk]+" · "+d.name+"</h3><ul class='plan'>"+planHtml(d)+"</ul>"+
      "<details class='cue'><summary>How to</summary><div class='body'>"+cues+"</div></details></div>";
  }).join("");
}

/* ----------------------------------------------------------------- freeze */
function renderFreeze(){
  const left=freezesLeft(), today=todayISO(), frozen=!!FREEZES[today],
        trained=qualifies(SESSIONS[today]), btn=$("freezeBtn"), note=$("freezeNote"),
        /* The snowflake is markup inside the button, so the label is its own
           element. Writing to the button would delete the icon. */
        lbl=$("freezeLbl");
  note.textContent=(left?left+(left===1?" freeze":" freezes"):"No freeze")+" left this week · resets Monday";
  if(frozen){
    btn.style.display="flex";lbl.textContent="Today is frozen · undo";
    btn.classList.add("on");btn.disabled=false;
  }else if(trained){
    btn.style.display="none";
  }else{
    btn.style.display="flex";lbl.textContent=left?"Freeze today":"No freeze left";
    btn.classList.remove("on");btn.disabled=!left;
  }
}
async function toggleFreeze(){
  const today=todayISO();
  if(FREEZES[today]){
    delete FREEZES[today];await del("freezes",today);
    toast("Freeze returned");
  }else{
    if(!freezesLeft())return;
    await spendFreeze(today,false);
    toast("Today is frozen. Tomorrow is "+WEEK[(appNow().getDay()+1)%7].name+".");
  }
  META.lastStreak=computeStreak();await put("meta",META);
  renderToday();renderHistory();renderStats();
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
    const future=new Date(y,mo,d)>appNow();
    let cls="c";
    if(s&&s.complete)cls+=" done"; else if(qualifies(s))cls+=" part";
    else if(FREEZES[key])cls+=" frz";
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
    const n=setCount(s.sets);
    return "<div class='stat' data-edit='"+s.date+"' style='cursor:pointer'><span>"+
      dt.toLocaleDateString(undefined,{month:"short",day:"numeric"})+
      " · "+WEEK[s.dayKey].name+"<br><span class='muted'>"+n+(n===1?" set · ":" sets · ")+t+"</span></span>"+
      "<span class='v mono'>"+(s.actualSec?fmt(s.actualSec):"")+"</span></div>";
  }).join(""):"<p class='muted'>Nothing yet.</p>";
  document.querySelectorAll("[data-edit]").forEach(el=>{
    if(el._wired)return; el._wired=1;
    el.addEventListener("click",()=>openEditor(el.dataset.edit));
  });
}

/* ------------------------------------------------------------------ stats */
/* What people come back to in a progress screen is proof they kept at it:
   totals that only grow, weeks held, last month in a few facts. Analysis is
   kept to charts that answer one question at a glance. Records were dropped:
   with fixed bells the load never moves, so a record is one lucky day. */
const WEEK_OK=4, CAL_WEEKS=5, REPS_SHOWN=4;
const MILES=[100,250,500,750,1000,1500,2000,2500,3000,4000,5000,7500,10000];
const nextMile=t=>MILES.find(x=>x>t)||Math.ceil((t+1)/5000)*5000;
const prevMile=t=>[0,...MILES].filter(x=>x<=t).pop();
const dOf=k=>new Date(k+"T12:00:00");
const addD=(k,n)=>{const d=dOf(k);d.setDate(d.getDate()+n);return iso(d);};
const gapD=(a,b)=>Math.round((dOf(b)-dOf(a))/864e5);
const fmtD=k=>dOf(k).toLocaleDateString("en-CA",{month:"short",day:"numeric"});
const monthOf=(k,len)=>dOf(k).toLocaleDateString("en-CA",{month:len||"long"});
const hmin=sec=>{const m=Math.round(sec/60);return m>=60?Math.floor(m/60)+"h"+String(m%60).padStart(2,"0"):m+" min";};
const nth=n=>n+(n%100>=11&&n%100<=13?"th":["th","st","nd","rd"][n%10]||"th");
const repsIn=(ss,m)=>ss.reduce((a,s)=>a+(s.sets||[]).filter(x=>!m||x.m===m).reduce((b,x)=>b+(x.reps||0),0),0);
const secsIn=ss=>ss.reduce((a,s)=>a+(s.actualSec||0),0);
const DAYS_PL=["Sundays","Mondays","Tuesdays","Wednesdays","Thursdays","Fridays","Saturdays"];
const SVG_FONT='font-family="Geist, system-ui, sans-serif"';
let HOURS=new Array(24).fill(0);

function renderStats(){
  const S=Object.values(SESSIONS).filter(qualifies).sort((a,b)=>a.date.localeCompare(b.date));
  const today=todayISO(), any=S.length>0;
  ["pgWeeks","pgHourCard","pgLenCard","pgRepsCard"].forEach(id=>$(id).hidden=!any);
  if(!any){
    $("pgSay").textContent="Your first session starts the count.";
    $("pgLife").innerHTML="";$("pgRecap").hidden=true;$("pgCmpCard").hidden=true;
  }else{
    statsHead(S,today);statsRecap(S,today);statsWeeks(S,today);statsMonth(S,today);
    statsHours(S);statsLength(S);statsReps(S);
  }
  statsWeight();
}

/* Weeks start Monday. A held day is trained or frozen, same as the streak. */
function statsWeekList(S,today){
  const out=[];
  for(let w=weekOf(S[0].date);w<=weekOf(today);w=addD(w,7))
    out.push({w,n:[0,1,2,3,4,5,6].filter(i=>held(addD(w,i))).length,live:w===weekOf(today)});
  let best=0,run=0;
  out.forEach((k,i)=>{
    if(k.n>=WEEK_OK){run++;best=Math.max(best,run);}
    else if(!k.live&&i>0)run=0;   /* the first, partial week and the live one never break it */
  });
  return {weeks:out,cur:run,best};
}

/* One sentence on what changed lately, and the totals that only grow. */
function statsHead(S,today){
  let back=null;
  for(let i=1;i<S.length;i++)if(gapD(S[i-1].date,S[i].date)>=7)back={from:S[i].date,off:gapD(S[i-1].date,S[i].date)-1};
  const {cur}=statsWeekList(S,today);
  let line;
  if(back&&gapD(back.from,today)<=28){const n=S.filter(s=>s.date>=back.from).length;
    line="Back at it: <em>"+n+" session"+(n===1?"":"s")+"</em> since "+fmtD(back.from)+", after "+back.off+" days off.";}
  else if(cur>=2)line="<em>"+cur+" weeks in a row</em> at "+WEEK_OK+"+ days.";
  else{const n=S.filter(s=>s.date>addD(today,-30)).length;line="<em>"+n+" session"+(n===1?"":"s")+"</em> in the last 30 days.";}
  $("pgSay").innerHTML=line;
  $("pgLife").innerHTML="<div><b>"+S.length+"</b><span>sessions</span></div><div><b>"+hmin(secsIn(S))+"</b><span>trained</span></div><div><b>"+repsIn(S).toLocaleString("en-CA")+"</b><span>reps</span></div>";
}

/* A month in a few facts: the card worth a screenshot. It opens on this month,
   and the arrows (or a swipe) walk back one month at a time, as far as the
   month of your first session. */
let RECAP_BACK=0;
function statsRecap(S,today){
  const first=dOf(S[0].date),now=dOf(today);
  const maxBack=(now.getFullYear()-first.getFullYear())*12+now.getMonth()-first.getMonth();
  RECAP_BACK=Math.min(Math.max(0,RECAP_BACK),maxBack);
  const d0=dOf(today);d0.setDate(1);d0.setMonth(d0.getMonth()-RECAP_BACK);const ym=iso(d0).slice(0,7);
  const MS=S.filter(s=>s.date.startsWith(ym));
  const firstMonth=RECAP_BACK===maxBack&&maxBack>0;
  const kick=(RECAP_BACK===0?"This month":RECAP_BACK===1?"Last month":RECAP_BACK+" months ago")+(firstMonth?" · your first":"");
  const head="<div class='rhead'><div aria-live='polite'><span class='kick'>"+kick+"</span><h2>"+monthOf(ym+"-15")+(d0.getFullYear()!==now.getFullYear()?" "+d0.getFullYear():"")+"</h2></div>"+
    "<button class='rnav' data-mo='1' aria-label='"+(RECAP_BACK>=maxBack?"No earlier sessions":"Previous month")+"'"+(RECAP_BACK>=maxBack?" disabled":"")+">‹</button>"+
    "<button class='rnav' data-mo='-1' aria-label='Next month'"+(RECAP_BACK===0?" disabled":"")+">›</button></div>";
  $("pgRecap").hidden=false;
  let longest=0,r=0,prev=null;
  MS.forEach(s=>{r=prev&&gapD(prev,s.date)===1?r+1:1;longest=Math.max(longest,r);prev=s.date;});
  const dow=[0,0,0,0,0,0,0];MS.forEach(s=>dow[dOf(s.date).getDay()]++);
  const hrs=new Array(24).fill(0);MS.forEach(s=>{if(s.startedAt)hrs[new Date(s.startedAt).getHours()]++;});
  const per={};MS.forEach(s=>(s.sets||[]).forEach(x=>{if(M[x.m])per[x.m]=(per[x.m]||0)+(x.reps||0);}));
  const top=Object.entries(per).sort((a,b)=>b[1]-a[1])[0];
  /* Every month shows the same grid, a dash where there is nothing to say, so
     stepping through months never makes the page below jump. */
  $("pgRecap").innerHTML=head+"<div class='facts'>"+
    "<div><span>Sessions</span><b>"+MS.length+"</b></div>"+
    "<div><span>Trained</span><b>"+(MS.length?hmin(secsIn(MS)):"–")+"</b></div>"+
    "<div><span>Reps</span><b>"+repsIn(MS).toLocaleString("en-CA")+"</b></div>"+
    "<div><span>Longest run</span><b>"+(longest?longest+(longest===1?" day":" days"):"–")+"</b></div>"+
    "<div><span>Usual start</span><b>"+(hrs.some(Boolean)?hrs.indexOf(Math.max(...hrs))+":00":"–")+"</b></div>"+
    "<div><span>Most loyal</span><b>"+(MS.length?DAYS_PL[dow.indexOf(Math.max(...dow))]:"–")+"</b></div>"+
    "<div class='wide'><span>Most reps</span><b>"+(top?top[1].toLocaleString("en-CA")+" · "+(M[top[0]].short||M[top[0]].name):"–")+"</b></div>"+
    "</div>";
}
/* Only the card re-renders, so a button keeps the focus it had. The new month
   slides in from the side it came from, unless reduced motion is on. */
function recapStep(n,fromKey){
  const S=Object.values(SESSIONS).filter(qualifies).sort((a,b)=>a.date.localeCompare(b.date));
  RECAP_BACK+=n;statsRecap(S,todayISO());
  const card=$("pgRecap");
  card.classList.remove("in-l","in-r");void card.offsetWidth;card.classList.add(n>0?"in-l":"in-r");
  if(fromKey){const b=card.querySelector("[data-mo='"+n+"']"),o=card.querySelector("[data-mo='"+(-n)+"']");(b.disabled?o:b).focus();}
}
$("pgRecap").addEventListener("click",e=>{const b=e.target.closest("[data-mo]");if(b&&!b.disabled)recapStep(+b.dataset.mo,true);});
/* Swipe right for the month before, left to come back, like turning pages.
   The card follows the finger a little so the gesture shows it was heard. */
let swipe=null;
$("pgRecap").addEventListener("pointerdown",e=>{if(e.target.closest("[data-mo]"))return;swipe={x:e.clientX,y:e.clientY};});
$("pgRecap").addEventListener("pointermove",e=>{
  if(!swipe)return;const dx=e.clientX-swipe.x;
  if(Math.abs(dx)>8)$("pgRecap").style.transform="translateX("+Math.max(-40,Math.min(40,dx*.35))+"px)";
});
function swipeEnd(e){
  if(!swipe)return;const dx=e.clientX-swipe.x,dy=e.clientY-swipe.y;swipe=null;
  $("pgRecap").style.transform="";
  if(e.type!=="pointerup"||Math.abs(dx)<50||Math.abs(dx)<Math.abs(dy)*1.5)return;
  const b=$("pgRecap").querySelector("[data-mo='"+(dx>0?1:-1)+"']");
  if(b&&!b.disabled)recapStep(dx>0?1:-1,false);
}
$("pgRecap").addEventListener("pointerup",swipeEnd);
$("pgRecap").addEventListener("pointercancel",swipeEnd);
$("pgRecap").addEventListener("pointerleave",swipeEnd);

/* The last few weeks, day by day, and how many weeks in a row held. */
function statsWeeks(S,today){
  const {weeks,cur,best}=statsWeekList(S,today);
  $("pgStreak").innerHTML="<b>"+cur+"</b> in a row · best <b>"+best+"</b>";
  let h="MTWTFSS".split("").map(c=>"<span class='h'>"+c+"</span>").join("")+"<span></span>";
  weeks.slice(-CAL_WEEKS).forEach(k=>{
    for(let i=0;i<7;i++){
      const d=addD(k.w,i),s=SESSIONS[d],on=qualifies(s),frz=!on&&!!FREEZES[d];
      const cls=d>today?"fut":on?"on":frz?"frz":"";
      const at=on&&s.startedAt?new Date(s.startedAt).toLocaleTimeString("en-CA",{hour:"2-digit",minute:"2-digit",hour12:false})+" · ":"";
      const tip=on?fmtD(d)+" · "+at+fmt(s.actualSec||0)+" · "+repsIn([s])+" reps":fmtD(d)+" · "+(d>today?"ahead":frz?"frozen":"no session");
      h+="<button class='d "+cls+(d===today?" today":"")+"' data-read='ro-cal' data-tip='"+tip+"' aria-label='"+tip+"'>"+dOf(d).getDate()+"</button>";
    }
    h+="<span class='n"+(k.n>=WEEK_OK?" ok":"")+"'>"+(k.live&&!k.n?"":k.n)+"</span>";
  });
  $("pgCal").innerHTML=h;
}

/* This month against last month, as a running count of sessions. */
function statsMonth(S,today){
  const thisM=today.slice(0,7),d0=dOf(today);d0.setDate(1);d0.setMonth(d0.getMonth()-1);
  const lastM=iso(d0).slice(0,7),dom=+today.slice(8);
  const has=new Set(S.map(s=>s.date));
  const run=(ym,upto)=>{let c=0;const out=[[0,0]];for(let i=1;i<=upto;i++){if(has.has(ym+"-"+String(i).padStart(2,"0")))c++;out.push([i,c]);}return out;};
  const lastLen=new Date(+lastM.slice(0,4),+lastM.slice(5),0).getDate();
  const A=run(thisM,dom),B=run(lastM,lastLen);
  const a=A[A.length-1][1],b=B[B.length-1][1],bAt=B[Math.min(dom,lastLen)][1];
  $("pgCmpCard").hidden=!a&&!b;if(!a&&!b)return;
  const w=388,h=96,padR=58,mx=Math.max(4,a,b);
  const X=i=>i/31*(w-padR),Y=v=>h-4-v/mx*(h-12),path=p=>p.map(([i,v])=>X(i)+","+Y(v)).join(" ");
  const lastName=monthOf(lastM+"-15");
  $("pgCmpH").textContent=monthOf(today)+" vs "+lastName;
  $("pgCmpLead").innerHTML="<b>"+a+"</b> session"+(a===1?"":"s")+" so far. "+lastName+" had <b>"+bAt+"</b> by the "+nth(dom)+".";
  $("pgCmp").innerHTML="<svg viewBox='0 0 "+w+" "+h+"' role='img' aria-label='Sessions: "+a+" this month, "+bAt+" last month by the same day'>"+
    "<line x1='"+X(dom)+"' x2='"+X(dom)+"' y1='0' y2='"+h+"' stroke='rgba(255,255,255,.12)' stroke-dasharray='3 3'/>"+
    "<polyline points='"+path(B)+"' fill='none' stroke='var(--dim)' stroke-width='2' stroke-linejoin='round' opacity='.7'/>"+
    "<polyline points='"+path(A)+"' fill='none' stroke='var(--acc)' stroke-width='2.5' stroke-linejoin='round'/>"+
    "<circle cx='"+X(dom)+"' cy='"+Y(a)+"' r='4' fill='var(--acc)' stroke='#121315' stroke-width='2'/>"+
    "<text x='"+(X(lastLen)+8)+"' y='"+(Y(b)+4)+"' font-size='12' fill='#8A8F95' "+SVG_FONT+">"+monthOf(lastM+"-15","short")+" "+b+"</text>"+
    "<text x='"+(X(dom)+8)+"' y='"+(Y(a)+4)+"' font-size='12' fill='#FF8A4C' "+SVG_FONT+">"+monthOf(today,"short")+" "+a+"</text></svg>";
}

/* 24 hours on one strip, brighter where you start more often. */
function statsHours(S){
  HOURS=new Array(24).fill(0);S.forEach(s=>{if(s.startedAt)HOURS[new Date(s.startedAt).getHours()]++;});
  const mx=Math.max(1,...HOURS);
  $("pgHours").innerHTML=HOURS.map(v=>"<i style='background:rgba(255,138,76,"+(v?.15+.85*v/mx:.05)+")'></i>").join("");
  $("pgHours").setAttribute("aria-label","Sessions by start hour: "+HOURS.map((v,i)=>v?i+":00 "+v:"").filter(Boolean).join(", "));
  $("pgHax").innerHTML=[0,6,12,18,24].map(h=>"<span style='left:"+(h/24*100)+"%;"+(h===0?"transform:none":h===24?"transform:translateX(-100%)":"")+"'>"+h+":00</span>").join("");
  /* Two habits, not one hour: name the two biggest parts of the day. */
  const parts=[["mornings",5,12],["afternoons",12,17],["evenings",17,24],["nights",0,5]]
    .map(([n,a,b])=>({n,v:HOURS.slice(a,b).reduce((x,y)=>x+y,0)})).sort((x,y)=>y.v-x.v);
  $("pgHourLead").innerHTML=parts.slice(0,2).filter(p=>p.v).map(p=>"<b>"+p.v+"</b> "+p.n).join(" · ");
}
/* The whole strip is one target: a tap picks the nearest hour, so thin cells never miss. */
$("pgHours").addEventListener("pointerdown",e=>{
  const r=$("pgHours").getBoundingClientRect(),i=Math.min(23,Math.max(0,Math.floor((e.clientX-r.left)/r.width*24)));
  const ro=$("ro-h");ro.textContent=i+":00–"+(i+1)+":00 · "+HOURS[i]+" session"+(HOURS[i]===1?"":"s");ro.classList.add("on");
});

/* Session length by weekday, against the average of the weekday averages,
   so a day you train more often does not weigh more. */
function statsLength(S){
  const ls=S.filter(s=>s.actualSec),order=[1,2,3,4,5,6,0],lbl=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  if(!ls.length){$("pgLenCard").hidden=true;return;}
  const by=order.map(dk=>{const xs=ls.filter(s=>dOf(s.date).getDay()===dk);return {dk,n:xs.length,avg:xs.length?secsIn(xs)/xs.length:0};});
  const mx=Math.max(...by.map(b=>b.avg)),days=by.filter(b=>b.n),avg=days.reduce((a,b)=>a+b.avg,0)/days.length;
  $("pgLenLead").innerHTML="<i class='avgk'></i><b>"+fmt(avg)+"</b> average";
  $("pgLen").innerHTML=by.map(b=>"<button data-read='ro-len' data-tip='"+DAYS_PL[b.dk]+" · "+(b.n?fmt(b.avg)+" average over "+b.n+" session"+(b.n===1?"":"s"):"no session yet")+"'>"+
    "<i style='height:"+(b.avg/mx*62)+"px'><em>"+(b.n?Math.round(b.avg/60)+"m":"")+"</em></i><span>"+lbl[b.dk]+"</span></button>").join("")+
    "<div class='avgl' style='bottom:"+(20+avg/mx*62)+"px' aria-hidden='true'></div>";
}

/* Bodyweight as a smoothed trend. Each weigh-in pulls the trend 10% of the way
   per day elapsed (the Hacker's Diet method), so one salty dinner barely shows. */
function statsWeight(){
  const W=WEIGHTS.slice().sort((a,b)=>a.date.localeCompare(b.date));
  $("wtExp").hidden=!W.length;
  if(!W.length){$("pgBw").innerHTML="<p class='muted'>Weigh in from the home screen and your trend shows up here.</p>";$("pgBwLead").textContent="";$("ro-bw").textContent="";return;}
  const tr=[];W.forEach((p,i)=>{if(!i){tr.push(p.w);return;}const k=1-Math.pow(.9,Math.max(1,gapD(W[i-1].date,p.date)));tr.push(tr[i-1]+k*(p.w-tr[i-1]));});
  const w=388,h=104,pl=30,pad=10,t0=dOf(W[0].date).getTime(),t1=dOf(W[W.length-1].date).getTime();
  const lo=Math.floor(Math.min(...W.map(x=>x.w))),hi=Math.ceil(Math.max(...W.map(x=>x.w)));
  const X=d=>pl+(dOf(d).getTime()-t0)/Math.max(1,t1-t0)*(w-pl-pad),Y=v=>h-pad-(v-lo)/Math.max(1,hi-lo)*(h-2*pad);
  const pts=W.map((p,i)=>[X(p.date),Y(tr[i]),p.date]);
  /* More than a week between weigh-ins: a dashed bridge instead of a curve. */
  const segs=[[pts[0]]];for(let i=1;i<pts.length;i++){if(gapD(pts[i-1][2],pts[i][2])>7)segs.push([]);segs[segs.length-1].push(pts[i]);}
  const curves=segs.filter(s=>s.length>1).map(s=>"<path d='"+monoPath(s)+"' fill='none' stroke='var(--acc)' stroke-width='2.5' stroke-linecap='round'/>").join("");
  const bridges=segs.slice(1).map((s,i)=>{const a=segs[i][segs[i].length-1],b=s[0];
    return "<line x1='"+a[0]+"' y1='"+a[1]+"' x2='"+b[0]+"' y2='"+b[1]+"' stroke='var(--acc)' stroke-width='2' stroke-dasharray='2 5' stroke-linecap='round' opacity='.55'/>";}).join("");
  let grid="";const step=hi-lo>8?2:1;
  for(let v=lo;v<=hi;v+=step)grid+="<line x1='"+pl+"' x2='"+w+"' y1='"+Y(v)+"' y2='"+Y(v)+"' stroke='rgba(255,255,255,.06)'/><text x='0' y='"+(Y(v)+4)+"' font-size='12' fill='#8A8F95' "+SVG_FONT+">"+v+"</text>";
  const mean=W.reduce((a,p)=>a+p.w,0)/W.length;
  const avgLine="<line x1='"+pl+"' x2='"+w+"' y1='"+Y(mean)+"' y2='"+Y(mean)+"' stroke='var(--pale)' stroke-width='1.5' stroke-dasharray='4 4' opacity='.55'/>"+
    "<text x='"+(pl+(w-pl)*.68)+"' y='"+(Y(mean)-6)+"' text-anchor='middle' font-size='12' fill='#8A8F95' "+SVG_FONT+">avg "+mean.toFixed(1)+"</text>";
  const dots=W.map(p=>"<circle cx='"+X(p.date)+"' cy='"+Y(p.w)+"' r='3' fill='var(--pale)' opacity='.45'/>"+
    "<circle cx='"+X(p.date)+"' cy='"+Y(p.w)+"' r='16' fill='transparent' data-read='ro-bw' data-tip='"+fmtD(p.date)+" · "+p.w+" lb'/>").join("");
  $("pgBw").innerHTML="<svg viewBox='0 0 "+w+" "+h+"' role='img' aria-label='Bodyweight trend, average "+mean.toFixed(1)+" lb'>"+grid+avgLine+bridges+curves+dots+"</svg>"+
    "<div class='hax'><span style='left:"+(pl/w*100)+"%;transform:none'>"+fmtD(W[0].date)+"</span><span style='right:0;transform:none'>"+fmtD(W[W.length-1].date)+"</span></div>";
  /* The first trend point is one weigh-in, too noisy to compare against. */
  const start=W.slice(0,3).reduce((a,p)=>a+p.w,0)/Math.min(3,W.length),dd=tr[tr.length-1]-start;
  $("pgBwLead").innerHTML="<b>"+tr[tr.length-1].toFixed(1)+"</b> lb"+(W.length>1?" · "+(Math.abs(dd)<.2?"level":(dd>0?"+":"−")+Math.abs(dd).toFixed(1)):"");
  $("ro-bw").textContent="Tap a dot.";$("ro-bw").classList.remove("on");
}
/* Monotone cubic through the points: smooth, and never overshoots between two weigh-ins. */
function monoPath(p){
  const n=p.length,dx=[],m=[],t=[];
  for(let i=0;i<n-1;i++){dx[i]=p[i+1][0]-p[i][0];m[i]=(p[i+1][1]-p[i][1])/dx[i];}
  t[0]=m[0];t[n-1]=m[n-2];
  for(let i=1;i<n-1;i++)t[i]=m[i-1]*m[i]<=0?0:3*(dx[i-1]+dx[i])/((2*dx[i]+dx[i-1])/m[i-1]+(dx[i]+2*dx[i-1])/m[i]);
  let d="M"+p[0][0]+","+p[0][1];
  for(let i=0;i<n-1;i++)d+="C"+(p[i][0]+dx[i]/3)+","+(p[i][1]+t[i]*dx[i]/3)+" "+(p[i+1][0]-dx[i]/3)+","+(p[i+1][1]-t[i+1]*dx[i]/3)+" "+p[i+1][0]+","+p[i+1][1];
  return d;
}

/* Lifetime reps per movement in this week's routine, the next round number,
   and reps per set then against now. Fixed bells make reps the only dial. */
function statsReps(S){
  const moves=[...new Set(Object.values(WEEK).flatMap(d=>d.blocks.flatMap(b=>(b.items||[b]).map(i=>i.m))))].filter(m=>M[m]);
  const rows=moves.map(m=>{
    const hist=S.filter(s=>(s.sets||[]).some(x=>x.m===m&&x.reps>0));
    const perSet=ss=>{const v=ss.flatMap(s=>s.sets.filter(x=>x.m===m&&x.reps>0).map(x=>x.reps));return v.reduce((a,x)=>a+x,0)/v.length;};
    return {m,t:repsIn(S,m),n:hist.length,then:hist.length>=6?perSet(hist.slice(0,3)):null,now:hist.length>=6?perSet(hist.slice(-3)):null};
  }).sort((a,b)=>b.t-a.t);
  $("pgReps").innerHTML=rows.map((r,i)=>{
    const lo=prevMile(r.t),hi=nextMile(r.t),unit=M[r.m].hold?(M[r.m].lo>=10?"sec":"holds"):"reps";
    const trend=r.then!==null?"<b>"+r.then.toFixed(1)+" → "+r.now.toFixed(1)+"</b> per set":r.t?r.n+" session"+(r.n===1?"":"s")+" so far":"starts this week";
    return "<div class='ex"+(i>=REPS_SHOWN?" more":"")+"'><span class='nm'>"+(M[r.m].short||M[r.m].name)+"</span><span class='tot'>"+r.t.toLocaleString("en-CA")+"<small>"+unit+"</small></span>"+
      "<div class='bar'><i style='width:"+((r.t-lo)/(hi-lo)*100)+"%'></i></div>"+
      "<div class='meta'><span>"+trend+"</span><span>"+(hi-r.t)+" to "+hi.toLocaleString("en-CA")+"</span></div></div>";
  }).join("");
  const btn=$("pgShowAll"),open=$("pgReps").classList.contains("open");
  btn.hidden=rows.length<=REPS_SHOWN;
  btn.textContent=open?"Show less":"Show all "+rows.length;
}
$("pgShowAll").addEventListener("click",()=>{
  const open=$("pgReps").classList.toggle("open");
  $("pgShowAll").setAttribute("aria-expanded",open);
  $("pgShowAll").textContent=open?"Show less":"Show all "+$("pgReps").children.length;
});
/* Tap a mark: its value goes to its card's readout line. The i opens its note. */
$("p-stats").addEventListener("click",e=>{
  const i=e.target.closest(".i");
  if(i){const open=i.getAttribute("aria-expanded")!=="true";i.setAttribute("aria-expanded",open);$(i.getAttribute("aria-controls")).classList.toggle("on",open);return;}
  const t=e.target.closest("[data-tip]");if(!t)return;
  const ro=$(t.dataset.read);ro.textContent=t.dataset.tip;ro.classList.add("on");
});

/* ---------------------------------------------------------------- session */
let PH=[],idx=0,el=0,holding=false,done=false,dayKey=1,startedAt=0,drift=0,pendingWork=null;
/* PLANNED is the whole day and never shrinks. PH does, because a resume drops
   the sets already logged, and `plannedSec` in the record has to keep meaning
   the length of the session that was planned rather than the part still left. */
let PLANNED=0,CARRY=0;
let logged=[],repVal=0,sound=true,finishing=false,raf=null,cued=0,warned=false,anchor=0;
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
  /* Anything that opens the audio device gets the primer, not just a session.
     The settings test used to skip it and fire its first beep into a speaker
     that had not woken up yet, which is precisely the case it exists to check. */
  if(!prime&&sound)startPrime();
  return actx;
}
/* A sine, on purpose. A filtered square measured louder and was tried on a
   real phone against this, and this one sounded better. Loudness is the volume
   slider's job, which is why it goes to 400%. */
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
/* Five sounds across five seconds: a second of quiet, four identical beeps on
   the beat, then the tone at zero. The ear locks onto a steady interval and
   knows where zero is without counting, so nothing else may change, or the beat
   stops being a beat. The quiet second is not padding. A beep at the five mark
   fired while the speaker was still waking up, and it came out late and clipped
   every time. */
const CUE_AT=[4,3,2,1];
function tick(){tone(880,.075,.5);if(navigator.vibrate)navigator.vibrate(14);}
/* Ten seconds out, a heads-up to get back into position, well clear of the countdown so it never reads as part of the beat. Lower and doubled, so the ear files it as a different sound from the ticks. A rest shorter than ten seconds skips it. */
const WARN_AT=10;
function warn(){tone(660,.09,.5);setTimeout(()=>tone(660,.09,.5),140);if(navigator.vibrate)navigator.vibrate(14);}
/* Thirty cycles a second, held under the whole session. A phone speaker cannot
   move that low, so it is silence to your ear and real signal to the phone,
   which powers the output stage down after silence and takes about a seventh of
   a second to bring it back. Whatever plays first into a cold output loses its
   front edge, and that was the first beep of every countdown. Digital silence
   does not hold the stage open, which is why a muted warm up note did nothing. */
let prime=null;
function startPrime(){
  if(prime||!actx)return;
  try{
    const o=actx.createOscillator(),g=actx.createGain();
    o.type="sine";o.frequency.value=30;g.gain.value=.012;
    o.connect(g);g.connect(actx.destination);o.start();
    prime=o;
  }catch(e){}
}
function stopPrime(){try{prime&&prime.stop();}catch(e){}prime=null;}
function goTone(){tone(1320,.22,.77);if(navigator.vibrate)navigator.vibrate([26,50,26]);}

/* Hold the screen awake while a session runs. Android takes the lock back on
   its own whenever the app leaves the foreground, so it is asked for again
   every time the app returns. */
let wake=null;
async function keepAwake(){
  if(!("wakeLock" in navigator)||wake)return;
  try{wake=await navigator.wakeLock.request("screen");
    wake.addEventListener("release",()=>{wake=null;});}catch(e){}
}
function dropAwake(){try{wake&&wake.release();}catch(e){}wake=null;}
addEventListener("visibilitychange",()=>{
  if(!document.hidden&&$("sess").classList.contains("on")&&!done)keepAwake();
});
/* Five seconds between the tap and the first rep. Landing straight into set one
   with the clock already running meant setting up while losing time, so the
   first rep of every session was the rushed one. It doubles as the moment the
   browser lets us open the audio device, since it runs inside the tap. */
const LEAD=5;
function startSession(){
  if(sound){try{audio();}catch(e){}}
  dayKey=appNow().getDay();
  /* Stamp day one before the phases are built, or the very first session is the
     one session the on-ramp never applies to. */
  if(!META.firstDay){META.firstDay=todayISO();put("meta",META);}
  PH=buildPhases(dayKey,onRamp());
  PLANNED=LEAD+PH.reduce((a,p)=>a+p.dur,0);
  const existing=SESSIONS[todayISO()];
  logged=existing&&!existing.complete?existing.sets.slice():[];
  CARRY=existing&&!existing.complete?(existing.activeSec||0):0;
  /* Resume picks up at the first set that was never logged. Restarting the day
     from set one and tapping back through the work already done was the whole
     reason pausing was not worth it. A movement done one side at a time writes
     a row per side, so rows are matched on movement and set, never counted. */
  if(logged.length){
    const had=new Set(logged.map(r=>r.m+"#"+r.set));
    let cut=0;
    while(cut<PH.length&&PH[cut].type==="work"&&had.has(PH[cut].m+"#"+PH[cut].set)){
      cut++;
      if(PH[cut]&&PH[cut].type==="rest")cut++;
    }
    if(cut>0&&cut<PH.length)PH=PH.slice(cut);
  }
  PH.unshift(Object.assign({},PH[0],{type:"rest",lead:true,dur:LEAD}));
  idx=0;el=0;holding=false;done=false;finishing=false;drift=0;pendingWork=null;cued=0;warned=false;
  anchor=Date.now();
  startedAt=existing&&existing.startedAt?existing.startedAt:Date.now();
  $("sStreak").textContent=computeStreak();
  $("doneview").classList.remove("on");
  $("log").classList.remove("on");
  $("sess").classList.add("on");
  sizeRing();render();keepAwake();
  if(!raf)raf=requestAnimationFrame(loop);
}
function plannedTotal(){return PH.reduce((a,p)=>a+p.dur,0);}
/* Seconds actually worked, with any pause left out of them. Phases already past
   count at their planned length and `drift` carries how far off each one ran,
   which is the same arithmetic finish() has always used to report the total. */
function activeSoFar(){
  let a=0;for(let i=0;i<idx;i++)a+=PH[i].dur;
  return CARRY+a+Math.max(0,el)+drift;
}
function remaining(){let r=Math.max(0,PH[idx].dur-el);for(let i=idx+1;i<PH.length;i++)r+=PH[i].dur;return r;}
/* In a superset the count is rounds: one round is one set of each movement. */
const setLbl=p=>p.sets>1?(p.pair>1?"Round ":"Set ")+p.set+" of "+p.sets:"Single set";
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
  $("phaseLbl").textContent=work?"Working"
    :(p.lead?"Get ready":(holding?"Resting · set not logged":"Resting"));
  const ct=over?("+"+upn(-left)):cdn(left);
  $("clock").textContent=ct;
  $("clock").className="big mono"+(over?" over":"")+(ct.length>=5?" wide":"");
  const show=work?p:(nextW||p),sm=M[show.m];
  $("exName").textContent=work?m.name:(nextW?sm.name:"Session ends");
  setPips(show.sets,show.set);
  $("setNow").textContent=show.sets>1?setLbl(show):"";
  $("target").innerHTML="<b>"+show.reps+"</b>"+(sm.side?" "+sm.side:(sm.hold?"":" reps"))+" · <b>"+sm.load+"</b>"+(show.how?" · "+show.how:"");
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
    :(p.lead?"Tap anywhere to start now · ends "
    :(green?(work?"Tap anywhere when the set is done · ends ":"Tap anywhere to start early · ends "):"Ends "));
  const prog=Math.min(1,Math.max(0,el/p.dur));
  bar.style.strokeDashoffset=over?0:RLEN*prog;
  ring.classList.toggle("over",!!over);
  $("logRest").textContent=cdn(Math.max(0,PH[idx].dur-el));
}
function endWork(){
  const p=PH[idx],delta=el-p.dur;
  p.actual=el;drift+=delta;flashDelta(delta);
  pendingWork={m:p.m,set:p.set,sets:p.sets,pair:p.pair,def:p.def,rir:p.rir};
  idx++;el=0;anchor=Date.now();
  if(idx>=PH.length){finishing=true;openLog();tone(520,.14,.66);return;}
  holding=true;openLog();tone(520,.14,.66);render();
}
function endRest(){
  const p=PH[idx];p.actual=el;drift+=(el-p.dur);
  /* Whatever the rest ran over belongs to the set after it. Without the carry,
     a phone that slept through the end of a rest would wake up and hand back a
     whole fresh rest that has already been taken. */
  const carry=Math.max(0,el-p.dur);
  idx++;el=0;cued=0;warned=false;anchor=Date.now()-carry*1000;
  if(idx>=PH.length){finish();return;}
  goTone();render();
}
/* Seed the counter with what you did last time, not a static default. Skips
   today, which is already in SESSIONS as the session writes itself. */
function lastReps(mKey,set,side){
  const prev=setsFor(mKey).filter(r=>r.date!==todayISO())[0];
  if(!prev)return null;
  const mine=side?prev.sets.filter(x=>x.side===side):prev.sets;
  const pool=mine.length?mine:prev.sets;
  const exact=pool.find(x=>x.set===set);
  return (exact||pool[pool.length-1]).reps;
}
/* A movement done one side at a time gets one number per side. Your arms are
   not the same arm: the first press session logged 6, 4 and 4 across three sets
   on each side, and nothing in the log could say which side gave out. */
const SIDES=[{k:"R",lbl:"Right"},{k:"L",lbl:"Left"}];
let sideVal=null;
/* Three answers instead of five. People miss their reps left by about one, more
   so far from failure and past twelve reps, so 3 against 4, and 1 against 2,
   were noise. The stored number keeps the old scale's meaning: 0 failed, 2 is
   the 1–2 target, 3 is three or more. Holds have no reps to leave, so they only
   ask to be saved. */
const EFFORT=[{v:0,t:"Failed",s:"0 left"},{v:2,t:"On target",s:"1–2 left"},{v:3,t:"Easy",s:"3+ left"}];
const EFFORT_TARGET=2;
const effortName=v=>v===1?"1 left":v===4?"4+ left":(EFFORT.find(e=>e.v===v)||{t:"–"}).t;
function effortOptions(cur){
  const vals=EFFORT.map(e=>e.v);
  if(typeof cur==="number"&&!vals.includes(cur))vals.push(cur);
  return vals.sort((a,b)=>a-b).map(v=>"<option value='"+v+"'"+(cur===v?" selected":"")+">"+effortName(v)+"</option>").join("");
}
function fillEffort(host,target,onPick){
  host.innerHTML="";host.classList.toggle("one",!target);
  if(!target){
    const b=document.createElement("button");b.innerHTML="<b>Save</b>";
    b.addEventListener("click",()=>onPick(null));host.appendChild(b);return;
  }
  const want=target[0]>=3?3:EFFORT_TARGET;
  EFFORT.forEach(e=>{
    const b=document.createElement("button");
    b.innerHTML="<b>"+e.t+"</b><small>"+e.s+"</small>";
    if(e.v===want)b.classList.add("tgt");
    b.addEventListener("click",()=>onPick(e.v));
    host.appendChild(b);
  });
}
function openLog(){
  const m=M[pendingWork.m], per=!!m.side;
  $("logName").textContent=m.name;
  $("logSet").textContent=setLbl(pendingWork);
  $("prTag").classList.remove("on");
  $("logOne").style.display=per?"none":"flex";
  $("logTwo").style.display=per?"flex":"none";
  if(per)openSides(m);else openSingle(m);
  $("log").classList.add("on");$("log").setAttribute("aria-hidden","false");
}
function openSingle(m){
  repVal=lastReps(pendingWork.m,pendingWork.set)||pendingWork.def||m.def;
  $("repVal").textContent=repVal;
  $("repUnit").textContent=m.hold?"seconds":"reps";
  $("rirLbl").textContent=pendingWork.rir?"How hard was it":"Hold done";
  fillEffort($("rir"),pendingWork.rir,commitLog);
  updatePrTag(prFor(pendingWork.m));
}
function openSides(m){
  const unit=m.hold?"seconds":"reps", cap=m.hold?600:60, host=$("logTwo");
  sideVal={};host.innerHTML="";
  SIDES.forEach(sd=>{
    const cell={reps:lastReps(pendingWork.m,pendingWork.set,sd.k)||pendingWork.def||m.def};
    sideVal[sd.k]=cell;
    const wrap=document.createElement("div");wrap.className="side";
    wrap.innerHTML="<div class='h'><span>"+sd.lbl+"</span><span>"+unit+"</span></div>"+
      "<div class='cnt'><button aria-label='One fewer'>−</button>"+
      "<div class='v mono'>"+cell.reps+"</div>"+
      "<button aria-label='One more'>+</button></div>";
    const pads=wrap.querySelectorAll(".cnt button"), v=wrap.querySelector(".v");
    const bump=d=>{cell.reps=Math.max(0,Math.min(cap,cell.reps+d));v.textContent=cell.reps;sidePr();};
    pads[0].addEventListener("click",()=>bump(-1));
    pads[1].addEventListener("click",()=>bump(1));
    host.appendChild(wrap);
  });
  /* One answer for both sides. Asking it per side doubled the taps for a
     difference the scale is too coarse to show. */
  const lbl=document.createElement("div");
  lbl.className="rirlbl";lbl.textContent=pendingWork.rir?"How hard was it":"Hold done";
  host.appendChild(lbl);
  const row=document.createElement("div");row.className="rir";
  fillEffort(row,pendingWork.rir,commitSides);
  host.appendChild(row);
  sidePr();
}
function sidePr(){
  const pr=prFor(pendingWork.m);
  $("prTag").classList.toggle("on",!!(pr&&SIDES.some(sd=>sideVal[sd.k].reps>pr.reps)));
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
function commitSides(rir){
  const pr=prFor(pendingWork.m), ts=Date.now();
  const isPr=!!(pr&&SIDES.some(sd=>sideVal[sd.k].reps>pr.reps));
  SIDES.forEach(sd=>logged.push({m:pendingWork.m,set:pendingWork.set,side:sd.k,
    reps:sideVal[sd.k].reps,rir:rir,ts:ts}));
  closeLog(isPr);
}
function commitLog(rir){
  const pr=prFor(pendingWork.m), isPr=!!(pr&&repVal>pr.reps);
  logged.push({m:pendingWork.m,set:pendingWork.set,reps:repVal,rir:rir,ts:Date.now()});
  closeLog(isPr);
}
function closeLog(isPr){
  holding=false;pendingWork=null;sideVal=null;
  $("log").classList.remove("on");$("log").setAttribute("aria-hidden","true");
  tone(isPr?990:880,.12,.66);
  saveSession(false);
  if(finishing){finish();return;}
  render();
}
function finish(){
  done=true;
  const actual=CARRY+plannedTotal()+drift;
  $("doneview").classList.add("on");
  $("doneTime").textContent=fmt(actual);
  saveSession(true,actual);
  const streak=computeStreak();
  $("sStreak").textContent=streak;
  const n=setCount(logged);
  $("doneNote").textContent=n+(n===1?" set logged. ":" sets logged. ")+
    (streak>0?("Day "+streak+" in a row."):"");
  renderRate();
  const f=streak>0?dayFacts(streak):null;
  $("doneMs").textContent=f?f.text:"";
  if(f)showBonus($("doneBonus"),f.bonus);
  else $("doneBonus").style.display="none";
  /* Either line can draw from the pool, so both get marked spent. */
  if(f){
    let touched=false;
    for(const i of [f.mainIndex,f.bonusIndex]){
      if(typeof i==="number"&&!META.poolSeen.includes(i)){META.poolSeen.push(i);touched=true;}
    }
    if(touched){
      if(META.poolSeen.length>=POOL.length)META.poolSeen=[];
      put("meta",META);
    }
  }
}
/* One number for the whole session, given at the end. It carries what a set's
   reps-left cannot: a day where getting to the target took more out of you. */
function renderRate(){
  const host=$("rate"),cur=(SESSIONS[todayISO()]||{}).srpe;
  host.innerHTML="";
  for(let n=1;n<=10;n++){
    const b=document.createElement("button");b.textContent=n;
    if(n===cur)b.classList.add("on");
    b.addEventListener("click",async()=>{
      const s=SESSIONS[todayISO()];if(!s)return;
      s.srpe=n;await put("sessions",s);renderRate();
    });
    host.appendChild(b);
  }
}
async function saveSession(complete,actual){
  const date=todayISO();
  const rec={date,dayKey,startedAt,endedAt:Date.now(),
    plannedSec:PLANNED,actualSec:actual||null,activeSec:activeSoFar(),
    sets:logged.slice(),complete:!!complete};
  if(SESSIONS[date]&&SESSIONS[date].srpe)rec.srpe=SESSIONS[date].srpe;
  SESSIONS[date]=rec;
  /* Froze this morning and trained anyway. Refund it rather than charge you
     for a day you showed up for. */
  if(FREEZES[date]){delete FREEZES[date];await del("freezes",date);}
  if(!META.firstDay){META.firstDay=date;}
  const st=computeStreak();
  if(st===0&&META.lastStreak>1){META.lastBreak=breakMessage(META.lastBreak).index;}
  META.lastStreak=st;
  await put("sessions",rec);await put("meta",META);
}
/* Pausing and quitting are the same act here: the sets are already saved, the
   day is already on the streak, and the only difference is whether you come
   back. So the button says pause, and the message says where to come back to. */
function pauseSession(){
  const some=logged.length>0;
  leaveSession();
  if(!done)toast(some?"Paused. Resume from the home screen.":"Session dropped.");
}
function leaveSession(){
  $("sess").classList.remove("on");
  dropAwake();
  /* `done` means finish() already stored the session complete. Saving again
     here would overwrite that flag and drop actualSec. That is exactly what
     the Done button used to do. */
  if(logged.length&&!done)saveSession(false);
  renderToday();renderHistory();renderStats();
}
/* The clock reads the wall, not the frame counter. A phone that sleeps stops
   painting frames, so a frame-counted clock resumed exactly where it froze and
   the whole session slid by however long the screen was off. */
function loop(){
  if($("sess").classList.contains("on")&&!done&&!finishing){
    const p=PH[idx];
    el=(Date.now()-anchor)/1000;
    if(p.type==="rest"&&holding){
      el=Math.min(el,p.dur);
    }else if(p.type==="rest"&&el>=p.dur){
      endRest();raf=requestAnimationFrame(loop);return;
    }else if(p.type==="rest"){
      const lft=p.dur-el;
      /* A tick already well past its moment is one the phone slept through.
         Skip it, rather than fire the whole ramp at once on waking. */
      /* A ten second switch inside a superset would get the heads-up and the
         countdown on top of each other. Short rests get the countdown only. */
      if(!warned&&lft<=WARN_AT){warned=true;if(lft>WARN_AT-.6&&p.dur>WARN_AT+2)warn();}
      while(cued<CUE_AT.length&&lft<=CUE_AT[cued]){const k=CUE_AT[cued++];if(lft>k-.6)tick();}
    }
    render();
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
  /* The day's movements as the week runs now, plus any the session logged under
     an older week, so a set can always be added back to what was done. */
  const moves=[...new Set(dayMoves(WEEK[s.dayKey]).concat(s.sets.map(x=>x.m)))].filter(m=>M[m]);
  $("edMove").innerHTML=moves.map(m=>"<option value='"+m+"'>"+M[m].name+"</option>").join("");
  renderEdList();
  $("editor").classList.add("on");
}
function renderEdList(){
  const s=SESSIONS[edDate];
  if(!s.sets.length){$("edList").innerHTML="<p class='muted'>No sets left on this day.</p>";return;}
  let h="<div class='edlab'><span>Reps</span><span>Effort</span></div>";
  const tally={};s.sets.forEach(x=>{(tally[x.m]=tally[x.m]||new Set()).add(x.set);});
  h+=s.sets.map((x,i)=>{
    const m=M[x.m],n=tally[x.m].size;
    const sd=x.side==="L"?" · Left":(x.side==="R"?" · Right":"");
    return "<div class='edrow'><span class='who'>"+m.name+"<small>Set "+x.set+(n>1?" of "+n:"")+sd+"</small></span>"+
      "<input type='number' inputmode='numeric' value='"+x.reps+"' data-i='"+i+"' data-f='reps'>"+
      "<select data-i='"+i+"' data-f='rir'>"+effortOptions(x.rir)+"</select>"+
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
  const s=SESSIONS[edDate], mk=$("edMove").value, m=M[mk], ts=Date.now();
  const n=new Set(s.sets.filter(x=>x.m===mk).map(x=>x.set)).size+1;
  if(m.side)SIDES.forEach(sd=>s.sets.push({m:mk,set:n,side:sd.k,reps:m.def,rir:EFFORT_TARGET,ts:ts}));
  else s.sets.push({m:mk,set:n,reps:m.def,rir:EFFORT_TARGET,ts:ts});
  await persistEdit(); renderEdList();
});
$("edDel").addEventListener("click",async()=>{
  if(!edDate)return;
  const d=edDate;
  delete SESSIONS[d];
  await del("sessions",d);
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
  /* Muting mid session must take the primer with it, or the phone keeps an
     audio stream open for cues that will never play. */
  if(on){tone(660,.08,.55);startPrime();}
  else stopPrime();
}
$("sndBtn").addEventListener("click",()=>setSound(!sound));
$("sndToggle").addEventListener("click",()=>setSound(!sound));
$("quitBtn").addEventListener("click",pauseSession);
$("doneBtn").addEventListener("click",leaveSession);
$("startBtn").addEventListener("click",startSession);
$("editToday").addEventListener("click",()=>openEditor(todayISO()));
$("freezeBtn").addEventListener("click",toggleFreeze);
document.querySelectorAll("nav button").forEach(b=>b.addEventListener("click",()=>{
  document.querySelectorAll("nav button").forEach(x=>x.classList.toggle("on",x===b));
  document.querySelectorAll(".page").forEach(p=>p.classList.remove("on"));
  $("p-"+b.dataset.go).classList.add("on");
  if(b.dataset.go==="history")renderHistory();
  if(b.dataset.go==="stats"){RECAP_BACK=0;renderStats();}
  scrollTo(0,0);
}));
$("calPrev").addEventListener("click",()=>{calCursor.setMonth(calCursor.getMonth()-1);renderHistory();});
$("calNext").addEventListener("click",()=>{calCursor.setMonth(calCursor.getMonth()+1);renderHistory();});
async function saveWeight(v){
  const rec={date:todayISO(),w:v};await put("weights",rec);
  WEIGHTS=WEIGHTS.filter(x=>x.date!==rec.date);WEIGHTS.push(rec);
  renderStats();renderWeighPill();toast("Saved");
}
/* Today's weight, or a way to add it, without leaving the home screen. Once
   logged the pill shows the number, and tapping it again corrects it. */
function renderWeighPill(){
  const t=WEIGHTS.find(x=>x.date===todayISO());
  $("wPillLbl").textContent=t?t.w+" lb":"Weigh in";
  $("wPill").classList.toggle("done",!!t);
}
function weighField(open){
  $("wPill").hidden=open;$("wForm").hidden=!open;
  if(!open)return;
  const t=WEIGHTS.find(x=>x.date===todayISO()),last=WEIGHTS.slice().sort((a,b)=>b.date.localeCompare(a.date))[0];
  $("wQuick").value=t?t.w:"";$("wQuick").placeholder=last?String(last.w):"lb";
  $("wQuick").focus();
}
$("wPill").addEventListener("click",()=>weighField(true));
$("wForm").addEventListener("submit",async e=>{
  e.preventDefault();
  const v=parseFloat($("wQuick").value);
  weighField(false);
  if(v>0)await saveWeight(v);
});
/* Leaving the field without saving closes it. Pressing the check button must
   not count as leaving, so it keeps the focus where it is. */
$("wForm").querySelector("button").addEventListener("pointerdown",e=>e.preventDefault());
$("wQuick").addEventListener("blur",()=>weighField(false));
$("wQuick").addEventListener("keydown",e=>{if(e.key==="Escape")weighField(false);});
/* Both exports go through the same JSON download, so the weigh-ins land in
   Downloads exactly the way the full backup does, with nothing opened. */
function saveJSON(name,data){
  const a=document.createElement("a");
  a.href=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:"application/json"}));
  a.download=name+"-"+todayISO()+".json";a.click();URL.revokeObjectURL(a.href);
}
const backup=()=>({sessions:Object.values(SESSIONS),meta:META,weights:WEIGHTS,freezes:Object.values(FREEZES)});
const dump=()=>JSON.stringify(backup(),null,2);
$("expBtn").addEventListener("click",()=>saveJSON("reps",backup()));
/* Bodyweight alone, oldest first. Import reads it too and adds the weigh-ins
   without touching anything else. */
$("wtExp").addEventListener("click",()=>{
  if(!WEIGHTS.length){toast("No weigh-ins yet");return;}
  saveJSON("reps-weigh-ins",{weights:WEIGHTS.slice().sort((a,b)=>a.date.localeCompare(b.date))});
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
/* The same five seconds a rest ends with, silent first second included. A test
   that plays something else tests nothing. */
let testing=false;
$("volTest").addEventListener("click",()=>{
  if(testing)return;
  testing=true;audio();
  CUE_AT.forEach(k=>setTimeout(tick,(5-k)*1000));
  setTimeout(()=>{goTone();testing=false;},5000);});
$("impBtn").addEventListener("click",()=>$("impFile").click());
$("impFile").addEventListener("change",async e=>{
  const f=e.target.files[0];if(!f)return;
  try{
    await ingest(JSON.parse(await f.text()));toast("Imported");
  }catch(err){toast("Could not read that file");}
  e.target.value="";
});

async function ingest(d){
  if(!d||!(Array.isArray(d.sessions)||Array.isArray(d.weights)))throw new Error("not an export");
  for(const s of (d.sessions||[]))await put("sessions",s);
  for(const w of (d.weights||[]))await put("weights",w);
  for(const f of (d.freezes||[]))await put("freezes",f);
  if(d.meta){META=Object.assign(META,d.meta,{k:"app"});await put("meta",META);}
  await load();
}
async function load(){
  const s=await all("sessions");SESSIONS={};s.forEach(x=>SESSIONS[x.date]=x);
  const m=await get("meta","app");if(m)META=Object.assign(META,m);
  const fz=await all("freezes");FREEZES={};fz.forEach(x=>FREEZES[x.date]=x);
  /* Sessions saved before the 4am rollover carry the calendar date they were
     started on. One started before 4 moves back to the evening it belongs to,
     unless that evening already holds a different session. The same session
     arriving twice, from an old export pasted in again, collapses into one. */
  for(const x of Object.values(SESSIONS)){
    if(!x.startedAt)continue;
    const st=new Date(x.startedAt);
    if(st.getHours()>=ROLLOVER_H||x.date!==iso(st))continue;
    st.setDate(st.getDate()-1);
    const prev=iso(st), there=SESSIONS[prev];
    if(there&&there.startedAt!==x.startedAt)continue;
    const old=x.date;
    x.date=prev;await put("sessions",x);await del("sessions",old);
    delete SESSIONS[old];SESSIONS[prev]=x;
  }
  sound=META.sound!==false;
  $("sndBtn").setAttribute("aria-pressed",sound?"true":"false");
  $("sndToggle").textContent=sound?"Cues on":"Cues off";
  /* A slider parked at zero is an app with no cues and nothing on screen to say
     why. The slider stops at 20%, and a stored zero reads as never set. */
  VOL=(typeof META.vol==="number"&&META.vol>=.2)?META.vol:1;
  $("volIn").value=Math.round(VOL*100);$("volNote").textContent=Math.round(VOL*100)+"%";
  WEIGHTS=await all("weights");
  /* Before the first render, or you see a broken streak that the freeze you
     are owed was about to save. */
  const covered=await autoCover();
  META.lastStreak=computeStreak();await put("meta",META);
  $("verNote").textContent=APP_VERSION;
  renderToday();renderRoutine();renderHistory();renderStats();
  if(covered)toast(covered===1?"A freeze covered yesterday":covered+" freezes covered the days you missed");
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
