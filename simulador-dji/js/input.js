// Entrada: teclado, mouse, controle por movimento e Gamepad API (controles de videogame
// e rádios em modo joystick USB). Padrão DJI em Mode 2: stick esquerdo = subir/descer e
// girar, stick direito = frente/trás e lados. Nos modos C/N/S o stick vertical esquerdo
// centrado mantém a altitude ("lift" de -1 a 1); no modo M ele é o acelerador (0 a 1).

const STORE = 'djisim.controls.v1';
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// Mapeamento de um controle "standard" (Xbox/PlayStation) em Mode 2.
// eixos: 0 = esquerdo X, 1 = esquerdo Y, 2 = direito X, 3 = direito Y
function padDefaults(stickMode) {
  const m1 = stickMode === 1;
  return {
    throttle: { axis: m1 ? 3 : 1, min: -1, max: 1, center: 0, invert: true, isThrottle: true },
    yaw: { axis: 0, min: -1, max: 1, center: 0, invert: false },
    pitch: { axis: m1 ? 1 : 3, min: -1, max: 1, center: 0, invert: true },
    roll: { axis: 2, min: -1, max: 1, center: 0, invert: false },
    armButton: 2,   // X: ligar motores / decolar / pousar
    modeButton: 3,  // Y: modo de voo
    resetButton: 12, // direcional para cima: reiniciar
    cameraButton: 4, // LB: câmera FPV / 3ª pessoa
    brakeButton: 1, // B: freio
    photoButton: 5, // RB: foto
    videoButton: 10, // L3: vídeo
    rthButton: 8,   // SELECT/VIEW: voltar para casa
    deadband: 0.04,
    calibrated: false,
  };
}

export const KEY_LABELS = {
  kb: [['Subir / descer', 'W / S'], ['Girar', 'A / D'], ['Frente / trás', '↑ / ↓'], ['Lados', '← / →']],
  kbm: [['Subir / descer', 'W / S'], ['Girar', 'A / D'], ['Frente / trás', 'Mouse ↕'], ['Lados', 'Mouse ↔']],
  mkb: [['Subir / descer', 'Mouse ↕'], ['Girar', 'Mouse ↔'], ['Frente / trás', '↑ / ↓'], ['Lados', '← / →']],
  motion: [['Apontar (direção e gimbal)', 'Mouse'], ['Acelerar (gatilho)', 'Botão esquerdo / ↑'], ['Frear', 'Botão direito'], ['Subir / descer', 'W / S']],
};

