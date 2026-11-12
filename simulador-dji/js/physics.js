// Simulação dos drones DJI (sem dependências; testável no Node).
// Cadeia: sticks -> (modos C/N/S: piloto de velocidade com GPS | modo M: rates acro)
// -> controladora (PID + mixer) -> motores (curva de RPM) -> hélices -> física
// (arrasto, prop wash, efeito solo, vento) + bateria e dano.
// Recursos DJI: freio, decolagem/pouso automáticos, voltar para casa (RTH),
// limite de altitude, proteção de pouso e desvio de obstáculos.
//
// Eixos do corpo (iguais ao Three.js): x = direita, y = cima, z = trás (nariz em -z).

// ---------- matemática mínima ----------
export const V = {
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  mul: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  len: (a) => Math.hypot(a[0], a[1], a[2]),
  norm: (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
};
export const Q = {
  // q = [x, y, z, w]
  rotate(q, v) {
    const [x, y, z, w] = q;
    const ix = w * v[0] + y * v[2] - z * v[1];
    const iy = w * v[1] + z * v[0] - x * v[2];
    const iz = w * v[2] + x * v[1] - y * v[0];
    const iw = -x * v[0] - y * v[1] - z * v[2];
    return [ix * w + iw * -x + iy * -z - iz * -y, iy * w + iw * -y + iz * -x - ix * -z, iz * w + iw * -z + ix * -y - iy * -x];
  },
  inv: (q) => [-q[0], -q[1], -q[2], q[3]],
  mul(a, b) {
    return [
      a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
      a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
      a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
      a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
    ];
  },
  normalize(q) { const l = Math.hypot(q[0], q[1], q[2], q[3]) || 1; return [q[0] / l, q[1] / l, q[2] / l, q[3] / l]; },
  fromYaw(yaw) { return [0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)]; },
  fromAxisAngle(ax, ang) { const s = Math.sin(ang / 2); return [ax[0] * s, ax[1] * s, ax[2] * s, Math.cos(ang / 2)]; },
  // a partir dos eixos x, y, z do corpo escritos no mundo (colunas da matriz de rotação)
  fromBasis(x, y, z) {
    const m00 = x[0], m01 = y[0], m02 = z[0], m10 = x[1], m11 = y[1], m12 = z[1], m20 = x[2], m21 = y[2], m22 = z[2];
    const tr = m00 + m11 + m22;
    let q;
    if (tr > 0) { const k = 0.5 / Math.sqrt(tr + 1); q = [(m21 - m12) * k, (m02 - m20) * k, (m10 - m01) * k, 0.25 / k]; }
    else if (m00 > m11 && m00 > m22) { const k = 2 * Math.sqrt(1 + m00 - m11 - m22); q = [0.25 * k, (m01 + m10) / k, (m02 + m20) / k, (m21 - m12) / k]; }
    else if (m11 > m22) { const k = 2 * Math.sqrt(1 + m11 - m00 - m22); q = [(m01 + m10) / k, 0.25 * k, (m12 + m21) / k, (m02 - m20) / k]; }
    else { const k = 2 * Math.sqrt(1 + m22 - m00 - m11); q = [(m02 + m20) / k, (m12 + m21) / k, 0.25 * k, (m10 - m01) / k]; }
    return Q.normalize(q);
  },
};
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const wrapA = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const DEG = Math.PI / 180;
const G = 9.81;

// ---------- curvas de rates do modo M (Betaflight / KISS / RaceFlight) ----------
export function rateDegPerSec(type, rc, r) {
  const a = Math.abs(rc);
  if (type === 'kiss') {
    const use = 1 / clamp(1 - a * r.superRate, 0.01, 1);
    const cmd = (rc * rc * rc * r.expo + rc * (1 - r.expo)) * (r.rcRate / 10);
    return clamp(2000 * use * cmd, -1998, 1998);
  }
  if (type === 'raceflight') {
    const maxRate = r.rcRate * 370;
    const expoed = rc * (1 + r.expo * (rc * rc - 1));
    const acroPlus = 1 + r.superRate * a * a * 1.6;
    return clamp(maxRate * expoed * acroPlus, -1998, 1998);
  }
  let x = rc;
  if (r.expo) x = rc * a * a * a * r.expo + rc * (1 - r.expo);
  let rcRate = r.rcRate;
  if (rcRate > 2) rcRate += (rcRate - 2) * 14.54;
  let ang = 200 * rcRate * x;
  if (r.superRate) ang *= 1 / clamp(1 - Math.abs(x) * r.superRate, 0.01, 1);
  return clamp(ang, -1998, 1998);
}

