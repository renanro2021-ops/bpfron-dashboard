/* drone-sim-ambiente.js — ambientação com modelos de verdade (12/10/2026)
 *
 * Segunda parte do cenário REALISTA (chamada no fim do drone-sim-realista.js).
 * Usa os modelos que o usuário trouxe e que o ferramentas/sim-pacote/
 * gerar-ambientacao.mjs pôs no pacote:
 *
 *   carros     os carros de caixa (estacionados, trânsito, viaturas da base e
 *              alvos de exercício) dão lugar a um sedã, ao sedã da viatura sem
 *              a pintura policial e a um caminhão. Estacionados = modelo leve
 *              ("_lod") desenhado por InstancedMesh; a placa Mercosul continua
 *              a mesma de cada carro (o exercício da placa não muda).
 *   casas      as casas de caixa do bairro e da vila dão lugar a quatro modelos: casa
 *              de alvenaria, casa de madeira, sobrado de tábuas e casa de telha
 *              modelada. Cada lote escolhe a sua pelo lugar (sempre a mesma), recebe
 *              a cor do lote na parede e a colisão passa a ter o tamanho do modelo.
 *   drone FPV  quadricóptero camuflado que aparece na largada da corrida FPV.
 *
 * Se o pacote guardado no aparelho for o antigo (sem estes modelos), nada aqui
 * roda e o cenário fica como era.
 */
import * as THREE from 'three';

const V3 = THREE.Vector3;
const EIXO_Y = new V3(0, 1, 0);

/* Pintura com máscara: o alfa da textura diz onde é lataria (recebe a cor do
   carro) e onde é farol, lanterna ou grade (fica como está). A cor vem da
   instância (estacionados) ou de um uniforme (carro avulso). */
function pintura(base, corHex) {
  const m = base.clone(); m.name = 'pintura';
  m.color.set(0xffffff); m.transparent = false; m.alphaTest = 0;
  if (!m.map) { if (corHex != null) m.color.setHex(corHex); return m; }
  const porInstancia = corHex == null, tinta = porInstancia ? null : { value: new THREE.Color(corHex) };
  m.onBeforeCompile = (sh) => {
    if (tinta) sh.uniforms.uTinta = tinta;
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uTinta;')
      .replace('#include <color_fragment>', porInstancia
        ? '#if defined( USE_COLOR ) && defined( USE_MAP )\n diffuseColor.rgb *= mix(vec3(1.0), vColor.rgb, sampledDiffuseColor.a);\n#endif\n diffuseColor.a = 1.0;'
        : '#ifdef USE_MAP\n diffuseColor.rgb *= mix(vec3(1.0), uTinta, sampledDiffuseColor.a);\n#endif\n diffuseColor.a = 1.0;');
  };
  m.customProgramCacheKey = () => (porInstancia ? 'pintura-inst' : 'pintura-uni');
  m.userData.tinta = tinta;
  return m;
}