export class Input {
  constructor() {
    this.keys = new Set();
    this.kb = { throttle: 0, yaw: 0, pitch: 0, roll: 0 };
    this.mouse = { x: 0, y: 0 };
    this.state = { throttle: 0, yaw: 0, pitch: 0, roll: 0, lift: 0, gimbal: 0, motion: null };
    this.kb.lift = 0; this.kb.gimbal = 0; this.kb.motion = null;
    this.aim = -0.1; this.trigger = 0; this.mouseBtn = [false, false, false]; this.wheel = 0;
    this.source = 'keyboard';
    this.opts = { profile: 'kb', throttleMode: 'spring', thrSens: 4, rotSens: 4, mouseSens: 5, stickMode: 2, padThrottle: 'auto', padDeadzone: 12 };
    this.map = this.load();
    this.prevButtons = {};
    this.events = [];
    this.lastPadArm = null;
    this.pointerLocked = false;
    addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) return;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
      if (!e.repeat) {
        const ev = { Space: 'arm', KeyT: 'takeoff', KeyH: 'rth', KeyB: 'brake', KeyR: 'reset', KeyC: 'camera', Escape: 'pause', KeyM: 'mode', KeyF: 'photo', KeyV: 'video', KeyX: 'gimbalReset', KeyG: 'placeGate', KeyZ: 'undoGate', Enter: 'enter', Digit1: 'zoom1', Digit2: 'zoom2', Digit3: 'zoom3', KeyK: 'quickshot' }[e.code];
        if (ev) this.events.push(ev);
      }
      this.keys.add(e.code);
      this.source = 'keyboard';
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
    addEventListener('mousemove', (e) => {
      if (!this.pointerLocked) return;
      const k = 0.0016 * this.opts.mouseSens;
      this.mouse.x = clamp(this.mouse.x + e.movementX * k, -1, 1);
      this.mouse.y = clamp(this.mouse.y - e.movementY * k, -1, 1);
    });
    document.addEventListener('pointerlockchange', () => { this.pointerLocked = !!document.pointerLockElement; });
    addEventListener('mousedown', (e) => { if (this.pointerLocked) this.mouseBtn[e.button] = true; });
    addEventListener('mouseup', (e) => { this.mouseBtn[e.button] = false; });
    addEventListener('contextmenu', (e) => { if (this.pointerLocked) e.preventDefault(); });
    addEventListener('wheel', (e) => { if (e.target && e.target.id === 'view') this.wheel += Math.sign(e.deltaY); }, { passive: true });
  }

  usesMouse() { return this.opts.profile !== 'kb'; }
  centered(pad) { return this.throttleStyle(pad) === 'gamepad'; }

  load() {
    try { const s = JSON.parse(localStorage.getItem(STORE)); if (s && s.throttle) return Object.assign(padDefaults(2), s); } catch (e) { /* sem storage */ }
    return padDefaults(2);
  }
  save() { try { localStorage.setItem(STORE, JSON.stringify(this.map)); } catch (e) { /* ignorar */ } }
  resetMap() { this.map = padDefaults(this.opts.stickMode); this.save(); }
  setStickMode(m) {
    if (this.map.calibrated) return;
    const d = padDefaults(m);
    for (const k of ['throttle', 'pitch']) this.map[k] = d[k];
  }

  pad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) if (p && p.connected && p.axes.length >= 2) return p;
    return null;
  }

  // "gamepad": stick do acelerador centrado = 0%, empurrar para cima = 100% (como no original)
  // "radio": curso completo do stick (rádios RC sem mola)
  throttleStyle(pad) {
    if (this.opts.padThrottle !== 'auto') return this.opts.padThrottle;
    if (this.map.calibrated) return 'radio';
    return pad.mapping === 'standard' ? 'gamepad' : 'radio';
  }

  // zona morta efetiva: a maior entre a da calibração e a escolhida nas configurações
  deadzone() { return Math.max(this.map.deadband || 0, (this.opts.padDeadzone ?? 12) / 100); }

  // folga entre eixos: em controles de videogame, empurrar um eixo até o fim também mexe o outro
  // eixo do mesmo stick (até ~40%). Quanto mais o parceiro está empurrado, maior a zona morta deste eixo.
  crossDz(pad, ch) {
    if (pad.mapping !== 'standard' || this.map.calibrated) return 0;
    return 0.32 * Math.abs(pad.axes[this.map[ch].axis ^ 1] ?? 0);
  }

  readAxis(pad, ch) {
    const m = this.map[ch];
    const v = pad.axes[m.axis] ?? 0;
    if (m.isThrottle) {
      if (this.throttleStyle(pad) === 'gamepad') {
        const n = m.invert ? -v : v;
        const dz = this.deadzone();
        return clamp((n - dz) / (1 - dz), 0, 1);
      }
      let t = (v - m.min) / ((m.max - m.min) || 1);
      if (m.invert) t = 1 - t;
      return clamp(t, 0, 1);
    }
    let n = v >= m.center ? (v - m.center) / ((m.max - m.center) || 1) : -(m.center - v) / ((m.center - m.min) || 1);
    if (m.invert) n = -n;
    n = clamp(n, -1, 1);
    const db = Math.min(0.7, this.deadzone() + this.crossDz(pad, ch));
    if (Math.abs(n) < db) return 0;
    return Math.sign(n) * (Math.abs(n) - db) / (1 - db);
  }

  readButton(pad, b) {
    if (b == null) return false;
    if (typeof b === 'string' && b.startsWith('a')) return (pad.axes[parseInt(b.slice(1), 10)] ?? -1) > 0.3;
    return !!(pad.buttons[b] && pad.buttons[b].pressed);
  }

  update(dt) {
    const k = this.keys, o = this.opts;
    const ramp = (cur, target, rate) => cur + clamp(target - cur, -rate * dt, rate * dt);
    const axis = (neg, pos) => (k.has(pos) ? 1 : 0) - (k.has(neg) ? 1 : 0);
    const thrRate = 0.35 + o.thrSens * 0.42;   // sensibilidade 4 ≈ 2/s
    const rotRate = 1.5 + o.rotSens * 1.6;     // sensibilidade 4 ≈ 8/s
    const prof = o.profile;

    // subir/descer (modos assistidos): W sobe, S desce, soltando mantém a altitude
    this.kb.lift = ramp(this.kb.lift, axis('KeyS', 'KeyW'), thrRate * 2.2);
    if (prof === 'mkb') this.kb.lift = Math.abs(this.mouse.y) > 0.08 ? this.mouse.y : 0;
    // acelerador (modo M)
    if (prof === 'mkb') {
      this.kb.throttle = clamp(this.mouse.y * 0.5 + 0.5, 0, 1);
    } else if (o.throttleMode === 'spring') {
      // como no original: W sobe, S desce, soltando volta a zero
      const target = k.has('KeyW') ? 1 : 0;
      const rate = k.has('KeyS') ? thrRate * 3 : k.has('KeyW') ? thrRate : thrRate * 1.6;
      this.kb.throttle = ramp(this.kb.throttle, target, rate);
    } else {
      if (k.has('KeyW')) this.kb.throttle = clamp(this.kb.throttle + dt * thrRate * 0.45, 0, 1);
      if (k.has('KeyS')) this.kb.throttle = clamp(this.kb.throttle - dt * thrRate * 0.45, 0, 1);
    }
    // yaw
    if (prof === 'mkb') this.kb.yaw = this.mouse.x;
    else this.kb.yaw = ramp(this.kb.yaw, axis('KeyA', 'KeyD'), rotRate);
    // pitch / roll
    if (prof === 'kbm') { this.kb.pitch = this.mouse.y; this.kb.roll = this.mouse.x; }
    else if (prof === 'motion') { this.kb.pitch = 0; this.kb.roll = 0; }
    else {
      this.kb.pitch = ramp(this.kb.pitch, axis('ArrowDown', 'ArrowUp'), rotRate);
      this.kb.roll = ramp(this.kb.roll, axis('ArrowLeft', 'ArrowRight'), rotRate);
    }
    // gimbal: Q baixa, E levanta (e rodinha do mouse)
    this.kb.gimbal = axis('KeyQ', 'KeyE') - this.wheel * 4; this.wheel = 0;
    // controle por movimento: o mouse aponta, o gatilho acelera
    if (prof === 'motion') {
      this.kb.yaw = this.mouse.x;
      this.aim = clamp(this.aim + this.mouse.y * dt * 1.6, -1.35, 0.9);
      this.mouse.y = 0;
      const trig = this.mouseBtn[0] || k.has('ArrowUp') ? 1 : 0;
      this.trigger = ramp(this.trigger, trig, 1.8);
      this.kb.motion = { aim: this.aim, trigger: this.mouseBtn[2] ? 0 : this.trigger, brake: this.mouseBtn[2] };
    } else this.kb.motion = null;
    // o mouse volta ao centro aos poucos (como um stick com mola)
    if (this.usesMouse()) {
      const back = Math.exp(-dt * 2.2);
      this.mouse.x *= back;
      if (prof === 'kbm') this.mouse.y *= back;
    }

    const pad = this.pad();
    const padMoved = pad && (pad.axes.some((v, i) => i < 4 && Math.abs(v) > 0.25) || pad.buttons.some((b) => b.pressed));
    if (padMoved && k.size === 0) this.source = 'pad';
    if (pad && this.source === 'pad') {
      this.padName = pad.id;
      for (const ch of ['throttle', 'yaw', 'pitch', 'roll']) this.state[ch] = this.readAxis(pad, ch);
      // stick vertical esquerdo centrado = manter altitude (padrão DJI)
      {
        const m = this.map.throttle, v = pad.axes[m.axis] ?? 0;
        let n;
        if (this.centered(pad)) n = m.invert ? -v : v;
        else { let t = (v - m.min) / ((m.max - m.min) || 1); if (m.invert) t = 1 - t; n = t * 2 - 1; }
        const db = Math.min(0.7, Math.max(0.08, this.deadzone()) + this.crossDz(pad, 'throttle'));
        this.state.lift = Math.abs(n) < db ? 0 : Math.sign(n) * (Math.abs(n) - db) / (1 - db);
      }
      const trig = (i) => (pad.buttons[i] ? pad.buttons[i].value || (pad.buttons[i].pressed ? 1 : 0) : 0);
      this.state.gimbal = trig(7) - trig(6) + this.kb.gimbal;
      this.state.motion = null;
      const arm = this.readButton(pad, this.map.armButton);
      if (typeof this.map.armButton === 'string') {
        if (this.lastPadArm !== null && arm !== this.lastPadArm) this.events.push(arm ? 'armOn' : 'armOff');
        this.lastPadArm = arm;
      } else if (arm && !this.prevButtons.arm) this.events.push('arm');
      this.prevButtons.arm = arm;
      for (const [name, btn, ev] of [['reset', this.map.resetButton, 'reset'], ['mode', this.map.modeButton, 'mode'], ['cam', this.map.cameraButton, 'camera'], ['start', 9, 'pause'],
        ['brake', this.map.brakeButton, 'brake'], ['photo', this.map.photoButton, 'photo'], ['video', this.map.videoButton, 'video'], ['rth', this.map.rthButton, 'rth'], ['gimbalReset', 11, 'gimbalReset']]) {
        const b = this.readButton(pad, btn);
        if (b && !this.prevButtons[name]) this.events.push(ev);
        this.prevButtons[name] = b;
      }
      this.kb.throttle = 0;
    } else {
      this.source = 'keyboard';
      Object.assign(this.state, this.kb);
    }
    return this.state;
  }

  sourceLabel() {
    if (this.source === 'pad' && this.padName) return this.padName.replace(/\(.*?\)/g, '').trim().slice(0, 32);
    return { kb: 'Teclado', kbm: 'Teclado e mouse', mkb: 'Mouse e teclado', motion: 'Controle por movimento (mouse)' }[this.opts.profile];
  }

  takeEvents() { const e = this.events; this.events = []; return e; }
}

