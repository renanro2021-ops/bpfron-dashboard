// MapaCampo — visualizador de mapas offline com GPS, marcas, trilhas e medição.
const $ = s => document.querySelector(s);
const state = {
  fmt: localStorage.fmt || 'dd', units: localStorage.units || 'metric',
  maps: [], features: [], overlays: {}, layers: {},
  me: null, follow: false, tool: null,
  rec: null,            // trilha em gravação
  measure: [],          // pontos da medição atual
};

// ---------- Mapa base ----------
const map = L.map('map', { zoomControl: false, attributionControl: true }).setView([-15.78, -47.93], 5);
// iPhone: o tamanho da tela muda ao abrir/girar; sem recalcular, o mapa fica descentralizado (a posição aparece fora do lugar)
const fixMapSize = () => map.invalidateSize({ pan: false });
window.addEventListener('resize', fixMapSize); window.addEventListener('orientationchange', () => { fixMapSize(); setTimeout(fixMapSize, 300); setTimeout(fixMapSize, 1000); });
window.visualViewport?.addEventListener('resize', fixMapSize);
window.addEventListener('pageshow', fixMapSize); window.addEventListener('load', () => [100, 600, 1500].forEach(t => setTimeout(fixMapSize, t)));
const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);
const meMarker = L.marker([0, 0], { icon: L.divIcon({ className: '', html: '<div class="me"></div>', iconSize: [18, 18] }), interactive: false });
const meAcc = L.circle([0, 0], { radius: 0, weight: 1, color: '#1a73e8', fillOpacity: .12 });
const measureLayer = L.layerGroup().addTo(map);
const featureLayer = L.layerGroup().addTo(map);
const recLine = L.polyline([], { color: '#c62828', weight: 4 }).addTo(map);

// ---------- Utilidades de UI ----------
const sheet = $('#sheet');
function openSheet(title, html, after) {
  $('#sheet-title').textContent = title; $('#sheet-body').innerHTML = html;
  sheet.hidden = false; after && after($('#sheet-body'));
}
function closeSheet() { sheet.hidden = true; }
$('#sheet-close').onclick = closeSheet;
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const toast = t => { $('#status').textContent = t; clearTimeout(toast.t); toast.t = setTimeout(updateStatus, 2500); };
function updateStatus() {
  $('#status').textContent = state.rec ? `● REC ${Geo.fmtDist(Geo.pathLength(state.rec.pts), state.units)}`
    : state.me ? `±${Math.round(state.me.acc)} m` : '';
}
function setTool(t) {
  state.tool = state.tool === t ? null : t;
  document.querySelectorAll('#toolbar button').forEach(b => b.classList.toggle('active', b.dataset.tool === state.tool));
  $('#measure-info').hidden = state.tool !== 'measure';
  if (state.tool !== 'measure') { state.measure = []; measureLayer.clearLayers(); }
  else renderMeasure();
}

// ---------- Coordenada do centro/cursor ----------
function showCoord(ll) { $('#coord').textContent = Geo.fmtCoord(ll.lat, ll.lng, state.fmt); }
map.on('move', () => showCoord(map.getCenter()));
$('#coord').onclick = () => {
  state.fmt = Geo.FORMATS[(Geo.FORMATS.indexOf(state.fmt) + 1) % Geo.FORMATS.length];
  localStorage.fmt = state.fmt; showCoord(map.getCenter());
};
showCoord(map.getCenter());

// ---------- GPS ----------
// O app só funciona com o GPS ativo: a tela de bloqueio (#gps-gate) fica por cima de tudo até chegar a 1ª posição.
const IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const HOWTO = {
  ios: '<b>iPhone/iPad:</b> Ajustes → Privacidade e Segurança → Serviços de Localização → ligue e, em <b>Safari</b> (ou no app instalado), escolha <b>Ao Usar o App</b> com <b>Localização Precisa</b> ligada.',
  android: '<b>Android (Chrome):</b> toque no cadeado ao lado do endereço → Permissões → Localização → <b>Permitir</b>. Confira também se a Localização do aparelho está ligada.',
};
const howto = () => IOS ? `${HOWTO.ios}<br><br>${HOWTO.android}` : `${HOWTO.android}<br><br>${HOWTO.ios}`;
function showGate(kind) {
  const m = {
    waiting: ['📡', 'Obtendo sua posição…', 'O MapaCampo precisa do GPS para funcionar. Quando o aparelho perguntar, toque em <b>Permitir</b>.'],
    denied: ['🚫', 'Localização bloqueada', `O acesso à localização foi negado. Libere-o para continuar:<br><br>${howto()}`],
    unavailable: ['🛰', 'Sem sinal de GPS', `Não consegui obter sua posição. Vá para um local aberto e confira se a Localização do aparelho está ligada.<br><br>${howto()}`],
    insecure: ['🔒', 'Conexão não segura', 'O GPS só funciona em páginas seguras (HTTPS). Abra o app por um endereço <b>https://</b> ou instale-o na tela inicial.'],
    unsupported: ['⚠️', 'GPS indisponível', 'Este navegador não oferece localização. Use o Chrome (Android) ou o Safari (iPhone).'],
  }[kind];
  $('#gate-icon').textContent = m[0]; $('#gate-title').textContent = m[1]; $('#gate-text').innerHTML = m[2];
  $('#gate-retry').hidden = kind === 'waiting' || kind === 'insecure' || kind === 'unsupported';
  $('#gps-gate').hidden = false;
}
const hideGate = () => { $('#gps-gate').hidden = true; };

let watchId = null;
function startGps() {
  if (watchId !== null) return;
  if (!window.isSecureContext) return showGate('insecure');
  if (!navigator.geolocation) return showGate('unsupported');
  if (!state.me) showGate('waiting');
  watchId = navigator.geolocation.watchPosition(onPos, onGpsError, { enableHighAccuracy: true, maximumAge: 1000, timeout: 20000 });
}
function onGpsError(e) {
  if (e.code === 1) {   // permissão negada (também se for revogada com o app aberto): bloqueia de novo
    state.me = null; meMarker.remove(); meAcc.remove(); showGate('denied');
    navigator.geolocation.clearWatch(watchId); watchId = null;
  } else if (!state.me) showGate('unavailable');   // sem 1ª posição ainda
  else toast('GPS: ' + e.message);                   // já tinha posição: só avisa
}
function retryGps() {
  if (watchId !== null) { navigator.geolocation.clearWatch(watchId); watchId = null; }
  startGps();
}
$('#gate-retry').onclick = retryGps;
// quando o usuário libera a localização nos ajustes, destrava sozinho
navigator.permissions?.query({ name: 'geolocation' }).then(s => { s.onchange = () => s.state !== 'denied' && !state.me && retryGps(); }).catch(() => { });

