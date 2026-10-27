// The Last Guest: menus, HUD, dialogue with the four objects, the ofrenda and the endings.
import { createWorld, roomAt } from "./world.js";
import { drawTitle, OBJECT_ART, drawWave, drawPortrait, drawPhoto, drawLetter, drawGuestList } from "./art.js";
import * as audio from "./audio.js";

const C = await (await fetch("content.json")).json();
const $ = (id) => document.getElementById(id);
const store = { get(k, d) { try { return localStorage.getItem(k) ?? d; } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, v); } catch {} } };
const settings = { lang: store.get("lg.lang", navigator.language?.startsWith("ko") ? "ko" : "en"), sound: store.get("lg.sound", "on"), sens: +store.get("lg.sens", "1") };
const L = () => C[settings.lang];
const t = (path) => path.split(".").reduce((o, k) => o?.[k], L()) ?? "";

// ---------------------------------------------------------------- language
function applyLang() {
  document.documentElement.lang = settings.lang;
  document.querySelectorAll("[data-t]").forEach((el) => { el.textContent = t(el.dataset.t); });
  document.querySelectorAll("[data-setting]").forEach((seg) => seg.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b.dataset.v === settings[seg.dataset.setting])));
  $("q").placeholder = t("ask.placeholder");
  $("controls").textContent = world.isTouch ? t("hud.touch") : t("hud.controls");
  $("promptVerb").textContent = t("hud.investigate");
  $("aboutPoints").innerHTML = L().about.points.map((p) => `<li>${p}</li>`).join("");
  $("aboutTable").innerHTML = `<tr>${L().about.cols.map((c) => `<th>${c}</th>`).join("")}</tr>` +
    L().about.rows.map((r, i) => `<tr class="${i === 2 ? "ours" : ""}">${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("");
  paintWorldTextures();
  if (state.current) renderTalkHead();
  renderJournal();
}

// ---------------------------------------------------------------- world
const world = createWorld($("scene"), {
  onLockChange: (locked) => {
    if (!locked && state.playing && !state.current && !anyOverlay() && !world.isTouch) openPause();
  },
  onJoystick: (start, x = 0, z = 0) => {
    const j = $("joy");
    if (!start) { j.classList.add("hidden"); return; }
    j.classList.remove("hidden"); j.style.left = start.x + "px"; j.style.top = start.y + "px";
    j.firstElementChild.style.transform = `translate(${x * 32}px, ${z * 32}px)`;
  },
  isSpinning: () => state.current === "record" && state.waiting,
});
world.setSensitivity(settings.sens);

function paintWorldTextures() {
  const mk = (w, h, f) => { const c = document.createElement("canvas"); c.width = w; c.height = h; f(c.getContext("2d"), w, h); return c; };
  // flat crops of the illustrations, used on the 3D props
  world.setTextures({
    photo: mk(512, 512, (g, w, h) => drawPhoto(g, w, h, 0, state.restored)),
    letter: mk(512, 512, (g, w, h) => drawLetter(g, w, h, 0)),
    list: mk(512, 512, (g, w, h) => drawGuestList(g, w, h, 0, settings.lang)),
  });
}

// ---------------------------------------------------------------- state
const state = {
  playing: false, over: false, current: null, waiting: false, restored: false,
  found: new Set(), visited: new Set(), asked: {}, history: {}, candles: 7, lastProgress: Date.now(), goalsDone: new Set(),
};
const OBJECTS = ["photo", "letter", "record", "guest_list"];
const overlays = ["journal", "ofrenda", "pause", "settings", "about", "intro", "forgotten"];
const anyOverlay = () => overlays.some((id) => !$(id).classList.contains("hidden"));

// ---------------------------------------------------------------- menu
const titleCanvas = $("titleArt");
function sizeTitle() { titleCanvas.width = innerWidth * Math.min(devicePixelRatio, 1.5); titleCanvas.height = innerHeight * Math.min(devicePixelRatio, 1.5); }
addEventListener("resize", sizeTitle); sizeTitle();

document.querySelectorAll("[data-open]").forEach((b) => b.addEventListener("click", () => $(b.dataset.open).classList.remove("hidden")));
document.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", () => $(b.dataset.close).classList.add("hidden")));
document.querySelectorAll("[data-setting]").forEach((seg) => seg.addEventListener("click", (e) => {
  const v = e.target.closest("button")?.dataset.v; if (!v) return;
  settings[seg.dataset.setting] = v; store.set("lg." + seg.dataset.setting, v);
  if (seg.dataset.setting === "sound") audio.setEnabled(v === "on");
  applyLang();
}));
$("sens").value = settings.sens;
$("sens").addEventListener("input", (e) => { settings.sens = +e.target.value; store.set("lg.sens", settings.sens); world.setSensitivity(settings.sens); });

$("newGameBtn").addEventListener("click", () => {
  audio.start(); audio.setEnabled(settings.sound === "on");
  $("menu").classList.add("hidden");
  $("introLines").innerHTML = L().intro.lines.map((l) => `<p>${l}</p>`).join("");
  $("intro").classList.remove("hidden");
  [...$("introLines").children].forEach((p, i) => setTimeout(() => p.classList.add("show"), 300 + i * 1300));
});
$("enterBtn").addEventListener("click", () => {
  $("intro").classList.add("hidden"); $("hud").classList.remove("hidden");
  state.playing = true; state.lastProgress = Date.now();
  world.setEnabled(true); world.lock();
  setTimeout(() => { $("controls").style.opacity = 0; }, 14000);
});

// ---------------------------------------------------------------- pause
function openPause() { world.setEnabled(false); $("pause").classList.remove("hidden"); }
function resume() { overlays.forEach((id) => $(id).classList.add("hidden")); world.setEnabled(true); world.lock(); }
$("resumeBtn").addEventListener("click", resume);
$("toMenuBtn").addEventListener("click", () => location.reload());

// ---------------------------------------------------------------- keys
addEventListener("keydown", (e) => {
  if (e.target.closest("input, select, textarea")) { if (e.key === "Escape") e.target.blur(); else return; }
  if (!state.playing || state.over) return;
  if (e.code === "KeyE" && !state.current && !anyOverlay()) interact();
  else if (e.code === "KeyJ" && !state.current) toggleJournal();
  else if (e.key === "Escape") {
    if (state.current) closeTalk();
    else if (!$("settings").classList.contains("hidden") || !$("about").classList.contains("hidden")) { $("settings").classList.add("hidden"); $("about").classList.add("hidden"); }
    else if (anyOverlay()) resume();
  }
});
$("touchAct").addEventListener("click", () => interact());
$("journalBtn").addEventListener("click", () => toggleJournal());

function interact() {
  const k = world.nearest(); if (!k) return;
  if (k === "ofrenda") openOfrenda(); else openTalk(k);
}

// ---------------------------------------------------------------- HUD
function renderCandles() {
  $("candles").innerHTML = Array.from({ length: 7 }, (_, i) => `<div class="candle ${i >= state.candles ? "out" : ""}"></div>`).join("");
  world.setCandles(state.candles);
}
renderCandles();
let toastTimer;
function toast(text, ms = 5200) {
  const el = $("toast"); el.textContent = text; el.classList.add("show");
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove("show"), ms);
}
let clueTimer;
function clueCard(key) {
  $("clueName").textContent = L().objects[key].name; $("clueText").textContent = L().objects[key].card;
  $("clueCard").classList.add("show"); clearTimeout(clueTimer); clueTimer = setTimeout(() => $("clueCard").classList.remove("show"), 6000);
}

// minimap: rooms, doors, objects (blue until found, then gold), seat 7, and you
const mm = $("minimap"), mg = mm.getContext("2d");
function drawMinimap(time) {
  const W = mm.width, p = world.player, scale = 13;
  mg.clearRect(0, 0, W, W);
  mg.save(); mg.beginPath(); mg.arc(W / 2, W / 2, W / 2 - 2, 0, Math.PI * 2); mg.clip();
  mg.translate(W / 2, W / 2); mg.rotate(p.yaw); mg.translate(-p.x * scale, -p.z * scale);
  for (const r of Object.values(world.rooms)) { mg.fillStyle = "rgba(60,80,140,.28)"; mg.fillRect(r.x[0] * scale, r.z[0] * scale, (r.x[1] - r.x[0]) * scale, (r.z[1] - r.z[0]) * scale); }
  mg.strokeStyle = "rgba(190,210,255,.75)"; mg.lineWidth = 3;
  for (const [x1, z1, x2, z2] of world.walls) { mg.beginPath(); mg.moveTo(x1 * scale, z1 * scale); mg.lineTo(x2 * scale, z2 * scale); mg.stroke(); }
  for (const k of [...OBJECTS, "ofrenda"]) {
    const o = world.objectPos(k), done = state.visited.has(k);
    mg.fillStyle = k === "ofrenda" ? "#f29a1d" : done ? "#e8c27a" : `rgba(143,182,255,${.6 + .4 * Math.sin(time * 4)})`;
    mg.beginPath(); mg.arc(o.x * scale, o.z * scale, k === "ofrenda" ? 7 : 6, 0, Math.PI * 2); mg.fill();
  }
  mg.restore();
  // you, always pointing up
  mg.fillStyle = "#fff"; mg.beginPath(); mg.moveTo(W / 2, W / 2 - 12); mg.lineTo(W / 2 + 8, W / 2 + 9); mg.lineTo(W / 2, W / 2 + 4); mg.lineTo(W / 2 - 8, W / 2 + 9); mg.fill();
  mg.fillStyle = "rgba(232,194,122,.9)"; mg.font = "bold 20px sans-serif"; mg.textAlign = "center"; mg.fillText("N", W / 2, 24);
}

function updateHUD(time) {
  const k = state.playing && !state.current && !anyOverlay() && !state.over ? world.nearest() : null;
  $("prompt").classList.toggle("hidden", !k);
  $("touchAct").classList.toggle("hidden", !k || !world.isTouch);
  if (k) {
    $("promptVerb").textContent = k === "ofrenda" ? t("hud.ofrenda") : t("hud.investigate");
    $("promptWhat").textContent = k === "ofrenda" ? "" : "· " + L().objects[k].name;
    $("touchAct").textContent = k === "ofrenda" ? t("hud.ofrenda") : t("hud.investigate");
  }
  $("clickHint").classList.toggle("hidden", !(state.playing && !world.locked && !world.isTouch && !state.current && !anyOverlay() && !state.over));
  $("roomName").textContent = L().hud.rooms[roomAt(world.player.x, world.player.z)];
  $("clueCount").textContent = `${state.visited.size - (state.visited.has("ofrenda") ? 1 : 0)}/4`;
  drawMinimap(time);
}

// ---------------------------------------------------------------- dialogue
const artCtx = $("objArt").getContext("2d"), waveCtx = $("waveCanvas").getContext("2d");
function renderTalkHead() {
  const o = L().objects[state.current];
  $("who").textContent = o.name; $("whoSub").textContent = o.sub; $("whoDesc").textContent = o.card;
  $("waveTitle").textContent = settings.lang === "ko" ? "기억의 조각" : "A fragment of memory";
  renderChips();
}
function openTalk(key) {
  state.current = key; world.setEnabled(false);
  if (!state.visited.has(key)) { state.visited.add(key); world.markFound(key); clueCard(key); audio.sfx.clue(); progressMade(); }
  $("log").innerHTML = "";
  renderTalkHead();
  addMsg(L().objects[key].hello, "them " + key);
  $("wave").classList.toggle("hidden", key !== "record");
  audio.crackle(key === "record");
  $("talk").classList.remove("hidden");
  if (!world.isTouch) $("q").focus();
}
function closeTalk() {
  state.current = null; $("talk").classList.add("hidden"); audio.crackle(false);
  if (!state.over) { world.setEnabled(true); world.lock(); }
}
$("closeTalk").addEventListener("click", closeTalk);
$("askForm").addEventListener("submit", (e) => { e.preventDefault(); ask($("q").value); $("q").value = ""; });

function addMsg(text, cls) {
  const div = document.createElement("div"); div.className = "msg " + cls; div.textContent = text;
  $("log").appendChild(div); $("log").scrollTop = $("log").scrollHeight; return div;
}
function renderChips() {
  const key = state.current, asked = state.asked[key] || new Set();
  $("chips").innerHTML = "";
  for (const c of L().objects[key].chips.filter((c) => !asked.has(c))) {
    const b = document.createElement("button"); b.type = "button"; b.className = "chip"; b.textContent = c;
    b.addEventListener("click", () => ask(c)); $("chips").appendChild(b);
  }
}
// scripted replies, used only when no model server is reachable (e.g. a static host)
function scripted(key, q) {
  const o = L().objects[key], text = q.toLowerCase();
  return o.intents.find((it) => it.k.some((k) => text.includes(k))) || { say: o.unknown, reveals: [] };
}
async function modelReply(key, q) {
  try {
    const res = await fetch("/api/ask", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ obj: key, q, lang: settings.lang, history: (state.history[key + settings.lang] || []) }) });
    const r = await res.json().catch(() => null);
    if (r && r.busy) return { say: r.busy, busy: true };
    if (!res.ok || !r) return null;
    (state.history[key + settings.lang] ||= []).push({ q, a: r.say });
    return r;
  } catch { return null; }
}
const WAITING = { en: ["…", "… the candle flame bends toward the voice …", "… something stirs, slowly, trying to remember …"],
  ko: ["…", "… 촛불이 목소리 쪽으로 기운다 …", "… 무언가 천천히, 기억해 내려 애쓴다 …"] };
async function ask(q) {
  q = q.trim(); const key = state.current;
  if (!key || !q || state.waiting || state.over) return;
  (state.asked[key] ||= new Set()).add(q); renderChips();
  addMsg(q, "you");
  const wait = addMsg("…", "them " + key); state.waiting = true;
  const started = Date.now(), lines = WAITING[settings.lang];
  const ticker = setInterval(() => { wait.textContent = lines[Math.min(lines.length - 1, Math.floor((Date.now() - started) / 4000))]; }, 1000);
  const r = (await modelReply(key, q)) || scripted(key, q);
  await new Promise((ok) => setTimeout(ok, Math.max(0, 600 + Math.random() * 500 - (Date.now() - started))));
  clearInterval(ticker); wait.remove(); state.waiting = false;
  if (state.current !== key) return;
  if (r.busy) { addMsg(r.say, "narrator"); state.asked[key].delete(q); renderChips(); return; }
  const reveals = r.reveals || [];
  const msg = addMsg(r.say, "them " + key + (reveals.includes("F18") ? " ink" : ""));
  if (r.cached) { const tag = document.createElement("span"); tag.className = "tag"; tag.textContent = "✦ " + t("ask.cachedNote"); msg.appendChild(tag); }
  reveals.forEach(learn);
}

// ---------------------------------------------------------------- memory: facts, goals, journal
function learn(id) {
  if (state.found.has(id) || !C.factGoal[id]) return;
  state.found.add(id); progressMade();
  for (const [g, ids] of Object.entries(C.goals)) {
    if (!state.goalsDone.has(g) && ids.every((x) => state.found.has(x))) {
      state.goalsDone.add(g); world.goalFx(g); audio.sfx.goal();
      if (state.current) addMsg(L().goalReached[g], "narrator"); else toast(L().goalReached[g]);
    }
  }
  renderJournal();
}
function progressMade() { state.lastProgress = Date.now(); }
function renderJournal() {
  $("journalObjs").innerHTML = OBJECTS.map((k) => `<div><span class="check ${state.visited.has(k) ? "" : "no"}">${state.visited.has(k) ? "✓" : ""}</span>${L().objects[k].name}</div><div class="${state.visited.has(k) ? "ok" : "no"}">${state.visited.has(k) ? 1 : 0}/1</div>`).join("");
  $("journalGoals").innerHTML = Object.keys(C.goals).map((g) => {
    const notes = [...state.found].filter((id) => C.factGoal[id] === g).map((id) => `<li>${L().facts[id]}</li>`).join("");
    return `<div class="goal ${state.goalsDone.has(g) ? "done" : ""}"><h3>${L().goalNames[g]}</h3><ul>${notes}</ul></div>`;
  }).join("");
}
function toggleJournal() {
  const j = $("journal");
  if (j.classList.contains("hidden")) { renderJournal(); world.setEnabled(false); j.classList.remove("hidden"); }
  else resume();
}
$("closeJournal").addEventListener("click", resume);
$("restoreBtn").addEventListener("click", () => { $("journal").classList.add("hidden"); openOfrenda(); });

// candles burn down when nothing is remembered for a while
setInterval(() => {
  if (!state.playing || state.over) return;
  if (Date.now() - state.lastProgress > 240000) { state.lastProgress = Date.now(); snuff(L().narrator.forget); }
}, 5000);
function snuff(why) {
  state.candles = Math.max(0, state.candles - 1); renderCandles(); audio.sfx.snuff();
  if (state.current) addMsg(why, "narrator"); else toast(why);
  if (state.candles === 0) forgotten();
}

// ---------------------------------------------------------------- ofrenda
function openOfrenda() {
  world.setEnabled(false); state.visited.add("ofrenda");
  const S = L().ofrenda;
  $("slots").innerHTML = C.slots.map((s) => {
    const locked = s.needs && !state.goalsDone.has(s.needs), lab = S.slots[s.id];
    return `<div class="slot"><label for="s-${s.id}">${lab.label}${locked ? ` (${S.locked})` : ""}</label>
      <select id="s-${s.id}" ${locked ? "disabled" : ""}><option value="">${S.choose}</option>${lab.opts.map((o, i) => `<option value="${i}">${o}</option>`).join("")}</select></div>`;
  }).join("");
  $("feedback").textContent = ""; $("ofrenda").classList.remove("hidden");
}
$("closeOfrenda").addEventListener("click", resume);
$("lightBtn").addEventListener("click", () => {
  const S = L().ofrenda, picks = C.slots.map((s) => $("s-" + s.id).value);
  if (picks.some((p) => p === "")) { $("feedback").textContent = S.missing; return; }
  const wrong = C.slots.filter((s, i) => Number(picks[i]) !== s.right).length;
  if (wrong) { $("feedback").textContent = wrong === 1 ? S.wrongOne : S.wrongMany.replace("{n}", wrong); snuff(L().narrator.wrong); return; }
  $("ofrenda").classList.add("hidden"); ending();
});

// ---------------------------------------------------------------- endings
let portraitOn = false;
function ending() {
  state.over = true; state.restored = true; paintWorldTextures();
  world.setEnabled(false); world.ending(); audio.sfx.ending();
  $("hud").classList.add("hidden");
  setTimeout(() => {
    const E = L().ending;
    $("endName").textContent = E.name; $("endDates").textContent = E.dates;
    $("endLines").innerHTML = [...E.lines.map((l) => `<p class="line">${l}</p>`), `<p class="line said">${E.said}</p>`, `<p class="line">${E.after}</p>`,
      `<p class="line"><button class="btn marigold" onclick="location.reload()">${E.again}</button></p>`].join("");
    $("ending").classList.remove("hidden"); portraitOn = true;
    requestAnimationFrame(() => $("ending").classList.add("show"));
    [...$("endLines").children].forEach((el, i) => setTimeout(() => el.classList.add("show"), 1400 + i * 1800));
  }, 5200);
}
function forgotten() {
  state.over = true; world.setEnabled(false); $("talk").classList.add("hidden");
  const F = L().forgotten;
  $("forgottenCard").innerHTML = F.lines.map((l) => `<p class="line">${l}</p>`).join("") + `<div class="row" style="justify-content:center"><button class="btn" onclick="location.reload()">${F.again}</button></div>`;
  $("forgotten").classList.remove("hidden");
  [...$("forgottenCard").querySelectorAll(".line")].forEach((el, i) => setTimeout(() => el.classList.add("show"), 600 + i * 1800));
}

// ---------------------------------------------------------------- loop
const portraitCtx = $("portrait").getContext("2d"), titleCtx = titleCanvas.getContext("2d");
function frame(ms) {
  const time = ms / 1000;
  if (!$("menu").classList.contains("hidden")) drawTitle(titleCtx, titleCanvas.width, titleCanvas.height, time);
  else {
    world.update();
    if (state.playing) updateHUD(time);
    if (state.current) {
      OBJECT_ART[state.current](artCtx, 640, 640, time, state.current === "photo" ? state.restored : settings.lang);
      if (state.current === "record") { drawWave(waveCtx, 600, 80, time, state.waiting); $("waveBar").style.width = `${(time * 4) % 100}%`; }
    }
    if (portraitOn) drawPortrait(portraitCtx, 640, 800, time);
  }
  requestAnimationFrame(frame);
}
applyLang();
requestAnimationFrame(frame);
window.game = { state, world, ask, openTalk, closeTalk, openOfrenda, learn, settings, applyLang };