// Assistente de calibração: detecta o eixo mexido e seus limites.
export class Calibrator {
  constructor(input) {
    this.input = input;
    this.steps = [
      { ch: 'throttle', text: 'ACELERADOR: mova o stick do acelerador para CIMA e depois até embaixo algumas vezes.' },
      { ch: 'yaw', text: 'YAW: mova o stick para a DIREITA primeiro, depois para os dois lados e solte no centro.' },
      { ch: 'pitch', text: 'PITCH: mova o stick para CIMA primeiro, depois cima/baixo e solte no centro.' },
      { ch: 'roll', text: 'ROLL: mova o stick para a DIREITA primeiro, depois para os lados e solte no centro.' },
      { ch: 'arm', text: 'ARMAR: aperte o botão ou mude a chave que você quer usar para armar.' },
    ];
    this.i = 0;
    this.used = new Set();
    this.begin();
  }
  get step() { return this.steps[this.i]; }
  begin() {
    const pad = this.input.pad();
    this.base = pad ? pad.axes.slice() : [];
    this.baseButtons = pad ? pad.buttons.map((b) => b.pressed) : [];
    this.min = this.base.slice(); this.max = this.base.slice();
    this.firstDir = null; this.detected = null;
  }
  sample() {
    const pad = this.input.pad();
    if (!pad) return { ok: false, msg: 'Nenhum controle detectado. Conecte o rádio/joystick e mexa um stick.' };
    const ax = pad.axes;
    if (this.step.ch === 'arm') {
      for (let b = 0; b < pad.buttons.length; b++) if (pad.buttons[b].pressed && !this.baseButtons[b]) this.detected = b;
      for (let a = 0; a < ax.length; a++) if (!this.used.has(a) && Math.abs(ax[a] - (this.base[a] ?? 0)) > 0.6) this.detected = 'a' + a;
      return { ok: this.detected != null, msg: this.detected != null ? 'Detectado: ' + (typeof this.detected === 'string' ? 'chave/eixo ' + this.detected.slice(1) : 'botão ' + this.detected) : 'Aguardando...' };
    }
    let best = -1, bestRange = 0;
    for (let a = 0; a < ax.length; a++) {
      if (this.used.has(a)) continue;
      this.min[a] = Math.min(this.min[a] ?? ax[a], ax[a]);
      this.max[a] = Math.max(this.max[a] ?? ax[a], ax[a]);
      const r = this.max[a] - this.min[a];
      if (r > bestRange) { bestRange = r; best = a; }
      if (this.firstDir === null && Math.abs(ax[a] - (this.base[a] ?? 0)) > 0.45) this.firstDir = { a, sign: Math.sign(ax[a] - (this.base[a] ?? 0)) };
    }
    if (best >= 0 && bestRange > 1.0) this.detected = best;
    return { ok: this.detected != null, msg: this.detected != null ? `Eixo ${this.detected} (faixa ${bestRange.toFixed(2)})` : 'Mova o stick até os extremos...' };
  }
  next() {
    const ch = this.step.ch, m = this.input.map;
    if (this.detected == null) return false;
    if (ch === 'arm') m.armButton = this.detected;
    else {
      const a = this.detected;
      const pad = this.input.pad();
      const center = pad ? pad.axes[a] : 0;
      const dirSign = this.firstDir && this.firstDir.a === a ? this.firstDir.sign : 1;
      m[ch] = { axis: a, min: this.min[a], max: this.max[a], center: ch === 'throttle' ? 0 : center, invert: dirSign < 0, isThrottle: ch === 'throttle' };
      this.used.add(a);
    }
    this.i++;
    if (this.i >= this.steps.length) { m.calibrated = true; this.input.save(); return 'done'; }
    this.begin();
    return true;
  }
}
