"""Drop training questions that duplicate each other or sit too close to an eval question.

Uses the local embeddinggemma model through Ollama, so no question text leaves the machine.

    uv run python dedupe.py --threshold 0.9
"""
import argparse
import json
from pathlib import Path

import httpx
import numpy as np

DATA = Path(__file__).parent / "data"


def embed(texts):
    vecs = []
    for i in range(0, len(texts), 64):
        r = httpx.post("http://localhost:11434/api/embed", json={"model": "embeddinggemma", "input": texts[i:i + 64]}, timeout=120)
        vecs += r.json()["embeddings"]
    v = np.array(vecs, dtype=np.float32)
    return v / np.linalg.norm(v, axis=1, keepdims=True)


def main(threshold):
    train = [json.loads(l) for l in (DATA / "train_questions.jsonl").read_text().splitlines()]
    evalq = [json.loads(l) for l in (DATA / "eval_questions.jsonl").read_text().splitlines()]
    seen, uniq = set(), []
    for r in train:
        k = r["q"].strip().lower()
        if k not in seen:
            seen.add(k)
            uniq.append(r)
    tv, ev = embed([r["q"] for r in uniq]), embed([r["q"] for r in evalq])
    near_eval = (tv @ ev.T).max(axis=1)
    kept, dropped = [], 0
    kept_vecs = []
    for r, v, ne in zip(uniq, tv, near_eval):
        if ne >= threshold or (kept_vecs and max(float(v @ k) for k in kept_vecs) >= threshold):
            dropped += 1
            continue
        kept.append(r)
        kept_vecs.append(v)
    with (DATA / "train_questions.jsonl").open("w") as f:
        for r in kept:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    print(f"{len(train)} -> exact-unique {len(uniq)} -> kept {len(kept)} (dropped {dropped} at cosine >= {threshold})")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--threshold", type=float, default=0.9)
    main(ap.parse_args().threshold)
