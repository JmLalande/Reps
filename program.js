/* The program. Edit here, everything else follows. ------------------------ */
"use strict";

/* Movements. `work` is the estimated seconds the set itself takes. It seeds the
   clock, and your recalibrate taps correct it. `hold` marks isometric work that
   is measured in seconds instead of reps. */
const M = {
  press:    {short:"KB press",      name:"Half-kneeling one-arm press",             reps:"5–8",   lo:5,  hi:8,  side:"each arm", load:"16 kg",     work:70, def:6,  next:"Take it to 8 a side. Then three seconds down on every rep. Then the next bell, back at 5.", cue:"Bell in your right hand means right knee down. Press it straight up, ribs down, do not lean away from it. Lower it under control. Five on that side, then switch."},
  lateral:  {short:"Lateral raise", name:"Lateral raise",                          reps:"12–15", lo:12, hi:15, side:"",         load:"dumbbells", work:40, def:13, cue:"Lead with your elbows, not your hands. Stop at shoulder height. If you need to swing, go lighter."},
  reardelt: {short:"Rear delt",     name:"Bent-over rear delt raise",              reps:"15",    lo:15, hi:15, side:"",         load:"dumbbells", work:40, def:15, cue:"Bend forward to about 45°, knees soft. Open your arms like a curtain. You should feel it behind the shoulder, not in your neck."},
  curl:     {short:"KB curl",       name:"Kettlebell curl, two hands",             reps:"12–15", lo:12, hi:15, side:"",         load:"16 kg",     work:40, def:13, next:"Pause two seconds halfway up, every rep. Then try one arm again.", cue:"Back flat against a wall so nothing else can help. Both hands side by side on the handle, bell hanging in front of your thighs. Elbows pinned to your ribs, curl to your chest, then three seconds down."},
  ohext:    {short:"OH extension",  name:"Overhead kettlebell extension",          reps:"10–12", lo:10, hi:12, side:"",         load:"16 kg",     work:40, def:11, cue:"Cup the round part with both hands, handle pointing down your back. Keep your elbows forward and close together."},
  pushup:   {short:"Push-ups",      name:"Feet-elevated push-ups on parallettes",  reps:"8–15",  lo:8,  hi:15, side:"",         load:"vest",      work:45, def:11, next:"Add reps to 15. Then three seconds down. Then more weight in the vest.", cue:"Vest on. Feet on the 12-inch step. Turn the handles out into a shallow V. Elbows about 45° from your ribs, not flared wide."},
  /* The second big push. A push-up stops at the parallette; this loads the chest
     and triceps at full stretch, which nothing else in the program does. */
  dip:      {short:"Dips",          name:"Dips between two chairs",                reps:"8–12",  lo:8,  hi:12, side:"",         load:"bodyweight",work:45, def:10, next:"Add reps to 12. Then three seconds down. Then the vest.", cue:"Two sturdy chairs, seats facing each other, a bit wider than your shoulders. Hands on the seats, knees bent so your feet clear the floor. Lower until your upper arms are level with the floor, elbows tucked, then press up. Start higher than that if the front of the shoulder complains."},
  /* Parked. They went in as the one concession to a vertical jump on a program
     with no leg day. Volleyball is the vertical now. */
  swing:    {short:"KB swings",     name:"Kettlebell swings",                      reps:"20",    lo:20, hi:20, side:"",         load:"16 kg",     work:45, def:20, cue:"Your hips do this, not your arms. Swing it back between your legs, snap your hips forward, let it float up. Back stays flat."},

  doorpress:{short:"Doorframe push",name:"Doorframe overhead press-up",            reps:"4 × 3s",lo:4,  hi:4,  side:"",         load:"max effort",work:32, def:4,  hold:true, cue:"Hands flat under the top of the door frame. Push up like you are trying to lift the house. Three seconds on, five off, four times."},
  /* Not in the week. Climbing already loads the elbow. If one flares, put these
     back on Saturday: heavy isometrics are the treatment, not only the guard. */
  tablecurl:{short:"Under-table",   name:"Under-table curl press",                 reps:"4 × 3s",lo:4,  hi:4,  side:"",         load:"max effort",work:32, def:4,  hold:true, cue:"Palms up under a heavy tabletop, elbows bent about 90°. Drive up as hard as you can for three seconds."},
  tablepush:{short:"Table press",   name:"Top-of-table press-down",                reps:"4 × 3s",lo:4,  hi:4,  side:"",         load:"max effort",work:32, def:4,  hold:true, cue:"Palms down on top of the table, elbows bent about 90°. Press down as hard as you can for three seconds."},
  splitsq:  {short:"Split squat",   name:"Split-squat hold",                       reps:"30s",   lo:30, hi:30, side:"each leg", load:"bodyweight",work:70, def:30, hold:true, cue:"Long stride. Drop until your front thigh is level with the floor and your back knee is a few inches off it. A hand on the wall is fine."}
};

