// Mundo: mapas, colisores (caixas orientadas + terreno), portões, céu e vegetação.
// Mapas refeitos a partir das telas do FPV.SkyDive (Abandoned Factory, Stadium, Red Canyon).
import * as THREE from 'three';
import { PHOTO, TERRAIN, photoMaterial, terrainMaterial } from './photo.js';
import { GrassField, grassData, Forest, WIND } from './vegetation.js';
import { buildTrain } from './train.js';
import { Kit } from './kit.js';
import { Fn, uniform, vec2, vec3, float, positionLocal, normalize, mix, pow, clamp as tclamp, max, dot, smoothstep, floor, fract, sin, step, abs, If, Loop } from 'three/tsl';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
function rng(seed) { let s = seed % 2147483647; if (s <= 0) s += 2147483646; return () => (s = (s * 16807) % 2147483647) / 2147483647; }

// ---------- ruído para terreno ----------
function hash(x, y) { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); }
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, y, o = 5) { let s = 0, a = 0.5, f = 1; for (let i = 0; i < o; i++) { s += a * vnoise(x * f, y * f); f *= 2; a *= 0.5; } return s; }

// =====================================================================
// Texturas procedurais
// =====================================================================
function canvasTex(w, h, draw, opts = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (opts.srgb !== false) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
function speckle(g, w, h, n, colors, size = [1, 3], alpha = [0.05, 0.25]) {
  for (let i = 0; i < n; i++) {
    const c = colors[(Math.random() * colors.length) | 0];
    g.globalAlpha = alpha[0] + Math.random() * (alpha[1] - alpha[0]);
    g.fillStyle = c;
    const s = size[0] + Math.random() * (size[1] - size[0]);
    g.fillRect(Math.random() * w, Math.random() * h, s, s);
  }
  g.globalAlpha = 1;
}
function blotches(g, w, h, n, color, r = [10, 60], alpha = [0.04, 0.12]) {
  for (let i = 0; i < n; i++) {
    const x = Math.random() * w, y = Math.random() * h, rr = r[0] + Math.random() * (r[1] - r[0]);
    const gr = g.createRadialGradient(x, y, 0, x, y, rr);
    gr.addColorStop(0, color); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.globalAlpha = alpha[0] + Math.random() * (alpha[1] - alpha[0]);
    g.fillStyle = gr; g.fillRect(x - rr, y - rr, rr * 2, rr * 2);
    // repete nas bordas para a textura emendar
    for (const [dx, dy] of [[w, 0], [-w, 0], [0, h], [0, -h]]) { g.save(); g.translate(dx, dy); g.fillRect(x - rr, y - rr, rr * 2, rr * 2); g.restore(); }
  }
  g.globalAlpha = 1;
}
function drawBricks(g, x0, y0, w, h, bw, bh, rnd = Math.random) {
  g.fillStyle = '#6e6257'; g.fillRect(x0, y0, w, h);
  for (let y = y0, row = 0; y < y0 + h; y += bh, row++) {
    for (let x = x0 - (row % 2 ? bw / 2 : 0); x < x0 + w; x += bw) {
      const base = 0.75 + rnd() * 0.35;
      const r = 128 * base + rnd() * 20, gg = 62 * base + rnd() * 12, b = 44 * base + rnd() * 10;
      g.fillStyle = `rgb(${r | 0},${gg | 0},${b | 0})`;
      g.fillRect(Math.max(x0, x + 1), y + 1, Math.min(bw - 2, x0 + w - x - 1), bh - 2);
      if (rnd() < 0.15) { g.fillStyle = 'rgba(30,20,15,0.35)'; g.fillRect(x + 2, y + 2, bw * 0.4, bh - 4); }
    }
  }
}

const TEX = {};
function tex(name) {
  if (TEX[name]) return TEX[name];
  const T = {
    grass: () => canvasTex(512, 512, (g, w, h) => {
      g.fillStyle = '#4d6a2c'; g.fillRect(0, 0, w, h);
      blotches(g, w, h, 40, '#6b7d34', [30, 90], [0.15, 0.35]);
      blotches(g, w, h, 30, '#33501f', [20, 70], [0.15, 0.3]);
      for (let i = 0; i < 26000; i++) {
        const x = Math.random() * w, y = Math.random() * h, l = 3 + Math.random() * 7;
        const c = Math.random();
        g.strokeStyle = c < 0.4 ? '#3c5a22' : c < 0.75 ? '#5f7f34' : c < 0.93 ? '#7e8f45' : '#8a7f4c';
        g.globalAlpha = 0.5 + Math.random() * 0.5; g.lineWidth = 1;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + (Math.random() - 0.5) * 3, y - l); g.stroke();
      }
      g.globalAlpha = 1;
    }),
    asphalt: () => canvasTex(512, 512, (g, w, h) => {
      g.fillStyle = '#3a3b3c'; g.fillRect(0, 0, w, h);
      speckle(g, w, h, 30000, ['#222', '#555', '#4a4a48', '#2c2c2c'], [1, 2.5], [0.2, 0.6]);
      blotches(g, w, h, 18, '#1d1d1d', [15, 60], [0.15, 0.35]);
      blotches(g, w, h, 10, '#58584f', [20, 70], [0.08, 0.16]);
      g.strokeStyle = 'rgba(15,15,15,0.7)'; g.lineWidth = 1.5;
      for (let k = 0; k < 7; k++) { g.beginPath(); let x = Math.random() * w, y = Math.random() * h; g.moveTo(x, y); for (let j = 0; j < 14; j++) { x += (Math.random() - 0.5) * 30; y += (Math.random() - 0.5) * 30; g.lineTo(x, y); } g.stroke(); }
      // capim nas rachaduras
      speckle(g, w, h, 300, ['#4b6b2a', '#5f7f34'], [1, 3], [0.4, 0.8]);
    }),
    concrete: () => canvasTex(512, 512, (g, w, h) => {
      g.fillStyle = '#8b8a84'; g.fillRect(0, 0, w, h);
      speckle(g, w, h, 20000, ['#6e6d68', '#a3a29b', '#7c7b75'], [1, 3], [0.15, 0.4]);
      blotches(g, w, h, 20, '#4f4c45', [20, 80], [0.08, 0.2]);
      g.strokeStyle = 'rgba(40,40,40,0.4)'; g.lineWidth = 2;
      for (let i = 0; i <= 2; i++) { g.beginPath(); g.moveTo(0, (i * h) / 2); g.lineTo(w, (i * h) / 2); g.stroke(); }
    }),
    brick: () => canvasTex(512, 512, (g, w, h) => {
      drawBricks(g, 0, 0, w, h, 64, 21);
      blotches(g, w, h, 25, '#2b2018', [20, 90], [0.1, 0.25]);
      blotches(g, w, h, 10, '#cfc7b8', [10, 40], [0.05, 0.12]);
    }),
    // vão de fachada com janelão industrial (6 m x 9 m)
    bay: () => canvasTex(512, 768, (g, w, h) => {
      drawBricks(g, 0, 0, w, h, 52, 18);
      const wx0 = w * 0.18, wx1 = w * 0.82, wy0 = h * 0.12, wy1 = h * 0.72;
      // arco de tijolos
      g.fillStyle = '#5c2f22'; g.beginPath(); g.ellipse((wx0 + wx1) / 2, wy0 + 6, (wx1 - wx0) / 2 + 14, 40, 0, Math.PI, 0); g.fill();
      // vidros
      const cols = 6, rows = 9, pw = (wx1 - wx0) / cols, ph = (wy1 - wy0) / rows;
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const k = Math.random();
        const v = k < 0.22 ? 12 : k < 0.6 ? 34 + Math.random() * 20 : 70 + Math.random() * 40; // quebrado / sujo / reflexo
        g.fillStyle = `rgb(${v * 0.9 | 0},${v | 0},${v * 1.05 | 0})`;
        g.fillRect(wx0 + c * pw, wy0 + r * ph, pw, ph);
        if (k > 0.85) { g.fillStyle = 'rgba(200,210,220,0.25)'; g.beginPath(); g.moveTo(wx0 + c * pw, wy0 + r * ph + ph); g.lineTo(wx0 + c * pw + pw, wy0 + r * ph); g.lineTo(wx0 + c * pw + pw, wy0 + r * ph + ph * 0.4); g.fill(); }
      }
      g.strokeStyle = '#1c1c1c'; g.lineWidth = 4;
      for (let c = 0; c <= cols; c++) { g.beginPath(); g.moveTo(wx0 + c * pw, wy0); g.lineTo(wx0 + c * pw, wy1); g.stroke(); }
      for (let r = 0; r <= rows; r++) { g.beginPath(); g.moveTo(wx0, wy0 + r * ph); g.lineTo(wx1, wy0 + r * ph); g.stroke(); }
      g.fillStyle = '#7d7468'; g.fillRect(wx0 - 8, wy1, wx1 - wx0 + 16, 10); // peitoril
      // sujeira escorrida
      const gr = g.createLinearGradient(0, h * 0.7, 0, h);
      gr.addColorStop(0, 'rgba(20,15,10,0)'); gr.addColorStop(1, 'rgba(20,15,10,0.45)');
      g.fillStyle = gr; g.fillRect(0, h * 0.7, w, h * 0.3);
      for (let i = 0; i < 12; i++) { g.fillStyle = 'rgba(25,20,15,0.18)'; g.fillRect(Math.random() * w, wy1 + 10, 4 + Math.random() * 10, 60 + Math.random() * 120); }
    }),
    roof: () => canvasTex(512, 512, (g, w, h) => {
      for (let x = 0; x < w; x += 16) {
        const gr = g.createLinearGradient(x, 0, x + 16, 0);
        gr.addColorStop(0, '#6c7177'); gr.addColorStop(0.5, '#9aa0a4'); gr.addColorStop(1, '#5d6268');
        g.fillStyle = gr; g.fillRect(x, 0, 16, h);
      }
      blotches(g, w, h, 30, '#7a4a28', [10, 50], [0.15, 0.4]);
      blotches(g, w, h, 20, '#3c4a2a', [10, 40], [0.1, 0.25]);
      for (let i = 0; i < 40; i++) { g.fillStyle = 'rgba(110,60,30,0.25)'; g.fillRect(Math.random() * w, Math.random() * h, 3, 30 + Math.random() * 80); }
      g.fillStyle = 'rgba(0,0,0,0.35)'; for (let y = 0; y < h; y += 128) g.fillRect(0, y, w, 3);
    }),
    rust: () => canvasTex(256, 256, (g, w, h) => {
      g.fillStyle = '#7a2a1e'; g.fillRect(0, 0, w, h);
      for (let x = 0; x < w; x += 16) { g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x, 0, 4, h); g.fillStyle = 'rgba(255,255,255,0.06)'; g.fillRect(x + 5, 0, 3, h); }
      blotches(g, w, h, 25, '#4a2416', [10, 40], [0.2, 0.5]);
      blotches(g, w, h, 15, '#a35a2c', [10, 30], [0.2, 0.4]);
    }),
    metal: () => canvasTex(256, 256, (g, w, h) => {
      g.fillStyle = '#5f646a'; g.fillRect(0, 0, w, h);
      speckle(g, w, h, 4000, ['#444', '#777', '#6b4a30'], [1, 3], [0.1, 0.3]);
      blotches(g, w, h, 12, '#6b3b1e', [8, 30], [0.2, 0.4]);
    }),
    wood: () => canvasTex(128, 128, (g, w, h) => {
      g.fillStyle = '#3f2f22'; g.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 3) { g.fillStyle = `rgba(${20 + Math.random() * 40},${15 + Math.random() * 20},10,0.4)`; g.fillRect(0, y, w, 1); }
    }),
    gravel: () => canvasTex(256, 256, (g, w, h) => {
      g.fillStyle = '#5a5248'; g.fillRect(0, 0, w, h);
      speckle(g, w, h, 9000, ['#3a332c', '#7a7065', '#6b5a48', '#2a2622'], [1.5, 4], [0.4, 0.9]);
    }),
    fence: () => canvasTex(128, 128, (g, w, h) => {
      g.clearRect(0, 0, w, h);
      g.strokeStyle = 'rgba(40,42,44,1)'; g.lineWidth = 2.2;
      for (let i = -w; i < w * 2; i += 16) {
        g.beginPath(); g.moveTo(i, 0); g.lineTo(i + h, h); g.stroke();
        g.beginPath(); g.moveTo(i, h); g.lineTo(i + h, 0); g.stroke();
      }
    }),
    grassClump: () => canvasTex(256, 256, (g, w, h) => {
      g.clearRect(0, 0, w, h);
      for (let i = 0; i < 70; i++) {
        const x = w * 0.1 + Math.random() * w * 0.8, bend = (Math.random() - 0.5) * 70, top = h * (0.05 + Math.random() * 0.45);
        const c = Math.random();
        g.fillStyle = c < 0.35 ? '#56702c' : c < 0.7 ? '#6f8236' : c < 0.9 ? '#8c8a48' : '#a39257';
        g.beginPath(); g.moveTo(x - 3, h); g.quadraticCurveTo(x + bend * 0.3, (h + top) / 2, x + bend, top); g.quadraticCurveTo(x + bend * 0.3 + 2, (h + top) / 2, x + 3, h); g.fill();
      }
    }),
    conifer: () => canvasTex(256, 512, (g, w, h) => {
      g.clearRect(0, 0, w, h);
      g.fillStyle = '#3b2a1e'; g.fillRect(w / 2 - 5, h * 0.75, 10, h * 0.25);
      for (let i = 0; i < 110; i++) {
        const t = i / 110, y = h * (0.03 + t * 0.8), half = w * (0.08 + Math.pow(t, 0.8) * 0.42) * (0.8 + Math.random() * 0.25);
        const c = 26 + Math.random() * 22;
        g.fillStyle = `rgb(${c * 0.75 | 0},${c * 1.45 + 10 | 0},${c * 0.9 | 0})`;
        g.beginPath(); g.moveTo(w / 2, y - 18);
        for (let k = 0; k <= 8; k++) { const xx = w / 2 - half + (k / 8) * half * 2; g.lineTo(xx, y + (k % 2 ? 4 : 14) + Math.random() * 6); }
        g.closePath(); g.fill();
      }
    }),
    broadleaf: () => canvasTex(512, 512, (g, w, h) => {
      g.clearRect(0, 0, w, h);
      g.strokeStyle = '#3d3024'; g.lineWidth = 12; g.beginPath(); g.moveTo(w / 2, h); g.lineTo(w / 2, h * 0.5); g.stroke();
      g.lineWidth = 5; for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(w / 2, h * (0.55 + i * 0.05)); g.lineTo(w / 2 + (i % 2 ? 1 : -1) * 90, h * (0.35 + i * 0.04)); g.stroke(); }
      for (let i = 0; i < 900; i++) {
        const ang = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random());
        const x = w / 2 + Math.cos(ang) * r * w * 0.44, y = h * 0.4 + Math.sin(ang) * r * h * 0.34;
        const c = Math.random();
        g.fillStyle = c < 0.4 ? '#2f4a1f' : c < 0.75 ? '#41632a' : c < 0.93 ? '#58793a' : '#6e8a48';
        g.beginPath(); g.arc(x, y, 5 + Math.random() * 9, 0, Math.PI * 2); g.fill();
      }
    }),
    apartments: () => canvasTex(256, 256, (g, w, h) => {
      g.fillStyle = '#b9b7ae'; g.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 32) for (let x = 0; x < w; x += 32) {
        g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(x, y, 32, 1); g.fillRect(x, y, 1, 32);
        const v = 30 + Math.random() * 50; g.fillStyle = `rgb(${v},${v + 4},${v + 8})`; g.fillRect(x + 9, y + 9, 14, 15);
      }
      blotches(g, w, h, 10, '#6b6658', [10, 40], [0.1, 0.25]);
    }),
    field: () => canvasTex(2048, 1366, (g, w, h) => {
      // campo de futebol oficial: 105 m x 68 m, com 3 m de grama em volta (textura cobre 111 m x 74 m)
      const k = w / 111;
      g.fillStyle = '#44822f'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 20; i++) { g.fillStyle = i % 2 ? '#3d7a2a' : '#4b8c34'; g.fillRect(Math.floor((3 + i * 5.25) * k), 0, Math.ceil(5.25 * k) + 1, h); }
      speckle(g, w, h, 70000, ['#2f5f22', '#5a9a3e'], [1, 3], [0.1, 0.3]);
      g.save(); g.scale(k, k); g.translate(3, 3);
      g.strokeStyle = '#f4f4f0'; g.fillStyle = '#f4f4f0'; g.lineWidth = 0.16;
      const L = 105, W = 68, c = W / 2, R = 9.15;
      const line = (x0, y0, x1, y1) => { g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); };
      const arc = (x, y, r, a0, a1) => { g.beginPath(); g.arc(x, y, r, a0, a1); g.stroke(); };
      const dot = (x, y, r) => { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); };
      g.strokeRect(0, 0, L, W);
      line(L / 2, 0, L / 2, W); arc(L / 2, c, R, 0, Math.PI * 2); dot(L / 2, c, 0.25);
      for (const side of [0, 1]) {
        const X = (x) => (side ? L - x : x);
        // grande área (16,5 m) e pequena área (5,5 m)
        g.beginPath(); g.moveTo(X(0), c - 20.16); g.lineTo(X(16.5), c - 20.16); g.lineTo(X(16.5), c + 20.16); g.lineTo(X(0), c + 20.16); g.stroke();
        g.beginPath(); g.moveTo(X(0), c - 9.16); g.lineTo(X(5.5), c - 9.16); g.lineTo(X(5.5), c + 9.16); g.lineTo(X(0), c + 9.16); g.stroke();
        // marca do pênalti e meia-lua
        dot(X(11), c, 0.22);
        const t = Math.acos(5.5 / R);
        if (side) arc(X(11), c, R, Math.PI - t, Math.PI + t); else arc(X(11), c, R, -t, t);
        // linha do gol mais grossa
        g.lineWidth = 0.24; line(X(0), c - 3.66, X(0), c + 3.66); g.lineWidth = 0.16;
      }
      // escanteios
      arc(0, 0, 1, 0, Math.PI / 2); arc(L, 0, 1, Math.PI / 2, Math.PI); arc(L, W, 1, Math.PI, Math.PI * 1.5); arc(0, W, 1, Math.PI * 1.5, Math.PI * 2);
      g.restore();
    }),
    adBoards: () => canvasTex(2048, 64, (g, w, h) => {
      const ads = [['#0a7a3a', '#ffd400', 'FPV SIM'], ['#ffd400', '#0a3a8a', 'ACADEMIA DE VOO'], ['#0a3a8a', '#ffffff', 'VOE COM SEGURANÇA'], ['#111111', '#3ee07a', 'MODO N · S · M']];
      const n = 8, sw = w / n;
      g.font = 'bold 34px Montserrat, Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
      for (let i = 0; i < n; i++) { const [bg, fg, t] = ads[i % ads.length]; g.fillStyle = bg; g.fillRect(i * sw, 0, sw + 1, h); g.fillStyle = fg; g.fillText(t, i * sw + sw / 2, h / 2 + 2, sw - 24); }
    }),
    goalNet: () => canvasTex(128, 128, (g, w, h) => {
      g.clearRect(0, 0, w, h); g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 3;
      for (let i = 0; i <= 8; i++) { const p = (i * w) / 8; g.beginPath(); g.moveTo(p, 0); g.lineTo(p, h); g.moveTo(0, p); g.lineTo(w, p); g.stroke(); }
    }),
    seatsRed: () => seatTex('#a5141d', '#d8343c'),
    seatsWhite: () => seatTex('#c9c9c4', '#f1f1ec'),
    gateBands: () => canvasTex(512, 16, (g, w, h) => {
      const n = 16;
      for (let i = 0; i < n; i++) { g.fillStyle = i % 2 ? '#e1232d' : '#f4f4f4'; g.fillRect((i * w) / n, 0, w / n + 1, h); }
    }),
  };
  TEX[name] = T[name]();
  TEX[name].userData.texName = name;
  return TEX[name];
}

