/* =====================================================================
   fichas-oficio.js — LEITOR DO OFÍCIO DE INDICAÇÃO (Fichas de Missão, 25/11/2026)

   Recebe os pedaços de texto do PDF do SEI (pdf.js: {s,x,y,w} por página) e
   devolve { oficio, linhas, avisos }. Puro JavaScript, sem tela: a fichas.html
   chama no navegador e o teste chama no Node com o PDF de verdade.

   Como lê: acha o cabeçalho da tabela (GRAD | MATRICULA | NOME | OPM | CPF |
   FONE | FUNÇÃO), guarda o centro de cada coluna, e cada matrícula/CPF vira
   uma linha; o resto do texto vai para a linha mais próxima na altura (nome e
   OPM quebrados em 2 ou 3 linhas se juntam). Período e unidade vêm dos títulos
   em cima de cada tabela ("1º PERÍODO 13/12 a 22/12/2026", "3º BPM:").
   Nada é corrigido escondido: o que parece errado vira aviso para conferir.
   ===================================================================== */
(function (raiz) {
  'use strict';
  const sem = (s) => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '');
  const M = (s) => sem(s).toUpperCase().replace(/\s+/g, ' ').trim();
  const dig = (s) => String(s == null ? '' : s).replace(/\D/g, '');
  const limpa = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
  const p2 = (n) => String(n).padStart(2, '0');

  const MESES = { JANEIRO: 1, FEVEREIRO: 2, MARCO: 3, ABRIL: 4, MAIO: 5, JUNHO: 6, JULHO: 7, AGOSTO: 8, SETEMBRO: 9, OUTUBRO: 10, NOVEMBRO: 11, DEZEMBRO: 12 };

  /* ---------- CPF, telefone, graduação ---------- */
  function cpfValido(v) {
    const c = dig(v);
    if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
    const dv = (n) => { let s = 0; for (let i = 0; i < n; i++) s += Number(c[i]) * (n + 1 - i); const r = (s * 10) % 11; return r === 10 ? 0 : r; };
    return dv(9) === Number(c[9]) && dv(10) === Number(c[10]);
  }
  // CPF do jeito que veio: 11 dígitos (zeros da frente comidos pela planilha voltam)
  function cpf11(v) { const c = dig(v); return c.length >= 9 && c.length < 11 ? c.padStart(11, '0') : c; }
  function fmtCpf(v) { const c = cpf11(v); return c.length === 11 ? c.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : String(v || ''); }

  // → { fone: só dígitos com DDD, aviso }
  function normFone(v) {
    let d = dig(v);
    if (!d) return { fone: '', aviso: '' };
    if (d.length >= 12 && d.startsWith('55')) d = d.slice(2);
    d = d.replace(/^0+/, '');
    if (d.length === 8 || d.length === 9) d = '69' + d;
    if (d.length === 11 && d[2] === '9') return { fone: d, aviso: '' };
    if (d.length === 10) return /[6-9]/.test(d[2])
      ? { fone: d.slice(0, 2) + '9' + d.slice(2), aviso: 'Telefone sem o 9 na frente: entrou com o 9, confira.' }
      : { fone: d, aviso: 'Parece telefone fixo: confira.' };
    if (d.length > 11 && d[d.length - 9] === '9') return { fone: d.slice(0, 2) + d.slice(-9), aviso: 'Telefone com dígito a mais no ofício (' + limpa(v) + '): confira.' };
    return { fone: d, aviso: 'Telefone fora do padrão no ofício (' + limpa(v) + '): confira.' };
  }

  const GRADS = [
    [/^(AL|ALUNO)/, 'AL SD'], [/^SD|^SOLD/, 'SD'], [/^CB|^CABO/, 'CB'],
    [/^([123])(O|º|°)?S(GT|ARG)/, (m) => m[1] + 'º SGT'],
    [/^(ST|SUB)/, 'ST'], [/^ASP/, 'ASP'], [/^([12])(O|º|°)?T(EN)?/, (m) => m[1] + 'º TEN'], [/^CAP/, 'CAP'], [/^MAJ/, 'MAJ'],
    [/^(TC|TENCEL|TENENTECORONEL)/, 'TC'], [/^(CEL|CORONEL)/, 'CEL'],
  ];
  function normGrad(v) {
    const k = M(v).replace(/[ªº°]/g, 'º').replace(/[\s.\-]/g, '');
    const t = k.replace(/^([123])A/, '$1º');
    for (const [re, saida] of GRADS) { const m = re.exec(t); if (m) return typeof saida === 'function' ? saida(m) : saida; }
    return limpa(v).toUpperCase();
  }

  /* ---------- períodos ---------- */
  const iso = (a, m, d) => a + '-' + p2(m) + '-' + p2(d);
  function montaPeriodo(d1, m1, a1, d2, m2, a2) {
    d1 = +d1; d2 = +d2; m2 = +m2; m1 = +(m1 || m2); a2 = +a2; if (a2 < 100) a2 += 2000;
    a1 = a1 ? +a1 : (m1 > m2 ? a2 - 1 : a2); if (a1 < 100) a1 += 2000;
    if (!(d1 >= 1 && d1 <= 31 && d2 >= 1 && d2 <= 31 && m1 >= 1 && m1 <= 12 && m2 >= 1 && m2 <= 12 && a2 > 2000)) return null;
    const p = { ini: iso(a1, m1, d1), fim: iso(a2, m2, d2) };
    return p.ini <= p.fim ? p : null;
  }
  // todos os períodos que aparecem num texto; ano = o do documento, quando o texto não traz
  function lerPeriodos(texto, ano) {
    const t = M(texto).replace(/[–—]/g, '-'), saida = [];
    const poe = (p) => { if (p && !saida.some((x) => x.ini === p.ini && x.fim === p.fim)) saida.push(p); };
    let m;
    const num = /(\d{1,2})\s*[\/.]\s*(\d{1,2})(?:\s*[\/.]\s*(\d{2,4}))?\s*(?:A|ATE|-)\s*(\d{1,2})\s*[\/.]\s*(\d{1,2})(?:\s*[\/.]\s*(\d{2,4}))?/g;
    while ((m = num.exec(t))) { const a = m[6] || m[3] || ano; if (a) poe(montaPeriodo(m[1], m[2], m[3], m[4], m[5], a)); }
    const curto = /(?:^|[^\d\/])(\d{1,2})\s*(?:A|ATE|-)\s*(\d{1,2})\s*[\/.]\s*(\d{1,2})(?:\s*[\/.]\s*(\d{2,4}))?/g;
    while ((m = curto.exec(t))) { const a = m[4] || ano; if (a) poe(montaPeriodo(m[1], m[3], null, m[2], m[3], a)); }
    const nomes = Object.keys(MESES).join('|');
    const ext = new RegExp('(\\d{1,2})[Oº°]?\\s*(?:DE\\s+(' + nomes + ')(?:\\s+DE\\s+(\\d{4}))?\\s+)?(?:A|ATE)\\s+(\\d{1,2})[Oº°]?\\s+(?:DE\\s+)?(' + nomes + ')(?:\\s+(?:DE\\s+)?(\\d{4}))?', 'g');
    while ((m = ext.exec(t))) { const a = m[6] || m[3] || ano; if (a) poe(montaPeriodo(m[1], m[2] ? MESES[m[2]] : null, m[3], m[4], MESES[m[5]], a)); }
    return saida;
  }
  function txtPeriodo(p) {
    if (!p || !p.ini || !p.fim) return '';
    const [a1, m1, d1] = p.ini.split('-'), [a2, m2, d2] = p.fim.split('-');
    return a1 === a2 ? d1 + '/' + m1 + ' a ' + d2 + '/' + m2 + '/' + a2 : d1 + '/' + m1 + '/' + a1 + ' a ' + d2 + '/' + m2 + '/' + a2;
  }

  /* ---------- colunas ---------- */
  const COLS = [
    ['grad', /^(GRAD|POSTO|P\/G|PG\b|GRADUACAO)/], ['re', /^(MATRICULA|MAT\b|RE\b|R\.?E\.?$|REGISTRO)/], ['nome', /^(NOME|POLICIAL)/],
    ['opm', /^(OPM|UNIDADE|LOTACAO)/], ['cpf', /^CPF/], ['fone', /^(FONE|TELEFONE|CONTATO|CELULAR|TEL\b)/], ['funcao', /^(FUNCAO|FUN\b)/], ['ord', /^(ORD|N[º°O]?\.?$|ITEM)/],
  ];
  const tipoCol = (s) => { const k = M(s); const c = COLS.find(([, re]) => re.test(k)); return c ? c[0] : ''; };

  // junta em linhas (mesma altura), de cima para baixo
  function emLinhas(itens, tol) {
    const ls = [];
    for (const i of itens.slice().sort((a, b) => b.y - a.y || a.x - b.x)) {
      const l = ls.find((x) => Math.abs(x.y - i.y) <= (tol || 2));
      if (l) l.itens.push(i); else ls.push({ y: i.y, itens: [i] });
    }
    for (const l of ls) l.itens.sort((a, b) => a.x - b.x);
    return ls;
  }
  function juntar(itens) {
    let s = '', fim = null;
    for (const i of itens) {
      s += (fim != null && i.x - fim > 0.9 && !/\s$/.test(s) ? ' ' : '') + i.s;
      fim = i.x + (i.w || 0);
    }
    return limpa(s);
  }
  const ehRE = (s) => /^1000\d{5}$/.test(s) || /^1000\d{4}-\d$/.test(s) || /^100\.\d{3}\.\d{3}$/.test(s);
  // só com pontos/traço, ou 11 dígitos que fecham a conta: telefone (69 98107-9970) não pode virar CPF
  const ehCPF = (s) => /^\d{3}\.\d{3}\.\d{3}\s?-?\s?\d{2}$/.test(s) || (/^\d{11}$/.test(s) && cpfValido(s));

  function lerOficio(paginas) {
    const linhas = [], avisos = [], textos = [];
    let cols = null, periodo = null, unidade = '', semCab = 0;

    const doc = paginas.map((pg) => pg.filter((i) => i && i.s && i.s.trim()).map((i) => ({ s: i.s.trim(), x: +i.x, y: +i.y, w: +i.w || 0 })));
    for (const pg of doc) for (const l of emLinhas(pg)) textos.push(juntar(l.itens));
    const tudo = textos.join('\n'), corrido = limpa(textos.join(' '));
    const oficio = lerMeta(tudo, corrido);
    const ano = oficio.ano;

    for (const pg of doc) {
      const ls = emLinhas(pg);
      // marcos da página, de cima para baixo: cabeçalho de tabela, período, unidade
      const marcos = [];
      for (const l of ls) {
        const t = juntar(l.itens), k = M(t);
        const achados = l.itens.map((i) => ({ t: tipoCol(i.s), c: i.x + i.w / 2 })).filter((c) => c.t);
        const tipos = new Set(achados.map((c) => c.t));
        if (tipos.has('nome') && (tipos.has('cpf') || tipos.has('re')) && tipos.size >= 3 && l.itens.length <= 12) { marcos.push({ y: l.y, cols: achados }); continue; }
        if (/PERIODO/.test(k) && k.length < 70) { const p = lerPeriodos(t, ano)[0]; if (p) { marcos.push({ y: l.y, periodo: p }); continue; } }
        if (k.length < 60 && /:$/.test(k) && /(BPM|CIA|CRP|BPA|BPTRAN|BOPE|BPCHOQUE|CPE|CPA|BATALHAO|COMPANHIA|PEL)/.test(k) && !/E-?MAIL|CEP/.test(k)) marcos.push({ y: l.y, unidade: limpa(t.replace(/:\s*$/, '')) });
      }
      const ancoras = [];
      for (const i of pg) {
        if (!ehRE(i.s) && !ehCPF(i.s)) continue;
        const a = ancoras.find((x) => Math.abs(x.y - i.y) <= 5);
        if (a) a.n++; else ancoras.push({ y: i.y, n: 1, itens: [] });
      }
      ancoras.sort((a, b) => b.y - a.y);
      const usados = new Set(marcos.map((m) => m.y));
      // estado de cada âncora (o marco mais próximo acima)
      let mi = 0;
      for (const a of ancoras) {
        while (mi < marcos.length && marcos[mi].y > a.y) {
          const m = marcos[mi++];
          if (m.cols) cols = m.cols; if (m.periodo) periodo = m.periodo; if (m.unidade) { unidade = m.unidade; periodo = null; }
        }
        a.cols = cols; a.periodo = periodo; a.unidade = unidade; a.teto = mi ? marcos[mi - 1].y : Infinity;
        a.chao = mi < marcos.length ? marcos[mi].y : -Infinity;
      }
      while (mi < marcos.length) { const m = marcos[mi++]; if (m.cols) cols = m.cols; if (m.periodo) periodo = m.periodo; if (m.unidade) { unidade = m.unidade; periodo = null; } }
      const validas = ancoras.filter((a) => a.cols && (a.n >= 2 || a.teto !== Infinity));
      semCab += ancoras.filter((a) => !a.cols && a.n >= 2).length;
      for (const i of pg) {
        if ([...usados].some((y) => Math.abs(y - i.y) <= 2)) continue;
        let melhor = null, dist = 1e9;
        for (const a of validas) { const d = Math.abs(a.y - i.y); if (d < dist && i.y < a.teto && i.y > a.chao) { dist = d; melhor = a; } }
        if (melhor && dist <= 15) melhor.itens.push(i);
      }
      for (const a of validas) {
        const cel = {};
        for (const i of a.itens) {
          const c = i.x + i.w / 2;
          let t = ehRE(i.s) ? 're' : ehCPF(i.s) ? 'cpf' : '';
          if (!t || !a.cols.some((k) => k.t === t)) t = a.cols.reduce((m, k) => (Math.abs(k.c - c) < Math.abs(m.c - c) ? k : m)).t;
          (cel[t] = cel[t] || []).push(i);
        }
        const v = (k) => (cel[k] ? emLinhas(cel[k]).map((l) => juntar(l.itens)).join(' ') : '');
        const p = montarLinha({ grad: v('grad'), re: v('re'), nome: v('nome'), opm: v('opm'), cpf: v('cpf'), fone: v('fone'), funcao: v('funcao') }, a.periodo, a.unidade);
        if (p.nome) linhas.push(p);
      }
    }
    // sem período em cima da tabela: se o corpo só fala em um, é ele
    const faltam = linhas.filter((l) => !l.ini);
    if (faltam.length && oficio.periodos.length === 1) for (const l of faltam) { l.ini = oficio.periodos[0].ini; l.fim = oficio.periodos[0].fim; l.periodo = txtPeriodo(oficio.periodos[0]); }
    else for (const l of faltam) l.avisos.push('O ofício não diz o período desta tabela: escolha.');
    if (!linhas.length) avisos.push(!corrido ? 'O PDF não tem texto (é imagem escaneada). Baixe do SEI o PDF original ou cole a relação.' : semCab ? 'Achei nomes, mas não o cabeçalho da tabela (GRAD, NOME, CPF…). Cole a relação.' : 'Não achei a tabela de policiais neste PDF. Cole a relação.');
    const vistos = {};
    for (const l of linhas) { const k = (l.cpf || M(l.nome)) + '|' + l.ini; if (vistos[k]) l.avisos.push('Repetido no mesmo período.'); vistos[k] = 1; }
    return { oficio, linhas, avisos };
  }

  function montarLinha(b, periodo, unidade) {
    const av = [];
    const cpf = cpf11(b.cpf), f = normFone(b.fone);
    const nome = limpa(b.nome).toUpperCase();
    let opm = limpa(b.opm);
    if (!cpf) av.push('Sem CPF no ofício.'); else if (!cpfValido(cpf)) av.push('CPF do ofício não confere (dígito verificador).');
    if (!f.fone) av.push('Sem telefone no ofício.'); else if (f.aviso) av.push(f.aviso);
    const bt = /(\d{1,2})\s*[ºª°]?\s*BPM/i.exec(opm);
    return {
      grad: normGrad(b.grad), re: dig(b.re), nome, opm, cpf, telefone: f.fone, funcao: limpa(b.funcao).toUpperCase(),
      unidade: unidade || (bt ? bt[1] + 'º BPM' : ''), ni: /(^|[\s\/])(NI|AI|SI|ARI)([\s\/]|$)/.test(M(opm)) ? 'SIM' : '',
      ini: periodo ? periodo.ini : '', fim: periodo ? periodo.fim : '', periodo: txtPeriodo(periodo), avisos: av,
    };
  }

  function lerMeta(tudo, corrido) {
    const pega = (re) => { const m = re.exec(corrido); return m ? limpa(m[1]) : ''; };
    const o = {};
    o.numero = pega(/Of[ií]cio\s*n[º°o]?\.?\s*([\d.]+\/\d{4}\/[A-Z0-9\-]+)/i) || pega(/Of[ií]cio\s*n[º°o]?\.?\s*([\d.]+(?:\/\d{4})?)/i);
    o.processo = pega(/\b(\d{4}\.\d{6}\/\d{4}-\d{2})\b/);
    o.sei = pega(/SEI\s*n[º°o]?\.?\s*(\d{6,})/i) || pega(/Of[ií]cio\s+[\d.]+\s*\((\d{6,})\)/i);
    const ln = tudo.split('\n');
    const assunto = ln.find((l) => /^Assunto\s*:/i.test(l)); o.assunto = assunto ? limpa(assunto.replace(/^Assunto\s*:/i, '')).replace(/\.$/, '') : '';
    const de = ln.find((l) => /^D[oa]\s+(Comandante|Chefe|Comando|Subcomandante|Diretor)/i.test(l)); o.remetente = de ? limpa(de.replace(/^D[oa]\s+/i, '')) : '';
    const rfr = ln.find((l) => /^(Rfr|Ref)\.?\s*:/i.test(l)); o.referencia = rfr ? limpa(rfr.replace(/^(Rfr|Ref)\.?\s*:/i, '')).replace(/\(\s*/g, '(').replace(/\s*\)/g, ')') : '';
    const op = /((?:Programa|Opera[cç][aã]o|Plano)\s+[“"”']?[^.;]{4,140}?[”"“']?)\s*(?:,|\.|;)?\s*(?:nos?|durante|para)\s+(?:o\s+)?per[ií]odos?/i.exec(corrido);
    o.operacao = op ? limpa(op[1]).replace(/[,;]\s*$/, '') : '';
    const a = /\/(20\d{2})\//.exec(o.numero) || /\/(20\d{2})$/.exec(o.numero) || /\/(20\d{2})-/.exec(o.processo); o.ano = a ? Number(a[1]) : 0;
    const crp = /(?:Regional de Policiamento|CRP)[\s\-]*(IV|III|II|I)\b/i.exec(o.remetente || '') || /PM-CRP\s*(IV|III|II|I)(?=AI|P\d|\b)/.exec(o.numero || '') || /CRP\s+(IV|III|II|I)\b/.exec(corrido);
    o.secao = crp ? 'CRP ' + crp[1].toUpperCase() : '';
    o.periodos = lerPeriodos(corrido, o.ano);
    const d = /em\s+(\d{2})\/(\d{2})\/(\d{4}),\s*às/.exec(corrido); o.data = d ? d[3] + '-' + d[2] + '-' + d[1] : '';
    return o;
  }

  /* ---------- relação colada (Excel, WhatsApp, e-mail) ---------- */
  function lerColado(texto) {
    const linhas = []; let periodo = null, unidade = '';
    for (const bruta of String(texto || '').split(/\r?\n/)) {
      const l = limpa(bruta.replace(/\t/g, '  ')); if (!l) continue;
      const cpfM = /\d{3}\.?\d{3}\.?\d{3}-?\s?\d{2}(?!\d)/.exec(l);
      const reM = /(?<!\d)1000\d{5}(?!\d)/.exec(l);
      if (!cpfM && !reM) {
        const p = lerPeriodos(l)[0]; if (p) { periodo = p; continue; }
        if (l.length < 40 && /(BPM|CIA|CRP|BPA|CPE)/i.test(l)) { unidade = limpa(l.replace(/:\s*$/, '')); periodo = null; }
        continue;
      }
      const partes = bruta.split(/\t|;|\|/).map(limpa).filter(Boolean);
      const b = { grad: '', re: reM ? reM[0] : '', nome: '', opm: '', cpf: cpfM && (!reM || cpfM.index !== reM.index) ? cpfM[0] : '', fone: '', funcao: '' };
      const resto = partes.length > 2 ? partes : [l];
      for (let c of resto) {
        c = limpa(c.replace(b.cpf || '\u0000', ' ').replace(b.re || '\u0000', ' ')); if (!c) continue;
        const f = /(?:\(?\d{2}\)?[\s.]*)?9[\s.]?\d{4}[\s\-.]?\d{4}/.exec(c); if (f && !b.fone) { b.fone = f[0]; c = limpa(c.replace(f[0], ' ')); }
        const g = /^((?:[123]\s*[ºª°oa]?\s*(?:SGT|SARGENTO|TEN|TENENTE)|SUB\s?TEN|ST|CB|CABO|SD|SOLDADO|CAP|MAJ|TC|CEL)\b\.?(?:\s+Q?P?PM\w*|\s+QO\w+)?)\s*/i.exec(c);
        if (g && !b.grad) { b.grad = g[1]; c = limpa(c.slice(g[0].length)); }
        if (!c || /^\d{1,3}$/.test(c)) continue;
        if (/^(CMT|MOT|PTR|COMANDANTE|MOTORISTA|PATRULHEIRO)$/i.test(c)) { b.funcao = c; continue; }
        if (/BPM|CIA|CRP|BPA|CPE|PEL\b/i.test(c) && b.nome) { b.opm = c; continue; }
        if (!b.nome) b.nome = c.replace(/[-–,:;]+$/, ''); else if (!b.opm) b.opm = c;
      }
      b.nome = limpa(b.nome.replace(/\b(CPF|RE|MATR[ÍI]CULA|FONE|TEL)\b:?/gi, ' ').replace(/[^\p{L}\s'.\-]/gu, ' '));
      const p = montarLinha(b, periodo, unidade); if (p.nome) { if (!p.ini) p.avisos.push('Escolha o período.'); linhas.push(p); }
    }
    return linhas;
  }

  const api = { lerOficio, lerColado, lerPeriodos, txtPeriodo, cpfValido, cpf11, fmtCpf, normFone, normGrad, semAcento: M };
  raiz.FichasOficio = api;
})(typeof window !== 'undefined' ? window : globalThis);
