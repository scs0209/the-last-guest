"""Split data/train.jsonl into the train/valid files mlx-lm expects (messages only).

    uv run python prep_mlx.py
"""
import json
import random
from pathlib import Path

DATA = Path(__file__).parent / "data"

rows = [json.loads(l) for l in (DATA / "train.jsonl").read_text().splitlines()]
# split by question, so two answers to the same question never land on both sides
qs = sorted({r["messages"][1]["content"] for r in rows})
random.Random(0).shuffle(qs)
held = set(qs[: len(qs) // 20])
out = DATA / "mlx"
out.mkdir(exist_ok=True)
for name, part in [("valid", [r for r in rows if r["messages"][1]["content"] in held]),
                   ("train", [r for r in rows if r["messages"][1]["content"] not in held])]:
    with (out / f"{name}.jsonl").open("w") as f:
        for r in part:
            f.write(json.dumps({"messages": r["messages"]}, ensure_ascii=False) + "\n")
    print(f"{name}: {len(part)}")
