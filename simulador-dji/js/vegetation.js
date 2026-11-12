// Vegetação realista: grama 3D (folha por folha) e árvores 3D com vento.
// Tudo é calculado na placa de vídeo (TSL): a grama acompanha a câmera e as árvores balançam.
import * as THREE from 'three';
import {
  Fn, uniform, texture, positionGeometry, positionLocal, uv, instanceIndex, hash, vec2, vec3, vec4, float,
  sin, cos, mix, smoothstep, step, length, normalize, floor, max, clamp, cameraViewMatrix, pow, dot,
  fract, screenCoordinate, positionWorld, normalMap,
} from 'three/tsl';
import { TreeGen, presetOptions } from './eztree/tree.js';

// vento compartilhado por grama e árvores
export const WIND = { time: uniform(0), strength: uniform(1), dir: uniform(new THREE.Vector2(0.9, 0.35).normalize()) };

// =====================================================================
// Grama 3D
// =====================================================================
// data: textura RGBA float sobre o mapa: R = altura do chão, G = densidade (0 = sem grama)
export class GrassField {
  constructor(opts) {
    const o = Object.assign({ patch: 56, perM2: 48, height: 0.75, width: 0.055, colors: 'lawn' }, opts);
    this.o = o;
    const N = Math.round(o.patch * o.patch * o.perM2);
    this.U = {
      cam: uniform(new THREE.Vector3()), drone: uniform(new THREE.Vector3(0, -999, 0)),
      bmin: uniform(new THREE.Vector2(o.bounds[0], o.bounds[1])), bsize: uniform(new THREE.Vector2(o.bounds[2] - o.bounds[0], o.bounds[3] - o.bounds[1])),
    };
    // uma folha: faixa afinando até a ponta (7 vértices)
    const ys = [0, 0.3, 0.58, 0.8, 1];
    const pos = [], uvs = [], idx = [];
    ys.forEach((y, k) => {
      const w = k === ys.length - 1 ? 0 : 0.5 * Math.pow(1 - y, 0.6);
      if (k === ys.length - 1) { pos.push(0, y, 0); uvs.push(0.5, y); } else { pos.push(-w, y, 0, w, y, 0); uvs.push(0, y, 1, y); }
    });
    for (let k = 0; k < ys.length - 2; k++) { const a = k * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    const tip = (ys.length - 1) * 2, last = tip - 2; idx.push(last, last + 1, tip);
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    g.setIndex(idx);
    g.instanceCount = N;
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);

    const U = this.U, S = o.patch, data = o.data;
    const fi = float(instanceIndex);
    const h1 = hash(fi.mul(1.173).add(0.5)), h2 = hash(fi.mul(2.311).add(5.1)), h3 = hash(fi.mul(3.771).add(1.3));
    const h4 = hash(fi.mul(0.713).add(9.2)), h5 = hash(fi.mul(5.13).add(2.7)), h6 = hash(fi.mul(7.91).add(4.4));
    // posição fixa no mundo que "dá a volta" em torno da câmera
    const local = vec2(h1, h2).mul(S);
    const rel = local.sub(U.cam.xz);
    const wxz = U.cam.xz.add(rel.sub(floor(rel.div(S)).mul(S))).sub(S / 2).toVar();
    const d = texture(data, wxz.sub(U.bmin).div(U.bsize)).level(0);
    const groundY = d.r, dens = d.g;
    const dist = length(wxz.sub(U.cam.xz));
    const fade = smoothstep(S * 0.5, S * (o.fadeStart ?? 0.22), dist);
    const keep = step(h3, dens);
    const H = mix(float(0.4), float(1.0), h4).mul(o.height).mul(fade).mul(keep).mul(dens.mul(0.4).add(0.6)).toVar();
    // longe a folha engrossa um pouco: nunca fica mais fina que um pixel (evita cintilar)
    const W = float(o.width).mul(mix(float(0.7), float(1.3), h5)).mul(fade).mul(dist.mul(0.05).add(1));
    const yaw = h6.mul(6.2832);
    const side = vec2(cos(yaw), sin(yaw));
    const p = positionGeometry;
    const t = p.y; // 0 na base, 1 na ponta
    // vento: inclinação de base + rajadas que correm pelo campo
    const gust = sin(WIND.time.mul(1.6).add(wxz.x.mul(0.31)).add(wxz.y.mul(0.23))).mul(0.5).add(0.5);
    const gust2 = sin(WIND.time.mul(3.7).add(wxz.x.mul(1.3)).add(h1.mul(6.0))).mul(0.12);
    const bend = WIND.strength.mul(gust.mul(0.35).add(0.12).add(gust2)).add(h5.sub(0.5).mul(0.35));
    let lean = vec2(WIND.dir.x, WIND.dir.y).mul(bend);
    // vento das hélices: empurra a grama para longe do drone quando ele voa baixo
    const toD = wxz.sub(U.drone.xz);
    const dd = length(toD);
    const alt = U.drone.y.sub(groundY);
    const wash = smoothstep(4.5, 0.3, dd).mul(smoothstep(4.0, 0.6, alt));
    const flutter = sin(WIND.time.mul(28).add(h1.mul(40))).mul(0.25).add(1);
    lean = lean.add(normalize(toD.add(vec2(0.001, 0))).mul(wash.mul(1.4).mul(flutter)));
    const bendT = t.mul(t);
    const off = lean.mul(bendT).mul(H);
    const sag = float(1).sub(length(lean).mul(bendT).mul(0.35));
    const world = vec3(wxz.x.add(side.x.mul(p.x).mul(W)).add(off.x), groundY.add(t.mul(H).mul(sag)), wxz.y.add(side.y.mul(p.x).mul(W)).add(off.y));

    const m = new THREE.MeshStandardNodeMaterial({ side: THREE.DoubleSide, roughness: 0.75 });
    m.positionNode = world;
    // normal: meio caminho entre a face da folha e "para cima" (iluminação suave de gramado)
    const nW = normalize(mix(vec3(side.y.negate(), 0, side.x), vec3(0, 1, 0), 0.65));
    m.normalNode = normalize(cameraViewMatrix.mul(vec4(nW, 0)).xyz);
    const C = o.colors === 'dry'
      ? { base: vec3(0.12, 0.08, 0.035), tip: vec3(0.4, 0.31, 0.16), alt: vec3(0.3, 0.26, 0.11) }
      : o.colors === 'pitch'
        ? { base: vec3(0.03, 0.09, 0.02), tip: vec3(0.16, 0.36, 0.07), alt: vec3(0.12, 0.3, 0.06) }
        : { base: vec3(0.03, 0.065, 0.015), tip: vec3(0.2, 0.36, 0.08), alt: vec3(0.42, 0.4, 0.17) };
    const dry = step(0.88, h3.mul(0.6).add(h5.mul(0.4)));
    const tipC = mix(mix(C.tip, C.tip.mul(0.75), h4), C.alt, dry);
    let col = mix(C.base, tipC, pow(t, 0.8)).mul(mix(float(0.75), float(1.15), h2));
    if (o.colorTex) {
      const r = o.colorRect, cuv = wxz.sub(vec2(r[0], r[1])).div(vec2(r[2], r[3]));
      const fc = texture(o.colorTex, vec2(cuv.x, float(1).sub(cuv.y))).level(0).rgb;
      col = fc.mul(mix(float(0.7), float(1.12), pow(t, 0.7))).mul(mix(float(0.85), float(1.1), h2));
    }
    // longe, base escura e ponta clara viram um tom médio: menos cintilação com a câmera em movimento
    col = mix(col, mix(C.base, tipC, 0.62).mul(0.95), smoothstep(6, S * 0.45, dist).mul(o.colorTex ? 0 : 0.7));
    m.colorNode = vec4(col, 1);
    this.mesh = new THREE.Mesh(g, m);
    this.mesh.frustumCulled = false;
    this.mesh.receiveShadow = true;
    this.mesh.castShadow = false;
  }
  update(camera, drone) {
    this.U.cam.value.copy(camera.position);
    if (drone) this.U.drone.value.set(drone[0], drone[1], drone[2]);
  }
}

