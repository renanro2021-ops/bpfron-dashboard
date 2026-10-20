// Rode `node stamp.js` antes de publicar: grava a versão do changelog.js na 1ª linha do sw.js.
// O navegador só instala um service worker novo se o próprio sw.js mudar de bytes (o iPhone não confere os arquivos importados).
const fs = require('fs');
const v = new Function(fs.readFileSync(__dirname + '/changelog.js', 'utf8') + ';return CHANGELOG')()[0].v;
let sw = fs.readFileSync(__dirname + '/sw.js', 'utf8');
sw = /^\/\/ build \d+\r?\n/.test(sw) ? sw.replace(/^\/\/ build \d+/, '// build ' + v) : '// build ' + v + '\n' + sw;
fs.writeFileSync(__dirname + '/sw.js', sw);
console.log('sw.js marcado com a versão', v);
