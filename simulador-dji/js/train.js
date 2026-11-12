// Trem da Estrada de Ferro Madeira-Mamoré (Porto Velho, RO): Locomotiva 7 (2-8-0, preta com viga vermelha),
// tender "E.F. MADEIRA MAMORÉ" e vagões de madeira vermelhos. Feito a partir da imagem de referência do usuário
// (imagens/Ferrovia Madeira-Mamoré_ Locomotiva 7.png). Tudo em peças simples juntadas pelo Kit (poucas malhas).
// Referencial local: x = lado, y = altura (0 = chão), z = comprimento, frente da locomotiva para +z.
import * as THREE from 'three';
import { Kit } from './kit.js';

const RT = 0.32; // topo do trilho
const TAU = Math.PI * 2;

// ---------- letreiros pintados (canvas com transparência) ----------
function paintTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); draw(g, w, h);
  // desgaste: pontinhos apagados
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < w * h / 260; i++) { g.globalAlpha = 0.3 + Math.random() * 0.7; g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 3, 1 + Math.random() * 2); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
const CREAM = '#d8ccae';
let TX = null;
function decalTextures() {
  if (TX) return TX;
  TX = {
    tender: paintTex(1024, 160, (g, w, h) => {
      g.fillStyle = CREAM; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = 'bold 104px Georgia, "Times New Roman", serif';
      g.fillText('E.F. MADEIRA MAMORÉ', w / 2, h / 2 + 6, w - 30);
    }),
    seven: paintTex(256, 256, (g, w, h) => {
      g.fillStyle = CREAM; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = 'bold 200px Georgia, "Times New Roman", serif'; g.fillText('7', w / 2, h / 2 + 12);
    }),
    // placa redonda da frente: aro de latão, fundo preto, "7" de latão
    plate: paintTex(256, 256, (g, w, h) => {
      g.beginPath(); g.arc(128, 128, 124, 0, TAU); g.fillStyle = '#9c7a44'; g.fill();
      g.beginPath(); g.arc(128, 128, 104, 0, TAU); g.fillStyle = '#141210'; g.fill();
      g.beginPath(); g.arc(128, 128, 96, 0, TAU); g.lineWidth = 4; g.strokeStyle = '#7d6236'; g.stroke();
      g.fillStyle = '#c9a466'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = 'bold 150px Georgia, serif'; g.fillText('7', 128, 140);
    }),
  };
  return TX;
}

// ---------- roda raiada (eixo em x) ----------
// R = raio, n = raios, crank = ângulo da manivela (null = sem manivela/contrapeso), out = lado de fora (+1/-1)
function wheel(k, cx, cy, cz, R, n, crank, out) {
  const w = 0.13, hw = w / 2, rim = R * 0.8, hubR = R * 0.22, ax = out > 0 ? 'x' : '-x';
  // pneu torneado: friso do lado de dentro, banda levemente cônica, chanfro por fora (cada trecho separado = quina viva)
  for (const prof of [
    [[rim, -hw], [R * 1.075, -hw]],
    [[R * 1.075, -hw], [R * 1.088, -hw + 0.012], [R * 1.07, -hw + 0.026], [R * 1.02, -hw + 0.04], [R, -hw + 0.05], [R * 0.988, hw]],
    [[R * 0.988, hw], [R * 0.97, hw + 0.006], [rim * 1.03, hw + 0.006]],
    [[rim * 1.03, hw + 0.006], [rim, hw - 0.012], [rim, -hw]],
  ]) k.lathe('iron', prof, cx, cy, cz, ax, 44);
  // cubo abaulado com parafusos e ponta do eixo
  k.lathe('iron', [[hubR * 1.05, -0.07], [hubR * 1.05, 0.03], [hubR * 0.92, 0.07], [hubR * 0.6, 0.085], [0.001, 0.09]], cx, cy, cz, ax, 22);
  for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; k.cyl('steel', cx + out * 0.075, cy + Math.cos(a) * hubR * 0.72, cz + Math.sin(a) * hubR * 0.72, 0.013, 0.025, 'x', 6); }
  k.cyl('steel', cx + out * 0.1, cy, cz, hubR * 0.4, 0.05, 'x', 14);
  // raios ovais, mais grossos junto ao cubo
  const sp = new THREE.CylinderGeometry(R * 0.042, R * 0.068, rim - hubR + 0.03, 8);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU, rm = (rim + hubR) / 2;
    k.add('iron', sp, cx + out * 0.012, cy + Math.cos(a) * rm, cz + Math.sin(a) * rm, a, 0, 0, 0.6, 1, 1);
  }
  if (crank != null) {
    // contrapeso (do lado oposto da manivela) e pino da manivela
    const psi = crank + Math.PI, L = 1.7;
    k.add('iron', new THREE.CylinderGeometry(rim, rim, 0.09, 14, 1, false, psi - Math.PI / 2 - L / 2, L), cx + out * 0.015, cy, cz, 0, 0, -Math.PI / 2);
    const rc = R * 0.5;
    k.cyl('iron', cx + out * 0.06, cy + Math.cos(crank) * rc, cz + Math.sin(crank) * rc, 0.09, 0.08, 'x', 16);
    k.cyl('steel', cx + out * 0.14, cy + Math.cos(crank) * rc, cz + Math.sin(crank) * rc, 0.045, 0.16, 'x', 10);
  }
}

// truque (bogie) de 2 eixos com longarinas em arco (vagões e tender)
function bogie(k, cz, R = 0.42) {
  const G = 0.72, cy = RT + R;
  for (const dz of [-0.75, 0.75]) {
    for (const s of [-1, 1]) wheel(k, s * G, cy, cz + dz, R, 10, null, s);
    k.cyl('steel', 0, cy, cz + dz, 0.06, 1.5, 'x', 10); // eixo
  }
  for (const s of [-1, 1]) {
    const x = s * 0.95;
    k.box('iron', x, cy + 0.32, cz, 0.09, 0.08, 2.3);           // barra de cima
    k.box('iron', x, cy - 0.12, cz, 0.08, 0.06, 1.2);          // barra de baixo
    for (const e of [-1, 1]) {
      k.rod('iron', [x, cy - 0.12, cz + e * 0.6], [x, cy + 0.3, cz + e * 1.1], 0.035, 6, true);
      k.box('iron', x, cy + 0.05, cz + e * 0.75, 0.2, 0.3, 0.3); // caixa de mancal
      k.box('iron', x + s * 0.11, cy + 0.12, cz + e * 0.75, 0.03, 0.12, 0.2);
    }
    k.box('iron', x, cy + 0.12, cz, 0.12, 0.42, 0.42);          // mola central
    for (let i = 0; i < 4; i++) k.cyl('steel', x, cy + 0.0 + i * 0.07, cz, 0.12, 0.05, 'y', 10);
  }
  k.box('iron', 0, cy + 0.3, cz, 2.0, 0.22, 0.4);              // travessa
}