// textura de dados (altura + densidade) a partir de funções do mapa
export function grassData(bounds, res, height, density) {
  const [x0, z0, x1, z1] = bounds;
  const w = Math.ceil((x1 - x0) / res), h = Math.ceil((z1 - z0) / res);
  const a = new Float32Array(w * h * 4);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const x = x0 + (i + 0.5) * res, z = z0 + (j + 0.5) * res, k = (j * w + i) * 4;
    a[k] = height(x, z); a[k + 1] = density(x, z); a[k + 3] = 1;
  }
  const t = new THREE.DataTexture(a, w, h, THREE.RGBAFormat, THREE.FloatType);
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.needsUpdate = true;
  return t;
}

// =====================================================================
// Árvores (ez-tree): 3D perto da câmera, "foto" da mesma árvore longe
// =====================================================================
// Perto: tronco e galhos com fotos de casca + cartões de folhas reais, balançando no vento.
// Longe: dois planos cruzados com uma foto da própria árvore 3D, tirada ao carregar o mapa.
// Na faixa entre FADE.r0 e FADE.r1 uma some e a outra aparece por pontilhado (o TAA suaviza),
// então a árvore não "surge do nada".
const TDIR = 'assets/trees/';
const tloader = new THREE.TextureLoader();
const TT = {};
function treeTex(path, srgb) {
  if (TT[path]) return TT[path];
  let done;
  const ready = new Promise((r) => (done = r));
  const t = tloader.load(TDIR + path, () => done(), undefined, () => done());
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return (TT[path] = { t, ready });
}

