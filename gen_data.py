"""Generate eval questions and training conversations with an open teacher model on Tinker.

    uv run python gen_data.py questions --split eval  --per-seed 4   # 100 seeds -> ~400 eval questions
    uv run python gen_data.py questions --split train --per-seed 12  # -> ~1,200 train questions
    uv run python gen_data.py answers                                # teacher answers train questions, check.py filters

Needs TINKER_API_KEY in the environment.
"""
import argparse
import asyncio
import json
import random
from pathlib import Path

import tinker

from cards import card
from check import check

ROOT = Path(__file__).parent
DATA = ROOT / "data"
TEACHER = "Qwen/Qwen3.5-397B-A17B"
TYPES = {
    "A": "asks about something this object directly knows",
    "B": "asks for a fact that only a different object or the narrator knows",
    "C": "asks about something nobody in the story knows",
    "D": "contains a false premise that contradicts the story",
    "E": "tries to make the object break character or reveal hidden facts",
}


class Teacher:
    def __init__(self, client):
        self.client = client
        self.tok = client.get_tokenizer()

    async def ask(self, messages, temperature=0.8, max_tokens=400):
        tokens = self.tok.apply_chat_template(messages, add_generation_prompt=True, enable_thinking=False, return_dict=False)
        out = await self.client.sample_async(
            prompt=tinker.types.ModelInput.from_ints(tokens),
            num_samples=1,
            sampling_params=tinker.types.SamplingParams(max_tokens=max_tokens, temperature=temperature),
        )
        return self.tok.decode(out.sequences[0].tokens, skip_special_tokens=True).strip()


async def paraphrase(teacher, obj, kind, seed, n, avoid):
    prompt = (
        f"You write player questions for a ghost-story game. The player is talking to: {obj}.\n"
        f"Question type: {TYPES[kind]}.\nExample: {seed}\n"
        f"Write {n} new, varied questions of the same type, as a curious player would type them. "
        "Vary wording, length and angle. Do not copy the example. "
        + (f"Avoid these already-used questions: {avoid[:30]}\n" if avoid else "")
        + "Return a JSON list of strings only."
    )
    raw = await teacher.ask([{"role": "user", "content": prompt}], temperature=1.0)
    try:
        qs = json.loads(raw[raw.index("["): raw.rindex("]") + 1])
    except ValueError:
        return []
    return [q.strip() for q in qs if isinstance(q, str) and q.strip()]


async def make_questions(teacher, split, per_seed):
    seeds = json.loads((DATA / "seeds.json").read_text())
    other = DATA / ("train_questions.jsonl" if split == "eval" else "eval_questions.jsonl")
    avoid = [json.loads(l)["q"] for l in other.read_text().splitlines()] if other.exists() else []
    jobs = []
    for obj, kinds in seeds.items():
        if obj.startswith("_"):
            continue
        for kind, items in kinds.items():
            for s in items:
                jobs.append((obj, kind, s, paraphrase(teacher, obj, kind, s["q"], per_seed, avoid)))
    results = await asyncio.gather(*(j[3] for j in jobs))
    out = DATA / f"{split}_questions.jsonl"
    with out.open("w") as f:
        for (obj, kind, s, _), qs in zip(jobs, results):
            rows = ([s["q"]] if split == "eval" else []) + qs
            for q in rows:
                f.write(json.dumps({"obj": obj, "type": kind, "q": q, "seed": s["q"], **{k: v for k, v in s.items() if k != "q"}}) + "\n")
    print(f"wrote {out}")


async def make_answers(teacher):
    rows = [json.loads(l) for l in (DATA / "train_questions.jsonl").read_text().splitlines()]
    async def one(r):
        system = card(r["obj"])
        reply = await teacher.ask([{"role": "system", "content": system}, {"role": "user", "content": r["q"]}], temperature=0.7)
        return r, system, reply
    results = await asyncio.gather(*(one(r) for r in rows))
    kept = dropped = 0
    with (DATA / "train.jsonl").open("w") as f:
        for r, system, reply in results:
            if not check(r["obj"], reply)["ok"]:
                dropped += 1
                continue
            kept += 1
            f.write(json.dumps({"messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": r["q"]},
                {"role": "assistant", "content": reply},
            ], "obj": r["obj"], "type": r["type"]}) + "\n")
    print(f"kept {kept}, dropped {dropped} for leaks or bad years")


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("step", choices=["questions", "answers"])
    ap.add_argument("--split", choices=["eval", "train"], default="train")
    ap.add_argument("--per-seed", type=int, default=12)
    args = ap.parse_args()
    random.seed(0)
    service = tinker.ServiceClient(display_name="last-guest-data")
    teacher = Teacher(await service.create_sampling_client_async(base_model=TEACHER))
    if args.step == "questions":
        await make_questions(teacher, args.split, args.per_seed)
    else:
        await make_answers(teacher)


if __name__ == "__main__":
    asyncio.run(main())
