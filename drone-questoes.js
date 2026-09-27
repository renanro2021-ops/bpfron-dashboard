/* drone-questoes.js — banco de questões + motor de sorteio do simulado do
 * Curso de Drone (CPPSARP), 26/09/2026.
 *
 * Dois bancos:
 *   anac      — conteúdo do exame teórico de piloto remoto da ANAC (RBAC 100,
 *               ICA 100-40, meteorologia, teoria de voo, fatores humanos,
 *               emergências, radiofrequência/ANATEL, cadastro SISANT/SARPAS).
 *   apostilas — só o que está escrito nas 9 apostilas da série (pasta
 *               apostilas/), com o número da apostila em cada questão.
 *
 * Como cada simulado sai diferente: a questão guarda a alternativa CERTA em `c`
 * e uma lista de ERRADAS em `e` (4 a 6 por questão). O motor sorteia quais
 * erradas entram (conforme o nº de alternativas que o aluno pediu) e embaralha a
 * ordem. Ou seja: a mesma questão dificilmente cai com as mesmas alternativas na
 * mesma posição duas vezes — não dá para decorar "a resposta é a letra C".
 *
 * NADA disso passa pelo Worker: o banco é do navegador. Se o gabarito viajasse
 * pela rede, viraria uma chamada que o aluno consegue ler no DevTools. O Worker
 * só recebe o RESULTADO da tentativa (ver bloco CURSO DE DRONE no worker.js).
 *
 * Campos de cada questão:
 *   id    — código único e estável (não renumerar: o histórico grava o id)
 *   tema  — assunto, usado no relatório de desempenho por tema
 *   dif   — 'facil' | 'medio' | 'dificil'
 *   p     — pergunta
 *   c     — alternativa correta
 *   e     — alternativas erradas (plausíveis, nunca absurdas)
 *   exp   — explicação mostrada na correção
 *   fonte — onde conferir (artigo da norma, apostila, seção)
 *   ap    — nº da apostila (só no banco 'apostilas')
 *
 * Para crescer o banco: acrescente objetos nos arrays. O teste
 * testes/drone/teste-questoes.mjs cobra id único, 4+ erradas, explicação e
 * fonte em toda questão — rode ele depois de mexer aqui.
 */
