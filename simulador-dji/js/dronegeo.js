// Geometrias esculpidas dos drones: cascos por seções (loft), hélices com perfil de asa e textura do sino do motor.
import * as THREE from 'three';

const cr = (p0, p1, p2, p3, t) => 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);
const KEYS = ['x', 'y', 'z', 'w', 't', 'b', 'n'];

// Casco liso que passa por uma lista de seções (Catmull-Rom entre elas).
// Seção: { x, y, z (centro), w (meia largura), t (altura acima do centro), b (altura abaixo), n (superelipse: 2 = oval, 4 = quadrado arredondado) }
// opts.range = [z0, z1] corta o casco nesses z (para separar peças, ex.: bateria); opts.edge = [r0, r1] boleia as pontas.
export function loft(secs, { seg = 40, steps = 8, range = null, edge = [0, 0] } = {}) {
  const S = secs.map((s) => ({ x: 0, y: 0, n: 3, b: s.t, ...s }));
  const N = S.length;
  const at = (t) => {
    const i = Math.min(N - 2, Math.max(0, Math.floor(t))), f = t - i, o = {};
    const g = (k) => [S[Math.max(0, i - 1)][k], S[i][k], S[i + 1][k], S[Math.min(N - 1, i + 2)][k]];
    for (const k of KEYS) { const [a, b, c, d] = g(k); o[k] = cr(a, b, c, d, f); }
    o.w = Math.max(o.w, 1e-4); o.t = Math.max(o.t, 1e-4); o.b = Math.max(o.b, 1e-4); o.n = Math.max(o.n, 1.6);
    return o;
  };
  // valores de t (parâmetro ao longo das seções); com range, acrescenta os cortes exatos
  let ts = [];
  for (let i = 0; i <= (N - 1) * steps; i++) ts.push(i / steps);
  if (range) {
    const zOf = (t) => at(t).z;
    const cut = (zc) => { // bisseção (z cresce ao longo das seções)
      if (zc <= zOf(0)) return 0; if (zc >= zOf(N - 1)) return N - 1;
      let lo = 0, hi = N - 1; for (let k = 0; k < 40; k++) { const m = (lo + hi) / 2; if (zOf(m) < zc) lo = m; else hi = m; } return (lo + hi) / 2;
    };
    const a = cut(range[0]), b = cut(range[1]);
    ts = [a, ...ts.filter((t) => t > a + 1e-4 && t < b - 1e-4), b];
    // anéis extras perto dos cortes para o boleado ficar redondo
    const extra = [];
    for (const [tc, r, dir] of [[a, edge[0], 1], [b, edge[1], -1]]) if (r > 0) for (const f of [0.15, 0.4, 0.7, 1.0]) {
      const zc = zOf(tc) + dir * r * f; const tt = cut(zc); if (tt > a && tt < b) extra.push(tt);
    }
    ts = [...new Set([...ts, ...extra])].sort((p, q) => p - q);
  } else if (edge[0] || edge[1]) {
    const extra = [];   // anéis extras junto às pontas para o boleado
    for (let i = 1; i < 6; i++) { const f = i / 6; extra.push(f / steps * 0.9, (N - 1) - f / steps * 0.9); }
    ts = [...new Set([...ts, ...extra])].sort((p, q) => p - q);
  }
  const rings = ts.map(at);
  // boleado nas pontas: encolhe os anéis perto das extremidades
  const zA = rings[0].z, zB = rings[rings.length - 1].z;
  for (const R of rings) {
    for (const [r, d] of [[edge[0], R.z - zA], [edge[1], zB - R.z]]) {
      if (r > 0 && d < r) { const ins = r - Math.sqrt(Math.max(0, r * r - (r - d) * (r - d))); R.w -= ins; R.t -= ins; R.b -= ins; }
    }
    R.w = Math.max(R.w, 1e-4); R.t = Math.max(R.t, 1e-4); R.b = Math.max(R.b, 1e-4);
  }
  // referencial de cada anel (tangente do eixo; "cima" = y, ou z se o eixo for quase vertical)
  const C = rings.map((R) => new THREE.Vector3(R.x, R.y, R.z));
  const avg = C[C.length - 1].clone().sub(C[0]).normalize();
  const up = Math.abs(avg.y) > 0.7 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0);
  const pos = [], idx = [];
  const T = new THREE.Vector3(), side = new THREE.Vector3(), nrm = new THREE.Vector3();
  rings.forEach((R, j) => {
    T.subVectors(C[Math.min(C.length - 1, j + 1)], C[Math.max(0, j - 1)]).normalize();
    side.crossVectors(up, T).normalize(); nrm.crossVectors(T, side);
    for (let i = 0; i < seg; i++) {
      const th = (i / seg) * Math.PI * 2, c = Math.cos(th), s = Math.sin(th), e = 2 / R.n;
      const x = R.w * Math.sign(c) * Math.pow(Math.abs(c), e);
      const y = (s >= 0 ? R.t : R.b) * Math.sign(s) * Math.pow(Math.abs(s), e);
      pos.push(C[j].x + side.x * x + nrm.x * y, C[j].y + side.y * x + nrm.y * y, C[j].z + side.z * x + nrm.z * y);
    }
  });
  const nr = rings.length;
  for (let j = 0; j < nr - 1; j++) for (let i = 0; i < seg; i++) {
    const a = j * seg + i, b = j * seg + (i + 1) % seg, c = (j + 1) * seg + (i + 1) % seg, d = (j + 1) * seg + i;
    idx.push(a, b, c, a, c, d);
  }
  // tampas (leque a partir do centro)
  const c0 = pos.length / 3; pos.push(C[0].x, C[0].y, C[0].z);
  const c1 = pos.length / 3; pos.push(C[nr - 1].x, C[nr - 1].y, C[nr - 1].z);
  for (let i = 0; i < seg; i++) {
    idx.push(c0, (i + 1) % seg, i);
    idx.push(c1, (nr - 1) * seg + i, (nr - 1) * seg + (i + 1) % seg);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// Pá de hélice com perfil de asa: corda larga a ~35% do raio, ponta arredondada, torção e espessura.
// Bordo de ataque para +z e levantado (mesma convenção do modelo antigo; o espelhamento z = sentido de giro).
export function bladeGeo(R, chordK = 1, { root = 0.13, ns = 16, nc = 7, tipSweep = 0.12 } = {}) {
  const chordAt = (s) => {
    const P = [[0, 0.5], [0.35, 1.0], [0.7, 0.84], [0.9, 0.58], [1, 0.16]];
    let i = 0; while (i < P.length - 2 && s > P[i + 1][0]) i++;
    const f = (s - P[i][0]) / (P[i + 1][0] - P[i][0]), sm = f * f * (3 - 2 * f);
    return R * 0.2 * chordK * (P[i][1] + (P[i + 1][1] - P[i][1]) * sm);
  };
  const pos = [], idx = [];
  for (const side of [1, -1]) { // superfície de cima e de baixo
    const base = pos.length / 3;
    for (let a = 0; a <= ns; a++) {
      const s = a / ns, r = R * (root + (1 - root) * s);
      const c = chordAt(s), twist = 0.42 * (1 - s) + 0.1, sweep = -tipSweep * R * s * s;
      const th = (0.11 - 0.05 * s) * c; // espessura
      for (let b = 0; b <= nc; b++) {
        const u = b / nc;                          // 0 = bordo de ataque, 1 = de fuga
        const zc = c * (0.4 - u) + sweep;          // posição na corda
        const camber = 0.04 * c * Math.sin(Math.PI * u);
        const thick = side * th * (Math.sqrt(Math.max(0, u)) * (1 - u) * 1.6);
        const yc = camber + thick * 0.5;
        // torção: gira (z, y) em torno do eixo do raio
        const z = zc * Math.cos(twist) - yc * Math.sin(twist);
        const y = zc * Math.sin(twist) + yc * Math.cos(twist);
        pos.push(r, y, z);
      }
    }
    for (let a = 0; a < ns; a++) for (let b = 0; b < nc; b++) {
      const p = base + a * (nc + 1) + b, q = p + nc + 1;
      if (side > 0) idx.push(p, q, p + 1, p + 1, q, q + 1); else idx.push(p, p + 1, q, p + 1, q + 1, q);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  // garante a face de cima apontando para cima
  const n = g.attributes.normal; let sy = 0; for (let i = 0; i < n.count / 2; i++) sy += n.getY(i);
  if (sy < 0) { const ix = g.index.array; for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; } g.computeVertexNormals(); }
  return g;
}

// textura do sino do motor: aberturas verticais escuras numa faixa metálica
let BELL = null;
export function bellTex() {
  if (BELL) return BELL;
  const c = document.createElement('canvas'); c.width = 256; c.height = 32;
  const g = c.getContext('2d');
  g.fillStyle = '#d4d6d9'; g.fillRect(0, 0, 256, 32);
  g.fillStyle = '#1a1b1d';
  for (let i = 0; i < 12; i++) { const x = i * (256 / 12) + 4; g.beginPath(); g.roundRect(x, 9, 11, 16, 3); g.fill(); }
  g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(0, 2, 256, 2);
  BELL = new THREE.CanvasTexture(c); BELL.colorSpace = THREE.SRGBColorSpace; BELL.wrapS = THREE.RepeatWrapping; BELL.anisotropy = 4;
  return BELL;
}