// engate + para-choques numa ponta (dir = +1 frente, -1 trás)
function couplerEnd(k, z, dir, y = 1.0) {
  k.box('iron', 0, y, z + dir * 0.18, 0.28, 0.24, 0.36);
  k.box('steel', 0, y, z + dir * 0.4, 0.2, 0.16, 0.16);
}

// ---------- locomotiva 7 + tender ----------
function locomotive(k) {
  const DZ = [-1.95, -0.65, 0.65, 1.95], R = 0.56, wy = RT + R, G = 0.72;
  // rodas motrizes (manivelas: direita 0°, esquerda 90° – como nas de verdade)
  for (const s of [-1, 1]) {
    const ph = s > 0 ? 0.9 : 0.9 + Math.PI / 2;
    for (const z of DZ) wheel(k, s * G, wy, z, R, 14, ph, s);
    // biela de acoplamento (liga os 4 pinos) e biela motriz (cruzeta → 3º eixo)
    const pin = (z) => [s * 0.93, wy + Math.cos(ph) * R * 0.5, z + Math.sin(ph) * R * 0.5];
    k.rod('steel', pin(DZ[0]), pin(DZ[3]), 0.045, 6, true);
    for (const z of DZ) k.cyl('steel', ...pin(z), 0.07, 0.06, 'x', 12);
    const ch = [s * 1.0, 1.02, 2.55];
    k.rod('steel', [ch[0], ch[1], ch[2]], [s * 1.0, pin(DZ[2])[1], pin(DZ[2])[2]], 0.05, 6, true);
    k.box('steel', ch[0], ch[1], ch[2], 0.14, 0.2, 0.3);                 // cruzeta
    k.box('steel', s * 1.0, 1.17, 2.95, 0.06, 0.05, 1.1);                // guias da cruzeta
    k.box('steel', s * 1.0, 0.88, 2.95, 0.06, 0.05, 1.1);
    // cilindro, tampa e caixa de vapor
    k.cyl('iron', s * 1.0, 1.02, 3.75, 0.29, 0.95, 'z', 24);
    for (const e of [-1, 1]) { k.cyl('iron', s * 1.0, 1.02, 3.75 + e * 0.49, 0.32, 0.05, 'z', 24); }
    k.cyl('brass', s * 1.0, 1.02, 4.255, 0.12, 0.03, 'z', 16);
    k.box('iron', s * 0.98, 1.47, 3.75, 0.42, 0.34, 0.9);
    k.rod('iron', [s * 0.55, 2.0, 3.55], [s * 0.95, 1.6, 3.6], 0.08, 10);   // tubo de vapor
    // distribuição Walschaerts: manivela de retorno → biela excêntrica → setor → haste de raio → alavanca de combinação → válvula
    const mp = pin(DZ[2]), ea = ph - Math.PI / 2;
    const ec = [s * 1.13, mp[1] + Math.cos(ea) * R * 0.26, mp[2] + Math.sin(ea) * R * 0.26];
    k.rod('steel', [s * 1.02, mp[1], mp[2]], ec, 0.035, 6, true);
    k.cyl('steel', ...ec, 0.04, 0.05, 'x', 10);
    const lk = [s * 1.13, 1.28, 1.55];
    k.box('steel', lk[0], lk[1], lk[2], 0.05, 0.46, 0.1, 0.14, 0, 0);                 // setor (link)
    k.box('steel', lk[0] + s * 0.035, lk[1], lk[2], 0.02, 0.4, 0.05, 0.14, 0, 0);
    k.box('iron', s * 1.13, 1.47, 1.55, 0.05, 0.24, 0.32);                           // suporte do setor
    k.rod('steel', ec, [lk[0], lk[1] - 0.2, lk[2] - 0.03], 0.03, 6, true);             // biela excêntrica
    const cz = 2.82;
    k.rod('steel', [s * 1.15, 1.52, cz], [s * 1.15, 0.84, cz], 0.028, 6, true);       // alavanca de combinação
    k.rod('steel', [lk[0], 1.36, lk[2] + 0.02], [s * 1.15, 1.42, cz], 0.03, 6, true); // haste de raio
    k.rod('steel', [s * 1.15, 0.87, cz], [s * 1.08, 0.94, ch[2]], 0.025, 6, true);    // biela de união (cruzeta)
    k.rod('steel', [s * 1.15, 1.52, cz], [s * 1.06, 1.47, 3.32], 0.022, 8);           // haste da válvula
    k.rod('steel', [s * 1.27, 1.7, 1.55], [s * 1.27, 1.7, -1.6], 0.016, 6);           // haste de reversão até a cabine
    k.rod('steel', [s * 1.27, 1.7, 1.55], [lk[0], 1.47, 1.6], 0.02, 6, true);
    // sapatas de freio atrás de cada roda, penduradas na longarina, e travessa do freio
    for (const z of DZ) {
      k.box('iron', s * G, wy - 0.02, z - R - 0.045, 0.11, 0.44, 0.07, -0.08, 0, 0);
      k.rod('iron', [s * G, wy + 0.2, z - R - 0.03], [s * 0.6, 1.2, z - R - 0.1], 0.022, 6, true);
      if (s > 0) k.cyl('steel', 0, wy - 0.12, z - R - 0.07, 0.025, 1.4, 'x', 6);
    }
    // registros de dreno dos cilindros
    for (const e of [-1, 1]) k.rod('steel', [s * 1.0, 0.76, 3.75 + e * 0.35], [s * 1.02, 0.5, 3.78 + e * 0.42], 0.013, 6);
  }
  for (const z of DZ) k.cyl('steel', 0, wy, z, 0.08, 1.45, 'x', 12);
  // truque dianteiro (2 rodas pequenas)
  for (const s of [-1, 1]) wheel(k, s * G, RT + 0.34, 3.35, 0.34, 10, null, s);
  k.cyl('steel', 0, RT + 0.34, 3.35, 0.06, 1.45, 'x', 10);
  k.box('iron', 0, RT + 0.52, 3.35, 1.6, 0.12, 0.3);

  // longarinas, estribo (passadiço), saia
  for (const s of [-1, 1]) {
    k.box('iron', s * 0.5, 1.0, 0.6, 0.09, 0.5, 7.9);
    k.box('iron', s * 1.12, 1.6, 1.25, 0.42, 0.035, 5.75);
    k.box('iron', s * 1.32, 1.53, 1.25, 0.025, 0.14, 5.75);
  }
  // viga dianteira vermelha + limpa-trilhos
  k.box('red', 0, 1.05, 4.48, 2.5, 0.42, 0.24);
  k.box('iron', 0, 1.29, 4.48, 2.52, 0.05, 0.26);
  for (const s of [-1, 1]) k.cyl('iron', s * 0.95, 1.06, 4.64, 0.06, 0.12, 'z', 10);   // parafusos grandes
  couplerEnd(k, 4.55, 1, 1.0);
  for (let i = 0; i <= 12; i++) {
    const x = -1.05 + (i / 12) * 2.1, back = Math.abs(x) / 1.05;
    k.rod('iron', [x, 0.86, 4.6], [x * 0.92, 0.14, 5.25 - back * 0.45], 0.028, 4, true);
  }
  for (const y of [0.15, 0.5]) for (const s of [-1, 1]) {
    const t = (0.86 - y) / 0.72, zc = 4.6 + t * 0.65, ze = 4.6 + t * 0.2;
    k.rod('iron', [0, y, zc], [s * 1.0, y, ze], 0.03, 4, true);
  }

  // caldeira com cintas, caixa de fumaça, porta com rebites e placa
  const by = 2.18;
  k.cyl('jacket', 0, by, 0.7, 0.7, 4.6, 'z', 40);
  for (const z of [-1.2, -0.3, 0.6, 1.5, 2.4]) k.add('steel', new THREE.TorusGeometry(0.705, 0.016, 6, 48), 0, by, z);
  k.cyl('iron', 0, by, 3.575, 0.75, 1.15, 'z', 40);
  k.add('iron', new THREE.TorusGeometry(0.75, 0.03, 6, 48), 0, by, 4.15);
  k.lathe('iron', [[0.7, 0], [0.68, 0.01], [0.55, 0.045], [0.3, 0.07], [0.001, 0.08]], 0, by, 4.15, 'z', 40); // porta abaulada
  k.box('iron', 0, 1.65, 3.6, 1.15, 0.55, 0.95);                       // berço
  const rivets = [];
  for (let i = 0; i < 30; i++) { const a = (i / 30) * TAU; rivets.push([Math.cos(a) * 0.72, by + Math.sin(a) * 0.72, 4.16]); }
  for (let i = 0; i < 24; i++) { const a = (i / 24) * TAU; rivets.push([Math.cos(a) * 0.6, by + Math.sin(a) * 0.6, 4.2]); }
  for (const z of [3.05, 4.05]) for (let i = 0; i < 26; i++) { const a = (i / 26) * Math.PI * 1.1 - 0.05; rivets.push([Math.cos(a) * 0.755, by + Math.sin(a) * 0.755, z]); rivets.push([-Math.cos(a) * 0.755, by + Math.sin(a) * 0.755, z]); }
  const rg = new THREE.SphereGeometry(0.022, 6, 4);
  for (const p of rivets) k.add('iron', rg, ...p);
  // fecho central e dobradiças da porta
  k.cyl('steel', 0, by - 0.36, 4.21, 0.035, 0.1, 'z', 10);
  k.box('steel', 0, by - 0.36, 4.26, 0.3, 0.035, 0.03);
  for (const y of [0.25, -0.25]) k.box('iron', -0.45, by + y, 4.22, 0.5, 0.07, 0.04);

  // chaminé, domos, apitos, válvulas
  k.lathe('iron', [[0.36, 0], [0.26, 0.08], [0.2, 0.25], [0.19, 0.95], [0.23, 1.0], [0.26, 1.1], [0.25, 1.16], [0.17, 1.16], [0.16, 0.6]], 0, 2.8, 3.62, 'y', 28);
  k.cyl('dark', 0, 3.7, 3.62, 0.165, 0.5, 'y', 20);
  const dome = (z, r, h) => k.lathe('jacket', [[r * 1.45, 0], [r * 1.1, 0.06], [r, 0.16], [r, h * 0.62], [r * 0.85, h * 0.85], [r * 0.5, h * 0.98], [0.001, h]], 0, 2.78, z, 'y', 28);
  dome(1.35, 0.3, 0.62); dome(0.0, 0.26, 0.48);
  k.lathe('brass', [[0.06, 0], [0.06, 0.12], [0.1, 0.14], [0.001, 0.2]], 0, 3.38, 1.35, 'y', 14);
  k.lathe('brass', [[0.05, 0], [0.05, 0.25], [0.07, 0.27], [0.07, 0.38], [0.001, 0.42]], 0.18, 2.86, -1.15, 'y', 14); // apito
  for (const x of [-0.12, 0.12]) k.lathe('brass', [[0.07, 0], [0.06, 0.15], [0.08, 0.17], [0.001, 0.22]], x, 2.86, -0.75, 'y', 12);
  // farol
  k.box('iron', 0, 3.17, 4.05, 0.46, 0.5, 0.42);
  k.lathe('iron', [[0.09, 0], [0.07, 0.18], [0.1, 0.2], [0.001, 0.22]], 0, 3.42, 4.02, 'y', 12);
  k.cyl('lens', 0, 3.17, 4.27, 0.17, 0.02, 'z', 24);
  k.add('brass', new THREE.TorusGeometry(0.18, 0.025, 8, 28), 0, 3.17, 4.28);
  k.box('iron', 0, 2.9, 4.0, 0.3, 0.06, 0.34);
  // corrimãos e areeiros
  for (const s of [-1, 1]) {
    k.rod('steel', [s * 0.82, 2.48, -1.45], [s * 0.82, 2.48, 3.9], 0.018);
    for (const z of [-1.2, 0.3, 1.8, 3.4]) k.rod('steel', [s * 0.72, 2.42, z], [s * 0.82, 2.48, z], 0.012);
    k.rod('iron', [s * 0.3, 2.86, 0.05], [s * 0.64, 2.56, 0.1], 0.025); k.rod('iron', [s * 0.64, 2.56, 0.1], [s * 0.97, 1.63, 0.35], 0.025);
    k.cyl('iron', s * 0.98, 1.35, 1.25, 0.17, 1.4, 'z', 16);                 // reservatório de ar
    for (const z of [0.6, 1.9]) k.add('iron', new THREE.TorusGeometry(0.175, 0.012, 4, 20), s * 0.98, 1.35, z);
  }
  k.cyl('iron', 1.0, 1.98, 0.35, 0.13, 0.7, 'y', 16);                       // bomba de ar
  k.cyl('brass', 1.0, 2.36, 0.35, 0.1, 0.06, 'y', 16);
  k.rod('iron', [1.0, 2.4, 0.35], [0.62, 2.62, 0.2], 0.02);                     // tubo de vapor da bomba
  // tubos do injetor ao longo da caldeira, com abraçadeiras, até a válvula de retenção de latão
  for (const s of [-1, 1]) {
    const lo = [s * 0.715, by - 0.21], hi = [s * 0.735, by + 0.12];
    k.rod('iron', [lo[0], lo[1], -1.5], [lo[0], lo[1], 0.95], 0.024, 8);
    k.rod('iron', [lo[0], lo[1], 0.95], [hi[0], hi[1], 1.08], 0.024, 8);
    for (const z of [-1.0, -0.1, 0.8]) k.box('steel', lo[0] * 0.985, lo[1], z, 0.05, 0.05, 0.03);
    k.lathe('brass', [[0.05, 0], [0.05, 0.06], [0.035, 0.08], [0.035, 0.12], [0.001, 0.13]], s * 0.72, hi[1], 1.08, s > 0 ? 'x' : '-x', 12);
    k.rod('iron', [s * 0.7, by - 0.36, -1.5], [s * 0.9, 1.45, -1.25], 0.022, 6);   // descida para o injetor
    k.cyl('brass', s * 0.92, 1.42, -1.25, 0.05, 0.18, 'z', 10);
  }
  // sino entre os domos (forquilha + sino de latão)
  for (const x of [-0.14, 0.14]) k.box('iron', x, 3.0, 0.65, 0.03, 0.3, 0.06);
  k.box('iron', 0, 3.15, 0.65, 0.31, 0.03, 0.06);
  k.lathe('brass', [[0.14, 0], [0.125, 0.025], [0.095, 0.11], [0.07, 0.17], [0.03, 0.2], [0.001, 0.205]], 0, 2.94, 0.65, 'y', 22);
  k.cyl('brass', 0, 3.16, 0.65, 0.02, 0.04, 'y', 8);
  // corrimão curvo na porta da caixa de fumaça + pegas
  k.add('steel', new THREE.TorusGeometry(0.6, 0.014, 6, 28, Math.PI * 0.62), 0, by, 4.27, 0, 0, Math.PI * 0.19);
  for (const a of [0.25, 0.5, 0.75]) k.cyl('steel', Math.cos(a * Math.PI) * 0.6, by + Math.sin(a * Math.PI) * 0.6, 4.24, 0.012, 0.06, 'z', 6);
  // degraus na viga dianteira
  for (const s of [-1, 1]) {
    k.box('iron', s * 1.2, 0.66, 4.66, 0.28, 0.035, 0.22);
    for (const e of [-1, 1]) k.box('iron', s * 1.2 + e * 0.12, 0.85, 4.62, 0.025, 0.4, 0.04);
  }
  // fornalha e cinzeiro entre as longarinas
  k.box('iron', 0, 1.5, -2.45, 1.05, 0.8, 1.9);

  // cabine
  const cz0 = -3.6, cz1 = -1.55, cy0 = 1.62, cy1 = 3.42, hw = 1.15;
  k.box('jacket', 0, cy0 - 0.02, (cz0 + cz1) / 2, 2.4, 0.06, cz1 - cz0);           // piso
  // frente com 2 janelas
  k.box('jacket', 0, (cy0 + 2.55) / 2, cz1, 2.3, 2.55 - cy0, 0.06);
  for (const [x0, x1] of [[-hw, -0.95], [-0.35, 0.35], [0.95, hw]]) k.box('jacket', (x0 + x1) / 2, 2.85, cz1, x1 - x0, 0.6, 0.06);
  k.box('jacket', 0, 3.27, cz1, 2.3, 0.3, 0.06);
  for (const x of [-0.65, 0.65]) k.box('glass', x, 2.85, cz1 + 0.01, 0.6, 0.6, 0.02);
  // laterais: painel baixo, colunas, janelas, verga; entrada aberta atrás
  for (const s of [-1, 1]) {
    const x = s * hw;
    k.box('jacket', x, (cy0 + 2.45) / 2, (-3.0 + cz1) / 2, 0.06, 2.45 - cy0, cz1 - -3.0);
    for (const [z, wz] of [[-3.0, 0.12], [-2.3, 0.08], [-1.62, 0.14]]) k.box('jacket', x, 2.8, z, 0.07, 0.7, wz);
    k.box('jacket', x, 3.27, (cz0 + cz1) / 2, 0.06, 0.32, cz1 - cz0);
    k.box('glass', x, 2.8, -1.97, 0.02, 0.66, 0.56);
    // moldura da janela lateral e da abertura traseira (filete saliente)
    for (const y of [2.45, 3.13]) k.box('jacket', x + s * 0.04, y, -2.3, 0.035, 0.05, 1.42);
    for (const z of [-2.99, -1.66]) k.box('jacket', x + s * 0.04, 2.79, z, 0.035, 0.72, 0.05);
    k.box('jacket', x + s * 0.03, 2.47, (-3.0 + cz1) / 2, 0.04, 0.05, cz1 + 3.0);     // peitoril
    k.rod('brass', [x + s * 0.06, 1.75, -3.05], [x + s * 0.06, 3.0, -3.05], 0.018);   // pega-mão
    k.box('iron', x - s * 0.05, 1.25, -3.3, 0.3, 0.04, 0.3);                         // degraus
    k.box('iron', x - s * 0.05, 0.85, -3.3, 0.3, 0.04, 0.3);
    k.box('iron', x, 1.05, -3.3, 0.04, 0.85, 0.04);
  }
  // teto arqueado com beiral
  const roof = new THREE.Shape();
  roof.absarc(0, -3.0, 3.26, Math.PI / 2 - 0.42, Math.PI / 2 + 0.42, false);
  roof.absarc(0, -3.0, 3.2, Math.PI / 2 + 0.42, Math.PI / 2 - 0.42, true);
  const rg2 = new THREE.ExtrudeGeometry(roof, { depth: 2.46, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2, curveSegments: 18 });
  k.add('jacket', rg2, 0, cy1 - 0.02, cz0 - 0.28);
  for (const s of [-1, 1]) k.rod('jacket', [s * 1.32, cy1 - 0.04, cz0 - 0.3], [s * 1.32, cy1 - 0.04, cz1 + 0.2], 0.022, 8); // calha
  k.box('jacket', 0, cy1 + 0.3, -2.6, 0.7, 0.08, 0.8);                               // escotilha de ventilação
  for (const x of [-0.37, 0.37]) k.box('jacket', x, cy1 + 0.26, -2.6, 0.04, 0.08, 0.8);
  // fresta acesa da porta da fornalha (vista pela porta e pelas janelas da cabine)
  k.box('fire', 0, 1.95, cz1 - 0.162, 0.32, 0.05, 0.012);
  // painel interno (dá vida pela janela): fornalha, manômetros
  k.cyl('dark', 0, 2.2, cz1 - 0.06, 0.7, 0.05, 'z', 28);
  for (const x of [-0.25, 0.25]) k.cyl('brass', x, 2.75, cz1 - 0.1, 0.09, 0.04, 'z', 16);
  k.box('iron', 0, 1.95, cz1 - 0.12, 0.45, 0.35, 0.06);

  // ---------- tender ----------
  const t0 = -9.8, t1 = -3.85, tc = (t0 + t1) / 2, tl = t1 - t0;
  bogie(k, t0 + 1.45); bogie(k, t1 - 1.45);
  k.box('iron', 0, 1.15, tc, 2.2, 0.26, tl + 0.1);
  for (const s of [-1, 1]) k.box('iron', s * 1.12, 1.15, tc, 0.06, 0.34, tl + 0.1);
  // tanque com os cantos de trás arredondados (planta extrudada para cima, bordas boleadas)
  const bv = 0.02, TW = 1.15 - bv, rr = 0.42, rf = 0.06, yF = -tl / 2 + bv, yR = tl / 2 - bv; // + chanfro = 2,3 m × tl
  const tank = new THREE.Shape();
  tank.moveTo(-TW + rf, yF); tank.lineTo(TW - rf, yF); tank.absarc(TW - rf, yF + rf, rf, -Math.PI / 2, 0);
  tank.lineTo(TW, yR - rr); tank.absarc(TW - rr, yR - rr, rr, 0, Math.PI / 2);
  tank.lineTo(-TW + rr, yR); tank.absarc(-TW + rr, yR - rr, rr, Math.PI / 2, Math.PI);
  tank.lineTo(-TW, yF + rf); tank.absarc(-TW + rf, yF + rf, rf, Math.PI, Math.PI * 1.5);
  const tg = new THREE.ExtrudeGeometry(tank, { depth: 1.45 - 2 * bv, bevelEnabled: true, bevelThickness: bv, bevelSize: bv, bevelSegments: 2, curveSegments: 12 });
  tg.rotateX(-Math.PI / 2);
  k.add('jacket', tg, 0, 2.0 - 1.45 / 2 + bv, tc);
  // borda alargada (aba do carvão) em volta, curvando nos cantos de trás
  for (const s of [-1, 1]) {
    k.box('jacketDS', s * 1.2, 2.86, (t1 + t0 + rr) / 2, 0.04, 0.32, tl - rr, 0, 0, -s * 0.35);
    k.add('jacketDS', new THREE.CylinderGeometry(rr + bv + 0.11, rr + bv, 0.31, 10, 1, true, s > 0 ? Math.PI / 2 : Math.PI, Math.PI / 2), s * (TW - rr), 2.87, t0 + rr + bv);
    k.box('steel', s * 1.16, 2.72, (t1 + t0 + rr) / 2, 0.02, 0.04, tl - rr);    // friso
    k.box('steel', s * 1.16, 1.3, (t1 + t0 + rr) / 2, 0.02, 0.04, tl - rr);
  }
  k.box('jacketDS', 0, 2.87, t0 - 0.055, 2.3 - 2 * rr, 0.31, 0.04, -0.35, 0, 0);
  k.cyl('iron', 0, 2.78, t0 + 1.3, 0.32, 0.12, 'y', 24);                      // tampa da caixa d'água
  k.cyl('iron', 0, 2.85, t0 + 1.3, 0.05, 0.05, 'y', 8);
  k.box('red', 0, 1.05, t0 - 0.02, 2.36, 0.36, 0.2);                          // viga traseira
  couplerEnd(k, t0, -1, 1.0);
  for (const x of [-0.25, 0.25]) k.box('iron', x, 2.05, t0 - 0.07, 0.04, 1.5, 0.04); // escada traseira
  for (let i = 0; i < 6; i++) k.box('iron', 0, 1.4 + i * 0.24, t0 - 0.07, 0.5, 0.03, 0.03);
  // rebites do tanque
  for (const s of [-1, 1]) {
    for (const y of [1.36, 2.64]) for (let z = t0 + 0.47; z < t1 - 0.05; z += 0.13) k.add('iron', rg, s * 1.153, y, z);
    for (const z of [t0 + 0.75, t1 - 0.75]) for (let y = 1.42; y < 2.62; y += 0.12) k.add('iron', rg, s * 1.153, y, z);
  }
  // carvão: monte irregular + pedras soltas
  const coal = new THREE.PlaneGeometry(2.15, 2.6, 16, 18); coal.rotateX(-Math.PI / 2);
  const p = coal.attributes.position, r = mulberry(7);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), hump = Math.max(0, 1 - (x / 1.15) ** 2) * Math.max(0, 1 - (z / 1.4) ** 2);
    p.setY(i, 0.5 * hump + (r() - 0.5) * 0.07 * hump);
  }
  coal.computeVertexNormals();
  k.add('coal', coal, 0, 2.7, t1 - 1.35);
  const lump = new THREE.IcosahedronGeometry(0.1, 0);
  for (let i = 0; i < 140; i++) {
    const x = (r() - 0.5) * 1.9, z = (r() - 0.5) * 2.3, hump = Math.max(0, 1 - (x / 1.15) ** 2) * Math.max(0, 1 - (z / 1.4) ** 2);
    const s = 0.5 + r() * 1.2;
    k.add('coal', lump, x, 2.72 + 0.5 * hump, t1 - 1.35 + z, r() * 3, r() * 3, r() * 3, s, s * (0.6 + r() * 0.5), s);
  }
  return { tender: [t0, t1] };
}

