# The Last Guest — working notes

DEV.to Hacktoberfest Open-Source AI Challenge, Week 4 "Ghost in the Machine". Deadline: Oct 31, 2026, 11:59 PM PDT (Nov 1, 3:59 PM KST).
A Día de los Muertos ghost story: four objects (photo, letter, record, guest list) each remember only their own facts about the forgotten pianist Marisol Vega. Open models answer as the objects; code keeps them honest.

## Rules for this project
- Reply to the user in Korean first, then English.
- All commits and pushes go under GitHub `scs0209` with `Changsu Seong <110822847+scs0209@users.noreply.github.com>` as the repo-local identity. Never the machine's global/work identity. Use `GH_TOKEN="$(gh auth token -u scs0209)"` per command instead of switching gh's active account.
- Public repo: scs0209/the-last-guest. Agent session logs go only to the private repo scs0209/the-last-guest-sessions (Entire checkpoint refs). `agent-session/` and `.env` are git-ignored; never commit them, never print `.env`.
- Before pushing, scan for API-key-shaped strings and personal emails.
- Push only after the user confirms. Render watches `main`: pushing a changed `render.yaml` to main can create or change paid services.
- No made-up results: every number in the game, README or post must come from `results/`.

## Setup on a new machine
```bash
git clone https://github.com/scs0209/the-last-guest && cd the-last-guest
git config user.name "Changsu Seong" && git config user.email "110822847+scs0209@users.noreply.github.com"
uv sync                                    # Python 3.12+
ollama pull gemma4:e4b && ollama pull embeddinggemma
uv run python server.py                    # http://localhost:8765 (server mode, Gemma E4B via Ollama)
python3 -m http.server 8770 --directory web  # static mode, same as the Render free site
```
`.env` (TINKER_API_KEY) is only needed for the Tinker scripts; Tinker credits are used up.

## Where things stand (2026-10-27)
- Data and evals: 22-fact graph (`facts.json`, Korean check words included), 478 eval questions, 891 filtered training conversations. Baselines (judge = Qwen3.5-397B on Tinker, run with the earlier letter card; cannot be re-scored now that Tinker credits are gone): Qwen3.5-4B prompt-only leaks 49.0%, Gemma 4 E4B 8.6%.
- Gemma inside the game harness, by code only (no judge):
  - **v2, current** (`results/gemma-harness-v2_*`, 2026-10-27): letter card no longer calls itself "unsent", F21 has more English check words (`unsent`, `unposted`, `not sent`, ...), Ollama `gemma4:e4b` id `dc35e8d9c606`. 0/478 word-check leaks, 14 fallbacks (photo 6, record 3, guest list 5; none on type A questions), 18 questions retried, clue recall 78/97 (all expected facts found by `server.progress`), 2.7 s median per question.
  - **Earlier run** (`results/gemma-harness_*`, previous card and check words): reported as 0/478 by word check, 7 fallbacks, clue recall 74/97. Re-scored with today's check words and the same recall definition as v2: 7 leaks (all F21, the letter calling itself unsent) and 76/97; 74/97 does not reproduce exactly with the current code.
  - v2's extra fallbacks are on objects whose prompts did not change; one run cannot tell sampling variance from a different model build.
- Fine-tuning: Tinker credits ran out; MLX LoRA on Qwen3.5-4B is set up (`prep_mlx.py`, `lora.yaml`) but paused after out-of-memory errors while Gemma was loaded. Not trained.
- Game (`web/`): title screen, first-person house, dialogue, journal, ofrenda, endings, Korean and English. Korean and English playthroughs reach the ending with suggested questions only.
- Two ways to run the model: `server.py` (Ollama, E4B), or the static site where typed questions run Gemma 4 E2B in the player's browser (`web/gemma-worker.js`, WebGPU) behind `web/harness.js`, a JS port of the guardrail that matched Python on 1,058 answers. Regenerate `web/gen/` with `uv run python build_web.py` after changing facts, cards, server constants or the cache.
- Render (from `main`, two services in `render.yaml`): `the-last-guest` (paid pro plus Docker, Gemma 4 E4B on CPU, about 27 s per typed answer, run only while the $50 credit lasts, about 8.6 days) and `the-last-guest-site` (free static site, browser Gemma). Suspend the paid one in the dashboard before the credit runs out.

## Next steps
The full remaining plan, starting with the Render deploy (R1–R7), the schedule and the pre-submit checklist, is in [PLAN.md](PLAN.md). Work on `main` (the old `wip/browser-gemma` branch was merged and removed on 2026-10-28). Every push to `main` redeploys both Render services, so push only after the user confirms.
