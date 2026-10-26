/* The program. Edit here, everything else follows. ------------------------ */
"use strict";

/* Movements. `work` is the estimated seconds the set itself takes. It seeds the
   clock, and your recalibrate taps correct it. `hold` marks isometric work that
   is measured in seconds instead of reps. */
const M = {
  press:    {short:"KB press",      name:"Half-kneeling one-arm press",             reps:"5–8",   lo:5,  hi:8,  side:"each arm", load:"16 kg",     work:70, def:6,  cue:"Bell in your right hand means right knee down. Press it straight up, ribs down, do not lean away from it. Lower it under control. Five on that side, then switch."},
  lateral:  {short:"Lateral raise", name:"Lateral raise",                          reps:"12–15", lo:12, hi:15, side:"",         load:"dumbbells", work:40, def:13, cue:"Lead with your elbows, not your hands. Stop at shoulder height. If you need to swing, go lighter."},
  reardelt: {short:"Rear delt",     name:"Bent-over rear delt raise",              reps:"15",    lo:15, hi:15, side:"",         load:"dumbbells", work:40, def:15, cue:"Bend forward to about 45°, knees soft. Open your arms like a curtain. You should feel it behind the shoulder, not in your neck."},
  curl:     {short:"KB curl",       name:"Kettlebell curl, two hands",             reps:"12–15", lo:12, hi:15, side:"",         load:"16 kg",     work:40, def:13, cue:"Back flat against a wall so nothing else can help. Both hands side by side on the handle, bell hanging in front of your thighs. Elbows pinned to your ribs, curl to your chest, then three seconds down."},
  ohext:    {short:"OH extension",  name:"Overhead kettlebell extension",          reps:"10–12", lo:10, hi:12, side:"",         load:"16 kg",     work:40, def:11, cue:"Cup the round part with both hands, handle pointing down your back. Keep your elbows forward and close together."},
  pushup:   {short:"Push-ups",      name:"Feet-elevated push-ups on parallettes",  reps:"8–15",  lo:8,  hi:15, side:"",         load:"vest",      work:45, def:11, cue:"Vest on. Feet on the 12-inch step. Turn the handles out into a shallow V. Elbows about 45° from your ribs, not flared wide."},
  /* The second big push. A push-up stops at the parallette; this loads the chest
     and triceps at full stretch, which nothing else in the program does. */
  dip:      {short:"Dips",          name:"Dips between two chairs",                reps:"8–12",  lo:8,  hi:12, side:"",         load:"bodyweight",work:45, def:10, cue:"Two sturdy chairs, seats facing each other, a bit wider than your shoulders. Hands on the seats, knees bent so your feet clear the floor. Lower until your upper arms are level with the floor, elbows tucked, then press up. Start higher than that if the front of the shoulder complains."},
  /* Back for the jump. Six weeks of swings, twice a week, raised vertical jump
     as much as jump-squat training did (Lake & Lauder 2012, 16 kg for men over
     70 kg). The point is speed: every rep as hard and fast as you can. */
  swing:    {short:"KB swings",     name:"Kettlebell swings",                      reps:"20",    lo:20, hi:20, side:"",         load:"16 kg",     work:45, def:20, cue:"Your hips do this, not your arms. Swing it back between your legs, snap your hips forward, let it float up. Back stays flat."},

  doorpress:{short:"Doorframe push",name:"Doorframe overhead press-up",            reps:"4 × 3s",lo:4,  hi:4,  side:"",         load:"max effort",work:32, def:4,  hold:true, cue:"Hands flat under the top of the door frame. Push up like you are trying to lift the house. Three seconds on, five off, four times."},
  /* Not in the week. Climbing already loads the elbow. If one flares, put these
     back on Saturday: heavy isometrics are the treatment, not only the guard. */
  tablecurl:{short:"Under-table",   name:"Under-table curl press",                 reps:"4 × 3s",lo:4,  hi:4,  side:"",         load:"max effort",work:32, def:4,  hold:true, cue:"Palms up under a heavy tabletop, elbows bent about 90°. Drive up as hard as you can for three seconds."},
  tablepush:{short:"Table press",   name:"Top-of-table press-down",                reps:"4 × 3s",lo:4,  hi:4,  side:"",         load:"max effort",work:32, def:4,  hold:true, cue:"Palms down on top of the table, elbows bent about 90°. Press down as hard as you can for three seconds."},
  /* The jump's strength half: one leg at a time, so the one bell and the vest
     become a real load. Back foot on the 12-inch step. */
  bss:      {short:"Bulgarian SS",  name:"Bulgarian split squat",                  reps:"8–12",  lo:8,  hi:12, side:"each leg", load:"16 kg + vest", work:85, def:10, cue:"Back foot on the step behind you, laces down. Bell held at your chest. Drop straight down until the front thigh is level with the floor, front knee tracking over the toes, then drive up through the front heel. All reps on one leg, then the other."},
  /* Slow and heavy, for the ankle end of the jump and for the feet and shins:
     loaded calf raises are a treatment for plantar fasciitis (Rathleff 2015). */
  calfraise:{short:"Calf raise",    name:"Single-leg calf raise",                  reps:"8–10",  lo:8,  hi:10, side:"each leg", load:"16 kg",     work:80, def:9,  cue:"Ball of one foot on the edge of a step, bell in the same hand, other hand on the wall. All the way up, pause, then three seconds down until the heel is below the step. All reps on one leg, then the other."},
  /* Parked. Saturday's hold became the Bulgarian split squat. */
  splitsq:  {short:"Split squat",   name:"Split-squat hold",                       reps:"30s",   lo:30, hi:30, side:"each leg", load:"bodyweight",work:70, def:30, hold:true, cue:"Long stride. Drop until your front thigh is level with the floor and your back knee is a few inches off it. A hand on the wall is fine."}
};

