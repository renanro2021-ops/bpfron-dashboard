/* drone-cpf.js — gate de acesso do Curso de Drone (24/09/2026)
 *
 * Incluído em drone.html, drone-material.html, drone-aro.html,
 * drone-simulado.html, drone-alunos.html e nas apostilas da pasta apostilas/
 * (lá o caminho é ../drone-cpf.js). Antes dessas páginas eram 100% públicas;
 * agora exigem um dos dois acessos:
 *   - ALUNO: entra só com o CPF (sessão de 12h, header X-Aro, POST /api/aro/entrar).
 *   - GESTOR: login normal do dashboard (usuário/senha, POST /api/login),
 *     reaproveita bp_token/bp_user do resto do site — se a pessoa já estiver
 *     logada no dashboard neste navegador, entra direto sem digitar nada,
 *     desde que tenha a permissão "aro".
 *
 * Expõe window.droneCpf = { headers(), souGestor, nome, sair() } para as
 * páginas usarem nas chamadas ao Worker sem duplicar essa lógica 3x.
 *
 * 26/09/2026 — tela de BOAS-VINDAS: passado o gate, aparece uma vez por sessão
 * do navegador (sessionStorage) uma saudação com o nome de quem entrou e se é
 * aluno ou gestor. Some sozinha em ~2,6 s, ou no primeiro toque/tecla. Fica
 * aqui, e não em cada página, pra valer igual nas 5 páginas e nas apostilas.
 *
 * 01/10/2026 — SESSÃO VENCIDA (aluno "não consegue ver o ranking"): o token do
 * CPF vale 12 h no Worker, mas a página liberava qualquer dr_token guardado sem
 * olhar a validade, e só reabria o gate em 401 das rotas /api/aro. No dia
 * seguinte o aluno via a página normal, mas o ranking respondia "Entre com o seu
 * CPF" e o resultado do simulado NÃO era gravado. Agora: (1) a validade (exp do
 * JWT) é conferida ao abrir; (2) 401 de /api/aro e /api/drone reabre o gate; e
 * (3) droneCpf.aposLogin() devolve uma Promise que resolve quando a pessoa
 * entrar de novo — a página usa pra repetir o envio que falhou, sem perder nada.
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
  var esperandoLogin = [];

  // exp do JWT do CPF (sem validar assinatura: isso é o Worker que faz; aqui é só
  // para não abrir a página com uma sessão que o servidor já vai recusar).
  function tokenVencido(t) {
    try {
      var p = JSON.parse(atob(String(t).split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      return !!p.exp && p.exp * 1000 < Date.now() + 60000;
    } catch (e) { return true; }
  }

  function sessaoVencida() {
    if (!estado.pronto && document.getElementById('drc-ovl')) return;
    estado.pronto = false;
    ls('dr_token', null); ls('dr_nome', null);
    if (estado.souGestor) { ls('bp_token', null); ls('bp_user', null); }
    montarGate('Sua sessão venceu. Entre de novo — o que você estava fazendo continua de onde parou.');
  }

  window.droneCpf = {
    get pronto() { return estado.pronto; },
    get souGestor() { return estado.souGestor; },
    get nome() { return estado.nome; },
    headers: function () {
      if (estado.souGestor) { var t = ls('bp_token'); return t ? { authorization: 'Bearer ' + t } : {}; }
      var dr = ls('dr_token'); return dr ? { 'X-Aro': dr } : {};
    },
    aposLogin: function () {
      if (estado.pronto) return Promise.resolve(estado);
      return new Promise(function (ok) { esperandoLogin.push(ok); });
    },
    sessaoVencida: function () { sessaoVencida(); },
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

  function montarGate(aviso) {
    if (el('drc-ovl')) return;
    if (!el('drc-css')) { var st = document.createElement('style'); st.id = 'drc-css'; st.textContent = CSS; document.head.appendChild(st); }
    var o = document.createElement('div');
    o.id = 'drc-ovl';
    o.innerHTML =
      '<div id="drc-box" role="dialog" aria-modal="true">' +
      '<div id="drc-passo-cpf">' +
        '<h2>🛩️ Curso de Drone</h2>' +
        '<p>' + (aviso ? '<b style="color:#fcd34d">' + esc(aviso) + '</b>' : 'Entre com o seu CPF para acessar o material e o formulário ARO.') + '</p>' +
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
          liberar(true, x.d.nome || NOMES_LOGIN[String(user).toLowerCase()] || x.d.user || user);
        }).catch(function () { setMsg(msg2, 'Sem conexão com o servidor.'); });
    };
  }

  function liberar(souGestor, nome) {
    estado.souGestor = souGestor; estado.nome = nome; estado.pronto = true;
    var fila = esperandoLogin; esperandoLogin = [];
    setTimeout(function () { fila.forEach(function (ok) { try { ok(estado); } catch (e) {} }); }, 0);
    var o = el('drc-ovl'); if (o) o.remove();
    document.body.style.overflow = '';
    boasVindas(souGestor, nome);
    document.dispatchEvent(new CustomEvent('drone-cpf-pronto', { detail: estado }));
  }

  /* ---------- boas-vindas ----------
     Uma vez por sessão do navegador e por pessoa: trocar de aluno pra gestor no
     mesmo navegador mostra de novo. Como é sessionStorage, fechar o navegador
     zera — quem volta no dia seguinte é recebido outra vez. */
  var CSS_BV = '#drc-bv{position:fixed;inset:0;z-index:2147483100;display:flex;align-items:center;justify-content:center;padding:20px;' +
    'background:radial-gradient(ellipse 70% 60% at 50% 30%,rgba(29,78,216,.28),rgba(6,9,18,.97) 70%),#060912;' +
    'font-family:Inter,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;text-align:center;' +
    'animation:drcFade .35s ease both;cursor:pointer}' +
    '#drc-bv.sai{animation:drcOut .45s ease both}' +
    '#drc-bv .cx{max-width:420px}' +
    '#drc-bv img{height:74px;width:74px;border-radius:50%;object-fit:cover;box-shadow:0 10px 40px rgba(0,0,0,.6);animation:drcPop .5s cubic-bezier(.2,1.4,.4,1) both}' +
    '#drc-bv .ola{margin-top:16px;font-size:12.5px;letter-spacing:2.5px;text-transform:uppercase;color:#F5C518;font-weight:700}' +
    '#drc-bv .nm{margin-top:6px;font-family:Rajdhani,sans-serif;font-size:27px;line-height:1.15;font-weight:700;color:#fff}' +
    '#drc-bv .pp{margin-top:10px;font-size:13px;color:#94a3b8}' +
    '#drc-bv .pp b{color:#cbd5e1}' +
    '#drc-bv .bar{margin:20px auto 0;width:120px;height:3px;border-radius:3px;background:rgba(148,163,184,.18);overflow:hidden}' +
    '#drc-bv .bar i{display:block;height:100%;width:100%;background:linear-gradient(90deg,#F5C518,#34d399);transform-origin:left;animation:drcBar 2.6s linear both}' +
    '@keyframes drcFade{from{opacity:0}to{opacity:1}}' +
    '@keyframes drcOut{to{opacity:0;visibility:hidden}}' +
    '@keyframes drcPop{from{opacity:0;transform:scale(.6)}to{opacity:1;transform:scale(1)}}' +
    '@keyframes drcBar{from{transform:scaleX(0)}to{transform:scaleX(1)}}' +
    '@media (prefers-reduced-motion:reduce){#drc-bv,#drc-bv img,#drc-bv .bar i{animation-duration:.01s}}';

  /* Nome bonito pra saudação. Três casos que aparecem de verdade:
     - "CB QPPM De Sousa" / "1º SGT QPPM Camilo": posto na frente -> mostra o
       nome de guerra (o que vem depois do posto/quadro);
     - "Grupamento de Radiopatrulha Aérea" / "Núcleo de Inteligência": nome de
       setor, não tem posto -> mostra inteiro;
     - "ALAN DA SILVA SAMPAIO" (relação do curso) -> dois primeiros nomes. */
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  var POSTO = /^(SD|CB|CABO|SGT|\d+º?\s*SGT|SUB\s*TEN|ST|TEN|1º\s*TEN|2º\s*TEN|CAP|MAJ|TC|CEL|ASP|APC|DPC|DAT|ESCRIV)/i;
  var QUADRO = /^(QPPM|QPBM|QOPM|QOBM|QPMP|PM|BM|PC)$/i;

  function nomeSaudacao(n) {
    var t = String(n || '').replace(/\s+/g, ' ').trim();
    if (!t) return '';
    var p = t.split(' ');
    if (POSTO.test(t)) {
      // pula posto e quadro e fica com o resto ("CB QPPM De Sousa" -> "De Sousa")
      var i = 1;
      while (i < p.length && (QUADRO.test(p[i]) || /^(QPPM|QPBM|QOPM|QOBM)$/i.test(p[i]))) i++;
      var resto = p.slice(i).join(' ');
      return (resto || t).slice(0, 44);
    }
    if (p.length > 3 && /^[A-ZÁÂÃÉÊÍÓÔÕÚÇ ]+$/.test(t)) {
      // nome completo em maiúsculas (relação do curso): dois primeiros
      return p.slice(0, 2).join(' ');
    }
    return t.slice(0, 44);
  }

  // Nome de exibição de logins conhecidos, pra quando o painel admin.html não
  // tiver o nome preenchido (o /api/me devolve só o login nesse caso).
  var NOMES_LOGIN = {
    graer: 'Grupamento de Radiopatrulha Aérea',
    desousa: 'CB QPPM De Sousa',
    cmtfelipe: 'MAJ QOPM Felipe Santos',
    p3: '2º SGT QPPM Camilo',
    p3aux: '3º SGT QPPM Juliana',
  };

  function boasVindas(souGestor, nome) {
    var chave = 'dr_bv_' + (souGestor ? 'g' : 'a') + '_' + String(nome || '').slice(0, 40);
    try { if (sessionStorage.getItem(chave)) return; sessionStorage.setItem(chave, '1'); } catch (e) { /* segue mesmo assim */ }

    if (!el('drc-bv-css')) { var st = document.createElement('style'); st.id = 'drc-bv-css'; st.textContent = CSS_BV; document.head.appendChild(st); }
    var h = new Date().getHours();
    var saudacao = h < 12 ? 'Bom dia' : (h < 18 ? 'Boa tarde' : 'Boa noite');
    // As apostilas ficam em apostilas/, um nível abaixo — o brasão sobe um nível.
    var base = /\/apostilas\//.test(location.pathname) ? '../' : '';
    var papel = souGestor
      ? 'Você entrou como <b>gestor do curso</b>. Dá pra cadastrar aluno, enviar apostila e ver o ranking da turma.'
      : 'Você entrou como <b>aluno do CPPSARP</b>. Bons estudos — o material e o simulado estão liberados.';

    var d = document.createElement('div');
    d.id = 'drc-bv';
    d.setAttribute('role', 'status');
    d.innerHTML = '<div class="cx">' +
      '<img src="' + base + 'LOGOS/brasao-curso-drone-ppsarp.png" alt="Brasão do Curso de Drone">' +
      '<div class="ola">' + saudacao + '</div>' +
      '<div class="nm">' + esc(nomeSaudacao(nome) || 'Bem-vindo') + '</div>' +
      '<div class="pp">' + papel + '</div>' +
      '<div class="bar"><i></i></div>' +
      '</div>';
    document.body.appendChild(d);

    var fechou = false;
    function fechar() {
      if (fechou) return; fechou = true;
      d.className = 'sai';
      setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, 460);
      document.removeEventListener('keydown', fechar);
    }
    d.addEventListener('click', fechar);
    document.addEventListener('keydown', fechar);
    setTimeout(fechar, 2600);
  }

  // 401 em qualquer chamada /api/aro* (sessão de CPF/gestor vencida) -> some
  // com a sessão local e volta pro gate, sem esperar a pessoa recarregar sozinha.
  var fetchOrig = window.fetch;
  window.fetch = function (input, init) {
    var url = typeof input === 'string' ? input : (input && input.url) || '';
    var p = fetchOrig.apply(this, arguments);
    if (/\/api\/(aro|drone)\b/.test(String(url)) && !/\/api\/aro\/entrar\b/.test(String(url))) {
      p.then(function (r) {
        if (r.status === 401 && estado.pronto) sessaoVencida();
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
            liberar(true, d.nome || NOMES_LOGIN[String(ls('bp_user') || '').toLowerCase()] || ls('bp_user') || '');
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
    if (drToken && !tokenVencido(drToken)) { liberar(false, ls('dr_nome') || ''); return; }
    var venceu = !!drToken;
    if (venceu) { ls('dr_token', null); ls('dr_nome', null); }
    montarGate(venceu ? 'Sua sessão venceu (vale 12 horas). Entre de novo com o CPF.' : '');
  }

  iniciar();
})();