function mulberry(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// ---------- vagão de passageiros de madeira (tábuas vermelhas, janelas, lanternim) ----------
function coach(k, zc, seed = 1) {
  const L = 11, hw = 1.2, y0 = 1.3, y1 = 3.3, z0 = zc - L / 2, z1 = zc + L / 2, r = mulberry(seed);
  bogie(k, z0 + 2.2); bogie(k, z1 - 2.2);
  // estrado, travessas e tirantes treliçados por baixo
  k.box('iron', 0, 1.12, zc, 2.3, 0.22, L + 1.6);
  for (const s of [-0.55, 0.55]) {
    k.rod('steel', [s, 1.02, z0 + 0.4], [s, 0.72, z0 + 3.6], 0.02);
    k.rod('steel', [s, 0.72, z0 + 3.6], [s, 0.72, z1 - 3.6], 0.02);
    k.rod('steel', [s, 0.72, z1 - 3.6], [s, 1.02, z1 - 0.4], 0.02);
    for (const z of [z0 + 3.6, z1 - 3.6]) k.box('iron', s, 0.87, z, 0.08, 0.3, 0.08);
  }
  // paredes laterais com 10 janelas
  const nW = 10, ww = 0.56, wy0 = 2.1, wy1 = 2.85, step = (L - 1.2) / nW;
  for (const s of [-1, 1]) {
    const x = s * hw;
    k.box('wood', x, (y0 + wy0) / 2, zc, 0.07, wy0 - y0, L);
    k.box('wood', x, (wy1 + y1) / 2, zc, 0.07, y1 - wy1, L);
    for (let i = 0; i < nW; i++) {
      const zm = z0 + 0.6 + (i + 0.5) * step;
      // colunas entre janelas
      const pz0 = i === 0 ? z0 : zm - step / 2, pz1 = zm - ww / 2;
      k.box('wood', x, (wy0 + wy1) / 2, (pz0 + pz1) / 2, 0.07, wy1 - wy0, pz1 - pz0);
      if (i === nW - 1) k.box('wood', x, (wy0 + wy1) / 2, (zm + ww / 2 + z1) / 2, 0.07, wy1 - wy0, z1 - zm - ww / 2);
      // caixilho e vidro (algumas abertas: abaixadas até a metade, outras quebradas)
      const kind = r();
      k.box('trim', x + s * 0.04, wy0 - 0.03, zm, 0.06, 0.06, ww + 0.12);
      k.box('trim', x + s * 0.04, wy1 + 0.03, zm, 0.06, 0.06, ww + 0.12);
      for (const e of [-1, 1]) k.box('trim', x + s * 0.04, (wy0 + wy1) / 2, zm + e * (ww / 2 + 0.03), 0.06, wy1 - wy0 + 0.12, 0.05);
      if (kind < 0.7) k.box('glass', x - s * 0.01, kind < 0.35 ? (wy0 + wy1) / 2 : wy0 + (wy1 - wy0) * 0.27, zm, 0.015, kind < 0.35 ? wy1 - wy0 : (wy1 - wy0) * 0.54, ww);
      k.box('trim', x, kind < 0.35 ? (wy0 + wy1) / 2 : wy0 + (wy1 - wy0) * 0.54, zm, 0.04, 0.035, ww);
    }
    // frisos (cintas) de madeira escura
    for (const y of [wy0 - 0.08, wy1 + 0.1, y1 - 0.04]) k.box('trim', x + s * 0.05, y, zc, 0.04, 0.07, L);
    k.box('trim', x + s * 0.04, y0 + 0.04, zc, 0.06, 0.1, L + 0.04);
  }
  // interior escuro (vê-se pelas janelas) e bancos
  k.box('dark', 0, (y0 + y1) / 2, zc, 2.3, y1 - y0 - 0.05, L - 0.1);
  // pontas: parede com porta, plataforma com grade e degraus
  for (const e of [-1, 1]) {
    const ze = zc + e * L / 2;
    k.box('wood', 0, (y0 + y1) / 2, ze, 2.4, y1 - y0, 0.07);
    k.box('dark', 0, 1.3 + 1.0, ze + e * 0.045, 0.75, 1.9, 0.02);
    k.box('trim', 0, 1.3 + 1.0, ze + e * 0.05, 0.85, 2.0, 0.015);
    k.box('glass', 0, 2.75, ze + e * 0.065, 0.45, 0.5, 0.015);
    const pz = ze + e * 0.42;
    k.box('wood', 0, 1.25, pz, 2.3, 0.08, 0.84);
    for (const s of [-1, 1]) {
      k.rod('steel', [s * 1.1, 1.29, ze + e * 0.82], [s * 1.1, 2.3, ze + e * 0.82], 0.022);
      k.rod('steel', [s * 0.45, 2.3, ze + e * 0.82], [s * 1.1, 2.3, ze + e * 0.82], 0.022);
      k.rod('steel', [s * 1.1, 2.3, ze + e * 0.82], [s * 1.1, 2.3, ze + e * 0.05], 0.022);
      for (let i = 1; i < 4; i++) k.rod('steel', [s * (0.45 + i * 0.16), 1.29, ze + e * 0.82], [s * (0.45 + i * 0.16), 2.3, ze + e * 0.82], 0.012);
      k.box('iron', s * 1.05, 0.95, pz + e * 0.2, 0.42, 0.04, 0.32);
      k.box('iron', s * 1.05, 0.62, pz + e * 0.2, 0.42, 0.04, 0.32);
    }
    couplerEnd(k, ze + e * 0.85, e, 1.0);
  }
  // teto: arco principal + lanternim com janelinhas
  const arc = (R, half, t) => { const sh = new THREE.Shape(); sh.absarc(0, -R, R + t, Math.PI / 2 - half, Math.PI / 2 + half, false); sh.absarc(0, -R, R, Math.PI / 2 + half, Math.PI / 2 - half, true); return sh; };
  const RB = { bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.02, bevelSegments: 2 };
  const roofG = new THREE.ExtrudeGeometry(arc(4.2, 0.31, 0.06), { depth: L + 1.65, curveSegments: 16, ...RB });
  k.add('roofc', roofG, 0, y1 + 0.2, z0 - 0.83);
  k.box('wood', 0, y1 + 0.32, zc, 1.3, 0.34, L - 1.4);
  for (let i = 0; i < 14; i++) for (const s of [-1, 1]) k.box('glass', s * 0.655, y1 + 0.32, z0 + 1.1 + i * ((L - 2.2) / 13), 0.012, 0.18, 0.4);
  const roof2 = new THREE.ExtrudeGeometry(arc(2.4, 0.3, 0.05), { depth: L - 1.05, curveSegments: 10, ...RB });
  k.add('roofc', roof2, 0, y1 + 0.58, z0 + 0.52);
  // respiros (chaminezinhas com chapéu) em cima do lanternim
  for (let i = 0; i < 5; i++) {
    const z = z0 + 1.6 + i * ((L - 3.2) / 4);
    k.cyl('iron', 0, y1 + 0.72, z, 0.06, 0.16, 'y', 10);
    k.lathe('iron', [[0.13, 0], [0.12, 0.03], [0.06, 0.07], [0.001, 0.08]], 0, y1 + 0.8, z, 'y', 12);
  }
  // equipamento sob o estrado: caixa de baterias, cilindro de freio, reservatório de ar, caixa d'água
  k.box('iron', 0, 0.82, zc + 1.35, 0.6, 0.42, 1.1);
  for (const dz of [-0.35, 0, 0.35]) for (const x of [-0.31, 0.31]) k.box('iron', x, 0.82, zc + 1.35 + dz, 0.02, 0.36, 0.04);
  k.cyl('iron', 0, 0.86, zc - 0.1, 0.28, 1.0, 'z', 18);
  for (const e of [-1, 1]) k.add('iron', new THREE.TorusGeometry(0.285, 0.012, 4, 24), 0, 0.86, zc - 0.1 + e * 0.4);
  k.cyl('iron', -0.25, 0.82, zc - 1.3, 0.14, 0.4, 'z', 14);
  k.rod('steel', [-0.25, 0.82, zc - 1.5], [-0.25, 0.82, zc - 1.95], 0.02);
  k.cyl('iron', 0.22, 0.8, zc - 1.4, 0.16, 0.9, 'z', 16);
  for (const e of [-1, 1]) k.lathe('iron', [[0.16, 0], [0.14, 0.05], [0.07, 0.09], [0.001, 0.1]], 0.22, 0.8, zc - 1.4 + e * 0.45, 'z', 14);
  // lanternas de cauda nas pontas
  for (const e of [-1, 1]) for (const s of [-1, 1]) {
    k.box('iron', s * 1.12, 2.6, zc + e * (L / 2 + 0.06), 0.14, 0.2, 0.1);
    k.cyl('lens', s * 1.12, 2.6, zc + e * (L / 2 + 0.115), 0.045, 0.01, 'z', 12);
  }
  return [z0 - 0.9, z1 + 0.9];
}

// ---------- vagão fechado de carga (tábuas na vertical, mãos-francesas de ferro, porta de correr) ----------
function boxcarWood(k, zc, seed = 2) {
  const L = 9, hw = 1.2, y0 = 1.3, y1 = 3.4, z0 = zc - L / 2, z1 = zc + L / 2, r = mulberry(seed);
  bogie(k, z0 + 1.8); bogie(k, z1 - 1.8);
  k.box('iron', 0, 1.12, zc, 2.3, 0.22, L + 0.3);
  for (const s of [-1, 1]) {
    const x = s * hw;
    k.box('woodv', x, (y0 + y1) / 2, zc, 0.07, y1 - y0, L);
    // estrutura de ferro: colunas, diagonais e cintas
    for (const z of [z0 + 0.05, z0 + 2.0, z1 - 2.0, z1 - 0.05]) k.box('iron', x + s * 0.05, (y0 + y1) / 2, z, 0.04, y1 - y0, 0.1);
    for (const [za, zb] of [[z0 + 0.1, z0 + 1.95], [z1 - 0.1, z1 - 1.95]]) {
      k.rod('iron', [x + s * 0.05, y0 + 0.05, za], [x + s * 0.05, y1 - 0.05, zb], 0.04, 4, true);
      k.rod('iron', [x + s * 0.05, y1 - 0.05, za], [x + s * 0.05, y0 + 0.05, zb], 0.04, 4, true);
    }
    for (const y of [y0 + 0.05, y1 - 0.05]) k.box('iron', x + s * 0.05, y, zc, 0.04, 0.1, L);
    // porta de correr (um pouco aberta de um lado) com trilho
    const open = s > 0 ? 0.55 + r() * 0.4 : 0;
    k.box('woodv', x + s * 0.11, (y0 + y1) / 2 - 0.05, zc + open, 0.06, y1 - y0 - 0.1, 1.8);
    for (const y of [y0 + 0.4, (y0 + y1) / 2, y1 - 0.4]) k.box('iron', x + s * 0.15, y, zc + open, 0.03, 0.08, 1.8);
    k.box('iron', x + s * 0.12, y1 + 0.02, zc + 0.5, 0.08, 0.08, 3.8);
    k.box('iron', x + s * 0.12, y0 - 0.04, zc + 0.5, 0.06, 0.06, 3.8);
    if (open) k.box('dark', x + s * 0.04, (y0 + y1) / 2 - 0.05, zc - 0.9 + open / 2, 0.01, y1 - y0 - 0.12, open); // vão da porta
    // escada na ponta
    for (let i = 0; i < 7; i++) k.box('steel', x + s * 0.09, y0 + 0.3 + i * 0.27, z1 - 0.35, 0.03, 0.03, 0.4);
  }
  k.box('dark', 0, (y0 + y1) / 2, zc, 2.3, y1 - y0 - 0.05, L - 0.1); // interior escuro (porta aberta)
  for (const e of [-1, 1]) {
    const ze = zc + e * L / 2;
    k.box('woodv', 0, (y0 + y1) / 2, ze, 2.4, y1 - y0, 0.07);
    for (const x of [-0.6, 0.6]) k.box('iron', x, (y0 + y1) / 2, ze + e * 0.05, 0.1, y1 - y0, 0.04);
    k.box('red', 0, 1.05, ze + e * 0.05, 2.36, 0.3, 0.12);
    couplerEnd(k, ze, e, 1.0);
  }
  // freio de mão (volante) numa ponta
  k.rod('steel', [0.6, 1.3, z1 + 0.12], [0.6, 3.1, z1 + 0.12], 0.02);
  k.add('steel', new THREE.TorusGeometry(0.22, 0.018, 6, 24), 0.6, 3.15, z1 + 0.12, Math.PI / 2, 0, 0);
  for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI; k.rod('steel', [0.6 + Math.cos(a) * 0.22, 3.15, z1 + 0.12 + Math.sin(a) * 0.22], [0.6 - Math.cos(a) * 0.22, 3.15, z1 + 0.12 - Math.sin(a) * 0.22], 0.012); }
  // teto com passarela
  const sh = new THREE.Shape(); sh.absarc(0, -5, 5.06, Math.PI / 2 - 0.25, Math.PI / 2 + 0.25, false); sh.absarc(0, -5, 5, Math.PI / 2 + 0.25, Math.PI / 2 - 0.25, true);
  k.add('roofc', new THREE.ExtrudeGeometry(sh, { depth: L + 0.26, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2, curveSegments: 12 }), 0, y1 + 0.16, z0 - 0.13);
  k.box('wood', 0, y1 + 0.27, zc, 0.5, 0.05, L + 0.2);
  for (let z = z0; z <= z1; z += 0.9) k.box('wood', 0, y1 + 0.23, z, 0.55, 0.05, 0.08);
  return [z0 - 0.6, z1 + 0.6];
}

