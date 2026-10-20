// Movimento, vibração e painel inferior arrastável (pontos de parada: recolhido / meio / aberto).
const Motion = (() => {
  const mq = matchMedia('(prefers-reduced-motion: reduce)');
  return { get reduced() { return mq.matches; } };
})();

const Haptic = {
  get on() { try { return localStorage.getItem('mc-haptic') !== '0'; } catch { return true; } },
  set on(v) { try { localStorage.setItem('mc-haptic', v ? '1' : '0'); } catch { } },
  tap(ms = 8) { if (this.on && !Motion.reduced) try { navigator.vibrate?.(ms); } catch { } },
};
document.addEventListener('pointerdown', e => {
  if (e.pointerType !== 'mouse' && e.target.closest?.('button:not(:disabled)')) Haptic.tap();
}, { passive: true });

// Tela de carregamento: bloqueia toques e mostra o que está sendo feito. `run` garante que ela apareça
// (espera a pintura) antes de começar o trabalho pesado e que fique visível por um tempo mínimo.
const Busy = (() => {
  const el = document.querySelector('#busy'), txt = document.querySelector('#busy-text');
  let n = 0;
  const paint = () => new Promise(r => requestAnimationFrame(() => setTimeout(r, 30)));
  async function run(msg, fn, { delay = 0, min = 400 } = {}) {
    let shown = false, t0 = 0, timer = 0;
    n++; txt.textContent = msg;
    const open = () => { if (shown) return; shown = true; t0 = Date.now(); el.hidden = false; document.body.setAttribute('aria-busy', 'true'); };
    if (delay) timer = setTimeout(open, delay); else { open(); await paint(); }
    try { return await fn(); }
    finally {
      clearTimeout(timer);
      if (shown) { const rest = min - (Date.now() - t0); if (rest > 0) await new Promise(r => setTimeout(r, rest)); }
      if (!--n) { el.hidden = true; document.body.removeAttribute('aria-busy'); }
    }
  }
  return { run, set: msg => { if (n) txt.textContent = msg; }, get active() { return n > 0; } };
})();

// Só o cabeçalho do painel recebe o gesto de arrastar; o corpo rola normalmente e o mapa fica livre.
const Sheet = (() => {
  const q = s => document.querySelector(s);
  const el = q('#sheet'), head = q('#sheet-head'), body = q('#sheet-body'), titleEl = q('#sheet-title'), grip = q('#sheet-grip');
  let snaps = [0], idx = 0, isOpen = false, h = 0, drag = null, hideT = 0;
  const avail = () => Math.max(160, window.innerHeight - q('#toolbar').offsetHeight - q('#topbar').offsetHeight - 8);
  const nearest = px => snaps.reduce((b, s, i) => Math.abs(s - px) < Math.abs(snaps[b] - px) ? i : b, 0);

  function setH(px, animate) {
    el.classList.toggle('dragging', !animate);
    document.body.classList.toggle('sheet-drag', !animate);
    h = Math.max(0, Math.round(px)); el.style.height = h + 'px';
    document.documentElement.style.setProperty('--sheet-h', h + 'px');
    document.body.classList.toggle('sheet-tall', h > avail() * .62);
  }
  function measure() {
    const a = avail(), peek = head.offsetHeight, nat = peek + body.scrollHeight;
    const s = [peek];
    for (const v of [Math.min(nat, a * .5), Math.min(nat, a * .9)]) if (v - s[s.length - 1] > 40) s.push(Math.round(v));
    return s;
  }
  function show(title, html, after) {
    clearTimeout(hideT);
    const was = isOpen;
    titleEl.textContent = title; body.innerHTML = html; body.scrollTop = 0;
    el.hidden = false; isOpen = true;
    after?.(body);
    snaps = measure(); idx = Math.min(1, snaps.length - 1);
    if (!was) { setH(0, false); void el.offsetHeight; }   // parte de altura 0 para animar a abertura
    setH(snaps[idx], true);
  }
  function close() {
    if (!isOpen) return;
    isOpen = false; setH(0, true);
    hideT = setTimeout(() => { if (!isOpen) el.hidden = true; }, Motion.reduced ? 0 : 340);
    api.onClose?.();
  }
  function snapTo(i) { if (i !== idx) Haptic.tap(6); idx = i; setH(snaps[i], true); }
  function refit() {   // o conteúdo mudou de tamanho (ex.: foto carregada)
    if (!isOpen || drag) return;
    snaps = measure(); idx = nearest(h); setH(snaps[idx], true);
  }

  head.addEventListener('pointerdown', e => {
    if (!isOpen || e.target.closest('#sheet-close')) return;
    drag = { y: e.clientY, h0: h, moved: false, v: 0, ly: e.clientY, lt: e.timeStamp };
    head.setPointerCapture(e.pointerId);
  });
  head.addEventListener('pointermove', e => {
    if (!drag) return;
    const dy = drag.y - e.clientY;
    if (!drag.moved && Math.abs(dy) < 6) return;
    drag.moved = true;
    const dt = e.timeStamp - drag.lt; if (dt > 0) drag.v = (drag.ly - e.clientY) / dt;   // px/ms, positivo = subindo
    drag.ly = e.clientY; drag.lt = e.timeStamp;
    setH(Math.min(snaps[snaps.length - 1], drag.h0 + dy), false);
  });
  const end = e => {
    if (!drag) return;
    const d = drag; drag = null;
    if (!d.moved) { if (e.type === 'pointerup') snapTo(idx === 0 ? Math.min(1, snaps.length - 1) : 0); return; }
    const proj = h + d.v * 140;   // leva a velocidade do gesto em conta
    if (proj < snaps[0] * .5) return close();
    snapTo(nearest(proj));
  };
  head.addEventListener('pointerup', end);
  head.addEventListener('pointercancel', end);
  grip.addEventListener('click', e => { if (e.detail === 0) snapTo(idx === 0 ? Math.min(1, snaps.length - 1) : 0); });   // teclado / leitor de tela
  q('#sheet-close').addEventListener('click', close);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  window.addEventListener('resize', refit);

  const api = { onClose: null, show, close, refit, snapTo, get isOpen() { return isOpen; }, get target() { return isOpen ? snaps[idx] : 0; } };
  return api;
})();
