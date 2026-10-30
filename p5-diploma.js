/* =====================================================================
   p5-diploma.js — desenha o CERTIFICADO ou o DIPLOMA de um agraciado num
   <canvas> e baixa em PDF ou PNG, um por um ou em LOTE. Usado pelo p5.html
   (clicar no nome, Confeccionar) e pelo p5-diploma.html (link compartilhado,
   sem login).

   MODELOS (a portaria aponta para um na coluna MODELO da planilha):
     certificado — o modelo oficial da P5 (CERTIFICADO.cdr do CorelDRAW,
                   29/10/2026): A4 em pé, fundo tirado do próprio arquivo
                   (p5-certificado-fundo.jpg) e os textos nas mesmas posições,
                   em Calisto MT como no Corel;
     simbolico   — o diploma provisório (A4 deitado) até chegar o modelo
                   oficial do diploma.
   Os textos de cada portaria (parágrafo, fecho, local/data, quem assina)
   ficam na coluna CONFIG; o que faltar sai de P5Diploma.padrao(portaria).

   P5Diploma.desenhar(canvas, dados, {escala}) → Promise
     dados = { agraciado:{posto,nome,funcao,trat,art,codigo},
               portaria:{numero,ano,data,titulo,doe,doe_data,assinante,cargo_assinante,modelo,config},
               grupo, link, modelo?, config? }   (modelo/config sobrepõem os da portaria: prévia)
   P5Diploma.baixarPDF / baixarPNG / pdfBlob / nomeArquivo / lote(itens, {formato, progresso})
   ===================================================================== */
