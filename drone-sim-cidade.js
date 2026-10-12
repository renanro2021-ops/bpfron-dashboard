/* drone-sim-cidade.js — bairro, carros e placas do simulador de voo (01/10/2026)
 *
 * Usado pelo drone-simulador.html (import ES). Monta, ao sul da rodovia, um
 * bairro em grade (ruas de 10 m, calçadas, quadras de 40×40 m com casas,
 * comércio, prédio, galpão e praça) e enche as ruas de carros estacionados com
 * PLACA MERCOSUL sorteada — base dos exercícios "localizar pela placa" e
 * "acompanhar o alvo".
 *
 * Desempenho (celular): cada TIPO de carro é desenhado por InstancedMesh (6
 * partes × 4 tipos = 24 chamadas de desenho para centenas de carros). As
 * placas ficam todas numa imagem só (atlas 2048×2048, 184 placas) e cada
 * instância lê a sua célula por um atributo próprio (aPlaca) injetado no shader.
 *
 * Coordenadas: norte = -z. Carro: frente para -z, comprimento em z.
 */

export const CIDADE = {
  ruasNS: [0, 50, 100, 150, 200, 250],   // ruas norte-sul (x do eixo)
  ruasLO: [60, 110, 160, 210, 260],      // ruas leste-oeste (z do eixo)
  larguraRua: 10, calcada: 2.2,
  limite: { x0: -8, x1: 258, z0: 44, z1: 268 },
  // rodovia em frente à base (leste–oeste): faz parte da malha de ruas desde 12/10/2026
  rodovia: { z: 40, larg: 8, x0: -800, x1: 800, acost: 2.5 },
  // quem chega na rodovia pelo norte: [x do eixo, largura] — acesso da base e estrada de terra
  entradasNorte: [[12, 7], [120, 5]],
};

/* ------------------------------------------------------------------ placas */
const LETRAS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
export function sortearPlaca(rnd) {
  const L = () => LETRAS[(rnd() * 26) | 0], N = () => String((rnd() * 10) | 0);
  return L() + L() + L() + N() + L() + N() + N(); // padrão Mercosul: LLLNLNN
}
export const placaFormatada = (p) => p.slice(0, 3) + ' ' + p.slice(3);

/* Desenha uma placa Mercosul (proporção 40×13 cm) em (x,y,w,h). */
export function desenharPlaca(g, x, y, w, h, texto) {
  const r = h * 0.09;
  g.save();
  g.fillStyle = '#f7f7f5';
  g.beginPath(); g.roundRect ? g.roundRect(x, y, w, h, r) : g.rect(x, y, w, h); g.fill();
  g.fillStyle = '#0b3a8c'; g.fillRect(x + w * 0.02, y + h * 0.04, w * 0.96, h * 0.2);   // faixa azul
  g.fillStyle = '#fff'; g.font = `bold ${Math.round(h * 0.14)}px Arial`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('BRASIL', x + w / 2, y + h * 0.145);
  // bandeirinha à direita e o "Mercosul" à esquerda
  const bx = x + w * 0.87, by = y + h * 0.07, bw = w * 0.08, bh = h * 0.14;
  g.fillStyle = '#1f8f3a'; g.fillRect(bx, by, bw, bh);
  g.fillStyle = '#f2d21b'; g.beginPath(); g.moveTo(bx + bw / 2, by + bh * 0.1); g.lineTo(bx + bw * 0.92, by + bh / 2); g.lineTo(bx + bw / 2, by + bh * 0.9); g.lineTo(bx + bw * 0.08, by + bh / 2); g.closePath(); g.fill();
  g.fillStyle = '#1b3f95'; g.beginPath(); g.arc(bx + bw / 2, by + bh / 2, bh * 0.22, 0, 7); g.fill();
  g.fillStyle = '#fff'; g.beginPath(); g.arc(x + w * 0.09, y + h * 0.145, h * 0.06, 0, 7); g.fill();
  // caracteres
  g.fillStyle = '#121212';
  g.save();
  g.translate(x + w / 2, y + h * 0.63);
  g.scale(0.74, 1);
  g.font = `bold ${Math.round(h * 0.62)}px "Arial Narrow", "Roboto Condensed", Arial, sans-serif`;
  g.fillText(placaFormatada(texto), 0, 0);
  g.restore();
  g.strokeStyle = '#2a2a2a'; g.lineWidth = Math.max(1, h * 0.03);
  g.beginPath(); g.roundRect ? g.roundRect(x + 1, y + 1, w - 2, h - 2, r) : g.rect(x + 1, y + 1, w - 2, h - 2); g.stroke();
  g.restore();
}

/* ------------------------------------------------------------------ carros */
const TIPOS = {
  sedan: {
    L: 4.5, W: 1.78, r: 0.31, eixos: [0.88, 3.62],
    corpo: [[0.02, 0.30], [0, 0.55], [0.08, 0.70], [1.15, 0.86], [1.30, 0.88], [3.55, 0.94], [4.38, 0.92], [4.5, 0.78], [4.48, 0.32], [4.30, 0.26], [0.2, 0.26]],
    cabine: [[1.30, 0.86], [2.05, 1.40], [3.20, 1.40], [3.62, 0.94]],
    teto: [[2.0, 1.38], [3.25, 1.38], [3.22, 1.44], [2.06, 1.44]],
    farolY: 0.66, lanternaY: 0.84, placaF: 0.42, placaT: 0.6,
  },
  hatch: {
    L: 4.0, W: 1.74, r: 0.30, eixos: [0.82, 3.25],
    corpo: [[0.02, 0.30], [0, 0.56], [0.08, 0.70], [1.0, 0.86], [1.12, 0.88], [3.85, 0.94], [4.0, 0.80], [3.98, 0.32], [3.8, 0.26], [0.2, 0.26]],
    cabine: [[1.12, 0.88], [1.85, 1.42], [3.55, 1.42], [3.9, 0.94]],
    teto: [[1.8, 1.40], [3.6, 1.40], [3.56, 1.46], [1.85, 1.46]],
    farolY: 0.68, lanternaY: 0.9, placaF: 0.42, placaT: 0.62,
  },
  suv: {
    L: 4.6, W: 1.86, r: 0.38, eixos: [0.95, 3.7],
    corpo: [[0.02, 0.40], [0, 0.70], [0.1, 0.88], [1.05, 1.02], [1.2, 1.04], [4.45, 1.06], [4.6, 0.95], [4.58, 0.42], [4.4, 0.34], [0.2, 0.34]],
    cabine: [[1.2, 1.04], [1.85, 1.62], [4.35, 1.62], [4.5, 1.06]],
    teto: [[1.8, 1.60], [4.38, 1.60], [4.36, 1.68], [1.85, 1.68]],
    farolY: 0.82, lanternaY: 1.0, placaF: 0.5, placaT: 0.7,
  },
  picape: {
    L: 5.3, W: 1.86, r: 0.38, eixos: [0.95, 4.2],
    corpo: [[0.02, 0.42], [0, 0.72], [0.1, 0.92], [1.15, 1.05], [1.3, 1.06], [5.2, 1.06], [5.3, 0.98], [5.28, 0.44], [5.1, 0.36], [0.2, 0.36]],
    cabine: [[1.3, 1.06], [1.95, 1.66], [3.05, 1.66], [3.15, 1.06]],
    teto: [[1.9, 1.64], [3.1, 1.64], [3.08, 1.72], [1.95, 1.72]],
    cacamba: true, farolY: 0.84, lanternaY: 0.95, placaF: 0.52, placaT: 0.62,
  },
};
export const TIPOS_CARRO = Object.keys(TIPOS);
export const dimensoesCarro = (tipo) => ({ L: TIPOS[tipo].L, W: TIPOS[tipo].W, H: TIPOS[tipo].teto[2][1] });

// Cores de frota brasileira (branco e prata dominam).
const PALETA = [[0xf2f2f0, 33], [0xb9bcc0, 24], [0x6b6e72, 12], [0x16181b, 12], [0x9b1b1b, 8], [0x1d3f7a, 5], [0x5a3a22, 3], [0x2f5d3a, 3]];
export function sortearCor(rnd) {
  let t = rnd() * 100;
  for (const [c, p] of PALETA) { if ((t -= p) <= 0) return c; }
  return PALETA[0][0];
}

/* Geometrias de um tipo de carro, separadas por material. */
function geometriasCarro(THREE, mergeGeometries, tipo) {
  const T = TIPOS[tipo];
  const ext = (pts, largura, bev) => {
    const s = new THREE.Shape(); s.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]); s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: largura, bevelEnabled: bev > 0, bevelThickness: bev, bevelSize: bev, bevelSegments: 3, curveSegments: 4 });
    g.translate(-T.L / 2, 0, -largura / 2); g.rotateY(-Math.PI / 2);
    return g.toNonIndexed();
  };
  const sem = (g) => { g = g.index ? g.toNonIndexed() : g; return g; };
  // cabine: polígono fechado descendo até a linha da carroceria
  const cab = [...T.cabine, [T.cabine[3][0], T.cabine[3][1] - 0.05], [T.cabine[0][0], T.cabine[0][1] - 0.05]];
  const pintura = [ext(T.corpo, T.W - 0.12, 0.06), ext(T.teto, T.W - 0.3, 0.02)];
  const escuro = [];
  if (T.cacamba) { const b = new THREE.BoxGeometry(T.W - 0.3, 0.06, T.L - 3.35); b.translate(0, T.corpo[5][1] + 0.01, T.L / 2 - (T.L - 3.35) / 2 - 0.12); escuro.push(sem(b)); }
  const vidro = [ext(cab, T.W - 0.2, 0.03)];
  const pneu = [], roda = [];
  for (const u of T.eixos) for (const s of [-1, 1]) {
    const z = u - T.L / 2, x = s * (T.W / 2 - 0.08);
    const p = new THREE.CylinderGeometry(T.r, T.r, 0.24, 18); p.rotateZ(Math.PI / 2); p.translate(x, T.r, z); pneu.push(sem(p));
    const c = new THREE.CylinderGeometry(T.r * 0.6, T.r * 0.6, 0.26, 12); c.rotateZ(Math.PI / 2); c.translate(x, T.r, z); roda.push(sem(c));
  }
  const luzes = [];
  const pintar = (g, r, gg, b) => { const n = g.attributes.position.count, cc = new Float32Array(n * 3); for (let i = 0; i < n; i++) { cc[i * 3] = r; cc[i * 3 + 1] = gg; cc[i * 3 + 2] = b; } g.setAttribute('color', new THREE.BufferAttribute(cc, 3)); return g; };
  for (const s of [-1, 1]) {
    const f = new THREE.BoxGeometry(0.34, 0.12, 0.05); f.translate(s * (T.W / 2 - 0.36), T.farolY, -T.L / 2 + 0.03); luzes.push(pintar(sem(f), 1, 0.97, 0.85));
    const l = new THREE.BoxGeometry(0.3, 0.12, 0.05); l.translate(s * (T.W / 2 - 0.3), T.lanternaY, T.L / 2 - 0.03); luzes.push(pintar(sem(l), 0.75, 0.04, 0.04));
  }
  const placa = [];
  const pf = new THREE.PlaneGeometry(0.4, 0.13); pf.rotateY(Math.PI); pf.translate(0, T.placaF, -T.L / 2 - 0.075); placa.push(pf);
  const pt = new THREE.PlaneGeometry(0.4, 0.13); pt.translate(0, T.placaT, T.L / 2 + 0.075); placa.push(pt);
  const m = (arr) => (arr.length ? mergeGeometries(arr.map((g) => { const h = g.index ? g.toNonIndexed() : g; if (!h.attributes.color && arr === luzes) return h; return h; }), false) : null);
  return { pintura: m(pintura), escuro: m(escuro), vidro: m(vidro), pneu: m(pneu), roda: m(roda), luzes: m(luzes), placa: mergeGeometries(placa, false) };
}

/* Materiais compartilhados dos carros (o cenário realista só troca/realça). */
function materiaisCarro(THREE, texPlacas) {
  const placa = new THREE.MeshStandardMaterial({ map: texPlacas, roughness: 0.5, metalness: 0.05 });
  placa.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec2 aPlaca;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\n#ifdef USE_MAP\n vMapUv = vMapUv * vec2(0.125, 86.0 / 2048.0) + aPlaca;\n#endif');
  };
  placa.customProgramCacheKey = () => 'placa-atlas';
  return {
    pintura: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.32, metalness: 0.45 }),
    escuro: new THREE.MeshLambertMaterial({ color: 0x1b1b1d }),
    vidro: new THREE.MeshStandardMaterial({ color: 0x0c1218, roughness: 0.06, metalness: 0.7 }),
    pneu: new THREE.MeshLambertMaterial({ color: 0x141414 }),
    roda: new THREE.MeshStandardMaterial({ color: 0xb9bdc2, roughness: 0.35, metalness: 0.85 }),
    luzes: new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
    placa,
    placaAvulsa: (tex) => new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5, metalness: 0.05 }),
  };
}

/* ------------------------------------------------------------------ telhados */
/* Telhado com beiral, 4 águas (padrão) ou 2 águas, com a cumeeira no lado maior.
   UV em metros ÷ 2 (cada repetição da textura = 2 m de telhado), então a telha fica
   do mesmo tamanho em qualquer casa. Grupos: 0 = telha, 1 = oitão (parede do
   triângulo no 2 águas), 2 = beiral por baixo e testeira. Base em y = 0. */
