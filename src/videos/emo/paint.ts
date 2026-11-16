// Painted canvas textures for the emu short. Everything is authored here (no downloaded assets):
// red-dirt ground, a wheat clump card, corrugated iron, weathered timber, the S01 relief map, cloud/dust cards.
// ctex() caches by name, so a texture is painted once per render process.
import * as THREE from "three";

const cache = new Map<string, THREE.CanvasTexture>();

export const ctex = (name: string, w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) => {
  const hit = cache.get(name);
  if (hit) return hit;
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  const g = cv.getContext("2d")!;
  draw(g);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  cache.set(name, t);
  return t;
};

const rnd = (seed: number, k: number) => { const x = Math.sin(seed * 127.1 + k * 311.7) * 43758.5453; return x - Math.floor(x); };
const mixHex = (a: string, b: string, t: number) => {
  const A = parseInt(a.slice(1), 16), B = parseInt(b.slice(1), 16);
  const c = (s: number) => Math.round(((A >> s) & 255) * (1 - t) + ((B >> s) & 255) * t).toString(16).padStart(2, "0");
  return `#${c(16)}${c(8)}${c(0)}`;
};

/** red Pilbara dirt: muted terracotta base, broad tonal washes, dry patches, pebbles, hairline cracks. */
export const dirtTex = () => ctex("dirt", 512, 512, (g) => {
  g.fillStyle = "#a06a55"; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 2600; i++) {
    const x = rnd(i, 1) * 512, y = rnd(i, 2) * 512, r = 1 + rnd(i, 3) * 7;
    g.fillStyle = mixHex("#a06a55", rnd(i, 4) > 0.5 ? "#c39479" : "#76513f", 0.14 + 0.42 * rnd(i, 5));
    g.beginPath(); g.ellipse(x, y, r, r * (0.5 + 0.8 * rnd(i, 6)), rnd(i, 7) * 3, 0, Math.PI * 2); g.fill();
  }
  // broad low-contrast washes so the ground has tonal shape instead of one flat orange
  for (let i = 0; i < 18; i++) {
    const x = rnd(i, 31) * 512, y = rnd(i, 32) * 512, r = 70 + rnd(i, 33) * 170;
    const warm = i % 3 !== 0;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, warm ? "rgba(220,196,166,.10)" : "rgba(70,48,40,.10)");
    gr.addColorStop(0.6, warm ? "rgba(220,196,166,.05)" : "rgba(70,48,40,.05)");
    gr.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // very soft diagonal bands break up the tiling without a hard edge
  for (let i = 0; i < 5; i++) {
    const y = rnd(i, 41) * 512;
    const gr = g.createLinearGradient(0, y, 512, y + 190);
    gr.addColorStop(0, "rgba(80,55,44,0)");
    gr.addColorStop(0.5, i % 2 ? "rgba(80,55,44,.06)" : "rgba(222,196,164,.06)");
    gr.addColorStop(1, "rgba(80,55,44,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 512, 512);
  }
  for (let i = 0; i < 42; i++) {
    const x = rnd(i, 11) * 512, y = rnd(i, 12) * 512, r = 18 + rnd(i, 13) * 70;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, "rgba(214,172,140,.11)"); gr.addColorStop(1, "rgba(214,172,140,0)");
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  g.strokeStyle = "rgba(78,48,38,.34)"; g.lineWidth = 1.1;
  for (let i = 0; i < 26; i++) {
    let x = rnd(i, 21) * 512, y = rnd(i, 22) * 512;
    g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 5; k++) { x += (rnd(i * 9 + k, 23) - 0.5) * 42; y += (rnd(i * 9 + k, 24) - 0.5) * 42; g.lineTo(x, y); }
    g.stroke();
  }
  // a few cool grit flecks keep the terracotta from reading as pure orange
  for (let i = 0; i < 160; i++) {
    g.fillStyle = "rgba(148,140,132,.10)";
    g.fillRect(rnd(i, 51) * 512, rnd(i, 52) * 512, 1.4, 1.4);
  }
});

