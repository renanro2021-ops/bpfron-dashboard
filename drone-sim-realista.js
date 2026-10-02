/* drone-sim-realista.js — cenário REALISTA do simulador de voo (01/10/2026)
 *
 * Carregado só quando o aluno escolhe "Cenário: Realista" (import dinâmico no
 * drone-simulador.html). O pacote (modelos escaneados + texturas fotográficas
 * CC0 do Poly Haven, ~6 MB) mora num Worker de arquivos estáticos da
 * Cloudflare e é guardado no próprio navegador (Cache Storage): baixa uma vez,
 * depois abre sem internet. Gerado por ferramentas/sim-pacote/gerar-pacote.mjs.
 *
 * A disposição do mapa é a MESMA do cenário leve (os exercícios e as colisões
 * continuam valendo): aqui só se trocam materiais e se acrescentam objetos.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { fachadaDetalhada } from './drone-sim-cidade.js';

export let PACOTE_URL = 'https://bpfron-sim-pacote.bpfron.workers.dev/';
export const definirUrlPacote = (u) => { PACOTE_URL = u.replace(/\/?$/, '/'); };
const CACHE = 'dsim-pacote-v1';

/* ------------------------------------------------------------------ cache */
async function abrirCache() { return 'caches' in self ? caches.open(CACHE) : null; }
async function obter(arq, rede = false) {
  const url = PACOTE_URL + arq, c = await abrirCache();
  if (c && !rede) { const r = await c.match(url); if (r) return r; }
  const r = await fetch(url, { cache: 'no-cache' });
  if (!r.ok) throw new Error(arq + ': HTTP ' + r.status);
  if (c) await c.put(url, r.clone());
  return r;
}
const listaArquivos = (m) => [
  ...Object.values(m.modelos).map((x) => [x.arq, x.bytes]),
  ...Object.values(m.texturas).flatMap((x) => [[x.cor, x.bytes / 2], [x.rel, x.bytes / 2]]),
  ...Object.values(m.folhas).map((x) => [x.arq, x.bytes]),
  [m.hdri, 1.4e6],
];

/* Estado do pacote neste navegador: { baixado, versao, bytes, faltam, online:{versao,bytes} } */
export async function estadoPacote() {
  const c = await abrirCache();
  if (!c) return { suportado: false };
  let local = null;
  const r = await c.match(PACOTE_URL + 'manifesto.json');
  if (r) local = await r.json();
  let faltam = 0;
  if (local) for (const [arq] of listaArquivos(local)) if (!(await c.match(PACOTE_URL + arq))) faltam++;
  return { suportado: true, baixado: !!local && faltam === 0, versao: local && local.versao, bytes: local && local.bytes, faltam };
}

/* Baixa (ou atualiza) tudo para o Cache Storage, avisando o progresso (0–1). */
export async function baixarPacote(progresso = () => {}) {
  try { if (navigator.storage && navigator.storage.persist) await navigator.storage.persist(); } catch (e) { /* sem persistência */ }
  const c = await abrirCache();
  // versão que já está guardada: arquivo da mesma versão não é baixado de novo
  let antes = null; try { const r0 = c && (await c.match(PACOTE_URL + 'manifesto.json')); if (r0) antes = await r0.json(); } catch (e) { /* sem cache */ }
  const m = await (await obter('manifesto.json', true)).json();
  const mesma = antes && antes.versao === m.versao;
  const lista = listaArquivos(m), total = lista.reduce((s, [, b]) => s + b, 0);
  let feito = 0;
  // 4 downloads ao mesmo tempo
  const fila = lista.slice();
  const trabalhador = async () => {
    while (fila.length) {
      const [arq, b] = fila.shift();
      const ja = c && (await c.match(PACOTE_URL + arq));
      if (!ja || !mesma) await obter(arq, true);
      feito += b; progresso(Math.min(1, feito / total), arq);
    }
  };
  await Promise.all([trabalhador(), trabalhador(), trabalhador(), trabalhador()]);
  return m;
}
export async function apagarPacote() { if ('caches' in self) await caches.delete(CACHE); }

