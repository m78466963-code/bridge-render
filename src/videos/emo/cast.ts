// Emu cast: flat canvas drawings on yaw-only cards, lit by cardShade() exactly like the bridge template.
// The emu is authored here from scratch (round body, long neck, tiny head, huge deadpan eyes, tufted tail);
// the 1930s gunner reuses the template's bean-head body with a new khaki outfit + tin helmet (toon.ts).
import * as THREE from "three";
import { Pen, bodyFront, bodySide, soldier, Outfit, FrontOpts, SideOpts, Expr, INK, thickAngle, mul } from "./toon";
import { cardShade, CARD_K } from "./cardshade";
import { NOINK } from "./ink";

// ---------------- canvas pool ----------------
type Entry = { cv: HTMLCanvasElement; tex: THREE.CanvasTexture; w: number; h: number };
export type Req = { key: string; w: number; h: number; k: number; draw: (p: Pen) => void; tex?: THREE.CanvasTexture };
const makeEntry = (w: number, h: number): Entry => {
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  return { cv, tex, w, h };
};
export class Pool {
  private live = new Map<string, Entry>();
  private free: Entry[] = [];
  private reqs: Req[] = [];
  req(key: string, w: number, h: number, k: number, draw: (p: Pen) => void) {
    const r: Req = { key: `${w}x${h}|${key}`, w, h, k, draw };
    this.reqs.push(r);
    return r;
  }
  flush() {
    const want = new Map<string, Req[]>();
    for (const r of this.reqs) { const l = want.get(r.key); if (l) l.push(r); else want.set(r.key, [r]); }
    for (const [key, e] of this.live) if (!want.has(key)) { this.live.delete(key); this.free.push(e); }
    for (const [key, rs] of want) {
      let e = this.live.get(key);
      if (!e) {
        const r = rs[0], i = this.free.findIndex((x) => x.w === r.w && x.h === r.h);
        e = i >= 0 ? this.free.splice(i, 1)[0] : makeEntry(r.w, r.h);
        const g = e.cv.getContext("2d")!;
        g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, e.w, e.h); g.setTransform(r.k, 0, 0, r.k, 0, 0);
        r.draw(new Pen(g));
        e.tex.needsUpdate = true;
        this.live.set(key, e);
      }
      for (const r of rs) r.tex = e.tex;
    }
    this.reqs = [];
  }
}

const blank = (() => { const c = document.createElement("canvas"); c.width = c.height = 2; return new THREE.CanvasTexture(c); })();
export const SU = 0.00216; // 1000 design units = 2.16 m
const BODY = (() => { const g = new THREE.PlaneGeometry(600 * SU, 1000 * SU); g.translate(0, (975 - 500) * SU, 0); return g; })();

export class Actor {
  mesh: THREE.Mesh; mat: THREE.MeshLambertMaterial; dmat: THREE.MeshDepthMaterial; r: Req | null = null;
  constructor(parent: THREE.Object3D) {
    this.mat = cardShade(new THREE.MeshLambertMaterial({ map: blank, alphaTest: 0.5, side: THREE.DoubleSide }));
    this.mat.alphaToCoverage = false;
    this.dmat = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: blank, alphaTest: 0.5, side: THREE.DoubleSide });
    this.mesh = new THREE.Mesh(BODY, this.mat);
    this.mesh.customDepthMaterial = this.dmat;
    this.mesh.onBeforeRender = (r) => { const rt = r.getRenderTarget(); CARD_K.uPx.value = (rt ? rt.height : r.domElement.height) / 1920; };
    this.mesh.castShadow = false; this.mesh.receiveShadow = true; this.mesh.visible = false;
    this.mesh.rotation.order = "YXZ"; this.mesh.renderOrder = 1; this.mesh.layers.set(NOINK);
    parent.add(this.mesh);
  }
  bind() { const t = this.r?.tex; if (t) { this.mat.map = t; this.dmat.map = t; } }
}

