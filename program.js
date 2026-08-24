/* The program. Edit here, everything else follows. ------------------------ */
"use strict";

/* Movements. `work` is the estimated seconds the set itself takes. It seeds the
   clock, and your recalibrate taps correct it. `hold` marks isometric work that
   is measured in seconds instead of reps. */
const M = {
  press:    {short:"KB press",      name:"Half-kneeling one-arm press, helped up",  reps:"5–6",   lo:5,  hi:6,  side:"each arm", load:"16 kg",     work:70, def:5,  next:"Press it up with one arm, no help from the other. Same bell, same reps.", cue:"Bell in your right hand means right knee down. Both hands on it to get it overhead. Let go with the left, then lower it slowly on the right, about three seconds down. The left hand helps it back up. Five on that side, then switch."},
  lateral:  {short:"Lateral raise", name:"Lateral raise",                          reps:"12–15", lo:12, hi:15, side:"",         load:"dumbbells", work:40, def:13, cue:"Lead with your elbows, not your hands. Stop at shoulder height. If you need to swing, go lighter."},
  reardelt: {short:"Rear delt",     name:"Bent-over rear delt raise",              reps:"15",    lo:15, hi:15, side:"",         load:"dumbbells", work:40, def:15, cue:"Bend forward to about 45°, knees soft. Open your arms like a curtain. You should feel it behind the shoulder, not in your neck."},
  curl:     {short:"KB curl",       name:"Kettlebell curl, two hands",             reps:"12–15", lo:12, hi:15, side:"",         load:"16 kg",     work:40, def:13, next:"Go back to one arm at 8–10 reps. Same bell, twice the load per side.", cue:"Both hands side by side on the handle, bell hanging in front of your thighs. Elbows pinned to your ribs, curl to your chest without leaning back."},
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

/* How hard, in reps left in the tank at the end of a set. Reps alone say how
   much work; without this the first session ran every last set to failure on
   the day that was designed to be the easy one. Lower is harder. A day sets
   the tone, a block can override it, and the on-ramp overrides both. */
const DEFAULT_RIR = [1,2], ONRAMP_RIR = [3,4];

/* The week. 0 = Sunday, matching JS getDay(). A block may carry `reps`/`lo`/`hi`
   to override the movement's own range when the same movement is asked to do a
   different job on a different day. */
const WEEK = {
  1: {name:"Press A",   rir:[2,2], blocks:[{m:"press",sets:3,rest:90},{m:"lateral",sets:3,rest:45},{m:"reardelt",sets:2,rest:40}]},
  2: {name:"Arms",      rir:[1,2], blocks:[{m:"curl",sets:4,rest:60},{m:"ohext",sets:3,rest:60},{m:"reardelt",sets:2,rest:40}]},
  3: {name:"Chest",     rir:[1,2], blocks:[{m:"pushup",sets:4,rest:75},{m:"lateral",sets:3,rest:45},{m:"swing",sets:1,rest:0,rir:[3,4]}]},
  4: {name:"Delts only",rir:[1,2], blocks:[{m:"lateral",sets:4,rest:45},{m:"reardelt",sets:3,rest:40}]},
  5: {name:"Press B",   rir:[2,2], blocks:[{m:"press",sets:3,rest:90},{m:"curl",sets:3,rest:60},{m:"ohext",sets:2,rest:60}]},
  6: {name:"Tendon"                 , blocks:[{m:"doorpress",sets:3,rest:60},{m:"splitsq",sets:3,rest:45}]},
  /* Sunday is the easy day. Flatter rep targets than the hard days use, so the
     fourth set looks like the first instead of collapsing into it. */
  0: {name:"Chest & arms", rir:[2,3], blocks:[
       {m:"pushup",sets:4,rest:60,reps:"10–12",lo:10,hi:12},
       {m:"curl",sets:3,rest:50},
       {m:"ohext",sets:2,rest:50,reps:"8–10",lo:8,hi:10},
       {m:"swing",sets:1,rest:0,rir:[3,4]}]}
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