/* ------------------------------------------------------------------ aplicar */
export async function aplicarRealista(ctx, progresso = () => {}) {
  const { renderer, cena, ANISO, SOMBRAS, M, addCaixa, MUNDO, rnd } = ctx;
  const R = (a, b) => a + (b - a) * rnd();
  const manifesto = await (await obter('manifesto.json')).json();
  const blobUrl = async (arq) => URL.createObjectURL(await (await obter(arq)).blob());
  const imagem = async (arq) => createImageBitmap(await (await obter(arq)).blob());

  let passos = 0; const totalPassos = 8;
  const avanco = (txt) => progresso(++passos / totalPassos, txt);

  /* ---- céu HDR: luz ambiente e reflexo ---- */
  const hdr = await new HDRLoader().loadAsync(await blobUrl(manifesto.hdri));
  hdr.mapping = THREE.EquirectangularReflectionMapping;
  const pmrem = new THREE.PMREMGenerator(renderer);
  cena.environment = pmrem.fromEquirectangular(hdr).texture;
  cena.environmentIntensity = 0.9;
  hdr.dispose(); pmrem.dispose();
  avanco('céu');

  /* ---- texturas fotográficas ---- */
  const cache = {};
  async function tex(id, rep = [1, 1]) {
    const t = manifesto.texturas[id]; if (!t) return {};
    if (!cache[id]) {
      const [cor, rel] = await Promise.all([imagem(t.cor), imagem(t.rel)]);
      cache[id] = { cor, rel };
    }
    const mk = (img, srgb) => { const x = new THREE.Texture(img); x.wrapS = x.wrapT = THREE.RepeatWrapping; x.anisotropy = ANISO; if (srgb) x.colorSpace = THREE.SRGBColorSpace; x.repeat.set(rep[0], rep[1]); x.needsUpdate = true; return x; };
    return { map: mk(cache[id].cor, true), normalMap: mk(cache[id].rel, false), img: cache[id].cor };
  }
  const aplicar = (mat, t, extra = {}) => {
    if (!mat || !t.map) return;
    mat.map = t.map; if ('normalMap' in mat) { mat.normalMap = t.normalMap; if (mat.normalScale) mat.normalScale.set(0.8, 0.8); }
    Object.assign(mat, extra); mat.needsUpdate = true;
  };
  // compõe foto + desenho (faixas, janelas) numa textura de canvas
  const compor = (largura, altura, foto, ladrilho, desenho) => {
    const c = document.createElement('canvas'); c.width = largura; c.height = altura;
    const g = c.getContext('2d');
    for (let x = 0; x < largura; x += ladrilho[0]) for (let y = 0; y < altura; y += ladrilho[1]) g.drawImage(foto, x, y, ladrilho[0], ladrilho[1]);
    if (desenho) desenho(g, largura, altura);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = ANISO;
    return t;
  };

  // chão: grama com pedra vista do alto (ladrilho de ~8 m); a variação de cor fica no shader
  // pasto: grama com folhas (ladrilho de ~3 m), puxada para o verde da região
  const grama = manifesto.texturas.leafy_grass ? await tex('leafy_grass', [3300, 3300]) : await tex('aerial_grass_rock', [1250, 1250]);
  if (M.chao) { aplicar(M.chao.material, grama, { vertexColors: false }); M.chao.material.color.setRGB(0.5, 0.98, 0.36); M.chao.material.normalScale && M.chao.material.normalScale.set(0.5, 0.5); }
  // pátio, estrada de terra, acostamento, campo
  aplicar(M.patio && M.patio.material, await tex('concrete_floor_worn_001', [11, 8]));
  aplicar(M.terra && M.terra.material, await tex('aerial_mud_1', [1, 74]));
  aplicar(M.acost && M.acost.material, await tex('aerial_mud_1', [160, 1.3]));
  avanco('chão');

  // asfalto com as faixas pintadas por cima (rodovia e ruas do bairro)
  const asf = await tex('asphalt_02');
  if (asf.img) {
    if (M.rodovia) {
      const t = compor(1024, 256, asf.img, [256, 256], (g, w, h) => {
        g.fillStyle = 'rgba(227,189,62,.92)'; g.fillRect(0, 122, 512, 6); g.fillRect(0, 132, 512, 6);
        g.fillStyle = 'rgba(232,232,230,.9)'; g.fillRect(0, 8, w, 6); g.fillRect(0, h - 14, w, 6);
      });
      t.repeat.set(50, 1); aplicar(M.rodovia.material, { map: t, normalMap: asf.normalMap });
      M.rodovia.material.normalMap.repeat.set(200, 2);
    }
    if (M.cidade) {
      const base = compor(512, 320, asf.img, [160, 160], (g, w, h) => { g.fillStyle = 'rgba(235,235,232,.88)'; for (let x = 0; x < w; x += 64) g.fillRect(x, h / 2 - 3, 32, 6); });
      for (const m of M.cidade.malhas.ruas) {
        const rep = m.material.map.repeat.clone(); const t = base.clone(); t.needsUpdate = true; t.repeat.copy(rep);
        aplicar(m.material, { map: t, normalMap: asf.normalMap });
      }
      const calc = await tex('concrete_pavement', [1, 1]);
      for (const m of M.cidade.malhas.calcadas) aplicar(m.material, calc);
    }
  }
  avanco('ruas');

  /* ---- paredes: reboco/tijolo/concreto de foto com as janelas desenhadas por cima ---- */
  const reboco = await tex('painted_plaster_wall'), tijolo = await tex('brick_wall_02'), concreto = await tex('concrete_wall_008');
  const telha = await tex('clay_roof_tiles_02', [1, 1]), chapa = await tex('corrugated_iron_02', [6, 3]), ferrugem = await tex('rusty_metal_02', [2, 1]);
  const janelas = (cols, andares, corJ, porta) => (g, w, h) => {
    const cw = w / cols, ch = h / andares;
    for (let a = 0; a < andares; a++) for (let c = 0; c < cols; c++) {
      if (porta && a === andares - 1 && c === (cols >> 1)) { g.fillStyle = '#4e3b2a'; g.fillRect(c * cw + cw * 0.3, a * ch + ch * 0.25, cw * 0.4, ch * 0.75); continue; }
      g.fillStyle = 'rgba(40,40,38,.55)'; g.fillRect(c * cw + cw * 0.18, a * ch + ch * 0.2, cw * 0.64, ch * 0.54);
      const gr = g.createLinearGradient(0, a * ch + ch * 0.22, 0, a * ch + ch * 0.72); gr.addColorStop(0, corJ); gr.addColorStop(1, '#1b2530');
      g.fillStyle = gr; g.fillRect(c * cw + cw * 0.2, a * ch + ch * 0.22, cw * 0.6, ch * 0.5);
      g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(c * cw + cw * 0.2, a * ch + ch * 0.22, cw * 0.6, ch * 0.06);
      g.fillStyle = 'rgba(220,215,205,.9)'; g.fillRect(c * cw + cw * 0.15, a * ch + ch * 0.72, cw * 0.7, ch * 0.04); // peitoril
    }
  };
  const fachadas = reboco.img ? {
    // mesmo desenho do cenário leve (moldura, grade, peitoril, portas de enrolar) sobre o reboco de foto
    casa: ctx.texCanvas ? fachadaDetalhada(ctx.texCanvas, 'casa', reboco.img) : compor(256, 256, reboco.img, [256, 256], janelas(3, 1, '#5d7a96', true)),
    comercio: ctx.texCanvas ? fachadaDetalhada(ctx.texCanvas, 'comercio', reboco.img) : compor(512, 512, reboco.img, [256, 256], janelas(4, 2, '#4e6b88', true)),
    predio: ctx.texCanvas ? fachadaDetalhada(ctx.texCanvas, 'predio', concreto.img || reboco.img) : compor(512, 512, concreto.img || reboco.img, [256, 256], janelas(4, 5, '#5b7895', false)),
  } : null;
  if (fachadas && M.cidade) {
    const vistos = new Set();
    for (const m of M.cidade.malhas.paredes) for (const mat of [].concat(m.material)) {
      if (vistos.has(mat)) continue; vistos.add(mat);
      const tipo = mat.userData && mat.userData.tipo;
      if (tipo && fachadas[tipo]) { mat.map = fachadas[tipo]; mat.color.lerp(new THREE.Color(1, 1, 1), 0.45); if (tipo === 'galpao') mat.color.setRGB(1.8, 1.8, 1.8); mat.needsUpdate = true; }
      else if (mat.userData && mat.userData.laje) { aplicar(mat, concreto); mat.color.set(0xffffff); }
    }
    // telhados (cada material uma vez só: cerâmica vira foto; fibrocimento fica o desenhado)
    const feitos = new Set();
    for (const m of M.cidade.malhas.telhados) {
      if (m.userData.telha) {
        const mt = [].concat(m.material)[0];
        if (!feitos.has(mt)) { feitos.add(mt); if (mt.userData.telhado === 'ceramica') { aplicar(mt, telha); mt.color.lerp(new THREE.Color(1, 1, 1), 0.6); } }
      } else { m.material = m.material.clone(); aplicar(m.material, chapa); m.material.color.setRGB(1.8, 1.8, 1.8); }
    }
    // muro, oitão e platibanda ficam no reboco claro desenhado (a foto escurecia demais)
  }
  // vila e base do batalhão
  if (fachadas) {
    for (const mat of M.paredesVila || []) { mat.map = fachadas.casa; mat.color.lerp(new THREE.Color(1, 1, 1), 0.45); mat.needsUpdate = true; }
    for (const mat of M.telhadosVila || []) { aplicar(mat, telha); mat.color.lerp(new THREE.Color(1, 1, 1), 0.6); }
    if (M.base) {
      const t = compor(1024, 256, concreto.img || reboco.img, [256, 256], (g, w, h) => {
        janelas(8, 1, '#4f6e8c', false)(g, w, h * 0.9);
        g.fillStyle = '#1e3a5f'; g.fillRect(w / 2 - 140, 8, 280, 44);
        g.fillStyle = '#F5C518'; g.font = 'bold 34px Arial'; g.textAlign = 'center'; g.fillText('BPFRON', w / 2, 42);
      });
      for (const mat of M.base.paredes) { mat.map = t; mat.needsUpdate = true; }
      aplicar(M.base.teto, concreto); M.base.teto.color.set(0xffffff);
    }
    if (M.hangar) for (const mat of M.hangar) { aplicar(mat, chapa); mat.color.setRGB(1.8, 1.8, 1.8); }
  }
  avanco('prédios');

  /* ---- canteiro de obras ---- */
  if (M.canteiro) {
    const K = M.canteiro;
    aplicar(K.mats.chao, await tex('brown_mud_rocks_01', [12, 7]));
    aplicar(K.mats.concreto, await tex('concrete_wall_008', [1, 1])); K.mats.concreto.color.set(0xffffff);
    aplicar(K.mats.tijolo, tijolo);
    for (const m of K.mats.conteiner) { aplicar(m, chapa); m.color.multiplyScalar(1.7); }
    aplicar(K.mats.brita, await tex('brown_mud_rocks_01', [2, 1])); K.mats.brita.color.set(0xcfcac2);
    aplicar(K.mats.areia, await tex('aerial_mud_1', [2, 1])); K.mats.areia.color.set(0xf2dcae);
  }
  avanco('canteiro');

  /* ---- árvores: copa refeita com cartões de folhagem de foto ---- */
  if (manifesto.folhas && M.copas) {
    const fk = Object.keys(manifesto.folhas);
    const atlas = await Promise.all(fk.map(async (k) => { const t = new THREE.Texture(await imagem(manifesto.folhas[k].arq)); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = ANISO; t.needsUpdate = true; return t; }));
    const geoCartoes = (() => {
      const pecas = [], n = 22;
      for (let i = 0; i < n; i++) {
        const p = new THREE.PlaneGeometry(1.25, 1.25); // cada cartão mostra o atlas inteiro (3 ramos)
        p.rotateZ(R(0, Math.PI * 2));
        const dir = new THREE.Vector3(R(-1, 1), R(-0.6, 0.9), R(-1, 1)).normalize();
        p.lookAt(dir); p.translate(dir.x * 0.55, dir.y * 0.45, dir.z * 0.55);
        // normal "esférica": a copa inteira recebe luz como uma bola de folhas
        const pos = p.attributes.position, nor = p.attributes.normal;
        for (let k = 0; k < pos.count; k++) { const v = new THREE.Vector3(pos.getX(k), pos.getY(k) + 0.1, pos.getZ(k)).normalize(); nor.setXYZ(k, v.x, v.y, v.z); }
        pecas.push(p);
      }
      return ctx.mergeGeometries(pecas, false);
    })();
    const cor = new THREE.Color();
    M.copas.forEach((orig, idx) => {
      const mat = new THREE.MeshLambertMaterial({ map: atlas[idx % atlas.length], alphaTest: 0.5, side: THREE.DoubleSide });
      const nova = new THREE.InstancedMesh(geoCartoes, mat, orig.count);
      nova.instanceMatrix.copy(orig.instanceMatrix);
      for (let i = 0; i < orig.count; i++) { cor.setRGB(R(0.82, 1.05), R(0.88, 1.08), R(0.78, 0.95)); nova.setColorAt(i, cor); }
      nova.castShadow = SOMBRAS; nova.receiveShadow = false;
      cena.add(nova); orig.visible = false;
      const k = ctx.OBSTRUI_FOTO.indexOf(orig); if (k >= 0) ctx.OBSTRUI_FOTO[k] = nova;
    });
    const casca = await tex('bark_brown_02', [2, 4]);
    for (const tr of M.troncos || []) aplicar(tr.material, casca);
  }
  avanco('árvores');

  /* ---- objetos escaneados (instanciados) ---- */
  const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
  const modelo = async (id) => { const m = manifesto.modelos[id]; if (!m) return null; const g = await loader.loadAsync(await blobUrl(m.arq)); return g.scene; };
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), ups = new THREE.Vector3(0, 1, 0);
  async function espalhar(id, lugares, colisao) {
    const cenaG = await modelo(id); if (!cenaG || !lugares.length) return;
    cenaG.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(cenaG);
    cenaG.traverse((o) => {
      if (!o.isMesh) return;
      const im = new THREE.InstancedMesh(o.geometry, o.material, lugares.length);
      lugares.forEach((l, i) => {
        q.setFromAxisAngle(ups, l.r || 0);
        const s = l.s || 1;
        m4.compose(new THREE.Vector3(l.x, l.y || 0, l.z), q, new THREE.Vector3(s, s, s)).multiply(o.matrixWorld);
        im.setMatrixAt(i, m4);
      });
      im.castShadow = SOMBRAS; im.receiveShadow = SOMBRAS; im.frustumCulled = false;
      cena.add(im);
    });
    if (colisao) for (const l of lugares) {
      const s = l.s || 1, c = Math.abs(Math.cos(l.r || 0)), sn = Math.abs(Math.sin(l.r || 0));
      const w = (box.max.x - box.min.x) * s, d = (box.max.z - box.min.z) * s;
      addCaixa(l.x, l.z, (w * c + d * sn) / 2, (w * sn + d * c) / 2, (box.max.y) * s + (l.y || 0), colisao);
    }
  }
  const K = ctx.CANTEIRO;
  // barreiras de concreto no perímetro do canteiro
  const barreiras = [];
  for (let x = K.x0 + 4; x < K.x1 - 4; x += 3.4) if (x < 196 || x > 206) barreiras.push({ x, z: K.z1 - 1.2, r: 0 });
  for (let z = K.z0 + 4; z < K.z1 - 4; z += 3.4) barreiras.push({ x: K.x0 + 1.2, z, r: Math.PI / 2 });
  await espalhar('concrete_road_barrier', barreiras.filter((_, i) => i % 2 === 0), 'barreira de concreto');
  await espalhar('concrete_road_barrier_02', barreiras.filter((_, i) => i % 2 === 1), 'barreira de concreto');
  await espalhar('Barrel_01', [[196, -12], [196.8, -11.4], [195.6, -11], [262, 4], [263, 4.6]].map(([x, z]) => ({ x, z, r: R(0, 6) })), 'tambor');
  await espalhar('barrel_03', [[197.4, -12.6], [261.4, 5.2], [180, -52]].map(([x, z]) => ({ x, z, r: R(0, 6) })), 'tambor');
  await espalhar('old_tyre', Array.from({ length: 9 }, (_, i) => ({ x: 270 + (i % 3) * 0.7, z: -50 + Math.floor(i / 3) * 0.7, y: 0.3 * (i % 2), r: R(0, 6) })), null);
  await espalhar('portable_generator', [{ x: 212, z: 9, r: 0.4 }, { x: 246, z: -20, r: 2 }], 'gerador');
  await espalhar('propane_tank', [[213.5, 9.5], [214, 10.2], [244, -19]].map(([x, z]) => ({ x, z })), null);
  await espalhar('wooden_crate_01', [[220, -4], [221.2, -4.4], [220.6, -3.2], [258, 6]].map(([x, z]) => ({ x, z, r: R(0, 3) })), null);
  await espalhar('utility_box_01', [{ x: 152, z: -2, r: Math.PI / 2 }, { x: 228, z: 20 }], 'caixa de energia');
  // pedras escaneadas: na borda do canteiro e espalhadas pelo pasto
  const pedra = (n, x0, x1, z0, z1, s0, s1) => Array.from({ length: n }, () => ({ x: R(x0, x1), z: R(z0, z1), r: R(0, 6), s: R(s0, s1) })).filter((p) => !ctx.bloqueado(p.x, p.z) || (p.x > K.x0 && p.x < K.x1 && p.z > K.z0 && p.z < K.z1 && ctx.livreCanteiro(p.x, p.z)));
  await espalhar('namaqualand_boulder_02', pedra(10, K.x0, K.x1, K.z0, K.z1 - 6, 0.8, 1.6), 'pedra');
  await espalhar('namaqualand_boulder_03', pedra(14, -380, 380, -320, 300, 0.8, 1.8), 'pedra');
  await espalhar('namaqualand_boulder_05', pedra(14, -380, 380, -320, 300, 0.8, 1.8), 'pedra');
  await espalhar('sand_rocks_small_01', pedra(10, K.x0 + 8, K.x1 - 8, K.z0 + 5, K.z1 - 8, 0.8, 1.3), null);
  await espalhar('rock_07', pedra(60, -300, 300, -300, 250, 2, 4), null);
  await espalhar('dead_tree_trunk_02', pedra(6, -350, 350, -300, 260, 0.9, 1.2), 'tronco caído');
  await espalhar('tree_stump_01', pedra(10, -350, 350, -300, 260, 0.9, 1.3), null);
  avanco('canteiro e pedras');

  // bairro: postes de luz, hidrantes, lixeiras e carros cobertos
  if (M.cidade) {
    const C = ctx.CIDADE, lamp = [], hid = [], lixo = [];
    for (const x of C.ruasNS) for (let z = C.limite.z0 + 12; z < C.limite.z1 - 4; z += 26) lamp.push({ x: x + C.larguraRua / 2 + 0.6, z, r: -Math.PI / 2 });
    for (const z of C.ruasLO) for (let x = C.ruasNS[0] + 14; x < C.ruasNS[C.ruasNS.length - 1]; x += 30) lamp.push({ x, z: z - C.larguraRua / 2 - 0.6, r: 0 });
    for (const x of C.ruasNS) for (const z of C.ruasLO) { hid.push({ x: x + 6.2, z: z + 6.2, r: R(0, 6) }); lixo.push({ x: x - 6.4, z: z + 6.6, r: 0 }); }
    const livre = (p) => M.cidade.livre(p.x, p.z, 0.6, 0.6);
    await espalhar('street_lamp_01', lamp.filter(livre), 'poste de luz');
    await espalhar('fire_hydrant', hid.filter(livre), null);
    await espalhar('metal_trash_can', lixo.filter(livre), null);
    const quintais = M.cidade.quadras.filter((q) => q.tipo === 'casas').slice(0, 6).map((q) => ({ x: (q.x0 + q.x1) / 2 + 9, z: (q.z0 + q.z1) / 2 - 2.6, r: Math.PI / 2 })); // no quintal, longe do muro do fundo
    await espalhar('covered_car', quintais.filter(livre), 'carro coberto');
  }
  avanco('bairro');
  return manifesto;
}
