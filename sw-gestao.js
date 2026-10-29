/* Service worker do Portal da Gestão (gestao.html).
   Registrado com scope "./gestao" — NÃO controla o resto do site.
   Só existe para o portal poder ser instalado como app. Não guarda cache:
   sempre busca a versão nova; sem internet mostra um aviso simples. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (e) => {
  if (e.request.mode !== 'navigate') return;
  e.respondWith(fetch(e.request).catch(() => new Response(
    '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<body style="margin:0;background:#060912;color:#e2e8f0;font:16px system-ui;display:grid;place-items:center;min-height:100vh;text-align:center;padding:16px">' +
    '<div><div style="font-size:42px">📶</div><h2 style="color:#F5C518">Sem internet</h2><p>O Portal da Gestão precisa de conexão.<br>Assim que voltar o sinal, toque abaixo.</p>' +
    '<button onclick="location.reload()" style="margin-top:12px;padding:12px 18px;border:0;border-radius:12px;background:#F5C518;font-weight:800">Tentar de novo</button></div>',
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } })));
});
