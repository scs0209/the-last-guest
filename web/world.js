// The house: a foyer, the dining room where six ghosts wait, and a study. First-person walking.
// Furniture models and floor/wall textures are Poly Haven assets (CC0), compressed into web/models and web/textures.
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

// ---------------------------------------------------------------- layout (metres; y is up)
export const ROOMS = {
  foyer: { x: [-4, 4], z: [2, 10] },
  dining: { x: [-5, 5], z: [-6, 2] },
  study: { x: [4, 10], z: [3, 9] },
};
const DOORS = [{ x: [-1, 1], z: [1.4, 2.6] }, { x: [3.4, 4.6], z: [5, 7] }];
const WALLS = [ // [x1, z1, x2, z2]; gaps are doorways
  [-4, 10, 4, 10], [-4, 2, -4, 10], [4, 7, 4, 10], [4, 2, 4, 5],
  [-5, 2, -1, 2], [1, 2, 5, 2], [-5, -6, 5, -6], [-5, -6, -5, 2], [5, -6, 5, 2],
  [4, 3, 10, 3], [10, 3, 10, 9], [4, 9, 10, 9], [4, 3, 4, 5], [4, 7, 4, 9],
];
const BLOCKS = [ // furniture the player cannot walk through
  { x: [-3, 3], z: [-3.2, -0.8] },          // dining table and chairs
  { x: [2.9, 4.9], z: [-6, -4.6] },         // piano
  { x: [-5, -4.3], z: [-3.2, -0.8] },       // fireplace
  { x: [-4, -1.8], z: [2, 4.6] }, { x: [1.8, 4], z: [2, 4.2] }, // staircases
  { x: [7.4, 9.4], z: [5.3, 6.7] },         // desk
  { x: [4.4, 5.6], z: [3, 4.1] },           // gramophone table
  { x: [9.4, 10], z: [3, 9] },              // bookshelves
  { x: [1.9, 3.3], z: [9.3, 10] },          // console by the front door
  { x: [4.1, 5], z: [-2.4, -0.8] },         // dining room cabinet
  { x: [5.5, 7.2], z: [7.6, 8.6] },         // armchair and its little table
  { x: [4, 5.4], z: [7.7, 9] },             // gothic statue in the study corner
  { x: [8.05, 9], z: [3, 4.35] },           // rocking chair
];
const SEAT7 = new THREE.Vector3(3.2, 0, -4.1);
const SHELF_LEVELS = [.04, .3, .56, .8]; // board heights of the Shelf_01 bookcase, as fractions of its height
const R = .28, EYE = 1.6;

const inRect = (r, x, z, m = 0) => x > r.x[0] + m && x < r.x[1] - m && z > r.z[0] + m && z < r.z[1] - m;
function walkable(x, z) {
  const inside = Object.values(ROOMS).some((r) => inRect(r, x, z, R)) || DOORS.some((d) => inRect(d, x, z, 0));
  return inside && !BLOCKS.some((b) => x > b.x[0] - R && x < b.x[1] + R && z > b.z[0] - R && z < b.z[1] + R);
}
export function roomAt(x, z) { return Object.keys(ROOMS).find((k) => inRect(ROOMS[k], x, z)) || "foyer"; }

// ---------------------------------------------------------------- helpers
function canvasTex(w, h, draw, repeat) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  return t;
}