/* How hard, in reps left in the tank at the end of a set. Reps alone say how
   much work; without this the first session ran every last set to failure on
   the day that was designed to be the easy one. Lower is harder. A day sets
   the tone, a block can override it, and the on-ramp overrides both. */
const DEFAULT_RIR = [1,2], ONRAMP_RIR = [3,4];

/* The week. 0 = Sunday, matching JS getDay(). A block may carry `reps`/`lo`/`hi`
   to override the movement's own range when the same movement is asked to do a
   different job on a different day.

   Two rules shaped this and both go quiet if broken, so they are written down:

   Nothing runs on two consecutive days, and Sunday counts as next to Monday.
   Saturday shares no movement with anyone, so it buffers Friday from Sunday.
   With seven movements over six days that leaves four possible weeks, and this
   is one of them. The pairing is the consequence: Monday and Wednesday press,
   Tuesday and Thursday chest, Friday and Sunday delts. An A and B rotation.

   Overhead extension never shares a day with push-ups or dips. Behind push-ups
   it collapsed every time (12@1 then 3@0, 10@2 then 8@0). Behind the press and
   curls it held. So it lives on the press days, with the curls between.

   Within a day, hardest and most technical first, isolation last. */
const WEEK = {
  1: {name:"Press & arms", rir:[2,2], blocks:[{m:"press",sets:3,rest:90},{m:"curl",sets:3,rest:60},{m:"ohext",sets:2,rest:55}]},
  2: {name:"Chest",        rir:[1,2], blocks:[{m:"dip",sets:3,rest:70},{m:"pushup",sets:3,rest:70},{m:"lateral",sets:4,rest:45}]},
  3: {name:"Press & delts",rir:[2,2], blocks:[{m:"press",sets:3,rest:90},{m:"reardelt",sets:4,rest:40},{m:"ohext",sets:3,rest:55}]},
  4: {name:"Chest & arms", rir:[1,2], blocks:[{m:"dip",sets:3,rest:70},{m:"pushup",sets:3,rest:70},{m:"curl",sets:3,rest:50}]},
  5: {name:"Shoulders",    rir:[2,2], blocks:[{m:"press",sets:3,rest:90},{m:"lateral",sets:3,rest:45},{m:"reardelt",sets:3,rest:40}]},
  6: {name:"Tendon"                 , blocks:[{m:"doorpress",sets:3,rest:60},{m:"splitsq",sets:3,rest:45},{m:"curl",sets:3,rest:60}]},
  0: {name:"Push & delts", rir:[1,2], blocks:[{m:"pushup",sets:5,rest:65},{m:"lateral",sets:3,rest:45},{m:"reardelt",sets:3,rest:40}]}
};

/* Weeks 1–2 hold you back on purpose: 3–4 reps in reserve, no vest, no progression. */
const ONRAMP_DAYS = 14;

function buildPhases(dayKey, onramp){
  const day = WEEK[dayKey], ph = [];
  day.blocks.forEach((b, bi) => {
    const m = M[b.m];
    const spec = {
      reps: b.reps || m.reps, lo: b.lo || m.lo, hi: b.hi || m.hi,
      rir: m.hold ? null : (onramp ? ONRAMP_RIR : (b.rir || day.rir || DEFAULT_RIR))
    };
    spec.def = (b.reps ? Math.round((spec.lo + spec.hi)/2) : m.def);
    for(let s=1; s<=b.sets; s++){
      ph.push(Object.assign({type:"work", m:b.m, bi, set:s, sets:b.sets, dur:m.work}, spec));
      const isLast = (bi === day.blocks.length-1) && (s === b.sets);
      const rest = (!isLast && b.rest > 0) ? b.rest : 20;
      if(!isLast) ph.push(Object.assign({type:"rest", m:b.m, bi, set:s, sets:b.sets, dur:rest}, spec));
    }
  });
  return ph;
}

/* What the plan lists read, so a block override never disagrees with the timer. */
const blockReps = b => b.reps || M[b.m].reps;
