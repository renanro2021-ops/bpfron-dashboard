// Histórico de versões. A cada atualização do app: acrescente uma entrada NO TOPO.
// A versão (v) também nomeia o cache offline em sw.js e dispara o aviso de atualização.
var CHANGELOG = [
  { v: 22, nome: '1.5', data: '2026-10-20', notas: [
    'Mapa que gira com a bússola: toque na bússola para alternar entre "norte para cima" e "mapa gira com o rumo" (o rumo do celular fica sempre para cima, como no Avenza)',
    'A escolha fica guardada; no modo que gira, o N da bússola mostra onde está o norte',
    'O seu marcador, as fotos e as setas de direção continuam em pé e corretos com o mapa girado'
  ] },
  { v: 21, nome: '1.4', data: '2026-10-20', notas: [
    'Bússola na tela: a seta mostra para onde o celular aponta, e fica grande com borda vermelha enquanto grava a trilha',
    'O marcador da sua posição ganha um cone de direção, que gira com a bússola mesmo parado',
    'Em movimento (acima de 7 km/h) usa o rumo do GPS e aprende a diferença entre o norte magnético e o verdadeiro; o asterisco (*) indica norte ainda sem calibração',
    'No iPhone, toque na bússola tracejada para ativar o sensor de movimento',
    'O painel do GPS mostra a leitura da bússola e qual norte está sendo usado'
  ] },
  { v: 20, nome: '1.3', data: '2026-10-20', notas: [
    'Painel de GPS: toque no indicador do GPS na barra de cima para ver precisão, altitude (com o ±), velocidade, rumo e há quanto tempo veio a última leitura',
    'Gráfico das últimas leituras de precisão, com o limite de 20 m tracejado',
    'Coordenadas nos três formatos (graus decimais, graus/min/seg e UTM), com botão Copiar',
    'Atalho para marcar com média de leituras direto do painel'
  ] },
  { v: 19, nome: '1.2', data: '2026-10-20', notas: [
    'Marcar na minha posição agora faz a média das melhores leituras do GPS (até 15, no máximo 30 s) e mostra a precisão',
    'Também dá para marcar na hora, sem média ("Marcar agora")',
    'Aviso de "Precisão ruim" quando o GPS está pior que 20 m (só avisa, não bloqueia); o painel do marcador mostra a precisão',
    'Trilha ignora leituras com precisão pior que 50 m e saltos impossíveis do GPS, e informa quantas foram descartadas'
  ] },
  { v: 18, nome: '1.1.1', data: '2026-10-20', notas: [
    'Tela de carregamento ao importar mapa (imagem, GeoTIFF, PDF), importar itens, plotar fotos e exportar (ZIP, GPX, KML, GeoJSON)',
    'Mostra o que está sendo feito, como "Processando foto 2 de 5", e bloqueia toques até terminar'
  ] },
  { v: 17, nome: '1.1', data: '2026-10-20', notas: [
    'Visual novo: ícones limpos, botões de zoom (+ e −) e painel inferior que sobe e desce arrastando',
    'Tema claro, escuro ou automático (Mais > Aparência), lembrado na próxima vez',
    'Toque num marcador ou trilha: destaca no mapa e abre o painel com nome, coordenadas e ações',
    'Barra superior mostra o estado do GPS (buscando, bom, sinal fraco, perdido ou negado)',
    'Legenda dos símbolos e opção de ocultar marcas, fotos, trilhas, linhas e áreas (Mais > Legenda e camadas)',
    'Marcadores novos aparecem com animação; vibração leve ao tocar no Android',
    'Respeita a opção de reduzir animações do aparelho'
  ] },
  { v: 16, nome: '1.0.2', data: '2026-10-19', notas: ['iPhone na vertical: barra de baixo volta ao tamanho normal', 'Mapa se ajusta ao girar o celular e a posição não fica mais fora do centro'] },
  { v: 15, nome: '1.0.1', data: '2026-10-19', notas: ['Barra de baixo menor no iPhone (sobrava espaço em branco embaixo)'] },
  { v: 14, nome: '1.0', data: '2026-10-19', notas: [
    'Versão 1.0 — lançamento no batalhão',
    'Novo ícone e cores do BPFRON, com o brasão na tela inicial',
    'Mapas offline em PDF georreferenciado, GeoTIFF e imagem',
    'Marcas, trilhas, medição e fotos com localização',
    'Compartilhar ou salvar na galeria a foto da marcação; exportar trilha em GPX',
    'Aviso automático quando sai versão nova, com o que mudou'
  ] },
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
