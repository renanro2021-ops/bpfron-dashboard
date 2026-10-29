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
   4. TELA DE CARREGAMENTO com a onça-pintada andando: BPCasca.carregando().

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
     4. ONÇA-PINTADA (tela de carregamento)
     29/10/2026: recortada da arte de referência que o usuário mandou
     (corpo, 4 patas, rabo e 2 moitas num PNG só, gerado por
     ferramentas/onca/montar-onca.py). As patas andam por cisalhamento a
     partir do corte (o pé fica plantado) e o chão corre para trás; a água
     reflete a cena. Desenho em 520x210, ampliado sem suavizar (pixel art).
     ================================================================ */
  var ONCA_PNG = 'data:image/png;base64,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';
  var ONCA = {"h1":{"x":50.0,"y":83.0,"cut":88.0,"paw":125.0,"far":false,"ph":0.6,"sx":0,"sy":0,"w":46,"h":42},"h2":{"x":134.0,"y":75.0,"cut":80.0,"paw":123.5,"far":true,"ph":0.1,"sx":48,"sy":0,"w":42,"h":49},"f2":{"x":183.0,"y":76.0,"cut":81.0,"paw":125.0,"far":true,"ph":0.35,"sx":92,"sy":0,"w":35,"h":50},"f1":{"x":227.5,"y":85.0,"cut":91.0,"paw":125.0,"far":false,"ph":0.85,"sx":129,"sy":0,"w":80,"h":40},"tail":{"x":7.0,"y":24.5,"px":80.0,"py":29.0,"sx":211,"sy":0,"w":77,"h":68},"body":{"x":62.5,"y":4.0,"sx":290,"sy":0,"w":264,"h":90},"pl":{"x":26.0,"y":59.0,"sx":556,"sy":0,"w":91,"h":125},"pr":{"x":445.0,"y":59.0,"sx":649,"sy":0,"w":144,"h":125}};
  var ONCA_W = 520, ONCA_H = 210, ONCA_CHAO = 150, ONCA_PE = 125, ONCA_LARG = 335;
  var oncaImg = null;
  function oncaFolha() {
    if (!oncaImg) { oncaImg = new Image(); oncaImg.src = ONCA_PNG; }
    return oncaImg;
  }

  // Liga a animação num <canvas> 520x210. Para sozinha quando o canvas sai da página.
  function oncaAnimar(cv) {
    var g = cv.getContext('2d'), img = oncaFolha();
    var lento = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    var T = lento ? 2.5 : 1.25, PASSO = 22, LEVANTA = 5, APOIO = 0.65;
    var vel = PASSO / (APOIO * T);                     // o chão anda o mesmo que o pé no apoio
    var jx = Math.round((ONCA_W - ONCA_LARG) / 2), jy = ONCA_CHAO - ONCA_PE;
    var BRILHOS = [];
    for (var b = 0; b < 16; b++) BRILHOS.push({ x: (b * 97) % (ONCA_W + 40), y: ONCA_CHAO + 9 + (b * 23) % (ONCA_H - ONCA_CHAO - 14), w: 2 + (b * 7) % 5 });
    function caminho(p) {                              // posição do pé (x) e quanto ele sobe
      p -= Math.floor(p);
      if (p < APOIO) return [PASSO / 2 - PASSO * p / APOIO, 0];
      var q = (p - APOIO) / (1 - APOIO), e = q * q * (3 - 2 * q);
      return [-PASSO / 2 + PASSO * e, Math.sin(Math.PI * q) * LEVANTA];
    }
    function peca(n, dx, dy) {
      var p = ONCA[n];
      g.drawImage(img, p.sx, p.sy, p.w, p.h, p.x + dx, p.y + dy, p.w, p.h);
    }
    function perna(n, t, sobe) {
      var p = ONCA[n], c = caminho(p.ph + t / T), c0 = caminho(p.ph), L = p.paw - p.cut;
      var k = (c[0] - c0[0]) / L, sy = (L + sobe - c[1]) / L;
      g.setTransform(1, 0, k, sy, jx, jy - sobe + p.cut);
      g.drawImage(img, p.sx, p.sy, p.w, p.h, p.x, p.y - p.cut, p.w, p.h);
    }
    function moitas(t, esc, velo, periodo, alfa, base) {
      var lista = [['pl', 0], ['pr', periodo * 0.52]];
      g.globalAlpha = alfa;
      for (var i = 0; i < lista.length; i++) {
        var p = ONCA[lista[i][0]], w = p.w * esc, h = p.h * esc;
        var x0 = ((lista[i][1] - t * velo) % periodo + periodo) % periodo - w;
        for (var x = x0; x < ONCA_W; x += periodo) {
          // as moitas foram recortadas com o chão em y=164 (escala da folha)
          g.drawImage(img, p.sx, p.sy, p.w, p.h, Math.round(x), Math.round(base - (164 - p.y) * esc), w, h);
        }
      }
      g.globalAlpha = 1;
    }
    function desenhar(t) {
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, ONCA_W, ONCA_H);
      g.imageSmoothingEnabled = false;
      // mato: o de longe mais devagar e apagado; o de perto no passo da onça
      g.save(); g.beginPath(); g.rect(0, 0, ONCA_W, ONCA_CHAO + 4); g.clip();
      moitas(t, 0.7, vel * 0.4, 330, 0.38, ONCA_CHAO - 8);
      moitas(t, 1.15, vel, 600, 1, ONCA_CHAO + 2);
      g.restore();
      // barranco
      g.fillStyle = '#1b120a'; g.fillRect(0, ONCA_CHAO - 1, ONCA_W, 6);
      g.fillStyle = '#3b2814'; g.fillRect(0, ONCA_CHAO - 1, ONCA_W, 1);
      var des = Math.floor(t * vel);
      for (var x = 0; x < ONCA_W; x++) {
        var hsh = Math.imul(x + des, 2654435761) >>> 0;
        if (hsh % 7 === 0) { g.fillStyle = hsh % 3 ? '#4a3420' : '#6b4b28'; g.fillRect(x, ONCA_CHAO + (hsh >>> 8) % 4, 1, 1); }
      }
      // onça: sobe e desce duas vezes por passada
      var sobe = Math.abs(Math.sin(2 * Math.PI * t / T)) * 1.4;
      perna('h2', t, sobe); perna('f2', t, sobe);
      var a = 0.07 * Math.sin(Math.PI * t / T), r = ONCA.tail;
      g.setTransform(Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), jx + r.px, jy - sobe + r.py);
      peca('tail', -r.px, -r.py);
      perna('h1', t, sobe); perna('f1', t, sobe);
      g.setTransform(1, 0, 0, 1, jx, jy - sobe);
      peca('body', 0, 0);
      g.setTransform(1, 0, 0, 1, 0, 0);
      // água: a cena de cima espelhada, ondulando e sumindo
      var topo = ONCA_CHAO + 5;
      g.fillStyle = '#030508'; g.fillRect(0, topo, ONCA_W, ONCA_H - topo);
      for (var y = topo; y < ONCA_H; y++) {
        var k = y - topo, src = Math.round(topo - 1 - k * 1.15);
        if (src < 0) break;
        g.globalAlpha = 0.5 * (1 - k / (ONCA_H - topo));
        g.drawImage(cv, 0, src, ONCA_W, 1, Math.round(Math.sin(k * 0.55 + t * 2.6) * (0.6 + k * 0.05)), y, ONCA_W, 1);
      }
      for (var i = 0; i < BRILHOS.length; i++) {
        var br = BRILHOS[i], bx = ((br.x - t * vel * 0.9) % (ONCA_W + 40) + ONCA_W + 40) % (ONCA_W + 40) - 20;
        g.globalAlpha = 0.18 + 0.22 * (0.5 + 0.5 * Math.sin(t * 3 + i * 1.7));
        g.fillStyle = i % 3 ? '#e0a92a' : '#ffd76a';
        g.fillRect(Math.round(bx), br.y, br.w, 1);
      }
      g.globalAlpha = 1;
    }
    var t0 = 0;
    function quadro(agora) {
      if (t0 && !cv.isConnected) return;
      if (!t0) t0 = agora;
      if (img.complete && img.naturalWidth) desenhar((agora - t0) / 1000);
      requestAnimationFrame(quadro);
    }
    requestAnimationFrame(quadro);
  }

  var CSS_ONCA =
    '#bpc-carga{position:fixed;inset:0;z-index:2147482000;display:flex;align-items:center;justify-content:center;padding:16px;' +
      'background:radial-gradient(700px 360px at 50% 42%,rgba(245,197,24,.07),transparent 65%),rgba(3,5,9,.94);' +
      'backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);color:#e2e8f0;' +
      'font-family:Inter,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;transition:opacity .55s ease,visibility .55s}' +
    '#bpc-carga.bpc-some{opacity:0;visibility:hidden}' +
    '#bpc-carga.bpc-some .bpc-carga-in{transform:scale(1.03)}' +
    '#bpc-carga .bpc-carga-in{display:flex;flex-direction:column;align-items:center;width:min(900px,100%);transition:transform .55s ease}' +
    '#bpc-carga .bpc-onca{display:block;width:100%;height:auto;image-rendering:pixelated;' +
      '-webkit-mask-image:linear-gradient(90deg,transparent,#000 13%,#000 87%,transparent);mask-image:linear-gradient(90deg,transparent,#000 13%,#000 87%,transparent)}' +
    '#bpc-carga .bpc-titulo{font-family:Rajdhani,Inter,sans-serif;font-weight:700;font-size:clamp(15px,2.4vw,19px);letter-spacing:.38em;text-indent:.38em;' +
      'color:#e9b52c;text-transform:uppercase;text-shadow:0 0 14px rgba(245,197,24,.35);margin-top:6px}' +
    '#bpc-carga .bpc-titulo i{font-style:normal;display:inline-block;animation:bpc-ponto 1.2s infinite}' +
    '#bpc-carga .bpc-titulo i:nth-child(2){animation-delay:.2s}#bpc-carga .bpc-titulo i:nth-child(3){animation-delay:.4s}' +
    '@keyframes bpc-ponto{0%,60%,100%{opacity:.25}30%{opacity:1}}' +
    '#bpc-carga .bpc-barra{position:relative;width:min(470px,86%);height:20px;margin-top:12px;background:#c99a24;' +
      'clip-path:polygon(9px 0,calc(100% - 9px) 0,100% 50%,calc(100% - 9px) 100%,9px 100%,0 50%)}' +
    '#bpc-carga .bpc-barra::before{content:"";position:absolute;inset:2px;background:#07090d;' +
      'clip-path:polygon(8px 0,calc(100% - 8px) 0,100% 50%,calc(100% - 8px) 100%,8px 100%,0 50%)}' +
    '#bpc-carga .bpc-barra i{position:absolute;left:6px;top:5px;bottom:5px;width:calc((100% - 12px) * var(--p,0));transition:width .35s ease-out;' +
      'background:repeating-linear-gradient(90deg,rgba(120,72,0,.22) 0 2px,transparent 2px 7px),linear-gradient(180deg,#ffe27d,#f5c518 45%,#c99400);' +
      'clip-path:polygon(4px 0,100% 0,100% 100%,4px 100%,0 50%)}' +
    '#bpc-carga .bpc-pata{display:flex;align-items:center;gap:12px;margin-top:12px;color:#c99a24}' +
    '#bpc-carga .bpc-pata b{width:70px;height:1px;background:linear-gradient(90deg,transparent,rgba(201,154,36,.7))}' +
    '#bpc-carga .bpc-pata b:last-child{transform:scaleX(-1)}' +
    '#bpc-carga .bpc-pata svg{width:17px;height:17px}' +
    '#bpc-carga .bpc-msg{font-size:12.5px;color:#8b95a7;margin-top:8px;min-height:18px;text-align:center}' +
    // celular: corta as laterais do cenário para a onça ocupar a largura
    '@media (max-width:640px){#bpc-carga{overflow:hidden}#bpc-carga .bpc-onca{width:150%;max-width:none;margin:0 -25%}}';

  // Abre a tela de carregamento. Devolve { msg(texto), fechar() }.
  function carregando(msg) {
    injetarCss('bpc-css-onca', CSS_ONCA);
    var el = document.getElementById('bpc-carga');
    if (!el) {
      el = document.createElement('div');
      el.id = 'bpc-carga';
      el.setAttribute('role', 'status');
      el.innerHTML = '<div class="bpc-carga-in">' +
        '<canvas class="bpc-onca" width="' + ONCA_W + '" height="' + ONCA_H + '" role="img" aria-label="Onça-pintada andando"></canvas>' +
        '<div class="bpc-titulo">Carregando<i>.</i><i>.</i><i>.</i></div>' +
        '<div class="bpc-barra"><i></i></div>' +
        '<div class="bpc-pata"><b></b><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><ellipse cx="12" cy="16.5" rx="5.2" ry="4.4"/>' +
          '<ellipse cx="5.2" cy="10.6" rx="2.2" ry="2.8"/><ellipse cx="9.4" cy="6.4" rx="2.2" ry="2.9"/><ellipse cx="14.6" cy="6.4" rx="2.2" ry="2.9"/><ellipse cx="18.8" cy="10.6" rx="2.2" ry="2.8"/></svg><b></b></div>' +
        '<div class="bpc-msg"></div></div>';
      (document.body || DOC).appendChild(el);
      oncaAnimar(el.querySelector('canvas'));
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
    carregando: carregando, oncaAnimar: oncaAnimar, cssOnca: function () { injetarCss('bpc-css-onca', CSS_ONCA); }
  };
})();