/** one clump of ripe wheat: thick golden stalks and full seed heads, transparent background, warm ink outline. */
export const wheatTex = () => ctex("wheat", 128, 256, (g) => {
  g.clearRect(0, 0, 128, 256);
  // base blades, so the clump reads as a dense tuft instead of loose spikes
  for (let i = 0; i < 7; i++) {
    const x = 30 + i * 11, bend = (i % 2 ? 1 : -1) * (10 + i * 1.5);
    g.beginPath(); g.moveTo(64, 254); g.quadraticCurveTo(x + bend * 0.3, 200, x + bend, 156 - i * 6);
    g.strokeStyle = "#7a5624"; g.lineWidth = 5.5; g.lineCap = "round"; g.stroke();
    g.strokeStyle = i % 2 ? "#d9a94a" : "#c8943a"; g.lineWidth = 3.2; g.stroke();
  }
  const stalks = [
    [64, 252, 55, 120, 48, 40, -0.10, 1.0],
    [66, 252, 66, 110, 62, 26, 0.02, 1.12],
    [62, 252, 76, 128, 82, 48, 0.12, 0.94],
    [65, 252, 46, 140, 34, 62, -0.16, 1.04],
    [67, 252, 86, 148, 96, 70, 0.18, 0.98],
    [64, 252, 60, 160, 56, 92, -0.04, 1.16],
    [63, 252, 72, 170, 74, 104, 0.07, 0.90],
    [66, 252, 40, 176, 28, 112, -0.13, 0.88],
  ] as const;
  for (const [x0, y0, cx, cy, x1, y1, lean, head] of stalks) {
    const pts: [number, number][] = [];
    for (let i = 0; i <= 18; i++) {
      const t = i / 18, s = 1 - t;
      pts.push([s * s * x0 + 2 * s * t * cx + t * t * (x1 + lean * 90), s * s * y0 + 2 * s * t * cy + t * t * y1]);
    }
    g.lineCap = "round";
    g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.strokeStyle = "#6b4a1e"; g.lineWidth = 5.4; g.stroke();
    g.strokeStyle = "#d5a241"; g.lineWidth = 3.5; g.stroke();
    // seed head: a tapered golden spike with a few chevron scales and awns
    const [hx, hy] = pts[pts.length - 1];
    g.save(); g.translate(hx, hy + 18); g.rotate(lean * 1.2);
    const hg = g.createLinearGradient(0, -22 * head, 0, 24 * head);
    hg.addColorStop(0, "#f6d77f"); hg.addColorStop(0.55, "#e8b84b"); hg.addColorStop(1, "#bd8630");
    g.fillStyle = hg;
    g.beginPath(); g.ellipse(0, 0, 6.2 * head, 22 * head, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = "#785021"; g.lineWidth = 1.5; g.stroke();
    g.strokeStyle = "#a9792f"; g.lineWidth = 2.2;
    for (let k = 0; k < 6; k++) {
      const yy = -15 * head + k * 6 * head, w = (6.5 - k * 0.7) * head;
      g.beginPath(); g.moveTo(-w, yy + 2); g.lineTo(0, yy - 2); g.lineTo(w, yy + 2); g.stroke();
    }
    g.strokeStyle = "#f1cd72"; g.lineWidth = 1.1;
    for (let k = -2; k <= 2; k++) {
      g.beginPath(); g.moveTo(k * 2.4, -20 * head); g.lineTo(k * 4.2, -32 * head); g.stroke();
    }
    g.restore();
  }
});

/** corrugated iron: vertical ribs + rust blooms + nail lines. */
export const ironTex = () => ctex("iron", 256, 256, (g) => {
  g.fillStyle = "#9d9a8b"; g.fillRect(0, 0, 256, 256);
  for (let x = 0; x < 256; x += 16) {
    const gr = g.createLinearGradient(x, 0, x + 16, 0);
    gr.addColorStop(0, "#787669"); gr.addColorStop(0.42, "#c2bfae"); gr.addColorStop(0.72, "#a7a495"); gr.addColorStop(1, "#6f6d60");
    g.fillStyle = gr; g.fillRect(x, 0, 16, 256);
  }
  for (let i = 0; i < 90; i++) {
    const x = rnd(i, 31) * 256, y = rnd(i, 32) * 256, r = 3 + rnd(i, 33) * 18;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, "rgba(128,62,30,.35)"); gr.addColorStop(1, "rgba(128,62,30,0)");
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  g.strokeStyle = "rgba(60,58,50,.35)"; g.lineWidth = 1;
  for (let y = 10; y < 256; y += 48) { g.beginPath(); g.moveTo(0, y); g.lineTo(256, y); g.stroke(); }
});

/** blued gunmetal: brushed bands, panel seams, rivets and warm scratches so the Lewis reads in silhouette. */
export const gunTex = () => ctex("gunmetal", 256, 256, (g) => {
  const base = g.createLinearGradient(0, 0, 256, 0);
  base.addColorStop(0, "#4c545f"); base.addColorStop(0.45, "#68717d"); base.addColorStop(0.62, "#555d68"); base.addColorStop(1, "#3e454f");
  g.fillStyle = base; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 160; i++) {
    const y = rnd(i, 61) * 256;
    g.strokeStyle = `rgba(${rnd(i, 62) > 0.5 ? "190,198,206" : "28,32,38"},${0.06 + 0.12 * rnd(i, 63)})`;
    g.lineWidth = 0.6 + rnd(i, 64) * 1.2;
    g.beginPath(); g.moveTo(0, y); g.lineTo(256, y + (rnd(i, 65) - 0.5) * 3); g.stroke();
  }
  g.strokeStyle = "rgba(20,24,30,.55)"; g.lineWidth = 3;
  for (const y of [44, 128, 212]) { g.beginPath(); g.moveTo(0, y); g.lineTo(256, y); g.stroke(); }
  g.strokeStyle = "rgba(198,204,210,.28)"; g.lineWidth = 1;
  for (const y of [47, 131, 215]) { g.beginPath(); g.moveTo(0, y); g.lineTo(256, y); g.stroke(); }
  for (let i = 0; i < 9; i++) {
    const x = 18 + i * 27, y = i % 2 ? 84 : 172, r = 3.2;
    g.fillStyle = "#9ba4ae"; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#30363e"; g.beginPath(); g.arc(x - 0.8, y - 0.8, r * 0.42, 0, Math.PI * 2); g.fill();
  }
  for (let i = 0; i < 26; i++) {
    const x = rnd(i, 66) * 256, y = rnd(i, 67) * 256, w = 8 + rnd(i, 68) * 34;
    g.strokeStyle = `rgba(190,144,92,${0.12 + rnd(i, 69) * 0.22})`; g.lineWidth = 0.8;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + w, y + (rnd(i, 70) - 0.5) * 6); g.stroke();
  }
});

