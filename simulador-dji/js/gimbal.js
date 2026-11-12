// Gimbal físico da câmera.
// Cada eixo tem um motor que segura a câmera no ângulo pedido (mola + amortecedor), um pouco de
// atrito com o corpo (movimentos bruscos do drone passam de leve) e batentes mecânicos: se o drone
// inclina além do curso do motor, a câmera encosta no batente e é arrastada junto com o corpo.
import * as THREE from 'three';

const DEG = Math.PI / 180;
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// Gimbal de cada drone (cursos mecânicos aproximados das fichas técnicas DJI, em graus, relativos ao corpo).
// hz = rigidez do motor (frequência natural), damp = amortecimento, drag = atrito com o corpo,
// pan = tempo (s) que o eixo de giro leva para seguir o nariz.
export const GIMBALS = {
  avata2: { name: '1 eixo (inclinação) + roll do corpo', axes: 1, tilt: [-95, 90], hz: 5, damp: 0.65, drag: 25 },
  djifpv: { name: '1 eixo (inclinação) + roll do corpo', axes: 1, tilt: [-65, 70], hz: 5, damp: 0.65, drag: 28 },
  mini5pro: { name: '3 eixos', axes: 3, tilt: [-135, 80], roll: [-135, 135], yaw: [-30, 30], hz: 8, damp: 0.7, drag: 30, pan: 0.15 },
  air3s: { name: '3 eixos', axes: 3, tilt: [-135, 100], roll: [-45, 45], yaw: [-27, 27], hz: 7, damp: 0.72, drag: 28, pan: 0.17 },
  mavic4pro: { name: '3 eixos (Infinity, roll 360°)', axes: 3, tilt: [-140, 115], roll: [-180, 180], yaw: [-40, 40], hz: 6, damp: 0.75, drag: 25, pan: 0.2 },
};

// um eixo: ângulo da câmera no mundo (c) e sua velocidade (v)
class Axis {
  constructor(c = 0) { this.c = c; this.v = 0; }
  // alvo t, ângulo e velocidade do corpo nesse eixo, curso [lo, hi] relativo ao corpo
  step(h, t, body, bodyRate, lo, hi, k, d, f, isYaw) {
    const e = isYaw ? wrap(t - this.c) : t - this.c;
    const a = k * e - d * this.v + f * (bodyRate - this.v);
    this.v += a * h;
    this.c += this.v * h;
    // batente mecânico: o motor não passa do curso, a câmera vai junto com o corpo
    const j = isYaw ? wrap(this.c - body) : this.c - body;
    if (j > hi) { this.c = body + hi; if (this.v > bodyRate) this.v = bodyRate; }
    else if (j < lo) { this.c = body + lo; if (this.v < bodyRate) this.v = bodyRate; }
    if (isYaw) this.c = wrap(this.c);
  }
}

export class Gimbal {
  constructor(key) {
    this.key = key;
    this.spec = GIMBALS[key] || GIMBALS.mini5pro;
    this.ready = false;
    this.eul = new THREE.Euler(0, 0, 0, 'YXZ');
    this.prev = null;
    this.panT = 0;
    this.q = new THREE.Quaternion();
    this.tiltQ = new THREE.Quaternion();
    this.joint = { tilt: 0, roll: 0, yaw: 0 };
  }

  reset(bodyQ, tilt) {
    this.eul.setFromQuaternion(bodyQ, 'YXZ');
    const b = { p: this.eul.x, y: this.eul.y, r: this.eul.z };
    this.pitch = new Axis(tilt); this.yaw = new Axis(b.y); this.roll = new Axis(0);
    this.panT = b.y; this.prev = b; this.ready = true;
  }

  // bodyQ: orientação do drone; tilt: inclinação pedida (rad, mundo); mode: 'follow' | 'fpv'
  update(dt, bodyQ, tilt, mode) {
    if (!this.ready || dt > 0.25) this.reset(bodyQ, tilt);
    const S = this.spec;
    this.eul.setFromQuaternion(bodyQ, 'YXZ');
    const b = { p: this.eul.x, y: this.eul.y, r: this.eul.z };
    const idt = dt > 1e-4 ? 1 / dt : 0;
    const rate = { p: (b.p - this.prev.p) * idt, y: wrap(b.y - this.prev.y) * idt, r: wrap(b.r - this.prev.r) * idt };
    this.prev = b;
    const w = 2 * Math.PI * S.hz, k = w * w, d = 2 * S.damp * w, f = S.drag;
    const n = Math.max(1, Math.ceil(dt / 0.002)), h = dt / n;
    if (S.axes === 1) {
      // só o motor de inclinação: estabiliza o "olhar" para cima/baixo; giro e rolagem vêm do corpo
      for (let i = 0; i < n; i++) this.pitch.step(h, tilt, b.p, rate.p, S.tilt[0] * DEG, S.tilt[1] * DEG, k, d, f, false);
      this.joint.tilt = this.pitch.c - b.p;
      this.tiltQ.setFromAxisAngle(new THREE.Vector3(1, 0, 0), this.joint.tilt);
      this.q.copy(bodyQ).multiply(this.tiltQ);
      return this.q;
    }
    // 3 eixos: giro segue o nariz com suavidade, rolagem nivelada (ou acompanha no modo FPV)
    this.panT += wrap(b.y - this.panT) * (1 - Math.exp(-dt / S.pan));
    const rollT = mode === 'fpv' ? b.r : 0;
    for (let i = 0; i < n; i++) {
      this.yaw.step(h, this.panT, b.y, rate.y, S.yaw[0] * DEG, S.yaw[1] * DEG, k, d, f, true);
      this.pitch.step(h, tilt, b.p, rate.p, S.tilt[0] * DEG, S.tilt[1] * DEG, k, d, f, false);
      this.roll.step(h, rollT, b.r, rate.r, S.roll[0] * DEG, S.roll[1] * DEG, k, d, f, false);
    }
    this.joint = { tilt: this.pitch.c - b.p, roll: wrap(this.roll.c - b.r), yaw: wrap(this.yaw.c - b.y) };
    this.eul.set(this.pitch.c, this.yaw.c, this.roll.c, 'YXZ');
    this.q.setFromEuler(this.eul);
    return this.q;
  }
}
