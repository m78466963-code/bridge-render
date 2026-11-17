// "Ten Bullets a Bird" — Emu War 1932. Pre-production timeline (code only, nothing rendered).
// The voice track is 58.1698 s = 1,745 frames @ 30 fps. Shots S01–S10 are staged in this build;
// frames 690+ are a textless pending card (see PENDING_FROM). Shot times come from /workspace/emo-short/script.md
// and will be re-anchored to voice/words.json before any render.
export const FPS = 30;
export const TOTAL = 1745;
export const PENDING_FROM = 690; // S11–S23 not built yet
export const BUILT_SHOTS = 10;

export type V3 = [number, number, number];
export type Light = "day" | "golden";

export type ShotDef = {
  id: number;
  a: number;
  b: number;
  light: Light;
  name: string;
  /** story seconds, if a shot needs a different clock than frame / FPS */
  tau?: (t: number) => number;
};

// Shot ranges from script.md (S01 0–82 … S10 607–690). S11+ are still pending.
export const SHOTS: ShotDef[] = [
  { id: 1, a: 0, b: 82, light: "day", name: "map / column" },
  { id: 2, a: 82, b: 140, light: "day", name: "Lewis gun / hero emu" },
  { id: 3, a: 140, b: 196, light: "day", name: "wheatbelt farm" },
  { id: 4, a: 196, b: 272, light: "day", name: "flock floods the crop" },
  { id: 5, a: 272, b: 340, light: "day", name: "convoy on the road" },
  { id: 6, a: 340, b: 404, light: "day", name: "Meredith arrives" },
  { id: 7, a: 404, b: 464, light: "day", name: "two guns / ammo" },
  { id: 8, a: 464, b: 524, light: "day", name: "flapping advance / stare-off" },
  { id: 9, a: 524, b: 607, light: "day", name: "flock splits" },
  { id: 10, a: 607, b: 690, light: "day", name: "first volley" },
];

export const shotAt = (f: number): ShotDef => {
  for (const s of SHOTS) if (f >= s.a && f < s.b) return s;
  return f < 0 ? SHOTS[0] : SHOTS[SHOTS.length - 1];
};

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
/** cinematic symmetric ease (smootherstep): zero velocity at both ends */
export const glide = (u: number) => { const x = clamp01(u); return x * x * x * (x * (6 * x - 15) + 10); };

// ---------------- camera ----------------
export type Cam = { pos: V3; look: V3; fov: number; roll: number };
type ShotCam = Partial<Cam> & { pos: V3; look: V3 };
type Key = { f: number; dur?: number; cut?: boolean; s: () => ShotCam };

const full = (c: ShotCam): Cam => ({ fov: 40, roll: 0, ...c });
const mix = (a: Cam, b: Cam, k: number): Cam => ({
  pos: a.pos.map((v, i) => v + (b.pos[i] - v) * k) as V3,
  look: a.look.map((v, i) => v + (b.look[i] - v) * k) as V3,
  fov: a.fov + (b.fov - a.fov) * k,
  roll: a.roll + (b.roll - a.roll) * k,
});
const run = (keys: Key[], f: number): Cam => {
  let cur = full(keys[0].s());
  for (let i = 1; i < keys.length; i++) {
    const k = keys[i];
    if (f < k.f) break;
    cur = k.cut ? full(k.s()) : mix(cur, full(k.s()), glide((f - k.f) / (k.dur ?? 24)));
  }
  return cur;
};