function onPos(p) {
  const ll = [p.coords.latitude, p.coords.longitude];
  const first = !state.me;
  state.me = { ll, acc: p.coords.accuracy, alt: p.coords.altitude, t: p.timestamp };
  if (first) { hideGate(); map.setView(ll, 16); }
  meMarker.setLatLng(ll).addTo(map); meAcc.setLatLng(ll).setRadius(p.coords.accuracy).addTo(map);
  if (state.follow) map.panTo(ll);
  if (state.rec) {
    const last = state.rec.pts.at(-1);
    if (!last || Geo.dist(last, ll) >= Math.max(3, Math.min(p.coords.accuracy / 2, 15))) {
      state.rec.pts.push([ll[0], ll[1], p.timestamp, p.coords.altitude]);
      recLine.setLatLngs(state.rec.pts.map(q => [q[0], q[1]]));
      saveDraft();
    }
  }
  updateStatus();
}
$('#btn-locate').onclick = () => {
  startGps();
  if (state.me) map.setView(state.me.ll, Math.max(map.getZoom(), 16)); else toast('Aguardando GPS…');
};
$('#btn-follow').onclick = e => {
  startGps(); state.follow = !state.follow; e.currentTarget.classList.toggle('on', state.follow);
  if (state.follow && state.me) map.panTo(state.me.ll);
};
map.on('dragstart', () => { state.follow = false; $('#btn-follow').classList.remove('on'); });

// ---------- Mapas importados (imagem georreferenciada por limites) ----------
async function loadMaps() {
  state.maps = await DB.all('maps');
  for (const m of state.maps) if (m.visible && !state.overlays[m.id]) addOverlay(m);
}
function addOverlay(m) {
  const url = URL.createObjectURL(m.blob);
  const o = L.imageOverlay(url, [[m.s, m.w], [m.n, m.e]], { opacity: m.opacity ?? 1, zIndex: 10 }).addTo(map);
  state.overlays[m.id] = o;
}
function removeOverlay(m) { state.overlays[m.id]?.remove(); delete state.overlays[m.id]; }

function showMaps() {
  const rows = state.maps.map(m => `
    <div class="row" data-id="${m.id}">
      <input type="checkbox" ${state.overlays[m.id] ? 'checked' : ''} data-act="vis">
      <div class="grow"><div class="t">${esc(m.name)}</div><div class="s">${m.n.toFixed(4)}, ${m.w.toFixed(4)} → ${m.s.toFixed(4)}, ${m.e.toFixed(4)}</div>
        <input type="range" min="10" max="100" value="${Math.round((m.opacity ?? 1) * 100)}" data-act="op"></div>
      <button class="btn ghost sm" data-act="go">Ir</button>
      <button class="btn danger sm" data-act="rm">✕</button>
    </div>`).join('') || '<p class="s">Nenhum mapa importado.</p>';
  openSheet('Mapas', `<button class="btn" id="add-map">+ Importar imagem de mapa</button>
    <label style="display:block;margin-top:10px"><input type="checkbox" id="base-vis" ${map.hasLayer(tiles) ? 'checked' : ''}> Mapa base online (OSM)</label>${rows}`, b => {
    b.querySelector('#add-map').onclick = () => $('#file-map').click();
    b.querySelector('#base-vis').onchange = e => e.target.checked ? tiles.addTo(map) : tiles.remove();
    b.querySelectorAll('.row').forEach(r => {
      const m = state.maps.find(x => x.id === r.dataset.id);
      r.querySelector('[data-act=vis]').onchange = async e => {
        m.visible = e.target.checked; e.target.checked ? addOverlay(m) : removeOverlay(m); await DB.put('maps', m);
      };
      r.querySelector('[data-act=op]').oninput = async e => {
        m.opacity = e.target.value / 100; state.overlays[m.id]?.setOpacity(m.opacity); DB.put('maps', m);
      };
      r.querySelector('[data-act=go]').onclick = () => { map.fitBounds([[m.s, m.w], [m.n, m.e]]); closeSheet(); };
      r.querySelector('[data-act=rm]').onclick = async () => {
        if (!confirm(`Remover "${m.name}"?`)) return;
        removeOverlay(m); await DB.del('maps', m.id); state.maps = state.maps.filter(x => x !== m); showMaps();
      };
    });
  });
}

$('#file-map').onchange = async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  let def, blob = f, geoHint = '';
  if (/\.tiff?$/i.test(f.name)) {
    try {
      toast('Lendo GeoTIFF…');
      const g = await GeoTiff.read(f);
      blob = g.blob; def = g.bounds; geoHint = `Limites lidos do GeoTIFF (EPSG:${g.epsg}). Confira e salve.`;
    } catch (err) { return toast('GeoTIFF: ' + err.message); }
  } else if (/\.pdf$/i.test(f.name) || f.type === 'application/pdf') {
    try {
      toast('Lendo PDF…');
      const g = await GeoPdf.read(f);
      blob = g.blob; def = g.bounds; geoHint = 'Limites lidos da georreferência do PDF' + (g.pages > 1 ? ' (só a 1ª página)' : '') + '. Confira e salve.';
    } catch (err) { return toast('PDF: ' + err.message); }
  } else {
    let img;
    try { img = await createImageBitmap(f); } catch { return toast('Imagem inválida ou formato não suportado'); }
    const b = map.getBounds(), c = map.getCenter();
    // Posiciona na vista atual mantendo a proporção da imagem
    const ratio = img.width / img.height;
    const hDeg = (b.getNorth() - b.getSouth()) * .7, wDeg = hDeg * ratio / Math.cos(c.lat * Math.PI / 180);
    def = { n: c.lat + hDeg / 2, s: c.lat - hDeg / 2, w: c.lng - wDeg / 2, e: c.lng + wDeg / 2 };
  }
  const prev = L.imageOverlay(URL.createObjectURL(blob), [[def.s, def.w], [def.n, def.e]], { opacity: .7, zIndex: 11 }).addTo(map);
  if (geoHint) map.fitBounds(prev.getBounds());
  const fld = (k, l) => `<label>${l}</label><input type="text" inputmode="decimal" id="c-${k}" value="${def[k].toFixed(6)}">`;
  openSheet('Georreferenciar mapa', `
    <div class="cal-hint">${geoHint || 'Informe os limites geográficos da imagem (graus decimais). Use as coordenadas dos cantos do mapa impresso.'}</div>
    <label>Nome</label><input type="text" id="c-name" value="${esc(f.name.replace(/\.[^.]+$/, ''))}">
    ${fld('n', 'Norte (lat. do topo)')}${fld('s', 'Sul (lat. da base)')}${fld('w', 'Oeste (lon. da esquerda)')}${fld('e', 'Leste (lon. da direita)')}
    <button class="btn" id="c-prev">Pré-visualizar</button> <button class="btn" id="c-save">Salvar</button>
    <button class="btn ghost" id="c-cancel">Cancelar</button>`, bd => {
    const read = () => Object.fromEntries('nswe'.split('').map(k => [k, parseFloat(bd.querySelector('#c-' + k).value.replace(',', '.'))]));
    const valid = v => Object.values(v).every(Number.isFinite) && v.n > v.s && v.e > v.w && Math.abs(v.n) <= 90 && Math.abs(v.s) <= 90;
    bd.querySelector('#c-prev').onclick = () => { const v = read(); if (!valid(v)) return toast('Limites inválidos'); prev.setBounds([[v.s, v.w], [v.n, v.e]]); map.fitBounds(prev.getBounds()); };
    bd.querySelector('#c-cancel').onclick = () => { prev.remove(); closeSheet(); };
    bd.querySelector('#c-save').onclick = async () => {
      const v = read(); if (!valid(v)) return toast('Limites inválidos');
      prev.remove();
      const m = { id: uid(), name: bd.querySelector('#c-name').value || f.name, blob, ...v, opacity: 1, visible: true };
      await DB.put('maps', m); state.maps.push(m); addOverlay(m); map.fitBounds([[v.s, v.w], [v.n, v.e]]); closeSheet();
    };
  });
};

