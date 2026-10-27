// Everything here is drawn with code on a 2D canvas: the title scene, the four objects, the portrait.

const rand = (seed) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

// ---------------------------------------------------------------- title scene
// A moonlit mansion on a hill, lit windows, bare trees, iron gate, a lantern path and a jack-o'-lantern.
export function drawTitle(g, w, h, t) {
  const r = rand(7);
  const sky = g.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, "#050a1f"); sky.addColorStop(.55, "#14254e"); sky.addColorStop(1, "#1d1a33");
  g.fillStyle = sky; g.fillRect(0, 0, w, h);

  // stars
  for (let i = 0; i < 160; i++) {
    const x = r() * w, y = r() * h * .6, s = r() * 1.3 + .2;
    g.globalAlpha = .35 + .65 * Math.abs(Math.sin(t * .6 + i));
    g.fillStyle = "#dfe6ff"; g.fillRect(x, y, s, s);
  }
  g.globalAlpha = 1;

  // moon with halo
  const mx = w * .74, my = h * .17, mr = Math.min(w, h) * .055;
  const halo = g.createRadialGradient(mx, my, mr * .8, mx, my, mr * 6);
  halo.addColorStop(0, "rgba(200,215,255,.35)"); halo.addColorStop(1, "rgba(200,215,255,0)");
  g.fillStyle = halo; g.fillRect(0, 0, w, h);
  const moon = g.createRadialGradient(mx - mr * .3, my - mr * .3, mr * .1, mx, my, mr);
  moon.addColorStop(0, "#fbfbf2"); moon.addColorStop(1, "#c9cfe0");
  g.fillStyle = moon; g.beginPath(); g.arc(mx, my, mr, 0, Math.PI * 2); g.fill();
  g.fillStyle = "rgba(120,130,160,.25)";
  [[-.3, -.2, .22], [.25, .15, .16], [-.05, .35, .12]].forEach(([a, b, c]) => { g.beginPath(); g.arc(mx + a * mr, my + b * mr, c * mr, 0, Math.PI * 2); g.fill(); });

  // drifting clouds
  for (let i = 0; i < 5; i++) {
    const cx = ((i * .27 + t * .006 * (1 + i * .3)) % 1.4 - .2) * w, cy = h * (.12 + i * .06);
    const cg = g.createRadialGradient(cx, cy, 0, cx, cy, w * .22);
    cg.addColorStop(0, "rgba(70,85,130,.28)"); cg.addColorStop(1, "rgba(70,85,130,0)");
    g.fillStyle = cg; g.beginPath(); g.ellipse(cx, cy, w * .22, h * .04, 0, 0, Math.PI * 2); g.fill();
  }

  // far hills; on portrait screens the house sits higher so the title has room below it
  const portrait = w < h, horizon = portrait ? .5 : .7;
  g.fillStyle = "#0d1430";
  g.beginPath(); g.moveTo(0, h * (horizon + .02));
  for (let x = 0; x <= w; x += w / 24) g.lineTo(x, h * (horizon - .04 + .04 * Math.sin(x / w * 7 + 1)));
  g.lineTo(w, h); g.lineTo(0, h); g.fill();

  // mansion silhouette
  const base = h * horizon, cx = w * (portrait ? .55 : .62), s = Math.min(w * (portrait ? .75 : .5), h * .75) / 100;
  const M = (x, y) => [cx + x * s, base - y * s];
  g.fillStyle = "#070814";
  const poly = (pts) => { g.beginPath(); pts.forEach(([x, y], i) => { const [a, b] = M(x, y); i ? g.lineTo(a, b) : g.moveTo(a, b); }); g.closePath(); g.fill(); };
  poly([[-46, 0], [-46, 30], [-50, 30], [-38, 44], [-26, 30], [-30, 30], [-30, 0]]);           // west wing gable
  poly([[-30, 0], [-30, 38], [-34, 38], [0, 58], [34, 38], [30, 38], [30, 0]]);                // main hall
  poly([[30, 0], [30, 28], [26, 28], [40, 42], [54, 28], [50, 28], [50, 0]]);                  // east wing
  poly([[-8, 50], [-8, 70], [-11, 70], [0, 92], [11, 70], [8, 70], [8, 50]]);                   // central tower
  poly([[-44, 30], [-44, 52], [-46, 52], [-41, 66], [-36, 52], [-38, 52], [-38, 30]]);         // west turret
  poly([[40, 40], [40, 56], [38, 56], [43, 70], [48, 56], [46, 56], [46, 40]]);                // east turret
  [[-20, 40], [22, 40], [-40, 30]].forEach(([x, y]) => poly([[x - 1.5, y], [x - 1.5, y + 10], [x + 1.5, y + 10], [x + 1.5, y]])); // chimneys
  // spire tips
  g.strokeStyle = "#070814"; g.lineWidth = Math.max(1, s * .5);
  [[0, 92, 100], [-41, 66, 72], [43, 70, 76]].forEach(([x, y, y2]) => { const [a, b] = M(x, y), [, d] = M(x, y2); g.beginPath(); g.moveTo(a, b); g.lineTo(a, d); g.stroke(); });

  // lit windows, flickering
  const win = (x, y, ww, hh, lit, arch) => {
    const [a, b] = M(x, y + hh);
    const f = .75 + .25 * Math.sin(t * 2.3 + x * 3 + y);
    g.fillStyle = lit ? `rgba(255,${170 + 30 * f | 0},80,${.85 * f})` : "#1a1c30";
    g.beginPath();
    if (arch) { g.moveTo(a, b + hh * s); g.lineTo(a, b + ww * s * .5); g.arc(a + ww * s / 2, b + ww * s * .5, ww * s / 2, Math.PI, 0); g.lineTo(a + ww * s, b + hh * s); }
    else g.rect(a, b, ww * s, hh * s);
    g.fill();
    if (lit) {
      const gl = g.createRadialGradient(a + ww * s / 2, b + hh * s / 2, 0, a + ww * s / 2, b + hh * s / 2, 9 * s);
      gl.addColorStop(0, "rgba(255,170,70,.28)"); gl.addColorStop(1, "rgba(255,170,70,0)");
      g.fillStyle = gl; g.fillRect(a - 9 * s, b - 9 * s, ww * s + 18 * s, hh * s + 18 * s);
    }
  };
  const lit = [1, 0, 1, 1, 0, 1, 1, 1, 0, 1, 1, 0, 1, 0, 1];
  let k = 0;
  for (const y of [6, 20]) for (const x of [-24, -16, -8, 4, 12, 20]) win(x, y, 4, 7, lit[k++ % lit.length], true);
  for (const x of [-43, -36]) win(x, 10, 3.5, 7, lit[k++ % lit.length], true);
  for (const x of [34, 42]) win(x, 10, 3.5, 7, lit[k++ % lit.length], true);
  win(-2, 60, 4, 7, 1, true); win(-42, 40, 2.5, 5, 1, true); win(41.5, 46, 2.5, 5, 0, true);
  win(-3, 0, 6, 11, 1, true); // front door

  // bare trees left and right
  const tree = (x, y, len, ang, depth) => {
    if (depth === 0) return;
    const x2 = x + Math.cos(ang) * len, y2 = y - Math.sin(ang) * len;
    g.strokeStyle = "#04050c"; g.lineWidth = depth * 1.4; g.beginPath(); g.moveTo(x, y); g.lineTo(x2, y2); g.stroke();
    tree(x2, y2, len * .72, ang + .45 + Math.sin(depth * 3.1) * .15, depth - 1);
    tree(x2, y2, len * .7, ang - .4 + Math.cos(depth * 2.3) * .15, depth - 1);
  };
  tree(w * .08, h * .95, h * .16, Math.PI / 2 + .05, 7);
  tree(w * .97, h * .97, h * .13, Math.PI / 2 - .1, 6);

  // iron fence and gate
  g.strokeStyle = "#05060d"; g.lineWidth = 2;
  for (let x = 0; x < w; x += 11) {
    if (x > w * .55 && x < w * .69) continue;
    g.beginPath(); g.moveTo(x, h * .9); g.lineTo(x, h * .82); g.stroke();
    g.beginPath(); g.moveTo(x - 3, h * .825); g.lineTo(x, h * .812); g.lineTo(x + 3, h * .825); g.stroke();
  }
  g.beginPath(); g.moveTo(0, h * .84); g.lineTo(w * .55, h * .84); g.moveTo(w * .69, h * .84); g.lineTo(w, h * .84); g.stroke();
  [w * .55, w * .69].forEach((x) => { g.fillStyle = "#05060d"; g.fillRect(x - 5, h * .76, 10, h * .14); });

  // path with lanterns
  g.fillStyle = "#151629";
  g.beginPath(); g.moveTo(w * .6, base); g.lineTo(w * .64, base); g.lineTo(w * .75, h); g.lineTo(w * .48, h); g.fill();
  [[.585, .79], [.67, .79], [.55, .9], [.71, .9]].forEach(([x, y], i) => {
    const lx = w * x, ly = h * y, f = .8 + .2 * Math.sin(t * 3 + i);
    const lg = g.createRadialGradient(lx, ly, 0, lx, ly, 26);
    lg.addColorStop(0, `rgba(255,190,90,${.9 * f})`); lg.addColorStop(1, "rgba(255,150,60,0)");
    g.fillStyle = lg; g.beginPath(); g.arc(lx, ly, 26, 0, Math.PI * 2); g.fill();
  });

  // ground fog
  for (let i = 0; i < 4; i++) {
    const fy = h * (.78 + i * .06), off = Math.sin(t * .15 + i) * w * .05;
    const fg = g.createLinearGradient(0, fy - 30, 0, fy + 30);
    fg.addColorStop(0, "rgba(120,130,180,0)"); fg.addColorStop(.5, `rgba(120,130,180,${.12 + i * .03})`); fg.addColorStop(1, "rgba(120,130,180,0)");
    g.fillStyle = fg; g.fillRect(off - w * .1, fy - 30, w * 1.2, 60);
  }

  // jack-o'-lantern
  const px = w * .9, py = h * .9, pr = Math.min(w, h) * .045;
  const pg = g.createRadialGradient(px, py, 0, px, py, pr * 3);
  pg.addColorStop(0, "rgba(255,140,30,.45)"); pg.addColorStop(1, "rgba(255,140,30,0)");
  g.fillStyle = pg; g.beginPath(); g.arc(px, py, pr * 3, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#7a3608"; g.beginPath(); g.ellipse(px, py, pr * 1.25, pr, 0, 0, Math.PI * 2); g.fill();
  g.strokeStyle = "#4e2104"; g.lineWidth = 2;
  [-.5, 0, .5].forEach((o) => { g.beginPath(); g.ellipse(px + o * pr, py, pr * .45, pr * .98, 0, 0, Math.PI * 2); g.stroke(); });
  g.fillStyle = "#2c3a10"; g.fillRect(px - 3, py - pr - 8, 6, 10);
  const flick = .8 + .2 * Math.sin(t * 9);
  g.fillStyle = `rgba(255,${200 * flick | 0},60,1)`;
  [[-.45, -.2], [.45, -.2]].forEach(([a, b]) => { g.beginPath(); g.moveTo(px + a * pr - 7, py + b * pr + 5); g.lineTo(px + a * pr, py + b * pr - 7); g.lineTo(px + a * pr + 7, py + b * pr + 5); g.fill(); });
  g.beginPath(); g.moveTo(px - pr * .7, py + pr * .25);
  for (let i = 0; i <= 6; i++) g.lineTo(px - pr * .7 + i * pr * .233, py + pr * (i % 2 ? .5 : .3));
  g.lineTo(px + pr * .7, py + pr * .25); g.quadraticCurveTo(px, py + pr * .85, px - pr * .7, py + pr * .25); g.fill();

  // vignette
  const v = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * .3, w / 2, h / 2, Math.max(w, h) * .75);
  v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(0,0,0,.7)");
  g.fillStyle = v; g.fillRect(0, 0, w, h);
}