export async function aplicarAmbiente(ctx, P) {
  const { cena, SOMBRAS, ANISO, M, AMB, FIXOS, VEICULOS, CID } = ctx;
  const { manifesto, modelo, avanco } = P;
  const tem = (id) => !!(manifesto.modelos && manifesto.modelos[id]);
  // carros e casas em quadras de 130 m: o que está fora da vista (e da sombra) não é desenhado
  const emQuadras = (im) => (ctx.emCelulas ? ctx.emCelulas(THREE, im, 130) : (im.frustumCulled = false, [im]));
  const info = (id) => manifesto.modelos[id];

  /* ================================================================ carros */
  if (tem('carro_sedan') && tem('carro_civil') && CID && AMB) {
    const ids = ['carro_sedan', 'carro_civil', 'viatura', 'caminhao'].filter(tem);
    const cenas = {};
    await Promise.all(ids.flatMap((id) => [id, id + '_lod']).filter(tem).map(async (id) => { cenas[id] = await modelo(id); cenas[id].updateMatrixWorld(true); }));
    for (const g of Object.values(cenas)) g.traverse((o) => { if (o.isMesh && o.material.map) o.material.map.anisotropy = ANISO; });

    // qual modelo faz o papel de cada "tipo" sorteado pelo bairro (n = número do carro)
    const NOMES = { carro_sedan: 'sedã esportivo', carro_civil: 'sedã', caminhao: 'caminhão de carroceria' };
    const papel = (tipo, n, avulso) => {
      if (tipo === 'picape' && tem('caminhao') && (avulso || n % 3 === 0)) return ['caminhao', 1];
      if (tipo === 'hatch') return ['carro_sedan', 0.93];
      if (tipo === 'suv') return ['carro_sedan', 1];
      return ['carro_civil', 1];
    };
    const medidas = (id, s) => { const i = info(id); return { L: i.L * s, W: i.W * s, H: i.H * s, pf: (i.placas ? i.placas.f : 0.45) * s, pt: (i.placas ? i.placas.t : 0.5) * s }; };

    /* ---- estacionados no bairro: um InstancedMesh por peça de cada modelo ---- */
    const carros = CID.carros, m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), cor = new THREE.Color(), corpos = [];
    carros.forEach((c, n) => {
      const [id, s] = papel(c.tipo, n, false), d = medidas(id, s);
      c.modelo = id; c.s = s; c.descricao = id === 'caminhao' ? NOMES[id] : `${NOMES[id]} ${ctx.nomeCor ? ctx.nomeCor(c.cor) : ''}`.trim();
      const ao = Math.abs(Math.sin(c.gir)) > 0.5;
      Object.assign(c.caixa, { hw: (ao ? d.L : d.W) / 2, hd: (ao ? d.W : d.L) / 2, top: d.H });
      const fx = -Math.sin(c.gir), fz = -Math.cos(c.gir), a = d.L / 2 + 0.02;
      c.placas = [{ x: c.x + fx * a, y: d.pf, z: c.z + fz * a, nx: fx, nz: fz }, { x: c.x - fx * a, y: d.pt, z: c.z - fz * a, nx: -fx, nz: -fz }];
    });
    for (const id of ids) {
      const lista = carros.filter((c) => c.modelo === id); if (!lista.length) continue;
      (cenas[id + '_lod'] || cenas[id]).traverse((o) => {
        if (!o.isMesh) return;
        const ehPintura = o.material.name === 'pintura';
        const im = new THREE.InstancedMesh(o.geometry, ehPintura ? pintura(o.material, null) : o.material, lista.length);
        lista.forEach((c, k) => {
          q.setFromAxisAngle(EIXO_Y, c.gir);
          m4.compose(new V3(c.x, 0, c.z), q, new V3(c.s, c.s, c.s)).multiply(o.matrixWorld); im.setMatrixAt(k, m4);
          if (ehPintura) im.setColorAt(k, cor.setHex(c.cor));
        });
        im.castShadow = SOMBRAS && (ehPintura || id === 'caminhao');
        const quadras = emQuadras(im);
        cena.add(...quadras); if (ehPintura) corpos.push(...quadras);
        // de longe fica só a lataria: roda, farol, grade e vidro do carro estacionado somem além de 380 m (sem zoom)
        else if (id !== 'caminhao' && ctx.comAlcance) ctx.comAlcance(quadras, 380);
      });
    }
    // placas: um retângulo por placa (2 por carro), todas no mesmo atlas do bairro
    {
      const geo = new THREE.PlaneGeometry(0.4, 0.13), n = carros.length * 2, off = new Float32Array(n * 2);
      const im = new THREE.InstancedMesh(geo, CID.matCarro.placa, n), um = new V3(1, 1, 1);
      carros.forEach((c, i) => c.placas.forEach((p, k) => {
        const j = i * 2 + k;
        q.setFromAxisAngle(EIXO_Y, Math.atan2(p.nx, p.nz)); m4.compose(new V3(p.x, p.y, p.z), q, um); im.setMatrixAt(j, m4);
        off[j * 2] = (c.celula % 8) * 0.125; off[j * 2 + 1] = 1 - (Math.floor(c.celula / 8) + 1) * 86 / 2048;
      }));
      geo.setAttribute('aPlaca', new THREE.InstancedBufferAttribute(off, 2));
      const quadras = emQuadras(im); cena.add(...quadras);
      if (ctx.comAlcance) ctx.comAlcance(quadras, 170); // placa de 40 cm: de longe só com zoom (e aí o alcance cresce junto)
    }
    for (const antigo of CID.instancias) antigo.visible = false; // os carros de caixa saem de cena
    CID.corpos = corpos;

    /* ---- carro avulso (trânsito, alvo de exercício, viaturas): modelo completo ---- */
    const montar = (g, id, s, corHex, placa) => {
      const copia = cenas[id].clone(true), d = medidas(id, s);
      copia.scale.setScalar(s);
      copia.traverse((o) => {
        if (!o.isMesh) return;
        if (o.material.name === 'pintura') o.material = pintura(o.material, corHex);
        o.castShadow = SOMBRAS;
      });
      g.add(copia);
      if (placa) {
        const cv = document.createElement('canvas'); cv.width = 256; cv.height = 86;
        ctx.desenharPlaca(cv.getContext('2d'), 2, 2, 252, 82, placa);
        const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = ANISO;
        const mat = CID.matCarro.placaAvulsa(tex), geo = new THREE.PlaneGeometry(0.4, 0.13);
        const f = new THREE.Mesh(geo, mat); f.rotation.y = Math.PI; f.position.set(0, d.pf, -d.L / 2 - 0.02);
        const t = new THREE.Mesh(geo, mat); t.position.set(0, d.pt, d.L / 2 + 0.02);
        g.add(f, t);
      }
      return d;
    };
    CID.carroAvulso = (tipo, corHex, placa) => {
      const g = new THREE.Group(), [id, s] = papel(tipo, 0, true), d = montar(g, id, s, corHex, placa);
      g.userData = { tipo, placa, cor: corHex, L: d.L, W: d.W, H: d.H };
      return g;
    };
    // quem já estava rodando na rodovia troca de carroceria (a rota e a colisão continuam as mesmas)
    for (const v of VEICULOS) {
      const u = v.g.userData, novo = CID.carroAvulso(u.tipo, u.cor != null ? u.cor : 0xb9bcc0, u.placa);
      v.g.clear(); for (const filho of [...novo.children]) v.g.add(filho);
      Object.assign(u, novo.userData); v.atualizar(0);
    }
    // viaturas da base e carros soltos pelo mapa
    AMB.fabrica = {
      fixo(g, tipo, corHex) {
        if (tipo === 'viatura' && tem('viatura')) return montar(g, 'viatura', 1, null, 'BPF0R26');
        return montar(g, tipo === 'picape' && tem('caminhao') ? 'caminhao' : 'carro_sedan', 1, corHex, null);
      },
    };
    for (const f of FIXOS) {
      f.g.clear();
      const d = AMB.fabrica.fixo(f.g, f.tipo, f.cor);
      if (f.caixa) Object.assign(f.caixa, { hw: (f.girado ? d.L : d.W) / 2, hd: (f.girado ? d.W : d.L) / 2, top: d.H });
    }
    avanco('carros');
  }

  /* ================================================================ casas
     As casas de caixa do bairro e da vila dão lugar aos modelos marcados como "casa" no pacote: a casa de
     alvenaria e a de madeira (12/10/2026) e, desde 13/10/2026, o sobrado de tábuas ("Farm house", Poly by
     Google) e a casa de telha modelada ("House", Quaternius). O kit de casinhas coloridas saiu a pedido do
     usuário: telhado granulado e serrilhado, desenho de brinquedo.
     Cada lote escolhe a sua casa pelo lugar (sempre a mesma), a casa encolhe para caber dentro do muro e a
     colisão passa a ter o tamanho do modelo. "pintar" (no pacote) diz o que recebe a cor do lote: "*" = a
     casa inteira, de leve (modelo de textura única); um nome = só o material da parede. */
  const idsCasa = Object.keys(manifesto.modelos).filter((id) => info(id).casa || id === 'casa_velha' || id === 'casa_madeira');
  if (idsCasa.length && CID && CID.casas) {
    const modelos = {};
    for (const id of idsCasa) { modelos[id] = await modelo(id); modelos[id].updateMatrixWorld(true); modelos[id].traverse((o) => { if (o.isMesh && o.material.map) o.material.map.anisotropy = ANISO; }); }

    // sorteio que depende só do lugar: a mesma casa aparece sempre no mesmo lote
    const sorte = (x, z, k) => { const s = Math.sin(x * 12.9898 + z * 78.233 + k * 37.719) * 43758.5453; return s - Math.floor(s); };
    const TONS_TELHA = [[1, 1, 1], [0.84, 0.8, 0.78], [1.14, 1.02, 0.96], [0.7, 0.68, 0.7]];
    const lotes = CID.casas.map((c) => ({ ...c, antigas: [c.malha], murado: true })).concat((M.casasVila || []).map((c) => ({ ...c, antigas: c.malhas, murado: false })));
    const grupos = new Map();
    for (const c of lotes) {
      const id = idsCasa[Math.min(idsCasa.length - 1, Math.floor(sorte(c.x, c.z, 1) * idsCasa.length))], D0 = info(id);
      const rot = c.frente != null ? (c.frente > 0 ? 0 : Math.PI) : [0, Math.PI / 2, Math.PI, -Math.PI / 2][Math.floor(sorte(c.x, c.z, 3) * 4)];
      const deLado = Math.abs(Math.sin(rot)) > 0.5, Wm = deLado ? D0.D : D0.W, Dm = deLado ? D0.W : D0.D;
      // cabe no lote: dentro dos muros no bairro; na vila (sem muro) sobra mais espaço
      const folgaW = c.murado ? 0.6 : 2.5, folgaD = c.murado ? 0.8 : 2.5;
      const s = Math.min(1, (c.w + folgaW) / Wm, (c.d + folgaD) / Dm);
      Object.assign(c.caixa, { hw: Wm * s / 2, hd: Dm * s / 2, top: D0.H * s });
      for (const a of c.antigas) a.visible = false;
      if (!grupos.has(id)) grupos.set(id, []);
      grupos.get(id).push({ c, rot, s });
    }
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), cor = new THREE.Color(), branco = new THREE.Color(0xffffff), novas = [];
    for (const [id, lista] of grupos) {
      const pintar = info(id).pintar;
      modelos[id].traverse((o) => {
        if (!o.isMesh) return;
        const parede = pintar === '*' || (!!pintar && o.material.name === pintar), telhado = o.material.name === 'telhado';
        const im = new THREE.InstancedMesh(o.geometry, o.material, lista.length);
        lista.forEach(({ c, rot, s }, k) => {
          q.setFromAxisAngle(EIXO_Y, rot);
          m4.compose(new V3(c.x, 0, c.z), q, new V3(s, s, s)).multiply(o.matrixWorld); im.setMatrixAt(k, m4);
          if (parede) im.setColorAt(k, cor.setHex(c.cor != null ? c.cor : 0xf3e3c3).lerp(branco, pintar === '*' ? 0.45 : 0.12));
          else if (telhado) im.setColorAt(k, cor.setRGB(...TONS_TELHA[Math.floor(sorte(c.x, c.z, 4) * TONS_TELHA.length)]));
        });
        im.castShadow = SOMBRAS; im.receiveShadow = SOMBRAS;
        const quadras = emQuadras(im);
        cena.add(...quadras); novas.push(...quadras);
      });
    }
    // os telhados antigos do bairro (juntados por material) saem de cena; quem encobre foto agora são as casas novas
    for (const t of CID.malhas.telhados) if (t.userData.telha) t.visible = false;
    const some = new Set(lotes.flatMap((c) => c.antigas));
    CID.malhas.paredes = CID.malhas.paredes.filter((m) => !some.has(m)).concat(novas);
    CID.malhas.telhados = CID.malhas.telhados.filter((t) => !t.userData.telha);
    CID.casasModelo = { total: lotes.length, modelos: grupos.size };
    avanco('casas');
  }

  /* ================================================================ drone da corrida FPV */
  if (tem('drone_fpv') && AMB) {
    const m = await modelo('drone_fpv'), g = new THREE.Group();
    m.scale.setScalar(1.3); // ~34 cm de ponta a ponta: do tamanho do Mavic na tela
    m.traverse((o) => { if (o.isMesh) { o.castShadow = SOMBRAS; if (o.material.map) o.material.map.anisotropy = ANISO; } });
    g.add(m); g.rotation.order = 'YXZ'; g.visible = false;
    cena.add(g); AMB.droneFPV = g;
    avanco('drone FPV');
  }
}
