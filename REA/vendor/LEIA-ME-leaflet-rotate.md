# leaflet-rotate (vendorizado)

- Pacote: `leaflet-rotate` 0.2.8 (https://github.com/Raruto/leaflet-rotate), arquivo `dist/leaflet-rotate.js` do npm.
- **Licença: GPL-3.0** (texto em `LICENSE-leaflet-rotate.txt`). Incluído por decisão do responsável (20/10/2026), que pretende
  substituí-lo depois por uma alternativa sem copyleft. Enquanto estiver aqui, distribuir o app (APK, GitHub Pages) implica
  respeitar a GPL-3.0 para o conjunto.
- Verificado antes do uso: pacote baixado em pasta isolada, sem `eval`, `new Function`, `fetch`, `XMLHttpRequest` ou `import()`.
- Única dependência do app nele: `REA/rotate.js` (opções do mapa, `setBearing`/`getBearing` e o evento `rotate`).

## Como trocar
1. Reimplemente em `rotate.js` as 3 coisas que o app usa: `map.setBearing(graus)`, `map.getBearing()` e o evento `rotate`
   (e as opções `rotate`, `touchRotate`, `shiftKeyRotate`, `rotateControl` em `MapRot.options`).
2. Apague `vendor/leaflet-rotate.js`, este arquivo e a licença; tire o `<script>` do `index.html` e do `SHELL` em `sw.js`.
3. Rode `%TEMP%\pw\rot15.js` (testes da rotação) e `v11.js` (regressão do mapa).
