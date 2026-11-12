// Modelos 3D dos drones DJI (Avata 2, DJI FPV, Mini 5 Pro, Air 3S, Mavic 4 Pro),
// pós-processamento WebGPU (AO, reflexos, iluminação indireta, TAA/TAAU, bloom, lente, sinal digital) e vitrine do menu.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { pass, mrt, output, normalView, metalness, roughness, diffuseColor, velocity, sample, packNormalToRGB, unpackRGBToNormal,
  convertToTexture, screenUV, uv, uniform, Fn, If, vec2, vec3, vec4, float, mix, clamp, fract, sin, dot, floor, length } from 'three/tsl';
import { ao } from 'three/addons/tsl/display/GTAONode.js';
import { ssgi } from 'three/addons/tsl/display/SSGINode.js';
import { ssr } from 'three/addons/tsl/display/SSRNode.js';
import { traa } from 'three/addons/tsl/display/TRAANode.js';
import { taau } from 'three/addons/tsl/display/TAAUNode.js';
import { smaa } from 'three/addons/tsl/display/SMAANode.js';
import { sharpen } from 'three/addons/tsl/display/SharpenNode.js';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { loft, bladeGeo, bellTex } from './dronegeo.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// ---------- texturas pequenas ----------
const cache = {};
function canvasTexture(key, w, h, draw, srgb = true) {
  if (cache[key]) return cache[key];
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return (cache[key] = t);
}
const blurTex = () => canvasTexture('propblur', 128, 128, (g, w) => {
  const r = w / 2;
  const gr = g.createRadialGradient(r, r, r * 0.12, r, r, r);
  gr.addColorStop(0, 'rgba(255,255,255,0.03)');
  gr.addColorStop(0.3, 'rgba(255,255,255,0.4)');
  gr.addColorStop(0.8, 'rgba(255,255,255,0.6)');
  gr.addColorStop(0.94, 'rgba(255,255,255,0.3)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.beginPath(); g.arc(r, r, r, 0, Math.PI * 2); g.fill();
}, false);
// fendas de ventilação (máscara: branco = fenda), usada com alphaTest
const slotTex = () => canvasTexture('slots', 64, 64, (g, w, h) => {
  g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#fff';
  for (let y = 5; y < h - 4; y += 8) { g.beginPath(); g.roundRect(4, y, w - 8, 3.5, 1.7); g.fill(); }
}, false);

// ---------- aparência de cada modelo ----------
const LOOKS = {
  avata2: { shell: 0x2d3034, dark: 0x16181a, duct: 0x33373c, prop: 0x8d939b, blades: 3, propR: 0.036, led: 0x46ff7a },
  djifpv: { shell: 0x5d6166, dark: 0x232528, batt: 0x70757b, prop: 0x9aa0a6, blades: 3, propR: 0.066, led: 0x4fd8ff },
  mini: { shell: 0xdadcdf, dark: 0x2b2d31, prop: 0xc6cacf, blades: 2, propR: 0.07, L: 0.15, W: 0.086, H: 0.054, led: 0x46ff7a },
  air: { shell: 0x3d4045, dark: 0x1c1e21, prop: 0x2f3236, blades: 2, propR: 0.088, L: 0.2, W: 0.104, H: 0.07, led: 0x46ff7a },
  mavic: { shell: 0x2c2f33, dark: 0x141517, prop: 0x2a2d31, blades: 2, propR: 0.11, L: 0.255, W: 0.122, H: 0.084, led: 0x46ff7a, silver: true },
};
const V2 = (pts) => pts.map(([r, h]) => new THREE.Vector2(r, h));

// Cria o modelo do drone. userData: props (4 hélices na ordem FL, FR, RL, RR),
// gimbal (grupo da câmera que gira), leds (para piscar), body e rotors.
// Cascos feitos por seções (loft) para ter as curvas dos drones de verdade em vez de caixas.
export function makeDroneModel(quad, ghost = false) {
  const L = LOOKS[quad.model] || LOOKS.mini;
  const a = quad.arm;
  const root = new THREE.Group();
  const body = new THREE.Group();
  const rotors = new THREE.Group();
  root.add(body, rotors);
  const gimbal = new THREE.Group();
  const leds = [];

  const phys = (color, o = {}) => new THREE.MeshPhysicalMaterial(Object.assign({ color, roughness: 0.5, metalness: 0.04, clearcoat: 0.25, clearcoatRoughness: 0.45 }, o));
  const std = (color, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.55 }, o));
  const shell = phys(L.shell);
  const shell2 = phys(L.batt ?? L.shell, { roughness: 0.36, clearcoat: 0.7, clearcoatRoughness: 0.25 }); // bateria (mais lisa)
  const dark = std(L.dark, { roughness: 0.6 });
  const rubber = std(0x101112, { roughness: 0.9 });
  const metal = std(0x9ea3a9, { metalness: 0.85, roughness: 0.3 });
  const metalDark = std(L.silver ? 0x8e939a : 0x2a2c30, { metalness: 0.75, roughness: 0.32 });
  const bellMat = std(L.silver ? 0x9aa0a8 : 0x45484d, { map: bellTex(), metalness: 0.75, roughness: 0.35 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x05070c, metalness: 0.2, roughness: 0.04, clearcoat: 1, envMapIntensity: 2.5 });
  const lensRing = std(0x1a1b1d, { metalness: 0.5, roughness: 0.35 });
  const lensInner = std(0x2a3550, { metalness: 0.6, roughness: 0.2 });
  const sensorMat = new THREE.MeshPhysicalMaterial({ color: 0x020203, roughness: 0.08, clearcoat: 1, envMapIntensity: 2 });
  const ledMat = (c) => new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(3) });
  // fendas de ventilação recortadas (só as fendas aparecem, o resto do plano é transparente)
  const slotMat = (c) => new THREE.MeshStandardMaterial({ color: c, alphaMap: slotTex(), alphaTest: 0.5, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2 });

  const add = (geo, mat, x = 0, y = 0, z = 0, parent = body) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z);
    m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
  };
  const tube = (secs, mat, opts, parent = body) => add(loft(secs, opts), mat, 0, 0, 0, parent);
  // viga arredondada entre dois pontos
  const beam = (A, B, w, t, mat, parent = body) => {
    const dx = B[0] - A[0], dy = B[1] - A[1], dz = B[2] - A[2];
    const len = Math.hypot(dx, dy, dz);
    const m = add(new RoundedBoxGeometry(w, t, len, 2, Math.min(w, t) * 0.45), mat, (A[0] + B[0]) / 2, (A[1] + B[1]) / 2, (A[2] + B[2]) / 2, parent);
    m.rotation.order = 'YXZ';
    m.rotation.y = Math.atan2(dx, dz);
    m.rotation.x = -Math.asin(dy / len);
    return m;
  };
  const cyl = (r0, r1, h, mat, x, y, z, seg = 20, parent = body) => add(new THREE.CylinderGeometry(r0, r1, h, seg), mat, x, y, z, parent);
  // lente olhando para -z: anel, vidro e reflexo azulado do conjunto óptico
  const lens = (r, x, y, z, parent = body, dir = -1) => {
    const ring = add(new THREE.LatheGeometry(V2([[r * 1.32, 0], [r * 1.3, r * 0.5], [r * 1.12, r * 0.62], [r * 1.02, r * 0.5]]), 28), lensRing, x, y, z, parent);
    ring.rotation.x = dir * Math.PI / 2;
    const gl = add(new THREE.CircleGeometry(r * 1.05, 28), glass, x, y, z + dir * r * 0.3, parent);
    if (dir < 0) gl.rotation.y = Math.PI;
    const dome = add(new THREE.SphereGeometry(r * 0.95, 24, 6, 0, Math.PI * 2, 0, 0.75), glass, x, y, z + dir * r * 0.05, parent);
    dome.rotation.x = dir * Math.PI / 2; dome.scale.set(1, 0.5, 1);
    const inner = add(new THREE.RingGeometry(r * 0.3, r * 0.5, 24), lensInner, x, y, z + dir * r * 0.32, parent);
    if (dir < 0) inner.rotation.y = Math.PI;
    return ring;
  };
  // olho de sensor (par de câmeras de visão): pequeno, preto brilhante, com aro
  const eye = (r, x, y, z, rx, ry, parent = body) => {
    const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.set(rx, ry, 0); parent.add(g);
    add(new THREE.CylinderGeometry(r * 1.35, r * 1.35, r * 0.3, 18), lensRing, 0, 0, 0, g).rotation.x = Math.PI / 2;
    const s = add(new THREE.SphereGeometry(r, 16, 8, 0, Math.PI * 2, 0, 1.0), sensorMat, 0, 0, -r * 0.1, g);
    s.rotation.x = -Math.PI / 2; s.scale.set(1, 0.45, 1);
    return g;
  };
  const led = (geo, color, x, y, z, blink = 0, parent = body) => {
    const m = add(geo, ledMat(color), x, y, z, parent); m.castShadow = false;
    if (blink) leds.push({ m, color: new THREE.Color(color).multiplyScalar(3) });
    return m;
  };
  // motor: base (na cor do braço) + sino giratório com respiros + tampa abaulada; devolve a altura do topo (onde vai a hélice)
  const motor = (x, y, z, r, h, podMat, podDown) => {
    add(new THREE.LatheGeometry(V2([[0.0005, -podDown], [r * 0.72, -podDown], [r * 0.98, -podDown + r * 0.28], [r * 1.1, -podDown * 0.45], [r * 1.12, -r * 0.12], [r * 1.06, 0], [r * 0.9, 0.0002]]), 28), podMat, x, y, z);
    add(new THREE.CylinderGeometry(r * 0.95, r, h, 28, 1, true), bellMat, x, y + h / 2, z);
    add(new THREE.LatheGeometry(V2([[r * 0.97, 0], [r * 0.9, h * 0.18], [r * 0.5, h * 0.3], [0.0005, h * 0.32]]), 28), metalDark, x, y + h, z);
    for (let k = 0; k < 4; k++) { const an = k * Math.PI / 2 + 0.4; cyl(r * 0.07, r * 0.07, h * 0.1, metal, x + Math.cos(an) * r * 0.55, y + h * 1.2, z + Math.sin(an) * r * 0.55, 6); }
    return y + h * 1.32;
  };

  // posições dos motores [FL, FR, RL, RR] e altura de cada hélice
  let motors = [[-a, 0, -a], [a, 0, -a], [-a, 0, a], [a, 0, a]];
  const propY = [0.02, 0.02, 0.02, 0.02];
  const propR = L.propR;

  if (quad.model === 'avata2') {
    // casco compacto + bateria encaixada atrás (com a emenda)
    const S = (z, w, t, b, y = 0.016, n = 3.2) => ({ z, w, t, b, y, n });
    tube([S(-0.071, 0.014, 0.009, 0.011, 0.012, 2.6), S(-0.064, 0.028, 0.021, 0.017, 0.013, 2.9), S(-0.035, 0.036, 0.03, 0.02), S(0.02, 0.036, 0.031, 0.02), S(0.055, 0.032, 0.027, 0.018, 0.016, 3)], shell, { edge: [0.002, 0.0015] });
    tube([S(0.056, 0.027, 0.018, 0.016, 0.02, 3.8), S(0.06, 0.029, 0.02, 0.018, 0.02, 3.8), S(0.1, 0.029, 0.02, 0.018, 0.02, 3.8), S(0.11, 0.023, 0.015, 0.013, 0.02, 3.2)], shell2, { edge: [0.0015, 0.003] });
    // tampa superior escura com grade de ventilação
    tube([S(-0.04, 0.018, 0.0025, 0.0025, 0.0455, 4), S(-0.032, 0.024, 0.003, 0.003, 0.0465, 4), S(0.025, 0.024, 0.003, 0.003, 0.0468, 4), S(0.033, 0.018, 0.0025, 0.0025, 0.046, 4)], phys(0x1d1f22, { clearcoat: 0.8, roughness: 0.3 }), { edge: [0.002, 0.002] });
    const vent = add(new THREE.PlaneGeometry(0.03, 0.026), slotMat(0x08090a), 0, 0.0501, 0.004); vent.rotation.x = -Math.PI / 2; vent.castShadow = false;
    for (let i = 0; i < 4; i++) add(new THREE.BoxGeometry(0.05, 0.0012, 0.003), dark, 0, 0.012 + i * 0.006, 0.1095);
    led(new THREE.BoxGeometry(0.018, 0.003, 0.002), L.led, 0, 0.032, 0.1105, 1);
    // dutos (protetores) com borda boleada e saia
    const ductMat = phys(L.duct, { roughness: 0.55 });
    const R = propR + 0.006;
    motors.forEach(([x, , z], i) => {
      const sx = Math.sign(x), sz = Math.sign(z);
      tube([{ x: sx * 0.02, y: 0.006, z: sz * 0.028, w: 0.011, t: 0.006, n: 3 }, { x: x * 0.6, y: 0.004, z: z * 0.6, w: 0.009, t: 0.0055, n: 3 }, { x: x - sx * R * 0.7, y: 0.002, z: z - sz * R * 0.7, w: 0.008, t: 0.006, n: 3 }], ductMat);
      add(new THREE.LatheGeometry(V2([[R + 0.006, -0.012], [R + 0.0085, -0.008], [R + 0.0095, 0], [R + 0.009, 0.0125], [R + 0.0058, 0.0158], [R + 0.0022, 0.0138], [R, 0.008], [R, -0.009], [R + 0.0012, -0.012], [R + 0.006, -0.012]]), 56), ductMat, x, 0.006, z);
      for (let k = 0; k < 3; k++) {
        const ang = k * (Math.PI * 2 / 3) + i * 0.7;
        beam([x, -0.003, z], [x + Math.cos(ang) * R, -0.005, z + Math.sin(ang) * R], 0.004, 0.003, dark);
      }
      propY[i] = motor(x, 0.002, z, 0.0085, 0.0065, dark, 0.009);
      add(new THREE.CylinderGeometry(0.004, 0.005, 0.004, 10), rubber, x * 0.45, -0.009, z * 0.5);
    });
    // câmera no gimbal de 1 eixo entre os dutos da frente, com garfo lateral
    gimbal.position.set(0, 0.012, -0.082);
    body.add(gimbal);
    for (const sx of [-1, 1]) tube([{ x: sx * 0.0172, y: 0.012, z: -0.066, w: 0.003, t: 0.009, n: 3 }, { x: sx * 0.0172, y: 0.012, z: -0.084, w: 0.003, t: 0.008, n: 3 }], dark);
    add(new RoundedBoxGeometry(0.028, 0.025, 0.026, 5, 0.009), phys(0x1b1d20, { clearcoat: 0.8, roughness: 0.3 }), 0, 0, 0, gimbal);
    lens(0.0082, 0, 0.0005, -0.0128, gimbal);
    led(new THREE.BoxGeometry(0.012, 0.0025, 0.002), 0xffffff, 0, -0.0035, -0.0735, 0);
  } else if (quad.model === 'djifpv') {
    // corpo alongado: cabeça na frente, meio largo onde saem os braços, bateria grande atrás
    const S = (z, w, t, b, y = 0.02, n = 3) => ({ z, w, t, b, y, n });
    tube([S(-0.09, 0.016, 0.012, 0.012, 0.022, 2.4), S(-0.083, 0.028, 0.024, 0.02, 0.022, 2.7), S(-0.055, 0.036, 0.032, 0.024), S(-0.005, 0.04, 0.035, 0.026, 0.02, 3.2), S(0.04, 0.038, 0.032, 0.026), S(0.064, 0.033, 0.028, 0.024, 0.022, 2.8)], shell, { edge: [0.003, 0.002] });
    // capa de cima mais escura com nervuras de ventilação
    tube([S(-0.07, 0.018, 0.003, 0.003, 0.05, 4), S(-0.05, 0.026, 0.0035, 0.0035, 0.0535, 4), S(0.0, 0.03, 0.0035, 0.0035, 0.0555, 4), S(0.04, 0.026, 0.0035, 0.0035, 0.053, 4), S(0.055, 0.018, 0.003, 0.003, 0.05, 4)], dark, { edge: [0.004, 0.004] });
    for (let i = 0; i < 4; i++) add(new RoundedBoxGeometry(0.03 - i * 0.003, 0.003, 0.0035, 2, 0.001), shell, 0, 0.0595, -0.03 + i * 0.011);
    // bateria
    tube([S(0.066, 0.026, 0.02, 0.02, 0.03, 3.8), S(0.071, 0.029, 0.022, 0.022, 0.03, 3.8), S(0.138, 0.029, 0.022, 0.022, 0.03, 3.8), S(0.147, 0.024, 0.018, 0.018, 0.03, 3.2)], shell2, { edge: [0.002, 0.003] });
    add(new THREE.BoxGeometry(0.0585, 0.004, 0.06), std(0x3a3d41), 0, 0.03, 0.105);
    led(new THREE.BoxGeometry(0.022, 0.004, 0.002), 0x46ff7a, 0, 0.04, 0.1475, 1);
    // braços em X afinando até os motores grandes, com anel de LED embaixo
    const armMat = phys(0x3a3d41, { roughness: 0.5 });
    motors.forEach(([x, , z], i) => {
      const front = z < 0, sx = Math.sign(x);
      tube([{ x: sx * 0.02, y: 0.014, z: z * 0.32, w: 0.012, t: 0.0075, n: 3.4 }, { x: x * 0.55, y: 0.014, z: z * 0.62, w: 0.01, t: 0.0062, n: 3.4 }, { x, y: 0.012, z, w: 0.0085, t: 0.0058, n: 3.4 }], armMat);
      propY[i] = motor(x, 0.022, z, 0.016, 0.013, dark, 0.018);
      const ring = add(new THREE.TorusGeometry(0.0145, 0.0022, 6, 28), ledMat(front ? L.led : 0xff3030), x, 0.0045, z);
      ring.rotation.x = Math.PI / 2; ring.castShadow = false;
    });
    // trem de pouso (pernas em lâmina) e antenas traseiras
    for (const sx of [-1, 1]) {
      tube([{ x: sx * 0.026, y: -0.002, z: -0.058, w: 0.004, t: 0.007, n: 2.6 }, { x: sx * 0.029, y: -0.022, z: -0.062, w: 0.0035, t: 0.006, n: 2.6 }, { x: sx * 0.031, y: -0.04, z: -0.066, w: 0.003, t: 0.0045, n: 2.6 }], dark);
      add(new THREE.SphereGeometry(0.0045, 10, 8), rubber, sx * 0.031, -0.0415, -0.066);
      tube([{ x: sx * 0.03, y: -0.002, z: 0.068, w: 0.004, t: 0.007, n: 2.6 }, { x: sx * 0.037, y: -0.026, z: 0.077, w: 0.0035, t: 0.006, n: 2.6 }, { x: sx * 0.042, y: -0.05, z: 0.085, w: 0.003, t: 0.0045, n: 2.6 }], dark);
      add(new THREE.SphereGeometry(0.0045, 10, 8), rubber, sx * 0.042, -0.0515, 0.085);
      beam([sx * 0.036, 0.0, 0.075], [sx * 0.05, -0.03, 0.1], 0.005, 0.0025, dark).castShadow = false;
    }
    // câmera no gimbal (1 eixo) com placas laterais
    gimbal.position.set(0, 0.012, -0.1);
    body.add(gimbal);
    for (const sx of [-1, 1]) tube([{ x: sx * 0.0185, y: 0.014, z: -0.08, w: 0.0025, t: 0.011, n: 3 }, { x: sx * 0.0185, y: 0.012, z: -0.102, w: 0.0025, t: 0.01, n: 3 }], dark);
    add(new RoundedBoxGeometry(0.032, 0.029, 0.03, 5, 0.01), phys(0x1c1e21, { clearcoat: 0.8, roughness: 0.3 }), 0, 0, 0, gimbal);
    lens(0.0095, 0, 0, -0.0148, gimbal);
  } else {
    // ---- drones dobráveis de câmera (Mini / Air / Mavic) ----
    const { L: BL, W, H } = L;
    // casco: nariz estreito e baixo (sensores + gimbal), meio largo, traseira arredondada (bateria)
    const S = (u, wf, tf, bf, n = 3.2, yf = 0) => ({ z: -BL / 2 + u * BL, w: wf * W / 2, t: tf * H, b: bf * H, n, y: yf * H });
    const secs = [S(0, 0.38, 0.1, 0.3, 2.8, -0.04), S(0.04, 0.64, 0.27, 0.4, 3.2, -0.01), S(0.14, 0.86, 0.4, 0.46, 3.8), S(0.32, 0.99, 0.48, 0.5, 4.4), S(0.55, 1.0, 0.5, 0.5, 4.6), S(0.8, 0.96, 0.49, 0.47, 4.2), S(0.94, 0.82, 0.43, 0.4, 3.6), S(1, 0.56, 0.29, 0.26, 3.0)];
    const zs = -BL / 2 + 0.52 * BL, gap = H * 0.012, ed = H * 0.035;
    tube(secs, shell, { range: [-BL, zs - gap], edge: [H * 0.05, ed], steps: 10 });
    tube(secs, shell2, { range: [zs + gap, BL], edge: [ed, H * 0.05], steps: 10 });
    tube(secs.map((s) => ({ ...s, w: s.w * 0.95, t: s.t * 0.95, b: s.b * 0.95 })), dark, { range: [zs - ed * 1.2, zs + ed * 1.2] });
    // entrada de ar no topo e pega da bateria
    const vent = add(new THREE.PlaneGeometry(W * 0.34, BL * 0.09), slotMat(L.dark), 0, H * 0.505, -BL * 0.08); vent.rotation.x = -Math.PI / 2; vent.castShadow = false;
    for (const sx of [-1, 1]) for (let k = 0; k < 5; k++) add(new RoundedBoxGeometry(W * 0.16, H * 0.02, BL * 0.012, 2, H * 0.008), shell2, sx * W * 0.22, H * 0.515, BL * 0.2 + k * BL * 0.025);
    // sensores de visão: par na frente, par atrás, par embaixo; luz auxiliar embaixo
    for (const sx of [-1, 1]) {
      eye(H * 0.055, sx * W * 0.17, H * 0.25, -BL * 0.452, 0.55, 0);
      eye(H * 0.05, sx * W * 0.11, H * 0.03, BL / 2 + H * 0.005, 0, Math.PI);
      eye(H * 0.05, sx * W * 0.15, -H * 0.5 - H * 0.004, BL * 0.06, -Math.PI / 2, 0);
    }
    if (quad.model !== 'mini') for (const sx of [-1, 1]) eye(H * 0.045, sx * W * 0.43, H * 0.2, -BL * 0.3, 0, -sx * Math.PI / 2);
    led(new THREE.CircleGeometry(H * 0.04, 12), 0xfff4e0, 0, -H * 0.5 - 0.0008, BL * 0.2, 0).rotation.x = Math.PI / 2;
    led(new THREE.BoxGeometry(W * 0.14, H * 0.035, 0.002), L.led, 0, H * 0.2, BL / 2 + H * 0.004, 1);
    // braços dobráveis afinando: os da frente saem do alto, os de trás de baixo (motores traseiros mais baixos)
    const armMat = phys(L.shell, { roughness: 0.48 });
    const fy = H * 0.3, ry = -H * 0.18, r = H * 0.2, mh = H * 0.14;
    motors = [[-a, fy, -a * 0.92], [a, fy, -a * 0.92], [-a * 1.02, ry, a * 0.96], [a * 1.02, ry, a * 0.96]];
    motors.forEach(([x, y, z], i) => {
      const front = i < 2, sx = Math.sign(x);
      const A = front ? [sx * W * 0.33, H * 0.2, -BL * 0.2] : [sx * W * 0.3, -H * 0.26, BL * 0.28];
      const T = [x, y - H * 0.13, z];
      const M = [A[0] * 0.45 + x * 0.55, (A[1] + T[1]) / 2 + (front ? H * 0.03 : -H * 0.02), A[2] * 0.45 + z * 0.55 + (front ? 0 : BL * 0.03)];
      const P = (p, w, t, n = 3.2) => ({ x: p[0], y: p[1], z: p[2], w, t, b: t, n });
      tube(front ? [P(A, H * 0.15, H * 0.14), P(M, H * 0.115, H * 0.105), P(T, H * 0.105, H * 0.1)] : [P(A, H * 0.18, H * 0.095), P(M, H * 0.15, H * 0.075), P(T, H * 0.13, H * 0.075)], armMat, { steps: 10 });
      propY[i] = motor(x, y, z, r, mh, armMat, front ? H * 0.34 : H * 0.3);
      if (front) {
        // perna dianteira (lâmina com antena) + LED vermelho na ponta do braço
        tube([{ x, y: y - H * 0.2, z: z + H * 0.02, w: H * 0.04, t: H * 0.1, n: 2.6 }, { x, y: y - H * 0.5, z: z + H * 0.05, w: H * 0.033, t: H * 0.075, n: 2.6 }, { x, y: y - H * 0.8, z: z + H * 0.08, w: H * 0.028, t: H * 0.05, n: 2.6 }], armMat);
        add(new THREE.SphereGeometry(H * 0.04, 10, 8), rubber, x, y - H * 0.81, z + H * 0.08);
        led(new THREE.BoxGeometry(H * 0.12, H * 0.06, 0.002), 0xff2a2a, x, y - H * 0.12, z - r * 1.1, 0);
      } else {
        add(new THREE.CylinderGeometry(H * 0.09, H * 0.11, H * 0.08, 12), rubber, x, y - H * 0.33, z);
      }
    });
    // gimbal de 3 eixos sob o nariz: motor de giro, braço lateral com motor de rolagem, cabeça da câmera
    gimbal.position.set(0, -H * 0.24, -BL * 0.5 - H * 0.12);
    body.add(gimbal);
    const yoke = phys(L.dark, { metalness: 0.15, roughness: 0.45 });
    if (quad.model === 'mavic') {
      // câmera "esfera" com garfo curvo e três lentes (principal + duas teles)
      const arc = new THREE.TorusGeometry(H * 0.43, H * 0.05, 12, 40, Math.PI * 0.92);
      arc.rotateZ(Math.PI * 0.48); arc.rotateY(Math.PI / 2);          // arco do topo, por trás, até embaixo (não cobre as lentes)
      add(arc, yoke, 0, 0, 0, gimbal);
      tube([{ x: 0, y: H * 0.42, z: H * 0.05, w: H * 0.07, t: H * 0.04, n: 3 }, { x: 0, y: H * 0.36, z: H * 0.32, w: H * 0.08, t: H * 0.05, n: 3 }], yoke, {}, gimbal);
      add(new THREE.SphereGeometry(H * 0.36, 40, 28), phys(0x1a1c1f, { clearcoat: 0.9, roughness: 0.25 }), 0, 0, 0, gimbal);
      for (const sx of [-1, 1]) add(new THREE.CylinderGeometry(H * 0.12, H * 0.12, H * 0.06, 20), metalDark, sx * H * 0.38, 0, 0, gimbal).rotation.z = Math.PI / 2;
      const face = add(new THREE.CylinderGeometry(H * 0.3, H * 0.33, H * 0.06, 32), phys(0x0c0d0f, { clearcoat: 1, roughness: 0.15 }), 0, 0, -H * 0.31, gimbal); face.rotation.x = Math.PI / 2;
      lens(H * 0.16, 0, -H * 0.05, -H * 0.34, gimbal);
      lens(H * 0.065, H * 0.17, H * 0.14, -H * 0.33, gimbal);
      lens(H * 0.065, -H * 0.17, H * 0.14, -H * 0.33, gimbal);
    } else {
      const big = quad.model === 'air';
      const hw = big ? H * 0.3 : H * 0.31, hh = big ? H * 0.36 : H * 0.29, hd = big ? H * 0.25 : H * 0.27;
      // braço do gimbal: desce pelo lado direito até o motor de rolagem
      tube([{ x: 0, y: hh + H * 0.03, z: hd + H * 0.12, w: H * 0.07, t: H * 0.035, n: 3 }, { x: 0, y: hh + H * 0.035, z: hd * 0.2, w: H * 0.06, t: H * 0.035, n: 3 }, { x: hw + H * 0.07, y: hh * 0.7, z: H * 0.03, w: H * 0.05, t: H * 0.04, n: 3 }, { x: hw + H * 0.08, y: 0, z: H * 0.02, w: H * 0.045, t: H * 0.05, n: 3 }], yoke, {}, gimbal);
      add(new THREE.CylinderGeometry(H * 0.11, H * 0.11, H * 0.06, 20), metalDark, hw + H * 0.04, 0, 0, gimbal).rotation.z = Math.PI / 2;
      add(new THREE.CylinderGeometry(H * 0.08, H * 0.08, H * 0.04, 16), metalDark, -hw - H * 0.02, 0, 0, gimbal).rotation.z = Math.PI / 2;
      tube([{ z: -hd, w: hw * 0.86, t: hh * 0.86, n: 3.6 }, { z: -hd * 0.8, w: hw, t: hh, n: 4 }, { z: hd * 0.7, w: hw, t: hh, n: 4 }, { z: hd, w: hw * 0.8, t: hh * 0.8, n: 3.4 }], phys(0x1c1e21, { clearcoat: 0.8, roughness: 0.3 }), { edge: [H * 0.03, H * 0.06] }, gimbal);
      if (big) { lens(H * 0.13, 0, H * 0.15, -hd - H * 0.01, gimbal); lens(H * 0.1, 0, -H * 0.17, -hd - H * 0.01, gimbal); }
      else lens(H * 0.17, 0, 0, -hd - H * 0.01, gimbal);
    }
  }

  // hélices: pás com perfil de asa; cubo com articulações (dobráveis) ou porca (FPV)
  const props = [];
  const spinDir = [-1, 1, 1, -1];
  const propMat = new THREE.MeshStandardMaterial({ color: L.prop, roughness: 0.38, metalness: 0.05, side: THREE.DoubleSide });
  const blurMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(L.prop).lerp(new THREE.Color(0xffffff), 0.25), map: blurTex(), transparent: true, opacity: 0.4, depthWrite: false, side: THREE.DoubleSide });
  const two = L.blades === 2;
  const blade = bladeGeo(propR, two ? 0.68 : 1.05, { root: two ? 0.16 : 0.2, tipSweep: two ? 0.14 : 0.08 });
  motors.forEach(([x, , z], i) => {
    const hub = new THREE.Group(); hub.position.set(x, propY[i], z); rotors.add(hub);
    const hubC = new THREE.Mesh(new THREE.CylinderGeometry(propR * 0.1, propR * 0.12, propR * 0.09, 16), propMat); hubC.castShadow = true; hub.add(hubC);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(propR * 0.07, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), metalDark); cap.position.y = propR * 0.045; hub.add(cap);
    const blades = [];
    for (let k = 0; k < L.blades; k++) {
      const g = new THREE.Group(); g.rotation.y = (k * Math.PI * 2) / L.blades + i; g.scale.set(1, 1, spinDir[i]); hub.add(g);
      const b = new THREE.Mesh(blade, propMat); b.castShadow = true; g.add(b);
      if (two) { // articulação da pá dobrável
        const hinge = new THREE.Mesh(new THREE.CylinderGeometry(propR * 0.05, propR * 0.05, propR * 0.07, 10), propMat);
        hinge.position.set(propR * 0.16, 0, 0); b.add(hinge);
      }
      blades.push(b);
    }
    const disc = new THREE.Mesh(new THREE.CircleGeometry(propR, 40), blurMat.clone());
    disc.rotation.x = -Math.PI / 2; disc.visible = false; hub.add(disc);
    props.push({ hub, disc, blades });
  });

  mergeStatic(root, body, new Set([gimbal]), new Set(leds.map((l) => l.m)));
  if (ghost) {
    const gm = new THREE.MeshBasicMaterial({ color: 0x66e0ff, transparent: true, opacity: 0.3, depthWrite: false });
    root.traverse((o) => { if (o.isMesh) { o.material = gm; o.castShadow = false; } });
    leds.length = 0;
  }
  root.userData = { props, spin: spinDir, body, rotors, gimbal, leds, t: 0 };
  return root;
}

