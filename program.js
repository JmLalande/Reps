/* The program. Edit here, everything else follows. ------------------------ */
"use strict";

/* Movements. `work` is the estimated seconds the set itself takes. It seeds the
   clock, and your recalibrate taps correct it. `hold` marks isometric work that
   is measured in seconds instead of reps. */
const M = {
  press:    {short:"KB press",      name:"Half-kneeling one-arm kettlebell press", reps:"6–8",   lo:6,  hi:8,  side:"each arm", load:"16 kg",     work:60, def:7,  cue:"Bell in your right hand means right knee down. Breathe out and let your ribs settle so your back does not arch. Press straight up until your bicep is beside your ear."},
  lateral:  {short:"Lateral raise", name:"Lateral raise",                          reps:"12–15", lo:12, hi:15, side:"",         load:"dumbbells", work:40, def:13, cue:"Lead with your elbows, not your hands. Stop at shoulder height. If you need to swing, go lighter."},
  reardelt: {short:"Rear delt",     name:"Bent-over rear delt raise",              reps:"15",    lo:15, hi:15, side:"",         load:"dumbbells", work:40, def:15, cue:"Bend forward to about 45°, knees soft. Open your arms like a curtain. You should feel it behind the shoulder, not in your neck."},
  curl:     {short:"KB curl",       name:"Kettlebell curl, one arm",               reps:"8–10",  lo:8,  hi:10, side:"each arm", load:"16 kg",     work:45, def:9,  cue:"Grip one side of the handle so the bell sits outside your wrist instead of banging your forearm. Keep your elbow at your side."},
  ohext:    {short:"OH extension",  name:"Overhead kettlebell extension",          reps:"10–12", lo:10, hi:12, side:"",         load:"16 kg",     work:40, def:11, cue:"Cup the round part with both hands, handle pointing down your back. Keep your elbows forward and close together."},
  pushup:   {short:"Push-ups",      name:"Feet-elevated push-ups on parallettes",  reps:"8–15",  lo:8,  hi:15, side:"",         load:"bodyweight",work:45, def:11, cue:"Feet on the 12-inch step. Turn the handles out into a shallow V. Elbows about 45° from your ribs, not flared wide."},
  swing:    {short:"KB swings",     name:"Kettlebell swings",                      reps:"20",    lo:20, hi:20, side:"",         load:"16 kg",     work:45, def:20, cue:"Your hips do this, not your arms. Swing it back between your legs, snap your hips forward, let it float up. Back stays flat."},

  doorpress:{short:"Doorframe push",name:"Doorframe overhead press-up",            reps:"4 × 3s",lo:4,  hi:4,  side:"",         load:"max effort",work:32, def:4,  hold:true, cue:"Hands flat under the top of the door frame. Push up like you are trying to lift the house. Three seconds on, five off, four times."},
  /* Not in the week. Climbing already loads the elbow. If one flares, put these
     back on Sunday: heavy isometrics are the treatment, not only the guard. */
  tablecurl:{short:"Under-table",   name:"Under-table curl press",                 reps:"4 × 3s",lo:4,  hi:4,  side:"",         load:"max effort",work:32, def:4,  hold:true, cue:"Palms up under a heavy tabletop, elbows bent about 90°. Drive up as hard as you can for three seconds."},
  tablepush:{short:"Table press",   name:"Top-of-table press-down",                reps:"4 × 3s",lo:4,  hi:4,  side:"",         load:"max effort",work:32, def:4,  hold:true, cue:"Palms down on top of the table, elbows bent about 90°. Press down as hard as you can for three seconds."},
  splitsq:  {short:"Split squat",   name:"Split-squat hold",                       reps:"30s",   lo:30, hi:30, side:"each leg", load:"bodyweight",work:70, def:30, hold:true, cue:"Long stride. Drop until your front thigh is level with the floor and your back knee is a few inches off it. A hand on the wall is fine."}
};

/* The week. 0 = Sunday, matching JS getDay(). */
const WEEK = {
  1: {name:"Press A",   blocks:[{m:"press",sets:3,rest:90},{m:"lateral",sets:3,rest:45},{m:"reardelt",sets:2,rest:40}]},
  2: {name:"Arms",      blocks:[{m:"curl",sets:4,rest:60},{m:"ohext",sets:3,rest:60},{m:"reardelt",sets:2,rest:40}]},
  3: {name:"Chest",     blocks:[{m:"pushup",sets:4,rest:75},{m:"lateral",sets:3,rest:45},{m:"swing",sets:1,rest:0}]},
  4: {name:"Delts only",blocks:[{m:"lateral",sets:4,rest:45},{m:"reardelt",sets:3,rest:40}]},
  5: {name:"Press B",   blocks:[{m:"press",sets:3,rest:90},{m:"curl",sets:3,rest:60},{m:"ohext",sets:2,rest:60}]},
  6: {name:"Tendon"                 , blocks:[{m:"doorpress",sets:3,rest:60},{m:"splitsq",sets:3,rest:45}]},
  0: {name:"Chest & arms", blocks:[{m:"pushup",sets:4,rest:60},{m:"curl",sets:3,rest:50},{m:"ohext",sets:2,rest:50},{m:"swing",sets:1,rest:0}]}
};

/* Weeks 1–2 hold you back on purpose: 3–4 reps in reserve, no vest, no progression. */
const ONRAMP_DAYS = 14;

function buildPhases(dayKey){
  const day = WEEK[dayKey], ph = [];
  day.blocks.forEach((b, bi) => {
    for(let s=1; s<=b.sets; s++){
      ph.push({type:"work", m:b.m, bi, set:s, sets:b.sets, dur:M[b.m].work});
      const isLast = (bi === day.blocks.length-1) && (s === b.sets);
      if(!isLast && b.rest > 0) ph.push({type:"rest", m:b.m, bi, set:s, sets:b.sets, dur:b.rest});
      else if(!isLast) ph.push({type:"rest", m:b.m, bi, set:s, sets:b.sets, dur:20});
    }
  });
  return ph;
}
