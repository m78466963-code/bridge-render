// "Ten Bullets a Bird" — Emu War 1932. Pre-production timeline (code only, nothing rendered).
// The voice track is 58.1698 s = 1,745 frames @ 30 fps. Only shots S01–S03 are staged in this build;
// frames 196+ are a pending slate (see PENDING_FROM). Shot times come from /workspace/emo-short/script.md
// and will be re-anchored to voice/words.json before any render.
export const FPS = 30;
export const TOTAL = 1745;
export const PENDING_FROM = 196; // S04–S23 not built yet
export const BUILT_SHOTS = 3;

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

// Provisional shot ranges from script.md (S01 0–82, S02 82–140, S03 140–196).
export const SHOTS: ShotDef[] = [
  { id: 1, a: 0, b: 82, light: "day", name: "map / column" },
  { id: 2, a: 82, b: 140, light: "day", name: "Lewis gun / hero emu" },
  { id: 3, a: 140, b: 196, light: "day", name: "wheatbelt farm" },
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
const S2c = (): ShotCam => ({ pos: [-1.8, 1.0, -2.4], look: [2.4, 1.52, -4.65], fov: 34, roll: 0.035 });
const S2d = (): ShotCam => ({ pos: [-1.65, 1.0, -2.35], look: [2.4, 1.55, -4.65], fov: 33, roll: 0.025 });
// S03: lateral glide over the wheat tips toward the windmill, shed and the waiting pair.
const S3a = (): ShotCam => ({ pos: [14.5, 2.15, 10.0], look: [-3.2, 2.05, -2.2], fov: 40, roll: -0.02 });
const S3b = (): ShotCam => ({ pos: [5.0, 2.35, 9.4], look: [-2.8, 1.95, -1.8], fov: 39, roll: 0.012 });

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
    { f: 123, dur: 6, s: S2c },
    { f: 130, dur: 10, s: S2d },
  ],
  3: [
    { f: 140, s: S3a },
    { f: 140, dur: 56, s: S3b },
  ],
};

export const camAt = (id: number, f: number): Cam => run(CAMS[id] ?? CAMS[3], f);

// ---------------- lens ----------------
export type Dof = { f: number; dur?: number; cInf: number; focus?: () => V3 };
const crew = (): V3 => [-0.35, 1.12, 0.55];
const heroEmuEyes = (): V3 => [2.4, 1.55, -4.65];
const farmPair = (): V3 => [-1.3, 1.15, 0.0];

export const DOF: Dof[] = [
  { f: 0, cInf: 0 }, // establishing: keep the toy map readable
  { f: 82, cInf: 5.2, focus: crew }, // low angle: both gunners + gun sharp, wheat soft
  { f: 123, dur: 3, cInf: 6.5, focus: heroEmuEyes }, // whip-pan racks focus to the emu
  { f: 140, dur: 10, cInf: 3.8, focus: farmPair }, // lateral glide: the S03 pair sharp, windmill readable
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
