# Reps

Reps, a fifteen-minute daily home workout web app on GitHub Pages (https://jmlalande.github.io/Reps/, repo `JmLalande/Reps`). Shoulders, arms and upper chest, built around volleyball Monday and Wednesday and climbing Thursday.

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
- The day ends at **4am**, not midnight. A session at 2am counts for the evening before.
- The clock runs the whole session. Work never auto-advances — it counts into
  overtime until you tap. Rest auto-advances, with a double low beep ten seconds out, four ticks on the beat and a tone at zero.
- Tapping anywhere ends the current phase and **shifts the entire remaining
  schedule**, so finishing early or late reflows the projected finish time.
- Weeks 1-2 hold you to 3-4 reps in reserve on purpose. Week 3 the rule changes.
- Hit the top of a rep range twice running and it tells you to move up, and names
  the next rung on the ladder.

## Freezes

One freeze a week, Monday to Sunday, and it never carries over. A frozen day holds the streak without counting toward it, so the number on screen stays a count of sessions done.

A freeze skips that day's workout. Nothing slides: the week is keyed to the calendar, so the day after a freeze is still that day's workout. This is where Reps differs from Loop, whose cycle stands still on a frozen day.

Freezing is a button on the Today page, and there is a safety net behind it. A missed day is only found when you open the app again, and it is covered automatically if that week still has its freeze. A gap is covered whole or not at all, each day out of its own week's budget, so a missed Sunday and Monday can both be saved but two missed days in the same week cannot. Train on a day you froze and the freeze comes back.

## Data

IndexedDB, this browser only. **Export from the Progress tab now and then** —
clearing site data wipes everything.

**Export weigh-ins** on the Progress tab saves bodyweight alone as `reps-weigh-ins-<date>.json`, oldest first, straight to Downloads like the full export. Import reads it and only adds the weigh-ins.

`DB_NAME` (`reps-tracker`) and `CACHE_NAME` (`reps-v…`) start with `reps-`. They must never collide with another app on the same GitHub Pages account, because storage there is shared across every repo of the account (Loop uses `loop-`).

## Deploying

`APP_VERSION` in `app.js` and `CACHE_NAME` in `sw.js` bump together, every time. Out of sync means phones keep serving stale files.
