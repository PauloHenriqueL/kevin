/* Editor de blocos da aula — arrastar + autosave (Demanda 7, D25).
 *
 * Vanilla JS, sem dependência: HTML5 Drag & Drop para reordenar e mover blocos
 * entre fases, e fetch para persistir na hora. A ordem visual é a fonte da
 * verdade — ao soltar, recalculamos ordem/fase de cada bloco e mandamos tudo.
 */
(function () {
  'use strict';

  var editor = document.getElementById('editor');
  if (!editor) return;

  var aulaId = editor.dataset.aula;

  function csrftoken() {
    var m = document.cookie.match(/csrftoken=([^;]+)/);
    return m ? m[1] : '';
  }

  function post(url, dados) {
    return fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': csrftoken(),
      },
      body: JSON.stringify(dados || {}),
    }).then(function (r) {
      if (!r.ok) throw new Error('falha ao salvar');
      return r.json();
    });
  }

  function toast(msg, erro) {
    var t = document.createElement('div');
    t.className = 'toast' + (erro ? ' error' : '');
    t.textContent = msg;
    var stack = document.querySelector('.toast-stack');
    if (!stack) {
      stack = document.createElement('div');
      stack.className = 'toast-stack';
      stack.style.cssText =
        'position:fixed;top:84px;right:24px;display:flex;flex-direction:column;gap:8px;z-index:9999;';
      document.body.appendChild(stack);
    }
    stack.appendChild(t);
    setTimeout(function () { t.remove(); }, 2400);
  }

  // ── Persistir a ordem/fase atual de todos os blocos ──
  function salvarOrdem() {
    var blocos = [];
    editor.querySelectorAll('.fase-blocos').forEach(function (coluna) {
      var fase = coluna.dataset.fase;
      coluna.querySelectorAll('.bloco-card').forEach(function (card, i) {
        blocos.push({ id: parseInt(card.dataset.id, 10), fase: fase, ordem: i + 1 });
      });
    });
    post('/coordenacao/aula/' + aulaId + '/blocos/reordenar/', { blocos: blocos })
      .catch(function () { toast('Não consegui salvar a ordem', true); });
  }

  // ── Drag & drop ──
  var arrastando = null;

  editor.addEventListener('dragstart', function (e) {
    var card = e.target.closest('.bloco-card');
    if (!card) return;
    arrastando = card;
    card.classList.add('arrastando');
    e.dataTransfer.effectAllowed = 'move';
  });

  editor.addEventListener('dragend', function () {
    if (arrastando) arrastando.classList.remove('arrastando');
    arrastando = null;
    editor.querySelectorAll('.fase-blocos').forEach(function (c) {
      c.classList.remove('drop-alvo');
    });
  });

  // Descobre depois de qual card soltar, pela posição vertical do mouse.
  function cardApos(coluna, y) {
    var cards = [].slice.call(
      coluna.querySelectorAll('.bloco-card:not(.arrastando)')
    );
    return cards.reduce(function (mais, card) {
      var box = card.getBoundingClientRect();
      var offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > mais.offset) {
        return { offset: offset, elemento: card };
      }
      return mais;
    }, { offset: -Infinity, elemento: null }).elemento;
  }

  editor.addEventListener('dragover', function (e) {
    var coluna = e.target.closest('.fase-blocos');
    if (!coluna || !arrastando) return;
    e.preventDefault();
    coluna.classList.add('drop-alvo');
    var apos = cardApos(coluna, e.clientY);
    if (apos == null) {
      coluna.appendChild(arrastando);
    } else {
      coluna.insertBefore(arrastando, apos);
    }
  });

  editor.addEventListener('dragleave', function (e) {
    var coluna = e.target.closest('.fase-blocos');
    if (coluna && !coluna.contains(e.relatedTarget)) {
      coluna.classList.remove('drop-alvo');
    }
  });

  editor.addEventListener('drop', function (e) {
    if (!arrastando) return;
    e.preventDefault();
    salvarOrdem();
  });

  // ── Remover bloco ──
  editor.addEventListener('click', function (e) {
    var botao = e.target.closest('.bloco-remover');
    if (!botao) return;
    var card = botao.closest('.bloco-card');
    if (!confirm('Remover este bloco?')) return;
    post('/coordenacao/bloco/' + botao.dataset.id + '/remover/')
      .then(function () { card.remove(); })
      .catch(function () { toast('Não consegui remover', true); });
  });

  // ── Adicionar bloco ──
  var modal = document.getElementById('modal-add');
  var faseAlvo = document.getElementById('add-fase');
  var busca = document.getElementById('busca-atividade');
  var resultados = document.getElementById('resultados-atividade');
  var tituloLivre = document.getElementById('titulo-livre');

  editor.addEventListener('click', function (e) {
    var botao = e.target.closest('.fase-add');
    if (!botao) return;
    faseAlvo.value = botao.dataset.fase;
    busca.value = '';
    tituloLivre.value = '';
    resultados.innerHTML = '';
    modal.showModal();
    busca.focus();
  });

  function novoCard(bloco) {
    var card = document.createElement('article');
    card.className = 'bloco-card';
    card.draggable = true;
    card.dataset.id = bloco.id;
    var corpo = bloco.atividade_id
      ? '<span class="bloco-atividade">' + bloco.atividade_nome + '</span>' +
        '<span class="bloco-tipo">' + bloco.atividade_tipo + '</span>'
      : '<span class="bloco-titulo-livre">' + bloco.titulo + '</span>';
    card.innerHTML =
      '<div class="bloco-arrasta" aria-hidden="true">⠿</div>' +
      '<div class="bloco-corpo">' + corpo + '</div>' +
      '<button class="bloco-remover" data-id="' + bloco.id + '" title="Remover" aria-label="Remover bloco">×</button>';
    return card;
  }

  function adicionar(payload) {
    return post('/coordenacao/aula/' + aulaId + '/blocos/adicionar/', payload)
      .then(function (r) {
        var coluna = editor.querySelector(
          '.fase-blocos[data-fase="' + payload.fase + '"]'
        );
        coluna.appendChild(novoCard(r.bloco));
        modal.close();
      })
      .catch(function () { toast('Não consegui adicionar', true); });
  }

  // Autocomplete de atividade (debounce simples).
  var timer = null;
  busca.addEventListener('input', function () {
    clearTimeout(timer);
    var q = busca.value.trim();
    timer = setTimeout(function () {
      fetch('/coordenacao/atividades/buscar/?q=' + encodeURIComponent(q))
        .then(function (r) { return r.json(); })
        .then(function (dados) {
          resultados.innerHTML = '';
          dados.resultados.forEach(function (a) {
            var li = document.createElement('li');
            li.innerHTML =
              '<strong>' + a.nome + '</strong> <em>' + a.tipo + '</em>' +
              (a.descricao ? '<span>' + a.descricao + '</span>' : '');
            li.addEventListener('click', function () {
              adicionar({ fase: faseAlvo.value, atividade_id: a.id });
            });
            resultados.appendChild(li);
          });
        });
    }, 180);
  });

  document.getElementById('add-titulo-livre').addEventListener('click', function () {
    var t = tituloLivre.value.trim();
    if (!t) { busca.focus(); return; }
    adicionar({ fase: faseAlvo.value, titulo: t });
  });
})();