export type CamInfo = { pos: THREE.Vector3; right: THREE.Vector3 };
export type Place = {
  key: string; draw: (p: Pen) => void; x: number; y: number; z: number;
  scale: number; mirror?: boolean; yaw?: number; size: [number, number, number];
};

const hh = (i: number, s = 0) => { const v = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return v - Math.floor(v); };
const q = (v: number, n = 120) => Math.round(v * n) / n;
const fkey = (o: object) => JSON.stringify(o, (_k, v) => (typeof v === "number" ? q(v) : v));
/** drawing resolution by distance: [canvas w, h, scale from the 600 x 1000 design] */
const tier = (d: number): [number, number, number] =>
  d < 3.2 ? [1800, 3000, 3.0] : d < 6.5 ? [1080, 1800, 1.8] : d < 16 ? [480, 800, 0.8] : [240, 400, 0.4];

// ---------------- characters ----------------
export const GUNNER: Outfit = {
  jacket: "#8a7a4e", pants: "#6b5f3f", boots: "#2f2620", hat: "tin", belt: "#5a4a32", buttons: "#c9b98a",
  skin: "#ffe2c2", build: "adult", rifle: false,
};
export const gunner = (v = 0): Outfit => ({ ...GUNNER, skin: [ "#ffe2c2", "#f5c9a0", "#ecd0b6", "#c99067" ][v % 4], moustache: v % 3 === 1 ? "#4a3426" : undefined });
export const MAJOR: Outfit = {
  ...GUNNER, jacket: "#7d6d43", pants: "#5b5136", boots: "#2f2620", hat: "slouch", belt: "#4b3b26",
  buttons: "#c9b98a", moustache: "#4a3426", skin: "#f5c9a0", build: "adult", rifle: false,
};

const LIGHT = -120 * Math.PI / 180; // painted key light: upper-left, same as the bridge cast

export const placeSoldier = (
  cam: CamInfo,
  p: { x: number; y?: number; z: number; dx: number; dz: number; phase?: number; expr?: Expr; mode?: "march" | "stroll" | "stand"; blink?: boolean | number; seed?: number; scale?: number; flap?: number },
): Place => {
  const { x, z, dx, dz, phase = 0, expr = "neutral", mode = "stand", blink = false, seed = 1, scale = 0.86, flap } = p;
  const y = p.y ?? 0;
  const tx = cam.pos.x - x, tz = cam.pos.z - z, tl = Math.hypot(tx, tz) || 1;
  const c = (tx * dx + tz * dz) / tl;
  const side = c < 0.57, mirror = dx * cam.right.x + dz * cam.right.z < 0;
  const d = cam.pos.distanceTo(new THREE.Vector3(x, y + 1.2, z)) / scale;
  const [w, h, k] = tier(d);
  const o = gunner(seed), mirror2 = side && mirror;
  const fo: FrontOpts = { phase, expr, mode: mode === "stand" ? "stand" : mode, look: 0, blink, light: LIGHT, facing: 0, seed, flap };
  const so: SideOpts = { phase, expr, mode: mode === "stand" ? "stand" : "march", blink, light: LIGHT, seed, stride: 0.62, flap };
  return {
    key: side ? `S|${seed}|${fkey(so)}` : `F|${seed}|${fkey(fo)}`,
    draw: (pen) => (side ? bodySide(pen, o, so) : bodyFront(pen, o, fo)),
    x, y: y + 0.005, z, scale, mirror: mirror2, size: [w, h, k],
  };
};

