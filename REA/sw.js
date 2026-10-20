// build 11
// Cache do app (offline) e dos tiles já vistos.
importScripts('changelog.js');
const APP = 'mapacampo-v' + CHANGELOG[0].v, TILES = 'mapacampo-tiles';
const SHELL = ['./', 'index.html', 'style.css', 'app.js', 'changelog.js', 'geo.js', 'db.js', 'exif.js', 'zip.js', 'geotiff.js', 'geopdf.js', 'vendor/pdf.min.js', 'vendor/pdf.worker.js','manifest.webmanifest', 'icon.svg',
  'vendor/leaflet.js', 'vendor/leaflet.css', 'vendor/images/layers.png', 'vendor/images/marker-icon.png', 'vendor/images/marker-shadow.png'];

self.addEventListener('install', e => e.waitUntil(caches.open(APP).then(c => c.addAll(SHELL))));
// A atualização só assume quando o usuário aceita (botão no aviso do app)
self.addEventListener('message', e => { if (e.data === 'skip') self.skipWaiting(); });
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(ks => Promise.all(ks.filter(k => k !== APP && k !== TILES).map(k => caches.delete(k)))).then(() => self.clients.claim())));

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (url.hostname.endsWith('openstreetmap.org')) {
    e.respondWith(caches.open(TILES).then(async c => {
      const hit = await c.match(e.request); if (hit) return hit;
      try { const r = await fetch(e.request); if (r.ok) c.put(e.request, r.clone()); return r; } catch { return Response.error(); }
    }));
  } else if (url.origin === location.origin) {
    e.respondWith(caches.match(e.request).then(h => h || fetch(e.request)));
  }
});
