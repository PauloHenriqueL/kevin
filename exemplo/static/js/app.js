/**
 * Kevin Platform - Main Application
 * SPA com navegacao client-side e integracoes de chat com Kevin animado
 */
(function () {
  'use strict';

  // ── State ──
  const state = {
    user: null,
    currentPage: 'login',
    chatHistory: [],
    currentLesson: null,
    availableUnits: [],
    isSending: false,
    mediaRecorder: null,
    isRecording: false,
    liveMode: false,
    audioContext: null,
    silenceTimer: null,
    analyserNode: null,
    micStream: null,
    currentAudioSource: null,
    currentSessionId: null,
  };

  // ── Silence detection config ──
  const SILENCE_THRESHOLD = 0.015;   // amplitude below this = silence
  const SILENCE_TIMEOUT_MS = 2500;   // stop after 2.5s of silence
  const MAX_RECORD_MS = 30000;       // hard cap: 30s per recording

  // ── Stop all audio, mic, and live mode ──
  function stopAllAudio() {
    // Stop any playing audio
    if (state.currentAudioSource) {
      try { state.currentAudioSource.stop(); } catch {}
      state.currentAudioSource = null;
    }
    // Stop recording
    if (state.isRecording) {
      state.isRecording = false;
      if (state.mediaRecorder && state.mediaRecorder.state !== 'inactive') {
        try { state.mediaRecorder.stop(); } catch {}
      }
    }
    // Stop mic stream
    if (state.micStream) {
      state.micStream.getTracks().forEach(t => t.stop());
      state.micStream = null;
    }
    // Disable live mode
    state.liveMode = false;
    // Clean up silence detection
    if (state._stopMonitor) {
      state._stopMonitor();
      state._stopMonitor = null;
    }
    state.analyserNode = null;
  }

  // ── Save audit log for current session ──
  async function saveAuditLog() {
    if (!state.currentLesson || state.chatHistory.length === 0) return;
    try {
      await api('/api/audit/save', {
        method: 'POST',
        body: {
          user: state.user,
          lesson: state.currentLesson,
          messages: state.chatHistory,
        },
      });
      console.log('[Kevin] Audit log saved.');
    } catch (err) {
      console.error('[Kevin] Failed to save audit log:', err);
    }
  }

  // ── Unlock audio playback on first user interaction ──
  function ensureAudioContext() {
    if (state.audioContext) return;
    state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    // Resume if suspended (browser policy)
    if (state.audioContext.state === 'suspended') {
      state.audioContext.resume();
    }
  }
  ['click', 'touchstart', 'keydown'].forEach(evt => {
    document.addEventListener(evt, ensureAudioContext, { once: false });
  });

  // ── Kevin inline renderer (usa o SVG do kevin-widget.js) ──
  // We create inline Kevin SVGs for various places without the fixed widget
  function kevinSVG(expression, size) {
    // Reuse the global Kevin widget's rendering by temporarily changing size
    // Instead, we'll directly use the expressions from the loaded kevin-widget.js
    // The Kevin widget is loaded globally, but for inline use we need raw SVG
    // We'll call into the widget's internals through a helper
    return `<div class="kevin-inline" style="width:${size}px;height:${size}px;" data-kevin-expr="${expression}" data-kevin-size="${size}"></div>`;
  }

  function renderInlineKevins() {
    document.querySelectorAll('.kevin-inline[data-kevin-expr]').forEach(el => {
      if (el.dataset.rendered) return;
      el.dataset.rendered = 'true';
      const expr = el.dataset.kevinExpr;
      const size = parseInt(el.dataset.kevinSize) || 100;
      // Use the global Kevin widget to get SVG
      // We'll manually create a mini Kevin here using the widget's mount
      const miniKevin = document.createElement('div');
      miniKevin.style.width = size + 'px';
      miniKevin.style.height = size + 'px';
      el.appendChild(miniKevin);

      // Create a mini Kevin instance by rendering SVG directly
      if (window._kevinExpressions) {
        const exp = window._kevinExpressions[expr];
        if (exp) {
          const svg = expr === 'talking'
            ? exp.svg(size, 0.3)
            : exp.svg(size);
          miniKevin.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" overflow="visible">${svg}</svg>`;

          // Add animation class
          if (exp.animClass) {
            miniKevin.querySelector('svg').style.animation =
              exp.animClass === 'kv-shake'
                ? `${exp.animClass} 0.55s ease-in-out 1`
                : `${exp.animClass} ${
                    exp.animClass === 'kv-bounce' ? '1.2s' :
                    exp.animClass === 'kv-laughing' ? '0.7s' : '2s'
                  } ease-in-out infinite`;
          }
        }
      }
    });
  }

  // ── Helpers ──
  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return (ctx || document).querySelectorAll(sel); }

  function api(endpoint, options = {}) {
    const opts = {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    };
    if (opts.body && typeof opts.body === 'object' && !(opts.body instanceof FormData)) {
      opts.body = JSON.stringify(opts.body);
    }
    if (opts.body instanceof FormData) {
      delete opts.headers['Content-Type'];
    }
    return fetch(endpoint, opts).then(r => {
      if (opts.rawResponse) return r;
      return r.json();
    });
  }

  function showToast(msg, isError = false) {
    const toast = document.createElement('div');
    toast.className = 'toast' + (isError ? ' error' : '');
    toast.innerHTML = `<span>${isError ? '\u2716' : '\u2714'}</span> ${msg}`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ── App root ──
  function getApp() { return document.getElementById('app'); }

  // Page class mapping for CSS
  const PAGE_CLASSES = {
    login: 'login-page',
    home: 'home-page',
    lessons: 'lessons-page',
    year: 'year-page',
    chat: 'chat-page',
    help: 'help-page',
    questions: 'questions-page',
    admin_add: 'admin-page',
    admin_list: 'admin-page',
    admin_logs: 'admin-page',
  };

  // ── Navigation ──
  function navigate(page, data) {
    state.currentPage = page;

    // Clear the single app container and set the page class
    const app = getApp();
    app.innerHTML = '';
    app.className = PAGE_CLASSES[page] || '';

    // Render
    switch (page) {
      case 'login': renderLogin(); break;
      case 'home': renderHome(); break;
      case 'lessons': renderLessons(); break;
      case 'year': renderYear(data); break;
      case 'chat': renderChat(data); break;
      case 'help': renderHelp(); break;
      case 'questions': renderQuestions(); break;
      case 'admin_add': renderAdminAdd(); break;
      case 'admin_list': renderAdminList(); break;
      case 'admin_logs': renderAdminLogs(); break;
    }

    if (window.Kevin) window.Kevin.hide();
    window.scrollTo(0, 0);
  }

  // ── Login Page ──
  function renderLogin() {
    const page = getApp();

    page.innerHTML = `
      <div class="login-container fade-in">
        <div class="login-kevin-avatar" id="login-kevin"></div>
        <h1 class="login-title">Kevin</h1>
        <p class="login-subtitle">Plataforma BeBilingue para Escolas</p>
        <div class="login-error" id="login-error"></div>
        <form class="login-form" id="login-form">
          <div class="form-group">
            <label>E-mail</label>
            <input type="email" id="login-email" placeholder="seu@email.com" required>
          </div>
          <div class="form-group">
            <label>Senha</label>
            <input type="password" id="login-password" placeholder="Sua senha" required>
          </div>
          <div class="form-group">
            <label>Perfil</label>
            <select id="login-role">
              <option value="professor">Professor</option>
              <option value="aluno">Aluno</option>
              <option value="administrador">Administrador</option>
            </select>
          </div>
          <button type="submit" class="btn btn-primary btn-full" style="margin-top:8px;">Entrar</button>
        </form>
        <details class="login-test-data">
          <summary>Dados de Teste</summary>
          <table>
            <tr><td><b>Professor</b></td><td><code>professor@escola.com</code></td><td><code>prof123</code></td></tr>
            <tr><td><b>Aluno</b></td><td><code>aluno@escola.com</code></td><td><code>aluno123</code></td></tr>
            <tr><td><b>Admin</b></td><td><code>admin@escola.com</code></td><td><code>admin123</code></td></tr>
          </table>
        </details>
      </div>
    `;

    // Render inline Kevin
    const kevinEl = $('#login-kevin');
    renderKevinInto(kevinEl, 'happy', 140);

    $('#login-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = $('#login-email').value;
      const password = $('#login-password').value;
      const role = $('#login-role').value;
      const errEl = $('#login-error');

      try {
        const res = await api('/api/login', {
          method: 'POST',
          body: { email, password, role },
        });
        if (res.success) {
          state.user = res.user;
          navigate('home');
        } else {
          errEl.textContent = res.error || 'Credenciais incorretas.';
          errEl.style.display = 'block';
        }
      } catch {
        errEl.textContent = 'Erro de conexao. Tente novamente.';
        errEl.style.display = 'block';
      }
    });
  }

  // ── Render Kevin into element using the widget's expressions ──
  function renderKevinInto(el, expression, size, animated = true) {
    if (!window._kevinExpressions) return;
    const exp = window._kevinExpressions[expression];
    if (!exp) return;

    const svg = expression === 'talking'
      ? exp.svg(size, 0.3)
      : exp.svg(size);

    const wrap = document.createElement('div');
    wrap.className = 'kv-wrap';
    wrap.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" overflow="visible">${svg}</svg>`;

    // Add animation only if requested
    if (animated && exp.animClass) {
      wrap.style.animation = exp.animClass === 'kv-shake'
        ? `${exp.animClass} 0.55s ease-in-out 1`
        : `${exp.animClass} ${
            exp.animClass === 'kv-bounce' ? '1.2s' :
            exp.animClass === 'kv-laughing' ? '0.7s' : '2s'
          } ease-in-out infinite`;
      wrap.style.transformOrigin = 'center bottom';
    }

    el.innerHTML = '';
    el.appendChild(wrap);
  }

  // ── Render static (no animation) Kevin for chat bubbles ──
  function renderKevinStatic(el, size) {
    renderKevinInto(el, 'happy', size, false);
  }

  // ── Animated talking Kevin (with mouth animation) ──
  function startTalkingKevin(el, size) {
    if (!window._kevinExpressions) return null;
    const exp = window._kevinExpressions['talking'];
    if (!exp) return null;

    let phase = 0;
    let running = true;
    const wrap = document.createElement('div');
    wrap.className = 'kv-wrap';
    wrap.style.animation = 'kv-talking-body 0.6s ease-in-out infinite';
    wrap.style.transformOrigin = 'center bottom';
    el.innerHTML = '';
    el.appendChild(wrap);

    function step() {
      if (!running) return;
      phase += 0.22;
      const open = Math.abs(Math.sin(phase)) * 0.9 + 0.05;
      const svg = exp.svg(size, open);
      wrap.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" overflow="visible">${svg}</svg>`;
      requestAnimationFrame(step);
    }
    requestAnimationFrame(step);

    return () => { running = false; };
  }

  // ── Topbar ──
  function renderTopbar(container) {
    if (!state.user) return '';

    const isAdmin = state.user.role === 'administrador';
    const isTeacherOrStudent = ['professor', 'aluno'].includes(state.user.role);

    let navLinks = `
      <button class="nav-link" data-nav="home">Home</button>
    `;
    if (isTeacherOrStudent) {
      navLinks += `
        <button class="nav-link" data-nav="lessons">Aulas</button>
        <button class="nav-link" data-nav="questions">Questions</button>
      `;
    }
    if (isAdmin) {
      navLinks += `
        <button class="nav-link" data-nav="admin_add">Adicionar Aula</button>
        <button class="nav-link" data-nav="admin_list">Aulas Criadas</button>
        <button class="nav-link" data-nav="admin_logs">Logs de Aula</button>
      `;
    }
    navLinks += `<button class="nav-link" data-nav="help">Ajuda</button>`;

    return `
      <div class="topbar">
        <div class="topbar-brand" data-nav="home">
          <div class="topbar-brand-avatar" id="topbar-kevin-${container}"></div>
          <h1>Kevin</h1>
        </div>
        <div class="topbar-nav">${navLinks}</div>
        <div class="topbar-user">
          <div class="topbar-user-info">
            <div class="topbar-user-name">${escapeHtml(state.user.name)}</div>
            <div class="topbar-user-role">${escapeHtml(state.user.role)}</div>
          </div>
          <button class="btn-logout" id="btn-logout-${container}">Sair</button>
        </div>
      </div>
    `;
  }

  function bindTopbar(container) {
    const page = getApp();

    // Nav links
    page.querySelectorAll('[data-nav]').forEach(btn => {
      btn.addEventListener('click', () => navigate(btn.dataset.nav));
    });

    // Logout
    const logoutBtn = page.querySelector(`#btn-logout-${container}`);
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        state.user = null;
        state.chatHistory = [];
        state.currentLesson = null;
        navigate('login');
      });
    }

    // Topbar Kevin avatar
    const topKevin = page.querySelector(`#topbar-kevin-${container}`);
    if (topKevin) {
      renderKevinInto(topKevin, 'happy', 40);
    }
  }

  // ── Home Page ──
  function renderHome() {
    const page = getApp();
    const isAdmin = state.user.role === 'administrador';
    const isTeacherOrStudent = ['professor', 'aluno'].includes(state.user.role);

    let cards = '';
    if (isTeacherOrStudent) {
      cards += `
        <div class="home-card card-lessons" data-nav="lessons">
          <div class="home-card-icon">\uD83D\uDCDA</div>
          <h3>Aulas (Lessons)</h3>
          <p>Conteudo curricular do Year 1 ao 5</p>
        </div>
        <div class="home-card card-questions" data-nav="questions">
          <div class="home-card-icon">\u2753</div>
          <h3>Questions</h3>
          <p>Banco de perguntas e respostas</p>
        </div>
      `;
    }
    if (isAdmin) {
      cards += `
        <div class="home-card card-admin-add" data-nav="admin_add">
          <div class="home-card-icon">\u2795</div>
          <h3>Adicionar Aula</h3>
          <p>Criar nova aula personalizada</p>
        </div>
        <div class="home-card card-admin-list" data-nav="admin_list">
          <div class="home-card-icon">\uD83D\uDCCB</div>
          <h3>Aulas Criadas</h3>
          <p>Ver e gerenciar aulas customizadas</p>
        </div>
        <div class="home-card card-admin-logs" data-nav="admin_logs">
          <div class="home-card-icon">\uD83D\uDCDD</div>
          <h3>Logs de Aula</h3>
          <p>Auditar conversas das sessoes</p>
        </div>
      `;
    }
    cards += `
      <div class="home-card card-help" data-nav="help">
        <div class="home-card-icon">\uD83D\uDEE0\uFE0F</div>
        <h3>Ajuda</h3>
        <p>Status do sistema e instrucoes</p>
      </div>
    `;

    page.innerHTML = `
      ${renderTopbar('home-page')}
      <div class="page-content">
        <div class="home-welcome fade-in">
          <div class="home-welcome-kevin" id="home-kevin"></div>
          <h2>Ola, ${escapeHtml(state.user.name.split(' ')[0])}!</h2>
          <p>O que vamos fazer hoje?</p>
        </div>
        <div class="home-cards fade-in">${cards}</div>
      </div>
    `;


    bindTopbar('home-page');

    // Kevin avatar
    renderKevinInto($('#home-kevin'), 'happy', 160);

    // Card clicks
    page.querySelectorAll('[data-nav]').forEach(el => {
      el.addEventListener('click', () => navigate(el.dataset.nav));
    });
  }

  // ── Lessons Page ──
  async function renderLessons() {
    const page = getApp();
    page.innerHTML = `
      ${renderTopbar('lessons-page')}
      <div class="page-content">
        <div class="page-header fade-in">
          <h2>Curriculum (Aulas)</h2>
          <p>Selecione o ano para ver as aulas disponiveis</p>
        </div>
        <div class="years-grid fade-in" id="years-grid">
          <p style="color:var(--texto-sec);grid-column:1/-1;text-align:center;">Carregando...</p>
        </div>
      </div>
    `;

    bindTopbar('lessons-page');

    const res = await api('/api/lessons/available');
    const units = res.units || [];
    state.availableUnits = units;

    let html = '';
    for (let i = 1; i <= 5; i++) {
      const avail = units.includes(i);
      html += `
        <div class="year-card ${avail ? 'available' : 'locked'}" ${avail ? `data-unit="${i}"` : ''}>
          <div class="year-num">${i}</div>
          <div class="year-label">Year ${i}</div>
          <span class="year-badge">${avail ? 'Disponivel' : 'Bloqueado'}</span>
        </div>
      `;
    }
    $('#years-grid').innerHTML = html;

    $$('.year-card.available').forEach(card => {
      card.addEventListener('click', () => navigate('year', { unit: parseInt(card.dataset.unit) }));
    });
  }

  // ── Year Page ──
  async function renderYear(data) {
    const unit = data.unit;
    const page = getApp();
    page.innerHTML = `
      ${renderTopbar('year-page')}
      <div class="page-content">
        <button class="btn-back" id="btn-back-lessons">\u2190 Voltar para Aulas</button>
        <div class="page-header fade-in">
          <h2>Year ${unit} - Conteudo</h2>
        </div>
        <div class="year-selector fade-in" id="year-selector">
          <h3>Configuracao da Sessao</h3>
          <p style="color:var(--texto-sec);margin-top:8px;">Carregando...</p>
        </div>
      </div>
    `;

    bindTopbar('year-page');

    $('#btn-back-lessons').addEventListener('click', () => navigate('lessons'));

    const res = await api(`/api/lessons/unit/${unit}`);
    const weeks = res.weeks || {};
    const weekKeys = Object.keys(weeks);

    if (weekKeys.length === 0) {
      $('#year-selector').innerHTML = `<p style="color:var(--texto-sec);">Nenhuma aula disponivel para Year ${unit}.</p>`;
      return;
    }

    $('#year-selector').innerHTML = `
      <h3>Configuracao da Sessao</h3>
      <div class="selector-row">
        <div class="form-group">
          <label>Semana</label>
          <select id="sel-week">
            ${weekKeys.map(w => `<option value="${w}">Week ${w}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Aula</label>
          <select id="sel-class"></select>
        </div>
      </div>
      <button class="btn btn-start-lesson" id="btn-start">Iniciar Atividade com Kevin</button>
    `;

    function updateClasses() {
      const w = $('#sel-week').value;
      const classes = weeks[w] || [];
      $('#sel-class').innerHTML = classes.map(c => `<option value="${c}">Class ${c}</option>`).join('');
    }
    updateClasses();
    $('#sel-week').addEventListener('change', updateClasses);

    $('#btn-start').addEventListener('click', () => {
      const week = $('#sel-week').value;
      const cls = $('#sel-class').value;
      state.chatHistory = [];
      state.currentLesson = { year: unit, week, class_num: cls };
      navigate('chat');
    });
  }

  // ── Chat Page ──
  function renderChat() {
    const lesson = state.currentLesson;
    if (!lesson) { navigate('lessons'); return; }

    const page = getApp();
    page.innerHTML = `
      <div class="chat-header-bar">
        <div class="chat-header-left">
          <div class="chat-header-kevin" id="chat-header-kevin"></div>
          <div class="chat-header-info">
            <h3>Kevin</h3>
            <p>Year ${lesson.year} \u2022 Week ${lesson.week} \u2022 Class ${lesson.class_num}</p>
          </div>
        </div>
        <button class="btn-end-session" id="btn-end-session">Encerrar Sessao</button>
      </div>
      <div class="chat-body" id="chat-body">
        <div class="chat-kevin-welcome" id="chat-welcome">
          <div class="chat-kevin-welcome-avatar" id="chat-welcome-kevin"></div>
          <h3>Ola! Eu sou o Kevin!</h3>
          <p>Digite uma mensagem para comecar a aula.</p>
        </div>
      </div>
      <div class="chat-input-area">
        <button class="btn-mic" id="btn-mic" title="Gravar audio">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
            <line x1="12" y1="19" x2="12" y2="23"/>
            <line x1="8" y1="23" x2="16" y2="23"/>
          </svg>
        </button>
        <button class="btn-mic-live" id="btn-mic-live" title="Conversa em tempo real">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
            <line x1="12" y1="19" x2="12" y2="23"/>
            <line x1="8" y1="23" x2="16" y2="23"/>
          </svg>
          <div class="live-waves">
            <span></span><span></span><span></span><span></span><span></span>
          </div>
        </button>
        <div class="chat-input-wrapper">
          <textarea class="chat-input" id="chat-input" placeholder="Digite sua mensagem para o Kevin..." rows="1"></textarea>
        </div>
        <button class="btn-send" id="btn-send" title="Enviar">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
          </svg>
        </button>
      </div>
    `;



    // Kevin avatars
    renderKevinInto($('#chat-header-kevin'), 'happy', 48);
    renderKevinInto($('#chat-welcome-kevin'), 'happy', 120);

    // End session
    $('#btn-end-session').addEventListener('click', async () => {
      stopAllAudio();
      await saveAuditLog();
      state.chatHistory = [];
      state.currentLesson = null;
      navigate('lessons');
    });

    // Re-render existing messages
    if (state.chatHistory.length > 0) {
      $('#chat-welcome').style.display = 'none';
      state.chatHistory.forEach(msg => appendMessage(msg.role, msg.content, false));
    }

    // Input handling
    const input = $('#chat-input');
    const sendBtn = $('#btn-send');

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    // Auto-resize textarea
    input.addEventListener('input', () => {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 120) + 'px';
    });

    sendBtn.addEventListener('click', sendMessage);

    // Mic button (manual)
    $('#btn-mic').addEventListener('click', toggleRecording);

    // Mic live button (auto-conversation mode)
    $('#btn-mic-live').addEventListener('click', toggleLiveMode);
  }

  function appendMessage(role, content, animate = true) {
    const body = $('#chat-body');
    if (!body) return;

    // Hide welcome
    const welcome = $('#chat-welcome');
    if (welcome) welcome.style.display = 'none';

    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${role}` + (animate ? ' fade-in' : '');

    if (role === 'user') {
      const initial = state.user ? state.user.name.charAt(0).toUpperCase() : 'U';
      msgDiv.innerHTML = `
        <div class="msg-avatar user-avatar">${initial}</div>
        <div class="msg-bubble">${escapeHtml(content)}</div>
      `;
    } else {
      msgDiv.innerHTML = `
        <div class="msg-avatar kevin-avatar" id="msg-kevin-${Date.now()}"></div>
        <div class="msg-bubble">${escapeHtml(content)}</div>
      `;
    }

    body.appendChild(msgDiv);

    // Render static Kevin avatar for assistant messages
    if (role === 'assistant') {
      const kevinAv = msgDiv.querySelector('.kevin-avatar');
      if (kevinAv) renderKevinStatic(kevinAv, 32);
    }

    body.scrollTop = body.scrollHeight;
  }

  function showTyping() {
    const body = $('#chat-body');
    if (!body) return;

    const welcome = $('#chat-welcome');
    if (welcome) welcome.style.display = 'none';

    const typingDiv = document.createElement('div');
    typingDiv.className = 'typing-indicator';
    typingDiv.id = 'typing-indicator';
    typingDiv.innerHTML = `
      <div class="msg-avatar kevin-avatar" id="typing-kevin"></div>
      <div class="typing-dots">
        <span></span><span></span><span></span>
      </div>
    `;
    body.appendChild(typingDiv);
    renderKevinStatic($('#typing-kevin'), 32);
    body.scrollTop = body.scrollHeight;
  }

  function hideTyping() {
    const el = $('#typing-indicator');
    if (el) el.remove();
  }

  // ── Kevin expression state in chat header ──
  function setChatKevinExpression(expr) {
    const el = $('#chat-header-kevin');
    if (!el) return;
    if (expr === 'talking') {
      return startTalkingKevin(el, 48);
    }
    renderKevinInto(el, expr, 48);
    return null;
  }

  async function sendMessage() {
    if (state.isSending) return;
    const input = $('#chat-input');
    const text = input.value.trim();
    if (!text) return;

    input.value = '';
    input.style.height = 'auto';
    state.isSending = true;
    $('#btn-send').disabled = true;

    // Show surprised Kevin briefly when message arrives
    setChatKevinExpression('surprised');

    // Add user message
    state.chatHistory.push({ role: 'user', content: text });
    appendMessage('user', text);

    // After brief surprise, show thinking
    setTimeout(() => {
      setChatKevinExpression('thinking');
    }, 600);

    // Show typing indicator
    showTyping();

    try {
      const res = await api('/api/chat', {
        method: 'POST',
        body: {
          message: text,
          year: state.currentLesson.year,
          week: state.currentLesson.week,
          class_num: state.currentLesson.class_num,
          history: state.chatHistory,
        },
      });

      hideTyping();

      if (res.reply) {
        state.chatHistory.push({ role: 'assistant', content: res.reply });

        // Try TTS — show text + play audio together
        let ttsOk = false;
        try {
          console.log('[Kevin TTS] Requesting audio...');
          const ttsRes = await fetch('/api/tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: res.reply }),
          });
          console.log('[Kevin TTS] Response status:', ttsRes.status);
          if (ttsRes.ok) {
            const blob = await ttsRes.blob();
            console.log('[Kevin TTS] Audio blob size:', blob.size);
            const audioUrl = URL.createObjectURL(blob);

            // Ensure AudioContext is unlocked
            ensureAudioContext();
            if (state.audioContext && state.audioContext.state === 'suspended') {
              await state.audioContext.resume();
            }

            // Decode audio first, then show text + play simultaneously
            const arrayBuffer = await blob.arrayBuffer();
            const audioBuffer = await state.audioContext.decodeAudioData(arrayBuffer);

            // NOW show the text and start talking animation together
            const stopTalking = setChatKevinExpression('talking');
            appendMessage('assistant', res.reply);

            const source = state.audioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(state.audioContext.destination);
            state.currentAudioSource = source;

            source.onended = () => {
              console.log('[Kevin TTS] Audio finished playing.');
              state.currentAudioSource = null;
              if (stopTalking) stopTalking();
              setChatKevinExpression('happy');
              URL.revokeObjectURL(audioUrl);
              // Auto-record if live mode is active
              if (state.liveMode && !state.isRecording && !state.isSending) {
                setTimeout(() => startRecording(), 400);
              }
            };

            source.start(0);
            ttsOk = true;
            console.log('[Kevin TTS] Audio playing via AudioContext.');
          } else {
            const errBody = await ttsRes.text();
            console.warn('[Kevin TTS] TTS failed:', ttsRes.status, errBody);
          }
        } catch (ttsErr) {
          console.error('[Kevin TTS] Error:', ttsErr);
        }

        // Fallback: if TTS failed, just show text
        if (!ttsOk) {
          appendMessage('assistant', res.reply);
          setChatKevinExpression('happy');
          // In live mode without TTS, still reopen mic after a delay
          if (state.liveMode && !state.isRecording && !state.isSending) {
            setTimeout(() => startRecording(), 1000);
          }
        }
      } else if (res.error) {
        appendMessage('assistant', 'Desculpe, ocorreu um erro: ' + res.error);
        setChatKevinExpression('happy');
      }
    } catch (err) {
      hideTyping();
      appendMessage('assistant', 'Erro de conexao. Tente novamente.');
      setChatKevinExpression('happy');
    }

    state.isSending = false;
    $('#btn-send').disabled = false;
    input.focus();
  }

  // ── Microphone Recording with silence detection ──
  async function startRecording() {
    if (state.isRecording || state.isSending) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      state.micStream = stream;
      state.mediaRecorder = new MediaRecorder(stream);
      const chunks = [];
      let hasSpeech = false;

      state.mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
      state.mediaRecorder.onstop = async () => {
        // Clean up silence detection
        cleanupSilenceDetection();
        stream.getTracks().forEach(t => t.stop());
        state.micStream = null;

        // If no speech was detected, skip sending
        if (!hasSpeech) {
          console.log('[Kevin Mic] No speech detected, skipping STT.');
          if (state.liveMode && !state.isSending) {
            // In live mode, try again after a short pause
            setTimeout(() => {
              if (state.liveMode && !state.isRecording && !state.isSending) {
                startRecording();
              }
            }, 500);
          }
          return;
        }

        const blob = new Blob(chunks, { type: 'audio/wav' });
        const formData = new FormData();
        formData.append('audio', blob, 'recording.wav');

        setChatKevinExpression('thinking');
        showTyping();

        try {
          const res = await fetch('/api/stt', { method: 'POST', body: formData });
          const data = await res.json();
          hideTyping();
          if (data.text && data.text.trim().length > 0) {
            const input = $('#chat-input');
            input.value = data.text;
            sendMessage();
          } else {
            setChatKevinExpression('happy');
            if (!state.liveMode) {
              showToast('Nao foi possivel transcrever o audio.', true);
            }
            // In live mode, restart mic if no transcription
            if (state.liveMode && !state.isSending) {
              setTimeout(() => {
                if (state.liveMode && !state.isRecording && !state.isSending) {
                  startRecording();
                }
              }, 500);
            }
          }
        } catch {
          hideTyping();
          setChatKevinExpression('happy');
          showToast('Erro ao processar audio.', true);
        }
      };

      state.mediaRecorder.start();
      state.isRecording = true;
      updateMicButtons();

      // Set up silence detection via AnalyserNode
      ensureAudioContext();
      const source = state.audioContext.createMediaStreamSource(stream);
      const analyser = state.audioContext.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      state.analyserNode = analyser;

      const dataArray = new Uint8Array(analyser.fftSize);
      let silenceStart = null;
      let speechDetected = false;
      let monitorRunning = true;

      // Hard timeout: stop after MAX_RECORD_MS regardless
      const hardTimeout = setTimeout(() => {
        if (state.isRecording) {
          console.log('[Kevin Mic] Hard timeout reached, stopping.');
          hasSpeech = speechDetected;
          stopRecording();
        }
      }, MAX_RECORD_MS);

      function monitorSilence() {
        if (!monitorRunning || !state.isRecording) {
          clearTimeout(hardTimeout);
          return;
        }

        analyser.getByteTimeDomainData(dataArray);
        // Calculate RMS amplitude
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          const val = (dataArray[i] - 128) / 128;
          sum += val * val;
        }
        const rms = Math.sqrt(sum / dataArray.length);

        if (rms > SILENCE_THRESHOLD) {
          // Sound detected
          speechDetected = true;
          silenceStart = null;
        } else {
          // Silence
          if (speechDetected && silenceStart === null) {
            silenceStart = Date.now();
          }
          // If we had speech and now silence for SILENCE_TIMEOUT_MS, stop
          if (speechDetected && silenceStart && (Date.now() - silenceStart) >= SILENCE_TIMEOUT_MS) {
            console.log('[Kevin Mic] Silence timeout after speech, stopping.');
            hasSpeech = true;
            clearTimeout(hardTimeout);
            stopRecording();
            return;
          }
          // If no speech at all for a longer period, stop (ambient noise filter)
          if (!speechDetected && !silenceStart) {
            silenceStart = Date.now();
          }
          if (!speechDetected && silenceStart && (Date.now() - silenceStart) >= (SILENCE_TIMEOUT_MS * 2)) {
            console.log('[Kevin Mic] No speech detected, stopping.');
            hasSpeech = false;
            clearTimeout(hardTimeout);
            stopRecording();
            return;
          }
        }

        requestAnimationFrame(monitorSilence);
      }

      // Store cleanup ref
      state._stopMonitor = () => {
        monitorRunning = false;
        clearTimeout(hardTimeout);
      };

      requestAnimationFrame(monitorSilence);
    } catch {
      showToast('Nao foi possivel acessar o microfone.', true);
    }
  }

  function cleanupSilenceDetection() {
    if (state._stopMonitor) {
      state._stopMonitor();
      state._stopMonitor = null;
    }
    if (state.silenceTimer) {
      clearTimeout(state.silenceTimer);
      state.silenceTimer = null;
    }
    state.analyserNode = null;
  }

  function stopRecording() {
    if (!state.isRecording) return;
    state.isRecording = false;
    updateMicButtons();
    if (state.mediaRecorder && state.mediaRecorder.state !== 'inactive') {
      state.mediaRecorder.stop();
    }
  }

  function toggleRecording() {
    if (state.isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }

  function toggleLiveMode() {
    state.liveMode = !state.liveMode;
    updateMicButtons();
    if (state.liveMode) {
      showToast('Modo conversa ativado');
      // Start recording immediately
      if (!state.isRecording && !state.isSending) {
        startRecording();
      }
    } else {
      showToast('Modo conversa desativado');
      // Stop if recording
      if (state.isRecording) {
        stopRecording();
      }
    }
  }

  function updateMicButtons() {
    const micBtn = $('#btn-mic');
    const liveBtn = $('#btn-mic-live');
    if (micBtn) {
      micBtn.classList.toggle('recording', state.isRecording && !state.liveMode);
    }
    if (liveBtn) {
      liveBtn.classList.toggle('active', state.liveMode);
      liveBtn.classList.toggle('recording', state.isRecording && state.liveMode);
    }
  }

  // ── Help Page ──
  async function renderHelp() {
    const page = getApp();
    page.innerHTML = `
      ${renderTopbar('help-page')}
      <div class="page-content">
        <div class="page-header fade-in"><h2>Ajuda & Status</h2></div>
        <div class="help-card fade-in">
          <h3>Instrucoes Rapidas</h3>
          <ol>
            <li>Acesse o menu <b>Aulas</b>.</li>
            <li>Escolha o <b>Year</b> disponivel.</li>
            <li>Selecione a <b>Semana</b> e a <b>Aula</b> desejada.</li>
            <li>Clique em <b>Iniciar Atividade com Kevin</b>.</li>
            <li>Use o microfone ou texto para interagir com o Kevin.</li>
          </ol>
        </div>
        <div class="help-card fade-in">
          <h3>Status do Sistema</h3>
          <div class="status-grid" id="status-grid">
            <p style="color:var(--texto-sec);">Verificando...</p>
          </div>
        </div>
      </div>
    `;

    bindTopbar('help-page');

    const res = await api('/api/status');
    $('#status-grid').innerHTML = `
      <div class="status-item ${res.openai ? 'ok' : 'err'}">
        <div class="status-dot"></div>
        OpenAI ${res.openai ? 'Conectado' : 'Desconectado'}
      </div>
      <div class="status-item ${res.elevenlabs ? 'ok' : 'err'}">
        <div class="status-dot"></div>
        Voice Engine ${res.elevenlabs ? 'Conectado' : 'Desconectado'}
      </div>
    `;
  }

  // ── Questions Page ──
  function renderQuestions() {
    const page = getApp();
    page.innerHTML = `
      ${renderTopbar('questions-page')}
      <div class="page-content">
        <div class="page-header fade-in"><h2>Perguntas Frequentes</h2></div>
        <div class="help-card fade-in" style="text-align:center;">
          <div style="font-size:3rem;margin-bottom:12px;">\uD83D\uDEA7</div>
          <h3>Modulo em desenvolvimento</h3>
          <p style="color:var(--texto-sec);margin-top:8px;">Em breve voce podera acessar o banco de perguntas e respostas.</p>
        </div>
      </div>
    `;

    bindTopbar('questions-page');
  }

  // ── Admin Add Lesson ──
  function renderAdminAdd() {
    const page = getApp();
    page.innerHTML = `
      ${renderTopbar('admin-add-page')}
      <div class="page-content">
        <div class="page-header fade-in"><h2>Adicionar Nova Aula</h2></div>
        <div class="admin-form fade-in">
          <h3>Codigo da Aula</h3>
          <div class="form-row">
            <div class="form-group">
              <label>Unit (U)</label>
              <input type="number" id="adm-unit" value="1" min="1" max="10">
            </div>
            <div class="form-group">
              <label>Week (W)</label>
              <input type="number" id="adm-week" value="1" min="1" max="52">
            </div>
            <div class="form-group">
              <label>Class (C)</label>
              <input type="number" id="adm-class" value="1" min="1" max="10">
            </div>
          </div>
          <p style="margin-top:8px;font-weight:700;color:var(--azul);" id="adm-code-label">Codigo: U1W1C1</p>
        </div>

        <div class="admin-form fade-in">
          <h3>Conteudo da Aula</h3>
          <div class="form-group">
            <label>Objetivos</label>
            <textarea id="adm-objetivos" placeholder='Ex: Fazer perguntas com "What\'s" e usar "a/an".'></textarea>
          </div>
          <div class="form-group">
            <label>Vocabulario</label>
            <textarea id="adm-vocabulario" placeholder="Ex: Clock, window, board, desk, picture, chair..."></textarea>
          </div>
          <div class="form-group">
            <label>Gramatica</label>
            <textarea id="adm-gramatica" placeholder='Ex: "What\'s this? It\'s a/an..."'></textarea>
          </div>
        </div>

        <div class="admin-form fade-in">
          <div class="phase-section phase-warmup">
            <h4>\u2600\uFE0F FASE 1: WARM UP</h4>
            <div id="warmup-actions"><div class="action-row"><textarea placeholder="Descreva a acao 1 do Warm Up..."></textarea></div></div>
            <button class="btn-add-action" data-phase="warmup">+ Adicionar Acao</button>
          </div>
          <div class="phase-section phase-dev" style="margin-top:16px;">
            <h4>\uD83D\uDCD6 FASE 2: DEVELOPMENT</h4>
            <div id="dev-actions"><div class="action-row"><textarea placeholder="Descreva a acao 1 do Development..."></textarea></div></div>
            <button class="btn-add-action" data-phase="dev">+ Adicionar Acao</button>
          </div>
          <div class="phase-section phase-closure" style="margin-top:16px;">
            <h4>\u2705 FASE 3: CLOSURE</h4>
            <div id="closure-actions"><div class="action-row"><textarea placeholder="Descreva a acao 1 do Closure..."></textarea></div></div>
            <button class="btn-add-action" data-phase="closure">+ Adicionar Acao</button>
          </div>
        </div>

        <button class="btn btn-primary btn-full" id="btn-save-lesson" style="margin-top:16px;padding:16px;">Salvar Aula</button>
      </div>
    `;

    bindTopbar('admin-add-page');

    // Update code label
    function updateCode() {
      const u = $('#adm-unit').value;
      const w = $('#adm-week').value;
      const c = $('#adm-class').value;
      $('#adm-code-label').textContent = `Codigo: U${u}W${w}C${c}`;
    }
    ['adm-unit', 'adm-week', 'adm-class'].forEach(id => {
      $(`#${id}`).addEventListener('input', updateCode);
    });

    // Add action buttons
    $$('.btn-add-action').forEach(btn => {
      btn.addEventListener('click', () => {
        const phase = btn.dataset.phase;
        const container = $(`#${phase}-actions`) || $(`#${phase === 'dev' ? 'dev' : phase}-actions`);
        const count = container.querySelectorAll('.action-row').length + 1;
        const row = document.createElement('div');
        row.className = 'action-row';
        row.innerHTML = `
          <textarea placeholder="Descreva a acao ${count}..."></textarea>
          <button class="btn-remove-action" title="Remover">\u2716</button>
        `;
        row.querySelector('.btn-remove-action').addEventListener('click', () => row.remove());
        container.appendChild(row);
      });
    });

    // Save
    $('#btn-save-lesson').addEventListener('click', async () => {
      const unit = parseInt($('#adm-unit').value);
      const week = parseInt($('#adm-week').value);
      const classNum = parseInt($('#adm-class').value);
      const objetivos = $('#adm-objetivos').value.trim();
      const vocabulario = $('#adm-vocabulario').value.trim();
      const gramatica = $('#adm-gramatica').value.trim();

      const warmup = Array.from($$('#warmup-actions textarea')).map(t => t.value.trim()).filter(Boolean);
      const development = Array.from($$('#dev-actions textarea')).map(t => t.value.trim()).filter(Boolean);
      const closure = Array.from($$('#closure-actions textarea')).map(t => t.value.trim()).filter(Boolean);

      // Validation
      const errors = [];
      if (!objetivos) errors.push('Preencha os Objetivos.');
      if (!vocabulario) errors.push('Preencha o Vocabulario.');
      if (!gramatica) errors.push('Preencha a Gramatica.');
      if (warmup.length < 1) errors.push('Adicione pelo menos 1 acao no Warm Up.');
      if (development.length < 1) errors.push('Adicione pelo menos 1 acao no Development.');
      if (closure.length < 1) errors.push('Adicione pelo menos 1 acao no Closure.');

      if (errors.length > 0) {
        showToast(errors[0], true);
        return;
      }

      const res = await api('/api/admin/lessons', {
        method: 'POST',
        body: { unit, week, class_num: classNum, objetivos, vocabulario, gramatica, warmup, development, closure },
      });

      if (res.success) {
        showToast(`Aula ${res.code} salva com sucesso!`);
        // Clear form
        $('#adm-objetivos').value = '';
        $('#adm-vocabulario').value = '';
        $('#adm-gramatica').value = '';
        ['warmup', 'dev', 'closure'].forEach(phase => {
          const container = $(`#${phase}-actions`);
          container.innerHTML = `<div class="action-row"><textarea placeholder="Descreva a acao 1..."></textarea></div>`;
        });
      } else {
        showToast('Erro ao salvar aula.', true);
      }
    });
  }

  // ── Admin List Lessons ──
  async function renderAdminList() {
    const page = getApp();
    page.innerHTML = `
      ${renderTopbar('admin-list-page')}
      <div class="page-content">
        <div class="page-header fade-in"><h2>Aulas Criadas</h2></div>
        <div id="lesson-list" class="fade-in">
          <p style="color:var(--texto-sec);">Carregando...</p>
        </div>
      </div>
    `;

    bindTopbar('admin-list-page');

    const lessons = await api('/api/admin/lessons');
    const keys = Object.keys(lessons).sort();

    if (keys.length === 0) {
      $('#lesson-list').innerHTML = `
        <div class="help-card" style="text-align:center;">
          <p style="color:var(--texto-sec);">Nenhuma aula customizada foi criada ainda.</p>
        </div>
      `;
      return;
    }

    let html = '';
    keys.forEach(code => {
      const d = lessons[code];
      html += `
        <div class="lesson-list-item" data-code="${code}">
          <div class="lesson-list-header">
            <h4>${code} \u2014 Unit ${d.unit}, Week ${d.week}, Class ${d.class}</h4>
            <span class="toggle-icon">\u25BC</span>
          </div>
          <div class="lesson-list-body">
            <div class="lesson-detail-label">Objetivos</div>
            <div class="lesson-detail-value">${escapeHtml(d.objetivos)}</div>
            <div class="lesson-detail-label">Vocabulario</div>
            <div class="lesson-detail-value">${escapeHtml(d.vocabulario)}</div>
            <div class="lesson-detail-label">Gramatica</div>
            <div class="lesson-detail-value">${escapeHtml(d.gramatica)}</div>
            <div class="lesson-detail-label">Warm Up</div>
            <div class="lesson-detail-value">${(d.warmup || []).map((a, i) => `${i + 1}. ${escapeHtml(a)}`).join('<br>')}</div>
            <div class="lesson-detail-label">Development</div>
            <div class="lesson-detail-value">${(d.development || []).map((a, i) => `${i + 1}. ${escapeHtml(a)}`).join('<br>')}</div>
            <div class="lesson-detail-label">Closure</div>
            <div class="lesson-detail-value">${(d.closure || []).map((a, i) => `${i + 1}. ${escapeHtml(a)}`).join('<br>')}</div>
            <div class="lesson-detail-label">Prompt Gerado</div>
            <div class="lesson-prompt-box">${escapeHtml(d.prompt)}</div>
            <button class="btn btn-danger" style="margin-top:16px;" data-delete="${code}">Excluir Aula</button>
          </div>
        </div>
      `;
    });

    $('#lesson-list').innerHTML = html;

    // Toggle expand
    $$('.lesson-list-header').forEach(header => {
      header.addEventListener('click', () => {
        header.parentElement.classList.toggle('open');
      });
    });

    // Delete
    $$('[data-delete]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const code = btn.dataset.delete;
        if (confirm(`Excluir aula ${code}?`)) {
          await api(`/api/admin/lessons/${code}`, { method: 'DELETE' });
          showToast(`Aula ${code} excluida.`);
          renderAdminList();
        }
      });
    });
  }

  // ── Admin Audit Logs ──
  async function renderAdminLogs() {
    const page = getApp();
    page.innerHTML = `
      ${renderTopbar('admin-logs-page')}
      <div class="page-content">
        <div class="page-header fade-in"><h2>Logs de Aula</h2></div>
        <div id="logs-list" class="fade-in">
          <p style="color:var(--texto-sec);">Carregando...</p>
        </div>
      </div>
    `;

    bindTopbar('admin-logs-page');

    const logs = await api('/api/audit/logs');

    if (!logs || logs.length === 0) {
      $('#logs-list').innerHTML = `
        <div class="help-card" style="text-align:center;">
          <p style="color:var(--texto-sec);">Nenhum log de aula registrado ainda.</p>
        </div>
      `;
      return;
    }

    let html = '';
    logs.forEach(log => {
      const date = new Date(log.timestamp);
      const dateStr = date.toLocaleDateString('pt-BR') + ' ' + date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      const lesson = log.lesson || {};
      const user = log.user || {};
      html += `
        <div class="lesson-list-item" data-log-id="${log.id}">
          <div class="lesson-list-header">
            <h4>Year ${lesson.year || '?'} - Week ${lesson.week || '?'} - Class ${lesson.class_num || '?'}</h4>
            <div style="display:flex;align-items:center;gap:12px;">
              <span style="color:var(--texto-sec);font-size:0.85rem;">${dateStr} &bull; ${escapeHtml(user.name || 'Desconhecido')} &bull; ${log.message_count} msgs</span>
              <span class="toggle-icon">\u25BC</span>
            </div>
          </div>
          <div class="lesson-list-body">
            <div class="audit-log-transcript" id="transcript-${log.id}">
              <p style="color:var(--texto-sec);">Clique para carregar...</p>
            </div>
            <button class="btn btn-danger" style="margin-top:12px;" data-delete-log="${log.id}">Excluir Log</button>
          </div>
        </div>
      `;
    });

    $('#logs-list').innerHTML = html;

    // Toggle expand and lazy-load transcript
    $$('.lesson-list-item[data-log-id]').forEach(item => {
      const header = item.querySelector('.lesson-list-header');
      let loaded = false;
      header.addEventListener('click', async () => {
        item.classList.toggle('open');
        if (!loaded && item.classList.contains('open')) {
          loaded = true;
          const logId = item.dataset.logId;
          const transcriptEl = $(`#transcript-${logId}`);
          try {
            const detail = await api(`/api/audit/logs/${logId}`);
            if (detail.messages && detail.messages.length > 0) {
              let transcriptHtml = '';
              detail.messages.forEach(msg => {
                const label = msg.role === 'user' ? 'Professor' : 'Kevin';
                const cls = msg.role === 'user' ? 'audit-msg-user' : 'audit-msg-kevin';
                transcriptHtml += `<div class="${cls}"><strong>${label}:</strong> ${escapeHtml(msg.content)}</div>`;
              });
              transcriptEl.innerHTML = transcriptHtml;
            } else {
              transcriptEl.innerHTML = '<p style="color:var(--texto-sec);">Nenhuma mensagem nesta sessao.</p>';
            }
          } catch {
            transcriptEl.innerHTML = '<p style="color:var(--vermelho);">Erro ao carregar log.</p>';
          }
        }
      });
    });

    // Delete log
    $$('[data-delete-log]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const logId = btn.dataset.deleteLog;
        if (confirm('Excluir este log?')) {
          await api(`/api/audit/logs/${logId}`, { method: 'DELETE' });
          showToast('Log excluido.');
          renderAdminLogs();
        }
      });
    });
  }

  // ── Init ──
  function init() {
    navigate('login');
  }

  // Wait for kevin-widget.js to load, then init
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