// ---------- Itens (marcas, trilhas, medições) ----------
async function loadFeatures() {
  state.features = await DB.all('features');
  // migração: versão anterior guardava uma única foto em f.photo/f.thumb
  for (const f of state.features) if (f.photo) {
    f.photos = [{ id: uid(), blob: f.photo, thumb: f.thumb, t: f.t, dir: null, dirRef: null, alt: f.alt ?? null, srcGps: !!f.srcGps }];
    delete f.photo; delete f.thumb; delete f.srcGps; await DB.put('features', f);
  }
  drawFeatures();
}
const CARD = ['N', 'NE', 'L', 'SE', 'S', 'SO', 'O', 'NO'];
const cardinal = d => CARD[Math.round(d / 45) % 8];
// Etiqueta com o nº de fotos: fica no lado oposto à seta de direção para não cobri-la.
const badgePos = dir => {
  const a = ((dir ?? 315) + 180) * Math.PI / 180;
  return `left:${(40 + 30 * Math.sin(a) - 9).toFixed(1)}px;top:${(40 - 30 * Math.cos(a) - 9).toFixed(1)}px;right:auto;bottom:auto`;
};
const hasPhotos = f => f.type === 'point' && f.photos?.length > 0;
const photoDir = f => f.photos.find(p => p.dir != null)?.dir ?? null;
function drawFeatures() {
  featureLayer.clearLayers();
  for (const f of state.features) {
    if (f.hidden) continue;
    if (f.type === 'point') {
      const dir = hasPhotos(f) ? photoDir(f) : null;
      const ic = hasPhotos(f)
        ? L.divIcon({
          className: '', iconSize: [80, 80], iconAnchor: [40, 40],
          html: `<div class="photo-wrap">${dir != null ? `<div class="photo-dir" style="transform:rotate(${dir}deg)"></div>` : ''}` +
            `<div class="photo-pin" style="background-image:url(${thumbUrl(f.photos[0])})"></div>` +
            `${f.photos.length > 1 ? `<span class="photo-count" style="${badgePos(dir)}">${f.photos.length}</span>` : ''}</div>`
        })
        : L.divIcon({ className: '', html: '<div class="pin"></div>', iconSize: [26, 26], iconAnchor: [4, 26] });
      L.marker([f.lat, f.lon], { icon: ic })
        .bindTooltip(esc(f.name)).on('click', () => editFeature(f.id)).addTo(featureLayer);
    } else if (f.type === 'track' || f.type === 'line') {
      L.polyline(f.pts.map(p => [p[0], p[1]]), { color: f.type === 'track' ? '#c62828' : '#6a1b9a', weight: 4 })
        .bindTooltip(esc(f.name)).on('click', () => editFeature(f.id)).addTo(featureLayer);
    } else if (f.type === 'area') {
      L.polygon(f.pts.map(p => [p[0], p[1]]), { color: '#ef6c00', weight: 3 }).bindTooltip(esc(f.name)).on('click', () => editFeature(f.id)).addTo(featureLayer);
    }
  }
}
async function saveFeature(f) {
  await DB.put('features', f);
  const i = state.features.findIndex(x => x.id === f.id);
  i < 0 ? state.features.push(f) : state.features[i] = f; drawFeatures();
}
const thumbUrls = new Map();   // photo.id -> object URL da miniatura
const thumbUrl = p => { if (!thumbUrls.has(p.id)) thumbUrls.set(p.id, URL.createObjectURL(p.thumb)); return thumbUrls.get(p.id); };
const fullUrls = new Map();    // photo.id -> object URL da foto original (só em memória)
const fullUrl = p => { if (!fullUrls.has(p.id)) fullUrls.set(p.id, URL.createObjectURL(p.blob)); return fullUrls.get(p.id); };
function dropUrls(p) {
  for (const m of [thumbUrls, fullUrls]) { if (m.has(p.id)) URL.revokeObjectURL(m.get(p.id)); m.delete(p.id); }
}
const fmtTime = t => new Date(t).toLocaleString('pt-BR');
function featureSummary(f) {
  if (f.type === 'point') return Geo.fmtCoord(f.lat, f.lon, state.fmt) + (hasPhotos(f) ? ` · ${f.photos.length} foto${f.photos.length > 1 ? 's' : ''}` : '');
  if (f.type === 'area') return Geo.fmtArea(Geo.area(f.pts), state.units) + ' · ' + Geo.fmtDist(Geo.pathLength([...f.pts, f.pts[0]]), state.units);
  return Geo.fmtDist(Geo.pathLength(f.pts), state.units) + ` · ${f.pts.length} pts`;
}
const icon = { point: '📍', track: '〰', line: '📏', area: '▱' };

function showFeatures() {
  const rows = [...state.features].reverse().map(f => `
    <div class="row" data-id="${f.id}">
      <input type="checkbox" ${f.hidden ? '' : 'checked'}>
      <div class="grow"><div class="t">${hasPhotos(f) ? '📷' : icon[f.type]} ${esc(f.name)}</div><div class="s">${featureSummary(f)}</div></div>
      <button class="btn ghost sm" data-act="go">Ver</button>
    </div>`).join('') || '<p class="s">Nada ainda. Use Marcar, Trilha ou Medir.</p>';
  openSheet('Itens', rows, b => b.querySelectorAll('.row').forEach(r => {
    const f = state.features.find(x => x.id === r.dataset.id);
    r.querySelector('input').onchange = async e => { f.hidden = !e.target.checked; await saveFeature(f); };
    r.querySelector('[data-act=go]').onclick = () => { focusFeature(f); editFeature(f.id); };
  }));
}
function focusFeature(f) {
  if (f.type === 'point') map.setView([f.lat, f.lon], Math.max(map.getZoom(), 17));
  else map.fitBounds(f.pts.map(p => [p[0], p[1]]), { padding: [40, 40] });
}
function editFeature(id) {
  const f = state.features.find(x => x.id === id); if (!f) return;
  openSheet('Editar item', `
    ${f.type === 'point' ? '<div id="ph"></div>' : ''}
    <div class="s">${hasPhotos(f) ? '📷' : icon[f.type]} ${featureSummary(f)}</div>
    <label>Nome</label><input type="text" id="f-name" value="${esc(f.name)}">
    <label>Notas</label><textarea id="f-notes" rows="3">${esc(f.notes)}</textarea>
    <button class="btn" id="f-save">Salvar</button> <button class="btn ghost" id="f-share">📤 ${f.type === 'point' ? 'Compartilhar local' : 'Compartilhar trilha (GPX)'}</button> <button class="btn danger" id="f-del">Excluir</button>`, b => {
    b.querySelector('#f-share').onclick = () => f.type === 'point' ? sharePoint(f) : shareTrack(f);
    if (f.type === 'point') renderPhotos(b.querySelector('#ph'), f, 0);
    b.querySelector('#f-save').onclick = async () => { f.name = b.querySelector('#f-name').value || f.name; f.notes = b.querySelector('#f-notes').value; await saveFeature(f); closeSheet(); };
    b.querySelector('#f-del').onclick = async () => {
      if (!confirm('Excluir este item?')) return;
      await DB.del('features', f.id); state.features = state.features.filter(x => x !== f);
      for (const p of f.photos || []) dropUrls(p);
      drawFeatures(); closeSheet();
    };
  });
}

