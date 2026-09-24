/* drone-cpf.js — gate de acesso do Curso de Drone (24/09/2026)
 *
 * Incluído em drone.html, drone-material.html e drone-aro.html. Antes dessas
 * páginas eram 100% públicas; agora exigem um dos dois acessos:
 *   - ALUNO: entra só com o CPF (sessão de 12h, header X-Aro, POST /api/aro/entrar).
 *   - GESTOR: login normal do dashboard (usuário/senha, POST /api/login),
 *     reaproveita bp_token/bp_user do resto do site — se a pessoa já estiver
 *     logada no dashboard neste navegador, entra direto sem digitar nada,
 *     desde que tenha a permissão "aro".
 *
 * Expõe window.droneCpf = { headers(), souGestor, nome, sair() } para as
 * páginas usarem nas chamadas ao Worker sem duplicar essa lógica 3x.
 */
(function () {
  if (window.__droneCpf) return;
  window.__droneCpf = true;

  var API_PADRAO = 'https://bpfron-api.bpfron.workers.dev';
  var apiBase = (function () {
    try { var q = new URLSearchParams(location.search).get('api'); if (q) return q.replace(/\/+$/, ''); } catch (e) {}
    return API_PADRAO;
  })();

  function ls(k, v) {
    try {
      if (v === undefined) return localStorage.getItem(k);
      if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v);
    } catch (e) {}
    return null;
  }

  var estado = { pronto: false, souGestor: false, nome: '' };

  window.droneCpf = {
    get pronto() { return estado.pronto; },
    get souGestor() { return estado.souGestor; },
    get nome() { return estado.nome; },
    headers: function () {
      if (estado.souGestor) { var t = ls('bp_token'); return t ? { authorization: 'Bearer ' + t } : {}; }
      var dr = ls('dr_token'); return dr ? { 'X-Aro': dr } : {};
    },
    sair: function () {
      ls('dr_token', null); ls('dr_nome', null); ls('bp_token', null); ls('bp_user', null); ls('bp_perms', null);
      location.reload();
    },
  };

  function onlyDigits(s) { return String(s || '').replace(/\D+/g, ''); }
  function mascaraCPF(inp) {
    var d = onlyDigits(inp.value).slice(0, 11);
    var out = d;
    if (d.length > 9) out = d.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, '$1.$2.$3-$4');
    else if (d.length > 6) out = d.replace(/(\d{3})(\d{3})(\d{1,3})/, '$1.$2.$3');
    else if (d.length > 3) out = d.replace(/(\d{3})(\d{1,3})/, '$1.$2');
    inp.value = out;
  }

  var CSS = '#drc-ovl{position:fixed;inset:0;z-index:2147483000;background:#060912;display:flex;align-items:center;justify-content:center;padding:16px;font-family:Inter,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}' +
    '#drc-box{width:100%;max-width:400px;background:rgba(12,17,30,.92);border:1px solid rgba(148,163,184,.14);border-radius:18px;padding:26px 24px;color:#dde3f0;box-shadow:0 20px 60px rgba(0,0,0,.6)}' +
    '#drc-box h2{margin:0 0 6px;font-size:21px;color:#fff;font-family:Rajdhani,sans-serif}#drc-box p{margin:0 0 16px;font-size:13.5px;line-height:1.55;color:#94a3b8}' +
    '#drc-box label{display:block;font-size:12.5px;font-weight:700;color:#cbd5e1;margin:12px 0 5px}' +
    '#drc-box input{width:100%;background:#060912;border:1px solid rgba(148,163,184,.14);border-radius:9px;padding:11px 13px;color:#e2e8f0;font-size:16px;outline:none;box-sizing:border-box}' +
    '#drc-box input:focus{border-color:rgba(245,197,24,.6)}' +
    '#drc-msg{min-height:18px;margin-top:12px;font-size:13px;color:#f87171}#drc-msg.ok{color:#34d399}' +
    '#drc-box button.drc-b{width:100%;border:0;border-radius:10px;padding:13px 14px;font-size:15px;font-weight:700;cursor:pointer;margin-top:14px}' +
    '#drc-entrar{background:linear-gradient(135deg,#F5C518,#e0a800);color:#1a1a1a}#drc-entrar:disabled{opacity:.5;cursor:default}' +
    '#drc-gestor-bt{background:transparent;color:#94a3b8;font-size:12.5px;text-decoration:underline;margin-top:14px;padding:4px}' +
    '#drc-voltar{background:rgba(148,163,184,.08);color:#cbd5e1}';

  function el(id) { return document.getElementById(id); }

  function montarGate() {
    if (!el('drc-css')) { var st = document.createElement('style'); st.id = 'drc-css'; st.textContent = CSS; document.head.appendChild(st); }
    var o = document.createElement('div');
    o.id = 'drc-ovl';
    o.innerHTML =
      '<div id="drc-box" role="dialog" aria-modal="true">' +
      '<div id="drc-passo-cpf">' +
        '<h2>🛩️ Curso de Drone</h2>' +
        '<p>Entre com o seu CPF para acessar o material e o formulário ARO.</p>' +
        '<label for="drc-cpf">Seu CPF</label>' +
        '<input id="drc-cpf" inputmode="numeric" placeholder="000.000.000-00" autocomplete="off">' +
        '<div id="drc-msg"></div>' +
        '<button type="button" class="drc-b" id="drc-entrar" disabled>Entrar</button>' +
        '<button type="button" class="drc-b" id="drc-gestor-bt">Sou gestor do curso</button>' +
      '</div>' +
      '<div id="drc-passo-gestor" style="display:none">' +
        '<h2>🔑 Login do gestor</h2>' +
        '<p>Use o mesmo usuário e senha do dashboard do BPFRON.</p>' +
        '<label for="drc-user">Usuário</label><input id="drc-user" autocomplete="username">' +
        '<label for="drc-pass">Senha</label><input id="drc-pass" type="password" autocomplete="current-password">' +
        '<div id="drc-msg2"></div>' +
        '<button type="button" class="drc-b" id="drc-entrar-gestor">Entrar</button>' +
        '<button type="button" class="drc-b drc-voltar" id="drc-voltar-bt">⬅ Entrar com CPF</button>' +
      '</div>' +
      '</div>';
    document.body.appendChild(o);
    document.body.style.overflow = 'hidden';

    var cpfInp = el('drc-cpf'), entrarBt = el('drc-entrar'), msg = el('drc-msg');
    cpfInp.addEventListener('input', function () { mascaraCPF(cpfInp); entrarBt.disabled = onlyDigits(cpfInp.value).length !== 11; });
    cpfInp.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' && !entrarBt.disabled) entrarCpf(); });
    entrarBt.onclick = entrarCpf;
    setTimeout(function () { cpfInp.focus(); }, 50);

    el('drc-gestor-bt').onclick = function () {
      el('drc-passo-cpf').style.display = 'none';
      el('drc-passo-gestor').style.display = 'block';
      setTimeout(function () { el('drc-user').focus(); }, 50);
    };
    el('drc-voltar-bt').onclick = function () {
      el('drc-passo-gestor').style.display = 'none';
      el('drc-passo-cpf').style.display = 'block';
    };

    function setMsg(alvo, t, ok) { alvo.textContent = t; alvo.className = ok ? 'ok' : ''; }

    function entrarCpf() {
      var cpf = onlyDigits(cpfInp.value);
      if (cpf.length !== 11) return;
      entrarBt.disabled = true; setMsg(msg, 'Entrando…', true);
      fetch(apiBase + '/api/aro/entrar', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ cpf: cpf }),
      }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { r: r, d: d }; }); })
        .then(function (x) {
          if (x.r.ok && x.d.token) {
            ls('dr_token', x.d.token); ls('dr_nome', x.d.nome || '');
            liberar(false, x.d.nome || '');
            return;
          }
          setMsg(msg, x.d.detail || 'CPF não autorizado. Fale com o gestor do curso.');
          entrarBt.disabled = false;
        }).catch(function () { setMsg(msg, 'Sem conexão com o servidor.'); entrarBt.disabled = false; });
    }

    el('drc-entrar-gestor').onclick = function () {
      var user = el('drc-user').value.trim(), pass = el('drc-pass').value;
      var msg2 = el('drc-msg2');
      if (!user || !pass) { setMsg(msg2, 'Preencha usuário e senha.'); return; }
      setMsg(msg2, 'Entrando…', true);
      fetch(apiBase + '/api/login', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ user: user, pass: pass }),
      }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { r: r, d: d }; }); })
        .then(function (x) {
          if (!x.r.ok || !x.d.token) { setMsg(msg2, x.d.detail || 'Usuário ou senha incorretos.'); return; }
          ls('bp_token', x.d.token); ls('bp_user', x.d.user || user);
          var perms = x.d.perms || [];
          if (perms.indexOf('aro') === -1) {
            setMsg(msg2, 'Esse login não tem permissão de gestor do ARO.');
            ls('bp_token', null); ls('bp_user', null);
            return;
          }
          liberar(true, x.d.nome || x.d.user || user);
        }).catch(function () { setMsg(msg2, 'Sem conexão com o servidor.'); });
    };
  }

  function liberar(souGestor, nome) {
    estado.souGestor = souGestor; estado.nome = nome; estado.pronto = true;
    var o = el('drc-ovl'); if (o) o.remove();
    document.body.style.overflow = '';
    document.dispatchEvent(new CustomEvent('drone-cpf-pronto', { detail: estado }));
  }

  // 401 em qualquer chamada /api/aro* (sessão de CPF/gestor vencida) -> some
  // com a sessão local e volta pro gate, sem esperar a pessoa recarregar sozinha.
  var fetchOrig = window.fetch;
  window.fetch = function (input, init) {
    var url = typeof input === 'string' ? input : (input && input.url) || '';
    var p = fetchOrig.apply(this, arguments);
    if (/\/api\/aro\b/.test(String(url))) {
      p.then(function (r) {
        if (r.status === 401 && estado.pronto) {
          estado.pronto = false;
          ls('dr_token', null); ls('dr_nome', null);
          if (estado.souGestor) { ls('bp_token', null); ls('bp_user', null); }
          montarGate();
        }
      }).catch(function () {});
    }
    return p;
  };

  function iniciar() {
    if (!document.body) { document.addEventListener('DOMContentLoaded', iniciar); return; }

    var bpToken = ls('bp_token');
    if (bpToken) {
      fetch(apiBase + '/api/me', { headers: { authorization: 'Bearer ' + bpToken } })
        .then(function (r) { return r.json().catch(function () { return {}; }); })
        .then(function (d) {
          if (d && d.authenticated && (d.perms || []).indexOf('aro') !== -1) {
            liberar(true, d.nome || ls('bp_user') || '');
            return;
          }
          tentarCpf();
        }).catch(tentarCpf);
      return;
    }
    tentarCpf();
  }

  function tentarCpf() {
    var drToken = ls('dr_token');
    if (drToken) { liberar(false, ls('dr_nome') || ''); return; }
    montarGate();
  }

  iniciar();
})();
