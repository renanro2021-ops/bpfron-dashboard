/* Service worker dos apps da Garagem (garagem.html e garagem-gestao.html).
   Registrado com scope "./garagem" — NÃO controla o resto do site (index, intel…).
   - páginas: rede primeiro (sempre a versão nova), cópia local se estiver sem sinal
   - bibliotecas/fontes/ícones (CDN): cache primeiro — abrem na hora a partir da 2ª vez,
     inclusive o leitor de OCR, que é pesado
   - API do Worker: nunca passa por aqui (dados sempre frescos, trava de uso no servidor) */
const VERSAO = 'garagem-v1';
const PAGINAS = ['garagem.html', 'garagem-gestao.html'];
const CDN = /^https:\/\/(cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|fonts\.googleapis\.com|fonts\.gstatic\.com|tessdata\.projectnaptha\.com)\//;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSAO).then((c) => c.addAll(PAGINAS.concat([
    'LOGOS/bpfron_transp.avif', 'garagem-icon-192.png', 'garagem-gestao-icon-192.png',
  ]))).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('garagem-') && k !== VERSAO).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (req.mode === 'navigate' && url.origin === location.origin) {
    e.respondWith(fetch(req).then((r) => {
      const copia = r.clone();
      caches.open(VERSAO).then((c) => c.put(url.pathname.split('/').pop() || req, copia));
      return r;
    }).catch(() => caches.match(url.pathname.split('/').pop()).then((r) => r || caches.match(req))));
    return;
  }

  const estatico = CDN.test(req.url) || (url.origin === location.origin && /\.(png|avif|webp|svg|js|webmanifest)$/.test(url.pathname) && !/sw-garagem\.js$/.test(url.pathname));
  if (estatico) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((r) => {
      if (r.ok || r.type === 'opaque') { const copia = r.clone(); caches.open(VERSAO).then((c) => c.put(req, copia)); }
      return r;
    })));
  }
});
