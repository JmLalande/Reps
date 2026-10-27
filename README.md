# Reps

Reps, a fifteen-minute daily home workout web app on GitHub Pages (https://jmlalande.github.io/Reps/, repo `JmLalande/Reps`). Shoulders, arms and upper chest, built around volleyball Monday and Wednesday and climbing Thursday.

Live: https://jmlalande.github.io/Reps/

## Editing the program

Everything about the training lives in `program.js` — movements, the week, rest periods, rep ranges, the cues shown on screen. Change it there and the whole app follows: the session engine, the routine page and the Progress tab all read from it.

`milestones.js` is the streak bank. `DAYS` is keyed to an exact day count, `POOL`
is the fallback that never repeats, `BREAKS` is what shows after a break, until you train again.

## Reworking the routine

`python3 planner/plan.py` opens a local page with the proposed week next to the current one and what the log says about every exercise. It reads the live `program.js`, the newest Reps export (pulled from the phone over adb, else `~/Downloads`, or `--export FILE`), and the newest proposal in `planner/proposals/`. Tap a day to edit it; the time, rest and rule checks follow. **Send** writes `planner/sent/<date>.json` (not committed) and prints the edits and notes, then the server stops. A new rework starts with a new proposal file, same shape as the last one.

## How it behaves

- A day counts toward the streak as soon as **one set** is logged. Lower the floor.
- The day ends at **4am**, not midnight. A session at 2am counts for the evening before.
- The clock runs the whole session. Work never auto-advances — it counts into
  overtime until you tap. Rest auto-advances, with a double low beep ten seconds out, four ticks on the beat and a tone at zero.
- Tapping anywhere ends the current phase and **shifts the entire remaining
  schedule**, so finishing early or late reflows the projected finish time.
- Weeks 1-2 hold you to 3-4 reps in reserve on purpose: Easy is the target then. Week 3 the rule changes.
- Most of the week runs in **supersets**: two movements that share no muscle, alternated (1A, 1B, 1A…). Each movement's rest is the pause after it, so the other movement is the real rest. A rest under twelve seconds gets the countdown but not the ten-second double beep.
- After a rep set, one tap: **Failed**, **On target** (1–2 left) or **Easy** (3+ left). Holds only ask to be saved. A set done one side at a time asks once for both sides. Stored as 0, 2 and 3, so older 0–4 entries still read the same.
- At the end, one **1–10 rating for the whole session** (`srpe` in the export): the hard-day signal a single set can't carry.

## Freezes

One freeze a week, Monday to Sunday, and it never carries over. A frozen day holds the streak without counting toward it, so the number on screen stays a count of sessions done.

A missed day the freeze can't cover costs the streak two, never below zero, and never resets it. A gap found on opening the app takes each week's freeze if it is still there, oldest day first.

A freeze skips that day's workout. Nothing slides: the week is keyed to the calendar, so the day after a freeze is still that day's workout. This is where Reps differs from Loop, whose cycle stands still on a frozen day.

## Progress

The tab leads with what only grows: one sentence on what changed lately, lifetime sessions, time and reps, then a month in a few facts, opening on this month, with arrows or a swipe to step back as far as your first month. Below that: the last five weeks (a week counts at 4 days, trained or frozen, and frozen days are blue), this month against last, start times on a 24 h strip, session length by weekday against the average of the weekday averages, bodyweight as a smoothed trend (Hacker's Diet, 10% a day) with its average, and lifetime reps per movement in this week's routine with the next round number. Personal records are gone: with fixed bells the load never moves, so a record is one lucky day. The mockup it was designed in is `planner/progress-mockup.html`: replace `/*DATA*/null` with `{sessions, weights, freezes, today}` from an export to view it.

Freezing is a button on the Today page, and there is a safety net behind it. A missed day is only found when you open the app again, and it is covered automatically if that week still has its freeze. A gap is covered whole or not at all, each day out of its own week's budget, so a missed Sunday and Monday can both be saved but two missed days in the same week cannot. Train on a day you froze and the freeze comes back.

## Data

IndexedDB, this browser only. **Export from Settings now and then**: clearing site data wipes everything.

**Export weigh-ins** on the Progress tab saves bodyweight alone as `reps-weigh-ins-<date>.json`, oldest first, straight to Downloads like the full export. Import reads it and only adds the weigh-ins.

`DB_NAME` (`reps-tracker`) and `CACHE_NAME` (`reps-v…`) start with `reps-`. They must never collide with another app on the same GitHub Pages account, because storage there is shared across every repo of the account (Loop uses `loop-`).

## Deploying

`APP_VERSION` in `app.js` and `CACHE_NAME` in `sw.js` bump together, every time. Out of sync means phones keep serving stale files.
