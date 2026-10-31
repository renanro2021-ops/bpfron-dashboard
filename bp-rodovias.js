/* bp-rodovias.js — rodovias BR e RO de Rondônia para TODOS os mapas do site (31/10/2026).
   Nasceu no intel.html e foi levado para o index.html (Mapa e Policiais em Campo) e o drone-aro.html.
   Quais vias são BR vêm do DNIT/SNV (traçado do próprio SNV, ~3 m da estrada) e quais são RO vêm do
   IBGE BC250 2025, encaixadas na estrada real do OpenStreetMap. Arquivo bp-rodovias.json, gerado por
   ferramentas/intel/gerar-rodovias.py. Trecho só planejado não entra; RO que coincide com BR aparece
   uma vez só, como BR. Linha cheia = asfalto, tracejada = terra.
   Visual: halo + contorno escuro + linha + brilho central, largura que cresce com o zoom e placas de
   rodovia (escudo BR, placa RO) espalhadas ao longo da via sem encavalar.

   Uso na página (Leaflet 1.9 já carregado):
     const g = buildRoadLayer(map, 'BR');   // L.layerGroup; preenche sozinho quando o arquivo chega
                                            // (3º argumento { interativo:false } = sem clique/realce)
     map._geoLayers = { br:g, ... }; map._geoOn = { br:true, ... };
     rodLigar(map);                          // engrossa no zoom e refaz as placas a cada movimento
     rodRotular(map);                        // chamar depois de ligar/desligar camada
   Se o .json não carregar, usa o GEO_RODOVIAS antigo da página (se existir). */
const ROD_ARQUIVO = (document.currentScript && document.currentScript.dataset.arquivo) || 'bp-rodovias.json';
(function(){ if (document.getElementById('bp-rod-css')) return; const s = document.createElement('style'); s.id = 'bp-rod-css'; s.textContent = ".rod-ico{background:none!important;border:0!important}\n.rod-halo{filter:blur(2.5px)}\n.rod-esc{display:flex;align-items:center;justify-content:center;font-family:Rajdhani,Inter,sans-serif;color:#111;line-height:1;user-select:none;pointer-events:none}\n.rod-esc b{font-weight:800}\n.rod-esc i{font-style:normal;font-weight:700}\n.rod-esc.br{width:28px;height:30px;margin:0 auto;flex-direction:column;padding-bottom:5px;\n  background:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 28 30'%3E%3Cpath d='M2 2h24v13.5c0 6.8-6.2 10.6-12 12.6C8.2 26.1 2 22.3 2 15.5z' fill='%23fff' stroke='%23161616' stroke-width='1.7'/%3E%3Cpath d='M4.6 9.2h18.8' stroke='%23161616' stroke-width='.9'/%3E%3C/svg%3E\") center/contain no-repeat;\n  filter:drop-shadow(0 0 1.5px rgba(255,138,31,.95)) drop-shadow(0 1px 2px rgba(0,0,0,.8))}\n.rod-esc.br b{font-size:6.5px;letter-spacing:.4px;margin-bottom:2px}\n.rod-esc.br i{font-size:11.5px;letter-spacing:-.2px}\n.rod-esc.ro{height:17px;padding:0 4px;gap:2px;margin:6px auto 0;width:max-content;background:#fff;border:1.5px solid #161616;border-radius:3px;\n  box-shadow:0 0 0 1.5px rgba(42,216,245,.9),0 1px 3px rgba(0,0,0,.8)}\n.rod-esc.ro b{font-size:8px;color:#0e5566}\n.rod-esc.ro i{font-size:11px}\n.rod-esc.g{transform:scale(1.45);transform-origin:center;margin:6px 10px 6px 4px}\n.rod-pop .leaflet-popup-content-wrapper{background:rgba(8,12,22,.94)!important;border:1px solid rgba(255,255,255,.12);border-radius:10px}\n.rod-pop .leaflet-popup-content{margin:9px 13px}\n.rod-pop .leaflet-popup-tip{background:rgba(8,12,22,.94)}\n.rod-pop-in{display:flex;align-items:center;gap:6px}\n.rod-pop-t{font:700 14px Rajdhani,sans-serif;color:#fff;letter-spacing:.3px}\n.rod-pop-s{font-size:12px;color:#cbd5e1}\n.rod-pop-f{font-size:10px;color:#64748b;margin-top:2px}"; document.head.appendChild(s); })();
const ROD = { dados:null, carregando:null, velho:false };
const ROD_COR = { BR:{ cor:'#ff8a1f', luz:'#ffe2c2', halo:'#ff8a1f', casing:'#140800' },
                  RO:{ cor:'#2ad8f5', luz:'#d9fbff', halo:'#2ad8f5', casing:'#00141a' } };