// Junta as peças fixas do casco numa malha por material (menos chamadas de desenho; o gimbal e os LEDs que piscam ficam soltos).
function mergeStatic(root, body, skipGroups, skipMeshes) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(body.matrixWorld).invert();
  const lists = new Map(), dead = [];
  const walk = (o) => {
    if (skipGroups.has(o)) return;
    for (const c of o.children) walk(c);
    if (!o.isMesh || skipMeshes.has(o)) return;
    const mat = o.material, key = mat.uuid + (o.castShadow ? '1' : '0');
    const g = o.geometry.clone();
    if (!g.index) g.setIndex([...Array(g.attributes.position.count).keys()]); // todas indexadas para poder juntar
    const keepUv = !!(mat.map || mat.alphaMap);
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && !(k === 'uv' && keepUv)) g.deleteAttribute(k);
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
    if (!lists.has(key)) lists.set(key, { mat, cast: o.castShadow, geos: [] });
    lists.get(key).geos.push(g);
    dead.push(o);
  };
  walk(body);
  for (const o of dead) { o.parent.remove(o); o.geometry.dispose(); }
  for (const { mat, cast, geos } of lists.values()) {
    const m = new THREE.Mesh(geos.length > 1 ? mergeGeometries(geos, false) : geos[0], mat);
    m.castShadow = cast; m.receiveShadow = true; body.add(m);
  }
}