/** weathered timber for the shed, fence, windmill and crates. */
export const woodTex = () => ctex("wood2", 512, 256, (g) => {
  g.fillStyle = "#8a6a43"; g.fillRect(0, 0, 512, 256);
  for (let y = 0; y < 256; y += 32) {
    g.fillStyle = ["#8a6a43", "#94744b", "#7d5e3a", "#9c7b50"][(y / 32) % 4];
    g.fillRect(0, y, 512, 32);
    g.strokeStyle = "rgba(58,40,24,.55)"; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(0, y + 0.5); g.lineTo(512, y + 0.5); g.stroke();
  }
  g.strokeStyle = "rgba(58,40,24,.28)"; g.lineWidth = 1;
  for (let i = 0; i < 70; i++) {
    const y = rnd(i, 41) * 256, x = rnd(i, 42) * 512, w = 30 + rnd(i, 43) * 90;
    g.beginPath(); g.moveTo(x, y); g.bezierCurveTo(x + w * 0.3, y - 3, x + w * 0.7, y + 3, x + w, y); g.stroke();
  }
});

/** toy relief map of Australia for S01. Textless by design: sea paper, coast ink, relief and state boundaries. */
export const mapTex = () => ctex("australia", 1024, 640, (g) => {
  g.fillStyle = "#d7e4df"; g.fillRect(0, 0, 1024, 640);
  for (let i = 0; i < 1200; i++) {
    g.fillStyle = rnd(i, 51) > 0.5 ? "rgba(90,130,140,.07)" : "rgba(255,255,255,.10)";
    g.fillRect(rnd(i, 52) * 1024, rnd(i, 53) * 640, 2, 2);
  }
  // graticule
  g.strokeStyle = "rgba(72,104,112,.18)"; g.lineWidth = 1;
  for (let x = 64; x < 1024; x += 64) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 640); g.stroke(); }
  for (let y = 52; y < 640; y += 52) { g.beginPath(); g.moveTo(0, y); g.lineTo(1024, y); g.stroke(); }
  // lon/lat -> canvas (mainland from Cape York to Wilsons Prom, Tasmania below)
  const X = (lon: number) => 72 + ((lon - 110) / 45) * 880;
  const Y = (lat: number) => 58 + ((-8 - lat) / 37) * 520;
  const at = (pts: [number, number][]): [number, number][] => pts.map(([lo, la]) => [X(lo), Y(la)]);
  const au = at([
    [142.5, -10.7], [141.5, -13.0], [141.7, -15.4], [140.8, -17.5], [139.2, -17.7], [136.9, -15.8],
    [136.5, -14.2], [135.5, -12.2], [132.6, -11.2], [130.8, -12.4], [129.6, -14.8], [128.0, -15.5],
    [126.0, -14.0], [124.4, -16.0], [122.2, -17.8], [120.0, -19.5], [116.8, -20.6], [114.1, -21.8],
    [113.4, -24.0], [114.0, -26.0], [113.2, -26.5], [114.5, -28.0], [115.0, -31.5], [115.7, -33.5],
    [115.1, -34.4], [117.9, -35.0], [120.0, -33.9], [123.0, -33.9], [126.0, -32.3], [129.0, -31.7],
    [132.0, -32.0], [134.0, -33.0], [135.5, -34.8], [137.0, -35.2], [137.9, -33.9], [138.5, -35.5],
    [140.0, -37.5], [141.0, -38.1], [144.5, -38.4], [146.4, -39.1], [147.5, -38.0], [150.0, -37.4],
    [150.8, -35.5], [153.0, -33.0], [153.1, -30.0], [153.4, -27.5], [153.1, -25.0], [151.0, -23.0],
    [149.0, -20.5], [146.8, -19.3], [145.8, -16.9], [145.3, -15.0], [144.0, -14.5], [143.5, -13.0],
    [142.8, -11.5],
  ]);
  const tas = at([
    [144.6, -40.7], [145.5, -40.9], [148.3, -40.8], [148.2, -42.2], [147.5, -43.2], [146.8, -43.6],
    [146.0, -43.5], [145.2, -42.5], [145.0, -41.5],
  ]);
  const path = (pts: [number, number][]) => { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); };
  // paper shadow under the continent
  g.save(); g.translate(8, 10); path(au); g.fillStyle = "rgba(72,48,28,.16)"; g.fill(); g.restore();
  path(au);
  const land = g.createLinearGradient(0, Y(-10), 0, Y(-39));
  land.addColorStop(0, "#e3c17a"); land.addColorStop(0.55, "#d8b06a"); land.addColorStop(1, "#c99a52");
  g.fillStyle = land; g.fill();
  g.save(); path(au); g.clip();
  // interior desert / scrub washes, placed by real-ish coordinates
  const relief: [number, number, number, string][] = [
    [128, -25, 235, "rgba(196,96,54,.48)"], [140, -24, 190, "rgba(190,108,62,.42)"],
    [119, -30, 180, "rgba(206,138,78,.38)"], [146, -31, 150, "rgba(150,128,78,.28)"],
    [116, -18, 170, "rgba(120,140,86,.28)"], [150, -20, 120, "rgba(120,140,86,.26)"],
    [136, -33, 120, "rgba(156,94,58,.32)"], [146, -36, 90, "rgba(120,138,84,.30)"],
  ];
  for (const [lo, la, r, c] of relief) {
    const x = X(lo), y = Y(la), gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, c); gr.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // eastern highlands: a few warm ridge strokes
  g.strokeStyle = "rgba(112,70,42,.28)"; g.lineWidth = 2;
  for (let i = 0; i < 20; i++) {
    const x = X(147 + rnd(i, 71) * 3), y = Y(-25 - rnd(i, 72) * 11);
    g.beginPath(); g.moveTo(x - 15, y + 5); g.lineTo(x, y - 8); g.lineTo(x + 15, y + 5); g.stroke();
  }
  // coast shading
  path(au); g.strokeStyle = "rgba(250,235,198,.78)"; g.lineWidth = 15; g.lineJoin = "round"; g.stroke();
  path(au); g.strokeStyle = "rgba(58,42,30,.95)"; g.lineWidth = 5.5; g.lineJoin = "round"; g.stroke();
  // state boundaries (no labels)
  g.strokeStyle = "rgba(70,48,36,.40)"; g.lineWidth = 2.2;
  const line = (a: [number, number], b: [number, number]) => { g.beginPath(); g.moveTo(X(a[0]), Y(a[1])); g.lineTo(X(b[0]), Y(b[1])); g.stroke(); };
  line([129, -12], [129, -35]);
  line([138, -12], [138, -26]);
  line([141, -26], [141, -38]);
  line([141, -29], [153, -29]);
  line([141, -34], [150, -36]);
  g.restore();
  path(au); g.strokeStyle = "#3b2a22"; g.lineWidth = 5.5; g.lineJoin = "round"; g.stroke();
  path(au); g.strokeStyle = "rgba(255,246,220,.28)"; g.lineWidth = 2; g.stroke();
  // Tasmania + islands
  const island = (pts: [number, number][], fill = "#d8b06a") => {
    g.save(); g.translate(5, 6); path(pts); g.fillStyle = "rgba(72,48,28,.14)"; g.fill(); g.restore();
    path(pts); g.fillStyle = fill; g.fill(); g.strokeStyle = "#3b2a22"; g.lineWidth = 4; g.lineJoin = "round"; g.stroke();
  };
  island(tas);
  island(at([[136.6, -35.6], [137.4, -35.5], [137.7, -36.1], [136.9, -36.2]]), "#d3a861");
  island(at([[147.9, -40.0], [148.4, -39.9], [148.5, -40.3], [148.0, -40.4]]), "#d3a861");
  // sea decoration (no compass lettering)
  g.strokeStyle = "rgba(72,104,112,.30)"; g.lineWidth = 1.4;
  for (let i = 0; i < 8; i++) {
    g.beginPath(); g.arc(886, 96, 18 + i * 7, 0.2, 1.5); g.stroke();
    g.beginPath(); g.arc(886, 96, 14 + i * 7, 3.35, 4.65); g.stroke();
  }
  g.save(); g.translate(886, 96); g.rotate(0.2); g.fillStyle = "rgba(74,53,41,.55)";
  g.beginPath(); g.moveTo(0, -34); g.lineTo(5, -7); g.lineTo(0, -12); g.lineTo(-5, -7); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(0, 34); g.lineTo(4, 8); g.lineTo(0, 12); g.lineTo(-4, 8); g.closePath(); g.fill(); g.restore();
  // wood frame
  g.strokeStyle = "#6f4e2f"; g.lineWidth = 18; g.strokeRect(9, 9, 1006, 622);
  g.strokeStyle = "#a97b49"; g.lineWidth = 4; g.strokeRect(20, 20, 984, 600);
});

