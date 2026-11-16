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

/** red Pilbara dirt: base wash, dry patches, pebbles, hairline cracks. Tileable enough at 12 m repeats. */
export const dirtTex = () => ctex("dirt", 512, 512, (g) => {
  g.fillStyle = "#b4552d"; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 2600; i++) {
    const x = rnd(i, 1) * 512, y = rnd(i, 2) * 512, r = 1 + rnd(i, 3) * 7;
    g.fillStyle = mixHex("#b4552d", rnd(i, 4) > 0.5 ? "#d18752" : "#7d3418", 0.18 + 0.5 * rnd(i, 5));
    g.beginPath(); g.ellipse(x, y, r, r * (0.5 + 0.8 * rnd(i, 6)), rnd(i, 7) * 3, 0, Math.PI * 2); g.fill();
  }
  for (let i = 0; i < 42; i++) {
    const x = rnd(i, 11) * 512, y = rnd(i, 12) * 512, r = 18 + rnd(i, 13) * 70;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, "rgba(226,160,100,.18)"); gr.addColorStop(1, "rgba(226,160,100,0)");
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  g.strokeStyle = "rgba(86,36,18,.42)"; g.lineWidth = 1.1;
  for (let i = 0; i < 26; i++) {
    let x = rnd(i, 21) * 512, y = rnd(i, 22) * 512;
    g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 5; k++) { x += (rnd(i * 9 + k, 23) - 0.5) * 42; y += (rnd(i * 9 + k, 24) - 0.5) * 42; g.lineTo(x, y); }
    g.stroke();
  }
});