/* How hard, in reps left in the tank at the end of a set. Reps alone say how
   much work; without this the first session ran every last set to failure on
   the day that was designed to be the easy one. Lower is harder. A day sets
   the tone, a block can override it, and the on-ramp overrides both. */
const DEFAULT_RIR = [1,2], ONRAMP_RIR = [3,4];

/* The week. 0 = Sunday, matching JS getDay(). A day is blocks, and a block is
   one to three movements run in turn, `rounds` times: a superset when there are
   two. Each movement's `rest` is the pause after it, so the other movement in the
   pair is the real rest for this one, and the last movement's rest closes the
   round. `next` is the setup time before the following block. `work` overrides
   the movement's own estimate when the tempo makes a set longer.

   Pairs share no muscle, so neither costs the other reps: press days pair the
   overhead extension with the lateral raise, chest days pair dips with curls and
   push-ups with the rear delt. Three rules shaped the week and go quiet if broken:

   The press, dips, push-ups, curls and overhead extension never run on two
   consecutive days, and Sunday counts as next to Monday. Laterals and rear delts
   may, they are small and light.

   Overhead extension never shares a day with push-ups or dips. Behind push-ups
   it collapsed every time (12@1 then 3@0, 10@2 then 8@0).

   Legs live on the weekend, away from volleyball: Bulgarian split squats on
   Saturday leave Sunday to recover, swings on Sunday barely leave you sore.

   No heavier bell, so the press, curl and overhead extension get harder by going
   slower. The tempo is in `how`, and it is why their `work` is longer. */