/** soft grey-brown cloud card. */
export const cloudTex = () => ctex("cloud", 256, 160, (g) => {
  g.clearRect(0, 0, 256, 160);
  const blobs: [number, number, number][] = [[80, 92, 46], [124, 76, 54], [168, 90, 44], [108, 104, 40], [148, 108, 34]];
  for (const [x, y, r] of blobs) {
    const gr = g.createRadialGradient(x, y - r * 0.18, r * 0.1, x, y, r);
    gr.addColorStop(0, "rgba(255,252,244,.95)"); gr.addColorStop(0.65, "rgba(240,238,232,.82)"); gr.addColorStop(1, "rgba(228,228,228,0)");
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
});

/** dust puff card for the column and truck wheels (multiply-friendly, soft edges). */
export const dustTex = () => ctex("dust", 192, 128, (g) => {
  g.clearRect(0, 0, 192, 128);
  for (const [x, y, r] of [[70, 80, 34], [100, 68, 42], [132, 82, 32], [88, 96, 28]] as const) {
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, "rgba(199,145,98,.55)"); gr.addColorStop(1, "rgba(199,145,98,0)");
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
});

/** textless ammo crate face: planks, steel corner straps and a painted chevron stencil. */
export const crateTex = () => ctex("crate", 512, 256, (g) => {
  g.fillStyle = "#7d613d"; g.fillRect(0, 0, 512, 256);
  for (let y = 0; y < 256; y += 64) {
    g.fillStyle = ["#7d613d", "#876a43", "#745835"][(y / 64) % 3]; g.fillRect(0, y, 512, 64);
    g.strokeStyle = "rgba(52,36,22,.6)"; g.lineWidth = 2; g.beginPath(); g.moveTo(0, y); g.lineTo(512, y); g.stroke();
  }
  g.strokeStyle = "#4a3420"; g.lineWidth = 14; g.strokeRect(7, 7, 498, 242);
  g.fillStyle = "rgba(54,58,62,.85)";
  for (const x of [34, 444]) g.fillRect(x, 24, 34, 208);
  g.fillStyle = "#9ba4ae";
  for (const x of [34, 444]) for (let y = 44; y < 224; y += 36) { g.beginPath(); g.arc(x + 17, y, 4, 0, Math.PI * 2); g.fill(); }
  g.strokeStyle = "rgba(215,205,178,.75)"; g.lineWidth = 9; g.lineJoin = "round";
  g.beginPath(); g.moveTo(190, 92); g.lineTo(256, 152); g.lineTo(322, 92); g.stroke();
  g.beginPath(); g.moveTo(190, 142); g.lineTo(256, 202); g.lineTo(322, 142); g.stroke();
  g.fillStyle = "rgba(60,42,26,.55)"; g.fillRect(70, 222, 372, 3);
});
