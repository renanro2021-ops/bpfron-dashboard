// Núcleo do simulador DJI: loop, câmeras com gimbal, telas de voo (DJI Goggles e DJI Fly),
// foto/vídeo, QuickShots, sinal de transmissão, menus e estados do jogo.
import * as THREE from 'three';
import { DroneSim, QUADS, rateDegPerSec } from './physics.js';
import { Input, Calibrator, KEY_LABELS } from './input.js';
import { Gimbal } from './gimbal.js';
import { World, MAPS } from './world.js';
import { makeDroneModel, animateProps, PostFX, Showcase, setFpvView, fitModel } from './visuals.js';
import { Audio } from './audio.js';
import { Album } from './album.js';
import { PadMenu } from './padmenu.js';
import { FreestyleMode, RaceMode, CollectMode, ChaseMode, TrainingMode, BuilderMode, Store, fmtTime, customTracks, DIFFICULTIES, LESSON_LIST } from './modes.js';

const DEFAULTS = {
  quad: 'avata2', flightMode: 'N',
  rateType: 'betaflight', ratePreset: 'medium', rcRate: 1.0, superRate: 0.7, expo: 0.0, yawRcRate: 1.0, yawSuperRate: 0.7, yawExpo: 0.0,
  obstacle: true, fpvBrake: true, maxAlt: 120, rthAlt: 30, batteryDrain: true, lowBatLand: true, damage: false, wind: 0,
  gimbalMode: 'auto', fovAdj: 0, distortion: true, mTilt: 30, grid: 'off', gimbalSpeed: 5, signalFx: true,
  cinematic: false, stickHud: true, lineAssist: true, ghost: true,
  volume: 70, quality: 'high', gfx: 'auto', upscale: 'off', aa: 'taa', shadows: true, bloom: true, grass: true,
  profile: 'kb', throttleMode: 'spring', thrSens: 4, rotSens: 4, mouseSens: 5, stickMode: 2, padThrottle: 'auto', padDeadzone: 12,
};
const SETTINGS_KEY = 'djisim.settings.v1';
// ---------- tela de carregamento (12/11/2026: o jogo "travava" sem aviso ao abrir e ao entrar no voo) ----------
const LD_DICAS = [
  'No controle: X decola e pousa, B freia e Y troca o modo de voo.',
  'No teclado: Espaço liga os motores, W/S sobem e descem, as setas movem o drone.',
  'Nos menus, o direcional ou o stick anda entre os botões: A escolhe, B volta.',
  'H traz o drone de volta para casa sozinho (RTH).',
  'F tira foto e V grava vídeo; tudo fica no Álbum.',
  'R reinicia o voo e ESC pausa.',
  'Na Corrida os portões vão em ordem; nas Missões, em qualquer ordem.',
  'Qualidade gráfica Automática: começa no máximo e baixa sozinha se o computador não aguentar.',
];
const LD = {
  el: () => document.getElementById('loading'),
  set(txt, pct) {
    const t = document.getElementById('ldTxt'); if (t && txt) t.textContent = txt;
    const b = document.querySelector('#loading .ld-bar i'); if (b && pct != null) b.style.width = Math.max(4, Math.min(100, pct)) + '%';
  },
  dica() { const d = document.getElementById('ldDica'); if (d) d.textContent = '💡 ' + LD_DICAS[Math.floor(Math.random() * LD_DICAS.length)]; },
  show(txt, pct) { this.set(txt, pct); this.el()?.classList.remove('hidden'); },
  hide() { this.el()?.classList.add('hidden'); },
};
// espera a tela ser pintada (sem isso o texto novo só aparece depois do trabalho pesado)
const nextPaint = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
const THUMB_KEY = 'djisim.thumbs', THUMB_VER = '2026-11-12a'; // trocar a versão quando mudar mapa ou drone

