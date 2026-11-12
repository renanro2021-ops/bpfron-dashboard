// Navegação dos menus pelo controle (12/11/2026, pedido do usuário: "o joystick controlar o menu").
// Só age quando há uma tela de menu aberta (início, escolha de voo, mapas, configurações, pausa, resultados...).
// Durante o voo não faz nada: os botões continuam sendo do drone (input.js).
//   Direcional ou stick esquerdo: anda entre os botões (pelo que está mais perto naquela direção)
//   A: aperta o botão marcado          B: volta (botão de voltar da tela, ou sai da pausa)
//   LB / RB: troca o drone no início e a aba nas configurações
// Padrão "standard" do Gamepad API: 0=A 1=B 2=X 3=Y 4=LB 5=RB 12..15 = cima/baixo/esquerda/direita.
const FOCO = 'pad-foco';

export class PadMenu {
  constructor(game) {
    this.game = game;
    this.el = null;          // botão marcado
    this.tela = null;        // tela em que o foco foi colocado
    this.ant = {};           // botões apertados no quadro anterior
    this.dir = null; this.repT = 0;
    this.usando = false;     // só mostra o contorno depois que o controle for usado no menu
    // mexeu o mouse de verdade (o Chrome também solta "mousemove" falso quando a tela se mexe sob o cursor parado)
    this.mouse = null;
    addEventListener('mousemove', (e) => {
      const m = this.mouse; this.mouse = [e.clientX, e.clientY];
      if (!m || Math.abs(m[0] - e.clientX) + Math.abs(m[1] - e.clientY) < 6) return;
      if (this.usando) { this.usando = false; this.marcar(null); }
    });
    requestAnimationFrame((t) => this.quadro(t));
  }

