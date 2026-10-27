"""Export the harness (fact graph, prompts, guardrail words, cached answers) for the in-browser version.

The Python server stays the single source of truth; this writes what the browser needs into web/gen/.
Run it after changing facts.json, cards.py, server.py or the answer cache, and commit the output.

    uv run python build_web.py
"""
import json
from pathlib import Path

import server
from cards import VOICES
from check import FACTS

ROOT = Path(__file__).parent
OUT = ROOT / "web" / "gen"


def main():
    OUT.mkdir(exist_ok=True)
    harness = {
        "facts": FACTS["facts"],
        "unknowables": FACTS["unknowables"],
        "allowedYears": {k: v["allowed_years"] for k, v in FACTS["objects"].items()},
        "voices": VOICES,
        "rules": server.RULES,
        "keyLines": server.KEY_LINES,
        "progress": server.PROGRESS,
        "fallback": server.FALLBACK,
        "reminder": server.REMINDER,
        "korean": server.KOREAN,
        "denial": server.DENIAL.pattern,
    }
    (OUT / "harness.json").write_text(json.dumps(harness, ensure_ascii=False, indent=1))
    cache = json.loads((ROOT / "data" / "answer_cache.json").read_text())
    (OUT / "answer_cache.json").write_text(json.dumps(cache, ensure_ascii=False))
    print(f"wrote {OUT}/harness.json and answer_cache.json")


if __name__ == "__main__":
    main()