// ---------- relevo (normal map) calculado a partir do claro/escuro da própria textura ----------
// força do relevo por textura (as que não estão aqui ficam lisas)
const RELIEF = { asphalt: 1.6, concrete: 1.4, gravel: 3, wood: 2.2, rust: 1.6, metal: 0.8, roof: 1.5, brick: 2.2, bay: 1.8, apartments: 1, grass: 1.2 };
const NORMALS = {};
function normalTex(name) {
  if (NORMALS[name]) return NORMALS[name];
  const src = tex(name).image, w = src.width, h = src.height;
  const d = src.getContext('2d').getImageData(0, 0, w, h).data;
  const L = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) L[i] = (d[i * 4] * 0.3 + d[i * 4 + 1] * 0.59 + d[i * 4 + 2] * 0.11) / 255;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'), out = g.createImageData(w, h), o = out.data;
  const k = 4;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const xl = (x - 1 + w) % w, xr = (x + 1) % w, yu = (y - 1 + h) % h, yd = (y + 1) % h;
    const dx = (L[y * w + xr] - L[y * w + xl]) * k, dy = (L[yd * w + x] - L[yu * w + x]) * k;
    const il = 1 / Math.hypot(dx, dy, 1), i = (y * w + x) * 4;
    o[i] = (-dx * il * 0.5 + 0.5) * 255; o[i + 1] = (dy * il * 0.5 + 0.5) * 255; o[i + 2] = (il * 0.5 + 0.5) * 255; o[i + 3] = 255;
  }
  g.putImageData(out, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; t.colorSpace = THREE.NoColorSpace;
  return (NORMALS[name] = t);
}
// troca as texturas desenhadas por fotos reais (photo.js) onde houver equivalente
function upgradeMaterials(root) {
  const swap = new Map();
  root.traverse((o) => {
    if (!o.isMesh || !o.material) return;
    const one = (m) => {
      if (!m || !m.isMeshStandardMaterial || m.isNodeMaterial || m.alphaTest > 0) return m;
      if (o.userData.terrain && TERRAIN[o.userData.terrain]) return terrainMaterial(TERRAIN[o.userData.terrain], m);
      const name = m.map && m.map.userData && m.map.userData.texName;
      if (!name || !PHOTO[name]) return m;
      if (!swap.has(m)) swap.set(m, photoMaterial(PHOTO[name], m));
      return swap.get(m);
    };
    o.material = Array.isArray(o.material) ? o.material.map(one) : one(o.material);
  });
}

// percorre o mapa pronto e dá relevo a todo material com textura conhecida
function addRelief(root) {
  const done = new Set();
  root.traverse((o) => {
    if (!o.material) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      if (done.has(m) || !m.isMeshStandardMaterial || !m.map || m.normalMap || m.alphaTest > 0) continue;
      done.add(m);
      const name = m.map.userData && m.map.userData.texName, s = RELIEF[name];
      if (!s) continue;
      const n = normalTex(name).clone();
      n.repeat.copy(m.map.repeat); n.offset.copy(m.map.offset); n.rotation = m.map.rotation; n.center.copy(m.map.center);
      n.needsUpdate = true;
      m.normalMap = n; m.normalScale.set(s, s);
      if (m.bumpMap) m.bumpMap = null;
      m.needsUpdate = true;
    }
  });
}
function seatTex(dark, light) {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#6d6c68'; g.fillRect(0, 0, w, h);
    for (let r = 0; r < 4; r++) {
      const y = r * 64;
      g.fillStyle = '#55544f'; g.fillRect(0, y + 50, w, 14);
      for (let x = 0; x < w; x += 16) {
        if (x === 128) { g.fillStyle = '#8a8983'; g.fillRect(x, y, 16, 64); continue; } // escada
        g.fillStyle = dark; g.fillRect(x + 2, y + 6, 12, 30);
        g.fillStyle = light; g.fillRect(x + 2, y + 6, 12, 6);
        g.fillStyle = dark; g.fillRect(x + 1, y + 36, 14, 12);
      }
    }
    speckle(g, w, h, 1500, ['#000', '#fff'], [1, 2], [0.03, 0.1]);
  });
}
function rep(t, x, y) { const c = t.clone(); c.needsUpdate = true; c.repeat.set(x, y); return c; }

// =====================================================================
// Mundo
// =====================================================================
// ---------- céu procedural (TSL: roda no WebGPU e no WebGL2) ----------
const h21 = Fn(([p]) => fract(sin(dot(p, vec2(127.1, 311.7))).mul(43758.5453)));
const vnoise2 = Fn(([p]) => {
  const i = floor(p), f = fract(p);
  const u = f.mul(f).mul(f.mul(-2).add(3));
  return mix(mix(h21(i), h21(i.add(vec2(1, 0))), u.x), mix(h21(i.add(vec2(0, 1))), h21(i.add(vec2(1, 1))), u.x), u.y);
});
const fbm6 = Fn(([p0]) => {
  const p = vec2(p0).toVar(), s = float(0).toVar(), a = float(0.5).toVar();
  Loop(6, () => { s.addAssign(a.mul(vnoise2(p))); p.assign(p.mul(2.03).add(vec2(17.1, 9.2))); a.mulAssign(0.5); });
  return s;
});
function skyMaterial(U) {
  const color = Fn(() => {
    const d = normalize(positionLocal).toVar();
    const y = d.y;
    const col = mix(U.horizon, U.zenith, pow(tclamp(y, 0, 1), 0.5)).toVar();
    const s = max(dot(d, U.sunDir), 0).toVar();
    const disc = smoothstep(float(0.9997).sub(U.sunSize.mul(0.0004)), float(0.99995).sub(U.sunSize.mul(0.0002)), s);
    col.addAssign(U.sunCol.mul(disc.mul(6).add(pow(s, 10).mul(0.18)).add(pow(s, 200).mul(0.6))));
    If(U.stars.greaterThan(0).and(y.greaterThan(0)), () => {
      const sp = floor(d.xz.div(y.add(0.3)).mul(260));
      col.addAssign(vec3(step(0.9975, h21(sp))).mul(U.stars).mul(smoothstep(0.05, 0.4, y)));
    });
    If(y.greaterThan(0), () => {
      const uv = d.xz.div(y.add(0.1)).mul(U.cloudScale).add(vec2(U.time.mul(0.004), U.time.mul(0.0015))).toVar();
      const c = fbm6(uv).toVar();
      const c2 = fbm6(uv.mul(2.3).add(5)).toVar();
      const dens = smoothstep(float(1).sub(U.cover).sub(0.35), float(1).sub(U.cover).add(0.35), c.mul(0.75).add(c2.mul(0.35)));
      const cc = mix(U.cloudShadow, U.cloudCol, smoothstep(0.2, 0.9, c2.add(c.sub(0.5).mul(0.4)))).toVar();
      cc.addAssign(U.sunCol.mul(pow(s, 6)).mul(0.35).mul(float(1).sub(dens.mul(0.5))));
      col.assign(mix(col, cc, dens.mul(smoothstep(0, 0.2, y))));
    }).Else(() => {
      col.assign(mix(U.horizon, U.groundCol, tclamp(y.negate().mul(5), 0, 1)));
    });
    col.assign(mix(col, U.horizon, float(1).sub(smoothstep(0, 0.1, abs(y))).mul(0.6)));
    return col;
  });
  const m = new THREE.MeshBasicNodeMaterial({ side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false });
  m.colorNode = color();
  return m;
}

export class World {
  constructor(scene, renderer) {
    this.scene = scene;
    this.renderer = renderer;
    this.root = new THREE.Group();
    scene.add(this.root);
    this.boxes = [];
    this.gates = [];
    this.heightFn = () => 0;
    this.grid = null;
    this.bounds = 400;
    this.mats = {};
    this.geoBox = new THREE.BoxGeometry(1, 1, 1);
    this.cellSize = 16;
    this.cells = null;
    this.stamp = 0;
  }

  mat(key, make) { return this.mats[key] || (this.mats[key] = make()); }

  clear() {
    this.scene.remove(this.root);
    this.root.traverse((o) => { if (o.geometry && o.geometry !== this.geoBox) o.geometry.dispose(); });
    if (this.envRT) { this.envRT.dispose(); this.envRT = null; }
    this.root = new THREE.Group();
    this.scene.add(this.root);
    this.boxes = [];
    this.cells = null;
    this.gates = [];
    this.heightFn = () => 0;
    this.grid = null;
    this.sun = null;
    this.sky = null;
    this.grassFields = [];
    this.forests = [];
  }

