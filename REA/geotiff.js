// Leitor mínimo de GeoTIFF: decodifica para PNG e devolve os limites em lat/lon.
// Suporta: 8 bits (cinza, RGB, RGBA, paleta), strips/tiles, sem compressão, LZW, Deflate, PackBits, predictor 2.
// CRS: EPSG:4326 e SIRGAS/WGS84 UTM (326xx, 327xx, 319xx, 311xx), além de Web Mercator (3857).
const GeoTiff = (() => {
  const MAX_SIDE = 4096;

  async function inflate(data) {
    const ds = new DecompressionStream('deflate');
    const w = ds.writable.getWriter(); w.write(data); w.close();
    return new Uint8Array(await new Response(ds.readable).arrayBuffer());
  }

  function lzw(src) {
    const out = []; let dict = [], bits = 9, next = 258, prev = null, buf = 0, nb = 0, p = 0;
    const reset = () => { dict = []; bits = 9; next = 258; prev = null; };
    const entry = c => c < 256 ? [c] : dict[c - 258];
    for (;;) {
      while (nb < bits && p < src.length) { buf = (buf << 8) | src[p++]; nb += 8; }
      if (nb < bits) break;
      const code = (buf >> (nb - bits)) & ((1 << bits) - 1); nb -= bits; buf &= (1 << nb) - 1;
      if (code === 257) break;
      if (code === 256) { reset(); continue; }
      let e;
      if (prev === null) e = entry(code);
      else {
        e = code < next ? entry(code) : prev.concat(prev[0]);
        dict[next++ - 258] = prev.concat(e[0]);
        bits = next >= 2047 ? 12 : next >= 1023 ? 11 : next >= 511 ? 10 : 9;
      }
      for (let i = 0; i < e.length; i++) out.push(e[i]);
      prev = e;
    }
    return Uint8Array.from(out);
  }

  function packbits(src) {
    const out = [];
    for (let i = 0; i < src.length;) {
      const n = src[i++] << 24 >> 24;
      if (n >= 0) { for (let k = 0; k <= n; k++) out.push(src[i++]); }
      else if (n !== -128) { const v = src[i++]; for (let k = 0; k < 1 - n; k++) out.push(v); }
    }
    return Uint8Array.from(out);
  }

  // UTM -> lat/lon (WGS84/SIRGAS2000, diferença irrelevante para sobreposição)
  function utmInv(e, n, zone, south) {
    const a = 6378137, f = 1 / 298.257223563, k0 = .9996, e2 = f * (2 - f), ep2 = e2 / (1 - e2);
    const x = e - 500000, y = south ? n - 1e7 : n;
    const M = y / k0, mu = M / (a * (1 - e2 / 4 - 3 * e2 * e2 / 64 - 5 * e2 ** 3 / 256));
    const e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2));
    const p = mu + (3 * e1 / 2 - 27 * e1 ** 3 / 32) * Math.sin(2 * mu) + (21 * e1 ** 2 / 16 - 55 * e1 ** 4 / 32) * Math.sin(4 * mu) + (151 * e1 ** 3 / 96) * Math.sin(6 * mu);
    const s = Math.sin(p), c = Math.cos(p), t = Math.tan(p);
    const N1 = a / Math.sqrt(1 - e2 * s * s), T1 = t * t, C1 = ep2 * c * c, R1 = a * (1 - e2) / (1 - e2 * s * s) ** 1.5, D = x / (N1 * k0);
    const lat = p - (N1 * t / R1) * (D * D / 2 - (5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * ep2) * D ** 4 / 24 + (61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * ep2 - 3 * C1 * C1) * D ** 6 / 720);
    const lon = (D - (1 + 2 * T1 + C1) * D ** 3 / 6 + (5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * ep2 + 24 * T1 * T1) * D ** 5 / 120) / c;
    return [lat * 180 / Math.PI, (zone * 6 - 183) + lon * 180 / Math.PI];
  }

  function utmZone(epsg) {
    if (epsg >= 32601 && epsg <= 32660) return { zone: epsg - 32600, south: false };
    if (epsg >= 32701 && epsg <= 32760) return { zone: epsg - 32700, south: true };
    if (epsg >= 31965 && epsg <= 31976) return { zone: epsg - 31954, south: false }; // SIRGAS 2000 norte (11N-22N)
    if (epsg >= 31977 && epsg <= 31985) return { zone: epsg - 31960, south: true }; // SIRGAS 2000 sul (17S-25S)
    return null;
  }

  function toLatLon(epsg, x, y) {
    if (epsg === 4326 || epsg === 4674 || epsg === 4269 || epsg === 4618) return [y, x];
    if (epsg === 3857 || epsg === 900913) { const R = 6378137; return [(2 * Math.atan(Math.exp(y / R)) - Math.PI / 2) * 180 / Math.PI, x / R * 180 / Math.PI]; }
    const u = utmZone(epsg); if (u) return utmInv(x, y, u.zone, u.south);
    throw new Error('Sistema de coordenadas EPSG:' + epsg + ' não suportado (use WGS84/SIRGAS ou UTM)');
  }

  async function read(file) {
    const buf = await file.arrayBuffer(), dv = new DataView(buf), u8 = new Uint8Array(buf);
    const le = dv.getUint16(0) === 0x4949;
    if (!le && dv.getUint16(0) !== 0x4d4d) throw new Error('Não é um TIFF');
    if (dv.getUint16(2, le) !== 42) throw new Error('BigTIFF não suportado');
    const SZ = [0, 1, 1, 2, 4, 8, 1, 1, 2, 4, 8, 4, 8];
    const tags = {};
    const ifd = dv.getUint32(4, le), cnt = dv.getUint16(ifd, le);
    for (let i = 0; i < cnt; i++) {
      const o = ifd + 2 + i * 12, tag = dv.getUint16(o, le), type = dv.getUint16(o + 2, le), n = dv.getUint32(o + 4, le);
      const size = (SZ[type] || 1) * n, vo = size <= 4 ? o + 8 : dv.getUint32(o + 8, le), vals = [];
      for (let k = 0; k < n; k++) {
        const q = vo + k * SZ[type];
        vals.push(type === 3 ? dv.getUint16(q, le) : type === 4 ? dv.getUint32(q, le) : type === 12 ? dv.getFloat64(q, le)
          : type === 5 ? dv.getUint32(q, le) / dv.getUint32(q + 4, le) : type === 1 || type === 2 || type === 7 ? dv.getUint8(q) : 0);
      }
      tags[tag] = vals;
    }
    const g = t => tags[t]?.[0];
    const W = g(256), H = g(257), bps = tags[258] || [1], comp = g(259) || 1, photo = g(262), spp = g(277) || 1, pred = g(317) || 1;
    if (!W || !H) throw new Error('TIFF inválido');
    if (bps.some(b => b !== 8)) throw new Error('Só GeoTIFF de 8 bits por canal é suportado');
    if (![1, 5, 8, 32946, 32773].includes(comp)) throw new Error('Compressão TIFF ' + comp + ' não suportada');
    if (!tags[33550] && !tags[34264]) throw new Error('TIFF sem georreferência (não é GeoTIFF)');

    // GeoKeys -> EPSG
    const gk = tags[34735] || []; let epsg = null;
    for (let i = 4; i + 3 < gk.length; i += 4) if (gk[i] === 3072 || (gk[i] === 2048 && epsg === null)) epsg = gk[i + 3];
    if (epsg === null || epsg === 32767) throw new Error('GeoTIFF sem código EPSG');

    // pixel (0,0) -> coordenada do CRS
    let ox, oy, sx, sy;
    if (tags[34264]) { const m = tags[34264]; ox = m[3]; oy = m[7]; sx = m[0]; sy = -m[5]; }
    else { const s = tags[33550], t = tags[33922]; sx = s[0]; sy = s[1]; ox = t[3] - t[0] * sx; oy = t[4] + t[1] * sy; }
    const x0 = ox, x1 = ox + W * sx, y0 = oy, y1 = oy - H * sy;
    const c = [toLatLon(epsg, x0, y0), toLatLon(epsg, x1, y0), toLatLon(epsg, x0, y1), toLatLon(epsg, x1, y1)];
    const bounds = { n: Math.max(...c.map(p => p[0])), s: Math.min(...c.map(p => p[0])), w: Math.min(...c.map(p => p[1])), e: Math.max(...c.map(p => p[1])) };

    // decodificação
    const tiled = !!tags[322], tw = tiled ? g(322) : W, th = tiled ? g(323) : (g(278) || H);
    const offs = tags[tiled ? 324 : 273], lens = tags[tiled ? 325 : 279];
    const planar = g(284) === 2; if (planar && spp > 1) throw new Error('Canais separados (planar) não suportado');
    const raw = new Uint8Array(W * H * spp), across = Math.ceil(W / tw);
    for (let i = 0; i < offs.length; i++) {
      let d = u8.subarray(offs[i], offs[i] + lens[i]);
      if (comp === 5) d = lzw(d); else if (comp === 8 || comp === 32946) d = await inflate(d); else if (comp === 32773) d = packbits(d);
      const bw = tw, rows = tiled ? th : Math.min(th, H - Math.floor(i * th));
      if (pred === 2) for (let r = 0; r < rows; r++) for (let x = spp; x < bw * spp; x++) d[r * bw * spp + x] += d[r * bw * spp + x - spp];
      const bx = tiled ? (i % across) * tw : 0, by = tiled ? Math.floor(i / across) * th : i * th;
      for (let r = 0; r < rows && by + r < H; r++) {
        const w = Math.min(bw, W - bx);
        raw.set(d.subarray(r * bw * spp, r * bw * spp + w * spp), ((by + r) * W + bx) * spp);
      }
    }

    // para RGBA
    const pal = tags[320], rgba = new Uint8ClampedArray(W * H * 4);
    for (let p = 0; p < W * H; p++) {
      let r, gg, b, a = 255; const q = p * spp;
      if (photo === 3 && pal) { const n = 1 << 8; r = pal[raw[q]] >> 8; gg = pal[n + raw[q]] >> 8; b = pal[2 * n + raw[q]] >> 8; }
      else if (spp >= 3) { r = raw[q]; gg = raw[q + 1]; b = raw[q + 2]; if (spp >= 4) a = raw[q + 3]; }
      else { r = gg = b = photo === 0 ? 255 - raw[q] : raw[q]; }
      rgba[p * 4] = r; rgba[p * 4 + 1] = gg; rgba[p * 4 + 2] = b; rgba[p * 4 + 3] = a;
    }
    const full = document.createElement('canvas'); full.width = W; full.height = H;
    full.getContext('2d').putImageData(new ImageData(rgba, W, H), 0, 0);
    let cv = full;
    if (Math.max(W, H) > MAX_SIDE) {
      const k = MAX_SIDE / Math.max(W, H); cv = document.createElement('canvas'); cv.width = Math.round(W * k); cv.height = Math.round(H * k);
      cv.getContext('2d').drawImage(full, 0, 0, cv.width, cv.height);
    }
    const blob = await new Promise(r => cv.toBlob(r, 'image/png'));
    return { blob, bounds, epsg, width: W, height: H };
  }

  return { read };
})();