export function geoTelhado(THREE, w, d, alt, tipo = '4', beiral = 0.5) {
  const girar = d > w;
  const A = (girar ? d : w) + 2 * beiral, B = (girar ? w : d) + 2 * beiral;
  const hx = A / 2, hz = B / 2, rc = tipo === '2' ? hx : Math.max(0, hx - hz);
  const Ls = Math.hypot(hz, alt); // comprimento da água, do beiral à cumeeira
  const a = [-hx, 0, -hz], b = [hx, 0, -hz], c = [hx, 0, hz], dd = [-hx, 0, hz], r1 = [-rc, alt, 0], r2 = [rc, alt, 0];
  const G = [[], [], []], U = [[], [], []];
  const tri = (gr, p, q, r, uv) => { G[gr].push(...p, ...q, ...r); U[gr].push(...uv(p), ...uv(q), ...uv(r)); };
  const uvFrente = (p) => [p[0] / 2, (p[2] + hz) / hz * Ls / 2];
  const uvFundo = (p) => [-p[0] / 2, (hz - p[2]) / hz * Ls / 2];
  const uvDir = (p) => [-p[2] / 2, (hx - p[0]) / hz * Ls / 2];
  const uvEsq = (p) => [p[2] / 2, (p[0] + hx) / hz * Ls / 2];
  const uvOitao = (p) => [p[2] / 2, p[1] / 2];
  tri(0, a, r1, r2, uvFrente); tri(0, a, r2, b, uvFrente);
  tri(0, c, r2, r1, uvFundo); tri(0, c, r1, dd, uvFundo);
  if (tipo === '2') { tri(1, b, r2, c, uvOitao); tri(1, dd, r1, a, uvOitao); }
  else { tri(0, b, r2, c, uvDir); tri(0, dd, r1, a, uvEsq); }
  // por baixo do beiral + testeira (faixa de 15 cm na borda)
  const uvB = (p) => [p[0] / 2, p[2] / 2];
  tri(2, a, b, c, uvB); tri(2, a, c, dd, uvB);
  const t = 0.15, desce = (p) => [p[0], p[1] - t, p[2]], uvT = (p) => [(p[0] + p[2]) / 2, p[1] * 3];
  for (const [p, q] of [[a, b], [b, c], [c, dd], [dd, a]]) { tri(2, p, q, desce(q), uvT); tri(2, p, desce(q), desce(p), uvT); }
  const geo = new THREE.BufferGeometry();
  const pos = [].concat(...G), uv = [].concat(...U);
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  let ini = 0; G.forEach((g, i) => { if (g.length) geo.addGroup(ini, g.length / 3, i); ini += g.length / 3; });
  if (girar) geo.rotateY(Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}

/* Texturas desenhadas no navegador (cenário leve; o realista troca por foto). */
export function texturasCasa(texCanvas) {
  const R = Math.random;
  // telha cerâmica colonial (capa e canal): 2 m × 2 m, ~10 fiadas
  const telha = texCanvas(256, 256, (g, w, h) => {
    g.fillStyle = '#9a4a2a'; g.fillRect(0, 0, w, h);
    const cw = w / 10, rh = h / 6;
    for (let c = 0; c < 10; c++) for (let r = 0; r < 6; r++) {
      const x = c * cw, y = r * rh, tom = 0.8 + R() * 0.35;
      const gr = g.createLinearGradient(x, 0, x + cw, 0);
      const cor = (k) => `rgb(${(178 * tom * k) | 0},${(92 * tom * k) | 0},${(56 * tom * k) | 0})`;
      gr.addColorStop(0, cor(0.55)); gr.addColorStop(0.35, cor(1.08)); gr.addColorStop(0.6, cor(1)); gr.addColorStop(1, cor(0.5));
      g.fillStyle = gr; g.fillRect(x, y, cw, rh);
      g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(x, y, cw, 3);           // sombra da fiada de cima
      g.fillStyle = 'rgba(255,230,200,.08)'; g.fillRect(x + cw * 0.3, y + 4, cw * 0.15, rh - 6);
      if (R() < 0.25) { g.fillStyle = `rgba(40,40,30,${0.08 + R() * 0.12})`; g.fillRect(x, y, cw, rh); } // limo/sujeira
    }
  });
  // fibrocimento ondulado (o "Eternit"), cinza com manchas de chuva
  const fibro = texCanvas(256, 256, (g, w, h) => {
    for (let x = 0; x < w; x++) { const k = 0.78 + 0.22 * Math.sin(x / w * Math.PI * 2 * 9); const v = (150 * k) | 0; g.fillStyle = `rgb(${v},${v + 2},${v + 4})`; g.fillRect(x, 0, 1, h); }
    for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(60,60,55,${R() * 0.12})`; g.fillRect(R() * w, R() * h, 6 + R() * 30, 20 + R() * 120); }
    g.fillStyle = 'rgba(0,0,0,.18)'; for (let y = 0; y < h; y += 128) g.fillRect(0, y, w, 2);
  });
  // reboco pintado (muro e platibanda): aspereza + sujeira escorrida embaixo
  const reboco = texCanvas(256, 128, (g, w, h) => {
    g.fillStyle = '#f2efe8'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) { const l = 205 + R() * 50 | 0; g.fillStyle = `rgba(${l},${l},${l - 6},.55)`; g.fillRect(R() * w, R() * h, 2, 2); }
    const gr = g.createLinearGradient(0, h * 0.55, 0, h); gr.addColorStop(0, 'rgba(90,75,55,0)'); gr.addColorStop(1, 'rgba(90,75,55,.35)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 18; i++) { g.fillStyle = `rgba(70,65,55,${0.05 + R() * 0.08})`; g.fillRect(R() * w, 0, 2 + R() * 4, 6 + R() * 40); } // escorrido
  });
  // portão de ferro (grade vertical sobre chapa)
  const portao = texCanvas(256, 128, (g, w, h) => {
    g.fillStyle = '#2b2f33'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#3d4247'; g.fillRect(0, h * 0.45, w, h * 0.55);
    for (let x = 4; x < w; x += 10) { g.fillStyle = '#16181a'; g.fillRect(x, 0, 4, h * 0.45); g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(x, 0, 1, h * 0.45); }
    g.fillStyle = '#1b1d20'; g.fillRect(0, 0, w, 5); g.fillRect(0, h * 0.44, w, 4); g.fillRect(w / 2 - 2, 0, 4, h);
  });
  return { telha, fibro, reboco, portao };
}

/* Fachadas desenhadas: janela com moldura, grade e peitoril; rodapé sujo; porta. */
export function fachadaDetalhada(texCanvas, tipo, foto) {
  const R = Math.random;
  const base = (g, w, h) => {
    if (foto) { // reboco de foto (cenário realista), clareado: a foto crua deixa a parede cinza-escura
      for (let x = 0; x < w; x += 256) for (let y = 0; y < h; y += 256) g.drawImage(foto, x, y, 256, 256);
      g.fillStyle = 'rgba(246,243,236,.5)'; g.fillRect(0, 0, w, h);
    }
    else {
      g.fillStyle = '#f1eee7'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 2200; i++) { const l = 200 + R() * 55 | 0; g.fillStyle = `rgba(${l},${l},${l - 8},.5)`; g.fillRect(R() * w, R() * h, 2, 2); }
    }
    const gr = g.createLinearGradient(0, h * 0.7, 0, h); gr.addColorStop(0, 'rgba(80,65,45,0)'); gr.addColorStop(1, 'rgba(80,65,45,.32)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  };
  const janela = (g, x, y, jw, jh, vidro, grade) => {
    g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(x - 3, y - 3, jw + 6, jh + 8);              // vão
    g.fillStyle = '#e8e6e1'; g.fillRect(x - 2, y - 2, jw + 4, jh + 4);                        // moldura
    const gr = g.createLinearGradient(x, y, x + jw * 0.7, y + jh); gr.addColorStop(0, vidro); gr.addColorStop(0.55, '#1c2733'); gr.addColorStop(1, '#2d3d4d');
    g.fillStyle = gr; g.fillRect(x, y, jw, jh);
    g.fillStyle = 'rgba(255,255,255,.22)'; g.beginPath(); g.moveTo(x, y); g.lineTo(x + jw * 0.45, y); g.lineTo(x, y + jh * 0.6); g.closePath(); g.fill(); // reflexo
    g.fillStyle = '#d9d6cf'; g.fillRect(x + jw / 2 - 1, y, 2, jh);                           // divisão do caixilho
    if (grade) { g.fillStyle = 'rgba(25,25,25,.85)'; for (let k = 1; k < 6; k++) g.fillRect(x + k * jw / 6 - 1, y, 2, jh); g.fillRect(x, y + jh / 2 - 1, jw, 2); }
    g.fillStyle = '#d6d2c8'; g.fillRect(x - 5, y + jh + 2, jw + 10, 4); g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(x - 5, y + jh + 6, jw + 10, 2); // peitoril
  };
  if (tipo === 'casa') return texCanvas(256, 128, (g, w, h) => {
    base(g, w, h);
    janela(g, 26, 34, 50, 40, '#6d8aa6', true); janela(g, 180, 34, 50, 40, '#6d8aa6', true);
    g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(105, 38, 46, 90); g.fillStyle = '#6b4b32'; g.fillRect(108, 41, 40, 87); // porta
    g.fillStyle = 'rgba(255,255,255,.1)'; for (let y = 48; y < 124; y += 10) g.fillRect(110, y, 36, 2);
    g.fillStyle = '#c9a227'; g.fillRect(140, 86, 4, 3);
    g.fillStyle = 'rgba(70,60,48,.45)'; g.fillRect(0, h - 7, w, 7); // rodapé
  });
  if (tipo === 'comercio') return texCanvas(512, 256, (g, w, h) => {
    base(g, w, h);
    for (let c = 0; c < 4; c++) janela(g, c * 128 + 34, 28, 60, 50, '#5d7896', false);
    g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, 124, w, 6);                                   // laje do térreo
    for (let c = 0; c < 4; c++) {                                                                  // portas de enrolar
      const x = c * 128 + 10; g.fillStyle = '#9aa0a6'; g.fillRect(x, 142, 108, 114);
      for (let y = 144; y < 256; y += 5) { g.fillStyle = 'rgba(0,0,0,.22)'; g.fillRect(x, y, 108, 1.5); }
      g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(x, 142, 108, 4);
    }
  });
  return texCanvas(512, 512, (g, w, h) => { // prédio: 4 colunas × 5 andares, faixa de laje entre os andares
    base(g, w, h);
    const ch = h / 5;
    for (let a = 0; a < 5; a++) {
      g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(0, a * ch, w, 5);
      for (let c = 0; c < 4; c++) janela(g, c * 128 + 22, a * ch + 22, 84, 52, R() < 0.25 ? '#a9c2d8' : '#5b7895', false);
    }
  });
}

/* ------------------------------------------------------------------ bairro */
export function montarCidade(ctx) {
  const { THREE, cena, mergeGeometries, addCaixa, MUNDO, SOMBRAS, rnd, texCanvas, ANISO, arvoresExtras } = ctx;
  const C = CIDADE, lr = C.larguraRua, mr = lr / 2;
  const R = (a, b) => a + (b - a) * rnd();
  // sorteio separado para os enfeites novos (muro, toldo): não mexe na sequência do bairro
  const rnd2 = (() => { let sd = 91; return () => (sd = (sd * 16807) % 2147483647) / 2147483647; })();
  const clampN = (v, a, b) => Math.max(a, Math.min(b, v));
  // geometria com cor por vértice e UV em escala (para juntar várias peças num desenho só)
  const pintar = (g, cor, su = 1, sv = 1) => {
    g = g.index ? g.toNonIndexed() : g;
    const n = g.attributes.position.count, c = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { c[i * 3] = cor.r; c[i * 3 + 1] = cor.g; c[i * 3 + 2] = cor.b; }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
    return g;
  };
  const ocupado = []; // retângulos de prédios (para não estacionar carro dentro de casa)

  /* ---------- texturas (cenário leve; o realista troca pelas do pacote) ---------- */
  const texRua = texCanvas(512, 128, (g, w, h) => {
    g.fillStyle = '#4c4e51'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 4000; i++) { const l = 60 + Math.random() * 45 | 0; g.fillStyle = `rgba(${l},${l},${l + 4},.8)`; g.fillRect(Math.random() * w, Math.random() * h, 1.3, 1.3); }
    g.fillStyle = '#e3bd3e'; g.fillRect(0, h / 2 - 2, w, 3); // eixo amarelo contínuo (rua de mão dupla)
  }, [1, 1]);
  const texAsfaltoLiso = texCanvas(128, 128, (g, w, h) => {
    g.fillStyle = '#4c4e51'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 1000; i++) { const l = 60 + Math.random() * 45 | 0; g.fillStyle = `rgba(${l},${l},${l + 4},.8)`; g.fillRect(Math.random() * w, Math.random() * h, 1.3, 1.3); }
  }, [2, 2]);
  const texCalcada = texCanvas(256, 256, (g, w, h) => {
    g.fillStyle = '#b4b0a6'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(90,88,80,.5)'; g.lineWidth = 2;
    for (let i = 0; i <= 8; i++) { g.beginPath(); g.moveTo(i * 32, 0); g.lineTo(i * 32, h); g.stroke(); g.beginPath(); g.moveTo(0, i * 32); g.lineTo(w, i * 32); g.stroke(); }
    for (let i = 0; i < 1500; i++) { const l = 150 + Math.random() * 50 | 0; g.fillStyle = `rgba(${l},${l - 3},${l - 10},.6)`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
  }, [1, 1]);
  const mat = {
    rua: new THREE.MeshLambertMaterial({ map: texRua, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    calcada: new THREE.MeshLambertMaterial({ map: texCalcada, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
    paredeCasa: fachadaDetalhada(texCanvas, 'casa'),
    paredeComercio: fachadaDetalhada(texCanvas, 'comercio'),
    paredePredio: fachadaDetalhada(texCanvas, 'predio'),
    paredeGalpao: texCanvas(256, 128, (g, w, h) => { for (let i = 0; i < 32; i++) { g.fillStyle = i % 2 ? '#a9adb2' : '#c2c6ca'; g.fillRect(i * 8, 0, 8, h); } g.fillStyle = '#4b5563'; g.fillRect(90, 50, 76, 78); }),
  };
  const coresParede = [0xf3e3c3, 0xdfe8f0, 0xf6d7c9, 0xe5efd3, 0xf4f4f2, 0xf8e7a8, 0xcfe0e8, 0xe9d4f0];
  // telhado: cerâmica em 3 tons (nova, envelhecida, escura) e fibrocimento cinza
  const TX = texturasCasa(texCanvas);
  for (const t of Object.values(TX)) t.anisotropy = ANISO;
  const telhados = [
    new THREE.MeshLambertMaterial({ map: TX.telha, color: 0xffffff }),
    new THREE.MeshLambertMaterial({ map: TX.telha, color: 0xd8c8bc }),
    new THREE.MeshLambertMaterial({ map: TX.telha, color: 0xb7a69a }),
    new THREE.MeshLambertMaterial({ map: TX.fibro, color: 0xffffff }),
  ];
  telhados.forEach((m, i) => { m.userData.telhado = i < 3 ? 'ceramica' : 'fibro'; });
  const beiralMat = new THREE.MeshLambertMaterial({ color: 0xe9e6df });
  const matParede = {};
  const paredeMat = (tipo, cor) => {
    const k = tipo + cor;
    if (!matParede[k]) matParede[k] = new THREE.MeshLambertMaterial({ color: cor, map: { casa: mat.paredeCasa, comercio: mat.paredeComercio, predio: mat.paredePredio, galpao: mat.paredeGalpao }[tipo] });
    matParede[k].userData.tipo = tipo;
    return matParede[k];
  };
  // oitão (triângulo do 2 águas) e platibanda: reboco liso na cor da parede
  const matOitao = {};
  const oitaoMat = (cor) => (matOitao[cor] = matOitao[cor] || new THREE.MeshLambertMaterial({ color: cor, map: TX.reboco }));
  const extras = { plat: [], toldo: [], muro: [], portao: [] }; // juntados num desenho só no fim
  // telhados das casas: separados por material e juntados no fim (1 desenho por material, não 3 por casa)
  const baldes = new Map();
  const porNoBalde = (m, g) => { if (!baldes.has(m)) baldes.set(m, []); baldes.get(m).push(g); };
  const separarGrupos = (geo) => geo.groups.map((gr) => {
    const g = new THREE.BufferGeometry();
    for (const [k, a] of Object.entries(geo.attributes)) g.setAttribute(k, new THREE.BufferAttribute(a.array.slice(gr.start * a.itemSize, (gr.start + gr.count) * a.itemSize), a.itemSize));
    return [gr.materialIndex, g];
  });
  const lajeMat = new THREE.MeshLambertMaterial({ color: 0x9a9a95 });
  lajeMat.userData.laje = true;
  const sombra = (m) => { if (SOMBRAS) { m.castShadow = true; m.receiveShadow = true; } return m; };
  const malhas = { paredes: [], telhados: [], ruas: [], calcadas: [] };
  const casas = []; // cada casa do bairro (posição, medidas, frente e colisão): o cenário realista põe um modelo no lugar

  /* ---------- ruas e calçadas ---------- */
  const faixaRua = (x, z, w, d, girada) => {
    const t = mat.rua.map.clone(); t.needsUpdate = true; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = ANISO;
    t.repeat.set((girada ? d : w) / 16, 1);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(girada ? d : w, girada ? w : d), mat.rua.clone()); m.material.map = t;
    m.rotation.x = -Math.PI / 2; if (girada) m.rotation.z = Math.PI / 2; m.position.set(x, 0.014, z);
    if (SOMBRAS) m.receiveShadow = true; cena.add(m); malhas.ruas.push(m);
  };
  const zMin = C.limite.z0, zMax = C.ruasLO[C.ruasLO.length - 1] + mr, xMin = C.ruasNS[0] - mr, xMax = C.ruasNS[C.ruasNS.length - 1] + mr;
  for (const x of C.ruasNS) faixaRua(x, (zMin + zMax) / 2, lr, zMax - zMin, true);
  for (const z of C.ruasLO) faixaRua((xMin + xMax) / 2, z, xMax - xMin, lr, false);
  // rodovia: a MESMA rua do bairro (asfalto + eixo amarelo), só mais estreita. Era um desenho à parte,
  // com outra textura, e ficava por cima do acostamento na mesma altura (as duas superfícies "piscavam").
  const RV = C.rodovia;
  faixaRua((RV.x0 + RV.x1) / 2, RV.z, RV.x1 - RV.x0, RV.larg, false);
  for (const x of C.ruasNS) MUNDO.mapa.linhas.push({ a: [x, zMin], b: [x, zMax], cor: '#6b7280', w: lr });
  for (const z of C.ruasLO) MUNDO.mapa.linhas.push({ a: [xMin, z], b: [xMax, z], cor: '#6b7280', w: lr });

  /* ---------- quadras ---------- */
  const quadras = [];
  for (let i = 0; i < C.ruasNS.length - 1; i++) for (let j = 0; j < C.ruasLO.length - 1; j++) {
    quadras.push({ x0: C.ruasNS[i] + mr, x1: C.ruasNS[i + 1] - mr, z0: C.ruasLO[j] + mr, z1: C.ruasLO[j + 1] - mr, i, j });
  }
  const calcadas = [];
  for (const q of quadras) { // calçada = moldura da quadra
    const cx = (q.x0 + q.x1) / 2, cz = (q.z0 + q.z1) / 2, w = q.x1 - q.x0, d = q.z1 - q.z0, c = C.calcada;
    for (const [px, pz, pw, pd] of [[cx, q.z0 + c / 2, w, c], [cx, q.z1 - c / 2, w, c], [q.x0 + c / 2, cz, c, d - 2 * c], [q.x1 - c / 2, cz, c, d - 2 * c]]) {
      const g = new THREE.PlaneGeometry(pw, pd); g.rotateX(-Math.PI / 2);
      const uv = g.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * pw / 4, uv.getY(k) * pd / 4);
      g.translate(px, 0.03, pz); calcadas.push(g);
    }
  }
  const texC = mat.calcada.map; texC.wrapS = texC.wrapT = THREE.RepeatWrapping;
  const mCalc = new THREE.Mesh(mergeGeometries(calcadas, false), mat.calcada); if (SOMBRAS) mCalc.receiveShadow = true; cena.add(mCalc); malhas.calcadas.push(mCalc);

  /* ---------- cruzamentos, faixas de pedestre e meio-fio ----------
     No desenho do pacote de ruas que o usuário trouxe (asfalto, eixo amarelo, faixa de
     pedestre em cada braço do cruzamento, guia clara): o miolo do cruzamento é um
     remendo de asfalto liso (os eixos das duas ruas não se cruzam mais) e cada braço
     ganha linha de retenção + faixa de pedestre. Nada aqui usa o sorteio do bairro. */
  {
    const chapa = (w, d, x, z, y) => { const g = new THREE.PlaneGeometry(w, d); g.rotateX(-Math.PI / 2); g.translate(x, y, z); return g; };
    const miolos = [], brancas = [], guias = [];
    for (const x of C.ruasNS) for (const z of C.ruasLO) {
      miolos.push(chapa(lr, lr, x, z, 0.02));
      // braços que existem: a rua N-S vai de zMin a zMax e a L-O de xMin a xMax
      const bracos = [[0, -1, z - mr > zMin + 1], [0, 1, z + mr < zMax - 1], [-1, 0, x - mr > xMin + 1], [1, 0, x + mr < xMax - 1]];
      for (const [dx, dz, existe] of bracos) {
        if (!existe) continue;
        const ao = dx !== 0; // braço ao longo de x
        const pos = (dist, lado) => (ao ? [x + dx * (mr + dist), z + lado] : [x + lado, z + dz * (mr + dist)]);
        for (let k = -4; k <= 4; k++) { const [px, pz] = pos(2.6, k * 1.0); brancas.push(ao ? chapa(3, 0.5, px, pz, 0.024) : chapa(0.5, 3, px, pz, 0.024)); } // faixa de pedestre: 9 listras de 3 m
        const [lx, lz] = pos(5.0, 0); brancas.push(ao ? chapa(0.3, lr - 0.6, lx, lz, 0.024) : chapa(lr - 0.6, 0.3, lx, lz, 0.024));              // linha de retenção
      }
    }
    /* rodovia: miolo liso em cada entroncamento, linha de retenção na rua que chega, linha branca de
       bordo e acostamento de cascalho — os dois últimos são interrompidos onde entra uma rua, para
       nenhuma peça ficar em cima da outra (era o que fazia a estrada piscar vista do alto). */
    const zN = RV.z - RV.larg / 2, zS = RV.z + RV.larg / 2, acost = [];
    const entN = C.entradasNorte, entS = C.ruasNS.map((x) => [x, lr]);
    for (const [x, w] of entN.concat(entS)) miolos.push(chapa(w, RV.larg, x, RV.z, 0.02));
    for (const [x] of entS) brancas.push(chapa(lr - 0.6, 0.4, x, zS + 0.9, 0.024));
    const aoLongo = (cortes, peca) => { // trechos da rodovia entre uma entrada e a seguinte
      let x = RV.x0;
      for (const [c, w] of cortes.slice().sort((a, b) => a[0] - b[0]).concat([[RV.x1 + 1, 2]])) { const fim = Math.min(RV.x1, c - w / 2); if (fim > x) peca((x + fim) / 2, fim - x); x = c + w / 2; }
    };
    const terra = (w, d, x, z) => { const g = chapa(w, d, x, z, 0.01), p = g.attributes.position, uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i) / 4, p.getZ(i) / 4); return g; };
    aoLongo(entN, (x, w) => { brancas.push(chapa(w, 0.15, x, zN + 0.3, 0.024)); acost.push(terra(w, RV.acost, x, zN - RV.acost / 2)); });
    aoLongo(entS, (x, w) => { brancas.push(chapa(w, 0.15, x, zS - 0.3, 0.024)); acost.push(terra(w, RV.acost, x, zS + RV.acost / 2)); });
    const texAcost = texCanvas(128, 128, (g, w, h) => {
      g.fillStyle = '#978568'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 1800; i++) { const l = Math.random() * 50 - 25; g.fillStyle = `rgba(${150 + l | 0},${130 + l | 0},${100 + l | 0},.8)`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
      for (let i = 0; i < 160; i++) { const l = 120 + Math.random() * 80 | 0; g.fillStyle = `rgba(${l},${l - 6},${l - 18},.7)`; g.beginPath(); g.arc(Math.random() * w, Math.random() * h, 0.8 + Math.random() * 1.6, 0, 7); g.fill(); }
    }, [1, 1]);
    for (const q of quadras) { // guia (meio-fio) clara na borda de cada quadra
      const cx = (q.x0 + q.x1) / 2, cz = (q.z0 + q.z1) / 2, w = q.x1 - q.x0, d = q.z1 - q.z0, e = 0.28;
      guias.push(chapa(w, e, cx, q.z0 + e / 2, 0.034), chapa(w, e, cx, q.z1 - e / 2, 0.034), chapa(e, d, q.x0 + e / 2, cz, 0.034), chapa(e, d, q.x1 - e / 2, cz, 0.034));
    }
    const dec = (cor, extra) => new THREE.MeshLambertMaterial(Object.assign({ color: cor, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }, extra || {}));
    const junta = (arr, m) => { const ms = new THREE.Mesh(mergeGeometries(arr, false), m); if (SOMBRAS) ms.receiveShadow = true; cena.add(ms); return ms; };
    malhas.cruzamentos = junta(miolos, dec(0xffffff, { map: texAsfaltoLiso, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
    malhas.faixas = junta(brancas, dec(0xe9e9e4));
    malhas.guias = junta(guias, dec(0xcfcbc2, { polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    malhas.acost = junta(acost, dec(0xffffff, { map: texAcost, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
  }

  /* ---------- prédios ---------- */
  const predio = (tipo, x, z, w, d, h, cor, frente = 1) => { // frente: +1 = fachada para +z, -1 = para -z
    const parede = paredeMat(tipo, cor);
    const m = sombra(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [parede, parede, lajeMat, lajeMat, parede, parede]));
    m.position.set(x, h / 2, z); cena.add(m); malhas.paredes.push(m);
    // repete a textura conforme o tamanho (janela de ~3 m)
    const uv = m.geometry.attributes.uv; const rep = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
    for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) { const i = f * 4 + k; uv.setXY(i, uv.getX(i) * Math.max(1, Math.round(rep[f][0] / (tipo === 'galpao' ? 30 : 9))), uv.getY(i) * (tipo === 'casa' || tipo === 'galpao' ? 1 : Math.max(1, Math.round(rep[f][1] / (tipo === 'predio' ? 15 : 7))))); }
    let topo = h;
    if (tipo === 'casa') {
      // mesmo número de sorteios de antes (o resto do bairro, carros e placas não muda)
      const mt = telhados[(rnd() * telhados.length) | 0];
      const fibro = mt.userData.telhado === 'fibro', duas = fibro || ((x * 7 + z * 13) | 0) % 3 === 0;
      const alt = fibro ? 1.0 : 1.75;
      const gt = geoTelhado(THREE, w, d, alt, duas ? '2' : '4', fibro ? 0.35 : 0.55); gt.translate(x, h, z);
      const ms = [mt, oitaoMat(cor), beiralMat];
      for (const [i, g] of separarGrupos(gt)) porNoBalde(ms[i], g);
      topo = h + alt;
    } else if (tipo === 'galpao') {
      const alt = d * 0.16, perfil = new THREE.Shape([new THREE.Vector2(-d / 2 - 0.4, 0), new THREE.Vector2(d / 2 + 0.4, 0), new THREE.Vector2(0, alt)]);
      const g = new THREE.ExtrudeGeometry(perfil, { depth: w + 0.8, bevelEnabled: false }); g.translate(0, 0, -(w + 0.8) / 2); g.rotateY(Math.PI / 2);
      const uvT = g.attributes.uv; for (let k = 0; k < uvT.count; k++) uvT.setXY(k, uvT.getX(k) / 4, uvT.getY(k) / 4);
      const tel = sombra(new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color: 0xa8adb3 })));
      tel.position.set(x, h, z); cena.add(tel); malhas.telhados.push(tel); topo = h + alt;
    } else { // laje com platibanda e caixa d'água
      const cx = sombra(new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.4, 2.2), lajeMat)); cx.position.set(x + w * 0.25, h + 0.7, z - d * 0.2); cena.add(cx);
      topo = h + 1.4;
      const ph = tipo === 'predio' ? 1.1 : 0.9, e = 0.22, cc = new THREE.Color(cor);
      for (const [bw, bd, bx, bz] of [[w + e, e, 0, -d / 2], [w + e, e, 0, d / 2], [e, d, -w / 2, 0], [e, d, w / 2, 0]]) {
        const g = new THREE.BoxGeometry(bw, ph, bd); g.translate(x + bx, h + ph / 2, z + bz);
        extras.plat.push(pintar(g, cc, Math.max(bw, bd) / 4, ph / 2));
      }
      if (tipo === 'comercio') { // toldo na frente da loja (lado da rua de cima, -z)
        const tw = w * 0.86, td = 1.5, g = new THREE.BoxGeometry(tw, 0.06, td);
        g.translate(0, 0, -td / 2); g.rotateX(-0.32); g.translate(x, 3.25, z - d / 2 - 0.02);
        extras.toldo.push(pintar(g, new THREE.Color().setHSL(rnd2(), 0.55, 0.42), tw / 1.2, 1));
        addCaixa(x, z - d / 2 - 0.75, tw / 2, 0.75, 3.3, 'toldo', 2.7);
      }
    }
    const caixa = addCaixa(x, z, w / 2, d / 2, topo, tipo === 'casa' ? 'casa' : 'prédio');
    if (tipo === 'casa') casas.push({ x, z, w, d, h, cor, frente, malha: m, caixa });
    ocupado.push({ x0: x - w / 2 - 0.5, x1: x + w / 2 + 0.5, z0: z - d / 2 - 0.5, z1: z + d / 2 + 0.5 });
    MUNDO.mapa.rets.push({ x, z, w, d, cor: tipo === 'casa' ? '#b45309' : '#9ca3af' });
  };
  /* muro de 1,9 m em volta dos lotes de uma quadra de casas; portão de 3 m na frente de cada lote */
  function muros(x0, x1, z0, z1, lotW, zm, cores) {
    const H = 1.9, E = 0.15, cinza = new THREE.Color(0xd9d6cf);
    const seg = (ax, az, bx, bz, cor) => {
      const len = Math.hypot(bx - ax, bz - az); if (len < 0.3) return;
      const horiz = Math.abs(bz - az) < 0.01, g = new THREE.BoxGeometry(horiz ? len : E, H, horiz ? E : len);
      g.translate((ax + bx) / 2, H / 2, (az + bz) / 2);
      extras.muro.push(pintar(g, cor, len / 4, 1));
      addCaixa((ax + bx) / 2, (az + bz) / 2, horiz ? len / 2 : E / 2, horiz ? E / 2 : len / 2, H, 'muro');
    };
    const portao = (x, z) => {
      const g = new THREE.BoxGeometry(3, H - 0.05, 0.08); g.translate(x, (H - 0.05) / 2, z);
      extras.portao.push(g.toNonIndexed()); addCaixa(x, z, 1.5, 0.06, H, 'portão');
    };
    // frente dos dois lados (z0 = lotes de cima, z1 = lotes de baixo), com o vão do portão
    [[z0, 0], [z1, 3]].forEach(([zz, i0]) => {
      let xa = x0;
      for (let k = 0; k < 3; k++) {
        const gx = x0 + (k + 1) * lotW - 2.2, cor = new THREE.Color(cores[i0 + k]).lerp(new THREE.Color(0xffffff), 0.15);
        seg(xa, zz, gx - 1.5, zz, cor); portao(gx, zz); xa = gx + 1.5;
        seg(xa, zz, x0 + (k + 1) * lotW, zz, cor); xa = x0 + (k + 1) * lotW;
      }
    });
    seg(x0, z0, x0, z1, cinza); seg(x1, z0, x1, z1, cinza);                 // laterais
    for (let k = 1; k < 3; k++) seg(x0 + k * lotW, z0, x0 + k * lotW, z1, cinza); // divisas entre lotes
    seg(x0, zm, x1, zm, cinza);                                               // fundo com fundo
  }
  const arvoresPraca = [];
  const PADRAO = ['casas', 'casas', 'comercio', 'casas', 'predio', 'praca', 'casas', 'galpao', 'casas', 'comercio', 'casas', 'casas', 'predio', 'casas', 'comercio', 'casas', 'galpao', 'casas', 'praca', 'casas'];
  quadras.forEach((q, n) => {
    const tipo = PADRAO[n % PADRAO.length], c = C.calcada + 0.6;
    const x0 = q.x0 + c, x1 = q.x1 - c, z0 = q.z0 + c, z1 = q.z1 - c, W = x1 - x0, D = z1 - z0;
    q.tipo = tipo;
    if (tipo === 'casas') {
      // 6 lotes (3 × 2) com muro e portão; a casa cabe dentro do lote
      const lotW = W / 3, zm = (z0 + z1) / 2, folga = lotW / 2 - 0.7, coresLote = [];
      for (const lado of [0, 1]) for (let k = 0; k < 3; k++) {
        let w = R(8, 10); const d = R(8, 10), lx = x0 + (k + 0.5) * lotW, lz = lado ? z1 - d / 2 - R(0.5, 2.5) : z0 + d / 2 + R(0.5, 2.5);
        w = Math.min(w, folga * 2);
        const off = clampN(R(-1, 1), -(folga - w / 2), folga - w / 2), cor = coresParede[(rnd() * coresParede.length) | 0];
        predio('casa', lx + off, lz, w, d, R(3, 3.6), cor, lado ? 1 : -1);
        coresLote.push(cor);
      }
      muros(x0, x1, z0, z1, lotW, zm, coresLote);
      const at = [x0 + W / 2 + R(-4, 4), z0 + D / 2 + R(-3, 3), R(0.7, 1)];
      if (Math.abs(at[1] - zm) < 1.6) at[1] = zm + (at[1] < zm ? -1.6 : 1.6); // árvore no quintal, não em cima do muro
      arvoresPraca.push(at);
    } else if (tipo === 'comercio') {
      for (let k = 0; k < 3; k++) predio('comercio', x0 + (k + 0.5) * W / 3, z0 + 6, W / 3 - 1, 11, R(6.5, 8), coresParede[(rnd() * coresParede.length) | 0]);
      predio('casa', x0 + W * 0.3, z1 - 6, 10, 9, 3.4, coresParede[(rnd() * coresParede.length) | 0]);
    } else if (tipo === 'predio') {
      predio('predio', x0 + W / 2, z0 + 8, W - 4, 13, R(15, 18), coresParede[(rnd() * coresParede.length) | 0]);
    } else if (tipo === 'galpao') {
      predio('galpao', x0 + W / 2, z0 + D / 2 - 3, W - 6, 18, 7, 0xffffff);
    } else { // praça
      for (let k = 0; k < 9; k++) arvoresPraca.push([x0 + R(3, W - 3), z0 + R(3, D - 3), R(0.8, 1.25)]);
    }
  });
  if (arvoresExtras) arvoresExtras(arvoresPraca);
  // junta muros, platibandas, toldos e portões (4 desenhos para o bairro inteiro)
  const matMuro = new THREE.MeshLambertMaterial({ map: TX.reboco, vertexColors: true });
  const matToldo = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const matPortao = new THREE.MeshLambertMaterial({ map: TX.portao });
  const juntar = (arr, m) => { if (!arr.length) return null; const ms = sombra(new THREE.Mesh(mergeGeometries(arr, false), m)); cena.add(ms); return ms; };
  malhas.muros = juntar(extras.muro.concat(extras.plat), matMuro);
  for (const [m, arr] of baldes) { const t = juntar(arr, m); t.userData.telha = true; malhas.telhados.push(t); }
  malhas.toldos = juntar(extras.toldo, matToldo);
  malhas.portoes = juntar(extras.portao, matPortao);

  /* ---------- carros estacionados ---------- */
  const livre = (x, z, rx, rz) => !ocupado.some((o) => x + rx > o.x0 && x - rx < o.x1 && z + rz > o.z0 && z - rz < o.z1);
  const vagas = [];
  const recuo = mr - 1.15; // encostado no meio-fio
  for (const x of C.ruasNS) for (const s of [-1, 1]) {
    for (let z = zMin + 10; z < zMax - 6; z += R(6.5, 10)) {
      if (C.ruasLO.some((zz) => Math.abs(z - zz) < 9)) continue; // não estaciona no cruzamento
      if (rnd() < 0.3) continue;
      vagas.push({ x: x + s * recuo, z, gir: s > 0 ? 0 : Math.PI });
    }
  }
  for (const z of C.ruasLO) for (const s of [-1, 1]) {
    for (let x = xMin + 10; x < xMax - 6; x += R(6.5, 10)) {
      if (C.ruasNS.some((xx) => Math.abs(x - xx) < 9)) continue;
      if (rnd() < 0.3) continue;
      vagas.push({ x, z: z + s * recuo, gir: s > 0 ? Math.PI / 2 : -Math.PI / 2 });
    }
  }
  // sorteia tipo, cor e placa (única) de cada carro
  const usadas = new Set();
  const carros = vagas.slice(0, 180).map((v, i) => {
    let placa; do { placa = sortearPlaca(rnd); } while (usadas.has(placa)); usadas.add(placa);
    const tt = rnd(), tipo = tt < 0.42 ? 'hatch' : tt < 0.72 ? 'sedan' : tt < 0.88 ? 'suv' : 'picape';
    return { ...v, tipo, cor: sortearCor(rnd), placa, celula: i };
  });

  // atlas de placas: 8 colunas × 23 linhas de 256×86
  const canvasPlacas = document.createElement('canvas'); canvasPlacas.width = 2048; canvasPlacas.height = 2048;
  const gp = canvasPlacas.getContext('2d'); gp.fillStyle = '#ddd'; gp.fillRect(0, 0, 2048, 2048);
  carros.forEach((c) => desenharPlaca(gp, (c.celula % 8) * 256 + 2, Math.floor(c.celula / 8) * 86 + 2, 252, 82, c.placa));
  const texPlacas = new THREE.CanvasTexture(canvasPlacas);
  texPlacas.colorSpace = THREE.SRGBColorSpace; texPlacas.anisotropy = ANISO;
  const matCarro = materiaisCarro(THREE, texPlacas);
  const GEO = {}; for (const t of TIPOS_CARRO) GEO[t] = geometriasCarro(THREE, mergeGeometries, t);

  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), um = new THREE.Vector3(1, 1, 1), cor = new THREE.Color();
  const instancias = [];
  for (const t of TIPOS_CARRO) {
    const lista = carros.filter((c) => c.tipo === t);
    if (!lista.length) continue;
    for (const parte of ['pintura', 'escuro', 'vidro', 'pneu', 'roda', 'luzes', 'placa']) {
      const geo = GEO[t][parte]; if (!geo) continue;
      const msh = new THREE.InstancedMesh(geo, matCarro[parte], lista.length);
      if (parte === 'placa') {
        const off = new Float32Array(lista.length * 2);
        lista.forEach((c, k) => { off[k * 2] = (c.celula % 8) * 0.125; off[k * 2 + 1] = 1 - (Math.floor(c.celula / 8) + 1) * 86 / 2048; });
        geo.setAttribute('aPlaca', new THREE.InstancedBufferAttribute(off, 2));
      }
      lista.forEach((c, k) => {
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), c.gir);
        m4.compose(new THREE.Vector3(c.x, 0, c.z), q, um); msh.setMatrixAt(k, m4);
        if (parte === 'pintura') { cor.setHex(c.cor); msh.setColorAt(k, cor); }
      });
      if (SOMBRAS && (parte === 'pintura' || parte === 'vidro')) msh.castShadow = true;
      msh.frustumCulled = false; // a esfera de limite do InstancedMesh não cobre o bairro todo
      cena.add(msh); instancias.push(msh);
    }
  }
  for (const c of carros) {
    const D = TIPOS[c.tipo], ao = Math.abs(Math.sin(c.gir)) > 0.5;
    c.caixa = addCaixa(c.x, c.z, (ao ? D.L : D.W) / 2, (ao ? D.W : D.L) / 2, D.teto[2][1], 'veículo');
    // centro e normal das placas (para a foto do exercício)
    const fwd = { x: -Math.sin(c.gir), z: -Math.cos(c.gir) };
    c.placas = [
      { x: c.x + fwd.x * (D.L / 2 + 0.08), y: D.placaF, z: c.z + fwd.z * (D.L / 2 + 0.08), nx: fwd.x, nz: fwd.z },
      { x: c.x - fwd.x * (D.L / 2 + 0.08), y: D.placaT, z: c.z - fwd.z * (D.L / 2 + 0.08), nx: -fwd.x, nz: -fwd.z },
    ];
  }

  /* ---------- carro avulso (alvo / trânsito): mesmas formas, material próprio ---------- */
  function carroAvulso(tipo, corHex, placa) {
    const g = new THREE.Group();
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 86;
    desenharPlaca(cv.getContext('2d'), 2, 2, 252, 82, placa);
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = ANISO;
    const pint = matCarro.pintura.clone(); pint.color.setHex(corHex);
    const pecas = { pintura: pint, escuro: matCarro.escuro, vidro: matCarro.vidro, pneu: matCarro.pneu, roda: matCarro.roda, luzes: matCarro.luzes, placa: matCarro.placaAvulsa(tex) };
    for (const [parte, m] of Object.entries(pecas)) {
      const geo = GEO[tipo][parte]; if (!geo) continue;
      const mesh = new THREE.Mesh(parte === 'placa' ? geo.clone().deleteAttribute('aPlaca') : geo, m);
      if (SOMBRAS && (parte === 'pintura' || parte === 'vidro')) mesh.castShadow = true;
      g.add(mesh);
    }
    g.userData = { tipo, placa, cor: corHex, ...dimensoesCarro(tipo) };
    return g;
  }

  return { carros, carroAvulso, quadras, malhas, mat, matCarro, instancias, texPlacas, canvasPlacas, livre, casas };
}

/* ------------------------------------------------------------------ veículo andando */
/* Segue uma rota (lista de pontos x,z fechada), desacelerando nas curvas.
   Atualiza a caixa de colisão (aproximada, alinhada aos eixos). */
export class VeiculoNaRota {
  constructor(THREE, grupo, rota, { vel = 11, curva = 4.5, faixa = 0, inicio = 0, fechada = true } = {}) {
    this.THREE = THREE; this.g = grupo; this.vMax = vel; this.vCurva = curva; this.fechada = fechada;
    this.pts = rota.map(([x, z]) => new THREE.Vector2(x, z));
    // desloca para a faixa da direita (mão brasileira)
    if (faixa) this.pts = this.pts.map((p, i, a) => {
      const ant = a[(i - 1 + a.length) % a.length], prox = a[(i + 1) % a.length];
      const d = prox.clone().sub(ant).normalize(); return new THREE.Vector2(p.x - d.y * faixa, p.y + d.x * faixa);
    });
    this.seg = []; let tot = 0;
    for (let i = 0; i < this.pts.length - (fechada ? 0 : 1); i++) {
      const a = this.pts[i], b = this.pts[(i + 1) % this.pts.length], l = a.distanceTo(b);
      this.seg.push({ a, b, l, ini: tot }); tot += l;
    }
    this.total = tot; this.s = inicio * tot; this.v = 0; this.parado = 0;
    this.pos = new THREE.Vector3(); this.rumo = 0; this.caixa = null;
    this.atualizar(0);
  }
  pontoEm(s) {
    s = this.fechada ? ((s % this.total) + this.total) % this.total : Math.max(0, Math.min(this.total - 0.001, s));
    const sg = this.seg.find((q) => s >= q.ini && s < q.ini + q.l) || this.seg[this.seg.length - 1];
    const t = (s - sg.ini) / sg.l;
    return { x: sg.a.x + (sg.b.x - sg.a.x) * t, z: sg.a.y + (sg.b.y - sg.a.y) * t, sg, resto: sg.l - (s - sg.ini) };
  }
  atualizar(dt) {
    const p = this.pontoEm(this.s);
    // freia antes da curva (e para de vez em quando, como no trânsito)
    if (this.parado > 0) { this.parado -= dt; this.v = Math.max(0, this.v - 6 * dt); }
    else {
      const alvo = p.resto < 18 ? this.vCurva + (this.vMax - this.vCurva) * (p.resto / 18) * 0.4 : this.vMax;
      this.v += Math.sign(alvo - this.v) * Math.min(Math.abs(alvo - this.v), (alvo > this.v ? 2.2 : 4.5) * dt);
      if (this.paradas && Math.random() < dt * this.paradas) this.parado = 3 + Math.random() * 5;
    }
    this.s += this.v * dt;
    if (!this.fechada && this.s >= this.total - 0.01) { this.s = this.total - 0.01; this.v = 0; this.fim = true; }
    const a = this.pontoEm(this.s), b = this.pontoEm(this.s + 3);
    const alvoRumo = Math.atan2(-(b.x - a.x), -(b.z - a.z)); // rotação y para o nariz (-z) apontar à frente
    let d = alvoRumo - this.rumo; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
    this.rumo += d * Math.min(1, dt * 4 + (dt === 0 ? 1 : 0));
    this.pos.set(a.x, 0, a.z);
    this.g.position.copy(this.pos); this.g.rotation.y = this.rumo;
    if (this.caixa) {
      const ud = this.g.userData, c = Math.abs(Math.cos(this.rumo)), s2 = Math.abs(Math.sin(this.rumo));
      this.caixa.x = a.x; this.caixa.z = a.z;
      this.caixa.hw = (ud.W * c + ud.L * s2) / 2; this.caixa.hd = (ud.W * s2 + ud.L * c) / 2; this.caixa.top = ud.H;
    }
  }
}

/* ------------------------------------------------------------------ canteiro de obras */
/* Área industrial / obra a leste da base (x 150–300, z -62–26), no espírito do
   cenário que o usuário mostrou: tubos de concreto empilhados, prédio em
   estrutura com andaime, contêineres, montes de brita e areia e uma GRUA DE
   TORRE (obstáculo alto, fino e fácil de subestimar). Tudo procedural; no
   cenário realista os materiais trocam pelos do pacote e entram objetos
   escaneados (barreiras, tambores, pneus, gerador, pedras). */
export const CANTEIRO = { x0: 150, x1: 300, z0: -62, z1: 26 };
export function montarCanteiro(ctx) {
  const { THREE, cena, addCaixa, MUNDO, SOMBRAS, rnd, texCanvas, mergeGeometries } = ctx;
  const R = (a, b) => a + (b - a) * rnd();
  const K = CANTEIRO, cx = (K.x0 + K.x1) / 2, cz = (K.z0 + K.z1) / 2;
  const sombra = (m) => { if (SOMBRAS) { m.castShadow = true; m.receiveShadow = true; } return m; };
  const texTerra = texCanvas(256, 256, (g, w, h) => {
    g.fillStyle = '#8f7a5c'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 3000; i++) { const l = Math.random() * 60 - 30; g.fillStyle = `rgba(${140 + l | 0},${118 + l | 0},${88 + l | 0},.8)`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
    for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(${100 + Math.random() * 40 | 0},${85 + Math.random() * 30 | 0},${60},.25)`; g.beginPath(); g.arc(Math.random() * w, Math.random() * h, 4 + Math.random() * 14, 0, 7); g.fill(); }
  }, [12, 7]);
  const texConcreto = texCanvas(128, 128, (g, w, h) => { g.fillStyle = '#c4c1b9'; g.fillRect(0, 0, w, h); for (let i = 0; i < 900; i++) { const l = 150 + Math.random() * 60 | 0; g.fillStyle = `rgba(${l},${l},${l - 6},.7)`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); } });
  const texTijolo = texCanvas(128, 128, (g, w, h) => { g.fillStyle = '#b8b0a4'; g.fillRect(0, 0, w, h); for (let y = 0; y < 8; y++) for (let x = 0; x < 4; x++) { g.fillStyle = `rgb(${165 + Math.random() * 30 | 0},${80 + Math.random() * 20 | 0},${55 + Math.random() * 15 | 0})`; g.fillRect(x * 32 + (y % 2) * 16 + 1, y * 16 + 1, 30, 14); } });
  const texChapa = texCanvas(256, 64, (g, w, h) => { for (let i = 0; i < 32; i++) { g.fillStyle = i % 2 ? '#d0d0d0' : '#f0f0f0'; g.fillRect(i * 8, 0, 8, h); } });
  const mats = {
    chao: new THREE.MeshLambertMaterial({ map: texTerra, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
    concreto: new THREE.MeshLambertMaterial({ color: 0xc9c6be, map: texConcreto }),
    tijolo: new THREE.MeshLambertMaterial({ color: 0xffffff, map: texTijolo }),
    conteiner: coresConteiner(THREE, texChapa),
    brita: new THREE.MeshLambertMaterial({ color: 0x8d8a84 }),
    areia: new THREE.MeshLambertMaterial({ color: 0xd2b27a }),
    andaime: new THREE.MeshStandardMaterial({ color: 0x9aa0a6, metalness: 0.7, roughness: 0.45 }),
  };
  const malhas = { chao: null, concreto: [], tijolo: [], conteiner: [], monte: [] };

  // chão de terra batida do canteiro
  const chao = new THREE.Mesh(new THREE.PlaneGeometry(K.x1 - K.x0, K.z1 - K.z0), mats.chao);
  chao.rotation.x = -Math.PI / 2; chao.position.set(cx, 0.011, cz); if (SOMBRAS) chao.receiveShadow = true;
  cena.add(chao); malhas.chao = chao;
  MUNDO.mapa.rets.push({ x: cx, z: cz, w: K.x1 - K.x0, d: K.z1 - K.z0, cor: '#7c6a4f' });

  // tubos de concreto (diâmetro 1,5 m) — eixo do tubo em x
  const nao = (g) => (g.index ? g.toNonIndexed() : g);
  const fora = new THREE.CylinderGeometry(0.78, 0.78, 2.4, 28, 1, true);
  const dentro = new THREE.CylinderGeometry(0.64, 0.64, 2.4, 28, 1, true); dentro.scale(-1, 1, 1);
  const anel = new THREE.RingGeometry(0.64, 0.78, 28);
  const geoTubo = mergeGeometries([fora, dentro, anel.clone().rotateX(-Math.PI / 2).translate(0, 1.2, 0), anel.clone().rotateX(Math.PI / 2).translate(0, -1.2, 0)].map(nao), false);
  geoTubo.rotateZ(Math.PI / 2);
  const tubo = (x, y, z, ry) => { const m = sombra(new THREE.Mesh(geoTubo, mats.concreto)); m.position.set(x, y, z); m.rotation.y = ry; cena.add(m); malhas.concreto.push(m); return m; };
  const pilhaTubos = (x, z, girada) => {
    for (const [d, y] of [[-1.6, 0], [0, 0], [1.6, 0], [-0.8, 1.38], [0.8, 1.38], [0, 2.76]]) {
      if (girada) tubo(x, 0.78 + y, z + d, 0); else tubo(x + d, 0.78 + y, z, Math.PI / 2);
    }
    addCaixa(x, z, girada ? 1.25 : 2.4, girada ? 2.4 : 1.25, 4.3, 'tubos de concreto');
  };
  pilhaTubos(172, -40, false); pilhaTubos(176, -28, false); pilhaTubos(188, 10, true);
  for (let k = 0; k < 5; k++) { // tubos soltos: deitados e de pé
    const x = 200 + k * 7, z = R(-55, -44);
    if (k % 2) { const m = tubo(x, 0.78, z, R(0, 3)); addCaixa(x, z, 1.3, 1.3, 1.6, 'tubo de concreto'); m.userData.solto = true; }
    else { const m = sombra(new THREE.Mesh(geoTubo, mats.concreto)); m.rotation.z = Math.PI / 2; m.position.set(x, 1.2, z); cena.add(m); malhas.concreto.push(m); addCaixa(x, z, 0.8, 0.8, 2.4, 'tubo de concreto'); }
  }

  // prédio em construção: estrutura de concreto (pilares + lajes), térreo com tijolo
  const ex = 252, ez = -30, EW = 24, ED = 14, PE = 3.3;
  for (let a = 0; a <= 3; a++) {
    const laje = sombra(new THREE.Mesh(new THREE.BoxGeometry(EW, 0.25, ED), mats.concreto));
    laje.position.set(ex, a * PE + 0.12, ez); cena.add(laje); malhas.concreto.push(laje);
    if (a < 3) for (let i = 0; i <= 4; i++) for (let j = 0; j <= 2; j++) {
      const p = sombra(new THREE.Mesh(new THREE.BoxGeometry(0.4, PE, 0.4), mats.concreto));
      p.position.set(ex - EW / 2 + 0.2 + i * (EW - 0.4) / 4, a * PE + PE / 2 + 0.12, ez - ED / 2 + 0.2 + j * (ED - 0.4) / 2); cena.add(p); malhas.concreto.push(p);
    }
  }
  for (const [w, d, x, z] of [[EW - 0.8, 0.2, ex, ez - ED / 2 + 0.2], [0.2, ED - 0.8, ex - EW / 2 + 0.2, ez], [EW * 0.5, 0.2, ex - EW * 0.25, ez + ED / 2 - 0.2]]) {
    const m = sombra(new THREE.Mesh(new THREE.BoxGeometry(w, 2.2, d), mats.tijolo)); m.position.set(x, 1.22, z); cena.add(m); malhas.tijolo.push(m);
  }
  addCaixa(ex, ez, EW / 2, ED / 2, 3 * PE + 0.3, 'prédio em construção');
  const tubosA = []; // andaime no lado sul
  for (let i = 0; i <= 8; i++) for (const dz of [0, 1.2]) { const g = new THREE.CylinderGeometry(0.03, 0.03, 3 * PE + 1.5, 6); g.translate(ex - EW / 2 + i * EW / 8, (3 * PE + 1.5) / 2, ez + ED / 2 + 0.6 + dz); tubosA.push(nao(g)); }
  for (let a = 1; a <= 3; a++) for (const dz of [0, 1.2]) { const g = new THREE.CylinderGeometry(0.03, 0.03, EW, 6); g.rotateZ(Math.PI / 2); g.translate(ex, a * PE + 0.9, ez + ED / 2 + 0.6 + dz); tubosA.push(nao(g)); }
  cena.add(sombra(new THREE.Mesh(mergeGeometries(tubosA, false), mats.andaime)));
  addCaixa(ex, ez + ED / 2 + 1.2, EW / 2, 0.8, 3 * PE + 1.5, 'andaime');
  MUNDO.mapa.rets.push({ x: ex, z: ez, w: EW, d: ED, cor: '#a8a29e' });

  // contêineres de obra (um empilhado)
  [[200, 4, 1.3, 0], [208, 4, 1.3, 1], [216, 4, 1.3, 2], [204, 4, 3.9, 3]].forEach(([x, z, y, i]) => {
    const c = sombra(new THREE.Mesh(new THREE.BoxGeometry(2.44, 2.6, 6.06), mats.conteiner[i]));
    c.position.set(i === 3 ? 204 : x, y, z); cena.add(c); malhas.conteiner.push(c);
  });
  addCaixa(208, 4, 9.3, 3.03, 2.6, 'contêiner'); addCaixa(204, 4, 1.22, 3.03, 5.2, 'contêiner', 2.6);

  // montes de brita e de areia
  for (const [x, z, r, h, m] of [[170, 0, 5, 2.6, mats.brita], [184, -10, 4, 2.2, mats.areia], [232, 12, 6, 3, mats.brita], [282, 8, 4.5, 2.4, mats.areia]]) {
    const g = new THREE.ConeGeometry(r, h, 24, 3); const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) if (p.getY(i) < h / 2 - 0.01) { const k = 1 + Math.sin(i * 12.9898) * 0.08; p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); }
    g.computeVertexNormals();
    const c = sombra(new THREE.Mesh(g, m)); c.position.set(x, h / 2, z); cena.add(c); malhas.monte.push(c);
    addCaixa(x, z, r * 0.55, r * 0.55, h * 0.7, 'monte de material');
  }

  // grua de torre: mastro em treliça de 32 m, lança de 38 m, contrapeso e cabo com gancho
  const gx = 230, gz = -8, H = 32;
  const grua = new THREE.Group(); grua.position.set(gx, 0, gz); cena.add(grua);
  const amarelo = new THREE.LineBasicMaterial({ color: 0xe0b100 });
  const trelica = (comp, larg, alt, eixo) => {
    const p = [], n = Math.round(comp / 1.6);
    const quad = (t) => [[-larg / 2, -alt / 2], [larg / 2, -alt / 2], [larg / 2, alt / 2], [-larg / 2, alt / 2]].map(([u, v]) => (eixo === 'y' ? [u, t, v] : [t, v, u]));
    for (let i = 0; i < n; i++) {
      const A = quad(i * comp / n), B = quad((i + 1) * comp / n);
      for (let k = 0; k < 4; k++) { const k2 = (k + 1) % 4; p.push(...A[k], ...B[k], ...A[k], ...B[k2], ...B[k], ...B[k2]); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); return new THREE.LineSegments(g, amarelo);
  };
  grua.add(trelica(H, 1.6, 1.6, 'y'));
  const lanca = trelica(38, 1.2, 1.3, 'x'); lanca.position.set(-6, H + 0.8, 0); grua.add(lanca);
  // montantes com volume (aparecem na sombra e de longe)
  for (const [ax, az] of [[-0.8, -0.8], [0.8, -0.8], [0.8, 0.8], [-0.8, 0.8]]) { const m = sombra(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, H, 5), new THREE.MeshLambertMaterial({ color: 0xe0b100 }))); m.position.set(ax, H / 2, az); grua.add(m); }
  const banzo = sombra(new THREE.Mesh(new THREE.BoxGeometry(38, 0.12, 0.12), new THREE.MeshLambertMaterial({ color: 0xe0b100 }))); banzo.position.set(13, H + 0.2, 0); grua.add(banzo);
  const cabine = sombra(new THREE.Mesh(new THREE.BoxGeometry(2.2, 2, 2.2), new THREE.MeshLambertMaterial({ color: 0xe0b100 }))); cabine.position.set(0, H - 0.5, 1.6); grua.add(cabine);
  const contrapeso = sombra(new THREE.Mesh(new THREE.BoxGeometry(3, 1.6, 2), mats.concreto)); contrapeso.position.set(-9, H + 0.3, 0); grua.add(contrapeso);
  grua.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(20, H + 0.2, 0), new THREE.Vector3(20, 6, 0)]), new THREE.LineBasicMaterial({ color: 0x222222 })));
  const gancho = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 0.6), new THREE.MeshLambertMaterial({ color: 0xe0b100 })); gancho.position.set(20, 5.6, 0); grua.add(gancho);
  const luzG = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2020, toneMapped: false })); luzG.position.set(0, H + 2.2, 0); grua.add(luzG);
  addCaixa(gx, gz, 0.9, 0.9, H + 1.6, 'grua (mastro)');
  addCaixa(gx + 13, gz, 19, 0.7, H + 1.5, 'grua (lança)', H + 0.1);
  addCaixa(gx + 20, gz, 0.35, 0.35, H, 'cabo da grua', 5.2);
  MUNDO.mapa.rets.push({ x: gx, z: gz, w: 2, d: 2, cor: '#eab308' });
  MUNDO.mapa.linhas.push({ a: [gx - 12, gz], b: [gx + 32, gz], cor: '#eab308', w: 1 });

  return { mats, malhas, area: K };
}
function coresConteiner(THREE, mapa) {
  return [0x2f6db5, 0xb8402a, 0x3f7d3a, 0xc9a227].map((c) => new THREE.MeshLambertMaterial({ color: c, map: mapa }));
}

