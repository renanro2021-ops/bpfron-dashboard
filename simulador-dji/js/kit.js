// Kit de montagem: junta muitas peças pequenas (caixas, cilindros, tornos) em poucas malhas,
// uma por material. Usado pelo trem e pelos janelões (centenas de peças viram meia dúzia de malhas).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
const BOX = new THREE.BoxGeometry(1, 1, 1);

// caixa com as 12 arestas chanfradas (c = tamanho do chanfro): pega um filete de luz na quina e tira a cara de "bloco"
function chamferBox(sx, sy, sz, c) {
  const h = [sx / 2, sy / 2, sz / 2], d = [sx, sy, sz];
  const P = (s, t) => [0, 1, 2].map((i) => s[i] * (i === t ? h[i] : h[i] - c));
  const tris = [], quad = (A, B, C, D) => tris.push([A, B, C], [A, C, D]);
  const cyc = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  for (let i = 0; i < 3; i++) {
    const j = (i + 1) % 3, k = (i + 2) % 3;
    for (const a of [-1, 1]) {
      quad(...cyc.map(([u, v]) => { const s = []; s[i] = a; s[j] = u; s[k] = v; return P(s, i); }));
      for (const b of [-1, 1]) {
        const e = (t, v) => { const s = []; s[i] = a; s[j] = b; s[k] = v; return P(s, t); };
        quad(e(i, -1), e(j, -1), e(j, 1), e(i, 1));
      }
    }
  }
  for (const a of [-1, 1]) for (const b of [-1, 1]) for (const e of [-1, 1]) { const s = [a, b, e]; tris.push([P(s, 0), P(s, 1), P(s, 2)]); }
  const pos = new Float32Array(tris.length * 9), nor = new Float32Array(tris.length * 9), uv = new Float32Array(tris.length * 6);
  const A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3(), n = new THREE.Vector3(), q = new THREE.Vector3();
  tris.forEach((t, f) => {
    A.fromArray(t[0]); B.fromArray(t[1]); C.fromArray(t[2]);
    n.subVectors(B, A).cross(q.subVectors(C, A));
    if (n.dot(q.copy(A).add(B).add(C)) < 0) { const tmp = t[1]; t[1] = t[2]; t[2] = tmp; n.negate(); }
    n.normalize();
    const ax = Math.abs(n.x) >= Math.abs(n.y) && Math.abs(n.x) >= Math.abs(n.z) ? 0 : Math.abs(n.y) >= Math.abs(n.z) ? 1 : 2;
    const [ui, vi] = ax === 0 ? [2, 1] : ax === 1 ? [0, 2] : [0, 1];
    t.forEach((p, v) => {
      pos.set(p, f * 9 + v * 3); nor.set([n.x, n.y, n.z], f * 9 + v * 3);
      uv[f * 6 + v * 2] = p[ui] / d[ui] + 0.5; uv[f * 6 + v * 2 + 1] = p[vi] / d[vi] + 0.5;
    });
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

export class Kit {
  // opts.bevel: chanfro (m) das caixas; 0 = caixas de quina viva (mais leve)
  constructor(opts = {}) { this.parts = new Map(); this.base = new THREE.Matrix4(); this.bevel = opts.bevel || 0; }
  _chamfer(sx, sy, sz) {
    const c = Math.min(this.bevel, Math.min(sx, sy, sz) * 0.3);
    return c >= 0.004 ? chamferBox(sx, sy, sz, c) : null;
  }

  // acrescenta uma geometria com transformação (posição, rotação XYZ, escala)
  add(key, geo, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
    _m.compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz));
    return this.addM(key, geo, _m);
  }
  addM(key, geo, m) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(this.base, m));
    if (!this.parts.has(key)) this.parts.set(key, []);
    this.parts.get(key).push(g);
    return g;
  }
  box(key, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) {
    const g = this.bevel ? this._chamfer(sx, sy, sz) : null;
    return g ? this.add(key, g, x, y, z, rx, ry, rz) : this.add(key, BOX, x, y, z, rx, ry, rz, sx, sy, sz);
  }
  // cilindro com eixo 'x', 'y' ou 'z'
  cyl(key, x, y, z, r, len, axis = 'y', seg = 16, rTop = r, open = false, t0 = 0, tl = Math.PI * 2) {
    const g = new THREE.CylinderGeometry(rTop, r, len, seg, 1, open, t0, tl);
    const rx = axis === 'z' ? Math.PI / 2 : 0, rz = axis === 'x' ? -Math.PI / 2 : 0;
    return this.add(key, g, x, y, z, rx, 0, rz);
  }
  // barra (caixa ou cilindro) ligando dois pontos
  rod(key, a, b, r, seg = 8, square = false) {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A), L = d.length();
    const g = square ? (this.bevel && this._chamfer(r * 2, L, r * 2)) || new THREE.BoxGeometry(r * 2, L, r * 2) : new THREE.CylinderGeometry(r, r, L, seg, 1);
    _q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    _m.compose(A.add(B).multiplyScalar(0.5), _q, _s.set(1, 1, 1));
    return this.addM(key, g, _m);
  }
  // sólido de torno (perfil [[raio, altura], ...]) com eixo 'y', 'z', 'x' (altura para +x) ou '-x' (altura para -x)
  lathe(key, pts, x, y, z, axis = 'y', seg = 24) {
    const g = new THREE.LatheGeometry(pts.map(([r, h]) => new THREE.Vector2(r, h)), seg);
    const rz = axis === 'x' ? -Math.PI / 2 : axis === '-x' ? Math.PI / 2 : 0;
    return this.add(key, g, x, y, z, axis === 'z' ? Math.PI / 2 : 0, 0, rz);
  }

  // monta as malhas (uma por material) dentro de "parent"
  build(parent, mats, opts = {}) {
    const out = {};
    for (const [key, list] of this.parts) {
      const geo = mergeGeometries(list, false);
      list.forEach((g) => g.dispose());
      geo.computeBoundingSphere();
      const m = new THREE.Mesh(geo, mats[key]);
      m.castShadow = opts.shadow?.[key] ?? true; m.receiveShadow = true;
      parent.add(m); out[key] = m;
    }
    this.parts.clear();
    return out;
  }
}