// ---------- Compartilhar (WhatsApp, Salvar na galeria, AirDrop…) ----------
const safeName = s => String(s || 'item').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.-]+/g, '_').slice(0, 40);
const mapsLink = (la, lo) => `https://maps.google.com/?q=${la.toFixed(6)},${lo.toFixed(6)}`;
// Abre a folha de compartilhar do aparelho (no iPhone tem 'Salvar imagem'). Se falhar, mostra o motivo e oferece outra saída.
async function shareFile(file, title, text) {
  let err = null;
  if (!navigator.share) err = new Error('este navegador não tem compartilhamento');
  else for (const data of [{ files: [file], title, text }, { files: [file] }]) {   // 2ª tentativa só com o arquivo
    try {
      if (navigator.canShare && !navigator.canShare(data)) { err = new Error('tipo de arquivo não aceito'); continue; }
      await navigator.share(data); return;
    } catch (e) { if (e.name === 'AbortError') return; err = e; }
  }
  const why = err ? (err.name + ': ' + err.message) : '';
  if (file.type.startsWith('image/')) return showImageFallback(file, why);
  alert('Não foi possível abrir o compartilhamento (' + why + '). O arquivo será baixado.');
  const l = document.createElement('a'); l.href = URL.createObjectURL(file); l.download = file.name; l.click();
  setTimeout(() => URL.revokeObjectURL(l.href), 5000);
}
// Última saída para foto: mostra a imagem grande; no iPhone, segurar o dedo nela abre "Salvar em Fotos" / "Compartilhar"
function showImageFallback(file, why) {
  const d = document.createElement('div');
  d.style.cssText = 'position:fixed;inset:0;z-index:3000;background:#000e;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:16px;color:#fff;text-align:center';
  d.innerHTML = '<div style="font-size:15px">Segure o dedo sobre a foto e escolha <b>Salvar em Fotos</b> ou <b>Compartilhar</b></div>'
    + '<img style="max-width:100%;max-height:62%;object-fit:contain;-webkit-touch-callout:default;-webkit-user-select:auto"><div style="font-size:11px;opacity:.7"></div>'
    + '<div><button class="btn" id="fb-menu">Abrir menu de salvar</button> <button class="btn ghost" id="fb-x" style="color:#fff">Fechar</button></div>';
  const img = d.querySelector('img'); img.src = URL.createObjectURL(file);
  d.querySelector('div:nth-of-type(2)').textContent = why ? 'Compartilhar direto falhou: ' + why : file.name;
  d.querySelector('#fb-menu').onclick = () => navigator.share?.({ files: [file] }).catch(() => { });
  d.querySelector('#fb-menu').hidden = !navigator.share;
  d.querySelector('#fb-x').onclick = () => { URL.revokeObjectURL(img.src); d.remove(); };
  document.body.appendChild(d);
}
const photoBase = (f, p) => safeName(f.name) + '_' + new Date(p.t).toISOString().slice(0, 16).replace(/[-:T]/g, '');
// Foto original, como foi tirada (para salvar na galeria)
function photoFile(f, p) {
  const ext = (p.blob.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
  return new File([p.blob], photoBase(f, p) + '.' + ext, { type: p.blob.type || 'image/jpeg' });
}
// Para WhatsApp: lado maior até 2000 px, JPEG. Se não der para reduzir, manda a original.
async function smallPhotoFile(f, p, max = 2000) {
  try {
    const img = await createImageBitmap(p.blob), k = Math.min(1, max / Math.max(img.width, img.height));
    if (k === 1 && p.blob.type === 'image/jpeg') { img.close?.(); return photoFile(f, p); }
    const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); img.close?.();
    const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', .85));
    return blob ? new File([blob], photoBase(f, p) + '.jpg', { type: 'image/jpeg' }) : photoFile(f, p);
  } catch { return photoFile(f, p); }
}
// Prepara a foto reduzida ao abrir a marcação: o iPhone só abre o compartilhar se for logo após o toque, sem esperar processamento
const smallCache = new WeakMap();
function prepShare(f, p) {
  if (smallCache.has(p)) return;
  const e = { file: null }; smallCache.set(p, e);
  smallPhotoFile(f, p).then(x => { e.file = x; });
}
async function sharePhoto(f, p) {
  const file = smallCache.get(p)?.file || await smallPhotoFile(f, p);
  const text = [f.name, fmtTime(p.t), `${f.lat.toFixed(6)}, ${f.lon.toFixed(6)}`, p.dir != null ? `direção ${Math.round(p.dir)}° ${cardinal(p.dir)}` : null, f.notes, mapsLink(f.lat, f.lon)].filter(Boolean).join('\n');
  await shareFile(file, f.name, text);
}
async function shareTrack(f) {
  const file = new File([Export.gpx([f])], safeName(f.name) + '.gpx', { type: 'application/gpx+xml' });
  await shareFile(file, f.name, f.name + (f.notes ? '\n' + f.notes : ''));
}
function sharePoint(f) {
  const text = [f.name, f.notes, `${f.lat.toFixed(6)}, ${f.lon.toFixed(6)}`, mapsLink(f.lat, f.lon)].filter(Boolean).join('\n');
  const copy = () => navigator.clipboard?.writeText(text).then(() => alert('Local copiado. Cole no WhatsApp.'), () => prompt('Copie o texto:', text));
  if (!navigator.share) return copy();
  navigator.share({ title: f.name, text }).catch(e => { if (e.name !== 'AbortError') { alert('Compartilhar falhou (' + e.name + ': ' + e.message + ')'); copy(); } });
}