// S01: aerial over the painted relief map, tilting down into a low glide beside the marching column.
const S1a = (): ShotCam => ({ pos: [0, 34, 22], look: [0, 0.2, -3], fov: 36 });
const S1b = (): ShotCam => ({ pos: [3, 26, 16], look: [0, 0.4, -4], fov: 37 });
const S1c = (): ShotCam => ({ pos: [6.5, 9.5, 7.5], look: [-1.4, 0.9, -6.5], fov: 40, roll: -0.025 });
const S1d = (): ShotCam => ({ pos: [7.2, 2.8, 3.2], look: [-2.2, 1.05, -8.5], fov: 42, roll: 0.02 });
// S02: low 3/4 of the gun crew, push past the cooling jacket, then a 6-frame whip-pan to the hero emu's deadpan.
// The yaw is pulled left so the near gunner and the far gunner share the frame; the shed/tank now sits behind the lens.
const S2a = (): ShotCam => ({ pos: [-3.4, 1.02, -3.5], look: [-0.6, 1.12, -0.2], fov: 49, roll: -0.02 });
const S2b = (): ShotCam => ({ pos: [-2.4, 1.02, -2.9], look: [-0.05, 1.12, -0.15], fov: 44, roll: -0.015 });
const S2c = (): ShotCam => ({ pos: [-1.8, 1.0, -2.4], look: [2.4, 1.53, -4.65], fov: 35, roll: 0.035 });
const S2d = (): ShotCam => ({ pos: [-1.65, 1.0, -2.35], look: [2.4, 1.54, -4.65], fov: 35, roll: 0.025 });
// S03: lateral glide over the wheat tips toward the windmill, shed and the waiting pair.
const S3a = (): ShotCam => ({ pos: [14.5, 2.15, 10.0], look: [-3.2, 2.05, -2.2], fov: 40, roll: -0.02 });
const S3b = (): ShotCam => ({ pos: [5.0, 2.35, 9.4], look: [-2.8, 1.95, -1.8], fov: 39, roll: 0.012 });
// S04: high wide over the wheat, tilting down as the flock floods in and the crop goes flat in bands.
const S4a = (): ShotCam => ({ pos: [30, 26, 36], look: [0, 0, -2], fov: 36 });
const S4b = (): ShotCam => ({ pos: [20, 15, 25], look: [2, 0.2, -18], fov: 44 });
// S05: tracking the convoy on the far road; the road sits beyond the wheat so it never disturbs the farm shots.
const S5a = (): ShotCam => ({ pos: [-26, 2.0, -54], look: [-6, 1.3, -48], fov: 46 });
const S5b = (): ShotCam => ({ pos: [2, 2.0, -54], look: [22, 1.3, -48], fov: 46 });
// S06: low hero push-in as Meredith steps down from the camp truck/step, two soldiers behind him.
const S6a = (): ShotCam => ({ pos: [10.4, 1.02, 3.2], look: [3.2, 1.38, -3.1], fov: 43 });
const S6b = (): ShotCam => ({ pos: [7.6, 1.14, 1.2], look: [3.2, 1.42, -3.1], fov: 39 });
// S07: pan across the two guns, then pull back and up to a top-down on the ammo stack.
const S7a = (): ShotCam => ({ pos: [-2.4, 1.35, 4.6], look: [2.2, 1.05, -1.3], fov: 44 });
const S7b = (): ShotCam => ({ pos: [3.2, 1.55, 2.4], look: [3.0, 0.9, -2.5], fov: 42 });
const S7c = (): ShotCam => ({ pos: [2.8, 7.2, 1.0], look: [2.6, 0.3, -2.6], fov: 40 });
// S08: wobbling advance on the flapping soldiers, hard reverse to the hero emu's deadpan blink.
const S8a = (): ShotCam => ({ pos: [5.6, 1.35, 3.6], look: [1.2, 1.08, -2.2], fov: 46, roll: 0.02 });
const S8b = (): ShotCam => ({ pos: [5.4, 1.30, 3.4], look: [1.4, 1.10, -2.0], fov: 45, roll: -0.018 });
const S8c = (): ShotCam => ({ pos: [5.2, 1.32, 3.1], look: [1.6, 1.06, -2.4], fov: 45, roll: 0.012 });
const S8d = (): ShotCam => ({ pos: [5.0, 1.28, 3.0], look: [1.8, 1.10, -2.2], fov: 44, roll: -0.012 });
const S8e = (): ShotCam => ({ pos: [4.8, 1.30, 2.8], look: [2.0, 1.08, -2.4], fov: 44, roll: 0.008 });
const S8r = (): ShotCam => ({ pos: [0.45, 1.45, -1.85], look: [2.4, 1.56, -4.65], fov: 33, roll: -0.01 });
const S8r2 = (): ShotCam => ({ pos: [0.70, 1.47, -1.75], look: [2.4, 1.57, -4.65], fov: 32, roll: 0.006 });
// S09: five-way split. Whip-pans find the groups, a top-down insert reads the radial dust trails.
const S9a = (): ShotCam => ({ pos: [22, 14, 26], look: [1, 0.5, -5], fov: 56 });
const S9b = (): ShotCam => ({ pos: [20, 5, 8], look: [8, 0.8, -6], fov: 38 });
const S9c = (): ShotCam => ({ pos: [10, 5, 16], look: [-9, 0.8, -3], fov: 38 });
const S9d = (): ShotCam => ({ pos: [2, 40, 2.2], look: [2, 0, -6], fov: 60 });
const S9e = (): ShotCam => ({ pos: [20, 16, 28], look: [1, 0.5, -6], fov: 60 });
// S10: over the gunner's shoulder for the burst, then a wide for the twelve cartoon flops.
const S10a = (): ShotCam => ({ pos: [-1.2, 1.5, 2.6], look: [1.8, 1.2, -3.0], fov: 40 });
const S10b = (): ShotCam => ({ pos: [7.8, 3.1, 8.5], look: [-0.5, 0.8, -4.2], fov: 42 });
const S10c = (): ShotCam => ({ pos: [7.2, 2.8, 7.8], look: [-0.3, 0.8, -4.0], fov: 41 });

