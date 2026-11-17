// The Emu War farm as one three.js scene. Painted dirt, an instanced waving wheat field, windmill, corrugated shed,
// fence, eucalypts, the S01 relief-map overlay, a Lewis gun on a tripod, a gun crew and the hero emu.
// update(id, f, camera, scene) poses everything for the ten built shots (S01–S10) and returns the look target.
import * as THREE from "three";
import { dirtTex, wheatTex, ironTex, gunTex, woodTex, mapTex, cloudTex, crateTex, dustTex } from "./paint";
import { twoTone, TONE, CHAR, untone } from "./shade";
import { LIGHTS, LOOK } from "./lights";
import { NOINK } from "./ink";
import { Pool, Actor, Place, CamInfo, placeSoldier, placeMajor, placeEmu, blinkAt } from "./cast";
import { FPS, SHOTS, camAt, V3, smooth, clamp01 } from "./story";

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const lam = (opts: THREE.MeshLambertMaterialParameters) => twoTone(new THREE.MeshLambertMaterial(opts));

const beamBetween = (a: THREE.Vector3, b: THREE.Vector3, th: number) => {
  const g = new THREE.BoxGeometry(th, a.distanceTo(b), th);
  const m = new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5),
    new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), b.clone().sub(a).normalize()), V(1, 1, 1));
  return g.applyMatrix4(m);
};

const SKY = { c: ["#cfe3f2", "#b8d0ec", "#8cb7e8", "#5f9adf", "#3b7fd0"], e: [0, 3, 8, 16, 40] };

const hash2 = (i: number, k: number) => { const v = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return v - Math.floor(v); };

/** distance from (px,pz) to the camera path a->b, for keeping wheat out of the lens */
const segDist = (px: number, pz: number, ax: number, az: number, bx: number, bz: number) => {
  const dx = bx - ax, dz = bz - az, l = dx * dx + dz * dz || 1;
  const u = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / l));
  return Math.hypot(px - (ax + dx * u), pz - (az + dz * u));
};

/** crossed-quad wheat clump geometry, base at y=0, top at y=1.6 */
const wheatGeo = () => {
  const g = new THREE.BufferGeometry();
  const p = [
    -0.5, 0, 0, 0.5, 0, 0, 0.5, 1.6, 0, -0.5, 1.6, 0,
    0, 0, -0.5, 0, 0, 0.5, 0, 1.6, 0.5, 0, 1.6, -0.5,
  ];
  const n = [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0];
  const uv = [0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1];
  g.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(n, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7]);
  return g;
};

export class EmuWorld {
  root = new THREE.Group();
  private pool = new Pool();
  private actors: Actor[] = [];
  private hemi: THREE.HemisphereLight;
  private sun: THREE.DirectionalLight;
  private fill: THREE.DirectionalLight;
  private sky: THREE.Mesh;
  private skyMat: THREE.ShaderMaterial;
  private fog = new THREE.Fog("#b8d0ec", 30, 260);
  private map: THREE.Mesh;
  private mapMat: THREE.MeshBasicMaterial;
  private wheatMat: THREE.MeshLambertMaterial;
  private wheatU = { uTime: { value: 0 }, uFlat: { value: 0 }, uFlatZ: { value: -30 }, uFlatW: { value: 4.5 } };
  private mill: THREE.Group;
  private clouds: THREE.Mesh[] = [];
  private dust: THREE.Sprite[] = [];
  private road: THREE.Group;
  private trucks: THREE.Group[] = [];
  private roadPuffs: THREE.Sprite[] = [];
  private camp: THREE.Group;
  private gun2: THREE.Group;
  private ammo: THREE.Group;
  private trails: THREE.Sprite[] = [];
  private flash: THREE.Group;
  private tracers: THREE.Mesh[] = [];
  private impacts: THREE.Sprite[] = [];
  private targets: { x: number; z: number }[] = [];
  /** farm props that sit on the S01 map plate: hidden until the map dissolves */
  private props: THREE.Object3D[] = [];
  private sunCache = new Map<number, THREE.Vector3>();
  private frustum = new THREE.Frustum();
  private m4 = new THREE.Matrix4();
  private v = new THREE.Vector3();
  private sph = new THREE.Sphere();

