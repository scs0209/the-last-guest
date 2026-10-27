"""Serve the game and let the four objects answer with a local model (Gemma 4 E4B via Ollama).

    uv run python server.py            # http://localhost:8765
    HOST=0.0.0.0 PORT=10000 OLLAMA_URL=http://localhost:11434 python server.py   # hosted (see Dockerfile)

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
import os
import random
import re
import threading
import time
from collections import defaultdict, deque
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import httpx

from cards import VOICES
from check import FACTS, check, revealed

ROOT = Path(__file__).parent
MODEL = os.environ.get("MODEL", "gemma4:e4b")
OLLAMA = os.environ.get("OLLAMA_URL", "http://localhost:11434") + "/api/chat"
HOST = os.environ.get("HOST", "127.0.0.1")
PORT = int(os.environ.get("PORT", "8765"))
# Pre-generated Gemma answers to the suggested questions (make_cache.py), so a CPU-only host stays playable.
CACHE = json.loads((ROOT / "data" / "answer_cache.json").read_text()) if (ROOT / "data" / "answer_cache.json").exists() else {}
LIVE_PER_IP = int(os.environ.get("LIVE_PER_IP", "30"))  # live model calls per visitor per 10 minutes
LIVE_QUEUE = int(os.environ.get("LIVE_QUEUE", "4"))     # callers allowed to wait for the one model slot

LANGS = ("en", "ko")
FALLBACK = {
    "en": {
        "photo": "That never stood in front of my lens. I will not make it up.",
        "letter": "My writer never set that down. I hold only what he felt, and he did not know it.",
        "record": "*hiss* …*the needle skips*… that was never sung into me.",
        "guest_list": "That is not recorded here. A list keeps seats, not stories.",
    },
    "ko": {
        "photo": "그건 제 렌즈 앞에 선 적이 없어요. 지어내지는 않겠어요.",
        "letter": "그는 그 일을 적지 않았소. 나는 그가 느낀 것만 품고 있고, 그는 그것을 알지 못했소.",
        "record": "*치이익* …*바늘이 튄다*… 그런 소리는 내게 새겨진 적이 없어…",
        "guest_list": "그것은 여기 기록되어 있지 않습니다. 명부는 자리를 적을 뿐, 사연은 적지 않지요.",
    },
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
# The clues the ending depends on, as lines each object can quote word for word.
# Keyed by fact id so only the fact's holder ever sees the line (checked at import below).
KEY_LINES = {
    "en": {
        "photo": {"F07": "Where the pianist's face should be, someone has scratched the silver away."},
        "letter": {"F11": "We were secretly engaged, you and I.",
                   "F12": "Mother forbade our engagement and sent you away."},
        "record": {"F01": "*crackle* ...good evening, everyone... I'm Marisol, from Oaxaca... *applause*",
                   "F17": "*crackle* ...hot chocolate my grandmother's way, with cinnamon... *laughter*"},
        "guest_list": {"F02": "Seat 7, the piano bench: Miss M. Vega, pianoforte."},
    },
    "ko": {
        "photo": {"F07": "피아노 앞 여인의 얼굴이 있어야 할 자리를, 누군가 긁어 은빛을 벗겨 냈어요."},
        "letter": {"F11": "우리는 남몰래 약혼한 사이였소, 그대와 나는.",
                   "F12": "어머니께서 우리 약혼을 반대하셨고, 그대를 떠나보내셨소."},
        "record": {"F01": "*지직* …안녕하세요, 여러분… 저는 마리솔이에요, 오악사카에서 왔어요… *박수*",
                   "F17": "*지직* …코코아는 우리 할머니 방식으로, 시나몬을 넣어서… *웃음소리*"},
        "guest_list": {"F02": "7번 좌석, 피아노 의자: M. 베가 양, 피아노포르테."},
    },
}
HOLDERS = {f["id"]: f["holders"] for f in FACTS["facts"]}
for _lang in LANGS:
    for _obj, _lines in KEY_LINES[_lang].items():
        assert all(_obj in HOLDERS[i] and check(_obj, t)["ok"] for i, t in _lines.items()), (_lang, _obj)

# Looser word stems that count as conveying an object's OWN fact, so free-form replies can move the game.
# Leak checks still use the strict tokens in facts.json.
PROGRESS = {
    "F07": ["scratch", "scrap", "no face", "face is gone", "faceless", "obscur", "erase", "erasure", "dark patch",
            "defaced", "rubbed away"],
    "F11": ["engag", "betroth", "marr", "promised to one another", "ring", "pledged", "vows"],
    "F12": ["forb", "mother", "not permissible", "sent away"],
    "F13": ["mrs. whitcombe"],
    "F14": ["empty", "save your place", "keep your place"],
    "F15": ["next year"],
    "F18": ["struck", "crossed", "line through", "lined out"],
}
# Korean stems for the same purpose (never match English text, so the English eval is unaffected).
for _fid, _stems in {
    "F05": ["피아노"], "F07": ["긁", "지워", "벗겨", "얼굴이 없"], "F11": ["약혼", "정혼", "혼약"],
    "F12": ["반대", "금지", "어머니"], "F13": ["휘트컴 부인"], "F14": ["비워", "빈자리"], "F15": ["내년"],
    "F17": ["코코아"], "F18": ["줄이 그", "줄을 그", "그어져"],
}.items():
    PROGRESS[_fid] = PROGRESS.get(_fid, []) + _stems
REMINDER = ("Your last answer mentioned things you cannot know. Answer again using only your facts, "
            "or say in your own voice that you cannot know.")
KOREAN = ("Answer in natural Korean, in your own voice. Write these names exactly as given: {glossary}. "
          "Do not use any other name or term from outside your facts.")


def scoped_card(obj, lang="en"):
    """System prompt with only this object's own facts: the graph decides what it may see."""
    own = [f for f in FACTS["facts"] if obj in f["holders"]]
    lines = [f"- {t}" for t in KEY_LINES[lang].get(obj, {}).values()]
    parts = [VOICES[obj], "", "YOUR facts (when asked, say them plainly, in their own words, then add your voice):",
             *[f"- {f['text']}" for f in own], "",
             "Lines you hold word for word (when asked about these, say the line itself):", *lines, "",
             "Nobody in the house knows: " + "; ".join(FACTS["unknowables"]) + ".", "", RULES]
    if lang == "ko":
        # only the names this object already holds, so the glossary cannot leak another object's facts
        glossary = "; ".join(f["glossary_ko"] for f in own if f.get("glossary_ko"))
        parts += ["", KOREAN.format(glossary=glossary or "none")]
    return "\n".join(parts)