const CAMS: Record<number, Key[]> = {
  1: [
    { f: 0, s: S1a },
    { f: 24, dur: 22, s: S1b },
    { f: 52, dur: 18, s: S1c },
    { f: 70, dur: 12, s: S1d },
  ],
  2: [
    { f: 82, s: S2a },
    { f: 110, dur: 13, s: S2b },
    { f: 123, dur: 3, s: S2c },
    { f: 130, dur: 10, s: S2d },
  ],
  3: [
    { f: 140, s: S3a },
    { f: 140, dur: 56, s: S3b },
  ],
  4: [
    { f: 196, s: S4a },
    { f: 200, dur: 66, s: S4b },
  ],
  5: [
    { f: 272, s: S5a },
    { f: 272, dur: 68, s: S5b },
  ],
  6: [
    { f: 340, s: S6a },
    { f: 340, dur: 60, s: S6b },
  ],
  7: [
    { f: 404, s: S7a },
    { f: 420, dur: 18, s: S7b },
    { f: 442, dur: 20, s: S7c },
  ],
  8: [
    { f: 464, s: S8a },
    { f: 472, dur: 8, s: S8b },
    { f: 480, dur: 8, s: S8c },
    { f: 488, dur: 8, s: S8d },
    { f: 496, dur: 8, s: S8e },
    { f: 500, cut: true, s: S8r },
    { f: 508, dur: 16, s: S8r2 },
  ],
  9: [
    { f: 524, s: S9a },
    { f: 540, dur: 6, s: S9b },
    { f: 556, dur: 6, s: S9c },
    { f: 572, cut: true, s: S9d },
    { f: 590, dur: 8, s: S9e },
  ],
  10: [
    { f: 607, s: S10a },
    { f: 632, dur: 18, s: S10b },
    { f: 650, dur: 26, s: S10c },
  ],
};

export const camAt = (id: number, f: number): Cam => run(CAMS[id] ?? CAMS[3], f);

// ---------------- lens ----------------
export type Dof = { f: number; dur?: number; cInf: number; focus?: () => V3 };
const crew = (): V3 => [-0.35, 1.12, 0.55];
const heroEmuEyes = (): V3 => [2.4, 1.62, -4.65];
const farmPair = (): V3 => [-0.4, 1.15, 0.4];
const farmFlock = (): V3 => [-1, 0.9, -14];
const roadMid = (): V3 => [4, 1.25, -48];
const campMajor = (): V3 => [3.25, 1.35, -2.4];
const gunFocus = (): V3 => [2.0, 1.05, -1.2];
const crateFocus = (): V3 => [2.6, 0.45, -2.6];
const advanceFocus = (): V3 => [2.0, 1.15, -3.0];
const splitFocus = (): V3 => [1.0, 1.0, -6.0];
const volleyFocus = (): V3 => [0, 0.75, -8.2];

export const DOF: Dof[] = [
  { f: 0, cInf: 0 }, // establishing: keep the toy map readable
  { f: 82, cInf: 5.2, focus: crew }, // low angle: both gunners + gun sharp, wheat soft
  { f: 123, dur: 3, cInf: 6.5, focus: heroEmuEyes }, // whip-pan racks focus to the emu
  { f: 140, dur: 10, cInf: 3.8, focus: farmPair }, // lateral glide: the S03 pair sharp, windmill readable
  { f: 196, cInf: 28, focus: farmFlock }, // high wide: deep enough to read the whole flood
  { f: 272, cInf: 20, focus: roadMid }, // convoy tracking: trucks and dust stay legible
  { f: 340, cInf: 5.4, focus: campMajor }, // low push-in: Meredith sharp, camp soft
  { f: 404, cInf: 5.2, focus: gunFocus }, // panning the guns
  { f: 440, dur: 16, cInf: 8, focus: crateFocus }, // top-down rack to the ammo stack
  { f: 464, cInf: 5.2, focus: advanceFocus }, // flapping advance
  { f: 500, dur: 2, cInf: 6.8, focus: heroEmuEyes }, // hard reverse: the stare-off
  { f: 524, cInf: 24, focus: splitFocus }, // split: deep, five directions
  { f: 607, cInf: 7, focus: volleyFocus }, // over-shoulder volley
  { f: 632, dur: 18, cInf: 18, focus: volleyFocus }, // wide flops
];

export const dofAt = (f: number) => {
  let i = 0;
  while (i + 1 < DOF.length && f >= DOF[i + 1].f) i++;
  const d = DOF[i], p = DOF[Math.max(0, i - 1)];
  const k = d.dur ? Math.min(1, (f - d.f) / d.dur) : 1;
  return { cInf: p.cInf + (d.cInf - p.cInf) * k, focus: d.focus };
};

export const focusAt = (id: number, f: number): V3 => {
  const d = dofAt(f);
  return d.focus ? d.focus() : camAt(id, f).look;
};