/* ------------------------------------------------------------------ complexo de galpões */
/* Conjunto industrial abandonado a nordeste da base (x 160–320, z -225 a -85), feito para
   voar POR DENTRO: um galpão comprido de concreto com portão nas duas pontas, janelões
   nas laterais e um rasgo no telhado; uma cobertura aberta sobre pilares; contêineres
   com corredor entre eles; tanques enferrujados; uma fila de pórticos com tubulação; e
   uma torre treliçada. Tudo de peças retas, cada uma com a sua caixa de colisão (vão de
   porta e de janela é vão de verdade: dá para passar). Desenho próprio — a ideia de um
   "bando" para atravessar voando veio do simulador FPV que o usuário mostrou.
   No cenário realista os materiais trocam pelas texturas de foto do pacote. */
export const GALPOES = { x0: 160, x1: 320, z0: -225, z1: -85 };
export function montarGalpoes(ctx) {
  const { THREE, cena, addCaixa, MUNDO, SOMBRAS, texCanvas, mergeGeometries } = ctx;
  const G = GALPOES;
  const ruido = (cor, n, forca) => texCanvas(128, 128, (g, w, h) => {
    g.fillStyle = cor; g.fillRect(0, 0, w, h);
    for (let i = 0; i < n; i++) { const l = Math.random() * forca | 0; g.fillStyle = `rgba(${l},${l},${l},.35)`; g.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 3, 2 + Math.random() * 3); }
  }, [1, 1]);
  const texChapa = texCanvas(128, 64, (g, w, h) => { for (let i = 0; i < 16; i++) { g.fillStyle = i % 2 ? '#8f969b' : '#a9b0b5'; g.fillRect(i * 8, 0, 8, h); } for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(120,80,45,${Math.random() * 0.25})`; g.fillRect(Math.random() * w, Math.random() * h, 4, 6); } }, [1, 1]);
  const mats = {
    concreto: new THREE.MeshLambertMaterial({ color: 0xb4b1a8, map: ruido('#b9b6ad', 500, 90) }),
    telha: new THREE.MeshLambertMaterial({ color: 0xffffff, map: texChapa, side: THREE.DoubleSide }),
    ferrugem: new THREE.MeshLambertMaterial({ color: 0x9a5a36, map: ruido('#a8693f', 700, 70) }),
    aco: new THREE.MeshLambertMaterial({ color: 0x5b6168 }),
    piso: new THREE.MeshLambertMaterial({ color: 0xffffff, map: ruido('#8f8d86', 900, 110), polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    conteiner: [0x2f6db5, 0xb8402a, 0x3f7d3a, 0xc9a227, 0x6b7280].map((c) => new THREE.MeshLambertMaterial({ color: c, map: texChapa })),
  };
  const baldes = new Map();
  const por = (m, g) => { if (!baldes.has(m)) baldes.set(m, []); baldes.get(m).push(g); };
  // caixa reta: desenho + colisão (y0 = base, y1 = topo); a textura repete a cada ~4 m
  const bloco = (m, x, z, w, d, y0, y1, nome = 'galpão', colide = true) => {
    const g = new THREE.BoxGeometry(w, y1 - y0, d), uv = g.attributes.uv, eu = Math.max(1, Math.max(w, d) / 4), ev = Math.max(1, (y1 - y0) / 4);
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * eu, uv.getY(i) * ev);
    g.translate(x, (y0 + y1) / 2, z); por(m, g);
    if (colide) addCaixa(x, z, w / 2, d / 2, y1, nome, y0);
  };

  /* piso de concreto e acesso pela estrada de terra */
  { const g = new THREE.PlaneGeometry(G.x1 - G.x0, G.z1 - G.z0); g.rotateX(-Math.PI / 2); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 26, uv.getY(i) * 22);
    g.translate((G.x0 + G.x1) / 2, 0.012, (G.z0 + G.z1) / 2); por(mats.piso, g);
    const r = new THREE.PlaneGeometry(G.x0 - 122.5, 6); r.rotateX(-Math.PI / 2); const u2 = r.attributes.uv; for (let i = 0; i < u2.count; i++) u2.setXY(i, u2.getX(i) * 7, u2.getY(i));
    r.translate((G.x0 + 122.5) / 2, 0.012, -155); por(mats.piso, r); }

  /* GALPÃO A — 44 × 18 m, parede de 8 m, comprido no eixo leste–oeste (x). Atravessa-se pelos portões das pontas. */
  { const cx = 225, cz = -185, L = 44, W = 18, H = 8, e = 0.5, xa = cx - L / 2, xb = cx + L / 2, za = cz - W / 2, zb = cz + W / 2;
    for (const z of [za, zb]) { // laterais: mureta, pilares entre 5 janelões de 5 × 3,5 m e viga em cima
      bloco(mats.concreto, cx, z, L, e, 0, 2.5); bloco(mats.concreto, cx, z, L, e, 6, H);
      for (let k = 0; k <= 5; k++) bloco(mats.concreto, xa + 2 + k * 8, z, 3, e, 2.5, 6);
    }
    for (const x of [xa, xb]) { // pontas: portão de 8 × 6 m no meio
      bloco(mats.concreto, x, cz - 6.5, e, 5, 0, H); bloco(mats.concreto, x, cz + 6.5, e, 5, 0, H); bloco(mats.concreto, x, cz, e, 8, 6, H);
    }
    // telhado de chapa com um rasgo de 14 × 8 m no meio (dá para entrar e sair por cima)
    bloco(mats.telha, cx - 14.5, cz, 15, W + 1, H, H + 0.25, 'telhado do galpão'); bloco(mats.telha, cx + 14.5, cz, 15, W + 1, H, H + 0.25, 'telhado do galpão');
    bloco(mats.telha, cx, cz - 6.75, 14, 5.5, H, H + 0.25, 'telhado do galpão'); bloco(mats.telha, cx, cz + 6.75, 14, 5.5, H, H + 0.25, 'telhado do galpão');
    for (const x of [cx - 11, cx + 11]) bloco(mats.aco, x, cz, 0.3, W, H - 0.5, H - 0.2, 'viga do galpão'); // tesouras
    MUNDO.mapa.rets.push({ x: cx, z: cz, w: L, d: W, cor: '#a8a29e' });
  }

  /* COBERTURA B — 30 × 16 m sobre 8 pilares, sem parede: passa-se por baixo, a 6 m */
  { const cx = 285, cz = -128, L = 30, W = 16, H = 6;
    for (const dx of [-14, -4.7, 4.7, 14]) for (const dz of [-7.4, 7.4]) bloco(mats.aco, cx + dx, cz + dz, 0.4, 0.4, 0, H, 'pilar da cobertura');
    bloco(mats.telha, cx, cz, L, W, H, H + 0.25, 'cobertura');
    MUNDO.mapa.rets.push({ x: cx, z: cz, w: L, d: W, cor: '#94a3b8' });
  }

  /* contêineres (6,1 × 2,44 × 2,6 m): duas fileiras com corredor de 5 m e três empilhados */
  { const pilha = [[186, -120, 0, 0], [186, -127.5, 1, 0], [186, -135, 2, 0], [196, -120, 3, 0], [196, -127.5, 4, 0], [196, -135, 1, 0], [186, -120, 2, 1], [196, -135, 0, 1], [186, -127.5, 3, 1]];
    for (const [x, z, c, andar] of pilha) bloco(mats.conteiner[c], x, z, 2.44, 6.1, andar * 2.6, andar * 2.6 + 2.6, 'contêiner');
    for (const [x, z, c] of [[215, -112, 4], [222, -105, 0]]) bloco(mats.conteiner[c], x, z, 6.1, 2.44, 0, 2.6, 'contêiner');
    MUNDO.mapa.rets.push({ x: 191, z: -127.5, w: 13, d: 22, cor: '#2f6db5' });
  }

  /* tanques enferrujados: dois em pé e um deitado sobre berços */
  for (const [x, z, r, h] of [[300, -198, 4.5, 10], [311, -182, 3.6, 8]]) {
    const c = new THREE.CylinderGeometry(r, r, h, 24); c.translate(x, h / 2, z); por(mats.ferrugem, c);
    const t = new THREE.ConeGeometry(r * 1.02, 1.1, 24); t.translate(x, h + 0.55, z); por(mats.ferrugem, t);
    addCaixa(x, z, r * 0.9, r * 0.9, h + 1.1, 'tanque');
    MUNDO.mapa.rets.push({ x, z, w: r * 2, d: r * 2, cor: '#9a5a36', redondo: true });
  }
  { const c = new THREE.CylinderGeometry(1.7, 1.7, 9, 18); c.rotateZ(Math.PI / 2); c.translate(178, 2.6, -205); por(mats.ferrugem, c);
    addCaixa(178, -205, 4.5, 1.6, 4.3, 'tanque', 0.9);
    for (const dx of [-3, 3]) bloco(mats.concreto, 178 + dx, -205, 0.6, 3, 0, 1.2, 'berço do tanque'); }

  /* pórticos com tubulação: 4 quadros de 6 m de vão e 5 m de altura — passa-se por baixo, em fila */
  for (let k = 0; k < 4; k++) {
    const z = -168 + k * 15;
    for (const dx of [-3, 3]) bloco(mats.aco, 258 + dx, z, 0.3, 0.3, 0, 5, 'pórtico');
    bloco(mats.aco, 258, z, 6.6, 0.3, 5, 5.3, 'pórtico');
  }
  for (const dx of [-1.6, 0, 1.6]) { const c = new THREE.CylinderGeometry(0.28, 0.28, 47, 10); c.rotateX(Math.PI / 2); c.translate(258 + dx, 5.6, -145.5); por(mats.ferrugem, c); }
  addCaixa(258, -145.5, 2.1, 23.5, 5.95, 'tubulação', 5.3);

  /* torre treliçada de 28 m */
  { const x = 312, z = -98, H = 28, b = 1.4, t = 0.4, pts = [];
    for (let i = 0; i < 8; i++) {
      const y0 = i * H / 8, y1 = (i + 1) * H / 8, a0 = b + (t - b) * (y0 / H), a1 = b + (t - b) * (y1 / H);
      const c0 = [[-a0, y0, -a0], [a0, y0, -a0], [a0, y0, a0], [-a0, y0, a0]], c1 = [[-a1, y1, -a1], [a1, y1, -a1], [a1, y1, a1], [-a1, y1, a1]];
      for (let k = 0; k < 4; k++) { const n = (k + 1) % 4; pts.push(...c0[k], ...c1[k], ...c0[k], ...c1[n], ...c0[n], ...c1[k], ...c1[k], ...c1[n]); }
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const lin = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0x8a4b2a })); lin.position.set(x, 0, z); cena.add(lin);
    for (const [ax, az] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const c = new THREE.CylinderGeometry(0.05, 0.08, H, 5); c.translate(x + ax * (b + t) / 2, H / 2, z + az * (b + t) / 2); por(mats.ferrugem, c); }
    addCaixa(x, z, 1.1, 1.1, H, 'torre treliçada');
    MUNDO.mapa.rets.push({ x, z, w: 3, d: 3, cor: '#9a5a36' });
  }

  const malhas = [];
  for (const [m, arr] of baldes) {
    const ms = new THREE.Mesh(mergeGeometries(arr.map((g) => (g.index ? g.toNonIndexed() : g)), false), m);
    if (SOMBRAS) { ms.castShadow = m !== mats.piso; ms.receiveShadow = true; }
    cena.add(ms); malhas.push(ms);
  }
  return { mats, malhas, area: G };
}

/* ------------------------------------------------------------------ base do BPFRON */
/* O ponto de decolagem (12/10/2026). A primeira versão era uma caixa com as janelas pintadas,
   um hangar de meia-cana e um pátio liso. Agora é um quartel pequeno de verdade: sede com
   telhado de quatro águas, barrado, janelas com moldura/vidro/peitoril e marquise com o
   letreiro; hangar de duas águas em chapa, com portas de enrolar; pátio de placas de concreto
   com vagas pintadas; acesso asfaltado até a rodovia com guarita, cancela e portão; cerca de
   alambrado nos fundos; muro de identificação e três mastros com bandeira.
   As caixas de colisão antigas ("prédio da base", "hangar", "mastro da bandeira") continuam no
   mesmo lugar e com o mesmo nome — exercícios e testes dependem delas. Nada alto foi posto ao
   norte e a leste do heliponto (por onde passam os exercícios) nem na chegada da corrida FPV.
   Não usa o sorteio do mapa. No cenário realista os materiais trocam pelas fotos do pacote. */
export const BASE = { patio: { x0: -22, x1: 22, z0: -13, z1: 19 }, acesso: { x0: 8.5, x1: 15.5, z0: 19, z1: 36 } };
export function montarBase(ctx) {
  const { THREE, cena, addCaixa, MUNDO, SOMBRAS, texCanvas, mergeGeometries } = ctx;
  const TX = texturasCasa(texCanvas);
  const L = (cor, extra) => new THREE.MeshLambertMaterial(Object.assign({ color: cor }, extra || {}));
  const dec = (n) => ({ polygonOffset: true, polygonOffsetFactor: -n, polygonOffsetUnits: -n });
  const A = Math.random;

  /* ---------- texturas desenhadas (cenário leve) ---------- */
  const texPiso = texCanvas(256, 256, (g, w, h) => { // 4 placas de 4 m com junta de dilatação
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { const l = 178 + A() * 14 | 0; g.fillStyle = `rgb(${l},${l - 2},${l - 9})`; g.fillRect(i * 128, j * 128, 128, 128); }
    for (let i = 0; i < 3200; i++) { const l = 150 + A() * 60 | 0; g.fillStyle = `rgba(${l},${l},${l - 8},.5)`; g.fillRect(A() * w, A() * h, 1.5, 1.5); }
    for (let i = 0; i < 7; i++) { g.fillStyle = `rgba(60,58,52,${0.04 + A() * 0.07})`; g.beginPath(); g.ellipse(A() * w, A() * h, 6 + A() * 16, 4 + A() * 10, A() * 3, 0, 7); g.fill(); }
    g.fillStyle = 'rgba(62,60,55,.75)'; for (const k of [0, 128]) { g.fillRect(k, 0, 2, h); g.fillRect(0, k, w, 2); }
  });
  const texAsf = texCanvas(128, 128, (g, w, h) => {
    g.fillStyle = '#4c4e51'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 1000; i++) { const l = 60 + A() * 45 | 0; g.fillStyle = `rgba(${l},${l},${l + 4},.8)`; g.fillRect(A() * w, A() * h, 1.3, 1.3); }
  });
  const texCalc = texCanvas(128, 128, (g, w, h) => {
    g.fillStyle = '#c4c0b5'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 700; i++) { const l = 165 + A() * 50 | 0; g.fillStyle = `rgba(${l},${l - 3},${l - 10},.6)`; g.fillRect(A() * w, A() * h, 2, 2); }
    g.strokeStyle = 'rgba(95,92,84,.5)'; g.lineWidth = 2; g.strokeRect(0, 0, w, h); g.beginPath(); g.moveTo(w / 2, 0); g.lineTo(w / 2, h); g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.stroke();
  });
  const texChapa = texCanvas(128, 64, (g, w, h) => { // chapa trapezoidal pintada (parede do hangar)
    for (let i = 0; i < 16; i++) { g.fillStyle = i % 2 ? '#b9c0c4' : '#d3d8db'; g.fillRect(i * 8, 0, 8, h); g.fillStyle = 'rgba(0,0,0,.14)'; g.fillRect(i * 8, 0, 1, h); }
    for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(110,90,60,${A() * 0.1})`; g.fillRect(A() * w, A() * h, 3, 8); }
  });
  const texZinco = texCanvas(128, 128, (g, w, h) => { // telha metálica (as ondas sobem a água do telhado)
    for (let x = 0; x < w; x++) { const k = 0.8 + 0.2 * Math.sin(x / w * Math.PI * 2 * 8), v = (176 * k) | 0; g.fillStyle = `rgb(${v},${v + 3},${v + 6})`; g.fillRect(x, 0, 1, h); }
    for (let i = 0; i < 30; i++) { g.fillStyle = `rgba(90,80,60,${A() * 0.1})`; g.fillRect(A() * w, A() * h, 5 + A() * 20, 10 + A() * 50); }
    g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(0, 0, w, 2);
  });
  const texPorta = texCanvas(64, 128, (g, w, h) => { // porta de enrolar
    g.fillStyle = '#56687a'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 5) { g.fillStyle = 'rgba(255,255,255,.13)'; g.fillRect(0, y, w, 1); g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(0, y + 4, w, 1); }
    g.fillStyle = '#e3bd3e'; g.fillRect(0, h - 6, w, 6); g.fillStyle = '#1f2937'; for (let x = 0; x < w; x += 12) g.fillRect(x, h - 6, 6, 6);
  });
  const texGrade = texCanvas(64, 64, (g, w, h) => { // alambrado: de perto se vê o losango, de longe vira um véu cinza
    g.clearRect(0, 0, w, h); g.strokeStyle = 'rgba(205,210,215,.62)'; g.lineWidth = 1.3;
    for (let k = -w; k < w * 2; k += 8) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k + w, h); g.stroke(); g.beginPath(); g.moveTo(k + w, 0); g.lineTo(k, h); g.stroke(); }
  });
  const texSebe = texCanvas(64, 64, (g, w, h) => {
    g.fillStyle = '#3d6a2c'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 500; i++) { const l = A(); g.fillStyle = `rgba(${40 + l * 60 | 0},${85 + l * 80 | 0},${30 + l * 40 | 0},.8)`; g.beginPath(); g.arc(A() * w, A() * h, 1 + A() * 2, 0, 7); g.fill(); }
  });
  const texConc = texCanvas(64, 64, (g, w, h) => {
    g.fillStyle = '#b9b5aa'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 300; i++) { const l = 150 + A() * 60 | 0; g.fillStyle = `rgba(${l},${l},${l - 8},.5)`; g.fillRect(A() * w, A() * h, 2, 2); }
  });
  const texCancela = texCanvas(128, 16, (g, w, h) => { for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#f1f5f9' : '#c81e1e'; g.fillRect(i * 16, 0, 16, h); } });
  const placa = (w, h, desenha) => { const t = texCanvas(w, h, desenha); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return t; };
  const texLetreiro = placa(1024, 160, (g, w, h) => {
    g.fillStyle = '#1e3a5f'; g.fillRect(0, 0, w, h); g.strokeStyle = '#F5C518'; g.lineWidth = 6; g.strokeRect(8, 8, w - 16, h - 16);
    g.fillStyle = '#F5C518'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = 'bold 96px Arial'; g.fillText('BPFRON', w / 2, 62);
    g.fillStyle = '#f1f5f9'; g.font = 'bold 30px Arial'; g.fillText('BATALHÃO DE POLÍCIA DE FRONTEIRA E DIVISAS', w / 2, 128);
  });
  const texMuro = placa(1024, 280, (g, w, h) => {
    g.fillStyle = '#1e3a5f'; g.fillRect(0, 0, w, h); g.strokeStyle = '#F5C518'; g.lineWidth = 8; g.strokeRect(10, 10, w - 20, h - 20);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#F5C518'; g.font = 'bold 130px Arial'; g.fillText('BPFRON', w / 2, 96);
    g.fillStyle = '#f1f5f9'; g.font = 'bold 36px Arial'; g.fillText('BATALHÃO DE POLÍCIA DE FRONTEIRA E DIVISAS', w / 2, 188);
    g.font = '28px Arial'; g.fillText('POLÍCIA MILITAR DO ESTADO DE RONDÔNIA', w / 2, 236);
  });
  const texHangar = placa(512, 96, (g, w, h) => {
    g.fillStyle = '#1e3a5f'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#F5C518'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = 'bold 50px Arial'; g.fillText('HANGAR', w / 2, 36);
    g.fillStyle = '#f1f5f9'; g.font = 'bold 20px Arial'; g.fillText('OPERAÇÕES COM DRONES', w / 2, 76);
  });
  const estrela = (g, cx, cy, r) => { g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, q = i % 2 ? r * 0.4 : r; g.lineTo(cx + Math.cos(a) * q, cy + Math.sin(a) * q); } g.closePath(); g.fill(); };
  const bandeiras = [
    placa(256, 176, (g, w, h) => { // Rondônia
      g.fillStyle = '#1f3f93'; g.fillRect(0, 0, w, h / 2); g.fillStyle = '#ffd400'; g.fillRect(0, h / 2, w, h / 2);
      g.fillStyle = '#009b3a'; g.beginPath(); g.moveTo(0, h); g.lineTo(w / 2, h / 2); g.lineTo(w, h); g.closePath(); g.fill();
      g.fillStyle = '#ffffff'; estrela(g, w / 2, h / 2, 26);
    }),
    placa(256, 176, (g, w, h) => { // Brasil
      g.fillStyle = '#009b3a'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#fedf00'; g.beginPath(); g.moveTo(w / 2, 14); g.lineTo(w - 22, h / 2); g.lineTo(w / 2, h - 14); g.lineTo(22, h / 2); g.closePath(); g.fill();
      g.fillStyle = '#002776'; g.beginPath(); g.arc(w / 2, h / 2, 44, 0, 7); g.fill();
      g.strokeStyle = '#ffffff'; g.lineWidth = 7; g.beginPath(); g.arc(w / 2, h / 2 + 62, 78, -Math.PI * 0.72, -Math.PI * 0.28); g.stroke();
    }),
    placa(256, 176, (g, w, h) => { // do batalhão
      g.fillStyle = '#1e3a5f'; g.fillRect(0, 0, w, h); g.strokeStyle = '#F5C518'; g.lineWidth = 8; g.strokeRect(8, 8, w - 16, h - 16);
      g.fillStyle = '#F5C518'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = 'bold 54px Arial'; g.fillText('BPFRON', w / 2, h / 2);
    }),
  ];

  const mats = {
    reboco: L(0xf1ede2, { map: TX.reboco }),
    barrado: L(0x24405f),
    friso: L(0xdcd8cd),
    telha: L(0xffffff, { map: TX.telha }),
    forro: L(0xe9e6df),
    vidro: new THREE.MeshStandardMaterial({ color: 0x17283a, roughness: 0.06, metalness: 0.75, envMapIntensity: 1.5 }),
    esquadria: L(0xeef0f2),
    chapa: L(0xffffff, { map: texChapa }),
    chapaTeto: L(0xffffff, { map: texZinco, side: THREE.DoubleSide }),
    porta: L(0xffffff, { map: texPorta }),
    aco: L(0x4b5563),
    conc: L(0xffffff, { map: texConc }),
    sebe: L(0xffffff, { map: texSebe }),
    amareloSolido: L(0xe3bd3e),
    laranja: L(0xf97316, { side: THREE.DoubleSide }),
    calcada: L(0xffffff, { map: texCalc }),
    cancela: L(0xffffff, { map: texCancela }),
    piso: L(0xffffff, Object.assign({ map: texPiso }, dec(2))),
    asfalto: L(0xffffff, Object.assign({ map: texAsf }, dec(2))),
    branco: L(0xecece6, dec(5)),
    amarelo: L(0xe3bd3e, dec(5)),
    grade: L(0xffffff, { map: texGrade, transparent: true, depthWrite: false, side: THREE.DoubleSide }),
  };
  const noChao = new Set([mats.piso, mats.asfalto, mats.branco, mats.amarelo]); // pintura e piso: não fazem sombra

  /* ---------- peças ---------- */
  const baldes = new Map();
  const por = (m, g) => { if (!baldes.has(m)) baldes.set(m, []); baldes.get(m).push(g.index ? g.toNonIndexed() : g); };
  // caixa reta de y0 a y1. lad = [metros por repetição na horizontal, na vertical]; 0 = a textura estica uma vez
  const caixa = (m, x, z, w, d, y0, y1, lad = [4, 4]) => {
    const g = new THREE.BoxGeometry(w, y1 - y0, d), uv = g.attributes.uv, h = y1 - y0;
    for (let i = 0; i < uv.count; i++) {
      const f = i >> 2, topo = f === 2 || f === 3;
      const su = lad[0] ? (f < 2 ? d : w) / lad[0] : 1, sv = topo ? (lad[0] ? d / lad[0] : 1) : (lad[1] ? h / lad[1] : 1);
      uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
    }
    g.translate(x, (y0 + y1) / 2, z); por(m, g);
  };
  const cil = (m, x, z, r, y0, y1, seg = 10, rTopo = r) => { const g = new THREE.CylinderGeometry(rTopo, r, y1 - y0, seg); g.translate(x, (y0 + y1) / 2, z); por(m, g); };
  // pintura/piso deitado no chão; a textura segue a posição no mundo (as placas emendam de uma peça para a outra)
  const chao = (m, x0, x1, z0, z1, y = 0.012, lad = 8) => {
    const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0); g.rotateX(-Math.PI / 2); g.translate((x0 + x1) / 2, y, (z0 + z1) / 2);
    const p = g.attributes.position, uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i) / lad, p.getZ(i) / lad);
    por(m, g);
  };
  const telhado = (geo, x, y, z, ms) => { // cada grupo do geoTelhado vai para o seu material
    geo.translate(x, y, z);
    for (const gr of geo.groups) {
      const g = new THREE.BufferGeometry();
      for (const [k, a] of Object.entries(geo.attributes)) g.setAttribute(k, new THREE.BufferAttribute(a.array.slice(gr.start * a.itemSize, (gr.start + gr.count) * a.itemSize), a.itemSize));
      por(ms[gr.materialIndex], g);
    }
  };
  // peça encostada numa fachada. eixo 'x': a parede corre ao longo de x, no plano z = b; eixo 'z': corre ao longo de z, no plano x = b.
  // s = lado para onde a parede olha (+1/-1); a = centro ao longo da parede; sai = quanto a frente da peça fica para fora da parede
  const peca = (m, eixo, s, a, b, larg, y0, y1, sai, lad = [0, 0]) => {
    const e = sai + 0.04, c = b + s * (sai - e / 2);
    if (eixo === 'x') caixa(m, a, c, larg, e, y0, y1, lad); else caixa(m, c, a, e, larg, y0, y1, lad);
  };
  const janela = (eixo, s, a, b, larg, y0 = 1.0, alt = 1.35, folhas = 2) => {
    peca(mats.friso, eixo, s, a, b, larg + 0.24, y0 - 0.12, y0 + alt + 0.12, 0.07);   // moldura
    peca(mats.vidro, eixo, s, a, b, larg, y0, y0 + alt, 0.09);
    peca(mats.friso, eixo, s, a, b, larg + 0.4, y0 - 0.2, y0 - 0.12, 0.2);             // peitoril
    for (let k = 0; k <= folhas; k++) peca(mats.esquadria, eixo, s, a - larg / 2 + k * larg / folhas, b, 0.06, y0, y0 + alt, 0.12);
    for (const y of [y0, y0 + alt - 0.06]) peca(mats.esquadria, eixo, s, a, b, larg, y, y + 0.06, 0.12);
  };
  const soltas = []; // malhas com textura própria (letreiros, bandeiras)
  const painel = (tex, w, h, x, y, z, giroY) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), L(0xffffff, { map: tex }));
    m.position.set(x, y, z); m.rotation.y = giroY; cena.add(m); soltas.push(m); return m;
  };
  // tela de alambrado entre dois pontos
  const tela = (x0, z0, x1, z1, y0, y1) => {
    const len = Math.hypot(x1 - x0, z1 - z0), g = new THREE.PlaneGeometry(len, y1 - y0), uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * len / 0.5, uv.getY(i) * (y1 - y0) / 0.5);
    g.rotateY(Math.atan2(-(z1 - z0), x1 - x0)); g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); por(mats.grade, g);
  };
  const cerca = (x0, z0, x1, z1, alt = 2.1) => {
    const len = Math.hypot(x1 - x0, z1 - z0), ao = Math.abs(x1 - x0) > Math.abs(z1 - z0), cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    caixa(mats.conc, cx, cz, ao ? len : 0.18, ao ? 0.18 : len, 0, 0.35, [1, 1]);                 // mureta
    tela(x0, z0, x1, z1, 0.35, alt);
    caixa(mats.aco, cx, cz, ao ? len : 0.05, ao ? 0.05 : len, alt - 0.03, alt + 0.02);            // travessa de cima
    const n = Math.max(1, Math.round(len / 3));
    for (let i = 0; i <= n; i++) caixa(mats.aco, x0 + (x1 - x0) * i / n, z0 + (z1 - z0) * i / n, 0.07, 0.07, 0.35, alt + 0.2);
    addCaixa(cx, cz, ao ? len / 2 : 0.1, ao ? 0.1 : len / 2, alt + 0.2, 'cerca da base');
    MUNDO.mapa.linhas.push({ a: [x0, z0], b: [x1, z1], cor: '#64748b', w: 0.6 });
  };

  /* ---------- pátio, acesso e pintura ---------- */
  const P = BASE.patio, AC = BASE.acesso;
  chao(mats.piso, P.x0, P.x1, P.z0, P.z1);
  chao(mats.piso, -25, -22, 15.5, 19); chao(mats.piso, -25, -12, 19, 27);                          // frente do hangar
  chao(mats.asfalto, AC.x0, AC.x1, AC.z0, AC.z1, 0.012, 4);
  for (const x of [AC.x0 + 0.25, AC.x1 - 0.25]) chao(mats.branco, x - 0.07, x + 0.07, AC.z0, AC.z1 - 1.2, 0.02);
  chao(mats.branco, AC.x0 + 0.4, AC.x1 - 0.4, AC.z1 - 1.0, AC.z1 - 0.6, 0.02);                    // linha de retenção na saída para a rodovia
  // área de toque do heliponto: quadrado amarelo de 10 m
  for (const s of [-1, 1]) { chao(mats.amarelo, -5, 5, s * 5 - 0.08, s * 5 + 0.08, 0.02); chao(mats.amarelo, s * 5 - 0.08, s * 5 + 0.08, -5, 5, 0.02); }
  // vagas das viaturas (lado leste do pátio): 5 vagas de 3 × 6 m, com batente de roda
  for (let k = 0; k <= 5; k++) chao(mats.branco, 15.6, 21.6, -11.5 + k * 3 - 0.06, -11.5 + k * 3 + 0.06, 0.02);
  for (let k = 0; k < 5; k++) caixa(mats.amareloSolido, 21.3, -10 + k * 3, 0.16, 1.9, 0.01, 0.13);
  // meio-fio do pátio (aberto na saída para o acesso e na frente do hangar)
  const guia = (x0, x1, z0, z1) => caixa(mats.friso, (x0 + x1) / 2, (z0 + z1) / 2, Math.max(0.16, x1 - x0), Math.max(0.16, z1 - z0), 0, 0.12);
  guia(P.x0, P.x1, P.z0 - 0.16, P.z0); guia(P.x1, P.x1 + 0.16, P.z0, P.z1);
  guia(P.x0, AC.x0, P.z1, P.z1 + 0.16); guia(AC.x1, P.x1, P.z1, P.z1 + 0.16);
  guia(P.x0 - 0.16, P.x0, P.z0, -4.6);
  MUNDO.mapa.rets.push({ x: (AC.x0 + AC.x1) / 2, z: (AC.z0 + AC.z1) / 2, w: AC.x1 - AC.x0, d: AC.z1 - AC.z0, cor: '#6b7280' });

  /* ---------- sede: 14 × 10 m, parede de 3,5 m, telhado de quatro águas ---------- */
  { const cx = -30, cz = 2, W = 14, D = 10, H = 3.5, xa = cx - W / 2, xb = cx + W / 2, za = cz - D / 2, zb = cz + D / 2;
    caixa(mats.calcada, -30.2, 3, 16.6, 15, 0, 0.07, [2, 2]);                                      // calçada em volta
    caixa(mats.calcada, -26.5, 11.5, 9, 2, 0, 0.07, [2, 2]);                                       // passeio até o pátio
    caixa(mats.reboco, cx, cz, W, D, 0, H, [4, 0]);
    caixa(mats.barrado, cx, cz, W + 0.06, D + 0.06, 0, 0.9);
    caixa(mats.friso, cx, cz, W + 0.3, D + 0.3, H - 0.24, H);                                      // cimalha
    telhado(geoTelhado(THREE, W, D, 2.1, '4', 0.75), cx, H, cz, [mats.telha, mats.reboco, mats.forro]);
    // frente (sul): porta de vidro sob a marquise e uma janela larga de cada lado
    janela('x', 1, -34.9, zb, 2.2, 1.0, 1.35, 3); janela('x', 1, -25.1, zb, 2.2, 1.0, 1.35, 3);
    peca(mats.friso, 'x', 1, cx, zb, 2.5, 0.07, 2.5, 0.07); peca(mats.vidro, 'x', 1, cx, zb, 2.1, 0.12, 2.3, 0.09);
    for (const dx of [-1.05, 0, 1.05]) peca(mats.esquadria, 'x', 1, cx + dx, zb, 0.07, 0.12, 2.3, 0.12);
    peca(mats.esquadria, 'x', 1, cx, zb, 2.1, 2.24, 2.3, 0.12);
    caixa(mats.friso, cx, zb + 1.25, 5.6, 2.5, 0.07, 0.2);                                         // patamar
    for (const dx of [-2.45, 2.45]) { caixa(mats.friso, cx + dx, zb + 2.2, 0.32, 0.32, 0.2, 2.85); addCaixa(cx + dx, zb + 2.2, 0.16, 0.16, 2.85, 'prédio da base (coluna)'); }
    caixa(mats.friso, cx, zb + 1.25, 5.6, 2.5, 2.85, 3.15);                                        // laje da marquise
    caixa(mats.barrado, cx, zb + 2.42, 5.6, 0.16, 3.15, 4.05);                                     // testeira do letreiro
    painel(texLetreiro, 5.4, 0.8, cx, 3.6, zb + 2.51, 0);
    addCaixa(cx, zb + 1.25, 2.8, 1.25, 4.05, 'prédio da base (marquise)', 2.85);
    for (const x of [-35, -25]) caixa(mats.sebe, x, zb + 1.0, 3.4, 0.8, 0.07, 0.85, [1, 1]);       // canteiro de sebe
    // fundos (norte): 4 janelas e dois condensadores de ar-condicionado
    for (const x of [-35, -31.7, -28.3, -25]) janela('x', -1, x, za, 1.8);
    for (const x of [-33.4, -26.6]) { peca(mats.esquadria, 'x', -1, x, za, 0.85, 0.2, 0.8, 0.32); peca(mats.aco, 'x', -1, x, za, 0.5, 0.27, 0.73, 0.33); }
    // leste (para o pátio) e oeste
    for (const z of [-1.2, 2, 5.2]) janela('z', 1, z, xb, 1.6);
    for (const z of [0, 4.2]) janela('z', -1, z, xa, 1.6);
    peca(mats.barrado, 'z', -1, -2, xa, 0.9, 0.07, 2.1, 0.05);                                     // porta dos fundos
    addCaixa(cx, cz, W / 2, D / 2, 6, 'prédio da base');
    MUNDO.mapa.rets.push({ x: cx, z: cz, w: W, d: D, cor: '#d6d3d1' });
  }

  /* ---------- hangar: 14 × 11 m, chapa sobre mureta, telhado de duas águas ---------- */
  { const hx = -32, hz = 21, W = 14, D = 11, H = 4.6, xb = hx + W / 2, za = hz - D / 2, zb = hz + D / 2;
    caixa(mats.conc, hx, hz, W + 0.1, D + 0.1, 0, 0.8, [1, 1]);
    caixa(mats.chapa, hx, hz, W, D, 0.8, H, [2, 0]);
    telhado(geoTelhado(THREE, W, D, 1.9, '2', 0.2), hx, H, hz, [mats.chapaTeto, mats.chapa, mats.forro]);
    for (const z of [18.2, 23.8]) { // duas portas de enrolar para o pátio
      peca(mats.aco, 'z', 1, z, xb, 4.7, 0, 3.85, 0.05); peca(mats.porta, 'z', 1, z, xb, 4.4, 0, 3.7, 0.07);
    }
    for (const z of [15.75, 21, 26.25]) cil(mats.amareloSolido, xb + 0.55, z, 0.09, 0, 0.95);      // balizadores
    painel(texHangar, 4.4, 0.82, xb + 0.23, 5.25, hz, Math.PI / 2);
    for (const x of [-36.5, -33.5, -30.5, -27.5]) { janela('x', 1, x, zb, 1.6, 3.3, 0.7); janela('x', -1, x, za, 1.6, 3.3, 0.7); } // basculantes
    for (const dx of [-4, 0, 4]) { cil(mats.esquadria, hx + dx, hz, 0.2, H + 1.8, H + 2.05, 8); const e = new THREE.SphereGeometry(0.36, 10, 8); e.translate(hx + dx, H + 2.25, hz); por(mats.esquadria, e); } // exaustores eólicos
    addCaixa(hx, hz, 7, 5.5, 7, 'hangar');
    MUNDO.mapa.rets.push({ x: hx, z: hz, w: W, d: D, cor: '#cbd5e1' });
  }

  /* ---------- mastros e bandeiras (Rondônia, Brasil, batalhão) ---------- */
  caixa(mats.friso, -19.6, 14, 2, 7, 0, 0.25);
  [[16.6, 9], [14, 10.5], [11.4, 9]].forEach(([z, h], i) => {
    const x = -19.6;
    cil(mats.esquadria, x, z, 0.08, 0.25, h, 8, 0.05);
    const e = new THREE.SphereGeometry(0.1, 8, 6); e.translate(x, h + 0.08, z); por(mats.amareloSolido, e);
    addCaixa(x, z, 0.08, 0.08, h, 'mastro da bandeira');
    const g = new THREE.PlaneGeometry(1.9, 1.3, 10, 1), p = g.attributes.position;
    for (let k = 0; k < p.count; k++) p.setZ(k, 0.09 * Math.sin((p.getX(k) + 0.95) * 3.2 + i) * (p.getX(k) + 0.95) / 1.9); // ondulado, preso no mastro
    g.translate(1.02, 0, 0); g.rotateY(Math.PI / 2); g.computeVertexNormals(); // solta para o norte, com a frente para o pátio
    const m = new THREE.Mesh(g, L(0xffffff, { map: bandeiras[i], side: THREE.DoubleSide }));
    m.position.set(x, h - 0.8, z); if (SOMBRAS) m.castShadow = true; cena.add(m); soltas.push(m);
  });

  /* ---------- guarita, cancela e portão ---------- */
  { const gx = 5.6, gz = 27.2;
    caixa(mats.calcada, gx, gz, 3.4, 3.4, 0, 0.07, [2, 2]);
    caixa(mats.reboco, gx, gz, 2.6, 2.6, 0, 2.5, [4, 0]); caixa(mats.barrado, gx, gz, 2.66, 2.66, 0, 0.9);
    caixa(mats.friso, gx, gz, 3.7, 3.7, 2.5, 2.68);                                                // laje com beiral
    janela('z', 1, gz, gx + 1.3, 1.6, 1.0, 1.1); janela('x', 1, gx, gz + 1.3, 1.6, 1.0, 1.1); janela('x', -1, gx, gz - 1.3, 1.0, 1.0, 1.1, 1);
    peca(mats.barrado, 'z', -1, gz, gx - 1.3, 0.85, 0.07, 2.1, 0.05);                              // porta
    addCaixa(gx, gz, 1.85, 1.85, 2.68, 'guarita');
    MUNDO.mapa.rets.push({ x: gx, z: gz, w: 2.6, d: 2.6, cor: '#d6d3d1' });
    // cancela abaixada
    caixa(mats.aco, 8.0, 26.9, 0.26, 0.26, 0, 1.15); caixa(mats.aco, 14.9, 26.9, 0.12, 0.12, 0, 1.0);
    caixa(mats.cancela, 11.4, 26.9, 6.8, 0.07, 0.97, 1.09, [0, 0]);
    addCaixa(11.4, 26.9, 3.4, 0.08, 1.3, 'cancela', 0.8); // faixa mais alta que o braço: a física dá 12 cm de folga em cima de toda caixa
    // portão: pilares e duas folhas abertas para dentro
    for (const x of [8.1, 15.9]) { caixa(mats.reboco, x, 31.5, 0.5, 0.5, 0, 2.5, [4, 0]); caixa(mats.friso, x, 31.5, 0.62, 0.62, 2.5, 2.62); addCaixa(x, 31.5, 0.3, 0.3, 2.62, 'portão da base'); }
    for (const x of [8.35, 15.65]) {
      tela(x, 27.75, x, 31.2, 0.2, 2.0);
      for (const y of [0.2, 1.1, 2.0]) caixa(mats.aco, x, 29.48, 0.05, 3.45, y - 0.03, y + 0.03);
      for (const z of [27.75, 31.2]) caixa(mats.aco, x, z, 0.06, 0.06, 0.15, 2.05);
      addCaixa(x, 29.48, 0.08, 1.75, 2.05, 'portão da base');
    }
  }

  /* ---------- cerca dos fundos, mureta da frente e muro de identificação ---------- */
  cerca(-52, 31.5, -13.2, 31.5); cerca(-6.8, 31.5, 7.85, 31.5); cerca(-52, -22, -52, 31.5);
  caixa(mats.conc, 28, 31.5, 23.7, 0.25, 0, 0.5, [1, 1]); addCaixa(28, 31.5, 11.85, 0.13, 0.5, 'mureta da base');
  caixa(mats.reboco, -10, 31.5, 6.4, 0.4, 0, 2.3, [4, 0]); caixa(mats.barrado, -10, 31.5, 6.46, 0.46, 0, 0.45); caixa(mats.friso, -10, 31.5, 6.6, 0.56, 2.3, 2.42);
  painel(texMuro, 5.9, 1.6, -10, 1.38, 31.71, 0); painel(texMuro, 5.9, 1.6, -10, 1.38, 31.29, Math.PI);
  addCaixa(-10, 31.5, 3.3, 0.28, 2.42, 'muro do letreiro');

  /* ---------- biruta e poste de iluminação (fora do caminho dos exercícios) ---------- */
  { const x = -20.6, z = -11.8;
    cil(mats.esquadria, x, z, 0.07, 0, 6, 8, 0.05); addCaixa(x, z, 0.1, 0.1, 6.1, 'biruta');
    const cone = new THREE.CylinderGeometry(0.1, 0.32, 1.7, 10, 1, true); cone.rotateZ(-Math.PI / 2 - 0.6); cone.translate(x + 0.75, 5.35, z);
    por(mats.laranja, cone);
  }
  { const x = -10.5, z = 28.4;
    cil(mats.aco, x, z, 0.1, 0, 8, 8, 0.06); caixa(mats.aco, x, z, 1.7, 0.08, 7.9, 7.98);
    for (const dx of [-0.7, 0.7]) caixa(mats.esquadria, x + dx, z - 0.12, 0.42, 0.3, 7.72, 7.9);
    addCaixa(x, z, 0.14, 0.14, 8.05, 'poste de iluminação');
  }

  /* ---------- junta tudo: um desenho por material ---------- */
  const malhas = [];
  for (const [m, arr] of baldes) {
    const ms = new THREE.Mesh(mergeGeometries(arr, false), m);
    if (SOMBRAS) { ms.castShadow = !noChao.has(m) && m !== mats.grade; ms.receiveShadow = m !== mats.grade; }
    if (m === mats.grade) ms.renderOrder = 2;
    cena.add(ms); malhas.push(ms);
  }
  return {
    mats, malhas, soltas,
    arvores: [[-47, -17, 0.85], [-47.5, 9, 0.9], [-46, 27, 0.8], [-2, 27.4, 0.8]],      // sombra nos fundos e na entrada
    semCapim: [[-38.7, -21.7, -4.7, 12.7], [-39.3, -11.8, 12.7, 27.2], [AC.x0 - 0.3, AC.x1 + 0.3, AC.z0, AC.z1], [3.7, 7.5, 25.3, 29.1]],
  };
}
