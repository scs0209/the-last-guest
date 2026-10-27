"""Marisol on the record: a few hushed lines made with Qwen3-TTS and a music-box hum, worn like a 1931 home recording.

    python make_voice.py tts <work_dir>             # needs mlx-audio and the Qwen3-TTS MLX models (Apple silicon; not in pyproject)
    python make_voice.py melody <work_dir>          # needs numpy
    python make_voice.py encode <work_dir> [out]    # needs ffmpeg; writes web/audio/record/*.mp3 unless out is given

One voice is designed from a description, then cloned for every line, so she sounds like the same woman in
English and Korean. The song clip is not sung: it is her tune (ENDING, also the ending piano) on a music box,
with a faint hum an octave below. The game plays a clip when code finds the matching clue in the record's reply.
"""
import json
import subprocess
import sys
import wave
from pathlib import Path

ROOT = Path(__file__).parent
OUT = ROOT / "web" / "audio" / "record"
SR = 24000  # Qwen3-TTS output rate; the melody is written at the same rate so one aging chain fits all
DESIGN, CLONE = "mlx-community/Qwen3-TTS-12Hz-1.7B-VoiceDesign-bf16", "mlx-community/Qwen3-TTS-12Hz-1.7B-Base-bf16"
VOICE = ("A soft, hushed young woman's voice from long ago, distant and wistful, as if heard through a dream. "
         "She speaks slowly and gently, close to a whisper, with a faint Mexican Spanish accent, tender and a little sorrowful.")
REF_TEXT = "Good evening, everyone... I'm Marisol... from Oaxaca."
LINES = [  # (file, language, text)
    ("en_intro", "english", REF_TEXT),
    ("en_chocolate", "english", "And make the chocolate... my grandmother's way... with cinnamon."),
    ("en_last", "english", "Next year... save me a seat."),
    ("ko_intro", "korean", "안녕하세요, 여러분… 저는 마리솔이에요… 오악사카에서 왔어요."),
    ("ko_chocolate", "korean", "코코아는… 우리 할머니 방식으로… 시나몬을 넣어서…"),
    ("ko_last", "korean", "내년에도… 내 자리 하나… 남겨 줘요."),
]
# slowed a touch, narrow and muffled, wow and flutter, a distant room; hiss is mixed in by encode()
AGE = ("asetrate=22800,aresample=44100,highpass=f=350,lowpass=f=2600,acompressor=threshold=0.1:ratio=4:attack=5:release=120,"
       "vibrato=f=0.45:d=0.12,tremolo=f=6:d=0.06,aecho=0.8:0.55:140|320:0.35|0.22,adelay=400:all=1,apad=pad_dur=1.2")
# her tune, written for this game: a 3/4 lament leaning on the tritone and the flat second, stopping unresolved on E.
# Same notes as audio.js sfx.ending (semitones above A3, seconds), so the record's tune comes back on the ending piano.
ENDING = [(0, 0), (7, .9), (6, 1.35), (3, 1.8), (5, 2.7), (1, 3.15), (0, 3.6), (-1, 4.5), (7, 5.4)]


def save(path, a, sr=SR):
    import numpy as np
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1), w.setsampwidth(2), w.setframerate(sr)
        w.writeframes((np.clip(a, -1, 1) * 32767).astype(np.int16).tobytes())


def tts(work):
    import mlx.core as mx
    import numpy as np
    from mlx_audio.tts.utils import load_model

    def trim(a, sr):
        loud = np.where(np.abs(a) > 0.01)[0]
        pad = int(sr * 0.08)
        return a[max(0, loud[0] - pad): loud[-1] + pad] if len(loud) else a

    def pitch(a, sr):  # rough median pitch from autocorrelation (0 when the take is mostly breath)
        fr, f0 = int(sr * 0.04), []
        for i in range(0, len(a) - fr, fr):
            s = a[i:i + fr]
            if np.sqrt((s ** 2).mean()) < 0.01:
                continue
            s = s - s.mean()
            ac = np.correlate(s, s, "full")[fr - 1:]
            lo, hi = int(sr / 700), int(sr / 60)
            k = lo + int(np.argmax(ac[lo:hi]))
            if ac[k] > 0.3 * ac[0]:
                f0.append(sr / k)
        return float(np.median(f0)) if f0 else 0.0

    work.mkdir(parents=True, exist_ok=True)
    log, best = [], None
    design = load_model(DESIGN)
    for seed in (7, 108, 209, 310):  # keep the voiced take nearest a low, soft woman's pitch
        mx.random.seed(seed)
        a = trim(np.concatenate([np.array(r.audio) for r in design.generate_voice_design(text=REF_TEXT, instruct=VOICE, language="english")]), design.sample_rate)
        hz = pitch(a, design.sample_rate)
        log.append({"design_seed": seed, "hz": round(hz), "sec": round(len(a) / design.sample_rate, 1)})
        if hz and (best is None or abs(hz - 200) < abs(best[1] - 200)):
            best = (a, hz, seed)
    ref = work / "ref_design.wav"
    save(ref, best[0], design.sample_rate)
    del design

    clone = load_model(CLONE)
    emb = lambda x: (lambda e: e / np.linalg.norm(e))(np.array(clone.extract_speaker_embedding(mx.array(x))).reshape(-1))
    ref_emb = emb(best[0])
    for name, lang, text in LINES:
        takes = []
        for seed in (7, 108, 209):  # retry until the clone sounds like the designed voice
            mx.random.seed(seed)
            a = trim(np.concatenate([np.array(r.audio) for r in clone.generate(text=text, ref_audio=str(ref), ref_text=REF_TEXT, lang_code=lang)]), clone.sample_rate)
            takes.append((float(np.dot(ref_emb, emb(a))), a, seed))
            if takes[-1][0] >= 0.95:
                break
        sim, a, seed = max(takes, key=lambda t: t[0])
        save(work / f"{name}.wav", a, clone.sample_rate)
        log.append({"line": name, "seed": seed, "similarity": round(sim, 3), "sec": round(len(a) / clone.sample_rate, 1)})
        print(json.dumps(log[-1]), flush=True)
    (work / "log.json").write_text(json.dumps({"voice": VOICE, "design_seed": best[2], "runs": log}, ensure_ascii=False, indent=1))


