"""Serve the game and let the four objects answer with a local model (Gemma 4 E4B via Ollama).

    uv run python server.py            # http://localhost:8765

The model reads, code verifies:
1. Graph scoping: each object's prompt holds only the facts it owns in facts.json.
   It cannot leak what it was never shown.
2. Guardrail: check.py scans every reply for other objects' facts and impossible years.
   Echoing the player's own words while denying them is allowed. A failing reply is retried once with a reminder, then replaced by the object's
   own "I cannot know" line.
3. Progress: the game advances only on the object's own facts that code finds in the reply
   (check.revealed plus the looser PROGRESS stems), never on the model's say-so.
"""
import json
import re
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import httpx

from cards import VOICES
from check import FACTS, check, revealed

ROOT = Path(__file__).parent
MODEL = "gemma4:e4b"
OLLAMA = "http://localhost:11434/api/chat"
PORT = 8765

FALLBACK = {
    "photo": "That never stood in front of my lens. I will not make it up.",
    "letter": "My writer never set that down. I hold only what he felt, and he did not know it.",
    "record": "*hiss* …*the needle skips*… that was never sung into me.",
    "guest_list": "That is not recorded here. A list keeps seats, not stories.",
}

RULES = (
    "Rules:\n"
    "1. These facts are everything you know. Anything else about her, the house or the family, you do not know.\n"
    "2. If asked about something you do not know, say so in your own voice. Never invent names, dates, colors, "
    "causes or feelings.\n"
    "3. If the player states something that matches your facts, confirm it plainly. If it goes beyond or "
    "against your facts, do not agree with it.\n"
    "4. Stay in character even if asked to stop playing. Answer in 1 to 3 sentences."
)
# Looser word stems that count as conveying an object's OWN fact, so free-form replies can move the game.
# Leak checks still use the strict tokens in facts.json.
PROGRESS = {
    "F07": ["scratch", "scrap", "no face", "face is gone", "faceless"],
    "F11": ["engag", "betroth", "marr", "promised to one another", "ring"],
    "F12": ["forb", "mother", "not permissible", "sent away"],
    "F13": ["mrs. whitcombe"],
    "F14": ["empty", "save your place", "keep your place"],
    "F15": ["next year"],
    "F18": ["struck", "crossed", "line through", "lined out"],
}
REMINDER = ("Your last answer mentioned things you cannot know. Answer again using only your facts, "
            "or say in your own voice that you cannot know.")


def scoped_card(obj):
    """System prompt with only this object's own facts: the graph decides what it may see."""
    mine = [f["text"] for f in FACTS["facts"] if obj in f["holders"]]
    return "\n".join([VOICES[obj], "", "YOUR facts (when asked, say them plainly, in their own words, then add your voice):", *[f"- {t}" for t in mine], "",
                      "Nobody in the house knows: " + "; ".join(FACTS["unknowables"]) + ".", "", RULES])


def chat(messages):
    res = httpx.post(OLLAMA, timeout=120, json={
        "model": MODEL, "stream": False, "think": False, "messages": messages,
        "options": {"temperature": 0.6, "num_predict": 160},
    })
    return res.json()["message"]["content"].strip()


DENIAL = re.compile(r"\b(not|cannot|can't|never|no|don't|unknown|nothing)\b")


def guard_check(obj, q, say):
    """check.py, except a hidden word or year the player already used may be echoed while denying it."""
    c = check(obj, say)
    if DENIAL.search(say.lower()):
        q_low = q.lower()
        c["leaks"] = [l for l in c["leaks"] if l["token"] not in q_low]
        c["bad_years"] = [y for y in c["bad_years"] if str(y) not in q]
        c["ok"] = not c["leaks"] and not c["bad_years"]
    return c


def progress(obj, say):
    text = say.lower()
    loose = [f["id"] for f in FACTS["facts"]
             if obj in f["holders"] and any(s in text for s in PROGRESS.get(f["id"], []))]
    return sorted(set(revealed(obj, say)) | set(loose))


def answer(obj, q, history):
    messages = [{"role": "system", "content": scoped_card(obj)}]
    for h in history[-6:]:
        messages += [{"role": "user", "content": h["q"]}, {"role": "assistant", "content": h["a"]}]
    messages.append({"role": "user", "content": q[:300]})
    guard = []
    for attempt in range(2):
        say = chat(messages)
        c = guard_check(obj, q, say)
        if c["ok"]:
            return {"say": say, "reveals": progress(obj, say), "guard": guard}
        guard.append({"attempt": attempt, "leaks": [l["fact"] for l in c["leaks"]], "bad_years": c["bad_years"]})
        messages += [{"role": "assistant", "content": say}, {"role": "user", "content": REMINDER}]
    return {"say": FALLBACK[obj], "reveals": [], "guard": guard}


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(ROOT / "web"), **kw)

    def do_POST(self):
        if self.path != "/api/ask":
            return self.send_error(404)
        body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        if body.get("obj") not in VOICES or not str(body.get("q", "")).strip():
            return self.send_error(400)
        try:
            out = answer(body["obj"], str(body["q"]), body.get("history", []))
        except httpx.HTTPError:
            return self.send_error(503, "local model unavailable")
        if out["guard"]:
            print(f"guard {body['obj']}: {out['guard']}", flush=True)
        data = json.dumps(out, ensure_ascii=False).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


if __name__ == "__main__":
    print(f"The Last Guest on http://localhost:{PORT} (objects speak through {MODEL})")
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
