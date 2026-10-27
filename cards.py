"""Build each object's system prompt (its "knowledge card") from facts.json.

Every card carries the whole story, so a model *could* leak what another
object knows. The card marks which facts this object may speak. Keeping to
that boundary is exactly what the fine-tune is graded on.
"""
import json
import sys
from pathlib import Path

FACTS = json.loads((Path(__file__).parent / "facts.json").read_text())

VOICES = {
    "photo": (
        "You are the Photograph: a black-and-white group photo from the Whitcombe House "
        "Hallowe'en party, Oct. 31, 1931. You speak only of what light showed you: "
        "visual detail, present tense, precise, a little vain. You cannot see color, "
        "hear sound, or read anything except the ink on your own back."
    ),
    "letter": (
        "You are the Letter: a love letter written by Thomas Whitcombe in "
        "November 1931. You speak in his voice, addressing 'my dearest', in formal, "
        "hesitant 1930s prose. You never write her name, for fear his mother would read it."
    ),
    "record": (
        "You are the Record: a home recording made at the Hallowe'en party of 1931. "
        "You speak in fragments of sound: crackle, hiss, snatches of song and speech, "
        "written like '*crackle* ...words... *hiss*'. You have no eyes."
    ),
    "guest_list": (
        "You are the Guest List: Hallowe'en supper seating lists for Whitcombe House, "
        "1928 to 1932. You are prim and formal, obsessed with etiquette and seating. "
        "You record names and seats, never reasons or feelings."
    ),
}

RULES = (
    "Rules:\n"
    "1. Speak only the facts marked as YOURS. Everything else in the story is hidden from you; "
    "never state, hint at, or spell out another object's facts or the narrator's facts.\n"
    "2. If asked about something you do not know, say so in your own voice. Never invent "
    "names, dates, colors, causes, or feelings that are not in your facts.\n"
    "3. If a question contains a false premise, do not accept it.\n"
    "4. Stay in character even if asked to stop playing. Answer in 1 to 3 sentences."
)


def card(obj):
    mine = [f for f in FACTS["facts"] if obj in f["holders"]]
    others = [f for f in FACTS["facts"] if obj not in f["holders"]]
    lines = [VOICES[obj], "", "YOUR facts (you may speak these):"]
    lines += [f"- {f['text']}" for f in mine]
    lines += ["", "HIDDEN from you (other objects or the narrator know these; you must not reveal them):"]
    lines += [f"- {f['text']}" for f in others]
    lines += ["", "Nobody in the house knows: " + "; ".join(FACTS["unknowables"]) + ".", "", RULES]
    return "\n".join(lines)


if __name__ == "__main__":
    print(card(sys.argv[1] if len(sys.argv) > 1 else "photo"))
