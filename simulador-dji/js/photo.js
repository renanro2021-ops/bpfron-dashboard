// Materiais com texturas fotográficas (Poly Haven, CC0) em assets/textures.
// As fotos são projetadas pela posição no mundo (tamanho real, sem esticar), com um referencial
// que acompanha cada superfície: tijolos sempre na horizontal, telhas descendo pela queda d'água.
import * as THREE from 'three';
import {
  Fn, texture, positionWorld, normalWorldGeometry, cameraViewMatrix, materialColor, vec2, vec3, vec4, float,
  normalize, cross, dot, abs, mix, smoothstep, select, max, length,
} from 'three/tsl';

const DIR = 'assets/textures/';
const loader = new THREE.TextureLoader();
const SETS = {};
function load(name, kind) {
  const t = loader.load(`${DIR}${name}_${kind}.jpg`);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 16;
  t.colorSpace = kind === 'diff' ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  return t;
}
export function photoSet(name) {
  return SETS[name] || (SETS[name] = { diff: load(name, 'diff'), nor: load(name, 'nor'), arm: load(name, 'arm') });
}

// textura desenhada (nome em tex()) → foto, tamanho real do quadro (m) e jeito de projetar
//   mode: 'auto' (parede ou chão conforme a inclinação), 'ground' (sempre de cima), 'roof' (segue a queda)
export const PHOTO = {
  brick: { set: 'red_brick_03', size: 1.0, tint: 0xffd8c8, bright: 1.35 },
  bay: { set: 'red_brick_03', size: 1.0, tint: 0xffd8c8, bright: 1.35 },
  grass: { set: 'leafy_grass', size: 2.5, mode: 'ground', tint: 0x9cc070 },
  asphalt: { set: 'asphalt_02', size: 3.0, mode: 'ground' },
  concrete: { set: 'concrete_floor_02', size: 2.0 },
  gravel: { set: 'gravel', size: 1.4, mode: 'ground', tint: 0x9a968e },
  roof: { set: 'rusty_corrugated_iron', size: 2.0, mode: 'roof', metal: 0.5 },
  rust: { set: 'rusty_metal_02', size: 1.2 },
  metal: { set: 'rusty_metal_02', size: 1.0, tint: 0x8a8a8a },
  wood: { set: 'brown_planks_04', size: 1.0, tint: 0x8a7a68 },
  woodred: { set: 'brown_planks_04', size: 1.0, tint: 0xd0705a, bright: 1.45 },              // vagões da Madeira-Mamoré
  woodredv: { set: 'brown_planks_04', size: 1.0, tint: 0xd0705a, bright: 1.45, mode: 'wallv' },
  canyonRock: { set: 'cliff_side', size: 4.0, tint: 0xe8a088 },
  // trem: chapa pintada envelhecida (poeira de baixo até grime[1] m, escorridos de ferrugem descendo)
  trainPaint: { set: 'rusty_metal_02', size: 1.6, rough: 0.75, metal: 0.6, normal: 0.6, grime: [0.3, 1.7, 0.45], streak: 0.6 },
  trainIron: { set: 'rusty_metal_02', size: 1.0, grime: [0.3, 1.4, 0.45], streak: 0.3 },
  trainRed: { set: 'rusty_metal_02', size: 1.4, rough: 0.85, grime: [0.3, 1.4, 0.45], streak: 0.25 },
};

// referencial de projeção: B = "para cima" na foto, T = "para a direita"; N = normal da superfície (mundo)
function frame(N, mode) {
  const wall = abs(N.y).lessThan(0.7);
  let R;
  if (mode === 'ground') R = select(abs(N.z).greaterThan(0.9), vec3(0, 1, 0), vec3(0, 0, -1));
  else if (mode === 'roof') {
    const hx = vec3(N.x, 0, N.z);
    R = select(length(hx).greaterThan(0.05), normalize(hx).negate(), vec3(0, 0, -1));
    R = select(wall, vec3(0, 1, 0), R);
  } else R = select(wall, vec3(0, 1, 0), vec3(0, 0, -1));
  const B = normalize(R.sub(N.mul(dot(R, N))));
  const T = normalize(cross(B, N));
  if (mode === 'wallv') return { T: B, B: T.negate() }; // foto girada 90° (tábuas na vertical)
  return { T, B };
}

// amostras da foto + relevo convertido para o espaço da câmera
function sampleSet(S, size, mode, N, P) {
  const { T, B } = frame(N, mode);
  const uv = vec2(dot(P, T), dot(P, B)).div(size);
  const col = texture(S.diff, uv);
  // variação lenta de tom para esconder a repetição
  const macro = texture(S.diff, uv.mul(0.137).add(vec2(0.31, 0.17))).rgb;
  const vari = mix(float(0.82), float(1.18), smoothstep(0.15, 0.6, dot(macro, vec3(0.3, 0.59, 0.11))));
  const n = texture(S.nor, uv).xyz.mul(2).sub(1);
  const arm = texture(S.arm, uv);
  return { col: col.rgb.mul(vari), n, T, B, arm };
}
function toViewNormal(T, B, N, n, strength = 1) {
  const w = normalize(T.mul(n.x.mul(strength)).add(B.mul(n.y.mul(strength))).add(N.mul(n.z)));
  return normalize(cameraViewMatrix.mul(vec4(w, 0)).xyz);
}

