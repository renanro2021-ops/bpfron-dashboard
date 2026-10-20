// Histórico de versões. A cada atualização do app: acrescente uma entrada NO TOPO.
// A versão (v) também nomeia o cache offline em sw.js e dispara o aviso de atualização.
var CHANGELOG = [
  { v: 13, data: '2026-10-19', notas: [
    'Botão Salvar na galeria: abre a foto original em tela cheia (segure o dedo para Salvar em Fotos)',
    'Foto compartilhada pelo WhatsApp agora sai reduzida (até 2000 px), mais leve e rápida de enviar'
  ] },
  { v: 12, data: '2026-10-19', notas: [
    'Compartilhar foto/local/trilha mostra o motivo se falhar e oferece saída alternativa (segurar a foto para salvar)'
  ] },
  { v: 11, data: '2026-10-19', notas: [
    'Corrigido o aviso de nova versão no iPhone'
  ] },
  { v: 10, data: '2026-10-19', notas: [
    'Compartilhar foto: toque na marcação, depois em Compartilhar / salvar foto (WhatsApp, Salvar imagem na galeria, AirDrop)',
    'Compartilhar local da marcação com link do mapa e coordenadas',
    'Compartilhar trilha em arquivo GPX'
  ] },
  { v: 9, data: '2026-10-19', notas: [
    'Aviso de nova versão com a lista do que mudou',
    'Menu inferior não fica mais cortado no iPhone',
    'Câmera volta a abrir no iPhone',
    'Gravação de trilha mantém a tela acesa e recupera a trilha se o app fechar',
    'Importa mapas em GeoTIFF e PDF georreferenciado'
  ] },
  { v: 8, data: '2026-10-19', notas: ['Primeira versão publicada no teste'] }
];