export const placeMajor = (
  cam: CamInfo,
  p: { x: number; y?: number; z: number; dx: number; dz: number; phase?: number; expr?: Expr; mode?: "march" | "stroll" | "stand"; blink?: boolean | number; seed?: number; scale?: number },
): Place => {
  const { x, z, dx, dz, phase = 0, expr = "stern", mode = "stand", blink = false, seed = 12, scale = 1.08 } = p;
  const y = p.y ?? 0;
  const tx = cam.pos.x - x, tz = cam.pos.z - z, tl = Math.hypot(tx, tz) || 1;
  const c = (tx * dx + tz * dz) / tl;
  const side = c < 0.57, mirror = dx * cam.right.x + dz * cam.right.z < 0;
  const d = cam.pos.distanceTo(new THREE.Vector3(x, y + 1.35, z)) / scale;
  const [w, h, k] = tier(d);
  const o: Outfit = { ...MAJOR };
  const fo: FrontOpts = { phase, expr, mode: mode === "stand" ? "stand" : mode, look: 0, blink, light: LIGHT, facing: 0, seed, prop: "clipboard" };
  const so: SideOpts = { phase, expr, mode: mode === "stand" ? "stand" : "march", blink, light: LIGHT, seed, stride: 0.62 };
  return {
    key: side ? `MS|${seed}|${fkey(so)}` : `MF|${seed}|${fkey(fo)}`,
    draw: (pen) => (side ? bodySide(pen, o, so) : bodyFront(pen, o, fo)),
    x, y: y + 0.005, z, scale, mirror: side && mirror, size: [w, h, k],
  };
};

// ---------------- emu ----------------
const ell = (cx: number, cy: number, rx: number, ry: number, rot = 0, n = 56): [number, number][] => {
  const out: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, x = rx * Math.cos(a), y = ry * Math.sin(a);
    out.push([cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)]);
  }
  return out;
};