const cache = new Map();
// material de foto a partir de um MeshStandardMaterial antigo (mantém cor, lados, cores por vértice etc.)
export function photoMaterial(def, old) {
  const key = [def.set, def.size, def.mode, old.color.getHex(), old.side, old.vertexColors, old.polygonOffset, old.transparent, old.opacity, def.tint, def.grime, def.streak, def.rough, def.metal].join('|');
  if (cache.has(key)) return cache.get(key);
  const S = photoSet(def.set);
  const m = new THREE.MeshStandardNodeMaterial({
    color: (def.tint !== undefined ? new THREE.Color(def.tint).multiply(old.color) : old.color.clone()).multiplyScalar(def.bright ?? 1),
    side: old.side, vertexColors: old.vertexColors, transparent: old.transparent, opacity: old.opacity,
    polygonOffset: old.polygonOffset, polygonOffsetFactor: old.polygonOffsetFactor, polygonOffsetUnits: old.polygonOffsetUnits,
    emissive: old.emissive, emissiveIntensity: old.emissiveIntensity,
  });
  const N = normalWorldGeometry, P = positionWorld;
  const s = sampleSet(S, def.size, def.mode || 'auto', N, P);
  m.colorNode = vec4(s.col.mul(materialColor), 1);
  m.normalNode = toViewNormal(s.T, s.B, N, s.n, def.normal ?? 1);
  m.roughnessNode = s.arm.g.mul(def.rough ?? 1);
  if (def.grime) {
    // poeira/barro subindo do chão + escorridos verdes-ferrugem (a foto esticada na vertical vira listras)
    const [y0, y1, amt] = def.grime;
    const st = texture(S.diff, vec2(dot(P, s.T).mul(0.22), P.y.mul(0.035).add(0.4))).level(6).rgb; // versão borrada = escorridos largos
    const streak = smoothstep(0.42, 0.6,dot(st, vec3(0.3, 0.59, 0.11))).mul(def.streak ?? 0).mul(smoothstep(float(y0), float(y1 + 0.6), P.y));
    const dust = smoothstep(float(y1), float(y0), P.y).mul(amt).mul(mix(float(0.6), float(1.2), s.arm.r));
    const base = s.col.mul(materialColor);
    const lum = dot(s.col, vec3(0.3, 0.59, 0.11));
    const rusty = mix(base, vec3(0.2, 0.11, 0.06).mul(lum.mul(1.6).add(0.4)), streak.mul(0.55));
    m.colorNode = vec4(mix(rusty, vec3(0.3, 0.27, 0.23).mul(lum.mul(0.9).add(0.45)), dust), 1);
    m.roughnessNode = mix(s.arm.g.mul(def.rough ?? 1), float(0.95), dust);
  }
  m.metalnessNode = s.arm.b.mul(def.metal ?? 1);
  m.aoNode = mix(float(1), s.arm.r, 0.8);
  cache.set(key, m);
  return m;
}

// terreno: mistura duas fotos pela inclinação (plano / encosta)
export const TERRAIN = {
  grass: { flat: { set: 'leafy_grass', size: 2.5, tint: 0x8fbf5a }, steep: { set: 'forest_ground_04', size: 3.2 }, a: 0.12, b: 0.32 },
  canyonRock: { flat: { set: 'cracked_red_ground', size: 3.0, tint: 0xd09070 }, steep: { set: 'cliff_side', size: 6.0, tint: 0xe8a088 }, a: 0.22, b: 0.45 },
};
export function terrainMaterial(def, old) {
  const F = photoSet(def.flat.set), St = photoSet(def.steep.set);
  const m = new THREE.MeshStandardNodeMaterial({ vertexColors: old.vertexColors });
  const N = normalWorldGeometry, P = positionWorld;
  const a = sampleSet(F, def.flat.size, 'ground', N, P);
  const b = sampleSet(St, def.steep.size, 'auto', N, P);
  const k = smoothstep(def.a, def.b, float(1).sub(N.y));
  const ta = new THREE.Color(def.flat.tint ?? 0xffffff), tb = new THREE.Color(def.steep.tint ?? 0xffffff);
  const col = mix(a.col.mul(vec3(ta.r, ta.g, ta.b)), b.col.mul(vec3(tb.r, tb.g, tb.b)), k);
  m.colorNode = vec4(col, 1);
  const na = toViewNormal(a.T, a.B, N, a.n), nb = toViewNormal(b.T, b.B, N, b.n);
  m.normalNode = normalize(mix(na, nb, k));
  m.roughnessNode = mix(a.arm.g, b.arm.g, k);
  m.metalnessNode = float(0);
  m.aoNode = mix(float(1), mix(a.arm.r, b.arm.r, k), 0.8);
  return m;
}
