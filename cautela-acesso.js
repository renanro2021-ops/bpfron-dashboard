/* cautela-acesso.js — entrada da Cautela de armamento (28/10/2026)
 *
 * A senha da Cautela é a ÚNICA do Portal do Policial: a mesma das Tarefas pelo RE
 * (rota /api/tarefas/entrar, que desde a Cautela vale para todo o efetivo). Quem tem
 * login do dashboard pode entrar com ele. Usado por cautela.html e cautela-reserva.html.
 *
 *   CA.token()              token da sessão (RE: tar_token · dashboard: bp_token)
 *   CA.peloRE()             a sessão é a do RE (senha do Portal)?
 *   CA.montar(el, {re, aoEntrar, aviso})   desenha o formulário de entrada em `el`
 *   CA.esquecer()           a sessão caiu (401): apaga só o token que estava em uso
 *   CA.sair()               sai do RE e do dashboard neste aparelho
 *   CA.trocarSenha()        troca voluntária (RE: /api/tarefas/minha-senha · dashboard: conta.js)
 */
(function () {
  if (window.CA) return;
  var API = (function () {
    try {
      var q = new URLSearchParams(location.search).get('api');
      if (q && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(q.replace(/\/+$/, ''))) return q.replace(/\/+$/, '');
    } catch (e) {}
    return 'https://bpfron-api.bpfron.workers.dev';
  })();
  var ls = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) {} },
  };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var re5 = function (v) { return String(v || '').replace(/\D/g, '').slice(-5); };

  var CSS = '.ca-seg{display:flex;gap:6px;margin-bottom:14px}' +
    '.ca-seg button{flex:1;background:rgba(148,163,184,.08);border:1px solid rgba(148,163,184,.16);border-radius:12px;padding:11px 8px;color:#94a3b8;font:inherit;font-size:14.5px;font-weight:700;cursor:pointer;min-height:46px}' +
    '.ca-seg button.on{background:rgba(245,197,24,.14);border-color:rgba(245,197,24,.45);color:#F5C518}' +
    '.ca-pa{border-radius:12px;padding:11px 13px;margin:12px 0 2px;font-size:14px;line-height:1.5;background:rgba(245,197,24,.08);border:1px solid rgba(245,197,24,.35);color:#e2e8f0}' +
    '.ca-link{background:none;border:none;color:#F5C518;font:inherit;font-size:14px;cursor:pointer;padding:10px 0 0;text-decoration:underline}' +
    '.ca-nota{font-size:13px;color:#94a3b8;margin-top:12px;line-height:1.55}' +
    '.ca-hide{display:none!important}';
  function estilo() {
    if (document.getElementById('ca-css')) return;
    var st = document.createElement('style'); st.id = 'ca-css'; st.textContent = CSS; document.head.appendChild(st);
  }

  var CA = window.CA = {
    API: API,
    token: function () { return ls.get('tar_token') || ls.get('bp_token') || ''; },
    peloRE: function () { return !!ls.get('tar_token'); },
    esquecer: function () {
      if (ls.get('tar_token')) { ls.set('tar_token', null); ls.set('tar_user', null); }
      else { ls.set('bp_token', null); ls.set('bp_user', null); ls.set('bp_perms', null); }
    },
    sair: function () {
      ['tar_token', 'tar_user', 'bp_token', 'bp_user', 'bp_perms'].forEach(function (k) { ls.set(k, null); });
    },
  };

  /* ---------------- formulário de entrada ---------------- */
  CA.montar = function (el, opt) {
    opt = opt || {};
    estilo();
    var MODO = '';            // '' (normal) | 'primeiro' | 'trocar'
    var PRECISA = 'cpf4';
    el.innerHTML =
      '<div class="ca-seg"><button type="button" data-m="re" class="on">' + (opt.rotuloRE || '🪪 RE e senha') + '</button><button type="button" data-m="dash">' + (opt.rotuloDash || '🔑 Login do dashboard') + '</button></div>' +
      (opt.aviso ? '<div class="ca-pa">' + opt.aviso + '</div>' : '') +
      '<form data-p="re" onsubmit="return false">' +
      '  <label for="ca-re">RE</label><input id="ca-re" name="username" inputmode="numeric" autocomplete="username" maxlength="12" placeholder="ex.: 94186">' +
      '  <div class="ca-pa ca-hide" id="ca-pa"></div>' +
      '  <div id="ca-w-senha"><label for="ca-senha" id="ca-senha-l">Senha</label><input id="ca-senha" name="password" type="password" autocomplete="current-password"></div>' +
      '  <div id="ca-w-conf" class="ca-hide"><label for="ca-conf" id="ca-conf-l">4 últimos dígitos do CPF</label><input id="ca-conf" autocomplete="off"></div>' +
      '  <div id="ca-w-nova" class="ca-hide"><label for="ca-nova">Crie a sua senha (mínimo 6 caracteres)</label><input id="ca-nova" type="password" autocomplete="new-password">' +
      '    <label for="ca-nova2">Repita a senha</label><input id="ca-nova2" type="password" autocomplete="new-password"></div>' +
      '  <div class="msg" id="ca-msg"></div>' +
      '  <button class="btn full" id="ca-ok" type="button">Entrar</button>' +
      '  <button class="ca-link" id="ca-primeiro" type="button">Primeiro acesso (ainda não tenho senha)</button>' +
      '  <p class="ca-nota">É a <b>mesma senha do Portal do Policial</b> (Tarefas e ficha). No 1º acesso você cria com o RE e os 4 últimos dígitos do CPF. Esqueceu? Peça à P4 para zerar e faça o 1º acesso de novo.</p>' +
      '</form>' +
      '<form data-p="dash" class="ca-hide" onsubmit="return false">' +
      '  <label for="ca-user">Usuário</label><input id="ca-user" name="username" autocomplete="username" autocapitalize="none" spellcheck="false">' +
      '  <label for="ca-pass">Senha</label><input id="ca-pass" name="password" type="password" autocomplete="current-password">' +
      '  <div class="msg" id="ca-msg2"></div>' +
      '  <button class="btn full" id="ca-ok2" type="button">Entrar</button>' +
      '  <p class="ca-nota">' + (opt.notaDash || 'Mesmo usuário e senha do dashboard. O seu RE vem da ligação feita no Portal do Policial.') + '</p>' +
      '</form>';
    var $ = function (id) { return el.querySelector('#' + id); };
    var vis = function (id, on) { $(id).classList.toggle('ca-hide', !on); };
    var msg = function (id, t, ok) { var m = $(id); m.className = 'msg ' + (ok ? 'ok' : t ? 'err' : ''); m.textContent = t || ''; };
    if (opt.re) $('ca-re').value = re5(opt.re);

    function aba(m) {
      el.querySelectorAll('.ca-seg button').forEach(function (b) { b.classList.toggle('on', b.dataset.m === m); });
      el.querySelector('[data-p="re"]').classList.toggle('ca-hide', m !== 're');
      el.querySelector('[data-p="dash"]').classList.toggle('ca-hide', m !== 'dash');
      setTimeout(function () { var i = m === 're' ? ($('ca-re').value ? $('ca-senha') : $('ca-re')) : $('ca-user'); if (i) i.focus(); }, 30);
    }
    el.querySelectorAll('.ca-seg button').forEach(function (b) { b.onclick = function () { aba(b.dataset.m); }; });

    function modo(m, precisa, nome) {
      MODO = m; PRECISA = precisa || PRECISA;
      var quem = nome ? '<b>' + esc(nome) + '</b>, ' : '';
      vis('ca-pa', !!m);
      vis('ca-w-senha', m !== 'primeiro');
      vis('ca-w-conf', m === 'primeiro');
      vis('ca-w-nova', !!m);
      vis('ca-primeiro', !m);
      if (m === 'primeiro') {
        var cpf = PRECISA === 'cpf4';
        $('ca-conf-l').textContent = cpf ? '4 últimos dígitos do CPF' : 'Sua data de nascimento';
        $('ca-conf').placeholder = cpf ? 'ex.: 1234' : 'dd/mm/aaaa';
        $('ca-conf').inputMode = cpf ? 'numeric' : 'text';
        $('ca-pa').innerHTML = '👋 ' + quem + 'é o seu primeiro acesso. Confirme quem é você e <b>crie a sua senha</b> — ela vale para a Cautela, as Tarefas e a ficha (Portal do Policial).';
        $('ca-ok').textContent = 'Criar senha e entrar';
      } else if (m === 'trocar') {
        $('ca-senha-l').textContent = 'Senha provisória';
        $('ca-pa').innerHTML = '🔐 ' + quem + 'você entrou com uma senha provisória. <b>Crie a sua senha</b> para continuar.';
        $('ca-ok').textContent = 'Salvar senha e entrar';
      } else {
        $('ca-senha-l').textContent = 'Senha';
        $('ca-ok').textContent = 'Entrar';
      }
    }

    async function entrarRE(soConsultar) {
      var re = $('ca-re').value.replace(/\D/g, '');
      msg('ca-msg', '');
      if (re.length < 4) { msg('ca-msg', 'Digite o seu RE (5 dígitos).'); $('ca-re').focus(); return; }
      // para:'cautela' — quem tem login do dashboard também entra pelo RE aqui (o armeiro entra só pelo RE)
      var corpo = { re: re, para: 'cautela' };
      if (!soConsultar) {
        if (MODO !== 'primeiro') corpo.senha = $('ca-senha').value;
        if (MODO) {
          var n1 = $('ca-nova').value, n2 = $('ca-nova2').value;
          if (MODO === 'primeiro') { corpo.confirma = $('ca-conf').value.trim(); if (!corpo.confirma) { msg('ca-msg', 'Preencha a confirmação.'); return; } }
          if (n1.length < 6) { msg('ca-msg', 'A senha precisa de pelo menos 6 caracteres.'); return; }
          if (n1 !== n2) { msg('ca-msg', 'As duas senhas não são iguais.'); return; }
          corpo.nova = n1;
        } else if (!corpo.senha) { msg('ca-msg', 'Digite a senha (ou toque em “Primeiro acesso”).'); return; }
      }
      var btn = $('ca-ok'), txt = btn.textContent; btn.disabled = true; btn.textContent = 'Aguarde…';
      try {
        var r = await fetch(API + '/api/tarefas/entrar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) });
        var d = await r.json().catch(function () { return {}; });
        if (d.token) {
          ls.set('tar_token', d.token); ls.set('tar_user', d.user);
          ['ca-senha', 'ca-conf', 'ca-nova', 'ca-nova2'].forEach(function (i) { $(i).value = ''; });
          modo('');
          if (opt.aoEntrar) opt.aoEntrar(d);
          return;
        }
        if (d.primeiro) {
          if (d.precisa === 'provisoria') { modo(''); throw new Error(d.detail || 'Peça uma senha provisória à P4.'); }
          modo('primeiro', d.precisa, d.nome); setTimeout(function () { $('ca-conf').focus(); }, 50); return;
        }
        if (d.trocar) { modo('trocar', '', d.nome); setTimeout(function () { $('ca-nova').focus(); }, 50); return; }
        if (d.error === 'use_login') { aba('dash'); msg('ca-msg2', d.detail || 'Entre com o seu login do dashboard.'); return; }
        if (soConsultar && d.error === 'invalid_credentials') throw new Error('Este RE já tem senha. Entre com ela — se esqueceu, peça à P4 para zerar.');
        throw new Error(d.detail || 'Não foi possível entrar.');
      } catch (e) { msg('ca-msg', e.message || 'Não foi possível conectar ao servidor.'); }
      finally { btn.disabled = false; if (btn.textContent === 'Aguarde…') btn.textContent = txt; }
    }
    $('ca-ok').onclick = function () { entrarRE(false); };
    $('ca-primeiro').onclick = function () { entrarRE(true); };
    $('ca-re').addEventListener('keydown', function (e) { if (e.key === 'Enter') (MODO === 'primeiro' ? $('ca-conf') : $('ca-senha')).focus(); });
    ['ca-senha', 'ca-nova2'].forEach(function (i) { $(i).addEventListener('keydown', function (e) { if (e.key === 'Enter') entrarRE(false); }); });
    $('ca-conf').addEventListener('keydown', function (e) { if (e.key === 'Enter') $('ca-nova').focus(); });
    $('ca-re').addEventListener('input', function () { if (MODO) modo(''); });

    async function entrarDash() {
      var user = $('ca-user').value.trim().toLowerCase(), pass = $('ca-pass').value;
      msg('ca-msg2', '');
      if (!user || !pass) { msg('ca-msg2', 'Informe usuário e senha.'); return; }
      var btn = $('ca-ok2'); btn.disabled = true; btn.textContent = 'Entrando…';
      try {
        var r = await fetch(API + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user: user, pass: pass }) });
        var d = await r.json().catch(function () { return {}; });
        if (!r.ok || !d.token) throw new Error(d.error === 'invalid_credentials' ? 'Usuário ou senha inválidos.' : (d.detail || 'Falha no login.'));
        // a sessão do dashboard passa a valer aqui (sai da sessão do RE neste aparelho, como no Portal)
        ls.set('tar_token', null); ls.set('tar_user', null);
        ls.set('bp_token', d.token); ls.set('bp_user', d.user);
        if (d.perms) ls.set('bp_perms', JSON.stringify({ user: d.user, nome: d.nome, admin: !!d.admin, perms: d.perms, bloqueios: d.bloqueios || [] }));
        $('ca-pass').value = '';
        if (opt.aoEntrar) opt.aoEntrar(d);
      } catch (e) { msg('ca-msg2', e.message || 'Não foi possível conectar ao servidor.'); }
      finally { btn.disabled = false; btn.textContent = 'Entrar'; }
    }
    $('ca-ok2').onclick = entrarDash;
    $('ca-user').addEventListener('keydown', function (e) { if (e.key === 'Enter') $('ca-pass').focus(); });
    $('ca-pass').addEventListener('keydown', function (e) { if (e.key === 'Enter') entrarDash(); });
    modo(''); aba('re');
  };

  /* ---------------- troca voluntária de senha ---------------- */
  CA.trocarSenha = function () {
    if (!CA.peloRE()) { if (window.bpTrocarSenha) window.bpTrocarSenha(); return; }
    estilo();
    var o = document.createElement('div'); o.className = 'ovl';
    o.innerHTML = '<div class="modal"><h2>Trocar a minha senha</h2><p class="muted">É a senha do Portal do Policial: vale para a Cautela, as Tarefas e a ficha. Ao trocar, este aparelho continua conectado.</p>' +
      '<label for="ca-t-at">Senha atual</label><input id="ca-t-at" type="password" autocomplete="current-password">' +
      '<label for="ca-t-n1">Senha nova (mínimo 6 caracteres)</label><input id="ca-t-n1" type="password" autocomplete="new-password">' +
      '<label for="ca-t-n2">Repita a senha nova</label><input id="ca-t-n2" type="password" autocomplete="new-password">' +
      '<div class="msg err" id="ca-t-msg"></div>' +
      '<div style="display:flex;gap:10px;margin-top:12px"><button class="btn sec" id="ca-t-nao" type="button" style="flex:1">Cancelar</button><button class="btn" id="ca-t-ok" type="button" style="flex:2">Salvar</button></div></div>';
    document.body.appendChild(o);
    var q = function (id) { return o.querySelector('#' + id); };
    q('ca-t-nao').onclick = function () { o.remove(); };
    q('ca-t-ok').onclick = async function () {
      var at = q('ca-t-at').value, n1 = q('ca-t-n1').value, n2 = q('ca-t-n2').value, m = q('ca-t-msg');
      if (!at) { m.textContent = 'Digite a senha atual.'; return; }
      if (n1.length < 6) { m.textContent = 'A senha nova precisa de pelo menos 6 caracteres.'; return; }
      if (n1 !== n2) { m.textContent = 'As duas senhas novas não são iguais.'; return; }
      var b = q('ca-t-ok'); b.disabled = true;
      try {
        var r = await fetch(API + '/api/tarefas/minha-senha', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + CA.token() }, body: JSON.stringify({ atual: at, nova: n1 }) });
        var d = await r.json().catch(function () { return {}; });
        if (!r.ok || !d.token) throw new Error(d.detail || (d.error === 'senha_incorreta' ? 'A senha atual não confere.' : 'Não foi possível trocar.'));
        ls.set('tar_token', d.token);
        o.remove();
        if (window.toast) window.toast('Senha trocada ✔');
      } catch (e) { m.textContent = e.message; b.disabled = false; }
    };
    setTimeout(function () { q('ca-t-at').focus(); }, 50);
  };
})();