// ---------- drones (valores aproximados das fichas técnicas) ----------
// modes: v = velocidade horizontal máx (m/s), up/down = subida/descida (m/s),
// tilt = inclinação máx (°), yaw = giro máx (°/s), smooth = suavização dos comandos (s).
export const QUADS = {
  avata2: {
    name: 'DJI Avata 2', short: 'AVATA 2', kind: 'fpv', model: 'avata2',
    desc: 'FPV compacto com protetores de hélice. Voa pelos óculos DJI Goggles.',
    mass: 0.377, arm: 0.062, twr: 4.4, motorTau: 0.02, yawRatio: 0.014, radius: 0.12, protected: true,
    cells: 4, capacity: 2.15, flightMin: 23, propWash: 0.8, sound: 1.25,
    camera: { fov: 98, fisheye: 3, tiltMin: -80, tiltMax: 60, lens: '1/1.3" · 155°', video: '4K 60fps', zoom: [1] },
    modes: {
      N: { v: 8, up: 6, down: 6, tilt: 35, yaw: 110, smooth: 0.18, ysmooth: 0.25 },
      S: { v: 16, up: 9, down: 9, tilt: 60, yaw: 190, smooth: 0.12, ysmooth: 0.18 },
      M: { v: 27 },
    },
    stats: { 'Velocidade máx.': '97 km/h', 'Tempo de voo': '23 min', 'Peso': '377 g', 'Câmera': '4K 60fps · 155°' },
  },
  djifpv: {
    name: 'DJI FPV', short: 'DJI FPV', kind: 'fpv', model: 'djifpv',
    desc: 'FPV híbrido de alta velocidade: 0 a 100 km/h em 2 segundos.',
    mass: 0.795, arm: 0.088, twr: 5.0, motorTau: 0.024, yawRatio: 0.016, radius: 0.14,
    cells: 6, capacity: 2.0, flightMin: 20, propWash: 1, sound: 0.9,
    camera: { fov: 92, fisheye: 3, tiltMin: -50, tiltMax: 58, lens: '1/2.3" · 150°', video: '4K 60fps', zoom: [1] },
    modes: {
      N: { v: 15, up: 8, down: 5, tilt: 45, yaw: 120, smooth: 0.18, ysmooth: 0.25 },
      S: { v: 27, up: 15, down: 10, tilt: 70, yaw: 200, smooth: 0.12, ysmooth: 0.18 },
      M: { v: 39 },
    },
    stats: { 'Velocidade máx.': '140 km/h', 'Tempo de voo': '20 min', 'Peso': '795 g', 'Câmera': '4K 60fps · 150°' },
  },
  mini5pro: {
    name: 'DJI Mini 5 Pro', short: 'MINI 5 PRO', kind: 'cam', model: 'mini',
    desc: 'Mini dobrável de menos de 250 g, com câmera de 1" e sensores de obstáculo.',
    mass: 0.249, arm: 0.082, twr: 2.4, motorTau: 0.035, yawRatio: 0.02, radius: 0.13,
    cells: 2, capacity: 2.79, flightMin: 36, propWash: 0.3, sound: 1.45, sensors: true,
    camera: { fov: 48, fisheye: 0, tiltMin: -90, tiltMax: 60, lens: '1" · 24 mm', video: '4K 120fps', zoom: [1, 2, 4] },
    modes: {
      C: { v: 5, up: 3, down: 3, tilt: 20, yaw: 40, smooth: 0.9 },
      N: { v: 12, up: 5, down: 4, tilt: 30, yaw: 80, smooth: 0.35 },
      S: { v: 18, up: 6, down: 6, tilt: 40, yaw: 130, smooth: 0.2 },
    },
    stats: { 'Velocidade máx.': '65 km/h', 'Tempo de voo': '36 min', 'Peso': '249 g', 'Câmera': '1" · 4K 120fps' },
  },
  air3s: {
    name: 'DJI Air 3S', short: 'AIR 3S', kind: 'cam', model: 'air',
    desc: 'Duas câmeras (grande-angular e tele 70 mm) e desvio de obstáculos em todas as direções.',
    mass: 0.724, arm: 0.105, twr: 2.5, motorTau: 0.04, yawRatio: 0.02, radius: 0.16,
    cells: 4, capacity: 4.28, flightMin: 45, propWash: 0.3, sound: 1.1, sensors: true,
    camera: { fov: 48, fisheye: 0, tiltMin: -90, tiltMax: 60, lens: '1" 24 mm + 70 mm', video: '4K 60fps', zoom: [1, 3, 6] },
    modes: {
      C: { v: 5, up: 3, down: 3, tilt: 20, yaw: 40, smooth: 0.9 },
      N: { v: 12, up: 6, down: 6, tilt: 30, yaw: 90, smooth: 0.35 },
      S: { v: 21, up: 10, down: 8, tilt: 42, yaw: 150, smooth: 0.2 },
    },
    stats: { 'Velocidade máx.': '76 km/h', 'Tempo de voo': '45 min', 'Peso': '724 g', 'Câmera': '24 + 70 mm · 4K' },
  },
  mavic4pro: {
    name: 'DJI Mavic 4 Pro', short: 'MAVIC 4 PRO', kind: 'cam', model: 'mavic',
    desc: 'Três câmeras num gimbal que gira 360° e olha até 70° para cima.',
    mass: 1.063, arm: 0.13, twr: 2.5, motorTau: 0.045, yawRatio: 0.022, radius: 0.19,
    cells: 4, capacity: 6.65, flightMin: 51, propWash: 0.25, sound: 0.95, sensors: true,
    camera: { fov: 42, fisheye: 0, tiltMin: -90, tiltMax: 70, lens: '4/3" 28 + 70 + 168 mm', video: '6K 60fps', zoom: [1, 2.5, 6] },
    modes: {
      C: { v: 5, up: 3, down: 3, tilt: 20, yaw: 40, smooth: 0.9 },
      N: { v: 15, up: 6, down: 6, tilt: 30, yaw: 90, smooth: 0.35 },
      S: { v: 25, up: 10, down: 8, tilt: 42, yaw: 150, smooth: 0.2 },
    },
    stats: { 'Velocidade máx.': '90 km/h', 'Tempo de voo': '51 min', 'Peso': '1063 g', 'Câmera': '3 câmeras · 6K' },
  },
};

// Deriva as constantes físicas de cada drone a partir da ficha.
for (const [key, q] of Object.entries(QUADS)) {
  q.key = key;
  q.modeList = Object.keys(q.modes);
  q.maxThrust = (q.mass * G * q.twr) / 4;
  const a2 = q.arm * q.arm;
  q.inertia = [0.42 * q.mass * a2, 0.75 * q.mass * a2, 0.42 * q.mass * a2];
  // ganhos do PID proporcionais à inércia / autoridade de torque (base: racer 5" calibrado)
  const kRP = (q.inertia[0] / (q.maxThrust * q.arm)) / 0.00237;
  const kY = (q.inertia[1] / (q.maxThrust * q.yawRatio)) / 0.0283;
  q.pid = { rp: [0.018 * kRP, 0.09 * kRP, 0.00016 * kRP], y: q.kind === 'fpv' ? [0.22 * kY, 0.9 * kY, 0] : [0.12 * kY, 0.5 * kY, 0] };
  // arrasto para que a velocidade máxima seja alcançável (e não muito além)
  const hov = Math.pow((q.mass * G) / 4 / q.maxThrust, 1 / 1.5);
  q.linDrag = 0.03 * q.mass;
  q.propDrag = 0.012 * q.mass;
  // arrasto efetivo cresce com a inclinação (o drone vira uma "placa" contra o vento)
  const cdK = (th) => 1 + 1.6 * Math.sin(th);
  let vt, Tav, th;
  if (q.modes.M) {
    vt = q.modes.M.v; Tav = Math.sqrt(Math.max(0, Math.pow(4 * q.maxThrust * 0.9, 2) - Math.pow(q.mass * G, 2)));
    th = Math.atan2(Tav, q.mass * G);
  } else { vt = q.modes.S.v * 1.12; th = q.modes.S.tilt * DEG; Tav = q.mass * G * Math.tan(th); }
  const rest = q.linDrag * vt + q.propDrag * 4 * hov * vt * 0.5;
  q.dragFront = Math.max(0.002, (Tav - rest) / (vt * vt * cdK(th)));
  q.dragTop = q.dragFront * 2.6;
  // garante inclinação suficiente para cada modo assistido chegar à velocidade da ficha
  for (const P of Object.values(q.modes)) {
    if (!P.tilt) continue;
    const v = P.v * 1.08;
    for (let t = P.tilt; t <= 78; t += 1) {
      const need = q.dragFront * cdK(t * DEG) * v * v + q.linDrag * v;
      if (q.mass * G * Math.tan(t * DEG) >= need) { P.tilt = t; break; }
      P.tilt = t;
    }
  }
  // velocidade máxima de inclinação de cada modo assistido (°/s): suave no C/N, mais viva no S
  for (const P of Object.values(q.modes)) {
    if (!P.tilt || P.att) continue;
    P.att = q.kind === 'fpv' ? (P.tilt > 50 ? 300 : 180) : P.v <= 6 ? 45 : P.tilt > 35 ? 140 : 95;
    P.acc = P.acc || (q.kind === 'fpv' ? (P.tilt > 50 ? 10 : 7) : P.v <= 6 ? 2.5 : P.tilt > 35 ? 7 : 5);
  }
  // corrente para bater o tempo de voo da ficha pairando
  q.maxCurrent = ((q.capacity * 60 * 0.85) / q.flightMin - 0.4) / (4 * hov * hov);
  q.resistance = 0.012 * q.cells / q.capacity;
  q.hover = hov;
}