export function createWorld(canvas, opts) {
  const isTouchDevice = matchMedia("(pointer: coarse)").matches;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio, isTouchDevice ? 1 : 1.5));
  renderer.shadowMap.enabled = !isTouchDevice; renderer.shadowMap.autoUpdate = false; // one shadow light, redrawn every third frame (below) renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x030308);
  scene.fog = new THREE.FogExp2(0x07070f, .11); // the far end of every room dissolves into dark
  const camera = new THREE.PerspectiveCamera(70, 1, .05, 60);
  // a faint room reflection so brass, glass and varnish read as such; kept low so the house stays dark
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), .04).texture;
  const ENV = .25;

  // ------------------------------------------------ textures
  // floor, wallpaper and wainscot: one tiling texture set each; geometry UVs are scaled to metres instead of cloning textures
  const texLoader = new THREE.TextureLoader();
  const tex = (file, srgb) => {
    const t = texLoader.load(`textures/${file}.jpg`); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  const pbr = (name, extra) => new THREE.MeshStandardMaterial({ map: tex(`${name}_diff`, true), normalMap: tex(`${name}_nor`), roughnessMap: tex(`${name}_rough`), envMapIntensity: ENV, ...extra });
  const tileUV = (geo, u, v) => { const a = geo.attributes.uv; for (let i = 0; i < a.count; i++) a.setXY(i, a.getX(i) * u, a.getY(i) * v); return geo; };
  const rug = canvasTex(256, 384, (g, w, h) => {
    g.fillStyle = "#2a0a0d"; g.fillRect(0, 0, w, h);
    g.strokeStyle = "#6e5428"; g.lineWidth = 6; g.strokeRect(14, 14, w - 28, h - 28);
    g.strokeStyle = "#141a2a"; g.lineWidth = 10; g.strokeRect(30, 30, w - 60, h - 60);
    g.fillStyle = "#3e1014"; g.beginPath(); g.ellipse(w / 2, h / 2, w * .28, h * .3, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = "#6e5428"; g.lineWidth = 3; g.stroke();
    for (let i = 0; i < 2500; i++) { g.fillStyle = `rgba(${Math.random() < .5 ? "0,0,0" : "120,110,100"},${Math.random() * .12})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); } // worn and dusty
  });
  // dark oil portraits: a sitter lit from one side against brown murk, brush texture, crazed varnish;
  // the faces have gone pale and blank, the eyes only shadows
  const portraitTex = (hue, woman = false) => canvasTex(256, 320, (g, w, h) => {
    const rr = (() => { let s = hue * 97 + 13; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
    const bg = g.createRadialGradient(w * .35, h * .3, 5, w * .5, h * .5, w * .9);
    bg.addColorStop(0, `hsl(${hue},18%,20%)`); bg.addColorStop(.6, `hsl(${hue},20%,8%)`); bg.addColorStop(1, "#040303");
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) { g.strokeStyle = `hsla(${hue},20%,${8 + rr() * 14}%,${.15 + rr() * .2})`; g.lineWidth = 2 + rr() * 5; const x = rr() * w, y = rr() * h; g.beginPath(); g.moveTo(x, y); g.lineTo(x + rr() * 26 - 13, y + rr() * 16 - 8); g.stroke(); } // brushwork
    // shoulders and dark clothes, a pale collar
    const coat = g.createLinearGradient(w * .2, 0, w * .8, 0); coat.addColorStop(0, "#2a211b"); coat.addColorStop(1, "#070505");
    g.fillStyle = coat; g.beginPath(); g.moveTo(w * .05, h); g.quadraticCurveTo(w * .12, h * .66, w * .36, h * .62); g.lineTo(w * .64, h * .62); g.quadraticCurveTo(w * .88, h * .66, w * .95, h); g.fill();
    g.fillStyle = woman ? "rgba(200,190,170,.5)" : "rgba(210,200,185,.55)"; g.beginPath(); g.moveTo(w * .42, h * .6); g.lineTo(w * .5, h * .72); g.lineTo(w * .58, h * .6); g.fill();
    g.fillStyle = "#3a2e28"; g.fillRect(w * .44, h * .5, w * .12, h * .12); // neck
    const face = g.createRadialGradient(w * .44, h * .36, 4, w * .5, h * .4, w * .2);
    face.addColorStop(0, "#8a7c6e"); face.addColorStop(.7, "#4a3e36"); face.addColorStop(1, "#1e1814");
    g.fillStyle = face; g.beginPath(); g.ellipse(w * .5, h * .4, w * .15, h * .15, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = "rgba(4,3,3,.9)"; [-1, 1].forEach((k) => { const e = g.createRadialGradient(w * (.5 + k * .055), h * .385, 1, w * (.5 + k * .055), h * .385, w * .04); e.addColorStop(0, "rgba(0,0,0,.95)"); e.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = e; g.beginPath(); g.ellipse(w * (.5 + k * .055), h * .385, w * .04, h * .028, 0, 0, Math.PI * 2); g.fill(); });
    g.fillStyle = "#0b0807"; g.beginPath(); // hair
    if (woman) { g.ellipse(w * .5, h * .33, w * .19, h * .1, 0, Math.PI, 0); g.fill(); g.beginPath(); g.arc(w * .5, h * .22, w * .08, 0, Math.PI * 2); g.fill(); g.beginPath(); g.ellipse(w * .36, h * .42, w * .05, h * .1, 0, 0, Math.PI * 2); g.ellipse(w * .64, h * .42, w * .05, h * .1, 0, 0, Math.PI * 2); }
    else g.ellipse(w * .5, h * .31, w * .17, h * .08, 0, Math.PI, 0);
    g.fill();
    g.strokeStyle = "rgba(0,0,0,.4)"; g.lineWidth = 1; // crazed varnish
    for (let i = 0; i < 90; i++) { let x = rr() * w, y = rr() * h; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 3; k++) { x += rr() * 14 - 7; y += rr() * 14 - 7; g.lineTo(x, y); } g.stroke(); }
    g.fillStyle = "rgba(90,70,30,.18)"; g.fillRect(0, 0, w, h); // yellowed varnish
  });
  const booksTex = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = "#1a0e08"; g.fillRect(0, 0, w, h);
    for (let row = 0; row < 4; row++) {
      let x = 4;
      while (x < w - 6) {
        const bw = 6 + Math.random() * 10, bh = 44 + Math.random() * 14;
        g.fillStyle = ["#5a1a14", "#1e3a2a", "#2a2450", "#6a4a1a", "#3a1a2a"][Math.floor(Math.random() * 5)];
        g.fillRect(x, row * 64 + 62 - bh, bw, bh);
        g.fillStyle = "rgba(220,180,90,.35)"; g.fillRect(x + 1, row * 64 + 62 - bh + 8, bw - 2, 2);
        x += bw + 1;
      }
      g.fillStyle = "#2b170c"; g.fillRect(0, row * 64 + 60, w, 4);
    }
  }, [2, 1]);

  // ------------------------------------------------ materials
  const M = {
    wall: pbr("decrepit_wallpaper", { color: 0x6a6070, side: THREE.DoubleSide }),
    stoneWall: pbr("medieval_blocks_03", { color: 0x8a8480 }), // the dining room is older than the rest of the house
    wains: pbr("dark_paneled_wood", { color: 0x8a6a5a }),
    floor: pbr("herringbone_parquet", { color: 0x7a6658 }),
    ceil: new THREE.MeshStandardMaterial({ color: 0x08060a, roughness: 1, side: THREE.DoubleSide }),
    wood: new THREE.MeshStandardMaterial({ color: 0x34180e, roughness: .5 }),
    darkwood: new THREE.MeshStandardMaterial({ color: 0x1d0d07, roughness: .45 }),
    cloth: new THREE.MeshStandardMaterial({ color: 0x7e7668, roughness: .97 }), // linen gone grey with dust
    velvet: new THREE.MeshStandardMaterial({ color: 0x47203e, roughness: 1 }),
    brass: new THREE.MeshStandardMaterial({ color: 0xc9a45c, roughness: .3, metalness: .85 }),
    wax: new THREE.MeshStandardMaterial({ color: 0xbdb3a0, roughness: .7, emissive: 0x120a04 }),
    flame: new THREE.MeshBasicMaterial({ color: 0xffd27a }),
    black: new THREE.MeshStandardMaterial({ color: 0x090909, roughness: .25 }),
    stone: new THREE.MeshStandardMaterial({ color: 0x2a2626, roughness: .9 }),
    rug: new THREE.MeshStandardMaterial({ map: rug, roughness: 1 }),
    books: new THREE.MeshStandardMaterial({ map: booksTex, roughness: .9 }),
    glass: new THREE.MeshBasicMaterial({ color: 0x1a2448 }),
  };
  M.floor.roughnessMap = null; M.floor.roughness = .82; // old, dull varnish: candles and lightning no longer mirror as hot spots on it
  const box = (w, h, d, m) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.castShadow = o.receiveShadow = true; return o; };
  const cyl = (rt, rb, h, m, s = 20) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, s), m); o.castShadow = o.receiveShadow = true; return o; };
  const at = (o, x, y, z, ry = 0) => { o.position.set(x, y, z); o.rotation.y = ry; scene.add(o); return o; };
  const put = (o, x, y, z) => { o.position.set(x, y, z); return o; };
  const pickables = [], blockers = []; // what a click can choose, and the walls that hide it
  // keep reflections faint on everything, models included
  const dim = (o) => o.traverse((m) => { if (m.isMesh) [].concat(m.material).forEach((mt) => { if (mt.envMapIntensity === 1) mt.envMapIntensity = ENV; }); });

  // furniture models: loaded once, cloned per use, scaled to a target size and set down by their base.
  // The procedural stand-ins listed in `hide` stay until the model arrives, so a failed load still leaves a house.
  const gltf = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder), loaded = {};
  const v3 = new THREE.Vector3(), b3 = new THREE.Box3();
  const tinted = new WeakSet();
  function place(name, { x, y = 0, z, ry = 0, rx = 0, rz = 0, height, width, size, anchor = "bottom", against, tint, hide = [] }) {
    loaded[name] ||= gltf.loadAsync(`models/${name}.glb`).then((g) => g.scene);
    const done = loaded[name].then((src) => {
      const o = src.clone(true), holder = new THREE.Group();
      o.rotation.set(rx, 0, rz); holder.add(o);
      b3.setFromObject(o).getSize(v3);
      if (size) o.scale.set(size[0] / v3.x, size[1] / v3.y, size[2] / v3.z);
      else o.scale.setScalar(height ? height / v3.y : width / v3.x);
      b3.setFromObject(o); b3.getCenter(v3);
      o.position.set(-v3.x, anchor === "bottom" ? -b3.min.y : anchor === "top" ? -b3.max.y : -v3.y, -v3.z);
      holder.position.set(x, y, z); holder.rotation.y = ry; scene.add(holder); dim(holder);
      holder.traverse((m) => {
        if (!m.isMesh) return;
        m.castShadow = m.receiveShadow = true;
        if (tint && !tinted.has(m.material)) { tinted.add(m.material); m.material.color.multiply(new THREE.Color(tint)); } // clones share materials: tint once
      });
      if (against) { // push it back until it touches a wall: ["x+", 9.98] puts its max x there
        b3.setFromObject(holder);
        const [axis, sign] = [against[0][0], against[0][1]];
        holder.position[axis] += against[1] - (sign === "+" ? b3.max[axis] : b3.min[axis]);
      }
      hide.forEach((h) => { h.visible = false; });
      return { holder, box: b3.setFromObject(holder).clone() };
    }).catch((e) => { console.warn(`model ${name} failed to load`, e); return null; });
    placing.push(done);
    return done;
  }
  const placing = [];

  // ------------------------------------------------ rooms
  const H = 4;
  for (const r of Object.values(ROOMS)) {
    const w = r.x[1] - r.x[0], d = r.z[1] - r.z[0], cx = (r.x[0] + r.x[1]) / 2, cz = (r.z[0] + r.z[1]) / 2;
    const f = new THREE.Mesh(tileUV(new THREE.PlaneGeometry(w, d), w / 1.6, d / 1.6), M.floor); f.rotation.x = -Math.PI / 2; f.receiveShadow = true; at(f, cx, 0, cz);
    const c = new THREE.Mesh(new THREE.PlaneGeometry(w, d), M.ceil); c.rotation.x = Math.PI / 2; at(c, cx, H, cz);
  }
  const STONE = 2.2; // metres per tile of the stone blocks
  for (const [x1, z1, x2, z2] of WALLS) {
    const len = Math.hypot(x2 - x1, z2 - z1), ang = Math.atan2(z2 - z1, x2 - x1);
    if (Math.max(z1, z2) <= 2 && Math.min(z1, z2) < 2) { // a dining room wall (the side walls run up to z = 2): bare stone to the floor
      const wall = new THREE.Mesh(tileUV(new THREE.PlaneGeometry(len, H), len / STONE, H / STONE), M.stoneWall); wall.receiveShadow = true; blockers.push(wall);
      wall.material.side = THREE.DoubleSide; at(wall, (x1 + x2) / 2, H / 2, (z1 + z2) / 2, -ang);
      continue;
    }
    if (z1 === 2 && z2 === 2) { // the wall shared with the foyer gets a stone face on the dining side
      const face = new THREE.Mesh(tileUV(new THREE.PlaneGeometry(len, H), len / STONE, H / STONE), M.stoneWall); face.receiveShadow = true;
      at(face, (x1 + x2) / 2, H / 2, 1.92, Math.PI);
    }
    const wall = new THREE.Mesh(tileUV(new THREE.PlaneGeometry(len, H), len / 1.4, H / 1.4), M.wall); wall.receiveShadow = true; blockers.push(wall);
    at(wall, (x1 + x2) / 2, H / 2, (z1 + z2) / 2, -ang);
    const panel = new THREE.Mesh(tileUV(new THREE.BoxGeometry(len, 1, .08), len / 1.2, 1 / 1.2), M.wains); panel.receiveShadow = true;
    at(panel, (x1 + x2) / 2, .5, (z1 + z2) / 2, -ang);
    const rail = box(len, .06, .12, M.darkwood); at(rail, (x1 + x2) / 2, 1.02, (z1 + z2) / 2, -ang);
    const crown = box(len, .14, .14, M.darkwood); at(crown, (x1 + x2) / 2, H - .07, (z1 + z2) / 2, -ang);
  }
  // door frames
  [[0, 2, 0], [4, 6, Math.PI / 2]].forEach(([x, z, r]) => {
    const g = new THREE.Group();
    [-1.05, 1.05].forEach((o) => { const p = box(.14, 2.6, .2, M.darkwood); p.position.set(o, 1.3, 0); g.add(p); });
    const top = box(2.4, .2, .22, M.darkwood); top.position.y = 2.65; g.add(top);
    const lintel = box(2.1, H - 2.75, .1, M.wall); lintel.position.y = 2.75 + (H - 2.75) / 2; g.add(lintel);
    at(g, x, 0, z, r);
  });

  // ------------------------------------------------ lights
  const sky = new THREE.HemisphereLight(0x3a4470, 0x120806, .27); scene.add(sky); // just enough to find the walls; candles and the moon do the rest
  const candleLights = [];
  const point = (color, intensity, dist, x, y, z, shadow) => {
    const l = new THREE.PointLight(color, intensity, dist, 1.6); l.position.set(x, y, z);
    if (shadow) { l.castShadow = true; l.shadow.mapSize.set(512, 512); l.shadow.bias = -.003; }
    scene.add(l); return l;
  };
  const chandelier = point(0xffa955, 24, 11, 0, 2.55, 6.5, false); // below the shades, so they are lit from inside without glaring
  const dinA = point(0xffb45a, 9, 9, -.9, 1.6, -2, true); candleLights.push(dinA);
  const dinB = point(0xffb45a, 9, 9, .9, 1.6, -2, false); candleLights.push(dinB);
  const fire = point(0xff6a24, 7, 7, -3.95, 1.15, -2, false); // out in front and up at mantel height: lights the surround and room, no hot spot mirrored on the floor
  const lamp = point(0xffc890, 6, 5, 8.2, 1.5, 5.4, false);
  const pianoLight = point(0x9fb4ff, 0, 5, 3.2, 1.8, -4.4, false);
  // moonlit windows
  const windowAt = (x, z, ry, moonlit = true) => {
    const g = new THREE.Group();
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 2.2), M.glass); g.add(pane);
    [[0, 1.12, 1.4, .1], [0, -1.12, 1.4, .1], [-.62, 0, .1, 2.3], [.62, 0, .1, 2.3], [0, 0, .06, 2.2], [0, .3, 1.2, .06]].forEach(([a, b, w, h]) => { const m = box(w, h, .08, M.darkwood); m.position.set(a, b, .02); g.add(m); });
    at(g, x, 2.2, z, ry);
    if (moonlit) moonAt(x, z, ry, 3.2);
  };
  const moons = [];
  const moonAt = (x, z, ry, y) => {
    const moon = new THREE.SpotLight(0x6f86d8, 4.5, 11, .5, .7); moon.position.set(x - Math.sin(ry) * .2, y, z - Math.cos(ry) * .2);
    moon.target.position.set(x + Math.sin(ry) * 3, 0, z + Math.cos(ry) * 3); scene.add(moon, moon.target); moons.push(moon);
  };
  windowAt(-3.98, 7, Math.PI / 2); windowAt(7, 8.98, Math.PI); // one moon light per room; the dining room's is the gothic window below

  // the dining room's great window: a pointed arch with stone tracery, a storm outside, bare trees, and now and then lightning
  const GW = 2.3, GS = .95, GR = GW * Math.sqrt(3) / 2, GY = .95; // width, straight height, arch rise, sill
  const archShape = (w, hs) => { // an equilateral pointed arch: each side is an arc centred on the opposite springing point
    const sh = new THREE.Shape(), r = w, rise = w * Math.sqrt(3) / 2;
    sh.moveTo(-w / 2, 0); sh.lineTo(w / 2, 0); sh.lineTo(w / 2, hs);
    sh.absarc(-w / 2, hs, r, 0, Math.PI / 3, false);       // right side up to the apex
    sh.absarc(w / 2, hs, r, Math.PI * 2 / 3, Math.PI, false); // apex down the left side
    sh.lineTo(-w / 2, 0); return { sh, top: hs + rise };
  };
  const archGeo = (w, hs) => { // flat arch with UVs spread over its bounding box
    const { sh, top } = archShape(w, hs), geo = new THREE.ShapeGeometry(sh, 24), a = geo.attributes.position, uv = geo.attributes.uv;
    for (let i = 0; i < a.count; i++) uv.setXY(i, (a.getX(i) + w / 2) / w, a.getY(i) / top);
    return geo;
  };
  const skyTex = canvasTex(512, 768, (g, w, h) => {
    const sk = g.createLinearGradient(0, 0, 0, h); sk.addColorStop(0, "#0c1430"); sk.addColorStop(.55, "#2a3a62"); sk.addColorStop(1, "#46557a");
    g.fillStyle = sk; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) { // heavy storm clouds
      const x = Math.random() * w, y = Math.random() * h * .6, r = 40 + Math.random() * 120, c = g.createRadialGradient(x, y, 0, x, y, r);
      c.addColorStop(0, `rgba(${Math.random() < .5 ? "10,14,30" : "70,84,120"},${.25 + Math.random() * .3})`); c.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = c; g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    g.strokeStyle = "#04050a"; g.lineCap = "round"; // bare trees against the sky
    const branch = (x, y, len, ang, wdt) => {
      if (wdt < .6) return;
      const x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len;
      g.lineWidth = wdt; g.beginPath(); g.moveTo(x, y); g.lineTo(x2, y2); g.stroke();
      branch(x2, y2, len * .72, ang - .35 - Math.random() * .3, wdt * .68); branch(x2, y2, len * .72, ang + .3 + Math.random() * .3, wdt * .68);
    };
    [[60, 110], [190, 80], [330, 120], [450, 90]].forEach(([x, l]) => branch(x, h, l, -Math.PI / 2 + (Math.random() - .5) * .3, 9));
    g.fillStyle = "#04050a"; g.fillRect(0, h * .93, w, h * .07);
    // stone tracery: three lancets, a rose of circles in the head, a transom
    g.strokeStyle = "#07070a"; g.fillStyle = "#07070a"; g.lineWidth = 10;
    const top = (GS + GR) / GW; // canvas height in widths
    const Y = (yw) => h - yw / top * h; // y measured up from the sill in window widths
    [1 / 3, 2 / 3].forEach((u) => { g.beginPath(); g.moveTo(u * w, h); g.lineTo(u * w, Y(GS / GW + .05)); g.stroke(); });
    g.lineWidth = 7; g.beginPath(); g.moveTo(0, Y(GS / GW * .5)); g.lineTo(w, Y(GS / GW * .5)); g.stroke();
    [1 / 6, .5, 5 / 6].forEach((u) => { // little pointed heads on each lancet
      const cx = u * w, hw = w / 6, base = Y(GS / GW + .02);
      g.beginPath(); g.moveTo(cx - hw, base); g.quadraticCurveTo(cx - hw, base - hw * 1.3, cx, base - hw * 1.6); g.quadraticCurveTo(cx + hw, base - hw * 1.3, cx + hw, base); g.stroke();
    });
    const rc = Y(GS / GW + GR / GW * .55), rr = w * .2;
    g.lineWidth = 8; g.beginPath(); g.arc(w / 2, rc, rr, 0, Math.PI * 2); g.stroke();
    for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; g.beginPath(); g.arc(w / 2 + Math.cos(a) * rr * .5, rc + Math.sin(a) * rr * .5, rr * .42, 0, Math.PI * 2); g.lineWidth = 5; g.stroke(); }
    g.beginPath(); g.arc(w / 2, rc, rr * .16, 0, Math.PI * 2); g.fill();
    for (let y = 0; y < h; y += 26) { g.globalAlpha = .35; g.lineWidth = 1.5; g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); } // leaded panes
    for (let x = 0; x < w; x += 22) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    g.globalAlpha = 1;
  });
  const SKY = new THREE.Color().setRGB(2.2, 2.5, 3.3); // moonlit storm; the window is a light source, so fog does not swallow it
  const skyMat = new THREE.MeshBasicMaterial({ map: skyTex, color: SKY.clone(), fog: false });
  const boltTex = canvasTex(256, 384, () => {});
  const drawBolt = () => { // a new jagged fork for every strike
    const g = boltTex.image.getContext("2d"), w = 256, h = 384; g.clearRect(0, 0, w, h);
    const fork = (x, y, len, wdt) => {
      let px = x, py = y;
      g.beginPath(); g.moveTo(px, py);
      while (py < y + len && py < h) { px += (Math.random() - .5) * 30; py += 10 + Math.random() * 16; g.lineTo(px, py); if (wdt > 2 && Math.random() < .12) fork(px, py, len * .4, wdt * .5); }
      g.lineWidth = wdt; g.strokeStyle = "rgba(225,235,255,1)"; g.shadowColor = "rgba(150,180,255,1)"; g.shadowBlur = 14; g.stroke();
    };
    fork(w * (.3 + Math.random() * .4), 0, h * .8, 4);
    boltTex.needsUpdate = true;
  };
  const boltMat = new THREE.MeshBasicMaterial({ map: boltTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  const gWin = new THREE.Group();
  const skyPane = new THREE.Mesh(archGeo(GW, GS), skyMat); gWin.add(skyPane);
  const bolt = new THREE.Mesh(archGeo(GW, GS), boltMat); bolt.position.z = .004; gWin.add(bolt); // in front of the sky, clipped to the arch
  { // a deep stone surround: the arch outline, a little proud of the wall
    const { sh } = archShape(GW + .36, GS), hole = archShape(GW, GS).sh; sh.holes.push(new THREE.Path(hole.getPoints(32)));
    const surround = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: .14, bevelEnabled: false, curveSegments: 24 }), M.stone);
    surround.receiveShadow = true; gWin.add(surround);
    const sill = box(GW + .5, .08, .3, M.stone); sill.position.set(0, -.04, .1); gWin.add(sill);
  }
  at(gWin, 0, GY, -5.97);
  moonAt(0, -5.98, 0, GY + GS + .4);
  const storm = { next: 7, start: -1 }; // lightning every 9 to 23 seconds
  const WHITE_BLUE = new THREE.Color(0xc8d8ff);

  // ------------------------------------------------ foyer: staircases, chandelier, front door, rug
  const stairs = (x0, dir) => {
    for (let i = 0; i < 9; i++) { const s = box(2.2, .22 * (i + 1), .28, M.darkwood); at(s, x0, .11 * (i + 1), 4.5 - i * .28); }
    const rail = box(.08, .08, 2.8, M.wood); rail.rotation.x = -.62; at(rail, x0 + dir * 1.05, 1.9, 3.3);
    for (let i = 0; i < 8; i++) { const p = cyl(.025, .025, 1, M.wood, 8); at(p, x0 + dir * 1.05, .7 + i * .22, 4.4 - i * .28); }
  };
  stairs(-2.9, 1); stairs(2.9, -1);
  const landing = box(8, .2, 1.6, M.darkwood); at(landing, 0, 2.1, 2.8);
  const cg = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(.6, .03, 8, 32), M.brass); ring.rotation.x = Math.PI / 2; cg.add(ring);
  const chain = cyl(.015, .015, .9, M.brass, 6); chain.position.y = .45; cg.add(chain);
  const flames = [];
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2, c = cyl(.02, .02, .14, M.wax, 8); c.position.set(Math.cos(a) * .6, .08, Math.sin(a) * .6); cg.add(c);
    const f = new THREE.Mesh(new THREE.SphereGeometry(.022, 8, 8), M.flame); f.scale.y = 2; f.position.set(Math.cos(a) * .6, .19, Math.sin(a) * .6); cg.add(f); flames.push(f);
  }
  at(cg, 0, 3.05, 6.5);
  place("Chandelier_01", { x: 0, y: 4, z: 6.5, height: 1.3, anchor: "top", tint: 0x7a6c5c, hide: [cg] }).then((r) => {
    // old, yellowed shades: no glowing white lamps
    r?.holder.traverse((m) => { if (m.isMesh) [].concat(m.material).forEach((mt) => { if (mt.emissive) mt.emissiveIntensity *= .2; mt.transparent = false; }); });
  });
  const door = box(1.8, 2.8, .12, M.darkwood); at(door, 0, 1.4, 9.95);
  [-.45, .45].forEach((x) => { const pn = box(.6, 1, .04, M.wood); at(pn, x, 1.9, 9.88); const pn2 = box(.6, .9, .04, M.wood); at(pn2, x, .7, 9.88); });
  const rugMesh = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 3.6), M.rug); rugMesh.rotation.x = -Math.PI / 2; at(rugMesh, 0, .005, 7);
  // console table by the door, a pumpkin and a clock on it
  const pumpkin = new THREE.Mesh(new THREE.SphereGeometry(.22, 16, 12), new THREE.MeshStandardMaterial({ color: 0xd9640f, emissive: 0x6a2a00, emissiveIntensity: .7, roughness: .7 }));
  pumpkin.scale.y = .8; at(pumpkin, 3.3, .18, 9.2); // its glow is emissive; no light of its own
  place("ClassicConsole_01", { x: 2.6, z: 9.6, ry: Math.PI, width: 1.4, against: ["z+", 9.97] }).then((r) => {
    if (!r) return;
    const top = r.box.max.y, cz = (r.box.min.z + r.box.max.z) / 2;
    pumpkin.position.set(3.0, top + .17, cz);
    place("mantel_clock_01", { x: 2.2, y: top, z: cz, ry: Math.PI, height: .34 });
  });
  place("ornate_mirror_01", { x: -3.96, y: 2.1, z: 8.8, ry: Math.PI / 2, height: 1.3, anchor: "center", against: ["x-", -3.98] });
  // portraits hang in carved frames; the canvas sits halfway into the frame's depth
  const framed = (pic, fr, x, y, z, ry, wall) => place("fancy_picture_frame_01", { x, y, z, ry, rz: Math.PI / 2, height: 1.32, anchor: "center", against: wall, tint: 0x6a5a48, hide: [fr] }).then((r) => {
    if (!r) return;
    const [axis, sign] = [wall[0][0], wall[0][1]];
    pic.position[axis] = (r.box.min[axis] + r.box.max[axis]) / 2 + (sign === "+" ? -.005 : .005);
  });
  [[-3.95, 5.35], [3.95, 8.4]].forEach(([x, z], i) => { // clear of the window at z = 7
    const fr = box(.06, 1.25, .95, M.brass); at(fr, x, 2.3, z);
    const paint = new THREE.MeshStandardMaterial({ map: portraitTex(i ? 260 : 20, !i), roughness: .85 });
    const pic = new THREE.Mesh(new THREE.PlaneGeometry(.8, 1.05), paint);
    at(pic, x + (x < 0 ? .04 : -.04), 2.3, z, x < 0 ? Math.PI / 2 : -Math.PI / 2);
    place("hanging_picture_frame_03", { x, y: 2.3, z, ry: x < 0 ? Math.PI / 2 : -Math.PI / 2, height: 1.15, anchor: "center", against: [x < 0 ? "x-" : "x+", x < 0 ? -3.98 : 3.98], tint: 0x8a7a68, hide: [fr, pic] })
      .then((r) => r?.holder.traverse((m) => {
        if (!m.isMesh) return;
        const name = [].concat(m.material).map((x) => x.name).join();
        if (/artwork/.test(name)) { paint.map.flipY = false; paint.map.needsUpdate = true; m.material = paint; } // glTF UVs expect an unflipped texture
        if (/glass/.test(name)) m.material = new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: .05, roughness: .25, envMapIntensity: .12, depthWrite: false });
      }));
  });

  // ------------------------------------------------ dining room
  const tableTop = box(4.3, .07, 1.5, M.cloth); at(tableTop, 0, .8, -2);
  const tableLegs = [[-2, -2.6], [2, -2.6], [-2, -1.4], [2, -1.4]].map(([x, z]) => at(box(.09, .78, .09, M.darkwood), x, .39, z));
  const runner = box(4, .005, .4, new THREE.MeshStandardMaterial({ color: 0x2a0a0e, roughness: 1 })); at(runner, 0, .84, -2);
  // two tables end to end make the long banquet table; top at the old cloth height so candles and the guest list still sit on it
  [-1.1, 1.1].forEach((x) => place("dining_table", { x, z: -2, size: [2.2, .835, 1.5], hide: [tableTop, ...tableLegs] }).then((r) => {
    if (!r) return;
    runner.position.y = r.box.max.y + .003;
    r.holder.traverse((m) => { if (m.isMesh && /cloth/i.test(m.name)) m.material = M.cloth; }); // white linen, not the model's checked cloth
  }));
  const chair = (x, z, face) => {
    const g = new THREE.Group();
    const seat = box(.5, .07, .5, M.velvet); seat.position.y = .48; g.add(seat);
    const back = box(.5, .95, .06, M.darkwood); back.position.set(0, .98, -.24); g.add(back);
    const pad = box(.36, .6, .02, M.velvet); pad.position.set(0, 1, -.2); g.add(pad);
    [[-.21, -.21], [.21, -.21], [-.21, .21], [.21, .21]].forEach(([a, b]) => { const l = box(.05, .46, .05, M.darkwood); l.position.set(a, .23, b); g.add(l); });
    place("dining_chair_02", { x, z, ry: face, height: 1.05, hide: [g] });
    return at(g, x, 0, z, face);
  };
  // ghosts: a sheet over a head and shoulders, folds that deepen toward a ragged hem
  const ghostGeo = (() => {
    const prof = [[0, 1.56], [.05, 1.55], [.09, 1.52], [.125, 1.47], [.14, 1.4], [.14, 1.32], [.13, 1.25], [.12, 1.2], [.16, 1.15], [.23, 1.09],
      [.27, 1.0], [.28, .9], [.29, .78], [.31, .64], [.34, .5], [.37, .36], [.4, .2], [.42, .08]];
    const geo = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 72);
    const pos = geo.attributes.position, v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const a = Math.atan2(v.z, v.x), below = THREE.MathUtils.clamp((1.12 - v.y) / .82, 0, 1), hem = THREE.MathUtils.clamp((.48 - v.y) / .18, 0, 1);
      const fold = Math.sin(a * 9 + Math.sin(a * 3) * 1.5) * .11 * below ** 1.4 + Math.sin(a * 17) * .03 * below;
      v.x *= 1 + fold; v.z *= 1 + fold;
      const head = THREE.MathUtils.clamp((v.y - 1.2) / .36, 0, 1); // the head leans forward and to one side, like something tired of waiting
      v.z += head * head * .05; v.x += head * .018 + Math.sin(a * 2 + 1) * .012 * head;
      v.y -= ((Math.sin(a * 7) * .5 + .5) * .09 + Math.sin(a * 13) * .02) * hem;
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    geo.computeVertexNormals(); return geo;
  })();
  // translucent cloth: the hem drifts in a slow draught and the edges glow (a fresnel rim), one shader for every ghost
  const ghostTime = { value: 0 };
  // Cold, half-there cloth: the body fades toward a hem that frays into nothing, the edges glow like breath on glass,
  // and uFade lets a ghost thin out and come back. Eyes are soft hollows, not cut-out circles.
  const ghostMaterial = ({ color = 0x6f7a90, emissive = 0x0c1222, emissiveIntensity = .6, rim = 0x7d98ff, opacity = .42, eyes = 1 } = {}) => {
    const mat = new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity, roughness: .95, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide, envMapIntensity: ENV });
    const phase = { value: Math.random() * 10 }, rimColor = { value: new THREE.Color(rim) }, fade = { value: 1 }, head = { value: 0 }, eyeK = { value: eyes };
    mat.userData.fade = fade; mat.userData.head = head;
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, { uTime: ghostTime, uPhase: phase, uRim: rimColor, uFade: fade, uHead: head, uEyes: eyeK });
      sh.vertexShader = "uniform float uTime;\nuniform float uPhase;\nuniform float uHead;\nvarying vec3 vLocal;\n" + sh.vertexShader.replace("#include <begin_vertex>", `#include <begin_vertex>
        // the head turns on its own, ahead of the body: vertices above the shoulders rotate about the vertical axis
        float headK = smoothstep(1.02, 1.24, position.y), ha = uHead * headK, hc = cos(ha), hs = sin(ha);
        transformed.xz = vec2(hc * transformed.x + hs * transformed.z, -hs * transformed.x + hc * transformed.z);
        float hemK = smoothstep(1.0, 0.3, position.y), ang = atan(position.z, position.x);
        transformed.xz += normalize(position.xz + 1e-5) * sin(uTime * 1.1 + uPhase + ang * 3.0 + position.y * 6.0) * 0.03 * hemK;
        transformed.y += sin(uTime * 1.5 + uPhase + ang * 5.0) * 0.02 * hemK * hemK;
        vLocal = position;`);
      sh.fragmentShader = "uniform vec3 uRim;\nuniform float uTime;\nuniform float uPhase;\nuniform float uFade;\nuniform float uEyes;\nvarying vec3 vLocal;\n" +
        "float gh(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}\n" +
        "float gn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(gh(i),gh(i+vec2(1,0)),f.x),mix(gh(i+vec2(0,1)),gh(i+vec2(1,1)),f.x),f.y);}\n" +
        sh.fragmentShader
          .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
        totalEmissiveRadiance += uRim * pow(1.0 - abs(dot(normal, normalize(vViewPosition))), 2.0) * 0.75;`)
          .replace("#include <alphatest_fragment>", `#include <alphatest_fragment>
        float a = atan(vLocal.z, vLocal.x);
        float tatter = gn(vec2(a * 4.0, vLocal.y * 9.0 - uTime * 0.25 + uPhase));            // ragged, slowly crawling holes
        float body = smoothstep(0.05, 0.75, vLocal.y + (tatter - 0.5) * 0.35);              // fades out toward the hem
        float eyes = 0.0;                                                                    // two soft dark hollows on the face
        for (int k = 0; k < 2; k++) { vec2 c = vec2(k == 0 ? -0.052 : 0.052, 1.37); vec2 d = vec2(vLocal.x - c.x, (vLocal.y - c.y) * 0.42);
          eyes += (1.0 - smoothstep(0.006, 0.03, length(d))) * smoothstep(0.0, 0.08, vLocal.z); } // long, drooping, soft-edged
        eyes *= uEyes;
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.0), clamp(eyes, 0.0, 1.0) * 0.85);
        diffuseColor.a = mix(diffuseColor.a, 0.95, clamp(eyes, 0.0, 1.0) * 0.8); // the hollows stay dark even where the cloth is thin
        diffuseColor.a *= body * uFade * (0.85 + 0.15 * sin(uTime * 3.0 + uPhase));
        if (diffuseColor.a < 0.01) discard;`);
    };
    mat.customProgramCacheKey = () => "ghost2";
    return mat;
  };
  const ghost = (mat = ghostMaterial()) => {
    const g = new THREE.Group(), m = new THREE.Mesh(ghostGeo, mat); m.renderOrder = 2; g.add(m);
    return g;
  };
  const SEATS = [
    { x: -1.35, z: -3.05, face: 0 }, { x: 0, z: -3.05, face: 0 }, { x: 1.35, z: -3.05, face: 0 },
    { x: -2.6, z: -2, face: Math.PI / 2 }, { x: -1.35, z: -.95, face: Math.PI }, { x: 0, z: -.95, face: Math.PI },
  ];
  const ghosts = SEATS.map((s, i) => {
    chair(s.x, s.z, s.face);
    const gh = ghost(); gh.userData = { base: Math.atan2(0 - s.x, -2 - s.z), phase: i * 1.3, fadeAt: 8 + i * 7 + Math.random() * 10, fadeT: -1,
      head: 0, notice: 0, delay: .15 + ((i * 7) % 6) * .22 }; // they notice you one after another, not all at once
    gh.scale.setScalar(.94 + (i % 3) * .04); gh.children[0].rotation.set(.12 + (i % 3) * .04, 0, i % 2 ? .05 : -.05); // heads bowed over their plates; not six copies
    // drawn in toward the table, so each sheet sits in front of its chair back rather than through it
    gh.rotation.y = gh.userData.base; return at(gh, s.x * .92, 0, -2 + (s.z + 2) * .82, gh.userData.base);
  });
  chair(1.35, -.95, Math.PI); // an empty chair at the table, too
  // candelabras: seven candles, the game's seven
  const candles = [];
  const candelabra = (x, z, n) => {
    const g = new THREE.Group();
    const stem = cyl(.025, .06, .5, M.brass); stem.position.y = .25; g.add(stem);
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0 : i / (n - 1) - .5, cx = t * .5, cy = .5 + (1 - Math.abs(t) * 2) * .08;
      const arm = box(Math.abs(cx) + .01, .015, .015, M.brass); arm.position.set(cx / 2, cy - .02, 0); g.add(arm);
      const wax = cyl(.017, .017, .2, M.wax, 10); wax.position.set(cx, cy + .11, 0); g.add(wax);
      const fl = new THREE.Mesh(new THREE.SphereGeometry(.018, 10, 10), M.flame.clone()); fl.scale.set(1, 2, 1); fl.position.set(cx, cy + .24, 0); g.add(fl);
      candles.push(fl);
    }
    return at(g, x, .835, z);
  };
  candelabra(-.9, -2, 4); candelabra(.9, -2, 3);
  // a soft warm glow, painted where a light would fall (sconces, the hearth floor)
  const glowTex = canvasTex(128, 128, (g, w, h) => {
    const r = g.createRadialGradient(w / 2, h * .45, 0, w / 2, h * .45, w / 2);
    r.addColorStop(0, "rgba(255,170,90,.9)"); r.addColorStop(.35, "rgba(255,120,50,.35)"); r.addColorStop(1, "rgba(255,90,30,0)");
    g.fillStyle = r; g.fillRect(0, 0, w, h);
  });
  // fireplace: a stone surround with an arched opening, a carved mantel, a sooty firebox, iron fire-dogs,
  // logs that glow along their cracks, a bed of embers, noise-shader flames and a few sparks.
  // Built facing +z and turned to face the room; the fire light above is the only real light it adds.
  const fp = new THREE.Group(), FW = 2.3, FH = 1.32, OW = 1.24, OH = .98, FD = .5; // surround, opening, depth
  const stoneDark = M.stoneWall.clone(); stoneDark.color.setHex(0x6a625e); stoneDark.side = THREE.FrontSide;
  {
    const sh = new THREE.Shape(); sh.moveTo(-FW / 2, 0); sh.lineTo(FW / 2, 0); sh.lineTo(FW / 2, FH); sh.lineTo(-FW / 2, FH); sh.lineTo(-FW / 2, 0);
    const hole = new THREE.Path(), spring = OH - .22; // a shallow segmental arch over the opening
    hole.moveTo(-OW / 2, 0); hole.lineTo(-OW / 2, spring); hole.quadraticCurveTo(0, OH + .2, OW / 2, spring); hole.lineTo(OW / 2, 0); hole.lineTo(-OW / 2, 0);
    sh.holes.push(hole);
    const geo = new THREE.ExtrudeGeometry(sh, { depth: FD, bevelEnabled: true, bevelThickness: .02, bevelSize: .02, bevelSegments: 2, curveSegments: 20 });
    const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / STONE * 1.6, uv.getY(i) / STONE * 1.6);
    const surround = new THREE.Mesh(geo, stoneDark); surround.castShadow = surround.receiveShadow = true; fp.add(surround);
  }
  // mantel shelf with a moulded lip and two corbels
  fp.add(put(box(FW + .3, .09, .66, M.darkwood), 0, FH + .045, .22));
  fp.add(put(box(FW + .26, .05, .05, M.darkwood), 0, FH - .02, .52));
  [-1, 1].forEach((k) => { const c = box(.12, .22, .14, M.darkwood); c.position.set(k * (FW / 2 - .2), FH - .12, FD + .07); fp.add(c); });
  // the firebox: soot-black walls, warmer near the fire
  const sootTex = canvasTex(128, 128, (g, w, h) => {
    const gr = g.createLinearGradient(0, h, 0, 0); gr.addColorStop(0, "#5a1c08"); gr.addColorStop(.35, "#1a0805"); gr.addColorStop(1, "#050303");
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * .3})`; g.fillRect(Math.random() * w, Math.random() * h, 3, 3); }
  });
  const sootMat = new THREE.MeshBasicMaterial({ map: sootTex, color: 0xffffff, side: THREE.DoubleSide });
  const back = new THREE.Mesh(new THREE.PlaneGeometry(OW, OH + .1), sootMat); back.position.set(0, (OH + .1) / 2, .04); fp.add(back);
  [-1, 1].forEach((k) => { const sw = new THREE.Mesh(new THREE.PlaneGeometry(FD, OH), sootMat); sw.rotation.y = k * Math.PI / 2; sw.position.set(k * OW / 2 * .98, OH / 2, FD / 2); fp.add(sw); });
  const roof = new THREE.Mesh(new THREE.PlaneGeometry(OW, FD), new THREE.MeshBasicMaterial({ color: 0x030202, side: THREE.DoubleSide })); roof.rotation.x = Math.PI / 2; roof.position.set(0, OH + .05, FD / 2); fp.add(roof);
  fp.add(put(box(FW + .5, .05, .55, stoneDark), 0, .025, FD + .2)); // hearthstone in front
  // iron fire-dogs
  [-1, 1].forEach((k) => {
    fp.add(put(box(.035, .035, .42, M.black), k * .32, .1, .26));
    fp.add(put(cyl(.02, .02, .2, M.black, 8), k * .32, .2, .46));
    fp.add(put(new THREE.Mesh(new THREE.SphereGeometry(.03, 10, 8), M.brass), k * .32, .31, .46));
  });
  // logs: bark, with orange cracks that glow (emissive map), stacked on the fire-dogs
  const barkTex = canvasTex(256, 64, (g, w, h) => {
    g.fillStyle = "#1a0e08"; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 160; i++) { g.strokeStyle = `rgba(${40 + Math.random() * 30},${22 + Math.random() * 14},12,.8)`; g.lineWidth = 1 + Math.random() * 2; const x = Math.random() * w; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + (Math.random() - .5) * 6, h); g.stroke(); } // grain along the log
  });
  const crackTex = canvasTex(256, 64, (g, w, h) => {
    g.fillStyle = "#000"; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) {
      g.strokeStyle = `rgba(255,${80 + Math.random() * 90},20,${.5 + Math.random() * .5})`; g.lineWidth = 1 + Math.random() * 2;
      let x = Math.random() * w, y = h * (.55 + Math.random() * .45); g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 5; k++) { x += (Math.random() - .3) * 20; y += (Math.random() - .5) * 8; g.lineTo(x, y); } g.stroke();
    }
    // u runs around the log: one side (the underside, after rotation) smoulders
    const under = g.createLinearGradient(w * .55, 0, w * .95, 0); under.addColorStop(0, "rgba(255,80,15,0)"); under.addColorStop(.5, "rgba(255,80,15,.45)"); under.addColorStop(1, "rgba(255,80,15,0)");
    g.fillStyle = under; g.fillRect(0, 0, w, h);
  });
  const logMat = new THREE.MeshStandardMaterial({ map: barkTex, emissiveMap: crackTex, emissive: 0xff5a18, emissiveIntensity: .7, roughness: .9 });
  [[0, .16, .3, 0, .08], [-.12, .12, .42, .35, .07], [.13, .13, .4, -.4, .065], [.02, .27, .28, .1, .055]].forEach(([x, y, z, ry, r]) => {
    const log = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.1, .72, 12), logMat); log.rotation.set(0, ry, Math.PI / 2, "YXZ"); log.position.set(x, y, z); fp.add(log);
  });
  // the ember bed
  const emberTex = canvasTex(256, 128, (g, w, h) => {
    g.fillStyle = "#000"; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 700; i++) {
      const x = Math.random() * w, y = Math.random() * h, r = 2 + Math.random() * 7, hot = Math.random();
      const c = g.createRadialGradient(x, y, 0, x, y, r); c.addColorStop(0, `rgba(255,${60 + hot * 150},${hot * 40},${.4 + hot * .6})`); c.addColorStop(1, "rgba(80,10,0,0)");
      g.fillStyle = c; g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    const fade = g.createRadialGradient(w / 2, h / 2, h * .2, w / 2, h / 2, w * .55); fade.addColorStop(0, "rgba(0,0,0,0)"); fade.addColorStop(1, "rgba(0,0,0,1)");
    g.fillStyle = fade; g.fillRect(0, 0, w, h);
  });
  const emberMat = new THREE.MeshBasicMaterial({ map: emberTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const emberBed = new THREE.Mesh(new THREE.PlaneGeometry(.95, .5), emberMat); emberBed.rotation.x = -Math.PI / 2; emberBed.position.set(0, .055, .3); fp.add(emberBed);
  // flames: value-noise fbm scrolling upward, shaped into tongues, coloured from deep red to a near-white core
  const fireU = { uTime: { value: 0 }, uGain: { value: 1 } };
  const flameShader = (seed) => new THREE.ShaderMaterial({
    uniforms: { ...fireU, uSeed: { value: seed } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: `uniform float uTime; uniform float uGain; uniform float uSeed; varying vec2 vUv;
      float hs(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hs(i), hs(i + vec2(1, 0)), f.x), mix(hs(i + vec2(0, 1)), hs(i + vec2(1, 1)), f.x), f.y); }
      float fbm(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * vn(p); p *= 2.03; a *= 0.5; } return s; }
      void main() {
        vec2 uv = vUv; float t = uTime;
        float n = fbm(vec2(uv.x * 4.0 + uSeed, uv.y * 3.0 - t * 1.9));
        float n2 = fbm(vec2(uv.x * 7.0 - uSeed, uv.y * 5.0 - t * 2.7));
        float sway = (n - 0.5) * 0.35 * uv.y;
        float d = abs(uv.x - 0.5 + sway);
        float width = mix(0.36, 0.02, pow(uv.y, 0.7));
        float body = smoothstep(width, width * 0.2, d);
        float f = body * (0.55 + n * 0.9) * (1.0 - smoothstep(0.35, 1.0, uv.y + (n2 - 0.5) * 0.45));
        f = clamp(f * 1.4, 0.0, 1.0);
        vec3 col = mix(vec3(0.5, 0.04, 0.0), vec3(1.0, 0.38, 0.04), smoothstep(0.05, 0.45, f));
        col = mix(col, vec3(1.0, 0.82, 0.42), smoothstep(0.55, 0.95, f));
        gl_FragColor = vec4(col * 2.2 * uGain, f);
      }`,
  });
  [[0, .78, 0], [-.2, .62, .9], [.19, .6, -.8], [0, .55, 1.57]].forEach(([x, hgt, ry], i) => {
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(.6, hgt), flameShader(i * 3.7)); pl.position.set(x, .12 + hgt / 2, .3); pl.rotation.y = ry; pl.renderOrder = 3; fp.add(pl);
  });
  // sparks drifting up the chimney
  const SPN = 26, spGeo = new THREE.BufferGeometry(), spPos = new Float32Array(SPN * 3), spVel = new Float32Array(SPN);
  for (let i = 0; i < SPN; i++) { spPos[i * 3] = (Math.random() - .5) * .6; spPos[i * 3 + 1] = Math.random() * OH; spPos[i * 3 + 2] = .2 + Math.random() * .25; spVel[i] = .25 + Math.random() * .5; }
  spGeo.setAttribute("position", new THREE.BufferAttribute(spPos, 3));
  const sparks = new THREE.Points(spGeo, new THREE.PointsMaterial({ color: 0xffa040, size: .018, transparent: true, opacity: .9, blending: THREE.AdditiveBlending, depthWrite: false })); fp.add(sparks);
  // a warm pool of light on the floor in front, so the fire reads from across the room without a second light
  const floorGlow = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.8), new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: .16 }));
  floorGlow.rotation.x = -Math.PI / 2; floorGlow.position.set(0, .012, FD + 1.0); fp.add(floorGlow);
  at(fp, -4.95, 0, -2, Math.PI / 2);
  place("antique_ceramic_vase_01", { x: -4.62, y: 1.4, z: -1.05, height: .32, tint: 0x8a8278 }); // faded glaze
  place("GothicCabinet_01", { x: 4.6, z: -1.6, ry: -Math.PI / 2, width: 1.5, against: ["x+", 4.97] }).then((r) => {
    if (r) place("marble_bust_01", { x: (r.box.min.x + r.box.max.x) / 2, y: r.box.max.y, z: -1.6, ry: -Math.PI / 2 - .5, height: .5 }); // she watches the table
  });
  [[-1.55, -2.42, .3], [.25, -1.58, 2.9], [1.45, -2.42, -.2]].forEach(([x, z, ry]) => place("brass_goblets", { x, y: .838, z, ry, height: .17 }));
  place("lantern_chandelier_01", { x: 0, y: 4, z: -2, height: 1.0, anchor: "top", tint: 0x6a5a48 });
  place("brass_candleholders", { x: -4.6, y: 1.4, z: -2.55, ry: Math.PI / 2, height: .3, tint: 0x8a7458 });
  // piano and bench (seat 7): an upright in black lacquer, 52 keys drawn on a canvas
  const lacquer = new THREE.MeshPhysicalMaterial({ color: 0x050406, roughness: .3, clearcoat: 1, clearcoatRoughness: .1, envMapIntensity: .25 });
  const keyTex = canvasTex(1024, 64, (g, w, h) => {
    const n = 52, kw = w / n;
    g.fillStyle = "#efe8d8"; g.fillRect(0, 0, w, h);
    g.fillStyle = "#3a352e"; for (let i = 1; i < n; i++) g.fillRect(i * kw - 1, 0, 1.5, h);
    g.fillStyle = "#0c0b0c"; for (let i = 0; i < n - 1; i++) if ([0, 2, 3, 5, 6].includes(i % 7)) g.fillRect((i + 1) * kw - kw * .3, 0, kw * .6, h * .62); // after A, C, D, F, G
  });
  const piano = new THREE.Group();
  const pp = (o, x, y, z) => { piano.add(put(o, x, y, z)); return o; };
  pp(box(1.5, 1.25, .58, lacquer), 0, .625, 0);                        // case
  pp(box(1.56, .035, .64, lacquer), 0, 1.268, 0);                      // lid
  pp(box(1.3, .46, .015, M.darkwood), 0, 1.0, .293);                   // inset panel above the keys
  [-.72, .72].forEach((x) => { pp(box(.06, .2, .3, lacquer), x, .78, .38); pp(cyl(.035, .028, .62, lacquer, 12), x * .95, .31, .46); pp(box(.08, .05, .46, lacquer), x * .95, .025, .3); });
  pp(box(1.44, .07, .3, lacquer), 0, .69, .4);                         // keybed
  pp(new THREE.Mesh(new THREE.BoxGeometry(1.36, .025, .16), [M.cloth, M.cloth, new THREE.MeshStandardMaterial({ map: keyTex, roughness: .35 }), M.cloth, M.cloth, M.cloth]), 0, .737, .44);
  pp(box(1.36, .07, .025, lacquer), 0, .78, .35);                      // key slip behind the keys
  const desk7 = pp(box(.7, .28, .02, lacquer), 0, 1.0, .33); desk7.rotation.x = -.18;
  const sheet = pp(box(.48, .3, .008, new THREE.MeshStandardMaterial({ color: 0xe8dcc0, roughness: .9 })), 0, 1.03, .345); sheet.rotation.x = -.18;
  [-.06, 0, .06].forEach((x) => pp(box(.03, .015, .08, M.brass), x, .06, .33)); // pedals
  at(piano, 3.9, 0, -5.3);
  const bench = new THREE.Group();
  const bTop = box(.8, .08, .36, M.velvet); bTop.position.y = .5; bench.add(bTop);
  bench.add(put(box(.82, .04, .38, lacquer), 0, .45, 0));
  [[-.34, -.14], [.34, -.14], [-.34, .14], [.34, .14]].forEach(([a, b]) => bench.add(put(cyl(.025, .018, .44, lacquer, 10), a, .22, b)));
  at(bench, 3.9, 0, -4.4);
  piano.userData.pick = bench.userData.pick = "ofrenda"; pickables.push(piano, bench);
  // portraits along the dining room wall
  [-3.1, 3.1].forEach((x, i) => {
    const fr = box(.95, 1.2, .06, M.brass); at(fr, x, 2.5, -5.95);
    const pic = new THREE.Mesh(new THREE.PlaneGeometry(.78, 1.02), new THREE.MeshStandardMaterial({ map: portraitTex(10 + i * 180, i === 1), roughness: .85 })); at(pic, x, 2.5, -5.91);
    framed(pic, fr, x, 2.5, -5.95, 0, ["z-", -5.98]);
  });

  // stone ribs across the ceiling, springing from corbels on the side walls
  [-5.1, -3.3, -1.5, .3].forEach((z) => {
    const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(-4.95, 2.85, z), new THREE.Vector3(0, 4.55, z), new THREE.Vector3(4.95, 2.85, z));
    const rib = new THREE.Mesh(new THREE.TubeGeometry(curve, 28, .09, 6), M.stone); scene.add(rib);
    [-4.9, 4.9].forEach((x) => at(box(.2, .26, .3, M.stone), x, 2.75, z));
  });
  // wall sconces: an iron bracket, one candle, and a warm pool of light painted on the stone behind it (no extra lights)
  const glows = [];
  const sconce = (x, z, ry) => {
    const g = new THREE.Group();
    g.add(put(box(.06, .2, .05, M.black), 0, 0, .025));
    g.add(put(box(.04, .04, .16, M.black), 0, -.06, .1));
    g.add(put(cyl(.05, .03, .04, M.black, 10), 0, -.03, .17));
    g.add(put(cyl(.022, .022, .16, M.wax, 10), 0, .07, .17));
    const fl = new THREE.Mesh(new THREE.SphereGeometry(.02, 8, 8), M.flame); fl.scale.y = 2; fl.position.set(0, .19, .17); g.add(fl); flames.push(fl);
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: .7 }));
    glow.position.set(0, .2, .012); g.add(glow); glows.push(glow);
    at(g, x, 2.0, z, ry);
  };
  sconce(-4.99, -4.6, Math.PI / 2); sconce(-4.99, .6, Math.PI / 2); sconce(4.99, -4.4, -Math.PI / 2); sconce(4.99, .6, -Math.PI / 2);
  sconce(-1.75, -5.99, 0); sconce(1.75, -5.99, 0);

  // ------------------------------------------------ study
  const desk = new THREE.Group();
  const dTop = box(2, .08, 1.2, M.wood); dTop.position.y = .78; desk.add(dTop);
  [[-.9, -.5], [.9, -.5], [-.9, .5], [.9, .5]].forEach(([a, b]) => { const l = box(.08, .78, .08, M.darkwood); l.position.set(a, .39, b); desk.add(l); });
  const drawers = box(.6, .5, 1.1, M.darkwood); drawers.position.set(.65, .5, 0); desk.add(drawers);
  at(desk, 8.4, 0, 6);
  place("ClassicConsole_01", { x: 8.4, z: 6, size: [2, .82, 1.1], hide: [desk] });
  const lampG = new THREE.Group();
  lampG.add(put(cyl(.08, .1, .04, M.brass), 0, .02, 0));
  lampG.add(put(cyl(.015, .015, .4, M.brass), 0, .22, 0));
  const shade = new THREE.Mesh(new THREE.ConeGeometry(.18, .2, 20, 1, true), new THREE.MeshStandardMaterial({ color: 0x1e3022, emissive: 0x0c1608, side: THREE.DoubleSide })); shade.position.y = .45; lampG.add(shade);
  at(lampG, 8.2, .82, 5.4);
  const shelf = box(.5, 3.4, 5.6, M.darkwood); at(shelf, 9.75, 1.7, 6);
  const bookFace = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 3.1), M.books); at(bookFace, 9.49, 1.75, 6, -Math.PI / 2);
  // three bookcases along the wall, books set on their shelves
  [4.3, 6, 7.7].forEach((z, i) => place("Shelf_01", { x: 9.6, z, ry: -Math.PI / 2, height: 2.6, against: ["x+", 9.98], tint: 0x5a4436, hide: [shelf, bookFace] }).then((r) => {
    if (!r) return;
    const h = r.box.max.y - r.box.min.y, x = (r.box.min.x + r.box.max.x) / 2;
    SHELF_LEVELS.forEach((f, k) => place("book_encyclopedia_set_01", { x, y: r.box.min.y + h * f, z: z + ((i + k) % 2 ? .18 : -.18), ry: -Math.PI / 2, height: .3 }));
  }));
  const armchair = new THREE.Group();
  armchair.add(put(box(.9, .45, .85, M.velvet), 0, .3, 0));
  armchair.add(put(box(.9, .8, .2, M.velvet), 0, .8, -.35));
  at(armchair, 6, 0, 8, Math.PI);
  place("ArmChair_01", { x: 6, z: 8, ry: Math.PI, height: 1.0, hide: [armchair] });
  place("WoodenTable_02", { x: 6.9, z: 8.25, height: .55 });
  const sideTable = new THREE.Group();
  sideTable.add(put(box(1.1, .06, 1, M.wood), 0, .75, 0));
  [[-.48, -.42], [.48, -.42], [-.48, .42], [.48, .42]].forEach(([a, b]) => sideTable.add(put(box(.06, .75, .06, M.darkwood), a, .375, b)));
  at(sideTable, 5, 0, 3.55);
  place("ClassicNightstand_01", { x: 5, z: 3.55, size: [.62, .78, .5], hide: [sideTable] });
  place("gothic_statue", { x: 4.7, z: 8.35, ry: Math.PI * .75, height: 1.55, tint: 0x8c8c94 });
  const statueLight = point(0x8fa8ff, 1.1, 3, 5.3, .55, 7.7, false); // lit from below, like a grave at night
  let rocker = null;
  place("Rockingchair_01", { x: 8.5, z: 3.75, ry: -Math.PI * .8, height: 1.0 }).then((r) => { if (r) rocker = r.holder; });
  const seascape = canvasTex(256, 168, (g, w, h) => {
    const sky = g.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, "#0b0e18"); sky.addColorStop(.55, "#2a3346"); sky.addColorStop(.56, "#0f141e"); sky.addColorStop(1, "#05070b");
    g.fillStyle = sky; g.fillRect(0, 0, w, h);
    g.fillStyle = "rgba(220,225,235,.5)"; g.beginPath(); g.arc(w * .72, h * .26, 9, 0, Math.PI * 2); g.fill();
    g.strokeStyle = "rgba(150,165,190,.25)"; for (let i = 0; i < 14; i++) { const y = h * (.6 + i * .028); g.beginPath(); g.moveTo(0, y); for (let x = 0; x <= w; x += 16) g.lineTo(x, y + Math.sin(x * .07 + i) * 2); g.stroke(); }
    g.fillStyle = "#020305"; g.beginPath(); g.moveTo(w * .1, h * .62); g.lineTo(w * .16, h * .4); g.lineTo(w * .2, h * .62); g.fill(); // a lone mast
  });
  place("hanging_picture_frame_02", { x: 7, y: 2.2, z: 3.03, height: .62, anchor: "center", against: ["z-", 3.02] }).then((r) => {
    if (!r) return;
    const pic = new THREE.Mesh(new THREE.PlaneGeometry((r.box.max.x - r.box.min.x) * .82, (r.box.max.y - r.box.min.y) * .75), new THREE.MeshStandardMaterial({ map: seascape, roughness: 1 }));
    at(pic, 7, (r.box.min.y + r.box.max.y) / 2 - .015, r.box.max.z + .003);
  });

  // ------------------------------------------------ cobwebs in the upper corners and on the chandeliers
  const webTex = canvasTex(256, 256, (g, w, h) => {
    g.strokeStyle = "rgba(220,225,235,.55)"; g.lineWidth = 1;
    const spokes = 9;
    for (let k = 0; k <= spokes; k++) { const a = k / spokes * Math.PI / 2; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * w * 1.2, Math.sin(a) * h * 1.2); g.stroke(); }
    for (let r = 14; r < w; r += 13 + Math.random() * 8) {
      g.beginPath();
      for (let k = 0; k <= spokes; k++) { const a = k / spokes * Math.PI / 2, rr = r * (.92 + Math.random() * .1), sag = k && k < spokes ? r * .06 : 0;
        const x = Math.cos(a) * rr - Math.cos(a) * sag, y = Math.sin(a) * rr - Math.sin(a) * sag; k ? g.lineTo(x, y) : g.moveTo(x, y); }
      g.stroke();
    }
  });
  const webMat = new THREE.MeshBasicMaterial({ map: webTex, transparent: true, opacity: .2, depthWrite: false, side: THREE.DoubleSide, fog: true });
  // a web across each upper corner, angled 45 degrees between the two walls
  [[-4, 10, Math.PI * .75], [4, 10, -Math.PI * .75], [-4, 2.01, Math.PI * .25], [-5, -6, Math.PI * .25], [5, -6, -Math.PI * .25], [-5, 2, Math.PI * .75],
   [10, 3, -Math.PI * .25], [10, 9, -Math.PI * .75], [4.01, 9, Math.PI * .75]].forEach(([x, z, ry]) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.3), webMat);
    m.position.set(x + Math.sin(ry) * .46, 3.54, z + Math.cos(ry) * .46); m.rotation.set(-Math.PI / 4, ry + Math.PI, 0, "YXZ"); scene.add(m);
  });

  // ------------------------------------------------ the four objects that remember
  const OBJ = {};
  const halo = canvasTex(64, 64, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    gr.addColorStop(0, "rgba(150,190,255,.9)"); gr.addColorStop(.4, "rgba(120,160,255,.35)"); gr.addColorStop(1, "rgba(120,160,255,0)");
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
  const remember = (key, group, pos, ry = 0) => {
    at(group, pos[0], pos[1], pos[2], ry);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: halo, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    s.scale.set(.9, .9, 1); s.position.set(pos[0], pos[1] + .25, pos[2]); scene.add(s);
    OBJ[key] = { group, sprite: s, pos: new THREE.Vector3(pos[0], pos[1], pos[2]), done: false };
    group.userData.pick = s.userData.pick = key; pickables.push(group, s);
  };
  // photograph standing on the mantel
  const pf = new THREE.Group();
  pf.add(box(.04, .34, .48, M.brass));
  const photoMat = new THREE.MeshStandardMaterial({ roughness: .9 });
  // the frame's artwork panel is portrait-oriented in its own UVs; once the frame lies on its side the print is turned to match
  const photoArt = { mesh: null, apply() { const m = photoMat.map; if (m && this.mesh) { m.center.set(.5, .5); m.rotation = -Math.PI / 2; m.wrapS = m.wrapT = THREE.RepeatWrapping; m.repeat.set(-1, 1); /* turned and un-mirrored */ m.needsUpdate = true; } } };
  const photoFace = new THREE.Mesh(new THREE.PlaneGeometry(.42, .28), photoMat); photoFace.position.x = .025; photoFace.rotation.y = Math.PI / 2; pf.add(photoFace);
  remember("photo", pf, [-4.42, 1.58, -2], 0);
  // turned on its side so the frame is landscape; the print is mapped onto the frame's own artwork panel
  place("standing_picture_frame_02", { x: -4.36, y: 1.4, z: -2, rx: Math.PI / 2, height: .3, tint: 0x8a7a68, hide: [pf.children[0], photoFace] }).then((r) => {
    if (!r) return;
    pf.remove(...pf.children.filter((c) => !c.visible)); // keep the clue group (glow, pick) but drop the stand-in box
    r.holder.userData.pick = "photo"; pickables.push(r.holder);
    r.holder.traverse((m) => {
      if (!m.isMesh) return;
      const name = [].concat(m.material).map((x) => x.name).join();
      if (/artwork/.test(name)) { m.material = photoMat; photoArt.mesh = m; photoArt.apply(); }
      if (/glass/.test(name)) m.material = new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: .06, roughness: .25, envMapIntensity: .12, depthWrite: false });
    });
  });
  // letter on the desk
  const letterMat = new THREE.MeshStandardMaterial({ roughness: .9 });
  const lt = new THREE.Mesh(new THREE.BoxGeometry(.34, .006, .24), [M.cloth, M.cloth, letterMat, M.cloth, M.cloth, M.cloth]); lt.castShadow = true;
  const ltG = new THREE.Group(); ltG.add(lt);
  remember("letter", ltG, [8, .83, 6.1], .3);
  // gramophone on the side table: wooden case with a brass rim, a grooved record, tonearm and a flared horn
  const grooves = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = "#0b0b0c"; g.fillRect(0, 0, w, h);
    for (let r = 40; r < 127; r += 1.6) { g.strokeStyle = `rgba(255,255,255,${r % 9 < 1.6 ? .09 : .035})`; g.beginPath(); g.arc(w / 2, h / 2, r, 0, Math.PI * 2); g.stroke(); }
    g.fillStyle = "#8e2a2a"; g.beginPath(); g.arc(w / 2, h / 2, 36, 0, Math.PI * 2); g.fill();
    g.strokeStyle = "#e8c27a"; g.lineWidth = 2; g.beginPath(); g.arc(w / 2, h / 2, 30, 0, Math.PI * 2); g.stroke();
  });
  const hornMat = new THREE.MeshPhysicalMaterial({ color: 0xc09a50, metalness: .9, roughness: .28, side: THREE.DoubleSide, envMapIntensity: .8 });
  const gr = new THREE.Group();
  gr.add(put(box(.38, .13, .38, M.wood), 0, .075, 0));
  gr.add(put(box(.392, .012, .392, M.brass), 0, .142, 0));
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => gr.add(put(new THREE.Mesh(new THREE.SphereGeometry(.018, 10, 8), M.brass), a * .17, .012, b * .17)));
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(.165, .165, .01, 48), [M.black, new THREE.MeshStandardMaterial({ map: grooves, roughness: .35 }), M.black]);
  disc.position.y = .153; gr.add(disc);
  gr.add(put(cyl(.004, .004, .03, M.brass, 8), 0, .17, 0));
  const armBase = put(cyl(.022, .026, .05, M.brass, 14), .15, .17, -.15); gr.add(armBase);
  const arm = put(cyl(.007, .007, .19, M.brass, 8), .09, .19, -.075); arm.rotation.set(Math.PI / 2, -.675, 0, "YXZ"); gr.add(arm); // base to soundbox
  gr.add(put(cyl(.022, .022, .018, M.brass, 16), .03, .175, 0));       // soundbox on the record
  const flare = [];
  for (let i = 0; i <= 24; i++) { const t = i / 24; flare.push(new THREE.Vector2(.01 + .14 * t ** 3.4, .42 * t)); }
  const horn = new THREE.Mesh(new THREE.LatheGeometry(flare, 40), hornMat);
  horn.position.set(.15, .19, -.15); horn.rotation.set(.55, -.75, 0, "YXZ"); gr.add(horn); // rises from the back corner, bell up and toward the room
  remember("record", gr, [5, .78, 3.55], .4);
  // guest list on a small easel at the head of the table
  const listMat = new THREE.MeshStandardMaterial({ roughness: .9, side: THREE.DoubleSide });
  const gl = new THREE.Group();
  const card = new THREE.Mesh(new THREE.PlaneGeometry(.24, .34), listMat); card.position.y = .18; card.rotation.x = -.18; gl.add(card);
  const easel = box(.02, .32, .02, M.brass); easel.position.set(0, .15, -.07); easel.rotation.x = .35; gl.add(easel);
  remember("guest_list", gl, [2.05, .84, -2], -Math.PI / 2);
  // seat 7: where the ofrenda goes
  const ofrendaSpot = new THREE.Group();
  const marigolds = new THREE.Group();
  for (let i = 0; i < 26; i++) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(.05, 10, 8), new THREE.MeshStandardMaterial({ color: 0xf29a1d, emissive: 0x8a4a00, emissiveIntensity: .6, roughness: .8 }));
    m.position.set((Math.random() - .5) * .7, .56 + Math.random() * .05, (Math.random() - .5) * .3); marigolds.add(m);
  }
  marigolds.visible = false; ofrendaSpot.add(marigolds);
  at(ofrendaSpot, 3.9, 0, -4.4);
  const OFRENDA_POS = new THREE.Vector3(3.9, .6, -4.4);

  // her ghost, revealed at the end: warm where the guests are cold, no hollow eyes, a marigold in her hair.
  // She sits at the bench facing the piano, then turns, head first, to look at whoever remembered her.
  const herMat = ghostMaterial({ color: 0xb8a690, emissive: 0x8a4a14, emissiveIntensity: .35, rim: 0xe0904a, opacity: 0, eyes: 0 });
  const her = ghost(herMat); at(her, 3.9, .02, -4.3, Math.PI); her.scale.set(.9, .97, .9);
  // her face from the photograph, glowing faintly through the cloth, and a marigold in her hair; both turn with her head
  const herHead = new THREE.Group(); her.children[0].add(herHead);
  const faceTex = canvasTex(256, 256, () => {}), faceMat = new THREE.MeshBasicMaterial({ map: faceTex, color: 0xffe0bc, transparent: true, opacity: 0, depthWrite: false });
  const faceImg = new Image(); faceImg.src = "img/marisol.webp";
  faceImg.onload = () => { // crop the face, feather it into a soft oval
    const g = faceTex.image.getContext("2d"), W = faceImg.width, H = faceImg.height;
    g.clearRect(0, 0, 256, 256); g.filter = "brightness(1.7) contrast(1.1)"; g.drawImage(faceImg, W * .36, H * .29, W * .33, H * .275, 0, 0, 256, 256);
    const m = g.createRadialGradient(128, 120, 30, 128, 128, 126); m.addColorStop(0, "#fff"); m.addColorStop(.6, "rgba(255,255,255,.7)"); m.addColorStop(1, "rgba(255,255,255,0)");
    g.filter = "none"; g.globalCompositeOperation = "destination-in"; g.fillStyle = m; g.fillRect(0, 0, 256, 256); faceTex.needsUpdate = true;
  };
  const herFace = new THREE.Mesh(new THREE.PlaneGeometry(.2, .2), faceMat); herFace.position.set(.01, 1.37, .2); herFace.renderOrder = 3; herHead.add(herFace);
  const herFlower = new THREE.Group(), petalMat = new THREE.MeshStandardMaterial({ color: 0xf29a1d, emissive: 0xf28a10, emissiveIntensity: 1.6 });
  for (let i = 0; i < 7; i++) {
    const pt = new THREE.Mesh(new THREE.SphereGeometry(.035, 8, 6), petalMat), a = i / 7 * Math.PI * 2;
    pt.scale.set(1, .45, .7); pt.position.set(Math.cos(a) * .035, Math.sin(a) * .035, 0); pt.rotation.z = a; herFlower.add(pt);
  }
  herFlower.add(new THREE.Mesh(new THREE.SphereGeometry(.022, 8, 6), new THREE.MeshStandardMaterial({ color: 0x7a2a00, emissive: 0xc04000, emissiveIntensity: 1 })));
  herFlower.position.set(.12, 1.47, .06); herFlower.rotation.y = .9; herHead.add(herFlower); herFlower.visible = false;
  let herTurn = 0;

  // drifting dust in the light, and marigold petals for the ending
  const dot = canvasTex(32, 32, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(.5, "rgba(255,255,255,.5)"); gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
  const dustGeo = new THREE.BufferGeometry(), DN = 400, dpos = new Float32Array(DN * 3);
  for (let i = 0; i < DN; i++) { dpos[i * 3] = -5 + Math.random() * 15; dpos[i * 3 + 1] = Math.random() * 3.6; dpos[i * 3 + 2] = -6 + Math.random() * 16; }
  dustGeo.setAttribute("position", new THREE.BufferAttribute(dpos, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: 0xc8c0ff, map: dot, size: .025, transparent: true, opacity: .4, depthWrite: false })); scene.add(dust);
  const petalGeo = new THREE.BufferGeometry(), PN = 600, ppos = new Float32Array(PN * 3), pvel = new Float32Array(PN);
  for (let i = 0; i < PN; i++) { ppos[i * 3] = -4 + Math.random() * 9; ppos[i * 3 + 1] = 2 + Math.random() * 3; ppos[i * 3 + 2] = -6 + Math.random() * 8; pvel[i] = .3 + Math.random() * .6; }
  petalGeo.setAttribute("position", new THREE.BufferAttribute(ppos, 3));
  const petals = new THREE.Points(petalGeo, new THREE.PointsMaterial({ color: 0xf29a1d, map: dot, size: .045, transparent: true, opacity: .95, depthWrite: false }));
  petals.visible = false; scene.add(petals);

  // ------------------------------------------------ post-processing
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), .55, .6, .95); // only bright things (flames, ghost rims, moon) bloom
  composer.addPass(bloom);
  const grade = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uDread: { value: 0 } },
    vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime; uniform float uDread; varying vec2 vUv;
      float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main() {
        vec2 c = vUv - 0.5; float r = length(c);
        // a touch of lens fringing toward the edges
        vec3 col = vec3(texture2D(tDiffuse, vUv + c * 0.004 * r).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - c * 0.004 * r).b);
        float l = dot(col, vec3(0.299, 0.587, 0.114));
        col = mix(vec3(l), col, 0.68 - 0.28 * uDread);                       // muted colour; more drained as the candles go out
        col *= mix(vec3(0.74, 0.9, 1.16), vec3(1.12, 0.95, 0.8), smoothstep(0.04, 0.5, l)); // teal shadows, orange candlelight
        vec3 c1 = clamp(col, 0.0, 1.0); col += (c1 * c1 * (3.0 - 2.0 * c1) - c1) * 0.1; // the faintest S-curve
        col = col * 0.95 + vec3(0.012, 0.014, 0.022);                          // blacks lifted into a cold haze, like breath on old glass
        col *= 1.0 - smoothstep(0.4, 0.9, r) * (0.62 + 0.25 * uDread);       // heavy vignette, heavier as the candles die
        col += (h(vUv * vec2(1920.0, 1080.0) + fract(uTime * 7.3)) - 0.5) * 0.045; // film grain
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  composer.addPass(grade);
  composer.addPass(new OutputPass());

  // ------------------------------------------------ player and controls
  dim(scene);
  const player = { x: 0, z: 9, yaw: 0, pitch: 0, bob: 0 };
  const keysDown = new Set();
  let enabled = false, sensitivity = 1, looked = false;
  const touch = { move: null, look: null, mx: 0, mz: 0 };
  const isTouch = matchMedia("(pointer: coarse)").matches;

  addEventListener("keydown", (e) => { if (enabled && !e.target.closest("input, textarea, select")) keysDown.add(e.code); });
  addEventListener("keyup", (e) => keysDown.delete(e.code));
  addEventListener("blur", () => keysDown.clear());
  // mouse: drag to look (no pointer lock), a click without a drag picks the glowing object under the cursor
  const mouse = { x: 0, y: 0, in: false };
  const aim = (e) => { mouse.x = e.clientX / innerWidth * 2 - 1; mouse.y = 1 - e.clientY / innerHeight * 2; mouse.in = true; };
  let drag = null;
  canvas.addEventListener("pointerdown", (e) => {
    if (!enabled || e.pointerType === "touch" || e.button !== 0) return;
    aim(e); // a click with no mouse move before it still picks what is under it
    drag = { x: e.clientX, y: e.clientY, moved: 0 }; canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (e.pointerType === "touch") return;
    aim(e);
    if (drag && !(e.buttons & 1)) { drag = null; canvas.classList.remove("dragging"); } // the button came up somewhere we did not hear
    if (!drag || !enabled) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    drag.x = e.clientX; drag.y = e.clientY; drag.moved += Math.abs(dx) + Math.abs(dy);
    player.yaw -= dx * .004 * sensitivity;
    player.pitch = Math.max(-1.2, Math.min(1.2, player.pitch - dy * .004 * sensitivity));
    if (drag.moved > 6) { looked = true; canvas.classList.add("dragging"); }
  });
  canvas.addEventListener("pointerup", (e) => {
    if (!drag) return;
    const click = drag.moved <= 6; drag = null; canvas.classList.remove("dragging");
    if (click && enabled) { const k = pick(); if (k) opts.onPick?.(k); }
  });
  canvas.addEventListener("pointerleave", () => { mouse.in = false; });
  // touch: left half is a joystick, right half drags the view
  canvas.addEventListener("touchstart", (e) => {
    if (!enabled) return;
    for (const t of e.changedTouches) {
      if (t.clientX < innerWidth / 2 && !touch.move) touch.move = { id: t.identifier, x: t.clientX, y: t.clientY };
      else if (!touch.look) touch.look = { id: t.identifier, x: t.clientX, y: t.clientY };
    }
    opts.onJoystick?.(touch.move);
  }, { passive: true });
  canvas.addEventListener("touchmove", (e) => {
    for (const t of e.changedTouches) {
      if (touch.move && t.identifier === touch.move.id) {
        touch.mx = Math.max(-1, Math.min(1, (t.clientX - touch.move.x) / 50)); touch.mz = Math.max(-1, Math.min(1, (t.clientY - touch.move.y) / 50));
        opts.onJoystick?.(touch.move, touch.mx, touch.mz);
      } else if (touch.look && t.identifier === touch.look.id) {
        player.yaw -= (t.clientX - touch.look.x) * .006 * sensitivity;
        player.pitch = Math.max(-1.2, Math.min(1.2, player.pitch - (t.clientY - touch.look.y) * .006 * sensitivity));
        touch.look.x = t.clientX; touch.look.y = t.clientY;
      }
    }
  }, { passive: true });
  const endTouch = (e) => {
    for (const t of e.changedTouches) {
      if (touch.move && t.identifier === touch.move.id) { touch.move = null; touch.mx = touch.mz = 0; opts.onJoystick?.(null); }
      if (touch.look && t.identifier === touch.look.id) touch.look = null;
    }
  };
  canvas.addEventListener("touchend", endTouch); canvas.addEventListener("touchcancel", endTouch);

  // ------------------------------------------------ cinematic camera (ending)
  let cinematic = null;
  const tmp = new THREE.Vector3(), fwd = new THREE.Vector3();

  // the object in reach for E: within 3 m and roughly in front, not only dead ahead
  function nearest() {
    if (cinematic) return null;
    fwd.set(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
    let best = null, bestD = 3;
    const consider = (key, pos) => {
      tmp.set(pos.x - player.x, 0, pos.z - player.z);
      const d = tmp.length(); if (d > bestD) return;
      if (d > .6 && tmp.normalize().dot(fwd) < .25) return;
      best = key; bestD = d;
    };
    for (const [k, o] of Object.entries(OBJ)) consider(k, o.pos);
    consider("ofrenda", OFRENDA_POS);
    return best;
  }

  // the glowing object under the mouse, if it is within 4.5 m and no wall is in the way
  const raycaster = new THREE.Raycaster(), ndc = new THREE.Vector2();
  raycaster.far = 4.5;
  let hover = null;
  function pick() {
    if (cinematic || !mouse.in) return null;
    raycaster.setFromCamera(ndc.set(mouse.x, mouse.y), camera);
    let o = raycaster.intersectObjects(pickables.concat(blockers), true)[0]?.object;
    while (o && !o.userData.pick) o = o.parent;
    return o?.userData.pick || null;
  }

  const clock = new THREE.Clock();
  let candleCount = 7, turn = 0, gust = 0, pianoFlash = 0, herAlpha = -1, endingT = 0;

  // compile every material's shader once the furniture is in, so walking into a room for the first time does not stutter
  (async () => { let n; do { n = placing.length; await Promise.allSettled(placing.slice()); } while (placing.length !== n); renderer.compileAsync?.(scene, camera).catch(() => {}); })();

  // Quality steps down on its own if frames are slow: first resolution and bloom, then the one shadow.
  let quality = 2, slowFor = 0, frameN = 0;
  function adapt(dt) {
    slowFor = dt > 1 / 38 ? slowFor + dt : Math.max(0, slowFor - dt * .5);
    if (slowFor < 2.5 || quality === 0) return;
    slowFor = 0; quality--;
    if (quality === 1) { renderer.setPixelRatio(1); bloom.enabled = false; resize(); }
    if (quality === 0) { renderer.shadowMap.enabled = false; scene.traverse((m) => { if (m.material) [].concat(m.material).forEach((mt) => { mt.needsUpdate = true; }); }); }
    console.info("quality lowered to", quality);
  }

  function update() {
    const raw = clock.getDelta(), dt = Math.min(raw, .05), t = clock.elapsedTime;
    if (enabled) adapt(raw);
    if (++frameN % 3 === 0) renderer.shadowMap.needsUpdate = true;
    // movement
    if (enabled && !cinematic) {
      let ix = 0, iz = 0;
      if (keysDown.has("KeyW") || keysDown.has("ArrowUp")) iz -= 1;
      if (keysDown.has("KeyS") || keysDown.has("ArrowDown")) iz += 1;
      if (keysDown.has("KeyA")) ix -= 1;
      if (keysDown.has("KeyD")) ix += 1;
      // left and right arrows turn, so the house can be walked with the keyboard alone
      if (keysDown.has("ArrowLeft")) player.yaw += 2 * dt;
      if (keysDown.has("ArrowRight")) player.yaw -= 2 * dt;
      ix += touch.mx; iz += touch.mz;
      const len = Math.hypot(ix, iz);
      if (len > .05) {
        const sp = (keysDown.has("ShiftLeft") ? 3.4 : 2.2) * dt / Math.max(1, len);
        const s = Math.sin(player.yaw), c = Math.cos(player.yaw);
        const dx = (ix * c + iz * s) * sp, dz = (-ix * s + iz * c) * sp;
        if (walkable(player.x + dx, player.z)) player.x += dx;
        if (walkable(player.x, player.z + dz)) player.z += dz;
        player.bob += dt * 9;
      }
    }
    if (cinematic) {
      cinematic.t = Math.min(1, cinematic.t + dt / cinematic.dur);
      const k = cinematic.t * cinematic.t * (3 - 2 * cinematic.t);
      const u = 1 - k; // quadratic Bezier through a raised midpoint, so the camera rises over the table and the guests
      camera.position.set(0, 0, 0).addScaledVector(cinematic.from, u * u).addScaledVector(cinematic.mid, 2 * u * k).addScaledVector(cinematic.to, k * k);
      tmp.lerpVectors(cinematic.lookFrom, cinematic.look, k); camera.lookAt(tmp);
    } else {
      camera.position.set(player.x, EYE + Math.sin(player.bob) * .025, player.z);
      camera.rotation.set(player.pitch, player.yaw, 0, "YXZ");
    }
    // candles and lights breathe; out candles stay dark
    const lit = candleCount / 7;
    candles.forEach((f, i) => { f.visible = i < candleCount; f.scale.y = 2 + Math.sin(t * 12 + i) * .2; });
    flames.forEach((f, i) => { f.scale.y = 2 + Math.sin(t * 11 + i * 2) * .25; });
    candleLights.forEach((l, i) => { l.intensity = (9 + Math.sin(t * 9 + i) * .6 + Math.sin(t * 23 + i * 3) * .4) * (.25 + .75 * lit) - gust * 4; });
    const stutter = Math.sin(t * .37) > .985 ? .25 + .75 * Math.abs(Math.sin(t * 41)) : 1;
    chandelier.intensity = (24 + Math.sin(t * 7) * 1.2 + Math.sin(t * 17) * .8) * stutter;
    const flick = Math.sin(t * 13) * .5 + Math.sin(t * 29 + 1) * .3 + Math.sin(t * 7.3) * .2;
    fire.intensity = 7 + flick * 2.2;
    fireU.uTime.value = t; fireU.uGain.value = .85 + flick * .15;
    logMat.emissiveIntensity = .6 + flick * .25; sootMat.color.setScalar(.75 + flick * .25); floorGlow.material.opacity = .14 + flick * .04;
    for (let i = 0; i < SPN; i++) { // sparks rise, drift and start again at the logs
      let y = spPos[i * 3 + 1] + spVel[i] * dt;
      if (y > OH + .1) { y = .2; spPos[i * 3] = (Math.random() - .5) * .5; }
      spPos[i * 3 + 1] = y; spPos[i * 3] += Math.sin(t * 3 + i) * dt * .06;
    }
    sparks.geometry.attributes.position.needsUpdate = true;
    glows.forEach((g, i) => { g.material.opacity = (.68 + Math.sin(t * 10 + i * 1.7) * .05 + Math.sin(t * 23 + i) * .03) * (.4 + .6 * lit); });
    // the storm: a flash (two quick pulses and a fade), the room lit blue-white through every window, thunder a moment later
    if (t > storm.next) {
      storm.start = t; storm.next = t + 9 + Math.random() * 14; drawBolt();
      opts.onThunder?.(.4 + Math.random() * 1.6);
    }
    const ls = t - storm.start, flash = storm.start < 0 || ls > 1.6 ? 0 : ls < .07 ? 1 : ls < .15 ? .12 : ls < .24 ? .85 : .85 * Math.exp(-(ls - .24) * 5);
    skyMat.color.copy(SKY).multiplyScalar(1 + flash * 4);
    boltMat.opacity = ls < .5 ? flash : 0;
    moons.forEach((m) => { m.intensity = 4.5 + flash * 140; });
    sky.intensity = .27 + flash * 1.3;
    M.glass.color.setHex(0x1a2448).lerp(WHITE_BLUE, flash * .8);
    gust = Math.max(0, gust - dt * .6);
    // Ghosts sway and now and then thin out and come back. Come within 5 m and, one after another, each turns its
    // head to look straight at you, then its body follows. After "face" they all turn to the bench instead.
    ghostTime.value = t; grade.uniforms.uTime.value = t; grade.uniforms.uDread.value = 1 - lit;
    ghosts.forEach((g) => {
      const u = g.userData, dx = player.x - g.position.x, dz = player.z - g.position.z, near = Math.hypot(dx, dz);
      const target = Math.atan2(SEAT7.x - g.position.x, SEAT7.z - g.position.z);
      let want = u.base + (target - u.base) * turn;
      const look = Math.atan2(dx, dz), wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
      u.notice = !turn && !cinematic && near < 5 ? u.notice + dt : Math.max(0, u.notice - dt * 2);
      const watching = u.notice > u.delay;
      if (watching) want = u.base + THREE.MathUtils.clamp(wrap(look - u.base), -1.5, 1.5);
      g.rotation.y += (want - g.rotation.y) * Math.min(1, dt * (watching ? 1.1 : 1.6));
      const headWant = watching ? THREE.MathUtils.clamp(wrap(look - g.rotation.y), -1.1, 1.1) : 0; // the head makes up the rest
      u.head += (headWant - u.head) * Math.min(1, dt * (watching ? 3.5 : 1.5));
      g.children[0].material.userData.head.value = u.head;
      g.position.y = .04 + Math.sin(t * .9 + u.phase) * .03; // they float, the hem never quite touches the floor
      if (t > u.fadeAt && u.fadeT < 0) u.fadeT = 0;
      if (u.fadeT >= 0) {
        u.fadeT += dt;
        const f = u.fadeT < 1.2 ? 1 - u.fadeT / 1.2 * .9 : u.fadeT < 2.4 ? .1 : u.fadeT < 3.6 ? .1 + (u.fadeT - 2.4) / 1.2 * .9 : 1;
        g.children[0].material.userData.fade.value = f;
        if (u.fadeT > 3.6) { u.fadeT = -1; u.fadeAt = t + 14 + Math.random() * 22; }
      }
    });
    if (rocker) rocker.rotation.x = Math.sin(t * 1.1) * .07 * (.6 + .4 * Math.sin(t * .23)); // nobody is sitting in it
    statueLight.intensity = 1.0 + Math.sin(t * 2.3) * .12;
    // remembering objects pulse until found
    for (const o of Object.values(OBJ)) {
      const p = o.done ? .25 : .7 + Math.sin(t * 2.4 + o.pos.x) * .3;
      o.sprite.material.opacity = p * .55;
      o.sprite.position.y = o.pos.y + .25 + Math.sin(t * 1.7 + o.pos.z) * .04;
    }
    disc.rotation.y += dt * (opts.isSpinning?.() ? 3.5 : .1);
    pianoLight.intensity = Math.max(pianoLight.intensity - dt * 1.5, herAlpha >= 0 ? 6 : 0) + pianoFlash;
    pianoFlash = Math.max(0, pianoFlash - dt * 2);
    // dust drift
    const dp = dust.geometry.attributes.position;
    for (let i = 0; i < DN; i++) { let y = dp.getY(i) + dt * .03; if (y > 3.8) y = 0; dp.setY(i, y); }
    dp.needsUpdate = true;
    if (petals.visible) {
      const pp = petals.geometry.attributes.position;
      for (let i = 0; i < PN; i++) {
        let y = pp.getY(i) - pvel[i] * dt * .6;
        if (y < 0) y = 3 + Math.random() * 2;
        pp.setY(i, y); pp.setX(i, pp.getX(i) + Math.sin(t + i) * dt * .1);
      }
      pp.needsUpdate = true;
    }
    if (herAlpha >= 0) {
      herAlpha = Math.min(.72, herAlpha + dt * .14); herMat.opacity = herAlpha; her.position.y = .02 + Math.sin(t * 1.1) * .03;
      // once she is there, she turns toward you: the head leads (about 1 rad), the body follows the rest of the way
      if (endingT > 3.2) herTurn = Math.min(1, herTurn + dt * .35);
      const k = herTurn * herTurn * (3 - 2 * herTurn), toCam = Math.atan2(camera.position.x - her.position.x, camera.position.z - her.position.z);
      const full = Math.atan2(Math.sin(toCam - Math.PI), Math.cos(toCam - Math.PI));
      const headK = THREE.MathUtils.clamp(endingT > 3.2 ? (endingT - 3.2) * .9 : 0, 0, 1);
      const head = THREE.MathUtils.clamp(full * (headK - .65 * k), -1.1, 1.1);
      her.rotation.y = Math.PI + full * .65 * k; herMat.userData.head.value = head;
      herHead.rotation.y = head; faceMat.opacity = herAlpha * .95; // turns with the shader's head rotation
    }
    if (endingT) endingT += dt;
    hover = enabled && !drag ? pick() : null;
    canvas.classList.toggle("hover", !!hover);
    composer.render(dt);
  }

  function resize() {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h, false); composer.setSize(w, h); bloom.resolution.set(w / 2, h / 2);
    camera.aspect = w / h; camera.fov = w < 760 ? 78 : 70; camera.updateProjectionMatrix();
  }
  addEventListener("resize", resize); resize();

  return {
    update, resize, isTouch, OBJECT_KEYS: Object.keys(OBJ), rooms: ROOMS, walls: WALLS,
    debug: { renderer, scene, composer, bloom, strike: () => { storm.next = 0; } }, // for profiling and testing from the console
    get player() { return player; },
    get looked() { return looked; },
    nearest,
    hovered: () => hover,
    setEnabled(on) { enabled = on; if (!on) { keysDown.clear(); touch.mx = touch.mz = 0; drag = null; hover = null; canvas.classList.remove("dragging", "hover"); } },
    setSensitivity(s) { sensitivity = s; },
    setCandles(n) { candleCount = n; },
    markFound(key) { if (OBJ[key]) OBJ[key].done = true; },
    objectPos(key) { return key === "ofrenda" ? OFRENDA_POS : OBJ[key].pos; },
    setTextures({ photo, letter, list }) {
      if (photo) { photoMat.map = new THREE.CanvasTexture(photo); photoMat.map.colorSpace = THREE.SRGBColorSpace; photoMat.needsUpdate = true; photoArt.apply(); }
      if (letter) { letterMat.map = new THREE.CanvasTexture(letter); letterMat.map.colorSpace = THREE.SRGBColorSpace; letterMat.needsUpdate = true; }
      if (list) { listMat.map = new THREE.CanvasTexture(list); listMat.map.colorSpace = THREE.SRGBColorSpace; listMat.needsUpdate = true; }
    },
    goalFx(goal) {
      if (goal === "name") pianoFlash = 4;
      if (goal === "face") turn = 1;
      if (goal === "why") gust = 1;
    },
    ending() {
      petals.visible = true; marigolds.visible = true; herAlpha = 0; herFlower.visible = true; turn = 1; endingT = .001;
      pianoLight.color.set(0xffb070); // the piano lamp turns warm for her
      const look = new THREE.Vector3(3.9, 1.2, -4.3), from = camera.position.clone(), to = new THREE.Vector3(3.55, 1.5, -2.85);
      const mid = from.clone().lerp(to, .5); mid.y = Math.max(from.y, to.y) + 1.4; // peak about 0.7 m above eye height
      cinematic = { t: 0, dur: 6, from, mid, to, lookFrom: from.clone().add(fwd.set(-Math.sin(player.yaw), 0, -Math.cos(player.yaw))), look };
    },
  };
}