// ---------------------------------------------------------------- object illustrations
function glow(g, w, h, color = "120,170,255") {
  const gl = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.min(w, h) * .5);
  gl.addColorStop(0, `rgba(${color},.22)`); gl.addColorStop(1, `rgba(${color},0)`);
  g.fillStyle = gl; g.fillRect(0, 0, w, h);
}

export function drawPhoto(g, w, h, t, restored = false) {
  g.clearRect(0, 0, w, h); glow(g, w, h);
  const fw = w * .78, fh = fw * .68, fx = (w - fw) / 2, fy = (h - fh) / 2;
  // gilt frame
  const fr = g.createLinearGradient(fx, fy, fx + fw, fy + fh);
  fr.addColorStop(0, "#7a5a22"); fr.addColorStop(.5, "#e0b864"); fr.addColorStop(1, "#6a4a18");
  g.fillStyle = fr; g.fillRect(fx - 14, fy - 14, fw + 28, fh + 28);
  g.strokeStyle = "rgba(0,0,0,.4)"; g.lineWidth = 2; g.strokeRect(fx - 6, fy - 6, fw + 12, fh + 12);
  // sepia photograph
  const ph = g.createLinearGradient(0, fy, 0, fy + fh);
  ph.addColorStop(0, "#8d8170"); ph.addColorStop(1, "#4d4438");
  g.fillStyle = ph; g.fillRect(fx, fy, fw, fh);
  g.fillStyle = "rgba(255,240,210,.12)"; g.fillRect(fx + fw * .08, fy + fh * .1, fw * .22, fh * .4); // parlor window
  // seven figures; the pianist on the right sits at a piano
  for (let i = 0; i < 7; i++) {
    const x = fx + fw * (.1 + i * .125), y = fy + fh * (.42 + (i % 2) * .04), r = fw * .035;
    g.fillStyle = "#2a241d";
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.moveTo(x - r * 1.6, fy + fh * .92); g.lineTo(x - r * 1.2, y + r * 1.4); g.lineTo(x + r * 1.2, y + r * 1.4); g.lineTo(x + r * 1.6, fy + fh * .92); g.fill();
    if (i === 6) {
      g.fillStyle = "#14110d"; g.fillRect(x - r * 3.2, fy + fh * .62, r * 2.4, fh * .3); // piano
      if (restored) {
        g.fillStyle = "#cfc2a8"; g.beginPath(); g.arc(x, y, r * .8, 0, Math.PI * 2); g.fill();
        g.fillStyle = "#e9e9ef"; g.beginPath(); g.ellipse(x + r * .8, y - r * .6, r * .35, r * .18, -.5, 0, Math.PI * 2); g.fill();
        g.fillStyle = "#f29a1d"; g.beginPath(); g.arc(x - r * .9, y - r * .7, r * .3, 0, Math.PI * 2); g.fill();
      } else {
        g.strokeStyle = "#efe8da"; g.lineWidth = 1.6;
        for (let s = 0; s < 9; s++) { g.beginPath(); g.moveTo(x - r * 1.2 + s * r * .3, y - r * 1.3); g.lineTo(x - r * .4 + s * r * .3, y + r * 1.2); g.stroke(); }
      }
    }
  }
  // grain and scratches of age
  const rr = rand(11);
  g.fillStyle = "rgba(255,255,255,.06)";
  for (let i = 0; i < 300; i++) g.fillRect(fx + rr() * fw, fy + rr() * fh, 1, 1);
  g.strokeStyle = "rgba(255,255,255,.07)";
  for (let i = 0; i < 6; i++) { const x = fx + rr() * fw; g.beginPath(); g.moveTo(x, fy); g.lineTo(x + 8, fy + fh); g.stroke(); }
}