const MOTOR_POS = [[-1, 0, -1], [1, 0, -1], [-1, 0, 1], [1, 0, 1]];
const MOTOR_SPIN = [-1, 1, 1, -1];
const MIX = [
  [+1, +1, -1], // FL
  [+1, -1, +1], // FR
  [-1, -1, -1], // RL
  [-1, +1, +1], // RR
];

function lipoOCV(soc) {
  const pts = [[0, 3.0], [0.05, 3.3], [0.1, 3.5], [0.25, 3.68], [0.5, 3.8], [0.8, 3.98], [1, 4.2]];
  for (let i = 1; i < pts.length; i++) {
    if (soc <= pts[i][0]) {
      const [a, va] = pts[i - 1], [b, vb] = pts[i];
      return va + ((soc - a) / (b - a)) * (vb - va);
    }
  }
  return 4.2;
}

class PID {
  constructor() { this.i = 0; this.lastMeas = 0; this.lastTarget = 0; this.hp = 0; }
  reset() { this.i = 0; }
  // lim: saída máxima do motor nesse eixo; saturado, não acumula mais o integral (anti-windup)
  step(target, meas, g, dt, tpa, lim = Infinity) {
    const e = target - meas;
    const dTarget = (target - this.lastTarget) / dt;
    this.hp += (Math.abs(dTarget) - this.hp) * Math.min(1, dt * 40);
    const relax = Math.max(0, 1 - this.hp / 15);
    const i0 = this.i;
    this.i = clamp(this.i + e * dt * relax, -0.8, 0.8);
    const d = (meas - this.lastMeas) / dt;
    this.lastMeas = meas; this.lastTarget = target;
    const out = (g[0] * e + g[1] * this.i - g[2] * d + g[0] * 0.04 * dTarget * dt * 25) * tpa;
    if (Math.abs(out) > lim && Math.sign(e) === Math.sign(out)) this.i = i0;
    return out;
  }
}

export class DroneSim {
  constructor(quadKey = 'avata2', settings = {}) {
    this.settings = Object.assign({
      flightMode: 'N', rateType: 'betaflight',
      rates: { rp: { rcRate: 1.0, superRate: 0.7, expo: 0.0 }, y: { rcRate: 1.0, superRate: 0.65, expo: 0.0 } },
      motorIdle: 0.055, throttleLimit: 1, throttleExpo: 0.0,
      allowDamage: false, infiniteBattery: false, airmode: true,
      propWash: 1.0, groundEffect: 1.0, wind: 0.0, gravity: G,
      obstacle: true, maxAlt: 120, rthAlt: 30,
    }, settings);
    this.setQuad(quadKey);
    this.reset([0, 1, 0], 0);
  }

  setQuad(key) {
    this.quadKey = key;
    this.q = QUADS[key];
    if (!this.q.modes[this.settings.flightMode]) this.settings.flightMode = 'N';
  }

  reset(pos, yaw) {
    this.pos = pos.slice();
    this.vel = [0, 0, 0];
    this.rot = Q.fromYaw(yaw);
    this.heading = yaw;
    this.w = [0, 0, 0];
    this.rpm = [0, 0, 0, 0];
    this.motorCmd = [0, 0, 0, 0];
    this.propHealth = [1, 1, 1, 1];
    this.cameraDamage = 0;
    this.pids = [new PID(), new PID(), new PID()];
    this.armed = false;
    this.crashed = false;
    this.frozen = false;
    this.soc = 1;
    this.mAh = 0;
    this.current = 0;
    this.voltage = this.q.cells * 4.2;
    this.vFactor = 1;
    this.batteryDead = false;
    this.washNoise = [0, 0, 0];
    this.wind = [0, 0, 0];
    this.onGround = true;
    this.landedT = 0;
    this.groundTimer = 0;
    this.lastImpact = 0;
    this.impactEvents = [];
    this.events = [];
    this.flags = {};
    this.flightTime = 0;
    this.speed = 0;
    this.home = pos.slice();
    this.auto = null; // tarefa automática: takeoff | land | rth | brake
    this.vi = [0, 0, 0]; // integral do controle de velocidade
    this.cmd = [0, 0, 0, 0]; // comandos suavizados [frente, lado, vertical, yaw]
    this.obsT = 0; this.obsLimit = null;
  }

  recharge() { this.soc = 1; this.mAh = 0; this.batteryDead = false; }
  repair() { this.propHealth = [1, 1, 1, 1]; this.cameraDamage = 0; this.crashed = false; }

  up() { return Q.rotate(this.rot, [0, 1, 0]); }
  forward() { return Q.rotate(this.rot, [0, 0, -1]); }
  right() { return Q.rotate(this.rot, [1, 0, 0]); }

  get assisted() { return this.settings.flightMode !== 'M' || !!this.auto; }
  get mode() { return this.q.modes[this.settings.flightMode] || this.q.modes.N; }
  agl(world) { return this.pos[1] - (world ? world.groundHeight(this.pos[0], this.pos[2]) : 0); }

  startMotors() {
    if (this.crashed || this.batteryDead) return 'Não é possível ligar: ' + (this.crashed ? 'drone danificado' : 'bateria vazia');
    this.armed = true;
    this.vi = [0, 0, 0];
    this.pids.forEach((p) => p.reset());
    return null;
  }
  tryArm(throttle) {
    if (this.settings.flightMode === 'M' && throttle > 0.06) return 'Abaixe o acelerador para ligar os motores';
    return this.startMotors();
  }
  disarm() { this.armed = false; this.auto = null; }

  // ---------- tarefas automáticas ----------
  takeoff() {
    const err = this.armed ? null : this.startMotors();
    if (err) return err;
    if (this.settings.flightMode === 'M') this.settings.flightMode = 'N';
    this.auto = { type: 'takeoff', y: this.pos[1] + 1.2 };
    this.home = this.pos.slice();
    return null;
  }
  land() { if (this.armed) this.auto = { type: 'land' }; }
  rth() {
    if (!this.armed) return;
    this.auto = { type: 'rth', phase: 'climb', alt: Math.max(this.settings.rthAlt + this.home[1], this.pos[1]) };
  }
  brake() { if (this.armed) this.auto = { type: 'brake', t: 0 }; }
  cancelAuto() { this.auto = null; }