// Galeria de fotos do marcador: foto grande, dados da foto selecionada e miniaturas.
function renderPhotos(box, f, sel) {
  const ps = f.photos || [];
  sel = Math.min(sel, ps.length - 1);
  const p = ps[sel];
  const full = p && fullUrl(p);
  const info = p && [
    fmtTime(p.t),
    p.dir != null ? `direção ${Math.round(p.dir)}° ${cardinal(p.dir)}${p.dirRef === 'M' ? ' (mag.)' : ''}${p.dirSrc ? ` · ${p.dirSrc}` : ''}` : null,
    p.alt != null ? `${Math.round(p.alt)} m alt.` : null,
    p.srcGps ? 'posição do GPS do app' : null,
  ].filter(Boolean).join(' · ');
  box.innerHTML = `${p ? `<img class="photo-full" src="${full}" alt=""><div class="s" style="margin-bottom:6px">${info}</div>` : ''}
    <div class="gallery">${ps.map((q, i) => `<div class="g ${i === sel ? 'sel' : ''}" data-i="${i}" style="background-image:url(${thumbUrl(q)})"></div>`).join('')}
      <button class="add" data-add="cam" title="Tirar foto">📷</button><button class="add" data-add="gal" title="Adicionar da galeria">🖼</button></div>
    ${p ? '<button class="btn sm" id="ph-share" style="margin-bottom:10px">📤 Compartilhar</button> <button class="btn ghost sm" id="ph-save" style="margin-bottom:10px">💾 Salvar na galeria</button><button class="btn danger sm" id="ph-del" style="margin-bottom:10px">Remover esta foto</button>' : ''}`;
  if (p) prepShare(f, p);
  box.querySelector('#ph-share')?.addEventListener('click', () => sharePhoto(f, p));
  box.querySelector('#ph-save')?.addEventListener('click', () => showImageFallback(photoFile(f, p), ''));
  box.querySelectorAll('.g').forEach(g => g.onclick = () => renderPhotos(box, f, +g.dataset.i));
  box.querySelectorAll('[data-add]').forEach(a => a.onclick = () => {
    state.photoTarget = f.id; startGps();
    $(a.dataset.add === 'cam' ? '#file-photo-cam' : '#file-photo-gal').click();
  });
  box.querySelector('#ph-del')?.addEventListener('click', async () => {
    if (!confirm('Remover esta foto?')) return;
    dropUrls(p);
    f.photos.splice(sel, 1); await saveFeature(f); renderPhotos(box, f, Math.max(0, sel - 1));
  });
}

// ---------- Marcar ----------
function addPoint(ll, name) {
  const n = state.features.filter(f => f.type === 'point').length + 1;
  const f = { id: uid(), type: 'point', name: name || `Marca ${n}`, notes: '', lat: ll.lat, lon: ll.lng, t: Date.now() };
  saveFeature(f).then(() => { toast('Marca salva'); editFeature(f.id); });
}
// ---------- Fotos com coordenadas ----------
async function makeThumb(file, size = 160) {
  const img = await createImageBitmap(file);
  const k = size / Math.min(img.width, img.height), w = Math.round(img.width * k), h = Math.round(img.height * k);
  const c = document.createElement('canvas'); c.width = c.height = size;
  c.getContext('2d').drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
  img.close?.();
  return new Promise(r => c.toBlob(r, 'image/jpeg', .75));
}
// Plota fotos: usa o GPS e a hora do EXIF; na câmera do app, cai para o GPS do aparelho.
const GROUP_M = 10;   // fotos a menos de 10 m uma da outra ficam no mesmo marcador

// iOS: o pedido de bússola abre um aviso que engole o toque da câmera; por isso vai no 1º toque na barra.
document.addEventListener('pointerup', e => { if (e.target.closest('#toolbar')) startCompass(); }, { once: false, capture: true });
// Bússola do aparelho: só serve de alternativa quando a foto não traz direção no EXIF.
let compassOn = false;
function startCompass() {
  if (compassOn || !window.DeviceOrientationEvent) return;
  const on = e => {
    const h = e.webkitCompassHeading ?? (e.absolute && e.alpha != null ? (360 - e.alpha) % 360 : null);
    if (h != null) state.heading = { v: h, t: Date.now() };
  };
  compassOn = true;
  window.addEventListener('deviceorientationabsolute', on, true);
  window.addEventListener('deviceorientation', on, true);
  // iOS só envia eventos depois que o usuário autoriza (precisa vir de um toque)
  try { DeviceOrientationEvent.requestPermission?.().catch(() => { }); } catch { /* sem bússola */ }
}

// Plota fotos: usa GPS, hora e direção do EXIF. Na câmera do app, se faltar GPS, usa o do aparelho.
// `targetId`: acrescenta as fotos a um marcador existente, sem exigir GPS.
async function addPhotos(files, fromCamera, targetId) {
  let ok = 0, noGps = 0, bad = 0, last;
  const target = targetId && state.features.find(x => x.id === targetId);
  for (const file of files) {
    let thumb;
    try { thumb = await makeThumb(file); } catch { bad++; continue; }
    const ex = await Exif.read(file);
    let lat = ex?.lat, lon = ex?.lon, srcGps = false;
    if (lat == null && fromCamera && state.me) { [lat, lon] = state.me.ll; srcGps = true; }
    if (target && lat == null) { lat = target.lat; lon = target.lon; }
    if (lat == null) { noGps++; continue; }
    const t = ex?.time || (fromCamera ? Date.now() : file.lastModified);
    const photo = { id: uid(), blob: file, thumb, t, dir: ex?.dir ?? null, dirRef: ex?.dirRef ?? null, alt: ex?.alt ?? (fromCamera ? state.me?.alt : null) ?? null, srcGps };
    if (photo.dir == null && fromCamera && state.heading && Date.now() - state.heading.t < 15000) { photo.dir = state.heading.v; photo.dirSrc = 'bússola (aprox.)'; }
    let f = target || state.features.find(x => hasPhotos(x) && Geo.dist([x.lat, x.lon], [lat, lon]) <= GROUP_M);
    if (f) f.photos.push(photo);
    else f = { id: uid(), type: 'point', name: 'Foto ' + fmtTime(t), notes: '', lat, lon, t, photos: [photo] };
    if (!f.photos) f.photos = [photo];
    await saveFeature(f); last = f; ok++;
  }
  state.photoTarget = null;
  const parts = [`${ok} foto(s) plotada(s)`];
  if (noGps) parts.push(`${noGps} sem GPS (ignorada${noGps > 1 ? 's' : ''})`);
  if (bad) parts.push(`${bad} ilegível(is)`);
  toast(parts.join(' · '));
  if (last) { focusFeature(last); if (ok === 1 || target) editFeature(last.id); else closeSheet(); }
  if (noGps && !last) noGpsHelp(noGps);
}
const PHOTO_HOWTO = {
  ios: '<b>iPhone:</b> (1) Ajustes → Privacidade e Segurança → Serviços de Localização → <b>Câmera</b> → <b>Ao Usar o App</b>, para as novas fotos já saírem com GPS. (2) Ao escolher fotos já tiradas, toque em <b>Opções</b> (canto inferior do seletor) e ligue <b>Localização</b>; sem isso o iOS remove o GPS da foto.',
  android: '<b>Android:</b> abra a Câmera → Configurações → ligue <b>Etiquetas de local</b> (ou "Salvar local"). Em fotos já tiradas sem isso, o GPS não pode ser recuperado.',
};
function noGpsHelp(n) {
  const order = IOS ? [PHOTO_HOWTO.ios, PHOTO_HOWTO.android] : [PHOTO_HOWTO.android, PHOTO_HOWTO.ios];
  openSheet('Fotos sem coordenadas', `<p><b>${n} foto${n > 1 ? 's' : ''} não ${n > 1 ? 'têm' : 'tem'} GPS gravado</b> e não ${n > 1 ? 'foram plotadas' : 'foi plotada'}.</p>
    <p>${order.join('<br><br>')}</p>
    <p>Ou use <b>Tirar foto</b> aqui no app: ele usa a posição do seu GPS.</p>
    <button class="btn" id="nh-cam">📷 Tirar foto agora</button>`, b => {
    b.querySelector('#nh-cam').onclick = () => { state.photoTarget = null; $('#file-photo-cam').click(); };
  });
}
for (const [id, cam] of [['#file-photo-cam', true], ['#file-photo-gal', false]])
  $(id).onchange = e => { const fs = [...e.target.files]; e.target.value = ''; if (fs.length) addPhotos(fs, cam, state.photoTarget); else state.photoTarget = null; };