  // Caixa sólida (visual + colisor). y = base da caixa.
  box(x, y, z, sx, sy, sz, material, yaw = 0, opts = {}) {
    const m = new THREE.Mesh(this.geoBox, material);
    m.scale.set(sx, sy, sz);
    m.position.set(x, y + sy / 2, z);
    m.rotation.y = yaw;
    m.castShadow = opts.shadow !== false; m.receiveShadow = true;
    if (opts.uv) this.scaleUV(m, sx, sy, sz, opts.uv, opts.uvv || opts.uv);
    (opts.parent || this.root).add(m);
    if (opts.collide !== false) this.addCollider(x, y + sy / 2, z, sx / 2, sy / 2, sz / 2, yaw);
    return m;
  }
  // UV em metros: uma repetição a cada ku metros (horizontal) e kv (vertical)
  scaleUV(mesh, sx, sy, sz, ku, kv) {
    const g = this.geoBox.clone();
    const uv = g.attributes.uv;
    const dims = [[sz, sy, 1], [sz, sy, 1], [sx, sz, 0], [sx, sz, 0], [sx, sy, 1], [sx, sy, 1]];
    for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) {
      const i = f * 4 + v;
      uv.setXY(i, uv.getX(i) * dims[f][0] / ku, uv.getY(i) * dims[f][1] / (dims[f][2] ? kv : ku));
    }
    mesh.geometry = g;
  }
  addCollider(cx, cy, cz, hx, hy, hz, yaw = 0) {
    this.boxes.push({ c: [cx, cy, cz], h: [hx, hy, hz], cos: Math.cos(yaw), sin: Math.sin(yaw), rad: Math.hypot(hx, hy, hz), s: 0 });
    this.cells = null;
  }
  cylinder(x, y, z, r, h, material, seg = 16, rTop = r) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, r, h, seg), material);
    m.position.set(x, y + h / 2, z); m.castShadow = true; m.receiveShadow = true;
    this.root.add(m);
    this.addCollider(x, y + h / 2, z, (r + rTop) * 0.43, h / 2, (r + rTop) * 0.43, 0);
    this.addCollider(x, y + h / 2, z, (r + rTop) * 0.43, h / 2, (r + rTop) * 0.43, Math.PI / 4);
    return m;
  }
  mesh(geo, mat, x = 0, y = 0, z = 0, opts = {}) {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z);
    m.castShadow = opts.shadow !== false; m.receiveShadow = true;
    (opts.parent || this.root).add(m); return m;
  }

  // grade espacial para colisão rápida (milhares de árvores)
  buildCells() {
    const C = this.cellSize, cells = new Map();
    for (const b of this.boxes) {
      const r = b.rad;
      const x0 = Math.floor((b.c[0] - r) / C), x1 = Math.floor((b.c[0] + r) / C);
      const z0 = Math.floor((b.c[2] - r) / C), z1 = Math.floor((b.c[2] + r) / C);
      for (let i = x0; i <= x1; i++) for (let j = z0; j <= z1; j++) {
        const k = i * 65536 + j;
        let arr = cells.get(k); if (!arr) cells.set(k, (arr = []));
        arr.push(b);
      }
    }
    this.cells = cells;
  }

  // ---------- terreno ----------
  terrain(size, res, fn, colorFn, texture, texRepeat) {
    const n = res + 1, step = size / res, half = size / 2;
    const heights = new Float32Array(n * n);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) heights[j * n + i] = fn(-half + i * step, -half + j * step);
    this.grid = { n, step, half, heights };
    const pos = new Float32Array(n * n * 3), col = new Float32Array(n * n * 3), uv = new Float32Array(n * n * 2);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const k = j * n + i, x = -half + i * step, z = -half + j * step, y = heights[k];
      pos.set([x, y, z], k * 3);
      uv.set([(i / res) * texRepeat, (j / res) * texRepeat], k * 2);
      col.set(colorFn(x, y, z, this.slopeAt(i, j)), k * 3);
    }
    const idx = [];
    for (let j = 0; j < res; j++) for (let i = 0; i < res; i++) {
      const a = j * n + i, b = a + 1, c = a + n, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: texture, vertexColors: true, roughness: 0.97 }));
    m.receiveShadow = true;
    m.userData.terrain = texture.userData && texture.userData.texName;
    this.root.add(m);
    this.heightFn = (x, z) => this.gridHeight(x, z);
    return m;
  }
  slopeAt(i, j) {
    const { n, step, heights } = this.grid;
    const h = (a, b) => heights[clamp(b, 0, n - 1) * n + clamp(a, 0, n - 1)];
    const dx = (h(i + 1, j) - h(i - 1, j)) / (2 * step), dz = (h(i, j + 1) - h(i, j - 1)) / (2 * step);
    return Math.hypot(dx, dz);
  }
  gridHeight(x, z) {
    const { n, step, half, heights } = this.grid;
    const fx = (x + half) / step, fz = (z + half) / step;
    const i = clamp(Math.floor(fx), 0, n - 2), j = clamp(Math.floor(fz), 0, n - 2);
    const u = clamp(fx - i, 0, 1), v = clamp(fz - j, 0, 1);
    const a = heights[j * n + i], b = heights[j * n + i + 1], c = heights[(j + 1) * n + i], d = heights[(j + 1) * n + i + 1];
    if (u + v <= 1) return a + (b - a) * u + (c - a) * v;
    return d + (c - d) * (1 - u) + (b - d) * (1 - v);
  }
  groundHeight(x, z) { return this.heightFn(x, z); }

  // ---------- colisão: esfera contra chão + caixas ----------
  collide(p, r) {
    const out = [];
    const gh = this.heightFn(p[0], p[2]);
    if (p[1] - r < gh) {
      const e = 0.5;
      const nx = this.heightFn(p[0] - e, p[2]) - this.heightFn(p[0] + e, p[2]);
      const nz = this.heightFn(p[0], p[2] - e) - this.heightFn(p[0], p[2] + e);
      const l = Math.hypot(nx, 2 * e, nz);
      const n = [nx / l, (2 * e) / l, nz / l];
      out.push({ n, depth: (gh + r - p[1]) * n[1] });
    }
    if (!this.cells) this.buildCells();
    const C = this.cellSize, stamp = ++this.stamp;
    const x0 = Math.floor((p[0] - r) / C), x1 = Math.floor((p[0] + r) / C);
    const z0 = Math.floor((p[2] - r) / C), z1 = Math.floor((p[2] + r) / C);
    for (let ci = x0; ci <= x1; ci++) for (let cj = z0; cj <= z1; cj++) {
      const list = this.cells.get(ci * 65536 + cj); if (!list) continue;
      for (const b of list) {
        if (b.s === stamp) continue; b.s = stamp;
        const dx = p[0] - b.c[0], dy = p[1] - b.c[1], dz = p[2] - b.c[2];
        if (dx * dx + dy * dy + dz * dz > (b.rad + r) * (b.rad + r)) continue;
        const lx = dx * b.cos - dz * b.sin, lz = dx * b.sin + dz * b.cos, ly = dy;
        const cx = clamp(lx, -b.h[0], b.h[0]), cy = clamp(ly, -b.h[1], b.h[1]), cz = clamp(lz, -b.h[2], b.h[2]);
        let ox = lx - cx, oy = ly - cy, oz = lz - cz;
        const d = Math.hypot(ox, oy, oz); let depth;
        if (d > r) continue;
        if (d > 1e-6) { ox /= d; oy /= d; oz /= d; depth = r - d; }
        else {
          const px = b.h[0] - Math.abs(lx), py = b.h[1] - Math.abs(ly), pz = b.h[2] - Math.abs(lz);
          if (px < py && px < pz) { ox = Math.sign(lx) || 1; oy = 0; oz = 0; depth = px + r; }
          else if (py < pz) { ox = 0; oy = Math.sign(ly) || 1; oz = 0; depth = py + r; }
          else { ox = 0; oy = 0; oz = Math.sign(lz) || 1; depth = pz + r; }
        }
        out.push({ n: [ox * b.cos + oz * b.sin, oy, -ox * b.sin + oz * b.cos], depth });
      }
    }
    const B = this.bounds;
    for (const k of [0, 2]) {
      if (p[k] > B) out.push({ n: k === 0 ? [-1, 0, 0] : [0, 0, -1], depth: p[k] - B });
      if (p[k] < -B) out.push({ n: k === 0 ? [1, 0, 0] : [0, 0, 1], depth: -B - p[k] });
    }
    if (p[1] > 260) out.push({ n: [0, -1, 0], depth: p[1] - 260 });
    return out;
  }

  // ---------- portões (arcos branco/vermelho numerados, como no original) ----------
  addGate(def) {
    const w = def.w || 3.2, h = def.h || 2.4, R = 0.11;
    const gy = this.heightFn(def.x, def.z);
    const base = gy + (def.y || 0);
    const yaw = def.yaw || 0;
    const group = new THREE.Group();
    group.position.set(def.x, 0, def.z);
    group.rotation.y = yaw;
    const bandMat = this.mat('gateBand', () => new THREE.MeshStandardMaterial({ map: tex('gateBands'), roughness: 0.45, metalness: 0.05 }));
    const legMat = this.mat('gateLeg', () => new THREE.MeshStandardMaterial({ color: 0x2a2b2e, roughness: 0.6, metalness: 0.5 }));
    // moldura: retângulo arredondado como tubo
    const hw = w / 2 + R, hh = h / 2 + R, cr = Math.min(0.5, hw * 0.3);
    const cy = base + h / 2;
    const path = new THREE.CurvePath();
    const P = (x, y) => new THREE.Vector3(x, y, 0);
    const corners = [[hw, hh], [-hw, hh], [-hw, -hh], [hw, -hh]];
    const pts = [];
    for (let i = 0; i < 4; i++) {
      const [x, y] = corners[i], [nx, ny] = corners[(i + 1) % 4];
      const dir = [Math.sign(nx - x), Math.sign(ny - y)];
      const a0 = P(x + dir[0] * cr, y + dir[1] * cr), a1 = P(nx - dir[0] * cr, ny - dir[1] * cr);
      pts.push([a0, a1, P(nx, ny)]);
    }
    for (let i = 0; i < 4; i++) {
      const [a0, a1, c] = pts[i];
      path.add(new THREE.LineCurve3(a0, a1));
      path.add(new THREE.QuadraticBezierCurve3(a1, c, pts[(i + 1) % 4][0]));
    }
    const tube = new THREE.Mesh(new THREE.TubeGeometry(path, 96, R, 10, true), bandMat);
    tube.position.y = cy; tube.castShadow = true; group.add(tube);
    // pés até o chão quando o portão está no alto
    if ((def.y || 0) > 0.3) {
      for (const sx of [-1, 1]) {
        const legH = base - gy;
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, legH, 8), legMat);
        leg.position.set(sx * hw, gy + legH / 2, 0); leg.castShadow = true; group.add(leg);
        const foot = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.08, 0.6), legMat); foot.position.set(sx * hw, gy + 0.04, 0); group.add(foot);
      }
    } else {
      for (const sx of [-1, 1]) { const foot = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.1, 0.9), legMat); foot.position.set(sx * hw, gy + 0.05, 0); group.add(foot); }
    }
    // placa com número (preenchida pelos modos com setGateNumber)
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 0.06), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 }));
    plate.position.set(0, cy + hh + 0.32, 0); plate.castShadow = true; plate.visible = false; group.add(plate);
    // colisores: laterais, topo e base
    const cos = Math.cos(yaw), sin = Math.sin(yaw);
    const toWorld = (lx, lz) => [def.x + lx * cos + lz * sin, def.z - lx * sin + lz * cos];
    const col = (lx, ly, hx, hy) => { const [wx, wz] = toWorld(lx, 0); this.addCollider(wx, ly, wz, hx, hy, R, yaw); };
    col(-hw, cy, R, hh + R); col(hw, cy, R, hh + R); col(0, cy + hh, hw, R);
    if ((def.y || 0) > 0.25) col(0, cy - hh, hw, R);
    // moldura luminosa interna e painel (estado do portão)
    const glowMat = new THREE.MeshBasicMaterial({ color: 0x777777, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false });
    const frame = new THREE.Mesh(this.frameGeometry(w, h, 0.1), glowMat);
    frame.position.set(0, cy, 0); group.add(frame);
    const panelMat = new THREE.MeshBasicMaterial({ color: 0x22e0ff, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false });
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(w, h), panelMat);
    panel.position.copy(frame.position); group.add(panel);
    this.root.add(group);
    const gate = {
      def, w, h, group, frame, glowMat, panelMat, plate,
      center: [def.x, cy, def.z],
      n: [-Math.sin(yaw), 0, -Math.cos(yaw)],
      r: [Math.cos(yaw), 0, -Math.sin(yaw)],
    };
    this.gates.push(gate);
    return gate;
  }
  setGateNumber(gate, n) {
    const c = document.createElement('canvas'); c.width = 128; c.height = 72;
    const g = c.getContext('2d');
    g.fillStyle = '#f4f4f4'; g.fillRect(0, 0, 128, 72);
    g.fillStyle = '#e1232d'; g.fillRect(0, 0, 128, 8); g.fillRect(0, 64, 128, 8);
    g.fillStyle = '#1a1a1a'; g.font = 'bold 50px Montserrat, Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(n), 64, 38);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    gate.plate.material = new THREE.MeshStandardMaterial({ map: t, roughness: 0.5 });
    gate.plate.visible = true;
  }
  frameGeometry(w, h, t) {
    const s = new THREE.Shape();
    s.moveTo(-w / 2, -h / 2); s.lineTo(w / 2, -h / 2); s.lineTo(w / 2, h / 2); s.lineTo(-w / 2, h / 2); s.lineTo(-w / 2, -h / 2);
    const hole = new THREE.Path();
    hole.moveTo(-w / 2 + t, -h / 2 + t); hole.lineTo(-w / 2 + t, h / 2 - t); hole.lineTo(w / 2 - t, h / 2 - t); hole.lineTo(w / 2 - t, -h / 2 + t); hole.lineTo(-w / 2 + t, -h / 2 + t);
    s.holes.push(hole);
    return new THREE.ShapeGeometry(s);
  }
  removeGate(gate) {
    this.root.remove(gate.group);
    const [x, , z] = gate.center;
    this.boxes = this.boxes.filter((b) => Math.hypot(b.c[0] - x, b.c[2] - z) > Math.max(gate.w, 2) * 0.9 || b.h[1] > 30);
    this.cells = null;
    this.gates = this.gates.filter((g) => g !== gate);
  }

  static crossGate(gate, p0, p1) {
    const c = gate.center, n = gate.n;
    const s0 = (p0[0] - c[0]) * n[0] + (p0[2] - c[2]) * n[2];
    const s1 = (p1[0] - c[0]) * n[0] + (p1[2] - c[2]) * n[2];
    if ((s0 < 0) === (s1 < 0)) return 0;
    const t = s0 / (s0 - s1);
    const px = p0[0] + (p1[0] - p0[0]) * t, py = p0[1] + (p1[1] - p0[1]) * t, pz = p0[2] + (p1[2] - p0[2]) * t;
    const u = (px - c[0]) * gate.r[0] + (pz - c[2]) * gate.r[2];
    const v = py - c[1];
    if (Math.abs(u) > gate.w / 2 || Math.abs(v) > gate.h / 2) return 0;
    return s0 < 0 ? 1 : -1;
  }

  // ---------- céu procedural com nuvens, névoa, luz e reflexos ----------
  atmosphere(o) {
    const C = (h) => new THREE.Color(h);
    const U = {
      zenith: uniform(C(o.zenith)), horizon: uniform(C(o.horizon)), groundCol: uniform(C(o.ground)),
      sunDir: uniform(new THREE.Vector3(...o.sunDir).normalize()), sunCol: uniform(C(o.sunColor).multiplyScalar(o.sunGlow ?? 1)),
      sunSize: uniform(o.sunSize ?? 1), cover: uniform(o.cloudCover ?? 0.5), cloudCol: uniform(C(o.cloudColor ?? 0xffffff)),
      cloudShadow: uniform(C(o.cloudShadow ?? 0x888888)), cloudScale: uniform(o.cloudScale ?? 1.2), stars: uniform(o.stars ?? 0),
      time: uniform(0),
    };
    this.skyU = U;
    const sky = new THREE.Mesh(new THREE.SphereGeometry(2000, 48, 24), skyMaterial(U));
    sky.frustumCulled = false; sky.renderOrder = -1;
    this.root.add(sky);
    this.sky = sky;
    // reflexos: ambiente gerado a partir do próprio céu
    if (this.renderer) {
      const tmp = new THREE.Scene(); const sk = sky.clone(); sk.material = sky.material; tmp.add(sk);
      const pm = new THREE.PMREMGenerator(this.renderer);
      this.envRT = pm.fromScene(tmp, 0.02, 1, 5000);
      pm.dispose();
      this.scene.environment = this.envRT.texture;
    }
    this.scene.environmentIntensity = o.envIntensity ?? 1;
    this.scene.fog = new THREE.FogExp2(C(o.fog ?? o.horizon), o.fogDensity ?? 0.002);
    this.root.add(new THREE.HemisphereLight(o.hemiSky ?? o.zenith, o.hemiGround ?? o.ground, o.hemi ?? 0.8));
    const sun = new THREE.DirectionalLight(o.lightColor ?? o.sunColor, o.sunIntensity ?? 2);
    sun.position.set(...(o.lightDir ?? o.sunDir)).multiplyScalar(100);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera; sc.left = sc.bottom = -60; sc.right = sc.top = 60; sc.near = 1; sc.far = 400;
    sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.04;
    this.root.add(sun); this.root.add(sun.target);
    this.sun = sun; this.sunDir = new THREE.Vector3(...(o.lightDir ?? o.sunDir)).normalize();
    this.look = { bloom: o.bloom ?? 0.25, exposure: o.exposure ?? 1 };
  }
  followShadow(pos) {
    if (!this.sun) return;
    // encaixa o centro da sombra na grade de pixels do mapa de sombra (evita a sombra "tremer")
    const d = this.sunDir, sc = this.sun.shadow.camera;
    const texel = (sc.right - sc.left) / this.sun.shadow.mapSize.x;
    const ax = new THREE.Vector3(0, 1, 0).cross(d); if (ax.lengthSq() < 1e-6) ax.set(1, 0, 0); ax.normalize();
    const ay = d.clone().cross(ax).normalize();
    const p = new THREE.Vector3(pos.x, pos.y, pos.z);
    const u = Math.round(p.dot(ax) / texel) * texel, v = Math.round(p.dot(ay) / texel) * texel, w = p.dot(d);
    pos = ax.multiplyScalar(u).addScaledVector(ay, v).addScaledVector(d, w);
    this.sun.target.position.set(pos.x, pos.y, pos.z);
    this.sun.position.copy(this.sun.target.position).addScaledVector(this.sunDir, 150);
  }
  update(camera, time, drone) {
    if (this.sky) { this.sky.position.copy(camera.position); this.skyU.time.value = time; }
    WIND.time.value = time;
    for (const g of this.grassFields || []) g.update(camera, drone);
    for (const f of this.forests || []) f.update(camera.position);
  }

  // ---------- vegetação ----------
  // Árvores como planos cruzados com textura recortada (instanciadas).
  forest(list, kind) {
    if (!list.length) return;
    const quads = kind === 'conifer' ? 3 : 2; // (só nas miniaturas do menu)
    const geos = [];
    for (let k = 0; k < quads; k++) {
      const p = new THREE.PlaneGeometry(1, 1); p.translate(0, 0.5, 0); p.rotateY((k * Math.PI) / quads); geos.push(p);
    }
    const geo = mergeSimple(geos);
    // normais inclinadas para cima: iluminação suave e uniforme como copa
    const nrm = geo.attributes.normal, pos = geo.attributes.position;
    for (let i = 0; i < nrm.count; i++) { const x = pos.getX(i), z = pos.getZ(i), l = Math.hypot(x, 1.2, z); nrm.setXYZ(i, x / l, 1.2 / l, z / l); }
    if (!this.opts.lowDetail) {
      const f = new Forest(list, kind, this.renderer);
      this.root.add(f.group);
      (this.forests || (this.forests = [])).push(f);
      return f;
    }
    const mat = new THREE.MeshStandardMaterial({ map: tex(kind === 'shrub' ? 'broadleaf' : kind), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.9 });
    const im = new THREE.InstancedMesh(geo, mat, list.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3(), color = new THREE.Color();
    list.forEach((t, i) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), t.rot);
      sc.set(t.w, t.h, t.w); p.set(t.x, t.y - 0.3, t.z);
      m4.compose(p, q, sc); im.setMatrixAt(i, m4);
      const k = 0.72 + t.tint * 0.4; color.setRGB(k, k * 1.03, k * 0.9); im.setColorAt(i, color);
    });
    im.castShadow = true; im.receiveShadow = true;
    this.root.add(im);
    return im;
  }
  // colisão só no tronco (folhas e galhos finos não batem): 2 trechos, cada um um octógono (2 caixas a 45°)
  treeColliders(list, forest) {
    list.forEach((t, i) => {
      if (Math.abs(t.x) > this.bounds + 10 || Math.abs(t.z) > this.bounds + 10) return;
      const T = forest && forest.trunkOf ? forest.trunkOf(i) : { r0: t.w * 0.04, r1: t.w * 0.01, len: t.h * 0.8 };
      const top = T.len * 0.8; // a ponta do tronco é fina demais para contar
      for (const [a, b] of [[0, 0.4], [0.4, 1]]) {
        const y0 = top * a, y1 = top * b, k = (a + b) / 2;
        const r = Math.max(0.12, T.r0 + (T.r1 - T.r0) * (k * top / T.len)) * 0.92;
        const cy = t.y - 0.2 + (y0 + y1) / 2, hy = (y1 - y0) / 2;
        this.addCollider(t.x, cy, t.z, r, hy, r, 0);
        this.addCollider(t.x, cy, t.z, r, hy, r, Math.PI / 4);
      }
    });
  }
  // grama 3D: bounds [x0,z0,x1,z1], density(x,z) 0..1
  addGrass(bounds, density, opts = {}) {
    const data = grassData(bounds, opts.res || 1, (x, z) => this.groundHeight(x, z) + (opts.y0 || 0), density);
    const g = new GrassField(Object.assign({ bounds, data }, opts));
    this.root.add(g.mesh);
    (this.grassFields || (this.grassFields = [])).push(g);
    return g;
  }
  grassField(points, size = 1) {
    if (!points.length) return;
    const geos = [];
    for (let k = 0; k < 2; k++) { const p = new THREE.PlaneGeometry(1.3, 0.85); p.translate(0, 0.42, 0); p.rotateY(k * Math.PI / 2); geos.push(p); }
    const geo = mergeSimple(geos);
    const nrm = geo.attributes.normal; for (let i = 0; i < nrm.count; i++) nrm.setXYZ(i, 0, 1, 0);
    const mat = new THREE.MeshStandardMaterial({ map: tex('grassClump'), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 1 });
    const im = new THREE.InstancedMesh(geo, mat, points.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    points.forEach((pt, i) => {
      q.setFromAxisAngle(up, pt[3]);
      const s = size * (0.7 + (pt[4] ?? 0.5) * 0.7);
      sc.set(s, s * (0.8 + (pt[4] ?? 0.5) * 0.6), s); p.set(pt[0], pt[1], pt[2]);
      m4.compose(p, q, sc); im.setMatrixAt(i, m4);
    });
    im.receiveShadow = true;
    this.root.add(im);
    this.grass = im;
    return im;
  }

  build(mapId, opts = {}) {
    this.clear();
    this.opts = opts;
    const def = MAPS[mapId];
    def.build(this, opts);
    if (!opts.lowDetail) { upgradeMaterials(this.root); addRelief(this.root); }
    return def;
  }
}