export type EmuOpts = { blink?: number; bob?: number; look?: number; lean?: number; stride?: number; phase?: number; scale?: number; down?: number };
/** hero emu in the 600 x 1000 design space (soles at y=975): round body, long S-neck, tiny head, huge half-lidded eyes. */
const drawEmuDown = (p: Pen, o: EmuOpts = {}) => {
  const { look = 0 } = o;
  // tail feathers fanned on the ground, left
  for (const [tx, ty, wdt] of [[92, 782, 13], [80, 812, 15], [86, 844, 14], [100, 868, 11]] as const) {
    p.line([[196, 810], [150, 806], [tx, ty]], "#6a5849", wdt, true);
    p.dot(tx, ty, wdt * 0.9, "#5b4a3d");
  }
  // legs sticking up, cartoon flop
  for (const [side, kx, fx, fy] of [[-1, 218, 186, 600], [1, 262, 286, 574]] as const) {
    p.line([[282 + side * 14, 770], [kx, 690], [fx, fy]], "#8a7762", 17, true);
    p.line([[kx, 690], [fx, fy]], "#6f5e4d", 10, false);
    p.line([[fx, fy], [fx - 28, fy - 20]], "#5b4a3d", 9, true);
    p.line([[fx, fy], [fx + 26, fy - 24]], "#5b4a3d", 9, true);
    p.dot(kx, 690, 6.5, "#4a3c31");
  }
  // body and wing lying on its side
  const body = ell(322, 800, 172, 92, -0.06);
  p.shadedFill(body, "#8b7864", "#57483c", LIGHT, 172, 0.42);
  p.inkRing(body, 13, thickAngle(LIGHT));
  const wing = ell(300, 788, 102, 55, 0.14);
  p.shadedFill(wing, "#786453", "#4e4036", LIGHT, 100, 0.45);
  p.inkRing(wing, 8, thickAngle(LIGHT));
  // neck + head resting forward
  p.line([[430, 806], [488, 760], [516, 700]], "#8b7864", 39, true);
  p.line([[438, 790], [488, 748], [512, 702]], "#a08a72", 17, false);
  const head = ell(526 + look * 6, 676, 58, 48, -0.08);
  p.shadedFill(head, "#8b7864", "#57483c", LIGHT, 58, 0.4);
  p.inkRing(head, 10, thickAngle(LIGHT));
  for (const [x0, y0, x1, y1] of [[514, 638, 500, 604], [524, 634, 522, 598], [535, 636, 546, 606]] as const) {
    p.stroke([[x0, y0], [x1, y1]], 7, "#4a3c31");
    p.dot(x1, y1, 5, "#3d3128");
  }
  p.poly([[570 + look * 6, 670], [644 + look * 6, 682], [572 + look * 6, 694]], "#3a2c2c", 7);
  p.stroke([[568 + look * 6, 684], [640 + look * 6, 690]], 3, "#1f1818");
  for (const ex of [514, 538]) {
    p.stroke([[ex - 10, 672], [ex + 10, 672]], 3.4, "#3d3128");
  }
  p.stroke([[500, 690], [552, 690]], 3, "#57483c");
};
export const drawEmu = (p: Pen, o: EmuOpts = {}) => {
  const { blink = 0, bob = 0, look = 0, lean = 0, stride = 0, phase = 0, down = 0 } = o;
  if (down > 0.5) { drawEmuDown(p, o); return; }
  const hx = 392 + lean * 12, hy = 214 + bob;
  // ---- tail (behind the body) ----
  for (const [tx, ty, wdt] of [[86, 452, 13], [78, 486, 15], [86, 520, 14], [102, 548, 11]] as const) {
    p.line([[186, 506], [140, 492], [tx, ty]], "#6a5849", wdt, true);
    p.dot(tx, ty, wdt * 0.9, "#5b4a3d");
  }
  // ---- legs ----
  for (const [side, kx, ax] of [[-1, 268, 278], [1, 332, 322]] as const) {
    const gait = stride > 0 ? Math.sin(Math.PI * 2 * phase + (side > 0 ? Math.PI : 0)) * stride : 0;
    const hip: [number, number] = [300 + side * 18, 716];
    const knee: [number, number] = [kx + gait * 12, 838 - Math.max(0, gait) * 10];
    const ankle: [number, number] = [ax + gait * 30, 950 - Math.max(0, gait) * 18];
    p.line([hip, knee, ankle], "#8a7762", 17, true);
    p.line([knee, ankle], "#6f5e4d", 10, false);
    // three-toed foot
    p.line([ankle, [ankle[0] - 30, ankle[1] + 20]], "#5b4a3d", 9, true);
    p.line([ankle, [ankle[0] + 2, ankle[1] + 27]], "#5b4a3d", 9, true);
    p.line([ankle, [ankle[0] + 32, ankle[1] + 18]], "#5b4a3d", 9, true);
    p.dot(knee[0], knee[1], 6.5, "#4a3c31");
  }
  // ---- body ----
  const body = ell(300, 566, 150, 174, -0.06);
  p.shadedFill(body, "#8b7864", "#57483c", LIGHT, 158, 0.42);
  p.inkRing(body, 13, thickAngle(LIGHT));
  // chest / belly wash
  const chest = ell(336, 590, 88, 126, -0.12);
  p.shadedFill(chest, "#a08a72", "#7b6754", LIGHT, 100, 0.5);
  p.poly(chest, null, 4);
  // folded wing
  const wing = ell(252, 576, 74, 112, 0.16);
  p.shadedFill(wing, "#786453", "#4e4036", LIGHT, 92, 0.45);
  p.inkRing(wing, 8, thickAngle(LIGHT));
  for (let i = 0; i < 3; i++) p.stroke([[232 + i * 8, 620 + i * 20], [266 + i * 8, 668 + i * 20]], 3.2, "#5d4c3e");
  // ---- neck ----
  const neck: [number, number][] = [[334, 452], [350, 372], [372, 300], [388, 252 + bob]];
  p.line(neck, "#8b7864", 39, true);
  p.line([[342, 436], [360, 360], [384, 286]], "#a08a72", 17, false);
  for (let i = 0; i < 4; i++) p.stroke([[348 + i * 5, 398 - i * 24], [376 + i * 5, 390 - i * 24]], 2.2, "#6f5e4d");
  // ---- head ----
  const head = ell(hx, hy, 58, 48, -0.08);
  p.shadedFill(head, "#8b7864", "#57483c", LIGHT, 60, 0.4);
  p.inkRing(head, 10, thickAngle(LIGHT));
  // tuft
  for (const [x0, y0, x1, y1] of [[hx - 12, hy - 42, hx - 26, hy - 76], [hx - 2, hy - 46, hx - 4, hy - 82], [hx + 9, hy - 44, hx + 20, hy - 74]] as const) {
    p.stroke([[x0, y0], [x1, y1]], 7, "#4a3c31");
    p.dot(x1, y1, 5, "#3d3128");
  }
  // beak (upper + lower)
  p.poly([[hx + 44, hy - 6], [hx + 118, hy + 6], [hx + 46, hy + 18]], "#3a2c2c", 7);
  p.stroke([[hx + 50, hy + 8], [hx + 112, hy + 8]], 3, "#1f1818");
  // eyes: huge sclera, small pupil, permanent half-lid
  for (const [ex, ey, side] of [[hx - 22, hy - 8, -1], [hx + 22, hy - 6, 1]] as const) {
    const rx = 20, ry = 25, lid = Math.max(0.35, Math.min(1, blink));
    p.ell(ex, ey, rx, ry, "#fffaf0", 7);
    p.dot(ex + look * 5 + side * 1.5, ey + 4, 7.4, "#171214");
    // deadpan lid: head-coloured cover down to (ey - ry + 2*lid*ry)
    const cut = ey - ry + 2 * ry * lid * 0.62;
    p.clip(ell(ex, ey, rx + 3, ry + 3), () => {
      p.g.fillStyle = "#8b7864"; p.g.fillRect(ex - rx - 4, ey - ry - 4, rx * 2 + 8, cut - (ey - ry - 4));
    });
    p.stroke([[ex - rx - 1, cut], [ex + rx + 1, cut]], 3.4, "#3d3128");
    p.arc(ex, ey, rx, ry, 200, 340, 2.2, "#57483c");
  }
  // ---- body feather ticks ----
  for (let i = 0; i < 6; i++) p.stroke([[262 + i * 13, 500 + (i % 3) * 16], [270 + i * 13, 516 + (i % 3) * 16]], 2.4, "#6f5e4d");
  void stride; void phase; // walk cycle arrives with S04 (flock); the hero stands here
};

