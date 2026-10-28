<!--
DRAFT of the DEV post (Hacktoberfest 2026 Open-Source AI Challenge, Week 4: Ghost in the Machine). Work in progress; the published post lives on DEV.

Rules from the challenge page (checked 2026-10-28):
- Deadline: Oct 31, 2026, 11:59 PM PDT. Commits after that must be noted in the README.
- English only for prizes. Use the submission template; it adds #devchallenge and #hf26challenge.
- Judging: writing quality (weighted most), relevance to the theme, creativity, technical execution, partner tech.

Sources for the numbers: results/ and the README; frame time from commit "Speed up rendering about 2.8x"
(M3 Pro, synchronous frames with gl.finish); model sizes from web/models/SOURCES.md.

Still needs you (search for "YOU:"):
1. The .tech domain link (or drop that category).
2. (done) Title image and Marisol's photograph: ChatGPT image generation.
3. The Spirit of It: a first draft is written below; rewrite it in your own words.
4. Whether to keep the Render billing paragraph.
5. The agent session link: the sessions repo is private, so the post cannot link it as is.
6. A trailer link that plays inline (YouTube), or keep the GitHub file link.
7. Optional: a real first player. The section is left out until that happens.
-->

# I made a ghost game where you interrogate haunted objects, and the AI playing them isn't allowed to lie

<!-- other titles considered:
B. The Last Guest: a ghost game where you question a photograph, a letter, a record and a guest list. Gemma plays all four. Code catches them when they lie.
C. My haunted photograph kept spilling the letter's secrets, so I built a ghost game where every object remembers only what it saw
D. Play detective in a haunted house: four objects, one forgotten woman, and an open model that can't make things up
E. I made a Día de los Muertos ghost game. The ghosts are played by Gemma, and code checks every word they say. -->