function mergeSimple(geos) {
  let total = 0; for (const g of geos) total += g.attributes.position.count;
  const pos = new Float32Array(total * 3), nrm = new Float32Array(total * 3), uv = new Float32Array(total * 2);
  const idx = []; let off = 0;
  for (const g of geos) {
    pos.set(g.attributes.position.array, off * 3); nrm.set(g.attributes.normal.array, off * 3); uv.set(g.attributes.uv.array, off * 2);
    for (const i of g.index.array) idx.push(i + off);
    off += g.attributes.position.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setIndex(idx);
  return out;
}

// =====================================================================
// Construções reutilizáveis
// =====================================================================
const rot = (lx, lz, yaw) => [lx * Math.cos(yaw) + lz * Math.sin(yaw), -lx * Math.sin(yaw) + lz * Math.cos(yaw)];

// Galpão de tijolos com telhado de duas águas. Comprimento no eixo z local.
// doors: { front: [largura, altura], back: [...] } abre portões nas pontas.
function shed(w, cx, cz, len, wid, H, rise, yaw, doors = {}) {
  const bay = w.mat('bayMat', () => new THREE.MeshStandardMaterial({ map: tex('bay'), roughness: 0.92, bumpMap: tex('bay'), bumpScale: 0.6 }));
  const brick = w.mat('brickMat', () => new THREE.MeshStandardMaterial({ map: tex('brick'), roughness: 0.95, bumpMap: tex('brick'), bumpScale: 0.6 }));
  const roofMat = w.mat('roofMat', () => new THREE.MeshStandardMaterial({ map: rep(tex('roof'), 0.25, 0.25), roughness: 0.75, metalness: 0.35, side: THREE.DoubleSide }));
  const gableMat = w.mat('gableMat', () => new THREE.MeshStandardMaterial({ map: rep(tex('brick'), 0.25, 0.25), roughness: 0.95 }));
  const T = 0.6;
  const at = (lx, lz) => { const [x, z] = rot(lx, lz, yaw); return [cx + x, cz + z]; };
  (w.sheds || (w.sheds = [])).push({ cx, cz, len, wid, yaw, H });
  // sem portões pedidos: as duas pontas ficam abertas (portão grande), para dar para entrar voando
  if (!doors.front && !doors.back && !doors.closed) { const d = [Math.min(wid * 0.55, 9), Math.min(H * 0.72, 7)]; doors = { front: d, back: d }; }
  // paredes longas com janelões (6 m por vão)
  if (w.opts.lowDetail) for (const sx of [-1, 1]) { const [x, z] = at(sx * wid / 2, 0); w.box(x, 0, z, T, H, len, bay, yaw, { uv: 6, uvv: H }); }
  else {
    const k = new Kit();
    for (const sx of [-1, 1]) windowWall(w, cx, cz, yaw, sx, wid, len, H, T, bay, k);
    const tx = windowTextures();
    k.build(w.root, {
      glass: w.mat('glass', () => new THREE.MeshStandardMaterial({ ...tx, roughness: 1, metalness: 0, alphaTest: 0.5, side: THREE.DoubleSide, normalScale: new THREE.Vector2(0.5, 0.5), envMapIntensity: 1.4 })),
      steel: w.mat('winSteel', () => new THREE.MeshStandardMaterial({ map: tex('rust'), color: 0x5a544e, roughness: 0.7, metalness: 0.6 })),
      wall: bay,
      trim: w.mat('winTrim', () => new THREE.MeshStandardMaterial({ map: rep(tex('concrete'), 0.5, 0.5), roughness: 0.9, color: 0xb8b2a6 })),
    }, { shadow: { glass: false } });
  }
  // paredes das pontas
  for (const [sz, key] of [[-1, 'front'], [1, 'back']]) {
    const d = doors[key];
    if (!d) { const [x, z] = at(0, sz * len / 2); w.box(x, 0, z, wid + T, H, T, brick, yaw, { uv: 4 }); continue; }
    const side = (wid - d[0]) / 2;
    for (const sx of [-1, 1]) { const [x, z] = at(sx * (d[0] / 2 + side / 2 + T / 4), sz * len / 2); w.box(x, 0, z, side + T / 2, H, T, brick, yaw, { uv: 4 }); }
    const [x, z] = at(0, sz * len / 2); w.box(x, d[1], z, d[0], H - d[1], T, brick, yaw, { uv: 4 });
  }
  // telhado (prisma) com empena de tijolo
  const sh = new THREE.Shape();
  sh.moveTo(-wid / 2 - 0.8, 0); sh.lineTo(wid / 2 + 0.8, 0); sh.lineTo(0, rise); sh.lineTo(-wid / 2 - 0.8, 0);
  const g = new THREE.ExtrudeGeometry(sh, { depth: len + 0.8, bevelEnabled: false });
  g.translate(0, 0, -(len + 0.8) / 2);
  const roof = new THREE.Mesh(g, [gableMat, roofMat]);
  roof.position.set(cx, H, cz); roof.rotation.y = yaw; roof.castShadow = true; roof.receiveShadow = true;
  w.root.add(roof);
  for (let k = 0; k < 3; k++) {
    const ww = (wid + 1.6) * (1 - (k + 0.5) / 3.2);
    const [x, z] = at(0, 0);
    w.addCollider(x, H + rise * (k / 3) + rise / 6, z, ww / 2, rise / 6, len / 2 + 0.4, yaw);
  }
  // teto interno (para quem voa por dentro)
  const [x, z] = at(0, 0);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(wid, len), w.mat('ceilMat', () => new THREE.MeshStandardMaterial({ color: 0x77736c, roughness: 1, side: THREE.DoubleSide })));
  ceil.rotation.x = Math.PI / 2; ceil.position.set(x, H - 0.05, z); ceil.rotation.z = -yaw; w.root.add(ceil);
  // piso de concreto (por dentro não é o gramado do terreno)
  const floorMat = w.mat('shedFloor', () => new THREE.MeshStandardMaterial({ map: rep(tex('concrete'), 1, 1), roughness: 0.9, color: 0x9a968e }));
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(wid - T, len), floorMat);
  floor.rotation.set(-Math.PI / 2, yaw, 0, 'YXZ'); floor.position.set(x, 0.03, z); floor.receiveShadow = true; w.root.add(floor);
  // tesouras: vigas de aço atravessando o galpão a cada 6 m, logo abaixo do teto
  const truss = w.mat('trussMat', () => new THREE.MeshStandardMaterial({ map: tex('metal'), color: 0x8a8278, roughness: 0.6, metalness: 0.6 }));
  for (let lz = -len / 2 + 6; lz < len / 2 - 2; lz += 6) {
    const [bx, bz] = at(0, lz);
    w.box(bx, H - 0.6, bz, wid - T, 0.45, 0.25, truss, yaw);
  }
}

// ---------- janelões industriais 3D ----------
// A parede comprida ganha vãos de verdade (com a espessura do tijolo à mostra). Dentro de cada vão: caixilho de aço
// 3D (6×9 vidraças), vidro com 5 variações pintadas num atlas (sujeira escorrida, trincas, vidro aramado, vidraças
// pintadas, tábuas pregadas e buracos com cacos: dá para ver o interior pelos buracos) e, em algumas, a báscula
// do meio aberta. Tudo vira poucas malhas pelo Kit.
const WIN = { cols: 6, rows: 9, cw: 512, ch: 768, hopper: { c0: 2, c1: 4, r0: 4, r1: 6 }, variants: 5 };
function windowTextures() {
  if (TEX.__win) return TEX.__win;
  const { cols, rows, cw, ch } = WIN, W = cw * 3, Hh = ch * 2, pw = cw / cols, ph = ch / rows;
  const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = Hh; return c; };
  const cc = mk(), rc = mk(), nc = mk();
  const g = cc.getContext('2d'), r = rc.getContext('2d'), n = nc.getContext('2d');
  r.fillStyle = '#ffffff'; r.fillRect(0, 0, W, Hh); n.fillStyle = 'rgb(128,128,255)'; n.fillRect(0, 0, W, Hh);
  // receitas: [quebradas, trincadas, aramado, linhas pintadas embaixo, tábuas, báscula aberta]
  const REC = [[0.05, 0.12, 0, 0, 0, 1], [0.1, 0.18, 1, 0, 0, 0], [0.28, 0.1, 0, 0, 4, 1], [0.08, 0.1, 0, 3, 0, 0], [0.03, 0.22, 0, 0, 1, 1]];
  const crack = (ctxs, x, y, len, rnd) => {
    for (let k = 0; k < 3 + rnd() * 4; k++) {
      let a = rnd() * Math.PI * 2, px = x, py = y;
      const pts = [[px, py]];
      for (let s = 0; s < 4; s++) { a += (rnd() - 0.5) * 0.9; px += Math.cos(a) * len * (0.2 + rnd() * 0.3); py += Math.sin(a) * len * (0.2 + rnd() * 0.3); pts.push([px, py]); }
      for (const [ctx, style, lw] of ctxs) { ctx.strokeStyle = style; ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (const p of pts) ctx.lineTo(p[0], p[1]); ctx.stroke(); }
    }
  };
  const pane = (ox, oy, i, j, rec, rnd, pw, ph) => {
    const x = ox + i * pw, y = oy + j * ph;
    const H = WIN.hopper, inHopper = rec[5] && i >= H.c0 && i < H.c1 && j >= H.r0 && j < H.r1;
    if (inHopper) { g.clearRect(x, y, pw, ph); return; } // báscula: a vidraça está na peça 3D aberta
    const broken = rnd() < rec[0], boards = rec[4] && rnd() < rec[4] / 30;
    const painted = rec[3] && j >= rows - rec[3], dirty = rnd(), tint = 0.82 + rnd() * 0.4;
    // vidro cinza esverdeado, cada vidraça de um lote diferente
    const v = (40 + dirty * 26) * tint;
    g.fillStyle = `rgb(${v * 0.86 | 0},${v | 0},${v * 0.97 | 0})`; g.fillRect(x, y, pw, ph);
    if (painted) { // caiação por dentro (tinta branca riscada)
      g.fillStyle = `rgba(150,148,132,${0.75 + rnd() * 0.2})`; g.fillRect(x, y, pw, ph);
      g.strokeStyle = 'rgba(60,70,66,0.6)'; g.lineWidth = 2;
      for (let k = 0; k < 6; k++) { g.beginPath(); const sx = x + rnd() * pw, sy = y + rnd() * ph; g.moveTo(sx, sy); g.lineTo(sx + (rnd() - 0.5) * 40, sy + (rnd() - 0.5) * 40); g.stroke(); }
    }
    if (rec[2] && !painted) { // vidro aramado (malha em losango)
      g.save(); g.beginPath(); g.rect(x, y, pw, ph); g.clip();
      g.strokeStyle = 'rgba(20,22,20,0.35)'; g.lineWidth = 1;
      for (let k = -ph; k < pw + ph; k += 9) { g.beginPath(); g.moveTo(x + k, y); g.lineTo(x + k - ph, y + ph); g.stroke(); g.beginPath(); g.moveTo(x + k - ph, y); g.lineTo(x + k, y + ph); g.stroke(); }
      g.restore();
    }
    // sujeira: acumulada embaixo, escorrida de cima, mais escura na massa das bordas
    const gr = g.createLinearGradient(0, y + ph * 0.35, 0, y + ph); gr.addColorStop(0, 'rgba(78,68,52,0)'); gr.addColorStop(1, `rgba(78,68,52,${0.25 + dirty * 0.45})`);
    g.fillStyle = gr; g.fillRect(x, y, pw, ph);
    for (let k = 0; k < 3 + dirty * 6; k++) { g.fillStyle = `rgba(90,78,60,${0.08 + rnd() * 0.15})`; g.fillRect(x + rnd() * pw, y, 1 + rnd() * 2, ph * (0.3 + rnd() * 0.7)); }
    g.strokeStyle = 'rgba(30,28,24,0.7)'; g.lineWidth = 5; g.strokeRect(x + 2, y + 2, pw - 4, ph - 4);
    const rv = painted ? 215 : 16 + dirty * dirty * 140;
    r.fillStyle = `rgb(${rv | 0},${rv | 0},${rv | 0})`; r.fillRect(x, y, pw, ph);
    n.fillStyle = `rgb(${128 + (rnd() - 0.5) * 34 | 0},${128 + (rnd() - 0.5) * 34 | 0},255)`; n.fillRect(x, y, pw, ph);
    if (boards) { // tábua pregada no lugar do vidro
      for (let k = 0; k < 2; k++) { const by = y + k * ph / 2; g.fillStyle = `rgb(${92 + rnd() * 30 | 0},${70 + rnd() * 20 | 0},${48 + rnd() * 14 | 0})`; g.fillRect(x, by, pw, ph / 2 - 2); }
      g.fillStyle = 'rgba(30,22,14,0.8)'; for (let k = 0; k < 4; k++) g.fillRect(x + 6 + (k % 2) * (pw - 14), y + 6 + (k >> 1) * (ph / 2), 3, 3);
      r.fillStyle = '#f0f0f0'; r.fillRect(x, y, pw, ph);
    } else if (rnd() < rec[1] && !broken) { // trinca em estrela
      const cx = x + pw * (0.2 + rnd() * 0.6), cy = y + ph * (0.2 + rnd() * 0.6);
      crack([[g, 'rgba(175,182,178,0.32)', 0.8], [r, 'rgb(120,120,120)', 1.5], [n, 'rgb(160,140,255)', 1.5]], cx, cy, pw * 0.65, rnd);
    }
    if (broken && !boards) { // buraco com cacos presos na massa
      g.save(); g.globalCompositeOperation = 'destination-out'; g.beginPath();
      if (rnd() < 0.3) g.rect(x + 3, y + 3, pw - 6, ph - 6);
      else {
        const cx = x + pw * (0.4 + rnd() * 0.2), cy = y + ph * (0.4 + rnd() * 0.2), m = 9 + (rnd() * 5 | 0);
        for (let k = 0; k < m; k++) { const a = (k / m) * Math.PI * 2, rr = (0.22 + rnd() * 0.3) * pw; const px = cx + Math.cos(a) * rr, py = cy + Math.sin(a) * rr; if (k) g.lineTo(px, py); else g.moveTo(px, py); }
        g.closePath();
      }
      g.fill(); g.restore();
    }
  };
  for (let v = 0; v < WIN.variants; v++) {
    const ox = (v % 3) * cw, oy = Math.floor(v / 3) * ch, rnd = rng(301 + v * 17);
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) pane(ox, oy, i, j, REC[v], rnd, pw, ph);
  }
  // célula 5: vidro da báscula (2×2 vidraças grandes, sujo, sem buracos)
  { const rnd = rng(999); for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) pane(2 * cw, ch, i, j, [0, 0.15, 0, 0, 0, 0], rnd, cw / 2, ch / 2); }
  const tx = (c, srgb) => { const t = new THREE.CanvasTexture(c); t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.anisotropy = 16; return t; };
  return (TEX.__win = { map: tx(cc, true), roughnessMap: tx(rc, false), normalMap: tx(nc, false) });
}
// plano de vidro com o uv apontando para uma célula do atlas (0..5)
function atlasPlane(wd, ht, cell) {
  const g = new THREE.PlaneGeometry(wd, ht), uv = g.attributes.uv, cx = cell % 3, cy = Math.floor(cell / 3);
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (cx + uv.getX(i)) / 3, 1 - (cy + 1 - uv.getY(i)) / 2);
  return g;
}

// parede comprida de galpão com os vãos e as janelas (lado sx = -1/+1); vãos de 6 m
function windowWall(w, cx, cz, yaw, sx, wid, len, H, T, wallMat, k) {
  const bays = Math.floor(len / 6), ww = 3.84, y0 = H * 0.28, y1 = H * 0.88, wh = y1 - y0;
  const at = (lx, lz) => { const [x, z] = rot(lx, lz, yaw); return [cx + x, cz + z]; };
  const lx = sx * wid / 2;
  const centers = []; for (let i = 0; i < bays; i++) centers.push(-len / 2 + 3 + i * 6 + (len - bays * 6) / 2);
  // pilares entre os vãos e faixas abaixo/acima de cada vão (sem colisor: a parede inteira colide)
  let z = -len / 2;
  const piece = (za, zb, ya, yb) => { if (zb - za < 0.01 || yb - ya < 0.01) return; const [x, zz] = at(lx, (za + zb) / 2); k.box('wall', x, (ya + yb) / 2, zz, T, yb - ya, zb - za, 0, yaw, 0); };
  for (const c of centers) { piece(z, c - ww / 2, 0, H); piece(c - ww / 2, c + ww / 2, 0, y0); piece(c - ww / 2, c + ww / 2, y1, H); z = c + ww / 2; }
  piece(z, len / 2, 0, H);
  { const [x, zz] = at(lx, 0); w.addCollider(x, H / 2, zz, T / 2, H / 2, len / 2, yaw); }
  const { cols, rows, hopper: HP } = WIN, pw = ww / cols, ph = wh / rows;
  const rnd = rng(Math.abs(Math.round(cx * 31 + cz * 17 + sx * 7)) + 5);
  const R = new THREE.Matrix4().makeRotationY(yaw), B = new THREE.Matrix4(), P = new THREE.Matrix4();
  for (const c of centers) {
    // peitoril e verga de concreto (por fora), em coordenadas do mundo
    k.base.identity();
    const [sxp, szp] = at(sx * (wid / 2 + T / 2 + 0.09), c);
    k.box('trim', sxp, y0 - 0.08, szp, 0.26, 0.16, ww + 0.5, 0, yaw, 0);
    k.box('trim', sxp, y1 + 0.16, szp, 0.2, 0.32, ww + 0.4, 0, yaw, 0);
    // referencial da janela: X ao longo da parede, Y para cima, Z para fora; origem no centro do vidro
    const [gx, gz] = at(sx * (wid / 2 + T / 2 - 0.16), c);
    B.makeBasis(new THREE.Vector3(0, 0, -sx), new THREE.Vector3(0, 1, 0), new THREE.Vector3(sx, 0, 0));
    k.base.copy(P.makeTranslation(gx, y0 + wh / 2, gz)).multiply(R).multiply(B);
    const variant = (rnd() * WIN.variants) | 0, hasHopper = [0, 2, 4].includes(variant);
    k.add('glass', atlasPlane(ww, wh, variant));
    // caixilho: moldura grossa + travessas finas, com profundidade
    k.box('steel', 0, wh / 2 - 0.04, 0, ww, 0.08, 0.14); k.box('steel', 0, -wh / 2 + 0.04, 0, ww, 0.08, 0.14);
    for (const e of [-1, 1]) k.box('steel', e * (ww / 2 - 0.04), 0, 0, 0.08, wh, 0.14);
    for (let i = 1; i < cols; i++) k.box('steel', -ww / 2 + i * pw, 0, 0, 0.035, wh, 0.07);
    for (let j = 1; j < rows; j++) k.box('steel', 0, -wh / 2 + j * ph, 0, ww, 0.035, 0.07);
    if (hasHopper) {
      // báscula: gira no eixo do meio (em cima entra, embaixo sai)
      const bw = (HP.c1 - HP.c0) * pw, bh = (HP.r1 - HP.r0) * ph;
      const bx = -ww / 2 + (HP.c0 + HP.c1) / 2 * pw, by = wh / 2 - (HP.r0 + HP.r1) / 2 * ph, ang = 0.35 + rnd() * 0.35;
      const sub = new THREE.Matrix4().makeTranslation(bx, by, 0.02).multiply(new THREE.Matrix4().makeRotationX(-ang));
      const save = k.base.clone(); k.base.multiply(sub);
      k.add('glass', atlasPlane(bw, bh, 5));
      k.box('steel', 0, bh / 2, 0, bw + 0.04, 0.045, 0.06); k.box('steel', 0, -bh / 2, 0, bw + 0.04, 0.045, 0.06);
      for (const e of [-1, 0, 1]) k.box('steel', e * bw / 2, 0, 0, 0.04, bh, 0.06);
      k.box('steel', 0, 0, 0, bw, 0.03, 0.05);
      k.base.copy(save);
    }
  }
  k.base.identity();
}