  pad() {
    const ps = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of ps) if (p && p.connected && p.buttons.length >= 4) return p;
    return null;
  }

  // tela de menu aberta agora (null = em voo ou nenhuma)
  telaAtiva() {
    const g = this.game;
    if (!g.activeScreen) return null;
    if (document.getElementById('drc-ovl') || document.getElementById('aviso-celular')?.style.display === 'flex') return null;
    return document.querySelector(`.screen.active[data-screen="${g.activeScreen}"]`);
  }

  visivel(el) {
    if (!el || el.disabled) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) return false;
    const st = getComputedStyle(el);
    return st.visibility !== 'hidden' && st.display !== 'none' && el.offsetParent !== null;
  }

  alvos(tela) {
    // um alvo só por controle ‹ valor › (esquerda/direita já trocam o valor)
    const rep = (ctl) => ctl.querySelector('.v') || ctl.querySelector('.a');
    return [...tela.querySelectorAll('button, [data-go], .ctl .v, input[type=text]')].filter((e) => {
      const ctl = e.closest('.ctl');
      if (ctl && ctl.querySelectorAll('.a').length === 2 && rep(ctl) !== e) return false;
      return this.visivel(e);
    });
  }

  primeiro(tela, lista) {
    // só entre os alvos válidos (num controle ‹ valor › o alvo é o valor, não a seta)
    const sel = '.go, #resume, #lessonGo, #again, #nameOk, .card, .mcard, .grid button, #setRows .ctl .v, #setRows .ctl .a, #setRows button';
    return lista.find((e) => e.matches(sel)) || lista[0] || null;
  }

  marcar(el) {
    document.querySelectorAll('.' + FOCO).forEach((x) => x.classList.remove(FOCO));
    this.el = el;
    if (el && this.usando) {
      // nas configurações o contorno vai no controle ‹ valor › inteiro, e a ajuda da direita acompanha a linha
      (el.closest('.ctl') || el).classList.add(FOCO);
      const row = el.closest('.row');
      if (row) row.dispatchEvent(new MouseEvent('mouseenter'));
      el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }

  // escolhe o vizinho mais perto na direção pedida (o desvio para o lado pesa mais que a distância)
  andar(dx, dy, lista) {
    if (!this.el || !lista.includes(this.el)) return this.marcar(this.primeiro(this.tela, lista));
    const a = this.el.getBoundingClientRect();
    const ax = a.left + a.width / 2, ay = a.top + a.height / 2;
    let melhor = null, nota = Infinity;
    for (const e of lista) {
      if (e === this.el) continue;
      const b = e.getBoundingClientRect();
      const bx = b.left + b.width / 2, by = b.top + b.height / 2;
      const vx = bx - ax, vy = by - ay;
      const frente = vx * dx + vy * dy;            // quanto anda na direção
      if (frente <= 4) continue;
      const lado = Math.abs(vx * dy - vy * dx);    // quanto foge para o lado
      const n = frente + lado * 2.2;
      if (n < nota) { nota = n; melhor = e; }
    }
    if (melhor) this.marcar(melhor);
  }

  apertou(p, i) { const b = !!(p.buttons[i] && p.buttons[i].pressed); const novo = b && !this.ant[i]; this.ant[i] = b; return novo; }

  voltar(tela) {
    const g = this.game;
    const back = tela.querySelector('.subbar .back');
    if (back && this.visivel(back)) { back.click(); return; }
    if (g.activeScreen === 'pause') { document.getElementById('resume')?.click(); return; }
    if (g.activeScreen === 'name') { document.getElementById('nameCancel')?.click(); return; }
    if (g.activeScreen === 'results') { document.getElementById('resMenu')?.click(); return; }
    if (g.activeScreen === 'lesson') { document.getElementById('lessonQuit')?.click(); }
  }

  quadro(t) {
    requestAnimationFrame((tt) => this.quadro(tt));
    const dt = Math.min(0.1, (t - (this.t0 ?? t)) / 1000); this.t0 = t;
    const p = this.pad();
    const tela = this.telaAtiva();
    if (!p || !tela) {
      if (p) for (let i = 0; i < p.buttons.length; i++) this.ant[i] = !!p.buttons[i].pressed; // não "vaza" aperto do voo para o menu
      if (!tela && this.el) this.marcar(null);
      this.tela = tela; this.dir = null;
      return;
    }
    const lista = this.alvos(tela);
    // tela nova: se a pessoa já está no controle, o foco já nasce no botão principal (um A só para seguir)
    if (tela !== this.tela) { this.tela = tela; this.marcar(this.usando ? this.primeiro(tela, lista) : null); }
    else if (this.usando && !this.el && lista.length) this.marcar(this.primeiro(tela, lista)); // tela ainda abrindo no quadro anterior
    if (this.el && !lista.includes(this.el)) this.marcar(null);

    // direção: direcional (12..15) ou stick esquerdo
    const bt = (i) => !!(p.buttons[i] && p.buttons[i].pressed);
    const lx = p.axes[0] || 0, ly = p.axes[1] || 0;
    let d = null;
    if (bt(12) || ly < -0.6) d = 'c'; else if (bt(13) || ly > 0.6) d = 'b';
    else if (bt(14) || lx < -0.6) d = 'e'; else if (bt(15) || lx > 0.6) d = 'd';
    if (d) {
      if (d !== this.dir) { this.repT = 0.38; this.mover(d, lista); }
      else { this.repT -= dt; if (this.repT <= 0) { this.repT = 0.13; this.mover(d, lista); } }
    }
    this.dir = d;

    if (this.apertou(p, 0)) {
      if (!this.usando || !this.el) { this.usando = true; this.marcar(this.el || this.primeiro(tela, lista)); }
      else if (this.el.tagName === 'INPUT') this.el.focus();
      else this.el.click();
    }
    if (this.apertou(p, 1)) { this.usando = true; this.voltar(tela); }
    const lb = this.apertou(p, 4), rb = this.apertou(p, 5);
    if (lb || rb) {
      this.usando = true;
      const s = lb ? -1 : 1;
      if (this.game.activeScreen === 'main') document.getElementById(s < 0 ? 'prevDrone' : 'nextDrone')?.click();
      if (this.game.activeScreen === 'settings') {
        const abas = [...document.querySelectorAll('#tabs button')];
        const i = abas.findIndex((b) => b.classList.contains('on'));
        abas[(i + s + abas.length) % abas.length]?.click();
        this.marcar(this.primeiro(tela, this.alvos(tela)));
      }
    }
    for (const i of [2, 3, 6, 7, 8, 9, 10, 11]) this.ant[i] = bt(i);
  }

  mover(d, lista) {
    this.usando = true;
    if (!this.el || !lista.includes(this.el)) return this.marcar(this.primeiro(this.tela, lista));
    // nas configurações, esquerda/direita num controle ‹ valor › troca o valor
    const ctl = this.el.closest('.ctl');
    if (ctl && (d === 'e' || d === 'd') && ctl.querySelectorAll('.a').length === 2) {
      const [l, r] = ctl.querySelectorAll('.a');
      (d === 'e' ? l : r).click();
      return;
    }
    const v = { c: [0, -1], b: [0, 1], e: [-1, 0], d: [1, 0] }[d];
    this.andar(v[0], v[1], lista);
  }
}