def chat(messages):
    res = httpx.post(OLLAMA, timeout=300, json={
        "model": MODEL, "stream": False, "think": False, "messages": messages,
        "options": {"temperature": 0.6, "num_predict": 160},
    })
    return res.json()["message"]["content"].strip()


DENIAL = re.compile(r"\b(not|cannot|can't|never|no|don't|unknown|nothing)\b|모르|몰라|없|못|않")


def guard_check(obj, q, say):
    """check.py, except a hidden word or year the player already used may be echoed while denying it."""
    c = check(obj, say)
    # a denial must come from the reply itself, not from inside a hidden-fact phrase ("부치지 못" contains 못)
    rest = say.lower()
    for l in c["leaks"]:
        rest = rest.replace(l["token"], " ")
    if DENIAL.search(rest):
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


def answer(obj, q, history, lang="en"):
    messages = [{"role": "system", "content": scoped_card(obj, lang)}]
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
    return {"say": FALLBACK[lang][obj], "reveals": [], "guard": guard}


BUSY = {
    "en": {"tired": "The spirits are tired. Try a suggested question, or ask again in a few minutes.",
           "crowd": "Too many voices at once. Try a suggested question, or ask again shortly."},
    "ko": {"tired": "영혼들이 지쳤어요. 추천 질문을 고르거나, 몇 분 뒤에 다시 물어보세요.",
           "crowd": "너무 많은 목소리가 한꺼번에 들려요. 추천 질문을 고르거나, 잠시 뒤에 다시 물어보세요."},
}
_slot = threading.Semaphore(1)  # one live generation at a time; a CPU cannot do two quickly
_waiting = 0
_lock = threading.Lock()
_calls = defaultdict(deque)


def live_allowed(ip):
    now = time.time()
    with _lock:
        calls = _calls[ip]
        while calls and now - calls[0] > 600:
            calls.popleft()
        if len(calls) >= LIVE_PER_IP:
            return False
        calls.append(now)
        return True


def live_answer(obj, q, history, lang):
    global _waiting
    with _lock:
        if _waiting >= LIVE_QUEUE:
            return None
        _waiting += 1
    try:
        with _slot:
            return answer(obj, q, history, lang)
    finally:
        with _lock:
            _waiting -= 1


def clean_history(raw):
    if not isinstance(raw, list):
        return []
    return [{"q": str(h["q"])[:300], "a": str(h["a"])[:600]} for h in raw[-6:]
            if isinstance(h, dict) and "q" in h and "a" in h]


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(ROOT / "web"), **kw)

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")  # revalidate, so a redeploy is picked up at once
        super().end_headers()

    def do_GET(self):
        if self.path == "/healthz":
            return self.send_json({"ok": True, "model": MODEL, "cached_questions": sum(len(qs) for objs in CACHE.values() for qs in objs.values())})
        return super().do_GET()

    def send_json(self, out, status=200):
        data = json.dumps(out, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_POST(self):
        if self.path != "/api/ask":
            return self.send_error(404)
        size = int(self.headers.get("Content-Length") or 0)
        if not 0 < size <= 20000:
            return self.send_error(413)
        try:
            body = json.loads(self.rfile.read(size))
        except ValueError:
            return self.send_error(400)
        obj, q = body.get("obj"), str(body.get("q", "")).strip()[:300]
        lang = body.get("lang") if body.get("lang") in LANGS else "en"
        if obj not in VOICES or not q:
            return self.send_error(400)
        cached = CACHE.get(lang, {}).get(obj, {}).get(q)
        if cached:
            # among the pre-written answers, prefer those that carry the most clues, so a suggested question never stalls the game
            best = max(len(c["reveals"]) for c in cached)
            return self.send_json({**random.choice([c for c in cached if len(c["reveals"]) == best]), "guard": [], "cached": True})
        ip = (self.headers.get("X-Forwarded-For") or self.client_address[0]).split(",")[0].strip()
        if not live_allowed(ip):
            return self.send_json({"busy": BUSY[lang]["tired"]}, 429)
        try:
            out = live_answer(obj, q, clean_history(body.get("history")), lang)
        except httpx.HTTPError:
            return self.send_error(503, "model unavailable")
        if out is None:
            return self.send_json({"busy": BUSY[lang]["crowd"]}, 503)
        if out["guard"]:
            print(f"guard {obj}: {out['guard']}", flush=True)
        self.send_json({**out, "cached": False})


if __name__ == "__main__":
    print(f"The Last Guest on http://{HOST}:{PORT} (objects speak through {MODEL}; {sum(len(qs) for objs in CACHE.values() for qs in objs.values())} cached questions)")
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