const PRESS_DAY = {name:"Press & arms", rir:[1,2], blocks:[
  {rounds:4, next:20, items:[{m:"press", lo:7, hi:10, how:"3s down", work:80, rest:30}]},
  {rounds:3, items:[{m:"ohext", lo:12, hi:16, how:"3s down", work:65, rest:10},
                    {m:"lateral", lo:8, hi:12, work:35, rest:10}]}
]};
const CHEST_DAY = {name:"Chest & arms", rir:[1,2], blocks:[
  {rounds:3, next:60, items:[{m:"dip", lo:10, hi:15, how:"vest on", work:40, rest:10},
                             {m:"curl", lo:10, hi:15, how:"2s pause halfway, 3s down", work:90, rest:10}]},
  {rounds:3, items:[{m:"pushup", lo:10, hi:15, rest:15},
                    {m:"reardelt", lo:12, hi:15, work:40, rest:15}]}
]};
const WEEK = {
  1: PRESS_DAY,
  2: CHEST_DAY,
  3: PRESS_DAY,
  4: CHEST_DAY,
  5: PRESS_DAY,
  6: {name:"Tendon & legs", rir:[1,2], blocks:[
    {rounds:3, next:40, items:[{m:"doorpress", rest:10},
                               {m:"curl", lo:10, hi:15, how:"2s pause halfway, 3s down", work:90, rest:10}]},
    {rounds:3, items:[{m:"bss", lo:8, hi:12, how:"back foot on the step, bell at the chest", work:85, rest:60}]}
  ]},
  0: {name:"Push & jump", rir:[1,2], blocks:[
    {rounds:4, next:45, items:[{m:"pushup", lo:10, hi:15, rest:15},
                               {m:"reardelt", lo:12, hi:15, work:40, rest:15}]},
    {rounds:4, items:[{m:"swing", lo:12, hi:15, how:"30s, every rep as hard and fast as you can", work:30, rest:10},
                      {m:"calfraise", lo:8, hi:10, how:"edge of a step, 3s down, bell in hand", rest:10}]}
  ]}
};

/* One freeze a week, Monday to Sunday, no carryover. A frozen day holds the
   streak and skips that day's workout. Nothing slides: the week is keyed to the
   calendar, so the day after a freeze is still that day's workout. */
const FREEZES_PER_WEEK = 1;

/* Weeks 1–2 hold you back on purpose: 3–4 reps in reserve, no vest, no progression. */
const ONRAMP_DAYS = 14;

/* A movement's target inside a block: the block's range when it sets one, the
   movement's own otherwise. Holds keep their written form ("4 × 3s"). */
function itemSpec(it){
  const m = M[it.m], lo = it.lo ?? m.lo, hi = it.hi ?? m.hi;
  const reps = it.reps || ((lo === m.lo && hi === m.hi) ? m.reps : (lo === hi ? String(lo) : lo + "–" + hi));
  return {reps, lo, hi, def: Math.round((lo + hi) / 2), work: it.work || m.work};
}

/* The day as a timeline. A superset runs A, B, A, B: each movement's rest is the
   pause after it, the last one's closes the round, and `next` is the walk to the
   following block. Nothing rests after the very last set. `set` counts rounds,
   so a movement's sets are numbered the same way they always were. */
function buildPhases(dayKey, onramp){
  const day = WEEK[dayKey], ph = [];
  day.blocks.forEach((b, bi) => {
    const lastBlock = bi === day.blocks.length - 1;
    for(let r = 1; r <= b.rounds; r++){
      b.items.forEach((it, ii) => {
        const m = M[it.m], sp = itemSpec(it);
        const spec = {reps:sp.reps, lo:sp.lo, hi:sp.hi, def:sp.def, how:it.how || "",
          rir: m.hold ? null : (onramp ? ONRAMP_RIR : (it.rir || day.rir || DEFAULT_RIR))};
        const base = {m:it.m, bi, set:r, sets:b.rounds, pair:b.items.length};
        ph.push(Object.assign({type:"work", dur:sp.work}, base, spec));
        const lastInBlock = r === b.rounds && ii === b.items.length - 1;
        const rest = lastInBlock ? (lastBlock ? 0 : (b.next || 20)) : (it.rest || 0);
        if(!(lastInBlock && lastBlock) && rest > 0) ph.push(Object.assign({type:"rest", dur:rest}, base, spec));
      });
    }
  });
  return ph;
}

/* What the plan lists read, so they never disagree with the timer. */
const planRows = day => day.blocks.map((b, bi) => b.items.map((it, ii) => ({
  tag: b.items.length > 1 ? (bi + 1) + "ABC"[ii] : String(bi + 1),
  m: it.m, rounds: b.rounds, reps: itemSpec(it).reps, how: it.how || "",
  rest: (bi === day.blocks.length - 1 && ii === b.items.length - 1) ? 0 : (it.rest || 0)
}))).flat();