  constructor() {
    const R = this.root;
    // ---- sky ----
    this.skyMat = new THREE.ShaderMaterial({
      uniforms: { c0: { value: new THREE.Color() }, c1: { value: new THREE.Color() }, c2: { value: new THREE.Color() },
        c3: { value: new THREE.Color() }, c4: { value: new THREE.Color() }, e: { value: new THREE.Vector4() } },
      vertexShader: "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: `uniform vec3 c0, c1, c2, c3, c4; uniform vec4 e; varying vec3 vP;
        void main(){ float el = asin(clamp(normalize(vP).y, -1.0, 1.0));
          vec3 c = mix(c0, c1, smoothstep(0.0, e.x, el));
          c = mix(c, c2, smoothstep(e.x, e.y, el));
          c = mix(c, c3, smoothstep(e.y, e.z, el));
          c = mix(c, c4, smoothstep(e.z, e.w, el));
          gl_FragColor = vec4(c, 1.0); }`,
      side: THREE.BackSide, depthWrite: false, fog: false,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(800, 40, 20), this.skyMat);
    this.sky.renderOrder = -1; this.sky.frustumCulled = false; this.sky.layers.set(NOINK);
    R.add(this.sky);

    this.hemi = new THREE.HemisphereLight("#dcecff", "#b49a78", 0.55);
    this.sun = new THREE.DirectionalLight("#fff3e0", 2.8);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.fill = new THREE.DirectionalLight("#9fb8ff", 0.2);
    R.add(this.hemi, this.sun, this.sun.target, this.fill, this.fill.target);

    // ---- ground + distant mounds ----
    const dirt = dirtTex();
    dirt.wrapS = dirt.wrapT = THREE.RepeatWrapping; dirt.repeat.set(60, 60);
    const groundM = lam({ map: dirt, color: "#ffffff" });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(500, 500), groundM);
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; R.add(ground);
    const moundM = lam({ color: "#986b56" });
    for (const [x, z, rx, ry, rz] of [
      [-58, -34, 28, 3.4, 16], [44, -52, 34, 4.2, 21], [66, 22, 26, 2.8, 14],
      [-46, 38, 23, 2.4, 13], [10, -74, 40, 4.6, 24],
    ] as const) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), moundM);
      m.position.set(x, -1.2, z); m.scale.set(rx, ry, rz); m.receiveShadow = true; R.add(m);
    }

    // ---- S01 relief map overlay ----
    const mt = mapTex(); mt.anisotropy = 16;
    this.mapMat = new THREE.MeshBasicMaterial({ map: mt, transparent: true, depthWrite: false, opacity: 1, toneMapped: false });
    this.map = new THREE.Mesh(new THREE.PlaneGeometry(16, 10), this.mapMat);
    this.map.rotation.x = -Math.PI / 2; this.map.position.set(0, 0.06, -3); this.map.renderOrder = 2;
    this.map.layers.set(NOINK); R.add(this.map);

    // ---- wheat field: ~2,400 instanced crossed cards, wind in the vertex shader ----
    this.wheatMat = new THREE.MeshLambertMaterial({ map: wheatTex(), alphaTest: 0.5, side: THREE.DoubleSide, color: "#ffffff" });
    this.wheatMat.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = this.wheatU.uTime;
      sh.uniforms.uFlat = this.wheatU.uFlat;
      sh.uniforms.uFlatZ = this.wheatU.uFlatZ;
      sh.uniforms.uFlatW = this.wheatU.uFlatW;
      sh.vertexShader = sh.vertexShader
        .replace("#include <common>", "#include <common>\nuniform float uTime; uniform float uFlat; uniform float uFlatZ; uniform float uFlatW;")
        .replace("#include <begin_vertex>", `#include <begin_vertex>
          float bend = clamp(position.y / 1.6, 0.0, 1.0);
          float ph = instanceMatrix[3].x * 0.55 + instanceMatrix[3].z * 0.38;
          float flatBand = 1.0 - smoothstep(uFlatW * 0.25, uFlatW, abs(instanceMatrix[3].z - uFlatZ));
          float fl = uFlat * flatBand;
          transformed.y *= 1.0 - 0.74 * fl;
          transformed.x += fl * 0.16 * bend;
          transformed.z += fl * 0.10 * bend;
          transformed.x += sin(uTime * 1.35 + ph) * 0.17 * bend * bend;
          transformed.z += cos(uTime * 1.05 + ph * 1.31) * 0.10 * bend * bend;`);
    };
    this.wheatMat.customProgramCacheKey = () => "wheatWind2";
    const N = 2400;
    const wheat = new THREE.InstancedMesh(wheatGeo(), this.wheatMat, N);
    wheat.receiveShadow = true; wheat.castShadow = false; wheat.frustumCulled = false;
    const m = new THREE.Matrix4(), qt = new THREE.Quaternion(), scl = V(1, 1, 1), pos = V(0, 0, 0), col = new THREE.Color();
    const fract = (x: number) => x - Math.floor(x);
    const hash = (i: number, k: number) => fract(Math.sin(i * 12.9898 + k * 78.233) * 43758.5453);
    let n = 0;
    for (let i = 0; i < 9000 && n < N; i++) {
      const x = -42 + 84 * hash(i, 1);
      const z = -42 + 84 * hash(i, 2);
      if (Math.hypot(x - -6.5, z - -8.5) < 6.8) continue;  // shed
      if (Math.hypot(x - -13, z - -8.5) < 5.2) continue;   // windmill
      if (Math.hypot(x, z - 0.4) < 4.2) continue;          // gun / crew
      if (x > -8.8 && x < 8.8 && z > -8.8 && z < 2.8) continue;    // S01 map plate clearing
      // soften the back edge of the farmyard clearing so the wheat line is not a hard band
      if (x > -8.8 && x < 8.8 && z >= 2.8 && z < 4.6 && hash(i, 9) < ((4.6 - z) / 1.8) * 0.45) continue;
      const s02 = segDist(x, z, -3.4, -3.5, -1.65, -2.35);
      if (s02 < 2.6) continue;                                     // S02 lens path
      if (s02 < 3.5 && hash(i, 10) < 0.5) continue;                // feathered edge
      if (segDist(x, z, 14.5, 10.0, 5.0, 9.4) < 2.7) continue;     // S03 lens path
      // open a clean sightline through the foreground wheat band to the S03 pair
      const s3view = Math.min(
        segDist(x, z, 14.5, 10.0, -1.8, 0.2),
        segDist(x, z, 5.0, 9.4, -1.8, 0.2),
      );
      if (s3view < 1.7) continue;
      if (s3view < 2.8 && hash(i, 12) < 0.45) continue;
      if (segDist(x, z, 10.4, 3.2, 7.6, 1.2) < 2.0) continue;  // S06 lens path
      if (segDist(x, z, -2.4, 4.6, 3.2, 2.4) < 2.0) continue;  // S07 lens path
      if (segDist(x, z, 5.6, 3.6, 4.8, 2.8) < 2.2) continue;   // S08 lens path
      if (Math.hypot(x - 10, z + 7) < 5.6) continue;           // camp clearing
      const s = 0.92 + 0.52 * Math.abs(Math.sin(i * 3.17 + 0.4));
      qt.setFromAxisAngle(V(0, 1, 0), i * 2.399);
      wheat.setMatrixAt(n, m.compose(pos.set(x, 0, z), qt, scl.set(s, s * (0.94 + 0.2 * Math.abs(Math.sin(i * 1.7))), s)));
      col.setHSL(0.108 + 0.024 * hash(i, 5), 0.72 + 0.10 * hash(i, 6), 0.60 + 0.08 * hash(i, 7));
      wheat.setColorAt(n, col);
      n++;
    }
    wheat.count = n;
    if (wheat.instanceColor) wheat.instanceColor.needsUpdate = true;
    R.add(wheat);

    // ---- windmill ----
    this.mill = new THREE.Group();
    this.mill.position.set(-13, 0, -8.5);
    const towerM = lam({ map: woodTex(), color: "#b7a58a" });
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 2.05, 7.6, 4, 1), towerM);
    tower.position.y = 3.8; tower.rotation.y = Math.PI / 4; tower.castShadow = true; tower.receiveShadow = true; this.mill.add(tower);
    for (const y of [2.2, 4.8]) {
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.02 + 1.35 - y * 0.1, 0.02 + 1.35 - y * 0.1, 0.1, 4, 1), lam({ color: "#6f5a3e" }));
      ring.position.y = y; ring.rotation.y = Math.PI / 4; this.mill.add(ring);
    }
    const cap = new THREE.Mesh(new THREE.ConeGeometry(1.5, 0.9, 4), lam({ color: "#5f5a4e" }));
    cap.position.y = 8.05; cap.rotation.y = Math.PI / 4; cap.castShadow = true; this.mill.add(cap);
    const hub = new THREE.Group(); hub.position.set(0, 7.55, 0.95); this.mill.add(hub);
    const hubM = lam({ color: "#4a4238" });
    hub.add(new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.5, 12), hubM).rotateX(Math.PI / 2));
    const sparM = lam({ map: woodTex(), color: "#c0a77e" });
    for (let b = 0; b < 4; b++) {
      const blade = new THREE.Group(); blade.rotation.z = (b / 4) * Math.PI * 2;
      const spar = new THREE.Mesh(new THREE.BoxGeometry(0.11, 3.0, 0.09), sparM);
      spar.position.y = 1.55; spar.castShadow = true; blade.add(spar);
      for (let k = 0; k < 9; k++) {
        const slat = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.045, 0.035), sparM);
        slat.position.set(0.33, 0.34 + k * 0.29, 0.02); blade.add(slat);
      }
      hub.add(blade);
    }
    const vane = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.1, 1.7), lam({ color: "#8d8369" }));
    vane.position.set(0, 7.55, -1.4); vane.castShadow = true; this.mill.add(vane);
    const ladderM = lam({ color: "#6d5638" });
    for (const s of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.07, 4.4, 0.07), ladderM);
      rail.position.set(s * 0.3, 3.2, 1.32); rail.rotation.x = -0.12; this.mill.add(rail);
    }
    for (let k = 0; k < 10; k++) {
      const rung = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.055, 0.055), ladderM);
      rung.position.set(0, 1.2 + k * 0.41, 1.32 + k * 0.05); this.mill.add(rung);
    }
    this.mill.traverse((o) => { if (o instanceof THREE.Mesh) { o.receiveShadow = true; } });
    R.add(this.mill);

    // ---- corrugated shed ----
    const shed = new THREE.Group(); shed.position.set(-6.5, 0, -8.5);
    const iron = ironTex(); iron.wrapS = iron.wrapT = THREE.RepeatWrapping; iron.repeat.set(3, 1.4);
    const wallM = lam({ map: iron, color: "#cfcbbd" });
    const body = new THREE.Mesh(new THREE.BoxGeometry(7, 3, 4.5), wallM);
    body.position.y = 1.5; body.castShadow = true; body.receiveShadow = true; shed.add(body);
    const roofM = lam({ map: iron, color: "#8b877a" });
    for (const s of [-1, 1]) {
      const slab = new THREE.Mesh(new THREE.BoxGeometry(7.6, 0.14, 2.9), roofM);
      slab.position.set(0, 3.62, s * 1.16); slab.rotation.x = s * 0.42; slab.castShadow = true; shed.add(slab);
    }
    const ridge = new THREE.Mesh(new THREE.BoxGeometry(7.9, 0.16, 0.16), lam({ color: "#5d594e" }));
    ridge.position.y = 4.24; shed.add(ridge);
    // gable ends close the triangle between wall top and ridge
    const gg = new THREE.BufferGeometry();
    gg.setAttribute("position", new THREE.Float32BufferAttribute([
      -3.5, 3.0, -2.25, -3.5, 3.0, 2.25, -3.5, 4.22, 0,
       3.5, 3.0,  2.25,  3.5, 3.0, -2.25,  3.5, 4.22, 0,
    ], 3));
    gg.computeVertexNormals();
    const gableM = lam({ color: "#c8c4b6", side: THREE.DoubleSide });
    const gable = new THREE.Mesh(gg, gableM); gable.castShadow = true; gable.receiveShadow = true; shed.add(gable);
    // gutter along the front eave, with a downpipe
    const gutter = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 7.7, 8), lam({ color: "#69675e" }));
    gutter.rotation.z = Math.PI / 2; gutter.position.set(0, 3.04, 2.6); shed.add(gutter);
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 2.8, 8), lam({ color: "#75736a" }));
    pipe.position.set(3.35, 1.55, 2.62); shed.add(pipe);
    const door = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 2.25), lam({ map: woodTex(), color: "#6d5335" }));
    door.position.set(1.4, 1.13, 2.26); shed.add(door);
    const frameM = lam({ color: "#4d3c2a" });
    for (const [x, y, w, h] of [[-1.5, 1.8, 1.4, 1.0], [1.4, 3.0, 1.2, 0.7]] as const) {
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(w, h), lam({ color: "#7fa4a8" }));
      pane.position.set(x, y, 2.261); shed.add(pane);
      const frame = new THREE.Mesh(new THREE.BoxGeometry(w + 0.14, h + 0.14, 0.04), frameM);
      frame.position.set(x, y, 2.24); shed.add(frame);
    }
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 2.1, 16), lam({ map: iron, color: "#8f938a" }));
    tank.position.set(4.1, 1.05, 1.6); tank.castShadow = true; tank.receiveShadow = true; shed.add(tank);
    shed.traverse((o) => { if (o instanceof THREE.Mesh) o.receiveShadow = true; });
    this.props.push(shed);
    R.add(shed);

    // ---- fence in the S03 foreground ----
    const wood = lam({ map: woodTex(), color: "#a8865c" });
    for (let x = -24; x <= 10; x += 2.2) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.11, 1.15, 0.11), wood);
      post.position.set(x, 0.575, 5.3); post.castShadow = true; post.receiveShadow = true; R.add(post);
    }
    for (const y of [0.42, 0.92]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(34.4, 0.07, 0.09), wood);
      rail.position.set(-7, y, 5.3); rail.castShadow = true; R.add(rail);
    }

    // ---- eucalyptus ----
    const trunkM = lam({ color: "#cfc4ad" });
    const leafM = lam({ color: "#6e8b5b" });
    for (const [x, z, s] of [[-19, 6, 1.15], [-23, -2, 0.95], [8, -16, 1.1], [19, -12, 0.9], [-4, -17, 1.0], [22, 3, 0.8]] as const) {
      const tr = new THREE.Group(); tr.position.set(x, 0, z);
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.24 * s, 0.42 * s, 4.6 * s, 8), trunkM);
      trunk.position.y = 2.3 * s; trunk.castShadow = true; trunk.receiveShadow = true; tr.add(trunk);
      for (const [dx, dy, dz, r] of [[0, 5.1, 0, 1.9], [-1.3, 4.4, 0.5, 1.35], [1.2, 4.7, -0.6, 1.25], [0.2, 6.0, 0.4, 1.1]] as const) {
        const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(r * s, 1), leafM);
        leaf.position.set(dx * s, dy * s, dz * s); leaf.scale.set(1.15, 0.82, 1.05); leaf.castShadow = true; leaf.receiveShadow = true; tr.add(leaf);
      }
      R.add(tr);
    }

    // ---- Lewis gun + ammo crates ----
    const gun = new THREE.Group(); gun.position.set(0, 0, 0);
    const gunM = lam({ map: gunTex(), color: "#ffffff" });
    const ironM = lam({ color: "#3d414c" });
    const steelM = lam({ color: "#7d8088" });
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + Math.PI / 6;
      const leg = new THREE.Mesh(beamBetween(V(0, 0.98, 0), V(Math.cos(a) * 1.02, 0, Math.sin(a) * 1.02), 0.055), ironM);
      leg.castShadow = true; gun.add(leg);
    }
    const cradle = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.18, 12), ironM);
    cradle.position.y = 0.98; gun.add(cradle);
    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.2, 0.62), gunM);
    receiver.position.set(0, 1.1, 0.18); receiver.castShadow = true; gun.add(receiver);
    const jacket = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.75, 14), gunM);
    jacket.rotation.x = Math.PI / 2; jacket.position.set(0, 1.1, -0.36); jacket.castShadow = true; gun.add(jacket);
    for (let k = 0; k < 5; k++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.105, 0.017, 6, 14), steelM);
      ring.position.set(0, 1.1, -0.62 + k * 0.13); gun.add(ring);
    }
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.62, 12), steelM);
    barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 1.1, -1.0); barrel.castShadow = true; gun.add(barrel);
    const pan = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.11, 24), gunM);
    pan.position.set(0, 1.31, -0.18); pan.castShadow = true; gun.add(pan);
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      const bolt = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 4), steelM);
      bolt.position.set(Math.cos(a) * 0.27, 1.372, -0.18 + Math.sin(a) * 0.27); gun.add(bolt);
    }
    const topEdge = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.012, 0.58), steelM);
    topEdge.position.set(0, 1.207, 0.18); gun.add(topEdge);
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.16, 0.54), lam({ map: woodTex(), color: "#8a5f35" }));
    stock.position.set(0, 1.02, 0.62); stock.castShadow = true; gun.add(stock);
    this.props.push(gun);
    R.add(gun);

    const crateM = lam({ map: crateTex(), color: "#ffffff" });
    for (const [x, z, ry, n] of [[1.25, 0.55, -0.35, 1], [-1.35, 0.95, 0.22, 2]] as const) {
      for (let k = 0; k < n; k++) {
        const crate = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.5, 0.56), [wood, wood, wood, wood, crateM, crateM]);
        crate.position.set(x, 0.25 + k * 0.51, z); crate.rotation.y = ry; crate.castShadow = true; crate.receiveShadow = true;
        this.props.push(crate); R.add(crate);
      }
    }

    // ---- road, convoy, camp, guns, ammo, volley FX ----
    const truckM = lam({ map: woodTex(), color: "#6f6246" });
    const truckDark = lam({ color: "#39352c" });
    const truckTarp = lam({ color: "#a89672" });
    const canvasM = lam({ color: "#b9a888" });
    const makeTruck = () => {
      const g = new THREE.Group();
      const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) => {
        const m = new THREE.Mesh(geo, mat);
        m.position.set(x, y, z); m.rotation.set(rx, ry, rz);
        m.castShadow = true; m.receiveShadow = true; g.add(m);
        return m;
      };
      add(new THREE.BoxGeometry(5.2, 0.22, 1.8), truckDark, 0, 0.55, 0);
      add(new THREE.BoxGeometry(2.9, 0.42, 1.85), truckM, -1.0, 0.9, 0);
      add(new THREE.BoxGeometry(2.9, 0.42, 0.08), truckM, -1.0, 1.22, 0.91);
      add(new THREE.BoxGeometry(2.9, 0.42, 0.08), truckM, -1.0, 1.22, -0.91);
      add(new THREE.BoxGeometry(1.5, 1.35, 1.72), truckM, 1.45, 1.35, 0);
      add(new THREE.BoxGeometry(1.55, 0.14, 1.78), truckDark, 1.45, 2.08, 0);
      add(new THREE.BoxGeometry(1.25, 0.9, 1.55), truckM, 2.65, 1.0, 0);
      add(new THREE.BoxGeometry(0.08, 0.62, 1.3), truckDark, 1.43, 1.55, 0.87);
      add(new THREE.BoxGeometry(0.08, 0.62, 1.3), truckDark, 1.43, 1.55, -0.87);
      add(new THREE.BoxGeometry(0.1, 0.1, 1.35), truckDark, 3.3, 0.95, 0);
      for (const x of [-1.7, 1.7]) for (const z of [-0.94, 0.94]) {
        add(new THREE.CylinderGeometry(0.48, 0.48, 0.34, 14), truckDark, x, 0.52, z, Math.PI / 2, 0, 0);
        add(new THREE.CylinderGeometry(0.24, 0.24, 0.36, 10), truckM, x, 0.52, z, Math.PI / 2, 0, 0);
      }
      add(new THREE.CylinderGeometry(0.13, 0.13, 0.1, 10), lam({ color: "#e4d7a8" }), 3.25, 1.12, 0.52, 0, 0, Math.PI / 2);
      add(new THREE.CylinderGeometry(0.13, 0.13, 0.1, 10), lam({ color: "#e4d7a8" }), 3.25, 1.12, -0.52, 0, 0, Math.PI / 2);
      add(new THREE.BoxGeometry(2.55, 0.1, 1.7), truckTarp, -1.0, 1.58, 0);
      return g;
    };

    const roadTex = dirtTex(); roadTex.wrapS = roadTex.wrapT = THREE.RepeatWrapping; roadTex.repeat.set(18, 2);
    this.road = new THREE.Group(); this.road.visible = false;
    const roadMesh = new THREE.Mesh(new THREE.PlaneGeometry(126, 5.4), lam({ map: roadTex, color: "#c19a76" }));
    roadMesh.rotation.x = -Math.PI / 2; roadMesh.position.set(0, 0.025, -48); roadMesh.receiveShadow = true; this.road.add(roadMesh);
    for (const z of [-1.12, 1.12]) {
      const rut = new THREE.Mesh(new THREE.PlaneGeometry(126, 0.2), lam({ color: "#8a6248" }));
      rut.rotation.x = -Math.PI / 2; rut.position.set(0, 0.036, -48 + z); this.road.add(rut);
    }
    for (let x = -54; x <= 54; x += 12) for (const z of [-45.8, -50.2]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.85, 0.12), lam({ map: woodTex(), color: "#a8865c" }));
      post.position.set(x, 0.42, z); post.castShadow = true; this.road.add(post);
    }
    R.add(this.road);
    for (let i = 0; i < 3; i++) {
      const t = makeTruck();
      t.position.set(-30 - i * 8.5, 0, -48); t.visible = false;
      this.trucks.push(t); R.add(t);
    }
    const puffMat = new THREE.SpriteMaterial({ map: dustTex(), transparent: true, depthWrite: false, opacity: 0.34, color: "#d8a676" });
    for (let i = 0; i < 18; i++) {
      const s = new THREE.Sprite(puffMat.clone());
      s.scale.set(2.6, 1.5, 1); s.layers.set(NOINK); s.visible = false;
      this.roadPuffs.push(s); R.add(s);
    }
    for (let i = 0; i < 24; i++) {
      const s = new THREE.Sprite(puffMat.clone());
      s.scale.set(2.2, 1.2, 1); s.layers.set(NOINK); s.visible = false;
      this.trails.push(s); R.add(s);
    }

    this.camp = new THREE.Group(); this.camp.visible = false;
    const tent = new THREE.Mesh(new THREE.ConeGeometry(2.4, 2.5, 4), canvasM);
    tent.position.set(7.4, 1.2, -6.8); tent.rotation.y = Math.PI / 4; tent.castShadow = true; tent.receiveShadow = true; this.camp.add(tent);
    const tentPole = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 2.9, 6), lam({ color: "#6d5638" }));
    tentPole.position.set(7.4, 1.35, -6.8); this.camp.add(tentPole);
    const tableTop = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.08, 0.95), lam({ map: woodTex(), color: "#9a7a50" }));
    tableTop.position.set(5.1, 0.8, -5.2); tableTop.castShadow = true; tableTop.receiveShadow = true; this.camp.add(tableTop);
    for (const [x, z] of [[4.2, -5.55], [6.0, -5.55], [4.2, -4.85], [6.0, -4.85]] as const) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.8, 0.08), lam({ map: woodTex(), color: "#7b5f3c" }));
      leg.position.set(x, 0.4, z); this.camp.add(leg);
    }
    const mapSheet = new THREE.Mesh(new THREE.PlaneGeometry(1.35, 0.72), lam({ color: "#e7ddc2" }));
    mapSheet.rotation.x = -Math.PI / 2; mapSheet.position.set(5.1, 0.85, -5.2); this.camp.add(mapSheet);
    const step = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.42, 1.05), lam({ map: woodTex(), color: "#9a7a50" }));
    step.position.set(3.1, 0.21, -3.0); step.castShadow = true; step.receiveShadow = true; this.camp.add(step);
    for (const [x, z, n] of [[6.4, -4.7, 1], [6.4, -4.7, 2]] as const) {
      const c = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.5, 0.56), [wood, wood, wood, wood, crateM, crateM]);
      c.position.set(x, 0.25 + (n - 1) * 0.51, z); c.rotation.y = 0.2; c.castShadow = true; c.receiveShadow = true; this.camp.add(c);
    }
    const campTruck = makeTruck(); campTruck.position.set(12.2, 0, -7.4); campTruck.rotation.y = -0.62; campTruck.scale.setScalar(0.92); this.camp.add(campTruck);
    R.add(this.camp);

    this.gun2 = gun.clone(true); this.gun2.position.set(4.3, 0, -0.65); this.gun2.rotation.y = -0.42; this.gun2.visible = false; R.add(this.gun2);
    this.ammo = new THREE.Group(); this.ammo.position.set(2.6, 0, -2.5); this.ammo.visible = false;
    for (const [x, y, z, ry] of [[-0.5, 0.25, 0, -0.16], [0.5, 0.25, 0.02, 0.22], [-0.46, 0.76, 0.01, 0.08], [0.42, 0.76, -0.02, -0.2], [0, 1.27, 0, 0.12]] as const) {
      const c = new THREE.Mesh(new THREE.BoxGeometry(0.94, 0.5, 0.58), [wood, wood, wood, wood, crateM, crateM]);
      c.position.set(x, y, z); c.rotation.y = ry; c.castShadow = true; c.receiveShadow = true; this.ammo.add(c);
    }
    R.add(this.ammo);

    this.flash = new THREE.Group(); this.flash.position.set(0, 1.1, -1.45); this.flash.visible = false;
    const flashM = new THREE.MeshBasicMaterial({ color: "#ffd36e", transparent: true, opacity: 0.95, depthWrite: false, toneMapped: false });
    const flashBall = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), flashM); this.flash.add(flashBall);
    const flashCone = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.9, 6), flashM);
    flashCone.rotation.x = Math.PI / 2; flashCone.position.z = -0.42; this.flash.add(flashCone);
    this.flash.traverse((o) => o.layers.set(NOINK)); R.add(this.flash);
    const tracerM = new THREE.MeshBasicMaterial({ color: "#ffd89a", transparent: true, opacity: 0.74, depthWrite: false, toneMapped: false });
    for (let i = 0; i < 12; i++) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 1, 6), tracerM.clone());
      m.layers.set(NOINK); m.visible = false; this.tracers.push(m); R.add(m);
    }
    for (let i = 0; i < 12; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: dustTex(), transparent: true, depthWrite: false, opacity: 0.5, color: "#e8c18b" }));
      s.scale.set(1.7, 1.0, 1); s.layers.set(NOINK); s.visible = false; this.impacts.push(s); R.add(s);
    }
    this.targets = Array.from({ length: 12 }, (_, i) => ({ x: -2.1 + (i % 4) * 1.4, z: -6.8 - Math.floor(i / 4) * 1.6 }));

    // ---- clouds + dust ----
    const cloudM = new THREE.MeshBasicMaterial({ map: cloudTex(), transparent: true, depthWrite: false, fog: false, opacity: 0.9 });
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + 0.35, d = 180 + (i % 3) * 32;
      const c = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), cloudM);
      c.position.set(Math.cos(a) * d, 58 + (i % 4) * 12, Math.sin(a) * d);
      const w = 58 + (i % 4) * 16; c.scale.set(w, w * 0.55, 1);
      c.layers.set(NOINK); this.clouds.push(c); R.add(c);
    }
    const dustM = new THREE.SpriteMaterial({ map: dustTex(), transparent: true, depthWrite: false, opacity: 0.45, color: "#d8a676" });
    for (let i = 0; i < 7; i++) {
      const s = new THREE.Sprite(dustM.clone());
      s.scale.set(2.1, 1.1, 1); s.layers.set(NOINK); this.dust.push(s); R.add(s);
    }
  }

  private shotSun(id: number, a: number, b: number) {
    const hit = this.sunCache.get(id);
    if (hit) return hit;
    let fx = 0, fz = 0;
    for (let f = a; f < b; f += 4) {
      const c = camAt(id, f), x = c.look[0] - c.pos[0], z = c.look[2] - c.pos[2], n = Math.hypot(x, z) || 1;
      fx += x / n; fz += z / n;
    }
    const n = Math.hypot(fx, fz) || 1; fx /= n; fz /= n;
    const az = THREE.MathUtils.degToRad(68), el = THREE.MathUtils.degToRad(46);
    const hx = fx * Math.cos(az) - fz * Math.sin(az), hz = fz * Math.cos(az) + fx * Math.sin(az);
    const v = V(hx * Math.cos(el), Math.sin(el), hz * Math.cos(el)).normalize();
    this.sunCache.set(id, v);
    return v;
  }

  private actor(i: number) { while (this.actors.length <= i) this.actors.push(new Actor(this.root)); return this.actors[i]; }

  update(id: number, f: number, cam: THREE.PerspectiveCamera, scene: THREE.Scene) {
    const t = f / FPS, s = SHOTS[id - 1] ?? SHOTS[2], L = LIGHTS[s.light], look = LOOK[s.light];
    // ---- camera ----
    const c = camAt(id, f);
    cam.position.set(...c.pos); cam.up.set(0, 1, 0); cam.lookAt(...c.look); cam.rotateZ(c.roll);
    cam.fov = c.fov; cam.near = 0.15; cam.far = 900; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    cam.layers.enable(NOINK);
    const focus = V(...c.look), dist = cam.position.distanceTo(focus);

    // ---- light + shadow fit ----
    const sunDir = this.shotSun(id, s.a, s.b);
    this.hemi.color.set(L.sky); this.hemi.groundColor.set(L.ground); this.hemi.intensity = L.hemiI;
    this.sun.color.set(L.sunCol); this.sun.intensity = L.sunI;
    const Rr = THREE.MathUtils.clamp(dist * 0.9 + 8, 14, 46);
    this.sun.position.copy(focus).addScaledVector(sunDir, 90);
    this.sun.target.position.copy(focus);
    const sc = this.sun.shadow.camera;
    sc.left = -Rr; sc.right = Rr; sc.top = Rr; sc.bottom = -Rr; sc.near = 5; sc.far = 220; sc.updateProjectionMatrix();
    this.sun.shadow.bias = L.bias; this.sun.shadow.normalBias = L.normalBias * (Rr / 14);
    this.fill.intensity = 0;
    TONE.uLitCol.value.set(...L.lit); TONE.uShadeCol.value.set(...L.shade); TONE.uShadeLift.value.set(...L.lift);
    TONE.uLambert.value = L.lambert; TONE.uSideK.value = L.sideK; TONE.uTerm.value = L.term;
    TONE.uBounce.value.set(...look.bounce); TONE.uSat.value = look.sat;
    CHAR.uCharTint.value.set(...L.charTint); CHAR.uCharShade.value = L.charShade; CHAR.uGrad.value = L.charGrad;
    CHAR.uBodyGrad.value = L.bodyGrad; CHAR.uSideTint.value.set(...L.sideTint);

    // ---- sky / fog / clouds ----
    const su = this.skyMat.uniforms;
    SKY.c.forEach((h, i) => untone(h, su["c" + i].value));
    const e = SKY.e.map((deg) => THREE.MathUtils.degToRad(deg));
    su.e.value.set(e[1], e[2], e[3], e[4]);
    this.sky.position.copy(cam.position);
    untone(L.fog, this.fog.color); this.fog.near = L.fogNear; this.fog.far = L.fogFar;
    scene.fog = this.fog; scene.background = null;
    for (const cl of this.clouds) cl.lookAt(cam.position.x, cl.position.y, cam.position.z);

    // ---- wheat + windmill + map fade ----
    this.wheatU.uTime.value = t;
    this.mill.children.forEach((o) => { if (o instanceof THREE.Group && o.position.y > 7) o.rotation.z = 0.55 * t + 0.7; });
    const mapK = id === 1 ? 1 - smooth((f - 20) / 26) : 0;
    this.map.visible = mapK > 0.005;
    this.mapMat.opacity = mapK;
    // the farm props stand where the S01 map plate is, so they swap in as the plate dissolves
    for (const p of this.props) p.visible = mapK < 0.02;
    this.wheatU.uFlat.value = 0;
    this.wheatU.uFlatZ.value = -30;
    this.wheatU.uFlatW.value = 4.5;
    this.road.visible = false;
    for (const tk of this.trucks) tk.visible = false;
    for (const sp of this.roadPuffs) sp.visible = false;
    this.camp.visible = false;
    this.gun2.visible = false;
    this.ammo.visible = false;
    for (const sp of this.trails) sp.visible = false;
    this.flash.visible = false;
    for (const m of this.tracers) m.visible = false;
    for (const sp of this.impacts) sp.visible = false;

    // ---- cast ----
    const places: Place[] = [];
    const camInfo: CamInfo = { pos: cam.position, right: V(0, 0, 0).setFromMatrixColumn(cam.matrixWorld, 0) };
    if (id === 1) {
      const march = 0.045 * Math.max(0, f - 20);
      for (let i = 0; i < 7; i++) {
        places.push(placeSoldier(camInfo, {
          x: -8.2 + i * 1.9 + march, z: -3.1 + (i % 2) * 0.32, y: 0.02 + 0.05 * mapK,
          dx: 1, dz: 0, phase: (f / 30) * 1.7 + i * 0.37, expr: i === 3 ? "stern" : "neutral",
          mode: "march", seed: i + 1, scale: 0.78,
        }));
      }
      for (let i = 0; i < this.dust.length; i++) {
        const sp = this.dust[i], x = -9.3 + i * 1.95 + march;
        sp.visible = mapK < 0.9;
        sp.position.set(x, 0.5, -2.55 + (i % 2) * 0.4);
        sp.material.opacity = 0.22 + 0.12 * Math.sin(f * 0.2 + i);
      }
    } else {
      for (const d of this.dust) d.visible = false;
    }
    if (id === 2) {
      places.push(placeSoldier(camInfo, { x: -0.95, z: 0.75, dx: 0.8, dz: -0.75, expr: "stern", mode: "stand", seed: 2, scale: 0.88 }));
      places.push(placeSoldier(camInfo, { x: 1.35, z: 1.05, dx: -1.3, dz: -1.0, expr: "neutral", mode: "stand", seed: 4, scale: 0.84 }));
      const forced = f >= 126 && f < 130 ? [0.5, 1, 1, 0.5][f - 126] : blinkAt(f, 3);
      places.push(placeEmu(camInfo, { x: 2.4, z: -4.65, scale: 0.98, blink: forced, bob: 2.2 * Math.sin((f - 82) * 0.06), look: 0 }));
    }
    if (id === 3) {
      places.push(placeSoldier(camInfo, { x: 0.5, z: 0.8, dx: -1.0, dz: -0.35, expr: "stern", mode: "stand", seed: 9, scale: 0.92 }));
      places.push(placeSoldier(camInfo, { x: 1.9, z: 0.2, dx: 0.6, dz: 0.8, expr: "neutral", mode: "stand", seed: 5, blink: blinkAt(f, 5), scale: 0.86 }));
      places.push(placeEmu(camInfo, { x: -1.8, z: 0.2, scale: 1.15, blink: blinkAt(f, 7), bob: 0.6 * Math.sin((f - 140) * 0.05), look: 0.25 }));
    }
    if (id === 4) {
      // the flock walks the flattening front down the field in loose rows
      const k = smooth((f - 196) / 70);
      const front = 10 - 33 * k;
      this.wheatU.uFlat.value = 0.94 * smooth(k * 4);
      this.wheatU.uFlatZ.value = front;
      this.wheatU.uFlatW.value = 5.6;
      for (let i = 0; i < 16; i++) {
        const row = Math.floor(i / 4), col = i % 4;
        const x = col * 1.9 + (hash2(i, 3) - 0.5) * 1.2;
        const z = front + 3.2 - row * 3.6 + (hash2(i, 4) - 0.5) * 1.2;
        places.push(placeEmu(camInfo, {
          x, z, scale: 0.8 + 0.12 * hash2(i, 8),
          stride: 0.55, phase: t * 2.2 + i * 0.37, lean: 0.22, look: 0.1,
          blink: blinkAt(f, 30 + i),
        }));
      }
      for (let i = 0; i < 8; i++) {
        const sp = this.roadPuffs[i];
        sp.visible = true;
        sp.position.set(-0.6 + hash2(i, 5) * 7.5, 0.3 + 0.15 * (i % 2), front - 1.5 + hash2(i, 6) * 8.5);
        sp.scale.set(1.7 + (i % 3) * 0.5, 0.95 + (i % 2) * 0.3, 1);
        (sp.material as THREE.SpriteMaterial).opacity = 0.07 + 0.07 * Math.abs(Math.sin(f * 0.25 + i * 2.1));
      }
    }
    if (id === 5) {
      this.road.visible = true;
      const p = clamp01((f - 272) / 68);
      for (let i = 0; i < this.trucks.length; i++) {
        const tk = this.trucks[i];
        tk.visible = true;
        tk.position.set(-12 + 26 * p + i * 8, 0.035 * Math.abs(Math.sin(f * 0.35 + i * 1.7)), -48);
        tk.rotation.z = 0.014 * Math.sin(f * 0.5 + i);
      }
      for (let i = 0; i < this.roadPuffs.length; i++) {
        const tk = this.trucks[i % 3], sp = this.roadPuffs[i];
        sp.visible = true;
        sp.position.set(tk.position.x - 2.4 - (i % 4) * 0.85, 0.32 + 0.22 * (i % 3), -48 + ((i % 3) - 1) * 0.55);
        sp.scale.set(2.1 + (i % 4) * 0.55, 1.15 + (i % 3) * 0.35, 1);
        (sp.material as THREE.SpriteMaterial).opacity = 0.16 + 0.16 * Math.abs(Math.sin(f * 0.22 + i * 1.9));
      }
      places.push(placeEmu(camInfo, {
        x: 3 + 3 * p, z: -44.5, scale: 0.9, stride: 0.34, phase: t * 0.8,
        lean: 0.12, look: 0.3, blink: blinkAt(f, 40),
      }));
    }
    if (id === 6) {
      this.camp.visible = true;
      const walk = smooth((f - 340) / 28);
      const stepDown = 0.42 * (1 - smooth((f - 340) / 15));
      places.push(placeMajor(camInfo, {
        x: 3.1 + 0.22 * walk, y: stepDown, z: -3.0 + 1.1 * walk,
        dx: 0.45, dz: 1.0, mode: f < 344 ? "stand" : "stroll", phase: (f - 340) * 0.06, scale: 1.05,
      }));
      places.push(placeSoldier(camInfo, { x: 2.05, z: -3.95, dx: 0.8, dz: 0.9, expr: "stern", mode: "stand", seed: 15, scale: 0.84 }));
      places.push(placeSoldier(camInfo, { x: 3.75, z: -4.05, dx: 0.5, dz: 1.1, expr: "neutral", mode: "stand", seed: 18, blink: blinkAt(f, 18), scale: 0.82 }));
    }
    if (id === 7) {
      this.gun2.visible = true;
      this.ammo.visible = true;
    }
    if (id === 8) {
      if (f < 500) {
        const adv = smooth((f - 464) / 34);
        for (let i = 0; i < 2; i++) {
          const flap = 0.5 + 0.45 * Math.sin((f - 464) * 0.42 + i * 1.9);
          places.push(placeSoldier(camInfo, {
            x: 1.2 + i * 1.15, z: -2.55 - i * 0.35 - adv * 0.95,
            dx: 0, dz: -1, expr: "stern", mode: "march", seed: 21 + i,
            phase: f * 0.11 + i * 0.5, scale: 0.86 - i * 0.03, flap: Math.max(0, flap),
          }));
        }
      } else {
        const forced = f >= 506 && f < 510 ? [0.5, 1, 1, 0.5][f - 506] : blinkAt(f, 11);
        places.push(placeEmu(camInfo, {
          x: 2.4, z: -4.65, scale: 1.0, blink: forced, look: 0.08,
          bob: 0.06 * Math.sin((f - 500) * 0.06),
        }));
      }
    }
    if (id === 9) {
      const p = clamp01((f - 524) / 83);
      const dirs = [[1, -0.25], [0.25, -1], [-0.92, -0.35], [-0.55, 0.85], [0.9, 0.62]] as const;
      const bases = [[7.5, -5.5], [-8.5, -3.2], [-2.5, -12.5], [4.2, -14.5], [8.5, 2.0]] as const;
      for (let g = 0; g < 5; g++) {
        const [bx, bz] = bases[g], [dx0, dz0] = dirs[g];
        const len = Math.hypot(dx0, dz0) || 1, dx = dx0 / len, dz = dz0 / len;
        const px = -dz, pz = dx;
        for (let j = 0; j < 3; j++) {
          const off = (j - 1) * 1.25 + (g % 2) * 0.4;
          places.push(placeEmu(camInfo, {
            x: bx + dx * p * 6.5 + px * off + (hash2(g * 3 + j, 1) - 0.5) * 0.7,
            z: bz + dz * p * 6.5 + pz * off + (hash2(g * 3 + j, 2) - 0.5) * 0.7,
            scale: 0.78 + 0.08 * hash2(g * 3 + j, 3),
            stride: 0.72, phase: t * 2.8 + g * 0.5 + j * 0.33, lean: 0.18, look: 0.1,
            blink: blinkAt(f, 60 + g * 3 + j),
          }));
        }
      }
      for (let i = 0; i < this.trails.length; i++) {
        const g = i % 5, [dx0, dz0] = dirs[g];
        const len = Math.hypot(dx0, dz0) || 1, dx = dx0 / len, dz = dz0 / len;
        const px = -dz, pz = dx;
        const row = Math.floor(i / 5);
        const r = 2.4 + row * 2.5 + p * 4.5;
        const sp = this.trails[i];
        sp.visible = true;
        sp.position.set(dx * r + px * ((row - 1) * 1.4), 0.42, -5 + dz * r + pz * ((row - 1) * 1.4));
        sp.scale.set(2.4 + row * 0.5, 1.3 + row * 0.3, 1);
        (sp.material as THREE.SpriteMaterial).opacity = 0.20 + 0.13 * (1 - p) * Math.abs(Math.sin(f * 0.2 + i));
      }
    }
    if (id === 10) {
      const muzzle = V(0, 1.1, -1.45);
      const burst = f >= 607 && f < 646 && (f - 607) % 3 < 2;
      this.flash.visible = burst;
      if (burst) {
        const k = 0.8 + 0.35 * Math.abs(Math.sin(f * 2.7));
        this.flash.scale.set(k, k, k);
        this.flash.rotation.z = f * 0.9;
      }
      for (let i = 0; i < 12; i++) {
        const tg = this.targets[i];
        const hit = 610 + i * 2.9;
        const down = f >= hit ? 1 : 0;
        places.push(placeEmu(camInfo, {
          x: tg.x, z: tg.z, y: 0.01, scale: 0.78 + 0.05 * hash2(i, 2),
          blink: blinkAt(f, 50 + i), bob: down ? 0 : 0.07 * Math.sin(f * 0.08 + i * 1.3),
          look: 0.15, down, mirror: i % 2 === 1,
        }));
        const tr = this.tracers[i];
        const travel = (f - (hit - 3)) / 3;
        if (travel > 0 && travel < 1.15) {
          const dir = V(tg.x - muzzle.x, 0.8 - muzzle.y, tg.z - muzzle.z);
          const dist = dir.length(); dir.normalize();
          tr.visible = true;
          tr.position.copy(muzzle).addScaledVector(dir, dist * Math.min(1, travel));
          tr.quaternion.setFromUnitVectors(V(0, 1, 0), dir);
          tr.scale.set(1, 2.6, 1);
        }
        const imp = this.impacts[i], age = f - hit;
        if (age >= 0 && age < 7) {
          imp.visible = true;
          imp.position.set(tg.x, 0.8, tg.z);
          const a = age / 7;
          imp.scale.setScalar(0.9 + a * 2.6);
          (imp.material as THREE.SpriteMaterial).opacity = 0.62 * (1 - a);
        }
      }
    }

    this.frustum.setFromProjectionMatrix(this.m4.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
    let ai = 0;
    const used: Actor[] = [];
    for (const p of places) {
      if (!this.frustum.intersectsSphere(this.sph.set(this.v.set(p.x, p.y + 1.1 * p.scale, p.z), 3.2))) continue;
      const a = this.actor(ai++);
      const [w, h, k] = p.size;
      a.r = this.pool.req(p.key, w, h, k, p.draw);
      a.mesh.visible = true;
      a.mesh.position.set(p.x, p.y, p.z);
      a.mesh.rotation.set(0, p.yaw ?? Math.atan2(cam.position.x - p.x, cam.position.z - p.z), 0);
      a.mesh.scale.set(p.mirror ? -p.scale : p.scale, p.scale, p.scale);
      a.mesh.castShadow = false;
      used.push(a);
    }
    for (let i = ai; i < this.actors.length; i++) this.actors[i].mesh.visible = false;
    this.pool.flush();
    for (const a of used) a.bind();
    return focus;
  }

  dispose() {
    this.root.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) m.dispose();
      }
    });
  }
}
