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

// An aged albumen print, 1931: sepia parlour, seven sitters, the pianist's face gouged out of the emulsion.
// Drawn into (x, y, w, h) so the same print is used in the dialogue view and on the 3D frame.
export function drawPhotoPrint(g, x, y, w, h, restored = false) {
  const r = rand(23);
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip(); g.translate(x, y);
  // paper and tone: warm in the middle, faded and silvered toward the edges
  const base = g.createRadialGradient(w * .5, h * .45, h * .1, w * .5, h * .5, w * .7);
  base.addColorStop(0, "#a8957a"); base.addColorStop(.6, "#7d6c56"); base.addColorStop(1, "#3c3328");
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  // parlour: patterned wallpaper, a tall bright window (blown out, as old lenses did), a drape, the floor
  g.globalAlpha = .12; g.fillStyle = "#2a2219";
  for (let yy = 0; yy < h * .62; yy += h * .07) for (let xx = (yy / (h * .07)) % 2 * w * .03; xx < w; xx += w * .06) { g.beginPath(); g.ellipse(xx, yy, w * .008, h * .02, 0, 0, Math.PI * 2); g.fill(); }
  g.globalAlpha = 1;
  const win = g.createLinearGradient(0, h * .05, 0, h * .6);
  win.addColorStop(0, "rgba(245,235,215,.85)"); win.addColorStop(1, "rgba(220,205,180,.45)");
  g.fillStyle = win; g.fillRect(w * .06, h * .06, w * .16, h * .5);
  g.fillStyle = "rgba(60,48,36,.55)"; g.fillRect(w * .135, h * .06, w * .01, h * .5); g.fillRect(w * .06, h * .28, w * .16, h * .012);
  g.fillStyle = "rgba(40,30,22,.7)"; g.beginPath(); g.moveTo(w * .22, h * .02); g.quadraticCurveTo(w * .27, h * .3, w * .24, h * .66); g.lineTo(w * .3, h * .66); g.quadraticCurveTo(w * .3, h * .3, w * .32, h * .02); g.fill();
  g.fillStyle = "rgba(55,44,33,.55)"; g.fillRect(0, h * .66, w, h * .34);
  // the upright piano at the right, where she sits
  g.fillStyle = "rgba(22,17,12,.92)"; g.fillRect(w * .8, h * .3, w * .2, h * .5);
  g.fillStyle = "rgba(200,190,170,.55)"; g.fillRect(w * .8, h * .5, w * .2, h * .02);
  // seven sitters: heads, hair, collars, dark clothes; lit from the window on the left
  const people = [[.16, .38, 0], [.27, .35, 1], [.38, .39, 0], [.49, .34, 1], [.6, .38, 0], [.7, .36, 1], [.86, .4, 1]];
  people.forEach(([px, py, woman], i) => {
    const cx = px * w, cy = py * h, hr = w * .034, last = i === 6;
    const body = g.createLinearGradient(cx - hr * 3, 0, cx + hr * 3, 0);
    body.addColorStop(0, "rgba(58,46,34,.95)"); body.addColorStop(1, "rgba(18,14,10,.95)");
    g.fillStyle = body; g.beginPath();
    g.moveTo(cx - hr * (woman ? 3.2 : 2.6), h); g.lineTo(cx - hr * 2.2, cy + hr * 1.8); g.quadraticCurveTo(cx, cy + hr * 1.2, cx + hr * 2.2, cy + hr * 1.8); g.lineTo(cx + hr * (woman ? 3.2 : 2.6), h); g.fill();
    g.fillStyle = "rgba(225,215,195,.55)"; g.beginPath(); g.moveTo(cx - hr * .7, cy + hr * 1.3); g.lineTo(cx, cy + hr * 2.3); g.lineTo(cx + hr * .7, cy + hr * 1.3); g.fill(); // collar
    const face = g.createRadialGradient(cx - hr * .4, cy - hr * .3, hr * .1, cx, cy, hr * 1.1);
    face.addColorStop(0, "rgba(212,196,170,1)"); face.addColorStop(1, "rgba(120,102,80,1)");
    g.fillStyle = face; g.beginPath(); g.ellipse(cx, cy, hr * .82, hr, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = "rgba(30,22,16,.55)"; [-1, 1].forEach((k) => { g.beginPath(); g.ellipse(cx + k * hr * .32, cy - hr * .1, hr * .16, hr * .1, 0, 0, Math.PI * 2); g.fill(); });
    g.fillStyle = "rgba(30,22,16,.4)"; g.fillRect(cx - hr * .25, cy + hr * .45, hr * .5, hr * .08);
    g.fillStyle = "rgba(24,18,13,.95)"; g.beginPath(); // hair: an updo for the women, short and parted for the men
    if (woman) { g.ellipse(cx, cy - hr * .55, hr * .95, hr * .6, 0, Math.PI, 0); g.fill(); g.beginPath(); g.arc(cx + hr * .2, cy - hr * 1.15, hr * .45, 0, Math.PI * 2); }
    else g.ellipse(cx, cy - hr * .62, hr * .88, hr * .45, 0, Math.PI, 0);
    g.fill();
    if (i === 3) { g.globalAlpha = .25; g.fillStyle = face; g.beginPath(); g.ellipse(cx + hr * .5, cy, hr * .82, hr, 0, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1; } // one sitter moved during the exposure
    if (last) {
      // her comb and flower (the flower is a pale grey: the photo cannot see its color)
      g.fillStyle = "rgba(235,235,240,.9)"; g.beginPath(); g.ellipse(cx + hr * .75, cy - hr * 1.0, hr * .32, hr * .13, -.5, 0, Math.PI * 2); g.fill();
      g.fillStyle = "rgba(190,185,175,.85)"; g.beginPath(); g.arc(cx - hr * .8, cy - hr * .95, hr * .3, 0, Math.PI * 2); g.fill();
      if (restored) {
        g.fillStyle = "#f29a1d"; g.beginPath(); g.arc(cx - hr * .8, cy - hr * .95, hr * .3, 0, Math.PI * 2); g.fill();
      } else {
        // the emulsion gouged away: a torn pale patch, then hard pin scratches across it
        g.fillStyle = "rgba(236,228,212,.96)"; g.beginPath();
        for (let k = 0; k <= 18; k++) { const a = k / 18 * Math.PI * 2, rad = hr * (1.05 + r() * .45); const px2 = cx + Math.cos(a) * rad * .9, py2 = cy + Math.sin(a) * rad; k ? g.lineTo(px2, py2) : g.moveTo(px2, py2); }
        g.fill();
        g.strokeStyle = "rgba(255,252,245,.95)"; g.lineCap = "round";
        for (let k = 0; k < 16; k++) { g.lineWidth = .6 + r() * 1.4; const sx = cx - hr * 1.4 + r() * hr * 2.8, sy = cy - hr * 1.5 + r() * hr; g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx + (r() - .3) * hr * 1.2, sy + hr * (1.4 + r() * 1.2)); g.stroke(); }
        g.strokeStyle = "rgba(60,45,30,.5)"; g.lineWidth = 1;
        for (let k = 0; k < 6; k++) { const sx = cx - hr + r() * hr * 2, sy = cy - hr + r() * hr * 2; g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx + r() * 6 - 3, sy + r() * 10); g.stroke(); }
      }
    }
  });
  // age: sepia wash, foxing, cracks, dust, a crease across one corner, silvering and a dark vignette
  g.fillStyle = "rgba(120,80,30,.12)"; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 38; i++) { const fx2 = r() * w, fy2 = r() * h, fr2 = 1 + r() * w * .012; const fg = g.createRadialGradient(fx2, fy2, 0, fx2, fy2, fr2); fg.addColorStop(0, "rgba(110,70,30,.45)"); fg.addColorStop(1, "rgba(110,70,30,0)"); g.fillStyle = fg; g.fillRect(fx2 - fr2, fy2 - fr2, fr2 * 2, fr2 * 2); }
  g.strokeStyle = "rgba(240,232,215,.35)"; g.lineWidth = .8;
  for (let i = 0; i < 7; i++) { let cx2 = r() * w, cy2 = r() * h; g.beginPath(); g.moveTo(cx2, cy2); for (let k = 0; k < 6; k++) { cx2 += (r() - .5) * w * .08; cy2 += (r() - .3) * h * .08; g.lineTo(cx2, cy2); } g.stroke(); }
  for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${r() > .5 ? "255,250,240" : "20,14,8"},${r() * .18})`; g.fillRect(r() * w, r() * h, 1, 1); }
  g.strokeStyle = "rgba(245,238,225,.45)"; g.lineWidth = 2; g.beginPath(); g.moveTo(w * .78, h); g.lineTo(w, h * .7); g.stroke();
  const silver = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * .35, w / 2, h / 2, Math.max(w, h) * .62);
  silver.addColorStop(0, "rgba(0,0,0,0)"); silver.addColorStop(.75, "rgba(25,18,12,.55)"); silver.addColorStop(1, "rgba(140,150,165,.35)");
  g.fillStyle = silver; g.fillRect(0, 0, w, h);
  g.restore();
}

export function drawPhoto(g, w, h, t, restored = false) {
  g.clearRect(0, 0, w, h); glow(g, w, h);
  const fw = w * .78, fh = fw * .68, fx = (w - fw) / 2, fy = (h - fh) / 2;
  // a worn wooden frame with a pale mat, like the one on the mantel
  const fr = g.createLinearGradient(fx, fy, fx + fw, fy + fh);
  fr.addColorStop(0, "#4a3a2c"); fr.addColorStop(.5, "#8a7660"); fr.addColorStop(1, "#3a2c20");
  g.fillStyle = fr; g.fillRect(fx - 26, fy - 26, fw + 52, fh + 52);
  g.fillStyle = "#cfc4ae"; g.fillRect(fx - 12, fy - 12, fw + 24, fh + 24);
  g.strokeStyle = "rgba(0,0,0,.35)"; g.lineWidth = 2; g.strokeRect(fx - 1, fy - 1, fw + 2, fh + 2);
  drawPhotoPrint(g, fx, fy, fw, fh, restored);
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
// The ending: her photograph, restored. A black-and-white cabinet card in the style of the 1930s, the only colour
// the marigold someone hand-tinted later. Her eyes are open and on you. The card is drawn once and cached; each frame
// only adds the flicker of a faint second exposure and grain.
let portraitCache = null;
function paintPortraitCard(w, h) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const g = c.getContext("2d"), r = rand(41);
  // card mount: dark board with a gilt bevel and a printed studio line
  g.fillStyle = "#17120e"; g.fillRect(0, 0, w, h);
  g.strokeStyle = "rgba(190,160,100,.55)"; g.lineWidth = 3; g.strokeRect(w * .06, h * .05, w * .88, h * .9);
  g.fillStyle = "rgba(190,160,100,.6)"; g.font = `italic ${w * .032}px "Cormorant Garamond", Georgia, serif`; g.textAlign = "center";
  g.fillText("Oaxaca · 1931", w / 2, h * .925);
  // the print: an oval vignette, soft and silvery
  const cx = w / 2, cy = h * .45, rx = w * .36, ry = h * .38;
  g.save(); g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); g.clip();
  const bg = g.createRadialGradient(cx - rx * .3, cy - ry * .2, rx * .1, cx, cy, rx * 1.2);
  bg.addColorStop(0, "#9a958e"); bg.addColorStop(.7, "#55514c"); bg.addColorStop(1, "#24221f");
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  const s = rx / 66, P = (x, y) => [cx + x * s, cy + (y + 10) * s]; // a close head-and-shoulders crop
  const shade = (x, y, r0, r1, a, b) => { const [px, py] = P(x, y); const gr = g.createRadialGradient(px, py, r0 * s, px, py, r1 * s); gr.addColorStop(0, a); gr.addColorStop(1, b); return gr; };
  g.filter = "blur(0.6px)";
  // shoulders, a dark dress with a lace collar
  g.fillStyle = shade(-20, 95, 10, 110, "#3a3734", "#0e0d0c"); g.beginPath();
  const [d0x, d0y] = P(-110, 140); g.moveTo(d0x, d0y);
  [[-95, 82], [-55, 62], [-22, 56], [22, 56], [55, 62], [95, 82], [110, 140]].forEach(([x, y]) => g.lineTo(...P(x, y))); g.fill();
  g.fillStyle = "rgba(225,222,215,.75)";
  for (let k = -6; k <= 6; k++) { const [lx, ly] = P(k * 5.5, 57 + Math.abs(k) * 1.1); g.beginPath(); g.arc(lx, ly, 3.4 * s, 0, Math.PI * 2); g.fill(); }
  // neck, then hair behind the head
  g.fillStyle = shade(-4, 40, 2, 22, "#a39d95", "#5b5650"); g.beginPath(); g.moveTo(...P(-15, 58)); g.lineTo(...P(-12, 22)); g.lineTo(...P(12, 22)); g.lineTo(...P(15, 58)); g.fill();
  g.fillStyle = "#0d0c0b"; g.beginPath(); g.ellipse(...P(0, -14), 43 * s, 52 * s, 0, 0, Math.PI * 2); g.fill();
  // face: light from the upper left, a soft shadow along the right cheek and jaw
  g.fillStyle = shade(-10, -22, 4, 44, "#d6d1c9", "#6f6a63"); g.beginPath(); g.ellipse(...P(0, -12), 29 * s, 37 * s, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = shade(24, -4, 2, 26, "rgba(40,36,32,.55)", "rgba(40,36,32,0)"); g.beginPath(); g.ellipse(...P(16, -6), 16 * s, 30 * s, 0, 0, Math.PI * 2); g.fill();
  // brows
  g.strokeStyle = "rgba(25,22,20,.85)"; g.lineCap = "round"; g.lineWidth = 2.6 * s;
  [[-12, -1], [12, 1]].forEach(([x, k]) => { const [bx, by] = P(x, -27); g.beginPath(); g.moveTo(bx - 8 * s, by + 1.5 * s * (k < 0 ? 1 : 1)); g.quadraticCurveTo(bx, by - 3 * s, bx + 8 * s, by + 1 * s); g.stroke(); });
  // eyes, open: shadowed sockets, whites, dark irises with a catchlight, heavy upper lids
  [[-12, -19], [12, -19]].forEach(([x, y]) => {
    const [ex, ey] = P(x, y);
    g.fillStyle = shade(x, y, 2, 11, "rgba(50,45,40,.55)", "rgba(50,45,40,0)"); g.beginPath(); g.ellipse(ex, ey, 11 * s, 7 * s, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#cfcac2"; g.beginPath(); g.ellipse(ex, ey, 6.6 * s, 3.2 * s, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#151311"; g.beginPath(); g.arc(ex + .4 * s, ey + .2 * s, 2.9 * s, 0, Math.PI * 2); g.fill();
    g.fillStyle = "rgba(255,255,255,.9)"; g.beginPath(); g.arc(ex - .6 * s, ey - .9 * s, .8 * s, 0, Math.PI * 2); g.fill();
    g.strokeStyle = "rgba(20,18,16,.9)"; g.lineWidth = 1.7 * s; g.beginPath(); g.ellipse(ex, ey + .6 * s, 6.8 * s, 3.6 * s, 0, Math.PI * 1.05, Math.PI * 1.95); g.stroke();
  });
  // nose and lips
  g.strokeStyle = "rgba(60,55,50,.6)"; g.lineWidth = 1.3 * s; g.beginPath(); g.moveTo(...P(2, -16)); g.quadraticCurveTo(...P(5, -3), ...P(1, 0)); g.stroke();
  g.fillStyle = "rgba(55,50,46,.55)"; g.beginPath(); g.ellipse(...P(-2, 1), 5 * s, 1.8 * s, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#5c5550"; g.beginPath(); g.moveTo(...P(-9, 12)); g.quadraticCurveTo(...P(0, 9), ...P(9, 12)); g.quadraticCurveTo(...P(0, 17), ...P(-9, 12)); g.fill();
  g.strokeStyle = "rgba(30,27,25,.7)"; g.lineWidth = 1 * s; g.beginPath(); g.moveTo(...P(-9, 12)); g.quadraticCurveTo(...P(0, 13), ...P(9, 12)); g.stroke();
  // hair framing the face, parted in the middle and drawn back
  g.fillStyle = "#0b0a09"; g.beginPath(); g.moveTo(...P(0, -52));
  g.quadraticCurveTo(...P(-40, -50), ...P(-33, -2)); g.quadraticCurveTo(...P(-27, -34), ...P(0, -45));
  g.quadraticCurveTo(...P(27, -34), ...P(33, -2)); g.quadraticCurveTo(...P(40, -50), ...P(0, -52)); g.fill();
  g.strokeStyle = "rgba(120,115,108,.25)"; g.lineWidth = 1; for (let k = 0; k < 14; k++) { g.beginPath(); g.moveTo(...P(-2, -50)); g.quadraticCurveTo(...P(-20 - k, -44 + k), ...P(-30 + k * .6, -10 + k * 2)); g.stroke(); }
  // silver hummingbird comb
  const [hx, hy] = P(25, -46); g.save(); g.translate(hx, hy); g.rotate(-.5);
  g.fillStyle = "#e8e6e2"; g.beginPath(); g.ellipse(0, 0, 7 * s, 3 * s, 0, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.moveTo(6 * s, -1 * s); g.lineTo(15 * s, -2.5 * s); g.lineTo(6 * s, 1 * s); g.fill();
  g.beginPath(); g.moveTo(-2 * s, -1 * s); g.quadraticCurveTo(-4 * s, -12 * s, 4 * s, -14 * s); g.quadraticCurveTo(2 * s, -6 * s, 2 * s, -1 * s); g.fill();
  g.restore();
  g.filter = "none";
  // grain, a few scratches, silvering at the rim of the oval
  for (let i = 0; i < 6000; i++) { g.fillStyle = `rgba(${r() > .5 ? "255,255,255" : "0,0,0"},${r() * .09})`; g.fillRect(r() * w, r() * h, 1, 1); }
  g.strokeStyle = "rgba(235,232,225,.35)"; g.lineWidth = .8;
  for (let i = 0; i < 9; i++) { const x0 = cx - rx + r() * rx * 2, y0 = cy - ry + r() * ry * 2; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0 + (r() - .5) * 30, y0 + r() * 90); g.stroke(); }
  const rim = g.createRadialGradient(cx, cy, rx * .55, cx, cy, rx * 1.05);
  rim.addColorStop(0, "rgba(0,0,0,0)"); rim.addColorStop(.8, "rgba(10,9,8,.6)"); rim.addColorStop(1, "rgba(150,155,165,.45)");
  g.fillStyle = rim; g.fillRect(0, 0, w, h);
  g.restore();
  // make the whole print monochrome
  const img = g.getImageData(0, 0, w, h), d = img.data;
  for (let i = 0; i < d.length; i += 4) { const l = d[i] * .3 + d[i + 1] * .59 + d[i + 2] * .11; d[i] = l * 1.02; d[i + 1] = l; d[i + 2] = l * .96; }
  g.putImageData(img, 0, 0);
  // the one hand-tinted thing: the marigold in her hair
  const [mx, my] = P(-29, -46);
  for (let ring = 3; ring >= 1; ring--) for (let k = 0; k < 12; k++) {
    const a = k / 12 * Math.PI * 2 + ring;
    g.fillStyle = ring === 3 ? "rgba(200,95,15,.85)" : ring === 2 ? "rgba(235,135,25,.85)" : "rgba(250,180,50,.9)";
    g.beginPath(); g.ellipse(mx + Math.cos(a) * ring * 2.6 * s, my + Math.sin(a) * ring * 2.6 * s, 3.4 * s, 2 * s, a, 0, Math.PI * 2); g.fill();
  }
  return { c, cx, cy, rx, ry };
}

// Her photograph for the ending (web/img/marisol.webp, supplied by the project owner). The drawn card above is the
// fallback until it loads or if it fails. The photo is cropped to fill the canvas, the flower in her hair is
// hand-tinted marigold, and the same breathing second exposure and grain are laid over it.
const marisolPhoto = new Image();
marisolPhoto.src = "img/marisol.webp";
const FLOWER = { x: 250 / 1145, y: 420 / 1374, r: 70 / 1145 }; // the flower in her hair, as fractions of the photo
function paintPhotoCard(w, h) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const g = c.getContext("2d"), iw = marisolPhoto.naturalWidth, ih = marisolPhoto.naturalHeight;
  const k = Math.max(w / iw, h / ih), dw = iw * k, dh = ih * k, dx = (w - dw) / 2, dy = (h - dh) / 2;
  g.drawImage(marisolPhoto, dx, dy, dw, dh);
  const fx = dx + FLOWER.x * dw, fy = dy + FLOWER.y * dh, fr = FLOWER.r * dw;
  g.globalCompositeOperation = "color"; // keep the photo's light and shade, give the flower its colour
  const tint = g.createRadialGradient(fx, fy, 0, fx, fy, fr);
  tint.addColorStop(0, "rgba(245,140,25,1)"); tint.addColorStop(.7, "rgba(240,130,20,.85)"); tint.addColorStop(1, "rgba(240,130,20,0)");
  g.fillStyle = tint; g.beginPath(); g.arc(fx, fy, fr, 0, Math.PI * 2); g.fill();
  g.globalCompositeOperation = "source-over";
  return { c, cx: w / 2, cy: h / 2, rx: w / 2, ry: h / 2, photo: true };
}

export function drawPortrait(g, w, h, t) {
  const ready = marisolPhoto.complete && marisolPhoto.naturalWidth > 0;
  if (!portraitCache || portraitCache.c.width !== w || (ready && !portraitCache.photo)) portraitCache = ready ? paintPhotoCard(w, h) : paintPortraitCard(w, h);
  const { c, cx, cy, rx, ry } = portraitCache;
  g.clearRect(0, 0, w, h);
  g.drawImage(c, 0, 0);
  // a second exposure that is not quite there: slightly offset, breathing in and out
  const a = .07 + .06 * Math.sin(t * .9) + (Math.sin(t * 7.3) > .97 ? .12 : 0);
  g.save(); g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); g.clip();
  g.globalAlpha = a; g.drawImage(c, 6 + Math.sin(t * .5) * 3, -4, w, h); g.globalAlpha = 1;
  // living grain
  for (let i = 0; i < 700; i++) { g.fillStyle = `rgba(${Math.random() > .5 ? "255,255,255" : "0,0,0"},${Math.random() * .08})`; g.fillRect(cx - rx + Math.random() * rx * 2, cy - ry + Math.random() * ry * 2, 1.5, 1.5); }
  g.restore();
}
