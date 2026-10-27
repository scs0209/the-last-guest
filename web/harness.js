// The game's harness, in the browser: the same fact-graph prompt, guardrail and progress rules as server.py.
// Data comes from gen/harness.json, which build_web.py exports from the Python source.
let H = null, CACHE = {};

export async function loadHarness() {
  [H, CACHE] = await Promise.all([fetch("gen/harness.json").then((r) => r.json()), fetch("gen/answer_cache.json").then((r) => r.json())]);
  H.denialRe = new RegExp(H.denial);
}

const tokens = (f) => f.tokens.concat(f.tokens_ko || []);

// cards.py + server.scoped_card: only the facts this object holds
export function scopedCard(obj, lang) {
  const own = H.facts.filter((f) => f.holders.includes(obj));
  const parts = [H.voices[obj], "", "YOUR facts (when asked, say them plainly, in their own words, then add your voice):",
    ...own.map((f) => `- ${f.text}`), "",
    "Lines you hold word for word (when asked about these, say the line itself):", ...Object.values(H.keyLines[lang][obj] || {}).map((t) => `- ${t}`), "",
    "Nobody in the house knows: " + H.unknowables.join("; ") + ".", "", H.rules];
  if (lang === "ko") {
    const glossary = own.filter((f) => f.glossary_ko).map((f) => f.glossary_ko).join("; ");
    parts.push("", H.korean.replace("{glossary}", glossary || "none"));
  }
  return parts.join("\n");
}

// check.py
export function check(obj, reply) {
  const text = reply.toLowerCase(), leaks = [];
  for (const f of H.facts) {
    if (f.holders.includes(obj)) continue;
    const hit = tokens(f).find((t) => text.includes(t));
    if (hit) leaks.push({ fact: f.id, token: hit });
  }
  const allowed = new Set(H.allowedYears[obj]);
  const years = [...new Set([...reply.matchAll(/\b(1[89]\d\d)\b/g)].map((m) => +m[1]))];
  const badYears = years.filter((y) => !allowed.has(y));
  return { leaks, badYears, ok: !leaks.length && !badYears.length };
}

// server.guard_check: the player's own words may be echoed while denying them
export function guardCheck(obj, q, say) {
  const c = check(obj, say);
  // a denial must come from the reply itself, not from inside a hidden-fact phrase ("부치지 못" contains 못)
  let rest = say.toLowerCase();
  for (const l of c.leaks) rest = rest.split(l.token).join(" ");
  if (H.denialRe.test(rest)) {
    const ql = q.toLowerCase();
    c.leaks = c.leaks.filter((l) => !ql.includes(l.token));
    c.badYears = c.badYears.filter((y) => !q.includes(String(y)));
    c.ok = !c.leaks.length && !c.badYears.length;
  }
  return c;
}

// check.revealed + server.PROGRESS: progress only on the object's own facts found by code
export function progress(obj, say) {
  const text = say.toLowerCase();
  return H.facts.filter((f) => f.holders.includes(obj) &&
    (tokens(f).some((t) => text.includes(t)) || (H.progress[f.id] || []).some((s) => text.includes(s)))).map((f) => f.id).sort();
}

// pre-written Gemma answers for suggested questions; prefer the one carrying the most clues
export function cached(lang, obj, q) {
  const list = CACHE[lang]?.[obj]?.[q];
  if (!list?.length) return null;
  const best = Math.max(...list.map((c) => c.reveals.length));
  const pick = list.filter((c) => c.reveals.length === best);
  return { ...pick[Math.floor(Math.random() * pick.length)], guard: [], cached: true };
}

// server.answer: ask, check, retry once with a reminder, else the object's own "I cannot know"
export async function answer(obj, q, history, lang, generate) {
  const messages = [{ role: "system", content: scopedCard(obj, lang) }];
  for (const h of history.slice(-6)) messages.push({ role: "user", content: h.q }, { role: "assistant", content: h.a });
  messages.push({ role: "user", content: q.slice(0, 300) });
  const guard = [];
  for (let attempt = 0; attempt < 2; attempt++) {
    const say = (await generate(messages)).trim();
    const c = guardCheck(obj, q, say);
    if (c.ok && say) return { say, reveals: progress(obj, say), guard };
    guard.push({ attempt, leaks: c.leaks.map((l) => l.fact), badYears: c.badYears });
    messages.push({ role: "assistant", content: say }, { role: "user", content: H.reminder });
  }
  return { say: H.fallback[lang][obj], reveals: [], guard };
}
