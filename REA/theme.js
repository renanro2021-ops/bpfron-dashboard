// Tema claro / escuro / automático. As cores ficam em tokens CSS (style.css); aqui só se escolhe qual conjunto vale.
// Carregado no <head>, antes da pintura, para não piscar o tema errado.
const Theme = (() => {
  const KEY = 'mc-theme', root = document.documentElement, mq = matchMedia('(prefers-color-scheme: dark)'), subs = [];
  let pref = 'auto';
  try { const v = localStorage.getItem(KEY); if (v === 'light' || v === 'dark') pref = v; } catch { }
  const resolved = () => pref === 'auto' ? (mq.matches ? 'dark' : 'light') : pref;
  function apply(animate) {
    if (animate) { root.classList.add('theme-anim'); clearTimeout(apply.t); apply.t = setTimeout(() => root.classList.remove('theme-anim'), 350); }
    root.setAttribute('data-theme', resolved());
    subs.forEach(fn => fn(resolved()));
  }
  const onSystem = () => pref === 'auto' && apply(true);
  mq.addEventListener ? mq.addEventListener('change', onSystem) : mq.addListener(onSystem);
  apply(false);
  return {
    get pref() { return pref; },
    get resolved() { return resolved(); },
    set(p) {
      if (!['auto', 'light', 'dark'].includes(p)) return;
      pref = p;
      try { p === 'auto' ? localStorage.removeItem(KEY) : localStorage.setItem(KEY, p); } catch { }
      apply(true);
    },
    onChange: fn => subs.push(fn),
    token: n => getComputedStyle(root).getPropertyValue(n).trim(),
  };
})();
