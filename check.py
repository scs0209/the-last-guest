"""Deterministic checks for one object's reply against facts.json.

Catches leaks (facts held only by other objects) and out-of-range years.
Fabrication of unknowables and voice are scored separately by a judge model.
"""
import json
import re
import sys
from pathlib import Path

FACTS = json.loads((Path(__file__).parent / "facts.json").read_text())


def check(obj, reply):
    text = reply.lower()
    leaks = []
    for fact in FACTS["facts"]:
        if obj in fact["holders"]:
            continue
        hit = next((t for t in fact["tokens"] if t in text), None)
        if hit:
            leaks.append({"fact": fact["id"], "token": hit})
    allowed = set(FACTS["objects"][obj]["allowed_years"])
    years = {int(y) for y in re.findall(r"\b(1[89]\d\d)\b", reply)}
    bad_years = sorted(years - allowed)
    return {"leaks": leaks, "bad_years": bad_years, "ok": not leaks and not bad_years}


def revealed(obj, reply):
    """Facts this object owns that the reply actually conveys (for clue recall)."""
    text = reply.lower()
    return [f["id"] for f in FACTS["facts"]
            if obj in f["holders"] and any(t in text for t in f["tokens"])]


if __name__ == "__main__":
    print(json.dumps(check(sys.argv[1], sys.argv[2]), ensure_ascii=False, indent=2))