(function () {
  'use strict';
  var W = 2339, H = 1654;           // diploma: A4 deitado a ~200 dpi
  var CW = 2480, CH = 3508;         // certificado: A4 em pé a 300 dpi
  var CALISTO = '"Calisto MT", "Crimson Pro", Georgia, serif';
  var FUNDO_CERT = 'p5-certificado-fundo.jpg';
  var PARAGRAFO_PADRAO = 'O Comandante-Geral da Polícia Militar do Estado de Rondônia, tendo em vista o dispositivo na Resolução nº 274, de 20 de julho de 2022, resolve, conferir a presente medalha pelos valorosos serviços prestados ao Batalhão de Polícia de Fronteira e Divisas e à Polícia Militar do Estado de Rondônia a(o) Sr(a).';
  var AZUL = '#0d2340', OURO = '#b8892c', OURO2 = '#e2bd5c', OURO3 = '#8a6417', TINTA = '#1d2433';
  var MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  var BRASAO = 'LOGOS/bpfron_transp.png';

  function extenso(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    return m ? Number(m[3]) + ' de ' + MESES[Number(m[2]) - 1] + ' de ' + m[1] : '';
  }
  var _img = {};
  function imagem(src) {
    if (!_img[src]) _img[src] = new Promise(function (ok) {
      var i = new Image(); i.onload = function () { ok(i); }; i.onerror = function () { ok(null); }; i.src = src;
    });
    return _img[src];
  }
  function fontes() {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    return Promise.all(['700 80px Cinzel', '400 40px Cinzel', '500 40px "Cormorant Garamond"', 'italic 500 40px "Cormorant Garamond"', '400 60px "Great Vibes"',
      '400 40px "Crimson Pro"', '700 40px "Crimson Pro"', 'italic 400 40px "Crimson Pro"', 'italic 700 40px "Crimson Pro"']
      .map(function (f) { return document.fonts.load(f).catch(function () {}); }));
  }
  /* A Calisto MT vem com o Office (não pode ser publicada no site). Com ela
     instalada o certificado sai idêntico ao do Corel; sem ela, Crimson Pro. */
  var _calisto = null;
  function temCalisto() {
    if (_calisto !== null) return _calisto;
    try {
      var c = document.createElement('canvas').getContext('2d'), t = 'Mérito Policial de Fronteira 0123';
      c.font = '40px monospace'; var a = c.measureText(t).width;
      c.font = '40px "Calisto MT", monospace'; _calisto = Math.abs(c.measureText(t).width - a) > 1;
    } catch (e) { _calisto = false; }
    return _calisto;
  }

  // "JAMES ALVES PADILHA - CEL QOPM" (como vem na portaria) → "CEL QOPM JAMES ALVES PADILHA"
  function assinanteCert(s) {
    var p = String(s || '').split(/\s+-\s+/);
    return (p.length > 1 ? p[1] + ' ' + p[0] : p[0]).toUpperCase().trim();
  }
  /* textos de uma portaria que ainda não foi confeccionada */
  function padrao(p) {
    p = p || {};
    return {
      paragrafo: PARAGRAFO_PADRAO,
      fecho: 'E para constar, expede o presente diploma.',
      local: 'Porto Velho, RO',
      data: p.data || '',
      assinante: assinanteCert(p.assinante),
      cargo: p.cargo_assinante || 'Comandante-Geral da PMRO',
    };
  }
  function textos(d) {
    var p = d.portaria || {}, base = padrao(p), c = d.config || p.config || {};
    Object.keys(base).forEach(function (k) { if (c[k] != null && String(c[k]).trim() !== '') base[k] = String(c[k]).trim(); });
    return base;
  }

  // parágrafo JUSTIFICADO (última linha centralizada), como no Corel; devolve o nº de linhas
  function quebra(ctx, texto, larg) {
    var pal = texto.split(/\s+/).filter(Boolean), linhas = [], linha = [];
    pal.forEach(function (p) {
      var t = linha.concat(p).join(' ');
      if (linha.length && ctx.measureText(t).width > larg) { linhas.push(linha); linha = [p]; } else linha.push(p);
    });
    if (linha.length) linhas.push(linha);
    return linhas;
  }
  function justificado(ctx, linhas, x, y, larg, alt) {
    linhas.forEach(function (l, i) {
      var yy = y + i * alt;
      if (i === linhas.length - 1 || l.length === 1) { ctx.textAlign = 'center'; ctx.fillText(l.join(' '), x + larg / 2, yy); return; }
      ctx.textAlign = 'left';
      var soma = l.reduce(function (s, p) { return s + ctx.measureText(p).width; }, 0);
      var vao = (larg - soma) / (l.length - 1), xx = x;
      l.forEach(function (p) { ctx.fillText(p, xx, yy); xx += ctx.measureText(p).width + vao; });
    });
    ctx.textAlign = 'center';
  }
  // diminui a fonte até o texto caber na largura
  function cabe(ctx, estilo, tam, texto, larg, min) {
    do { ctx.font = estilo + ' ' + tam + 'px ' + CALISTO; tam -= 1; } while (ctx.measureText(texto).width > larg && tam > (min || 30));
  }
  function esp(ctx, px) { if ('letterSpacing' in ctx) ctx.letterSpacing = px + 'px'; }

  // texto centralizado quebrando em linhas; devolve o y da última linha
  function paragrafo(ctx, texto, x, y, larg, alt) {
    var pal = texto.split(' '), linha = '', linhas = [];
    pal.forEach(function (p) {
      var t = linha ? linha + ' ' + p : p;
      if (ctx.measureText(t).width > larg && linha) { linhas.push(linha); linha = p; } else linha = t;
    });
    if (linha) linhas.push(linha);
    linhas.forEach(function (l, i) { ctx.fillText(l, x, y + i * alt); });
    return y + (linhas.length - 1) * alt;
  }
  function ouro(ctx, x0, y0, x1, y1) {
    var g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, OURO3); g.addColorStop(0.35, OURO2); g.addColorStop(0.55, '#f6dc8c'); g.addColorStop(0.75, OURO); g.addColorStop(1, OURO3);
    return g;
  }

  function fundo(ctx) {
    var g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#fdfaf0'); g.addColorStop(0.5, '#f8f1dd'); g.addColorStop(1, '#f1e6c8');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    var v = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.62);
    v.addColorStop(0, 'rgba(255,255,255,0)'); v.addColorStop(1, 'rgba(160,120,40,.18)');
    ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
    // guilhoché (roseta de linhas finas, como papel de segurança)
    ctx.save(); ctx.translate(W / 2, H / 2 + 40); ctx.strokeStyle = 'rgba(184,137,44,.07)'; ctx.lineWidth = 1.4;
    for (var k = 0; k < 72; k++) {
      ctx.beginPath(); ctx.rotate(Math.PI / 36);
      ctx.ellipse(0, 0, 640, 250, 0, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
    // linhas onduladas em cima e embaixo
    ctx.save(); ctx.strokeStyle = 'rgba(13,35,64,.05)'; ctx.lineWidth = 1.2;
    for (var j = 0; j < 14; j++) {
      [190, H - 190].forEach(function (y0) {
        ctx.beginPath();
        for (var x = 120; x <= W - 120; x += 8) ctx.lineTo(x, y0 + Math.sin(x / 38 + j * 0.45) * 22 + (j - 7) * 3);
        ctx.stroke();
      });
    }
    ctx.restore();
  }

  function moldura(ctx) {
    // faixa azul com losangos dourados
    var m = 46, f = 30;
    ctx.fillStyle = AZUL; ctx.fillRect(m, m, W - 2 * m, f); ctx.fillRect(m, H - m - f, W - 2 * m, f);
    ctx.fillRect(m, m, f, H - 2 * m); ctx.fillRect(W - m - f, m, f, H - 2 * m);
    ctx.fillStyle = OURO2;
    function los(x, y) { ctx.beginPath(); ctx.moveTo(x, y - 7); ctx.lineTo(x + 7, y); ctx.lineTo(x, y + 7); ctx.lineTo(x - 7, y); ctx.fill(); }
    for (var x = m + 60; x < W - m - 40; x += 46) { los(x, m + f / 2); los(x, H - m - f / 2); }
    for (var y = m + 60; y < H - m - 40; y += 46) { los(m + f / 2, y); los(W - m - f / 2, y); }
    // filetes dourados por dentro
    ctx.strokeStyle = ouro(ctx, 0, 0, W, H); ctx.lineWidth = 7; ctx.strokeRect(96, 96, W - 192, H - 192);
    ctx.lineWidth = 2; ctx.strokeRect(112, 112, W - 224, H - 224);
    // cantos: quadrado girado com arcos
    [[96, 96], [W - 96, 96], [96, H - 96], [W - 96, H - 96]].forEach(function (c) {
      ctx.save(); ctx.translate(c[0], c[1]);
      ctx.fillStyle = AZUL; ctx.strokeStyle = OURO2; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(0, -34); ctx.lineTo(34, 0); ctx.lineTo(0, 34); ctx.lineTo(-34, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = OURO2; ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    });
  }

  function ornamento(ctx, cx, y, larg) {
    ctx.save(); ctx.strokeStyle = OURO; ctx.fillStyle = OURO; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(cx - larg, y); ctx.lineTo(cx - 26, y); ctx.moveTo(cx + 26, y); ctx.lineTo(cx + larg, y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, y - 13); ctx.lineTo(cx + 13, y); ctx.lineTo(cx, y + 13); ctx.lineTo(cx - 13, y); ctx.fill();
    [-1, 1].forEach(function (s) { ctx.beginPath(); ctx.arc(cx + s * (larg + 10), y, 6, 0, Math.PI * 2); ctx.fill(); });
    ctx.restore();
  }

  // medalha dourada com fita (canto inferior direito)
  function medalha(ctx, cx, cy, titulo) {
    ctx.save();
    // fitas
    [[-1, '#0d2340'], [1, '#1f6f3a']].forEach(function (f) {
      ctx.fillStyle = f[1];
      ctx.beginPath(); ctx.moveTo(cx + f[0] * 20, cy + 60); ctx.lineTo(cx + f[0] * 110, cy + 250); ctx.lineTo(cx + f[0] * 70, cy + 228);
      ctx.lineTo(cx + f[0] * 52, cy + 272); ctx.lineTo(cx - f[0] * 30, cy + 80); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = OURO2; ctx.lineWidth = 3; ctx.stroke();
    });
    // estrela serrilhada
    var n = 36, r1 = 158, r2 = 140;
    ctx.beginPath();
    for (var i = 0; i <= n * 2; i++) { var a = i * Math.PI / n, r = i % 2 ? r2 : r1; ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); }
    ctx.fillStyle = ouro(ctx, cx - r1, cy - r1, cx + r1, cy + r1); ctx.shadowColor = 'rgba(90,60,10,.35)'; ctx.shadowBlur = 18; ctx.fill();
    ctx.shadowBlur = 0;
    ctx.beginPath(); ctx.arc(cx, cy, 118, 0, Math.PI * 2); ctx.fillStyle = AZUL; ctx.fill();
    ctx.lineWidth = 5; ctx.strokeStyle = OURO2; ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, 80, 0, Math.PI * 2); ctx.lineWidth = 2; ctx.stroke();
    // texto em volta
    var txt = (titulo || 'MÉRITO POLICIAL DE FRONTEIRA').replace(/^Medalha do\s+/i, '').toUpperCase();
    ctx.font = '700 22px Cinzel'; ctx.fillStyle = OURO2; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    var passo = 0.118, ini = -Math.PI / 2 - (txt.length - 1) * passo / 2;
    for (var k = 0; k < txt.length; k++) {
      ctx.save(); ctx.translate(cx + Math.cos(ini + k * passo) * 99, cy + Math.sin(ini + k * passo) * 99);
      ctx.rotate(ini + k * passo + Math.PI / 2); ctx.fillText(txt[k], 0, 0); ctx.restore();
    }
    // estrela no meio
    ctx.beginPath();
    for (var e = 0; e <= 10; e++) { var ang = -Math.PI / 2 + e * Math.PI / 5, rr = e % 2 ? 26 : 62; ctx.lineTo(cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr); }
    ctx.fillStyle = ouro(ctx, cx - 60, cy - 60, cx + 60, cy + 60); ctx.fill();
    ctx.restore();
  }

  function qr(texto, tam) {
    if (!texto || typeof QRCode === 'undefined') return null;
    var div = document.createElement('div');
    try { new QRCode(div, { text: texto, width: tam, height: tam, colorDark: AZUL, colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.M }); }
    catch (e) { return null; }
    return div.querySelector('canvas');
  }

  var MODELOS = {
    simbolico: async function (ctx, d) {
      var a = d.agraciado || {}, p = d.portaria || {};
      var brasao = await imagem(BRASAO);
      fundo(ctx);
      if (brasao) { // marca-d'água
        ctx.save(); ctx.globalAlpha = 0.055; var mw = 900, mh = mw * brasao.height / brasao.width;
        ctx.drawImage(brasao, (W - mw) / 2, (H - mh) / 2 + 60, mw, mh); ctx.restore();
      }
      moldura(ctx);
      ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      var cx = W / 2;
      if (brasao) { var bh = 180, bw = bh * brasao.width / brasao.height; ctx.drawImage(brasao, cx - bw / 2, 132, bw, bh); }
      ctx.fillStyle = AZUL; ctx.font = '700 34px Cinzel'; esp(ctx, 6);
      ctx.fillText('ESTADO DE RONDÔNIA  ·  POLÍCIA MILITAR', cx, 364);
      ctx.font = '400 30px Cinzel'; esp(ctx, 5);
      ctx.fillText('BATALHÃO DE POLÍCIA DE FRONTEIRA E DIVISAS', cx, 406);

      ctx.font = '700 140px Cinzel'; esp(ctx, 32);
      ctx.save(); ctx.shadowColor = 'rgba(90,60,10,.28)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 4;
      ctx.fillStyle = ouro(ctx, cx - 520, 460, cx + 520, 590); ctx.fillText('DIPLOMA', cx + 16, 572); ctx.restore();
      ctx.fillStyle = AZUL; ctx.font = '700 42px Cinzel'; esp(ctx, 4);
      var tit = (p.titulo || 'Medalha do Mérito Policial de Fronteira').toUpperCase();
      ctx.fillText(tit, cx, 642);
      ornamento(ctx, cx, 676, Math.min(560, ctx.measureText(tit).width / 2 + 40));

      esp(ctx, 0); ctx.fillStyle = TINTA; ctx.font = 'italic 500 44px "Cormorant Garamond"';
      ctx.fillText('O Comandante-Geral da Polícia Militar do Estado de Rondônia confere ' + (a.art && /empresa/i.test(d.grupo || '') ? 'à empresa' : 'a'), cx, 752);

      // nome: posto em dourado em cima, nome grande; diminui até caber
      var y = 818;
      var topo = a.posto || a.trat || '';
      if (topo) { ctx.font = '700 40px Cinzel'; esp(ctx, 6); ctx.fillStyle = OURO3; ctx.fillText(topo.toUpperCase(), cx, y); y += 86; }
      else y += 60;
      var nome = (a.nome || '').toUpperCase(), tam = 96;
      esp(ctx, 3);
      do { ctx.font = '700 ' + tam + 'px Cinzel'; tam -= 2; } while (ctx.measureText(nome).width > 1760 && tam > 52);
      ctx.fillStyle = AZUL; ctx.fillText(nome, cx, y);
      esp(ctx, 0);
      var ln = Math.min(900, ctx.measureText(nome).width / 2 + 60);
      ctx.strokeStyle = ouro(ctx, cx - ln, 0, cx + ln, 0); ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(cx - ln, y + 26); ctx.lineTo(cx + ln, y + 26); ctx.stroke();
      if (a.funcao) { ctx.font = 'italic 500 36px "Cormorant Garamond"'; ctx.fillStyle = '#3c4658'; ctx.fillText(a.funcao, cx, y + 74); y += 40; }

      ctx.font = '500 41px "Cormorant Garamond"'; ctx.fillStyle = TINTA;
      var dt = extenso(p.data), doe = extenso(p.doe_data);
      var corpo = 'a ' + (p.titulo || 'Medalha do Mérito Policial de Fronteira') +
        ', como reconhecimento e recompensa pelos valorosos serviços e contribuições prestados ao Batalhão de Polícia de Fronteira e Divisas, conforme a Portaria nº ' +
        (p.numero || '—') + (dt ? ', de ' + dt : '') + (p.doe ? ', publicada no Diário Oficial do Estado de Rondônia nº ' + p.doe + (doe ? ', de ' + doe : '') : '') + '.';
      var yFim = paragrafo(ctx, corpo, cx, y + 100, 1400, 54);

      var tx = textos(d);
      ctx.font = 'italic 500 40px "Cormorant Garamond"';
      var yData = Math.max(yFim + 82, 1236);
      ctx.fillText(tx.local + ', ' + (extenso(tx.data) || '___ de ____________ de ____') + '.', cx, yData);

      // assinatura
      var ya = Math.max(1388, yData + 128); // texto longo empurra a assinatura
      ctx.font = '400 66px "Great Vibes"'; ctx.fillStyle = 'rgba(13,35,64,.78)';
      var ass = tx.assinante.replace(/^(?:(?:CEL|TEN|MAJ|CAP|QOPM|QOAPM|RR)\s+)+/, '').toLowerCase().replace(/(^|\s)\S/g, function (s) { return s.toUpperCase(); });
      if (ass) ctx.fillText(ass, cx, ya - 26);
      ctx.strokeStyle = AZUL; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx - 380, ya); ctx.lineTo(cx + 380, ya); ctx.stroke();
      ctx.fillStyle = AZUL; ctx.font = '700 30px Cinzel'; esp(ctx, 2);
      ctx.fillText(tx.assinante || 'COMANDANTE-GERAL', cx, ya + 42);
      esp(ctx, 0); ctx.font = '500 32px "Cormorant Garamond"'; ctx.fillStyle = TINTA;
      ctx.fillText(tx.cargo, cx, ya + 82);

      medalha(ctx, W - 318, 1218, p.titulo);

      // QR de conferência (canto inferior esquerdo)
      var q = qr(d.link, 220);
      if (q) {
        ctx.fillStyle = '#fff'; ctx.fillRect(230, 1150, 244, 244);
        ctx.strokeStyle = OURO; ctx.lineWidth = 3; ctx.strokeRect(230, 1150, 244, 244);
        ctx.drawImage(q, 242, 1162, 220, 220);
        ctx.font = '600 22px "Cormorant Garamond"'; ctx.fillStyle = '#3c4658';
        ctx.fillText('Confira a autenticidade', 352, 1424);
        if (a.codigo) { ctx.font = '700 20px Cinzel'; esp(ctx, 3); ctx.fillText(a.codigo.toUpperCase(), 352, 1452); esp(ctx, 0); }
      }
      ctx.font = 'italic 500 22px "Cormorant Garamond"'; ctx.fillStyle = 'rgba(60,70,88,.7)';
      ctx.fillText('Modelo provisório · o diploma oficial da P5 entra no lugar deste', cx, H - 126);
    },

    /* Certificado oficial (CERTIFICADO.cdr). Posições e tamanhos medidos na
       prévia do próprio arquivo do Corel e calibrados com a Calisto MT: com o
       texto padrão, o parágrafo quebra nas mesmas 4 linhas do modelo. */
    certificado: async function (ctx, d) {
      var a = d.agraciado || {}, p = d.portaria || {}, tx = textos(d);
      var fundo = await imagem(FUNDO_CERT);
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, CW, CH);
      if (fundo) ctx.drawImage(fundo, 0, 0, CW, CH);
      var cx = 1237;
      ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';

      // título da medalha (no Corel é texto por cima do fundo)
      var tit = String(p.titulo || 'Medalha do Mérito Policial de Fronteira').trim();
      var mt = /^(medalha|comenda|diploma|láurea|laurea)\s+(d[oa]s?)\s+(.+)$/i.exec(tit);
      var l1 = mt ? (mt[1] + ' ' + mt[2]).toUpperCase() : '', resto = (mt ? mt[3] : tit).toUpperCase();
      ctx.fillStyle = ctx.strokeStyle = '#2a2a2a'; ctx.lineWidth = 1.6; ctx.lineJoin = 'round';
      var grosso = function (t, x, y) { ctx.fillText(t, x, y); ctx.strokeText(t, x, y); }; // no Corel o título é mais encorpado
      if (l1) { ctx.font = '700 51px ' + CALISTO; grosso(l1, cx, 2076); }
      ctx.font = '700 72px ' + CALISTO;
      var lt = quebra(ctx, resto, 1000).map(function (l) { return l.join(' '); }).slice(0, 2);
      if (lt.length === 1) { cabe(ctx, '700', 72, lt[0], 1080, 44); grosso(lt[0], cx, 2200); }
      else lt.forEach(function (l, i) { grosso(l, cx, 2162 + i * 77); });

      // parágrafo: 53 px, justificado entre x 285 e 2190
      var par = tx.paragrafo;
      if (/empresa/i.test(d.grupo || '')) par = par.replace(/a\(o\)\s*Sr\(a\)\.?\s*$/i, 'à empresa');
      var tam = 53, linhas;
      do { ctx.font = '400 ' + tam + 'px ' + CALISTO; linhas = quebra(ctx, par, 1905); tam -= 1; } while (linhas.length > 6 && tam > 40);
      var alt = Math.round(tam * 1.03 + 1);
      ctx.fillStyle = '#1b1b1b';
      justificado(ctx, linhas, 285, 2393, 1905, alt);
      var desce = Math.max(0, linhas.length - 4) * alt; // texto maior empurra o resto (até a linha da assinatura)

      // nome: negrito itálico 59 px (diminui se não couber)
      var nome = ((a.posto ? a.posto + ' ' : '') + (a.nome || '')).toUpperCase().trim();
      ctx.fillStyle = '#000';
      cabe(ctx, 'italic 700', 59, nome, 1905, 36);
      ctx.fillText(nome, cx, 2681 + desce);

      ctx.fillStyle = '#1b1b1b';
      ctx.font = '400 58px ' + CALISTO; ctx.fillText(tx.fecho, cx, 2787 + desce);
      ctx.font = '400 56px ' + CALISTO;
      ctx.fillText(tx.local + ', ' + (extenso(tx.data) || '___ de ____________ de ____'), cx, Math.min(2893 + desce, 3020));

      // assinatura (a linha já vem no fundo, em y 3093)
      ctx.fillStyle = '#111';
      cabe(ctx, '700', 47, tx.assinante, 1300, 32); ctx.fillText(tx.assinante, cx, 3152);
      ctx.font = 'italic 400 49px ' + CALISTO; ctx.fillText(tx.cargo, cx, 3204);
    },
  };
  var TAM = { certificado: { w: CW, h: CH, nome: 'Certificado' }, simbolico: { w: W, h: H, nome: 'Diploma' } };
  function modeloDe(d) { var m = (d && (d.modelo || (d.portaria || {}).modelo)) || 'certificado'; return MODELOS[m] ? m : 'certificado'; }

  async function desenhar(canvas, dados, opt) {
    var m = modeloDe(dados), t = TAM[m], esc = (opt && opt.escala) || 1;
    canvas.width = Math.round(t.w * esc); canvas.height = Math.round(t.h * esc);
    var ctx = canvas.getContext('2d');
    ctx.setTransform(esc, 0, 0, esc, 0, 0);
    await fontes();
    await MODELOS[m](ctx, dados);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    return canvas;
  }

  function nomeArquivo(d) {
    var a = (d && d.agraciado) || {}, p = (d && d.portaria) || {};
    var base = (TAM[modeloDe(d)].nome + ' ' + (a.posto ? a.posto + ' ' : '') + (a.nome || '') + ' - Portaria ' + (p.numero || '') + '-' + (p.ano || ''))
      .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[º°]/g, '').replace(/[^\w\- ]+/g, '').replace(/\s+/g, ' ').trim();
    return base || 'Diploma';
  }

  function salvar(blob, nome) {
    var url = URL.createObjectURL(blob), el = document.createElement('a');
    el.href = url; el.download = nome; document.body.appendChild(el); el.click(); el.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }
  function baixarPNG(canvas, nome) {
    return new Promise(function (ok) { canvas.toBlob(function (b) { salvar(b, nome + '.png'); ok(); }, 'image/png'); });
  }
  var _jspdf = null;
  function carregarJsPDF() {
    if (window.jspdf) return Promise.resolve(window.jspdf);
    if (!_jspdf) _jspdf = new Promise(function (ok, no) {
      var s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
      s.onload = function () { ok(window.jspdf); }; s.onerror = function () { _jspdf = null; no(new Error('Não consegui carregar o gerador de PDF. Confira a internet.')); };
      document.head.appendChild(s);
    });
    return _jspdf;
  }
  var _jszip = null;
  function carregarJSZip() {
    if (window.JSZip) return Promise.resolve(window.JSZip);
    if (!_jszip) _jszip = new Promise(function (ok, no) {
      var s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
      s.onload = function () { ok(window.JSZip); }; s.onerror = function () { _jszip = null; no(new Error('Não consegui carregar o gerador de .zip. Confira a internet.')); };
      document.head.appendChild(s);
    });
    return _jszip;
  }
  // uma página A4 (em pé ou deitada, conforme o canvas) no documento
  function pagina(lib, doc, canvas, qual) {
    var deitado = canvas.width > canvas.height, w = deitado ? 297 : 210, h = deitado ? 210 : 297;
    if (!doc) doc = new lib.jsPDF({ orientation: deitado ? 'landscape' : 'portrait', unit: 'mm', format: 'a4', compress: true });
    else doc.addPage('a4', deitado ? 'landscape' : 'portrait');
    doc.addImage(canvas.toDataURL('image/jpeg', qual), 'JPEG', 0, 0, w, h);
    return doc;
  }
  async function pdfBlob(canvas) {
    var lib = await carregarJsPDF();
    return pagina(lib, null, canvas, 0.93).output('blob');
  }
  async function baixarPDF(canvas, nome) { salvar(await pdfBlob(canvas), nome + '.pdf'); }

  /* LOTE: todos de uma vez, na ordem da lista.
     formato 'pdf' = um PDF só com uma página por agraciado (para imprimir);
     formato 'zip' = um PDF para cada um, numerados na ordem do documento.
     A escala menor (≈200 dpi) segura o tamanho do arquivo: o fundo do
     certificado tem 153 dpi, então não se perde nada. */
  async function lote(itens, op) {
    op = op || {};
    var lib = await carregarJsPDF();
    var zip = op.formato === 'zip' ? new (await carregarJSZip())() : null;
    var cv = document.createElement('canvas'), doc = null, n = itens.length, usados = {};
    for (var i = 0; i < n; i++) {
      if (op.cancelado && op.cancelado()) throw new Error('Cancelado.');
      await desenhar(cv, itens[i], { escala: op.escala || 0.67 });
      if (zip) {
        var nome = String(i + 1).padStart(3, '0') + ' - ' + nomeArquivo(itens[i]);
        if (usados[nome]) nome += ' (' + (++usados[nome]) + ')'; else usados[nome] = 1;
        zip.file(nome + '.pdf', pagina(lib, null, cv, 0.9).output('arraybuffer'));
      } else doc = pagina(lib, doc, cv, 0.88);
      if (op.progresso) op.progresso(i + 1, n);
      await new Promise(function (r) { setTimeout(r, 0); }); // deixa a tela respirar
    }
    if (zip) return zip.generateAsync({ type: 'blob', compression: 'STORE' });
    return doc ? doc.output('blob') : null;
  }

  window.P5Diploma = {
    desenhar: desenhar, baixarPDF: baixarPDF, baixarPNG: baixarPNG, pdfBlob: pdfBlob, nomeArquivo: nomeArquivo, extenso: extenso,
    lote: lote, salvar: salvar, padrao: padrao, textos: textos, temCalisto: temCalisto, modeloDe: modeloDe,
    tamanho: function (m) { return TAM[MODELOS[m] ? m : 'certificado']; }, W: W, H: H,
  };
})();