// espécies por tipo de floresta (3 variações cada; preset + semente)
const SPECIES = {
  conifer: [{ p: 'Pine Medium', seed: 11 }, { p: 'Pine Large', seed: 23 }, { p: 'Pine Small', seed: 37 }],
  broadleaf: [{ p: 'Oak Medium', seed: 5 }, { p: 'Ash Small', seed: 9 }, { p: 'Aspen Medium', seed: 13 }],
  shrub: [{ p: 'Bush 1', seed: 3, tint: 0xc0aa78 }, { p: 'Bush 2', seed: 4, tint: 0xb4a070 }, { p: 'Bush 3', seed: 6, tint: 0xb8ac80 }],
};

export const FADE = { cam: uniform(new THREE.Vector3()), r0: uniform(48), r1: uniform(68) };
// ruído por pixel (interleaved gradient noise) e quanto a árvore está "perto" (1) ou "longe" (0)
const ign = fract(float(52.9829189).mul(fract(dot(screenCoordinate.xy, vec2(0.06711056, 0.00583715)))));
const camDist = length(positionWorld.xz.sub(FADE.cam.xz));
const nearK = smoothstep(FADE.r1, FADE.r0, camDist);

// duplica os triângulos com a face invertida (mesma normal): folhas dos dois lados sem a normal "virar"
function twoSided(g) {
  const idx = g.index.array, n = idx.length, out = new (idx.constructor)(n * 2);
  out.set(idx);
  for (let i = 0; i < n; i += 3) { out[n + i] = idx[i]; out[n + i + 1] = idx[i + 2]; out[n + i + 2] = idx[i + 1]; }
  g.setIndex(new THREE.BufferAttribute(out, 1));
  return g;
}

const VARIANTS = new Map();
function buildVariant(spec) {
  const key = spec.p + '|' + spec.seed;
  if (VARIANTS.has(key)) return VARIANTS.get(key);
  const o = presetOptions(spec.p, spec.seed);
  // 12/11/2026: o álamo vinha com folha de outono (amarela) e virava manchas na mata; usa a folha verde do freixo
  if (spec.p.startsWith('Aspen')) { o.leaves.type = 'ash'; o.leaves.tint = 0xffffff; }
  // galhos finos com menos gomos (quase não muda o desenho, alivia a placa de vídeo)
  for (let l = 1; l <= 3; l++) {
    o.branch.sections[l] = Math.max(3, Math.round(o.branch.sections[l] * 0.7));
    o.branch.segments[l] = Math.max(3, Math.round(o.branch.segments[l] * 0.75));
  }
  const g = new TreeGen(o).generate();
  const bb = g.wood.boundingBox.clone().union(g.leaves.boundingBox);
  const s = 1 / bb.max.y; // altura 1: a instância escala pela altura da árvore
  g.wood.scale(s, s, s); g.leaves.scale(s, s, s);
  g.wood.computeBoundingBox(); g.leaves.computeBoundingBox();
  const halfW = Math.max(-bb.min.x, bb.max.x, -bb.min.z, bb.max.z) * s;
  // normais "de copa": a folha é iluminada como parte de um volume, não como um cartão chapado
  const lc = g.leaves.boundingBox.getCenter(new THREE.Vector3());
  const pos = g.leaves.attributes.position, nrm = g.leaves.attributes.normal, v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.set(pos.getX(i) - lc.x, (pos.getY(i) - lc.y) * 1.3, pos.getZ(i) - lc.z).normalize();
    v.y += 0.35; v.normalize();
    nrm.setXYZ(i, v.x, v.y, v.z);
  }
  twoSided(g.leaves);
  // tronco (para a colisão): raio na base, comprimento e quanto afina até o topo — na escala de altura 1
  const trunk = { r: o.branch.radius[0] * s, len: Math.min(1, o.branch.length[0] * s), taper: o.type === 'evergreen' ? 1 : o.branch.taper[0] };
  const V = { o, wood: g.wood, leaves: g.leaves, halfW, tint: spec.tint, trunk };
  VARIANTS.set(key, V);
  return V;
}

