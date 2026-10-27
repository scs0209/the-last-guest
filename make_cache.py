"""Pre-generate Gemma's answers to the game's suggested questions, for the hosted (CPU-only) version.

Every answer goes through the same harness as live play (server.answer): scoped card, check.py
guardrail, code-detected progress. Fallback answers are dropped so the cache holds real replies only.

    uv run python make_cache.py --lang en --variants 3     # updates data/answer_cache.json
    uv run python make_cache.py --lang ko --variants 3
"""
import argparse
import json
from pathlib import Path

import server

ROOT = Path(__file__).parent
CACHE = ROOT / "data" / "answer_cache.json"


def suggested_questions(lang):
    content = json.loads((ROOT / "web" / "content.json").read_text())
    return {obj: o["chips"] for obj, o in content[lang]["objects"].items()}


def main(lang, variants):
    cache = json.loads(CACHE.read_text()) if CACHE.exists() else {}
    cache[lang] = {}
    for obj, qs in suggested_questions(lang).items():
        for q in qs:
            replies = [server.answer(obj, q, [], lang) for _ in range(variants)]
            kept = [{"say": r["say"], "reveals": r["reveals"]} for r in replies if r["say"] != server.FALLBACK[lang][obj]]
            cache[lang].setdefault(obj, {})[q] = kept
            print(f"{obj:10s} {len(kept)}/{variants}  {q}  reveals {[r['reveals'] for r in kept]}", flush=True)
    CACHE.write_text(json.dumps(cache, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--lang", choices=server.LANGS, default="en")
    ap.add_argument("--variants", type=int, default=3)
    a = ap.parse_args()
    main(a.lang, a.variants)
