/* =====================================================================
   bp-casca.js — "casca" comum do site BPFRON (29/10/2026)

   Incluído no <head> das páginas (antes do <style> delas). Faz 4 coisas:
   1. LISTA ÚNICA DE SISTEMAS (CATALOGO) com a regra de quem abre cada um.
      O sistemas.html, o Portal da Gestão (gestao.html) e o menu ☰ leem daqui:
      sistema novo = um item a mais no CATALOGO, e só.
   2. TEMA DO SITE: aplica o tema antes de a página aparecer (sem piscar).
      Fica em localStorage.bp_tema (vale para todas as páginas do aparelho) e
      acompanha o LOGIN: vem no /api/login e /api/me e é salvo em
      POST /api/conta/tema (outra máquina / celular abrem igual).
      Tema Claro só nas páginas que já foram ajustadas para ele
      (<html data-bp-claro>); nas outras ele cai no Escuro.
      <html data-bp-tema="fixo"> = a página não muda de tema.
   3. MENU ☰: gaveta lateral com os sistemas que o login acessa + os abertos
      ao efetivo, busca, tema e sair. O botão entra no elemento marcado com
      [data-bp-menu] (no cabeçalho da página) ou fica flutuando no canto.
      No dashboard (index.html) entra como itens da barra lateral.
      <html data-bp-menu="nao"> ou página dentro de iframe = sem menu.
   4. TELA DE CARREGAMENTO (arcos dourados girando): BPCasca.carregando().

   ⚠️ O menu só ESCONDE o que a pessoa não usa. Quem barra o acesso de
   verdade é o Worker (cada rota confere a permissão).
   ===================================================================== */