function markHere() {
  openSheet('Nova marca', `<button class="btn" id="m-center">No centro do mapa</button>
    <button class="btn" id="m-gps">Na minha posição</button>
    <p><button class="btn" id="m-cam">📷 Tirar foto</button>
    <button class="btn ghost" id="m-gal">🖼 Plotar fotos da galeria</button></p>
    <p class="s">Fotos com GPS no EXIF vão direto para as coordenadas onde foram tiradas. Toque e segure no mapa para marcar um ponto.</p>`, b => {
    b.querySelector('#m-cam').onclick = () => { state.photoTarget = null; startGps(); $('#file-photo-cam').click(); };
    b.querySelector('#m-gal').onclick = () => { state.photoTarget = null; $('#file-photo-gal').click(); };
    b.querySelector('#m-center').onclick = () => addPoint(map.getCenter());
    b.querySelector('#m-gps').onclick = () => state.me ? addPoint({ lat: state.me.ll[0], lng: state.me.ll[1] }) : (startGps(), toast('Aguardando GPS…'));
  });
}
map.on('contextmenu', e => addPoint(e.latlng));

// ---------- Trilha ----------
// Navegador não grava GPS com a tela apagada: mantém a tela acesa e guarda rascunho se o app for fechado.
let wake = null, hiddenAt = 0;
async function holdScreen() { try { wake = await navigator.wakeLock?.request('screen'); } catch { wake = null; } }
function releaseScreen() { try { wake?.release(); } catch { } wake = null; }
function saveDraft() { try { localStorage.setItem('mc-draft', JSON.stringify(state.rec.pts)); } catch { } }
function clearDraft() { try { localStorage.removeItem('mc-draft'); } catch { } }
document.addEventListener('visibilitychange', () => {
  if (!state.rec) return;
  if (document.hidden) hiddenAt = Date.now();
  else { holdScreen(); if (hiddenAt && Date.now() - hiddenAt > 20000) toast('Tela ficou apagada: a trilha pode ter falhas nesse trecho'); hiddenAt = 0; }
});
function setRecUi(on) {
  const btn = document.querySelector('[data-tool=track]');
  btn.classList.toggle('rec', on); btn.lastChild.textContent = on ? 'Parar' : 'Trilha';
}
function resumeDraft() {
  let pts; try { pts = JSON.parse(localStorage.getItem('mc-draft') || 'null'); } catch { }
  if (!Array.isArray(pts) || !pts.length) return;
  if (!confirm('Há uma trilha que estava sendo gravada quando o app foi fechado. Continuar gravando?')) {
    if (pts.length > 1) saveFeature({ id: uid(), type: 'track', name: 'Trilha recuperada ' + new Date(pts[0][2] || Date.now()).toLocaleString('pt-BR'), notes: '', pts, t: Date.now() });
    return clearDraft();
  }
  state.rec = { pts }; setRecUi(true); recLine.setLatLngs(pts.map(q => [q[0], q[1]])); holdScreen(); updateStatus();
}
function toggleTrack() {
  startGps();
  if (!state.rec) {
    state.rec = { pts: [] }; setRecUi(true); holdScreen(); toast('Gravando trilha — mantenha a tela acesa');
    if (state.me) state.rec.pts.push([...state.me.ll, state.me.t, state.me.alt]);
    saveDraft();
  } else {
    const pts = state.rec.pts; state.rec = null; recLine.setLatLngs([]); setRecUi(false); releaseScreen(); clearDraft(); setTimeout(updateBanner);
    if (pts.length < 2) return toast('Trilha muito curta, descartada');
    const f = { id: uid(), type: 'track', name: 'Trilha ' + new Date(pts[0][2] || Date.now()).toLocaleString('pt-BR'), notes: '', pts, t: Date.now() };
    saveFeature(f).then(() => editFeature(f.id));
  }
  updateStatus();
}

// ---------- Medir ----------
map.on('click', e => {
  if (state.tool !== 'measure') return;
  state.measure.push([e.latlng.lat, e.latlng.lng]); renderMeasure();
});
function renderMeasure() {
  measureLayer.clearLayers();
  const p = state.measure;
  p.forEach(q => L.circleMarker(q, { radius: 5, color: '#fff', fillColor: '#6a1b9a', fillOpacity: 1, weight: 2 }).addTo(measureLayer));
  if (p.length > 1) L.polyline(p, { color: '#6a1b9a', weight: 3, dashArray: '6 6' }).addTo(measureLayer);
  const info = $('#measure-info');
  const len = Geo.fmtDist(Geo.pathLength(p), state.units);
  const closed = p.length > 2 ? ` · área ${Geo.fmtArea(Geo.area(p), state.units)}` : '';
  info.innerHTML = p.length ? `${len}${closed} <button class="btn sm" id="ms-undo">↶</button> <button class="btn sm" id="ms-save">Salvar</button>` : 'Toque no mapa para medir';
  if (p.length) {
    info.querySelector('#ms-undo').onclick = e => { e.stopPropagation(); state.measure.pop(); renderMeasure(); };
    info.querySelector('#ms-save').onclick = e => {
      e.stopPropagation();
      const area = p.length > 2 && confirm('Salvar como ÁREA (OK) ou LINHA (Cancelar)?');
      const f = { id: uid(), type: area ? 'area' : 'line', name: (area ? 'Área ' : 'Linha ') + new Date().toLocaleTimeString('pt-BR'), notes: '', pts: p.map(q => [...q]), t: Date.now() };
      saveFeature(f).then(() => { setTool('measure'); editFeature(f.id); });
    };
  }
}

