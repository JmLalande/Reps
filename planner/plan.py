"""Routine planner: the current week, a proposed one, and what the log says, on one local page.

Run from the repo root:  python3 planner/plan.py [--export FILE] [--proposal FILE] [--no-open]

It reads the live program.js, the newest Reps export (from the phone over adb, else ~/Downloads),
and the newest proposal in planner/proposals/. The page is served on 127.0.0.1 and the process
blocks until Send. Send writes planner/sent/<date>.json and prints the edits and notes, which is
how they reach Claude: run this in the background and the exit is the wake-up."""
import argparse
import json
import re
import statistics as st
import subprocess
import sys
import tempfile
import threading
from collections import Counter, defaultdict
from datetime import date, datetime, timedelta
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
PAGE = HERE / "planner.html"
EXPORT = re.compile(r"^reps-(\d{4}-\d{2}-\d{2})(?: \(\d+\))?\.json$")
PHONE_DIR = "/sdcard/Download"
WINDOW_DAYS = 56  # how far back the per-day real times look
PORT = 47290  # the page keeps unsent edits per origin, and the port is part of the origin


def load_program():
    """Evaluate program.js in node so the planner never drifts from what the app runs."""
    js = (
        "const fs=require('fs');"
        "const src=fs.readFileSync(process.argv[1],'utf8').replace(/^\"use strict\";/m,'');"
        "const o=new Function(src+';return {M,WEEK};')();"
        "process.stdout.write(JSON.stringify(o));"
    )
    out = subprocess.run(["node", "-e", js, str(ROOT / "program.js")], capture_output=True, text=True, check=True)
    return json.loads(out.stdout)


def as_days(week, M):
    """Old blocks are {m, sets, rest}; supersets are {rounds, items}. The page only knows the second."""
    days = {}
    for dk, day in week.items():
        blocks = []
        for b in day["blocks"]:
            if "items" in b:
                b = dict(b, items=[dict({"lo": M[it["m"]]["lo"], "hi": M[it["m"]]["hi"], "rest": 0}, **it) for it in b["items"]])
                blocks.append(b)
            else:
                item = {"m": b["m"], "rest": b.get("rest", 0)}
                for k in ("lo", "hi", "how"):
                    if k in b:
                        item[k] = b[k]
                blocks.append({"rounds": b["sets"], "next": b.get("rest", 0), "items": [item]})
        days[dk] = {"name": day["name"], "blocks": blocks}
    return days


def newest_export(explicit):
    if explicit:
        return Path(explicit)
    try:
        ls = subprocess.run(["adb", "shell", f"ls {PHONE_DIR}"], capture_output=True, text=True, timeout=15)
        names = sorted((n.strip() for n in ls.stdout.splitlines() if EXPORT.match(n.strip())),
                       key=lambda n: (EXPORT.match(n).group(1), n))
        if ls.returncode == 0 and names:
            dest = Path(tempfile.gettempdir()) / "reps-planner"
            dest.mkdir(exist_ok=True)
            target = dest / names[-1]
            subprocess.run(["adb", "pull", f"{PHONE_DIR}/{names[-1]}", str(target)], capture_output=True, check=True, timeout=30)
            print(f"Export from the phone: {names[-1]}", flush=True)
            return target
    except (OSError, subprocess.SubprocessError):
        pass
    local = sorted((p for p in (Path.home() / "Downloads").glob("reps-*.json") if EXPORT.match(p.name)),
                   key=lambda p: (EXPORT.match(p.name).group(1), p.name))
    if local:
        print(f"Export from ~/Downloads: {local[-1].name}", flush=True)
        return local[-1]
    sys.exit("No Reps export found: phone not reachable over adb and none in ~/Downloads. Pass --export FILE.")


def ranges(program):
    """The rep range the current week asks for, per movement. A block override wins."""
    out = {k: (m["lo"], m["hi"]) for k, m in program["M"].items()}
    for day in program["WEEK"].values():
        for b in day["blocks"]:
            for it in b.get("items", [b]):
                if "lo" in it and "hi" in it:
                    out[it["m"]] = (it["lo"], it["hi"])
    return out


