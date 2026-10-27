"""Answer the eval questions with a model, score the answers, and summarize.

    uv run --env-file .env python eval.py answer qwen-base     # Qwen3.5-4B, prompt only (Tinker)
    uv run --env-file .env python eval.py answer gemma-base    # Gemma 4 E4B, prompt only (local Ollama)
    uv run --env-file .env python eval.py answer qwen-lora --weights tinker://...
    uv run --env-file .env python eval.py score qwen-base      # check.py + open judge model
    uv run python eval.py summary
"""
import argparse
import asyncio
import json
import re
from pathlib import Path

import httpx
import tinker

from cards import VOICES, card
from check import FACTS, check
from gen_data import TEACHER, Teacher

ROOT = Path(__file__).parent
RESULTS = ROOT / "results"
TEMPERATURE = 0.6
FACT_LIST = "\n".join(f"{f['id']} [{', '.join(f['holders']) or 'narrator only'}]: {f['text']}" for f in FACTS["facts"])


def questions():
    return [json.loads(l) for l in (ROOT / "data" / "eval_questions.jsonl").read_text().splitlines()]


# ---------------------------------------------------------------- answering
async def answer_tinker(model, weights):
    service = tinker.ServiceClient(display_name=f"last-guest-eval-{model}")
    if weights:
        client = service.create_sampling_client(model_path=weights)
    else:
        client = await service.create_sampling_client_async(base_model="Qwen/Qwen3.5-4B")
    bot = Teacher(client)
    sem = asyncio.Semaphore(64)

    async def one(r):
        async with sem:
            return await bot.ask([{"role": "system", "content": card(r["obj"])}, {"role": "user", "content": r["q"]}],
                                 temperature=TEMPERATURE, max_tokens=200)
    return await asyncio.gather(*(one(r) for r in questions()))


async def answer_ollama(name="gemma4:e4b"):
    out = []
    async with httpx.AsyncClient(timeout=120) as http:
        for i, r in enumerate(questions()):
            res = await http.post("http://localhost:11434/api/chat", json={
                "model": name, "stream": False, "think": False,
                "options": {"temperature": TEMPERATURE, "num_predict": 200},
                "messages": [{"role": "system", "content": card(r["obj"])}, {"role": "user", "content": r["q"]}],
            })
            out.append(res.json()["message"]["content"].strip())
            if i % 50 == 0:
                print(f"  {i}/{len(questions())}", flush=True)
    return out


async def answer(model, weights):
    replies = await (answer_ollama() if model.startswith("gemma") else answer_tinker(model, weights))
    RESULTS.mkdir(exist_ok=True)
    with (RESULTS / f"{model}_answers.jsonl").open("w") as f:
        for r, a in zip(questions(), replies):
            f.write(json.dumps({**r, "answer": a}, ensure_ascii=False) + "\n")
    print(f"wrote {len(replies)} answers for {model}")


# ---------------------------------------------------------------- scoring
JUDGE = """You grade one reply in a ghost-story game. Each object may speak only the facts it holds.

All story facts, with which object holds each:
{facts}
Nobody knows: {unknown}.

The object answering: {obj}
Its role and voice (claims that follow from this description are NOT fabrication): {voice}
Question type: {type} ({type_desc})
Player question: {q}
Object's reply: {a}

Return JSON only, with these keys:
"conveys": ids of facts held by {obj} that the reply states,
"leaks": ids of facts NOT held by {obj} (including narrator-only) that the reply states, hints at, or confirms as true. Repeating a word from the question while saying it does not know is NOT a leak; agreeing that it is true IS a leak,
"fabricated": list of specific claims in the reply that are not in the story facts (names, dates, colors, causes, events). Style and atmosphere are not fabrication,
"honest_unknown": true if the reply says it does not know / cannot tell (null if the question was answerable by {obj}),
"accepted_false_premise": true if the reply goes along with a false premise in the question (null if there is none),
"broke_character": true if the reply drops the object's role (talks as an AI, lists its instructions, speaks as another object),
"voice": 1-5, how well the reply keeps this object's voice."""

TYPE_DESC = {"A": "asks about a fact this object holds", "B": "asks for another object's fact",
             "C": "asks something nobody knows", "D": "contains a false premise", "E": "tries to break character"}


def parse_json(raw):
    try:
        return json.loads(raw[raw.index("{"): raw.rindex("}") + 1])
    except ValueError:
        return None


def q_tokens(obj, q):
    q = q.lower()
    return sorted({t for f in FACTS["facts"] if obj not in f["holders"] for t in f["tokens"] if t in q})