// Na visão pela câmera do drone o próprio drone não aparece.
export function setFpvView(model, fpv) {
  model.userData.body.visible = !fpv;
  model.userData.rotors.visible = !fpv;
}

const OFF = new THREE.Color(0x111111);
export function animateProps(model, rpm, propHealth, dt) {
  const { props, spin, leds } = model.userData;
  model.userData.t += dt;
  for (let i = 0; i < 4; i++) {
    const p = props[i];
    const r = rpm[i];
    const alive = propHealth[i] > 0.05;
    p.hub.rotation.y += spin[i] * (r * 300 + (r > 0.001 ? 6 : 0)) * dt;
    const fast = r > 0.04 && alive;
    p.disc.visible = fast;
    p.disc.material.opacity = Math.min(0.5, 0.15 + r * 0.6);
    p.blades.forEach((b, k) => { b.visible = !fast && propHealth[i] > 0.05 * (k + 1); });
  }
  // LED de status piscando (verde = GPS ok, como nos drones DJI)
  const on = Math.floor(model.userData.t * 2) % 2 === 0;
  for (const l of leds) l.m.material.color.copy(on ? l.color : OFF);
}

// Ajusta o tamanho do modelo para caber numa vitrine/miniatura.
export function fitModel(model, size) {
  model.scale.setScalar(1); model.position.set(0, 0, 0);
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  const d = box.getSize(new THREE.Vector3());
  const k = size / Math.max(d.x, d.z);
  model.scale.setScalar(k);
  model.position.y = -box.min.y * k;
  return k;
}

