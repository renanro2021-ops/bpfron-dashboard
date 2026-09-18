/* conta.js — troca de senha do usuário (BPFRON, 18/09/2026)
 *
 * Incluído em todas as páginas com login. Não depende da página:
 *  - observa as respostas do Worker (fetch). Se o login/me vier com
 *    trocarSenha:true, ou qualquer API responder 403 "trocar_senha"
 *    (senha provisória criada/redefinida no admin.html), abre a tela
 *    OBRIGATÓRIA de troca — nova senha + repetir, mínimo 6 caracteres.
 *  - window.bpTrocarSenha() abre a troca voluntária (pede a senha atual).
 * Depois de trocar, grava o token novo em localStorage.bp_token e recarrega.
 */
(function () {
  if (window.__bpConta) return;
  window.__bpConta = true;

  var API_PADRAO = 'https://bpfron-api.bpfron.workers.dev';
  var apiBase = (function () {
    try { var q = new URLSearchParams(location.search).get('api'); if (q) return q.replace(/\/+$/, ''); } catch (e) {}
    return API_PADRAO;
  })();
  var aberta = false;

  function ls(k, v) {
    try {
      if (v === undefined) return localStorage.getItem(k);
      if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v);
    } catch (e) {}
    return null;
  }

  // ---------- observa o fetch da página ----------
  var fetchOrig = window.fetch;
  window.fetch = function (input, init) {
    var url = typeof input === 'string' ? input : (input && input.url) || '';
    var p = fetchOrig.apply(this, arguments);
    var m = String(url).match(/^(.*?)\/api\/([a-z/]+)/i);
    if (m) {
      p.then(function (r) {
        var rota = m[2].replace(/\/+$/, '');
        if (rota !== 'login' && rota !== 'me' && r.status !== 403) return;
        if (m[1]) apiBase = m[1];
        r.clone().json().then(function (d) {
          if (d && (d.trocarSenha === true || d.error === 'trocar_senha')) abrir(true);
        }).catch(function () {});
      }).catch(function () {});
    }
    return p;
  };

  // ---------- tela ----------
  var CSS = '#bpc-ovl{position:fixed;inset:0;z-index:2147483000;background:rgba(2,6,23,.86);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:16px;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}' +
    '#bpc-box{width:100%;max-width:400px;background:#0f172a;border:1px solid #1e293b;border-radius:16px;padding:24px 22px;color:#e2e8f0;box-shadow:0 20px 60px rgba(0,0,0,.5)}' +
    '#bpc-box h2{margin:0 0 6px;font-size:20px;color:#f8fafc}#bpc-box p{margin:0 0 16px;font-size:14px;line-height:1.5;color:#94a3b8}' +
    '#bpc-box label{display:block;font-size:13px;color:#cbd5e1;margin:12px 0 5px}' +
    '#bpc-box .bpc-in{display:flex;gap:6px}#bpc-box input{flex:1;min-width:0;background:#020617;border:1px solid #334155;border-radius:10px;padding:11px 13px;color:#f1f5f9;font-size:16px;outline:none}' +
    '#bpc-box input:focus{border-color:#22c55e}#bpc-box .bpc-olho{background:#1e293b;border:1px solid #334155;border-radius:10px;color:#cbd5e1;padding:0 12px;cursor:pointer;font-size:15px}' +
    '#bpc-regras{list-style:none;margin:12px 0 0;padding:0;font-size:13px}#bpc-regras li{color:#64748b;margin:3px 0}#bpc-regras li.ok{color:#4ade80}' +
    '#bpc-msg{min-height:18px;margin-top:12px;font-size:13.5px;color:#fca5a5}#bpc-msg.ok{color:#4ade80}' +
    '#bpc-box .bpc-bts{display:flex;gap:8px;margin-top:14px;flex-wrap:wrap}#bpc-box button.bpc-b{flex:1;border:0;border-radius:10px;padding:12px 14px;font-size:15px;font-weight:600;cursor:pointer}' +
    '#bpc-salvar{background:#16a34a;color:#fff}#bpc-salvar:disabled{opacity:.5;cursor:default}#bpc-sec{background:#1e293b;color:#cbd5e1}';

  function el(id) { return document.getElementById(id); }

  function abrir(obrigatoria) {
    if (aberta) return;
    if (!document.body) { document.addEventListener('DOMContentLoaded', function () { abrir(obrigatoria); }); return; }
    aberta = true;
    if (!el('bpc-css')) { var st = document.createElement('style'); st.id = 'bpc-css'; st.textContent = CSS; document.head.appendChild(st); }
    var nome = ls('bp_user') || '';
    var o = document.createElement('div');
    o.id = 'bpc-ovl';
    o.innerHTML = '<div id="bpc-box" role="dialog" aria-modal="true" aria-labelledby="bpc-tit">' +
      '<h2 id="bpc-tit">🔑 ' + (obrigatoria ? 'Troque sua senha' : 'Trocar minha senha') + '</h2>' +
      '<p>' + (obrigatoria
        ? 'Você entrou com uma <b>senha provisória</b>' + (nome ? ' (login <b>' + esc(nome) + '</b>)' : '') + '. Escolha agora uma senha só sua para continuar.'
        : 'Escolha uma nova senha. As sessões abertas em outros aparelhos serão encerradas.') + '</p>' +
      (obrigatoria ? '' : '<label for="bpc-atual">Senha atual</label><div class="bpc-in"><input id="bpc-atual" type="password" autocomplete="current-password"></div>') +
      '<label for="bpc-nova">Nova senha</label><div class="bpc-in"><input id="bpc-nova" type="password" autocomplete="new-password" spellcheck="false"><button type="button" class="bpc-olho" id="bpc-olho" title="Mostrar/ocultar">👁</button></div>' +
      '<label for="bpc-conf">Repita a nova senha</label><div class="bpc-in"><input id="bpc-conf" type="password" autocomplete="new-password" spellcheck="false"></div>' +
      '<ul id="bpc-regras"><li id="bpc-r1">○ Pelo menos 6 caracteres</li><li id="bpc-r2">○ As duas senhas iguais</li></ul>' +
      '<p style="margin:8px 0 0;font-size:12.5px">Pode usar letras maiúsculas, números e caracteres especiais.</p>' +
      '<div id="bpc-msg"></div>' +
      '<div class="bpc-bts"><button type="button" class="bpc-b" id="bpc-salvar" disabled>Salvar nova senha</button>' +
      '<button type="button" class="bpc-b" id="bpc-sec">' + (obrigatoria ? 'Sair' : 'Cancelar') + '</button></div></div>';
    document.body.appendChild(o);
    var ovfAntes = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function valida() {
      var n = el('bpc-nova').value, c = el('bpc-conf').value;
      var r1 = n.length >= 6, r2 = r1 && n === c;
      el('bpc-r1').className = r1 ? 'ok' : ''; el('bpc-r1').textContent = (r1 ? '✓' : '○') + ' Pelo menos 6 caracteres';
      el('bpc-r2').className = r2 ? 'ok' : ''; el('bpc-r2').textContent = (r2 ? '✓' : '○') + ' As duas senhas iguais';
      el('bpc-salvar').disabled = !(r1 && r2) || (!obrigatoria && !el('bpc-atual').value);
      return r1 && r2;
    }
    ['bpc-nova', 'bpc-conf', 'bpc-atual'].forEach(function (id) {
      var i = el(id); if (!i) return;
      i.addEventListener('input', valida);
      i.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' && !el('bpc-salvar').disabled) salvar(); });
    });
    el('bpc-olho').onclick = function () {
      var t = el('bpc-nova').type === 'password' ? 'text' : 'password';
      el('bpc-nova').type = el('bpc-conf').type = t;
    };
    el('bpc-sec').onclick = function () {
      if (obrigatoria) {
        ls('bp_token', null); ls('bp_user', null); ls('bp_perms', null);
        location.reload();
      } else fechar();
    };
    function fechar() { o.remove(); document.body.style.overflow = ovfAntes; aberta = false; }
    function msg(t, ok) { el('bpc-msg').textContent = t; el('bpc-msg').className = ok ? 'ok' : ''; }

    function salvar() {
      if (!valida()) return;
      var tok = ls('bp_token');
      if (!tok) { msg('Sua sessão expirou. Entre de novo.'); return; }
      el('bpc-salvar').disabled = true; msg('Salvando…', true);
      fetchOrig(apiBase + '/api/conta/senha', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: 'Bearer ' + tok },
        body: JSON.stringify({ nova: el('bpc-nova').value, confirma: el('bpc-conf').value, atual: el('bpc-atual') ? el('bpc-atual').value : '' })
      }).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (d) { return { r: r, d: d }; });
      }).then(function (x) {
        if (x.r.ok && x.d.token) {
          ls('bp_token', x.d.token);
          if (x.d.perms) ls('bp_perms', JSON.stringify(x.d.perms));
          msg('✅ Senha alterada! Carregando…', true);
          setTimeout(function () { location.reload(); }, 900);
          return;
        }
        if (x.r.status === 401) msg('Sua sessão expirou. Toque em ' + (obrigatoria ? '"Sair"' : '"Cancelar"') + ' e entre de novo.');
        else msg(x.d.detail || 'Não foi possível trocar a senha (' + x.r.status + ').');
        valida();
      }).catch(function () { msg('Sem conexão com o servidor. Tente de novo.'); valida(); });
    }
    el('bpc-salvar').onclick = salvar;
    setTimeout(function () { (el('bpc-atual') || el('bpc-nova')).focus(); }, 50);
  }

  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  window.bpTrocarSenha = function () {
    if (!ls('bp_token')) { alert('Entre com seu login primeiro.'); return; }
    abrir(false);
  };
})();