// ---------- Importar / Exportar ----------
const download = (name, text, mime) => {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: mime })); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
};
const xml = s => esc(s).replace(/'/g, '&apos;');
const Export = {
  // names: mapa photo.id -> caminho no ZIP; sem ele as fotos não são listadas
  geojson: (fs, names) => JSON.stringify({
    type: 'FeatureCollection', features: fs.map(f => ({
      type: 'Feature', properties: {
        name: f.name, notes: f.notes, kind: f.type, times: f.type === 'track' ? f.pts.map(p => p[2]) : undefined,
        photos: names && hasPhotos(f) ? f.photos.map(p => ({ file: names[p.id], time: new Date(p.t).toISOString(), direction: p.dir ?? undefined, directionRef: p.dirRef ?? undefined, altitude: p.alt ?? undefined })) : undefined,
      },
      geometry: f.type === 'point' ? { type: 'Point', coordinates: [f.lon, f.lat] }
        : f.type === 'area' ? { type: 'Polygon', coordinates: [[...f.pts, f.pts[0]].map(p => [p[1], p[0]])] }
          : { type: 'LineString', coordinates: f.pts.map(p => p[3] != null ? [p[1], p[0], p[3]] : [p[1], p[0]]) }
    }))
  }, null, 1),
  gpx: fs => `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="MapaCampo" xmlns="http://www.topografix.com/GPX/1/1">\n` +
    fs.map(f => f.type === 'point' ? `<wpt lat="${f.lat}" lon="${f.lon}"><name>${xml(f.name)}</name><desc>${xml(f.notes)}</desc></wpt>`
      : `<trk><name>${xml(f.name)}</name><trkseg>${(f.type === 'area' ? [...f.pts, f.pts[0]] : f.pts).map(p => `<trkpt lat="${p[0]}" lon="${p[1]}">${p[3] != null ? `<ele>${p[3]}</ele>` : ''}${p[2] ? `<time>${new Date(p[2]).toISOString()}</time>` : ''}</trkpt>`).join('')}</trkseg></trk>`).join('\n') + '\n</gpx>',
  kml: fs => `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2"><Document>\n` +
    fs.map(f => `<Placemark><name>${xml(f.name)}</name><description>${xml(f.notes)}</description>` + (f.type === 'point'
      ? `<Point><coordinates>${f.lon},${f.lat}</coordinates></Point>`
      : f.type === 'area' ? `<Polygon><outerBoundaryIs><LinearRing><coordinates>${[...f.pts, f.pts[0]].map(p => `${p[1]},${p[0]}`).join(' ')}</coordinates></LinearRing></outerBoundaryIs></Polygon>`
        : `<LineString><coordinates>${f.pts.map(p => `${p[1]},${p[0]}`).join(' ')}</coordinates></LineString>`) + '</Placemark>').join('\n') + '\n</Document></kml>',
};
const MIME = { geojson: 'application/geo+json', gpx: 'application/gpx+xml', kml: 'application/vnd.google-earth.kml+xml' };

// ZIP com GeoJSON/KML/GPX e as fotos originais em photos/ (o GeoJSON liga cada foto ao arquivo).
async function exportZip() {
  const names = {}, files = [], used = new Set();
  const stamp = t => {   // AAAAMMDD-HHMMSS na hora local
    const d = new Date(t), z = (n, w = 2) => String(n).padStart(w, '0');
    return `${d.getFullYear()}${z(d.getMonth() + 1)}${z(d.getDate())}-${z(d.getHours())}${z(d.getMinutes())}${z(d.getSeconds())}`;
  };
  const safe = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '_').slice(0, 40) || 'foto';
  for (const f of state.features) for (const [i, p] of (f.photos || []).entries()) {
    const ext = { 'image/png': 'png', 'image/webp': 'webp' }[p.blob.type] || 'jpg';
    let n = `photos/${safe(f.name)}_${stamp(p.t)}_${i + 1}.${ext}`;
    while (used.has(n)) n = n.replace(/(\.\w+)$/, '_x$1');
    used.add(n); names[p.id] = n; files.push({ name: n, data: p.blob, date: new Date(p.t) });
  }
  const withNotes = state.features.map(f => hasPhotos(f)
    ? { ...f, notes: [f.notes, 'Fotos: ' + f.photos.map(p => names[p.id]).join(', ')].filter(Boolean).join('\n') } : f);
  files.unshift({ name: 'items.geojson', data: Export.geojson(state.features, names) },
    { name: 'items.kml', data: Export.kml(withNotes) }, { name: 'items.gpx', data: Export.gpx(withNotes) });
  download('mapacampo.zip', await Zip.build(files), 'application/zip');
  toast(`ZIP com ${Object.keys(names).length} foto(s)`);
}

function parseImport(name, text) {
  const out = [], mk = (type, name, pts, extra = {}) => ({ id: uid(), type, name, notes: '', pts, t: Date.now(), ...extra });
  const ext = name.split('.').pop().toLowerCase();
  const num = s => s.trim().split(',').map(Number);
  if (ext === 'geojson' || ext === 'json') {
    const j = JSON.parse(text), fs = j.type === 'FeatureCollection' ? j.features : [j.type === 'Feature' ? j : { geometry: j, properties: {} }];
    for (const g of fs) {
      const geo = g.geometry, nm = g.properties?.name || 'Importado', nt = g.properties?.notes || '';
      if (!geo) continue;
      if (geo.type === 'Point') out.push({ id: uid(), type: 'point', name: nm, notes: nt, lat: geo.coordinates[1], lon: geo.coordinates[0], t: Date.now() });
      else if (geo.type === 'LineString') out.push(mk(g.properties?.kind === 'track' ? 'track' : 'line', nm, geo.coordinates.map(c => [c[1], c[0], null, c[2] ?? null]), { notes: nt }));
      else if (geo.type === 'Polygon') out.push(mk('area', nm, geo.coordinates[0].slice(0, -1).map(c => [c[1], c[0]]), { notes: nt }));
    }
  } else {
    const d = new DOMParser().parseFromString(text, 'text/xml');
    const tx = (el, tag) => el.getElementsByTagName(tag)[0]?.textContent || '';
    if (ext === 'gpx') {
      for (const w of d.getElementsByTagName('wpt')) out.push({ id: uid(), type: 'point', name: tx(w, 'name') || 'Waypoint', notes: tx(w, 'desc'), lat: +w.getAttribute('lat'), lon: +w.getAttribute('lon'), t: Date.now() });
      for (const t of d.getElementsByTagName('trk')) out.push(mk('track', tx(t, 'name') || 'Trilha', [...t.getElementsByTagName('trkpt')].map(p => [+p.getAttribute('lat'), +p.getAttribute('lon'), Date.parse(tx(p, 'time')) || null, tx(p, 'ele') ? +tx(p, 'ele') : null])));
    } else if (ext === 'kml') {
      for (const pm of d.getElementsByTagName('Placemark')) {
        const nm = tx(pm, 'name') || 'Importado', nt = tx(pm, 'description');
        const c = tx(pm, 'coordinates').trim().split(/\s+/).filter(Boolean).map(num);
        if (pm.getElementsByTagName('Point').length) out.push({ id: uid(), type: 'point', name: nm, notes: nt, lat: c[0][1], lon: c[0][0], t: Date.now() });
        else if (pm.getElementsByTagName('Polygon').length) out.push(mk('area', nm, c.slice(0, -1).map(p => [p[1], p[0]]), { notes: nt }));
        else if (c.length > 1) out.push(mk('line', nm, c.map(p => [p[1], p[0]]), { notes: nt }));
      }
    }
  }
  return out.filter(f => f.type === 'point' ? Number.isFinite(f.lat) && Number.isFinite(f.lon) : f.pts.length > 1 && f.pts.every(p => Number.isFinite(p[0]) && Number.isFinite(p[1])));
}
$('#file-import').onchange = async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  try {
    const items = parseImport(f.name, await f.text());
    for (const it of items) await saveFeature(it);
    toast(`${items.length} itens importados`); if (items.length) focusFeature(items[0]);
  } catch (err) { toast('Falha ao importar: ' + err.message); }
};