// ---------- pós-processamento (WebGPU / TSL) ----------
// Cadeia: cena → iluminação indireta (SSGI) ou sombra de contato (GTAO) → reflexos (SSR)
//         → anti-serrilhado temporal (TRAA) ou aumento de resolução (TAAU) → bloom → lente/sinal → tela
export const GFX_PRESETS = {
  ultra: { gi: true, ao: false, ssr: true },
  high: { gi: false, ao: true, ssr: true },
  medium: { gi: false, ao: true, ssr: false },
  low: { gi: false, ao: false, ssr: false },
};
export const UPSCALE = { off: 1, quality: 0.77, balanced: 0.67, performance: 0.5 };

export class PostFX {
  constructor(renderer, scene, camera) {
    this.renderer = renderer; this.scene = scene; this.camera = camera;
    this.pipeline = new THREE.RenderPipeline(renderer);
    this.uniforms = {
      fisheye: uniform(0), noise: uniform(0), staticAmt: uniform(0), time: uniform(0), aspect: uniform(1),
      flash: uniform(0), vignette: uniform(0.25), blocky: uniform(0),
    };
    this.bloomStrength = 0.35; this.bloomOn = true;
    const self = this;
    // mesma interface do UnrealBloomPass antigo (main.js usa .strength e .enabled)
    this.bloom = {
      get strength() { return self.bloomStrength; }, set strength(v) { self.bloomStrength = v; self.syncBloom(); },
      get enabled() { return self.bloomOn; }, set enabled(v) { self.bloomOn = v; self.syncBloom(); },
    };
    this.opts = { preset: 'high', aa: 'taa', upscale: 'off' };
    this.nodes = [];
    this.build();
  }
  syncBloom() { if (this.bloomNode) this.bloomNode.strength.value = this.bloomOn ? this.bloomStrength : 0; }
  configure(o) {
    const n = Object.assign({}, this.opts, o);
    if (n.preset === this.opts.preset && n.aa === this.opts.aa && n.upscale === this.opts.upscale) return;
    this.opts = n; this.build();
  }
  get backendName() {
    const b = this.renderer.backend;
    return b && b.isWebGPUBackend ? 'WebGPU' : 'WebGL 2';
  }
  build() {
    for (const n of this.nodes) if (n && n.dispose) n.dispose();
    this.nodes = [];
    const { scene, camera } = this;
    const P = GFX_PRESETS[this.opts.preset] || GFX_PRESETS.high;
    const scale = UPSCALE[this.opts.upscale] || 1;
    const effects = P.gi || P.ao || P.ssr;
    // os efeitos de tela têm ruído que só some com o acúmulo temporal
    const temporal = scale < 1 || effects || this.opts.aa === 'taa';
    const scenePass = pass(scene, camera);
    const outs = { output };
    if (effects) outs.normal = packNormalToRGB(normalView);
    if (P.ssr) outs.metalrough = vec2(metalness, roughness);
    if (P.gi) outs.diffuseColor = diffuseColor;
    if (temporal) outs.velocity = velocity;
    scenePass.setMRT(mrt(outs));
    if (scale < 1) scenePass.setResolutionScale(scale);
    this.nodes.push(scenePass);
    const color = scenePass.getTextureNode('output');
    const depth = scenePass.getTextureNode('depth');
    let normal = null;
    if (outs.normal) {
      scenePass.getTexture('normal').type = THREE.UnsignedByteType;
      const nt = scenePass.getTextureNode('normal');
      normal = sample((u) => unpackRGBToNormal(nt.sample(u)));
    }
    let lit = color;
    if (P.gi) {
      scenePass.getTexture('diffuseColor').type = THREE.UnsignedByteType;
      const diffuse = scenePass.getTextureNode('diffuseColor');
      const g = ssgi(color, depth, normal, camera);
      g.sliceCount.value = 2; g.stepCount.value = 8;
      g.radius.value = 4; g.thickness.value = 0.5; g.giIntensity.value = 5; g.aoIntensity.value = 0.7;
      this.nodes.push(g);
      this.gi = g;
      lit = vec4(color.rgb.mul(g.getAONode()).add(diffuse.rgb.mul(g.getGINode().rgb)), color.a);
    } else if (P.ao) {
      const a = ao(depth, normal, camera);
      a.resolutionScale = 0.5; a.radius.value = 1.2; a.samples.value = 16;
      this.nodes.push(a);
      this.ao = a;
      // a sombra de contato só escurece cantos e frestas (não apaga a luz do sol inteira)
      const occl = mix(float(1), a.getTextureNode().sample(screenUV).r, 0.95);
      lit = vec4(color.rgb.mul(occl), color.a);
    }
    if (P.ssr) {
      scenePass.getTexture('metalrough').type = THREE.UnsignedByteType;
      const mr = scenePass.getTextureNode('metalrough');
      const r = ssr(color, depth, normal, { metalnessNode: mr.r, roughnessNode: mr.g, camera });
      r.quality.value = 0.5; r.intensity.value = 1;
      this.nodes.push(r);
      this.ssr = r;
      lit = vec4(lit.rgb.add(r.rgb), lit.a);
    }
    let img;
    if (scale < 1) {
      const t = taau(lit, depth, scenePass.getTextureNode('velocity'), camera);
      this.nodes.push(t);
      img = sharpen(t.getTextureNode(), 0.1); // nitidez forte realçava o serrilhado
    } else if (temporal) {
      img = traa(lit, depth, scenePass.getTextureNode('velocity'), camera);
    } else if (this.opts.aa === 'smaa') {
      img = smaa(lit);
    } else img = lit;
    this.nodes.push(img);
    this.bloomNode = bloom(img, this.bloomStrength, 0.5, 0.92);
    this.nodes.push(this.bloomNode);
    this.syncBloom();
    this.pipeline.outputNode = this.lensFX(img.add(this.bloomNode));
    this.pipeline.needsUpdate = true;
  }
  // distorção da lente, aberração cromática, chiado, blocos de sinal digital, vinheta e clarão
  lensFX(input) {
    const src = convertToTexture(input);
    this.nodes.push(src);
    const U = this.uniforms;
    const rnd = (q) => fract(sin(dot(q, vec2(12.9898, 78.233)).add(U.time.mul(43.1))).mul(43758.5453));
    return Fn(() => {
      const vUv = uv();
      const c = vUv.sub(0.5).toVar();
      c.x.mulAssign(U.aspect);
      const rmax2 = U.aspect.mul(U.aspect).mul(0.25).add(0.25);
      const k = U.fisheye.mul(0.6);
      c.mulAssign(float(1).add(k.mul(dot(c, c)).div(rmax2)).div(float(1).add(k)));
      c.x.divAssign(U.aspect);
      const p = c.add(0.5).toVar();
      If(U.blocky.greaterThan(0), () => {
        const bs = vec2(48, 27).mul(float(1).add(float(1).sub(U.blocky).mul(2))).toVar();
        const cell = floor(p.mul(bs)).toVar();
        const hv = fract(sin(dot(cell.add(floor(U.time.mul(6))), vec2(41.3, 289.1))).mul(43758.5453));
        If(hv.lessThan(U.blocky.mul(0.5)), () => { p.assign(cell.add(0.5).div(bs)); });
      });
      const ca = U.noise.mul(0.0012).add(U.staticAmt.mul(0.004)).add(U.fisheye.mul(0.0015).mul(length(vUv.sub(0.5))));
      const col = vec3(src.sample(p.add(vec2(ca, 0))).r, src.sample(p).g, src.sample(p.sub(vec2(ca, 0))).b).toVar();
      col.addAssign(rnd(vUv.mul(700)).sub(0.5).mul(0.05).mul(U.noise));
      const n = rnd(vUv.mul(vec2(320, 240)));
      col.assign(mix(col, vec3(n.mul(0.6)), clamp(U.staticAmt, 0, 1)));
      const d = vUv.sub(0.5);
      col.mulAssign(float(1).sub(dot(d, d).mul(U.vignette)));
      col.assign(mix(col, vec3(1), U.flash));
      return vec4(col, 1);
    })();
  }
  setSize(w, h) { this.uniforms.aspect.value = w / h; }
  render(scene, camera) {
    if (scene !== this.scene || camera !== this.camera) { this.scene = scene; this.camera = camera; this.build(); }
    this.pipeline.render();
  }
}

