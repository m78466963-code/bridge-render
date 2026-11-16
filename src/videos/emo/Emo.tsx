// "Ten Bullets a Bird" — Emu War 1932. Composition shell for the three built shots.
// Same post chain as the bridge template: InkPass (world lines) -> thin-lens DOF -> Neutral tone map -> colour grade.
// S01–S03 live in world.ts; frames PENDING_FROM..TOTAL hold a pre-production slate until the rest of the shots exist.
import React, { useEffect, useMemo } from "react";
import * as THREE from "three";
import { AbsoluteFill, getInputProps, useCurrentFrame } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import { EffectComposer } from "@react-three/postprocessing";
import { ToneMappingEffect, ToneMappingMode } from "postprocessing";
import { EmuWorld } from "./world";
import { InkPass, noInkFallback } from "./ink";
import { LensBlur } from "./lensblur";
import { GradeEffect, GRADE_STRENGTH, GRADES, gradeFor } from "./grade";
import { PENDING_FROM, TOTAL, dofAt, focusAt, shotAt } from "./story";

export const EMU_FRAMES = TOTAL;

type PostToggles = { ink: boolean; lens: boolean; grade: boolean };
const toggles = (): PostToggles => ({ ink: true, lens: true, grade: true, ...((getInputProps() as { post?: Partial<PostToggles> }).post ?? {}) });

const fwd = new THREE.Vector3(), fpt = new THREE.Vector3();

const Inner: React.FC<{ id: number; world: EmuWorld }> = ({ id, world }) => {
  const f = useCurrentFrame();
  const { camera, scene } = useThree();
  const target = useMemo(() => new THREE.Vector3(), []);
  const on = useMemo(toggles, []);
  const fx = useMemo(() => ({
    ink: new InkPass(scene, camera as THREE.PerspectiveCamera),
    lens: new LensBlur({ maxCoC: 22, nearScale: 1.15 }),
    tone: new ToneMappingEffect({ mode: ToneMappingMode.NEUTRAL }),
    grade: new GradeEffect(GRADES.day, GRADE_STRENGTH.day),
  }), [camera, scene]);
  useEffect(() => () => fx.ink.dispose(), [fx]);
  const post = useMemo(() => (
    <EffectComposer multisampling={4}>
      {on.ink ? <primitive object={fx.ink} dispose={null} /> : null}
      {on.lens ? <primitive object={fx.lens.pre} dispose={null} /> : null}
      {on.lens ? <primitive object={fx.lens.main} dispose={null} /> : null}
      <primitive object={fx.tone} dispose={null} />
      {on.grade ? <primitive object={fx.grade} dispose={null} /> : null}
    </EffectComposer>
  ), [fx, on]);
  const cam = camera as THREE.PerspectiveCamera;
  target.copy(world.update(id, f, cam, scene));
  noInkFallback(world.root);
  const d = dofAt(f);
  cam.getWorldDirection(fwd);
  if (d.focus) fpt.set(...d.focus()); else fpt.copy(target);
  fx.lens.focus = Math.max(0.3, fpt.sub(cam.position).dot(fwd));
  fx.lens.cInf = d.cInf;
  gradeFor(fx.grade, "day");
  return (
    <>
      <primitive object={world.root} dispose={null} />
      {post}
    </>
  );
};

const Slate: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: "#160f0b", color: "#e8d9bd", fontFamily: "Georgia, 'Times New Roman', serif", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 760, padding: "56px 54px", border: "3px solid #6e4f33", boxShadow: "0 0 0 10px #160f0b, 0 0 0 12px #3b2a1d" }}>
        <div style={{ fontSize: 26, letterSpacing: 7, color: "#c39a63" }}>PRE-PRODUCTION</div>
        <div style={{ fontSize: 64, lineHeight: 1.04, marginTop: 18 }}>Ten Bullets<br />a Bird</div>
        <div style={{ fontSize: 26, marginTop: 18, color: "#b9a486" }}>The Emu War · Western Australia · 1932</div>
        <div style={{ height: 2, background: "#6e4f33", margin: "34px 0 26px" }} />
        <div style={{ fontFamily: "'Courier New', monospace", fontSize: 25, lineHeight: 1.75 }}>
          <div>S01–S03 · built · frames 0–196</div>
          <div style={{ color: "#8f7a5f" }}>S04–S23 · pending</div>
          <div style={{ color: "#8f7a5f" }}>1,745 frames · 30 fps · 1080 × 1920</div>
        </div>
        <div style={{ marginTop: 28, fontSize: 19, color: "#8f7a5f" }}>code only · nothing rendered</div>
      </div>
      <div style={{ marginTop: 26, fontFamily: "'Courier New', monospace", fontSize: 18, color: "#5a4936" }}>
        frame {Math.round(f)} / {TOTAL}
      </div>
    </AbsoluteFill>
  );
};

export const EmuShort: React.FC = () => {
  const f = useCurrentFrame();
  const world = useMemo(() => new EmuWorld(), []);
  useEffect(() => () => world.dispose(), [world]);
  if (f >= PENDING_FROM) return <Slate />;
  const id = shotAt(f).id;
  return (
    <AbsoluteFill style={{ background: "#cfe3f2" }}>
      <ThreeCanvas
        width={1080} height={1920} shadows
        gl={{ antialias: false, stencil: false, powerPreference: "high-performance", toneMappingExposure: 1.0 }}
        camera={{ fov: 40, near: 0.15, far: 900 }}
      >
        <Inner id={id} world={world} />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
