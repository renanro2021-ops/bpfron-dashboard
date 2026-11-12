# Simulador DJI

Simulador de drones DJI em 3D para navegador: drones FPV (Avata 2 e DJI FPV) com a tela dos óculos DJI Goggles,
e drones de câmera (Mini 5 Pro, Air 3S e Mavic 4 Pro) com a tela do app DJI Fly.
Fan-made, sem ligação com a DJI.

A versão anterior (cópia do FPV.SkyDive) está guardada em `../fpv-sim-backup-skydive`.

## Como rodar
Dê dois cliques em `iniciar.bat` (precisa do Node.js), ou rode `node serve.js` e abra http://localhost:8080.
O Three.js e as fontes vêm de CDN, então a primeira abertura precisa de internet.
Usa **WebGPU** (Chrome ou Edge atualizados); sem ele, cai para WebGL 2. Qualidade gráfica e TAAU ficam em Configurações › Transmissão.

## Drones
| Drone | Tipo | Modos | Velocidade máx. |
|---|---|---|---|
| DJI Avata 2 | FPV (protetores de hélice) | N / S / M | 8 / 16 / 27 m/s |
| DJI FPV | FPV | N / S / M | 15 / 27 / 39 m/s |
| DJI Mini 5 Pro | Câmera (zoom 1x/2x/4x) | C / N / S | 5 / 12 / 18 m/s |
| DJI Air 3S | Câmera (zoom 1x/3x/6x) | C / N / S | 5 / 12 / 21 m/s |
| DJI Mavic 4 Pro | Câmera (zoom 1x/2,5x/6x) | C / N / S | 5 / 15 / 25 m/s |

Modos C, N e S têm GPS: soltando os sticks o drone freia e fica parado no ar, e a altura é mantida sozinha.
O modo M (só FPV) é manual, sem assistência nenhuma (acro).

## Controles (teclado)
| Tecla | Ação |
|---|---|
| T | decolar / pousar automático (ou segure W no chão) |
| W / S | subir / descer (no modo M: acelerador) |
| A / D | girar |
| ↑ ↓ ← → | mover para frente, trás e lados |
| H | voltar para casa (RTH) · B freio |
| Espaço | liga/desliga os motores no chão · freio no ar |
| M | troca o modo de voo |
| Q / E (ou rodinha) | inclina o gimbal · X centraliza / aponta para baixo |
| F / V | foto / vídeo (vão para o Álbum) |
| 1 2 3 | zoom · K QuickShots (Dronie, Foguete, Círculo, Hélice) |
| C | câmera do drone / 3ª pessoa · R reinicia · Esc pausa |
| G / Z / Enter | criar pista: colocar portão / desfazer / salvar |

Perfis em Configurações › Controle: teclado, teclado + mouse, mouse + teclado e **Movimento** (o mouse imita o
DJI Motion Controller: aponte e segure o botão esquerdo para acelerar, botão direito freia).

Controle de videogame (Mode 2): X liga/decola, Y modo, B freio, RB foto, L3 vídeo, Select RTH, LB câmera,
gatilhos inclinam o gimbal. Rádios em modo joystick USB podem ser calibrados em Configurações › Controle.

## Modos de jogo
Voo livre, Corrida (com fantasma da melhor volta), Missões (coletar pontos e seguir outro drone),
Academia de voo (15 lições: 4 exercícios de stick com o drone parado e 11 de voo, da decolagem ao flip no modo M) e Criar pista.
O Estádio tem um campo de futebol oficial (105 × 68 m) com gols e rede.

## Créditos de terceiros
- Texturas fotográficas (`assets/textures/`): [Poly Haven](https://polyhaven.com), licença CC0.
- Árvores (`js/eztree/`, `assets/trees/`): gerador [ez-tree](https://github.com/dgreenheck/ez-tree) de Daniel Greenheck, licença MIT (ver `js/eztree/LICENSE`), adaptado para WebGPU.