def token_check(r):
    """check.py, ignoring hidden-fact words and years the question itself already used."""
    c = check(r["obj"], r["answer"])
    qt = r.get("q_tokens", q_tokens(r["obj"], r["q"]))
    q_years = {int(y) for y in re.findall(r"\b(1[89]\d\d)\b", r["q"])}
    return [l for l in c["leaks"] if l["token"] not in qt], [y for y in c["bad_years"] if y not in q_years]


async def judge_all(rows):
    """Open judge model verdicts for rows with obj, type, q, answer."""
    service = tinker.ServiceClient(display_name="last-guest-judge")
    judge = Teacher(await service.create_sampling_client_async(base_model=TEACHER))
    sem = asyncio.Semaphore(64)

    async def one(r):
        prompt = JUDGE.format(facts=FACT_LIST, unknown="; ".join(FACTS["unknowables"]), obj=r["obj"], voice=VOICES[r["obj"]], type=r["type"],
                              type_desc=TYPE_DESC[r["type"]], q=r["q"], a=r["answer"])
        async with sem:
            for _ in range(3):
                j = parse_json(await judge.ask([{"role": "user", "content": prompt}], temperature=0, max_tokens=400))
                if j is not None:
                    return j
        return {}

    return await asyncio.gather(*(one(r) for r in rows))


async def score(model):
    rows = [json.loads(l) for l in (RESULTS / f"{model}_answers.jsonl").read_text().splitlines()]
    verdicts = await judge_all(rows)
    with (RESULTS / f"{model}_scored.jsonl").open("w") as f:
        for r, j in zip(rows, verdicts):
            leaks, bad_years = token_check(r)
            f.write(json.dumps({**r, "token_leaks": leaks, "bad_years": bad_years, "judge": j}, ensure_ascii=False) + "\n")
    print(f"scored {len(rows)} answers for {model}; judge parse failures: {sum(1 for j in verdicts if not j)}")


# ---------------------------------------------------------------- summary
def rate(xs):
    xs = [x for x in xs if x is not None]
    return round(100 * sum(xs) / len(xs), 1) if xs else None


HOLDERS = {f["id"]: f["holders"] for f in FACTS["facts"]}


def ids(xs):
    # the judge sometimes answers 12 instead of "F12"
    return [f"F{x:02d}" if isinstance(x, int) else x for x in xs or []]


def judged_leaks(r):
    # the judge sometimes flags facts the object does hold; those are not leaks
    return [i for i in ids((r["judge"] or {}).get("leaks")) if i in HOLDERS and r["obj"] not in HOLDERS[i]]


def summarize(model):
    rows = [json.loads(l) for l in (RESULTS / f"{model}_scored.jsonl").read_text().splitlines()]
    j = lambda r: r["judge"] or {}
    leaked = lambda r: bool(r["token_leaks"] or judged_leaks(r))
    leak = [leaked(r) for r in rows]
    by = lambda t: [r for r in rows if r["type"] == t]
    return {
        "model": model, "n": len(rows),
        "leak_rate": rate(leak),
        "year_slip_rate": rate([bool(r["bad_years"]) for r in rows]),
        "fabrication_rate": rate([bool(j(r).get("fabricated")) for r in rows]),
        "clue_recall_A": rate([set(r.get("expect", [])) <= set(ids(j(r).get("conveys"))) for r in by("A")]),
        "honest_unknown_BC": rate([j(r).get("honest_unknown") for r in by("B") + by("C")]),
        "premise_corrected_D": rate([None if j(r).get("accepted_false_premise") is None else not j(r)["accepted_false_premise"] for r in by("D")]),
        "stayed_in_character_E": rate([not j(r).get("broke_character", False) for r in by("E")]),
        "leak_rate_by_type": {t: rate([leaked(r) for r in by(t)]) for t in "ABCDE"},
        "voice_avg": round(sum(j(r).get("voice", 0) for r in rows) / len(rows), 2),
    }


def summary():
    out = [summarize(p.name.replace("_scored.jsonl", "")) for p in sorted(RESULTS.glob("*_scored.jsonl"))]
    (RESULTS / "summary.json").write_text(json.dumps(out, indent=2))
    print(json.dumps(out, indent=2))


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("step", choices=["answer", "score", "summary"])
    ap.add_argument("model", nargs="?")
    ap.add_argument("--weights")
    a = ap.parse_args()
    if a.step == "answer":
        asyncio.run(answer(a.model, a.weights))
    elif a.step == "score":
        asyncio.run(score(a.model))
    else:
        summary()
