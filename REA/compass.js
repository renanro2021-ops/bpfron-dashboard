// Bússola do aparelho + rumo do GPS, num só valor de direção.
// - Parado: usa o sensor de orientação (iOS: webkitCompassHeading; Android: deviceorientationabsolute).
// - Em movimento (>= 2 m/s): usa o rumo do GPS, que já é em relação ao norte verdadeiro, e com ele aprende a diferença
//   entre o norte do sensor (magnético) e o verdadeiro, para corrigir o sensor quando o usuário parar.
const Compass = (() => {
  const subs = [];
  let started = false, perm = window.DeviceOrientationEvent ? (typeof DeviceOrientationEvent.requestPermission === 'function' ? 'prompt' : 'granted') : 'unsupported';
  let raw = null, rawT = 0;                    // direção do sensor, suavizada (graus, norte do sensor)
  let course = null, speed = 0, courseT = 0;   // rumo e velocidade do GPS
  let off = null, diffs = [];                  // correção sensor -> norte verdadeiro (graus) e amostras para aprendê-la
  try { const v = parseFloat(localStorage.getItem('mc-decl')); if (Number.isFinite(v)) off = v; } catch { }
  const rad = d => d * Math.PI / 180;
  const norm = a => ((a % 360) + 360) % 360;
  const delta = (a, b) => ((a - b + 540) % 360) - 180;   // a - b, no menor caminho, em (-180, 180]

  // Heading do aparelho a partir do evento. Em pé (beta alto) usa a direção da traseira; deitado, a do topo.
  function fromEvent(e) {
    if (Number.isFinite(e.webkitCompassHeading)) return e.webkitCompassHeading;   // iOS já compensa a inclinação
    if (e.alpha == null || (e.type === 'deviceorientation' && !e.absolute)) return null;   // alpha relativo não serve
    const beta = e.beta ?? 0, gamma = e.gamma ?? 0;
    if (Math.abs(beta) < 50) return norm(360 - e.alpha);   // deitado
    const x = rad(beta), y = rad(gamma), z = rad(e.alpha);
    const vx = -Math.cos(z) * Math.sin(y) - Math.sin(z) * Math.sin(x) * Math.cos(y);
    const vy = -Math.sin(z) * Math.sin(y) + Math.cos(z) * Math.sin(x) * Math.cos(y);
    return norm(Math.atan2(vx, vy) * 180 / Math.PI);   // retrato; em paisagem a precisão cai (limite conhecido)
  }
  let raf = 0;
  const notify = () => { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; const v = value(); subs.forEach(fn => fn(v)); }); };
  function onEvent(e) {
    const h = fromEvent(e); if (h == null) return;
    const now = Date.now();
    raw = raw == null || now - rawT > 3000 ? h : norm(raw + 0.3 * delta(h, raw));   // filtro passa-baixa circular
    rawT = now; notify();
  }
  function start() {
    if (!window.DeviceOrientationEvent) { perm = 'unsupported'; return notify(); }
    if (!started) { started = true; window.addEventListener('deviceorientationabsolute', onEvent, true); window.addEventListener('deviceorientation', onEvent, true); }
    const req = DeviceOrientationEvent.requestPermission;
    if (typeof req === 'function') {   // iOS: só funciona dentro de um toque do usuário
      if (perm === 'granted') return;
      Promise.resolve().then(() => req.call(DeviceOrientationEvent)).then(r => { perm = r === 'granted' ? 'granted' : 'denied'; notify(); })
        .catch(() => { perm = 'prompt'; notify(); });
    } else perm = 'granted';
  }
  // Chamado a cada leitura do GPS: guarda rumo/velocidade e, em movimento firme, aprende a correção do sensor.
  function feedGps(c, s, t) {
    if (!Number.isFinite(c) || !Number.isFinite(s)) { course = null; return notify(); }
    course = norm(c); speed = s; courseT = t || Date.now();
    if (s >= 2 && raw != null && Date.now() - rawT < 3000) {
      diffs.push(delta(course, raw)); if (diffs.length > 10) diffs.shift();
      if (diffs.length >= 6) {
        const sx = diffs.reduce((a, d) => a + Math.cos(rad(d)), 0) / diffs.length, sy = diffs.reduce((a, d) => a + Math.sin(rad(d)), 0) / diffs.length;
        const R = Math.min(1, Math.hypot(sx, sy)), std = Math.sqrt(-2 * Math.log(Math.max(R, 1e-9))) * 180 / Math.PI;   // desvio circular (R limitado a 1: arredondamento dava NaN)
        if (std < 15) {   // só aprende se o sensor e o GPS concordam de forma estável (celular apontando para onde anda)
          const m = Math.atan2(sy, sx) * 180 / Math.PI;
          off = off == null ? m : off + 0.3 * delta(m, off);
          try { localStorage.setItem('mc-decl', String(Math.round(off * 10) / 10)); } catch { }
        }
      }
    }
    notify();
  }
  function value() {
    const now = Date.now();
    if (course != null && speed >= 2 && now - courseT < 4000) return { v: course, src: 'gps', calibrated: true };
    if (raw != null && now - rawT < 3000) return { v: norm(raw + (off || 0)), src: 'bussola', calibrated: off != null };
    return null;
  }
  // só o sensor do aparelho (sem o rumo do GPS): é o "rumo" do painel Tracking, que mostra o trajeto do GPS à parte
  function sensor() { return raw != null && Date.now() - rawT < 3000 ? { v: norm(raw + (off || 0)), calibrated: off != null } : null; }
  return {
    start, feedGps, value, sensor, onChange: fn => subs.push(fn),
    get perm() { return perm; },
    get offset() { return off; },
    reset() { off = null; diffs = []; try { localStorage.removeItem('mc-decl'); } catch { } notify(); },
  };
})();
