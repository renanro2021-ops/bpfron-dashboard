/* =====================================================================
   p5-portaria.js — lê o TEXTO de uma portaria de outorga (DOE/SEI da PMRO)
   e devolve os dados da portaria + a lista de agraciados NA ORDEM DO
   DOCUMENTO, separada por artigo (policiais militares, autoridades
   militares, civis, empresa).

   Usado em dois lugares (o mesmo código, para não divergir):
     - p5.html: o gestor arrasta o PDF de uma portaria nova, o pdf.js extrai
       as linhas e este arquivo monta a lista para ele conferir;
     - ferramentas/p5/gerar-seed.mjs: gerou a lista das 4 primeiras
       portarias que vai embutida no Worker (backend/p5-seed.js).

   P5Portaria.ler(linhas) → { numero, ano, data, titulo, doe, doeData, sei,
     processo, assinante, cargoAssinante, grupos:[{art, titulo}],
     agraciados:[{art, ordem, posto, re, nome, funcao, trat}], avisos:[] }
   ===================================================================== */
(function (raiz) {
  'use strict';

  var MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

  // posto/graduação no começo do nome (policial militar da PMRO)
  var POSTO = /^((?:CEL|TEN CEL|TC|MAJ|CAP|[12][ºo°] TEN|ASP OF|ASP|ST|SUBTEN|[123][ºo°] SGT|AL SGT|SGT|CB|SD)(?:\s+(?:QOPM|QOAPM|QOSPM|QOEPM|QPPM|QPEPM|QOBM|QPBM))?(?:\s+RR)?)\s+(?:RE\s+)?([*\d]{6,})\s+(.+)$/;

  function limpa(s) { return String(s || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim(); }
  // texto justificado do PDF: "P M P R" → "PMPR", "ALE- RO" → "ALE-RO"
  function junta(s) {
    return s.replace(/\b[A-Z](?: [A-Z]){2,}\b/g, function (x) { return x.replace(/ /g, ''); })
      .replace(/([A-Za-zÀ-ú])- ([A-Z])/g, '$1-$2');
  }
  function iso(d, m, a) { return a + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0'); }
  function dataExtenso(s) {
    var m = /(\d{1,2})\s+de\s+([a-zç]+)\s+de\s+(\d{4})/i.exec(s);
    if (!m) return '';
    var mes = MESES.indexOf(m[2].toLowerCase());
    return mes < 0 ? '' : iso(m[1], mes + 1, m[3]);
  }
  function dataBR(s) { var m = /(\d{2})\/(\d{2})\/(\d{4})/.exec(s); return m ? iso(m[1], m[2], m[3]) : ''; }

  // "1° TEN" / "1º TEN" / "1o TEN" → "1º TEN" (o símbolo varia de portaria pra portaria)
  function normPosto(p) { return limpa(p).replace(/(\d)[o°º]\s/g, '$1º '); }

  // RE: guarda só os 3 últimos dígitos (as portarias de 2023 em diante já vêm assim)
  function mascaraRE(re) {
    var d = String(re || '').replace(/\D/g, '');
    return d ? '******' + d.slice(-3) : '';
  }

  // título do grupo pelo texto do artigo
  function tituloGrupo(intro) {
    var t = intro.toLowerCase();
    if (/policiais militares/.test(t)) return 'Policiais militares';
    if (/autoridades militares/.test(t)) return 'Autoridades militares';
    if (/personalidades militares/.test(t)) return 'Personalidades militares';
    if (/autoridades civis/.test(t)) return 'Autoridades civis';
    if (/personalidades civis/.test(t)) return 'Personalidades civis';
    if (/empresa/.test(t)) return 'Empresa';
    return 'Agraciado';
  }

  // um item da lista ("CEL QOPM RE 100065725 FULANO" ou "Exmo. Sr. FULANO - Cargo")
  function lerItem(txt) {
    txt = junta(limpa(txt)).replace(/^e\s+/i, '').replace(/^\d{1,3}\.\s+/, '').replace(/[;.,]+$/, '').replace(/\s+e$/i, '').trim();
    if (!txt) return null;
    var m = POSTO.exec(txt);
    if (m) return { posto: normPosto(m[1]), re: mascaraRE(m[2]), nome: limpa(m[3]), funcao: '', trat: '' };
    var trat = '';
    var t = /^((?:Exm[oa]\.?\s*)?Sra?\.)\s+/i.exec(txt);
    if (t) { trat = limpa(t[1]); txt = txt.slice(t[0].length); }
    // "CAP BMRO - JOSSIMAR … - COMANDANTE": a 1ª parte curta é o posto, não o nome
    var partes = txt.split(/\s+-\s+/);
    if (partes.length > 2 && /^(?:CEL|TEN|MAJ|CAP|SGT|CB|SD|DEL)\b/.test(partes[0]) && partes[0].split(' ').length <= 2) partes = [partes[0] + ' ' + partes[1]].concat(partes.slice(2));
    var nome = limpa(limpa(partes[0]).replace(/[“”"]/g, ''));
    var funcao = limpa(partes.slice(1).join(' - '));
    return { posto: '', re: '', nome: nome, funcao: funcao, trat: trat };
  }

  function ler(linhasEntrada) {
    var avisos = [];
    // fora: rodapé de página, linhas em branco e o cabeçalho do DOE repetido
    var linhas = (linhasEntrada || []).map(limpa).filter(function (l) {
      return l && !/^Portaria \d+ \(\d+\) SEI .*pg\. ?\d+$/i.test(l);
    });
    var tudo = linhas.join('\n');
    var out = { numero: '', ano: '', data: '', titulo: '', doe: '', doeData: '', sei: '', processo: '', assinante: '', cargoAssinante: '', grupos: [], agraciados: [], avisos: avisos };

    var m = /Portaria\s+n[º°o.]*\s*(\d+)\s+de\s+(\d{1,2}\s+de\s+[a-zç]+\s+de\s+\d{4})/i.exec(tudo);
    if (m) { out.numero = m[1]; out.data = dataExtenso(m[2]); out.ano = out.data.slice(0, 4); }
    else avisos.push('Não achei o número e a data da portaria.');
    m = /Di[aá]rio Oficial do Estado de Rond[oô]nia\s+n[º°o.]*\s*(\d+)/i.exec(tudo); if (m) out.doe = m[1];
    m = /Publica[cç][aã]o:\s*(\d{2}\/\d{2}\/\d{4})/i.exec(tudo); if (m) out.doeData = dataBR(m[1]);
    m = /c[oó]digo\s+verificador\s+(\d+)/i.exec(tudo); if (m) out.sei = m[1];
    m = /Processo\s+n[º°o.]*\s*([\d.\/-]+\d)/i.exec(tudo); if (m) out.processo = m[1];
    m = /outorga d[ao]\s+(.+?)(?:\.|\n\s*\n|$)/i.exec(tudo.replace(/\n/g, ' '));
    if (m) out.titulo = limpa(m[1]).replace(/\s+da Pol[ií]cia Militar do Estado de Rond[oô]nia$/i, '').replace(/^./, function (c) { return c.toUpperCase(); });
    for (var i = 0; i < linhas.length; i++) {
      if (/^Comandante-Geral da PMRO$/i.test(linhas[i]) && i > 0) { out.assinante = linhas[i - 1]; out.cargoAssinante = linhas[i]; break; }
    }

    // artigos: do "R E S O L V E" até o "entra em vigor"
    var corpo = tudo.replace(/\n/g, ' ');
    var ini = corpo.search(/R\s*E\s*S\s*O\s*L\s*V\s*E/i);
    if (ini >= 0) corpo = corpo.slice(ini);
    var arts = corpo.split(/\bArt\.\s*(?=\d+\s*[º°o]?)/).slice(1);
    arts.forEach(function (a) {
      var mm = /^(\d+)\s*[º°o]?\s*(.*)$/.exec(a);
      if (!mm) return;
      var art = Number(mm[1]), txt = mm[2];
      if (/entra em vigor/i.test(txt) && !/Outorgar/i.test(txt)) return;
      if (!/Outorgar/i.test(txt)) return;
      var dois = txt.indexOf(':');
      var itens, intro;
      if (dois >= 0) {
        intro = txt.slice(0, dois);
        itens = txt.slice(dois + 1).split(';');
      } else {
        // artigo de uma pessoa só: "Outorgar a Medalha …, a CEL QOPM RE … NOME, como reconhecimento"
        intro = txt;
        var um = /Fronteira,?\s+(?:a|à|ao)\s+(?:empresa\s+)?(.+?),\s+como reconhecimento/i.exec(txt);
        itens = um ? [um[1]] : [];
        if (!um) avisos.push('Art. ' + art + ': não consegui separar o nome.');
      }
      var titulo = /empresa/i.test(intro) ? 'Empresa' : (dois < 0 && itens.length && POSTO.test(limpa(itens[0])) ? 'Policial militar' : tituloGrupo(intro));
      var ordem = 0, inicio = out.agraciados.length;
      itens.forEach(function (it) {
        var x = lerItem(it);
        if (!x || !x.nome) return;
        x.art = art; x.ordem = ++ordem;
        out.agraciados.push(x);
      });
      if (out.agraciados.length > inicio) out.grupos.push({ art: art, titulo: titulo });
    });
    if (!out.agraciados.length) avisos.push('Nenhum agraciado encontrado no texto.');
    return out;
  }

  /* Linhas a partir do pdf.js (página por página): junta os pedaços de texto
     que estão na mesma altura, em ordem da esquerda para a direita. */
  function linhasDoPdfJs(paginas) {
    var saida = [];
    paginas.forEach(function (itens) {
      var porY = [];
      itens.forEach(function (it) {
        if (!it.str || !it.str.trim()) return;
        var y = it.transform[5], x = it.transform[4];
        var g = null;
        for (var i = 0; i < porY.length; i++) if (Math.abs(porY[i].y - y) < 2.5) { g = porY[i]; break; }
        if (!g) { g = { y: y, partes: [] }; porY.push(g); }
        g.partes.push({ x: x, w: it.width || 0, s: it.str });
      });
      porY.sort(function (a, b) { return b.y - a.y; });
      porY.forEach(function (g) {
        g.partes.sort(function (a, b) { return a.x - b.x; });
        // espaço só quando há folga entre um pedaço e o próximo: o pdf.js corta
        // "JOÃO" em "J" + "OÃO" (letra capitular do texto justificado)
        var t = '', fim = null;
        g.partes.forEach(function (p) {
          if (fim !== null && p.x - fim > 1.2 && !/\s$/.test(t) && !/^\s/.test(p.s)) t += ' ';
          t += p.s; fim = p.x + p.w;
        });
        saida.push(t);
      });
    });
    return saida;
  }

  var api = { ler: ler, linhasDoPdfJs: linhasDoPdfJs, mascaraRE: mascaraRE };
  if (typeof module === 'object' && module.exports) module.exports = api;
  raiz.P5Portaria = api;
})(typeof window !== 'undefined' ? window : globalThis);