(function (raiz) {
  "use strict";

  /* ======================================================================
   * BANCO 1 — ANAC (exame teórico de piloto remoto)
   * ====================================================================== */
  var QUESTOES_ANAC = [
    /* ---------------- FÁCIL ---------------- */
    {
      id: "AN-001", tema: "Conceitos", dif: "facil",
      p: "No vocabulário da legislação brasileira, o que a sigla UAS designa?",
      c: "O sistema completo: a aeronave, a estação de pilotagem remota, o enlace de comando e controle e os demais equipamentos",
      e: [
        "Apenas a aeronave não tripulada que voa",
        "Apenas a estação de pilotagem remota, de onde o piloto comanda",
        "Somente aeronaves não tripuladas de uso militar",
        "O conjunto de normas da ANAC aplicável a drones",
      ],
      exp: "UA é a aeronave; RPA é a aeronave remotamente pilotada; UAS (Unmanned Aircraft System) é o sistema todo — aeronave + RPS + enlace C2 + demais equipamentos.",
      fonte: "ICA 100-40, art. 7º, LVIII",
    },
    {
      id: "AN-002", tema: "Conceitos", dif: "facil",
      p: "Qual é o significado da sigla VLOS?",
      c: "Linha de visada visual: o piloto ou o observador mantém contato visual direto com a aeronave",
      e: [
        "Voo em linha reta sobre obstáculos",
        "Voo além da linha de visada, guiado só pela tela",
        "Velocidade limite de operação segura",
        "Voo em local sem cobertura de GPS",
      ],
      exp: "VLOS (Visual Line of Sight) é o contato visual direto, sem lentes — só as corretivas são admitidas. Sem contato visual é BVLOS.",
      fonte: "ICA 100-40, art. 7º, XXXV",
    },
    {
      id: "AN-003", tema: "Regulamentação", dif: "facil",
      p: "Qual é a idade mínima para atuar como piloto remoto em operação não recreativa?",
      c: "18 anos",
      e: ["16 anos", "21 anos", "14 anos, com autorização dos pais", "Não há idade mínima, só a aprovação no exame"],
      exp: "O RBAC 100 exige 18 anos. Menor de 18 só em voo recreativo e acompanhado o tempo todo por piloto remoto maior de idade.",
      fonte: "RBAC 100 — requisitos do piloto remoto (Apostila 05)",
    },
    {
      id: "AN-004", tema: "Regulamentação", dif: "facil",
      p: "Qual é a distância horizontal mínima que a aeronave deve manter de pessoas não envolvidas e não anuentes com a operação?",
      c: "30 metros, salvo se houver barreira mecânica suficientemente forte para protegê-las",
      e: [
        "10 metros, em qualquer situação",
        "50 metros, sem exceção",
        "150 metros, sempre",
        "Não há distância mínima: basta o piloto avaliar o risco",
      ],
      exp: "São 30 m horizontais, medidos entre as projeções verticais do drone e da pessoa. A única dispensa é a barreira mecânica.",
      fonte: "RBAC 100 / IS nº E94-003",
    },
    {
      id: "AN-005", tema: "Espaço aéreo", dif: "facil",
      p: "Qual órgão autoriza o acesso de uma aeronave não tripulada ao espaço aéreo brasileiro?",
      c: "O DECEA, por meio do SARPAS",
      e: [
        "A ANAC, por meio do SISANT",
        "A ANATEL, ao homologar o equipamento",
        "A Polícia Federal, nas áreas de fronteira",
        "O comandante da unidade policial, por ordem de serviço",
      ],
      exp: "Cadastro da aeronave é ANAC (SISANT); autorização para usar o espaço aéreo é DECEA (SARPAS). São coisas diferentes, e as duas são obrigatórias.",
      fonte: "ICA 100-40, arts. 19 e 55",
    },
    {
      id: "AN-006", tema: "Cadastro", dif: "facil",
      p: "Em qual sistema a aeronave não tripulada é cadastrada junto à ANAC?",
      c: "SISANT",
      e: ["SARPAS", "RAB", "Mosaico", "AISWEB"],
      exp: "SISANT é o cadastro da aeronave na ANAC; SARPAS é a solicitação de voo no DECEA; Mosaico é a homologação na ANATEL; AISWEB é informação aeronáutica.",
      fonte: "Apostila 04, seção 9",
    },
    {
      id: "AN-007", tema: "Regulamentação", dif: "facil",
      p: "Qual é a altura máxima, em regra, da categoria aberta de operação?",
      c: "120 metros (400 pés) AGL",
      e: ["60 metros (200 pés) AGL", "150 metros (500 pés) AGL", "300 metros (1.000 pés) AGL", "A altura do obstáculo mais alto da área"],
      exp: "Categoria aberta: até 400 ft (120 m) AGL. Na operação recreativa o limite cai para 200 ft (60 m).",
      fonte: "ICA 100-40, art. 38; RBAC 100, 100.5(a)(1)",
    },
    {
      id: "AN-008", tema: "Emergências", dif: "facil",
      p: "O que faz a função RTH de um drone?",
      c: "Traz a aeronave automaticamente de volta ao ponto de decolagem registrado",
      e: [
        "Desliga os motores imediatamente para evitar dano a terceiros",
        "Mantém a aeronave pairando no mesmo ponto até a bateria acabar",
        "Aumenta a potência do enlace de rádio para recuperar o sinal",
        "Grava o vídeo do voo na memória interna da aeronave",
      ],
      exp: "RTH (Return to Home) é o regresso a casa: a aeronave sobe até a altura programada e volta ao home point. É a mitigação clássica da perda de enlace.",
      fonte: "ICA 100-40, art. 7º, LV",
    },
    {
      id: "AN-009", tema: "Fatores humanos", dif: "facil",
      p: "Um piloto remoto que tomou medicamento com efeito sedativo pode assumir o comando do voo?",
      c: "Não: é vedado operar sob efeito de substância que reduza a capacidade psicofísica, inclusive medicamento",
      e: [
        "Sim, desde que a dose tenha sido prescrita por médico",
        "Sim, se houver um observador acompanhando o voo",
        "Sim, desde que o voo seja em VLOS e abaixo de 30 metros",
        "Sim, desde que o comandante da operação autorize por escrito",
      ],
      exp: "A regra é tolerância zero, e não é só sobre álcool e drogas: medicamento e falta de sono entram na mesma conta. O operador responde por colocar o piloto em condições de voar.",
      fonte: "RBAC 100 — requisitos do piloto (Apostila 05, seção 5)",
    },
    {
      id: "AN-010", tema: "Regulamentação", dif: "facil",
      p: "Quantas aeronaves um piloto remoto pode operar ao mesmo tempo?",
      c: "Uma só, salvo autorização específica da ANAC",
      e: [
        "Até duas, se estiverem na mesma área de operação",
        "Até três, se houver um observador para cada aeronave",
        "Quantas quiser, desde que em VLOS",
        "Duas, sendo uma delas obrigatoriamente automatizada",
      ],
      exp: "A regra da proporção é 1 piloto : 1 aeronave. Show de enxame (swarm) sem autorização da ANAC é irregular no Brasil.",
      fonte: "RBAC 100 (Apostila 05, seção 6)",
    },
    {
      id: "AN-011", tema: "Meteorologia", dif: "facil",
      p: "O piloto pode iniciar a operação sob chuva, nevoeiro ou vento acima do tolerado pela aeronave?",
      c: "Não: a norma proíbe operar em condição que coloque a operação em risco",
      e: [
        "Pode, se a aeronave tiver classificação de resistência à água",
        "Pode, desde que reduza a altura para 30 metros",
        "Pode, se a missão for de segurança pública",
        "Pode, com autorização verbal do comandante da operação",
      ],
      exp: "O art. 27 veda operar sob precipitação, vento, nevoeuro ou qualquer condição que ponha a operação em risco — e quem decide no local é o piloto em comando.",
      fonte: "ICA 100-40, art. 27",
    },
    {
      id: "AN-012", tema: "Conceitos", dif: "facil",
      p: "O que significa PMD?",
      c: "Peso máximo de decolagem: o peso máximo com que a aeronave pode decolar e voar com segurança",
      e: [
        "O peso da aeronave vazia, informado pelo fabricante",
        "O peso máximo de carga que pode ser lançada em voo",
        "A pressão média de decolagem exigida pelos motores",
        "O peso da aeronave somado ao da estação de pilotagem",
      ],
      exp: "PMD não é o peso do drone: inclui combustível, cargas, equipamentos e acessórios. É por isso que um protetor de hélice pode tirar um 'mini' de 249 g da faixa dos 250 g.",
      fonte: "ICA 100-40, art. 7º, XLIX; art. 38, §1º",
    },
    {
      id: "AN-013", tema: "Espaço aéreo", dif: "facil",
      p: "O que é uma FRZ?",
      c: "Zona de Restrição de Voo: espaço aéreo em que o voo de aeronave não tripulada é restringido conforme certas condições",
      e: [
        "Zona de recarga rápida de baterias em operações longas",
        "Faixa de radiofrequência reservada ao enlace de comando",
        "Zona proibida definida pelo fabricante no software do drone",
        "Área de responsabilidade exclusiva da Polícia Federal",
      ],
      exp: "FRZ (Flight Restriction Zone) é da norma do DECEA. A zona bloqueada pelo fabricante no software é a NFZ — coisa diferente, e não substitui a norma.",
      fonte: "ICA 100-40, art. 7º, LXV e LXVI",
    },
    {
      id: "AN-014", tema: "Fatores humanos", dif: "facil",
      p: "Numa equipe de três (piloto, observador e segurança), qual é a função do observador?",
      c: "Manter contato visual com a aeronave e vigiar o entorno, avisando o piloto de tráfego, obstáculos e pessoas",
      e: [
        "Pilotar a aeronave quando o piloto estiver cansado",
        "Registrar as imagens e operar a câmera durante o voo",
        "Cuidar da documentação e do preenchimento do SARPAS",
        "Isolar o perímetro e afastar curiosos da área de decolagem",
      ],
      exp: "O piloto costuma estar olhando a tela; o observador olha o drone e o céu. Isolar o perímetro é do policial de segurança da equipe.",
      fonte: "ICA 100-40, art. 7º, XXXVI e art. 24",
    },
    {
      id: "AN-015", tema: "Radiofrequência", dif: "facil",
      p: "Qual órgão é responsável por homologar (certificar) o equipamento de radiofrequência do drone no Brasil?",
      c: "ANATEL",
      e: ["ANAC", "DECEA", "Ministério da Defesa", "INMETRO"],
      exp: "ANATEL cuida do espectro e da homologação do transmissor; ANAC, da aeronave e do piloto; DECEA, do espaço aéreo.",
      fonte: "ICA 100-40, art. 3º; Lei 9.472/1997",
    },
    {
      id: "AN-016", tema: "Regulamentação", dif: "facil",
      p: "A operação totalmente autônoma, em que o piloto não pode intervir durante o voo, é permitida no Brasil?",
      c: "Não: a aeronave autônoma não é autorizada a acessar o espaço aéreo brasileiro",
      e: [
        "Sim, desde que a rota seja programada antes da decolagem",
        "Sim, para órgãos de segurança pública em operação especial",
        "Sim, desde que a aeronave tenha menos de 25 kg",
        "Sim, em área confinada e sem terceiros por perto",
      ],
      exp: "Autônoma (sem possibilidade de intervenção) é vedada. Automatizada — rota programada em que o piloto pode intervir em qualquer fase — é permitida.",
      fonte: "ICA 100-40, art. 19, §2º; art. 7º, VIII e XXXIX",
    },
    {
      id: "AN-017", tema: "Espaço aéreo", dif: "facil",
      p: "Ao perceber a aproximação de uma aeronave tripulada, qual é a conduta correta do piloto remoto?",
      c: "Encerrar imediatamente a operação, dando prioridade à aeronave tripulada",
      e: [
        "Manter a altura e acender as luzes de navegação para ser visto",
        "Subir acima da aeronave tripulada para sair da rota dela",
        "Continuar o voo se a operação policial estiver em andamento",
        "Chamar a torre no rádio e aguardar orientação antes de descer",
      ],
      exp: "A regra é 'baixa, não testa': a aeronave tripulada tem prioridade absoluta, mesmo civil, mesmo em operação policial sensível.",
      fonte: "ICA 100-40, art. 36",
    },
    {
      id: "AN-018", tema: "Emergências", dif: "facil",
      p: "O que é fly-away?",
      c: "A perda do enlace C2 em que a aeronave deixa de ser controlada e também não executa os procedimentos pré-programados como previsto",
      e: [
        "Qualquer perda momentânea do sinal entre controle e aeronave",
        "O retorno automático da aeronave ao ponto de decolagem",
        "A decolagem sem autorização de acesso ao espaço aéreo",
        "O voo acima da altura autorizada na solicitação",
      ],
      exp: "Se o enlace cai e o RTH funciona, houve falha de enlace — o RTH evitou o fly-away. Fly-away é quando nem o piloto comanda nem o pré-programado acontece.",
      fonte: "ICA 100-40, art. 7º, XXXIII e XXXIV",
    },
    {
      id: "AN-019", tema: "Cadastro", dif: "facil",
      p: "Uma aeronave com PMD de até 250 g precisa de autorização de acesso ao espaço aéreo?",
      c: "Sim: o DECEA exige autorização inclusive para UA com PMD de até 250 g",
      e: [
        "Não: até 250 g é dispensada de tudo",
        "Não, desde que voe abaixo de 30 metros",
        "Só se for operada por órgão público",
        "Só em área urbana",
      ],
      exp: "A 'liberdade do subdrone' vale para a ANAC (fora do RBAC 100 em VLOS até 120 m), não para o DECEA — e o SARPAS só aceita aeronave com número SISANT.",
      fonte: "ICA 100-40, art. 19, §4º",
    },
    {
      id: "AN-020", tema: "Teoria de voo", dif: "facil",
      p: "Por que o vento de proa (contra) exige atenção especial no cálculo de autonomia?",
      c: "Porque a volta contra o vento consome muito mais bateria do que o trecho de ida a favor",
      e: [
        "Porque o vento de proa reduz a sustentação e derruba a aeronave",
        "Porque o vento de proa desativa o sistema de visão dianteiro",
        "Porque a bússola perde calibração com vento constante",
        "Porque o vento de proa aumenta o alcance do enlace de rádio",
      ],
      exp: "Sair a favor do vento é fácil e engana: o retorno é contra, mais lento e mais caro em bateria. A autonomia tem que ser calculada pelo pior trecho.",
      fonte: "ICA 100-40, art. 73, IV (autonomia no planejamento)",
    },
    {
      id: "AN-021", tema: "Documentação", dif: "facil",
      p: "Uma assinatura 'digitalizada' (assinar no papel, fotografar e colar no PDF) é válida para a ARO?",
      c: "Não: a assinatura precisa ser digital, com código de verificação, como a do gov.br",
      e: [
        "Sim, desde que a foto esteja legível",
        "Sim, se o documento for rubricado em todas as folhas",
        "Sim, se houver testemunha assinando também",
        "Sim, quando a operação for de urgência",
      ],
      exp: "Digital (verificável, com QR Code/conferência no site) vale; digitalizada (foto da assinatura) não serve.",
      fonte: "Apostila 06, seção 9",
    },
    {
      id: "AN-022", tema: "Regulamentação", dif: "facil",
      p: "Em regra, o transporte de pessoas e animais por aeronave não tripulada é:",
      c: "Proibido pelo RBAC 100",
      e: [
        "Permitido para animais de pequeno porte",
        "Permitido em operações de resgate",
        "Permitido com autorização do operador da aeronave",
        "Permitido desde que o PMD não passe de 25 kg",
      ],
      exp: "O RBAC 100 proíbe transportar pessoas, animais e artigos perigosos, com exceções (agricultura/pecuária, baterias de lítio do próprio equipamento, operações estatais, equipamentos de bordo e o que a ANAC autorizar).",
      fonte: "RBAC 100 (Apostila 05, seção 10)",
    },
    {
      id: "AN-023", tema: "Espaço aéreo", dif: "facil",
      p: "Qual é o limite de altura da operação recreativa?",
      c: "200 pés (60 metros) AGL, com até 300 metros de distância horizontal",
      e: [
        "400 pés (120 metros) AGL, como na categoria aberta",
        "100 pés (30 metros) AGL, com até 100 metros de distância",
        "500 pés (150 metros) AGL, em área desabitada",
        "Não há limite: o voo recreativo é dispensado de regra de altura",
      ],
      exp: "Recreativo é mais restrito que a categoria aberta: 60 m de altura e 300 m de distância horizontal.",
      fonte: "ICA 100-40, art. 32",
    },
    {
      id: "AN-024", tema: "Conceitos", dif: "facil",
      p: "O que é o enlace C2?",
      c: "O enlace de comando e controle entre a aeronave e a estação de pilotagem remota",
      e: [
        "O canal de vídeo que leva a imagem da câmera ao piloto",
        "A conexão da estação de pilotagem com a internet",
        "O cabo que liga o controle ao celular ou tablet",
        "A ligação entre o piloto e o órgão de controle de tráfego aéreo",
      ],
      exp: "C2 (Command and Control) é o enlace que gerencia o voo. O vídeo é o downlink — importante, mas não é o C2.",
      fonte: "ICA 100-40, art. 7º, XXVIII",
    },
    {
      id: "AN-025", tema: "Documentação", dif: "facil",
      p: "Qual é o prazo máximo de validade de uma Avaliação de Risco Operacional (ARO)?",
      c: "12 meses",
      e: ["30 dias", "6 meses", "24 meses", "Uma única operação: vale só para o voo avaliado"],
      exp: "A ARO tem de estar atualizada dentro dos 12 meses calendáricos anteriores à operação. 12 meses é o máximo, não uma obrigação: evento singular pede ARO específica.",
      fonte: "IS nº E94-003 / RBAC 100 (Apostila 06, seção 8)",
    },

    /* ---------------- MÉDIO ---------------- */
    {
      id: "AN-030", tema: "Regulamentação", dif: "medio",
      p: "Quais são os requisitos que, TODOS juntos, caracterizam a categoria aberta de operação?",
      c: "PMD até 25 kg, VLOS (ou EVLOS), até 120 m AGL e sem interseção com EAC ou FRZ",
      e: [
        "PMD até 25 kg, BVLOS permitido e até 120 m AGL",
        "PMD até 250 g, VLOS e qualquer altura",
        "PMD até 25 kg, VLOS e até 150 m AGL, mesmo dentro de FRZ",
        "Qualquer PMD, desde que em VLOS e abaixo de 120 m AGL",
      ],
      exp: "A aberta é taxativa: não pode faltar nenhum requisito. Basta um alterado (401 ft, 26 kg, BVLOS ou FRZ) e a operação cai na categoria específica.",
      fonte: "ICA 100-40, art. 38; RBAC 100, 100.5(a)(1)",
    },
    {
      id: "AN-031", tema: "Regulamentação", dif: "medio",
      p: "Uma operação com drone de 24 kg, em VLOS, a 399 pés AGL, mas com interseção da FRZ de um aeroporto, é de qual categoria?",
      c: "Específica",
      e: ["Aberta, porque cumpre peso, visada e altura", "Certificada, por estar perto de aeroporto", "Recreativa", "Aberta, desde que haja Termo de Coordenação"],
      exp: "Na categoria específica basta UM requisito da aberta não atendido — aqui, a interseção com FRZ. O Termo de Coordenação é exigência adicional, não muda a categoria.",
      fonte: "ICA 100-40, arts. 38 e 40",
    },
    {
      id: "AN-032", tema: "Espaço aéreo", dif: "medio",
      p: "O piloto decola do topo de um prédio de 10 metros e o controle indica 120 metros de altura. Qual é a situação em relação ao limite de 120 m AGL?",
      c: "A aeronave está a cerca de 130 m AGL, acima do limite: o controle marca a altura a partir do ponto de decolagem",
      e: [
        "Está exatamente no limite, porque o controle sempre mostra AGL",
        "Está a 110 m AGL, porque a altura do prédio é descontada",
        "Está dentro do limite, já que o prédio faz parte do solo",
        "Não há limite a observar, porque a decolagem foi de estrutura elevada",
      ],
      exp: "O RC mostra altura relativa ao ponto de decolagem; AGL é contado do solo. Decolou de 10 m e subiu 120 → 130 m AGL.",
      fonte: "Apostila 04, seção 4 (altitude × altura × AGL)",
    },
    {
      id: "AN-033", tema: "Espaço aéreo", dif: "medio",
      p: "Como se calcula a altitude limite de voo de uma solicitação no SARPAS?",
      c: "Altitude do solo no ponto de referência somada à altura de voo solicitada",
      e: [
        "Altura de voo solicitada menos a altitude do ponto de decolagem",
        "Sempre 120 metros acima do nível médio do mar",
        "Altitude do obstáculo mais alto da área mais 30 metros",
        "Altura programada no RTH somada à altura de voo solicitada",
      ],
      exp: "Altitude limite de voo = altitude do solo no ponto de referência + altura solicitada. O piloto não pode extrapolar esse teto, mesmo que o RC mostre pouco.",
      fonte: "ICA 100-40, art. 7º, XII; art. 63, §2º",
    },
    {
      id: "AN-034", tema: "Espaço aéreo", dif: "medio",
      p: "O que caracteriza uma operação como BVLOS, mesmo que o piloto esteja no local do voo?",
      c: "Pilotar com óculos FPV sem um observador mantendo contato visual com a aeronave",
      e: [
        "Voar a mais de 500 metros do ponto de decolagem",
        "Perder momentaneamente o sinal de vídeo da câmera",
        "Voar acima de 120 metros AGL",
        "Operar em área confinada, sem GPS",
      ],
      exp: "Com óculos FPV, ou em VLOS estendido, o observador é obrigatório; sem ele, a operação passa a ser BVLOS — com todas as exigências que vêm com isso.",
      fonte: "ICA 100-40, art. 24, §1º",
    },
    {
      id: "AN-035", tema: "Cadastro", dif: "medio",
      p: "Qual é a ordem correta para regularizar uma aeronave e voar legalmente?",
      c: "Conta gov.br → homologação ANATEL do equipamento → cadastro no SISANT → cadastro/solicitação no SARPAS",
      e: [
        "SARPAS → SISANT → ANATEL → gov.br",
        "SISANT → SARPAS → gov.br → ANATEL",
        "ANATEL → SARPAS → SISANT, sem necessidade de conta gov.br",
        "gov.br → SARPAS → SISANT → ANATEL",
      ],
      exp: "Uma etapa obriga a anterior: o SARPAS só aceita aeronave que tenha número do SISANT, e o acesso a tudo isso começa na conta gov.br.",
      fonte: "Apostila 04, seção 9; Apostila 08, seção 2",
    },
    {
      id: "AN-036", tema: "Documentação", dif: "medio",
      p: "Na matriz de risco da IS nº E94-003, o risco classificado como EXTREMO pode ser autorizado por quem?",
      c: "Somente pela hierarquia mais alta da instituição, com controles preventivos em vigor",
      e: [
        "Pelo próprio piloto remoto em comando",
        "Pela chefia imediata ou comandante da operação",
        "Pelo diretor ou comandante do batalhão",
        "Por ninguém: risco extremo nunca pode ser autorizado",
      ],
      exp: "Extremo (4A, 5A, 5B) exige aprovação do nível mais alto — no batalhão, o comandante-geral. Alto vai ao diretor/comandante; moderado, à chefia imediata; baixo e muito baixo ficam com o piloto.",
      fonte: "IS nº E94-003 (Apostila 06, seção 4)",
    },
    {
      id: "AN-037", tema: "Documentação", dif: "medio",
      p: "Quais são os três riscos que precisam constar de toda ARO, independentemente do cenário?",
      c: "Perda do enlace C2, tráfego aéreo no local e presença de pessoas não anuentes",
      e: [
        "Chuva, vento forte e interferência eletromagnética",
        "Falha de bateria, falha de GPS e falha do gimbal",
        "Invasão de fronteira, artigo perigoso e falta de seguro",
        "Perda do enlace, falha do RTH e queda por colisão com ave",
      ],
      exp: "Riscos são infinitos; estes três são obrigatórios. Os demais (vento, chuva, interferência) entram conforme o cenário.",
      fonte: "Apostila 06, seção 5",
    },
    {
      id: "AN-038", tema: "Documentação", dif: "medio",
      p: "Mitigar um risco, na metodologia da ARO, significa:",
      c: "Adotar medidas que reduzam a probabilidade do evento ou a severidade das consequências",
      e: [
        "Transferir a responsabilidade do voo para quem autorizou",
        "Registrar o risco no documento para efeito de prova",
        "Cancelar a operação sempre que o risco não for baixo",
        "Substituir a aeronave por outra de menor peso",
      ],
      exp: "Mitigar é diminuir a chance de acontecer ou o impacto se acontecer. No exemplo do aeroclube, spotters e contato com o DECEA derrubaram a probabilidade de 4 para 1 — a severidade (A) continuou a mesma.",
      fonte: "Apostila 06, seção 7",
    },
    {
      id: "AN-039", tema: "Espaço aéreo", dif: "medio",
      p: "Qual é o prazo mínimo de antecedência para solicitar no SARPAS um voo BVLOS?",
      c: "8 dias",
      e: ["30 minutos", "4 dias", "24 horas", "90 dias"],
      exp: "BVLOS, PMD acima de 25 kg, voo acima de 400 ft e operação atípica pedem 8 dias. Interseção com FRZ ou área maior que 100 km² são 4 dias. Operação aérea especial e área adequada, 30 minutos.",
      fonte: "ICA 100-40, art. 57",
    },
    {
      id: "AN-040", tema: "Espaço aéreo", dif: "medio",
      p: "A solicitação de acesso ao espaço aéreo NÃO será aceita quando:",
      c: "Houver interseção com área proibida",
      e: [
        "Houver interseção com área perigosa",
        "A operação for noturna",
        "A aeronave tiver menos de 250 g de PMD",
        "O piloto ainda não tiver feito a prova teórica da ANAC",
      ],
      exp: "Área proibida e REH nem entram para análise. Já a área perigosa é permitida sem Termo de Coordenação — cabe ao piloto decidir se aceita o risco.",
      fonte: "ICA 100-40, art. 56, V e VI; art. 29, III",
    },
    {
      id: "AN-041", tema: "Emergências", dif: "medio",
      p: "Ocorreu um fly-away durante a operação. Qual é a providência imediata do piloto em comando?",
      c: "Notificar o Tático SARPAS, informando última posição conhecida, altitude, velocidade e autonomia",
      e: [
        "Registrar o fato no relatório e comunicar no dia seguinte",
        "Avisar a ANAC, que administra o registro da aeronave",
        "Acionar o CENIPA para abrir a investigação do incidente",
        "Desligar o controle para forçar o retorno automático",
      ],
      exp: "O Tático SARPAS, no CGNA, é quem recebe o fly-away e difunde alerta aos órgãos ATS locais. O piloto em comando tem de saber esse contato antes de voar.",
      fonte: "ICA 100-40, arts. 26 e 76",
    },
    {
      id: "AN-042", tema: "Meteorologia", dif: "medio",
      p: "Qual condição meteorológica mais claramente inviabiliza o cumprimento do requisito de VLOS?",
      c: "Nevoeiro ou neblina reduzindo a visibilidade no local do voo",
      e: [
        "Temperatura acima de 35 °C",
        "Umidade relativa do ar acima de 80%",
        "Céu encoberto por nuvens altas",
        "Pressão atmosférica abaixo da média do local",
      ],
      exp: "VLOS depende de ver a aeronave. Nevoeiro tira exatamente isso — e a norma proíbe operar sob nevoeiro.",
      fonte: "ICA 100-40, art. 27",
    },
    {
      id: "AN-043", tema: "Fatores humanos", dif: "medio",
      p: "Quem tem a autoridade final para decidir se o voo acontece?",
      c: "O piloto remoto em comando",
      e: [
        "O comandante da operação, que determina o horário do serviço",
        "O Administrador SARPAS da instituição",
        "O órgão de controle de tráfego aéreo da região",
        "O operador, que é o responsável legal pela aeronave",
      ],
      exp: "O comandante define quando a operação ocorre; quem diz se o voo acontece é o piloto. Recusar voo inseguro não é insubordinação.",
      fonte: "RBAC 100 (Apostila 05, seções 4 e 14)",
    },
    {
      id: "AN-044", tema: "Regulamentação", dif: "medio",
      p: "O que é o handover numa operação com aeronave não tripulada?",
      c: "O procedimento escrito de transferência de comando entre pilotos, para evitar duplicidade de comando",
      e: [
        "A entrega da aeronave ao setor de manutenção após o voo",
        "A passagem do vídeo ao vivo para a sala de situação",
        "A transferência da autorização SARPAS para outra equipe",
        "A troca de baterias com a aeronave pairando",
      ],
      exp: "A presença do piloto é obrigatória em todas as fases do voo; se ele precisa se ausentar, a troca de comando só vale com procedimento claro e escrito.",
      fonte: "RBAC 100 (Apostila 05, seção 6)",
    },
    {
      id: "AN-045", tema: "Cadastro", dif: "medio",
      p: "Qual é o papel do Administrador SARPAS numa instituição de segurança pública?",
      c: "É a pessoa física que gerencia, no SARPAS, as aeronaves, os pilotos e as equipes da instituição, respondendo por elas",
      e: [
        "É o oficial que autoriza o voo de risco extremo",
        "É o servidor da ANAC que aprova o cadastro das aeronaves",
        "É o piloto mais antigo, que fiscaliza os demais em campo",
        "É o responsável técnico pela manutenção das aeronaves",
      ],
      exp: "Sem administrador, a instituição não existe no sistema — e sem instituição cadastrada como segurança pública não há o 'privilégio' da operação aérea especial.",
      fonte: "ICA 100-40, arts. 7º, III e 51; Apostila 04, seção 9",
    },
    {
      id: "AN-046", tema: "Teoria de voo", dif: "medio",
      p: "Por que o modo ATT (atitude), sem posicionamento por satélite, é perigoso em ambiente com muita interferência?",
      c: "Porque a aeronave deixa de manter a posição sozinha e passa a derivar com o vento",
      e: [
        "Porque os motores perdem potência e a aeronave desce",
        "Porque o RTH fica mais preciso e pode voltar em linha reta contra obstáculos",
        "Porque a câmera para de gravar e o piloto perde a referência",
        "Porque a aeronave acelera automaticamente até o limite de velocidade",
      ],
      exp: "Sem GNSS a aeronave não trava a posição: fica à mercê do vento e do comando do piloto. Foi assim que, no Carnaval de Manaus, o drone derivou e bateu no sino da igreja.",
      fonte: "Apostila 05, seção 7",
    },
    {
      id: "AN-047", tema: "Regulamentação", dif: "medio",
      p: "Sobre o seguro nas operações com UAS, o que diz o RBAC 100?",
      c: "Todas as operações devem ter seguro de danos a terceiros, exceto as de entidades estatais e a aplicação agrícola em áreas desabitadas",
      e: [
        "Nenhuma operação com UAS precisa de seguro",
        "Todas as operações precisam do seguro RETA, sem exceção",
        "O seguro é exigido apenas acima de 25 kg de PMD",
        "O seguro é exigido apenas em voo BVLOS",
      ],
      exp: "A isenção da polícia decorre de ser operação do Estado — não de o drone ser pequeno.",
      fonte: "RBAC 100 (Apostila 05, seção 13)",
    },
    {
      id: "AN-048", tema: "Espaço aéreo", dif: "medio",
      p: "Numa FRZ de aeródromo, o que distingue a ZAD da ZEA?",
      c: "A ZAD é o setor de aproximação e decolagem (os cones das cabeceiras); a ZEA é a área circular em volta, excluídos esses cones",
      e: [
        "A ZAD é a área do pátio de estacionamento e a ZEA é a pista",
        "A ZAD vale para helicópteros e a ZEA para aviões",
        "A ZAD é definida pelo fabricante do drone e a ZEA pelo DECEA",
        "A ZAD é diurna e a ZEA é noturna",
      ],
      exp: "Bizu da aula: 'ZAD tem o D do meio — Aproximação e Decolagem'. A ZEH é o círculo do heliponto, sem cones, porque o helicóptero opera na vertical.",
      fonte: "ICA 100-40, art. 7º, LXII a LXIV",
    },
    {
      id: "AN-049", tema: "Documentação", dif: "medio",
      p: "O plano de terminação de voo deve ser elaborado por quem e quando?",
      c: "Pelo operador da aeronave, antes da solicitação de acesso ao espaço aéreo",
      e: [
        "Pelo piloto, no momento em que a emergência acontece",
        "Pelo órgão ATS local, ao emitir o Termo de Coordenação",
        "Pela ANAC, ao aprovar o cenário padrão da operação",
        "Pelo observador, durante o briefing da equipe",
      ],
      exp: "O plano vem antes do pedido, com procedimentos de terminação, rotas/EAC envolvidos e os crash sites. O piloto tem de conhecer e aplicar.",
      fonte: "ICA 100-40, arts. 74 e 75",
    },
    {
      id: "AN-050", tema: "Fatores humanos", dif: "medio",
      p: "O que é 'hora de nacele' (voo mental) no treinamento do piloto remoto?",
      c: "Treinar mentalmente, no próprio posto de pilotagem, a sequência de resposta a cada emergência",
      e: [
        "A hora de voo registrada no log da aeronave",
        "O tempo mínimo de descanso entre dois voos",
        "A vistoria do compartimento da bateria antes da decolagem",
        "O tempo de voo em simulador exigido pela ANAC",
      ],
      exp: "Situações críticas exigem resposta imediata; repetir mentalmente (e com as mãos) a reação a perda de link, bateria crítica e invasão dos 30 m é o que dá essa resposta.",
      fonte: "IS nº E94-003 (Apostila 06, seção 2)",
    },
    {
      id: "AN-051", tema: "Radiofrequência", dif: "medio",
      p: "Por que o uso de jammer (bloqueador de sinal) por órgão de segurança pública exige regularização junto a ANATEL, ANAC e DECEA?",
      c: "Porque ele bloqueia uma faixa inteira de rádio, afetando outros equipamentos em volta, inclusive equipamentos médicos",
      e: [
        "Porque o jammer só funciona com autorização judicial",
        "Porque o equipamento é importado e precisa de licença de importação",
        "Porque o jammer derruba o drone, causando dano ao patrimônio",
        "Porque o uso é exclusivo das Forças Armadas, por lei",
      ],
      exp: "O jammer desfaz a conexão de tudo que é radiocontrolado ao redor — incluindo marca-passos. Por isso o convênio e a regularização vêm antes do uso.",
      fonte: "Apostila 05, seção 12",
    },
    {
      id: "AN-052", tema: "Emergências", dif: "medio",
      p: "Na configuração do RTH, qual é a boa prática quanto à altura de retorno?",
      c: "Programar a altura de retorno acima do obstáculo mais alto da área de operação",
      e: [
        "Programar a menor altura possível, para economizar bateria",
        "Programar a mesma altura do voo, para não mudar a referência",
        "Deixar no padrão de fábrica, que é calculado pela aeronave",
        "Programar 30 metros, que é a distância mínima de terceiros",
      ],
      exp: "Se o RTH volta abaixo de um poste, uma torre ou uma árvore, ele leva a aeronave para a colisão. A equipe do curso usa RTH direto a 120 m para tirar a variável dos sensores.",
      fonte: "Apostila 05, seção 8; modelo de ARO (Apostila 06)",
    },
    {
      id: "AN-053", tema: "Conceitos", dif: "medio",
      p: "Qual é a diferença entre operação automatizada e operação autônoma?",
      c: "Na automatizada o piloto pode intervir em qualquer fase do voo; na autônoma, não há possibilidade de intervenção",
      e: [
        "A automatizada é feita por órgão público e a autônoma por empresa privada",
        "A automatizada usa GPS e a autônoma usa sensores visuais",
        "A automatizada exige observador e a autônoma não",
        "São sinônimos na norma brasileira",
      ],
      exp: "Aerolevantamento com rota programada é automatizado (aperta pausa e a aeronave obedece) — e é permitido. Autônomo é vedado.",
      fonte: "ICA 100-40, art. 7º, VIII e XXXIX",
    },
    {
      id: "AN-054", tema: "Regulamentação", dif: "medio",
      p: "A retenção obrigatória dos registros (logs) de voo é exigida em quais categorias?",
      c: "Específica e certificada",
      e: ["Somente na certificada", "Em todas, inclusive a aberta", "Somente na aberta", "Somente quando houver incidente"],
      exp: "Na aberta não é exigido guardar log — mas os drones DJI registram automaticamente, e o log é o que vai ser analisado se algo acontecer.",
      fonte: "RBAC 100 (Apostila 05, seção 9)",
    },
    {
      id: "AN-055", tema: "Espaço aéreo", dif: "medio",
      p: "Numa Zona UTM, quais são os limites de duração e de área da solicitação?",
      c: "Até 1 hora de voo, em área circular de no máximo 15 km² em VLOS ou 30 km² em BVLOS",
      e: [
        "Até 4 horas de voo, em área de no máximo 100 km²",
        "Até 1 hora de voo, em área de no máximo 100 km²",
        "Até 24 horas de voo, sem limite de área",
        "Até 30 minutos de voo, em área de no máximo 5 km²",
      ],
      exp: "A Zona UTM troca burocracia por limite: pode pedir com 30 minutos de antecedência, mas o voo é curto e a área é pequena.",
      fonte: "ICA 100-40, arts. 57 e 59",
    },

    /* ---------------- DIFÍCIL ---------------- */
    {
      id: "AN-070", tema: "Espaço aéreo", dif: "dificil",
      p: "O ponto de referência da solicitação está num vale a 90 m de altitude e foram pedidos 120 m de altura. Dentro da mesma área, o piloto decola do alto de um morro a 150 m de altitude. Quanto ele pode subir a partir dali?",
      c: "60 metros, porque a altitude limite de voo é 210 m e ele já está a 150 m",
      e: [
        "120 metros, porque a altura autorizada é contada do ponto de decolagem",
        "210 metros, porque a altitude limite é medida do solo do morro",
        "30 metros, porque é preciso deixar margem de segurança",
        "Nada: decolar de ponto mais alto que a referência invalida a autorização",
      ],
      exp: "Altitude limite = altitude do ponto de referência (90) + altura solicitada (120) = 210 m. Do alto do morro (150 m) sobram 60 m, mesmo que o RC mostre '60 m' apenas.",
      fonte: "ICA 100-40, art. 7º, XII; art. 63, §2º",
    },
    {
      id: "AN-071", tema: "Regulamentação", dif: "dificil",
      p: "Quais requisitos a operação aérea especial de órgão de segurança pública tem de cumprir, além de ser em circunstância incomum que não permita planejamento prévio?",
      c: "PMD até 25 kg, VLOS e até 400 pés (120 m) AGL",
      e: [
        "PMD até 25 kg, BVLOS permitido e até 400 pés AGL",
        "Qualquer PMD, VLOS e até 400 pés AGL",
        "PMD até 25 kg, VLOS e sem limite de altura",
        "PMD até 250 g, VLOS e até 200 pés AGL",
      ],
      exp: "O privilégio é no prazo (30 minutos) e na prioridade, não nos limites: acima de 400 ft ou BVLOS só com órgão acreditado, espaço aéreo segregado e Acordo Operacional prévio.",
      fonte: "ICA 100-40, arts. 44 a 46",
    },
    {
      id: "AN-072", tema: "Regulamentação", dif: "dificil",
      p: "Em que condições um órgão especial com necessidade de resposta imediata pode registrar a solicitação DEPOIS do voo?",
      c: "Se estiver acreditado pelo DECEA, houver impossibilidade de solicitação prévia, o registro ocorrer em até 24 h e o voo tiver sido com UA até 25 kg, VLOS, até 400 ft e sem interseção com FRZ, TRA, TSA, área restrita ou proibida",
      e: [
        "Sempre que a operação for policial, em até 72 horas",
        "Se o voo tiver ocorrido em área urbana, em até 24 horas",
        "Se o comandante-geral autorizar por escrito, em até 4 dias",
        "Em qualquer caso, desde que registrado antes do fim do mês",
      ],
      exp: "É exceção estreita: acreditação, impossibilidade real, 24 h e parâmetros de operação simples. Fora disso, o caminho é o prazo normal.",
      fonte: "ICA 100-40, art. 57, §3º",
    },
    {
      id: "AN-073", tema: "Documentação", dif: "dificil",
      p: "Numa ARO, a probabilidade foi avaliada como 4 (ocasional) e a severidade como A (catastrófico). Qual é a tolerabilidade e o que a metodologia manda fazer?",
      c: "Risco extremo: não deve ocorrer; a operação só prossegue com controles preventivos em vigor e aprovação da hierarquia mais alta",
      e: [
        "Risco alto: prossegue com aprovação do diretor ou comandante do batalhão",
        "Risco moderado: prossegue com aprovação da chefia imediata",
        "Risco baixo: o piloto decide, com controles opcionais",
        "Risco muito baixo: aceitável como concebido, sem controles",
      ],
      exp: "4A é extremo, junto com 5A e 5B. Mitigar (spotters, contato com o DECEA) pode derrubar a probabilidade para 1 e levar o caso a 1A — moderado.",
      fonte: "IS nº E94-003 (Apostila 06, seções 4 e 7)",
    },
    {
      id: "AN-074", tema: "Documentação", dif: "dificil",
      p: "Quando a ARO é considerada FACULTATIVA pelo RBAC 100 / IS nº E94-003?",
      c: "Quando a operação ocorre a mais de 150 metros horizontais de pessoas não envolvidas e não anuentes, ou quando há barreira mecânica suficientemente forte para protegê-las",
      e: [
        "Quando a operação é de órgão de segurança pública",
        "Quando a aeronave tem PMD de até 250 g",
        "Quando o voo é em VLOS e abaixo de 30 metros",
        "Quando já existe uma ARO de outro voo na mesma cidade",
      ],
      exp: "É a única dispensa prevista. Fora dela, toda operação tem ARO, com no mínimo os três riscos obrigatórios.",
      fonte: "IS nº E94-003, item (a)(1)(v)(B) (Apostila 06, seção 1)",
    },
    {
      id: "AN-075", tema: "Espaço aéreo", dif: "dificil",
      p: "Qual é a consequência de uma operação com UA próxima a aeródromo ou a auxílio à navegação SEM a devida autorização, segundo a ICA 100-40?",
      c: "É considerada Ato de Interferência Ilícita contra a Aviação Civil, no âmbito do Programa AVSEC do SISCEAB",
      e: [
        "É infração leve, punida com advertência pela ANAC",
        "É crime de dano ao patrimônio público, apurado pela Polícia Federal",
        "É irregularidade administrativa resolvida com o registro posterior em 24 h",
        "É infração de trânsito aéreo julgada pelo CENIPA",
      ],
      exp: "O §3º do art. 19 é expresso. E quem julga a infração de tráfego aéreo é a JJAER; o CENIPA investiga acidentes com finalidade só de prevenção, sem atribuir culpa.",
      fonte: "ICA 100-40, art. 19, §3º; art. 66",
    },
    {
      id: "AN-076", tema: "Regulamentação", dif: "dificil",
      p: "Qual norma da ANAC passou a reger as aeronaves não tripuladas civis, substituindo integralmente o RBAC-E nº 94?",
      c: "RBAC nº 100, aprovado pela Resolução ANAC nº 805, de 15/06/2026",
      e: [
        "RBAC nº 90, aprovado em 2024",
        "ICA 100-40, publicada pelo DECEA em 2026",
        "IS nº E94-003, Revisão A, de 2017",
        "RBAC-E nº 94, Emenda 03, de 2023",
      ],
      exp: "O RBAC 100 trocou as classes por peso (1, 2 e 3) pelas categorias por risco (aberta, específica e certificada). Registros e certificados emitidos pelo RBAC-E 94 seguem válidos até cancelamento pela ANAC.",
      fonte: "RBAC 100; ICA 100-40, art. 78",
    },
    {
      id: "AN-077", tema: "Espaço aéreo", dif: "dificil",
      p: "Em quais tipos de Espaço Aéreo Condicionado a operação exige a apresentação de Termo de Coordenação (TCo)?",
      c: "Área restrita, TRA e TSA",
      e: [
        "Área proibida e REH",
        "Área perigosa e área proibida",
        "Somente TRA",
        "Qualquer EAC, inclusive área perigosa",
      ],
      exp: "Área proibida veda a operação (a solicitação nem é aceita) e REH também impede. Área perigosa dispensa TCo — o piloto decide se aceita o risco. Em Área Adequada o TCo é dispensado.",
      fonte: "ICA 100-40, art. 29 e art. 28, parágrafo único",
    },
    {
      id: "AN-078", tema: "Documentação", dif: "dificil",
      p: "O comandante-geral autorizou uma operação de risco extremo e o piloto voou. Houve colisão. Como fica a responsabilidade do piloto?",
      c: "Não há transferência automática: a conduta do piloto será apurada pelo log do voo e pelas medidas que ele adotou",
      e: [
        "A responsabilidade passa integralmente a quem autorizou o voo",
        "O piloto responde apenas se não houver ARO assinada",
        "A responsabilidade é do observador, que deveria ter avisado",
        "Não há responsabilidade quando a ordem é de autoridade superior",
      ],
      exp: "A autorização legitima a operação; não apaga a conduta. Vai ser analisado se a altitude minimizava risco, se houve manobra evasiva e se os spotters avisaram.",
      fonte: "Apostila 06, seção 7",
    },
    {
      id: "AN-079", tema: "Regulamentação", dif: "dificil",
      p: "Um cidadão derrubou a tiros um drone que sobrevoava o quintal dele sem autorização de voo. Juridicamente, como isso é tratado?",
      c: "Quem derruba responde: drone é aeronave, e atirar nele equivale a atirar numa aeronave — a falta de autorização do voo não autoriza a derrubada",
      e: [
        "Nada acontece, porque o drone estava irregular",
        "Os dois respondem igualmente, em legítima defesa recíproca",
        "Só há responsabilidade se o drone estivesse filmando",
        "É exercício regular de direito à privacidade, previsto em lei",
      ],
      exp: "O caso citado em aula terminou em condenação a indenizar o dono do drone. A situação muda quando há risco à vida (drone com explosivo), aí a lógica é a legítima defesa de terceiros — fundamentada e registrada.",
      fonte: "Apostila 05, seção 12",
    },
    {
      id: "AN-080", tema: "Espaço aéreo", dif: "dificil",
      p: "Qual é o prazo máximo de duração de uma autorização SARPAS e em que condição ela pode ser estendida?",
      c: "Até 90 dias; a autorização de 90 dias com NOTAM pode ser estendida por 60 dias, se pedida com 8 dias de antecedência do término e com parecer favorável",
      e: [
        "Até 30 dias, prorrogáveis por mais 30 a qualquer momento",
        "Até 12 meses, renováveis automaticamente",
        "Até 90 dias, sem qualquer possibilidade de extensão",
        "Até 4 dias, como na operação aérea especial",
      ],
      exp: "Também não se aceita solicitação feita com mais de 90 dias de antecedência nem com duração superior a 90 dias.",
      fonte: "ICA 100-40, arts. 56 e 65",
    },
    {
      id: "AN-081", tema: "Cadastro", dif: "dificil",
      p: "Onde são registradas as aeronaves não tripuladas MILITARES?",
      c: "Na própria Força (Marinha, Exército ou Aeronáutica), e não no SISANT/RAB da ANAC",
      e: [
        "No SISANT, como as civis, com documento probatório",
        "No SARPAS, diretamente pelo Administrador da Organização Militar",
        "No RAB da ANAC, com marcas de nacionalidade e matrícula",
        "No CENIPA, por questão de investigação de acidentes",
      ],
      exp: "O registro da UA militar é competência exclusiva da respectiva Força. Já o drone da Polícia Militar é aeronave de propriedade do governo em serviço policial: cadastra no SISANT como as civis.",
      fonte: "ICA 100-40, art. 54, §3º; art. 7º, VI",
    },
    {
      id: "AN-082", tema: "Emergências", dif: "dificil",
      p: "Ao definir um crash site (ponto de terminação de voo), o que é indispensável avaliar?",
      c: "Que o local continue seguro no dia e no horário da operação — uma área de feira, por exemplo, não serve no dia em que a feira funciona",
      e: [
        "Que o local esteja a menos de 30 metros do ponto de decolagem",
        "Que o local tenha cobertura de GPS e sinal de telefonia",
        "Que o local seja o mesmo home point programado no RTH",
        "Que o local seja pavimentado, para reduzir dano à aeronave",
      ],
      exp: "O crash site segue os mesmos rigores de segurança da operação. Nem toda missão vai ter um — às vezes não existe local melhor para a aeronave cair.",
      fonte: "Apostila 05, seção 13; ICA 100-40, art. 74",
    },
    {
      id: "AN-083", tema: "Regulamentação", dif: "dificil",
      p: "Uma operação de aerolevantamento cruzando a fronteira com outro país, feita por órgão estadual de segurança pública, depende de quê?",
      c: "Autorização expressa da ANAC, regulamentação do DECEA e integração com o outro país — sem isso, vira incidente internacional",
      e: [
        "Apenas da autorização SARPAS, porque é operação de Estado",
        "Apenas do Acordo Operacional com o órgão ATS local",
        "Apenas da autorização do Ministério da Defesa",
        "De nada além do cadastro SISANT, já que a aeronave é a mesma",
      ],
      exp: "Ponto crítico para o BPFRON: nenhum agente de Estado voa por cima da fronteira sem esse conjunto de autorizações.",
      fonte: "Apostila 05, seção 13",
    },
    {
      id: "AN-084", tema: "Documentação", dif: "dificil",
      p: "No cenário 'perda de link' de uma ARO, o que faz a severidade subir de E (insignificante) para C (significativo)?",
      c: "O fato de o retorno automático poder levar a aeronave sobre pessoas, em vez de terminar em crash site seguro",
      e: [
        "A quantidade de vezes que o modelo já perdeu link, relatada por outros operadores",
        "A distância entre o piloto e a aeronave no momento da perda",
        "O valor patrimonial da aeronave envolvida",
        "A ausência de seguro RETA para a operação",
      ],
      exp: "A probabilidade vem do histórico do equipamento; a severidade vem do cenário concreto. Mesmo perigo, severidades diferentes — é por isso que ARO é analisada caso a caso.",
      fonte: "Apostila 06, seções 6 e 7",
    },
    {
      id: "AN-085", tema: "Espaço aéreo", dif: "dificil",
      p: "Ao atender ocorrência de drone irregular sobrevoando estabelecimento penal, qual é o procedimento correto do policial?",
      c: "Coletar materialidade e autoria (imagens da aeronave, identificação do operador, horário e local) e encaminhar cópia do procedimento à Organização Regional do DECEA da área",
      e: [
        "Derrubar a aeronave com o meio disponível e apreendê-la",
        "Encaminhar o caso ao CENIPA, que julga as infrações de tráfego aéreo",
        "Registrar boletim e aguardar o pedido formal da ANAC",
        "Acionar o Tático SARPAS, que aplica a multa ao operador",
      ],
      exp: "Estabelecimento penal é área de segurança, logo FRZ. A apuração criminal é da polícia; a administrativa é do COMAER, e quem julga a infração de tráfego aéreo é a JJAER — por isso o procedimento vai à Organização Regional (em Rondônia, o CINDACTA IV).",
      fonte: "ICA 100-40, arts. 13, 67 a 71",
    },
    {
      id: "AN-086", tema: "Fatores humanos", dif: "dificil",
      p: "Sob o RBAC 100, quem é o 'operador' da aeronave numa polícia militar?",
      c: "O responsável legal pela operação — o comandante da unidade e, em último nível, o comandante-geral — que designa o piloto remoto como seu preposto",
      e: [
        "O policial que está com o controle na mão durante o voo",
        "O Administrador SARPAS da instituição",
        "O órgão de controle de tráfego aéreo que autoriza o voo",
        "O setor de patrimônio, que detém a carga da aeronave",
      ],
      exp: "Operador não é quem pilota: é quem responde pelo controle operacional e tem de garantir que o piloto tenha treinamento e condições psicofísicas para a missão.",
      fonte: "RBAC 100 (Apostila 05, seção 4)",
    },
    {
      id: "AN-087", tema: "Teoria de voo", dif: "dificil",
      p: "Por que os sensores de obstáculo de um drone não evitam a colisão com uma aeronave tripulada em rota de cruzeiro?",
      c: "Porque a velocidade de aproximação é alta demais para o tempo de reação dos sensores e da aeronave",
      e: [
        "Porque os sensores só funcionam abaixo de 30 metros de altura",
        "Porque os sensores detectam apenas objetos metálicos",
        "Porque o sistema de visão é desativado em voo automatizado",
        "Porque os sensores olham só para baixo e para trás",
      ],
      exp: "O que existe é alerta de tráfego (AirSense/ADS-B) para aeronaves com transponder — e ele não substitui a vigilância visual do observador. A pergunta que fica é o que um drone fazia na altura de cruzeiro.",
      fonte: "Apostila 05, seção 11; Apostila 03, seção 1",
    },
    {
      id: "AN-088", tema: "Radiofrequência", dif: "dificil",
      p: "Havendo comunicação bilateral com o órgão de controle, como o piloto identifica a aeronave na fraseologia?",
      c: "Dizendo 'RPA' antes do código de chamada da aeronave, conforme o MCA 100-16",
      e: [
        "Dizendo 'drone' seguido da placa da viatura",
        "Informando o número do SISANT completo a cada chamada",
        "Dizendo 'UAS' seguido do nome da instituição",
        "Usando apenas o indicativo da unidade policial",
      ],
      exp: "A fraseologia é a do MCA 100-16, com 'RPA' antes do código de chamada. E, ao falar de altura no rádio, diga '200 pés de altura' — não '200 FT'.",
      fonte: "ICA 100-40, art. 21",
    },
    {
      id: "AN-089", tema: "Cadastro", dif: "dificil",
      p: "Quando o Plano de Voo (FPL) é exigido e a aeronave não tem designador de tipo definido, como ele é preenchido?",
      c: "'ZZZZ' no item 9 e o tipo no item 18, precedido de TYP/UAS",
      e: [
        "'UAS' no item 9 e o número do SISANT no item 18",
        "'RPA' no item 9 e o modelo no item 15",
        "O número da autorização SARPAS no item 9",
        "Deixa-se o item 9 em branco e descreve-se no item 11",
      ],
      exp: "É a regra do art. 22, remetendo ao MCA 100-11.",
      fonte: "ICA 100-40, art. 22",
    },
    {
      id: "AN-090", tema: "Regulamentação", dif: "dificil",
      p: "Uma operação aeroagrícola com PMD acima de 25 kg pode ser enquadrada na categoria aberta?",
      c: "Não: pelo peso já é categoria específica — o que existe é prazo facilitado de 30 minutos em condições determinadas",
      e: [
        "Sim, porque a atividade agrícola tem isenção prevista no RBAC 100",
        "Sim, desde que em VLOS e abaixo de 30 metros",
        "Sim, porque o defensivo agrícola não é artigo perigoso",
        "Não: é sempre categoria certificada, por causa dos produtos químicos",
      ],
      exp: "A facilitação é no prazo: operação aeroagrícola específica com PMD > 25 kg, VLOS, até 100 ft (30 m), sem FRZ/EAC e sobre área desabitada pode ser solicitada com 30 minutos.",
      fonte: "ICA 100-40, art. 57, §1º, II",
    },
    /* ------- METEOROLOGIA ------- */
    {
      id: "AN-100", tema: "Meteorologia", dif: "facil",
      p: "O que é uma rajada de vento?",
      c: "Uma variação brusca e momentânea da velocidade do vento em relação à média",
      e: [
        "O vento constante que sopra durante todo o dia",
        "A mudança gradual de direção do vento ao longo da tarde",
        "O vento que sopra sempre do mar para o continente",
        "A corrente de ar quente que sobe do solo aquecido",
      ],
      exp: "Rajada é o pico momentâneo. O drone aguenta a média anunciada pelo fabricante, mas é a rajada que desestabiliza — é por isso que ela entra na ARO.",
      fonte: "Apostila 06, situação 4 (ventos e rajadas)",
    },
    {
      id: "AN-101", tema: "Meteorologia", dif: "facil",
      p: "Qual nuvem indica atividade convectiva intensa, com trovoadas, e proíbe o voo na área?",
      c: "Cumulonimbus (Cb)",
      e: ["Cirrus (Ci)", "Stratus (St)", "Altocumulus (Ac)", "Cirrostratus (Cs)"],
      exp: "O cumulonimbus traz corrente descendente forte, rajada, granizo e descarga elétrica. Não se voa perto dele nem por curiosidade.",
      fonte: "Meteorologia aeronáutica básica",
    },
    {
      id: "AN-102", tema: "Meteorologia", dif: "medio",
      p: "Por que o calor extremo reduz o desempenho de um multirrotor?",
      c: "Porque o ar quente é menos denso, as hélices geram menos sustentação e a bateria aquece mais rápido",
      e: [
        "Porque o ar quente aumenta a densidade e trava as hélices",
        "Porque o calor melhora a sustentação, mas derruba o sinal de rádio",
        "Porque o GPS perde precisão acima de 30 °C",
        "Porque o gimbal se desregula com a temperatura",
      ],
      exp: "Menos densidade do ar = menos sustentação para a mesma rotação, então o motor trabalha mais e a bateria esquenta e rende menos. Em Rondônia, isso é rotina.",
      fonte: "Meteorologia aeronáutica / manual do equipamento",
    },
    {
      id: "AN-103", tema: "Meteorologia", dif: "medio",
      p: "Chuva forte se aproximou no meio da operação, ainda a alguns quilômetros. Qual é a conduta?",
      c: "Suspender a operação tão rápido quanto seja praticável e seguro, trazendo a aeronave",
      e: [
        "Continuar até a chuva chegar ao ponto de decolagem",
        "Descer para 30 metros e continuar a filmagem",
        "Pousar a aeronave no local mais próximo e buscá-la depois da chuva",
        "Programar o RTH e desligar o controle para economizar bateria",
      ],
      exp: "A própria ARO modelo manda suspender quando a condição climática muda durante a operação. Chuva vem junto com rajada — o problema raramente é só a água.",
      fonte: "ICA 100-40, art. 27; Apostila 06, situação 5",
    },
    {
      id: "AN-104", tema: "Meteorologia", dif: "dificil",
      p: "Numa operação no fim da tarde, o vento médio é de 6 m/s e o fabricante indica resistência de até 10 m/s. O que ainda exige cautela?",
      c: "As rajadas, que podem passar bem do valor médio, e o consumo extra de bateria no retorno contra o vento",
      e: [
        "Nada: com margem de 4 m/s a operação é segura em qualquer situação",
        "Apenas a precisão do GPS, que cai com vento lateral",
        "Apenas o alcance do enlace de rádio, reduzido pelo vento",
        "Apenas a estabilidade da imagem, corrigida pelo gimbal",
      ],
      exp: "O número do fabricante é vento sustentado em condição ideal. Rajada não avisa, e a aeronave que foi longe a favor volta contra — o cálculo de autonomia tem de considerar o pior trecho.",
      fonte: "Apostila 05, seção 8; Apostila 06, situação 4",
    },

    /* ------- TEORIA DE VOO / TÉCNICO ------- */
    {
      id: "AN-110", tema: "Teoria de voo", dif: "facil",
      p: "Num quadricóptero, como a aeronave gira em torno do próprio eixo (guinada)?",
      c: "Aumentando a rotação do par de motores que gira num sentido e reduzindo a do outro par",
      e: [
        "Inclinando o gimbal da câmera para o lado desejado",
        "Aumentando a rotação dos quatro motores ao mesmo tempo",
        "Usando uma hélice de cauda, como no helicóptero",
        "Freando dois motores até pararem completamente",
      ],
      exp: "Em multirrotor, dois motores giram no sentido horário e dois no anti-horário. Desequilibrar os pares gera o torque que faz a guinada.",
      fonte: "Teoria de voo — multirrotores",
    },
    {
      id: "AN-111", tema: "Teoria de voo", dif: "medio",
      p: "O que acontece com um multirrotor que desce verticalmente muito rápido sobre o próprio fluxo de ar?",
      c: "Pode entrar em anel de vórtice, perdendo sustentação e ficando instável até sair do fluxo com deslocamento lateral",
      e: [
        "Ganha sustentação extra e desce mais devagar do que o comandado",
        "Perde o sinal de GPS por causa da turbulência das hélices",
        "Entra automaticamente em RTH por segurança",
        "Nada: a descida vertical é sempre o modo mais seguro de pousar",
      ],
      exp: "O anel de vórtice (VRS) aparece na descida vertical rápida: a hélice recircula o próprio ar sujo. A saída é dar deslocamento lateral/para frente e reduzir a taxa de descida.",
      fonte: "Teoria de voo — multirrotores",
    },
    {
      id: "AN-112", tema: "Teoria de voo", dif: "medio",
      p: "Por que a calibração da bússola/IMU faz parte do checklist antes do voo?",
      c: "Porque bússola desalinhada ou influenciada por metal faz a aeronave derivar e pode comprometer o RTH",
      e: [
        "Porque sem calibrar a câmera não grava em alta resolução",
        "Porque a calibração aumenta a autonomia da bateria",
        "Porque a ANAC exige registro da calibração em cada voo",
        "Porque a calibração amplia o alcance do enlace de rádio",
      ],
      exp: "A bússola dá a referência de direção. Decolar em cima de estrutura metálica ou sem calibrar é receita de deriva — e o RTH depende dessa referência.",
      fonte: "Modelo de ARO — perigo 1 (Apostila 06)",
    },
    {
      id: "AN-113", tema: "Teoria de voo", dif: "facil",
      p: "O que o sistema GNSS/GPS faz pelo multirrotor em voo normal?",
      c: "Mantém a posição no ar e registra o home point usado pelo RTH",
      e: [
        "Aumenta a potência dos motores em altitude elevada",
        "Corrige a exposição da câmera conforme a luz",
        "Transmite a imagem ao controle remoto",
        "Impede a entrada em zonas restritas definidas pela norma",
      ],
      exp: "Sem GNSS a aeronave não trava a posição (modo ATT) e não há home point confiável. A restrição de área é do software do fabricante (NFZ), coisa diferente.",
      fonte: "Apostila 03, seção 1",
    },
    {
      id: "AN-114", tema: "Teoria de voo", dif: "dificil",
      p: "Qual é a limitação dos sensores visuais de obstáculo que mais importa numa busca noturna?",
      c: "Eles dependem de luz e de textura na cena: no escuro, na fumaça ou diante de parede lisa, deixam de funcionar",
      e: [
        "Eles só funcionam quando a aeronave está pairando",
        "Eles desligam automaticamente acima de 50 metros de altura",
        "Eles detectam apenas objetos maiores que 2 metros",
        "Eles funcionam melhor no escuro do que de dia",
      ],
      exp: "Sensor visual é câmera: sem luz e sem textura não há o que comparar entre quadros. É por isso que drones de ambiente confinado usam LiDAR, que funciona no escuro.",
      fonte: "Apostila 05, seção 1; Apostila 03, seção 1",
    },
    {
      id: "AN-115", tema: "Técnico", dif: "facil",
      p: "O que o recurso AirSense, presente em drones DJI, faz?",
      c: "Alerta o piloto sobre aeronaves tripuladas próximas que transmitem ADS-B",
      e: [
        "Detecta qualquer aeronave próxima, com ou sem transponder",
        "Mede a qualidade do ar para operações de defesa civil",
        "Bloqueia a decolagem em zonas proibidas pelo fabricante",
        "Aumenta o alcance do enlace de rádio em área urbana",
      ],
      exp: "AirSense é receptor ADS-B: só vê quem transmite. Aeronave sem transponder não aparece — por isso o observador continua indispensável.",
      fonte: "Apostila 03, seção 1",
    },
    {
      id: "AN-116", tema: "Técnico", dif: "medio",
      p: "Para que serve o RTK do DJI Matrice 350 RTK?",
      c: "Corrigir o posicionamento por satélite em tempo real, levando a precisão de metros para centímetros",
      e: [
        "Aumentar o alcance da transmissão de vídeo para 20 km",
        "Permitir o voo autônomo sem intervenção do piloto",
        "Substituir o GPS em ambientes confinados, sem sinal de satélite",
        "Detectar obstáculos por laser em todas as direções",
      ],
      exp: "RTK (Real-Time Kinematic) é correção de GNSS — essencial em mapeamento e inspeção. Quem resolve a falta de satélite é LiDAR/sensor visual.",
      fonte: "Apostila 03, seção 1",
    },
    {
      id: "AN-117", tema: "Técnico", dif: "medio",
      p: "Quais são os cuidados corretos com bateria inteligente de lítio de drone?",
      c: "Guardar em carga parcial, longe de calor e umidade, e não usar bateria estufada ou com dano físico",
      e: [
        "Guardar sempre com 100% de carga, para estar pronta a qualquer chamado",
        "Guardar sempre totalmente descarregada, para preservar as células",
        "Recarregar imediatamente após o voo, com a bateria ainda quente",
        "Congelar a bateria antes de operações longas, para reduzir o aquecimento",
      ],
      exp: "Lítio guardado cheio por muito tempo envelhece; guardado vazio pode entrar em tensão crítica. Bateria estufada é descarte, não é 'dá para uma última missão'.",
      fonte: "Manual do equipamento; Apostila 05, seção 10",
    },
    {
      id: "AN-118", tema: "Técnico", dif: "dificil",
      p: "Numa operação noturna, qual exigência da norma incide sobre o equipamento mesmo que a operação seja dispensada de CNS?",
      c: "As luzes de navegação, cuja dispensa não se aplica ao voo noturno",
      e: [
        "O transponder ADS-B embarcado",
        "O rádio VHF de aviação a bordo da aeronave",
        "O paraquedas de emergência homologado",
        "O sistema anticolisão automático (DAA)",
      ],
      exp: "O art. 20, §2º dispensa CNS para UA até 25 kg, VLOS e até 400 ft — mas o §4º diz que a dispensa não vale para as luzes de navegação à noite.",
      fonte: "ICA 100-40, art. 20, §§2º e 4º",
    },
    {
      id: "AN-119", tema: "Técnico", dif: "facil",
      p: "Para que serve o botão de pausa de voo no controle remoto?",
      c: "Interromper imediatamente qualquer missão automática e deixar a aeronave pairando",
      e: [
        "Pausar a gravação de vídeo sem interromper o voo",
        "Congelar a imagem na tela para análise",
        "Desligar os motores em emergência",
        "Suspender a transmissão ao vivo para a sala de situação",
      ],
      exp: "É o botão que materializa a 'intervenção humana' que a lei exige: rota programada só é permitida porque o piloto pode interromper a qualquer momento.",
      fonte: "Apostila 03, seção 1",
    },

    /* ------- FATORES HUMANOS ------- */
    {
      id: "AN-125", tema: "Fatores humanos", dif: "medio",
      p: "O que é a perda de consciência situacional durante a operação de drone?",
      c: "Deixar de perceber o que acontece em volta — tráfego, pessoas, bateria, vento — por excesso de foco na tela",
      e: [
        "Perder o sinal de vídeo e continuar comandando às cegas",
        "Esquecer de registrar o voo no SARPAS depois da operação",
        "Confundir a aeronave com outra na mesma área",
        "Operar sem ter dormido o suficiente na noite anterior",
      ],
      exp: "O piloto olha a tela; é o observador que devolve a consciência situacional. É exatamente a razão de a equipe mínima ser de três.",
      fonte: "Apostila 04, seção 13 (doutrina da equipe)",
    },
    {
      id: "AN-126", tema: "Fatores humanos", dif: "medio",
      p: "Um piloto dormiu 3 horas e foi escalado para uma operação com drone. Quem responde por colocá-lo no comando?",
      c: "O operador — o responsável legal pela operação — além do próprio piloto, que deve manter a capacidade psicofísica",
      e: [
        "Somente o piloto, porque a responsabilidade é individual",
        "Somente o comandante da operação, que fez a escala",
        "O Administrador SARPAS, que cadastra os pilotos",
        "Ninguém: falta de sono não é impedimento previsto em norma",
      ],
      exp: "Cabe ao operador garantir treinamento e condição psicofísica compatíveis com a missão — e a norma cita expressamente a falta de sono, junto de droga e medicamento.",
      fonte: "RBAC 100 (Apostila 05, seção 4)",
    },
    {
      id: "AN-127", tema: "Fatores humanos", dif: "facil",
      p: "Qual é a atitude correta do piloto quando o comandante insiste num voo que o piloto considera inseguro?",
      c: "Recusar o voo, explicando o motivo — recusar voo inseguro não é insubordinação",
      e: [
        "Cumprir a ordem, porque a responsabilidade passa a ser de quem ordenou",
        "Cumprir a ordem, mas reduzir a altura para diminuir o risco",
        "Passar o controle a outro piloto da equipe",
        "Voar e registrar depois o que deu errado",
      ],
      exp: "Quem decide se o voo acontece é o piloto. A ordem superior deve constar do documento, mas não transfere automaticamente a responsabilidade pela condução do voo.",
      fonte: "Apostila 05, seção 14; Apostila 06, seção 7",
    },
    {
      id: "AN-128", tema: "Fatores humanos", dif: "dificil",
      p: "Numa transmissão ao vivo para autoridades, a aeronave precisa voltar para trocar bateria. Qual é a conduta esperada do piloto?",
      c: "Narrar a ação para quem está assistindo, avisando que a aeronave está retornando e quando a imagem volta",
      e: [
        "Encerrar a sala para não expor a operação nesse intervalo",
        "Deixar a imagem congelada sem comentar, para não gerar alarme",
        "Transferir a transmissão para a câmera do celular",
        "Continuar filmando o solo com a aeronave pousada",
      ],
      exp: "Quem assiste não sabe interpretar a tela. Sem narração, a autoridade pode achar que a equipe parou de trabalhar. Informar ao entrar e ao sair é parte da entrega.",
      fonte: "Apostila 07, seção 5",
    },

    /* ------- SEGURANÇA OPERACIONAL / CHECKLIST ------- */
    {
      id: "AN-132", tema: "Segurança operacional", dif: "facil",
      p: "O que o planejamento do voo deve incluir, no mínimo, segundo a ICA 100-40?",
      c: "Restrições do espaço aéreo, necessidade de coordenação, meteorologia atualizada, autonomia da bateria, plano alternativo e consulta aos produtos AIS",
      e: [
        "Apenas a autorização SARPAS impressa e a bateria carregada",
        "Apenas a ordem de serviço e o contato do comandante",
        "Apenas a ARO assinada e o seguro da aeronave",
        "Apenas o número do SISANT e a homologação ANATEL",
      ],
      exp: "É a lista do art. 73. Autonomia da bateria e plano alternativo estão lá — não são 'zelo extra', são requisito.",
      fonte: "ICA 100-40, art. 73",
    },
    {
      id: "AN-133", tema: "Segurança operacional", dif: "medio",
      p: "Antes de sair do local de decolagem, qual verificação evita o pior problema do RTH?",
      c: "Confirmar no aplicativo que o home point foi registrado e que o sinal de satélite está firme",
      e: [
        "Confirmar que o cartão de memória tem espaço livre",
        "Confirmar que a transmissão ao vivo está estável",
        "Confirmar que o gimbal está nivelado",
        "Confirmar que o modo esportivo está desativado",
      ],
      exp: "RTH sem home point registrado não tem para onde voltar. É a primeira linha do checklist do curso.",
      fonte: "Apostila 03, seção 7; Apostila 06 (modelo de ARO)",
    },
    {
      id: "AN-134", tema: "Segurança operacional", dif: "medio",
      p: "Quem faz o checklist antes de cada voo?",
      c: "O piloto remoto em comando, antes de cada decolagem",
      e: [
        "O observador, enquanto o piloto monta a estação",
        "O Administrador SARPAS, no cadastro da missão",
        "O setor de manutenção, uma vez por semana",
        "O comandante da operação, ao autorizar o serviço",
      ],
      exp: "O piloto toma ciência do planejamento e passa o checklist a cada voo — é nesse momento que ele decide se o voo acontece.",
      fonte: "RBAC 100 (Apostila 05, seção 6); ICA 100-40, art. 72",
    },
    {
      id: "AN-135", tema: "Segurança operacional", dif: "dificil",
      p: "A equipe vai operar com óculos FPV numa busca em área de mata. Qual é o arranjo mínimo exigido?",
      c: "Um observador mantendo contato visual com a aeronave, em comunicação direta e constante com o piloto",
      e: [
        "Dois pilotos alternando o comando a cada 10 minutos",
        "Um segundo drone acompanhando a aeronave principal",
        "Autorização verbal do órgão ATS mais próximo",
        "Apenas o registro no log de que o voo foi em FPV",
      ],
      exp: "Óculos FPV sem observador = BVLOS, com todas as exigências que isso traz (8 dias, segregação, acordo operacional para órgão especial).",
      fonte: "ICA 100-40, art. 24",
    },
    {
      id: "AN-136", tema: "Segurança operacional", dif: "medio",
      p: "Durante a operação, uma pessoa não anuente entrou no raio de 30 metros. O que fazer?",
      c: "Suspender a operação tão rápido quanto seja praticável e seguro",
      e: [
        "Subir a aeronave acima de 50 metros e continuar",
        "Pedir ao observador que converse com a pessoa enquanto o voo segue",
        "Continuar, porque o limite só vale para o início da operação",
        "Acionar o alto-falante e determinar que a pessoa saia da área",
      ],
      exp: "É a mitigação escrita na própria ARO modelo: se alguém acessa acidentalmente a área, o voo é suspenso. Antes de iniciar, nem começa enquanto a pessoa estiver lá.",
      fonte: "Apostila 06, situação 3",
    },

    /* ------- LEGISLAÇÃO / ESPAÇO AÉREO (COMPLEMENTO) ------- */
    {
      id: "AN-140", tema: "Espaço aéreo", dif: "facil",
      p: "Qual órgão do COMAER é o Órgão Central do SISCEAB, responsável pelo controle do espaço aéreo brasileiro?",
      c: "DECEA",
      e: ["CENIPA", "JJAER", "CGNA", "ANAC"],
      exp: "DECEA é o Órgão Central. O CGNA abriga a Seção e o Tático SARPAS; a JJAER julga infrações; o CENIPA investiga acidentes para prevenir.",
      fonte: "ICA 100-40, art. 5º; Apostila 01, seção 8",
    },
    {
      id: "AN-141", tema: "Espaço aéreo", dif: "medio",
      p: "Uma operação em Rondônia é analisada por qual Organização Regional do DECEA?",
      c: "CINDACTA IV, em Manaus (FIR Amazônica)",
      e: [
        "CINDACTA I, em Brasília",
        "CINDACTA II, em Curitiba",
        "CINDACTA III, em Recife",
        "CRCEA-SE, em São Paulo",
      ],
      exp: "Rondônia está na FIR Amazônica, sob o CINDACTA IV — inclusive para encaminhar procedimento de drone irregular.",
      fonte: "ICA 100-40, Anexo II; Apostila 01, seção 8",
    },
    {
      id: "AN-142", tema: "Regulamentação", dif: "facil",
      p: "Qual órgão julga administrativamente as infrações de tráfego aéreo e aplica as penalidades do Código Brasileiro de Aeronáutica?",
      c: "JJAER — Junta de Julgamento da Aeronáutica",
      e: ["CENIPA", "ANAC", "DECEA", "Polícia Federal"],
      exp: "JJAER pune; CENIPA investiga acidentes só para prevenir, e suas conclusões não servem para atribuir culpa.",
      fonte: "ICA 100-40, arts. 4º, §1º e 66",
    },
    {
      id: "AN-143", tema: "Espaço aéreo", dif: "medio",
      p: "Estabelecimento penal, refinaria, usina hidrelétrica e área militar são exemplos de:",
      c: "Áreas de segurança e locais de interesse estratégico, em torno das quais existem FRZ",
      e: [
        "Áreas proibidas, onde a solicitação de voo nem é aceita",
        "Espaço aéreo segregado de uso exclusivo das Forças Armadas",
        "Zonas UTM, com solicitação simplificada de 30 minutos",
        "Áreas adequadas, com parâmetros flexibilizados",
      ],
      exp: "A lista do art. 13 (ICA 100-36) cria FRZ. É por isso que drone sobre presídio é ocorrência — e o policial coleta materialidade e autoria.",
      fonte: "ICA 100-40, art. 13",
    },
    {
      id: "AN-144", tema: "Regulamentação", dif: "medio",
      p: "Operação em área confinada (dentro de uma edificação) é atividade em espaço aéreo, de responsabilidade do DECEA?",
      c: "Não, mas as regras de segurança, de equipe e de responsabilidade continuam valendo",
      e: [
        "Sim, e exige solicitação no SARPAS com 4 dias de antecedência",
        "Sim, e é sempre categoria específica",
        "Não, e por isso nenhuma regra se aplica a esse voo",
        "Não, mas exige autorização da ANATEL para o enlace",
      ],
      exp: "O art. 31 tira a área confinada do escopo do DECEA. Não tira a responsabilidade do operador nem do piloto.",
      fonte: "ICA 100-40, art. 31",
    },
    {
      id: "AN-145", tema: "Regulamentação", dif: "dificil",
      p: "Operações de UA de órgãos de segurança pública e defesa civil têm prioridade sobre quais outras?",
      c: "Sobre as demais operações de aeronaves não tripuladas — nunca sobre aeronave tripulada",
      e: [
        "Sobre qualquer aeronave, tripulada ou não",
        "Somente sobre operações recreativas",
        "Somente sobre operações de aerolevantamento",
        "Sobre aeronaves tripuladas civis, mas não militares",
      ],
      exp: "O art. 34 dá prioridade sobre as demais UA. O art. 36 manda encerrar a operação diante de aeronave tripulada — e também diante de UA de segurança pública/defesa civil.",
      fonte: "ICA 100-40, arts. 34 e 36",
    },
    {
      id: "AN-146", tema: "Cadastro", dif: "medio",
      p: "Uma denúncia de atividade irregular de drone deve conter, entre outros elementos:",
      c: "Descrição sucinta, data e hora, e documentos/fotos/vídeos que identifiquem a aeronave e o responsável pela operação",
      e: [
        "Apenas o número do SISANT da aeronave envolvida",
        "Apenas o nome e o endereço do denunciante",
        "Laudo técnico da ANATEL sobre a frequência usada",
        "Autorização judicial para uso das imagens",
      ],
      exp: "Materialidade (a aeronave) e autoria (quem operava) são o que permite a Organização Regional e a JJAER seguirem com o processo.",
      fonte: "ICA 100-40, arts. 67 a 69",
    },
    {
      id: "AN-147", tema: "Regulamentação", dif: "dificil",
      p: "Um órgão de segurança pública quer voar BVLOS em operação aérea especial. O que a norma exige?",
      c: "Que o órgão esteja acreditado pelo DECEA como de resposta imediata, com espaço aéreo segregado e Acordo Operacional prévio",
      e: [
        "Nada além da solicitação com 30 minutos de antecedência",
        "Apenas a presença de observador no local do voo",
        "Apenas o registro do voo em até 24 horas depois",
        "Apenas a ARO assinada pelo comandante-geral",
      ],
      exp: "Operação aérea especial 'normal' é limitada a 25 kg, VLOS e 400 ft. Ultrapassar isso exige acreditação, segregação e AOp — arts. 45 e 46.",
      fonte: "ICA 100-40, arts. 44 a 46",
    },
    {
      id: "AN-148", tema: "Espaço aéreo", dif: "facil",
      p: "Em qual fuso horário o SARPAS trabalha?",
      c: "Horário de Brasília — Rondônia está 1 hora atrás",
      e: [
        "Horário local de cada estado",
        "Horário UTC (Zulu), como nos planos de voo",
        "Horário de Manaus, sede do CINDACTA IV",
        "Horário do fuso do aeródromo mais próximo",
      ],
      exp: "Erro clássico: pedir '16h50' pensando no horário local quando em Brasília já são 17h50 — o sistema não retrocede e o pedido é negado.",
      fonte: "Apostila 04, seção 10 (bizus do SARPAS)",
    },
    {
      id: "AN-149", tema: "Documentação", dif: "medio",
      p: "Onde a ARO deve estar durante a operação?",
      c: "Rubricada em todas as folhas, digital ou impressa, dentro da maleta do drone ou na pasta da equipe",
      e: [
        "Arquivada na seção administrativa da unidade",
        "Anexada ao processo no SARPAS, apenas em meio digital",
        "Com o comandante da operação, na viatura",
        "Publicada em boletim interno antes do voo",
      ],
      exp: "Documento que fica na gaveta não serve na hora da fiscalização ou do incidente. A ARO acompanha a operação.",
      fonte: "Apostila 06, seção 8",
    },
    {
      id: "AN-150", tema: "Regulamentação", dif: "dificil",
      p: "Por que a autorização SARPAS importa juridicamente quando o drone produz prova de um flagrante?",
      c: "Porque a operação irregular abre discussão sobre a licitude da prova derivada, e a autorização documentada fecha essa porta",
      e: [
        "Porque sem ela as imagens não podem ser anexadas ao inquérito",
        "Porque a autorização transfere à Aeronáutica a responsabilidade pela prova",
        "Porque a ANAC precisa validar as imagens antes do uso judicial",
        "Porque a prova só vale se o drone estiver homologado pela ANATEL",
      ],
      exp: "A tese dos 'frutos da árvore envenenada' (CPP, art. 157, §1º) é discutível no caso do drone e ainda não tem jurisprudência firme — mas operação autorizada e documentada evita o debate. Para o voo feito em urgência, o caminho é o registro em 24 h, não a omissão.",
      fonte: "Apostila 04, seção 11",
    },
    {
      id: "AN-151", tema: "Cadastro", dif: "facil",
      p: "O que o SARPAS entrega ao final de uma solicitação aprovada?",
      c: "A autorização com as condicionantes, o polígono da área e um QR Code para fiscalização",
      e: [
        "O certificado de aeronavegabilidade da aeronave",
        "O número de cadastro SISANT da aeronave",
        "O comprovante de homologação ANATEL do equipamento",
        "A apólice do seguro RETA da operação",
      ],
      exp: "A autorização fica guardada no sistema e é o documento que legitima o piloto em campo.",
      fonte: "Apostila 04, seção 10",
    },
    {
      id: "AN-152", tema: "Regulamentação", dif: "medio",
      p: "Quem responde pela veracidade e pela precisão das informações prestadas na solicitação de acesso ao espaço aéreo?",
      c: "O solicitante, integralmente",
      e: [
        "A Organização Regional que analisou o pedido",
        "O Administrador SARPAS da instituição",
        "O comandante da operação que assinou a ordem de serviço",
        "O DECEA, que emitiu a autorização",
      ],
      exp: "É o art. 58. Informar área ou altura diferente da real não é detalhe: é responsabilidade do solicitante.",
      fonte: "ICA 100-40, art. 58",
    },
    {
      id: "AN-153", tema: "Radiofrequência", dif: "medio",
      p: "O que é o enlace por fibra óptica usado em drones de guerra e por que ele é relevante para a discussão de autonomia?",
      c: "É um enlace imune a bloqueio eletrônico; quando o cabo é cortado e a aeronave segue sozinha, a operação passa a ser autônoma — vedada no Brasil",
      e: [
        "É um sistema de transmissão de vídeo em 4K sem perda de qualidade",
        "É um tipo de antena que aumenta o alcance do rádio em 20 vezes",
        "É o cabo que liga o controle ao celular do piloto",
        "É um jammer embarcado que protege a aeronave",
      ],
      exp: "Fibra resolve o jamming, mas o modelo em que o piloto perde o comando depois de 'adquirir o alvo' é operação autônoma — a lei brasileira exige poder intervir a qualquer momento.",
      fonte: "Apostila 02, seção 8; Apostila 05, seção 9",
    },
    {
      id: "AN-154", tema: "Conceitos", dif: "facil",
      p: "O que significa EVLOS?",
      c: "Operação em que o contato visual com a aeronave é mantido por observador(es) em comunicação direta com o piloto",
      e: [
        "Operação sem qualquer contato visual, só pela tela",
        "Operação com dois pilotos alternando o comando",
        "Operação a menos de 30 metros de terceiros anuentes",
        "Operação em espaço aéreo segregado",
      ],
      exp: "O RBAC 100 admite VLOS ou EVLOS na categoria aberta. A ICA 100-40 não usa a sigla: fala em 'VLOS estendida' com observador, que para o DECEA continua sendo VLOS.",
      fonte: "RBAC 100, 100.5(a)(1); ICA 100-40, art. 24",
    },
    {
      id: "AN-155", tema: "Documentação", dif: "facil",
      p: "Na matriz de risco, o que o nível de severidade 'A' representa?",
      c: "Catastrófico: morte de múltiplas pessoas",
      e: [
        "Insignificante: somente danos ao equipamento",
        "Pequeno: danos a objetos e lesões leves",
        "Crítico: morte de uma pessoa ou lesão incapacitante",
        "Significativo: lesões sérias, sem sequela permanente",
      ],
      exp: "A escala vai de A (catastrófico) a E (insignificante). Crítico é B; significativo, C; pequeno, D.",
      fonte: "IS nº E94-003 (Apostila 06, seção 3)",
    },
    {
      id: "AN-156", tema: "Documentação", dif: "medio",
      p: "Na matriz de risco, o que o nível de probabilidade '1' descreve?",
      c: "Muito improvável: é quase impossível que o evento ocorra",
      e: [
        "Frequente: é provável que ocorra muitas vezes",
        "Ocasional: é provável que ocorra algumas vezes",
        "Remoto: improvável, mas possível, ocorrendo raramente",
        "Improvável: bastante improvável, sem notícia de ter ocorrido",
      ],
      exp: "5 é frequente; 4 ocasional; 3 remoto; 2 improvável; 1 muito improvável. A probabilidade mede a chance da CONSEQUÊNCIA do perigo, não do perigo em si.",
      fonte: "IS nº E94-003 (Apostila 06, seção 3)",
    },
    {
      id: "AN-157", tema: "Segurança operacional", dif: "dificil",
      p: "Num evento com público, o organizador incluiu no ingresso a concordância com a filmagem por drone. O que isso muda?",
      c: "As pessoas que aceitaram passam a ser anuentes, o que afasta o limite dos 30 metros em relação a elas",
      e: [
        "Nada: o limite de 30 metros é absoluto em qualquer situação",
        "Permite voar sem autorização de acesso ao espaço aéreo",
        "Dispensa a Avaliação de Risco Operacional do evento",
        "Transfere ao organizador a responsabilidade pelo voo",
      ],
      exp: "O limite protege terceiros não envolvidos e NÃO anuentes. Anuência resolve o requisito da distância — não resolve espaço aéreo, ARO nem responsabilidade do piloto.",
      fonte: "RBAC 100 / IS nº E94-003 (Apostila 05, seção 2)",
    },
    {
      id: "AN-158", tema: "Segurança operacional", dif: "medio",
      p: "Agentes de segurança pública atuando na operação contam para o limite de 30 metros de pessoas não anuentes?",
      c: "Não: eles são pessoas envolvidas na operação",
      e: [
        "Sim, como qualquer pessoa no solo",
        "Sim, se não estiverem fardados",
        "Só contam se estiverem a menos de 10 metros",
        "Só contam em operações noturnas",
      ],
      exp: "A regra protege quem é alheio à operação. A equipe (piloto, observador, segurança) e os policiais empenhados estão dentro dela.",
      fonte: "Apostila 05, seção 2",
    },
    {
      id: "AN-159", tema: "Emergências", dif: "medio",
      p: "O enlace caiu e a aeronave iniciou o RTH. No meio do caminho o sinal voltou. O que o piloto pode fazer?",
      c: "Reassumir o comando — mas, se o controle estiver com bateria crítica, deixar a aeronave concluir o retorno automático",
      e: [
        "Nada: depois de iniciado, o RTH não pode ser interrompido",
        "Desligar o controle para não gerar comando conflitante",
        "Pousar imediatamente onde a aeronave estiver",
        "Trocar para o modo esportivo para acelerar o retorno",
      ],
      exp: "Recuperado o enlace, o piloto retoma. O que não se faz é brigar com a aeronave quando o problema é o controle descarregando.",
      fonte: "Apostila 04, seção 13",
    },
    {
      id: "AN-160", tema: "Emergências", dif: "facil",
      p: "Quais são os três comportamentos normalmente programáveis para a perda de sinal?",
      c: "Retornar (RTH), pairar ou pousar",
      e: [
        "Desligar os motores, pousar ou girar em círculos",
        "Acelerar, subir ou descer verticalmente",
        "Gravar vídeo, tirar foto ou acender o estrobo",
        "Trocar de frequência, reduzir potência ou desligar",
      ],
      exp: "O mais importante é o RTH. E o FPV montado normalmente não tem RTH: acabou a bateria, ele simplesmente para de voar.",
      fonte: "Apostila 04, seção 13; Apostila 05, seção 8",
    },
    /* ------- DIREITO AERONÁUTICO / OACI ------- */
    {
      id: "AN-170", tema: "Direito aeronáutico", dif: "facil",
      p: "Qual convenção internacional de 1944 estabeleceu as bases do Direito Aeronáutico e deu origem à OACI?",
      c: "Convenção de Chicago (Convenção sobre Aviação Civil Internacional)",
      e: [
        "Convenção de Montreal, de 1999",
        "Convenção de Varsóvia, de 1929",
        "Convenção de Tóquio, de 1963",
        "Convenção de Genebra, de 1949",
      ],
      exp: "Assinada em 1944 por 54 países, inclusive o Brasil; a OACI foi criada em 1947, com sede em Montreal.",
      fonte: "OACI Doc 7300; Apostila 01, seção 3",
    },
    {
      id: "AN-171", tema: "Direito aeronáutico", dif: "medio",
      p: "O artigo 8º da Convenção de Chicago é a base de qual regra aplicada aos drones no Brasil?",
      c: "De que nenhuma aeronave capaz de voar sem piloto pode sobrevoar o território de um Estado sem autorização especial",
      e: [
        "De que toda aeronave deve ter seguro de responsabilidade civil",
        "De que o piloto deve falar inglês em voos internacionais",
        "De que o espaço aéreo é livre acima de 120 metros",
        "De que a investigação de acidentes tem fim exclusivo de prevenção",
      ],
      exp: "É daí que vem a exigência de autorização do Estado — no Brasil, dada pelo DECEA via SARPAS, inclusive para aeronaves de até 250 g.",
      fonte: "ICA 100-40, art. 7º, XIX; Apostila 01, seção 3",
    },
    {
      id: "AN-172", tema: "Direito aeronáutico", dif: "medio",
      p: "Qual documento da OACI, de 2015, serve de base para as normas nacionais sobre aeronaves remotamente pilotadas?",
      c: "Doc 10019 — Manual on Remotely Piloted Aircraft Systems (RPAS)",
      e: [
        "Doc 7300 — Convenção de Chicago",
        "Anexo 2 — Regras do Ar",
        "Doc 4444 — Gerenciamento de Tráfego Aéreo",
        "Doc 9859 — Manual de Gerenciamento da Segurança Operacional",
      ],
      exp: "O Doc 10019 saiu em 2015, mesmo ano da primeira ICA 100-40.",
      fonte: "Apostila 01, seções 3 e 4",
    },
    {
      id: "AN-173", tema: "Direito aeronáutico", dif: "facil",
      p: "Qual lei é o Código Brasileiro de Aeronáutica (CBA)?",
      c: "Lei nº 7.565, de 19 de dezembro de 1986",
      e: [
        "Lei nº 11.182, de 2005",
        "Lei nº 9.472, de 1997",
        "Decreto-lei nº 1.177, de 1971",
        "Lei nº 13.105, de 2015",
      ],
      exp: "A Lei 11.182/2005 criou a ANAC; a 9.472/1997 é da ANATEL; o Decreto-lei 1.177/1971 trata de aerolevantamento.",
      fonte: "ICA 100-40, art. 83",
    },
    {
      id: "AN-174", tema: "Regulamentação", dif: "medio",
      p: "Qual órgão regulamenta as atividades de aerolevantamento no Brasil?",
      c: "Ministério da Defesa",
      e: ["ANAC", "DECEA", "ANATEL", "IBGE"],
      exp: "Base: Decreto-lei nº 1.177/1971. Já a operação de aerolevantamento com UA também precisa de SARPAS (DECEA) e cadastro (ANAC).",
      fonte: "ICA 100-40, art. 3º; Apostila 01, seção 7",
    },

    /* ------- CATEGORIAS E CERTIFICAÇÃO ------- */
    {
      id: "AN-175", tema: "Regulamentação", dif: "medio",
      p: "O que caracteriza a categoria certificada de operação?",
      c: "Ser realizada por UA com Certificado de Tipo, sobretudo quando envolve artigos perigosos de alto risco a terceiros",
      e: [
        "Ser realizada por piloto com curso de formação reconhecido pela ANAC",
        "Ser realizada por órgão público com acreditação do DECEA",
        "Ser realizada acima de 400 pés AGL",
        "Ser realizada com aeronave acima de 25 kg de PMD",
      ],
      exp: "Certificada é 'por essência': o risco é inerente à operação (explosivo, agente químico) e só a certificação de tipo o mitiga. Peso ou altura levam à específica, não à certificada.",
      fonte: "ICA 100-40, arts. 7º, XXIII e 41; Apostila 05, seção 3",
    },
    {
      id: "AN-176", tema: "Regulamentação", dif: "dificil",
      p: "O que é um cenário padrão no RBAC 100?",
      c: "Tipo de operação da categoria específica para a qual a ANAC já definiu critérios individualizados, garantindo enquadramento previsível",
      e: [
        "A operação padrão prevista na ICA 100-40, sem procedimentos especiais",
        "O modelo de ARO distribuído pela ANAC aos operadores",
        "A autorização automática do SARPAS para operações de rotina",
        "O conjunto de checklists obrigatórios antes de cada voo",
      ],
      exp: "Exemplo dado em aula: um festival que acontece todo ano no mesmo lugar poderia ter cenário padrão definido pela ANAC, com autorização previsível. 'Operação padrão' é outro conceito, da ICA.",
      fonte: "ICA 100-40, art. 7º, XXIV; Apostila 05, seção 3",
    },
    {
      id: "AN-177", tema: "Regulamentação", dif: "medio",
      p: "Quem são considerados 'Órgãos Especiais' pela ICA 100-40?",
      c: "Órgãos dos três Poderes, em todas as esferas, e os que prestam serviços essenciais à vida ou à redução do sofrimento",
      e: [
        "Somente as Forças Armadas e as polícias militares",
        "Somente órgãos federais de segurança pública",
        "Qualquer empresa com contrato com a administração pública",
        "Somente a Defesa Civil e o Corpo de Bombeiros",
      ],
      exp: "A lista inclui água potável, energia, assistência médica, saneamento, QBRN, apoio a acidentes, infraestrutura aeroportuária, calamidades, emergência ambiental e mineração.",
      fonte: "ICA 100-40, art. 42",
    },
    {
      id: "AN-178", tema: "Regulamentação", dif: "dificil",
      p: "Quais órgãos, além das Forças Armadas, a norma lista como de 'necessidade de resposta imediata' — e que precisam ser acreditados pelo DECEA?",
      c: "Segurança Pública, Defesa Civil, Força Nacional, Guardas Municipais, Receita Federal, institutos de criminalística/medicina legal/identificação, inteligência de Estado e órgãos no exercício do poder de polícia administrativa",
      e: [
        "Somente Polícia Federal e Polícia Rodoviária Federal",
        "Somente polícias militares e corpos de bombeiros militares",
        "Qualquer órgão público, desde que tenha drone cadastrado",
        "Somente órgãos federais, por serem de âmbito nacional",
      ],
      exp: "A acreditação é feita pelo DECEA (decea.mil.br/drone) e é o que libera o 'privilégio' da operação aérea especial.",
      fonte: "ICA 100-40, art. 43",
    },

    /* ------- INFORMAÇÃO AERONÁUTICA / NAVEGAÇÃO ------- */
    {
      id: "AN-180", tema: "Espaço aéreo", dif: "facil",
      p: "O que é um NOTAM?",
      c: "Aviso aos aeronavegantes com informação sobre estabelecimento, condição ou modificação de instalação, serviço, procedimento ou perigo",
      e: [
        "O plano de voo apresentado ao órgão de controle",
        "A autorização de acesso ao espaço aéreo emitida pelo SARPAS",
        "O relatório de acidente aeronáutico publicado pelo CENIPA",
        "O boletim meteorológico de aeródromo",
      ],
      exp: "NOTAM é aviso; consulta no AISWEB faz parte do planejamento do voo (art. 73, VI).",
      fonte: "ICA 100-40, art. 7º, XX",
    },
    {
      id: "AN-181", tema: "Espaço aéreo", dif: "medio",
      p: "Qual portal do DECEA se consulta para ver NOTAM, cartas, aeródromos, helipontos e espaços aéreos condicionados?",
      c: "AISWEB",
      e: ["SARPAS NG", "SISANT", "Mosaico", "Contas DECEA"],
      exp: "AISWEB é informação aeronáutica. SARPAS é solicitação de voo; SISANT é cadastro da aeronave na ANAC; Mosaico é homologação na ANATEL.",
      fonte: "Apostila 08, seção 2",
    },
    {
      id: "AN-182", tema: "Espaço aéreo", dif: "medio",
      p: "O que é uma Área Adequada, criada pelo DECEA?",
      c: "Espaço aéreo em que os parâmetros de solicitação são flexibilizados mediante condicionantes, com dispensa de Termo de Coordenação e prazo de 30 minutos",
      e: [
        "Área em que o voo de UA é proibido a qualquer tempo",
        "Área reservada exclusivamente a operações militares",
        "Área de uso recreativo cadastrada por clube de aeromodelismo",
        "Área em que o drone pode voar sem qualquer autorização",
      ],
      exp: "Quem cria é a Organização Regional, depois de avaliar o impacto. Dispensa o TCo (art. 28, parágrafo único) e cai para 30 minutos de antecedência.",
      fonte: "ICA 100-40, arts. 17, 18 e 57, I, c",
    },
    {
      id: "AN-183", tema: "Espaço aéreo", dif: "dificil",
      p: "Na FRZ de aeroporto, por que a coluna de distâncias da operação aérea especial é menor que a da operação padrão?",
      c: "Porque a norma reconhece a urgência da operação de segurança pública e reduz o afastamento exigido para cada faixa de altura",
      e: [
        "Porque a operação aérea especial voa sempre abaixo de 30 metros",
        "Porque a segurança pública está isenta de respeitar a FRZ",
        "Porque a operação especial é sempre BVLOS",
        "Porque a tabela considera apenas aeródromos sem tráfego IFR",
      ],
      exp: "São as colunas das Figuras 2 e 3: a mesma altura é liberada mais perto da pista na operação aérea especial e na operação no entorno de estrutura. Isenção não existe — a coordenação continua obrigatória.",
      fonte: "ICA 100-40, Figuras 2 e 3 (Apostila 04, seção 5)",
    },
    {
      id: "AN-184", tema: "Espaço aéreo", dif: "medio",
      p: "O que é a operação 'no entorno de estrutura' definida pela ICA 100-40?",
      c: "Operação em torno de estrutura ou obstáculo, limitada a 5 m acima da altura dele e a até 30 m de afastamento horizontal",
      e: [
        "Operação a menos de 30 metros de pessoas, com barreira mecânica",
        "Operação dentro de edificação, em área confinada",
        "Operação em torno de aeródromo, com Termo de Coordenação",
        "Operação de inspeção com aeronave acima de 25 kg",
      ],
      exp: "É uma categoria de operação com tabela própria de afastamento na FRZ — inspeção de torre, ponte, prédio.",
      fonte: "ICA 100-40, art. 7º, XLII",
    },

    /* ------- APLICAÇÃO PRÁTICA / POLICIAL ------- */
    {
      id: "AN-186", tema: "Segurança operacional", dif: "medio",
      p: "Um drone com dispositivo de soltura de carga foi apreendido com facção criminosa. Por que isso preocupa operacionalmente?",
      c: "Porque um drone comum de porte médio carrega mais de 1 kg e o dispositivo é barato e fácil de adaptar, inclusive para explosivo",
      e: [
        "Porque o dispositivo interfere no enlace dos drones policiais",
        "Porque o dispositivo é proibido de ser vendido no Brasil",
        "Porque o dispositivo impede o RTH da aeronave",
        "Porque o dispositivo exige certificação da ANATEL",
      ],
      exp: "São vendidos como acessório de 'entrega de presente', custam em torno de R$ 50 e funcionam com acionamento próprio ou pelo sensor de luz do drone. Já foram usados contra rivais e contra viaturas.",
      fonte: "Apostila 05, seção 10",
    },
    {
      id: "AN-187", tema: "Segurança operacional", dif: "dificil",
      p: "Um drone com artefato explosivo ameaça pessoas numa ocorrência. A intervenção policial para derrubá-lo se justifica com base em quê?",
      c: "Na legítima defesa de terceiros, com tudo fundamentado e registrado por escrito",
      e: [
        "Na proteção da privacidade dos moradores da área",
        "No poder de polícia administrativa sobre o espaço aéreo",
        "Na autorização automática que a operação aérea especial confere",
        "No direito de apreensão de bem usado em crime",
      ],
      exp: "A derrubada de drone por privacidade é ilícita; o que muda o quadro é o risco à vida. E ainda fica aberta a discussão do dano causado pela queda — tudo tem de ser documentado.",
      fonte: "Apostila 05, seção 12",
    },
    {
      id: "AN-188", tema: "Segurança operacional", dif: "medio",
      p: "Por que órgãos estaduais que já compraram canhões antidrone ainda não podem usá-los livremente?",
      c: "Porque o uso depende de convênio com a Aeronáutica e de regularização junto a ANATEL, ANAC e DECEA",
      e: [
        "Porque o equipamento precisa de laudo do CENIPA",
        "Porque só a Polícia Federal pode operar esse tipo de equipamento",
        "Porque falta decisão judicial autorizando o uso",
        "Porque o equipamento ainda não tem fornecedor no Brasil",
      ],
      exp: "O canhão/jammer atua no espectro: bloqueia tudo o que é radiocontrolado em volta, inclusive equipamento médico. Daí a exigência de regularização.",
      fonte: "Apostila 05, seção 12",
    },
    {
      id: "AN-189", tema: "Técnico", dif: "medio",
      p: "O que é uma NFZ (No Fly Zone) e qual a diferença em relação à FRZ?",
      c: "NFZ é a área bloqueada tecnicamente pelo fabricante no software do drone; FRZ é a restrição criada pela norma do DECEA",
      e: [
        "NFZ e FRZ são sinônimos, em inglês e português",
        "NFZ é criada pela ANAC e FRZ pelo DECEA",
        "NFZ vale para drones civis e FRZ para drones militares",
        "NFZ é temporária e FRZ é permanente",
      ],
      exp: "Nas atualizações recentes, várias NFZ passaram a ser só aviso: o app pergunta e o piloto confirma. O software não impede mais o erro — a norma continua valendo.",
      fonte: "ICA 100-40, art. 7º, LXVI; Apostila 04, seção 1",
    },
    {
      id: "AN-190", tema: "Técnico", dif: "facil",
      p: "Numa transmissão ao vivo da imagem do drone, para que serve a placa de captura de vídeo?",
      c: "Transformar o sinal HDMI que sai do controle em vídeo que o celular ou o PC reconhece como webcam",
      e: [
        "Aumentar o alcance do enlace de vídeo entre drone e controle",
        "Gravar o vídeo em cartão de memória em alta resolução",
        "Converter o vídeo para transmissão via satélite",
        "Reduzir o atraso da imagem no aplicativo de voo",
      ],
      exp: "E a direção importa: o HDMI vem do controle e a saída USB vai para o receptor. Invertido, não funciona — foi o erro mais comum da aula.",
      fonte: "Apostila 07, seção 1",
    },
    {
      id: "AN-191", tema: "Técnico", dif: "medio",
      p: "Numa transmissão de operação policial, qual configuração evita que a autoridade fique de fora da sala?",
      c: "Deixar a sala aberta (sem sala de espera), protegida por senha enviada junto com o link",
      e: [
        "Deixar a sala com sala de espera e um policial admitindo cada pessoa",
        "Transmitir pelo YouTube em modo público",
        "Enviar o link só depois do fim da operação",
        "Usar videochamada de WhatsApp com todos os interessados",
      ],
      exp: "Com lobby ativado, o piloto tem de largar o controle para admitir gente. Sala aberta com senha resolve os dois lados: acesso e segurança da informação.",
      fonte: "Apostila 07, seção 2",
    },
    {
      id: "AN-192", tema: "Técnico", dif: "dificil",
      p: "Qual é o momento correto de enviar o link da transmissão ao grupo da operação?",
      c: "Depois de testar o cabeamento e a sala e com a aeronave já decolada e estável",
      e: [
        "Antes de montar o equipamento, para a autoridade acompanhar desde o início",
        "Assim que a sala for criada, mesmo sem imagem",
        "Somente ao final, junto com o relatório da operação",
        "No momento em que a bateria entrar na faixa amarela",
      ],
      exp: "Mandar antes já deu errado: todo mundo assistindo o piloto tentando fazer a aeronave subir. A ordem é testar, decolar, confirmar com o observador e só então enviar.",
      fonte: "Apostila 07, seção 4",
    },

    /* ------- PROVA E HABILITAÇÃO ------- */
    {
      id: "AN-195", tema: "Regulamentação", dif: "facil",
      p: "Onde é feita a avaliação teórica de piloto remoto exigida pelo RBAC 100?",
      c: "No Portal de Capacitação da ANAC, on-line e gratuita, com 20 questões objetivas",
      e: [
        "Numa banca presencial em aeroclube credenciado",
        "No SARPAS NG, junto com o cadastro do piloto",
        "No portal do DECEA, com prova aplicada pelo CINDACTA",
        "Em curso pago obrigatório de 40 horas",
      ],
      exp: "Nota mínima 7 (14 de 20) e até 3 tentativas. Confira sempre o próprio portal: prazos e regra de aproveitamento de nota já mudaram.",
      fonte: "Apostila 05, seção 5; Apostila 08, seção 2",
    },
    {
      id: "AN-196", tema: "Regulamentação", dif: "medio",
      p: "Qual é o idioma exigido do piloto remoto, e quando o inglês entra?",
      c: "Português; o inglês é exigido apenas para operações internacionais",
      e: [
        "Inglês em qualquer operação, por ser o idioma da aviação",
        "Português e inglês em toda operação acima de 400 pés",
        "Português apenas em operação recreativa",
        "Não há exigência de idioma na norma",
      ],
      exp: "O inglês é o idioma global da aviação entre países — o que torna o ponto relevante para operação em faixa de fronteira.",
      fonte: "RBAC 100 (Apostila 05, seção 5)",
    },
    {
      id: "AN-197", tema: "Cadastro", dif: "medio",
      p: "O número gerado pelo cadastro da aeronave na ANAC (ex.: PP-212101663) é usado para quê?",
      c: "Para vincular a aeronave no SARPAS e nas equipes da instituição",
      e: [
        "Para comprovar a homologação do equipamento na ANATEL",
        "Para identificar o piloto remoto nas solicitações",
        "Para emitir o certificado de aeronavegabilidade",
        "Para contratar o seguro RETA da operação",
      ],
      exp: "O SARPAS só 'enxerga' a aeronave que tem número do SISANT — inclusive o drone de até 250 g. A equipe só usa a aeronave que foi vinculada a ela.",
      fonte: "Apostila 04, seção 9",
    },
    {
      id: "AN-198", tema: "Cadastro", dif: "dificil",
      p: "No SARPAS NG, quais perfis podem ser atribuídos a um integrante de equipe?",
      c: "Administrador, Solicitante e Piloto — podendo acumular mais de um, com data limite de validade",
      e: [
        "Somente Piloto e Observador",
        "Somente Administrador e Piloto",
        "Comandante, Piloto e Mecânico",
        "Titular e Suplente, sem prazo de validade",
      ],
      exp: "Quem gerencia é o Administrador; quem pede o voo é o Solicitante; quem pilota é o Piloto. O membro entra como PENDENTE até aceitar o convite, e o acesso tem validade a renovar.",
      fonte: "Ajuda DECEA — equipes no SARPAS NG (Apostila 04, seção 9)",
    },

    /* ------- EMERGÊNCIAS E CONTINGÊNCIA ------- */
    {
      id: "AN-200", tema: "Emergências", dif: "medio",
      p: "O que o plano de terminação de voo deve prever, além dos procedimentos em cada ponto de terminação?",
      c: "As aerovias, EAC, procedimentos de chegada e saída, rotas visuais, circuitos de tráfego e os crash sites",
      e: [
        "A lista de baterias e o número de ciclos de cada uma",
        "O contato do fabricante para acionamento de garantia",
        "A apólice do seguro e o valor patrimonial da aeronave",
        "O roteiro de imagens a serem captadas na missão",
      ],
      exp: "O plano existe para terminar o voo de forma controlada, minimizando dano a pessoas, propriedades e outras aeronaves.",
      fonte: "ICA 100-40, arts. 7º, LII, 74 e 75",
    },
    {
      id: "AN-201", tema: "Emergências", dif: "dificil",
      p: "Numa área saturada de sinais de rádio (show, evento com TV), qual risco vai além da simples perda de enlace?",
      c: "A aeronave pode receber comando espúrio e se deslocar sozinha, mesmo sem o piloto comandar",
      e: [
        "A bateria descarrega instantaneamente por interferência",
        "O gimbal trava e a aeronave perde estabilidade",
        "O GPS passa a indicar posição de outro país",
        "A hélice desbalanceia por vibração eletromagnética",
      ],
      exp: "Foi o caso do Carnaval de Manaus: o drone entrou em modo ATT, recebeu comando indevido da 'miríade de sinais' e foi no sino da igreja. É o mesmo princípio dos antidrone mais avançados.",
      fonte: "Apostila 05, seção 7",
    },
    {
      id: "AN-202", tema: "Emergências", dif: "facil",
      p: "Qual é a diferença entre RTH direto e RTH adaptativo?",
      c: "O direto sobe até a altura programada e volta em linha reta; o adaptativo volta com os sensores ligados, desviando dos obstáculos que 'vê'",
      e: [
        "O direto pousa no local e o adaptativo retorna ao ponto de decolagem",
        "O direto funciona sem GPS e o adaptativo depende de satélite",
        "O direto é automático e o adaptativo é comandado pelo piloto",
        "O direto só existe em drones acima de 25 kg",
      ],
      exp: "A preferência da equipe do curso é RTH direto na altura máxima (120 m): tira a variável dos sensores e passa acima dos obstáculos urbanos comuns.",
      fonte: "Apostila 05, seção 8",
    },
    {
      id: "AN-203", tema: "Emergências", dif: "medio",
      p: "Quem é responsável pela salvaguarda física da aeronave e dos equipamentos no solo, embarcados e no ar?",
      c: "O operador da aeronave",
      e: [
        "O órgão ATS da região da operação",
        "O Administrador SARPAS da instituição",
        "O observador designado para o voo",
        "O setor de patrimônio da unidade",
      ],
      exp: "É o art. 77 — e conversa com a cadeia de responsabilidade do RBAC 100: operador é quem responde legalmente pela operação.",
      fonte: "ICA 100-40, art. 77",
    },
    {
      id: "AN-204", tema: "Regulamentação", dif: "dificil",
      p: "Entidades estatais podem transportar artigo perigoso com UA?",
      c: "Sim: artigo perigoso controlado pelo Estado, sob responsabilidade própria e cumprindo as regras aplicáveis",
      e: [
        "Não: a proibição do RBAC 100 é absoluta para qualquer operador",
        "Sim, sem qualquer condição, por serem operações de Estado",
        "Somente com aeronave de PMD acima de 25 kg",
        "Somente mediante autorização judicial",
      ],
      exp: "É uma das exceções do RBAC 100, ao lado de agricultura/pecuária, baterias de lítio dos equipamentos, equipamentos de bordo e o que a ANAC autorizar. Projeto experimental (granada de gás, por exemplo) exige projeto aprovado.",
      fonte: "RBAC 100 (Apostila 05, seção 10)",
    },
    {
      id: "AN-205", tema: "Conceitos", dif: "facil",
      p: "O que é a RPS num sistema de aeronave não tripulada?",
      c: "A Estação de Pilotagem Remota: o componente que contém os equipamentos necessários à pilotagem",
      e: [
        "O receptor de posicionamento por satélite da aeronave",
        "O rádio portátil de aviação usado pelo piloto",
        "O sistema de prevenção de colisão em rota",
        "O registro de proprietário do sistema na ANAC",
      ],
      exp: "UAS = UA + RPS + enlace C2 + demais equipamentos. A RPS pode ser um controle de mão ou um computador dentro de um contêiner.",
      fonte: "ICA 100-40, art. 7º, XXXI",
    },
    {
      id: "AN-206", tema: "Conceitos", dif: "medio",
      p: "Qual é a diferença entre altitude e altura, na definição da norma?",
      c: "Altitude é a distância vertical até o nível médio do mar; altura é a distância vertical até uma determinada referência",
      e: [
        "Altitude é medida pelo controle remoto e altura pelo GPS",
        "Altitude vale para aeronave tripulada e altura para drone",
        "Altitude é a altura máxima autorizada na solicitação",
        "São sinônimos, desde que se informe a unidade em pés",
      ],
      exp: "Bizu: 'AGL' → solo; 'altitude' → nível do mar; 'altura' sem referência → relativa. O controle mostra altura em relação ao ponto de decolagem, e pode ficar negativo.",
      fonte: "ICA 100-40, art. 7º, XI e XIII",
    },
    {
      id: "AN-207", tema: "Espaço aéreo", dif: "facil",
      p: "Qual é o nome do sistema brasileiro pelo qual se solicita acesso ao espaço aéreo para aeronave não tripulada?",
      c: "SARPAS",
      e: ["SISCEAB", "SISANT", "AISWEB", "SIPAER"],
      exp: "SARPAS foi criado em 2016 e significa Sistema para Solicitação de Acesso ao Espaço Aéreo Brasileiro por Aeronaves Não Tripuladas. SISCEAB é o sistema de controle do espaço aéreo como um todo.",
      fonte: "ICA 100-40, art. 7º, LIX",
    },
    {
      id: "AN-208", tema: "Espaço aéreo", dif: "medio",
      p: "O que é a Zona UTM criada pela ICA 100-40 de 2026?",
      c: "Volume de espaço aéreo em que o acesso de UAS é garantido por serviços, regras e procedimentos específicos, com elevado nível de digitalização",
      e: [
        "A faixa de espaço aéreo entre 0 e 120 metros AGL em todo o país",
        "A área de responsabilidade de cada CINDACTA",
        "O espaço aéreo reservado a drones de entrega comercial",
        "A zona de restrição de voo em torno de aeródromos",
      ],
      exp: "UTM é o gerenciamento de tráfego de aeronaves não tripuladas — o equivalente ao ATM da aviação tripulada. Na Zona UTM o pedido pode ser feito com 30 minutos, mas a área e o tempo são limitados.",
      fonte: "ICA 100-40, art. 7º, LXVII; arts. 57 e 59",
    },
    {
      id: "AN-209", tema: "Segurança operacional", dif: "medio",
      p: "Qual é a função do policial designado como 'segurança' na equipe de operação com drone?",
      c: "Proteger a equipe, que está com a atenção voltada para o voo",
      e: [
        "Operar a câmera e registrar as imagens da ocorrência",
        "Manter contato visual com a aeronave durante todo o voo",
        "Conduzir a viatura e a logística de baterias",
        "Fiscalizar o cumprimento da autorização SARPAS",
      ],
      exp: "Piloto pilota, observador observa a aeronave e o entorno aéreo, segurança protege a equipe. Doutrina do GRAER: três policiais.",
      fonte: "Apostila 04, seção 13",
    },
  ];
  /* ======================================================================
   * (o banco 'apostilas' é acrescentado logo abaixo, no mesmo arquivo)
   * ====================================================================== */
  var QUESTOES_APOSTILAS = [
    /* ================= APOSTILA 00 — GLOSSÁRIO DE SIGLAS ================= */
    {
      id: "AP-000", ap: "00", tema: "Siglas", dif: "facil",
      p: "O que significa a sigla SARP, usada no nome do curso?",
      c: "Sistema de Aeronave Remotamente Pilotada — a tradução de RPAS",
      e: [
        "Sistema de Autorização de Radiofrequência para Pilotos",
        "Serviço Aéreo de Resposta Policial",
        "Sistema de Acesso e Registro de Pilotos",
        "Sistema Aéreo de Reconhecimento Preventivo",
      ],
      exp: "RPAS (Remotely Piloted Aircraft System) em português é SARP. O curso é o CPPSARP — Curso de Piloto Policial de SARP.",
      fonte: "Apostila 00 e Apostila 02, seção 13",
    },
    {
      id: "AP-001", ap: "00", tema: "Siglas", dif: "facil",
      p: "O que significa BVLOS?",
      c: "Beyond Visual Line of Sight — além da linha de visada visual",
      e: [
        "Basic Visual Line of Sight — linha de visada básica",
        "Beyond Very Low Operating Speed — abaixo da velocidade mínima",
        "Bilateral Voice Link Operating System — sistema de comunicação bilateral",
        "Backup Visual Line of Sight — visada visual de reserva",
      ],
      exp: "VLOS é com contato visual; EVLOS é com observador (extended); BVLOS é sem contato visual, só pela tela.",
      fonte: "Apostila 00; ICA 100-40, art. 7º, X",
    },
    {
      id: "AP-002", ap: "00", tema: "Siglas", dif: "medio",
      p: "O que significa ADS-B, sigla do sistema que alimenta o recurso AirSense?",
      c: "Automatic Dependent Surveillance–Broadcast: vigilância automática em que a aeronave transmite a própria posição",
      e: [
        "Aircraft Detection System – Basic: detecção por radar embarcado",
        "Automatic Drone Safety Beacon: estrobo automático de segurança",
        "Air Defense Surveillance Band: faixa de radiofrequência militar",
        "Automated Drone Separation Bus: separação automática entre drones",
      ],
      exp: "Como depende de a outra aeronave transmitir, o AirSense não detecta quem não tem transponder — por isso o observador continua sendo necessário.",
      fonte: "Apostila 00; Apostila 03, seção 1",
    },
    {
      id: "AP-003", ap: "00", tema: "Siglas", dif: "medio",
      p: "O que significa a sigla PMD, tão cobrada na legislação?",
      c: "Peso Máximo de Decolagem",
      e: [
        "Peso Médio Declarado",
        "Potência Máxima Disponível",
        "Plano de Missão Detalhado",
        "Piloto em Missão Designado",
      ],
      exp: "PMD é o peso máximo com que a aeronave consegue decolar e voar em segurança — inclui combustível, carga, equipamentos e acessórios.",
      fonte: "Apostila 00; ICA 100-40, art. 7º, XLIX",
    },
    {
      id: "AP-004", ap: "00", tema: "Siglas", dif: "dificil",
      p: "Qual sigla designa o órgão que julga administrativamente as infrações de tráfego aéreo?",
      c: "JJAER",
      e: ["CENIPA", "CGNA", "SIPAER", "CRCEA-SE"],
      exp: "JJAER (Junta de Julgamento da Aeronáutica) pune; CENIPA investiga para prevenir; CGNA abriga a Seção/Tático SARPAS; CRCEA-SE é Organização Regional.",
      fonte: "Apostila 00; ICA 100-40, art. 4º, §1º",
    },
    {
      id: "AP-005", ap: "00", tema: "Siglas", dif: "medio",
      p: "O que quer dizer VANT e por que o termo é considerado obsoleto?",
      c: "Veículo Aéreo Não Tripulado — caiu em desuso porque a norma atual trabalha com UA, RPA e UAS",
      e: [
        "Veículo Autônomo Não Tripulado — proibido no Brasil",
        "Vigilância Aérea Não Tripulada — uso exclusivo militar",
        "Veículo Aéreo Nacional Terrestre — categoria mista",
        "Voo Automatizado Não Tripulado — modo de operação",
      ],
      exp: "VANT e ARP aparecem em documentos antigos e na imprensa, mas a comunidade aeronáutica internacional considera os termos obsoletos.",
      fonte: "Apostila 01, seção 1",
    },

    /* ================= APOSTILA 01 — INTRODUÇÃO AO UAS ================= */
    {
      id: "AP-010", ap: "01", tema: "Conceitos", dif: "facil",
      p: "Segundo a classificação da OACI, qual é a característica da aeronave não tripulada AUTÔNOMA?",
      c: "A rota é programada previamente e não há possibilidade de intervenção manual após o início do voo",
      e: [
        "É pilotada por estação remota, com intervenção possível a qualquer momento",
        "É pilotada remotamente, mas com finalidade exclusivamente recreativa",
        "É pilotada por dois pilotos em estações diferentes",
        "É pilotada por inteligência artificial embarcada, com supervisão do piloto",
      ],
      exp: "As três categorias da OACI são UA remotamente pilotada, aeromodelo (recreativo) e autônoma. A autônoma não é objeto da regulamentação brasileira e não pode acessar o espaço aéreo.",
      fonte: "Apostila 01, seção 2; ICA 100-40, art. 19, §2º",
    },
    {
      id: "AP-011", ap: "01", tema: "Conceitos", dif: "medio",
      p: "Qual é a diferença entre aeromodelo e RPA, segundo a apostila?",
      c: "A finalidade: o aeromodelo é para lazer, mesmo tendo muitas semelhanças operacionais com a RPA",
      e: [
        "O peso: aeromodelo é sempre abaixo de 250 g",
        "A tecnologia: aeromodelo não usa GPS",
        "A altura: aeromodelo voa somente abaixo de 30 metros",
        "O piloto: aeromodelo não é pilotado remotamente",
      ],
      exp: "Os dois são pilotados remotamente. O que separa é a finalidade — e a operação recreativa tem limites próprios (60 m e 300 m).",
      fonte: "Apostila 01, seção 2",
    },
    {
      id: "AP-012", ap: "01", tema: "Espaço aéreo", dif: "medio",
      p: "Quantas Organizações Regionais do DECEA gerenciam o espaço aéreo brasileiro?",
      c: "Cinco: CINDACTA I, II, III, IV e CRCEA-SE",
      e: [
        "Quatro: CINDACTA I, II, III e IV",
        "Três: CINDACTA I, II e III",
        "Seis: cinco CINDACTA e o CGNA",
        "Duas: CINDACTA I e CRCEA-SE",
      ],
      exp: "São 4 CINDACTA e 1 CRCEA (Sudeste), que controla a região de maior fluxo do país (RJ–SP). O Brasil responde por cerca de 22 milhões de km² de espaço aéreo.",
      fonte: "Apostila 01, seção 8",
    },
    {
      id: "AP-013", ap: "01", tema: "Espaço aéreo", dif: "facil",
      p: "Em qual FIR está Rondônia?",
      c: "FIR Amazônica, sob o CINDACTA IV (Manaus)",
      e: [
        "FIR Brasília, sob o CINDACTA I",
        "FIR Curitiba, sob o CINDACTA II",
        "FIR Recife, sob o CINDACTA III",
        "FIR Atlântico, sob o CRCEA-SE",
      ],
      exp: "As solicitações de Rondônia são analisadas pelo CINDACTA IV, em Manaus — inclusive as denúncias de drone irregular.",
      fonte: "Apostila 01, seção 8",
    },
    {
      id: "AP-014", ap: "01", tema: "Conceitos", dif: "medio",
      p: "O que é o SISCEAB?",
      c: "Sistema de Controle do Espaço Aéreo Brasileiro: órgãos, radares, centros e torres de controle, telecomunicações e pessoal que garantem a segurança do fluxo aéreo",
      e: [
        "O sistema da ANAC que cadastra aeronaves não tripuladas",
        "O programa de segurança da aviação civil contra atos ilícitos",
        "A rede de aeroportos administrada pela Infraero",
        "O sistema de investigação de acidentes aeronáuticos",
      ],
      exp: "O DECEA é o Órgão Central do SISCEAB. O programa contra atos ilícitos é o AVSEC.",
      fonte: "Apostila 01, seção 8",
    },
    {
      id: "AP-015", ap: "01", tema: "Técnico", dif: "medio",
      p: "Qual é a diferença entre TCAS e DAA?",
      c: "TCAS é o sistema anticolisão já usado na aviação tripulada; DAA (detectar e evitar) é o projeto equivalente em desenvolvimento para aeronaves não tripuladas",
      e: [
        "TCAS é para drones e DAA para aviões",
        "TCAS usa radar e DAA usa câmeras térmicas",
        "TCAS é obrigatório em drones acima de 25 kg e DAA acima de 150 kg",
        "São dois nomes do mesmo sistema, em inglês e português",
      ],
      exp: "Enquanto o DAA não é realidade nos drones policiais, a detecção continua humana: é o observador que vigia o céu.",
      fonte: "Apostila 01, seção 6",
    },
    {
      id: "AP-016", ap: "01", tema: "Direito aeronáutico", dif: "dificil",
      p: "Em que ano ocorreu a primeira operação de aeronave não tripulada com a Polícia Federal no Brasil, que deu origem à AIC N 29/09?",
      c: "2009, na Tríplice Fronteira",
      e: ["2002, na Amazônia", "2015, junto com a 1ª ICA 100-40", "2016, com a criação do SARPAS", "2019, no 1º SIRESANT"],
      exp: "A linha do tempo regulatória: 2009 (PF na Tríplice Fronteira), 2015 (Doc 10019 e 1ª ICA 100-40), 2016 (SARPAS), 2017 (RBAC-E 94), 2019 (1º SIRESANT), 2026 (RBAC 100 e nova ICA 100-40).",
      fonte: "Apostila 01, seção 4",
    },
    {
      id: "AP-017", ap: "01", tema: "Regulamentação", dif: "dificil",
      p: "A apostila 01 traz um quadro de verificação sobre um slide que mistura duas gerações de regra. Qual era a classificação antiga, do RBAC-E nº 94?",
      c: "Classes 1, 2 e 3 definidas pelo peso, com CAER, CAVE e AEV",
      e: [
        "Categorias aberta, específica e certificada",
        "Operação padrão, especial e atípica",
        "VLOS, EVLOS e BVLOS",
        "Zonas ZAD, ZEA e ZEH",
      ],
      exp: "As classes por peso eram do RBAC-E 94 (revogado em 15/06/2026). As categorias por risco (aberta/específica/certificada) são do RBAC 100.",
      fonte: "Apostila 01, seção 7 (quadro de verificação)",
    },
    {
      id: "AP-018", ap: "01", tema: "Conceitos", dif: "medio",
      p: "O que significa a sigla UTM no contexto de aeronaves não tripuladas?",
      c: "Unmanned aircraft Traffic Management — gerenciamento de tráfego de aeronaves não tripuladas",
      e: [
        "Universal Transverse Mercator — sistema de coordenadas do mapa",
        "Unmanned Terrestrial Machine — veículo terrestre não tripulado",
        "Urban Traffic Monitoring — monitoramento de trânsito urbano",
        "United Tactical Mission — padrão de missão tática",
      ],
      exp: "UTM é o equivalente do ATM (tráfego tripulado) para UA. A ICA 100-40 de 2026 já criou a Zona UTM.",
      fonte: "Apostila 01, seção 10",
    },
    {
      id: "AP-019", ap: "01", tema: "Regulamentação", dif: "facil",
      p: "Segundo a apostila, quantos países são membros da OACI hoje?",
      c: "193",
      e: ["54", "120", "180", "210"],
      exp: "54 países assinaram a Convenção de Chicago em 1944; a OACI foi criada em 1947 e hoje tem 193 membros, com sede em Montreal.",
      fonte: "Apostila 01, seção 3",
    },

    /* ================= APOSTILA 02 — HISTÓRIA E EVOLUÇÃO ================= */
    {
      id: "AP-020", ap: "02", tema: "História", dif: "facil",
      p: "De onde vem a palavra 'drone'?",
      c: "Do inglês para 'zangão', por causa do zumbido do motor em voo",
      e: [
        "Do alemão, significando 'sem piloto'",
        "Da sigla militar americana DRON (Drone Reconnaissance Operational Network)",
        "Do grego, significando 'que voa longe'",
        "Do nome do primeiro fabricante de aeronaves radiocontroladas",
      ],
      exp: "O termo começou a ser usado entre a Primeira e a Segunda Guerra. É apelido popular — o termo técnico da norma brasileira é RPA, dentro do gênero UA.",
      fonte: "Apostila 02, seção 1",
    },
    {
      id: "AP-021", ap: "02", tema: "História", dif: "facil",
      p: "Qual é o marco aceito como primeiro uso de aeronave não tripulada armada na história?",
      c: "O ataque austríaco a Veneza, em 1849, com balões carregados de explosivos",
      e: [
        "A 'Bomba Voadora' norte-americana, em 1918",
        "O Queen Bee britânico, em 1935",
        "A V-1 alemã, em 1944",
        "O MQ-1 Predator armado, em 2001",
      ],
      exp: "Os balões eram levados pelo vento, com bombas liberadas por pavio temporizado — e muitos voltaram sobre as próprias linhas austríacas com a mudança do vento.",
      fonte: "Apostila 02, seção 2",
    },
    {
      id: "AP-022", ap: "02", tema: "História", dif: "medio",
      p: "A apostila corrige uma informação do slide sobre o 'Queen Bee' (DH.82B). Qual é a correção?",
      c: "Ele era britânico e servia de ALVO aéreo para treinar a artilharia antiaérea — não era um caçador de aeronaves espiãs dos EUA",
      e: [
        "Ele era alemão e foi o primeiro míssil teleguiado",
        "Ele era americano e foi o primeiro drone de reconhecimento armado",
        "Ele era francês e deu origem ao Matra MILAN",
        "Ele era soviético e serviu de base para o satélite Zenit",
      ],
      exp: "O apelido 'abelha-rainha' é a origem mais aceita do termo drone: os americanos batizaram seus próprios alvos radiocontrolados de 'drones' em referência ao britânico.",
      fonte: "Apostila 02, seção 3 (verificação)",
    },
    {
      id: "AP-023", ap: "02", tema: "História", dif: "medio",
      p: "Quem é chamado de 'pai do drone moderno' e qual foi a contribuição dele?",
      c: "Abraham Karem, que na garagem criou o Albatross com poucos recursos e deu origem à linhagem que levou ao MQ-1 Predator",
      e: [
        "Frank Wang, fundador da DJI, que popularizou o quadricóptero civil",
        "Reginald Denny, criador do Radioplane OQ-2",
        "Archibald Low, do Aerial Target britânico",
        "Charles Kettering, do Kettering Bug",
      ],
      exp: "Karem criticava o programa Aquila, que exigia 30 pessoas para controlar um drone e voava poucos minutos. Do Albatross saíram o Amber e o GNAT-750, base do Predator.",
      fonte: "Apostila 02, seção 4",
    },
    {
      id: "AP-024", ap: "02", tema: "História", dif: "dificil",
      p: "Qual foi o primeiro VANT brasileiro e para que servia?",
      c: "O BQM1BR, fabricado pela CBT, com primeiro voo em 1983, usado como alvo para treinamento militar",
      e: [
        "O Albatross, fabricado pela Embraer em 1977",
        "O Harpia, da Força Aérea Brasileira, de 1995",
        "O Carcará, da Santos Lab, de 2008",
        "O Nauru 1000C, da AGX, de 2010",
      ],
      exp: "Tinha 3,89 m de comprimento e 3,38 m de envergadura, era movido a jato e não tinha câmera: a única — e fatal — utilidade era servir de alvo.",
      fonte: "Apostila 02, seção 5",
    },
    {
      id: "AP-025", ap: "02", tema: "História", dif: "medio",
      p: "Em 1982, o que consolidou o valor militar dos drones no mundo?",
      c: "A operação israelense no Vale do Bekaa, usando drones como iscas e sensores para destruir radares antiaéreos sírios com perdas mínimas",
      e: [
        "O primeiro ataque com Predator armado, no Afeganistão",
        "A criação da DJI na China",
        "O primeiro voo do BQM1BR no Brasil",
        "A entrada em serviço da V-1 alemã",
      ],
      exp: "Israel usou IAI Scout e Tadiran Mastiff. Foi o episódio que convenceu as forças armadas do mundo.",
      fonte: "Apostila 02, seção 5",
    },
    {
      id: "AP-026", ap: "02", tema: "História", dif: "dificil",
      p: "A apostila corrige a data do slide sobre o MQ-1 Predator. Quando ele voou e entrou em serviço?",
      c: "Primeiro voo em 1994 e entrada em serviço em 1995 — não na década de 1950",
      e: [
        "Primeiro voo em 1950 e serviço em 1951",
        "Primeiro voo em 1977, com Abraham Karem",
        "Primeiro voo em 2001, já armado",
        "Primeiro voo em 1982, na Guerra do Líbano",
      ],
      exp: "Na década de 1950 o marco americano é o Ryan Firebee (1951), primeiro drone a jato, alvo aéreo depois adaptado para reconhecimento.",
      fonte: "Apostila 02, seção 7 (verificação)",
    },
    {
      id: "AP-027", ap: "02", tema: "História", dif: "facil",
      p: "Em que ano e por quem foi fundada a DJI?",
      c: "Em 2006, na China, por Frank Wang (Wang Tao)",
      e: [
        "Em 1985, nos EUA, pela Horizon Hobby",
        "Em 2013, pela Amazon, para o projeto Prime Air",
        "Em 2014, na Suíça, pela Flyability",
        "Em 1995, pela General Atomics",
      ],
      exp: "Dà-Jiāng Innovations Science and Technology. Hoje domina o mercado de segurança pública: está presente em mais de dois terços das agências pesquisadas.",
      fonte: "Apostila 02, seções 7 e 12",
    },
    {
      id: "AP-028", ap: "02", tema: "História", dif: "medio",
      p: "O que a empresa suíça Flyability trouxe de novo em 2014?",
      c: "Drones para espaços confinados, que se localizam sem depender de GPS e usam gaiola protetora",
      e: [
        "O primeiro drone com câmera térmica integrada",
        "O primeiro drone de entrega comercial autorizado",
        "O primeiro sistema antidrone portátil",
        "O primeiro drone com enlace por fibra óptica",
      ],
      exp: "É a mesma lógica dos FPV com sensores visuais ou LiDAR: dentro de estrutura colapsada não há GPS, e a aeronave precisa se localizar pelo que 'vê'. A gaiola permite encostar em paredes.",
      fonte: "Apostila 02, seção 7",
    },
    {
      id: "AP-029", ap: "02", tema: "Técnico", dif: "medio",
      p: "Segundo a apostila, como funciona um jammer usado como arma antidrone?",
      c: "Detecta e classifica o sinal, localiza drone e piloto e interrompe o vínculo de rádio, fazendo a aeronave parar, pousar ou retornar",
      e: [
        "Emite pulso eletromagnético que queima a eletrônica da aeronave",
        "Dispara projétil que envolve as hélices numa rede",
        "Assume o controle da câmera para identificar o operador",
        "Bloqueia apenas o sinal de GPS, sem afetar o enlace de comando",
      ],
      exp: "Os sistemas mais avançados vão além: quebram o enlace e assumem o comando, trazendo a aeronave até o operador do antidrone.",
      fonte: "Apostila 02, seção 9",
    },
    {
      id: "AP-030", ap: "02", tema: "Segurança operacional", dif: "medio",
      p: "Por que o drone FPV é o indicado para ação tática ou busca em ambiente colapsado?",
      c: "Porque se localiza por sensores visuais ou LiDAR embarcados, sem depender de GPS, ao contrário das linhas Mavic, Enterprise e Matrice",
      e: [
        "Porque tem a maior autonomia de bateria entre os modelos",
        "Porque é o único que pode voar sem autorização do DECEA",
        "Porque transmite imagem em 4K sem atraso",
        "Porque tem RTH mais preciso que os demais modelos",
      ],
      exp: "Drones comuns precisam de GPS para se posicionar e por isso não atuam bem dentro de ambiente confinado.",
      fonte: "Apostila 05, seção 1; Apostila 02, seção 10",
    },
    {
      id: "AP-031", ap: "02", tema: "Segurança operacional", dif: "medio",
      p: "Qual uso do alto-falante acoplado ao drone a apostila destaca como um dos mais eficazes?",
      c: "Conduzir negociação e levar à rendição sem expor o negociador ao risco",
      e: [
        "Afastar animais da área de pouso",
        "Emitir alarme sonoro para localizar a aeronave perdida",
        "Orientar o trânsito em acidentes rodoviários",
        "Transmitir ordens à equipe em campo, substituindo o rádio",
      ],
      exp: "Comunicação direta com a pessoa, sem aproximar o negociador. O holofote e o estrobo são os outros acessórios modulares.",
      fonte: "Apostila 02, seção 10",
    },
    {
      id: "AP-032", ap: "02", tema: "Técnico", dif: "dificil",
      p: "O que caracteriza os drones de fibra óptica que apareceram em 2025 na guerra da Ucrânia?",
      c: "Conexão por cabo de fibra, imune a interferência eletrônica, com alcance limitado ao comprimento do cabo",
      e: [
        "Conexão por satélite, com alcance global",
        "Enlace criptografado em 5G, imune a jammer",
        "Voo totalmente autônomo por inteligência artificial",
        "Transmissão por rádio em frequência militar reservada",
      ],
      exp: "Vantagens: imunidade a bloqueio, alcance de até 20 km e vídeo de alta qualidade. Limitações: peso da bobina, risco de enrosco e alcance preso ao cabo.",
      fonte: "Apostila 02, seção 8",
    },
    {
      id: "AP-033", ap: "02", tema: "História", dif: "dificil",
      p: "Segundo a verificação da apostila, o que era o Henschel Hs 293, citado no slide como 'primeiro míssil teleguiado' de 1935?",
      c: "Uma bomba planadora antinavio guiada por rádio, desenvolvida a partir de 1940 e usada em combate em 1943",
      e: [
        "Um avião radiocontrolado usado como alvo aéreo",
        "Um balão-bomba lançado pela corrente de jato",
        "O primeiro míssil de cruzeiro com piloto automático",
        "Um satélite espião de reconhecimento fotográfico",
      ],
      exp: "Em 1935, o marco do ano é o Queen Bee britânico. A V-1 (1944), por sua vez, não era pilotada remotamente: voava com piloto automático e é precursora dos mísseis de cruzeiro.",
      fonte: "Apostila 02, seção 7 (verificações)",
    },
    {
      id: "AP-034", ap: "02", tema: "História", dif: "facil",
      p: "Qual foi o impacto da pandemia de COVID-19 no uso de drones, segundo a apostila?",
      c: "Impulsionou entregas de suprimentos médicos, medição de temperatura, orientação por alto-falante e desinfecção de áreas públicas",
      e: [
        "Suspendeu todas as operações civis com drone no Brasil",
        "Levou a ANAC a criar as categorias por risco",
        "Provocou a proibição de drones em áreas urbanas",
        "Deu origem ao uso de drones com câmera térmica",
      ],
      exp: "Os 'drones SOS' levavam insumos a áreas de difícil acesso ou de risco de contágio, reduzindo a exposição de profissionais de saúde.",
      fonte: "Apostila 02, seção 7 (2020)",
    },
    {
      id: "AP-035", ap: "02", tema: "Regulamentação", dif: "medio",
      p: "Qual é a conclusão da apostila 02 sobre a relação entre tecnologia e legislação?",
      c: "A tecnologia avança mais rápido que a legislação, e por isso é preciso conferir a regulamentação vigente da ANAC, do DECEA e da ANATEL antes de qualquer emprego",
      e: [
        "A legislação brasileira está à frente da tecnologia disponível",
        "A norma internacional dispensa a consulta às normas nacionais",
        "O piloto pode aplicar por analogia as regras da aviação tripulada",
        "Enquanto não houver norma específica, o uso é livre",
      ],
      exp: "Existem protótipos totalmente autônomos, mas a lei brasileira exige sempre um piloto capaz de intervir.",
      fonte: "Apostila 02, seção 14",
    },
    /* ================= APOSTILA 03 — COMPONENTES E APLICAÇÕES ================= */
    {
      id: "AP-040", ap: "03", tema: "Técnico", dif: "facil",
      p: "O Mavic 2 Enterprise possui câmera térmica integrada?",
      c: "Não: a versão térmica é o Mavic 2 Enterprise Dual (e depois veio o Advanced)",
      e: [
        "Sim, de fábrica, em todas as unidades",
        "Sim, mas só a partir da segunda geração do modelo",
        "Sim, como acessório modular acoplado na parte superior",
        "Não, e nenhuma versão do Mavic 2 tem câmera térmica",
      ],
      exp: "O Mavic 2 Enterprise tem interface superior para acessórios modulares: holofote, alto-falante e estrobo.",
      fonte: "Apostila 03, seção 2",
    },
    {
      id: "AP-041", ap: "03", tema: "Técnico", dif: "facil",
      p: "Quais são os três acessórios modulares do Mavic 2 Enterprise citados na apostila?",
      c: "Holofote (spotlight), alto-falante (speaker) e estrobo (beacon)",
      e: [
        "Câmera térmica, LiDAR e paraquedas",
        "Lançador de carga, farol e antena direcional",
        "Rádio VHF, transponder ADS-B e GPS RTK",
        "Protetor de hélice, trem de pouso alto e gaiola",
      ],
      exp: "O estrobo tem função normativa: à noite, as luzes de navegação não são dispensadas (ICA 100-40, art. 20, §4º).",
      fonte: "Apostila 03, seção 2",
    },
    {
      id: "AP-042", ap: "03", tema: "Técnico", dif: "medio",
      p: "Segundo o comparativo da apostila, qual é a autonomia máxima do Matrice 350 RTK?",
      c: "Até 55 minutos",
      e: ["Até 31 minutos", "Até 45 minutos", "Até 70 minutos", "Até 25 minutos"],
      exp: "No comparativo: Mavic 2 Enterprise até 31 min, Mavic 3 Enterprise/3T até 45 min e Matrice 350 RTK até 55 min.",
      fonte: "Apostila 03, seção 6",
    },
    {
      id: "AP-043", ap: "03", tema: "Técnico", dif: "medio",
      p: "Qual sistema de transmissão equipa o Mavic 3 Enterprise e o Matrice 350 RTK?",
      c: "O3 Enterprise",
      e: ["OcuSync 2.0", "Lightbridge 2", "WiFi 6 dual-band", "OcuSync 1.0"],
      exp: "O Mavic 2 Enterprise usa OcuSync 2.0 (até 8 km); o Mavic 3E/3T, O3 Enterprise (até 15 km); o M350, O3 Enterprise (até 20 km) — todos em condição ideal, padrão FCC.",
      fonte: "Apostila 03, seção 6",
    },
    {
      id: "AP-044", ap: "03", tema: "Técnico", dif: "dificil",
      p: "A apostila 03 traz uma verificação sobre a linha de 'peso' do slide comparativo. Qual é o problema apontado?",
      c: "O slide mistura peso da aeronave com peso máximo de decolagem — por exemplo, os 6,47 kg do Matrice 350 são o peso com duas baterias TB65, enquanto o PMD dele é de 9,2 kg",
      e: [
        "O slide inverteu os pesos do Mavic 2 e do Mavic 3",
        "O slide usou libras em vez de quilogramas",
        "O slide considerou o peso sem bateria em todos os modelos",
        "O slide somou o peso do controle remoto ao da aeronave",
      ],
      exp: "É a confusão que a Apostila 05 ensina a separar: o fabricante divulga peso, a legislação analisa PMD. No Mavic 3E/3T, 1.050 g é de fato o PMD.",
      fonte: "Apostila 03, seção 6 (verificação)",
    },
    {
      id: "AP-045", ap: "03", tema: "Técnico", dif: "medio",
      p: "Qual equipamento da lista do curso tem LiDAR frontal?",
      c: "DJI Neo 2 (FPV, usado com os Goggles N3)",
      e: ["Mavic 2 Enterprise", "Mavic 3 Enterprise", "Matrice 350 RTK", "Mavic 2 Enterprise Dual"],
      exp: "LiDAR mede distância por laser e melhora a detecção de obstáculo com baixa luminosidade — daí o uso em FPV e ambiente confinado.",
      fonte: "Apostila 03, seção 1",
    },
    {
      id: "AP-046", ap: "03", tema: "Técnico", dif: "medio",
      p: "Qual é a função do 'botão de autoridade da aeronave' presente no RC Plus do Matrice 350?",
      c: "Tomar o controle da aeronave com segurança na troca de piloto (handover)",
      e: [
        "Autorizar a decolagem depois do checklist",
        "Liberar o voo em zona restrita pelo fabricante",
        "Ativar o modo de voo esportivo",
        "Confirmar a autorização SARPAS no aplicativo",
      ],
      exp: "É o recurso que materializa o handover exigido pelo RBAC 100: a troca só acontece por procedimento claro, sem duplicidade de comando.",
      fonte: "Apostila 03, seção 7; Apostila 05, seção 6",
    },
    {
      id: "AP-047", ap: "03", tema: "Técnico", dif: "facil",
      p: "Para que serve o gimbal?",
      c: "Manter a câmera estável, em três eixos, independentemente dos movimentos da aeronave",
      e: [
        "Aumentar o zoom óptico da câmera",
        "Proteger a lente contra chuva e poeira",
        "Medir a distância até o solo no pouso",
        "Transmitir a imagem ao controle remoto",
      ],
      exp: "É o estabilizador. Sem ele, a imagem seguiria cada inclinação do drone.",
      fonte: "Apostila 03, seção 1",
    },
    {
      id: "AP-048", ap: "03", tema: "Técnico", dif: "dificil",
      p: "O que é o PSDK / E-Port dos equipamentos DJI Enterprise?",
      c: "Portas padronizadas para acoplar acessórios e cargas de terceiros, como holofotes, alto-falantes, sensores de gás e lançadores",
      e: [
        "O conector de carregamento rápido das baterias inteligentes",
        "A porta de saída de vídeo HDMI do controle remoto",
        "O slot de cartão microSD de gravação a bordo",
        "O conector de atualização de firmware da aeronave",
      ],
      exp: "PSDK é Payload Software Development Kit. Importante lembrar: todo acessório acoplado soma no PMD.",
      fonte: "Apostila 03, seção 1",
    },
    {
      id: "AP-049", ap: "03", tema: "Técnico", dif: "medio",
      p: "Numa bateria inteligente de drone, o que o circuito interno informa e calcula?",
      c: "Carga, temperatura, ciclos e a autonomia restante, inclusive o ponto em que só dá para fazer o retorno",
      e: [
        "A altura máxima que a aeronave pode atingir com aquela carga",
        "O peso máximo de decolagem permitido pela legislação",
        "A distância até o ponto de decolagem",
        "A intensidade do vento no local da operação",
      ],
      exp: "São as faixas verde, amarela e vermelha do aplicativo. Em drone montado (FPV), quem faz essa conta é um módulo à parte — e nem todo mundo instala.",
      fonte: "Apostila 03, seção 1; Apostila 05, seção 8",
    },
    {
      id: "AP-050", ap: "03", tema: "Técnico", dif: "medio",
      p: "Qual porta do controle remoto é usada para transmitir a imagem do drone para outra tela?",
      c: "A saída HDMI (mini HDMI no Mavic 3 Enterprise)",
      e: [
        "A porta USB-A de carregamento",
        "O slot de cartão microSD",
        "A entrada de downlink de vídeo",
        "O orifício de parafuso M4 do suporte",
      ],
      exp: "Mavic 2 Enterprise tem HDMI comum; Mavic 3, mini HDMI; Matrice 350, HDMI no topo. É daí que sai o sinal para a placa de captura.",
      fonte: "Apostila 03, seções 2 e 7; Apostila 07, seção 1",
    },

    /* ================= APOSTILA 04 — ICA 100-40 ================= */
    {
      id: "AP-060", ap: "04", tema: "Regulamentação", dif: "facil",
      p: "Qual portaria aprovou a ICA 100-40 em vigor e desde quando ela vale?",
      c: "Portaria DECEA nº 2.094/DNOR8, de 18/03/2026, em vigor desde 1º/07/2026",
      e: [
        "Resolução ANAC nº 805, de 15/06/2026",
        "Portaria nº 1.474/SPO, de 02/05/2017",
        "Decreto nº 11.237/2022",
        "Lei nº 7.565, de 19/12/1986",
      ],
      exp: "A Resolução 805/2026 é a do RBAC 100 (ANAC); a Portaria 1.474/SPO/2017 aprovou a IS nº E94-003 (ARO); o Decreto 11.237/2022 é a estrutura do COMAER.",
      fonte: "Apostila 04, abertura",
    },
    {
      id: "AP-061", ap: "04", tema: "Regulamentação", dif: "medio",
      p: "Quantas conceituações traz o art. 7º da ICA 100-40 de 2026?",
      c: "67",
      e: ["25", "40", "83", "100"],
      exp: "São 67 incisos, do 'Acomodação' (I) à 'Zona UTM' (LXVII). A norma tem 83 artigos em 8 capítulos.",
      fonte: "Apostila 04, seções 2 e 3",
    },
    {
      id: "AP-062", ap: "04", tema: "Espaço aéreo", dif: "medio",
      p: "Numa área perigosa, o que a ICA 100-40 exige do operador de UA?",
      c: "Nada além da decisão do próprio piloto sobre aceitar os riscos — o Termo de Coordenação é dispensado",
      e: [
        "Termo de Coordenação com o administrador do EAC",
        "Acordo Operacional prévio com o órgão ATS",
        "Plano de Voo apresentado com 8 dias de antecedência",
        "Autorização expressa do Diretor-Geral do DECEA",
      ],
      exp: "Área proibida veda a operação; área restrita, TRA e TSA exigem TCo; área perigosa dispensa o TCo e transfere a decisão ao piloto.",
      fonte: "ICA 100-40, art. 29, III e parágrafo único",
    },
    {
      id: "AP-063", ap: "04", tema: "Espaço aéreo", dif: "dificil",
      p: "O que acontece com a solicitação de voo que tem interseção com Rota Especial de Helicóptero (REH)?",
      c: "A operação é proibida e a solicitação não é aceita",
      e: [
        "É aceita, desde que apresentado Termo de Coordenação",
        "É aceita com prazo de 8 dias de antecedência",
        "É aceita apenas para órgãos de segurança pública",
        "É aceita com restrição de altura de 30 metros",
      ],
      exp: "Art. 30 proíbe e art. 56, VI não aceita a solicitação — mesma consequência da área proibida.",
      fonte: "ICA 100-40, arts. 30 e 56, VI",
    },
    {
      id: "AP-064", ap: "04", tema: "Espaço aéreo", dif: "medio",
      p: "Quais são os prazos mínimos de antecedência para pedir voo com interseção de FRZ e para pedir voo BVLOS?",
      c: "4 dias para FRZ e 8 dias para BVLOS",
      e: [
        "30 minutos para FRZ e 4 dias para BVLOS",
        "8 dias para FRZ e 4 dias para BVLOS",
        "24 horas para FRZ e 8 dias para BVLOS",
        "4 dias para os dois casos",
      ],
      exp: "Também são 4 dias para área maior que 100 km². Operação aérea especial e Área Adequada: 30 minutos.",
      fonte: "ICA 100-40, art. 57",
    },
    {
      id: "AP-065", ap: "04", tema: "Regulamentação", dif: "dificil",
      p: "Qual é o prazo máximo do período de voo numa solicitação de operação aérea especial?",
      c: "4 dias contados da data da solicitação",
      e: ["3 dias, como dito em aula", "24 horas", "30 dias", "90 dias"],
      exp: "Quadro de verificação da apostila: o instrutor acreditava serem 3 dias; a norma de 2026 fala em quatro dias (art. 56, IV).",
      fonte: "ICA 100-40, art. 56, IV (Apostila 04, seção 8)",
    },
    {
      id: "AP-066", ap: "04", tema: "Cadastro", dif: "medio",
      p: "Segundo a aula, qual dos sistemas NÃO é sincronizado com os demais, embora o cumprimento continue obrigatório?",
      c: "A homologação na ANATEL (Mosaico)",
      e: [
        "O cadastro no SISANT",
        "O cadastro no SARPAS",
        "A conta gov.br",
        "O AISWEB",
      ],
      exp: "SISANT e SARPAS não pedem o comprovante de homologação, mas a homologação do equipamento continua obrigatória.",
      fonte: "Apostila 04, seção 9",
    },
    {
      id: "AP-067", ap: "04", tema: "Cadastro", dif: "dificil",
      p: "Qual é o efeito prático do 'conflito do subdrone' (UA de até 250 g) descrito na apostila?",
      c: "Como o DECEA exige autorização para toda UA e o SARPAS só aceita aeronave com número do SISANT, o subdrone também precisa ser cadastrado no SISANT para voar legalmente",
      e: [
        "O subdrone está totalmente dispensado de cadastro e de autorização",
        "O subdrone precisa de certificação de tipo pela ANAC",
        "O subdrone só pode voar em área confinada",
        "O subdrone precisa de seguro RETA, por não ter cadastro",
      ],
      exp: "Pela ANAC, o drone de até 250 g em VLOS até 120 m fica fora do RBAC 100 e dispensa cadastro. Pelo DECEA, não há dispensa de autorização — e a porta de entrada é o SISANT.",
      fonte: "Apostila 04, seção 9; ICA 100-40, art. 19, §4º",
    },
    {
      id: "AP-068", ap: "04", tema: "Cadastro", dif: "medio",
      p: "Segundo a analogia usada em aula, o que é o Administrador SARPAS?",
      c: "É como ter uma frota de viaturas toda no próprio nome e emprestá-la aos pilotos — qualquer problema, ele responde primeiro",
      e: [
        "É o piloto mais experiente, que supervisiona os voos da unidade",
        "É o oficial que assina a Avaliação de Risco Operacional",
        "É o servidor do DECEA que analisa cada solicitação",
        "É o setor de patrimônio, que controla a carga das aeronaves",
      ],
      exp: "Por isso ele precisa garantir que os pilotos foram capacitados e conhecem as regras. Sem administrador, 'todo mundo está ilegal'.",
      fonte: "Apostila 04, seção 9",
    },
    {
      id: "AP-069", ap: "04", tema: "Espaço aéreo", dif: "medio",
      p: "Segundo os bizus de preenchimento do SARPAS, qual altura se costuma informar e o que acontece se pedir mais?",
      c: "120 metros, que é o limite; pedir 150 m não é aceito",
      e: [
        "60 metros, porque é o limite da operação recreativa",
        "150 metros, com justificativa de operação policial",
        "400 metros, convertendo os 400 pés",
        "A altura do obstáculo mais alto da área",
      ],
      exp: "O sistema mostra a altura em pés e em metros. Acima do limite, o pedido não passa na aprovação automática.",
      fonte: "Apostila 04, seção 10",
    },
    {
      id: "AP-070", ap: "04", tema: "Espaço aéreo", dif: "facil",
      p: "Qual é a regra-mãe do art. 19 da ICA 100-40?",
      c: "Nenhuma UA pode acessar o espaço aéreo brasileiro sem autorização do Estado brasileiro",
      e: [
        "Nenhuma UA pode voar acima de 120 metros AGL",
        "Nenhuma UA pode operar sem seguro de danos a terceiros",
        "Nenhuma UA pode ser operada por menor de 18 anos",
        "Nenhuma UA pode transportar carga externa",
      ],
      exp: "A autorização é concedida por integração/acomodação (condicionantes) ou por segregação de espaço aéreo. E vale inclusive para UA de até 250 g.",
      fonte: "ICA 100-40, art. 19",
    },
    {
      id: "AP-071", ap: "04", tema: "Regulamentação", dif: "medio",
      p: "Quais operações exigem segregação do espaço aéreo, com divulgação por produto AIS?",
      c: "BVLOS, voo acima de 400 pés (120 m) AGL e PMD maior que 25 kg",
      e: [
        "Qualquer operação de órgão de segurança pública",
        "Operações noturnas e operações sobre água",
        "Operações recreativas em clube de aeromodelismo",
        "Operações com mais de um observador",
      ],
      exp: "É o art. 25. São exatamente os casos que levam a operação para a categoria específica.",
      fonte: "ICA 100-40, art. 25",
    },
    {
      id: "AP-072", ap: "04", tema: "Espaço aéreo", dif: "dificil",
      p: "Na tabela de FRZ de aeroportos, a operação padrão a 3.000 m da pista e fora dos cones da ZAD está em qual setor e com que altura liberada?",
      c: "Setor D da ZEA, com até 300 pés",
      e: [
        "Setor A da ZEA, com 0 pé",
        "Setor B da ZEA, com até 100 pés",
        "Setor E da ZEA, com até 400 pés",
        "Setor F da ZAD, com 0 pé",
      ],
      exp: "Na coluna IFR/VFR de operação padrão: acima de 2.960 m entra no setor D (300 ft). Dentro do cone (ZAD), na mesma distância, ainda se está em setor de 0 pé — só a partir de 3.550 m começa a liberar.",
      fonte: "ICA 100-40, Figuras 2 e 3 (Apostila 04, seção 5)",
    },
    {
      id: "AP-073", ap: "04", tema: "Regulamentação", dif: "medio",
      p: "O que a ICA 100-40 exige quando a operação aérea especial tem interseção com EAC ou FRZ?",
      c: "Estreita coordenação prévia com o órgão ATS, o operador do aeródromo ou o responsável pelo EAC",
      e: [
        "Nada: a operação especial é isenta de coordenação",
        "Termo de Coordenação assinado com 8 dias de antecedência",
        "Plano de Voo apresentado ao CGNA",
        "Acordo Operacional com a ANAC",
      ],
      exp: "O privilégio não dispensa a coordenação — dispensa o prazo longo.",
      fonte: "ICA 100-40, art. 44, §2º",
    },
    {
      id: "AP-074", ap: "04", tema: "Espaço aéreo", dif: "facil",
      p: "O que o DECEA pode fazer com EAC e FRZ, segundo o art. 10?",
      c: "Criar, cadastrar, ativar ou cancelar a qualquer tempo",
      e: [
        "Somente criar, mediante publicação em portaria anual",
        "Somente cancelar, a pedido do operador de aeródromo",
        "Somente ativar em caso de grande evento",
        "Nada: FRZ é definida pelo fabricante do equipamento",
      ],
      exp: "Por isso a consulta ao AISWEB e ao mapa do SARPAS é parte do planejamento: a restrição pode ter mudado desde o último voo.",
      fonte: "ICA 100-40, arts. 10 e 16",
    },
    {
      id: "AP-075", ap: "04", tema: "Regulamentação", dif: "dificil",
      p: "O que acontece com registros, cadastros e certificados emitidos com base no antigo RBAC-E nº 94?",
      c: "Continuam válidos até que a ANAC os cancele",
      e: [
        "Perderam validade em 15/06/2026, com a revogação",
        "Valem por 90 dias após a entrada em vigor da nova norma",
        "Precisam ser revalidados no SISANT em até 12 meses",
        "Valem só para operações recreativas",
      ],
      exp: "É o art. 78 (disposições transitórias). E as operações autorizadas até 30/06/2026 permanecem válidas por até 90 dias nos parâmetros da autorização (art. 79).",
      fonte: "ICA 100-40, arts. 78 e 79",
    },
    {
      id: "AP-076", ap: "04", tema: "Documentação", dif: "medio",
      p: "Quais documentos a Organização Regional pode exigir na análise de uma solicitação?",
      c: "Carta de Acordo Operacional (CAOp), Acordo Operacional (AOp) e Termo de Coordenação (TCo), podendo ainda exigir comunicação bilateral e Plano de Voo",
      e: [
        "Apenas a ARO assinada pelo comandante",
        "Apenas o comprovante de homologação ANATEL",
        "Apenas o certificado de aeronavegabilidade",
        "Apenas a apólice do seguro RETA",
      ],
      exp: "Enquanto isso o status fica 'pendente'. O parecer desfavorável sempre informa o motivo (art. 62).",
      fonte: "ICA 100-40, arts. 61 e 62",
    },
    {
      id: "AP-077", ap: "04", tema: "Espaço aéreo", dif: "medio",
      p: "O que o piloto precisa conhecer antes de voar, quanto ao fly-away?",
      c: "O meio de contato do Tático SARPAS",
      e: [
        "O telefone da torre de controle do aeroporto mais próximo",
        "O e-mail da JJAER para registrar a ocorrência",
        "O número do CENIPA para abrir investigação",
        "O contato da assistência técnica do fabricante",
      ],
      exp: "Art. 26. O Tático SARPAS, no CGNA, recebe o fly-away e difunde alerta de perigo aos órgãos ATS locais.",
      fonte: "ICA 100-40, arts. 26 e 76",
    },
    {
      id: "AP-078", ap: "04", tema: "Regulamentação", dif: "dificil",
      p: "Numa operação de UA militar sob Circulação Operacional Militar, qual norma se aplica?",
      c: "A ICA 100-13, em lugar da ICA 100-40",
      e: [
        "A ICA 100-40, sem qualquer alteração",
        "O RBAC 100 da ANAC",
        "A MCA 56-5, do Manual de SARP",
        "A ICA 100-12, Regras do Ar",
      ],
      exp: "Art. 33: a UA militar cumpre a Portaria; sob Circulação Operacional Militar, cumpre a ICA 100-13.",
      fonte: "ICA 100-40, art. 33",
    },
    {
      id: "AP-079", ap: "04", tema: "Regulamentação", dif: "facil",
      p: "Além do DECEA, quais normas o explorador, o operador e o piloto em comando também devem observar?",
      c: "As da ANAC, da ANATEL, do MAPA e do Ministério da Defesa",
      e: [
        "Somente as da ANAC",
        "Somente as do município onde o voo ocorre",
        "Somente as do Código de Trânsito Brasileiro",
        "Somente as normas internas da própria instituição",
      ],
      exp: "Art. 35. Cada autoridade cuida de um pedaço do mesmo voo — e uma operação regular está em dia com todas as que se aplicam.",
      fonte: "ICA 100-40, art. 35",
    },
    {
      id: "AP-080", ap: "04", tema: "Espaço aéreo", dif: "medio",
      p: "Qual é o e-mail de contato do CINDACTA IV, para denúncias envolvendo Rondônia, segundo o Anexo II?",
      c: "protocolo.cindacta4@fab.mil.br",
      e: [
        "rpas.cindacta3@fab.mil.br",
        "protocolo.crcease@fab.mil.br",
        "cadastrosarpas@cgna.decea.mil.br",
        "protocolo.cindacta1@fab.mil.br",
      ],
      exp: "O endereço é Av. do Turismo, 1350, Tarumã, Manaus-AM. O cadastrosarpas@cgna.decea.mil.br é do CGNA, para cadastro — não para denúncia.",
      fonte: "ICA 100-40, Anexo II",
    },
    {
      id: "AP-081", ap: "04", tema: "Documentação", dif: "dificil",
      p: "Por que a aula recomenda pedir no SARPAS a janela inteira do serviço, em vez de vários intervalos?",
      c: "Para não precisar especificar cada intervalo de voo e evitar ficar fora do horário autorizado",
      e: [
        "Porque o sistema cobra taxa por solicitação",
        "Porque a autorização vale no máximo 1 hora por pedido",
        "Porque o DECEA nega pedidos com menos de 4 horas",
        "Porque cada intervalo exige um Termo de Coordenação",
      ],
      exp: "Pedir a janela com folga também protege contra atraso na operação — a autorização é de período, não de um instante.",
      fonte: "Apostila 04, seção 10",
    },
    {
      id: "AP-082", ap: "04", tema: "Regulamentação", dif: "medio",
      p: "Segundo a apostila, qual é a diferença entre a atuação da JJAER e a do CENIPA?",
      c: "A JJAER julga e pune administrativamente; o CENIPA investiga acidentes com finalidade exclusiva de prevenção, e suas conclusões não servem para atribuir culpa",
      e: [
        "A JJAER investiga e o CENIPA julga",
        "A JJAER cuida de aeronave tripulada e o CENIPA de drone",
        "Os dois julgam, em instâncias diferentes",
        "A JJAER é da ANAC e o CENIPA é do DECEA",
      ],
      exp: "Confundir os dois é erro comum: um pune, o outro previne.",
      fonte: "Apostila 04, seção 2",
    },
    /* ================= APOSTILA 05 — RBAC 100 / ART 100.3 ================= */
    {
      id: "AP-090", ap: "05", tema: "Regulamentação", dif: "facil",
      p: "Como se medem os 30 metros de distância de pessoas não anuentes?",
      c: "Pela distância estritamente horizontal entre a projeção vertical do drone e a da pessoa",
      e: [
        "Pela diagonal (linha reta) entre o drone e a pessoa",
        "Pela distância do piloto até a pessoa",
        "Pela altura do drone somada à distância no solo",
        "Pelo raio de alcance do enlace de rádio",
      ],
      exp: "Não tem cálculo de hipotenusa: estende-se uma linha vertical da pessoa e outra do drone, e mede-se a horizontal entre as duas.",
      fonte: "Apostila 05, seção 2",
    },
    {
      id: "AP-091", ap: "05", tema: "Regulamentação", dif: "medio",
      p: "Quais são os cinco elementos analisados para enquadrar a operação nas categorias do RBAC 100?",
      c: "Peso (PMD), contato visual, altura, pessoas em volta e existência de barreira mecânica",
      e: [
        "Peso, marca da aeronave, altura, horário e local",
        "Peso, autonomia, alcance, altura e clima",
        "Piloto, observador, segurança, aeronave e bateria",
        "Peso, seguro, cadastro, homologação e ARO",
      ],
      exp: "No RBAC-E 94 a categoria vinha do peso; hoje vem da análise do risco criado pela situação do voo.",
      fonte: "Apostila 05, seção 3",
    },
    {
      id: "AP-092", ap: "05", tema: "Técnico", dif: "medio",
      p: "Por que o LiDAR funciona no escuro, ao contrário dos sensores visuais?",
      c: "Porque ele emite os próprios pulsos de laser e mede o tempo de retorno, sem depender da luz do ambiente",
      e: [
        "Porque usa câmera infravermelha de alta sensibilidade",
        "Porque usa ondas de rádio, como um radar",
        "Porque usa ultrassom, como um sonar",
        "Porque amplifica a luz residual do ambiente",
      ],
      exp: "Limites do LiDAR: é mais caro e mais pesado (pesa no PMD), e vidro, espelho e fumaça densa atrapalham.",
      fonte: "Apostila 05, seção 1",
    },
    {
      id: "AP-093", ap: "05", tema: "Fatores humanos", dif: "medio",
      p: "Segundo a cadeia de responsabilidade do RBAC 100, o piloto remoto é designado como:",
      c: "Preposto do operador, que é o responsável legal pela operação",
      e: [
        "Responsável legal exclusivo pela operação",
        "Auxiliar do Administrador SARPAS",
        "Encarregado da manutenção da aeronave",
        "Fiscal da autoridade aeronáutica em campo",
      ],
      exp: "A apostila compara com o comandante-geral que designa um oficial como encarregado de um IPM. O operador responde pelo controle operacional; o piloto, pela condução segura do voo.",
      fonte: "Apostila 05, seção 4",
    },
    {
      id: "AP-094", ap: "05", tema: "Segurança operacional", dif: "dificil",
      p: "No caso do Carnaval de Manaus, o que provocou a colisão do drone com o sino da igreja?",
      c: "A saturação de sinais de rádio e TV no local: a aeronave entrou em modo ATT, derivou e recebeu um comando espúrio",
      e: [
        "Uma rajada de vento repentina durante a filmagem",
        "Falha da bateria, que descarregou antes do previsto",
        "Erro do piloto, que perdeu a referência visual na multidão",
        "Um jammer acionado pela organização do evento",
      ],
      exp: "A lição: em ambiente saturado, o drone pode não só perder o contato — pode receber comando indevido. É o mesmo princípio dos antidrone mais avançados.",
      fonte: "Apostila 05, seção 7",
    },
    {
      id: "AP-095", ap: "05", tema: "Regulamentação", dif: "medio",
      p: "Qual é a única exceção em que o voo 'autônomo' é admitido, segundo a apostila?",
      c: "Quando há perda de sinal e a aeronave executa o que foi pré-definido (RTH, pouso) — porque aí a intervenção já não é possível",
      e: [
        "Quando a rota é programada para aerolevantamento",
        "Quando a operação é de segurança pública",
        "Quando a aeronave tem menos de 250 g",
        "Quando o voo é em área confinada",
      ],
      exp: "Aerolevantamento com rota programada é operação automatizada — permitida, porque o piloto pode interromper a qualquer momento.",
      fonte: "Apostila 05, seção 9",
    },
    {
      id: "AP-096", ap: "05", tema: "Regulamentação", dif: "facil",
      p: "Quantas tentativas e qual nota mínima a apostila informa para a prova teórica da ANAC?",
      c: "Até 3 tentativas, com nota mínima 7 (70%, ou 14 de 20 questões)",
      e: [
        "Tentativa única, com nota mínima 6",
        "Até 5 tentativas, com nota mínima 5",
        "Até 3 tentativas, com nota mínima 9",
        "Tentativas ilimitadas, sem nota mínima (apto/inapto)",
      ],
      exp: "Em aula foi dito que vale a nota da última tentativa; fontes não oficiais informam que vale a maior — a apostila recomenda conferir no próprio portal da ANAC.",
      fonte: "Apostila 05, seção 5; Apostila 08, seção 2",
    },
    {
      id: "AP-097", ap: "05", tema: "Segurança operacional", dif: "medio",
      p: "Numa operação perto de aeroclube, quais mitigações a apostila descreve para derrubar a probabilidade de conflito com tráfego aéreo?",
      c: "Checklist rigoroso, emprego de spotters (um para a aeronave e um ou dois para o entorno) e verificação ativa com o SARPAS/contato com o DECEA",
      e: [
        "Reduzir a altura para 30 metros e voar somente de manhã",
        "Usar drone de menos de 250 g",
        "Transmitir a imagem ao vivo para a torre de controle",
        "Programar o RTH direto na altura máxima",
      ],
      exp: "Com observadores e controle pela rede, a probabilidade cai de 4 (ocasional) para 1 (muito improvável). A severidade continua A — mitigar não muda a consequência possível.",
      fonte: "Apostila 05 / Apostila 06, seção 7",
    },
    {
      id: "AP-098", ap: "05", tema: "Regulamentação", dif: "dificil",
      p: "Segundo a apostila, o que a ANAC pode fazer mesmo quando tecnicamente tudo está conforme?",
      c: "Proibir operações em áreas específicas, se houver perturbação à ordem pública, além de fazer inspeções, auditorias e vistorias sem aviso prévio",
      e: [
        "Cassar a autorização SARPAS emitida pelo DECEA",
        "Aplicar multa de trânsito aéreo ao piloto",
        "Apreender a aeronave em campo",
        "Exigir seguro RETA de operações estatais",
      ],
      exp: "E o UAS deve ser disponibilizado sempre que requerido pela ANAC. Já revogar autorização de espaço aéreo é do DECEA (arts. 64 e 81 da ICA).",
      fonte: "Apostila 05, seção 13",
    },
    {
      id: "AP-099", ap: "05", tema: "Fatores humanos", dif: "medio",
      p: "A que o instrutor compara a decisão do voo, na relação entre comandante e piloto?",
      c: "Ao tiro de comprometimento: o comandante dá a luz verde, mas quem de fato inicia é o atirador",
      e: [
        "À condução de viatura: quem assume o volante responde pelo trajeto",
        "Ao IPM: quem instaura responde pelo resultado",
        "Ao plantão de serviço: quem escala responde pela equipe",
        "À ordem de missão: quem assina responde por tudo",
      ],
      exp: "O comandante da operação diz quando a operação acontece; quem decide se o voo acontece dentro dela é o piloto.",
      fonte: "Apostila 05, seção 14",
    },
    {
      id: "AP-100", ap: "05", tema: "Segurança operacional", dif: "facil",
      p: "Para atuar perto de um aeródromo, o que a apostila aponta como necessário além da coordenação com o DECEA?",
      c: "Autorização expressa do administrador do aeródromo, com definição de altura, horário e distância, e contato mantido durante toda a operação",
      e: [
        "Apenas a autorização SARPAS aprovada automaticamente",
        "Apenas o aviso ao piloto da aeronave que estiver pousando",
        "Apenas o registro do voo em até 24 horas",
        "Apenas a presença de observador no local",
      ],
      exp: "Aeródromo é toda área usada para pouso e decolagem: heliponto, aeroporto, aeroclube. O gestor põe o operador em contato com a torre.",
      fonte: "Apostila 05, seção 11",
    },

    /* ================= APOSTILA 06 — ARO ================= */
    {
      id: "AP-110", ap: "06", tema: "Documentação", dif: "facil",
      p: "O que é a ARO?",
      c: "A Avaliação de Risco Operacional: o documento que cruza probabilidade e severidade de cada perigo, define a tolerabilidade e diz quem autoriza o voo",
      e: [
        "A autorização de acesso ao espaço aéreo emitida pelo DECEA",
        "O relatório do voo entregue após a operação",
        "O cadastro da aeronave e do operador na ANAC",
        "O checklist de itens verificados antes da decolagem",
      ],
      exp: "Ela transforma 'acho que dá para voar' numa decisão fundamentada, assinada no nível certo da hierarquia.",
      fonte: "Apostila 06, abertura",
    },
    {
      id: "AP-111", ap: "06", tema: "Documentação", dif: "medio",
      p: "Qual instrução suplementar da ANAC traz a metodologia da avaliação de risco operacional?",
      c: "IS nº E94-003, Revisão A, aprovada pela Portaria nº 1.474/SPO, de 02/05/2017",
      e: [
        "IS nº 100-001, de 2026",
        "ICA 100-40, de 2026",
        "RBAC nº 100, Emenda 00",
        "MCA 56-5, do DECEA",
      ],
      exp: "Ela nasceu para o RBAC-E 94, e a exigência de ARO foi mantida no RBAC 100 de 2026.",
      fonte: "Apostila 06, seção 1",
    },
    {
      id: "AP-112", ap: "06", tema: "Documentação", dif: "medio",
      p: "Na escala de severidade da IS E94-003, o que é o nível D?",
      c: "Pequeno: incidentes menores, danos a objetos, animais ou vegetação no solo, lesões leves",
      e: [
        "Catastrófico: morte de múltiplas pessoas",
        "Crítico: morte de pessoa ou lesão incapacitante",
        "Significativo: lesões sérias sem sequela",
        "Insignificante: somente danos ao equipamento",
      ],
      exp: "A → catastrófico; B → crítico; C → significativo; D → pequeno; E → insignificante (só dano ao equipamento).",
      fonte: "Apostila 06, seção 3",
    },
    {
      id: "AP-113", ap: "06", tema: "Documentação", dif: "dificil",
      p: "Quais classificações compõem o nível de risco ALTO na matriz da IS E94-003?",
      c: "3A, 4B e 5C",
      e: ["4A, 5A e 5B", "1A, 2A e 2B", "1B, 1C e 2C", "1D, 1E e 2E"],
      exp: "Extremo: 4A, 5A, 5B. Alto: 3A, 4B, 5C. Moderado: 1A, 2A, 2B, 3B, 3C, 4C, 4D, 5D, 5E. Baixo: 1B, 1C, 2C, 2D, 3D, 3E, 4E. Muito baixo: 1D, 1E, 2E.",
      fonte: "Apostila 06, seção 4",
    },
    {
      id: "AP-114", ap: "06", tema: "Documentação", dif: "medio",
      p: "No nível de risco BAIXO, quem autoriza a operação?",
      c: "O próprio piloto remoto: controles e aprovação da chefia imediata são opcionais",
      e: [
        "A chefia imediata, obrigatoriamente",
        "O comandante do batalhão",
        "O comandante-geral",
        "Ninguém: risco baixo impede a operação",
      ],
      exp: "Muito baixo é aceitável como concebido (nenhum controle nem aprovação). Moderado sobe para a chefia imediata; alto, para diretor/comandante; extremo, para a hierarquia mais alta.",
      fonte: "Apostila 06, seção 4",
    },
    {
      id: "AP-115", ap: "06", tema: "Documentação", dif: "medio",
      p: "Na situação-modelo 'presença de pessoas não anuentes' dos slides, qual é o risco resultante e a tolerabilidade?",
      c: "1B — risco baixo",
      e: ["1A — risco moderado", "3C — risco moderado", "4A — risco extremo", "3B — risco moderado"],
      exp: "Probabilidade 1 (muito improvável) com severidade B (crítico) = 1B, baixo — e aqui o próprio piloto pode autorizar, o que o slide já trazia coerente.",
      fonte: "Apostila 06, seção 6 (situação 3)",
    },
    {
      id: "AP-116", ap: "06", tema: "Documentação", dif: "dificil",
      p: "Na situação-modelo 'ventos fortes e rajadas' (probabilidade 4, severidade A), o que o próprio slide traz como mitigação?",
      c: "Não realizar a operação nessas condições, verificando o clima antes e durante, e suspendendo se mudar",
      e: [
        "Reduzir a altura para 30 metros e manter o voo",
        "Empregar dois observadores para vigiar o vento",
        "Aumentar a altura de RTH para 120 metros",
        "Voar apenas no período vespertino, quando o vento é previsível",
      ],
      exp: "4A é risco extremo: a mitigação é não voar. A apostila anota que o campo 'nível de autorização' dos slides vem preenchido como 'piloto remoto em comando' apenas como modelo — pela matriz, extremo exige o comandante-geral.",
      fonte: "Apostila 06, seção 6 (situação 4)",
    },
    {
      id: "AP-117", ap: "06", tema: "Documentação", dif: "medio",
      p: "Quais são os quatro passos do processo de gestão de risco descritos na apostila?",
      c: "Identificar, avaliar, mitigar e chancelar",
      e: [
        "Planejar, executar, verificar e corrigir",
        "Cadastrar, solicitar, autorizar e voar",
        "Observar, decidir, agir e registrar",
        "Prevenir, investigar, punir e divulgar",
      ],
      exp: "Identificar os perigos (com os três obrigatórios), avaliar cruzando probabilidade × severidade pelo pior cenário, mitigar com controles preventivos e chancelar com a assinatura do nível exigido.",
      fonte: "Apostila 06, seção 8",
    },
    {
      id: "AP-118", ap: "06", tema: "Documentação", dif: "medio",
      p: "Uma ARO pode valer para vários eventos futuros?",
      c: "Sim, quando o evento é recorrente e tem as mesmas características — por exemplo, os jogos do ano no mesmo estádio",
      e: [
        "Não: cada voo exige uma ARO nova",
        "Sim, mas somente para operações de segurança pública",
        "Sim, com validade de até 24 meses",
        "Não, salvo autorização expressa da ANAC",
      ],
      exp: "Os 12 meses são o máximo, não uma obrigação. Evento singular pede ARO específica daquele evento.",
      fonte: "Apostila 06, seção 8",
    },
    {
      id: "AP-119", ap: "06", tema: "Documentação", dif: "medio",
      p: "Quais são as partes da estrutura do documento de ARO apresentada em aula?",
      c: "Cabeçalho, base legal, declaração de procedimentos em caso de lesão, tabela de avaliação e assinatura",
      e: [
        "Capa, sumário, desenvolvimento, conclusão e anexos",
        "Identificação, autorização SARPAS, log de voo e relatório",
        "Objetivo, efetivo empregado, viaturas e prazo",
        "Perigo, causa, efeito e responsável",
      ],
      exp: "O coração do documento é a tabela: situação, probabilidade, severidade, risco, nível hierárquico de autorização e mitigações empregadas.",
      fonte: "Apostila 06, seção 9",
    },
    {
      id: "AP-120", ap: "06", tema: "Documentação", dif: "dificil",
      p: "No modelo de ARO do BPFRON, o que define quem precisa assinar o documento?",
      c: "O maior risco residual da operação: baixo/muito baixo vai com o piloto, moderado com a chefia imediata, alto com o diretor/comandante do batalhão e extremo com o comandante-geral",
      e: [
        "A quantidade de perigos avaliados no documento",
        "O peso da aeronave empregada na operação",
        "O tipo de voo (VLOS ou EVLOS)",
        "A duração prevista da operação",
      ],
      exp: "Por isso a dica de escrever o código da matriz ('2C — moderado') em vez de 'baixa/moderada': o código já indica o nível de autorização exigido.",
      fonte: "Apostila 06, seção 10",
    },
    {
      id: "AP-121", ap: "06", tema: "Documentação", dif: "facil",
      p: "Onde ficam salvos os dados preenchidos na versão embutida do Formulário ARO da apostila?",
      c: "Só no próprio aparelho, como rascunho local — nada é enviado a servidor",
      e: [
        "Na planilha da Seção Operacional do BPFRON",
        "No SARPAS, junto com a solicitação de voo",
        "No Drive institucional da unidade",
        "No servidor da ANAC, para auditoria",
      ],
      exp: "Em aparelho compartilhado, a recomendação é usar 'Limpar rascunho' ao terminar.",
      fonte: "Apostila 06, seção 10",
    },
    {
      id: "AP-122", ap: "06", tema: "Documentação", dif: "medio",
      p: "Se o comandante da unidade alertou que o risco era alto e a operação ocorreu por ordem direta superior, o que deve ser feito?",
      c: "Registrar isso expressamente no documento, indicando quem determinou a operação",
      e: [
        "Deixar o campo de autorização em branco",
        "Anotar apenas no log de voo da aeronave",
        "Comunicar verbalmente ao Administrador SARPAS",
        "Cancelar a ARO e refazer depois da operação",
      ],
      exp: "Exemplo dado na apostila: 'o comandante de unidade informou risco alto e que não deveria haver o voo; a operação ocorreu por ordem direta do comandante-geral'.",
      fonte: "Apostila 06, seção 7",
    },

    /* ================= APOSTILA 07 — TRANSMISSÃO DE IMAGEM ================= */
    {
      id: "AP-130", ap: "07", tema: "Técnico", dif: "facil",
      p: "Quais são os quatro passos da transmissão de imagem, na ordem do quadro da aula?",
      c: "Cabeamento, configuração do app de transmissão, entrada no app de espelhamento e envio do link",
      e: [
        "Decolagem, enquadramento, gravação e envio do vídeo",
        "Login, criação da sala, convite e gravação",
        "Espelhamento, cabeamento, link e narração",
        "Cabeamento, gravação no cartão, edição e envio",
      ],
      exp: "Na hora de pôr no ar, o instrutor corrigiu a execução: abra primeiro o espelhamento (a imagem aparece) e depois entre na sala — mas a sala precisa estar criada e configurada antes.",
      fonte: "Apostila 07, seções 1 a 4",
    },
    {
      id: "AP-131", ap: "07", tema: "Técnico", dif: "medio",
      p: "Qual é o erro mais comum no cabeamento, segundo a aula?",
      c: "Inverter a direção da placa de captura: o HDMI vem do controle e a saída USB tem de ficar voltada para o receptor",
      e: [
        "Usar cabo HDMI longo demais, que perde sinal",
        "Ligar a placa de captura na tomada antes do controle",
        "Usar cartão de memória de classe baixa",
        "Conectar dois receptores na mesma placa",
      ],
      exp: "A placa tem sentido: entrada HDMI de um lado, saída USB do outro. Invertida, não funciona — e a pessoa fica 'se batendo lá'.",
      fonte: "Apostila 07, seção 1",
    },
    {
      id: "AP-132", ap: "07", tema: "Técnico", dif: "medio",
      p: "Qual plataforma de transmissão o BPFRON usa, e qual é o cuidado dela?",
      c: "O meet.jit.si (Jitsi): gratuito e sem limite de tempo, mas 'pesado' em dados/bateria e exige que quem cria a sala esteja logado",
      e: [
        "O Google Meet, que não tem limite de tempo na conta gratuita",
        "O YouTube, que transmite em tempo real sem atraso",
        "O Instagram, por ser o de acesso mais fácil",
        "O WhatsApp, por suportar muitos participantes",
      ],
      exp: "O Meet gratuito cai em 60 minutos com 3 ou mais pessoas; o YouTube tem atraso de 10 a 15 segundos; Instagram/Facebook são transmissão pública, em regra inadequada para operação policial.",
      fonte: "Apostila 07, seção 2",
    },
    {
      id: "AP-133", ap: "07", tema: "Técnico", dif: "facil",
      p: "Qual aplicativo Android é usado para espelhar a imagem da placa de captura no celular?",
      c: "USB Camera",
      e: ["AMCap", "DJI Pilot 2", "OBS Studio", "VLC Mobile"],
      exp: "No computador (Windows) o programa citado é o AMCap: escolhe-se o 'Device' da placa de captura e a imagem aparece.",
      fonte: "Apostila 07, seção 3",
    },
    {
      id: "AP-134", ap: "07", tema: "Técnico", dif: "medio",
      p: "A tela do app de espelhamento ficou preta. Qual é a causa mais provável e o que checar?",
      c: "Placa de captura invertida, cabo HDMI frouxo ou saída HDMI do controle desabilitada",
      e: [
        "Internet lenta no local da operação",
        "Bateria da aeronave abaixo de 30%",
        "Cartão de memória cheio",
        "Sala de transmissão com lobby ativado",
      ],
      exp: "Conferir a direção (USB para o receptor), reencaixar o cabo e verificar no app do drone se a saída HDMI está habilitada.",
      fonte: "Apostila 07, seção 6",
    },
    {
      id: "AP-135", ap: "07", tema: "Técnico", dif: "dificil",
      p: "O celular não reconhece a placa de captura. O que verificar, segundo a apostila?",
      c: "Se há adaptador OTG (USB-C) e se a função OTG está ativada nas configurações do Android",
      e: [
        "Se o celular tem 5G habilitado",
        "Se o aplicativo de voo está fechado",
        "Se o cartão microSD está inserido no controle",
        "Se o Bluetooth do controle está desligado",
      ],
      exp: "A placa geralmente sai em USB-A; o adaptador que acompanha resolve os dois lados (celular e PC).",
      fonte: "Apostila 07, seções 1 e 6",
    },
    {
      id: "AP-136", ap: "07", tema: "Segurança operacional", dif: "medio",
      p: "Quais cuidados de segurança da informação a apostila recomenda para a sala de transmissão?",
      c: "Enviar o link só ao grupo autorizado, preferir sala com senha, usar nome de sala não óbvio e encerrar a sala ao final",
      e: [
        "Transmitir publicamente, para dar transparência à operação",
        "Gravar a transmissão e publicar depois nas redes da unidade",
        "Enviar o link a todos os grupos de WhatsApp da unidade",
        "Deixar a sala aberta e sem senha, para facilitar o acesso",
      ],
      exp: "Sala aberta (sem lobby) é para não parar a operação admitindo gente — e é justamente por isso que ela vem acompanhada de senha.",
      fonte: "Apostila 07, seções 2 e 4",
    },

    /* ================= APOSTILA 08 — APLICATIVOS E FERRAMENTAS ================= */
    {
      id: "AP-140", ap: "08", tema: "Cadastro", dif: "facil",
      p: "Para que serve a conta gov.br no fluxo do piloto de drone?",
      c: "É a conta única que dá acesso ao SISANT, ao SARPAS NG (ID Operacional) e ao assinador digital",
      e: [
        "Serve apenas para consultar a homologação na ANATEL",
        "Serve apenas para fazer a prova teórica da ANAC",
        "Serve apenas para assinar a ARO",
        "Serve apenas para denunciar drone irregular",
      ],
      exp: "Recomenda-se conta de nível prata ou ouro. É o primeiro passo de todo o fluxo.",
      fonte: "Apostila 08, seção 2",
    },
    {
      id: "AP-141", ap: "08", tema: "Técnico", dif: "medio",
      p: "Qual aplicativo de voo é usado no Mavic 3 Enterprise e no Matrice 350 RTK?",
      c: "DJI Pilot 2",
      e: ["DJI Pilot", "DJI Fly", "DJI GO 4", "DJI FlySafe"],
      exp: "DJI Pilot (1) é do Smart Controller do Mavic 2 Enterprise; DJI Fly é da linha de consumo (Mini, Air, Neo, Avata); FlySafe é a consulta de zonas geográficas.",
      fonte: "Apostila 08, seção 3",
    },
    {
      id: "AP-142", ap: "08", tema: "Documentação", dif: "medio",
      p: "Qual é o endereço oficial do assinador digital do gov.br citado na apostila?",
      c: "assinador.iti.br",
      e: ["assinador.gov.br", "assinatura.iti.gov.br", "sso.acesso.gov.br", "assinador.anac.gov.br"],
      exp: "A apostila registra que o formulário ARO cita 'assinador.iti.gov.br', mas o endereço oficial do serviço é assinador.iti.br.",
      fonte: "Apostila 08, seção 2",
    },
    {
      id: "AP-143", ap: "08", tema: "Espaço aéreo", dif: "medio",
      p: "Para que serve o Portal Drone do DECEA (decea.mil.br/drone)?",
      c: "Para a acreditação de Órgão Especial com resposta imediata, modelos de documentos e orientações de notificação de fly-away",
      e: [
        "Para solicitar autorização de voo, substituindo o SARPAS",
        "Para cadastrar a aeronave, substituindo o SISANT",
        "Para consultar NOTAM e cartas aeronáuticas",
        "Para fazer a prova teórica de piloto remoto",
      ],
      exp: "A acreditação é o que libera o privilégio da operação aérea especial. NOTAM e cartas ficam no AISWEB; a prova, no Portal de Capacitação da ANAC.",
      fonte: "Apostila 08, seção 2",
    },
    {
      id: "AP-144", ap: "08", tema: "Cadastro", dif: "dificil",
      p: "Segundo a apostila 08, qual é a ordem que 'não pode inverter'?",
      c: "gov.br → ANATEL (homologação) → SISANT (nº de cadastro) → SARPAS NG (aeronave, equipe, solicitação) → autorização com QR Code",
      e: [
        "gov.br → SARPAS → SISANT → ANATEL → autorização",
        "SISANT → gov.br → SARPAS → ANATEL → autorização",
        "ANATEL → SISANT → gov.br → SARPAS → autorização",
        "SARPAS → gov.br → ANATEL → SISANT → autorização",
      ],
      exp: "Uma etapa obriga a anterior: o SARPAS só aceita aeronave com número do SISANT — inclusive o drone de até 250 g.",
      fonte: "Apostila 08, seção 2",
    },
    {
      id: "AP-145", ap: "08", tema: "Espaço aéreo", dif: "facil",
      p: "Em que momento da operação se consulta o AISWEB?",
      c: "No planejamento do voo, para conferir NOTAM e áreas próximas",
      e: [
        "Depois do voo, para registrar a operação realizada",
        "Durante o voo, para acompanhar o tráfego em tempo real",
        "Na compra do equipamento, para conferir a homologação",
        "Apenas quando houver fly-away",
      ],
      exp: "É requisito do planejamento (art. 73, VI da ICA 100-40): condições dos produtos AIS.",
      fonte: "Apostila 08, seção 2",
    },
    {
      id: "AP-146", ap: "08", tema: "Técnico", dif: "medio",
      p: "O que a apostila registra sobre o 'Novo SISANT' lançado pela ANAC em 2026?",
      c: "Que ele tem endereço novo, e por isso o acesso deve ser feito sempre pela página oficial da ANAC",
      e: [
        "Que ele passou a exigir certificado digital A3",
        "Que ele substituiu o SARPAS na autorização de voo",
        "Que ele dispensou o cadastro de drones até 250 g",
        "Que ele passou a ser pago para pessoa jurídica",
      ],
      exp: "Endereços de sistema mudam: a apostila marca isso onde o link é instável.",
      fonte: "Apostila 08, seção 2",
    },
  ];

  /* ======================================================================
   * MOTOR — sorteio, embaralhamento e correção
   * ====================================================================== */

  var DIFS = ["facil", "medio", "dificil"];
  var DIF_NOME = { facil: "Fácil", medio: "Médio", dificil: "Difícil", mista: "Mista" };

  /* Gerador pseudoaleatório com semente (mulberry32). Math.random serve para o
     aluno, mas o teste precisa repetir o mesmo sorteio — daí a semente. */
  function drqRng(semente) {
    if (semente === undefined || semente === null || semente === "") {
      return Math.random;
    }
    var a = (Number(semente) || 0) >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* Fisher-Yates: embaralha uma COPIA, nunca o array original do banco. */
  function drqEmbaralhar(arr, rnd) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rnd() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function drqBanco(nome) {
    return String(nome) === "anac" ? QUESTOES_ANAC : QUESTOES_APOSTILAS;
  }

  /* Quantas questões existem por banco / dificuldade / tema — alimenta o painel
     de configuração (o aluno vê quantas questões pode pedir antes de começar). */
  function drqEstatisticas() {
    var out = {};
    ["anac", "apostilas"].forEach(function (b) {
      var banco = drqBanco(b);
      var info = { total: banco.length, dif: { facil: 0, medio: 0, dificil: 0 }, temas: {} };
      banco.forEach(function (q) {
        if (info.dif[q.dif] !== undefined) info.dif[q.dif]++;
        info.temas[q.tema] = (info.temas[q.tema] || 0) + 1;
      });
      out[b] = info;
    });
    return out;
  }

  /* Monta a prova.
     opcoes = { banco, dificuldade, qtd, alternativas, temas?, apostilas?, seed? }
     Devolve { prova, avisos, pedido }. Cada item da prova já vem com as
     alternativas embaralhadas e o gabarito marcado em alt.ok. */
  function drqSortear(opcoes) {
    var o = opcoes || {};
    var nomeBanco = o.banco === "anac" ? "anac" : "apostilas";
    var dificuldade = DIFS.indexOf(o.dificuldade) >= 0 ? o.dificuldade : "mista";
    var nAlt = Math.max(2, Math.min(6, Math.round(Number(o.alternativas) || 4)));
    var rnd = drqRng(o.seed);
    var avisos = [];

    var pool = drqBanco(nomeBanco).slice();
    if (o.temas && o.temas.length) {
      pool = pool.filter(function (q) { return o.temas.indexOf(q.tema) >= 0; });
    }
    if (o.apostilas && o.apostilas.length) {
      pool = pool.filter(function (q) { return o.apostilas.indexOf(q.ap) >= 0; });
    }
    if (!pool.length) return { prova: [], avisos: ["Nenhuma questão encontrada com esses filtros."], pedido: o };

    var pedida = Math.max(1, Math.round(Number(o.qtd) || 10));
    var escolhidas;

    if (dificuldade === "mista") {
      // Mista = 35% fácil, 40% médio, 25% difícil, e o que faltar entra de onde tiver.
      var fatias = { facil: 0.35, medio: 0.4, dificil: 0.25 };
      escolhidas = [];
      DIFS.forEach(function (d) {
        var alvo = Math.round(pedida * fatias[d]);
        var desse = drqEmbaralhar(pool.filter(function (q) { return q.dif === d; }), rnd);
        escolhidas = escolhidas.concat(desse.slice(0, alvo));
      });
      if (escolhidas.length < pedida) {
        var jaTem = {};
        escolhidas.forEach(function (q) { jaTem[q.id] = 1; });
        var resto = drqEmbaralhar(pool.filter(function (q) { return !jaTem[q.id]; }), rnd);
        escolhidas = escolhidas.concat(resto.slice(0, pedida - escolhidas.length));
      }
      escolhidas = drqEmbaralhar(escolhidas, rnd).slice(0, pedida);
    } else {
      var doNivel = drqEmbaralhar(pool.filter(function (q) { return q.dif === dificuldade; }), rnd);
      escolhidas = doNivel.slice(0, pedida);
      if (escolhidas.length < pedida) {
        // Faltou questão desse nível: completa com os vizinhos e AVISA (nunca
        // repete questão na mesma prova, e nunca entrega menos do que dá).
        var falta = pedida - escolhidas.length;
        var usados = {};
        escolhidas.forEach(function (q) { usados[q.id] = 1; });
        var vizinhos = drqEmbaralhar(pool.filter(function (q) { return !usados[q.id]; }), rnd);
        escolhidas = escolhidas.concat(vizinhos.slice(0, falta));
        avisos.push("O banco tem " + doNivel.length + " questão(ões) de nível " +
          DIF_NOME[dificuldade].toLowerCase() + " nesse modo; as outras " +
          Math.min(falta, vizinhos.length) + " vieram de outros níveis.");
      }
    }

    if (escolhidas.length < pedida) {
      avisos.push("Você pediu " + pedida + " questões e o banco tem " + escolhidas.length + " disponíveis com esses filtros.");
    }

    var prova = escolhidas.map(function (q) {
      var erradas = drqEmbaralhar(q.e || [], rnd).slice(0, Math.max(1, nAlt - 1));
      if (erradas.length < nAlt - 1) {
        // Questão com menos distratores do que o pedido: a prova sai com menos
        // alternativas nessa questão em vez de repetir texto.
        avisos.push("A questão " + q.id + " tem só " + (erradas.length + 1) + " alternativas disponíveis.");
      }
      var alts = drqEmbaralhar([{ t: q.c, ok: true }].concat(erradas.map(function (t) {
        return { t: t, ok: false };
      })), rnd);
      return {
        id: q.id, tema: q.tema, dif: q.dif, ap: q.ap || "",
        p: q.p, alts: alts, exp: q.exp, fonte: q.fonte,
        gabarito: alts.reduce(function (acc, a, i) { return a.ok ? i : acc; }, -1),
      };
    });

    return {
      prova: prova, avisos: avisos,
      pedido: { banco: nomeBanco, dificuldade: dificuldade, qtd: prova.length, alternativas: nAlt },
    };
  }

  /* Corrige. respostas = array do índice marcado em cada questão (null = branco).
     Devolve o resumo e o detalhe por questão, para a tela de revisão. */
  function drqCorrigir(prova, respostas) {
    var r = respostas || [];
    var detalhe = prova.map(function (q, i) {
      var marcada = r[i] === undefined || r[i] === null ? null : Number(r[i]);
      var acertou = marcada !== null && !!(q.alts[marcada] && q.alts[marcada].ok);
      return {
        id: q.id, tema: q.tema, dif: q.dif, p: q.p, alts: q.alts,
        marcada: marcada, gabarito: q.gabarito, acertou: acertou,
        embranco: marcada === null, exp: q.exp, fonte: q.fonte,
      };
    });
    var acertos = detalhe.filter(function (d) { return d.acertou; }).length;
    var porTema = {}, porDif = {};
    detalhe.forEach(function (d) {
      (porTema[d.tema] = porTema[d.tema] || { total: 0, acertos: 0 }).total++;
      if (d.acertou) porTema[d.tema].acertos++;
      (porDif[d.dif] = porDif[d.dif] || { total: 0, acertos: 0 }).total++;
      if (d.acertou) porDif[d.dif].acertos++;
    });
    var total = prova.length;
    return {
      total: total, acertos: acertos, erros: total - acertos,
      embranco: detalhe.filter(function (d) { return d.embranco; }).length,
      pct: total ? Math.round((acertos / total) * 1000) / 10 : 0,
      aprovado: total ? acertos / total >= 0.7 : false, // 70% é o corte da prova da ANAC
      porTema: porTema, porDif: porDif, detalhe: detalhe,
    };
  }

  raiz.droneQuestoes = {
    versao: "2026-09-26",
    ANAC: QUESTOES_ANAC,
    APOSTILAS: QUESTOES_APOSTILAS,
    DIFS: DIFS,
    DIF_NOME: DIF_NOME,
    banco: drqBanco,
    estatisticas: drqEstatisticas,
    sortear: drqSortear,
    corrigir: drqCorrigir,
    embaralhar: drqEmbaralhar,
    rng: drqRng,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = raiz.droneQuestoes;
})(typeof globalThis !== "undefined" ? globalThis : this);