function chimney(w, x, z, h, r, opts = {}) {
  const brick = w.mat('chimBrick', () => new THREE.MeshStandardMaterial({ map: rep(tex('brick'), 2, 6), roughness: 0.95, bumpMap: tex('brick'), bumpScale: 0.5 }));
  const iron = w.mat('iron', () => new THREE.MeshStandardMaterial({ color: 0x1d1c1b, roughness: 0.7, metalness: 0.6 }));
  const gy = w.groundHeight(x, z);
  w.box(x, gy, z, r * 2.8, 3, r * 2.8, w.mat('plinth', () => new THREE.MeshStandardMaterial({ map: rep(tex('brick'), 1, 1), roughness: 0.95 })), 0, { uv: 4 });
  w.cylinder(x, gy + 3, z, r, h - 3, brick, 24, r * 0.72);
  // cintas de ferro
  for (let y = 7; y < h - 1; y += 4.5) {
    const k = (y - 3) / (h - 3), rr = r * (1 - 0.28 * k) + 0.06;
    const band = new THREE.Mesh(new THREE.CylinderGeometry(rr, rr, 0.25, 24, 1, true), iron);
    band.position.set(x, gy + y, z); w.root.add(band);
  }
  // topo com coroa escura e, às vezes, galeria
  const top = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.8, r * 0.74, 1.2, 24, 1, true), iron);
  top.position.set(x, gy + h + 0.4, z); w.root.add(top);
  if (opts.gallery) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r * 1.05, 0.06, 6, 32), iron);
    ring.rotation.x = Math.PI / 2; ring.position.set(x, gy + h - 1, z); w.root.add(ring);
    const deck = new THREE.Mesh(new THREE.RingGeometry(r * 0.72, r * 1.05, 32), iron); deck.rotation.x = -Math.PI / 2; deck.position.set(x, gy + h - 2, z); w.root.add(deck);
    for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; const p = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1, 4), iron); p.position.set(x + Math.cos(a) * r * 1.05, gy + h - 1.5, z + Math.sin(a) * r * 1.05); w.root.add(p); }
  }
  // buracos na alvenaria
  for (const hl of opts.holes || []) {
    const k = (hl[0] - 3) / (h - 3), rr = r * (1 - 0.28 * k);
    const hole = new THREE.Mesh(new THREE.CircleGeometry(hl[2], 12), w.mat('holeMat', () => new THREE.MeshBasicMaterial({ color: 0x0b0908 })));
    hole.position.set(x + Math.sin(hl[1]) * (rr + 0.02), gy + hl[0], z + Math.cos(hl[1]) * (rr + 0.02)); hole.rotation.y = hl[1]; hole.scale.y = 1.3; w.root.add(hole);
  }
}

function railTrack(w, x, z0, z1) {
  const len = z1 - z0, cz = (z0 + z1) / 2;
  if (w.paved) w.paved.push([x - 1.7, z0, x + 1.7, z1]);
  const gravel = w.mat('gravelMat', () => new THREE.MeshStandardMaterial({ map: rep(tex('gravel'), 1, 1), roughness: 1 }));
  const bed = new THREE.Mesh(new THREE.PlaneGeometry(3.4, len), gravel);
  bed.material = gravel.clone(); bed.material.map = rep(tex('gravel'), 1.2, len / 3);
  bed.rotation.x = -Math.PI / 2; bed.position.set(x, 0.03, cz); bed.receiveShadow = true; w.root.add(bed);
  const n = Math.floor(len / 0.65);
  const sleeper = new THREE.InstancedMesh(new THREE.BoxGeometry(2.5, 0.14, 0.24), w.mat('sleeperMat', () => new THREE.MeshStandardMaterial({ map: tex('wood'), roughness: 0.95 })), n);
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < n; i++) { m4.makeTranslation(x, 0.1, z0 + i * 0.65 + 0.3); sleeper.setMatrixAt(i, m4); }
  sleeper.receiveShadow = true; w.root.add(sleeper);
  const railMat = w.mat('railMat', () => new THREE.MeshStandardMaterial({ color: 0x6b5a4a, metalness: 0.8, roughness: 0.45 }));
  for (const sx of [-0.72, 0.72]) w.box(x + sx, 0.17, cz, 0.08, 0.15, len, railMat, 0, { collide: false });
}

function boxcar(w, x, z, yaw, color) {
  const rust = w.mat('car' + color, () => new THREE.MeshStandardMaterial({ map: tex('rust'), color, roughness: 0.8, metalness: 0.3 }));
  const black = w.mat('carBlack', () => new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.8, metalness: 0.4 }));
  w.box(x, 1.25, z, 3.0, 3.1, 14, rust, yaw, { uv: 3 });
  w.box(x, 4.35, z, 3.2, 0.25, 14.2, w.mat('carRoof', () => new THREE.MeshStandardMaterial({ color: 0x55575a, metalness: 0.6, roughness: 0.6 })), yaw);
  w.box(x, 0.75, z, 2.4, 0.5, 13.4, black, yaw, { collide: false });
  for (const dz of [-5, -3.6, 3.6, 5]) for (const sx of [-0.72, 0.72]) {
    const [ox, oz] = rot(sx, dz, yaw);
    const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.15, 16), black);
    wh.rotation.z = Math.PI / 2; wh.rotation.y = yaw; wh.position.set(x + ox, 0.62, z + oz); w.root.add(wh);
  }
}

function fence(w, x0, z0, x1, z1, h = 3) {
  const len = Math.hypot(x1 - x0, z1 - z0), yaw = Math.atan2(-(z1 - z0), x1 - x0);
  const t = rep(tex('fence'), len / 1.2, h / 1.2);
  const mat = new THREE.MeshStandardMaterial({ map: t, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.6, metalness: 0.6 });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(len, h), mat);
  m.position.set((x0 + x1) / 2, h / 2 + 0.05, (z0 + z1) / 2); m.rotation.y = yaw; w.root.add(m);
  w.addCollider((x0 + x1) / 2, h / 2, (z0 + z1) / 2, len / 2, h / 2, 0.06, yaw);
  const post = w.mat('postMat', () => new THREE.MeshStandardMaterial({ color: 0x3b3d40, metalness: 0.7, roughness: 0.5 }));
  const n = Math.ceil(len / 3);
  for (let i = 0; i <= n; i++) { const k = i / n; const p = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, h + 0.3, 6), post); p.position.set(x0 + (x1 - x0) * k, (h + 0.3) / 2, z0 + (z1 - z0) * k); p.castShadow = true; w.root.add(p); }
}

