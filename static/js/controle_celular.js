/**
 * Controle do Kevin pelo celular (D62).
 *
 * O celular não grava nem toca nada: manda comandos ao telão (pela fila no
 * servidor) e mostra o estado que o telão publica. O microfone que vale é o
 * do telão, aberto só enquanto o professor segura o botão — microfone fechado,
 * como pede a resolução do CNE/MEC.
 *
 * Botão de falar: segurar = falar enquanto segura. Toque curto = começa, e
 * outro toque envia (para quem não consegue segurar enquanto organiza a turma).
 */
(function () {
  const cfg = window.CONTROLE_CONFIG;
  const raiz = document.getElementById('cc');
  if (!cfg || !raiz) return;

  const btnFalar = document.getElementById('cc-falar');
  const dica = document.getElementById('cc-falar-dica');
  const btnIniciar = document.getElementById('cc-iniciar');
  const statusTexto = document.getElementById('cc-status-texto');
  const conexao = document.getElementById('cc-conexao');
  const btnRepetir = document.getElementById('cc-repetir');
  const btnWhisper = document.getElementById('cc-whisper');
  const btnSoIngles = document.getElementById('cc-so-ingles');

  const TOQUE_CURTO_MS = 450;
  const DICA_PADRAO = 'Segure para falar · ou toque uma vez para começar e outra para enviar';
  const TEXTO_FASE = {
    ocioso: 'Pronto. Aperte para falar com o Kevin.',
    gravando: 'Ouvindo você…',
    pensando: 'O Kevin está pensando…',
    falando: 'O Kevin está falando…',
    musica: 'Música tocando',
    nao_iniciado: 'A aula ainda não começou no telão.',
  };

  let estado = {};
  let telaoOnline = false;
  let falhas = 0;
  let falandoLocal = false;     // o botão está "aberto" deste lado
  let modoToque = false;        // abriu por toque curto: o próximo toque envia
  let apertouEm = 0;
  let viuGravando = false;      // o telão confirmou que abriu o microfone
  let fila = Promise.resolve(); // comandos saem em ordem
  let buscarLogo = null;

  // ── Comandos ──
  function enviar(tipo) {
    if (navigator.vibrate) navigator.vibrate(25);
    fila = fila.then(async () => {
      try {
        const r = await fetch(cfg.comando, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tipo }),
        });
        if (r.status === 403) return linkVencido();
        if (r.ok) aplicar(await r.json());
      } catch (e) {
        console.warn('[Controle] comando falhou', tipo, e);
      }
    });
    // Logo depois de um comando, o estado muda rápido: pergunta de novo cedo.
    agendar(250);
    return fila;
  }

  /**
   * O botão só fica vermelho ("Fale agora") quando o TELÃO confirma que abriu o
   * microfone: entre o toque e a confirmação passa meio segundo, e quem
   * começasse a falar na hora perderia o começo da frase. Até lá, amarelo.
   */
  function atualizarBotao() {
    if (!falandoLocal) {
      raiz.dataset.falando = 'false';
      dica.textContent = DICA_PADRAO;
      return;
    }
    raiz.dataset.falando = viuGravando ? 'true' : 'abrindo';
    const fim = modoToque ? 'toque de novo para enviar' : 'solte para enviar';
    dica.textContent = viuGravando ? 'Fale agora · ' + fim : 'Abrindo o microfone do telão… espere ficar vermelho';
  }

  function abrirFala() {
    falandoLocal = true;
    viuGravando = false;
    atualizarBotao();
    enviar('falar_inicio');
  }

  function fecharFala() {
    falandoLocal = false;
    modoToque = false;
    viuGravando = false;
    atualizarBotao();
    enviar('falar_fim');
  }

  btnFalar.addEventListener('pointerdown', (e) => {
    if (btnFalar.disabled) return;
    e.preventDefault();
    if (falandoLocal && modoToque) { fecharFala(); return; }
    if (falandoLocal) return;
    try { btnFalar.setPointerCapture(e.pointerId); } catch (err) { /* sem captura, segue */ }
    apertouEm = performance.now();
    abrirFala();
  });

  function soltou() {
    if (!falandoLocal || modoToque) return;
    if (performance.now() - apertouEm < TOQUE_CURTO_MS) {
      // Toque curto: fica aberto até o próximo toque.
      modoToque = true;
      atualizarBotao();
      return;
    }
    fecharFala();
  }
  btnFalar.addEventListener('pointerup', soltou);
  btnFalar.addEventListener('pointercancel', soltou);
  btnFalar.addEventListener('contextmenu', (e) => e.preventDefault());

  document.querySelectorAll('.cc-btn[data-comando]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (btn.disabled) return;
      // Whisper/Só inglês: mostra a mudança na hora; o telão confirma em seguida.
      if (btn.hasAttribute('aria-pressed')) {
        btn.setAttribute('aria-pressed', btn.getAttribute('aria-pressed') === 'true' ? 'false' : 'true');
      }
      enviar(btn.dataset.comando);
    });
  });
  btnIniciar.addEventListener('click', () => { btnIniciar.hidden = true; enviar('iniciar'); });

  // ── Estado do telão ──
  function aplicar(dados) {
    telaoOnline = !!dados.telao_online;
    estado = dados.estado || {};
    raiz.dataset.conectado = telaoOnline ? 'true' : 'false';
    conexao.textContent = telaoOnline ? 'Telão conectado' : 'Telão desconectado';

    const iniciado = !!estado.iniciado;
    let fase = estado.fase || 'ocioso';
    if (!telaoOnline) fase = 'desconectado';
    else if (!iniciado) fase = 'nao_iniciado';
    raiz.dataset.fase = fase;
    statusTexto.textContent = telaoOnline
      ? (TEXTO_FASE[fase] || TEXTO_FASE.ocioso)
      : 'O telão não está respondendo. A aula está aberta nele?';
    if (telaoOnline && estado.modo === 'live') statusTexto.textContent += ' · ao vivo';

    btnIniciar.hidden = !(telaoOnline && !iniciado);
    btnFalar.disabled = !(telaoOnline && iniciado);
    btnRepetir.disabled = !(telaoOnline && estado.repetir);
    btnWhisper.setAttribute('aria-pressed', estado.whisper ? 'true' : 'false');
    btnSoIngles.setAttribute('aria-pressed', estado.so_ingles ? 'true' : 'false');

    if (falandoLocal && fase === 'gravando' && !viuGravando) {
      viuGravando = true;  // o telão confirmou: agora sim, "fale agora"
      if (navigator.vibrate) navigator.vibrate([20, 40, 20]);
      atualizarBotao();
    } else if (falandoLocal && viuGravando && fase !== 'gravando') {
      // O telão parou de gravar sozinho (limite de 30 s, erro): solta o botão aqui também.
      falandoLocal = false; modoToque = false; viuGravando = false;
      atualizarBotao();
    }
  }

  function linkVencido() {
    window.location.reload();  // o servidor devolve a tela de "link não vale mais"
  }

  async function buscar() {
    buscarLogo = null;
    try {
      const r = await fetch(cfg.estado, { cache: 'no-store' });
      if (r.status === 403) return linkVencido();
      if (!r.ok) throw new Error('HTTP ' + r.status);
      falhas = 0;
      aplicar(await r.json());
    } catch (e) {
      falhas += 1;
      if (falhas >= 3) aplicar({ telao_online: false, estado });
    }
    agendar(falandoLocal || estado.fase === 'pensando' ? 400 : 900);
  }

  function agendar(ms) {
    if (buscarLogo) clearTimeout(buscarLogo);
    buscarLogo = setTimeout(buscar, ms);
  }

  // Volta a ficar visível (tela desbloqueada): atualiza na hora.
  document.addEventListener('visibilitychange', () => { if (!document.hidden) agendar(0); });
  buscar();
})();
