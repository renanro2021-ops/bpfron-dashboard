// Modos de jogo: Voo livre, Corrida (com fantasma da melhor volta), Missões
// (coletar pontos / seguir o drone), Academia de voo DJI e Construtor de pistas.
import * as THREE from 'three';
import { World } from './world.js';
import { makeDroneModel } from './visuals.js';
import { QUADS } from './physics.js';

const LS = {
  get(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* cheio/bloqueado */ } },
};
export const Store = LS;

export function fmtTime(ms) {
  if (ms == null || !isFinite(ms)) return '--:--.---';
  const m = Math.floor(ms / 60000), s = Math.floor((ms % 60000) / 1000), x = Math.floor(ms % 1000);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(x).padStart(3, '0')}`;
}

export function customTracks(mapId) {
  return LS.get('djisim.customTracks', []).filter((t) => !mapId || t.map === mapId);
}

// Estado visual dos portões (como DetectionGate: lado bom/ruim)
function styleGate(g, state, goodSide = true) {
  const s = {
    next: [goodSide ? 0x22ff88 : 0xff3355, 0.95, 0.12],
    after: [0xffffff, 0.35, 0.0],
    idle: [0x999999, 0.0, 0.0],
    passed: [0x22e0ff, 0.25, 0.0],
  }[state];
  g.glowMat.color.setHex(s[0]); g.glowMat.opacity = s[1];
  g.panelMat.color.setHex(s[0]); g.panelMat.opacity = s[2];
}

class BaseMode {
  constructor(game, opts) { this.game = game; this.opts = opts; this.time = 0; this.objects = []; this.finished = false; }
  get sim() { return this.game.sim; }
  get world() { return this.game.world; }
  add(o) { this.game.scene.add(o); this.objects.push(o); return o; }
  dispose() { for (const o of this.objects) this.game.scene.remove(o); this.objects = []; }
  start() {}
  update() {}
  segment() {}
  onReset() { this.game.spawnAtStart(); }
  event() { return false; }
  hud() { return { title: '', rows: [], target: null }; }
  buildGates(gates) {
    this.gates = gates.map((d) => this.world.addGate(d));
    this.gates.forEach((g, i) => { styleGate(g, 'idle'); this.world.setGateNumber(g, i + 1); });
  }
}

// ---------------------------------------------------------------------
export class FreestyleMode extends BaseMode {
  start() {
    const map = this.game.mapDef;
    // portões da primeira pista como obstáculos livres
    if (map.tracks[0]) this.buildGates(map.tracks[0].gates);
    this.game.spawnAtStart();
    this.game.toast(this.game.quad.kind === 'cam'
      ? 'Voo livre: T decola, W/S sobe/desce, setas movem, A/D gira, Q/E gimbal, F foto, V vídeo, H volta para casa.'
      : 'Voo livre: T decola, W/S sobe/desce, setas movem, A/D gira, M troca o modo (N/S/M), H volta para casa.');
  }
  hud() { return { title: 'VOO LIVRE · ' + this.game.mapDef.name, rows: [['Tempo de voo', fmtTime(this.sim.flightTime * 1000)]], target: null }; }
}

// ---------------------------------------------------------------------
export class RaceMode extends BaseMode {
  start() {
    this.track = this.opts.track;
    this.buildGates(this.track.gates);
    this.recKey = 'djisim.rec.' + this.track.id + '.' + this.game.sim.quadKey;
    this.record = LS.get(this.recKey, null);
    this.ghostModel = null;
    if (this.record && this.record.ghost && this.record.ghost.length > 1 && this.game.settings.ghost) {
      this.ghostModel = this.add(makeDroneModel(QUADS[this.game.sim.quadKey], true));
      this.ghostModel.scale.setScalar(1.1);
      this.ghostModel.visible = false;
    }
    this.restart();
  }
  restart() {
    this.lap = 0; this.next = 0; this.lapTimes = []; this.raceStart = null; this.lapStart = null;
    this.state = 'countdown'; this.countdown = 3.999; this.lastCount = 4;
    this.frames = []; this.recT = 0; this.finished = false;
    this.game.spawnAtStart(this.track);
    this.sim.frozen = true;
    this.refreshGates();
  }
  onReset() { this.restart(); }
  refreshGates() {
    const n = this.gates.length;
    this.gates.forEach((g, i) => styleGate(g, i === this.next ? 'next' : i === (this.next + 1) % n ? 'after' : 'idle'));
  }
  now() { return performance.now(); }
  update(dt) {
    if (this.state === 'countdown') {
      this.countdown -= dt;
      const c = Math.ceil(this.countdown);
      if (c !== this.lastCount) { this.lastCount = c; this.game.audio.countdown(c <= 0); }
      if (this.countdown <= 0) {
        this.state = 'race'; this.sim.frozen = false; this.game.autoArmNow();
        this.game.toast(this.game.assistedMode ? 'VAI! Segure W para subir e passe pelos portões na ordem (o próximo fica verde).' : 'VAI! Acelere e passe pelos portões na ordem (o próximo fica verde).');
      }
    }
    if (this.state === 'race' && this.raceStart != null) {
      this.recT += dt;
      if (this.recT >= 1 / 30) {
        this.recT = 0;
        const p = this.sim.pos, q = this.sim.rot;
        this.frames.push([this.now() - this.lapStart, +p[0].toFixed(2), +p[1].toFixed(2), +p[2].toFixed(2), +q[0].toFixed(3), +q[1].toFixed(3), +q[2].toFixed(3), +q[3].toFixed(3)]);
      }
    }
    // ghost (GhostDataPerFrame) — repete a melhor volta
    if (this.ghostModel && this.lapStart != null && this.record.ghost) {
      const t = this.now() - this.lapStart, F = this.record.ghost;
      let i = this.ghostIdx || 0;
      if (i >= F.length || F[i][0] > t) i = 0;
      while (i < F.length - 1 && F[i + 1][0] <= t) i++;
      this.ghostIdx = i;
      const a = F[i], b = F[Math.min(i + 1, F.length - 1)];
      const k = b[0] > a[0] ? Math.min(1, (t - a[0]) / (b[0] - a[0])) : 0;
      this.ghostModel.visible = t < F[F.length - 1][0];
      this.ghostModel.position.set(a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k, a[3] + (b[3] - a[3]) * k);
      this.ghostModel.quaternion.set(a[4], a[5], a[6], a[7]).slerp(new THREE.Quaternion(b[4], b[5], b[6], b[7]), k);
    }
    // cor do próximo portão: verde se estiver do lado certo
    const g = this.gates[this.next];
    if (g) {
      const s = (this.sim.pos[0] - g.center[0]) * g.n[0] + (this.sim.pos[2] - g.center[2]) * g.n[2];
      styleGate(g, 'next', s < 0.5);
    }
  }
  segment(p0, p1) {
    if (this.state !== 'race') return;
    const g = this.gates[this.next];
    if (World.crossGate(g, p0, p1) !== 1) return;
    const t = this.now();
    if (this.next === 0) {
      if (this.raceStart == null) { this.raceStart = t; this.lapStart = t; this.game.audio.gate(); }
      else if (this.allPassed) {
        const lapMs = t - this.lapStart;
        this.lapTimes.push(lapMs);
        this.game.audio.lap();
        this.saveLap(lapMs);
        this.lap++;
        this.lapStart = t; this.frames = []; this.ghostIdx = 0;
        if (this.lap >= this.track.laps) return this.finish(t);
        this.game.toast(`Volta ${this.lap}: ${fmtTime(lapMs)}`);
      }
    } else this.game.audio.gate();
    this.allPassed = this.next === this.gates.length - 1;
    this.next = (this.next + 1) % this.gates.length;
    this.refreshGates();
  }
  saveLap(ms) {
    if (!this.record || ms < this.record.best) {
      this.record = { best: ms, ghost: this.frames.slice(), date: Date.now() };
      LS.set(this.recKey, this.record);
      this.newRecord = true;
      this.game.toast('NOVO RECORDE de volta! ' + fmtTime(ms));
    }
  }
  finish(t) {
    this.state = 'done'; this.finished = true;
    const total = t - this.raceStart;
    const best = Math.min(...this.lapTimes);
    const lb = LS.get('djisim.lb.' + this.track.id, []);
    lb.push({ total, best, quad: QUADS[this.sim.quadKey].name, date: Date.now() });
    lb.sort((a, b) => a.total - b.total); LS.set('djisim.lb.' + this.track.id, lb.slice(0, 10));
    const rank = lb.findIndex((e) => e.total === total) + 1;
    this.game.showResults({
      title: 'Corrida concluída!',
      lines: [
        ['Pista', this.track.name], ['Tempo total', fmtTime(total)], ['Melhor volta', fmtTime(best)],
        ...this.lapTimes.map((l, i) => ['Volta ' + (i + 1), fmtTime(l)]),
        ['Posição no ranking local', rank + 'º'],
      ],
      board: lb.slice(0, 5).map((e, i) => `${i + 1}. ${fmtTime(e.total)} · ${e.quad}`),
    });
  }
  hud() {
    const cur = this.lapStart != null && this.state === 'race' ? this.now() - this.lapStart : null;
    const rows = [
      ['Volta', `${Math.min(this.lap + 1, this.track.laps)}/${this.track.laps}`],
      ['Portão', `${this.next + 1}/${this.gates.length}`],
      ['Volta atual', fmtTime(cur)],
      ['Recorde', fmtTime(this.record && this.record.best)],
    ];
    const center = this.state === 'countdown' ? String(Math.max(1, Math.ceil(this.countdown))) : this.raceStart == null && this.state === 'race' ? 'Passe pelo portão de largada' : '';
    return { title: 'CORRIDA · ' + this.track.name, rows, center, big: this.state === 'countdown', target: this.gates[this.next] && this.gates[this.next].center };
  }
}

// ---------------------------------------------------------------------
const DIFF = { EASY: { label: 'Fácil', time: 150, chase: 8 }, MEDIUM: { label: 'Média', time: 110, chase: 12 }, HARD: { label: 'Difícil', time: 80, chase: 17 } };
export const DIFFICULTIES = DIFF;

function challengePoints(map) {
  const gates = map.tracks[0].gates;
  const pts = [];
  const world = (x, z, y) => [x, y, z];
  for (let i = 0; i < gates.length; i++) {
    const a = gates[i], b = gates[(i + 1) % gates.length];
    const ah = (a.y || 0) + (a.h || 2.4) / 2, bh = (b.y || 0) + (b.h || 2.4) / 2;
    pts.push(world(a.x, a.z, ah));
    if (gates.length <= 10) pts.push(world((a.x + b.x) / 2 + (i % 2 ? 4 : -4), (a.z + b.z) / 2, (ah + bh) / 2 + 2 + (i % 3) * 2));
  }
  return pts;
}

export class CollectMode extends BaseMode {
  start() {
    const d = DIFF[this.opts.difficulty];
    this.limit = d.time; this.left = d.time;
    this.collected = 0; this.finished = false;
    const pts = challengePoints(this.game.mapDef);
    const geo = new THREE.OctahedronGeometry(0.7, 0);
    this.items = pts.map((p, i) => {
      const mat = new THREE.MeshStandardMaterial({ color: 0xffd23f, emissive: 0xffa400, emissiveIntensity: 1.2, metalness: 0.3, roughness: 0.3 });
      const m = this.add(new THREE.Mesh(geo, mat));
      const gy = this.world.groundHeight(p[0], p[2]);
      m.position.set(p[0], gy + p[1], p[2]);
      const halo = new THREE.Mesh(new THREE.SphereGeometry(1.3, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.12, depthWrite: false }));
      m.add(halo);
      return { m, mat, taken: false, phase: i * 0.7 };
    });
    this.total = this.items.length;
    this.game.spawnAtStart();
    this.game.toast(`Missão COLETAR: pegue os ${this.total} pontos antes do tempo acabar! T decola.`);
  }
  onReset() { this.dispose(); this.start(); }
  update(dt) {
    if (this.finished) return;
    if (this.sim.armed || this.left < this.limit) this.left -= dt;
    for (const it of this.items) {
      if (it.taken) continue;
      it.phase += dt;
      it.m.rotation.y += dt * 1.75; // RotationSpeed = 100°/s
      it.mat.emissiveIntensity = 0.4 + 0.9 * (0.5 + 0.5 * Math.sin(it.phase * Math.PI / 0.65));
      const p = it.m.position, s = this.sim.pos;
      if ((p.x - s[0]) ** 2 + (p.y - s[1]) ** 2 + (p.z - s[2]) ** 2 < 1.7 * 1.7) {
        it.taken = true; it.m.visible = false; this.collected++; this.game.audio.collect();
      }
    }
    if (this.collected === this.total) this.finish(true);
    else if (this.left <= 0) this.finish(false);
  }
  nearest() {
    let best = null, bd = 1e9;
    for (const it of this.items) if (!it.taken) {
      const p = it.m.position, s = this.sim.pos, d = (p.x - s[0]) ** 2 + (p.y - s[1]) ** 2 + (p.z - s[2]) ** 2;
      if (d < bd) { bd = d; best = [p.x, p.y, p.z]; }
    }
    return best;
  }
  finish(win) {
    this.finished = true;
    const timeUsed = this.limit - Math.max(0, this.left);
    const score = this.collected * 100 + (win ? Math.round(Math.max(0, this.left) * 10) : 0);
    const key = 'djisim.lb.collect.' + this.game.mapDef.id + '.' + this.opts.difficulty;
    const lb = LS.get(key, []); lb.push({ score, date: Date.now() }); lb.sort((a, b) => b.score - a.score); LS.set(key, lb.slice(0, 10));
    const stars = win ? (this.left > this.limit * 0.4 ? 3 : this.left > this.limit * 0.15 ? 2 : 1) : 0;
    this.game.showResults({
      title: win ? 'Missão concluída! ' + '★'.repeat(stars) + '☆'.repeat(3 - stars) : 'Tempo esgotado!',
      lines: [['Pontos coletados', `${this.collected}/${this.total}`], ['Tempo usado', fmtTime(timeUsed * 1000)], ['Pontuação', score], ['Dificuldade', DIFF[this.opts.difficulty].label]],
      board: lb.slice(0, 5).map((e, i) => `${i + 1}. ${e.score} pts`),
    });
  }
  hud() {
    return { title: 'MISSÃO · COLETAR', rows: [['Pontos', `${this.collected}/${this.total}`], ['Tempo restante', fmtTime(Math.max(0, this.left) * 1000)]], target: this.nearest(), center: !this.sim.armed && this.left === this.limit ? 'Decole para começar (T)' : '' };
  }
}

export class ChaseMode extends BaseMode {
  start() {
    const d = DIFF[this.opts.difficulty];
    this.speed = d.chase; this.duration = 60; this.left = 60; this.score = 0; this.finished = false; this.started = false;
    const gates = this.game.mapDef.tracks[0].gates;
    const pts = gates.map((g) => new THREE.Vector3(g.x, this.world.groundHeight(g.x, g.z) + (g.y || 0) + (g.h || 2.4) / 2, g.z));
    this.curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal');
    this.length = this.curve.getLength();
    this.u = 0;
    // alvo: drone vermelho com rastro
    this.target = this.add(makeDroneModel(QUADS.djifpv, false));
    this.target.scale.setScalar(2.5);
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 12), new THREE.MeshBasicMaterial({ color: 0xff3355 }));
    this.target.add(glow);
    const lineGeo = new THREE.BufferGeometry().setFromPoints(this.curve.getPoints(400));
    this.add(new THREE.Line(lineGeo, new THREE.LineDashedMaterial({ color: 0xff3355, dashSize: 1, gapSize: 2, transparent: true, opacity: 0.35 }))).computeLineDistances();
    this.placeTarget(0);
    this.game.spawnAtStart();
    this.game.toast('Missão SEGUIR: fique a menos de 15 m do outro drone. Decole para começar (T).');
  }
  onReset() { this.dispose(); this.start(); }
  placeTarget(dt) {
    this.u = (this.u + (this.speed * dt) / this.length) % 1;
    const p = this.curve.getPointAt(this.u), t = this.curve.getTangentAt(this.u);
    this.target.position.copy(p);
    this.target.lookAt(p.clone().sub(t));
    this.target.userData.props.forEach((pr) => (pr.hub.rotation.y += dt * 120));
  }
  update(dt) {
    if (this.finished) return;
    if (!this.started && this.sim.armed && this.sim.pos[1] - this.world.groundHeight(this.sim.pos[0], this.sim.pos[2]) > 1) this.started = true;
    if (!this.started) return;
    this.placeTarget(dt);
    this.left -= dt;
    const p = this.target.position, s = this.sim.pos;
    this.dist = Math.hypot(p.x - s[0], p.y - s[1], p.z - s[2]);
    if (this.dist < 15) this.score += dt * (this.dist < 6 ? 2 : 1);
    if (this.left <= 0) this.finish();
  }
  finish() {
    this.finished = true;
    const pts = Math.round(this.score * 10);
    const key = 'djisim.lb.chase.' + this.game.mapDef.id + '.' + this.opts.difficulty;
    const lb = LS.get(key, []); lb.push({ score: pts, date: Date.now() }); lb.sort((a, b) => b.score - a.score); LS.set(key, lb.slice(0, 10));
    this.game.showResults({
      title: 'Missão encerrada', lines: [['Pontuação', pts], ['Tempo no alcance', (this.score).toFixed(1) + ' s (bônus x2 abaixo de 6 m)'], ['Dificuldade', DIFF[this.opts.difficulty].label]],
      board: lb.slice(0, 5).map((e, i) => `${i + 1}. ${e.score} pts`),
    });
  }
  hud() {
    const d = this.dist ?? 0;
    return {
      title: 'MISSÃO · SEGUIR', rows: [['Distância', this.started ? d.toFixed(1) + ' m' : '--'], ['Pontos', Math.round(this.score * 10)], ['Tempo', fmtTime(Math.max(0, this.left) * 1000)]],
      target: [this.target.position.x, this.target.position.y, this.target.position.z], center: !this.started ? 'Decole para começar (T)' : d > 15 ? 'LONGE DEMAIS!' : '', warn: d > 15,
    };
  }
}

// ---------------------------------------------------------------------
// Academia DJI: lições com teoria + prática
const zoneMesh = (m, r, h, color = 0xffd23f) => m.add(new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 40, 1, true),
  new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.2, side: THREE.DoubleSide, depthWrite: false })));
const padMesh = (m, r) => {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'); g.strokeStyle = '#ffd23f'; g.lineWidth = 8; g.beginPath(); g.arc(64, 64, 58, 0, Math.PI * 2); g.stroke();
  g.beginPath(); g.moveTo(64, 20); g.lineTo(64, 108); g.moveTo(20, 64); g.lineTo(108, 64); g.stroke();
  const t = new THREE.CanvasTexture(c);
  const p = m.add(new THREE.Mesh(new THREE.CircleGeometry(r, 40), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false })));
  p.rotation.x = -Math.PI / 2; return p;
};
const agl = (m) => m.sim.pos[1] - m.world.groundHeight(m.sim.pos[0], m.sim.pos[2]) - m.sim.q.radius;
const yawTracker = {
  setup(m) { m.acc = 0; m.lastYaw = null; },
  tick(m) {
    const yaw = m.sim.heading;
    if (m.lastYaw != null && agl(m) > 0.8) { let d = yaw - m.lastYaw; if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI; m.acc += d; }
    m.lastYaw = yaw; m.progress = Math.min(1, Math.abs(m.acc) / (2 * Math.PI));
  },
};
// Exercícios de stick: o drone fica parado e o painel mostra onde colocar cada stick.
// want = valor pedido em cada canal (yaw/lift/roll/pitch, de -1 a 1); canal ausente = tanto faz.
// track(t) = alvo que se move (seguir com o stick), need = segundos dentro do alvo.
const C = { lift: 0, yaw: 0, roll: 0, pitch: 0 };
const DRILLS = {
  basics: [
    { t: 'Solte os dois sticks', did: 'Sticks no centro = drone parado, pairando no lugar', want: { ...C }, tol: 0.12, hold: 1 },
    { t: 'Stick {lift} para CIMA', did: 'O drone SOBE', want: { lift: 1 }, tol: 0.3, hold: 0.8 },
    { t: 'Stick {lift} para BAIXO', did: 'O drone DESCE (no chão, segurar para baixo desliga os motores)', want: { lift: -1 }, tol: 0.3, hold: 0.8 },
    { t: 'Stick {yaw} para a ESQUERDA', did: 'GIRA o nariz para a esquerda, no próprio eixo', want: { yaw: -1 }, tol: 0.3, hold: 0.8 },
    { t: 'Stick {yaw} para a DIREITA', did: 'GIRA o nariz para a direita', want: { yaw: 1 }, tol: 0.3, hold: 0.8 },
    { t: 'Stick {pitch} para CIMA', did: 'O drone vai para FRENTE (inclina o nariz para baixo)', want: { pitch: 1 }, tol: 0.3, hold: 0.8 },
    { t: 'Stick {pitch} para BAIXO', did: 'O drone vai para TRÁS', want: { pitch: -1 }, tol: 0.3, hold: 0.8 },
    { t: 'Stick {roll} para a ESQUERDA', did: 'O drone DESLIZA para a esquerda, sem virar o nariz', want: { roll: -1 }, tol: 0.3, hold: 0.8 },
    { t: 'Stick {roll} para a DIREITA', did: 'O drone DESLIZA para a direita', want: { roll: 1 }, tol: 0.3, hold: 0.8 },
    { t: 'Solte tudo de novo', did: 'Nos DJI, soltar os sticks faz o drone frear e parar sozinho (GPS)', want: { ...C }, tol: 0.12, hold: 1 },
  ],
  pressure: [
    { t: 'Stick {pitch} para cima só 25%', did: 'Bem devagar: ideal para filmar e chegar perto das coisas', want: { pitch: 0.25 }, tol: 0.1, hold: 1.5, analog: true },
    { t: 'Agora 50%', did: 'Metade da velocidade máxima do modo', want: { pitch: 0.5 }, tol: 0.1, hold: 1.5, analog: true },
    { t: 'Agora 75%', did: 'Rápido, mas ainda dá para corrigir', want: { pitch: 0.75 }, tol: 0.1, hold: 1.5, analog: true },
    { t: 'Até o fim: 100%', did: 'Velocidade máxima do modo de voo', want: { pitch: 1 }, tol: 0.1, hold: 1, analog: true },
    { t: 'Gire devagar: stick {yaw} 30% à direita', did: 'Giro lento = imagem suave (panorâmica de cinema)', want: { yaw: 0.3 }, tol: 0.1, hold: 1.5, analog: true },
    { t: 'Gire 60% à esquerda', did: 'Giro mais rápido', want: { yaw: -0.6 }, tol: 0.1, hold: 1.5, analog: true },
    { t: 'Suba devagar: stick {lift} 40% para cima', did: 'Subida suave', want: { lift: 0.4 }, tol: 0.1, hold: 1.5, analog: true },
    { t: 'Desça devagar: stick {lift} 30% para baixo', did: 'Descida suave, sem tranco', want: { lift: -0.3 }, tol: 0.1, hold: 1.5, analog: true },
    { t: 'Stick {roll} 50% à direita', did: 'Desliza de lado na metade da velocidade', want: { roll: 0.5 }, tol: 0.1, hold: 1.5, analog: true },
  ],
  combo: [
    { t: 'SOBE + FRENTE ao mesmo tempo', did: 'Subida em diagonal: passa por cima de árvores e prédios', want: { lift: 0.7, pitch: 0.7 }, tol: 0.25, hold: 1.2 },
    { t: 'FRENTE + GIRO à direita', did: 'Curva suave, como um carro fazendo a curva', want: { pitch: 0.7, yaw: 0.6 }, tol: 0.25, hold: 1.2 },
    { t: 'LADO à esquerda + GIRO à direita', did: 'ÓRBITA: o drone circula em volta de algo, olhando sempre para ele', want: { roll: -0.7, yaw: 0.6 }, tol: 0.25, hold: 1.2 },
    { t: 'SOBE + TRÁS ao mesmo tempo', did: 'DRONIE: afasta e sobe, revelando o lugar (clássico dos DJI)', want: { lift: 0.6, pitch: -0.7 }, tol: 0.25, hold: 1.2 },
    { t: 'DESCE + LADO à direita', did: 'Desce de lado acompanhando um objeto', want: { lift: -0.5, roll: 0.7 }, tol: 0.25, hold: 1.2 },
  ],
  track: [
    { t: 'Siga o alvo com o stick {pitch}', did: 'Mantenha a bolinha dentro do círculo verde. Movimentos suaves!', track: (t) => ({ roll: 0.6 * Math.sin(t * 0.9), pitch: 0.6 * Math.cos(t * 0.9) }), tol: 0.22, need: 6 },
    { t: 'Agora com o stick {lift}', did: 'Faça um "8" acompanhando o alvo', track: (t) => ({ yaw: 0.65 * Math.sin(t * 0.8), lift: 0.55 * Math.sin(t * 1.6) }), tol: 0.22, need: 6 },
    { t: 'Os dois sticks juntos', did: 'Igual a pilotar de verdade: cada mão faz uma coisa', track: (t) => ({ roll: 0.55 * Math.sin(t * 0.7), pitch: 0.55 * Math.cos(t * 0.7), yaw: 0.5 * Math.sin(t * 0.5), lift: 0.4 * Math.cos(t * 0.9) }), tol: 0.26, need: 6 },
  ],
};
// ângulo de giro em volta de um ponto (lição da órbita)
const POLE = [0, 18];
const LESSONS = [
  {
    title: 'Conhecendo os sticks', mode: 'N', drill: DRILLS.basics, tag: 'controle',
    theory: 'Antes de voar, conheça o controle. No <b>Mode 2</b> (padrão DJI):<br>• <b>stick esquerdo</b>: para cima/baixo <b>sobe e desce</b>, para os lados <b>gira</b> o nariz;<br>• <b>stick direito</b>: para cima/baixo vai para <b>frente e trás</b>, para os lados <b>desliza</b> de lado.<br><br>O drone fica parado no chão. Coloque o stick no lugar que o painel pedir e segure até a barra encher.',
  },
  {
    title: 'Dosando a pressão', mode: 'N', drill: DRILLS.pressure, tag: 'controle',
    theory: 'Os sticks são <b>proporcionais</b>: quanto mais você empurra, mais rápido o drone vai. Pilotos bons quase nunca usam 100%: movimentos pequenos e suaves dão imagens bonitas e evitam batidas.<br><br>Segure o stick exatamente na porcentagem pedida. Olhe a barra e o número no painel.',
  },
  {
    title: 'Dois sticks juntos', mode: 'N', drill: DRILLS.combo, tag: 'controle',
    theory: 'As manobras de verdade usam <b>as duas mãos ao mesmo tempo</b>. Cada combinação vira um movimento de cinema: subida em diagonal, curva, <b>órbita</b> e <b>dronie</b>.<br><br>Coloque os dois sticks nos alvos verdes e segure.',
  },
  {
    title: 'Seguir o alvo', mode: 'N', drill: DRILLS.track, tag: 'controle',
    theory: 'Agora o alvo <b>se mexe</b>. Acompanhe com o stick, mantendo a bolinha dentro do círculo. Isso treina o controle fino dos dedos, que é o segredo para voar suave.<br><br>O tempo só conta enquanto você está dentro do alvo.',
  },
  {
    title: 'Ligar e decolar', mode: 'N',
    theory: 'Nos drones DJI a decolagem é automática. Aperte o botão de ligar do controle ou <kbd>T</kbd> (ou o botão de decolar na tela) e o drone liga os motores, sobe 1,2 m e fica <b>pairando parado</b> sozinho, segurado pelo GPS.<br><br>Outra forma: segure o <b>stick esquerdo para cima</b> (<kbd>W</kbd>) com o drone no chão. Decole agora e suba acima de 1 m.',
    check: (m) => m.sim.armed && !m.sim.onGround && agl(m) > 1,
  },
  {
    title: 'Subir e pairar', mode: 'N',
    theory: 'No modo <b>N (Normal)</b> o <b>stick esquerdo</b> controla a altura: para cima sobe e para baixo desce (<kbd>W</kbd>/<kbd>S</kbd>). Quando você solta, o drone <b>mantém a altitude</b> e fica parado no ar.<br><br>Fique dentro da <b>zona amarela</b> (entre 3 e 5 m de altura) por 4 segundos.',
    setup(m) { const s = m.game.mapDef.spawn.pos; m.zone = zoneMesh(m, 3, 2); m.zone.position.set(s[0], m.world.groundHeight(s[0], s[2]) + 4, s[2]); m.hold = 0; },
    tick(m, dt) {
      const s = m.sim.pos, z = m.zone.position;
      const inside = Math.hypot(s[0] - z.x, s[2] - z.z) < 3 && Math.abs(s[1] - z.y) < 1;
      m.hold = inside ? m.hold + dt : 0; m.progress = Math.min(1, m.hold / 4);
    },
    check: (m) => m.hold >= 4,
  },
  {
    title: 'Girar no lugar', mode: 'N', ...yawTracker,
    theory: 'O <b>giro</b> (yaw) vira o drone no próprio eixo, como uma bússola: <b>stick esquerdo para os lados</b> (<kbd>A</kbd>/<kbd>D</kbd>).<br><br>Decole, mantenha pelo menos 1 m de altura e complete <b>uma volta inteira (360°)</b>. O GPS segura o drone no mesmo lugar enquanto ele gira.',
    check: (m) => Math.abs(m.acc) >= 2 * Math.PI,
  },
  {
    title: 'Para frente', mode: 'N',
    theory: 'O <b>stick direito</b> move o drone: para cima vai para frente e para baixo vai para trás (<kbd>↑</kbd>/<kbd>↓</kbd>). Nos drones DJI a altura é mantida sozinha, então você não precisa compensar nada.<br><br>Solte o stick e o drone <b>freia e para</b> sozinho. Passe pelo portão à frente.',
    gates: [{ x: 0, z: 12, yaw: 0 }],
  },
  {
    title: 'Para os lados', mode: 'N',
    theory: 'Com o <b>stick direito para os lados</b> (<kbd>←</kbd>/<kbd>→</kbd>) o drone desliza sem virar o nariz. Isso é ótimo para filmar em movimento.<br><br>Passe pelos dois portões: o primeiro fica à esquerda e o segundo à direita.',
    gates: [{ x: -7, z: 18, yaw: 0 }, { x: 7, z: 2, yaw: 0 }],
  },
  {
    title: 'Voo em quadrado', mode: 'N',
    theory: 'Agora desenhe um <b>quadrado</b> no ar usando <b>só o stick direito</b>: frente, direita, trás e esquerda. Não gire o nariz: ele fica sempre olhando para o mesmo lado.<br><br>Esse exercício é o primeiro que os instrutores de drone pedem. Passe pelos 4 portões na ordem.',
    gates: [{ x: 0, z: 24, yaw: 0 }, { x: 8, z: 16, yaw: -Math.PI / 2 }, { x: 16, z: 24, yaw: Math.PI }, { x: 8, z: 32, yaw: Math.PI / 2 }],
  },
  {
    title: 'Órbita em volta do poste', mode: 'N',
    theory: 'A <b>órbita</b> é a manobra mais usada em filmagem: o drone dá uma volta em torno de algo, <b>sempre olhando para ele</b>.<br><br>Decole e fique de frente para o <b>poste laranja</b>, a uns 10 m. Empurre o <b>stick direito para o lado</b> e, ao mesmo tempo, o <b>stick esquerdo para o lado oposto</b> para manter o poste no centro da tela. Dê uma volta completa.',
    setup(m) {
      const gh = m.world.groundHeight(POLE[0], POLE[1]);
      const mat = new THREE.MeshStandardMaterial({ color: 0xff7a1a, emissive: 0x552200, roughness: 0.5 });
      const p = m.add(new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, 6, 16), mat)); p.position.set(POLE[0], gh + 3, POLE[1]);
      const top = m.add(new THREE.Mesh(new THREE.SphereGeometry(0.45, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffd23f }))); top.position.set(POLE[0], gh + 6.3, POLE[1]);
      m.ring = zoneMesh(m, 10, 0.4); m.ring.position.set(POLE[0], gh + 0.2, POLE[1]);
      m.acc = 0; m.lastA = null; m.aimOk = false;
    },
    tick(m) {
      const s = m.sim, dx = s.pos[0] - POLE[0], dz = s.pos[2] - POLE[1], d = Math.hypot(dx, dz);
      const want = Math.atan2(dx, dz); // rumo que aponta o nariz para o poste
      let e = s.heading - want; e = Math.atan2(Math.sin(e), Math.cos(e));
      m.aimOk = agl(m) > 1.5 && d > 5 && d < 18 && Math.abs(e) < 0.6;
      const a = Math.atan2(dx, dz);
      if (m.aimOk && m.lastA != null) { let da = a - m.lastA; da = Math.atan2(Math.sin(da), Math.cos(da)); m.acc += da; }
      m.lastA = m.aimOk ? a : null;
      m.progress = Math.min(1, Math.abs(m.acc) / (2 * Math.PI));
      m.hint = !s.armed || agl(m) < 1.5 ? 'Decole e suba um pouco' : d >= 18 ? 'Chegue mais perto do poste' : d <= 5 ? 'Afaste-se um pouco do poste' : Math.abs(e) >= 0.6 ? 'Gire para olhar o poste' : 'Isso! Continue girando em volta';
    },
    check: (m) => Math.abs(m.acc) >= 2 * Math.PI,
  },
  {
    title: 'Curvas no modo Esporte', mode: 'S',
    theory: 'O modo <b>S (Esporte)</b> é bem mais rápido e o drone inclina mais. Atenção: neste modo o <b>desvio de obstáculos fica desligado</b>.<br><br>Faça curvas combinando <kbd>↑</kbd> para frente com <kbd>A</kbd>/<kbd>D</kbd> para girar. Passe pelos 4 portões em círculo.',
    gates: [],
  },
  {
    title: 'Pouso de precisão', mode: 'N',
    theory: 'Voe até a <b>marca amarela</b> e pouse em cima dela. Para pousar: segure <kbd>S</kbd> até tocar o chão (os motores desligam sozinhos) ou aperte <kbd>T</kbd> para o pouso automático.<br><br>Desça devagar no final: a <b>proteção de pouso</b> reduz a velocidade perto do chão.',
    setup(m) {
      const s = m.game.mapDef.spawn.pos; const x = s[0] + 6, z = s[2] - 14;
      m.pad = padMesh(m, 1.4); m.pad.position.set(x, m.world.groundHeight(x, z) + 0.03, z); m.padXZ = [x, z]; m.flew = false;
    },
    tick(m) {
      if (agl(m) > 1) m.flew = true;
      const d = Math.hypot(m.sim.pos[0] - m.padXZ[0], m.sim.pos[2] - m.padXZ[1]);
      m.progress = m.flew ? Math.max(0, Math.min(0.95, 1 - d / 15)) : 0;
      m.landedOk = m.flew && m.sim.onGround && !m.sim.armed && d < 1.4;
    },
    check: (m) => m.landedOk,
  },
  {
    title: 'Voltar para casa (RTH)', mode: 'N',
    theory: 'O <b>RTH</b> (Return to Home) traz o drone de volta sozinho: ele sobe até a altitude de retorno, volta para o ponto de decolagem (o <b>H</b> no chão) e pousa.<br><br>Afaste-se pelo menos <b>25 m</b> do ponto inicial e aperte <kbd>H</kbd>. Espere o drone pousar sozinho. Mexer os sticks cancela o retorno.',
    setup(m) { m.far = false; },
    tick(m) {
      const s = m.sim, d = Math.hypot(s.pos[0] - s.home[0], s.pos[2] - s.home[2]);
      if (d > 25) m.far = true;
      m.progress = m.far ? (s.onGround && !s.armed ? 1 : 0.5 + Math.max(0, 0.45 - d / 60)) : Math.min(0.5, d / 50);
    },
    check: (m) => m.far && m.sim.onGround && !m.sim.armed && Math.hypot(m.sim.pos[0] - m.sim.home[0], m.sim.pos[2] - m.sim.home[2]) < 4,
  },
  {
    title: 'Modo Manual e flip', mode: 'N', fpvOnly: true,
    theory: 'No modo <b>M (Manual)</b>, só nos drones FPV, não há nenhuma assistência: o drone <u>não</u> se nivela e não segura a altura. O stick esquerdo vira acelerador e o direito controla a <i>velocidade de giro</i>.<br><br>Decole com <kbd>T</kbd>, suba acima de 8 m, aperte <kbd>M</kbd> até chegar no modo M e faça um <b>flip completo</b> (360°). Dica: solte o acelerador durante o giro e acelere de novo ao terminar.',
    setup(m) { m.acc = [0, 0]; },
    tick(m, dt) {
      if (agl(m) > 6 && m.sim.armed && m.sim.settings.flightMode === 'M') { m.acc[0] += m.sim.w[0] * dt; m.acc[1] += m.sim.w[2] * dt; } else m.acc = [0, 0];
      m.progress = Math.min(1, Math.max(Math.abs(m.acc[0]), Math.abs(m.acc[1])) / (2 * Math.PI));
    },
    check: (m) => Math.max(Math.abs(m.acc[0]), Math.abs(m.acc[1])) >= 2 * Math.PI,
  },
];
// portões em círculo (tangentes à curva)
LESSONS.find((l) => l.title === 'Curvas no modo Esporte').gates = [0, 1, 2, 3].map((i) => {
  const a = (i / 4) * Math.PI * 2 + Math.PI / 4, R = 16, cx = 0, cz = 10;
  return { x: cx + Math.sin(a) * R, z: cz + Math.cos(a) * R, yaw: a - Math.PI / 2 };
});
export const LESSON_LIST = LESSONS;

export class TrainingMode extends BaseMode {
  start() {
    this.done = LS.get('djisim.school2', []);
    this.index = this.opts.lesson ?? 0;
    this.begin();
  }
  begin() {
    this.dispose();
    this.world.gates.slice().forEach((g) => this.world.removeGate(g));
    const L = (this.lesson = LESSONS[this.index]);
    if (L.fpvOnly && this.game.quad.kind !== 'fpv') { this.game.setSetting('quad', 'djifpv'); this.game.toast('Esta lição usa o modo M: trocamos para o DJI FPV.'); }
    this.progress = 0; this.state = 'theory'; this.successT = 0; this.gateIdx = 0;
    this.di = 0; this.dHold = 0; this.dT = 0; this.dIn = 0; this.dOk = false; this.dFlash = 0; this.dFrac = 0; this.dWant = null; this.hint = '';
    this.game.sim.settings.flightMode = L.mode;
    this.game.spawnAtStart();
    if (L.setup) L.setup(this);
    if (L.gates) { this.buildGates(L.gates); this.refresh(); }
    this.game.showLesson(this.index, LESSONS.length, L.title, L.theory, () => { this.state = 'practice'; if (L.drill) this.game.sim.frozen = true; });
  }
  refresh() { this.gates.forEach((g, i) => styleGate(g, i === this.gateIdx ? 'next' : i < this.gateIdx ? 'passed' : 'after')); }
  onReset() { this.begin(); }
  // nos exercícios de stick o drone não liga nem decola
  event(ev) { return !!(this.lesson && this.lesson.drill && this.state === 'practice' && ['arm', 'armOn', 'takeoff', 'rth', 'brake', 'mode'].includes(ev)); }
  // valores atuais dos sticks (comando, depois da zona morta)
  sticks() { const st = this.game.input.state; return { yaw: st.yaw, lift: st.lift, roll: st.roll, pitch: st.pitch }; }
  drillStep(dt) {
    const L = this.lesson, step = L.drill[this.di], v = this.sticks();
    const kb = this.game.input.source !== 'pad';
    this.dT += dt;
    const want = step.track ? step.track(this.dT) : step.want;
    // no teclado não existe meio-termo: aceita o stick no fim do curso
    const tol = step.tol * (kb && step.track ? 2 : 1);
    let ok = true;
    for (const ch in want) {
      let w = want[ch];
      if (kb && step.analog && w !== 0) w = Math.sign(w);
      const x = v[ch] || 0;
      ok = ok && (Math.abs(w) >= 0.99 ? Math.sign(x) === Math.sign(w) && Math.abs(x) >= 1 - tol : Math.abs(x - w) <= tol);
    }
    this.dOk = ok; this.dWant = want; this.dTol = tol;
    if (step.track) { if (ok) this.dIn += dt; this.dFrac = Math.min(1, this.dIn / step.need); }
    else { this.dHold = ok ? this.dHold + dt : Math.max(0, this.dHold - dt * 2); this.dFrac = Math.min(1, this.dHold / step.hold); }
    this.dFlash = Math.max(0, this.dFlash - dt);
    if (this.dFrac >= 1) {
      this.di++; this.dHold = 0; this.dIn = 0; this.dT = 0; this.dFrac = 0; this.dFlash = 0.6;
      this.game.audio.gate();
    }
    this.progress = Math.min(1, (this.di + (this.dFrac || 0)) / L.drill.length);
    return this.di >= L.drill.length;
  }
  segment(p0, p1) {
    if (!this.lesson.gates || this.state !== 'practice') return;
    const g = this.gates[this.gateIdx];
    if (g && World.crossGate(g, p0, p1) === 1) { this.gateIdx++; this.game.audio.gate(); this.progress = this.gateIdx / this.gates.length; this.refresh(); }
  }
  update(dt) {
    if (this.state === 'practice') {
      const L = this.lesson;
      let ok;
      if (L.drill) { this.game.sim.frozen = true; ok = this.drillStep(dt); }
      else {
        if (L.tick) L.tick(this, dt);
        ok = L.gates ? this.gateIdx >= this.gates.length : L.check(this);
      }
      if (ok) {
        this.state = 'success'; this.successT = 2.2; this.game.audio.lap();
        if (!this.done.includes(this.index)) { this.done.push(this.index); LS.set('djisim.school2', this.done); }
      }
    } else if (this.state === 'success') {
      this.successT -= dt;
      if (this.successT <= 0) {
        if (this.index + 1 < LESSONS.length) { this.index++; this.begin(); }
        else {
          this.finished = true;
          this.game.showResults({ title: 'Academia DJI concluída! 🎓', lines: [['Lições', `${LESSONS.length}/${LESSONS.length}`], ['Próximo passo', 'Tente uma corrida no modo S ou M']] });
        }
      }
    }
  }
  hud() {
    const target = this.lesson.gates && this.gates[this.gateIdx] ? this.gates[this.gateIdx].center : null;
    const L = this.lesson;
    if (L.drill) {
      const step = L.drill[Math.min(this.di, L.drill.length - 1)];
      return {
        title: `ACADEMIA DJI · ${this.index + 1}/${LESSONS.length} · ${L.title}`, rows: [], progress: this.progress,
        center: this.state === 'success' ? '✔ Exercício concluído!' : '',
        drill: this.state === 'success' ? null : {
          n: L.drill.length, i: this.di, t: step.t, did: step.did, want: this.dWant || step.want || {}, tol: this.dTol || step.tol,
          frac: this.dFrac || 0, ok: this.dOk, flash: this.dFlash, track: !!step.track, analog: !!step.analog,
        },
      };
    }
    return {
      title: `ACADEMIA DJI · ${this.index + 1}/${LESSONS.length} · ${this.lesson.title}`,
      rows: this.hint && this.state === 'practice' ? [['Modo de voo', this.sim.settings.flightMode], ['Dica', this.hint]] : [['Modo de voo', this.sim.settings.flightMode]], progress: this.progress,
      center: this.state === 'success' ? '✔ Lição concluída!' : '', target,
    };
  }
}

// ---------------------------------------------------------------------
export class BuilderMode extends BaseMode {
  start() {
    this.placed = [];
    if (this.opts.edit) for (const d of this.opts.edit.gates) { const gt = this.world.addGate(d); this.world.setGateNumber(gt, this.placed.length + 1); this.placed.push({ def: d, gate: gt }); }
    this.restyle();
    this.game.spawnAtStart();
    this.game.toast('Criar pista: decole (T), voe até o lugar desejado e aperte G para colocar um portão. Z desfaz, ENTER salva.');
  }
  restyle() { this.placed.forEach((p, i) => styleGate(p.gate, i === 0 ? 'next' : 'after')); }
  event(ev) {
    if (ev === 'placeGate') {
      const s = this.sim, f = s.forward();
      const yaw = Math.atan2(-f[0], -f[2]);
      const x = s.pos[0] + -Math.sin(yaw) * 5, z = s.pos[2] + -Math.cos(yaw) * 5;
      const gh = this.world.groundHeight(x, z);
      const y = Math.max(0, s.pos[1] - gh - 1.2);
      const def = { x: +x.toFixed(2), z: +z.toFixed(2), y: +y.toFixed(2), yaw: +yaw.toFixed(3) };
      { const gt = this.world.addGate(def); this.world.setGateNumber(gt, this.placed.length + 1); this.placed.push({ def, gate: gt }); }
      this.restyle(); this.game.audio.gate();
      return true;
    }
    if (ev === 'undoGate') {
      const p = this.placed.pop(); if (p) this.world.removeGate(p.gate); this.restyle();
      return true;
    }
    if (ev === 'enter') {
      if (this.placed.length < 2) { this.game.toast('Coloque pelo menos 2 portões.'); return true; }
      this.game.askTrackName((name) => {
        const list = LS.get('djisim.customTracks', []);
        const t = { id: 'custom-' + Date.now(), name: name || 'Minha pista', map: this.game.mapDef.id, laps: 3, gates: this.placed.map((p) => p.def), custom: true, difficulty: 'Custom' };
        list.push(t); LS.set('djisim.customTracks', list);
        this.game.toast(`Pista "${t.name}" salva! Ela aparece em Corrida > ${this.game.mapDef.name}.`);
      });
      return true;
    }
    return false;
  }
  hud() { return { title: 'CRIAR PISTA · ' + this.game.mapDef.name, rows: [['Portões', this.placed.length], ['G', 'colocar portão'], ['Z', 'desfazer'], ['ENTER', 'salvar pista']] }; }
}