  // ---------- modo M: rates acro ----------
  acroRates(input) {
    const s = this.settings;
    const roll = rateDegPerSec(s.rateType, input.roll, s.rates.rp) * DEG;
    const pitch = rateDegPerSec(s.rateType, input.pitch, s.rates.rp) * DEG;
    const yaw = rateDegPerSec(s.rateType, input.yaw, s.rates.y) * DEG;
    return [-pitch, -yaw, -roll];
  }

  // ---------- drones FPV nos modos N/S: voo livre como no simulador original ----------
  // Stick inclina o drone (modo ângulo). Stick solto: freia naquele eixo e trava a posição no ar (GPS),
  // como nos DJI FPV/Avata nos modos N e S (desligável em settings.fpvBrake: aí segue no embalo).
  freeAngle(dt, input, world) {
    const q = this.q, s = this.settings, P = q.modes[s.flightMode] || q.modes.N;
    this.yawSet = null;
    const r = this.right(), f = this.forward(), u = this.up();
    let curRoll = Math.asin(clamp(-r[1], -1, 1));
    const curPitch = Math.asin(clamp(-f[1], -1, 1));
    if (u[1] < 0) curRoll = Math.sign(curRoll || 1) * (Math.PI - Math.abs(curRoll));
    const maxA = P.tilt * DEG, k = 7.5;
    let wantRoll = (input.roll || 0) * maxA, wantPitch = (input.pitch || 0) * maxA;
    if (s.fpvBrake !== false && !this.onGround) {
      // velocidade em relação ao nariz (frente) e ao lado direito
      const hd = this.heading, fx = -Math.sin(hd), fz = -Math.cos(hd), rx = Math.cos(hd), rz = -Math.sin(hd);
      const vf = this.vel[0] * fx + this.vel[2] * fz, vr = this.vel[0] * rx + this.vel[2] * rz;
      const sp = Math.abs(input.pitch || 0), sr = Math.abs(input.roll || 0);
      // os dois sticks soltos e quase parado: guarda o ponto e segura ali (corrige vento e deriva)
      if (sp < 0.06 && sr < 0.06) {
        if (!this.holdXZ && Math.hypot(this.vel[0], this.vel[2]) < 0.5) this.holdXZ = [this.pos[0], this.pos[2]];
      } else this.holdXZ = null;
      let tf = 0, tr = 0;
      if (this.holdXZ) {
        const dx = this.holdXZ[0] - this.pos[0], dz = this.holdXZ[1] - this.pos[2];
        tf = clamp((dx * fx + dz * fz) * 0.8, -1.5, 1.5); tr = clamp((dx * rx + dz * rz) * 0.8, -1.5, 1.5);
      }
      // frenagem: no S mais longa (mais embalo), no N mais firme; girando, freia mais macio (a câmera não balança)
      // (o efeito do giro some aos poucos, ~0,6 s, para não dar um tranco de lado ao soltar o giro)
      const ya = Math.abs(input.yaw || 0), yp = this.brakeYaw ?? 0;
      this.brakeYaw = ya > yp ? ya : yp + (ya - yp) * (1 - Math.exp(-dt / 0.6));
      const aMax = (P.brake || (P.tilt > 50 ? 7 : 8.5)) * (1 - 0.75 * this.brakeYaw), lim = maxA * 0.85;
      const brakeAng = (v, t) => clamp(Math.atan(clamp((t - v) * 1.6, -aMax, aMax) / G), -lim, lim);
      const sm = (x) => { const t = clamp((x - 0.06) / 0.14, 0, 1); return t * t * (3 - 2 * t); };
      // só freia com o stick direito TODO solto: com o stick em uso, nenhum eixo se mexe sozinho
      // (frear o lado durante a curva inclinava o drone sozinho e a câmera "sambava")
      const b = 1 - sm(Math.max(sp, sr)); // 1 = stick solto (freia), 0 = stick em uso
      wantPitch = wantPitch * (1 - b) + brakeAng(vf, tf) * b;
      wantRoll = wantRoll * (1 - b) + brakeAng(vr, tr) * b;
    } else this.holdXZ = null;
    const angRoll = clamp((wantRoll - curRoll) * k, -12, 12);
    const angPitch = clamp((wantPitch - curPitch) * k, -12, 12);
    // giro em torno do eixo vertical (não desmancha a inclinação)
    const yb = Q.rotate(Q.inv(this.rot), [0, -(input.yaw || 0) * P.yaw * DEG, 0]);
    const target = [-angPitch + yb[0], yb[1], -angRoll + yb[2]];
    // altura: stick esquerdo sobe/desce, no centro segura a altura
    const gh = world ? world.groundHeight(this.pos[0], this.pos[2]) : 0, agl = this.pos[1] - gh;
    const lift = input.lift ?? 0;
    let vz = lift >= 0 ? lift * P.up : lift * P.down;
    if (vz < 0) vz = Math.max(vz, -Math.max(0.5, (agl - 0.15) * 1.4));
    const alt = this.pos[1] - this.home[1];
    this.flags.altLimit = false; this.flags.obstacle = false;
    if (vz > 0 && alt > s.maxAlt - 2) { vz = Math.min(vz, (s.maxAlt - alt) * 1.2); this.flags.altLimit = alt > s.maxAlt - 0.6; }
    if (Math.abs(lift) < 0.05 && !this.onGround) {
      if (this.holdY == null && Math.abs(this.vel[1]) < 0.5) this.holdY = this.pos[1];
      if (this.holdY != null) vz += clamp((this.holdY - this.pos[1]) * 1.5, -1.5, 1.5);
    } else this.holdY = null;
    const ey = vz - this.vel[1];
    if (this.onGround && vz <= 0.05) this.vi[1] = 0;
    else if (Math.abs(ey) < 1) this.vi[1] = clamp(this.vi[1] + ey * dt * 2.0, -5, 5);
    else this.vi[1] *= 1 - dt * 2;
    const ay = clamp(ey * 4.5 + this.vi[1], -G * 0.7, G * 1.5);
    const T = (q.mass * (G + ay)) / Math.max(0.35, u[1]);
    const per = T / 4 / (q.maxThrust * this.vFactor * (this.ge || 1));
    const rpm = Math.pow(clamp(per, 0, 1), 1 / 1.5);
    const idle = s.motorIdle;
    let thr = clamp((rpm - idle) / (1 - idle), 0, 1);
    if (this.onGround && vz <= 0.05) thr = 0;
    return { target, thr };
  }