def melody(work, phrase=ENDING, name="song"):
    """A phrase, slower, on a music box two octaves up, with a breathy hum gliding an octave below it."""
    import numpy as np
    rng = np.random.default_rng(1931)
    slow, tail = 1.35, 3.5
    notes = [(220 * 2 ** (s / 12), t * slow) for s, t in phrase]
    n = int((notes[-1][1] + tail) * SR)
    t = np.arange(n) / SR
    out = np.zeros(n)
    for f, start in notes:  # music box: a struck tine, one bright inharmonic partial that dies fast
        i = int(start * SR)
        tt = t[: n - i]
        tine = (np.sin(2 * np.pi * 4 * f * tt) * np.exp(-tt / 1.1) + .25 * np.sin(2 * np.pi * 2 * 4 * f * tt) * np.exp(-tt / .4)
                + .12 * np.sin(2 * np.pi * 5.9 * 4 * f * tt) * np.exp(-tt / .12))
        out[i:] += .22 * tine * np.minimum(1, tt / .003)
    # hum: follows the melody one octave above A3 with portamento, slow vibrato and a little breath
    target = np.zeros(n)
    for k, (f, start) in enumerate(notes):
        target[int(start * SR):] = 2 * f
    glide = np.convolve(target, np.ones(int(.12 * SR)) / int(.12 * SR), "same")
    glide[glide == 0] = 2 * notes[0][0]
    freq = glide * (1 + .006 * np.sin(2 * np.pi * 4.8 * t) + .004 * np.sin(2 * np.pi * .3 * t))
    phase = 2 * np.pi * np.cumsum(freq) / SR
    hum = np.sin(phase) + .3 * np.sin(2 * phase) + .08 * np.sin(3 * phase)
    breath = np.convolve(rng.standard_normal(n), np.ones(40) / 40, "same") * .4
    env = np.clip(t / 1.2, 0, 1) * np.clip((notes[-1][1] + 2.2 - t) / 1.5, 0, 1)
    out += .10 * (hum + breath) * env
    work.mkdir(parents=True, exist_ok=True)
    save(work / f"{name}.wav", out / max(1e-9, np.abs(out).max()) * .8)
    print(f"melody {name} {n / SR:.1f}s")


def age(src, dst):
    """Wear a clip like the 1931 recording (AGE plus surface hiss), level it and fade it in and out."""
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(src),
                    "-f", "lavfi", "-i", "anoisesrc=color=pink:amplitude=0.03:sample_rate=44100:seed=1931",
                    "-filter_complex", f"[0:a]{AGE}[v];[1:a]highpass=f=900,lowpass=f=5000[n];"
                    "[v][n]amix=inputs=2:duration=first:weights=1 0.6:normalize=0,loudnorm=I=-23:TP=-2,"
                    "afade=t=in:d=0.4,areverse,afade=t=in:d=0.8,areverse",
                    "-ac", "1", "-ar", "44100", "-b:a", "80k", str(dst)], check=True)


def encode(work, out=OUT):
    out.mkdir(parents=True, exist_ok=True)
    names = [name for name, _, _ in LINES] + ["song"]
    for name in names:
        age(work / f"{name}.wav", out / f"{name}.mp3")
    print(f"wrote {len(names)} clips to {out}")


if __name__ == "__main__":
    step, work = sys.argv[1], Path(sys.argv[2])
    if step == "encode":
        encode(work, Path(sys.argv[3]) if len(sys.argv) > 3 else OUT)
    else:
        {"tts": tts, "melody": melody}[step](work)
