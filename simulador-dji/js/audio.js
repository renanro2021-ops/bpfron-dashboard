// Áudio sintetizado (WebAudio): ronco dos motores, vento, batidas e bipes.
// Equivale ao MotorSoundManager (sons low/mid/high), DamageSoundController e AudioManager.
export class Audio {
  constructor() { this.ctx = null; this.volume = 0.7; this.pitch = 1; }

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain(); this.master.gain.value = this.volume; this.master.connect(ctx.destination);
    // motores: 4 osciladores dente-de-serra filtrados
    this.motorBus = ctx.createGain(); this.motorBus.gain.value = 0;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800; lp.Q.value = 0.7;
    this.motorFilter = lp;
    this.motorBus.connect(lp); lp.connect(this.master);
    this.oscs = [0, 1, 2, 3].map((i) => {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 60 + i * 3;
      const o2 = ctx.createOscillator(); o2.type = 'square'; o2.frequency.value = 120;
      const g = ctx.createGain(); g.gain.value = 0.06; const g2 = ctx.createGain(); g2.gain.value = 0.02;
      o.connect(g); o2.connect(g2); g.connect(this.motorBus); g2.connect(this.motorBus); o.start(); o2.start();
      return { o, o2, g };
    });
    // ruído base (vento/hélices)
    const len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = buf;
    const n = ctx.createBufferSource(); n.buffer = buf; n.loop = true;
    this.windFilter = ctx.createBiquadFilter(); this.windFilter.type = 'bandpass'; this.windFilter.frequency.value = 600; this.windFilter.Q.value = 0.6;
    this.windGain = ctx.createGain(); this.windGain.gain.value = 0;
    n.connect(this.windFilter); this.windFilter.connect(this.windGain); this.windGain.connect(this.master); n.start();
  }

  setVolume(v) { this.volume = v; if (this.master) this.master.gain.value = v; }

  update(rpm, speed, armed, damage) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    let avg = 0;
    for (let i = 0; i < 4; i++) {
      const r = rpm[i]; avg += r / 4;
      const f = (70 + r * 520) * (this.pitch || 1) + (damage[i] < 0.95 ? Math.sin(t * 40 + i) * 25 * (1 - damage[i]) : 0);
      this.oscs[i].o.frequency.setTargetAtTime(f, t, 0.02);
      this.oscs[i].o2.frequency.setTargetAtTime(f * 2.01, t, 0.02);
    }
    this.motorBus.gain.setTargetAtTime(armed ? 0.25 + avg * 0.9 : 0, t, 0.05);
    this.motorFilter.frequency.setTargetAtTime(900 + avg * 3500, t, 0.05);
    this.windGain.gain.setTargetAtTime(Math.min(0.5, speed / 60) * 0.5 + avg * 0.06, t, 0.1);
    this.windFilter.frequency.setTargetAtTime(400 + speed * 25, t, 0.1);
  }

  beep(freq = 880, dur = 0.08, type = 'sine', vol = 0.25) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.value = freq; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.02);
  }
  crash(strength) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, s = this.ctx.createBufferSource(), g = this.ctx.createGain(), f = this.ctx.createBiquadFilter();
    s.buffer = this.noiseBuf; f.type = 'lowpass'; f.frequency.value = 600 + strength * 120;
    g.gain.setValueAtTime(Math.min(0.9, 0.1 + strength * 0.04), t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    s.connect(f); f.connect(g); g.connect(this.master); s.start(t, Math.random()); s.stop(t + 0.3);
  }
  // obturador da câmera: dois cliques curtos de ruído
  shutter() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    for (const [dt, fq] of [[0, 3200], [0.07, 2200]]) {
      const s = this.ctx.createBufferSource(), g = this.ctx.createGain(), f = this.ctx.createBiquadFilter();
      s.buffer = this.noiseBuf; f.type = 'bandpass'; f.frequency.value = fq; f.Q.value = 1.2;
      g.gain.setValueAtTime(0.5, t + dt); g.gain.exponentialRampToValueAtTime(0.001, t + dt + 0.05);
      s.connect(f); f.connect(g); g.connect(this.master); s.start(t + dt, Math.random()); s.stop(t + dt + 0.07);
    }
  }
  collect() { this.beep(1046, 0.07, 'triangle', 0.25); setTimeout(() => this.beep(1568, 0.1, 'triangle', 0.22), 70); }
  gate() { this.beep(1320, 0.06, 'square', 0.12); }
  lap() { this.beep(988, 0.12, 'square', 0.15); setTimeout(() => this.beep(1318, 0.18, 'square', 0.15), 130); }
  countdown(go) { this.beep(go ? 1200 : 600, go ? 0.35 : 0.15, 'square', 0.15); }
}