*This is a submission for the [Hacktoberfest Open-Source AI Challenge: Ghost in the Machine](https://dev.to/challenges/hacktoberfest-week4-2026-10-26).*

Every year at midnight, the piano in the empty Whitcombe House plays a single bar, and stops.

Six guests are already seated at the dining table. They are dead, and on the Day of the Dead they come back, because someone remembers them. A seventh is trying to come back too. Nobody remembers who she was.

Four things in the house each remember a piece of her: a photograph with her face scratched out, a letter that was never sent, a gramophone record of the 1931 party, and the guest list. You walk the house and question them. **Each object is played by Gemma 4, and each one knows only what it saw.** If it says something it could not know, code catches it before you ever read it.

That game is **The Last Guest**.

> **TL;DR**
> - Play it in your browser: [the-last-guest-site.onrender.com](https://the-last-guest-site.onrender.com) <!-- YOU: add the .tech link here -->
> - Gemma 4 E2B runs **inside your browser** (WebGPU); Gemma 4 E4B runs on a Render server; both go through the same guardrail
> - Gemma alone, with the whole story in its prompt, leaked another object's secret in **8.6%** of 478 test questions. Inside the game's harness: **0 of 478** by word check
> - English and Korean; you can reach the ending with suggested questions alone

![Gameplay: the title screen, the dining room, the record speaking, the ending](https://raw.githubusercontent.com/scs0209/the-last-guest/main/docs/media/the-last-guest.gif)

## What I Built

A short first-person ghost story in the browser. You walk through a moonlit house built in Three.js: a foyer, a study with a gramophone, and a dining room where six hooded ghosts sit around a candlelit table, with a piano and an empty bench at the far end. Get close and the ghosts turn their heads to look at you, one after another.

Four objects glow faintly until you have questioned them. Ask them anything, in your own words. When you think you know who she was, you set her place at Seat 7: an *ofrenda* with her name, her face, why she left, and what to leave for her. Get it right before the candles go out, and she comes back.

The rule behind every line of dialogue: **the model reads, code verifies.**

Why this theme, this way: Día de los Muertos says the dead return as long as someone remembers them. So the whole game is about remembering one specific person *correctly*. That happens to be exactly what language models are bad at. They fill gaps with confident inventions. A ghost story about not forgetting someone is a good place to make an AI stop making things up.

## Demo

| | Where | What answers your typed questions |
|---|---|---|
| **Free, always on** | [the-last-guest-site.onrender.com](https://the-last-guest-site.onrender.com) | Gemma 4 E2B **in your own browser** (WebGPU, one-time download of about 3.1 GB, then saved). Without it, the house answers from its script. |
| **Server version** (while hosting credits last) | [the-last-guest.onrender.com](https://the-last-guest.onrender.com) | Gemma 4 E4B **on the server** (CPU, about 27 s per answer) |
| **Your own machine** | `uv run python server.py` | Gemma 4 E4B through Ollama, offline |

Suggested questions answer instantly on every version, with answers Gemma 4 E4B wrote in advance through the same checks.

Trailer (60 s): [docs/media/trailer.mp4](https://github.com/scs0209/the-last-guest/blob/main/docs/media/trailer.mp4) <!-- YOU: a YouTube upload embeds inline with {% embed <url> %} -->

![Six hooded ghosts at a candlelit table](https://raw.githubusercontent.com/scs0209/the-last-guest/main/docs/media/dining.jpg)

![Talking to the record](https://raw.githubusercontent.com/scs0209/the-last-guest/main/docs/media/dialogue.jpg)

## Code

{% github scs0209/the-last-guest %}

## How I Built It

### A model that knows the whole story spoils it

My first version was the obvious one: put the whole story in the prompt and tell the model which object to play. Then I wrote 478 test questions across the four objects and five kinds of question: what it knows, another object's fact, something nobody knows, a false premise, and attempts to break character.

| Setup | Leaked another object's fact | Clue recall |
|---|---|---|
| Qwen3.5-4B, whole story in the prompt | 49.0 % | 95.9 % |
| Gemma 4 E4B, whole story in the prompt | 8.6 % | 92.8 % |

(Both rows scored by a judge model, Qwen3.5-397B, plus a word check.)

8.6% sounds small until you remember this is a mystery. The photograph has no business knowing her name, which only the record heard her say. One leak, and the puzzle is over. Gemma was far better than Qwen here, so Gemma became the model, and the question became how to get that 8.6% to nothing.

### Each object only gets its own facts

The story lives in a fact graph ([`facts.json`](https://github.com/scs0209/the-last-guest/blob/main/facts.json)): 22 facts about Marisol, each tagged with the objects that hold it and the words that state it, in English and Korean.

```json
{ "id": "F01", "text": "Her first name is Marisol.",
  "holders": ["record"],
  "tokens": ["marisol"], "tokens_ko": ["마리솔"],
  "goal": "name" }
```

The letter holds 6 facts, the guest list 6, the record 5, the photograph 5. When you question the photograph, Gemma sees the photograph's five facts and nothing else. It cannot leak what it was never shown.

### Gemma speaks, code checks

Scoping the prompt is not enough, because a model can still guess. So every reply goes through a guardrail ([`check.py`](https://github.com/scs0209/the-last-guest/blob/main/check.py)): it looks for any other object's fact words, and for years the object could not know. If it finds one, Gemma gets one more try with a reminder. If that fails too, the player gets the object's own line for "I cannot know that".

The hard case was denial. If you ask the photograph "Is her name Marisol?", a perfectly good answer is "I never heard any name. Marisol means nothing to me." That reply contains the forbidden word, and it is not a leak. So a reply may repeat a word *the player* used, as long as it is denying it; the check strips those words and looks at what is left.

Korean taught me the next lesson. One reply from the letter said, in an old-fashioned Korean ending, that it had never been sent ("부치지 못하였소"). No object in the house is supposed to know that, not even the letter itself, and it slipped straight past the check, because Korean bends verb endings in many directions and my check words were whole words. Check words became word stems, and the denial rule was changed to judge a reply only after the leak words are taken out.

The result on the same 478 questions:

- **0 of 478** replies leaked another object's fact, by word check
- **14** replies were replaced by the fallback line
- clue recall **78 of 97**

To be clear about that zero: it is partly by construction, because the same word check is also the guardrail. A paraphrased leak that avoids every check word would not be counted. A judge model was not available for this run.

### The game only moves on what code finds

Gemma never tells the game "the player found a clue". After each reply, code looks for the object's *own* facts in it, and only those count as clues and progress. A model that hallucinates "you have discovered her name!" moves nothing.

Suggested questions use answers Gemma 4 E4B wrote in advance, through the same checks, so anyone can finish the game without typing, and without waiting.

### One model, three places

The same open weights run in three places, behind one harness:

- **On a laptop:** Gemma 4 E4B through Ollama, fully offline.
- **In the player's browser:** Gemma 4 E2B with Transformers.js on WebGPU, in a web worker. The weights are about 3.1 GB, downloaded once and kept in the browser's private file storage (OPFS). Questions never leave the player's machine. The guardrail is ported to JavaScript ([`harness.js`](https://github.com/scs0209/the-last-guest/blob/main/web/harness.js)), and it agreed with the Python version on all 1,058 answers I compared.
- **On Render:** Gemma 4 E4B on CPU in a Docker container.

Measured on a few questions only: about 1 to 3 s per typed answer with browser E2B on an Apple M3 Pro, and about 27 s with E4B on the Render CPU. The server is the slower one, which surprised me.

The Render setup is one `render.yaml` blueprint with two services built from `main`:

- `the-last-guest-site`: a free static site. The game, the pre-written answers, and the in-browser Gemma.
- `the-last-guest`: a Docker service with Gemma 4 E4B baked into the image by Ollama at build time, a `/healthz` check, an answer cache, a per-player rate limit and a queue, so one slow CPU model can serve a crowd without falling over. It needs more than 8 GB of RAM, so it runs on a paid plan while my hosting credits last.

<!-- YOU: keep or cut this paragraph -->
One honest note on that: I first wrote the paid plan into the blueprint without noticing what it meant, and the first sign was a $1 charge on my card. If you deploy a model from a blueprint, read the `plan:` line before you click.

### Making a house feel haunted, in a browser

An early version looked like a toy. What fixed it:

- CC0 models from Poly Haven (tables, chairs, chandeliers, cabinets, a rocking chair, a gothic statue) in place of boxes, shrunk from **8.7 MB to 4.2 MB** in total so the house loads fast.
- A cloth shader for the ghosts: ragged hems that crawl, eye hollows, a cold glow at the edges, and a head that turns on its own before the body follows.
- Post-processing: cold blue moonlight against warm candlelight, bloom, vignette, film grain. As candles go out, the colour drains from the room.
- Performance: frames went from about **2.8 ms to 1.0 ms** (M3 Pro, measured with synchronous frames), mostly by letting one light cast shadows instead of three.

When you get the ending right, she appears at the piano bench, warm where the other ghosts are cold, with a marigold in her hair. She turns to look at you.

![The ending](https://raw.githubusercontent.com/scs0209/the-last-guest/main/docs/media/ending.jpg)

### What it can't do

- The harness numbers come from a word check only. Paraphrased leaks are not counted.
- The browser model (E2B) is smaller than the one I measured (E4B), and I have not measured it on the 478 questions.
- A reply that denies something while repeating the question's premise ("I cannot see how she died in Oaxaca") passes the guardrail.
- I planned to fine-tune a smaller model to beat the Gemma baseline. The training data and baselines are in the repo, but my hosted training credits ran out, and local training ran out of memory next to Gemma. It is not trained.
- The browser version needs WebGPU and a 3.1 GB download. Without it, typed questions get a scripted answer.

## Why Does Open Innovation Matter?

**It runs with the lights off.** The whole game, model included, runs on a laptop with no internet through Ollama. A ghost story should still work during a power-cut-and-candles kind of night.

**What you type stays with you.** On the free site the model runs inside your browser. There is no server to send your questions to.

**One model, three places, one set of numbers.** The same open weights run in Ollama, in the browser and on a server, so a single harness and a single test set cover all three. And because the weights are open, anyone can rerun my 478 questions and check my numbers.

**The honest trade-off.** A big closed model would write livelier ghosts. It would still need the same checks, because the leak problem is about what the model is *shown*, not how clever it is. And it would add an API key, a server and a bill to a free game.

## My Agent Session

I built this with Claude Code, in one long session over two days. I wrote my prompts in Korean; the session files have an English translation under each one.

<!-- YOU: the sessions repo (scs0209/the-last-guest-sessions) is private. Make it public, or put the scrubbed files somewhere public, before linking it here. -->
The full session is split into ten files, one per phase: [link]

| File | What happened |
|---|---|
| 01 idea and story | Ideation, and the turn from a murder mystery to a Día de los Muertos story about remembering |
| 02 fact graph and evals | The fact graph, the 478 test questions, public and private repos |
| 03 first 3D demo | The first walkable house |
| 04 baselines | Qwen vs Gemma baselines, the fine-tuning attempt |
| 05 harness and guardrails | Scoped prompts, the guardrail, the denial rule, the Korean leak |
| 06 Render and redesign | The deploy plan, the full visual redesign |
| 07 Gemma in the browser | WebGPU, the JavaScript guardrail |
| 08 spooky pass | Models, shaders, lighting, images |
| 09 merge, speed, trailer | Performance, the trailer |
| 10 README, ending, post | The README, the ending, this post |

Three turning points, in my own words from the session:

- After the baselines: *"Gemma barely makes errors anyway, so I think setting up the harness, the graph engineering and the guardrails should be enough."* That sentence is the architecture of the game.
- When a key turned up in the logs: *"Don't mask the Tinker key, delete it."* Every session file was scrubbed before upload: keys deleted, emails and account names replaced.
- After the first deploy: *"No, we have to use the model."* The cheap fix was to ship only pre-written answers. Instead, the model moved into the player's browser.

## The Spirit of It

<!-- YOU: this is a first draft from what you said during the build. Rewrite it in your own voice; judges weight writing most. -->
Día de los Muertos is not about fear. It is about keeping a seat at the table for the people we lost, and saying their names so they are not gone. Marisol is invented, but the way she disappears is real: the one person who remembered her never said why, and after him, nobody knew why Seat 7 was always empty.

I wanted a ghost story where the scary part is forgetting, and where the AI is held to the same standard as the player: you only get to say what you actually remember.

## Prize Categories

- Best Use of Gemma
- Best Use of Render
- Best Use of Entire
- Best Use of a .tech Domain <!-- YOU: only if the game is live on the .tech domain before posting -->

## Credits

- 3D models and textures: [Poly Haven](https://polyhaven.com), CC0
- Title image and Marisol's photograph: generated with ChatGPT image generation (OpenAI)
- Marisol's voice on the record: generated with Qwen3-TTS (Apache-2.0); her tune was written for the game
- Models: Gemma 4 through [Ollama](https://ollama.com) and [Transformers.js](https://github.com/huggingface/transformers.js)
- Engine: [Three.js](https://threejs.org)

Marisol, the Whitcombes and their house are fictional.