// ---------- montagem no mapa ----------
// w = World, h = { tex, rep } (texturas desenhadas do world.js), x/z/yaw = posição do conjunto
// parts: lista na ordem a partir da frente: 'loco' (inclui tender), 'coach', 'boxcar'
export function buildTrain(w, h, x, z, yaw, parts = ['loco', 'coach']) {
  const M = (key, make) => w.mat(key, make);
  // mesma textura com outro nome → outra entrada de foto em photo.js (madeira pintada de vermelho, tábuas deitadas ou em pé)
  const alias = (src, name) => { const t = h.tex(src).clone(); t.userData = { texName: name }; t.needsUpdate = true; return t; };
  const mats = {
    // chapas: foto de ferro com poeira subindo do chão e escorridos de ferrugem (photo.js: trainIron/trainPaint/trainRed)
    iron: M('tr_iron', () => new THREE.MeshStandardMaterial({ map: alias('rust', 'trainIron'), color: 0x4a4440, roughness: 0.7, metalness: 0.5 })),
    jacket: M('tr_jacket', () => new THREE.MeshStandardMaterial({ map: alias('rust', 'trainPaint'), color: 0x3b3633, roughness: 0.6, metalness: 0.5 })),
    jacketDS: M('tr_jacketDS', () => new THREE.MeshStandardMaterial({ map: alias('rust', 'trainPaint'), color: 0x3b3633, roughness: 0.6, metalness: 0.5, side: THREE.DoubleSide })),
    red: M('tr_red', () => new THREE.MeshStandardMaterial({ map: alias('rust', 'trainRed'), color: 0xc8503a, roughness: 0.7, metalness: 0.3 })),
    fire: M('tr_fire', () => new THREE.MeshStandardMaterial({ color: 0x401000, emissive: 0xff6a1a, emissiveIntensity: 2.2, roughness: 1 })),
    steel: M('tr_steel', () => new THREE.MeshStandardMaterial({ color: 0x6f6b66, roughness: 0.38, metalness: 0.9 })),
    brass: M('tr_brass', () => new THREE.MeshStandardMaterial({ color: 0xb08c55, roughness: 0.32, metalness: 1 })),
    lens: M('tr_lens', () => new THREE.MeshStandardMaterial({ color: 0xfff1d0, roughness: 0.08, metalness: 0.2, emissive: 0xffe2a0, emissiveIntensity: 0.25 })),
    glass: M('tr_glass', () => new THREE.MeshStandardMaterial({ color: 0x10161a, roughness: 0.06, metalness: 0.3 })),
    dark: M('tr_dark', () => new THREE.MeshStandardMaterial({ color: 0x0c0b0a, roughness: 1, metalness: 0 })),
    coal: M('tr_coal', () => new THREE.MeshStandardMaterial({ color: 0x0e0e0f, roughness: 0.5, metalness: 0.2 })),
    wood: M('tr_wood', () => new THREE.MeshStandardMaterial({ map: alias('wood', 'woodred'), roughness: 0.9 })),
    woodv: M('tr_woodv', () => new THREE.MeshStandardMaterial({ map: alias('wood', 'woodredv'), roughness: 0.9 })),
    trim: M('tr_trim', () => new THREE.MeshStandardMaterial({ map: alias('wood', 'woodred'), color: 0x8a6058, roughness: 0.85 })),
    roofc: M('tr_roof', () => new THREE.MeshStandardMaterial({ map: h.tex('rust'), color: 0x58524c, roughness: 0.85, metalness: 0.3, side: THREE.DoubleSide })),
  };
  const root = new THREE.Group(); root.position.set(x, 0, z); root.rotation.y = yaw; w.root.add(root);
  const k = new Kit({ bevel: 0.018 });   // quinas chanfradas em todas as caixas
  const c = Math.cos(yaw), s = Math.sin(yaw);
  const col = (lx, ly, lz, hx, hy, hz) => w.addCollider(x + lx * c + lz * s, ly, z - lx * s + lz * c, hx, hy, hz, yaw);
  let zf = 0; // frente do próximo veículo (vai para -z)
  const decals = [];
  for (const p of parts) {
    if (p === 'loco') {
      k.base.makeTranslation(0, 0, zf - 5.3);
      locomotive(k);
      const o = zf - 5.3;
      col(0, 1.9, o + 0.4, 1.2, 1.55, 4.0); col(0, 0.75, o + 4.8, 1.05, 0.45, 0.5); col(0, 3.3, o + 3.62, 0.3, 0.6, 0.3);
      col(0, 1.85, o - 6.82, 1.2, 1.1, 3.0);
      decals.push(['tender', 1.152, 2.02, o - 6.85, 4.2, 0.66], ['tender', -1.152, 2.02, o - 6.85, 4.2, 0.66],
        ['seven', 1.182, 2.05, o - 2.75, 0.5, 0.5], ['seven', -1.182, 2.05, o - 2.75, 0.5, 0.5], ['seven', 0, 2.0, o - 9.83, 0.55, 0.55, Math.PI],
        ['plate', 0, 2.18, o + 4.245, 0.34, 0.34, 0]);
      zf = o - 9.8 - 0.75;
    } else if (p === 'coach') {
      const zc = zf - 0.9 - 5.5;
      k.base.makeTranslation(0, 0, 0);
      coach(k, zc, 3);
      col(0, 2.4, zc, 1.25, 1.25, 6.2);
      zf = zc - 5.5 - 0.95;
    } else if (p === 'boxcar') {
      const zc = zf - 0.6 - 4.5;
      k.base.makeTranslation(0, 0, 0);
      boxcarWood(k, zc, 5);
      col(0, 2.4, zc, 1.3, 1.25, 4.9);
      zf = zc - 4.5 - 0.6;
    }
  }
  k.base.identity();
  k.build(root, mats, { shadow: { glass: false, lens: false, dark: false, fire: false } });
  // letreiros pintados (planos com transparência, levemente afastados da chapa)
  const T = decalTextures();
  for (const [name, dx, dy, dz, sw, sh, ry] of decals) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(sw, sh), w.mat('tr_dec_' + name, () => new THREE.MeshStandardMaterial({ map: T[name], alphaTest: 0.5, roughness: 0.7, metalness: 0.1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 })));
    m.position.set(dx, dy, dz);
    m.rotation.y = ry ?? (dx > 0 ? Math.PI / 2 : -Math.PI / 2);
    m.receiveShadow = true; root.add(m);
  }
  return root;
}
