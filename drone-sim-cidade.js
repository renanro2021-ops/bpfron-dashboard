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
    g.fillStyle = '#e9e9e6'; for (let x = 0; x < w; x += 64) g.fillRect(x, h / 2 - 2, 32, 4);
  }, [1, 1]);
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

  /* ---------- prédios ---------- */
  const predio = (tipo, x, z, w, d, h, cor) => {
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
    addCaixa(x, z, w / 2, d / 2, topo, tipo === 'casa' ? 'casa' : 'prédio');
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
        predio('casa', lx + off, lz, w, d, R(3, 3.6), cor);
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
    g.userData = { tipo, placa, ...dimensoesCarro(tipo) };
    return g;
  }

  return { carros, carroAvulso, quadras, malhas, mat, matCarro, instancias, texPlacas, canvasPlacas, livre };
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