export const placeEmu = (cam: CamInfo, p: { x: number; y?: number; z: number; scale?: number; blink?: number; bob?: number; look?: number; stride?: number; phase?: number; lean?: number; down?: number; mirror?: boolean }): Place => {
  const { x, z, scale = 0.95, blink = 0, bob = 0, look = 0, stride = 0, phase = 0, lean = 0, down = 0, mirror = false } = p;
  const y = p.y ?? 0;
  const d = cam.pos.distanceTo(new THREE.Vector3(x, y + 1.1, z)) / scale;
  const [w, h, k] = tier(d);
  const opts: EmuOpts = { blink: q(blink, 60), bob: q(bob, 60), look: q(look, 60), stride: q(stride, 60), phase: q(phase, 60), lean: q(lean, 60), down: q(down, 60) };
  return {
    key: `EMU|${fkey(opts)}`,
    draw: (pen) => drawEmu(pen, opts),
    x, y: y + 0.005, z, scale, mirror, size: [w, h, k],
  };
};

/** deterministic blink schedule (4-frame half/shut/shut/half), useful for the deadpan hold */
export const blinkAt = (f: number, seed = 3) => {
  let s = Math.round(-40 - 80 * hh(seed, 5));
  for (let n = 0; n < 60; n++) {
    const k = f - s;
    if (k >= 0 && k < 4) return [0.5, 1, 1, 0.5][k];
    s += Math.round(42 + 90 * hh(seed * 17 + n, 7));
  }
  return 0;
};

export const emuShadowTint = (l: string) => mul(l, [0.22, 0.2, 0.26]);