function graffiti(w, x, y, z, yaw, wd, ht, seed) {
  const r = rng(seed);
  const c = document.createElement('canvas'); c.width = 512; c.height = 256;
  const g = c.getContext('2d');
  const words = ['FPV', 'RIP', 'SKY', 'ZOOM', 'DIVE', 'ACRO', 'PMRO', 'PROP'];
  const pal = [['#e94b3c', '#ffd23f'], ['#2fb7e8', '#ffffff'], ['#a1e44d', '#1b1b1b'], ['#f06bc2', '#2b2b2b'], ['#ff9f1c', '#3a0ca3']];
  let [fill, out] = pal[(r() * pal.length) | 0];
  g.font = `900 ${140 + r() * 40}px Impact, Arial Black, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.translate(256, 135); g.rotate((r() - 0.5) * 0.25);
  const word = words[(r() * words.length) | 0];
  if (word === 'PMRO') { fill = '#2563d9'; out = '#000000'; } // pedido do usuário: PMRO em azul com borda preta
  g.lineWidth = 18; g.strokeStyle = out; g.strokeText(word, 0, 0);
  g.fillStyle = fill; g.fillText(word, 0, 0);
  g.globalAlpha = 0.25; g.fillStyle = '#000'; for (let i = 0; i < 400; i++) g.fillRect((r() - 0.5) * 512, (r() - 0.5) * 256, 2, 2);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(wd, ht), new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: 0.9, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
  m.position.set(x, y, z); m.rotation.y = yaw; m.receiveShadow = true; w.root.add(m);
}

// ---------- mobília de galpão abandonado ----------
// Ao longo das duas paredes compridas, vão a vão: máquinas operatrizes, pilhas de paletes, caixotes, estantes porta-palete,
// entulho e tambores; chapas de telhado caídas encostadas na parede; luminárias penduradas no meio. O corredor central
// fica livre para voar. Tudo num Kit (poucas malhas) e com colisores simples para o navegador.
function shedProps(w, sh, seed, o = {}) {
  const r = rng(seed);
  const { cx, cz, len, wid, yaw, H } = sh;
  const T = 0.6, wallIn = wid / 2 - T / 2 - 0.25;
  const inner = o.inner ?? Math.max(wid * 0.2 + 0.3, 2.2);
  const depth = wallIn - inner;
  if (depth < 0.9) return;
  const at = (lx, lz) => { const [x, z] = rot(lx, lz, yaw); return [cx + x, cz + z]; };
  const col = (lx, cy, lz, hx, hy, hz) => { const [x, z] = at(lx, lz); w.addCollider(x, cy, z, hx, hy, hz, yaw); };
  const kb = new Kit({ bevel: 0.012 }), kp = new Kit();
  kb.base.makeRotationY(yaw).setPosition(cx, 0, cz); kp.base.copy(kb.base);
  const M = (name, make) => w.mat(name, make);
  const mats = {
    machine: M('propMachine', () => new THREE.MeshStandardMaterial({ map: tex('metal'), color: 0x55705c, roughness: 0.55, metalness: 0.5 })),
    machine2: M('propMachine2', () => new THREE.MeshStandardMaterial({ map: tex('metal'), color: 0x5a6672, roughness: 0.55, metalness: 0.5 })),
    steel: M('propSteel', () => new THREE.MeshStandardMaterial({ map: tex('metal'), color: 0xb0aca4, roughness: 0.45, metalness: 0.8 })),
    cabinet: M('propCabinet', () => new THREE.MeshStandardMaterial({ map: tex('metal'), color: 0x8f918c, roughness: 0.6, metalness: 0.4 })),
    wood: M('propWood', () => new THREE.MeshStandardMaterial({ map: tex('wood'), color: 0xd8c4a0, roughness: 0.9 })),
    crate: M('propCrate', () => new THREE.MeshStandardMaterial({ map: tex('wood'), color: 0xa8916c, roughness: 0.9 })),
    rack: M('propRack', () => new THREE.MeshStandardMaterial({ map: tex('metal'), color: 0xd06a1c, roughness: 0.5, metalness: 0.5 })),
    rackBlue: M('propRackBlue', () => new THREE.MeshStandardMaterial({ map: tex('metal'), color: 0x2f5a9a, roughness: 0.5, metalness: 0.5 })),
    rubble: M('propRubble', () => new THREE.MeshStandardMaterial({ map: rep(tex('concrete'), 1, 1), color: 0xb8b2a8, roughness: 0.95 })),
    brick: M('propBrick', () => new THREE.MeshStandardMaterial({ map: tex('brick'), roughness: 0.95 })),
    sheet: M('propSheet', () => new THREE.MeshStandardMaterial({ map: tex('roof'), roughness: 0.7, metalness: 0.4, side: THREE.DoubleSide })),
    lamp: M('propLamp', () => new THREE.MeshStandardMaterial({ map: tex('metal'), color: 0x3d5446, roughness: 0.5, metalness: 0.5, side: THREE.DoubleSide })),
    cable: M('propCable', () => new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.6 })),
  };
  // lado sx (−1/+1): x local de um objeto de profundidade d encostado na parede
  const wallX = (sx, d) => sx * (wallIn - d / 2);

  function machine(sx, lz) {
    const d = Math.min(depth, 2.0), lx = wallX(sx, d), key = r() < 0.5 ? 'machine' : 'machine2';
    kb.box(key, lx, 0.42, lz, d * 0.8, 0.84, 2.6);                         // base
    kb.box('steel', lx, 0.9, lz, d * 0.55, 0.14, 2.4);                     // barramento
    kb.box(key, lx, 1.28, lz - 0.85, d * 0.7, 0.66, 0.62);                 // cabeçote
    kb.cyl('steel', lx, 1.22, lz - 0.48, 0.17, 0.14, 'z', 18);            // placa
    kb.box(key, lx, 1.12, lz + 0.9, d * 0.32, 0.34, 0.3);                  // contraponto
    kb.cyl('steel', lx, 1.16, lz + 0.35, 0.05, 1.0, 'z', 10);             // fuso
    kb.cyl('machine2', lx - sx * d * 0.25, 1.5, lz - 0.85, 0.2, 0.42, 'x', 16); // motor
    kb.box('cabinet', sx * (wallIn - 0.25), 0.85, lz + 1.7, 0.45, 1.7, 0.55); // painel elétrico
    kp.rod('cable', [sx * (wallIn - 0.25), 1.7, lz + 1.7], [sx * (wallIn - 0.25), H - 0.7, lz + 1.7], 0.025, 6); // eletroduto
    col(lx, 0.8, lz, d * 0.4, 0.8, 1.35);
    col(sx * (wallIn - 0.25), 0.85, lz + 1.7, 0.23, 0.85, 0.28);
  }
  function pallet(lx, y, lz, rotq) {
    const c = Math.cos(rotq), sn = Math.sin(rotq);
    const P = (ax, az) => [lx + ax * c + az * sn, lz - ax * sn + az * c];
    for (let i = 0; i < 5; i++) { const [px, pz] = P(-0.44 + i * 0.22, 0); kp.box('wood', px, y + 0.133, pz, 0.1, 0.022, 1.2, 0, rotq, 0); }
    for (let i = 0; i < 3; i++) { const [px, pz] = P(-0.44 + i * 0.44, 0); kp.box('wood', px, y + 0.083, pz, 0.12, 0.078, 1.2, 0, rotq, 0); }
    for (let i = 0; i < 3; i++) { const [px, pz] = P(0, -0.54 + i * 0.54); kp.box('wood', px, y + 0.011, pz, 1.0, 0.022, 0.1, 0, rotq, 0); }
  }
  function pallets(sx, lz) {
    const n = 1 + ((r() * 3) | 0);
    for (let k = 0; k < n; k++) {
      const d = 1.0, lx = wallX(sx, d) - sx * (k % 2) * 1.15, z = lz + (k - (n - 1) / 2) * 1.35;
      if (Math.abs(lx) < inner) continue;
      const h = 1 + ((r() * 8) | 0), rq = (r() - 0.5) * 0.12;
      for (let j = 0; j < h; j++) pallet(lx + (r() - 0.5) * 0.04, j * 0.144, z + (r() - 0.5) * 0.04, rq);
      col(lx, h * 0.072, z, 0.5, h * 0.072, 0.6);
    }
  }
  function crate(lx, y, lz, s, key = 'crate') {
    kb.box(key, lx, y + s / 2, lz, s - 0.04, s - 0.04, s - 0.04);
    for (const a of [-1, 1]) for (const b of [-1, 1]) {
      kb.box('wood', lx + a * (s / 2 - 0.035), y + s / 2, lz + b * (s / 2 - 0.035), 0.07, s, 0.07); // quinas
      kb.box('wood', lx, y + (a > 0 ? s - 0.035 : 0.035), lz + b * (s / 2 - 0.035), s, 0.07, 0.07);
      kb.box('wood', lx + b * (s / 2 - 0.035), y + (a > 0 ? s - 0.035 : 0.035), lz, 0.07, 0.07, s);
    }
  }
  function crates(sx, lz) {
    const d = Math.min(depth, 1.8), base = wallX(sx, d);
    let y = 0;
    for (let row = 0; row < 3 && r() < 0.85; row++) {
      const n = 3 - row;
      for (let k = 0; k < n; k++) {
        const s = 0.75 + r() * 0.35;
        crate(base + (r() - 0.5) * 0.2, y, lz + (k - (n - 1) / 2) * 1.05 + (r() - 0.5) * 0.15, s);
      }
      y += 0.85;
    }
    if (y > 0) col(base, y / 2, lz, d / 2, y / 2, 1.6);
  }
  function rack(sx, lz) {
    if (depth < 1.2) return crates(sx, lz);
    const d = 1.1, lx = wallX(sx, d), L = 4.6, h = Math.min(4.2, H - 1.2), key = r() < 0.6 ? 'rack' : 'rackBlue';
    for (const a of [-1, 1]) for (const b of [-1, 1]) kb.box(key, lx + a * (d / 2 - 0.04), h / 2, lz + b * (L / 2 - 0.04), 0.08, h, 0.08);
    for (const a of [-1, 1]) for (let lv = 1; lv <= 2; lv++) kb.box(key, lx + a * (d / 2 - 0.04), lv * h / 2.2, lz, 0.06, 0.12, L);
    for (const b of [-1, 1]) for (let i = 1; i < 6; i++) kp.rod(key, [lx - d / 2 + 0.04, i * h / 6, lz + b * (L / 2 - 0.04)], [lx + d / 2 - 0.04, (i + 0.8) * h / 6, lz + b * (L / 2 - 0.04)], 0.015, 5);
    for (let lv = 0; lv <= 2; lv++) {
      const y = lv === 0 ? 0 : lv * h / 2.2 + 0.06;
      for (const b of [-1, 1]) if (r() < 0.75) {
        pallet(lx, y, lz + b * 1.15, Math.PI / 2 + (r() - 0.5) * 0.05);
        if (r() < 0.7) crate(lx, y + 0.144, lz + b * 1.15, 0.7 + r() * 0.25);
      }
    }
    col(lx, h / 2, lz, d / 2, h / 2, L / 2);
  }
  function rubble(sx, lz) {
    const lx0 = wallX(sx, Math.min(depth, 2.4));
    const n = 10 + ((r() * 10) | 0);
    for (let i = 0; i < n; i++) {
      const g = new THREE.IcosahedronGeometry(0.12 + r() * 0.32, 0);
      const a = r() * Math.PI * 2, d = Math.pow(r(), 0.7) * 1.3;
      kb.add('rubble', g, lx0 + Math.cos(a) * d * 0.8, 0.05 + (1.3 - d) * 0.22 * r(), lz + Math.sin(a) * d * 1.4, r() * 3, r() * 3, r() * 3, 1, 0.5 + r() * 0.5, 1);
    }
    for (let i = 0; i < 14; i++) kp.box('brick', lx0 + (r() - 0.5) * 2.2, 0.035 + r() * 0.1, lz + (r() - 0.5) * 3, 0.22, 0.07, 0.1, r() * 0.6, r() * 3, r() * 0.6);
    col(lx0, 0.25, lz, 0.9, 0.25, 1.3);
  }
  function sheets(sx, lz) {
    // chapas do telhado caídas, encostadas na parede (inclinadas)
    for (let i = 0; i < 2 + ((r() * 3) | 0); i++) {
      const tilt = 0.18 + r() * 0.2, Ls = 2.4;
      kp.box('sheet', sx * (wallIn - Math.sin(tilt) * Ls / 2 - 0.05), Math.cos(tilt) * Ls / 2, lz + i * 0.55, 0.02, Ls, 0.9, 0, 0, sx * tilt);
    }
  }
  const kinds = [[machine, o.noMachines ? 0 : 3], [pallets, 2.5], [crates, 2], [rack, 2], [rubble, 1.2], [sheets, 0.8], [null, 1.2]];
  const pick = () => { const tot = kinds.reduce((a, k) => a + k[1], 0); let v = r() * tot; for (const k of kinds) { v -= k[1]; if (v <= 0) return k[0]; } return null; };
  for (const sx of [-1, 1]) {
    for (let lz = -len / 2 + 5; lz <= len / 2 - 5; lz += 5.6) {
      const f = pick();
      if (f) f(sx, lz + (r() - 0.5) * 0.8);
      else if (r() < 0.6) { const [bx, bz] = at(wallX(sx, 1.4), lz); barrels(w, bx, bz, 3 + ((r() * 3) | 0), (seed * 7 + lz * 13) | 0); }
    }
  }
  // tábuas e caixotes soltos no chão (fora do corredor central)
  for (let i = 0; i < (o.noMachines ? 0 : len / 6); i++) { // no Galpão A o meio já tem máquinas
    const sx = r() < 0.5 ? -1 : 1, lx = sx * (inner * 0.6 + r() * 1.2), lz = (r() - 0.5) * (len - 8);
    if (r() < 0.6) kp.box('wood', lx, 0.012, lz, 0.18, 0.024, 1.6 + r() * 1.6, 0, r() * 3, 0);
    else crate(lx, 0, lz, 0.5 + r() * 0.2);
  }
  // luminárias industriais penduradas no meio (apagadas: galpão abandonado)
  for (let lz = -len / 2 + 6; lz < len / 2 - 2; lz += 12) {
    const y = H - 3.0;
    kp.rod('cable', [0, H - 0.6, lz], [0, y + 0.02, lz], 0.008, 4);
    kb.lathe('lamp', [[0.03, 0], [0.09, -0.04], [0.32, -0.3], [0.34, -0.33]], 0, y, lz, 'y', 24);
  }
  kb.build(w.root, mats); kp.build(w.root, mats);
}

// tambor de 200 L: r = 0,29 m, altura 0,88 m; dois frisos de rolagem, borda na tampa e no fundo
let DRUM_GEO = null;
function drumGeometry() {
  if (DRUM_GEO) return DRUM_GEO;
  const R = 0.29, H = 0.88, pts = [];
  const add = (r, h) => pts.push(new THREE.Vector2(r, h));
  add(0.001, 0.012); add(R - 0.03, 0.012); add(R - 0.02, 0.0); add(R + 0.004, 0.0); add(R + 0.006, 0.028); add(R - 0.006, 0.04);
  for (const hc of [H * 0.33, H * 0.67]) { add(R - 0.006, hc - 0.03); add(R + 0.008, hc - 0.012); add(R + 0.008, hc + 0.012); add(R - 0.006, hc + 0.03); }
  add(R - 0.006, H - 0.04); add(R + 0.006, H - 0.028); add(R + 0.004, H); add(R - 0.02, H); add(R - 0.03, H - 0.012); add(0.001, H - 0.012);
  const body = new THREE.LatheGeometry(pts, 28);
  // bujões na tampa (um grande, um pequeno)
  const g1 = new THREE.CylinderGeometry(0.035, 0.035, 0.02, 10); g1.translate(0.17, H - 0.004, 0);
  const g2 = new THREE.CylinderGeometry(0.022, 0.022, 0.02, 10); g2.translate(-0.17, H - 0.004, 0.04);
  DRUM_GEO = mergeSimple([body, g1, g2]);
  DRUM_GEO.computeVertexNormals();
  return DRUM_GEO;
}
function barrels(w, x, z, n, seed) {
  const r = rng(seed);
  const mats = [0x2f4f7a, 0x7a2f22, 0x3d5a2a, 0x8a6a1e].map((c) => w.mat('barrel' + c, () => new THREE.MeshStandardMaterial({ map: tex('rust'), color: c, roughness: 0.7, metalness: 0.45 })));
  const geo = drumGeometry(), placed = [];
  for (let i = 0, tries = 0; i < n && tries < 80; tries++) {
    const lying = r() < 0.25;
    const bx = x + (r() - 0.5) * 4.5, bz = z + (r() - 0.5) * 4.5, need = lying ? 1.12 : 0.66;
    if (placed.some((p) => Math.hypot(p[0] - bx, p[1] - bz) < (need + p[2]) / 2 + 0.02)) continue;
    placed.push([bx, bz, need]);
    const gy = w.groundHeight(bx, bz);
    const m = new THREE.Mesh(geo, mats[(r() * mats.length) | 0]);
    m.castShadow = true; m.receiveShadow = true;
    if (lying) {
      // deitado: eixo na horizontal, apoiado no chão (centro a 0,29 m), girado em torno do próprio centro
      const yaw = r() * Math.PI;
      m.rotation.set(0, yaw, Math.PI / 2, 'YXZ');
      m.position.set(bx + Math.cos(yaw) * 0.44, gy + 0.29, bz - Math.sin(yaw) * 0.44);
      w.root.add(m);
      w.addCollider(bx, gy + 0.29, bz, 0.44, 0.29, 0.26, yaw);
    } else {
      m.rotation.y = r() * Math.PI * 2; m.position.set(bx, gy, bz); w.root.add(m);
      w.addCollider(bx, gy + 0.44, bz, 0.26, 0.44, 0.26, 0);
      w.addCollider(bx, gy + 0.44, bz, 0.26, 0.44, 0.26, Math.PI / 4);
    }
    i++;
  }
}

// As Três Caixas d'Água de Porto Velho ("Três Marias", Chicago Bridge & Iron Works, 1910-1912, 200 mil litros cada):
// tanque de chapa rebitada com teto cônico e fundo arredondado, passadiço com guarda-corpo, quatro pernas
// inclinadas com travessas e contraventamento em X, e o tubo de subida no meio. Pintadas de grafite.
function caixaDagua(w, x, z, yaw = 0) {
  const paint = w.mat('tankPaint', () => new THREE.MeshStandardMaterial({ map: tex('rust'), color: 0x3a3e42, roughness: 0.55, metalness: 0.55 }));
  const dark = w.mat('tankDark', () => new THREE.MeshStandardMaterial({ map: tex('metal'), color: 0x2a2d30, roughness: 0.6, metalness: 0.6, side: THREE.DoubleSide }));
  const gy = w.groundHeight(x, z);
  const R = 3.0, Y0 = 12.4, BOWL = 2.2, CYL = 6.4, ROOF = 1.9;
  const Yb = Y0 + BOWL, Yt = Yb + CYL;
  // corpo: fundo arredondado + cilindro + beiral + cone + pináculo (um só torno)
  const pts = [];
  for (let i = 0; i <= 8; i++) { const t = (i / 8) * Math.PI / 2; pts.push(new THREE.Vector2(Math.max(0.001, R * Math.sin(t)), Y0 + BOWL * (1 - Math.cos(t)))); }
  pts.push(new THREE.Vector2(R, Yt), new THREE.Vector2(R + 0.28, Yt - 0.05), new THREE.Vector2(R + 0.3, Yt + 0.08));
  pts.push(new THREE.Vector2(0.32, Yt + ROOF), new THREE.Vector2(0.18, Yt + ROOF + 0.05), new THREE.Vector2(0.12, Yt + ROOF + 0.45));
  pts.push(new THREE.Vector2(0.2, Yt + ROOF + 0.55), new THREE.Vector2(0.001, Yt + ROOF + 0.75));
  w.mesh(new THREE.LatheGeometry(pts, 36), paint, x, gy, z);
  // emendas das chapas (anéis rebitados)
  for (const y of [Yb + 2.1, Yb + 4.2]) { const t = new THREE.Mesh(new THREE.TorusGeometry(R + 0.01, 0.035, 5, 48), dark); t.rotation.x = Math.PI / 2; t.position.set(x, gy + y, z); w.root.add(t); }
  // passadiço na junção do fundo com o cilindro: piso em anel, saia, guarda-corpo e montantes
  const deck = new THREE.Mesh(new THREE.RingGeometry(R - 0.05, R + 0.75, 40), dark); deck.rotation.x = -Math.PI / 2; deck.position.set(x, gy + Yb - 0.02, z); deck.castShadow = true; w.root.add(deck);
  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.75, R + 0.75, 0.12, 40, 1, true), dark); skirt.position.set(x, gy + Yb - 0.06, z); w.root.add(skirt);
  for (const hh of [0.5, 1.0]) { const t = new THREE.Mesh(new THREE.TorusGeometry(R + 0.72, 0.03, 5, 48), dark); t.rotation.x = Math.PI / 2; t.position.set(x, gy + Yb + hh, z); w.root.add(t); }
  for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2; const p = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.0, 5), dark); p.position.set(x + Math.cos(a) * (R + 0.72), gy + Yb + 0.5, z + Math.sin(a) * (R + 0.72)); w.root.add(p); }
  // quatro pernas inclinadas (do chão, raio 4,4 m, até o passadiço, raio 3 m)
  const RB = 4.4, RT = R, legs = [];
  const beam = (ax, ay, az, bx, by, bz, th, mat) => {
    const A = new THREE.Vector3(ax, ay, az), B = new THREE.Vector3(bx, by, bz), L = A.distanceTo(B);
    const m = new THREE.Mesh(new THREE.BoxGeometry(th, L, th), mat);
    m.position.copy(A).add(B).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize());
    m.castShadow = true; m.receiveShadow = true; w.root.add(m);
  };
  const conc = w.mat('concMat', () => new THREE.MeshStandardMaterial({ map: rep(tex('concrete'), 0.5, 0.5), roughness: 0.95 }));
  for (let i = 0; i < 4; i++) {
    const a = yaw + Math.PI / 4 + i * Math.PI / 2;
    legs.push((y) => { const k = y / Yb, rr = RB + (RT - RB) * k; return [x + Math.cos(a) * rr, gy + y, z + Math.sin(a) * rr]; });
    const p0 = legs[i](0), p1 = legs[i](Yb);
    beam(...p0, ...p1, 0.34, paint);
    w.box(p0[0], gy - 0.2, p0[2], 1.0, 0.5, 1.0, conc, 0, { collide: false }); // sapata
    w.addCollider((p0[0] + p1[0]) / 2, gy + Yb / 2, (p0[2] + p1[2]) / 2, 0.3, Yb / 2, 0.3, -a);
  }
  // travessas em 3 níveis e contraventamento em X (tirantes finos) entre elas
  const levels = [0.6, 4.6, 8.6, 12.2];
  for (let i = 0; i < 4; i++) {
    const L0 = legs[i], L1 = legs[(i + 1) % 4];
    for (let k = 1; k < levels.length; k++) beam(...L0(levels[k]), ...L1(levels[k]), 0.2, paint);
    for (let k = 0; k + 1 < levels.length; k++) {
      beam(...L0(levels[k]), ...L1(levels[k + 1]), 0.05, dark);
      beam(...L1(levels[k]), ...L0(levels[k + 1]), 0.05, dark);
    }
  }
  // tubo de subida no meio
  const riser = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, Y0 + 0.2, 16), dark); riser.position.set(x, gy + (Y0 + 0.2) / 2, z); riser.castShadow = true; w.root.add(riser);
  w.addCollider(x, gy + Y0 / 2, z, 0.3, Y0 / 2, 0.3, 0);
  // corpo do tanque (física do navegador: octógonos no cilindro, no fundo e no teto; disco do passadiço)
  w.addCollider(x, gy + (Yb + Yt) / 2, z, R * 0.93, CYL / 2 + 0.1, R * 0.93, 0);
  w.addCollider(x, gy + (Yb + Yt) / 2, z, R * 0.93, CYL / 2 + 0.1, R * 0.93, Math.PI / 4);
  w.addCollider(x, gy + Y0 + BOWL * 0.5, z, R * 0.62, BOWL * 0.5, R * 0.62, 0);
  w.addCollider(x, gy + Y0 + BOWL * 0.5, z, R * 0.62, BOWL * 0.5, R * 0.62, Math.PI / 4);
  w.addCollider(x, gy + Yt + ROOF * 0.35, z, R * 0.6, ROOF * 0.35, R * 0.6, Math.PI / 8);
  w.addCollider(x, gy + Yb, z, (R + 0.75) * 0.93, 0.08, (R + 0.75) * 0.93, Math.PI / 8);
}

// =====================================================================
// FÁBRICA ABANDONADA
// =====================================================================
// Pátio em "U" de galpões de tijolo, trilhos com vagão vermelho, quatro chaminés,
// caixa d'água, cerca, mato alto e floresta em morros ao redor (céu nublado).
const FX = { x0: -66, x1: 66, z0: -150, z1: 66 }; // área plana da fábrica
function factory(w, opts) {
  w.bounds = 330;
  w.sheds = [];
  w.paved = []; // retângulos de piso (asfalto, leito dos trilhos): o gramado é o que sobra
  w.atmosphere({
    zenith: 0x5f6873, horizon: 0xaeb3b2, ground: 0x4d5a3a, sunDir: [0.35, 0.55, -0.6], sunColor: 0xfff2e0, sunGlow: 0.35, sunSize: 0,
    cloudCover: 0.88, cloudColor: 0xbfc3c5, cloudShadow: 0x737a82, cloudScale: 1.0,
    fog: 0x9da3a3, fogDensity: 0.0024, hemiSky: 0xc4ccd4, hemiGround: 0x4a5236, hemi: 1.15,
    lightColor: 0xfff1de, sunIntensity: 1.5, envIntensity: 0.8, bloom: 0.12, exposure: 1.0,
  });
  // terreno: plano na fábrica, morros com floresta em volta
  const flat = (x, z) => {
    const dx = Math.max(FX.x0 - x, 0, x - FX.x1), dz = Math.max(FX.z0 - z, 0, z - FX.z1);
    return Math.hypot(dx, dz);
  };
  const hfn = (x, z) => {
    const d = flat(x, z);
    const hills = 22 + 50 * fbm(x / 260 + 3, z / 260 + 1, 4);
    return smooth(25, 170, d) * hills + smooth(10, 60, d) * (fbm(x / 40, z / 40, 3) - 0.5) * 6;
  };
  w.terrain(1800, 180, hfn, (x, y, z, slope) => {
    const v = fbm(x / 60, z / 60, 3);
    return [0.72 + v * 0.3 - slope * 0.1, 0.78 + v * 0.25 - slope * 0.08, 0.6 + v * 0.15];
  }, tex('grass'), 180);
  const ground = (x, z) => w.groundHeight(x, z);

  // asfalto: pátio central e anel de ruas
  const asphalt = new THREE.MeshStandardMaterial({ map: rep(tex('asphalt'), 1, 1), roughness: 0.92 });
  const slab = (x0, z0, x1, z1) => {
    w.paved.push([x0, z0, x1, z1]);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), asphalt.clone());
    m.material.map = rep(tex('asphalt'), (x1 - x0) / 8, (z1 - z0) / 8);
    m.rotation.x = -Math.PI / 2; m.position.set((x0 + x1) / 2, 0.02, (z0 + z1) / 2); m.receiveShadow = true; w.root.add(m);
  };
  slab(-12, -88, 12, 60);    // pátio entre os galpões
  slab(-62, 34, 62, 48);     // rua sul
  slab(46, -132, 60, 48);    // rua leste
  slab(-66, -132, -52, 48);  // rua oeste
  slab(-62, -142, 62, -130); // rua norte (atrás das chaminés)
  slab(-6, -104, 6, -84);    // passagem

  // galpões
  shed(w, -24, -35, 80, 20, 10, 5, 0, { front: [8, 7], back: [8, 7] }); // Galpão A (oco, atravessável)
  shed(w, -43, -8, 28, 12, 7, 3.5, 0);                                   // anexo
  shed(w, 22, -50, 52, 16, 9, 4.5, 0);                                   // Galpão B1
  shed(w, 22, 2, 38, 16, 9, 4.5, 0);                                     // Galpão B2 (vão de 6 m entre B1 e B2)
  shed(w, -26, -95, 38, 14, 12, 5, Math.PI / 2);                         // fundo esquerdo
  shed(w, 26, -95, 38, 14, 12, 5, Math.PI / 2);                          // fundo direito (passagem no meio)
  if (!opts.lowDetail) w.sheds.forEach((s, i) => shedProps(w, s, 101 + i * 17, i === 0 ? { inner: 7.6, noMachines: true } : {}));
  // ponte de tubos sobre a passagem
  const pipe = w.mat('pipe', () => new THREE.MeshStandardMaterial({ color: 0x8a8d90, metalness: 0.8, roughness: 0.4 }));
  for (const dz of [-1, 1]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 14, 14), pipe); p.rotation.z = Math.PI / 2; p.position.set(0, 10.5, -95 + dz * 1.1); p.castShadow = true; w.root.add(p); }
  w.addCollider(0, 10.5, -95, 7, 0.5, 1.7, 0);

  // interior do Galpão A: pilares, ponte rolante e máquinas
  const steel = w.mat('steel', () => new THREE.MeshStandardMaterial({ map: tex('metal'), roughness: 0.6, metalness: 0.6 }));
  for (let z = -70; z <= 0; z += 10) for (const x of [-31, -17]) w.box(x, 0, z, 0.5, 10, 0.5, steel);
  for (const x of [-31, -17]) w.box(x, 8, -35, 0.6, 0.7, 78, steel);
  const yellow = w.mat('yellowSteel', () => new THREE.MeshStandardMaterial({ color: 0xc89b1e, roughness: 0.55, metalness: 0.5 }));
  w.box(-24, 8.7, -48, 15, 0.8, 1.2, yellow);
  w.box(-29, 4, -48, 0.08, 4.6, 0.08, steel, 0, { collide: false }); w.box(-29, 3.4, -48, 1, 0.6, 1, steel);
  const r = rng(11);
  for (let i = 0; i < 6; i++) w.box(-24 + (i % 2 ? 4.5 : -4.5), 0, -66 + i * 11, 2 + r() * 2, 1 + r() * 1.6, 3 + r() * 2, steel);

  // trilhos e vagões
  railTrack(w, -4, -86, 160); railTrack(w, 4, -86, 160);
  if (opts.lowDetail) { boxcar(w, 4, -28, 0, 0xffffff); boxcar(w, -4, -60, 0, 0x8c8c8c); }
  else {
    // trem da Madeira-Mamoré (Porto Velho): Locomotiva 7 + tender + vagão de passageiros; vagão de carga no outro trilho
    buildTrain(w, { tex, rep }, 4, -8, 0, ['loco', 'coach']);
    buildTrain(w, { tex, rep }, -4, -50, 0, ['boxcar']);
  }

  // chaminés (como na tela de pausa do original)
  chimney(w, -16, -116, 42, 2.4, { holes: [[20, 0.4, 0.9], [31, -0.3, 0.6]] });
  chimney(w, -3, -121, 47, 2.6, { gallery: true });
  chimney(w, 10, -114, 40, 2.3, { holes: [[24, 0.2, 1.1]] });
  chimney(w, 24, -124, 34, 2.1, {});

  // As Três Caixas d'Água de Porto Velho, em fila ao longo da rua leste
  caixaDagua(w, 53.5, -64); caixaDagua(w, 52.5, -79); caixaDagua(w, 53.5, -94);

  // cerca de tela e muros
  fence(w, 64, -140, 64, 62); fence(w, -64, 62, 64, 62); fence(w, -70, -140, -70, 62);

  // tambores, pichações
  barrels(w, -12, 30, 6, 3); barrels(w, 13, -70, 5, 7); barrels(w, -50, 26, 4, 9); barrels(w, 40, -100, 5, 13);
  graffiti(w, 13.65, 2.2, -38, Math.PI / 2, 6, 3, 1);
  graffiti(w, -13.65, 2.2, -12, -Math.PI / 2, 5, 2.5, 2);
  graffiti(w, 13.65, 2.4, 10, Math.PI / 2, 5, 2.5, 3);
  graffiti(w, -26, 2.4, -87.65, 0, 7, 3, 4);

  // prédios de apartamentos ao longe (vistos no original)
  const apt = w.mat('aptMat', () => new THREE.MeshStandardMaterial({ map: tex('apartments'), roughness: 0.9 }));
  for (const [x, z, len, yaw] of [[230, -40, 60, 0.2], [260, 30, 45, 0.5], [210, 80, 50, 0.1], [-250, -120, 55, -0.3], [150, -260, 60, 1.2]]) {
    const gy = ground(x, z) - 2;
    w.box(x, gy, z, len, 30, 12, apt, yaw, { uv: 8, uvv: 8, collide: false, shadow: false });
  }

  const blds = w.boxes.filter((b) => b.h[1] > 3 && b.rad < 60);
  // floresta nos morros + árvores de folha larga perto dos galpões
  const rr = rng(42);
  const inSite = (x, z, m) => x > FX.x0 - m && x < FX.x1 + m && z > FX.z0 - m && z < FX.z1 + m;
  const conifers = [], broad = [];
  const dense = opts.lowDetail ? 2500 : 9000;
  for (let i = 0; i < dense; i++) {
    const a = rr() * Math.PI * 2, d = 60 + Math.pow(rr(), 0.85) * 660;
    const x = Math.cos(a) * d * 1.1, z = -40 + Math.sin(a) * d;
    if (inSite(x, z, 12)) continue;
    if (fbm(x / 120, z / 120, 2) < 0.33) continue; // clareiras
    const h = 12 + rr() * 12;
    const con = rr() < 0.7;
    const t = { x, z, y: ground(x, z), h: con ? h : h * 0.75, w: con ? h * (0.5 + rr() * 0.12) : h * 0.75 * 0.9, rot: rr() * 3, tint: rr() };
    (con ? conifers : broad).push(t);
  }
  for (let i = 0; i < 26; i++) {
    const side = rr() < 0.5;
    const x = side ? 36 + rr() * 8 : -56 + rr() * 6, z = -120 + rr() * 170;
    if (Math.abs(x - 53) < 9 && Math.abs(z + 79) < 24) continue; // caixas d'água
    if (w.sheds.some((s) => { const [lx, lz] = rot(x - s.cx, z - s.cz, -s.yaw); return Math.abs(lx) < s.wid / 2 + 2.5 && Math.abs(lz) < s.len / 2 + 2.5; })) continue; // galpões
    const h = 8 + rr() * 6;
    broad.push({ x, z, y: 0, h, w: h * 0.85, rot: rr() * 3, tint: rr() });
  }
  const fc = w.forest(conifers, 'conifer');
  const fb = w.forest(broad, 'broadleaf');
  w.treeColliders(conifers, fc);
  w.treeColliders(broad, fb);
  // mato alto
  if (!opts.noGrass) {
    const pts = [];
    const tryPt = (x, z) => {
      if (x > -14 && x < 14 && z > -90 && z < 62) return; // pátio
      if (z > 32 && z < 50 && x > -64 && x < 64) return; // rua sul
      if ((x > 44 && x < 62) || (x < -50 && x > -68)) { if (z > -134 && z < 50) return; }
      if (z > -142 && z < -128) return;
      for (const s of w.sheds) { const [lx, lz] = rot(x - s.cx, z - s.cz, -s.yaw); if (Math.abs(lx) < s.wid / 2 + 1.2 && Math.abs(lz) < s.len / 2 + 1.2) return; } // dentro do galpão
      for (const b of blds) { const dx = x - b.c[0], dz = z - b.c[2]; const lx = Math.abs(dx * b.cos - dz * b.sin), lz = Math.abs(dx * b.sin + dz * b.cos); if (lx < b.h[0] + 1.2 && lz < b.h[2] + 1.2) return; }
      pts.push([x, ground(x, z), z, rr() * 3, rr()]);
    };
    if (opts.lowDetail) {
      for (let i = 0; i < 2500; i++) {
        const cx = -80 + rr() * 160, cz = -150 + rr() * 230;
        if (fbm(cx / 18, cz / 18, 2) < 0.42) continue;
        tryPt(cx, cz);
      }
      w.grassField(pts, 1.1);
    } else {
      const allowed = (x, z) => { const n0 = pts.length; tryPt(x, z); const ok = pts.length > n0; if (ok) pts.pop(); return ok; };
      const dens = (x, z) => {
        if (!allowed(x, z)) return 0;
        const patchy = smooth(0.25, 0.6, fbm(x / 18, z / 18, 2));
        const far = smooth(70, 140, Math.hypot(x, z + 40));
        return Math.max(0.12, patchy) * (1 - far * 0.6);
      };
      w.addGrass([-220, -300, 220, 200], dens, { perM2: 48, patch: 50, height: 0.85, colors: 'lawn' });
      // segunda camada: mais rala e longe, para a grama não acabar numa linha
      w.addGrass([-220, -300, 220, 200], dens, { perM2: 9, patch: 130, height: 0.8, width: 0.11, fadeStart: 0.3, colors: 'lawn' });
    }
  }
}
const FACTORY_TRACK = [
  { x: 0, z: 15, yaw: 0, w: 4, h: 3 },
  { x: 0, z: -50, y: 2.5, yaw: 0, w: 3.6, h: 2.6 },
  { x: 0, z: -95, yaw: 0, w: 5, h: 4.5 },                       // passagem sob os tubos
  { x: -30, z: -108, y: 1.5, yaw: Math.PI / 2, w: 4, h: 3 },    // diante das chaminés
  { x: -58, z: -92, yaw: Math.PI, w: 4, h: 3 },                 // rua oeste
  { x: -24, z: -70, yaw: Math.PI, w: 6, h: 5 },                 // entra no Galpão A
  { x: -24, z: -35, y: 1, yaw: Math.PI, w: 4, h: 3 },           // dentro do galpão
  { x: -24, z: 8, yaw: Math.PI, w: 6, h: 5 },                   // sai do galpão
  { x: -6, z: 41, yaw: -Math.PI / 2, w: 4, h: 3 },              // rua sul
];

// =====================================================================
// ESTÁDIO (noturno, arquibancadas vermelhas e brancas, cobertura com refletores)
// =====================================================================
// ---------- camarotes do estádio: interior visto pelo vidro espelhado (um módulo de 8 m, repetido) ----------
function skyboxTextures() {
  if (TEX.__sky) return TEX.__sky;
  const W = 1024, H = 384, mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
  const cc = mk(), ec = mk(), g = cc.getContext('2d'), e = ec.getContext('2d'), rnd = rng(55);
  e.fillStyle = '#000'; e.fillRect(0, 0, W, H);
  for (let b = 0; b < 2; b++) {           // 2 camarotes de 4 m por módulo
    const x0 = b * W / 2, x1 = x0 + W / 2;
    const warm = 0.7 + rnd() * 0.3, on = rnd() < 0.85;
    const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, `rgb(${58 * warm | 0},${50 * warm | 0},${40 * warm | 0})`); bg.addColorStop(1, '#141210');
    g.fillStyle = bg; g.fillRect(x0, 0, W / 2, H);
    // parede do fundo com quadro/TV e porta
    g.fillStyle = '#2a2622'; g.fillRect(x0 + 40, 90, W / 2 - 80, 150);
    g.fillStyle = on ? '#3b5a7a' : '#101418'; g.fillRect(x0 + 200, 110, 110, 64);
    g.fillStyle = '#1a1714'; g.fillRect(x0 + 380, 100, 70, 160);
    // luzes do teto (quentes) + brilho
    for (let i = 0; i < 4; i++) {
      const lx = x0 + 64 + i * 120;
      g.fillStyle = on ? '#ffe4b5' : '#3a3630'; g.fillRect(lx - 18, 14, 36, 8);
      if (on) { e.fillStyle = '#ffd9a0'; e.fillRect(lx - 18, 14, 36, 8); const gl = e.createRadialGradient(lx, 18, 2, lx, 18, 60); gl.addColorStop(0, 'rgba(255,200,140,0.35)'); gl.addColorStop(1, 'rgba(255,200,140,0)'); e.fillStyle = gl; e.fillRect(lx - 60, 0, 120, 90); }
    }
    // duas fileiras de poltronas (encostos) e mesa/bancada
    for (const [y, n] of [[262, 7], [312, 8]]) for (let i = 0; i < n; i++) { const sx = x0 + 30 + i * ((W / 2 - 60) / n); g.fillStyle = b ? '#5e1416' : '#1e2a44'; g.fillRect(sx, y, 40, 34); g.fillStyle = 'rgba(0,0,0,0.4)'; g.fillRect(sx, y + 28, 40, 6); }
    // algumas pessoas (silhuetas) quando o camarote está aceso
    if (on) for (let i = 0; i < 2 + rnd() * 4; i++) { const px = x0 + 50 + rnd() * (W / 2 - 100); g.fillStyle = `rgb(${20 + rnd() * 30 | 0},${18 + rnd() * 20 | 0},${16 + rnd() * 16 | 0})`; g.beginPath(); g.arc(px, 222, 14, 0, Math.PI * 2); g.fill(); g.fillRect(px - 20, 236, 40, 60); }
    g.fillStyle = '#3a3530'; g.fillRect(x0, 350, W / 2, 34);
    // sala acesa: o interior inteiro brilha fraco (visto de fora à noite), luzes por cima
    if (on) {
      e.save(); e.globalAlpha = 0.8 * warm; e.drawImage(cc, x0, 0, W / 2, H, x0, 0, W / 2, H); e.restore();
      for (let i = 0; i < 4; i++) { const lx = x0 + 64 + i * 120; e.fillStyle = '#ffd9a0'; e.fillRect(lx - 18, 14, 36, 8); }
    }
    // divisória entre camarotes
    g.fillStyle = '#0c0b0a'; g.fillRect(x1 - 10, 0, 20, H);
  }
  const tx = (c) => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; t.anisotropy = 8; return t; };
  return (TEX.__sky = { map: tx(cc), emissiveMap: tx(ec) });
}
// fachada de vidro inclinada dos camarotes (coordenadas locais do lado da arquibancada)
function skyboxFront(grp, len, zf, y0, h, mats) {
  const k = new Kit(), th = -0.17, cy = y0 + h / 2, up = [Math.cos(th), Math.sin(th)];
  const glass = new THREE.PlaneGeometry(len, h), uv = glass.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * len / 8);
  k.add('glass', glass, 0, cy, zf, th, Math.PI, 0);
  for (let x = -len / 2; x <= len / 2 + 0.01; x += 1.6) k.box('alu', x, cy, zf - 0.04, 0.07, h + 0.05, 0.12, th, 0, 0);
  for (const f of [-0.5, 0.5, -0.17]) k.box('alu', 0, cy + f * h * up[0], zf + f * h * up[1] - 0.04, len, f === -0.17 ? 0.05 : 0.1, 0.13, th, 0, 0);
  k.box('slab', 0, y0 - 0.15, zf - 0.45, len, 0.3, 1.3);                 // laje (beiral)
  k.rod('alu', [-len / 2, y0 + 1.0, zf - 1.0], [len / 2, y0 + 1.0, zf - 1.0], 0.03);   // guarda-corpo
  for (let x = -len / 2; x <= len / 2; x += 2) k.rod('alu', [x, y0, zf - 1.0], [x, y0 + 1.0, zf - 1.0], 0.02);
  k.build(grp, mats, { shadow: { glass: false } });
}

function stadium(w) {
  w.bounds = 150;
  w.atmosphere({
    zenith: 0x05070c, horizon: 0x161c27, ground: 0x0b0d10, sunDir: [-0.45, 0.55, -0.6], sunColor: 0xdfe8ff, sunGlow: 1.2, sunSize: 3,
    cloudCover: 0.45, cloudColor: 0x3a404a, cloudShadow: 0x0d1016, cloudScale: 1.6, stars: 0.6,
    fog: 0x10141b, fogDensity: 0.0016, hemiSky: 0x7c8db0, hemiGround: 0x1b2416, hemi: 0.55,
    lightColor: 0xf3f6ff, lightDir: [0.25, 1, 0.35], sunIntensity: 3.2, envIntensity: 0.35, bloom: 0.55, exposure: 1.05,
  });
  // campo
  const grassMat = new THREE.MeshStandardMaterial({ map: rep(tex('grass'), 30, 20), roughness: 1, color: 0x88aa77 });
  const g0 = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), grassMat); g0.rotation.x = -Math.PI / 2; g0.receiveShadow = true; w.root.add(g0);
  const layer = (m, n) => { m.polygonOffset = true; m.polygonOffsetFactor = -n; m.polygonOffsetUnits = -4 * n; return m; };
  const field = new THREE.Mesh(new THREE.PlaneGeometry(111, 74), layer(new THREE.MeshStandardMaterial({ map: tex('field'), roughness: 0.95 }), 3));
  field.rotation.x = -Math.PI / 2; field.position.y = 0.02; field.receiveShadow = true; w.root.add(field);
  const track = new THREE.Mesh(new THREE.PlaneGeometry(146, 82), layer(new THREE.MeshStandardMaterial({ color: 0x4a2a24, roughness: 1 }), 1));
  track.rotation.x = -Math.PI / 2; track.position.y = 0.01; track.receiveShadow = true; w.root.add(track);
  if (!w.opts.lowDetail) w.addGrass([-56, -37.5, 56, 37.5], (x, z) => (Math.abs(x) < 55.4 && Math.abs(z) < 36.9 ? 1 : 0), { perM2: 150, patch: 30, height: 0.07, width: 0.02, colors: 'pitch', y0: 0.02, colorTex: tex('field'), colorRect: [-55.5, -37, 111, 74] });
  const centerG = new THREE.Mesh(new THREE.PlaneGeometry(126, 77), layer(grassMat.clone(), 2)); centerG.rotation.x = -Math.PI / 2; centerG.position.y = 0.015; centerG.receiveShadow = true; w.root.add(centerG);

  const conc = w.mat('stConc', () => new THREE.MeshStandardMaterial({ map: rep(tex('concrete'), 0.25, 0.25), roughness: 0.9, color: 0xb5b5b0 }));
  const dark = w.mat('stDark', () => new THREE.MeshStandardMaterial({ color: 0x1d1f23, roughness: 0.6, metalness: 0.3 }));
  const glassBox = w.mat('stGlass', () => new THREE.MeshStandardMaterial({ color: 0x0c1118, roughness: 0.1, metalness: 0.6, emissive: 0x1a2a40, emissiveIntensity: 0.6 }));
  const roofUnder = w.mat('stRoof', () => new THREE.MeshStandardMaterial({ color: 0x8c8f93, roughness: 0.7, metalness: 0.3, side: THREE.DoubleSide }));
  const lampMat = w.mat('stLamp', () => new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffffff).multiplyScalar(6) }));
  const seatR = (u, v) => new THREE.MeshStandardMaterial({ map: rep(tex('seatsRed'), u, v), roughness: 0.75 });
  const seatW = (u, v) => new THREE.MeshStandardMaterial({ map: rep(tex('seatsWhite'), u, v), roughness: 0.75 });

  // um lado de arquibancada; d0 = distância do campo, len = comprimento
  const side = (d0, len, yaw) => {
    const grp = new THREE.Group(); grp.rotation.y = yaw; w.root.add(grp);
    const at = (lx, lz) => rot(lx, lz, yaw);
    const B = (lx, y, lz, sx, sy, sz, mat, o = {}) => { const [x, z] = at(lx, lz); return w.box(x, y, z, sx, sy, sz, mat, yaw, o); };
    B(0, 0, d0 + 0.4, len, 2.6, 0.8, dark, { uv: 4 });
    const tier = (z0, z1, y0, y1, rows, white) => {
      const depth = z1 - z0, rise = y1 - y0, sl = Math.hypot(depth, rise), th = Math.atan2(rise, depth);
      const geo = new THREE.PlaneGeometry(len, sl); geo.rotateX(-Math.PI / 2);
      const mk = (mat, x0, x1) => {
        const gg = new THREE.PlaneGeometry(x1 - x0, sl); gg.rotateX(-Math.PI / 2);
        const m = new THREE.Mesh(gg, mat); m.rotation.x = -th; m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); m.receiveShadow = true; grp.add(m);
      };
      // blocos vermelhos com faixas brancas
      const seg = len / 6;
      for (let i = 0; i < 6; i++) {
        const x0 = -len / 2 + i * seg;
        mk(white && (i === 2 || i === 3) ? seatW(seg / 8, rows / 4) : seatR(seg / 8, rows / 4), x0, x0 + seg);
      }
      const steps = 8;
      for (let k = 0; k < steps; k++) {
        const za = z0 + (depth * k) / steps, ya = y0 + (rise * (k + 1)) / steps;
        const [x, z] = at(0, (za + z1) / 2);
        w.addCollider(x, ya / 2, z, len / 2, ya / 2, (z1 - za) / 2, yaw);
      }
      // parede lateral (fecha o vão sob a arquibancada)
      B(0, 0, z1 + 0.3, len, y1, 0.6, conc, { uv: 4, collide: false });
    };
    tier(d0 + 1, d0 + 19, 2.6, 12.5, 24, false);
    if (w.opts.lowDetail) B(0, 12.5, d0 + 20, len, 3.2, 2, glassBox); // camarotes
    else {
      // camarotes: corpo recuado + fachada de vidro espelhado inclinada, com o interior aceso atrás
      B(0, 12.5, d0 + 20.6, len, 3.2, 1.4, dark);
      const sk = skyboxTextures(), map = sk.map.clone(), em = sk.emissiveMap.clone(); map.needsUpdate = em.needsUpdate = true;
      skyboxFront(grp, len, d0 + 19.45, 12.5, 3.2, {
        glass: new THREE.MeshStandardMaterial({ map, emissiveMap: em, emissive: 0xffffff, emissiveIntensity: 0.9, color: 0xc8d4dc, roughness: 0.05, metalness: 0.45 }),
        alu: w.mat('stAlu', () => new THREE.MeshStandardMaterial({ color: 0x9ea3a8, roughness: 0.35, metalness: 0.9 })),
        slab: conc,
      });
    }
    tier(d0 + 21, d0 + 37, 15.7, 31, 20, true);
    B(0, 0, d0 + 38.5, len, 35, 1, conc, { uv: 6 });            // fachada externa
    // cobertura com refletores na borda
    B(0, 36, d0 + 22, len, 1.2, 34, roofUnder);
    B(0, 34.8, d0 + 5.3, len, 1.4, 0.6, dark);
    for (let x = -len / 2 + 6; x <= len / 2 - 6; x += 12) {
      const [lx, lz] = at(x, d0 + 6);
      for (let k = 0; k < 6; k++) {
        const l = new THREE.Mesh(new THREE.CircleGeometry(0.28, 12), lampMat);
        l.position.set(lx + Math.cos(yaw) * ((k % 3) - 1) * 0.7, 35.0 - Math.floor(k / 3) * 0.7, lz - Math.sin(yaw) * ((k % 3) - 1) * 0.7);
        l.lookAt(0, 0, 0); w.root.add(l);
      }
    }
    for (let x = -len / 2 + 10; x <= len / 2 - 10; x += 20) B(x, 0, d0 + 37.6, 1, 36, 1, conc);
  };
  side(40, 144, 0);              // sul (z+)
  side(40, 144, Math.PI);        // norte
  side(72, 80, Math.PI / 2);     // oeste (x-)  — yaw π/2: z local -> -x
  side(72, 80, -Math.PI / 2);    // leste
  // cantos fechados
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    w.box(sx * 92, 0, sz * 60, 40, 36, 40, conc, 0, { uv: 6 });
  }
  // placar
  w.box(0, 22, -78, 26, 9, 1, dark);
  const sc = document.createElement('canvas'); sc.width = 512; sc.height = 180; const g = sc.getContext('2d');
  g.fillStyle = '#05070a'; g.fillRect(0, 0, 512, 180); g.fillStyle = '#e1232d'; g.font = 'bold 64px Montserrat, Arial'; g.textAlign = 'center'; g.fillText('FPV', 140, 110);
  g.fillStyle = '#f4f4f4'; g.fillText('00:00', 360, 110);
  const st = new THREE.CanvasTexture(sc); st.colorSpace = THREE.SRGBColorSpace;
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(25, 8.5), new THREE.MeshBasicMaterial({ map: st, color: 0xcccccc }));
  screen.position.set(0, 26.5, -77.45); w.root.add(screen);
  // andaime central e bandeiras de curva
  const scaff = w.mat('scaff', () => new THREE.MeshStandardMaterial({ color: 0xc9c9c9, metalness: 0.7, roughness: 0.35 }));
  for (const [x, z] of [[-4, -4], [4, -4], [-4, 4], [4, 4]]) w.box(x, 0, z, 0.3, 10, 0.3, scaff);
  w.box(0, 10, 0, 8.6, 0.4, 8.6, scaff);
  const flagMat = new THREE.MeshStandardMaterial({ color: 0xffd400, side: THREE.DoubleSide, emissive: 0x332a00 });
  const white = w.mat('goalWhite', () => new THREE.MeshStandardMaterial({ color: 0xf4f4f0, roughness: 0.4, metalness: 0.2 }));
  for (const [x, z] of [[-52.5, -34], [52.5, 34], [-52.5, 34], [52.5, -34]]) {
    w.box(x, 0, z, 0.05, 1.6, 0.05, white);
    const f = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.35), flagMat); f.position.set(x + 0.25, 1.4, z); w.root.add(f);
  }
  // gols: 7,32 m x 2,44 m, com rede
  const netTex = tex('goalNet');
  const netMat = (u, v) => { const t = netTex.clone(); t.needsUpdate = true; t.repeat.set(u, v); return new THREE.MeshStandardMaterial({ map: t, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide, roughness: 1 }); };
  for (const sx of [-1, 1]) {
    const x0 = sx * 52.56, xb = sx * 54.6, D = 2.0, GW = 7.32, GH = 2.44, p = 0.12;
    w.box(x0, 0, -GW / 2 - p / 2, p, GH, p, white);
    w.box(x0, 0, GW / 2 + p / 2, p, GH, p, white);
    w.box(x0, GH, 0, p, p, GW + 2 * p, white);
    w.box(xb, 0, -GW / 2, 0.06, GH * 0.9, 0.06, white, 0, { collide: false });
    w.box(xb, 0, GW / 2, 0.06, GH * 0.9, 0.06, white, 0, { collide: false });
    const back = new THREE.Mesh(new THREE.PlaneGeometry(GW, GH * 0.9), netMat(GW / 0.9, GH / 0.9)); back.position.set(xb, GH * 0.45, 0); back.rotation.y = Math.PI / 2; w.root.add(back);
    const roofLen = Math.hypot(D, GH * 0.1);
    const top = new THREE.Mesh(new THREE.PlaneGeometry(roofLen, GW), netMat(roofLen / 0.9, GW / 0.9));
    top.rotation.set(-Math.PI / 2, 0, 0); top.rotateY(Math.atan2(GH * 0.1, D) * sx); top.position.set((x0 + xb) / 2, GH * 0.95, 0); w.root.add(top);
    for (const sz of [-1, 1]) {
      const shape = new THREE.Shape(); shape.moveTo(0, 0); shape.lineTo(D, 0); shape.lineTo(D, GH * 0.9); shape.lineTo(0, GH); shape.lineTo(0, 0);
      const geo = new THREE.ShapeGeometry(shape); const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 0.9, uv.getY(i) / 0.9);
      const sideNet = new THREE.Mesh(geo, netMat(1, 1)); sideNet.position.set(x0, 0, sz * GW / 2); sideNet.scale.x = sx; w.root.add(sideNet);
    }
    // a rede segura o drone
    w.addCollider(xb, GH * 0.45, 0, 0.05, GH * 0.45, GW / 2, 0);
    w.addCollider((x0 + xb) / 2, GH * 0.95, 0, D / 2, 0.05, GW / 2, 0);
    for (const sz of [-1, 1]) w.addCollider((x0 + xb) / 2, GH / 2, sz * GW / 2, D / 2, GH / 2, 0.05, 0);
  }
  // placas de publicidade em volta do campo
  const adMat = (len) => { const t = tex('adBoards').clone(); t.needsUpdate = true; t.repeat.set(len / 48, 1); return new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: 0xffffff, emissiveIntensity: 0.55, roughness: 0.6 }); };
  const board = (x, z, len, yaw) => {
    w.box(x, 0, z, len, 0.9, 0.12, dark, yaw);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.86), adMat(len));
    m.position.set(x + Math.sin(yaw) * 0.07, 0.45, z + Math.cos(yaw) * 0.07); m.rotation.y = yaw; w.root.add(m);
  };
  board(0, 38.2, 110, Math.PI); board(0, -38.2, 110, 0);
  for (const sz of [-1, 1]) { board(-58.5, sz * 21, 24, Math.PI / 2); board(58.5, sz * 21, 24, -Math.PI / 2); }
}
const STADIUM_TRACK = [
  { x: 0, z: 22, yaw: 0 },
  { x: 0, z: -20, yaw: 0 },
  { x: -30, z: -32, yaw: Math.PI / 2 },
  { x: -46, z: -5, yaw: Math.PI },
  { x: -25, z: 18, yaw: -Math.PI / 2 },
  { x: 0, z: 0, y: 10.4, yaw: -Math.PI / 2, w: 3.6, h: 3 },
  { x: 30, z: -12, y: 4.2, yaw: -Math.PI / 2, w: 3, h: 2.2 },
  { x: 46, z: 5, yaw: Math.PI },
  { x: 25, z: 32, yaw: Math.PI / 2 },
];
const STADIUM_TECH = [
  { x: 0, z: 22, yaw: 0 },
  { x: -15, z: 0, yaw: 0.6 },
  { x: -40, z: -25, yaw: 0.9 },
  { x: -10, z: -36, y: 3, yaw: -Math.PI / 2 },
  { x: 20, z: -30, yaw: -2.2 },
  { x: 42, z: -2, yaw: Math.PI },
  { x: 20, z: 20, y: 5, yaw: Math.PI / 2 },
];

// =====================================================================
// CÂNION VERMELHO
// =====================================================================
function canyon(w, opts) {
  w.bounds = 380;
  w.atmosphere({
    zenith: 0x2f5ea8, horizon: 0xf0b07a, ground: 0x7a3b22, sunDir: [-0.6, 0.22, -0.45], sunColor: 0xffc890, sunGlow: 1.3, sunSize: 2,
    cloudCover: 0.32, cloudColor: 0xffe2c4, cloudShadow: 0xb07a68, cloudScale: 0.9,
    fog: 0xe0a676, fogDensity: 0.0019, hemiSky: 0x9fb8e0, hemiGround: 0x7a3b22, hemi: 0.75,
    lightColor: 0xffd2a0, sunIntensity: 2.8, envIntensity: 0.9, bloom: 0.3, exposure: 1.0,
  });
  const center = (z) => 45 * Math.sin(z / 70) + 20 * Math.sin(z / 23);
  const hfn = (x, z) => {
    const d = Math.abs(x - center(z));
    const canyonF = smooth(10, 34, d);
    const mesa = 30 + 10 * fbm(x / 90, z / 90, 3);
    let h = canyonF * mesa;
    h += (fbm(x / 25, z / 25, 4) - 0.5) * 6 * (0.3 + canyonF);
    h += Math.max(0, fbm(x / 140 + 7, z / 140, 2) - 0.55) * 120 * canyonF;
    return h;
  };
  const rockTex = canvasTex(512, 512, (g, ww, hh) => {
    g.fillStyle = '#b4583a'; g.fillRect(0, 0, ww, hh);
    speckle(g, ww, hh, 16000, ['#8a3d26', '#cf7a52', '#6e2e1c'], [1, 4], [0.15, 0.4]);
    for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(90,30,15,${Math.random() * 0.25})`; g.fillRect(0, Math.random() * hh, ww, 2 + Math.random() * 6); }
    blotches(g, ww, hh, 20, '#e0a07a', [20, 60], [0.08, 0.18]);
  });
  rockTex.userData.texName = 'canyonRock';
  w.terrain(760, 190, hfn, (x, y, z, slope) => {
    const t = clamp(y / 40, 0, 1);
    const flat = slope < 0.3 && y < 2 ? 1 : 0;
    return flat ? [0.75, 0.62, 0.48] : [0.85 + 0.15 * t - slope * 0.06, 0.62 + 0.12 * t - slope * 0.05, 0.55 + 0.05 * t];
  }, rockTex, 60);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(760, 760), new THREE.MeshStandardMaterial({ color: 0x2c6e7f, roughness: 0.08, metalness: 0.2, transparent: true, opacity: 0.85 }));
  water.rotation.x = -Math.PI / 2; water.position.y = -0.6; w.root.add(water);
  const rock = new THREE.MeshStandardMaterial({ map: rep(rockTex, 1, 1), roughness: 1, color: 0xe0a080 });
  const pillars = [[-60, 0.6], [-20, -0.5], [35, 0.4], [80, -0.6], [130, 0.3], [-110, -0.3], [170, 0.5]];
  for (const [z, off] of pillars) {
    const x = center(z) + off * 14, h = 14 + Math.abs(off) * 16;
    w.box(x, w.groundHeight(x, z) - 1, z, 4.5, h, 4.5, rock, z * 0.1, { uv: 4 });
    w.box(x, w.groundHeight(x, z) - 1 + h, z, 7, 2, 7, rock, z * 0.1 + 0.4, { uv: 4 });
  }
  const az = 60, ax = center(az);
  w.box(ax, 16, az, 50, 5, 7, rock, -0.25, { uv: 6 });
  const wood = new THREE.MeshStandardMaterial({ map: tex('wood'), roughness: 0.9 });
  const bz = -120, bx = center(bz);
  w.box(bx, 22, bz, 60, 0.6, 3, wood, 0.2);
  for (let i = -2; i <= 2; i++) w.box(bx + i * 12 * Math.cos(0.2), w.groundHeight(bx + i * 12, bz), bz - i * 12 * Math.sin(0.2), 0.5, Math.max(1, 22 - w.groundHeight(bx + i * 12, bz)), 0.5, wood);
  if (!opts.lowDetail) w.addGrass([-120, -300, 120, 300], (x, z) => {
    const y = w.groundHeight(x, z);
    if (Math.abs(x - center(z)) > 30 || y > 5) return 0;
    // touceiras: manchas pequenas e densas, mais comuns em algumas áreas
    const area = smooth(0.35, 0.6, fbm(x / 20, z / 20, 2));
    return fbm(x / 0.9 + 40, z / 0.9, 2) > 0.63 - area * 0.08 ? 1 : 0;
  }, { perM2: 60, patch: 60, height: 0.55, width: 0.035, res: 0.5, colors: 'dry' });
  // arbustos secos nas bordas
  const rr = rng(5), trees = [];
  for (let i = 0; i < (opts.lowDetail ? 150 : 500); i++) {
    const x = (rr() - 0.5) * 700, z = (rr() - 0.5) * 700, y = w.groundHeight(x, z);
    if (y < 18) continue;
    const h = 4 + rr() * 5; trees.push({ x, z, y, h, w: h * 0.7, rot: rr() * 3, tint: rr() * 0.5 });
  }
  w.forest(trees, 'shrub');
}
function canyonTrack() {
  const c = (z) => 45 * Math.sin(z / 70) + 20 * Math.sin(z / 23);
  const pts = [];
  for (let z = 150; z >= -200; z -= 35) pts.push(z);
  const gates = pts.map((z) => {
    const dx = c(z - 1) - c(z);
    const yaw = Math.atan2(-dx, 1);
    return { x: c(z), z, yaw, y: z === 60 ? 2 : 0.5, w: 4, h: 3 };
  });
  for (const z of [-215, -165, -115, -85, -40, 10, 55, 105, 140]) {
    const dx = c(z + 1) - c(z);
    const yaw = Math.atan2(-dx, -1) + Math.PI;
    gates.push({ x: c(z) + 8, z, yaw, y: 9, w: 4, h: 3 });
  }
  return gates;
}