const ROD_CAMADAS = ['halo', 'casing', 'linha', 'terra', 'brilho'];
function rodDecode(arr, esc){
  const out = []; let x = arr[0], y = arr[1]; out.push([y/esc, x/esc]);
  for (let i = 2; i < arr.length; i += 2){ x += arr[i]; y += arr[i+1]; out.push([y/esc, x/esc]); }
  return out;
}
function rodCarregar(){
  if (ROD.carregando) return ROD.carregando;
  ROD.carregando = fetch(ROD_ARQUIVO)
    .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(d => d.rodovias.map(f => ({ ref:f.ref, t:f.t, km:f.km, kmPav:f.pav || 0, fonte:f.fonte || '', coinc:f.coinc || [],
      partes:f.l.map(a => rodDecode(a, d.escala)), pav:f.p || f.l.map(() => 1) })))
    .catch(() => {   // sem o arquivo: usa o traçado antigo embutido, pra camada nunca sumir
      ROD.velho = true;
      if (typeof GEO_RODOVIAS === 'undefined') return [];
      return GEO_RODOVIAS.features.map(f => { const partes = (f.geometry.type === 'LineString' ? [f.geometry.coordinates] : f.geometry.coordinates).map(c => c.map(p => [p[1], p[0]]));
        return { ref:f.properties.ref, t:f.properties.t, km:0, kmPav:0, fonte:'', coinc:[], partes, pav:partes.map(() => 1) }; });
    })
    .then(lst => (ROD.dados = lst));
  return ROD.carregando;
}
// largura da linha por zoom (z6 … z13+)
function rodLarg(z, t){
  const b = t === 'BR' ? [1.5, 1.9, 2.5, 3.1, 3.7, 4.5, 5.4, 6.4] : [1, 1.3, 1.7, 2.2, 2.7, 3.3, 4.1, 4.9];
  return b[Math.max(0, Math.min(b.length - 1, Math.round(z) - 6))];
}
function rodEstilos(z, t){
  const w = rodLarg(z, t), c = ROD_COR[t];
  return {
    halo:  { color:c.halo,   weight:w * 3.4, opacity:t === 'BR' ? .16 : .12, lineCap:'round', lineJoin:'round', className:'rod-halo' },
    casing:{ color:c.casing, weight:w + 2.6, opacity:.82, lineCap:'round', lineJoin:'round' },
    linha: { color:c.cor,    weight:w,       opacity:.97, lineCap:'round', lineJoin:'round' },
    terra: { color:c.cor,    weight:Math.max(1, w * .9), opacity:.97, lineCap:'butt', lineJoin:'round', dashArray:Math.max(3, w * 2.4).toFixed(1) + ' ' + Math.max(2.5, w * 1.6).toFixed(1) },
    brilho:{ color:c.luz,    weight:Math.max(.6, w * .32), opacity:.75, lineCap:'round', lineJoin:'round' },
  };
}
function rodPanes(map){
  if (map._rodPanes) return;
  map.createPane('rodovias').style.zIndex = 395;          // abaixo das marcações (400)
  map.createPane('rodRotulos').style.zIndex = 590;        // placas abaixo dos pinos (600)
  map.getPane('rodRotulos').style.pointerEvents = 'none';
  map._rodRender = L.svg({ pane:'rodovias', padding:.6 });
  if (map.attributionControl) map.attributionControl.addAttribution('Rodovias e rotas © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>');
  map._rodPanes = true;
}
// Grupo de um tipo ('BR' ou 'RO'). Fica vazio até o arquivo chegar e é preenchido sozinho.
// opc.interativo = false: a via não responde a clique (mapa onde o clique marca um ponto, ex. drone-aro)
function buildRoadLayer(map, tipo, opc){
  const interativo = !(opc && opc.interativo === false);
  rodPanes(map);
  const g = L.layerGroup(); g._rodTipo = tipo; g._rodVias = [];
  rodCarregar().then(lista => {
    const z = map.getZoom(), es = rodEstilos(z, tipo);
    lista.filter(r => r.t === tipo).forEach(r => {
      const op = { renderer:map._rodRender, pane:'rodovias', pmIgnore:true, interactive:false, smoothFactor:1.2 };
      const via = { r };
      const asf = r.partes.filter((_, i) => r.pav[i]), terra = r.partes.filter((_, i) => !r.pav[i]);
      const geo = { halo:r.partes, casing:r.partes, linha:asf, terra, brilho:asf };
      ROD_CAMADAS.forEach(k => {
        via[k] = L.polyline(geo[k], Object.assign({}, op, es[k], k === 'casing' && interativo ? { interactive:true, bubblingMouseEvents:true } : {})).addTo(g);
      });
      via.casing.on('mouseover', () => { if (!rodDesenhando(map)) { via.brilho.setStyle({ opacity:1, color:'#ffffff' }); via.halo.setStyle({ opacity:.32 }); } });
      via.casing.on('mouseout',  () => { if (!via.aberta) rodRestaurar(map, via); });
      via.casing.on('click', e => { if (rodDesenhando(map)) return; rodRealcar(map, via, e.latlng); });
      g._rodVias.push(via);
    });
    rodRotular(map);
  });
  return g;
}
function rodDesenhando(map){ try { return !!(map.pm && (map.pm.globalDrawModeEnabled() || map.pm.globalEditModeEnabled())); } catch(e){ return false; } }
function rodRestaurar(map, via){
  const es = rodEstilos(map.getZoom(), via.r.t);
  via.brilho.setStyle(es.brilho); via.halo.setStyle(es.halo);
}
function rodRestyle(map){
  if (!map._geoLayers) return;
  const z = map.getZoom();
  ['br', 'ro'].forEach(k => {
    const g = map._geoLayers[k]; if (!g || !g._rodVias) return;
    const es = rodEstilos(z, g._rodTipo);
    g._rodVias.forEach(v => ROD_CAMADAS.forEach(p => v[p].setStyle(es[p])));
  });
}
function rodEscudo(ref, t, grande){
  const [sig, num] = ref.split('-');
  return `<div class="rod-esc ${t === 'BR' ? 'br' : 'ro'}${grande ? ' g' : ''}"><b>${sig}</b><i>${num}</i></div>`;
}
function rodRealcar(map, via, ll){
  const r = via.r;
  via.aberta = true;
  via.halo.setStyle({ opacity:.42 }); via.brilho.setStyle({ opacity:1, color:'#ffffff' });
  L.popup({ className:'rod-pop', closeButton:false, autoPan:false, offset:[0, -4] })
    .setLatLng(ll)
    .setContent(`<div class="rod-pop-in">${rodEscudo(r.ref, r.t, true)}<div><div class="rod-pop-t">${r.t === 'BR' ? 'Rodovia federal' : 'Rodovia estadual'} ${r.ref}</div>`
      + `<div class="rod-pop-s">${r.km ? r.km.toLocaleString('pt-BR') + ' km em Rondônia · ' + (r.kmPav >= r.km - 1 ? 'toda asfaltada' : r.kmPav ? r.kmPav.toLocaleString('pt-BR') + ' km de asfalto, o resto de terra' : 'estrada de terra') : 'traçado antigo (arquivo novo não carregou)'}</div>`
      + (r.coinc.length ? `<div class="rod-pop-s">No mesmo leito: ${r.coinc.join(', ')}</div>` : '')
      + `<div class="rod-pop-f">${r.fonte ? 'Fonte oficial: ' + r.fonte + ' · ' : ''}traçado sobre a estrada real</div></div></div>`)
    .openOn(map);
  map.once('popupclose', () => { via.aberta = false; rodRestaurar(map, via); });
}
// Placas ao longo das vias visíveis, com distância mínima entre elas (refeito a cada movimento).
function rodRotular(map){
  if (!map || !ROD.dados) return;
  if (!map._rodRot) map._rodRot = L.layerGroup().addTo(map);
  const lg = map._rodRot; lg.clearLayers();
  const on = map._geoOn || {}, z = map.getZoom();
  const tipos = []; if (on.br) tipos.push('BR'); if (on.ro && z >= 7) tipos.push('RO');
  if (!tipos.length) return;
  const sz = map.getSize(), M = 18;
  const passo = z <= 6 ? 300 : z <= 8 ? 250 : z <= 11 ? 230 : 280;
  const postos = []; let total = 0;
  const livre = (p, ref) => postos.every(q => {
    const dx = Math.abs(q.x - p.x), dy = Math.abs(q.y - p.y);
    if (dx < 46 && dy < 40) return false;                                    // encavala
    return !(q.ref === ref && dx * dx + dy * dy < (passo * .75) ** 2);      // mesma via perto demais
  });
  for (const t of tipos){
    for (const r of ROD.dados){
      if (r.t !== t) continue;
      let acum = passo * .45;          // conta a distância pela rodovia inteira (ela vem em vários pedaços)
      for (const parte of r.partes){
        let prev = null;
        for (const ll of parte){
          const p = map.latLngToContainerPoint(ll);
          if (prev){
            acum += prev.distanceTo(p);
            if (acum >= passo){
              if (p.x > M && p.y > M && p.x < sz.x - M && p.y < sz.y - M && livre(p, r.ref)){
                postos.push({ x:p.x, y:p.y, ref:r.ref });
                L.marker(map.containerPointToLatLng(p), { pane:'rodRotulos', interactive:false, keyboard:false, pmIgnore:true,
                  icon:L.divIcon({ className:'rod-ico', html:rodEscudo(r.ref, t), iconSize:[34, 30], iconAnchor:[17, 15] }) }).addTo(lg);
                acum = 0;
                if (++total >= 80) return;
              } else acum = passo * .8;   // tenta de novo um pouco adiante
            }
          }
          prev = p;
        }
      }
    }
  }
}
// liga os eventos do mapa uma vez só: espessura por zoom e placas refeitas a cada movimento
function rodLigar(map){
  if (!map || map._rodLigado) return;
  map._rodLigado = true;
  let tm = null;
  map.on('zoomend', () => rodRestyle(map));
  map.on('moveend zoomend', () => { clearTimeout(tm); tm = setTimeout(() => rodRotular(map), 90); });
  map.on('zoomstart', () => { if (map._rodRot) map._rodRot.clearLayers(); });
}
