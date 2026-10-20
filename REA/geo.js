// Cálculos geográficos e formatos de coordenadas (sem dependências).
const Geo = (() => {
  const R = 6371008.8;
  const rad = d => d * Math.PI / 180;

  function dist(a, b) {
    const dLat = rad(b[0] - a[0]), dLon = rad(b[1] - a[1]);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  const pathLength = pts => pts.reduce((s, p, i) => i ? s + dist(pts[i - 1], p) : 0, 0);

  // Área esférica aproximada (m²) de um polígono [lat,lon]
  function area(pts) {
    if (pts.length < 3) return 0;
    let s = 0;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      s += rad(b[1] - a[1]) * (2 + Math.sin(rad(a[0])) + Math.sin(rad(b[0])));
    }
    return Math.abs(s * R * R / 2);
  }

  function bearing(a, b) {
    const y = Math.sin(rad(b[1] - a[1])) * Math.cos(rad(b[0]));
    const x = Math.cos(rad(a[0])) * Math.sin(rad(b[0])) - Math.sin(rad(a[0])) * Math.cos(rad(b[0])) * Math.cos(rad(b[1] - a[1]));
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  }

  function fmtDist(m, units = 'metric') {
    if (units === 'imperial') {
      const ft = m * 3.28084;
      return ft < 1000 ? `${ft.toFixed(0)} ft` : `${(m / 1609.344).toFixed(2)} mi`;
    }
    return m < 1000 ? `${m.toFixed(0)} m` : `${(m / 1000).toFixed(2)} km`;
  }
  function fmtArea(m2, units = 'metric') {
    if (units === 'imperial') return m2 < 4046.86 ? `${(m2 * 10.7639).toFixed(0)} ft²` : `${(m2 / 4046.86).toFixed(2)} ac`;
    return m2 < 10000 ? `${m2.toFixed(0)} m²` : `${(m2 / 10000).toFixed(2)} ha`;
  }

  function dms(v, pos, neg) {
    const h = v >= 0 ? pos : neg; v = Math.abs(v);
    const d = Math.floor(v), mf = (v - d) * 60, m = Math.floor(mf), s = (mf - m) * 60;
    return `${d}°${String(m).padStart(2, '0')}'${s.toFixed(2).padStart(5, '0')}"${h}`;
  }

  // WGS84 -> UTM
  function utm(lat, lon) {
    const a = 6378137, f = 1 / 298.257223563, k0 = 0.9996, e2 = f * (2 - f), ep2 = e2 / (1 - e2);
    const zone = Math.floor((lon + 180) / 6) + 1, lon0 = rad((zone - 1) * 6 - 180 + 3);
    const p = rad(lat), l = rad(lon);
    const N = a / Math.sqrt(1 - e2 * Math.sin(p) ** 2), T = Math.tan(p) ** 2, C = ep2 * Math.cos(p) ** 2, A = Math.cos(p) * (l - lon0);
    const M = a * ((1 - e2 / 4 - 3 * e2 ** 2 / 64 - 5 * e2 ** 3 / 256) * p - (3 * e2 / 8 + 3 * e2 ** 2 / 32 + 45 * e2 ** 3 / 1024) * Math.sin(2 * p)
      + (15 * e2 ** 2 / 256 + 45 * e2 ** 3 / 1024) * Math.sin(4 * p) - (35 * e2 ** 3 / 3072) * Math.sin(6 * p));
    const x = k0 * N * (A + (1 - T + C) * A ** 3 / 6 + (5 - 18 * T + T * T + 72 * C - 58 * ep2) * A ** 5 / 120) + 500000;
    let y = k0 * (M + N * Math.tan(p) * (A * A / 2 + (5 - T + 9 * C + 4 * C * C) * A ** 4 / 24 + (61 - 58 * T + T * T + 600 * C - 330 * ep2) * A ** 6 / 720));
    if (lat < 0) y += 10000000;
    const bands = 'CDEFGHJKLMNPQRSTUVWX', band = lat < -80 || lat > 84 ? '' : bands[Math.floor((lat + 80) / 8)];
    return { zone, band, e: x, n: y };
  }

  const FORMATS = ['dd', 'dms', 'utm'];
  function fmtCoord(lat, lon, fmt = 'dd') {
    if (fmt === 'dms') return `${dms(lat, 'N', 'S')} ${dms(lon, 'E', 'W')}`;
    if (fmt === 'utm') { const u = utm(lat, lon); return `${u.zone}${u.band} ${u.e.toFixed(0)}E ${u.n.toFixed(0)}N`; }
    return `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
  }

  return { dist, pathLength, area, bearing, fmtDist, fmtArea, fmtCoord, FORMATS };
})();
