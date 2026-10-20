// PDF georreferenciado (padrão ISO 32000 /VP + /Measure GEO, usado por Avenza, ArcGIS, QGIS).
// Usa pdf.js em vendor/ (worker com handler extra "GetGeoRef"). Devolve PNG + limites lat/lon.
const GeoPdf = (() => {
  const MAX_SIDE = 4096;
  let loading;

  function loadLib() {
    if (window.pdfjsLib) return Promise.resolve();
    return loading ||= new Promise((ok, no) => {
      const s = document.createElement('script'); s.src = 'vendor/pdf.min.js';
      s.onload = () => { pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.js'; ok(); };
      s.onerror = () => { loading = null; no(new Error('não foi possível carregar o leitor de PDF')); };
      document.head.appendChild(s);
    });
  }

  // Mínimos quadrados: v = a*x + b*y + c
  function fitPlane(pts, vals) {
    const A = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], B = [0, 0, 0];
    pts.forEach(([x, y], i) => {
      const r = [x, y, 1];
      for (let j = 0; j < 3; j++) { B[j] += r[j] * vals[i]; for (let k = 0; k < 3; k++) A[j][k] += r[j] * r[k]; }
    });
    // Cramer
    const det = m => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
    const d = det(A); if (Math.abs(d) < 1e-18) throw new Error('pontos de controle degenerados');
    return [0, 1, 2].map(c => det(A.map((row, i) => row.map((v, j) => j === c ? B[i] : v))) / d);
  }

  function findGeo(info) {
    const vps = Array.isArray(info.vp) ? info.vp : info.vp ? [info.vp] : [];
    for (const vp of vps) {
      const m = vp?.Measure;
      if (m?.Subtype === 'GEO' && m.GPTS?.length >= 6 && m.LPTS?.length >= m.GPTS.length) return { bbox: vp.BBox, gpts: m.GPTS, lpts: m.LPTS };
    }
    return null;
  }

  async function read(file) {
    await loadLib();
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    const info = await pdf._transport.messageHandler.sendWithPromise('GetGeoRef', { pageIndex: 0 });
    const g = findGeo(info);
    if (!g) throw new Error(info.lgi ? 'formato de georreferência LGIDict (TerraGo) não suportado' : 'o PDF não tem georreferência');

    const [bx1, by1, bx2, by2] = g.bbox || [0, 0, 1, 1];
    const n = g.gpts.length / 2, px = [], lat = [], lon = [];
    for (let i = 0; i < n; i++) {
      // LPTS são fração do BBox da viewport (origem embaixo à esquerda, como o PDF)
      px.push([bx1 + g.lpts[i * 2] * (bx2 - bx1), by1 + g.lpts[i * 2 + 1] * (by2 - by1)]);
      lat.push(g.gpts[i * 2]); lon.push(g.gpts[i * 2 + 1]);
    }
    const fl = fitPlane(px, lat), fo = fitPlane(px, lon);
    const at = (x, y) => [fl[0] * x + fl[1] * y + fl[2], fo[0] * x + fo[1] * y + fo[2]];

    const page = await pdf.getPage(1);
    const [vx1, vy1, vx2, vy2] = info.view;
    const base = page.getViewport({ scale: 1, rotation: 0 });
    const scale = Math.min(4, MAX_SIDE / Math.max(base.width, base.height));
    const vp = page.getViewport({ scale, rotation: 0 });
    const cv = document.createElement('canvas'); cv.width = Math.ceil(vp.width); cv.height = Math.ceil(vp.height);
    await page.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise;

    const c = [at(vx1, vy1), at(vx2, vy1), at(vx1, vy2), at(vx2, vy2)];
    const bounds = { n: Math.max(...c.map(p => p[0])), s: Math.min(...c.map(p => p[0])), w: Math.min(...c.map(p => p[1])), e: Math.max(...c.map(p => p[1])) };
    const blob = await new Promise(r => cv.toBlob(r, 'image/png'));
    return { blob, bounds, pages: pdf.numPages };
  }

  return { read };
})();