  // ---------- modos C/N/S e tarefas: piloto de velocidade (GPS) ----------
  // Devolve as rotações alvo do corpo e o acelerador coletivo.
  assist(dt, input, world) {
    const q = this.q, s = this.settings;
    const P = this.settings.flightMode === 'M' || !q.modes[s.flightMode] ? (q.modes.S || q.modes.N) : q.modes[s.flightMode];
    // direção pedida pelo piloto: a controladora guarda e segue (não escorrega com o drone muito inclinado)
    if (this.yawSet == null || this.onGround) this.yawSet = this.heading;
    const yaw = this.yawSet;
    const fwd = [-Math.sin(yaw), 0, -Math.cos(yaw)], rgt = [Math.cos(yaw), 0, -Math.sin(yaw)];
    const shape = (x) => Math.sign(x) * Math.pow(Math.abs(x), 1.25);
    const flags = this.flags;
    const gh = world ? world.groundHeight(this.pos[0], this.pos[2]) : 0;
    const agl = this.pos[1] - gh;

    // comandos do piloto, suavizados conforme o modo (Cine bem macio)
    let want = [shape(input.pitch), shape(input.roll), input.lift ?? 0, input.yaw];
    const stickAct = Math.max(Math.abs(input.pitch), Math.abs(input.roll), Math.abs(input.yaw), Math.abs(input.lift ?? 0));
    const a = this.auto;
    if (a && a.type !== 'brake' && stickAct > 0.45 && a.type !== 'takeoff') { this.auto = null; this.events.push('autoCancel'); }
    if (a && a.type === 'brake') { a.t += dt; if (a.t > 0.6 && stickAct > 0.15) this.auto = null; }
    const k = 1 - Math.exp(-dt / Math.max(0.02, P.smooth || 0.15));
    const ky = 1 - Math.exp(-dt / Math.max(0.02, P.ysmooth || P.smooth || 0.15));
    for (let i = 0; i < 4; i++) this.cmd[i] += (want[i] - this.cmd[i]) * (i === 3 ? ky : k);
    let vdes = V.add(V.mul(fwd, this.cmd[0] * P.v), V.mul(rgt, this.cmd[1] * P.v));
    let vz = this.cmd[2] >= 0 ? this.cmd[2] * P.up : this.cmd[2] * P.down;
    let yawRate = -this.cmd[3] * P.yaw * DEG;

    // controle por movimento (Motion Controller): voa para onde a câmera aponta
    if (input.motion && !this.auto) {
      const m = input.motion, sp = m.trigger * P.v;
      const ch = Math.cos(m.aim), sh = Math.sin(m.aim);
      vdes = V.mul(fwd, sp * ch);
      vz = clamp(sp * sh, -P.down, P.up) + (input.lift ?? 0) * P.up * 0.6;
    }

    // tarefas automáticas
    if (this.auto) {
      const t = this.auto;
      if (t.type === 'brake') { vdes = [0, 0, 0]; vz = 0; yawRate = 0; }
      if (t.type === 'takeoff') {
        vdes = [0, 0, 0]; vz = clamp((t.y - this.pos[1]) * 2.2, -1, 2.2); yawRate = -input.yaw * P.yaw * DEG;
        if (Math.abs(t.y - this.pos[1]) < 0.12 && Math.abs(this.vel[1]) < 0.3) { this.auto = null; this.events.push('takeoffDone'); }
      }
      if (t.type === 'land') { vdes = [0, 0, 0]; vz = -clamp(agl * 0.8, 0.6, 3); yawRate = 0; }
      if (t.type === 'custom') {
        // voo automático programado (QuickShots): devolve velocidade e giro desejados
        const r = t.get(this, dt);
        vdes = [r.v[0], 0, r.v[2]]; vz = r.v[1]; yawRate = r.yaw || 0;
        if (r.done) { this.auto = null; this.events.push('shotDone'); }
      }
      if (t.type === 'rth') {
        const dx = this.home[0] - this.pos[0], dz = this.home[2] - this.pos[2], d = Math.hypot(dx, dz);
        if (t.phase === 'climb') {
          vdes = [0, 0, 0]; vz = clamp((t.alt - this.pos[1]) * 1.5, -2, P.up);
          if (this.pos[1] > t.alt - 0.5) t.phase = 'fly';
        } else if (t.phase === 'fly') {
          const sp = Math.min(P.v, q.modes.N.v, d * 0.8 + 0.5);
          vdes = [dx / (d || 1) * sp, 0, dz / (d || 1) * sp]; vz = clamp((t.alt - this.pos[1]) * 1.5, -2, 3);
          // aponta o nariz para casa
          const hy = Math.atan2(-dx, -dz);
          let e = hy - yaw; while (e > Math.PI) e -= 2 * Math.PI; while (e < -Math.PI) e += 2 * Math.PI;
          yawRate = clamp(e * 2, -1.5, 1.5);
          if (d < 0.6) { t.phase = 'land'; this.events.push('rthHome'); }
        } else { vdes = [this.home[0] - this.pos[0], 0, this.home[2] - this.pos[2]]; vz = -clamp(agl * 0.8, 0.6, 3); yawRate = 0; }
      }
    }

    this.yawSet = wrapA(this.yawSet + yawRate * dt);

    // proteção de pouso: desce devagar perto do chão
    if (vz < 0) vz = Math.max(vz, -Math.max(0.5, (agl - 0.15) * 1.4));
    // limite de altitude (relativo ao ponto de decolagem)
    const alt = this.pos[1] - this.home[1];
    flags.altLimit = false;
    if (vz > 0 && alt > s.maxAlt - 2) { vz = Math.min(vz, (s.maxAlt - alt) * 1.2); flags.altLimit = alt > s.maxAlt - 0.6; }

    // desvio de obstáculos (Frear): sonda à frente da direção pedida
    flags.obstacle = false;
    if (s.obstacle && q.sensors && world && this.settings.flightMode !== 'S' && (!this.auto || this.auto.type === 'rth')) {
      this.obsT -= dt;
      const sp = Math.hypot(vdes[0], vdes[2]);
      if (this.obsT <= 0) {
        this.obsT = 0.03; this.obsLimit = null;
        if (sp > 0.3) {
          const dir = [vdes[0] / sp, 0, vdes[2] / sp];
          for (const d of [0.8, 1.6, 2.5, 3.5, 5, 7, 9, 12]) {
            const p = [this.pos[0] + dir[0] * d, this.pos[1], this.pos[2] + dir[2] * d];
            if (world.collide(p, q.radius + 0.25).some((c) => c.n[1] < 0.7)) { this.obsLimit = { dir, d }; break; }
          }
        }
      }
      if (this.obsLimit && sp > 0.1) {
        const L = this.obsLimit;
        const along = vdes[0] * L.dir[0] + vdes[2] * L.dir[2];
        const allowed = Math.sqrt(2 * 3.2 * Math.max(0, L.d - 1.5));
        if (along > allowed) {
          const cut = along - allowed;
          vdes = [vdes[0] - L.dir[0] * cut, 0, vdes[2] - L.dir[2] * cut];
          flags.obstacle = true;
        }
      }
    }

    // stick vertical no centro: segura a altura atual (barômetro + sensores, como nos DJI)
    const liftIdle = Math.abs(input.lift ?? 0) < 0.05 && Math.abs(this.cmd[2]) < 0.08 && (!this.auto || this.auto.type === 'brake') && !input.motion;
    if (liftIdle && !this.onGround) {
      if (this.holdY == null && Math.abs(this.vel[1]) < 0.5) this.holdY = this.pos[1];
      if (this.holdY != null) vz += clamp((this.holdY - this.pos[1]) * 1.5, -1.5, 1.5);
    } else this.holdY = null;
    // sticks de movimento soltos: trava a posição no ar (GPS), sem escorregar nem derivar com vento
    const horizIdle = Math.abs(this.cmd[0]) < 0.03 && Math.abs(this.cmd[1]) < 0.03 && (!this.auto || this.auto.type === 'brake') && !input.motion;
    if (horizIdle && !this.onGround) {
      if (!this.holdXZ && Math.hypot(this.vel[0], this.vel[2]) < 0.4) this.holdXZ = [this.pos[0], this.pos[2]];
      if (this.holdXZ) {
        vdes = [vdes[0] + clamp((this.holdXZ[0] - this.pos[0]) * 0.8, -1.5, 1.5), vdes[1], vdes[2] + clamp((this.holdXZ[1] - this.pos[2]) * 0.8, -1.5, 1.5)];
      }
    } else this.holdXZ = null;

    // malha de velocidade -> aceleração desejada
    const kv = this.auto && this.auto.type === 'brake' ? 2.4 : q.kind === 'fpv' ? 1.8 : 1.6;
    const ex = vdes[0] - this.vel[0], ez = vdes[2] - this.vel[2], ey = vz - this.vel[1];
    const grounded = this.onGround && vz <= 0.05;
    if (grounded) this.vi = [0, 0, 0];
    else {
      // integra só perto do alvo e sem saturar a inclinação (anti-windup)
      if (Math.hypot(ex, ez) < 1.5 && !this.tiltSat) {
        this.vi[0] = clamp(this.vi[0] + ex * dt * 0.6, -3, 3);
        this.vi[2] = clamp(this.vi[2] + ez * dt * 0.6, -3, 3);
      } else { this.vi[0] *= 1 - dt * 2; this.vi[2] *= 1 - dt * 2; }
      if (Math.abs(ey) < 1) this.vi[1] = clamp(this.vi[1] + ey * dt * 2.0, -5, 5);
      else this.vi[1] *= 1 - dt * 2;
    }
    let ax = ex * kv + this.vi[0], az = ez * kv + this.vi[2];
    // limita a aceleração/frenagem pedida (sem mergulhar ou empinar a cada toque no stick)
    {
      const aMax = (P.acc || 6) * (this.auto && this.auto.type === 'brake' ? 1.3 : 1), al = Math.hypot(ax, az);
      if (al > aMax) { ax *= aMax / al; az *= aMax / al; }
    }
    // curva coordenada: a parte da curva que a inclinação aguenta é feita inclinando (com embalo);
    // o que passar do limite físico segue o nariz direto (sem derrapar)
    this.gripNow = 1;
    if (q.kind === 'fpv' && P.grip != null && (!this.auto || this.auto.type === 'custom')) {
      const aReq = Math.hypot(this.vel[0], this.vel[2]) * Math.abs(yawRate);
      if (aReq > 0.05) {
        const bank = Math.min(aReq * (1 - P.grip), G * Math.tan(P.tilt * DEG) * (globalThis.__bankK ?? 0.6));
        const cf = bank / aReq;
        this.gripNow = 1 - cf;
        ax += yawRate * this.vel[2] * cf; az += -yawRate * this.vel[0] * cf;
      } else this.gripNow = P.grip;
    }
    let ay = ey * 4.5 + this.vi[1];
    // compensa o arrasto na velocidade pedida (resposta mais firme em alta velocidade)
    const vdl = Math.hypot(vdes[0], vdes[2]);
    if (vdl > 0.5) {
      // arrasto na velocidade atual (na direção pedida, até a pedida), com a inclinação que ela exige
      const vNow = clamp((this.vel[0] * vdes[0] + this.vel[2] * vdes[2]) / vdl, 0, vdl);
      let drag = 0, th = 0;
      for (let it = 0; it < 3; it++) {
        const sn = Math.sin(th);
        drag = ((q.dragFront * (1 - sn) + q.dragTop * sn) * vNow * vNow + q.linDrag * vNow) / q.mass;
        th = Math.atan2(drag, G);
      }
      ax += (vdes[0] / vdl) * drag; az += (vdes[2] / vdl) * drag;
    }
    ay = clamp(ay, -G * 0.7, G * 1.5);
    let ty = G + ay;
    const tmax = P.tilt * DEG;
    const hl = Math.hypot(ax, az), hmax = ty * Math.tan(tmax);
    this.tiltSat = hl > hmax;
    if (this.tiltSat) {
      if (vdl > 0.5) {
        // sem inclinação sobrando: prioriza corrigir o lado (curvar) e sacrifica a aceleração para frente
        const dx = vdes[0] / vdl, dz = vdes[2] / vdl;
        let al = ax * dx + az * dz, px = ax - al * dx, pz = az - al * dz;
        const pl = Math.hypot(px, pz);
        if (pl >= hmax) { px *= hmax / pl; pz *= hmax / pl; al = 0; }
        else { const rem = Math.sqrt(hmax * hmax - pl * pl); al = clamp(al, -rem, rem); }
        ax = px + al * dx; az = pz + al * dz;
      } else { ax *= hmax / hl; az *= hmax / hl; }
    }
    const tdes = [ax, ty, az];
    const tl = V.len(tdes);
    const uDes = V.mul(tdes, 1 / tl);

    // atitude: gira o "para cima" do corpo até a direção do empuxo pedido
    // orientação desejada: "para cima" = direção do empuxo e nariz na direção guardada
    const fd = [-Math.sin(this.yawSet), 0, -Math.cos(this.yawSet)];
    // nariz perpendicular ao empuxo, ajustado só na vertical (mantém a direção horizontal pedida)
    const fp = V.norm([fd[0], -V.dot(fd, uDes) / Math.max(0.2, uDes[1]), fd[2]]);
    const zb = V.mul(fp, -1), xb = V.cross(uDes, zb);
    let qe = Q.mul(Q.inv(this.rot), Q.fromBasis(xb, uDes, zb));
    if (qe[3] < 0) qe = qe.map((v) => -v);
    const sh = Math.hypot(qe[0], qe[1], qe[2]), ang = 2 * Math.atan2(sh, qe[3]);
    const e = sh > 1e-9 ? [qe[0] / sh * ang, qe[1] / sh * ang, qe[2] / sh * ang] : [0, 0, 0];
    const kAtt = q.kind === 'fpv' ? 7 : 6;
    const rmax = (P.att || 120) * DEG;
    // perfil com frenagem: desacelera o giro antes de chegar no ângulo (sem passar do ponto)
    const alpha = rmax * 4;
    const prof = (x) => Math.sign(x) * Math.min(Math.abs(x) * kAtt, Math.sqrt(2 * alpha * Math.abs(x)) * 0.85, rmax);
    // nariz: volta ao rumo freando antes de chegar (antes era e·14 até 5 rad/s: depois de uma batida o giro
    // passava do ponto, voltava e ficava num vai-e-vem sem fim, a câmera "chacoalhava")
    const wy = Math.sign(e[1]) * Math.min(Math.abs(e[1]) * 8, Math.sqrt(2 * 5 * Math.abs(e[1])) * 0.8, 3.5);
    const wx = prof(e[0]), wz = prof(e[2]);
    // giro pedido (em torno do eixo vertical do mundo), convertido para o corpo
    const yb = Q.rotate(Q.inv(this.rot), [0, yawRate, 0]);
    const target = [wx + yb[0], wy + yb[1], wz + yb[2]];

    // empuxo coletivo
    const u = this.up();
    const cosE = Math.max(0.35, V.dot(u, uDes));
    const T = (q.mass * tl) / cosE;
    const per = T / 4 / (q.maxThrust * this.vFactor * (this.ge || 1));
    const rpm = Math.pow(clamp(per, 0, 1), 1 / 1.5);
    const idle = s.motorIdle;
    let thr = clamp((rpm - idle) / (1 - idle), 0, 1);
    if (grounded) thr = 0; // parado no chão: motores em marcha lenta
    return { target, thr };
  }