// nós de textura da casca (repetição do preset aplicada no uv)
function barkNodes(o) {
  const type = o.bark.type, sc = o.bark.textureScale;
  const uvR = uv().mul(vec2(sc.x, 1 / sc.y));
  const T = (k, srgb) => treeTex(`bark/${type}_${k}_1k.jpg`, srgb);
  const c = T('color', true), n = T('normal', false), r = T('roughness', false), a = T('ao', false);
  // cascas escuras (carvalho, pinheiro) ficariam pretas na sombra da copa: clareia um pouco
  const tc = new THREE.Color(o.bark.tint).multiplyScalar(type === 'birch' ? 1 : 1.45);
  return {
    color: texture(c.t, uvR).rgb.mul(vec3(tc.r, tc.g, tc.b)),
    normal: normalMap(texture(n.t, uvR)), rough: texture(r.t, uvR).r, ao: mix(float(1), texture(a.t, uvR).r, 0.6),
    ready: [c.ready, n.ready, r.ready, a.ready],
  };
}
function leafTex(o) { return treeTex(`leaves/${o.leaves.type}_color.png`, true); }
function leafColor(V) {
  const c = new THREE.Color(V.o.leaves.tint);
  if (V.tint !== undefined) c.multiply(new THREE.Color(V.tint));
  return c;
}

// balanço: a copa (em cima) mexe mais; folhas ganham um tremor rápido
function sway(amount, flutter) {
  const ph = hash(float(instanceIndex).mul(3.17)).mul(6.28);
  const hgt = positionGeometry.y;
  const k = hgt.mul(hgt).mul(amount).mul(WIND.strength.mul(0.7).add(0.3));
  let s = vec3(
    sin(WIND.time.mul(0.9).add(ph)).mul(0.6).add(WIND.dir.x.mul(0.5)),
    0,
    cos(WIND.time.mul(0.73).add(ph.mul(1.3))).mul(0.6).add(WIND.dir.y.mul(0.5)),
  ).mul(k);
  if (flutter) {
    const f = sin(WIND.time.mul(6.0).add(positionGeometry.x.mul(53)).add(positionGeometry.z.mul(41)).add(ph));
    s = s.add(vec3(f, f.mul(0.5), f.negate()).mul(flutter).mul(hgt));
  }
  return positionLocal.add(s);
}

// planos cruzados (frente e lado), com faces dos dois lados e normais de copa
function impostorGeo(halfW) {
  const pos = [], nrm = [], uvs = [], idx = [], groups = [];
  const quad = (axis, face, group) => {
    const b = pos.length / 3;
    const corners = [[-1, 0], [1, 0], [1, 1], [-1, 1]];
    for (const [cx, cy] of corners) {
      const w = cx * halfW;
      const x = axis === 0 ? w : 0, z = axis === 0 ? 0 : -w;
      pos.push(x, cy, z);
      const n = new THREE.Vector3(x / halfW * 0.7, (cy - 0.45) * 0.8 + 0.45, z / halfW * 0.7);
      if (axis === 0) n.z += 0.5 * face; else n.x += 0.5 * face;
      n.normalize(); nrm.push(n.x, n.y, n.z);
      uvs.push((cx + 1) / 2, cy);
    }
    const s = idx.length;
    if (face > 0) idx.push(b, b + 1, b + 2, b, b + 2, b + 3); else idx.push(b, b + 2, b + 1, b, b + 3, b + 2);
    groups.push([s, 6, group]);
  };
  quad(0, 1, 0); quad(0, -1, 0); quad(1, 1, 1); quad(1, -1, 1);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(idx);
  for (const [s, c, m] of groups) g.addGroup(s, c, m);
  return g;
}