def stats(export, program):
    sessions = sorted(export.get("sessions", []), key=lambda s: s["date"])
    rng = ranges(program)
    by_move = defaultdict(list)
    for s in sessions:
        per = defaultdict(lambda: defaultdict(list))
        for x in s.get("sets", []):
            if x.get("reps", 0) > 0:
                per[x["m"]][x["set"]].append(x)
        for m, sets in per.items():
            rows = [(st.mean(v["reps"] for v in g), min(v.get("rir", 2) for v in g)) for _, g in sorted(sets.items())]
            by_move[m].append({"date": s["date"], "sets": rows})
    moves = {}
    for m, hist in by_move.items():
        if m not in program["M"]:
            continue
        lo, hi = rng.get(m, (0, 0))
        reps = [r for h in hist for r, _ in h["sets"]]
        rirs = Counter(q for h in hist for _, q in h["sets"])
        top = sum(r >= hi for r in reps) / len(reps)
        under = sum(r < lo for r in reps) / len(reps)
        easy = (rirs[3] + rirs[4]) / max(1, sum(rirs.values()))
        failed = rirs[0] / max(1, sum(rirs.values()))
        hold = bool(program["M"][m].get("hold"))
        recent = st.mean(r for h in hist[-3:] for r, _ in h["sets"])
        if hold:
            verdict = "easy" if top >= .8 else "ok"
        elif (top >= .8 and easy >= .4) or recent > hi:
            verdict = "easy"
        elif under >= .25 or failed >= .25:
            verdict = "hard"
        else:
            verdict = "ok"
        moves[m] = {
            "lo": lo, "hi": hi, "sessions": len(hist), "sets": len(reps),
            "avg": round(st.mean(reps), 1),
            "first": round(st.mean(h["sets"][0][0] for h in hist), 1),
            "last": round(st.mean(h["sets"][-1][0] for h in hist), 1),
            "top": round(100 * top), "under": round(100 * under),
            "recent": [round(st.mean(r for r, _ in h["sets"]), 1) for h in hist[-3:]],
            "rir": [rirs[i] for i in range(5)], "verdict": verdict, "hold": hold,
            "history": [{"date": h["date"], "sets": [[round(r, 1), q] for r, q in h["sets"]]} for h in hist[-5:]],
        }
    cutoff = (date.fromisoformat(sessions[-1]["date"]) - timedelta(days=WINDOW_DAYS)).isoformat() if sessions else ""
    per_day = defaultdict(list)
    ratios = []
    for s in sessions:
        if s["date"] < cutoff or not s.get("actualSec") or not s.get("plannedSec"):
            continue
        per_day[str(s["dayKey"])].append(s["actualSec"])
        r = s["actualSec"] / s["plannedSec"]
        if .5 < r < 1.5:
            ratios.append(r)
    return {
        "moves": moves,
        "days": {k: {"n": len(v), "real": round(st.mean(v))} for k, v in per_day.items()},
        "ratio": round(st.mean(ratios), 3) if ratios else 1,
        "from": sessions[0]["date"] if sessions else None, "to": sessions[-1]["date"] if sessions else None,
        "count": len(sessions),
    }


def newest_proposal(explicit):
    if explicit:
        return Path(explicit)
    found = sorted((HERE / "proposals").glob("*.json"))
    return found[-1] if found else None


def payload(program, export_path, proposal_path):
    export = json.loads(Path(export_path).read_text())
    current = as_days(program["WEEK"], program["M"])
    proposal = json.loads(proposal_path.read_text()) if proposal_path else {"title": "Rework", "days": current, "questions": []}
    moves = {k: {kk: v.get(kk) for kk in ("name", "short", "work", "hold", "side", "lo", "hi", "reps")} for k, v in program["M"].items()}
    moves.update(proposal.get("moves", {}))
    return {
        "generated": datetime.now().strftime("%Y-%m-%d %H:%M"),
        "export": Path(export_path).name,
        "proposalFile": proposal_path.name if proposal_path else None,
        "moves": moves, "current": current, "proposal": proposal,
        "stats": stats(export, program),
    }


def summary(sent):
    """What Claude reads: notes first, then only what differs from the proposal."""
    lines = [f"Sent {sent['sent']} from {sent.get('proposalFile') or 'current week'}"]
    if sent.get("note"):
        lines.append(f"Note from JM: {sent['note']}")
    for dk, note in sorted((sent.get("dayNotes") or {}).items()):
        if note.strip():
            lines.append(f"Day {dk} note: {note.strip()}")
    for qid, ans in (sent.get("answers") or {}).items():
        lines.append(f"Answer {qid}: {ans}")
    changes = sent.get("changes") or []
    lines.append(f"{len(changes)} edit(s) to the proposal" + (":" if changes else ""))
    lines += [f"  - {c}" for c in changes]
    return "\n".join(lines)


def serve(data, port=PORT, open_browser=True):
    html = PAGE.read_text().replace("/*DATA*/null", json.dumps(data, ensure_ascii=False))
    done = {}

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *a):
            pass

        def do_GET(self):
            body = html.encode()
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.end_headers()
            self.wfile.write(body)

        def do_POST(self):
            sent = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
            sent["sent"] = datetime.now().strftime("%Y-%m-%d %H:%M")
            sent["proposalFile"] = data["proposalFile"]
            out = HERE / "sent" / f"{date.today().isoformat()}.json"
            out.parent.mkdir(exist_ok=True)
            out.write_text(json.dumps(sent, ensure_ascii=False, indent=2) + "\n")
            done["path"], done["sent"] = out, sent
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b"ok")
            threading.Thread(target=server.shutdown).start()

    server = HTTPServer(("127.0.0.1", port), Handler)
    url = f"http://127.0.0.1:{server.server_address[1]}/"
    print(f"Planner open at {url}", flush=True)
    if open_browser:
        subprocess.run(["open", url])
    server.serve_forever()
    return done


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--export", help="a Reps export; default: newest on the phone, else ~/Downloads")
    ap.add_argument("--proposal", help="a proposal JSON; default: newest in planner/proposals/")
    ap.add_argument("--no-open", action="store_true")
    ap.add_argument("--port", type=int, default=PORT, help="fixed, so edits saved in the browser survive a restart")
    ap.add_argument("--dump", action="store_true", help="print the page data and exit, for checking")
    a = ap.parse_args()
    data = payload(load_program(), newest_export(a.export), newest_proposal(a.proposal))
    if a.dump:
        print(json.dumps(data, ensure_ascii=False, indent=1))
        return
    done = serve(data, port=a.port, open_browser=not a.no_open)
    print(f"Saved {done['path'].relative_to(ROOT)}")
    print(summary(done["sent"]))


if __name__ == "__main__":
    main()