  step(dt, input, world) {
    if (this.frozen) return;
    const q = this.q, s = this.settings;
    const g = s.gravity;

    // rumo (heading) usado pelos modos assistidos
    const f0 = this.forward();
    if (Math.hypot(f0[0], f0[2]) > 0.03) this.heading = Math.atan2(-f0[0], -f0[2]);
    else { const wy = Q.rotate(this.rot, this.w)[1]; this.heading += wy * dt; }
    // modos C/N/S: ao girar, o movimento acompanha o nariz (curva com aderência, sem derrapar de lado)

    this.prevHd = this.heading;
    const ys0 = this.yawSet;

    const active = this.armed && !this.batteryDead && !this.crashed;
    let thr = clamp(input.throttle, 0, 1);
    let target = null;
    if (active) {
      if (this.assisted) {
        const free = q.kind === 'fpv' && !this.auto && s.flightMode !== 'M';
        const r = free ? this.freeAngle(dt, input, world) : this.assist(dt, input, world); target = r.target; thr = r.thr;
        if (ys0 != null && this.yawSet != null && !this.onGround && (!this.auto || this.auto.type === 'custom')) {
          const dh = wrapA(this.yawSet - ys0);
          if (dh && Math.abs(dh) < 0.2) {
            const a = dh * (q.kind === 'fpv' ? (this.gripNow ?? 1) : 0.95), c = Math.cos(a), sn = Math.sin(a), x = this.vel[0], zz = this.vel[2];
            this.vel = [x * c + zz * sn, this.vel[1], -x * sn + zz * c];
            if (this.holdXZ) this.holdXZ = null;
          }
        }
      }
      else {
        this.yawSet = null;
        if (s.throttleExpo) thr = thr * (1 - s.throttleExpo) + thr * thr * thr * s.throttleExpo;
        thr *= s.throttleLimit;
        target = this.acroRates(input);
      }
    }

    // ---------- controladora de voo ----------
    if (active) {
      const tpa = thr > 0.6 ? 1 - (thr - 0.6) * 0.5 : 1;
      const out = [
        this.pids[0].step(target[0], this.w[0], q.pid.rp, dt, tpa),
        this.pids[1].step(target[1], this.w[1], q.pid.y, dt, 1, 0.35),
        this.pids[2].step(target[2], this.w[2], q.pid.rp, dt, tpa),
      ];
      out[1] = clamp(out[1], -0.35, 0.35);
      const idle = s.motorIdle;
      const mix = MIX.map((m) => m[0] * out[0] + m[1] * out[1] + m[2] * out[2]);
      let mn = Math.min(...mix), mx = Math.max(...mix);
      const range = mx - mn;
      let scale = 1;
      if (range > 1 - idle) scale = (1 - idle) / range;
      const scaled = mix.map((v) => v * scale);
      mn *= scale; mx *= scale;
      let base = idle + thr * (1 - idle);
      if (s.airmode && !(this.assisted && this.onGround && thr === 0)) base = clamp(base, idle - mn, 1 - mx);
      else { for (let i = 0; i < 4; i++) scaled[i] *= this.onGround ? 0 : 1; }
      for (let i = 0; i < 4; i++) this.motorCmd[i] = clamp(base + scaled[i], 0, 1);
    } else {
      for (let i = 0; i < 4; i++) this.motorCmd[i] = 0;
      this.pids.forEach((p) => p.reset());
    }

    // ---------- bateria ----------
    let current = 0;
    for (let i = 0; i < 4; i++) current += q.maxCurrent * this.rpm[i] * this.rpm[i];
    current += 0.4;
    this.current = current;
    const ocv = lipoOCV(this.soc) * q.cells;
    this.voltage = Math.max(0, ocv - current * q.resistance);
    if (!s.infiniteBattery) {
      this.mAh += (current * dt) / 3.6;
      this.soc = Math.max(0, 1 - this.mAh / (q.capacity * 1000));
      if (this.soc <= 0.001) { this.batteryDead = true; this.armed = false; }
    }
    this.vFactor = Math.pow(clamp(this.voltage / (q.cells * 4.0), 0.5, 1.1), 1.6);

    // ---------- motores ----------
    const a = 1 - Math.exp(-dt / q.motorTau);
    const thrusts = [0, 0, 0, 0];
    let totalThrust = 0;
    const gh = world ? world.groundHeight(this.pos[0], this.pos[2]) : -1e9;
    const hAbove = this.pos[1] - gh;
    const geDist = q.arm * 8;
    const ge = hAbove < geDist && this.up()[1] > 0.5 ? 1 + 0.3 * s.groundEffect * Math.pow(1 - hAbove / geDist, 2) : 1;
    this.ge = ge;
    for (let i = 0; i < 4; i++) {
      const tgt = this.motorCmd[i] * (this.propHealth[i] > 0.05 ? 1 : 0);
      this.rpm[i] += (tgt - this.rpm[i]) * a;
      thrusts[i] = q.maxThrust * Math.pow(this.rpm[i], 1.5) * this.vFactor * this.propHealth[i] * ge;
      totalThrust += thrusts[i];
    }

    // ---------- forças ----------
    const up = this.up();
    let F = V.mul(up, totalThrust);
    F[1] -= q.mass * g;
    if (s.wind > 0) {
      for (let k = 0; k < 3; k += 2) this.wind[k] += ((Math.random() - 0.5) * 6 - this.wind[k] * 0.3) * dt * s.wind;
    }
    const vAir = V.sub(this.vel, V.mul(this.wind, s.wind * 3));
    const sp = V.len(vAir);
    this.speed = V.len(this.vel);
    if (sp > 1e-4) {
      const dir = V.mul(vAir, 1 / sp);
      const facing = Math.abs(V.dot(dir, up));
      const cd = q.dragTop * facing + q.dragFront * (1 - facing);
      F = V.add(F, V.mul(dir, -(cd * sp * sp + q.linDrag * sp)));
      const vPlanar = V.sub(vAir, V.mul(up, V.dot(vAir, up)));
      const rpmSum = this.rpm[0] + this.rpm[1] + this.rpm[2] + this.rpm[3];
      F = V.add(F, V.mul(vPlanar, -q.propDrag * rpmSum));
    }

    // ---------- torques ----------
    const arm = q.arm;
    let tau = [0, 0, 0];
    for (let i = 0; i < 4; i++) {
      const r = [MOTOR_POS[i][0] * arm, 0, MOTOR_POS[i][2] * arm];
      tau[0] += -r[2] * thrusts[i];
      tau[2] += r[0] * thrusts[i];
      tau[1] += -MOTOR_SPIN[i] * q.yawRatio * thrusts[i];
    }
    const vBodyUp = V.dot(this.vel, up);
    const washAmt = clamp((-vBodyUp - 2.5) / 8, 0, 1) * clamp(totalThrust / (q.mass * g), 0, 3) * s.propWash * q.propWash;
    for (let k = 0; k < 3; k++) {
      this.washNoise[k] += ((Math.random() - 0.5) * 2 - this.washNoise[k]) * Math.min(1, dt * 30);
      tau[k] += this.washNoise[k] * washAmt * q.maxThrust * arm * (k === 1 ? 0.1 : 0.35);
    }
    tau = V.add(tau, V.mul(this.w, -0.0015 * q.inertia[0] / 0.003 * 0.6));
    const I = q.inertia;
    const Iw = [I[0] * this.w[0], I[1] * this.w[1], I[2] * this.w[2]];
    const gyro = V.cross(this.w, Iw);
    for (let k = 0; k < 3; k++) this.w[k] += ((tau[k] - gyro[k]) / I[k]) * dt;
    for (let k = 0; k < 3; k++) this.w[k] = clamp(this.w[k], -40, 40);

    // ---------- integração ----------
    this.vel = V.add(this.vel, V.mul(F, dt / q.mass));
    this.pos = V.add(this.pos, V.mul(this.vel, dt));
    const wl = V.len(this.w);
    if (wl > 1e-9) {
      const dq = Q.fromAxisAngle(V.mul(this.w, 1 / wl), wl * dt);
      this.rot = Q.normalize(Q.mul(this.rot, dq));
    }
    if (this.armed && !this.onGround) this.flightTime += dt;

    if (world) this.collide(world, dt);

    // pouso: no chão com o stick para baixo (ou pousando sozinho) -> desliga os motores
    if (this.armed && this.assisted && this.onGround && this.up()[1] > 0.8) {
      const down = (input.lift ?? 0) < -0.3 || (this.auto && (this.auto.type === 'land' || (this.auto.type === 'rth' && this.auto.phase === 'land')));
      this.landedT = down ? this.landedT + dt : 0;
      if (this.landedT > 0.7) { this.armed = false; this.auto = null; this.landedT = 0; this.events.push('landed'); }
    } else this.landedT = 0;
  }