// Lista de mapas (SkyDiveMap)
export const MAPS = {
  factory: {
    id: 'factory', name: 'Fábrica Abandonada', desc: 'Galpões de tijolo, trilhos, chaminés e mato alto sob céu nublado.',
    build: factory, spawn: { pos: [0, 0.3, 30], yaw: 0 },
    tracks: [{ id: 'factory-loop', name: 'Volta Industrial', laps: 3, gates: FACTORY_TRACK, difficulty: 'Média' }],
    thumbCam: { pos: [-38, 22, 52], look: [6, 8, -70] },
  },
  stadium: {
    id: 'stadium', name: 'Estádio', desc: 'Estádio de futebol noturno: campo oficial com gols, arquibancadas e refletores.',
    build: stadium, spawn: { pos: [0, 0.3, 32], yaw: 0 },
    tracks: [
      { id: 'stadium-gp', name: 'Grande Prêmio', laps: 3, gates: STADIUM_TRACK, difficulty: 'Fácil' },
      { id: 'stadium-tech', name: 'Técnica', laps: 3, gates: STADIUM_TECH, difficulty: 'Média' },
    ],
    thumbCam: { pos: [0, 4, 34], look: [0, 12, -40] },
  },
  canyon: {
    id: 'canyon', name: 'Cânion Vermelho', desc: 'Cânion ao pôr do sol com pilares de pedra, arco natural e ponte.',
    build: canyon, spawn: { pos: [45 * Math.sin(185 / 70) + 20 * Math.sin(185 / 23), 0.5, 185], yaw: 0 },
    tracks: [{ id: 'canyon-run', name: 'Descida do Cânion', laps: 2, gates: canyonTrack(), difficulty: 'Difícil' }],
    thumbCam: { pos: [46, 7, 165], look: [29, 9, 90] },
  },
};
