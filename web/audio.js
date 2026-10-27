// Procedural sound: wind in the house, record crackle, piano notes. No audio files.
let ctx = null, master = null, crackleGain = null, enabled = true;

function noiseBuffer(seconds, brown) {
  const b = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate), d = b.getChannelData(0);
  let last = 0;
  for (let i = 0; i < d.length; i++) {
    const white = Math.random() * 2 - 1;
    if (brown) { last = (last + .02 * white) / 1.02; d[i] = last * 3.5; } else d[i] = white;
  }
  return b;
}

export function start() {
  if (ctx) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain(); master.gain.value = enabled ? .7 : 0; master.connect(ctx.destination);
  // wind: brown noise through a slowly moving band-pass
  const wind = ctx.createBufferSource(); wind.buffer = noiseBuffer(6, true); wind.loop = true;
  const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 400; bp.Q.value = .7;
  const lfo = ctx.createOscillator(), lfoGain = ctx.createGain(); lfo.frequency.value = .07; lfoGain.gain.value = 220;
  lfo.connect(lfoGain).connect(bp.frequency); lfo.start();
  const wg = ctx.createGain(); wg.gain.value = .22;
  wind.connect(bp).connect(wg).connect(master); wind.start();
  // record crackle, faded in only while the record is open
  const cr = ctx.createBufferSource(); const cb = noiseBuffer(2, false), d = cb.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() < .0015 ? d[i] : d[i] * .04;
  cr.buffer = cb; cr.loop = true;
  const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 1500;
  crackleGain = ctx.createGain(); crackleGain.gain.value = 0;
  cr.connect(hp).connect(crackleGain).connect(master); cr.start();
}

export function setEnabled(on) {
  enabled = on;
  if (master) master.gain.setTargetAtTime(on ? .7 : 0, ctx.currentTime, .1);
}

export function crackle(on) {
  if (crackleGain) crackleGain.gain.setTargetAtTime(on ? .5 : 0, ctx.currentTime, .3);
}

// a soft piano-like note: a few sine partials with a quick attack and long decay
export function note(freq, when = 0, dur = 2.4, vol = .25) {
  if (!ctx || !enabled) return;
  const t = ctx.currentTime + when;
  [1, 2, 3, 4.2].forEach((p, i) => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = "sine"; o.frequency.value = freq * p;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol / (i + 1) ** 1.6, t + .01);
    g.gain.exponentialRampToValueAtTime(.0001, t + dur / (1 + i * .5));
    o.connect(g).connect(master); o.start(t); o.stop(t + dur);
  });
}

const A = 220;
const tone = (semi) => A * 2 ** (semi / 12);
export const sfx = {
  clue: () => { note(tone(12), 0, 1.6, .12); note(tone(19), .12, 1.8, .1); },
  goal: () => [0, 4, 7, 12].forEach((s, i) => note(tone(s + 3), i * .18, 2.6, .18)),
  snuff: () => note(tone(-12), 0, 1.4, .15),
  // a short minor phrase for the ending, written for this game
  ending: () => [[0, 0], [3, .5], [7, 1], [8, 1.5], [7, 2.1], [5, 2.6], [3, 3.2], [2, 3.8], [0, 4.6]].forEach(([s, w]) => note(tone(s), w, 3, .22)),
};