  collide(world, dt) {
    const radius = this.q.radius;
    const contacts = world.collide(this.pos, radius);
    this.onGround = false;
    for (const c of contacts) {
      this.pos = V.add(this.pos, V.mul(c.n, c.depth));
      const vn = V.dot(this.vel, c.n);
      if (c.n[1] > 0.6) this.onGround = true;
      if (vn < 0) {
        const impact = -vn;
        const e = impact > 3 ? 0.35 : 0.05;
        this.vel = V.sub(this.vel, V.mul(c.n, (1 + e) * vn));
        const fr = this.armed && c.n[1] < 0.6 ? 0.85 : 0.6;
        const vt = V.sub(this.vel, V.mul(c.n, V.dot(this.vel, c.n)));
        this.vel = V.add(V.mul(c.n, V.dot(this.vel, c.n)), V.mul(vt, Math.pow(fr, dt * 60)));
        if (impact > 2.5) {
          const kick = Math.min(impact, 25) * 0.9;
          for (let k = 0; k < 3; k++) this.w[k] += (Math.random() - 0.5) * kick;
          this.registerImpact(impact);
        }
      }
    }
    if (this.onGround && (!this.armed || (this.assisted && this.rpm[0] < this.q.hover * 0.9)) && this.speed < 0.8) {
      // parado no chão: amortece e endireita
      this.w = V.mul(this.w, 0.85);
      this.vel = V.mul(this.vel, 0.9);
      if (this.up()[1] < 0.2) {
        this.groundTimer += dt;
        if (this.groundTimer > 1.5) this.flipUpright();
      } else this.groundTimer = 0;
    } else this.groundTimer = 0;
  }