/** one clump of ripe wheat: 6 curved stalks with seed heads, transparent background, ink outline. */
export const wheatTex = () => ctex("wheat", 128, 256, (g) => {
  g.clearRect(0, 0, 128, 256);
  const stalks = [
    [64, 252, 55, 120, 48, 40, -0.10],
    [66, 252, 66, 110, 62, 26, 0.02],
    [62, 252, 76, 128, 82, 48, 0.12],
    [65, 252, 46, 140, 34, 62, -0.16],
    [67, 252, 86, 148, 96, 70, 0.18],
    [64, 252, 60, 160, 56, 92, -0.04],
  ] as const;
  for (const [x0, y0, cx, cy, x1, y1, lean] of stalks) {
    const pts: [number, number][] = [];
    for (let i = 0; i <= 18; i++) {
      const t = i / 18, s = 1 - t;
      pts.push([s * s * x0 + 2 * s * t * cx + t * t * (x1 + lean * 90), s * s * y0 + 2 * s * t * cy + t * t * y1]);
    }
    g.lineCap = "round";
    g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.strokeStyle = "#3a2a16"; g.lineWidth = 5.5; g.stroke();
    g.strokeStyle = "#c99a44"; g.lineWidth = 3.2; g.stroke();
    // seed head: small chevrons either side of the top 26 px
    const [hx, hy] = pts[pts.length - 1];
    g.strokeStyle = "#3a2a16"; g.lineWidth = 3.6;
    for (let k = 0; k < 5; k++) {
      const yy = hy + 10 + k * 8;
      const w = 7 - k * 0.7;
      g.beginPath(); g.moveTo(hx - w, yy); g.lineTo(hx, yy - 3); g.lineTo(hx + w, yy); g.stroke();
    }
    g.fillStyle = "#e8b84b";
    g.beginPath(); g.ellipse(hx, hy + 20, 4.5, 16, lean * 1.4, 0, Math.PI * 2); g.fill();
    g.strokeStyle = "#5b431f"; g.lineWidth = 1.2; g.stroke();
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

/** toy relief map of Australia for S01: sea paper, coast ink, relief washes, a few state lines and a "1932" stamp. */
export const mapTex = () => ctex("australia", 1024, 640, (g) => {
  g.fillStyle = "#d9e6e2"; g.fillRect(0, 0, 1024, 640);
  for (let i = 0; i < 1200; i++) {
    g.fillStyle = rnd(i, 51) > 0.5 ? "rgba(90,130,140,.08)" : "rgba(255,255,255,.10)";
    g.fillRect(rnd(i, 52) * 1024, rnd(i, 53) * 640, 2, 2);
  }
  // graticule
  g.strokeStyle = "rgba(72,104,112,.20)"; g.lineWidth = 1;
  for (let x = 64; x < 1024; x += 64) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 640); g.stroke(); }
  for (let y = 52; y < 640; y += 52) { g.beginPath(); g.moveTo(0, y); g.lineTo(1024, y); g.stroke(); }
  // Australia, roughly geographic, with Tasmania
  const au: [number, number][] = [
    [188, 268], [156, 222], [166, 168], [214, 130], [282, 112], [352, 96], [420, 92], [482, 74],
    [548, 82], [608, 64], [672, 86], [736, 82], [800, 118], [854, 162], [874, 214], [862, 272],
    [826, 318], [790, 372], [742, 410], [690, 444], [634, 466], [574, 476], [522, 470], [462, 444],
    [404, 428], [348, 402], [292, 368], [242, 322], [206, 296],
  ];
  const path = (pts: [number, number][]) => { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); };
  path(au);
  g.fillStyle = "#d8b06a"; g.fill();
  g.save(); g.clip();
  // interior desert washes
  const relief: [number, number, number, string][] = [
    [470, 280, 250, "rgba(196,96,54,.55)"], [610, 250, 190, "rgba(190,108,62,.45)"],
    [380, 340, 170, "rgba(206,138,78,.42)"], [700, 340, 150, "rgba(150,128,78,.32)"],
    [300, 180, 170, "rgba(120,140,86,.30)"], [820, 190, 110, "rgba(120,140,86,.30)"],
  ];
  for (const [x, y, r, c] of relief) { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, c); gr.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
  // coast shading
  g.strokeStyle = "rgba(246,232,198,.75)"; g.lineWidth = 12; g.stroke();
  g.restore();
  path(au); g.strokeStyle = "#3b2a22"; g.lineWidth = 5; g.lineJoin = "round"; g.stroke();
  // state lines
  g.strokeStyle = "rgba(70,48,36,.45)"; g.lineWidth = 2;
  for (const [x0, y0, x1, y1] of [[430, 96, 430, 460], [700, 84, 690, 444], [430, 300, 690, 300], [242, 322, 430, 300]] as const) {
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
  }
  // Tasmania
  g.beginPath(); g.ellipse(632, 536, 34, 22, -0.2, 0, Math.PI * 2); g.fillStyle = "#d8b06a"; g.fill();
  g.strokeStyle = "#3b2a22"; g.lineWidth = 4; g.stroke();
  // labels (diegetic map printing)
  g.fillStyle = "#4a3529"; g.textAlign = "center";
  g.font = "700 30px Georgia, serif"; g.fillText("AUSTRALIA", 512, 576);
  g.font = "600 18px Georgia, serif"; g.fillText("WESTERN AUSTRALIA", 318, 268);
  g.fillText("NORTHERN TERRITORY", 545, 218);
  g.fillText("SOUTH AUSTRALIA", 545, 352);
  g.fillText("QUEENSLAND", 760, 212);
  g.fillText("NEW SOUTH WALES", 748, 352);
  g.fillText("VICTORIA", 700, 418);
  // sea decorative lines + compass
  g.strokeStyle = "rgba(72,104,112,.35)"; g.lineWidth = 1.4;
  for (let i = 0; i < 8; i++) {
    g.beginPath(); g.arc(886, 96, 18 + i * 7, 0.2, 1.5); g.stroke();
  }
  g.fillStyle = "#4a3529"; g.font = "700 22px Georgia, serif"; g.fillText("N", 886, 44);
  g.beginPath(); g.moveTo(886, 52); g.lineTo(878, 78); g.lineTo(894, 78); g.closePath(); g.fill();
  // "1932" rubber stamp, slightly off-axis
  g.save(); g.translate(852, 540); g.rotate(-0.08);
  g.strokeStyle = "rgba(122,54,40,.6)"; g.lineWidth = 4; g.strokeRect(-60, -26, 120, 52);
  g.fillStyle = "rgba(122,54,40,.65)"; g.font = "700 28px Courier New, monospace"; g.fillText("1932", 0, 10);
  g.restore();
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

/** stencilled ammo crate face. */
export const crateTex = (label: string) => ctex(`crate|${label}`, 512, 256, (g) => {
  g.fillStyle = "#7d613d"; g.fillRect(0, 0, 512, 256);
  for (let y = 0; y < 256; y += 64) {
    g.fillStyle = ["#7d613d", "#876a43", "#745835"][(y / 64) % 3]; g.fillRect(0, y, 512, 64);
    g.strokeStyle = "rgba(52,36,22,.6)"; g.lineWidth = 2; g.beginPath(); g.moveTo(0, y); g.lineTo(512, y); g.stroke();
  }
  g.strokeStyle = "#4a3420"; g.lineWidth = 14; g.strokeRect(7, 7, 498, 242);
  g.fillStyle = "#d7cdb2"; g.textAlign = "center";
  g.font = "700 58px Courier New, monospace"; g.fillText(label, 256, 128);
  g.font = "700 28px Courier New, monospace"; g.fillText("SMALL ARMS AMMUNITION", 256, 178);
  g.fillStyle = "rgba(60,42,26,.55)"; g.fillRect(70, 196, 372, 4);
});
