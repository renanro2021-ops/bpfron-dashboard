/* Service worker da Central de Tarefas (tarefas.html).
   Registrado com scope "./tarefas" — NÃO controla o resto do site.
   Só cuida dos avisos (Web Push): mostra a notificação mesmo com a página
   fechada e, ao tocar, abre a Central na tarefa. Não guarda cache de nada. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = { corpo: e.data ? e.data.text() : '' }; }
  e.waitUntil((async () => {
    const abertas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    abertas.forEach((c) => c.postMessage({ tipo: 'push', d }));   // a página aberta atualiza na hora
    await self.registration.showNotification(d.titulo || 'Central de Tarefas · BPFRON', {
      body: d.corpo || 'Você tem uma novidade na Central de Tarefas.',
      icon: 'tarefas-icon-192.png',
      badge: 'tarefas-badge.png',
      tag: d.tag || undefined,
      renotify: !!d.tag,
      requireInteraction: d.nivel === 'alta',
      vibrate: d.nivel === 'alta' ? [200, 100, 200, 100, 200] : [120, 60, 120],
      data: { tarefa: d.tarefa || '' },
    });
  })());
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const id = (e.notification.data || {}).tarefa || '';
  const url = new URL('tarefas.html' + (id ? '#t=' + encodeURIComponent(id) : ''), self.registration.scope).href;
  e.waitUntil((async () => {
    const abertas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const c = abertas.find((x) => /tarefas\.html/.test(x.url));
    if (c) { await c.focus(); if (id) c.postMessage({ tipo: 'abrir', tarefa: id }); return; }
    await self.clients.openWindow(url);
  })());
});