(function () {
  'use strict';
  if (window.BPCasca) return;

  var DOC = document.documentElement;
  var API_PADRAO = 'https://bpfron-api.bpfron.workers.dev';
  // ?api= só para teste local (nunca manda o token para outro endereço)
  var API = (function () {
    try {
      var q = new URLSearchParams(location.search).get('api');
      if (q && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(q.replace(/\/+$/, ''))) return q.replace(/\/+$/, '');
    } catch (e) {}
    return API_PADRAO;
  })();

  function ls(k, v) {
    try {
      if (v === undefined) return localStorage.getItem(k);
      if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v);
    } catch (e) {}
    return null;
  }
  function ss(k, v) {
    try {
      if (v === undefined) return sessionStorage.getItem(k);
      if (v === null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, v);
    } catch (e) {}
    return null;
  }
  function jparse(s, def) { try { var v = JSON.parse(s); return v == null ? def : v; } catch (e) { return def; } }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function semAcento(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }

  /* ícones desenhados (no lugar de emoji): a pistola é a mesma imagem do
     dashboard (.ico-pistola do index.html) e a bola é a do tema Colorido */
  var IC_PISTOLA = '<i class="bpc-pistola" aria-hidden="true"></i>';
  var IC_BOLA = '<i class="bpc-bola" aria-hidden="true"></i>';
  var CSS_ICONES =
    '.bpc-pistola,.bpc-bola{display:inline-block;width:1.15em;height:1.15em;vertical-align:-.2em}' +
    '.bpc-pistola{background:url(data:image/png;base64,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) center/contain no-repeat}' +
    '.bpc-bola{width:1em;height:1em;vertical-align:-.12em;border-radius:50%;background:radial-gradient(circle at 32% 28%,rgba(255,255,255,.85),rgba(255,255,255,0) 32%),linear-gradient(135deg,#ec4899,#a855f7 50%,#22d3ee);box-shadow:inset -.12em -.14em .25em rgba(18,10,42,.45),0 0 .35em rgba(236,72,153,.45)}';

  /* ================================================================
     1. CATÁLOGO
     acesso: 'pub'      aberto ao efetivo (sem login ou login próprio da página)
             'login'    qualquer login do dashboard
             'admin'    administrador do Painel de Controle
             'conceito' lista fixa da Ficha de Conceito (comandante)
             {perm:[…]} precisa de UMA das permissões do painel
             {pagina:x} página do dashboard — todo login, menos quem tem x bloqueada
     gestor/ver: permissão que mostra o selo "Gestor" / "Só ver".
     ================================================================ */
  var GRUPOS = [
    { id: 'analise',  nome: 'Análise e Inteligência',      ic: '📊', cor: '#3b82f6' },
    { id: 'dash',     nome: 'Dashboard · Áreas de Gestão', ic: '🚓', cor: '#f59e0b' },
    { id: 'adm',      nome: 'Administrativo',               ic: '🗂️', cor: '#22c55e' },
    { id: 'log',      nome: 'Logística',                    ic: '🛠️', cor: '#f97316' },
    { id: 'com',      nome: 'Comunicação',                  ic: '🎥', cor: '#a855f7' },
    { id: 'drone',    nome: 'Curso de Drone',               ic: '🚁', cor: '#06b6d4' },
    { id: 'efetivo',  nome: 'Serviços ao Efetivo',          ic: '🛡️', cor: '#eab308' },
    { id: 'apoio',    nome: 'Apoio às Ocorrências',         ic: '🤖', cor: '#ec4899' },
    { id: 'admin',    nome: 'Administração',                ic: '🔐', cor: '#ef4444' }
  ];

  var CATALOGO = [
    // ---- Análise e Inteligência
    { id: 'painel', href: 'index.html', ic: '📊', nome: 'Painel Analítico', grupo: 'analise', acesso: 'pub',
      desc: 'Dashboard de operações: indicadores, mapa, gráficos e comparativos.' },
    { id: 'consultas', href: 'index.html?pg=consultas', ic: '🔎', nome: 'Consultas (Envolvidos e Veículos)', grupo: 'analise', acesso: { pagina: 'consultas' },
      desc: 'Qualificação de envolvidos e veículos das ocorrências.' },
    { id: 'intel', href: 'intel.html', ic: '🕵️', nome: 'Central de Inteligência', grupo: 'analise', acesso: { perm: ['intel'] },
      desc: 'Mapa de Inteligência (P2) com marcações, fotos e pesquisa cruzada.' },
    { id: 'busca', href: 'ocorrencias.html', ic: '🧾', nome: 'Busca de Ocorrências', grupo: 'analise', acesso: { perm: ['busca'] },
      desc: 'Pesquisa livre no texto de todas as ocorrências, com relatório.' },

    // ---- Dashboard · Áreas de Gestão (páginas dentro do index.html)
    { id: 'dgaragem', href: 'index.html?pg=garagem', ic: '🚗', nome: 'Garagem (painel)', grupo: 'dash', acesso: { pagina: 'garagem' },
      desc: 'Situação das viaturas e o último checklist de cada uma.' },
    { id: 'dmaterial', href: 'index.html?pg=material', ic: IC_PISTOLA, nome: 'Material Bélico', grupo: 'dash', acesso: { pagina: 'material' }, gestor: 'material',
      desc: 'Armamento, munição e equipamentos da reserva.' },
    { id: 'dcampo', href: 'index.html?pg=policiais-campo', ic: '👮', nome: 'Policiais em Campo', grupo: 'dash', acesso: { pagina: 'policiais-campo' },
      desc: 'Onde cada policial está, pela escala, no mapa.' },
    { id: 'ddiaria', href: 'index.html?pg=diaria', ic: '💵', nome: 'Diária por Policial', grupo: 'dash', acesso: { pagina: 'diaria' }, gestor: 'diaria',
      desc: 'Ranking de diárias, missões e cadastro.' },
    { id: 'drecursos', href: 'index.html?pg=recursos', ic: '💰', nome: 'Valor de Recursos Obtidos', grupo: 'dash', acesso: { pagina: 'recursos' },
      desc: 'Prejuízo ao crime e recursos obtidos.' },
    { id: 'dp1', href: 'index.html?pg=p1', ic: '🗂️', nome: 'Ficha do Efetivo', grupo: 'dash', acesso: { perm: ['p1'] }, gestor: 'p1',
      desc: 'Painel consolidado da P1 com os dados de todo o efetivo.' },

    // ---- Administrativo
    { id: 'diaria', href: 'diaria.html', ic: '🧮', nome: 'Lançar Diárias', grupo: 'adm', acesso: { perm: ['diaria'] }, gestor: 'diaria',
      desc: 'Lançamento das diárias pela escala do SEI (PDF ou HTML), com edição e histórico.' },
    { id: 'rvn', href: 'rvn.html', ic: '✍️', nome: 'RVN · Assinatura Digital', grupo: 'adm', acesso: { perm: ['rvn'] }, gestor: 'rvn',
      desc: 'Assinatura digital dos RVNs e controle dos pendentes e assinados.' },
    { id: 'pesquisas', href: 'pesquisas.html', ic: '📋', nome: 'Pesquisas e Formulários', grupo: 'adm', acesso: { perm: ['pesquisa'] }, gestor: 'pesquisa',
      desc: 'Monte o questionário, distribua o link e emita o relatório.' },
    { id: 'questionario', href: 'questionario.html', ic: '🧩', nome: 'Questionário Colaborativo', grupo: 'adm', acesso: { perm: ['pesquisa'] }, gestor: 'pesquisa',
      desc: 'Uma resposta do batalhão preenchida por vários setores, ao vivo.' },
    { id: 'tarefas', href: 'tarefas.html', ic: '✅', nome: 'Central de Tarefas', grupo: 'adm', acesso: 'pub', gestor: 'tarefas',
      desc: 'Tarefas com prazo e prioridade, ciência, andamento e atrasadas.' },
    { id: 'conceito', href: 'conceito.html', ic: '🎖️', nome: 'Ficha de Conceito', grupo: 'adm', acesso: 'conceito',
      desc: 'Conceito quadrimestral dos graduados, com tabela pronta para o SEI.' },

    // ---- Logística
    { id: 'garagem-gestao', href: 'garagem-gestao.html', ic: '🛠️', nome: 'Garagem · Gestão da Frota', grupo: 'log', acesso: { perm: ['garagem'] }, gestor: 'garagem',
      desc: 'Alterações, checklists, notas fiscais com leitura automática e manutenção.' },
    { id: 'reserva', href: 'cautela-reserva.html', ic: IC_PISTOLA, nome: 'Reserva de Armamento', grupo: 'log', acesso: { perm: ['cautela', 'material'] }, gestor: 'cautela',
      desc: 'Estoque, cautela, passagem de serviço e a Parte Diária para o SEI.' },
    { id: 'leilao', href: 'leilao.html', ic: '🔨', nome: 'Leilão · Prestação de Contas', grupo: 'log', acesso: { perm: ['leilao', 'leilaover'] }, gestor: 'leilao', ver: 'leilaover',
      desc: 'Processo, entradas com comprovante, gastos com nota e relatório.' },

    // ---- Comunicação
    { id: 'sala', href: 'sala.html', ic: '🎥', nome: 'Sala de Reunião', grupo: 'com', acesso: 'login', gestor: 'video',
      desc: 'Videoconferência pelo Jitsi, com link de convidado.' },
    { id: 'slides', href: 'slides.html', ic: '🎞️', nome: 'Banco de Slides', grupo: 'com', acesso: { perm: ['slides', 'slidesver'] }, gestor: 'slides', ver: 'slidesver',
      desc: 'Apresentações institucionais do batalhão num lugar só.' },

    // ---- Curso de Drone
    { id: 'drone', href: 'drone.html', ic: '🚁', nome: 'Piloto de Drones', grupo: 'drone', acesso: 'pub', gestor: 'aro',
      desc: 'Apostilas, simulado, simulador de voo e Formulário ARO.' },
    { id: 'drone-alunos', href: 'drone-alunos.html', ic: '🎓', nome: 'Cadastro de Alunos', grupo: 'drone', acesso: { perm: ['aro'] }, gestor: 'aro',
      desc: 'Relação da turma, CSV e relatório em PDF.' },
    { id: 'drone-material', href: 'drone-material.html', ic: '📚', nome: 'Apostilas do Curso', grupo: 'drone', acesso: { perm: ['aro'] }, gestor: 'aro',
      desc: 'Envie apostilas novas sem publicar nada no GitHub.' },
    { id: 'caixa', href: 'caixinha.html', ic: '🪙', nome: 'Caixa da Turma', grupo: 'drone', acesso: { perm: ['caixa'] }, gestor: 'caixa',
      desc: 'Pagamentos por PIX, compras com nota e loja da turma.' },

    // ---- Serviços ao Efetivo
    { id: 'policial', href: 'policial.html', ic: '🛡️', nome: 'Portal do Policial', grupo: 'efetivo', acesso: 'pub',
      desc: 'Tarefas, checklist da viatura, cautela e ficha da P1 num app só.' },
    { id: 'cautela', href: 'cautela.html', ic: IC_PISTOLA, nome: 'Cautela de Armamento', grupo: 'efetivo', acesso: 'pub',
      desc: 'Confira e assine o material que recebe e devolve na reserva.' },
    { id: 'garagem', href: 'garagem.html', ic: '🚓', nome: 'Checklist da Viatura', grupo: 'efetivo', acesso: 'pub',
      desc: 'Início e término de uso da viatura, direto do celular.' },
    { id: 'p1', href: 'p1.html', ic: '🪪', nome: 'P1 · Minha Ficha', grupo: 'efetivo', acesso: 'pub',
      desc: 'Autoatualização da ficha cadastral: dados, cursos e acessos.' },
    { id: 'acessos', href: 'acessos.html', ic: '🔑', nome: 'Acesso a Sistemas', grupo: 'efetivo', acesso: 'pub', gestor: 'acessos',
      desc: 'Informe a quais sistemas policiais você ainda não tem acesso.' },
    { id: 'emborrachados', href: 'emborrachados.html', ic: '🛒', nome: 'Pedido de Emborrachados', grupo: 'efetivo', acesso: 'pub', gestor: 'emborrachados',
      desc: 'Catálogo e pedido de emborrachados do batalhão.' },
    { id: 'loja', href: 'loja.html', ic: '🛍️', nome: 'Loja BPFRON', grupo: 'efetivo', acesso: 'login', gestor: 'vitrine',
      desc: 'Vitrine de itens à venda para o efetivo.' },
    { id: 'aplicativos', href: 'aplicativos.html', ic: '📲', nome: 'Loja de Aplicativos', grupo: 'efetivo', acesso: 'pub',
      desc: 'Aplicativos que instalam no celular sem loja (MapaCampo e outros).' },

    // ---- Apoio às Ocorrências
    { id: 'prompts', href: 'prompts.html', ic: '🤖', nome: 'Prompts de IA', grupo: 'apoio', acesso: 'pub',
      desc: 'Prompt pronto para redigir o histórico da ocorrência.' },
    { id: 'ia', href: 'ia.html', ic: '🧠', nome: 'Plataformas de IA', grupo: 'apoio', acesso: 'pub',
      desc: 'Ferramentas de IA gratuitas em português.' },

    // ---- Administração
    { id: 'sistemas', href: 'sistemas.html', ic: '🧭', nome: 'Todos os Sistemas', grupo: 'admin', acesso: 'pub',
      desc: 'Lista completa dos sistemas do site.' },
    { id: 'admin', href: 'admin.html', ic: '🛡️', nome: 'Painel de Controle', grupo: 'admin', acesso: 'admin',
      desc: 'Usuários, senhas e níveis de acesso de cada login.' }
  ];
  var PORTAL = { id: 'gestao', href: 'gestao.html', ic: '🏛️', nome: 'Portal da Gestão', desc: 'Seus sistemas num lugar só.' };

  /* ================================================================
     2. TEMA
     ================================================================ */
  var TEMAS = [
    { id: 'escuro',   nome: 'Escuro',       ic: '🌙', cores: ['#060912', '#111829', '#F5C518'], desc: 'o padrão' },
    { id: 'azul',     nome: 'Azul-marinho', ic: '🌊', cores: ['#041227', '#0e2850', '#38bdf8'], desc: 'azul escuro' },
    { id: 'colorido', nome: 'Colorido',     ic: IC_BOLA, cores: ['#120a2a', '#ec4899', '#22d3ee'], desc: 'roxo, rosa e ciano' },
    { id: 'claro',    nome: 'Claro',        ic: '☀️', cores: ['#eef2f7', '#ffffff', '#b58500'], desc: 'bom de dia, na rua' },
    { id: 'auto',     nome: 'Automático',   ic: '🖥️', cores: ['#060912', '#eef2f7', '#F5C518'], desc: 'segue o aparelho' }
  ];
  var TEMA_IDS = TEMAS.map(function (t) { return t.id; });
  var MQ = window.matchMedia ? matchMedia('(prefers-color-scheme: light)') : { matches: false, addEventListener: function () {} };
  var temaFixo = DOC.getAttribute('data-bp-tema') === 'fixo';

  function temaEscolhido() {
    var t = ls('bp_tema');
    if (!t) { // a Central de Tarefas tinha tema próprio: aproveita a escolha
      var antigo = ls('tar_tema');
      if (TEMA_IDS.indexOf(antigo) >= 0) { t = antigo; ls('bp_tema', t); }
    }
    return TEMA_IDS.indexOf(t) >= 0 ? t : 'escuro';
  }
  function suportaClaro() { return DOC.hasAttribute('data-bp-claro'); }
  function temaEfetivo(t) {
    t = t || temaEscolhido();
    if (t === 'auto') t = MQ.matches ? 'claro' : 'escuro';
    if (t === 'claro' && !suportaClaro()) t = 'escuro';
    return t;
  }
  function aplicarTema() {
    if (temaFixo) return;
    var t = temaEfetivo();
    DOC.setAttribute('data-tema', t);
    DOC.setAttribute('data-tema-escolhido', temaEscolhido());
    var mt = document.querySelector('meta[name="theme-color"]');
    if (mt) {
      var bg = '';
      try { bg = getComputedStyle(DOC).getPropertyValue('--bg').trim(); } catch (e) {}
      if (bg) mt.setAttribute('content', bg);
    }
    try { window.dispatchEvent(new CustomEvent('bp-tema', { detail: { tema: t, escolhido: temaEscolhido() } })); } catch (e) {}
  }

  // Troca o tema. ev (opcional) = o clique, para a transição em círculo.
  function setTema(id, ev, semSalvar) {
    if (TEMA_IDS.indexOf(id) < 0) return;
    var mudou = id !== temaEscolhido();
    ls('bp_tema', id);
    ls('tar_tema', id); // a Central de Tarefas acompanha
    var troca = function () { aplicarTema(); };
    if (mudou && document.startViewTransition && !reduzMov()) {
      var x = ev && ev.clientX != null ? ev.clientX : innerWidth / 2;
      var y = ev && ev.clientY != null ? ev.clientY : innerHeight / 2;
      DOC.style.setProperty('--bpc-vx', x + 'px');
      DOC.style.setProperty('--bpc-vy', y + 'px');
      DOC.classList.add('bpc-vt');
      try {
        var vt = document.startViewTransition(troca);
        vt.finished.then(function () { DOC.classList.remove('bpc-vt'); }, function () { DOC.classList.remove('bpc-vt'); });
      } catch (e) { troca(); DOC.classList.remove('bpc-vt'); }
    } else troca();
    if (!semSalvar) salvarTemaNoLogin(id);
    pintarTemasMenu();
  }
  function reduzMov() { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } }

  function salvarTemaNoLogin(id) {
    var tok = ls('bp_token');
    if (!tok || tokenVencido(tok)) return;
    var me = jparse(ss('bpc_me'), null);
    if (me && me.d) { me.d.tema = id; ss('bpc_me', JSON.stringify(me)); }
    try {
      fetchOrig(API + '/api/conta/tema', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + tok }, body: JSON.stringify({ tema: id }) }).catch(function () {});
    } catch (e) {}
  }

  // Cores de cada tema para as páginas de sempre (que só têm o Escuro).
  // Cobre os dois jeitos de nomear as cores usados no site (--text/--card no
  // dashboard; --t1/--t2/--surf no Portal e nas Tarefas). As páginas que têm
  // tema próprio (Tarefas, Portal da Gestão) definem o delas depois deste
  // bloco e ganham na cascata.
  var CSS_TEMAS =
    '@media screen{' +
    ':root[data-tema="azul"]{--bg:#041227;--bg2:#071a36;--bg3:#0a1f40;--surf:#0a1f40;--surf2:#0e2850;--surf3:#143363;' +
      '--card:rgba(10,31,64,.86);--card2:rgba(20,52,100,.6);--panel:rgba(10,31,64,.9);--glass:rgba(14,40,80,.72);--glass2:rgba(14,40,80,.95);' +
      '--text:#dbe7f7;--t1:#ffffff;--t2:#dbe7f7;--t3:#c3d3ea;--muted:#9fb3cf;--dim:#6f86a8;' +
      '--border:rgba(159,179,207,.16);--border2:rgba(159,179,207,.26);--line:rgba(159,179,207,.15);--scr:#1d3a6b;color-scheme:dark}' +
    ':root[data-tema="colorido"]{--bg:#120a2a;--bg2:#1a0f3a;--bg3:#1b1140;--surf:#1b1140;--surf2:#24185a;--surf3:#2f2170;' +
      '--card:rgba(36,24,90,.82);--card2:rgba(48,32,112,.6);--panel:rgba(36,24,90,.9);--glass:rgba(36,24,90,.72);--glass2:rgba(36,24,90,.95);' +
      '--yellow:#ffd23f;--text:#f1ecff;--t1:#ffffff;--t2:#efeaff;--t3:#d9d0f5;--muted:#b9acdf;--dim:#8b7fb5;' +
      '--border:rgba(185,172,223,.18);--border2:rgba(255,210,63,.32);--line:rgba(185,172,223,.16);--scr:#3b2c80;color-scheme:dark}' +
    ':root[data-tema="claro"]{--bg:#eef2f7;--bg2:#e2e8f0;--bg3:#dbe2ec;--surf:#ffffff;--surf2:#f8fafc;--surf3:#e2e8f0;' +
      '--card:#ffffff;--card2:#f8fafc;--panel:#ffffff;--glass:rgba(255,255,255,.85);--glass2:rgba(255,255,255,.95);' +
      '--yellow:#b58500;--text:#1e293b;--t1:#0f172a;--t2:#1e293b;--t3:#334155;--muted:#475569;--dim:#64748b;' +
      '--border:rgba(15,23,42,.13);--border2:rgba(181,133,0,.32);--line:rgba(15,23,42,.1);--scr:#cbd5e1;color-scheme:light}' +
    ':root[data-tema="azul"] body,:root[data-tema="colorido"] body{background-color:var(--bg)!important}' +
    ':root[data-tema="azul"] body{background-image:radial-gradient(ellipse 70% 45% at 15% -10%,rgba(56,189,248,.16),transparent 60%),radial-gradient(ellipse 60% 40% at 100% 0%,rgba(245,197,24,.06),transparent 60%)}' +
    ':root[data-tema="colorido"] body{background-image:radial-gradient(ellipse 70% 50% at 10% -10%,rgba(236,72,153,.26),transparent 60%),radial-gradient(ellipse 60% 45% at 100% 0%,rgba(34,211,238,.2),transparent 60%)}' +
    '}' +
    /* transição em círculo saindo do clique (View Transitions) */
    '::view-transition-old(root),::view-transition-new(root){animation:none;mix-blend-mode:normal}' +
    'html.bpc-vt::view-transition-new(root){animation:bpc-revela .55s cubic-bezier(.2,.8,.2,1)}' +
    '@keyframes bpc-revela{from{clip-path:circle(0 at var(--bpc-vx) var(--bpc-vy))}to{clip-path:circle(150vmax at var(--bpc-vx) var(--bpc-vy))}}';

  function injetarCss(id, css) {
    if (document.getElementById(id)) return;
    var st = document.createElement('style');
    st.id = id; st.textContent = css;
    (document.head || DOC).appendChild(st);
  }
  injetarCss('bpc-icones', CSS_ICONES);
  if (!temaFixo) injetarCss('bpc-temas', CSS_TEMAS);
  aplicarTema();
  try { MQ.addEventListener('change', function () { if (temaEscolhido() === 'auto') aplicarTema(); }); } catch (e) {}
  // outra aba trocou o tema → esta acompanha na hora
  window.addEventListener('storage', function (e) {
    if (e.key === 'bp_tema') { aplicarTema(); pintarTemasMenu(); }
    if (e.key === 'bp_token' || e.key === 'bp_user') { ss('bpc_me', null); atualizarPerfil(true); }
  });

  /* ================================================================
     3. SESSÃO / PERFIL (quem está logado e o que acessa)
     ================================================================ */
  var fetchOrig = window.fetch ? window.fetch.bind(window) : null;
  var PERFIL = null;          // { logado, user, nome, admin, perms, bloqueios, conceito }
  var ouvintes = [];

  function tokenVencido(tok) {
    try {
      var p = JSON.parse(atob(tok.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      return p.exp && p.exp * 1000 < Date.now();
    } catch (e) { return false; }
  }
  function perfilVazio() { return { logado: false, user: '', nome: '', admin: false, perms: [], bloqueios: [], conceito: false }; }
  function perfilDe(d) {
    if (!d || !d.user) return perfilVazio();
    return { logado: true, user: d.user, nome: d.nome || d.user, admin: !!d.admin, perms: d.perms || [], bloqueios: d.bloqueios || [], conceito: !!d.conceito };
  }
  // Perfil rápido (sem rede): o que a página já guardou no aparelho.
  function perfilLocal() {
    var tok = ls('bp_token'), user = ls('bp_user');
    if (!tok || !user || tokenVencido(tok)) return perfilVazio();
    var me = jparse(ss('bpc_me'), null);
    if (me && me.tok === tok.slice(-24) && me.d) return perfilDe(me.d);
    var p = jparse(ls('bp_perms'), null);
    if (p && p.user === user) return perfilDe(p);
    return { logado: true, user: user, nome: user, admin: false, perms: [], bloqueios: [], conceito: false };
  }
  function definirPerfil(p) {
    var antes = JSON.stringify(PERFIL);
    PERFIL = p;
    if (antes !== JSON.stringify(p)) {
      pintarMenu();
      ouvintes.forEach(function (cb) { try { cb(p); } catch (e) {} });
    }
  }
  // Guarda o que veio do Worker (login/me) e aplica o tema do login.
  function guardarDoWorker(d, tok) {
    if (!d || !d.user) return;
    ss('bpc_me', JSON.stringify({ tok: (tok || ls('bp_token') || '').slice(-24), t: Date.now(), d: d }));
    try { ls('bp_perms', JSON.stringify({ user: d.user, nome: d.nome, admin: !!d.admin, perms: d.perms || [], bloqueios: d.bloqueios || [] })); } catch (e) {}
    if (d.tema && TEMA_IDS.indexOf(d.tema) >= 0 && d.tema !== temaEscolhido()) { ls('bp_tema', d.tema); ls('tar_tema', d.tema); aplicarTema(); pintarTemasMenu(); }
    else if (!d.tema && ls('bp_tema') && ls('bp_tema') !== 'escuro') salvarTemaNoLogin(ls('bp_tema')); // 1ª vez: leva o tema do aparelho para o login
    definirPerfil(perfilDe(d));
  }
  var buscando = null;
  function atualizarPerfil(forcar) {
    var tok = ls('bp_token');
    if (!tok || tokenVencido(tok)) { definirPerfil(perfilVazio()); return Promise.resolve(PERFIL); }
    var me = jparse(ss('bpc_me'), null);
    if (!forcar && me && me.tok === tok.slice(-24) && Date.now() - me.t < 5 * 60e3) {
      definirPerfil(me.d ? perfilDe(me.d) : perfilVazio());
      return Promise.resolve(PERFIL);
    }
    if (buscando) return buscando;
    if (!PERFIL) definirPerfil(perfilLocal());
    if (!fetchOrig) return Promise.resolve(PERFIL);
    buscando = fetchOrig(API + '/api/me', { headers: { 'Authorization': 'Bearer ' + tok } })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d && d.authenticated) guardarDoWorker(d, tok);
        else { ss('bpc_me', JSON.stringify({ tok: tok.slice(-24), t: Date.now(), d: null })); definirPerfil(perfilVazio()); }
        return PERFIL;
      })
      .catch(function () { return PERFIL; }) // sem rede: fica com o que o aparelho sabe
      .then(function (p) { buscando = null; return p; });
    return buscando;
  }

  // Observa o fetch da página: login/logout feitos por ela atualizam o menu.
  if (fetchOrig) {
    window.fetch = function (input, init) {
      var url = typeof input === 'string' ? input : (input && input.url) || '';
      var p = fetchOrig.apply(this, arguments);
      var m = String(url).match(/\/api\/(login|logout)(?:[?#]|$)/);
      if (m) {
        p.then(function (r) {
          if (m[1] === 'logout') { ss('bpc_me', null); setTimeout(function () { definirPerfil(perfilVazio()); }, 0); return; }
          if (!r.ok) return;
          r.clone().json().then(function (d) { if (d && d.token && d.user) guardarDoWorker(d, d.token); }).catch(function () {});
        }).catch(function () {});
      }
      return p;
    };
  }

  /* ---------- regras de acesso ---------- */
  function tem(P, perm) {
    if (!perm) return false;
    var l = Array.isArray(perm) ? perm : [perm];
    return l.some(function (x) { return P.perms.indexOf(x) >= 0; });
  }
  function pode(item, P) {
    P = P || PERFIL || perfilVazio();
    var a = item.acesso;
    if (a === 'pub') return true;
    if (!P.logado) return false;
    if (a === 'login') return true;
    if (a === 'admin') return !!P.admin;
    if (a === 'conceito') return !!P.conceito;
    if (a && a.perm) return tem(P, a.perm);
    if (a && a.pagina) return P.bloqueios.indexOf(a.pagina) < 0;
    return false;
  }
  // "gestor" | "ver" | "" — selo do cartão
  function papel(item, P) {
    P = P || PERFIL || perfilVazio();
    if (!P.logado) return '';
    if (item.acesso === 'admin' || item.acesso === 'conceito') return 'gestor';
    if (item.gestor && tem(P, item.gestor)) return 'gestor';
    if (item.ver && tem(P, item.ver)) return 'ver';
    return '';
  }
  // Sistemas de gestão do login (o que vai na aba ADM): os restritos que ele
  // abre + os abertos em que ele é gestor.
  function deGestao(item, P) {
    P = P || PERFIL || perfilVazio();
    if (!P.logado || !pode(item, P)) return false;
    if (item.acesso === 'pub' || item.acesso === 'login') return papel(item, P) === 'gestor';
    return true;
  }
  function visiveis(P) { return CATALOGO.filter(function (i) { return pode(i, P); }); }

  /* ---------- página atual + recentes ---------- */
  function arquivoAtual() {
    var f = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
    var pg = '';
    try { pg = new URLSearchParams(location.search).get('pg') || ''; } catch (e) {}
    return { f: f, pg: pg };
  }
  function itemAtual() {
    var a = arquivoAtual(), achou = null;
    CATALOGO.forEach(function (i) {
      var u = i.href.split('?'), f = u[0].toLowerCase(), pg = (u[1] || '').replace(/^pg=/, '');
      if (f === a.f && pg === a.pg) achou = i;
    });
    return achou;
  }
  function registrarVisita() {
    var i = itemAtual();
    if (!i) return;
    var r = jparse(ls('bp_recentes'), []).filter(function (x) { return x && x.id !== i.id; });
    r.unshift({ id: i.id, t: Date.now() });
    ls('bp_recentes', JSON.stringify(r.slice(0, 12)));
  }
  function recentes() { return jparse(ls('bp_recentes'), []).map(function (x) { return CATALOGO.filter(function (i) { return i.id === x.id; })[0]; }).filter(Boolean); }
  function hrefCom(href) { // repassa o ?api= de teste para as outras páginas
    if (API === API_PADRAO) return href;
    return href + (href.indexOf('?') >= 0 ? '&' : '?') + 'api=' + encodeURIComponent(API);
  }

  function sair() {
    var tok = ls('bp_token');
    ['bp_token', 'bp_user', 'bp_perms'].forEach(function (k) { ls(k, null); });
    ss('bpc_me', null);
    if (tok && fetchOrig) fetchOrig(API + '/api/logout', { method: 'POST', headers: { 'Authorization': 'Bearer ' + tok } }).catch(function () {});
    definirPerfil(perfilVazio());
  }

  /* ================================================================
     4. TELA DE CARREGAMENTO
     29/10/2026: a onça andando saiu a pedido do usuário; no lugar, 5 arcos
     concêntricos girando em dourado (modelo que ele mandou), cada um
     começando 0,2 s depois do outro.
     ================================================================ */
  function aneisHTML() {
    var h = '<div class="bpc-aneis" role="img" aria-label="Carregando">';
    for (var i = 0; i < 5; i++) h += '<i style="--i:' + i + '"></i>';
    return h + '</div>';
  }

  var CSS_ONCA =
    '#bpc-carga{position:fixed;inset:0;z-index:2147482000;display:flex;align-items:center;justify-content:center;padding:16px;' +
      'background:radial-gradient(700px 360px at 50% 42%,rgba(245,197,24,.07),transparent 65%),rgba(3,5,9,.94);' +
      'backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);color:#e2e8f0;' +
      'font-family:Inter,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;transition:opacity .55s ease,visibility .55s}' +
    '#bpc-carga.bpc-some{opacity:0;visibility:hidden}' +
    '#bpc-carga.bpc-some .bpc-carga-in{transform:scale(1.03)}' +
    '#bpc-carga .bpc-carga-in{display:flex;flex-direction:column;align-items:center;width:min(560px,100%);transition:transform .55s ease}' +
    '#bpc-carga .bpc-aneis{position:relative;width:110px;height:110px;margin-bottom:22px;filter:drop-shadow(0 0 6px rgba(212,175,55,.45))}' +
    '#bpc-carga .bpc-aneis i{position:absolute;left:50%;top:50%;box-sizing:border-box;width:calc(100px - var(--i) * 10px);height:calc(100px - var(--i) * 10px);' +
      'margin:calc((100px - var(--i) * 10px) / -2) 0 0 calc((100px - var(--i) * 10px) / -2);border-radius:50%;' +
      'border:2px solid transparent;border-top-color:#d4af37;border-left-color:#d4af37;' +
      'animation:bpc-gira 1s linear infinite;animation-delay:calc(var(--i) * .2s)}' +
    '#bpc-carga .bpc-aneis i:nth-child(1){border-top-color:#ffd700;border-left-color:#ffd700}' +
    '#bpc-carga .bpc-aneis i:nth-child(2){border-top-color:#f5c518;border-left-color:#f5c518}' +
    '#bpc-carga .bpc-aneis i:nth-child(4){border-top-color:#c9a227;border-left-color:#c9a227}' +
    '#bpc-carga .bpc-aneis i:nth-child(5){border-top-color:#b8860b;border-left-color:#b8860b}' +
    '@keyframes bpc-gira{to{transform:rotate(360deg)}}' +
    '@media (prefers-reduced-motion:reduce){#bpc-carga .bpc-aneis i{animation-duration:2.5s}}' +
    '#bpc-carga .bpc-titulo{font-family:Rajdhani,Inter,sans-serif;font-weight:700;font-size:14px;letter-spacing:.34em;text-indent:.34em;' +
      'color:#d4af37;text-transform:uppercase;text-shadow:0 0 14px rgba(245,197,24,.35);margin-top:2px}' +
    '#bpc-carga .bpc-titulo i{font-style:normal;display:inline-block;animation:bpc-ponto 1.2s infinite}' +
    '#bpc-carga .bpc-titulo i:nth-child(2){animation-delay:.2s}#bpc-carga .bpc-titulo i:nth-child(3){animation-delay:.4s}' +
    '@keyframes bpc-ponto{0%,60%,100%{opacity:.25}30%{opacity:1}}' +
    '#bpc-carga .bpc-barra{position:relative;width:min(320px,78%);height:16px;margin-top:10px;background:#c99a24;' +
      'clip-path:polygon(9px 0,calc(100% - 9px) 0,100% 50%,calc(100% - 9px) 100%,9px 100%,0 50%)}' +
    '#bpc-carga .bpc-barra::before{content:"";position:absolute;inset:2px;background:#07090d;' +
      'clip-path:polygon(8px 0,calc(100% - 8px) 0,100% 50%,calc(100% - 8px) 100%,8px 100%,0 50%)}' +
    '#bpc-carga .bpc-barra i{position:absolute;left:6px;top:4px;bottom:4px;width:calc((100% - 12px) * var(--p,0));transition:width .35s ease-out;' +
      'background:repeating-linear-gradient(90deg,rgba(120,72,0,.22) 0 2px,transparent 2px 7px),linear-gradient(180deg,#ffe27d,#f5c518 45%,#c99400);' +
      'clip-path:polygon(4px 0,100% 0,100% 100%,4px 100%,0 50%)}' +
    '#bpc-carga .bpc-pata{display:flex;align-items:center;gap:10px;margin-top:10px;color:#c99a24}' +
    '#bpc-carga .bpc-pata b{width:50px;height:1px;background:linear-gradient(90deg,transparent,rgba(201,154,36,.7))}' +
    '#bpc-carga .bpc-pata b:last-child{transform:scaleX(-1)}' +
    '#bpc-carga .bpc-pata svg{width:14px;height:14px}' +
    '#bpc-carga .bpc-msg{font-size:12px;color:#8b95a7;margin-top:6px;min-height:18px;text-align:center}';

  // Abre a tela de carregamento. Devolve { msg(texto), fechar() }.
  function carregando(msg) {
    injetarCss('bpc-css-onca', CSS_ONCA);
    var el = document.getElementById('bpc-carga');
    if (!el) {
      el = document.createElement('div');
      el.id = 'bpc-carga';
      el.setAttribute('role', 'status');
      el.innerHTML = '<div class="bpc-carga-in">' +
        aneisHTML() +
        '<div class="bpc-titulo">Carregando<i>.</i><i>.</i><i>.</i></div>' +
        '<div class="bpc-barra"><i></i></div>' +
        '<div class="bpc-pata"><b></b><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><ellipse cx="12" cy="16.5" rx="5.2" ry="4.4"/>' +
          '<ellipse cx="5.2" cy="10.6" rx="2.2" ry="2.8"/><ellipse cx="9.4" cy="6.4" rx="2.2" ry="2.9"/><ellipse cx="14.6" cy="6.4" rx="2.2" ry="2.9"/><ellipse cx="18.8" cy="10.6" rx="2.2" ry="2.8"/></svg><b></b></div>' +
        '<div class="bpc-msg"></div></div>';
      (document.body || DOC).appendChild(el);
    }
    el.classList.remove('bpc-some');
    var m = el.querySelector('.bpc-msg'), barra = el.querySelector('.bpc-barra i');
    // barra "de mentira": anda rápido no começo e vai freando antes do fim
    var p = 0.06, fim = false;
    barra.style.setProperty('--p', p);
    clearInterval(el._bpcBarra);
    el._bpcBarra = setInterval(function () { if (!fim) { p += (0.92 - p) * 0.07; barra.style.setProperty('--p', p.toFixed(3)); } }, 140);
    var por = function (t) { m.textContent = t || ''; };
    por(msg);
    return {
      msg: por,
      fechar: function () {
        fim = true; clearInterval(el._bpcBarra); barra.style.setProperty('--p', 1);
        setTimeout(function () {
          el.classList.add('bpc-some');
          setTimeout(function () { if (el.classList.contains('bpc-some') && el.parentNode) el.parentNode.removeChild(el); }, 650);
        }, 300);
      }
    };
  }

  /* ================================================================
     5. MENU ☰ (gaveta lateral)
     ================================================================ */
  var semMenu = DOC.getAttribute('data-bp-menu') === 'nao' || DOC.classList.contains('portal') || (function () { try { return window.self !== window.top; } catch (e) { return true; } })();

  var CSS_MENU =
    '.bpc-btn{display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;flex:none;border-radius:12px;cursor:pointer;padding:0;' +
      'border:1px solid rgba(245,197,24,.32);background:rgba(245,197,24,.09);color:var(--yellow,#F5C518);transition:background .2s,transform .2s,box-shadow .2s}' +
    '.bpc-btn:hover{background:rgba(245,197,24,.18);box-shadow:0 0 0 4px rgba(245,197,24,.08)}' +
    '.bpc-btn:active{transform:scale(.94)}' +
    '.bpc-btn svg{width:20px;height:20px}' +
    '.bpc-btn.bpc-flutua{position:fixed;top:max(10px,env(safe-area-inset-top));left:10px;z-index:2147480000;backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);background:rgba(6,9,18,.72);box-shadow:0 6px 24px rgba(0,0,0,.35)}' +
    ':root[data-tema="claro"] .bpc-btn.bpc-flutua{background:rgba(255,255,255,.85)}' +
    '#bpc-fundo{position:fixed;inset:0;z-index:2147480500;background:rgba(2,6,23,.55);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);opacity:0;visibility:hidden;transition:opacity .3s,visibility .3s}' +
    '#bpc-fundo.on{opacity:1;visibility:visible}' +
    '#bpc-gaveta{position:fixed;top:0;left:0;bottom:0;z-index:2147481000;width:min(360px,88vw);display:flex;flex-direction:column;' +
      'background:var(--bg2,#0b1120);color:var(--t2,var(--text,#e2e8f0));border-right:1px solid rgba(148,163,184,.16);box-shadow:24px 0 60px rgba(0,0,0,.45);' +
      'transform:translateX(-104%);transition:transform .38s cubic-bezier(.2,.8,.2,1);font-family:Inter,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;font-size:14px;line-height:1.4;text-align:left}' +
    '#bpc-gaveta.on{transform:none}' +
    '#bpc-gaveta *{box-sizing:border-box}' +
    '#bpc-gaveta .bpc-topo{display:flex;align-items:center;gap:10px;padding:14px 14px 12px;border-bottom:1px solid rgba(148,163,184,.12)}' +
    '#bpc-gaveta .bpc-topo img{height:34px;width:auto}' +
    '#bpc-gaveta .bpc-topo b{display:block;font-family:Rajdhani,Inter,sans-serif;font-size:18px;color:var(--t1,#fff);letter-spacing:.4px;line-height:1.1}' +
    '#bpc-gaveta .bpc-topo b em{font-style:normal;color:var(--yellow,#F5C518)}' +
    '#bpc-gaveta .bpc-topo small{display:block;font-size:11px;color:var(--muted,#94a3b8)}' +
    '#bpc-gaveta .bpc-x{margin-left:auto;width:34px;height:34px;border-radius:10px;border:1px solid rgba(148,163,184,.2);background:none;color:var(--muted,#94a3b8);cursor:pointer;font-size:18px;line-height:1}' +
    '#bpc-gaveta .bpc-x:hover{color:var(--t1,#fff)}' +
    '#bpc-gaveta .bpc-eu{display:flex;align-items:center;gap:10px;margin:12px 14px 4px;padding:10px 12px;border-radius:14px;background:rgba(148,163,184,.07);border:1px solid rgba(148,163,184,.12)}' +
    '#bpc-gaveta .bpc-av{width:34px;height:34px;border-radius:50%;display:grid;place-items:center;font-size:12px;font-weight:800;color:#1a1300;background:linear-gradient(135deg,#F5C518,#e0a800);flex:none}' +
    '#bpc-gaveta .bpc-eu b{display:block;font-size:13.5px;color:var(--t1,#fff);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
    '#bpc-gaveta .bpc-eu small{font-size:11.5px;color:var(--muted,#94a3b8)}' +
    '#bpc-gaveta .bpc-chip{display:inline-block;font-size:10px;font-weight:800;letter-spacing:.4px;padding:2px 7px;border-radius:999px;background:rgba(239,68,68,.14);color:#fca5a5;margin-left:4px;vertical-align:1px}' +
    '#bpc-gaveta .bpc-busca{margin:10px 14px 6px;position:relative}' +
    '#bpc-gaveta .bpc-busca input{width:100%;padding:10px 12px 10px 34px;border-radius:12px;border:1px solid rgba(148,163,184,.2);background:rgba(148,163,184,.07);color:var(--t1,#fff);font:inherit;font-size:16px;outline:none}' +
    '#bpc-gaveta .bpc-busca input:focus{border-color:rgba(245,197,24,.55)}' +
    '#bpc-gaveta .bpc-busca span{position:absolute;left:11px;top:50%;transform:translateY(-50%);opacity:.6;font-size:14px}' +
    '#bpc-gaveta .bpc-lista{flex:1;overflow-y:auto;padding:4px 8px 10px;overscroll-behavior:contain}' +
    '#bpc-gaveta .bpc-portal{display:flex;align-items:center;gap:10px;margin:6px 6px 4px;padding:11px 12px;border-radius:14px;text-decoration:none;color:var(--t1,#fff);' +
      'background:linear-gradient(135deg,rgba(245,197,24,.16),rgba(245,197,24,.04));border:1px solid rgba(245,197,24,.3);transition:transform .2s,background .2s}' +
    '#bpc-gaveta .bpc-portal:hover{transform:translateX(3px)}' +
    '#bpc-gaveta .bpc-portal b{display:block;font-size:14px}#bpc-gaveta .bpc-portal small{color:var(--muted,#94a3b8);font-size:11.5px}' +
    '#bpc-gaveta .bpc-portal .bpc-ic{background:rgba(245,197,24,.18)}' +
    '#bpc-gaveta .bpc-gr{font-size:10.5px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;color:var(--muted,#94a3b8);margin:14px 10px 4px;display:flex;align-items:center;gap:6px}' +
    '#bpc-gaveta .bpc-gr i{width:6px;height:6px;border-radius:50%;flex:none}' +
    '#bpc-gaveta .bpc-it{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:11px;text-decoration:none;color:var(--t2,var(--text,#e2e8f0));transition:background .15s,transform .15s;' +
      'opacity:0;transform:translateX(-8px)}' +
    '#bpc-gaveta.on .bpc-it,#bpc-gaveta.on .bpc-portal{animation:bpc-entra .38s cubic-bezier(.2,.8,.2,1) forwards;animation-delay:calc(var(--i,0) * 18ms + 60ms)}' +
    '#bpc-gaveta.on .bpc-portal{opacity:0}' +
    '@keyframes bpc-entra{to{opacity:1;transform:none}}' +
    '#bpc-gaveta .bpc-it:hover{background:rgba(148,163,184,.1)}' +
    '#bpc-gaveta .bpc-it.atual{background:rgba(245,197,24,.12);color:var(--t1,#fff)}' +
    '#bpc-gaveta .bpc-it.atual::after{content:"aqui";margin-left:auto;font-size:10px;font-weight:800;color:var(--yellow,#F5C518);letter-spacing:.5px;text-transform:uppercase}' +
    '#bpc-gaveta .bpc-ic{width:32px;height:32px;border-radius:10px;display:grid;place-items:center;font-size:16px;flex:none;background:rgba(148,163,184,.1)}' +
    '#bpc-gaveta .bpc-it span.t{min-width:0;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:600;font-size:13.5px}' +
    '#bpc-gaveta .bpc-sl{font-size:9.5px;font-weight:800;letter-spacing:.4px;padding:2px 6px;border-radius:999px;background:rgba(34,197,94,.14);color:#4ade80;flex:none}' +
    '#bpc-gaveta .bpc-sl.ver{background:rgba(57,135,229,.15);color:#7cb4f5}' +
    '#bpc-gaveta .bpc-nada{padding:18px 12px;color:var(--muted,#94a3b8);font-size:13px;text-align:center}' +
    '#bpc-gaveta .bpc-pe{border-top:1px solid rgba(148,163,184,.12);padding:12px 14px calc(12px + env(safe-area-inset-bottom))}' +
    '#bpc-gaveta .bpc-pe .bpc-lb{font-size:10.5px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;color:var(--muted,#94a3b8);margin-bottom:8px}' +
    '#bpc-gaveta .bpc-temas{display:flex;gap:8px;margin-bottom:12px}' +
    '#bpc-gaveta .bpc-temas button{flex:1;height:38px;border-radius:11px;border:2px solid transparent;cursor:pointer;padding:0;position:relative;overflow:hidden;transition:transform .15s}' +
    '#bpc-gaveta .bpc-temas button:hover{transform:translateY(-2px)}' +
    '#bpc-gaveta .bpc-temas button.on{border-color:var(--yellow,#F5C518)}' +
    '#bpc-gaveta .bpc-temas button span{position:absolute;inset:auto 0 0 0;font-size:14px;line-height:38px;text-align:center;top:0}' +
    '#bpc-gaveta .bpc-acoes{display:flex;gap:8px}' +
    '#bpc-gaveta .bpc-acoes a,#bpc-gaveta .bpc-acoes button{flex:1;display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:9px 10px;border-radius:11px;border:1px solid rgba(148,163,184,.2);' +
      'background:none;color:var(--t2,var(--text,#e2e8f0));font:inherit;font-size:13px;font-weight:700;cursor:pointer;text-decoration:none}' +
    '#bpc-gaveta .bpc-acoes a.pri{background:linear-gradient(135deg,#F5C518,#e0a800);color:#1a1300;border:0}' +
    '#bpc-gaveta .bpc-acoes button:hover{border-color:rgba(148,163,184,.45)}' +
    ':root[data-tema="claro"] #bpc-gaveta{background:#ffffff;border-right-color:rgba(15,23,42,.1);box-shadow:24px 0 60px rgba(15,23,42,.18)}' +
    ':root[data-tema="claro"] #bpc-gaveta .bpc-sl{color:#047857}:root[data-tema="claro"] #bpc-gaveta .bpc-sl.ver{color:#1d4ed8}:root[data-tema="claro"] #bpc-gaveta .bpc-chip{color:#b91c1c}' +
    /* dashboard: itens na barra lateral */
    '#sidebar .bpc-sb{display:flex}' +
    '@media (max-width:640px){.bpc-logo-cel{display:none!important}.bpc-btn{width:38px;height:38px}}' +
    '@media print{.bpc-btn,#bpc-gaveta,#bpc-fundo,#bpc-carga{display:none!important}}';

  var BRASAO = 'LOGOS/bpfron_transp.avif';
  var ICO_MENU = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="17" x2="14" y2="17"/></svg>';
  var gaveta = null, fundo = null, filtro = '';

  function montarMenu() {
    if (semMenu || gaveta) return;
    injetarCss('bpc-css-menu', CSS_MENU);
    fundo = document.createElement('div'); fundo.id = 'bpc-fundo';
    gaveta = document.createElement('aside'); gaveta.id = 'bpc-gaveta';
    gaveta.setAttribute('aria-label', 'Sistemas do BPFRON'); gaveta.setAttribute('aria-hidden', 'true');
    gaveta.innerHTML =
      '<div class="bpc-topo"><img src="' + BRASAO + '" alt=""><div><b>BPFRON <em>·</em> Sistemas</b><small>Batalhão de Polícia de Fronteira</small></div>' +
      '<button class="bpc-x" type="button" aria-label="Fechar o menu">✕</button></div>' +
      '<div class="bpc-eu-slot"></div>' +
      '<div class="bpc-busca"><span>🔎</span><input type="search" placeholder="Buscar sistema…" aria-label="Buscar sistema" autocomplete="off"></div>' +
      '<nav class="bpc-lista"></nav>' +
      '<div class="bpc-pe"><div class="bpc-lb">Tema do site</div><div class="bpc-temas"></div><div class="bpc-acoes"></div></div>';
    document.body.appendChild(fundo);
    document.body.appendChild(gaveta);
    fundo.addEventListener('click', fecharMenu);
    gaveta.querySelector('.bpc-x').addEventListener('click', fecharMenu);
    var inp = gaveta.querySelector('.bpc-busca input');
    inp.addEventListener('input', function () { filtro = inp.value; pintarLista(); });
    inp.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { var a = gaveta.querySelector('.bpc-lista a.bpc-it'); if (a) location.href = a.href; }
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && gaveta.classList.contains('on')) fecharMenu(); });

    // o botão ☰: no cabeçalho da página ([data-bp-menu]) ou flutuando
    var dash = document.getElementById('sidebar');
    if (dash) montarNoDashboard(dash);
    else {
      // [data-bp-menu] manda; senão, o cabeçalho de sempre das páginas do site
      // (um seletor por vez: a lista com vírgula devolveria o 1º da PÁGINA, não o 1º da prioridade)
      var slot = null;
      ['[data-bp-menu]', '.hdr .hdr-brand', '.hdr .brand', '.hdr .hdr-inner', '.hdr .hdr-in', '.intel-hdr', '.oc-hdr', '.pg-hdr', 'header.top', '.hdr']
        .some(function (s) { slot = document.querySelector(s); return !!slot; });
      var bt = document.createElement('button');
      bt.type = 'button'; bt.className = 'bpc-btn' + (slot ? '' : ' bpc-flutua');
      bt.setAttribute('aria-label', 'Abrir o menu de sistemas'); bt.title = 'Sistemas do BPFRON';
      bt.innerHTML = ICO_MENU;
      bt.addEventListener('click', function (e) { e.stopPropagation(); abrirMenu(); });
      // botão nunca dentro de um link (o clique navegaria): entra antes dele
      if (slot && slot.tagName === 'A') slot.parentNode.insertBefore(bt, slot);
      else if (slot) slot.insertBefore(bt, slot.firstChild);
      else document.body.appendChild(bt);
      // no celular o ☰ toma o lugar do brasão do cabeçalho (senão o título espreme)
      var logo = slot && slot.querySelector('img');
      if (logo) logo.classList.add('bpc-logo-cel');
    }
    pintarMenu();
  }

  // Dashboard: dois itens na barra lateral (que no celular já é gaveta).
  function montarNoDashboard(sb) {
    var ref = document.getElementById('nav-sistemas');
    var mk = function (id, ic, txt, fn) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'sb-item bpc-sb'; b.id = id;
      b.innerHTML = '<span class="ic">' + ic + '</span> ' + txt;
      b.addEventListener('click', function (e) { e.stopPropagation(); if (typeof window.closeNav === 'function') window.closeNav(); fn(); });
      return b;
    };
    var bMeus = mk('nav-bpc-sistemas', '☰', 'Meus sistemas', function () { abrirMenu(); });
    var bTema = mk('nav-bpc-tema', '🎨', 'Tema do site', function () { abrirMenu(true); });
    if (ref && ref.parentNode === sb) { sb.insertBefore(bMeus, ref); sb.insertBefore(bTema, ref); }
    else { sb.appendChild(bMeus); sb.appendChild(bTema); }
  }

  function abrirMenu(focarTema) {
    if (!gaveta) montarMenu();
    if (!gaveta) return;
    atualizarPerfil();
    pintarMenu();
    gaveta.classList.remove('on'); void gaveta.offsetWidth; // reinicia a animação dos itens
    gaveta.classList.add('on'); fundo.classList.add('on');
    gaveta.setAttribute('aria-hidden', 'false');
    setTimeout(function () {
      if (focarTema) { var t = gaveta.querySelector('.bpc-temas button.on') || gaveta.querySelector('.bpc-temas button'); if (t) t.focus(); }
      else if (matchMedia('(pointer:fine)').matches) gaveta.querySelector('.bpc-busca input').focus();
    }, 120);
  }
  function fecharMenu() {
    if (!gaveta) return;
    gaveta.classList.remove('on'); fundo.classList.remove('on');
    gaveta.setAttribute('aria-hidden', 'true');
  }

  function iniciais(n) {
    var p = String(n || '').replace(/\b(CB|SD|SGT|TEN|CAP|MAJ|TC|CEL|QPPM|QOPM|PM|\d+º)\b/gi, ' ').trim().split(/\s+/).filter(Boolean);
    if (!p.length) return '?';
    return (p[0][0] + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
  }

  function pintarMenu() {
    if (!gaveta) return;
    var P = PERFIL || perfilLocal();
    var slot = gaveta.querySelector('.bpc-eu-slot');
    slot.innerHTML = P.logado
      ? '<div class="bpc-eu"><div class="bpc-av">' + esc(iniciais(P.nome)) + '</div><div style="min-width:0"><b>' + esc(P.nome) + '</b><small>' + esc(P.user) +
        (P.admin ? '<span class="bpc-chip">ADMIN</span>' : '') + '</small></div></div>'
      : '';
    var ac = gaveta.querySelector('.bpc-acoes');
    ac.innerHTML = P.logado
      ? (typeof window.bpTrocarSenha === 'function' ? '<button type="button" data-a="senha">🔑 Senha</button>' : '') + '<button type="button" data-a="sair">🚪 Sair</button>'
      : '<a class="pri" href="' + esc(hrefCom(PORTAL.href)) + '">Entrar</a>';
    var bs = ac.querySelector('[data-a="senha"]'); if (bs) bs.onclick = function () { fecharMenu(); window.bpTrocarSenha(); };
    var bx = ac.querySelector('[data-a="sair"]'); if (bx) bx.onclick = function () { sair(); fecharMenu(); location.reload(); };
    pintarTemasMenu();
    pintarLista();
  }

  function pintarTemasMenu() {
    if (!gaveta) return;
    var box = gaveta.querySelector('.bpc-temas'), at = temaEscolhido();
    box.innerHTML = TEMAS.map(function (t) {
      var bg = 'linear-gradient(135deg,' + t.cores[0] + ' 0 50%,' + t.cores[1] + ' 50% 100%)';
      return '<button type="button" data-t="' + t.id + '" class="' + (t.id === at ? 'on' : '') + '" style="background:' + bg + '" title="' + esc(t.nome + ' — ' + t.desc) + '" aria-label="Tema ' + esc(t.nome) + '"><span>' + t.ic + '</span></button>';
    }).join('');
    Array.prototype.forEach.call(box.querySelectorAll('button'), function (b) {
      b.onclick = function (e) { setTema(b.getAttribute('data-t'), e); };
    });
  }

  function pintarLista() {
    if (!gaveta) return;
    var P = PERFIL || perfilLocal();
    var q = semAcento(filtro).trim();
    var atual = itemAtual();
    var bate = function (i) { return !q || semAcento(i.nome + ' ' + i.desc + ' ' + i.href).indexOf(q) >= 0; };
    var n = 0, html = '';
    if (!q || bate(PORTAL)) {
      html += '<a class="bpc-portal" style="--i:0" href="' + esc(hrefCom(PORTAL.href)) + '"><span class="bpc-ic">' + PORTAL.ic + '</span><span><b>' + PORTAL.nome + '</b><small>' +
        (P.logado ? 'Seus sistemas num lugar só' : 'Entre com o login do dashboard') + '</small></span></a>';
    }
    GRUPOS.forEach(function (g) {
      var itens = CATALOGO.filter(function (i) { return i.grupo === g.id && pode(i, P) && bate(i); });
      if (!itens.length) return;
      html += '<div class="bpc-gr"><i style="background:' + g.cor + '"></i>' + esc(g.nome) + '</div>';
      itens.forEach(function (i) {
        n++;
        var pa = papel(i, P);
        html += '<a class="bpc-it' + (atual && atual.id === i.id ? ' atual' : '') + '" style="--i:' + n + '" href="' + esc(hrefCom(i.href)) + '" title="' + esc(i.desc) + '">' +
          '<span class="bpc-ic">' + i.ic + '</span><span class="t">' + esc(i.nome) + '</span>' +
          (pa === 'gestor' && !(atual && atual.id === i.id) ? '<span class="bpc-sl">GESTOR</span>' : pa === 'ver' && !(atual && atual.id === i.id) ? '<span class="bpc-sl ver">VER</span>' : '') + '</a>';
      });
    });
    if (!n && q) html += '<div class="bpc-nada">Nenhum sistema com “' + esc(filtro) + '”.</div>';
    if (!P.logado && !q) html += '<div class="bpc-nada">Entre com o login do dashboard para ver também os sistemas de gestão liberados para você.</div>';
    gaveta.querySelector('.bpc-lista').innerHTML = html;
  }

  /* ================================================================
     início
     ================================================================ */
  function iniciar() {
    aplicarTema(); // de novo: agora a <meta name="theme-color"> já existe
    registrarVisita();
    if (!semMenu) montarMenu();
    atualizarPerfil();
  }
  PERFIL = perfilLocal();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();

  window.BPCasca = {
    API: API,
    GRUPOS: GRUPOS, CATALOGO: CATALOGO, PORTAL: PORTAL, TEMAS: TEMAS,
    tema: temaEscolhido, temaEfetivo: function () { return temaEfetivo(); }, setTema: setTema,
    perfil: function () { return PERFIL || perfilLocal(); },
    atualizarPerfil: atualizarPerfil,
    aoMudarPerfil: function (cb) { ouvintes.push(cb); },
    guardarDoWorker: guardarDoWorker,
    pode: pode, papel: papel, deGestao: deGestao, visiveis: visiveis,
    recentes: recentes, hrefCom: hrefCom, sair: sair, iniciais: iniciais,
    abrirMenu: abrirMenu, fecharMenu: fecharMenu,
    carregando: carregando, cssOnca: function () { injetarCss('bpc-css-onca', CSS_ONCA); }
  };
})();