export function drawLetter(g, w, h, t) {
  g.clearRect(0, 0, w, h); glow(g, w, h, "255,210,150");
  g.save(); g.translate(w / 2, h / 2); g.rotate(-.06);
  const pw = w * .66, ph = pw * 1.2;
  const pg = g.createLinearGradient(-pw / 2, -ph / 2, pw / 2, ph / 2);
  pg.addColorStop(0, "#f2e4c4"); pg.addColorStop(1, "#d8c49a");
  g.fillStyle = pg; g.fillRect(-pw / 2, -ph / 2, pw, ph);
  g.strokeStyle = "rgba(120,90,40,.25)"; g.lineWidth = 1;
  g.beginPath(); g.moveTo(-pw / 2, -ph / 6); g.lineTo(pw / 2, -ph / 6); g.moveTo(-pw / 2, ph / 6); g.lineTo(pw / 2, ph / 6); g.stroke(); // folds
  g.fillStyle = "#3d2a18"; g.font = `italic ${pw * .075}px "Cormorant Garamond", Georgia, serif`;
  g.fillText("My dearest —", -pw * .4, -ph * .36);
  g.strokeStyle = "rgba(61,42,24,.75)"; g.lineWidth = 1.2;
  const rr = rand(5);
  for (let i = 0; i < 11; i++) {
    const y = -ph * .27 + i * ph * .055, len = pw * (.55 + rr() * .25);
    g.beginPath(); g.moveTo(-pw * .4, y);
    for (let x = 0; x < len; x += 6) g.lineTo(-pw * .4 + x, y + Math.sin(x * .3 + i) * 1.6);
    g.stroke();
  }
  g.fillStyle = "#3d2a18"; g.font = `italic ${pw * .06}px "Cormorant Garamond", Georgia, serif`;
  g.fillText("Yours, always — T.", pw * .02, ph * .4);
  // wax seal
  g.fillStyle = "#8e2323"; g.beginPath(); g.arc(pw * .3, -ph * .38, pw * .07, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#b23a3a"; g.beginPath(); g.arc(pw * .3, -ph * .38, pw * .045, 0, Math.PI * 2); g.fill();
  g.restore();
}

export function drawRecord(g, w, h, t) {
  g.clearRect(0, 0, w, h); glow(g, w, h, "190,160,255");
  const cx = w / 2, cy = h / 2, R = Math.min(w, h) * .4;
  g.save(); g.translate(cx, cy); g.rotate(t * 3.5);
  g.fillStyle = "#0d0d10"; g.beginPath(); g.arc(0, 0, R, 0, Math.PI * 2); g.fill();
  for (let i = 0; i < 26; i++) { g.strokeStyle = `rgba(255,255,255,${.03 + (i % 3) * .015})`; g.beginPath(); g.arc(0, 0, R * (.42 + i * .022), 0, Math.PI * 2); g.stroke(); }
  const sheen = g.createLinearGradient(-R, -R, R, R);
  sheen.addColorStop(.35, "rgba(255,255,255,0)"); sheen.addColorStop(.5, "rgba(255,255,255,.12)"); sheen.addColorStop(.65, "rgba(255,255,255,0)");
  g.fillStyle = sheen; g.beginPath(); g.arc(0, 0, R, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#8e2a2a"; g.beginPath(); g.arc(0, 0, R * .3, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#e8d6a8"; g.font = `${R * .09}px "Cormorant Garamond", Georgia, serif`; g.textAlign = "center";
  g.fillText("Whitcombe", 0, -R * .08); g.fillText("Oct. 31, 1931", 0, R * .14);
  g.fillStyle = "#111"; g.beginPath(); g.arc(0, 0, R * .03, 0, Math.PI * 2); g.fill();
  g.restore();
  // tone arm
  g.strokeStyle = "#c9a45c"; g.lineWidth = R * .04; g.lineCap = "round";
  g.beginPath(); g.moveTo(cx + R * 1.05, cy - R * .9); g.lineTo(cx + R * .75, cy + R * .1); g.lineTo(cx + R * .55, cy + R * .25); g.stroke();
  g.fillStyle = "#c9a45c"; g.beginPath(); g.arc(cx + R * 1.05, cy - R * .9, R * .08, 0, Math.PI * 2); g.fill();
}

export function drawGuestList(g, w, h, t, lang = "en") {
  g.clearRect(0, 0, w, h); glow(g, w, h, "240,220,170");
  const pw = w * .58, ph = pw * 1.35, x0 = (w - pw) / 2, y0 = (h - ph) / 2;
  g.fillStyle = "#3a1e12"; g.fillRect(x0 - 10, y0 - 10, pw + 20, ph + 20); // leather cover
  const pg = g.createLinearGradient(x0, y0, x0 + pw, y0 + ph);
  pg.addColorStop(0, "#f3ead6"); pg.addColorStop(1, "#ddd0b2");
  g.fillStyle = pg; g.fillRect(x0, y0, pw, ph);
  g.fillStyle = "#2e2014"; g.textAlign = "left";
  g.font = `italic ${pw * .07}px "Cormorant Garamond", Georgia, serif`;
  g.fillText(lang === "ko" ? "핼러윈 만찬, 1932" : "Hallowe'en Supper, 1932", x0 + pw * .08, y0 + ph * .1);
  g.font = `${pw * .055}px "Cormorant Garamond", Georgia, serif`;
  const names = ["Mr. T. Whitcombe", "Mrs. Ashby", "Dr. Pell", "Miss Croft", "Mr. Lowe", "Mrs. Hale", "Miss M. Vega — pianoforte"];
  names.forEach((n, i) => g.fillText(`${i + 1}.  ${n}`, x0 + pw * .08, y0 + ph * (.2 + i * .1)));
  const sy = y0 + ph * (.2 + 6 * .1) - pw * .018;
  g.strokeStyle = "#0b0806"; g.lineWidth = pw * .028; g.lineCap = "round";
  g.beginPath(); g.moveTo(x0 + pw * .06, sy); g.lineTo(x0 + pw * .94, sy + 2); g.stroke();
  g.fillStyle = "rgba(60,30,20,.6)"; g.font = `italic ${pw * .045}px "Cormorant Garamond", Georgia, serif`;
  g.fillText("— E. W.", x0 + pw * .66, y0 + ph * .94);
}

export const OBJECT_ART = { photo: drawPhoto, letter: drawLetter, record: drawRecord, guest_list: drawGuestList };

// waveform for the record panel: bars that breathe while the record "speaks"
export function drawWave(g, w, h, t, active) {
  g.clearRect(0, 0, w, h);
  const n = 64;
  for (let i = 0; i < n; i++) {
    const a = active ? (.25 + .75 * Math.abs(Math.sin(t * 6 + i * .7) * Math.sin(t * 2.3 + i * .21))) : .08;
    const bh = h * a, x = (i + .5) * w / n;
    g.fillStyle = `rgba(140,185,255,${.4 + a * .6})`;
    g.fillRect(x - 1.2, (h - bh) / 2, 2.4, bh);
  }
}

// ---------------------------------------------------------------- the portrait for the ending
// A painted oval portrait: dark hair with a silver hummingbird comb and a marigold, a high-collared dress.
export function drawPortrait(g, w, h, t) {
  g.clearRect(0, 0, w, h);
  const cx = w / 2, cy = h / 2, rx = w * .4, ry = h * .44;
  // gilt oval frame
  const fr = g.createLinearGradient(0, 0, w, h);
  fr.addColorStop(0, "#6e4f1c"); fr.addColorStop(.45, "#f0cd7c"); fr.addColorStop(1, "#5d4115");
  g.fillStyle = fr; g.beginPath(); g.ellipse(cx, cy, rx + w * .06, ry + w * .06, 0, 0, Math.PI * 2); g.fill();
  g.strokeStyle = "rgba(60,40,10,.6)"; g.lineWidth = 3; g.beginPath(); g.ellipse(cx, cy, rx + w * .02, ry + w * .02, 0, 0, Math.PI * 2); g.stroke();
  g.save(); g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); g.clip();
  // painted background, warm candlelight from the left
  const bg = g.createRadialGradient(cx - rx * .5, cy - ry * .4, 0, cx, cy, rx * 1.4);
  bg.addColorStop(0, "#6d4a2c"); bg.addColorStop(.6, "#33201a"); bg.addColorStop(1, "#140c0a");
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  const s = rx / 100;
  const P = (x, y) => [cx + x * s, cy + y * s];
  const shape = (pts, fill) => { g.fillStyle = fill; g.beginPath(); pts.forEach(([x, y], i) => { const [a, b] = P(x, y); i ? g.lineTo(a, b) : g.moveTo(a, b); }); g.closePath(); g.fill(); };
  // dress and shoulders
  const dress = g.createLinearGradient(0, cy, 0, h);
  dress.addColorStop(0, "#3b2347"); dress.addColorStop(1, "#1c1024");
  g.fillStyle = dress; g.beginPath(); const [d1, d2] = P(-95, 140); g.moveTo(d1, d2);
  [[-80, 70], [-40, 52], [-14, 46], [14, 46], [40, 52], [80, 70], [95, 140]].forEach(([x, y]) => { const [a, b] = P(x, y); g.lineTo(a, b); }); g.fill();
  // lace collar
  g.fillStyle = "rgba(240,228,205,.85)";
  for (let i = -5; i <= 5; i++) { const [a, b] = P(i * 6, 50 + Math.abs(i) * 1.2); g.beginPath(); g.arc(a, b, 4 * s, 0, Math.PI * 2); g.fill(); }
  // neck
  shape([[-12, 48], [-10, 20], [10, 20], [12, 48]], "#c69a7a");
  // hair behind
  g.fillStyle = "#140c0a"; g.beginPath(); const [h1, h2] = P(0, -18); g.ellipse(h1, h2, 46 * s, 54 * s, 0, 0, Math.PI * 2); g.fill();
  // face
  const skin = g.createRadialGradient(...P(-10, -24), 2 * s, ...P(0, -14), 40 * s);
  skin.addColorStop(0, "#e2b994"); skin.addColorStop(1, "#a9785a");
  g.fillStyle = skin; g.beginPath(); const [f1, f2] = P(0, -14); g.ellipse(f1, f2, 30 * s, 38 * s, 0, 0, Math.PI * 2); g.fill();
  // soft features: brows, closed eyes, lips
  g.strokeStyle = "rgba(50,28,20,.7)"; g.lineWidth = 2.2 * s; g.lineCap = "round";
  [[-13, -26], [13, -26]].forEach(([x, y]) => { const [a, b] = P(x, y); g.beginPath(); g.arc(a, b + 6 * s, 7 * s, Math.PI * 1.15, Math.PI * 1.85); g.stroke(); });
  g.lineWidth = 1.6 * s;
  [[-12, -17], [12, -17]].forEach(([x, y]) => { const [a, b] = P(x, y); g.beginPath(); g.arc(a, b - 3 * s, 6 * s, Math.PI * .2, Math.PI * .8); g.stroke(); });
  g.strokeStyle = "rgba(120,60,40,.5)"; g.lineWidth = 1.4 * s; { const [a, b] = P(0, -12); g.beginPath(); g.moveTo(a, b - 6 * s); g.lineTo(a - 2 * s, b + 2 * s); g.stroke(); }
  g.fillStyle = "#9a4a3e"; { const [a, b] = P(0, 4); g.beginPath(); g.ellipse(a, b, 7 * s, 2.6 * s, 0, 0, Math.PI * 2); g.fill(); }
  // hair framing the face, parted in the middle, gathered up
  g.fillStyle = "#1a100c";
  g.beginPath(); const [p1, p2] = P(0, -52); g.moveTo(p1, p2);
  g.quadraticCurveTo(...P(-38, -50), ...P(-32, -6)); g.quadraticCurveTo(...P(-26, -30), ...P(0, -44));
  g.quadraticCurveTo(...P(26, -30), ...P(32, -6)); g.quadraticCurveTo(...P(38, -50), p1, p2); g.fill();
  g.beginPath(); const [b1, b2] = P(0, -60); g.ellipse(b1, b2, 26 * s, 14 * s, 0, 0, Math.PI * 2); g.fill();
  // silver hummingbird comb
  const [hx, hy] = P(24, -52);
  g.save(); g.translate(hx, hy); g.rotate(-.5);
  const sil = g.createLinearGradient(-10 * s, 0, 10 * s, 0); sil.addColorStop(0, "#9aa3b5"); sil.addColorStop(.5, "#f4f6fb"); sil.addColorStop(1, "#8a92a5");
  g.fillStyle = sil;
  g.beginPath(); g.ellipse(0, 0, 7 * s, 3 * s, 0, 0, Math.PI * 2); g.fill();                         // body
  g.beginPath(); g.moveTo(6 * s, -1 * s); g.lineTo(15 * s, -2.5 * s); g.lineTo(6 * s, 1 * s); g.fill(); // beak
  g.beginPath(); g.moveTo(-2 * s, -1 * s); g.quadraticCurveTo(-4 * s, -12 * s, 4 * s, -14 * s); g.quadraticCurveTo(2 * s, -6 * s, 2 * s, -1 * s); g.fill(); // wing
  g.beginPath(); g.moveTo(-6 * s, 0); g.lineTo(-13 * s, -3 * s); g.lineTo(-12 * s, 3 * s); g.fill(); // tail
  g.restore();
  // marigold on the other side
  const [mx, my] = P(-28, -48);
  for (let ring = 3; ring >= 1; ring--) {
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * Math.PI * 2 + ring;
      g.fillStyle = ring === 3 ? "#d8650a" : ring === 2 ? "#f08a12" : "#ffb52e";
      g.beginPath(); g.ellipse(mx + Math.cos(a) * ring * 2.6 * s, my + Math.sin(a) * ring * 2.6 * s, 3.4 * s, 2 * s, a, 0, Math.PI * 2); g.fill();
    }
  }
  // brush texture and candle glow
  const rr = rand(3);
  for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${rr() > .5 ? "255,230,190" : "0,0,0"},${rr() * .05})`; g.fillRect(rr() * w, rr() * h, 2 + rr() * 3, 1); }
  const cg = g.createRadialGradient(cx - rx * .6, cy + ry * .2, 0, cx - rx * .6, cy + ry * .2, rx);
  cg.addColorStop(0, `rgba(255,170,70,${.18 + .05 * Math.sin(t * 4)})`); cg.addColorStop(1, "rgba(255,170,70,0)");
  g.fillStyle = cg; g.fillRect(0, 0, w, h);
  g.restore();
}
