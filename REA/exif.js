// Leitor mínimo de EXIF (JPEG): coordenadas GPS, altitude e data/hora da captura.
const Exif = (() => {
  async function read(file) {
    try {
      const v = new DataView(await file.slice(0, 256 * 1024).arrayBuffer());
      if (v.getUint16(0) !== 0xFFD8) return null;
      let o = 2;
      while (o + 4 < v.byteLength) {
        const marker = v.getUint16(o), len = v.getUint16(o + 2);
        if (marker === 0xFFE1 && v.getUint32(o + 4) === 0x45786966) return parseTiff(v, o + 10);
        if ((marker & 0xFF00) !== 0xFF00 || marker === 0xFFDA) break;
        o += 2 + len;
      }
    } catch { /* arquivo sem EXIF legível */ }
    return null;
  }

  function parseTiff(v, base) {
    const le = v.getUint16(base) === 0x4949;
    const u16 = p => v.getUint16(base + p, le), u32 = p => v.getUint32(base + p, le);
    const SIZE = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 };
    const ifd = off => {
      const tags = {}, n = u16(off);
      for (let i = 0; i < n; i++) {
        const e = off + 2 + i * 12, tag = u16(e), type = u16(e + 2), cnt = u32(e + 4);
        const sz = (SIZE[type] || 1) * cnt, vp = sz > 4 ? u32(e + 8) : e + 8;
        let val;
        if (type === 2) { let s = ''; for (let k = 0; k < cnt - 1; k++) s += String.fromCharCode(v.getUint8(base + vp + k)); val = s; }
        else if (type === 5) { val = []; for (let k = 0; k < cnt; k++) val.push(u32(vp + k * 8) / (u32(vp + k * 8 + 4) || 1)); }
        else if (type === 3) { val = []; for (let k = 0; k < cnt; k++) val.push(u16(vp + k * 2)); }
        else if (type === 4) { val = []; for (let k = 0; k < cnt; k++) val.push(u32(vp + k * 4)); }
        else if (type === 1 || type === 7) { val = []; for (let k = 0; k < cnt; k++) val.push(v.getUint8(base + vp + k)); }
        tags[tag] = val;
      }
      return tags;
    };
    const t0 = ifd(u32(4)), out = { lat: null, lon: null, alt: null, time: null, dir: null, dirRef: null };
    const one = a => Array.isArray(a) ? a[0] : a;
    if (t0[0x8769]) {
      const ex = ifd(one(t0[0x8769]));
      const dt = ex[0x9003] || ex[0x9004] || t0[0x0132];
      out.time = parseDate(dt);
    } else out.time = parseDate(t0[0x0132]);
    if (t0[0x8825]) {
      const g = ifd(one(t0[0x8825])), dms = a => a[0] + a[1] / 60 + a[2] / 3600;
      if (g[2] && g[4]) {
        out.lat = dms(g[2]) * (g[1] === 'S' ? -1 : 1);
        out.lon = dms(g[4]) * (g[3] === 'W' ? -1 : 1);
      }
      if (g[6]) out.alt = one(g[6]) * (one(g[5]) === 1 ? -1 : 1);
      // direção para onde a câmera apontava (graus, 0 = norte; 'M' = norte magnético)
      if (g[0x11] && Number.isFinite(one(g[0x11]))) { out.dir = ((one(g[0x11]) % 360) + 360) % 360; out.dirRef = g[0x10] === 'M' ? 'M' : 'T'; }
      // sem data local: usa data/hora UTC do GPS
      if (!out.time && g[29] && g[7]) {
        const [y, m, d] = g[29].split(':').map(Number);
        out.time = Date.UTC(y, m - 1, d, ...g[7].map(Math.floor));
      }
    }
    if (!Number.isFinite(out.lat) || !Number.isFinite(out.lon) || Math.abs(out.lat) > 90 || Math.abs(out.lon) > 180 || (out.lat === 0 && out.lon === 0)) out.lat = out.lon = null;
    return out;
  }

  // "AAAA:MM:DD HH:MM:SS" (hora local do aparelho que tirou a foto)
  function parseDate(s) {
    const m = /^(\d{4}):(\d\d):(\d\d) (\d\d):(\d\d):(\d\d)/.exec(s || '');
    return m ? new Date(+m[1], m[2] - 1, +m[3], +m[4], +m[5], +m[6]).getTime() : null;
  }

  return { read };
})();
