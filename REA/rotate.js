// Rotação do mapa ("mapa gira com a bússola"). TUDO que depende do plugin leaflet-rotate (GPL-3.0, vendor/) fica neste arquivo:
// opções do mapa, setBearing/getBearing e o evento 'rotate'. Para trocar o plugin, veja vendor/LEIA-ME-leaflet-rotate.md.
//
// Convenção: bearing = graus que o mapa está girado no sentido horário na tela (0 = norte para cima).
// Uma direção absoluta d (graus a partir do norte) aparece na tela em d + bearing. No modo "heading", bearing = −heading,
// então a direção para onde o aparelho aponta fica sempre para cima.
const MapRot = (() => {
  const KEY = 'mc-rot', subs = [];
  let mode = 'north', map = null, tween = 0;
  try { if (localStorage.getItem(KEY) === 'heading') mode = 'heading'; } catch { }
  const supported = !!(window.L && L.Map && L.Map.prototype.setBearing);
  const norm = a => ((a % 360) + 360) % 360;
  const delta = (a, b) => ((a - b + 540) % 360) - 180;
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  // opções passadas ao criar o mapa (o plugin ignora o que não conhece; sem plugin elas são inofensivas)
  const options = { rotate: true, bearing: 0, rotateControl: false, touchRotate: false, shiftKeyRotate: false };

  function attach(m) {
    map = m;
    if (!supported) return;
    map.on('rotate', () => { document.documentElement.style.setProperty('--bearing', bearing().toFixed(1) + 'deg'); subs.forEach(fn => fn(bearing())); });
  }
  const bearing = () => supported && map ? norm(map.getBearing()) : 0;
  const setNow = b => { if (supported && map) map.setBearing(norm(b)); };

  // anima até o alvo pelo menor caminho (instantâneo se o aparelho pede menos movimento)
  function tweenTo(target) {
    cancelAnimationFrame(tween);
    const from = bearing(), d = delta(target, from);
    if (reduced() || Math.abs(d) < 1) return setNow(target);
    const t0 = performance.now(), dur = 240;
    const step = t => { const k = Math.min(1, (t - t0) / dur), e = 1 - (1 - k) ** 3; setNow(from + d * e); if (k < 1) tween = requestAnimationFrame(step); };
    tween = requestAnimationFrame(step);
  }

  return {
    options, attach, supported,
    get mode() { return mode; },
    get bearing() { return bearing(); },
    onChange: fn => subs.push(fn),
    setMode(m) {
      if (m !== 'north' && m !== 'heading') return;
      mode = m; try { localStorage.setItem(KEY, m); } catch { }
      if (m === 'north') tweenTo(0);
      subs.forEach(fn => fn(bearing()));
    },
    // chamado a cada leitura de direção (graus a partir do norte); só gira no modo "heading", ignorando variações < 1°
    follow(heading, { animate = false } = {}) {
      if (!supported || mode !== 'heading' || heading == null) return;
      const target = norm(-heading);
      if (animate) return tweenTo(target);
      if (Math.abs(delta(target, bearing())) >= 1) { cancelAnimationFrame(tween); setNow(target); }
    },
  };
})();