const AUTO_GFX_KEY = 'djisim.autogfx';
const GFX_ORDER = ['ultra', 'high', 'medium', 'low'];
const GFX_NAMES = { ultra: 'Ultra', high: 'Alta', medium: 'Média', low: 'Baixa' };
const PHYS_HZ = 500;
const RATE_PRESETS = { low: [0.8, 0.5, 0.2], medium: [1.0, 0.7, 0.0], high: [1.2, 0.76, 0.0] };
export const MODE_NAMES = { C: 'Cine', N: 'Normal', S: 'Esporte', M: 'Manual' };
const DEG = Math.PI / 180;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const wrap = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const mmss = (t) => `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

// ---------- configurações (seções no estilo do DJI Fly) ----------
const ON = [[true, 'Ligado'], [false, 'Desligado']];
const TABS = [['safety', 'SEGURANÇA'], ['control', 'CONTROLE'], ['camera', 'CÂMERA'], ['display', 'TRANSMISSÃO'], ['audio', 'SOM'], ['rates', 'MODO M'], ['general', 'GERAL']];
const SET = {
  safety: [
    { k: 'flightMode', label: 'Modo de voo', dyn: true, help: 'C (Cine): lento e suave para filmar. N (Normal): o GPS segura o drone parado quando você solta os sticks. S (Esporte): muito mais rápido e sem desvio de obstáculos. M (Manual): só nos drones FPV, sem assistência nenhuma.' },
    { k: 'obstacle', label: 'Desvio de obstáculos', opts: [[true, 'Frear'], [false, 'Desligado']], help: 'Nos drones de câmera, freia sozinho antes de bater em paredes, árvores e prédios (nos modos C e N e na volta para casa).' },
    { k: 'fpvBrake', label: 'Freio ao soltar o stick (FPV)', opts: [[true, 'Ligado (como na DJI)'], [false, 'Desligado (segue no embalo)']], help: 'Avata 2 e DJI FPV nos modos N e S: ao soltar o stick o drone freia e fica parado no lugar, como os DJI de verdade (no S a frenagem é mais longa). Desligado: o drone continua no embalo, como no simulador original. O modo M nunca freia.' },
    { k: 'maxAlt', label: 'Altitude máxima', type: 'slider', min: 20, max: 500, step: 10, unit: ' m', help: 'O drone não sobe acima desta altura em relação ao ponto de decolagem. O padrão da DJI é 120 m.' },
    { k: 'rthAlt', label: 'Altitude de retorno (RTH)', type: 'slider', min: 15, max: 200, step: 5, unit: ' m', help: 'Ao apertar H o drone sobe até esta altura, volta para o ponto inicial e pousa.' },
    { k: 'batteryDrain', label: 'Consumo de bateria', opts: ON, help: 'A bateria descarrega de acordo com o tempo de voo de cada drone. Desligado = bateria infinita.' },
    { k: 'lowBatLand', label: 'Pouso com bateria crítica', opts: ON, help: 'Com 10% de bateria o drone começa a pousar sozinho, como nos drones reais.' },
    { k: 'damage', label: 'Dano em batidas', opts: ON, help: 'Batidas fortes quebram hélices e podem derrubar o drone.' },
    { k: 'wind', label: 'Vento', type: 'slider', min: 0, max: 1.5, step: 0.1, help: 'Rajadas de vento. Nos modos C, N e S o GPS compensa sozinho.' },
  ],
  control: [
    { k: 'profile', label: 'Perfil de entrada', type: 'buttons', opts: [['kb', 'Teclado'], ['kbm', 'Tecl. + mouse'], ['mkb', 'Mouse + tecl.'], ['motion', 'Movimento']], help: 'Teclado: tudo no teclado. Teclado + mouse: mouse move o drone para frente e para os lados. Mouse + teclado: mouse sobe/desce e gira. Movimento: o mouse funciona como o Motion Controller da DJI (aponte e segure o botão esquerdo para acelerar). Com mouse, clique na tela para capturá-lo.' },
    { k: 'gimbalSpeed', label: 'Velocidade do gimbal', type: 'slider', min: 1, max: 10, step: 1, help: 'Velocidade com que Q/E, a rodinha do mouse ou os gatilhos do controle inclinam a câmera.' },
    { k: 'throttleMode', label: 'Acelerador no modo M (teclado)', opts: [['spring', 'Mola (volta a 0)'], ['hold', 'Fica na posição']], help: 'Só vale no modo M. Mola: segurar W acelera e soltar volta a zero. Fica na posição: W/S sobem e descem e o valor se mantém.' },
    { k: 'thrSens', label: 'Sensibilidade vertical', type: 'slider', min: 1, max: 10, step: 1, help: 'Velocidade com que W/S respondem.' },
    { k: 'rotSens', label: 'Sensibilidade dos movimentos', type: 'slider', min: 1, max: 10, step: 1, help: 'Velocidade com que as setas e A/D respondem.' },
    { k: 'mouseSens', label: 'Sensibilidade do mouse', type: 'slider', min: 1, max: 10, step: 1, help: 'Quanto o mouse precisa andar para mover o drone.' },
    { k: 'stickMode', label: 'Modo do stick', opts: [[2, 'Mode 2'], [1, 'Mode 1']], help: 'Mode 2 (padrão DJI): subir/descer e girar no stick esquerdo. Mode 1: subir/descer no stick direito.' },
    { k: 'padThrottle', label: 'Stick vertical do controle', opts: [['auto', 'Automático'], ['gamepad', 'Centrado'], ['radio', 'Curso total']], help: 'Centrado: stick no meio = mantém altitude (controles com mola, como o RC da DJI). Curso total: para rádios sem mola no acelerador.' },
    { k: 'padDeadzone', label: 'Zona morta dos sticks', type: 'slider', min: 0, max: 30, step: 1, unit: '%', help: 'Quanto o stick precisa sair do centro para o drone obedecer. Se o drone anda ou gira sozinho com os sticks soltos, aumente. Controles de videogame: 10–15%. Rádios: 2–5%.' },
    { type: 'action', label: 'Calibração do controle', btn: 'Configurar', act: 'calib', help: 'Mapeia os eixos e o botão do seu rádio ou controle.' },
    { type: 'action', label: 'Mapeamento padrão', btn: 'Restaurar', act: 'resetControls', help: 'Apaga a calibração e volta ao mapeamento padrão.' },
    { type: 'keys' },
  ],
  camera: [
    { k: 'gimbalMode', label: 'Modo do gimbal', opts: [['auto', 'Automático'], ['follow', 'Seguir (horizonte reto)'], ['fpv', 'FPV (inclina junto)'], ['body', 'Presa ao corpo (FPV original)']], help: 'O gimbal é simulado como peça física: motores com resposta própria e batentes. Avata 2 e DJI FPV têm gimbal de 1 eixo (só inclinação; a rolagem vem do corpo). Mini, Air e Mavic têm 3 eixos. Seguir: horizonte reto. FPV: a rolagem acompanha o drone. Presa ao corpo: sem gimbal, como no FPV original.' },
    { k: 'fovAdj', label: 'Ajuste do campo de visão', type: 'slider', min: -20, max: 20, step: 1, unit: '°', help: 'Aumenta ou diminui o campo de visão padrão da câmera de cada drone.' },
    { k: 'distortion', label: 'Distorção grande-angular', opts: ON, help: 'Curvatura das lentes ultra grande-angulares dos drones FPV.' },
    { k: 'mTilt', label: 'Inclinação da câmera FPV', type: 'slider', min: 0, max: 50, step: 1, unit: '°', help: 'Nos drones FPV a câmera fica presa ao corpo, inclinada para cima (como no FPV original). Pilotos rápidos usam 20–40°.' },
    { k: 'grid', label: 'Linhas de grade', opts: [['off', 'Desligadas'], ['thirds', 'Regra dos terços'], ['center', 'Centro']], help: 'Linhas de enquadramento na tela, como no DJI Fly.' },
  ],
  display: [
    { k: 'quality', label: 'Resolução', opts: [['high', 'Alta'], ['medium', 'Média'], ['low', 'Baixa']], help: 'Resolução da imagem. Use Média ou Baixa se estiver lento.' },
    { k: 'gfx', label: 'Qualidade gráfica', opts: [['auto', 'Automática'], ['ultra', 'Ultra'], ['high', 'Alta'], ['medium', 'Média'], ['low', 'Baixa']], help: 'Automática: começa no Ultra e, se o voo ficar travando, desce sozinha até ficar liso (a escolha fica guardada neste computador). Ultra: luz rebatida entre as superfícies (iluminação global) e reflexos. Alta: sombras de contato nos cantos e reflexos. Média: só sombras de contato. Baixa: sem efeitos extras, a mais leve.' },
    { k: 'upscale', label: 'Aumento de resolução (TAAU)', opts: [['off', 'Desligado'], ['quality', 'Qualidade'], ['balanced', 'Equilibrado'], ['performance', 'Desempenho']], help: 'Funciona como o DLSS: desenha a imagem menor e reconstrói os detalhes usando os quadros anteriores. Ganha bastante FPS perdendo pouca nitidez. Qualidade = 77% da resolução, Equilibrado = 67%, Desempenho = 50%.' },
    { k: 'aa', label: 'Anti-aliasing', opts: [['taa', 'Temporal (TAA)'], ['smaa', 'SMAA'], ['off', 'Desligado']], help: 'Suaviza os serrilhados. Nas qualidades Ultra, Alta e Média o TAA fica sempre ligado, porque ele também limpa o ruído dos efeitos.' },
    { k: 'shadows', label: 'Sombras', opts: ON, help: 'Sombras do sol e dos refletores.' },
    { k: 'bloom', label: 'Brilho (bloom)', opts: ON, help: 'Brilho em volta das luzes fortes.' },
    { k: 'grass', label: 'Mato alto', opts: ON, help: 'Vegetação alta. Vale a partir do próximo carregamento de mapa.' },
    { k: 'signalFx', label: 'Falhas de sinal', opts: ON, help: 'Atrás de prédios e morros o sinal de vídeo enfraquece e aparecem blocos na imagem, como na transmissão digital real.' },
  ],
  audio: [
    { k: 'volume', label: 'Volume geral', type: 'slider', min: 0, max: 100, step: 5, help: 'Volume dos motores, efeitos e avisos.' },
  ],
  rates: [
    { k: 'ratePreset', label: 'Perfis predefinidos', type: 'buttons', opts: [['low', 'Suave'], ['medium', 'Médio'], ['high', 'Rápido']], help: 'Velocidade de giro no modo M. Suave: 320°/s. Médio: 667°/s. Rápido: 960°/s.' },
    { k: 'rateType', label: 'Tipo de curva', opts: [['betaflight', 'Betaflight'], ['kiss', 'KISS'], ['raceflight', 'RaceFlight']], help: 'Fórmula usada para converter o stick em velocidade de giro.' },
    { k: 'rcRate', label: 'Pitch/Roll (RC Rate)', type: 'slider', min: 0.3, max: 2.5, step: 0.01, help: 'Sensibilidade no centro do stick.' },
    { k: 'superRate', label: 'Pitch/Roll (Super Rate)', type: 'slider', min: 0, max: 0.95, step: 0.01, help: 'Aumenta o giro nos extremos do stick.' },
    { k: 'expo', label: 'Pitch/Roll (Expo)', type: 'slider', min: 0, max: 0.9, step: 0.01, help: 'Suaviza o centro do stick.' },
    { k: 'yawRcRate', label: 'Yaw (RC Rate)', type: 'slider', min: 0.3, max: 2.5, step: 0.01, help: 'Sensibilidade do giro no centro.' },
    { k: 'yawSuperRate', label: 'Yaw (Super Rate)', type: 'slider', min: 0, max: 0.95, step: 0.01, help: 'Giro nos extremos.' },
    { k: 'yawExpo', label: 'Yaw (Expo)', type: 'slider', min: 0, max: 0.9, step: 0.01, help: 'Suaviza o centro do giro.' },
  ],
  general: [
    { k: 'cinematic', label: 'Ocultar informações da tela', opts: ON, help: 'Esconde toda a interface para gravar vídeos limpos.' },
    { k: 'stickHud', label: 'Mostrar sticks', opts: ON, help: 'Mostra os dois sticks na tela: o anel é onde o stick físico está, a bolinha é o comando que chega no drone, e as barras mostram quanto (%) você está apertando.' },
    { k: 'lineAssist', label: 'Marcador do objetivo', opts: ON, help: 'Mostra um marcador apontando para o próximo portão ou objetivo.' },
    { k: 'ghost', label: 'Fantasma da melhor volta', opts: ON, help: 'Na corrida, mostra um drone fantasma repetindo sua melhor volta.' },
    { type: 'action', label: 'Restaurar padrões', btn: 'Restaurar', act: 'resetSettings', help: 'Volta todas as configurações para os valores padrão.' },
  ],
};
const ALL_DEFS = Object.values(SET).flat().filter((d) => d.k);
const DEF = Object.fromEntries(ALL_DEFS.map((d) => [d.k, d]));
const PAUSE_TILES = [['flightMode', 't-mode', 'MODO DE VOO'], ['obstacle', 't-obs', 'DESVIO DE OBSTÁCULOS'], ['gimbalMode', 't-gimbal', 'MODO DO GIMBAL'], ['fovAdj', 't-fov', 'CAMPO DE VISÃO'],
  ['grid', 't-grid', 'GRADE'], ['batteryDrain', 't-bat', 'CONSUMO DE BATERIA'], ['damage', 't-dmg', 'DANO'], ['wind', 't-wind', 'VENTO']];

function homePadTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#2b2e33'; g.beginPath(); g.arc(128, 128, 126, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#ffffff'; g.lineWidth = 10; g.beginPath(); g.arc(128, 128, 104, 0, Math.PI * 2); g.stroke();
  g.fillStyle = '#ffb000'; g.font = '800 130px "Open Sans", Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('H', 128, 136);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

class Game {
  constructor(renderer) {
    this.settings = Object.assign({}, DEFAULTS, Store.get(SETTINGS_KEY, {}));
    if (typeof this.settings.aa === 'boolean') this.settings.aa = this.settings.aa ? 'taa' : 'off';
    if (!QUADS[this.settings.quad]) this.settings.quad = DEFAULTS.quad;
    // 26/10/2026: o upscale (TAAU) deixava a imagem serrilhada em movimento; com as árvores novas o Ultra roda
    // sem ele, então volta para "Desligado" uma vez (o usuário pode religar nas configurações)
    if (!this.settings.mig261026) { this.settings.upscale = 'off'; this.settings.mig261026 = true; Store.set(SETTINGS_KEY, this.settings); }
    // 12/11/2026: no site a qualidade nascia em "Alta"; agora o padrão é "Automática" (Ultra que desce sozinha se travar)
    if (!this.settings.mig121126) { if (this.settings.gfx === 'high') this.settings.gfx = 'auto'; this.settings.mig121126 = true; Store.set(SETTINGS_KEY, this.settings); }
    this.autoGfx = Store.get(AUTO_GFX_KEY, null) || (renderer.backend.isWebGPUBackend ? 'ultra' : 'medium');
    this.perf = { t: 0, n: 0, wait: 3 };
    this.canvas = $('#view');
    this.renderer = renderer;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(90, 1, 0.01, 4000);
    this.post = new PostFX(this.renderer, this.scene, this.camera);
    this.world = new World(this.scene, this.renderer);
    this.input = new Input();
    this.audio = new Audio();
    this.album = new Album();
    this.sim = new DroneSim(this.settings.quad);
    this.osd = $('#osd'); this.g2 = this.osd.getContext('2d');
    this.camMode = 'fpv';
    this.state = 'menu';
    this.mode = null;
    this.pending = {};
    this.thumbs = {};
    this.ctls = [];
    this.acc = 0; this.last = performance.now(); this.flash = 0; this.shake = 0;
    this.chase = new THREE.Vector3();
    this.gimbal = 0; this.gimbalShowT = 0; this.camYaw = 0; this.zoomIdx = 0;
    this.capMode = 'photo'; this.rec = null; this.qs = null;
    this.signal = 1; this.sigT = 0; this.sats = 18 + Math.floor(Math.random() * 8);
    this.warnings = {}; this.batWarned = 0;
    this.homePad = new THREE.Mesh(new THREE.CircleGeometry(0.65, 48), new THREE.MeshStandardMaterial({ map: homePadTexture(), roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -24 }));
    this.homePad.rotation.x = -Math.PI / 2; this.homePad.receiveShadow = true;
    this.scene.add(this.homePad);
    this.applySettings();
    this.loadMap('factory');
    this.showcase = new Showcase($('#showcase'));
    this.showcase.setQuad(QUADS[this.settings.quad]);
    this.bindUI();
    this.show('main');
    this.resize();
    addEventListener('resize', () => this.resize());
    requestAnimationFrame((t) => this.frame(t));
  }

  // abertura da página: o loop já desenha o menu por baixo da tela de carregamento; ela só sai com tudo pronto
  async boot() {
    LD.set('Preparando os gráficos…', 45);
    await this.warmFrames((f) => LD.set(null, 45 + f * 15));
    // trava de segurança: se as fotos dos mapas falharem no meio, o menu abre assim mesmo (só fica sem as fotos)
    const limite = new Promise((r) => setTimeout(r, 40000));
    await Promise.race([this.makeThumbs((i, n) => LD.set('Preparando as fotos dos mapas…', 60 + (38 * i) / n)).catch(() => {}), limite]);
    LD.set('Pronto!', 100);
    await nextPaint();
    LD.hide();
  }

  // espera os primeiros quadros (a placa de vídeo monta os shaders neles e o jogo engasga) até o ritmo firmar
  warmFrames(onProg, max = 9000) {
    return new Promise((res) => {
      const t0 = performance.now(); let last = t0, bons = 0, n = 0;
      const tick = (t) => {
        const d = t - last; last = t; n++;
        bons = d < 120 ? bons + 1 : 0;
        if (onProg) onProg(Math.min(1, n / 10));
        if ((bons >= 4 && n >= 5) || t - t0 > max) return res();
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }

  get quad() { return QUADS[this.settings.quad]; }

  // ---------- configuração ----------
  applySettings() {
    const s = this.settings, q = QUADS[s.quad];
    if (!q.modes[s.flightMode]) s.flightMode = 'N';
    Object.assign(this.sim.settings, {
      flightMode: s.flightMode, rateType: s.rateType, allowDamage: s.damage,
      infiniteBattery: !s.batteryDrain, wind: s.wind, obstacle: s.obstacle, fpvBrake: s.fpvBrake, maxAlt: s.maxAlt, rthAlt: s.rthAlt,
      rates: { rp: { rcRate: s.rcRate, superRate: s.superRate, expo: s.expo }, y: { rcRate: s.yawRcRate, superRate: s.yawSuperRate, expo: s.yawExpo } },
    });
    Object.assign(this.input.opts, { profile: s.profile, throttleMode: s.throttleMode, thrSens: s.thrSens, rotSens: s.rotSens, mouseSens: s.mouseSens, stickMode: s.stickMode, padThrottle: s.padThrottle, padDeadzone: s.padDeadzone });
    this.input.setStickMode(s.stickMode);
    this.audio.setVolume(s.volume / 100);
    this.renderer.setPixelRatio(s.quality === 'high' ? Math.min(devicePixelRatio, 2) : s.quality === 'medium' ? 1 : 0.7);
    this.post.configure({ preset: s.gfx === 'auto' ? this.autoGfx : s.gfx, aa: s.aa, upscale: s.upscale });
    if (this.world.sun) this.world.sun.castShadow = s.shadows;
    this.resize();
  }
  setSetting(k, v) {
    this.settings[k] = v;
    if (k === 'ratePreset') { const p = RATE_PRESETS[v]; Object.assign(this.settings, { rcRate: p[0], superRate: p[1], expo: p[2], yawRcRate: p[0], yawSuperRate: p[1], yawExpo: p[2] }); }
    if (['rcRate', 'superRate', 'expo'].includes(k)) this.settings.ratePreset = 'custom';
    if (k === 'quad') this.changeQuad(v);
    this.saveSettings(); this.applySettings();
    if (this.mode instanceof TrainingMode) this.sim.settings.flightMode = this.mode.lesson.mode;
    if ((k === 'profile' || k === 'quad') && this.activeScreen === 'settings') { this.fillSettings(); return; }
    if (k === 'quad' && this.activeScreen === 'pause') this.fillPause();
    this.ctls.forEach((c) => c.update());
    this.drawRates();
  }
  changeQuad(v) {
    this.sim.setQuad(v); this.loadDrone(); this.showcase.setQuad(QUADS[v]); this.refreshMain();
    this.zoomIdx = 0; this.buildZoomChips(); this.updateFov();
    if (this.state !== 'menu') { this.sim.recharge(); this.sim.repair(); }
    this.updateFlyUI();
  }
  saveSettings() { Store.set(SETTINGS_KEY, this.settings); }

  resize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setSize(w, h, false);
    this.post.setSize(w, h, this.renderer.getPixelRatio());
    this.camera.aspect = w / h; this.updateFov();
    const dpr = Math.min(devicePixelRatio, 2);
    this.osd.width = w * dpr; this.osd.height = h * dpr; this.osdScale = dpr;
  }
  updateFov() {
    const q = this.quad;
    let fov = 55;
    if (this.state === 'menu') fov = 50;
    else if (this.camMode === 'fpv') {
      const base = clamp(q.camera.fov + this.settings.fovAdj, 25, 130);
      const z = q.camera.zoom[this.zoomIdx] || 1;
      fov = (2 * Math.atan(Math.tan((base * DEG) / 2) / z)) / DEG;
    }
    this.camera.fov = fov;
    this.camera.near = this.camMode === 'fpv' && this.state !== 'menu' ? 0.03 : 0.1;
    this.camera.updateProjectionMatrix();
  }

  // ---------- mapa / drone ----------
  loadMap(id) {
    this.mapDef = this.world.build(id, { noGrass: !this.settings.grass });
    this.mapId = id;
    if (this.world.sun) this.world.sun.castShadow = this.settings.shadows;
    this.renderer.toneMappingExposure = this.world.look.exposure;
    this.post.bloom.strength = this.world.look.bloom;
    this.loadDrone();
  }
  loadDrone() {
    if (this.droneModel) this.scene.remove(this.droneModel);
    const q = this.quad;
    this.droneModel = makeDroneModel(q);
    this.droneModel.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(this.droneModel);
    this.visOff = q.radius + box.min.y; // encosta os pés do modelo no chão
    this.scene.add(this.droneModel);
  }
  spawnAtStart(track) {
    let pos, yaw;
    if (track && track.gates.length) {
      const g = track.gates[0];
      const n = [-Math.sin(g.yaw || 0), -Math.cos(g.yaw || 0)];
      pos = [g.x - n[0] * 9, 0, g.z - n[1] * 9]; yaw = g.yaw || 0;
    } else { pos = this.mapDef.spawn.pos.slice(); yaw = this.mapDef.spawn.yaw; }
    const gy = this.world.groundHeight(pos[0], pos[2]);
    pos[1] = gy + this.quad.radius;
    this.sim.reset(pos, yaw);
    this.homePad.position.set(pos[0], gy + 0.03, pos[2]);
    this.prevPos = pos.slice();
    this.chase.set(pos[0] + Math.sin(yaw) * 2.2, pos[1] + 0.8, pos[2] + Math.cos(yaw) * 2.2);
    this.input.kb.throttle = 0; this.input.kb.lift = 0;
    this.gimbal = this.quad.kind === 'cam' ? -8 : 0;
    this.camYaw = yaw; this.qs = null; this.batWarned = 0;
    if (this.gim) this.gim.ready = false;
  }
  // liga os motores no chão (sem decolar) e marca o ponto inicial
  startMotors(quiet) {
    const s = this.sim;
    const err = s.tryArm(this.input.state.throttle);
    if (err) { if (!quiet) this.toast(err); return false; }
    if (s.onGround) s.home = s.pos.slice();
    this.audio.beep(660, 0.1, 'sine', 0.12);
    return true;
  }
  autoArmNow() { if (!this.sim.armed && !this.sim.crashed && !this.sim.batteryDead) this.startMotors(true); }
  get assistedMode() { return this.sim.settings.flightMode !== 'M'; }

  async startGame() {
    if (this.loadingGame) return;
    this.loadingGame = true;
    const p = this.pending;
    this.audio.init();
    LD.dica();
    LD.show('Montando o mapa…', 10);
    this.show(null);
    await nextPaint();
    try {
      if (this.mode) this.mode.dispose();
      this.mode = null;
      this.warming = true; // até os gráficos firmarem: sem física, sem relógio da missão e sem botões
      this.sim.setQuad(this.settings.quad);
      this.applySettings();
      this.state = 'playing';
      this.camMode = 'fpv';
      this.zoomIdx = 0;
      this.loadMap(p.map || 'factory');
      LD.set('Posicionando o drone…', 40);
      const key = p.mode === 'challenge' ? p.type : p.mode;
      const M = { freestyle: FreestyleMode, race: RaceMode, collect: CollectMode, chase: ChaseMode, school: TrainingMode, builder: BuilderMode }[key];
      this.mode = new M(this, p);
      this.mode.start();
      this.updateFov();
      this.buildZoomChips();
      LD.set('Preparando os gráficos…', 55);
      await this.warmFrames((f) => LD.set(null, 55 + f * 43));
    } finally {
      this.warming = false;
      this.loadingGame = false;
    }
    this.perf.wait = 3; this.perf.t = 0; this.perf.n = 0; // o mapa recém-carregado ainda compila sombras e texturas
    this.last = performance.now(); this.acc = 0;
    LD.set('Pronto!', 100);
    LD.hide();
    this.updateFlyUI();
  }
  async quitToMenu() {
    if (this.rec) this.rec.mr.stop();
    if (this.mode) { this.mode.dispose(); this.mode = null; }
    if (document.pointerLockElement) document.exitPointerLock();
    this.state = 'menu';
    this.sim.disarm(); this.sim.frozen = false;
    // o menu fica na Fábrica: vindo de outro mapa, remontar também engasga, então mostra o carregamento
    const troca = this.mapId !== 'factory';
    if (troca) { LD.dica(); LD.show('Voltando ao menu…', 20); this.show(null); await nextPaint(); this.loadMap('factory'); }
    this.applySettings();
    this.updateFov();
    this.refreshMain();
    if (troca) { await this.warmFrames((f) => LD.set(null, 30 + f * 68)); LD.hide(); }
    this.show('main');
    this.updateFlyUI();
  }

  // ---------- loop ----------
  // qualidade automática: mede o voo em janelas de 4 s; abaixo de ~42 quadros/s desce um nível e guarda
  autoQuality(raw) {
    const P = this.perf;
    if (this.settings.gfx !== 'auto' || this.state !== 'playing' || this.warming || document.hidden || raw > 0.5) { P.t = 0; P.n = 0; return; }
    if (P.wait > 0) { P.wait -= raw; return; }
    P.t += raw; P.n++;
    if (P.t < 4) return;
    const fps = P.n / P.t; P.t = 0; P.n = 0;
    const i = GFX_ORDER.indexOf(this.autoGfx);
    if (fps < 42 && i < GFX_ORDER.length - 1) {
      this.autoGfx = GFX_ORDER[i + 1];
      Store.set(AUTO_GFX_KEY, this.autoGfx);
      this.applySettings();
      P.wait = 2;
      this.toast(`Qualidade automática: ${GFX_NAMES[this.autoGfx]} (${Math.round(fps)} quadros/s). Dá para escolher outra em Configurações › Transmissão.`);
    }
  }

  frame(t) {
    requestAnimationFrame((tt) => this.frame(tt));
    this.autoQuality((t - this.last) / 1000);
    const dt = Math.min(0.05, (t - this.last) / 1000); this.last = t;
    const inp = this.input.update(dt);
    for (const ev of this.input.takeEvents()) if (!this.warming) this.onEvent(ev);

    if (this.state === 'playing' && !this.warming) {
      const s = this.sim, q = s.q;
      // gimbal: Q/E, rodinha, gatilhos ou o controle por movimento
      const gmin = q.camera.tiltMin, gmax = q.camera.tiltMax;
      if (inp.motion) this.gimbal = clamp(inp.motion.aim / DEG, gmin, gmax);
      else if (Math.abs(inp.gimbal) > 0.02 && !this.qs) {
        this.gimbal = clamp(this.gimbal + inp.gimbal * (12 + this.settings.gimbalSpeed * 11) * dt, gmin, gmax);
        this.gimbalShowT = 1.5;
      }
      this.gimbalShowT = Math.max(0, this.gimbalShowT - dt);
      if (inp.motion && inp.motion.brake && s.armed && !s.onGround && !s.auto) s.brake();
      // segurar W no chão liga os motores e decola (modos assistidos)
      if (!s.armed && s.onGround && this.assistedMode && inp.lift > 0.5 && !s.crashed && !s.batteryDead && !s.frozen) this.startMotors();
      const h = 1 / PHYS_HZ;
      this.acc += dt;
      this.prevPos = s.pos.slice();
      let steps = 0;
      while (this.acc >= h && steps < 60) { s.step(h, inp, this.world); this.acc -= h; steps++; }
      for (const ev of s.events) this.onSimEvent(ev);
      s.events = [];
      this.checkBattery();
      if (this.mode) { this.mode.segment(this.prevPos, s.pos); this.mode.update(dt); }
      for (const imp of s.impactEvents) { this.audio.crash(imp); this.shake = Math.min(1, imp / 15); if (imp > 10) this.flash = 0.2; }
      if (s.impactEvents.length && s.crashed && !this.crashToasted) { this.toast('O drone caiu! Aperte R para reiniciar.'); this.crashToasted = true; }
      if (!s.crashed) this.crashToasted = false;
      s.impactEvents = [];
      this.sigT -= dt;
      if (this.sigT <= 0) { this.sigT = 0.35; this.updateSignal(); }
    }
    this.updateVisuals(dt, t / 1000);
    this.world.update(this.camera, t / 1000, this.sim.pos);
    this.renderFrame(t / 1000);
    this.drawOSD(t / 1000);
    if (this.activeScreen === 'main') this.showcase.render(dt);
    if (this.activeScreen === 'calib') this.updateCalibScreen();
    this.devT = (this.devT || 0) + dt;
    if (this.devT > 0.5) { this.devT = 0; $('#deviceName').textContent = this.input.sourceLabel(); }
  }

  onSimEvent(ev) {
    const msg = {
      takeoffDone: 'Decolagem concluída. Drone pairando.',
      landed: 'Pousado. Motores desligados.',
      rthHome: 'Chegou ao ponto inicial. Pousando…',
      autoCancel: 'Voo automático cancelado pelos sticks.',
    }[ev];
    if (ev === 'shotDone' || (ev === 'autoCancel' && this.qs)) this.endQuickShot(ev === 'shotDone');
    else if (msg) this.toast(msg);
    if (ev === 'landed') this.audio.beep(520, 0.15, 'sine', 0.12);
  }
  checkBattery() {
    const s = this.sim;
    if (!this.settings.batteryDrain || !s.armed) return;
    const pct = s.soc * 100;
    if (pct < 25 && this.batWarned < 1) { this.batWarned = 1; this.toast('Bateria fraca (25%). Volte para casa: aperte H.'); this.audio.beep(880, 0.2, 'square', 0.1); }
    if (pct < 10 && this.batWarned < 2 && this.settings.lowBatLand && !s.onGround) {
      this.batWarned = 2; s.land(); this.toast('Bateria crítica (10%). Pousando automaticamente.');
    }
  }
  // sinal de vídeo: cai com a distância e quando há prédios/morros entre o drone e o piloto
  updateSignal() {
    const s = this.sim, hm = s.home;
    const a = [hm[0], hm[1] + 1.6, hm[2]], b = s.pos;
    const d = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    let blocked = 0;
    const N = 14;
    for (let i = 1; i < N; i++) {
      const t = i / N, p = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
      if (p[1] < this.world.groundHeight(p[0], p[2]) + 0.2 || this.world.collide(p, 0.25).some((c) => c.n[1] < 0.7)) blocked++;
    }
    const target = clamp(1 - d / 4000 - Math.min(0.85, blocked * 0.09), 0, 1);
    this.signal += (target - this.signal) * 0.5;
  }

  // ---------- QuickShots (drones de câmera) ----------
  startQuickShot(type) {
    const s = this.sim;
    $('#qsMenu').classList.add('hidden'); $('#btnQs').classList.remove('on');
    if (s.q.kind !== 'cam') { this.toast('QuickShots só nos drones de câmera (Mini, Air e Mavic).'); return; }
    if (!s.armed || s.onGround || this.sim.agl(this.world) < 2) { this.toast('Decole e suba pelo menos 2 m antes do QuickShot.'); return; }
    const yaw = s.heading, fwd = [-Math.sin(yaw), -Math.cos(yaw)];
    const gx = s.pos[0] + fwd[0] * 9, gz = s.pos[2] + fwd[1] * 9;
    const target = new THREE.Vector3(gx, this.world.groundHeight(gx, gz) + 1, gz);
    const qs = (this.qs = { type, target, t: 0, recStarted: false });
    const r0 = Math.hypot(s.pos[0] - target.x, s.pos[2] - target.z);
    const ang0 = Math.atan2(s.pos[2] - target.z, s.pos[0] - target.x);
    const dur = { dronie: 10, rocket: 8, circle: (2 * Math.PI * r0) / 4, helix: 14 }[type];
    const face = (sim) => {
      const e = wrap(Math.atan2(-(target.x - sim.pos[0]), -(target.z - sim.pos[2])) - sim.heading);
      return clamp(e * 2.5, -1.5, 1.5);
    };
    s.auto = {
      type: 'custom', get: (sim, dt) => {
        qs.t += dt;
        const done = qs.t >= dur;
        if (type === 'dronie') return { v: [-fwd[0] * 3, 1.4, -fwd[1] * 3], yaw: face(sim), done };
        if (type === 'rocket') return { v: [0, 4, 0], yaw: 0, done };
        const dx = sim.pos[0] - target.x, dz = sim.pos[2] - target.z, r = Math.hypot(dx, dz) || 1;
        const rWant = type === 'helix' ? r0 + qs.t * 0.7 : r0;
        const sp = 4;
        const tx = -dz / r, tz = dx / r; // tangente (anti-horário)
        const radial = (rWant - r) * 1.2;
        return { v: [tx * sp + (dx / r) * radial, type === 'helix' ? 1.2 : 0, tz * sp + (dz / r) * radial], yaw: face(sim), done };
      },
    };
    void ang0;
    this.toast('QuickShot ' + { dronie: 'Dronie', rocket: 'Foguete', circle: 'Círculo', helix: 'Hélice' }[type] + ': gravando… (mexa um stick para cancelar)');
    if (!this.rec) { this.toggleVideo(); qs.recStarted = true; }
  }
  endQuickShot(ok) {
    if (!this.qs) return;
    if (this.qs.recStarted && this.rec) this.rec.mr.stop();
    this.toast(ok ? 'QuickShot concluído. Vídeo salvo no Álbum.' : 'QuickShot cancelado.');
    this.qs = null;
  }

  // ---------- foto e vídeo ----------
  snapThumb() {
    const c = this.renderer.domElement, th = document.createElement('canvas');
    th.width = 320; th.height = Math.round((320 * c.height) / c.width);
    th.getContext('2d').drawImage(c, 0, 0, th.width, th.height);
    return th.toDataURL('image/jpeg', 0.8);
  }
  takePhoto() {
    const c = this.renderer.domElement;
    const thumb = this.snapThumb();
    const meta = { type: 'photo', thumb, date: Date.now(), drone: this.quad.name, map: this.mapDef.name };
    c.toBlob((b) => { if (b) this.album.add(Object.assign(meta, { blob: b })).then(() => this.updateFlyUI()); }, 'image/jpeg', 0.93);
    const f = $('#shutterFlash'); f.classList.add('on'); setTimeout(() => f.classList.remove('on'), 60);
    this.audio.shutter();
    this.toast('Foto salva no Álbum.');
    this.lastThumb = thumb; this.updateFlyUI();
  }
  toggleVideo() {
    if (this.rec) { this.rec.mr.stop(); return; }
    if (!this.canvas.captureStream || !window.MediaRecorder) { this.toast('Este navegador não grava vídeo.'); return; }
    const mime = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find((m) => MediaRecorder.isTypeSupported(m));
    let mr;
    try { mr = new MediaRecorder(this.canvas.captureStream(30), mime ? { mimeType: mime, videoBitsPerSecond: 8e6 } : undefined); } catch (e) { this.toast('Não foi possível gravar vídeo.'); return; }
    const chunks = [], t0 = performance.now();
    const meta = { type: 'video', thumb: null, drone: this.quad.name, map: this.mapDef.name };
    this.thumbCb = (t) => { meta.thumb = t; };
    mr.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    mr.onstop = () => {
      const blob = new Blob(chunks, { type: mime || 'video/webm' });
      this.album.add(Object.assign(meta, { blob, date: Date.now(), dur: (performance.now() - t0) / 1000 })).then(() => this.updateFlyUI());
      if (!this.qs) this.toast('Vídeo salvo no Álbum.');
      this.rec = null; if (meta.thumb) this.lastThumb = meta.thumb; this.updateFlyUI();
      this.audio.beep(700, 0.12, 'sine', 0.12);
    };
    mr.start(500);
    this.rec = { mr, t0 };
    this.audio.beep(900, 0.12, 'sine', 0.12);
    this.updateFlyUI();
  }

  updateVisuals(dt, time) {
    const s = this.sim, m = this.droneModel, q = s.q;
    m.position.set(s.pos[0], s.pos[1] - this.visOff, s.pos[2]);
    m.quaternion.set(s.rot[0], s.rot[1], s.rot[2], s.rot[3]);
    animateProps(m, s.rpm, s.propHealth, dt);
    const live = this.state === 'playing';
    this.audio.pitch = q.sound;
    this.audio.update(live ? s.rpm : [0, 0, 0, 0], live ? s.speed : 0, live && s.armed, s.propHealth);

    if (this.state === 'menu') {
      const a = time * 0.035;
      this.camera.position.set(Math.sin(a) * 85, 34, -35 + Math.cos(a) * 85);
      this.camera.lookAt(0, 8, -45);
      m.visible = false;
      this.world.followShadow(new THREE.Vector3(0, 0, -40));
      return;
    }
    m.visible = true;
    const fpv = this.camMode === 'fpv';
    setFpvView(m, fpv);
    this.world.followShadow(m.position);

    // orientação do gimbal no mundo
    if (q.kind === 'cam') this.camYaw += wrap(s.heading - this.camYaw) * (1 - Math.exp(-dt * 5));
    else this.camYaw = s.heading;
    if (this.qs) {
      // QuickShot: a câmera acompanha o alvo
      if (this.qs.type === 'rocket') this.gimbal += (-90 - this.gimbal) * (1 - Math.exp(-dt * 1.5));
      else {
        const tg = this.qs.target, dh = Math.hypot(tg.x - s.pos[0], tg.z - s.pos[2]);
        this.gimbal = clamp(Math.atan2(tg.y - s.pos[1], dh) / DEG, q.camera.tiltMin, q.camera.tiltMax);
      }
    }
    const gm = this.settings.gimbalMode === 'auto' ? (q.kind === 'fpv' ? 'fpv' : 'follow') : this.settings.gimbalMode;
    // modo M ou "presa ao corpo": câmera fixa no corpo, inclinada para cima (FPV original)
    const rigid = (gm === 'body' || s.settings.flightMode === 'M') && !(s.auto && s.auto.type === 'custom') && !this.qs;
    let camQ;
    const gimbalLocal = m.userData.gimbal;
    if (rigid) {
      gimbalLocal.quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), this.settings.mTilt * DEG);
      camQ = m.quaternion.clone().multiply(gimbalLocal.quaternion);
      if (this.gim) this.gim.ready = false;
    } else {
      // gimbal físico (motores, atraso e batentes de cada drone)
      if (!this.gim || this.gim.key !== s.quadKey) this.gim = new Gimbal(s.quadKey);
      camQ = this.gim.update(dt, m.quaternion, this.gimbal * DEG, gm === 'follow' ? 'follow' : 'fpv').clone();
      gimbalLocal.quaternion.copy(m.quaternion).invert().multiply(camQ);
    }
    if (fpv) {
      m.updateMatrixWorld(true);
      gimbalLocal.getWorldPosition(this.camera.position);
      this.camera.position.add(new THREE.Vector3(0, 0, -0.02).applyQuaternion(camQ));
      this.camera.quaternion.copy(camQ);
    } else {
      // 3ª pessoa: atrás e acima, seguindo a direção do voo
      const f = s.forward(), v = s.vel;
      const sp = Math.hypot(v[0], v[2]);
      let dx = f[0], dz = f[2];
      if (sp > 3) { dx = dx * 0.4 + (v[0] / sp) * 0.6; dz = dz * 0.4 + (v[2] / sp) * 0.6; }
      const l = Math.hypot(dx, dz) || 1;
      const dist = 0.7 + q.arm * 8 + Math.min(1.2, sp * 0.025);
      const target = new THREE.Vector3(s.pos[0] - (dx / l) * dist, s.pos[1] + 0.3 + q.arm * 2, s.pos[2] - (dz / l) * dist);
      this.chase.lerp(target, 1 - Math.exp(-dt * 6));
      const gh = this.world.groundHeight(this.chase.x, this.chase.z) + 0.3;
      if (this.chase.y < gh) this.chase.y = gh;
      this.camera.position.copy(this.chase);
      this.camera.lookAt(s.pos[0], s.pos[1] + 0.08, s.pos[2]);
    }
    if (this.shake > 0) {
      this.camera.rotateZ((Math.random() - 0.5) * this.shake * 0.06);
      this.camera.rotateX((Math.random() - 0.5) * this.shake * 0.04);
      this.shake = Math.max(0, this.shake - dt * 3);
    }
  }

  renderFrame(time) {
    const u = this.post.uniforms, s = this.sim, q = s.q;
    const fpv = this.camMode === 'fpv' && this.state !== 'menu';
    u.time.value = time;
    u.fisheye.value = fpv && this.settings.distortion && this.zoomIdx === 0 ? q.camera.fisheye / 10 : 0;
    u.noise.value = 0;
    let st = s.cameraDamage * 0.35;
    if (s.crashed) st = Math.max(st, 0.5);
    u.staticAmt.value = fpv ? Math.min(1, st) : 0;
    u.blocky.value = fpv && this.settings.signalFx && this.state === 'playing' ? clamp((0.4 - this.signal) * 2.6, 0, 1) : 0;
    u.vignette.value = fpv ? (q.kind === 'fpv' ? 0.4 : 0.15) : 0.12;
    u.flash.value = this.flash; this.flash = Math.max(0, this.flash - 0.03);
    this.post.bloom.enabled = this.settings.bloom;
    this.post.render(this.scene, this.camera);
    if (this.wantPhoto) { this.wantPhoto = false; this.takePhoto(); }
    if (this.thumbCb) { this.thumbCb(this.snapThumb()); this.thumbCb = null; }
  }

  // ---------- telas de voo ----------
  telemetry() {
    const s = this.sim, hm = s.home;
    const agl = Math.max(0, s.pos[1] - this.world.groundHeight(s.pos[0], s.pos[2]) - s.q.radius);
    return {
      H: Math.max(0, s.pos[1] - hm[1]), agl, D: Math.hypot(s.pos[0] - hm[0], s.pos[2] - hm[2]),
      hs: Math.hypot(s.vel[0], s.vel[2]), vs: s.vel[1], bat: Math.round(s.soc * 100), rem: s.remainingTime(),
      volt: s.voltage, mode: s.settings.flightMode, homeBearing: Math.atan2(-(hm[0] - s.pos[0]), -(hm[2] - s.pos[2])),
    };
  }
  statusText() {
    const s = this.sim;
    if (s.crashed) return ['Drone danificado', 'red'];
    if (s.batteryDead) return ['Bateria descarregada', 'red'];
    if (s.auto) {
      const t = s.auto.type;
      if (t === 'rth') return ['Retornando ao ponto inicial', 'yellow'];
      if (t === 'land') return ['Pousando', 'yellow'];
      if (t === 'takeoff') return ['Decolando', 'green'];
      if (t === 'brake') return ['Freio: pairando', 'green'];
      if (t === 'custom') return ['QuickShot em andamento', 'green'];
    }
    if (this.settings.batteryDrain && s.soc < 0.25) return ['Bateria fraca', 'yellow'];
    if (this.signal < 0.3) return ['Sinal de vídeo fraco', 'yellow'];
    if (!s.armed) return [s.onGround ? 'Pronto para decolar (GPS)' : 'Motores desligados', 'green'];
    return [s.onGround ? 'Motores ligados (GPS)' : s.settings.flightMode === 'M' ? 'Em voo (Manual)' : 'Em voo (GPS)', 'green'];
  }
  warningText() {
    const s = this.sim, f = s.flags || {};
    if (f.obstacle) return 'Obstáculo detectado. Freando.';
    if (f.altLimit) return `Altitude máxima atingida (${this.settings.maxAlt} m)`;
    if (!s.armed && s.onGround && this.state === 'playing' && !s.crashed) return this.assistedMode ? 'T para decolar · ou segure W' : 'ESPAÇO liga os motores (acelerador no mínimo)';
    return '';
  }

  drawOSD(time) {
    const g = this.g2, k = this.osdScale, W = this.osd.width / k, H = this.osd.height / k;
    g.setTransform(k, 0, 0, k, 0, 0);
    g.clearRect(0, 0, W, H);
    const hudEl = $('#modehud'), centerEl = $('#center'), ind = $('#indicator');
    const hide = this.state === 'menu' || this.settings.cinematic;
    if (hide) { hudEl.classList.add('hidden'); centerEl.classList.add('hidden'); ind.style.display = 'none'; if (this.state === 'menu') return; }
    this.curDrill = null;
    if (this.mode && !hide) {
      const info = this.mode.hud();
      this.curDrill = info.drill || null;
      hudEl.classList.toggle('hidden', this.mode instanceof FreestyleMode);
      hudEl.querySelector('.title').textContent = info.title;
      hudEl.querySelector('.rows').innerHTML = info.rows.map(([a, b]) => `<span>${a}<b>${b}</b></span>`).join('');
      const pr = hudEl.querySelector('.progress');
      pr.style.display = info.progress != null ? 'block' : 'none';
      if (info.progress != null) pr.firstElementChild.style.width = (info.progress * 100).toFixed(0) + '%';
      centerEl.classList.toggle('hidden', !info.center);
      centerEl.textContent = info.center || '';
      centerEl.classList.toggle('big', !!info.big);
      centerEl.classList.toggle('warn', !!info.warn);
      this.drawIndicator(this.settings.lineAssist ? info.target : null);
    }
    if (hide || this.state !== 'playing') return;
    if (this.quad.kind === 'fpv') this.drawGoggles(g, W, H, time);
    else this.drawFlyApp(g, W, H, time);
    this.drawGrid(g, W, H);
    if (this.curDrill) this.drawDrill(g, W, H, this.curDrill, time);
    else if (this.settings.stickHud) this.drawSticks(g, W, H);
  }

  // painel dos exercícios de stick: dois sticks grandes com o alvo, barra de segurar e prévia do drone
  drawDrill(g, W, H, d, time) {
    const dt = Math.min(0.05, Math.max(0, time - (this.drillLastT ?? time))); this.drillLastT = time;
    const inp = this.input, st = inp.state, m1 = this.settings.stickMode === 1;
    const side = { yaw: 'esquerdo', roll: 'direito', lift: m1 ? 'direito' : 'esquerdo', pitch: m1 ? 'esquerdo' : 'direito' };
    const sticks = [['yaw', m1 ? 'pitch' : 'lift'], ['roll', m1 ? 'lift' : 'pitch']]; // [horizontal, vertical]
    const mapKey = { yaw: 'yaw', roll: 'roll', pitch: 'pitch', lift: 'throttle' };
    const LAB = { lift: ['SOBE', 'DESCE'], pitch: ['FRENTE', 'TRÁS'], yaw: ['◀ GIRA', 'GIRA ▶'], roll: ['◀ LADO', 'LADO ▶'] };
    const pad = inp.source === 'pad' ? inp.pad() : null;
    const raw = (ch) => { const m = inp.map[mapKey[ch]]; if (!pad || !m) return null; const v = pad.axes[m.axis] ?? 0; return m.invert ? -v : v; };
    const S = Math.max(90, Math.min(230, H * 0.34, (W - 24 - 70) / 2.75)), P = S * 0.75, gap = P + 36;
    const pw = S * 2 + gap + 40, ph = S + 205, px = (W - pw) / 2, py = Math.max(8, (H - ph) / 2 + 20);
    const fs = Math.max(15, Math.min(24, pw / 30));
    g.save(); g.shadowBlur = 0; g.shadowOffsetY = 0;
    g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(12,14,18,0.88)'; g.beginPath(); g.roundRect(px, py, pw, ph, 18); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.12)'; g.lineWidth = 1; g.stroke();
    // textos
    const cx = W / 2; let y = py + 24;
    g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    g.font = '700 12px "Open Sans", sans-serif'; g.fillStyle = '#4aa8ff'; g.fillText(`EXERCÍCIO ${d.i + 1} DE ${d.n}`, cx, y);
    y += fs + 10;
    const txt = d.t.replace(/\{(\w+)\}/g, (_, c) => (side[c] ? side[c].toUpperCase() : c));
    g.font = `800 ${fs}px Montserrat, "Open Sans", sans-serif`; g.fillStyle = '#fff'; g.fillText(txt, cx, y, pw - 30);
    y += 24;
    g.font = '600 14px "Open Sans", sans-serif'; g.fillStyle = '#9fd1ff'; g.fillText(d.did, cx, y, pw - 30);
    // barra de segurar / tempo no alvo
    y += 16;
    const bw = pw - 80, bx = px + 40;
    g.fillStyle = 'rgba(255,255,255,0.12)'; g.beginPath(); g.roundRect(bx, y, bw, 8, 4); g.fill();
    g.fillStyle = d.ok ? '#3ee07a' : '#ffd23f'; g.beginPath(); g.roundRect(bx, y, Math.max(8, bw * d.frac), 8, 4); g.fill();
    g.font = '600 11px "Open Sans", sans-serif'; g.fillStyle = 'rgba(255,255,255,0.65)';
    g.fillText(d.track ? (d.ok ? 'dentro do alvo: contando tempo' : 'fora do alvo') : d.ok ? 'isso! segure…' : 'coloque o stick na área amarela', cx, y + 24);
    // sticks
    const sy = y + 38, xs = [px + 20, px + pw - 20 - S];
    const R = S / 2 - 12, pulse = 0.5 + 0.5 * Math.sin(time * 6);
    const range = (w, tol) => (w == null ? [-1, 1] : Math.abs(w) >= 0.99 ? (w > 0 ? [1 - tol, 1.06] : [-1.06, -1 + tol]) : [w - tol, w + tol]);
    sticks.forEach(([hc, vc], k) => {
      const x = xs[k], mx = x + S / 2, my = sy + S / 2;
      const wh = d.want[hc], wv = d.want[vc], used = wh != null || wv != null;
      g.globalAlpha = used ? 1 : 0.45;
      g.fillStyle = 'rgba(255,255,255,0.06)'; g.beginPath(); g.roundRect(x, sy, S, S, 14); g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.4)'; g.lineWidth = 1.5; g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.15)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(mx, sy + 8); g.lineTo(mx, sy + S - 8); g.moveTo(x + 8, my); g.lineTo(x + S - 8, my); g.stroke();
      g.beginPath(); g.arc(mx, my, R, 0, Math.PI * 2); g.stroke();
      // rótulos das direções
      g.font = '700 11px "Open Sans", sans-serif'; g.fillStyle = 'rgba(255,255,255,0.6)';
      g.textAlign = 'center'; g.fillText(LAB[vc][0], mx, sy + 16); g.fillText(LAB[vc][1], mx, sy + S - 7);
      g.textAlign = 'left'; g.fillText(LAB[hc][0], x + 6, my - 6); g.textAlign = 'right'; g.fillText(LAB[hc][1], x + S - 6, my - 6);
      // alvo
      if (used) {
        const [h0, h1] = range(wh, d.tol), [v0, v1] = range(wv, d.tol);
        const X0 = mx + clamp(h0, -1.06, 1.06) * R, X1 = mx + clamp(h1, -1.06, 1.06) * R;
        const Y0 = my - clamp(v1, -1.06, 1.06) * R, Y1 = my - clamp(v0, -1.06, 1.06) * R;
        g.fillStyle = d.ok ? 'rgba(62,224,122,0.35)' : `rgba(255,210,63,${0.18 + pulse * 0.14})`;
        g.strokeStyle = d.ok ? '#3ee07a' : '#ffd23f'; g.lineWidth = 2;
        g.beginPath(); g.roundRect(X0, Y0, Math.max(6, X1 - X0), Math.max(6, Y1 - Y0), 8); g.fill(); g.stroke();
      }
      // anel = stick físico, bolinha = comando
      const rx = raw(hc), ry = raw(vc);
      if (rx != null && ry != null) {
        g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 2;
        g.beginPath(); g.arc(mx + clamp(rx, -1, 1) * R, my - clamp(ry, -1, 1) * R, 10, 0, Math.PI * 2); g.stroke();
      }
      const ch = st[hc] || 0, cv = st[vc] || 0, dx = mx + clamp(ch, -1, 1) * R, dy = my - clamp(cv, -1, 1) * R;
      g.strokeStyle = 'rgba(255,255,255,0.4)'; g.lineWidth = 2; g.beginPath(); g.moveTo(mx, my); g.lineTo(dx, dy); g.stroke();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(dx, dy, 7, 0, Math.PI * 2); g.fill();
      g.globalAlpha = 1;
      g.textAlign = 'center'; g.font = '800 12px Montserrat, "Open Sans", sans-serif'; g.fillStyle = '#fff';
      g.fillText('STICK ' + (k ? 'DIREITO' : 'ESQUERDO'), mx, sy + S + 18);
      g.font = '600 11px "Open Sans", sans-serif'; g.fillStyle = 'rgba(255,255,255,0.7)';
      const pc = (v) => Math.round((v || 0) * 100);
      const nm = (c, v) => ({ yaw: 'GIRO', roll: 'LADO', lift: v < 0 ? 'DESCE' : 'SOBE', pitch: v < 0 ? 'TRÁS' : 'FRENTE' })[c];
      g.fillText(`${nm(hc, ch)} ${Math.abs(pc(ch))}%  ·  ${nm(vc, cv)} ${Math.abs(pc(cv))}%`, mx, sy + S + 34);
    });
    // prévia do drone (vista de cima): anda, gira e sobe conforme os sticks
    const T = this.drillToy || (this.drillToy = { x: 0, y: 0, yaw: 0, alt: 0 });
    T.yaw += (st.yaw || 0) * 2.2 * dt;
    const fx = Math.sin(T.yaw), fy = -Math.cos(T.yaw), rx = Math.cos(T.yaw), ry = Math.sin(T.yaw);
    const vx = (st.pitch || 0) * fx + (st.roll || 0) * rx, vy = (st.pitch || 0) * fy + (st.roll || 0) * ry;
    T.x = clamp(T.x + (vx * 1.2 - T.x * 0.9) * dt, -1, 1); T.y = clamp(T.y + (vy * 1.2 - T.y * 0.9) * dt, -1, 1);
    T.alt = clamp(T.alt + ((st.lift || 0) * 1.2 - T.alt * 0.8) * dt, -1, 1);
    const pcx = W / 2, pcy = sy + S / 2, pr = P / 2;
    g.fillStyle = 'rgba(80,140,70,0.25)'; g.beginPath(); g.arc(pcx, pcy, pr, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.2)'; g.lineWidth = 1; g.stroke();
    const qx = pcx + T.x * pr * 0.6, qy = pcy + T.y * pr * 0.6, sc = (pr / 40) * (1 + T.alt * 0.3);
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.ellipse(qx + 4 + T.alt * 6, qy + 6 + T.alt * 8, 15 * sc * 0.8, 15 * sc * 0.8, 0, 0, Math.PI * 2); g.fill();
    g.save(); g.translate(qx, qy - T.alt * 6); g.rotate(T.yaw); g.scale(sc, sc);
    g.strokeStyle = '#d8dce2'; g.lineWidth = 3.5; g.beginPath(); g.moveTo(-12, -12); g.lineTo(12, 12); g.moveTo(12, -12); g.lineTo(-12, 12); g.stroke();
    for (const [a, b] of [[-12, -12], [12, -12], [-12, 12], [12, 12]]) { g.fillStyle = 'rgba(220,230,240,0.35)'; g.beginPath(); g.arc(a, b, 7, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = '#2b2f36'; g.beginPath(); g.roundRect(-6, -9, 12, 18, 4); g.fill();
    g.fillStyle = '#ff5a4f'; g.beginPath(); g.moveTo(0, -17); g.lineTo(-5, -9); g.lineTo(5, -9); g.closePath(); g.fill();
    g.restore();
    g.textAlign = 'center'; g.font = '700 10px "Open Sans", sans-serif'; g.fillStyle = 'rgba(255,255,255,0.55)';
    g.fillText('PRÉVIA DO DRONE', pcx, pcy + pr + 16);
    g.fillText(T.alt > 0.15 ? 'subindo ↑' : T.alt < -0.15 ? 'descendo ↓' : 'altura mantida', pcx, pcy + pr + 30);
    // rodapé
    g.font = '600 11px "Open Sans", sans-serif'; g.fillStyle = pad ? 'rgba(255,255,255,0.55)' : '#ffc426';
    const foot = !pad ? (d.analog ? 'No teclado só existe 0% ou 100%: aqui vale apertar até o fim. Use um controle para treinar a pressão.' : 'Teclado: W/S e A/D = stick esquerdo · setas = stick direito. Com controle fica bem melhor!')
      : 'anel = onde o stick está · bolinha = comando que chega no drone · Mode ' + (m1 ? 1 : 2);
    g.fillText(foot, cx, py + ph - 12, pw - 30);
    if (d.flash > 0) { g.globalAlpha = Math.min(1, d.flash * 2.5); g.font = `900 ${fs * 3}px Montserrat, sans-serif`; g.fillStyle = '#3ee07a'; g.fillText('✔', cx, sy + S / 2 + fs); g.globalAlpha = 1; }
    g.restore();
  }

  // primitivas de desenho do OSD
  osdTools(g) {
    const txt = (t, x, y, px, align = 'left', color = '#fff', weight = 600) => {
      g.font = `${weight} ${px}px "Open Sans", sans-serif`; g.textAlign = align; g.fillStyle = color; g.fillText(t, x, y);
      return g.measureText(t).width;
    };
    const bars = (x, y, n, sz, color = '#fff') => {
      for (let i = 0; i < 5; i++) {
        g.fillStyle = i < n ? color : 'rgba(255,255,255,0.28)';
        const hh = sz * (0.35 + i * 0.16);
        g.fillRect(x + i * sz * 0.3, y - hh, sz * 0.2, hh);
      }
      return sz * 1.5;
    };
    const battery = (x, y, w, h, pct, color) => {
      g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.strokeRect(x, y - h, w, h);
      g.fillStyle = '#fff'; g.fillRect(x + w, y - h * 0.68, 2.5, h * 0.36);
      g.fillStyle = color; g.fillRect(x + 2, y - h + 2, (w - 4) * clamp(pct / 100, 0, 1), h - 4);
    };
    const pill = (x, y, w, h, color) => { g.fillStyle = color; g.beginPath(); g.roundRect(x, y, w, h, h / 2); g.fill(); };
    return { txt, bars, battery, pill };
  }
  batColor(p) { return p < 15 ? '#ff4b4b' : p < 30 ? '#ffc426' : '#34d36b'; }
  sigBars() { return Math.max(0, Math.ceil(this.signal * 5 - 0.01)); }

  // Tela dos óculos DJI Goggles (drones FPV)
  drawGoggles(g, W, H, time) {
    const { txt, bars, battery } = this.osdTools(g);
    const s = this.sim, T = this.telemetry();
    const fs = Math.max(12, H * 0.021), big = Math.max(16, H * 0.032);
    g.shadowColor = 'rgba(0,0,0,0.6)'; g.shadowBlur = 4; g.shadowOffsetY = 1;
    const top = H * 0.065, L = W * 0.045, R = W * 0.955;
    // modo de voo em caixa + GPS + sinal
    g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.roundRect(L, top - big * 0.95, big * 1.15, big * 1.15, 5); g.stroke();
    txt(T.mode, L + big * 0.575, top - big * 0.08, big * 0.8, 'center', '#fff', 700);
    let x = L + big * 1.6;
    x += txt('GPS', x, top - 2, fs * 0.75, 'left', '#cfd3d8', 700) + 5;
    x += txt(String(this.sats), x, top - 2, fs, 'left') + 14;
    x += bars(x, top - 2, this.sigBars(), fs * 1.1) + 4;
    txt('O4', x, top - 2, fs * 0.75, 'left', '#cfd3d8', 700);
    // centro do topo: gravação
    if (this.rec) {
      const rt = (performance.now() - this.rec.t0) / 1000;
      g.fillStyle = Math.floor(time * 2) % 2 ? '#ff4b4b' : 'rgba(255,75,75,0.4)'; g.beginPath(); g.arc(W / 2 - fs * 2.6, top - fs * 0.35, fs * 0.38, 0, Math.PI * 2); g.fill();
      txt(mmss(rt), W / 2 - fs * 1.8, top - 2, fs, 'left');
    } else txt(this.quad.camera.video, W / 2, top - 2, fs * 0.85, 'center', '#cfd3d8', 600);
    // bateria do drone
    const bw = fs * 2.0;
    battery(R - bw - 3, top, bw, fs * 0.95, T.bat, this.batColor(T.bat));
    const tw = txt(`${T.bat}%`, R - bw - 10, top - 1, big * 0.8, 'right', '#fff', 700);
    txt(`${T.volt.toFixed(1)}V`, R - bw - 16 - tw, top - 1, fs * 0.85, 'right', '#cfd3d8');
    txt(mmss(T.rem), R, top + fs * 1.5, fs * 0.85, 'right', '#cfd3d8');
    // retícula central e marcador da direção do voo
    const cx = W / 2, cy = H / 2;
    g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 2;
    g.beginPath(); g.arc(cx, cy, 5, 0, Math.PI * 2); g.moveTo(cx - 26, cy); g.lineTo(cx - 12, cy); g.moveTo(cx + 12, cy); g.lineTo(cx + 26, cy); g.stroke();
    if (T.hs + Math.abs(T.vs) > 1.5) {
      const p = new THREE.Vector3(s.pos[0] + s.vel[0], s.pos[1] + s.vel[1], s.pos[2] + s.vel[2]).project(this.camera);
      if (p.z < 1) {
        const px = (p.x * 0.5 + 0.5) * W, py = (-p.y * 0.5 + 0.5) * H;
        if (px > 0 && px < W && py > 0 && py < H) {
          g.strokeStyle = '#7dff9c'; g.lineWidth = 2;
          g.beginPath(); g.arc(px, py, 7, 0, Math.PI * 2); g.moveTo(px - 16, py); g.lineTo(px - 7, py); g.moveTo(px + 7, py); g.lineTo(px + 16, py); g.moveTo(px, py - 7); g.lineTo(px, py - 13); g.stroke();
        }
      }
    }
    // acelerador (modo M) e gimbal
    if (T.mode === 'M') {
      const bx = W * 0.06, by = H * 0.38, bh = H * 0.24;
      g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(bx, by, 6, bh);
      const th = this.input.state.throttle;
      g.fillStyle = '#fff'; g.fillRect(bx, by + bh * (1 - th), 6, bh * th);
      txt(`${Math.round(th * 100)}%`, bx + 3, by + bh + fs * 1.4, fs * 0.85, 'center');
    }
    if (this.gimbalShowT > 0 || this.input.state.motion) this.drawGimbalScale(g, W * 0.94, H * 0.5, H * 0.22, fs);
    // parte de baixo: altura, distância, velocidade e direção de casa
    const bot = H * 0.93;
    let bx = L;
    bx += txt('H', bx, bot, fs * 0.85, 'left', '#cfd3d8', 700) + 6;
    bx += txt(`${T.H.toFixed(1)}m`, bx, bot, big * 0.8) + 22;
    bx += txt('D', bx, bot, fs * 0.85, 'left', '#cfd3d8', 700) + 6;
    txt(`${Math.round(T.D)}m`, bx, bot, big * 0.8);
    txt(`${Math.round(T.hs * 3.6)}`, W / 2, bot, big * 1.15, 'center', '#fff', 700);
    txt('km/h', W / 2, bot + fs * 1.1, fs * 0.75, 'center', '#cfd3d8');
    this.drawHomeArrow(g, R - fs * 4.5, bot - fs * 0.4, fs * 0.9, T.homeBearing - s.heading);
    txt(`${Math.round(T.D)}m`, R, bot, fs, 'right');
    // avisos
    g.shadowBlur = 0; g.shadowOffsetY = 0;
    this.drawWarning(g, W, H * 0.16, fs, time);
  }

  // Tela do app DJI Fly (drones de câmera)
  drawFlyApp(g, W, H, time) {
    const { txt, bars, battery, pill } = this.osdTools(g);
    const s = this.sim, T = this.telemetry();
    const fs = Math.max(12, H * 0.02);
    // barra superior com degradê
    const barH = Math.max(40, H * 0.075);
    const grd = g.createLinearGradient(0, 0, 0, barH * 1.4);
    grd.addColorStop(0, 'rgba(0,0,0,0.6)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd; g.fillRect(0, 0, W, barH * 1.4);
    const cy = barH * 0.55;
    const [st, col] = this.statusText();
    const colors = { green: '#34d36b', yellow: '#ffc426', red: '#ff4b4b' };
    g.font = `700 ${fs}px "Open Sans", sans-serif`;
    const sw = g.measureText(st).width + fs * 1.6;
    pill(W * 0.022, cy - fs * 0.95, sw, fs * 1.9, col === 'green' ? 'rgba(52,211,107,0.22)' : col === 'yellow' ? 'rgba(255,196,38,0.9)' : 'rgba(255,75,75,0.92)');
    txt(st, W * 0.022 + fs * 0.8, cy + fs * 0.36, fs, 'left', col === 'green' ? colors.green : '#111', 700);
    // itens à direita: modo, desvio, GPS, sinal, bateria
    let x = W * 0.978;
    txt('•••', x, cy + fs * 0.35, fs * 1.1, 'right', '#fff', 800); x -= fs * 2.6;
    const remW = txt(mmss(T.rem), x, cy + fs * 0.36, fs * 0.9, 'right', '#d7dadf'); x -= remW + 8;
    const pw = txt(`${T.bat}%`, x, cy + fs * 0.36, fs, 'right', this.batColor(T.bat), 700); x -= pw + 6;
    battery(x - fs * 1.7, cy + fs * 0.45, fs * 1.6, fs * 0.9, T.bat, this.batColor(T.bat)); x -= fs * 2.8;
    bars(x - fs * 1.5, cy + fs * 0.5, this.sigBars(), fs * 1.1); x -= fs * 1.9;
    txt('RC', x, cy + fs * 0.36, fs * 0.75, 'right', '#cfd3d8', 700); x -= fs * 2.4;
    const gw = txt(String(this.sats), x, cy + fs * 0.36, fs, 'right'); x -= gw + 5;
    txt('GPS', x, cy + fs * 0.36, fs * 0.72, 'right', '#cfd3d8', 700); x -= fs * 3;
    // ícone do desvio de obstáculos
    const obsOn = this.settings.obstacle && s.settings.flightMode !== 'S';
    g.strokeStyle = obsOn ? (s.flags && s.flags.obstacle ? '#ffc426' : '#34d36b') : 'rgba(255,255,255,0.4)'; g.lineWidth = 2;
    for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(x - fs * 0.7, cy + fs * 0.7, fs * (0.35 + i * 0.32), -Math.PI * 0.8, -Math.PI * 0.2); g.stroke(); }
    if (!obsOn) txt('OFF', x - fs * 0.7, cy + fs * 1.4, fs * 0.55, 'center', 'rgba(255,255,255,0.7)', 800);
    x -= fs * 2.8;
    g.strokeStyle = '#fff'; g.lineWidth = 1.6; g.beginPath(); g.roundRect(x - fs * 1.4, cy - fs * 0.75, fs * 1.4, fs * 1.5, 4); g.stroke();
    txt(T.mode, x - fs * 0.7, cy + fs * 0.38, fs, 'center', '#fff', 700);
    // gravação
    if (this.rec) {
      const rt = (performance.now() - this.rec.t0) / 1000;
      pill(W / 2 - fs * 3, barH * 1.15, fs * 6, fs * 1.8, 'rgba(255,75,75,0.9)');
      g.fillStyle = '#fff'; g.beginPath(); g.arc(W / 2 - fs * 1.9, barH * 1.15 + fs * 0.9, fs * 0.3, 0, Math.PI * 2); g.fill();
      txt(mmss(rt), W / 2 + fs * 0.4, barH * 1.15 + fs * 1.3, fs, 'center', '#fff', 700);
    }
    // gimbal (escala à esquerda) quando estiver mexendo
    if (this.gimbalShowT > 0 || this.qs) this.drawGimbalScale(g, W * 0.085, H * 0.5, H * 0.24, fs, true);
    // widget de atitude e mapa (canto inferior esquerdo) + telemetria
    const r = Math.max(48, H * 0.085), wx = W * 0.025 + r, wy = H * 0.965 - r;
    this.drawAttitude(g, wx, wy, r, T, fs);
    const tx = wx + r + fs * 1.2, ty1 = wy - fs * 0.3, ty2 = wy + fs * 1.6;
    g.shadowColor = 'rgba(0,0,0,0.6)'; g.shadowBlur = 3;
    const item = (lab, val, xx, yy) => { const a = txt(lab, xx, yy, fs * 0.8, 'left', '#cfd3d8', 700); return txt(val, xx + a + 6, yy, fs * 1.05, 'left', '#fff', 700) + a + fs * 1.6; };
    let xx = tx; xx += item('D', `${Math.round(T.D)}m`, xx, ty1); item('H', `${T.H.toFixed(1)}m`, xx, ty1);
    xx = tx; xx += item('H.S', `${T.hs.toFixed(1)}m/s`, xx, ty2); item('V.S', `${T.vs.toFixed(1)}m/s`, xx, ty2);
    g.shadowBlur = 0;
    // parâmetros da câmera
    const cp = $('#camParams');
    const ev = '0', zoom = this.quad.camera.zoom[this.zoomIdx] || 1;
    const iso = this.world.look.exposure < 0.9 ? 1600 : 100;
    const html = `<span><small>ISO</small>${iso}</span><span><small>Obt.</small>1/${iso > 400 ? 60 : 1000}</span><span><small>EV</small>${ev}</span><span>${this.capMode === 'video' || this.rec ? this.quad.camera.video : 'JPEG'}</span><span>${zoom}x</span>`;
    if (cp.innerHTML !== html) cp.innerHTML = html;
    this.drawWarning(g, W, barH * 1.55 + (this.rec ? fs * 2.2 : 0), fs, time);
  }

  drawAttitude(g, cx, cy, r, T, fs) {
    const s = this.sim;
    g.save();
    g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fillStyle = 'rgba(0,0,0,0.45)'; g.fill();
    g.clip();
    // horizonte artificial: inclinação e rolagem do drone
    const f = s.forward(), rgt = s.right();
    const pitch = Math.asin(clamp(f[1], -1, 1)), roll = Math.asin(clamp(-rgt[1], -1, 1));
    g.translate(cx, cy); g.rotate(-roll);
    const off = clamp(pitch / (Math.PI / 4), -1, 1) * r * 0.8;
    g.fillStyle = 'rgba(42,140,255,0.28)'; g.fillRect(-r * 2, off - r * 4, r * 4, r * 4);
    g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(-r, off); g.lineTo(r, off); g.stroke();
    g.restore();
    g.save();
    g.translate(cx, cy);
    // bússola (o mapa gira, o drone aponta para cima)
    g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 1.5; g.beginPath(); g.arc(0, 0, r - 1, 0, Math.PI * 2); g.stroke();
    const hdg = -s.heading;
    for (const [lab, a] of [['N', 0], ['L', Math.PI / 2], ['S', Math.PI], ['O', -Math.PI / 2]]) {
      const ang = a - hdg - Math.PI / 2;
      g.font = `700 ${fs * 0.7}px "Open Sans", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = lab === 'N' ? '#ff6a6a' : 'rgba(255,255,255,0.75)';
      g.fillText(lab, Math.cos(ang) * (r - fs * 0.7), Math.sin(ang) * (r - fs * 0.7));
    }
    // ponto de casa
    if (T.D > 0.5) {
      const rel = T.homeBearing - s.heading;
      const rr = Math.min(r - fs * 1.4, (Math.log10(1 + T.D) / 3) * r);
      const hx = -Math.sin(rel) * rr, hy = -Math.cos(rel) * rr;
      g.fillStyle = '#ffb000'; g.beginPath(); g.arc(hx, hy, fs * 0.55, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#111'; g.font = `800 ${fs * 0.6}px "Open Sans", sans-serif`; g.fillText('H', hx, hy + 0.5);
    }
    // cone da câmera e o drone
    g.fillStyle = 'rgba(255,255,255,0.12)'; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, r * 0.75, -Math.PI / 2 - 0.4, -Math.PI / 2 + 0.4); g.fill();
    g.fillStyle = '#fff'; g.beginPath(); g.moveTo(0, -fs * 0.75); g.lineTo(fs * 0.5, fs * 0.5); g.lineTo(0, fs * 0.25); g.lineTo(-fs * 0.5, fs * 0.5); g.closePath(); g.fill();
    g.textBaseline = 'alphabetic';
    g.restore();
  }
  drawGimbalScale(g, x, cy, h, fs, left) {
    const q = this.quad, mn = q.camera.tiltMin, mx = q.camera.tiltMax;
    const y0 = cy - h / 2;
    const yOf = (deg) => y0 + ((mx - deg) / (mx - mn)) * h;
    g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(x, y0); g.lineTo(x, y0 + h); g.stroke();
    for (const d of [mx, 0, mn]) { g.beginPath(); g.moveTo(x - 5, yOf(d)); g.lineTo(x + 5, yOf(d)); g.stroke(); }
    const y = yOf(this.gimbal);
    g.fillStyle = '#fff'; g.beginPath(); g.arc(x, y, 5, 0, Math.PI * 2); g.fill();
    g.font = `700 ${fs * 0.9}px "Open Sans", sans-serif`; g.textAlign = left ? 'left' : 'right';
    g.shadowColor = 'rgba(0,0,0,0.6)'; g.shadowBlur = 3;
    g.fillText(`${Math.round(this.gimbal)}°`, left ? x + 12 : x - 12, y + fs * 0.32);
    g.shadowBlur = 0;
  }
  drawHomeArrow(g, x, y, sz, rel) {
    g.save(); g.translate(x, y); g.rotate(-rel);
    g.fillStyle = '#ffb000'; g.beginPath(); g.moveTo(0, -sz); g.lineTo(sz * 0.65, sz * 0.7); g.lineTo(0, sz * 0.35); g.lineTo(-sz * 0.65, sz * 0.7); g.closePath(); g.fill();
    g.restore();
  }
  drawWarning(g, W, y, fs, time) {
    const w = this.warningText();
    if (!w) return;
    const s = this.sim;
    const crit = (s.flags && s.flags.obstacle) || s.crashed;
    if (!crit && !s.flags.altLimit && Math.floor(time * 1.5) % 3 === 2) return;
    g.font = `700 ${fs}px "Open Sans", sans-serif`;
    const tw = g.measureText(w).width + fs * 2;
    g.fillStyle = crit ? 'rgba(255,75,75,0.9)' : 'rgba(255,196,38,0.92)';
    g.beginPath(); g.roundRect(W / 2 - tw / 2, y, tw, fs * 2, fs); g.fill();
    g.fillStyle = '#111'; g.textAlign = 'center'; g.fillText(w, W / 2, y + fs * 1.36);
  }
  drawGrid(g, W, H) {
    const m = this.settings.grid;
    if (m === 'off' || this.camMode !== 'fpv') return;
    g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 1;
    g.beginPath();
    if (m === 'thirds') for (const t of [1 / 3, 2 / 3]) { g.moveTo(W * t, 0); g.lineTo(W * t, H); g.moveTo(0, H * t); g.lineTo(W, H * t); }
    else { g.moveTo(W / 2 - 30, H / 2); g.lineTo(W / 2 + 30, H / 2); g.moveTo(W / 2, H / 2 - 30); g.lineTo(W / 2, H / 2 + 30); }
    g.stroke();
  }
  drawSticks(g, W, H) {
    const inp = this.input, sti = inp.state, S = Math.max(70, Math.min(110, H * 0.12));
    const app = this.quad.kind === 'cam';
    // no app DJI Fly sobe os quadros para não cobrir a bússola e o botão de foto
    const sy = app ? H * 0.55 : H - S - Math.max(100, H * 0.16), lx = W * 0.045, rx2 = app ? W * 0.75 - S : W * 0.955 - S - 10;
    const vert = this.assistedMode ? sti.lift : sti.throttle * 2 - 1;
    // posição física dos sticks (antes da zona morta), só com controle
    const pad = inp.source === 'pad' ? inp.pad() : null;
    const raw = (ch) => {
      const m = inp.map[ch]; if (!pad || !m) return null;
      const v = pad.axes[m.axis] ?? 0; return m.invert ? -v : v;
    };
    const dz = pad ? inp.deadzone() : 0;
    const pct = (v) => Math.round(Math.abs(v) * 100);
    const col = (v) => { const a = Math.abs(v); return a > 0.9 ? '#ff5a4f' : a > 0.6 ? '#ffc426' : '#3ee07a'; };
    g.save(); g.shadowBlur = 0; g.shadowOffsetY = 0;
    const stick = (x, y, cx, cy, rx, ry, labX, labY) => {
      // fundo e cruz
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.roundRect(x, y, S, S, 10); g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 1.5; g.beginPath(); g.roundRect(x, y, S, S, 10); g.stroke();
      const mx = x + S / 2, my = y + S / 2, R = S / 2 - 6;
      g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(mx, y + 4); g.lineTo(mx, y + S - 4); g.moveTo(x + 4, my); g.lineTo(x + S - 4, my); g.stroke();
      // zona morta
      if (dz > 0) { g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(mx - dz * R, my - dz * R, dz * R * 2, dz * R * 2); }
      // barras de intensidade (horizontal embaixo, vertical à direita)
      const bw = 5;
      g.fillStyle = 'rgba(255,255,255,0.15)'; g.fillRect(x, y + S + 5, S, bw); g.fillRect(x + S + 5, y, bw, S);
      g.fillStyle = col(cx); g.fillRect(mx, y + S + 5, cx * S / 2, bw);
      g.fillStyle = col(cy); g.fillRect(x + S + 5, my, bw, -cy * S / 2);
      // anel = stick físico, bolinha = comando
      if (rx != null && ry != null) {
        g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineWidth = 1.5;
        g.beginPath(); g.arc(mx + clamp(rx, -1, 1) * R, my - clamp(ry, -1, 1) * R, 7, 0, Math.PI * 2); g.stroke();
      }
      const px = mx + clamp(cx, -1, 1) * R, py = my - clamp(cy, -1, 1) * R;
      g.strokeStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.moveTo(mx, my); g.lineTo(px, py); g.stroke();
      g.fillStyle = col(Math.max(Math.abs(cx), Math.abs(cy))); g.beginPath(); g.arc(px, py, 5, 0, Math.PI * 2); g.fill();
      // textos com a porcentagem
      g.font = '600 11px "Open Sans", sans-serif'; g.fillStyle = '#fff'; g.textAlign = 'center';
      g.fillText(`${labX} ${pct(cx)}%   ${labY} ${pct(cy)}%`, mx, y + S + 24);
    };
    const yl = sti.yaw > 0.02 ? 'GIRO ▶' : sti.yaw < -0.02 ? '◀ GIRO' : 'GIRO';
    const vl = this.assistedMode ? (vert > 0.02 ? 'SOBE' : vert < -0.02 ? 'DESCE' : 'ALT.') : 'ACEL.';
    const rl = sti.roll > 0.02 ? 'LADO ▶' : sti.roll < -0.02 ? '◀ LADO' : 'LADO';
    const pl = sti.pitch > 0.02 ? 'FRENTE' : sti.pitch < -0.02 ? 'TRÁS' : 'FRENTE';
    const ry = raw('throttle');
    stick(lx, sy, sti.yaw, vert, raw('yaw'), ry, yl, vl);
    stick(rx2, sy, sti.roll, sti.pitch, raw('roll'), raw('pitch'), rl, pl);
    g.font = '600 10px "Open Sans", sans-serif'; g.fillStyle = 'rgba(255,255,255,0.6)'; g.textAlign = 'left';
    g.fillText(pad ? 'anel = stick físico · bolinha = comando · zona morta ' + Math.round(dz * 100) + '%' : 'teclado', lx, sy - 8);
    g.restore();
  }

  drawIndicator(target) {
    const ind = $('#indicator');
    if (!target || this.state !== 'playing') { ind.style.display = 'none'; return; }
    const v = new THREE.Vector3(...target);
    const dist = v.distanceTo(this.camera.position);
    v.project(this.camera);
    const W = innerWidth, H = innerHeight;
    const behind = v.z > 1;
    let x = (v.x * 0.5 + 0.5) * W, y = (-v.y * 0.5 + 0.5) * H;
    if (behind) { x = W - x; y = H - y; }
    const on = !behind && x > 30 && x < W - 30 && y > 30 && y < H - 30;
    ind.style.display = 'block';
    ind.classList.toggle('off', !on);
    if (!on) {
      const cx = W / 2, cy = H / 2;
      let dx = x - cx, dy = y - cy;
      if (behind && Math.abs(dx) < 1 && Math.abs(dy) < 1) dy = 1;
      const sc = Math.min((W / 2 - 40) / Math.abs(dx || 1e-6), (H / 2 - 40) / Math.abs(dy || 1e-6));
      x = cx + dx * sc; y = cy + dy * sc;
      ind.querySelector('.arrow').style.transform = `rotate(${Math.atan2(dy, dx) + Math.PI / 2}rad)`;
    } else ind.querySelector('.arrow').style.transform = '';
    ind.style.left = x + 'px'; ind.style.top = y + 'px';
    ind.querySelector('span').textContent = dist.toFixed(0) + ' m';
  }

  // botões da tela do DJI Fly
  updateFlyUI() {
    const show = this.state === 'playing' && this.quad.kind === 'cam' && !this.settings.cinematic;
    $('#flyui').classList.toggle('hidden', !show);
    const s = this.sim;
    $('#btnTakeoff').innerHTML = `<svg><use href="#i-${s.armed && !s.onGround ? 'land' : 'takeoff'}"/></svg>`;
    const sh = $('#btnShutter');
    sh.classList.toggle('video', this.capMode === 'video');
    sh.classList.toggle('rec', !!this.rec);
    $('#capPhoto').classList.toggle('on', this.capMode === 'photo');
    $('#capVideo').classList.toggle('on', this.capMode === 'video');
    if (this.lastThumb) $('#btnAlbum').style.backgroundImage = `url(${this.lastThumb})`;
  }
  buildZoomChips() {
    const z = this.quad.camera.zoom, el = $('#zoomChips');
    el.innerHTML = z.length > 1 ? z.map((v, i) => `<button data-z="${i}" class="${i === this.zoomIdx ? 'on' : ''}">${v}x</button>`).join('') : '';
    el.querySelectorAll('[data-z]').forEach((b) => (b.onclick = () => this.setZoom(+b.dataset.z)));
  }
  setZoom(i) {
    const z = this.quad.camera.zoom;
    if (i >= z.length) { if (z.length === 1) this.toast('Este drone não tem zoom.'); return; }
    this.zoomIdx = i; this.updateFov(); this.buildZoomChips();
  }

  // ---------- eventos ----------
  onEvent(ev) {
    if (ev === 'pause') {
      $('#qsMenu').classList.add('hidden');
      if ($('#viewer') && !$('#viewer').classList.contains('hidden')) { $('#viewer').classList.add('hidden'); return; }
      if (this.state === 'playing') this.pause();
      else if (this.state === 'paused' && this.activeScreen === 'pause') this.resume();
      else if (this.state === 'paused' && ['settings', 'help', 'album'].includes(this.activeScreen)) this.show('pause');
      else if (this.state === 'menu' && this.activeScreen !== 'main') this.show('main');
      return;
    }
    if (this.state !== 'playing') return;
    if (this.mode && this.mode.event(ev)) return;
    const s = this.sim;
    if (ev === 'arm' || ev === 'armOn' || ev === 'armOff') {
      if (ev === 'armOff') { if (s.onGround) s.disarm(); return; }
      if (!s.armed) { this.startMotors(); if (s.armed && this.assistedMode && ev === 'arm' && this.input.source === 'pad') { s.takeoff(); this.toast('Decolando…'); } }
      else if (s.onGround) { s.disarm(); this.toast('Motores desligados.'); }
      else { s.brake(); this.toast('Freio: pairando no lugar.'); }
    } else if (ev === 'takeoff') {
      if (s.armed && !s.onGround) { s.land(); this.toast('Pousando…'); }
      else { const err = s.takeoff(); if (err) this.toast(err); else { this.toast('Decolando…'); this.audio.beep(660, 0.1, 'sine', 0.12); } }
      this.updateFlyUI();
    } else if (ev === 'rth') {
      if (!s.armed || s.onGround) { this.toast('O drone já está no chão.'); return; }
      s.rth(); this.toast(`Voltando para casa a ${this.settings.rthAlt} m de altura. Mexa os sticks para cancelar.`);
    } else if (ev === 'brake') {
      if (s.armed && !s.onGround) { s.brake(); this.toast('Freio: pairando no lugar.'); }
    } else if (ev === 'reset') {
      if (this.rec) this.rec.mr.stop();
      s.recharge(); s.repair();
      if (this.mode) this.mode.onReset(); else this.spawnAtStart();
    } else if (ev === 'camera') {
      this.camMode = this.camMode === 'fpv' ? 'chase' : 'fpv'; this.updateFov();
    } else if (ev === 'mode') {
      const order = s.q.modeList;
      const next = order[(order.indexOf(s.settings.flightMode) + 1) % order.length];
      s.settings.flightMode = next;
      if (next === 'M') { this.input.kb.throttle = s.armed && !s.onGround ? s.q.hover : 0; }
      if (!(this.mode instanceof TrainingMode)) { this.settings.flightMode = next; this.saveSettings(); }
      this.toast(`Modo ${next} (${MODE_NAMES[next]})` + (next === 'S' ? ' · desvio de obstáculos desligado' : next === 'M' ? ' · sem assistência!' : ''));
      this.audio.beep(next === 'M' ? 440 : 760, 0.08, 'sine', 0.1);
    } else if (ev === 'photo') {
      this.capMode = 'photo'; this.wantPhoto = true; this.updateFlyUI();
    } else if (ev === 'video') {
      this.capMode = 'video'; this.toggleVideo();
    } else if (ev === 'gimbalReset') {
      const q = s.q;
      this.gimbal = Math.abs(this.gimbal) < 2 && q.kind === 'cam' ? -90 : 0;
      this.gimbalShowT = 1.5;
    } else if (ev.startsWith('zoom')) {
      this.setZoom(+ev.slice(4) - 1);
    } else if (ev === 'quickshot') {
      if (s.q.kind !== 'cam') { this.toast('QuickShots só nos drones de câmera (Mini, Air e Mavic).'); return; }
      $('#qsMenu').classList.toggle('hidden'); $('#btnQs').classList.toggle('on');
      if (document.pointerLockElement) document.exitPointerLock();
    }
  }
  pause() {
    this.state = 'paused';
    if (document.pointerLockElement) document.exitPointerLock();
    this.show('pause');
    this.updateFlyUI();
  }
  resume() {
    this.state = 'playing'; this.show(null); this.applySettings();
    if (this.mode instanceof TrainingMode) this.sim.settings.flightMode = this.mode.lesson.mode;
    this.last = performance.now();
    this.updateFov(); this.buildZoomChips(); this.updateFlyUI();
    this.lockMouse();
  }
  lockMouse() { if (this.input.usesMouse() && this.state === 'playing' && !document.pointerLockElement) this.canvas.requestPointerLock?.(); }

  toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(this.toastT); this.toastT = setTimeout(() => t.classList.remove('show'), 3800);
  }
  showResults({ title, lines, board }) {
    this.state = 'results'; this.sim.frozen = true;
    if (document.pointerLockElement) document.exitPointerLock();
    $('#resTitle').textContent = title;
    $('#resLines').innerHTML = lines.map(([a, b]) => `<tr><td>${a}</td><td>${b}</td></tr>`).join('');
    $('#resBoard').textContent = board && board.length ? 'Ranking local\n' + board.join('\n') : '';
    this.show('results'); this.updateFlyUI();
  }
  showLesson(i, n, title, html, onGo) {
    this.state = 'paused'; this.sim.frozen = true;
    $('#lessonStep').textContent = `LIÇÃO ${i + 1} DE ${n}`;
    $('#lessonTitle').textContent = title;
    $('#lessonText').innerHTML = html;
    this.lessonGo = () => { this.sim.frozen = false; this.state = 'playing'; this.show(null); this.updateFlyUI(); onGo(); };
    this.show('lesson'); this.updateFlyUI();
  }
  askTrackName(cb) {
    this.state = 'paused'; this.nameCb = cb; $('#trackName').value = '';
    this.show('name'); setTimeout(() => $('#trackName').focus(), 50);
  }

  // ---------- telas ----------
  show(name) {
    if (name && this.activeScreen && name !== this.activeScreen) this.prevScreen = this.activeScreen;
    this.activeScreen = name;
    $$('.screen').forEach((el) => el.classList.toggle('active', el.dataset.screen === name));
    if (name === 'map') this.fillMaps();
    if (name === 'hangar') this.fillDrones();
    if (name === 'school') this.fillLessons();
    if (name === 'pause') this.fillPause();
    if (name === 'main') this.refreshMain();
    if (name === 'fly') this.applyThumbs();
    if (name === 'album') this.fillAlbum();
  }
  openSettings(tab) {
    this.settingsTab = tab || this.settingsTab || 'safety';
    this.show('settings');
    this.fillSettings();
  }

  bindUI() {
    document.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      this.audio.init();
      if (b.dataset.go) this.show(b.dataset.go);
      if (b.dataset.settings) this.openSettings(b.dataset.settings);
      if (b.hasAttribute('data-back')) this.show(this.state === 'paused' ? 'pause' : 'main');
      if (b.dataset.mode) {
        this.pending = { mode: b.dataset.mode };
        if (b.dataset.mode === 'school') this.show('school');
        else this.show('map');
      }
      if (b.dataset.qs) this.startQuickShot(b.dataset.qs);
    });
    this.canvas.addEventListener('click', () => this.lockMouse());
    $('#resume').onclick = () => this.resume();
    $('#restart').onclick = () => { this.resume(); this.onEvent('reset'); };
    $('#quit').onclick = () => this.quitToMenu();
    $('#again').onclick = () => { this.sim.frozen = false; this.startGame(); };
    $('#resMenu').onclick = () => this.quitToMenu();
    $('#lessonGo').onclick = () => this.lessonGo && this.lessonGo();
    $('#lessonQuit').onclick = () => this.quitToMenu();
    $('#nameOk').onclick = () => { const n = $('#trackName').value.trim(); this.resume(); this.nameCb && this.nameCb(n); };
    $('#nameCancel').onclick = () => this.resume();
    $('#trackName').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#nameOk').click(); e.stopPropagation(); });
    $('#calibNext').onclick = () => {
      if (!this.calib) return;
      const r = this.calib.next();
      if (r === false) { this.toast('Nada detectado ainda — mexa o stick até os extremos.'); return; }
      if (r === 'done') { this.toast('Calibração salva!'); this.calib = null; this.openSettings('control'); return; }
      $('#calibStep').textContent = this.calib.step.text;
    };
    const cycle = (d) => { const keys = Object.keys(QUADS); const i = (keys.indexOf(this.settings.quad) + d + keys.length) % keys.length; this.setSetting('quad', keys[i]); };
    $('#prevDrone').onclick = () => cycle(-1);
    $('#nextDrone').onclick = () => cycle(1);
    $('#pauseDrone').onchange = (e) => this.setSetting('quad', e.target.value);
    // controles na tela do DJI Fly
    $('#btnTakeoff').onclick = () => this.onEvent('takeoff');
    $('#btnRth').onclick = () => this.onEvent('rth');
    $('#btnQs').onclick = () => this.onEvent('quickshot');
    $('#capPhoto').onclick = () => { this.capMode = 'photo'; this.updateFlyUI(); };
    $('#capVideo').onclick = () => { this.capMode = 'video'; this.updateFlyUI(); };
    $('#btnShutter').onclick = () => { if (this.capMode === 'photo') this.wantPhoto = true; else this.toggleVideo(); };
    $('#btnAlbum').onclick = () => { if (this.state === 'playing') this.pause(); this.show('album'); };
    $('#vClose').onclick = () => this.closeViewer();
    $('#viewer').addEventListener('click', (e) => { if (e.target.id === 'viewer') this.closeViewer(); });
  }

  // controles ‹ valor › e sliders
  makeCtl(def) {
    const el = document.createElement('div');
    const s = this.settings;
    const opts = () => (def.dyn ? this.quad.modeList.map((m) => [m, `${m} · ${MODE_NAMES[m]}`]) : def.opts);
    let update = () => {};
    if (def.type === 'slider') {
      el.className = 'ctl';
      el.innerHTML = '<button class="a">‹</button><div class="sl"><i></i><span></span></div><button class="a">›</button>';
      const [l, sl, r] = el.children;
      const dec = (v) => Number((Math.round(v / def.step) * def.step).toFixed(3));
      const set = (v) => this.setSetting(def.k, Math.min(def.max, Math.max(def.min, dec(v))));
      l.onclick = () => set(s[def.k] - def.step);
      r.onclick = () => set(s[def.k] + def.step);
      const fromX = (e) => { const rc = sl.getBoundingClientRect(); const t = (e.clientX - rc.left - 8) / (rc.width - 16); set(def.min + Math.min(1, Math.max(0, t)) * (def.max - def.min)); };
      sl.addEventListener('pointerdown', (e) => { sl.setPointerCapture(e.pointerId); fromX(e); sl.onpointermove = fromX; });
      sl.addEventListener('pointerup', () => { sl.onpointermove = null; });
      update = () => {
        const v = s[def.k], t = (v - def.min) / (def.max - def.min);
        const pos = `calc(8px + (100% - 16px) * ${t})`;
        sl.children[0].style.left = pos; sl.children[1].style.left = pos;
        sl.children[1].textContent = (def.step < 1 ? v.toFixed(2).replace('.', ',') : String(v)) + (def.unit || '');
      };
    } else if (def.type === 'buttons') {
      el.className = 'ctl btns';
      el.innerHTML = def.opts.map(([, lab]) => `<button>${lab}</button>`).join('');
      [...el.children].forEach((b, i) => (b.onclick = () => this.setSetting(def.k, def.opts[i][0])));
      update = () => [...el.children].forEach((b, i) => b.classList.toggle('on', s[def.k] === def.opts[i][0]));
    } else if (def.type === 'action') {
      el.className = 'ctl btns';
      el.innerHTML = `<button>${def.btn}</button>`;
      el.firstChild.onclick = () => this.action(def.act);
    } else {
      el.className = 'ctl';
      el.innerHTML = '<button class="a">‹</button><div class="v"></div><button class="a">›</button>';
      const [l, v, r] = el.children;
      const step = (d) => { const o = opts(); const i = o.findIndex((x) => x[0] === s[def.k]); this.setSetting(def.k, o[(i + d + o.length) % o.length][0]); };
      l.onclick = () => step(-1); r.onclick = () => step(1); v.onclick = () => step(1);
      update = () => { const o = opts().find((x) => x[0] === s[def.k]); v.textContent = o ? o[1] : 'Personalizado'; };
    }
    update();
    this.ctls.push({ update });
    return el;
  }
  action(a) {
    if (a === 'resetSettings') { const q = this.settings.quad; this.settings = Object.assign({}, DEFAULTS, { quad: q }); this.saveSettings(); this.applySettings(); this.fillSettings(); this.toast('Configurações padrão restauradas.'); }
    if (a === 'resetControls') { this.input.resetMap(); this.toast('Mapeamento padrão restaurado.'); }
    if (a === 'calib') {
      if (!this.input.pad()) { this.toast('Conecte um controle e mexa um stick primeiro.'); return; }
      this.calib = new Calibrator(this.input); this.show('calib'); $('#calibStep').textContent = this.calib.step.text;
    }
  }
  fillSettings() {
    this.ctls = [];
    const tab = this.settingsTab;
    $('#tabs').innerHTML = TABS.map(([id, lab]) => `<button data-tab="${id}" class="${id === tab ? 'on' : ''}">${lab}</button>`).join('');
    $$('#tabs button').forEach((b) => (b.onclick = () => { this.settingsTab = b.dataset.tab; this.fillSettings(); }));
    const rows = $('#setRows'); rows.innerHTML = '';
    const help = (title, text) => { $('#helpTitle').textContent = title; $('#helpText').textContent = text; };
    for (const def of SET[tab]) {
      if (def.type === 'keys') {
        const head = document.createElement('div'); head.className = 'row head'; head.innerHTML = '<span>Ação</span><span>Teclas (perfil atual)</span>'; rows.append(head);
        const list = [...KEY_LABELS[this.settings.profile], ['Decolar / pousar', 'T'], ['Motores / freio', 'ESPAÇO'], ['Voltar para casa', 'H'], ['Modo de voo', 'M'], ['Gimbal', 'Q / E'], ['Foto / vídeo', 'F / V'], ['Câmera', 'C'], ['Pausa', 'ESC']];
        for (const [a, k] of list) { const r = document.createElement('div'); r.className = 'row'; r.innerHTML = `<span>${a}</span><div class="ctl"><div class="v">${k}</div></div>`; rows.append(r); }
        continue;
      }
      const r = document.createElement('div'); r.className = 'row';
      r.innerHTML = `<span>${def.label}</span>`;
      r.append(this.makeCtl(def));
      r.addEventListener('mouseenter', () => { help(def.label, def.help || ''); $$('.row.focus').forEach((x) => x.classList.remove('focus')); r.classList.add('focus'); });
      rows.append(r);
    }
    const first = SET[tab].find((d) => d.label);
    help(first.label, first.help || '');
    const rates = tab === 'rates';
    $('#rateGraph').style.display = rates ? 'block' : 'none';
    $('#rateNums').style.display = rates ? 'flex' : 'none';
    this.drawRates();
  }
  drawRates() {
    const c = $('#rateGraph'); if (!c || c.style.display === 'none') return;
    const g = c.getContext('2d'), W = c.width, H = c.height, s = this.settings;
    g.clearRect(0, 0, W, H);
    const rp = { rcRate: s.rcRate, superRate: s.superRate, expo: s.expo }, ry = { rcRate: s.yawRcRate, superRate: s.yawSuperRate, expo: s.yawExpo };
    const max = Math.max(rateDegPerSec(s.rateType, 1, rp), rateDegPerSec(s.rateType, 1, ry), 200);
    const curve = (r, col, w) => {
      g.strokeStyle = col; g.lineWidth = w; g.beginPath();
      for (let i = 0; i <= 60; i++) { const x = i / 60, y = rateDegPerSec(s.rateType, x, r); const px = 10 + x * (W - 20), py = H - 10 - (y / max) * (H - 20); i ? g.lineTo(px, py) : g.moveTo(px, py); }
      g.stroke();
    };
    curve(ry, '#ffc426', 3); curve(rp, '#57a6ff', 3);
    const a = Math.round(rateDegPerSec(s.rateType, 1, rp)), b = Math.round(rateDegPerSec(s.rateType, 1, ry));
    $('#rateNums').innerHTML = `<span style="background:#57a6ff">Pitch/Roll ${a}°/s</span><span style="background:#ffc426">Yaw ${b}°/s</span>`;
  }
  fillPause() {
    this.ctls = [];
    const box = $('#pauseTiles'); box.innerHTML = '';
    for (const [k, icon, label] of PAUSE_TILES) {
      const t = document.createElement('div'); t.className = 'ptile';
      t.innerHTML = `<svg><use href="#${icon}"/></svg><div class="lbl">${label}</div>`;
      t.append(this.makeCtl(DEF[k]));
      box.append(t);
    }
    $('#pauseDroneName').textContent = this.quad.name;
    $('#pauseInfo').textContent = this.mapDef ? this.mapDef.name + ' · ' + (this.quad.kind === 'fpv' ? 'FPV' : 'Câmera') : '';
    $('#pauseDrone').innerHTML = Object.entries(QUADS).map(([k, q]) => `<option value="${k}" ${k === this.settings.quad ? 'selected' : ''}>${q.name}</option>`).join('');
  }
  refreshMain() {
    const q = this.quad;
    $('#dKind').textContent = q.kind === 'fpv' ? 'FPV · DJI GOGGLES' : 'CÂMERA · DJI FLY';
    $('#dName').textContent = q.name;
    $('#dDesc').textContent = q.desc;
    $('#dSpecs').innerHTML = Object.entries(q.stats).map(([a, b]) => `<div class="spec"><small>${a}</small><b>${b}</b></div>`).join('');
    $('#droneBar').innerHTML = Object.entries(QUADS).map(([k, d]) => `<button class="dchip ${k === this.settings.quad ? 'sel' : ''}" data-quad="${k}"><div class="th" style="${this.thumbStyle('drone-' + k)}"></div><div><b>${d.name}</b><small>${d.kind === 'fpv' ? 'FPV' : 'Câmera'}</small></div></button>`).join('');
    $$('#droneBar [data-quad]').forEach((b) => (b.onclick = () => this.setSetting('quad', b.dataset.quad)));
  }
  thumbStyle(id) { return this.thumbs[id] ? `background-image:url(${this.thumbs[id]})` : 'background:linear-gradient(135deg,#2c2f34,#1b1d21)'; }
  applyThumbs() {
    $$('[data-thumb]').forEach((el) => { const t = this.thumbs[el.dataset.thumb]; if (t) el.style.backgroundImage = `url(${t})`; });
  }
  fillDrones() {
    const el = $('#droneList');
    el.innerHTML = Object.entries(QUADS).map(([k, q]) => `<button class="mcard ${k === this.settings.quad ? 'sel' : ''}" data-quad="${k}"><div class="img" style="${this.thumbStyle('drone-' + k)}"></div><span class="tag">${q.kind === 'fpv' ? 'FPV' : 'Câmera'}</span><div class="cap">${q.name}<small>${q.desc}<br>${Object.values(q.stats).join(' · ')} · modos ${q.modeList.join('/')}</small></div></button>`).join('');
    el.querySelectorAll('[data-quad]').forEach((b) => (b.onclick = () => { this.setSetting('quad', b.dataset.quad); this.fillDrones(); }));
  }
  fillMaps() {
    const mode = this.pending.mode;
    $('#mapTitle').textContent = ({ freestyle: 'Voo livre', race: 'Corrida', challenge: 'Missões', builder: 'Criar pista' }[mode] || '') + ' · escolha o local';
    const el = $('#mapList');
    el.innerHTML = Object.values(MAPS).map((m) => `<button class="mcard" data-map="${m.id}"><div class="img" style="${this.thumbStyle(m.id)}"></div><div class="cap">${m.name}<small>${m.desc}</small></div></button>`).join('');
    el.querySelectorAll('[data-map]').forEach((b) => (b.onclick = () => {
      this.pending.map = b.dataset.map;
      if (mode === 'race') this.fillTracks();
      else if (mode === 'challenge') this.fillChallenges();
      else this.startGame();
    }));
  }
  fillTracks() {
    const map = MAPS[this.pending.map];
    const tracks = [...map.tracks, ...customTracks(map.id)];
    const el = $('#trackList');
    el.innerHTML = tracks.map((t, i) => {
      const rec = Store.get('djisim.rec.' + t.id + '.' + this.settings.quad, null);
      return `<button class="mcard" data-i="${i}"><div class="img" style="${this.thumbStyle(map.id)}"></div><span class="tag">${t.custom ? 'Sua pista' : t.difficulty}</span><div class="cap">${t.name}<small>${t.gates.length} portões · ${t.laps} voltas · recorde: ${rec ? fmtTime(rec.best) : '—'}</small></div></button>`;
    }).join('');
    el.querySelectorAll('[data-i]').forEach((b) => (b.onclick = () => { this.pending.track = tracks[+b.dataset.i]; this.startGame(); }));
    this.show('track');
  }
  fillChallenges() {
    const el = $('#challengeList');
    const items = [];
    for (const type of ['collect', 'chase']) for (const d of Object.keys(DIFFICULTIES)) items.push({ type, d });
    el.innerHTML = items.map((it, i) => {
      const lb = Store.get(`djisim.lb.${it.type}.${this.pending.map}.${it.d}`, []);
      return `<button class="mcard" data-i="${i}"><div class="img" style="${this.thumbStyle(this.pending.map)}"></div><span class="tag">${DIFFICULTIES[it.d].label}</span><div class="cap">${it.type === 'collect' ? 'Passar pelos portões' : 'Seguir o drone'}<small>${it.type === 'collect' ? `Passe por todos em ${DIFFICULTIES[it.d].time} s` : `Alvo a ${DIFFICULTIES[it.d].chase} m/s por 60 s`} · melhor: ${lb[0] ? lb[0].score + ' pts' : '—'}</small></div></button>`;
    }).join('');
    el.querySelectorAll('[data-i]').forEach((b) => (b.onclick = () => { const it = items[+b.dataset.i]; this.pending.type = it.type; this.pending.difficulty = it.d; this.startGame(); }));
    this.show('challenge');
  }
  fillLessons() {
    const done = Store.get('djisim.school2', []);
    const el = $('#lessonList');
    el.innerHTML = LESSON_LIST.map((l, i) => `<button class="mcard ${done.includes(i) ? 'done' : ''}" data-i="${i}"><div class="img" style="${this.thumbStyle(i % 2 ? 'stadium' : 'factory')}"></div><span class="tag">Lição ${i + 1} · ${l.drill ? 'exercício de controle' : 'modo ' + l.mode}${l.fpvOnly ? ' · só FPV' : ''}</span><div class="cap">${l.title}</div></button>`).join('');
    el.querySelectorAll('[data-i]').forEach((b) => (b.onclick = () => {
      const i = +b.dataset.i;
      if (LESSON_LIST[i].fpvOnly && this.quad.kind !== 'fpv') { this.setSetting('quad', 'djifpv'); this.toast('Esta lição usa o modo M: trocamos para o DJI FPV.'); }
      this.pending = { mode: 'school', map: 'stadium', lesson: i }; this.startGame();
    }));
  }
  async fillAlbum() {
    const items = await this.album.list();
    this.albumItems = items;
    $('#albumCount').textContent = `${items.filter((i) => i.type === 'photo').length} fotos · ${items.filter((i) => i.type === 'video').length} vídeos`;
    const el = $('#albumList');
    if (!items.length) { el.innerHTML = '<div class="empty">Nenhuma foto ou vídeo ainda. Durante o voo aperte F para foto e V para vídeo.</div>'; return; }
    el.innerHTML = items.map((it, i) => `<button class="mcard" data-i="${i}"><div class="img ${it.type === 'video' ? 'vid' : ''}" style="background-image:url(${it.thumb})"></div><div class="cap">${it.type === 'video' ? 'Vídeo · ' + mmss(it.dur || 0) : 'Foto'}<small>${new Date(it.date).toLocaleString('pt-BR')} · ${it.drone} · ${it.map}</small></div></button>`).join('');
    el.querySelectorAll('[data-i]').forEach((b) => (b.onclick = () => this.openViewer(items[+b.dataset.i])));
  }
  openViewer(it) {
    const url = URL.createObjectURL(it.blob);
    this.viewerUrl = url;
    $('#vMedia').innerHTML = it.type === 'video' ? `<video src="${url}" controls autoplay></video>` : `<img src="${url}" alt="Foto">`;
    $('#vInfo').textContent = `${new Date(it.date).toLocaleString('pt-BR')} · ${it.drone} · ${it.map}`;
    $('#vDown').onclick = () => {
      const a = document.createElement('a'); a.href = url;
      a.download = `DJI_SIM_${new Date(it.date).toISOString().replace(/[:.]/g, '-')}.${it.type === 'video' ? 'webm' : 'jpg'}`;
      document.body.append(a); a.click(); a.remove();
    };
    $('#vDel').onclick = async () => { await this.album.remove(it.id); this.closeViewer(); this.fillAlbum(); this.toast('Arquivo excluído do Álbum.'); };
    $('#viewer').classList.remove('hidden');
  }
  closeViewer() {
    $('#viewer').classList.add('hidden'); $('#vMedia').innerHTML = '';
    if (this.viewerUrl) { URL.revokeObjectURL(this.viewerUrl); this.viewerUrl = null; }
  }
  updateCalibScreen() {
    const pad = this.input.pad();
    $('#axes').innerHTML = pad ? pad.axes.map((v, i) => `<div class="axis">eixo ${i}: ${v.toFixed(2)}<div class="bar"><i style="left:${Math.min(50, (v + 1) * 50)}%;width:${Math.abs(v) * 50}%"></i></div></div>`).join('') : '';
    if (this.calib) $('#calibStatus').textContent = this.calib.sample().msg;
  }

  // Miniaturas dos mapas e drones, renderizadas num contexto separado.
  async makeThumbs(prog) {
    const cache = Store.get(THUMB_KEY, null);
    if (cache && cache.v === THUMB_VER && cache.t && Object.keys(cache.t).length) {
      Object.assign(this.thumbs, cache.t); this.applyThumbs(); this.refreshMain(); return; // 2ª visita em diante: nada de montar os mapas de novo
    }
    const jobs = [
      ['factory', 480, 300, MAPS.factory.thumbCam],
      ['factory2', 480, 300, { pos: [10, 3, 18], look: [-6, 12, -110] }],
      ['stadium', 480, 300, MAPS.stadium.thumbCam],
      ['promo', 480, 300, { pos: [0, 2.2, 26], look: [0, 9, -40] }, true],
      ['canyon', 480, 300, MAPS.canyon.thumbCam],
    ];
    const total = jobs.length + 1;
    let r;
    try { r = new THREE.WebGPURenderer({ antialias: true }); await r.init(); } catch (e) { return; }
    r.toneMapping = THREE.ACESFilmicToneMapping; r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFShadowMap;
    const scene = new THREE.Scene();
    const w = new World(scene, r);
    let built = null, fim;
    const pronto = new Promise((r2) => (fim = r2));
    const step = () => {
      if (prog) prog(total - jobs.length - 1, total);
      const job = jobs.shift();
      if (!job) {
        for (const k of Object.keys(QUADS)) {
          const sc = new THREE.Scene(); sc.environment = scene.environment;
          const bg = document.createElement('canvas'); bg.width = 4; bg.height = 64;
          const bgg = bg.getContext('2d'), gr = bgg.createLinearGradient(0, 0, 0, 64); gr.addColorStop(0, '#3a3f47'); gr.addColorStop(1, '#16181b'); bgg.fillStyle = gr; bgg.fillRect(0, 0, 4, 64);
          sc.background = new THREE.CanvasTexture(bg); sc.background.colorSpace = THREE.SRGBColorSpace;
          sc.add(new THREE.HemisphereLight(0xffffff, 0x333333, 1.3)); const dl = new THREE.DirectionalLight(0xffffff, 2.5); dl.position.set(1, 2, 1); sc.add(dl);
          const m = makeDroneModel(QUADS[k]); fitModel(m, 0.5); m.rotation.y = 0.6; sc.add(m);
          const cam = new THREE.PerspectiveCamera(30, 480 / 300, 0.01, 10); cam.position.set(0, 0.3, 0.95); cam.lookAt(0, 0.05, 0);
          r.setSize(480, 300); r.render(sc, cam); this.thumbs['drone-' + k] = r.domElement.toDataURL('image/jpeg', 0.85);
        }
        w.clear(); r.dispose();
        this.applyThumbs(); this.refreshMain();
        try { Store.set(THUMB_KEY, { v: THUMB_VER, t: this.thumbs }); } catch (e) { /* navegador sem espaço: só refaz na próxima */ }
        if (prog) prog(total, total);
        return fim();
      }
      const [id, W, H, cam, drone] = job;
      const mapId = id === 'promo' ? 'stadium' : id.replace(/\d+$/, '');
      if (built !== mapId) { w.build(mapId, { lowDetail: true }); built = mapId; }
      r.toneMappingExposure = w.look.exposure;
      const c = new THREE.PerspectiveCamera(55, W / H, 0.05, 4000);
      c.position.set(...cam.pos); c.lookAt(...cam.look);
      w.followShadow(new THREE.Vector3(...cam.look));
      w.update(c, 0);
      let dm = null;
      if (drone) {
        dm = makeDroneModel(QUADS.avata2); dm.scale.setScalar(4);
        const fw = new THREE.Vector3(); c.getWorldDirection(fw);
        dm.position.copy(c.position).addScaledVector(fw, 1.7).add(new THREE.Vector3(0, -0.25, 0)); dm.rotation.set(0.25, 0.55, -0.12);
        animateProps(dm, [0.5, 0.5, 0.5, 0.5], [1, 1, 1, 1], 0.1);
        scene.add(dm);
      }
      r.setSize(W, H); r.render(scene, c);
      this.thumbs[id] = r.domElement.toDataURL('image/jpeg', 0.85);
      if (dm) scene.remove(dm);
      this.applyThumbs();
      setTimeout(step, 30);
    };
    step();
    return pronto;
  }
}

// O WebGPU precisa ser ligado antes do primeiro quadro. Sem WebGPU, o Three.js cai sozinho para o WebGL 2.
// Os efeitos gravam várias imagens por pixel (cor, normal, material, velocidade...): pede o limite maior que a placa aceitar.
const requiredLimits = {};
try {
  const ad = navigator.gpu && (await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' }));
  if (ad) requiredLimits.maxColorAttachmentBytesPerSample = Math.min(64, ad.limits.maxColorAttachmentBytesPerSample);
} catch (e) { /* sem WebGPU: o Three.js usa WebGL 2 */ }
LD.dica();
LD.set('Ligando a placa de vídeo…', 12);
const renderer = new THREE.WebGPURenderer({ canvas: document.querySelector('#view'), antialias: false, powerPreference: 'high-performance', requiredLimits });
await renderer.init();
LD.set('Montando o mapa…', 28);
await nextPaint();
window.game = new Game(renderer);
window.game.padMenu = new PadMenu(window.game);
await window.game.boot();
if (!renderer.backend.isWebGPUBackend) window.game.toast('WebGPU indisponível neste navegador: usando WebGL 2 (mais lento).');
