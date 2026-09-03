# Reps

Fifteen minutes a day, at home. Shoulders, arms and upper chest, built around
volleyball Monday and Wednesday and climbing Thursday.

Live: https://jmlalande.github.io/Reps/

## Editing the program

Everything about the training lives in `program.js` — movements, the week, rest
periods, rep ranges, the cues shown on screen. Change it there and the whole app
follows: the session engine, the routine page, the progression prompts and the
personal records all read from it.

`milestones.js` is the streak bank. `DAYS` is keyed to an exact day count, `POOL`
is the fallback that never repeats, `BREAKS` is what shows when a streak ends.

## How it behaves

- A day counts toward the streak as soon as **one set** is logged. Lower the floor.
- The clock runs the whole session. Work never auto-advances — it counts into
  overtime until you tap. Rest auto-advances, with four ticks on the beat and a tone at zero.
- Tapping anywhere ends the current phase and **shifts the entire remaining
  schedule**, so finishing early or late reflows the projected finish time.
- Weeks 1–2 hold you to 3–4 reps in reserve on purpose. Week 3 the rule changes.
- Hit the top of a rep range twice running and it tells you to move up, and names
  the next rung on the ladder.

## Data

IndexedDB, this browser only. **Export from the Progress tab now and then** —
clearing site data wipes everything.