  flipUpright() {
    this.rot = Q.fromYaw(this.heading);
    this.pos[1] += 0.15;
    this.w = [0, 0, 0];
    this.groundTimer = 0;
  }

  registerImpact(impact) {
    this.lastImpact = impact;
    this.impactEvents.push(impact);
    if (!this.settings.allowDamage) return;
    const prot = this.q.protected ? 0.4 : 1;
    if (impact > 7) {
      const i = Math.floor(Math.random() * 4);
      this.propHealth[i] = Math.max(0, this.propHealth[i] - (impact - 7) * 0.07 * prot);
    }
    if (impact > 13) this.cameraDamage = Math.min(1, this.cameraDamage + (impact - 13) * 0.06 * prot);
    const broken = this.propHealth.filter((h) => h < 0.05).length;
    if (impact > 24 / prot || broken >= 2) { this.crashed = true; this.armed = false; this.auto = null; }
  }

  // tempo de voo restante estimado (s) com o consumo atual
  remainingTime() {
    const cur = Math.max(this.current, 4 * this.q.maxCurrent * this.q.hover * this.q.hover * 0.9 + 0.4);
    return (this.soc * this.q.capacity * 3600 * 0.85) / cur;
  }

  telemetry() {
    return {
      voltage: this.voltage, cell: this.voltage / this.q.cells, mAh: this.mAh, current: this.current,
      speedKmh: this.speed * 3.6, altitude: this.pos[1], armed: this.armed, crashed: this.crashed,
      batteryDead: this.batteryDead, flightTime: this.flightTime, rpm: this.rpm.slice(),
      battery: Math.round(this.soc * 100), remaining: this.remainingTime(),
    };
  }
}

export function hoverThrottle(quadKey) {
  return QUADS[quadKey].hover;
}