export class Forest {
  // trees: [{x,y,z,h,w,rot,tint}], kind 'conifer' | 'broadleaf' | 'shrub'
  constructor(trees, kind, renderer) {
    this.trees = trees; this.kind = kind; this.renderer = renderer;
    this.group = new THREE.Group();
    this.cap = 900;
    this.variants = [];
    const waits = [];
    (SPECIES[kind] || SPECIES.broadleaf).forEach((spec, v) => {
      const V = buildVariant(spec);
      const bark = barkNodes(V.o), lt = leafTex(V.o);
      waits.push(...bark.ready, lt.ready);
      const wood = new THREE.MeshStandardNodeMaterial({ alphaTest: 0.5 });
      wood.colorNode = bark.color; wood.normalNode = bark.normal; wood.roughnessNode = bark.rough; wood.aoNode = bark.ao;
      wood.positionNode = sway(0.25, 0);
      wood.opacityNode = step(ign, nearK);
      const leaves = new THREE.MeshStandardNodeMaterial({ map: lt.t, color: leafColor(V), alphaTest: V.o.leaves.alphaTest, roughness: 0.8 });
      leaves.positionNode = sway(0.25, 0.012);
      leaves.opacityNode = step(ign, nearK);
      const W = new THREE.InstancedMesh(V.wood, wood, this.cap), L = new THREE.InstancedMesh(V.leaves, leaves, this.cap);
      for (const m of [W, L]) { m.count = 0; m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; this.group.add(m); }
      L.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(this.cap * 3), 3);
      // longe: planos cruzados (a textura é a foto tirada em capture())
      const mine = trees.filter((_, i) => i % 3 === v);
      const imp = [0, 1].map(() => {
        const m = new THREE.MeshStandardNodeMaterial({ alphaTest: 0.5, roughness: 0.9 });
        return m;
      });
      const far = new THREE.InstancedMesh(impostorGeo(V.halfW), imp, Math.max(1, mine.length));
      far.count = mine.length; far.visible = false; far.receiveShadow = true; far.castShadow = false; far.frustumCulled = false;
      this.group.add(far);
      this.variants.push({ V, wood: W, leaves: L, far, imp, mine });
    });
    this.fill();
    this.m4 = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.s = new THREE.Vector3(); this.p = new THREE.Vector3(); this.c = new THREE.Color();
    this.last = new THREE.Vector3(1e9, 0, 0);
    this.ready = false;
    Promise.all(waits).then(() => (this.ready = true));
    this.captured = false;
  }

  // tronco em metros da árvore i da lista: { r0 (base), r1 (topo), len }
  trunkOf(i) {
    const t = this.trees[i], T = this.variants[i % this.variants.length].V.trunk;
    const s = t.h * (this.kind === 'shrub' ? 0.9 : 1);
    return { r0: T.r * s, r1: T.r * s * (1 - T.taper), len: T.len * s };
  }
  // matriz de cada árvore: altura 1 na geometria → escala pela altura; largura pelo preset
  matrix(t, out) {
    this.q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), t.rot);
    const s = t.h * (this.kind === 'shrub' ? 0.9 : 1);
    this.s.set(s, s, s); this.p.set(t.x, t.y - 0.2, t.z);
    return out.compose(this.p, this.q, this.s);
  }
  tint(t) { const k = 0.8 + t.tint * 0.35; return this.c.setRGB(k * 0.97, k, k * 0.92); }

  fill() {
    this.m4 = this.m4 || new THREE.Matrix4(); this.q = this.q || new THREE.Quaternion(); this.s = this.s || new THREE.Vector3(); this.p = this.p || new THREE.Vector3(); this.c = this.c || new THREE.Color();
    for (const P of this.variants) {
      P.mine.forEach((t, i) => { P.far.setMatrixAt(i, this.matrix(t, this.m4)); P.far.setColorAt(i, this.tint(t)); });
      P.far.instanceMatrix.needsUpdate = true;
      if (P.far.instanceColor) P.far.instanceColor.needsUpdate = true;
    }
  }

  // tira a "foto" de cada variação 3D (cor pura, sem luz) para usar nos planos de longe
  capture(renderer) {
    this.captured = true;
    const prevRT = renderer.getRenderTarget();
    const prevColor = renderer.getClearColor(new THREE.Color()), prevAlpha = renderer.getClearAlpha();
    for (const P of this.variants) {
      const V = P.V, bark = barkNodes(V.o);
      const scene = new THREE.Scene();
      const wm = new THREE.MeshBasicNodeMaterial(); wm.colorNode = bark.color.mul(bark.ao.mul(0.4).add(0.45));
      const lm = new THREE.MeshBasicNodeMaterial({ map: leafTex(V.o).t, color: leafColor(V).multiplyScalar(0.8), alphaTest: V.o.leaves.alphaTest, side: THREE.DoubleSide });
      // copa mais escura por dentro e embaixo (como a sombra da própria árvore)
      const lc = V.leaves.boundingBox.getCenter(new THREE.Vector3());
      const lcol = leafColor(V).multiplyScalar(0.85);
      const lt = texture(lm.map);
      // folha que passou no recorte vira opaca na foto (senão a foto de longe sai rala)
      lm.colorNode = vec4(lt.rgb.mul(vec3(lcol.r, lcol.g, lcol.b))
        .mul(smoothstep(lc.y - 0.45, lc.y + 0.4, positionGeometry.y).mul(0.45).add(0.55)), step(V.o.leaves.alphaTest * 0.4, lt.a));
      scene.add(new THREE.Mesh(V.wood, wm), new THREE.Mesh(V.leaves, lm));
      const hw = V.halfW, Hpx = 1024, Wpx = Math.min(1024, Math.max(128, Math.round(Hpx * 2 * hw)));
      P.imp.forEach((mat, k) => {
        const rt = new THREE.RenderTarget(Wpx, Hpx, { type: THREE.UnsignedByteType, colorSpace: THREE.SRGBColorSpace, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter });
        const cam = new THREE.OrthographicCamera(-hw, hw, 1, 0, 0.01, 20);
        if (k === 0) cam.position.set(0, 0, 10); else cam.position.set(10, 0, 0);
        cam.lookAt(0, 0, 0);
        renderer.setRenderTarget(rt);
        renderer.setClearColor(this.kind === 'shrub' ? 0x6a6040 : 0x1e2c14, 0);
        renderer.clear();
        renderer.render(scene, cam);
        (P.rts || (P.rts = []))[k] = rt;
        // no WebGPU a imagem gerada fica de cabeça para baixo em relação ao uv
        const tuv = renderer.backend && renderer.backend.isWebGPUBackend ? vec2(uv().x, float(1).sub(uv().y)) : uv();
        mat.colorNode = texture(rt.texture, tuv).rgb.mul(0.88);
        // a redução da imagem (mipmap) afina a copa ao longe: reforça a cobertura com a distância
        mat.opacityNode = texture(rt.texture, tuv).a.mul(camDist.mul(0.012).add(1.5)).mul(step(nearK, ign));
        mat.needsUpdate = true;
      });
      P.far.visible = true;
    }
    renderer.setRenderTarget(prevRT);
    renderer.setClearColor(prevColor, prevAlpha);
  }

  update(cam) {
    FADE.cam.value.copy(cam);
    if (!this.captured && this.ready && this.renderer) this.capture(this.renderer);
    if (cam.distanceToSquared(this.last) < 4) return;
    this.last.copy(cam);
    const R = FADE.r1.value + 6, r2 = R * R;
    for (const P of this.variants) {
      let n = 0;
      for (const t of P.mine) {
        const dx = t.x - cam.x, dz = t.z - cam.z;
        if (dx * dx + dz * dz > r2 || n >= this.cap) continue;
        this.matrix(t, this.m4);
        P.wood.setMatrixAt(n, this.m4); P.leaves.setMatrixAt(n, this.m4);
        P.leaves.setColorAt(n, this.tint(t));
        n++;
      }
      P.wood.count = P.leaves.count = n;
      P.wood.instanceMatrix.needsUpdate = P.leaves.instanceMatrix.needsUpdate = true;
      if (P.leaves.instanceColor) P.leaves.instanceColor.needsUpdate = true;
    }
  }
}