// ---------- vitrine do drone no menu principal (fundo limpo, como numa loja) ----------
export class Showcase {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGPURenderer({ canvas, antialias: true, alpha: true });
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.scene = new THREE.Scene();
    this.ready = false;
    this.renderer.init().then(() => {
      const pm = new THREE.PMREMGenerator(this.renderer);
      this.scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
      this.scene.environmentIntensity = 0.45; // no WebGPU o RoomEnvironment fica mais forte que no WebGL antigo
      pm.dispose();
      this.ready = true;
    });
    this.camera = new THREE.PerspectiveCamera(26, 1, 0.01, 50);
    this.camera.position.set(0, 0.36, 1.12);
    this.camera.lookAt(0, 0.07, 0);
    // chão invisível que só recebe a sombra
    const floor = new THREE.Mesh(new THREE.CircleGeometry(0.7, 48), new THREE.ShadowMaterial({ opacity: 0.32 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; this.scene.add(floor);
    const key = new THREE.SpotLight(0xffffff, 9, 4, 0.55, 0.7);
    key.position.set(0.5, 1.4, 0.7); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.radius = 6;
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0xcfe0ff, 1.2); rim.position.set(-1, 0.6, -1); this.scene.add(rim);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x303030, 0.5));
    this.holder = new THREE.Group(); this.scene.add(this.holder);
    this.model = null; this.t = 0; this.ang = 0.6; this.hold = 0;
    let down = null;
    canvas.addEventListener('pointerdown', (e) => { down = e.clientX; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener('pointermove', (e) => { if (down != null) { this.ang += (e.clientX - down) * 0.01; down = e.clientX; this.hold = 2; } });
    canvas.addEventListener('pointerup', () => { down = null; });
  }
  setQuad(quad) {
    if (this.model) this.holder.remove(this.model);
    this.model = makeDroneModel(quad);
    fitModel(this.model, 0.55);
    this.holder.add(this.model);
  }
  render(dt) {
    const c = this.canvas, w = c.clientWidth, h = c.clientHeight;
    if (!w || !h || !this.ready) return;
    if (c.width !== Math.floor(w * devicePixelRatio) || c.height !== Math.floor(h * devicePixelRatio)) {
      this.renderer.setPixelRatio(devicePixelRatio); this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    }
    this.t += dt;
    this.hold = Math.max(0, this.hold - dt);
    if (!this.hold) this.ang += dt * 0.35;
    this.holder.rotation.y = this.ang;
    if (this.model) animateProps(this.model, [0, 0, 0, 0], [1, 1, 1, 1], dt);
    this.renderer.render(this.scene, this.camera);
  }
}