// ---------- Mais ----------
function showMore() {
  openSheet('Mais', `
    <label>Formato de coordenadas</label>
    <select id="o-fmt"><option value="dd">Graus decimais</option><option value="dms">Graus/min/seg</option><option value="utm">UTM</option></select>
    <label>Unidades</label>
    <select id="o-units"><option value="metric">Métrico</option><option value="imperial">Imperial</option></select>
    <label>Exportar todos os itens</label>
    <div><button class="btn sm" data-x="geojson">GeoJSON</button> <button class="btn sm" data-x="gpx">GPX</button> <button class="btn sm" data-x="kml">KML</button>
      <button class="btn sm" id="o-zip">ZIP + fotos</button></div>
    <p><button class="btn ghost" id="o-news">Novidades (versão ${VERSION_NAME})</button></p>
    <p><button class="btn ghost" id="o-imp">Importar GeoJSON / GPX / KML</button></p>
    <p class="s">Os dados ficam só neste aparelho (IndexedDB). Funciona offline após o primeiro carregamento; os mapas importados não precisam de internet.</p>`, b => {
    b.querySelector('#o-fmt').value = state.fmt; b.querySelector('#o-units').value = state.units;
    b.querySelector('#o-fmt').onchange = e => { state.fmt = localStorage.fmt = e.target.value; showCoord(map.getCenter()); };
    b.querySelector('#o-units').onchange = e => { state.units = localStorage.units = e.target.value; };
    b.querySelectorAll('[data-x]').forEach(x => x.onclick = () => {
      if (!state.features.length) return toast('Nada para exportar');
      download(`mapacampo.${x.dataset.x}`, Export[x.dataset.x](state.features), MIME[x.dataset.x]);
    });
    b.querySelector('#o-zip').onclick = () => state.features.length ? exportZip() : toast('Nada para exportar');
    b.querySelector('#o-news').onclick = () => showChangelog();
    b.querySelector('#o-imp').onclick = () => $('#file-import').click();
  });
}

// ---------- Versões / atualização ----------
const VERSION = CHANGELOG[0].v;
const vname = c => c.nome ?? c.v;   // nome mostrado ao usuário (ex.: 1.0); v é o número usado para comparar
const VERSION_NAME = vname(CHANGELOG[0]);
const notesHtml = list => list.map(c => `<h3 style="margin:12px 0 4px">Versão ${vname(c)} <span class="s">${c.data}</span></h3><ul>${c.notas.map(n => '<li>' + esc(n) + '</li>').join('')}</ul>`).join('');
function showChangelog(list = CHANGELOG, title = 'Novidades') { openSheet(title, notesHtml(list)); }
function checkWhatsNew() {   // 1ª abertura depois de atualizar: mostra o que mudou
  let seen;
  try { seen = +localStorage.getItem('mc-ver') || 0; localStorage.setItem('mc-ver', VERSION); } catch { return; }
  if (seen && seen < VERSION) showChangelog(CHANGELOG.filter(c => c.v > seen), 'App atualizado para a versão ' + VERSION_NAME);
}
let pendingReg = null, reloading = false, wantUpdate = false;
function updateBanner() {
  const bar = $('#upd'); if (!pendingReg) return bar.hidden = true;
  bar.hidden = false; const rec = !!state.rec;
  $('#upd-go').disabled = rec; $('#upd-go').textContent = rec ? 'Pare a trilha para atualizar' : 'Atualizar agora';
}
// Histórico publicado agora (o cache do app ainda tem o antigo): só as versões mais novas que esta
async function remoteNotes() {
  try {
    const t = await (await fetch('changelog.js?n=' + Date.now(), { cache: 'no-store' })).text();
    return new Function(t + ';return CHANGELOG')().filter(c => c.v > VERSION);
  } catch { return null; }
}
async function offerUpdate(reg) {
  pendingReg = reg; updateBanner();
  const nw = await remoteNotes();
  if (nw) { reg.notes = nw; $('#upd-txt').textContent = 'Nova versão ' + (nw[0] ? vname(nw[0]) : '') + ' disponível'; }
}
// Plano B: o iPhone nem sempre percebe sozinho que há versão nova, então confere a versão publicada
async function checkRemote() {
  if (pendingReg) return;
  const nw = await remoteNotes();
  if (nw?.length) { pendingReg = { notes: nw, remote: true }; $('#upd-txt').textContent = 'Nova versão ' + vname(nw[0]) + ' disponível'; updateBanner(); }
}
// Sem service worker novo à espera: limpa o cache do app e recarrega (marcas, trilhas e mapas ficam no IndexedDB)
async function hardRefresh() {
  try { for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister(); } catch { }
  try { for (const k of await caches.keys()) if (k.startsWith('mapacampo-v')) await caches.delete(k); } catch { }
  location.reload();
}
function watchUpdates() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (wantUpdate && !reloading) { reloading = true; location.reload(); } });
  navigator.serviceWorker.register('sw.js').then(reg => {
    const check = () => { reg.update().catch(() => { }); checkRemote(); };
    const track = w => w?.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) offerUpdate(reg); });
    if (reg.waiting && navigator.serviceWorker.controller) offerUpdate(reg);
    reg.addEventListener('updatefound', () => track(reg.installing));
    check(); setInterval(check, 30 * 60 * 1000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
  }).catch(() => { });
}
$('#upd-go').onclick = () => {
  wantUpdate = true;
  if (pendingReg?.waiting) pendingReg.waiting.postMessage('skip'); else hardRefresh();
};
$('#upd-more').onclick = () => showChangelog(pendingReg?.notes?.length ? pendingReg.notes : CHANGELOG, 'O que mudou');
$('#upd-x').onclick = () => { $('#upd').hidden = true; };

// ---------- Barra de ferramentas ----------
document.querySelectorAll('#toolbar button').forEach(b => b.onclick = () => {
  const t = b.dataset.tool;
  if (t !== 'measure' && state.tool === 'measure') setTool('measure');
  if (t === 'maps') showMaps();
  else if (t === 'mark') markHere();
  else if (t === 'track') toggleTrack();
  else if (t === 'measure') { closeSheet(); setTool('measure'); }
  else if (t === 'features') showFeatures();
  else if (t === 'more') showMore();
});

// ---------- Início ----------
(async () => {
  startGps();   // sem GPS o app fica bloqueado pela tela #gps-gate
  await loadMaps(); await loadFeatures(); resumeDraft();
  const last = JSON.parse(localStorage.view || 'null'); if (last && !state.me) map.setView(last.c, last.z);
  map.on('moveend', () => localStorage.view = JSON.stringify({ c: map.getCenter(), z: map.getZoom() }));
  checkWhatsNew();
  watchUpdates();
})();
