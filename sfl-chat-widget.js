/**
 * Stayforlong Chat Widget
 * GTM-injectable, zero-dependency, Shadow DOM isolated.
 *
 * Usage (GTM Custom HTML tag):
 *   <script>
 *     window.StayforlongChat = {
 *       wsUrl: 'wss://your-backend.com/ws',
 *       accentColor: '#f60e5f',
 *       lang: 'es',        // optional — omit to auto-detect from navigator.language
 *       contextVars: {     // optional — GTM dataLayer / window variables to forward as WS params
 *         user_id:    '{{User ID}}',          // GTM variable or literal value
 *         booking_id: '{{Booking ID}}',
 *         // any key here becomes a query param on the WebSocket URL
 *       },
 *     };
 *   </script>
 *   <script src="https://your-cdn.com/sfl-chat-widget.js"></script>
 */
(function (cfg) {
  'use strict';

  var config = Object.assign({
    wsUrl: (function() {
      var h = (typeof location !== 'undefined') ? location.hostname : '';
      var isLocal = !h || h === 'localhost' || h === '127.0.0.1';
      return isLocal ? 'ws://localhost:8000/ws' : 'wss://sfl-multi-agents-ws.up.railway.app/ws';
    })(),
    accentColor: '#f60e5f',
    secondaryColor: '#c40a4c',
    lang: null,         // null = auto-detect from navigator.language; set 'es'/'en' to force
    position: 'bottom-right',
    welcomeMessage: null,
    contextVars: {},    // key→value map of extra WS query params (GTM variables resolved before widget loads)
    enableVoice: true,  // show mic button inside the chat window
    voiceWsUrl: null,   // null = auto-derive from wsUrl (/ws → /ws/voice)
  }, cfg || {});

  function _voiceWsUrl() {
    if (config.voiceWsUrl) return config.voiceWsUrl;
    return config.wsUrl.replace(/\/ws(\?.*)?$/, '/ws/voice');
  }

  // ─── STYLES ────────────────────────────────────────────────────────────────

  var CSS = '\n\
  :host { all: initial; }\n\
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }\n\
\n\
  /* ── Floating button ── */\n\
  #sfl-btn {\n\
    position: fixed;\n\
    bottom: 24px;\n\
    right: 24px;\n\
    width: 60px;\n\
    height: 60px;\n\
    border-radius: 50%;\n\
    background: ' + config.accentColor + ';\n\
    box-shadow: 0 4px 16px rgba(0,0,0,0.25);\n\
    cursor: pointer;\n\
    border: none;\n\
    display: flex;\n\
    align-items: center;\n\
    justify-content: center;\n\
    z-index: 2147483647;\n\
    transition: transform 0.2s ease, box-shadow 0.2s ease;\n\
  }\n\
  #sfl-btn:hover { transform: scale(1.08); box-shadow: 0 6px 20px rgba(0,0,0,0.3); }\n\
  #sfl-btn svg { width: 28px; height: 28px; fill: #fff; }\n\
  #sfl-badge {\n\
    position: absolute;\n\
    top: -2px; right: -2px;\n\
    width: 14px; height: 14px;\n\
    background: #E63946;\n\
    border-radius: 50%;\n\
    border: 2px solid #fff;\n\
    display: none;\n\
  }\n\
\n\
  /* ── Chat window ── */\n\
  #sfl-window {\n\
    position: fixed;\n\
    bottom: 96px;\n\
    right: 24px;\n\
    width: 380px;\n\
    max-width: calc(100vw - 32px);\n\
    height: 560px;\n\
    max-height: calc(100vh - 120px);\n\
    background: #fff;\n\
    border-radius: 16px;\n\
    box-shadow: 0 8px 40px rgba(0,0,0,0.18);\n\
    display: none;\n\
    flex-direction: column;\n\
    overflow: hidden;\n\
    z-index: 2147483646;\n\
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;\n\
    font-size: 14px;\n\
    color: #1a1a2e;\n\
  }\n\
  #sfl-window.open { display: flex; }\n\
\n\
  /* ── Header ── */\n\
  #sfl-header {\n\
    background: linear-gradient(135deg, ' + config.secondaryColor + ', ' + config.accentColor + ');\n\
    color: #fff;\n\
    padding: 16px 18px;\n\
    display: flex;\n\
    align-items: center;\n\
    gap: 12px;\n\
    flex-shrink: 0;\n\
  }\n\
  #sfl-avatar {\n\
    width: 40px; height: 40px;\n\
    background: rgba(255,255,255,0.25);\n\
    border-radius: 50%;\n\
    display: flex; align-items: center; justify-content: center;\n\
    flex-shrink: 0;\n\
  }\n\
  #sfl-avatar svg { width: 22px; height: 22px; fill: #fff; }\n\
  #sfl-header-info { flex: 1; min-width: 0; }\n\
  #sfl-header-title { font-weight: 700; font-size: 15px; }\n\
  #sfl-agent-name {\n\
    font-size: 12px;\n\
    opacity: 0.85;\n\
    margin-top: 1px;\n\
    white-space: nowrap;\n\
    overflow: hidden;\n\
    text-overflow: ellipsis;\n\
  }\n\
  #sfl-close {\n\
    background: none;\n\
    border: none;\n\
    color: rgba(255,255,255,0.8);\n\
    cursor: pointer;\n\
    padding: 4px;\n\
    border-radius: 6px;\n\
    font-size: 20px;\n\
    line-height: 1;\n\
    transition: color 0.15s;\n\
  }\n\
  #sfl-close:hover { color: #fff; }\n\
\n\
  /* ── Messages area ── */\n\
  #sfl-messages {\n\
    flex: 1;\n\
    overflow-y: auto;\n\
    padding: 16px;\n\
    display: flex;\n\
    flex-direction: column;\n\
    gap: 10px;\n\
    scroll-behavior: smooth;\n\
  }\n\
  #sfl-messages::-webkit-scrollbar { width: 4px; }\n\
  #sfl-messages::-webkit-scrollbar-thumb { background: #ccc; border-radius: 4px; }\n\
\n\
  .sfl-msg {\n\
    display: flex;\n\
    flex-direction: column;\n\
    max-width: 85%;\n\
    animation: sfl-fade-in 0.2s ease;\n\
  }\n\
  @keyframes sfl-fade-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }\n\
\n\
  .sfl-msg.agent { align-self: flex-start; }\n\
  .sfl-msg.user  { align-self: flex-end; }\n\
\n\
  .sfl-agent-label {\n\
    font-size: 11px;\n\
    color: ' + config.accentColor + ';\n\
    font-weight: 600;\n\
    margin-bottom: 3px;\n\
    padding-left: 2px;\n\
  }\n\
  .sfl-bubble {\n\
    padding: 10px 14px;\n\
    border-radius: 16px;\n\
    line-height: 1.5;\n\
    word-break: break-word;\n\
    white-space: pre-wrap;\n\
  }\n\
  .sfl-msg.agent .sfl-bubble {\n\
    background: #f0f4f8;\n\
    color: #1a1a2e;\n\
    border-bottom-left-radius: 4px;\n\
  }\n\
  .sfl-msg.user .sfl-bubble {\n\
    background: ' + config.accentColor + ';\n\
    color: #fff;\n\
    border-bottom-right-radius: 4px;\n\
  }\n\
\n\
  /* ── Typing indicator ── */\n\
  #sfl-typing {\n\
    align-self: flex-start;\n\
    background: #f0f4f8;\n\
    padding: 10px 16px;\n\
    border-radius: 16px;\n\
    border-bottom-left-radius: 4px;\n\
    display: none;\n\
    gap: 5px;\n\
    align-items: center;\n\
  }\n\
  #sfl-typing.visible { display: flex; }\n\
  #sfl-typing span {\n\
    width: 7px; height: 7px;\n\
    background: #999;\n\
    border-radius: 50%;\n\
    animation: sfl-bounce 1.2s infinite;\n\
  }\n\
  #sfl-typing span:nth-child(2) { animation-delay: 0.2s; }\n\
  #sfl-typing span:nth-child(3) { animation-delay: 0.4s; }\n\
  @keyframes sfl-bounce {\n\
    0%, 80%, 100% { transform: translateY(0); }\n\
    40% { transform: translateY(-6px); }\n\
  }\n\
\n\
  /* ── Input area ── */\n\
  #sfl-input-row {\n\
    display: flex;\n\
    align-items: flex-end;\n\
    gap: 8px;\n\
    padding: 12px 14px;\n\
    border-top: 1px solid #e8ecf0;\n\
    background: #fff;\n\
    flex-shrink: 0;\n\
  }\n\
  #sfl-input {\n\
    flex: 1;\n\
    border: 1px solid #d0d7df;\n\
    border-radius: 22px;\n\
    padding: 10px 16px;\n\
    font-size: 14px;\n\
    font-family: inherit;\n\
    resize: none;\n\
    outline: none;\n\
    line-height: 1.4;\n\
    max-height: 120px;\n\
    overflow-y: auto;\n\
    transition: border-color 0.2s;\n\
  }\n\
  #sfl-input:focus { border-color: ' + config.accentColor + '; }\n\
  #sfl-input::placeholder { color: #9aa3ad; }\n\
  #sfl-send {\n\
    width: 40px; height: 40px;\n\
    border-radius: 50%;\n\
    background: ' + config.accentColor + ';\n\
    border: none;\n\
    cursor: pointer;\n\
    display: flex;\n\
    align-items: center;\n\
    justify-content: center;\n\
    flex-shrink: 0;\n\
    transition: background 0.2s, transform 0.15s;\n\
  }\n\
  #sfl-send:hover { background: ' + config.secondaryColor + '; transform: scale(1.05); }\n\
  #sfl-send svg { width: 18px; height: 18px; fill: #fff; }\n\
  #sfl-send:disabled { opacity: 0.5; cursor: not-allowed; }\n\
\n\
  /* ── Status bar ── */\n\
  #sfl-status {\n\
    font-size: 11px;\n\
    color: #E63946;\n\
    text-align: center;\n\
    padding: 4px;\n\
    display: none;\n\
  }\n\
  #sfl-status.visible { display: block; }\n\
\n\
  /* ── Mic button ── */\n\
  #sfl-mic {\n\
    width: 40px; height: 40px;\n\
    border-radius: 50%;\n\
    background: #e8e8ed;\n\
    border: 2px solid transparent;\n\
    cursor: pointer;\n\
    display: flex;\n\
    align-items: center;\n\
    justify-content: center;\n\
    flex-shrink: 0;\n\
    transition: background 0.2s, border-color 0.2s, transform 0.15s;\n\
    user-select: none;\n\
    -webkit-user-select: none;\n\
    touch-action: none;\n\
  }\n\
  #sfl-mic:hover { background: #d2d2d7; }\n\
  #sfl-mic svg { width: 18px; height: 18px; fill: #6e6e73; }\n\
  #sfl-mic.recording {\n\
    background: #fee2e2;\n\
    border-color: ' + config.accentColor + ';\n\
    animation: sfl-mic-pulse 0.9s infinite;\n\
  }\n\
  #sfl-mic.recording svg { fill: ' + config.accentColor + '; }\n\
  @keyframes sfl-mic-pulse {\n\
    0%, 100% { box-shadow: 0 0 0 0 rgba(246,14,95,0.4); }\n\
    50%       { box-shadow: 0 0 0 8px rgba(246,14,95,0); }\n\
  }\n\
\n\
  /* ── Voice feedback strip ── */\n\
  #sfl-voice-feedback {\n\
    display: none;\n\
    flex-direction: column;\n\
    gap: 4px;\n\
    padding: 7px 14px;\n\
    border-top: 1px solid #f0e6ec;\n\
    background: #fdf5f8;\n\
    flex-shrink: 0;\n\
  }\n\
  #sfl-voice-feedback.active { display: flex; }\n\
\n\
  /* interim transcript bubble */\n\
  #sfl-interim-bubble {\n\
    display: none;\n\
    flex-direction: column;\n\
    align-items: flex-end;\n\
    animation: sfl-fade-in 0.15s ease;\n\
  }\n\
  #sfl-interim-bubble.active { display: flex; }\n\
  #sfl-interim-bubble .sfl-agent-label { font-size: 10px; color: ' + config.accentColor + '; font-weight: 700; margin-bottom: 2px; text-transform: uppercase; }\n\
  #sfl-interim-bubble .sfl-bubble {\n\
    background: #fce7f3;\n\
    color: #9d174d;\n\
    border-bottom-right-radius: 4px;\n\
    font-style: italic;\n\
    opacity: 0.9;\n\
    max-width: 100%;\n\
  }\n\
\n\
  /* audio playing indicator */\n\
  #sfl-audio-indicator {\n\
    display: none;\n\
    align-items: center;\n\
    gap: 6px;\n\
    font-size: 11px;\n\
    color: #2e7d32;\n\
    font-weight: 600;\n\
  }\n\
  #sfl-audio-indicator.active { display: flex; }\n\
  #sfl-audio-indicator .sfl-bars { display: flex; gap: 3px; align-items: center; height: 12px; }\n\
  #sfl-audio-indicator .sfl-bars span {\n\
    width: 3px; background: #4caf50; border-radius: 2px;\n\
    animation: sfl-audiobar 0.7s ease-in-out infinite alternate;\n\
  }\n\
  #sfl-audio-indicator .sfl-bars span:nth-child(2) { animation-delay: 0.15s; }\n\
  #sfl-audio-indicator .sfl-bars span:nth-child(3) { animation-delay: 0.3s; }\n\
  #sfl-audio-indicator .sfl-bars span:nth-child(4) { animation-delay: 0.15s; }\n\
  @keyframes sfl-audiobar { from { height: 3px; } to { height: 12px; } }\n\
\n\
  /* ── History separator ── */\n\
  .sfl-separator {\n\
    display: flex;\n\
    align-items: center;\n\
    gap: 8px;\n\
    margin: 4px 0;\n\
    color: #9aa3ad;\n\
    font-size: 11px;\n\
  }\n\
  .sfl-separator::before, .sfl-separator::after {\n\
    content: "";\n\
    flex: 1;\n\
    border-top: 1px solid #e0e6ec;\n\
  }\n\
  ';

  // ─── HTML TEMPLATE ─────────────────────────────────────────────────────────

  var CHAT_ICON = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z"/></svg>';
  var CLOSE_ICON = '&#x2715;';
  var SEND_ICON = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>';
  var MIC_ICON = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 1a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4zm-1 17.93A8 8 0 0 1 4.07 12H6a6 6 0 0 0 12 0h1.93A8 8 0 0 1 13 18.93V21h2v2H9v-2h2v-2.07z"/></svg>';

  var _voiceFeedbackHtml = config.enableVoice ? '\
      <div id="sfl-voice-feedback">\
        <div id="sfl-interim-bubble"><div class="sfl-agent-label">🎤 You</div><div class="sfl-bubble" id="sfl-interim-text"></div></div>\
        <div id="sfl-audio-indicator"><div class="sfl-bars"><span></span><span></span><span></span><span></span></div>&nbsp;🔊 Speaking…</div>\
      </div>' : '';

  var _micBtnHtml = config.enableVoice ? '\
        <button id="sfl-mic" aria-label="Hold to speak" title="Hold to speak">' + MIC_ICON + '</button>' : '';

  var TEMPLATE = '\
    <style>' + CSS + '</style>\
    <button id="sfl-btn" aria-label="Open support chat">\
      ' + CHAT_ICON + '\
      <div id="sfl-badge"></div>\
    </button>\
    <div id="sfl-window" role="dialog" aria-label="Stayforlong Chat">\
      <div id="sfl-header">\
        <div id="sfl-avatar">' + CHAT_ICON + '</div>\
        <div id="sfl-header-info">\
          <div id="sfl-header-title">Stayforlong</div>\
          <div id="sfl-agent-name">Connecting...</div>\
        </div>\
        <button id="sfl-close" aria-label="Close chat">' + CLOSE_ICON + '</button>\
      </div>\
      <div id="sfl-messages" aria-live="polite">\
        <div id="sfl-typing" aria-hidden="true">\
          <span></span><span></span><span></span>\
        </div>\
      </div>\
      ' + _voiceFeedbackHtml + '\
      <div id="sfl-status"></div>\
      <div id="sfl-input-row">\
        <textarea id="sfl-input" rows="1" placeholder="Write your message..." aria-label="Message"></textarea>\
        ' + _micBtnHtml + '\
        <button id="sfl-send" aria-label="Send">' + SEND_ICON + '</button>\
      </div>\
    </div>\
  ';

  // ─── STATE ─────────────────────────────────────────────────────────────────

  var state = {
    socket: null,
    sessionId: null,
    userId: null,
    isOpen: false,
    isConnected: false,
    reconnectAttempts: 0,
    MAX_RECONNECT: 3,
    RECONNECT_DELAY: 2500,
    shadow: null,
    _pingInterval: null,
    // ── voice state ──
    voiceSocket: null,
    voiceConnected: false,
    mediaRecorder: null,
    audioChunks: [],
    isRecording: false,
    audioCtx: null,
    audioQueue: [],
    audioNextSeq: 0,
    audioPlaying: false,
    liveRecog: null,
    _streamingBubble: null,
  };

  // ─── USER IDENTITY ──────────────────────────────────────────────────────────

  function getUserId() {
    var STORAGE_KEY = 'sfl_chat_user_id';
    function _newId() {
      return 'sfl_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9);
    }
    // 1. Try localStorage (persists across tabs and sessions)
    try {
      var stored = localStorage.getItem(STORAGE_KEY);
      if (stored) return stored;
      var id = _newId();
      localStorage.setItem(STORAGE_KEY, id);
      return id;
    } catch (e) { /* blocked: private browsing or cross-origin */ }
    // 2. Try sessionStorage (persists across reloads within the same tab)
    try {
      var stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) return stored;
      var id = _newId();
      sessionStorage.setItem(STORAGE_KEY, id);
      return id;
    } catch (e) { /* also blocked */ }
    // 3. Last resort: random per page load (won't persist)
    return 'anon_' + Math.random().toString(36).substr(2, 12);
  }

  // ─── DOM HELPERS ────────────────────────────────────────────────────────────

  function $(id) { return state.shadow.getElementById(id); }

  function appendSeparator(label) {
    var messages = $('sfl-messages');
    var typing = $('sfl-typing');
    var sep = document.createElement('div');
    sep.className = 'sfl-separator';
    sep.textContent = label;
    messages.insertBefore(sep, typing);
  }

  function appendMessage(role, content, agentName) {
    var messages = $('sfl-messages');
    var typing = $('sfl-typing');

    var wrapper = document.createElement('div');
    wrapper.className = 'sfl-msg ' + role;

    if (role === 'agent' && agentName && agentName !== 'Stayforlong Assistant') {
      var label = document.createElement('div');
      label.className = 'sfl-agent-label';
      label.textContent = agentName;
      wrapper.appendChild(label);
    }

    var bubble = document.createElement('div');
    bubble.className = 'sfl-bubble';
    bubble.textContent = content; // textContent prevents XSS
    wrapper.appendChild(bubble);

    messages.insertBefore(wrapper, typing);
    messages.scrollTop = messages.scrollHeight;
  }

  function showTyping(agentName) {
    var typing = $('sfl-typing');
    typing.classList.add('visible');
    if (agentName) $('sfl-agent-name').textContent = agentName + '...';
    // Move typing to end of messages so it stays at the bottom
    $('sfl-messages').appendChild(typing);
    $('sfl-messages').scrollTop = $('sfl-messages').scrollHeight;
  }

  function hideTyping() {
    $('sfl-typing').classList.remove('visible');
  }

  function setAgentLabel(name) {
    $('sfl-agent-name').textContent = name || 'Assistant';
  }

  function setStatus(msg) {
    var el = $('sfl-status');
    if (msg) { el.textContent = msg; el.classList.add('visible'); }
    else { el.textContent = ''; el.classList.remove('visible'); }
  }

  function setSendEnabled(enabled) {
    $('sfl-send').disabled = !enabled;
  }

  // ─── VOICE HELPERS ────────────────────────────────────────────────────────────

  function _getAudioCtx() {
    if (!state.audioCtx) {
      state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    return state.audioCtx;
  }

  function _resetAudioQueue() {
    state.audioQueue = [];
    state.audioNextSeq = 0;
    state.audioPlaying = false;
    var ind = $('sfl-audio-indicator');
    if (ind) ind.classList.remove('active');
    _hideVoiceFeedback();
  }

  function _b64ToArrayBuffer(b64) {
    var binary = atob(b64);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer;
  }

  function _showVoiceFeedback() {
    var el = $('sfl-voice-feedback');
    if (el) el.classList.add('active');
  }

  function _hideVoiceFeedback() {
    var interimActive = $('sfl-interim-bubble') && $('sfl-interim-bubble').classList.contains('active');
    var audioActive = state.audioPlaying;
    if (!interimActive && !audioActive) {
      var el = $('sfl-voice-feedback');
      if (el) el.classList.remove('active');
    }
  }

  function _showInterim(text) {
    var bubble = $('sfl-interim-bubble');
    var textEl = $('sfl-interim-text');
    if (!bubble || !textEl) return;
    textEl.textContent = text;
    bubble.classList.add('active');
    _showVoiceFeedback();
  }

  function _hideInterim() {
    var bubble = $('sfl-interim-bubble');
    var textEl = $('sfl-interim-text');
    if (bubble) bubble.classList.remove('active');
    if (textEl) textEl.textContent = '';
  }

  function _playNextAudio() {
    if (!state.audioQueue.length) {
      state.audioPlaying = false;
      var ind = $('sfl-audio-indicator');
      if (ind) ind.classList.remove('active');
      _hideVoiceFeedback();
      return;
    }
    var item = state.audioQueue[0];
    if (item.seq !== state.audioNextSeq) {
      state.audioPlaying = false;
      return;
    }
    state.audioQueue.shift();
    state.audioNextSeq++;
    state.audioPlaying = true;
    var ind = $('sfl-audio-indicator');
    if (ind) ind.classList.add('active');
    _showVoiceFeedback();

    var ctx = _getAudioCtx();
    var src = ctx.createBufferSource();
    src.buffer = item.buffer;
    src.connect(ctx.destination);
    src.onended = _playNextAudio;
    src.start(0);
  }

  function _enqueueAudioChunk(b64, seq) {
    var bytes = _b64ToArrayBuffer(b64);
    _getAudioCtx().decodeAudioData(bytes, function (buffer) {
      state.audioQueue.push({ seq: seq, buffer: buffer });
      state.audioQueue.sort(function (a, b) { return a.seq - b.seq; });
      if (!state.audioPlaying) _playNextAudio();
    }, function (err) {
      console.warn('[SFL Voice] Audio decode error:', err);
    });
  }

  function _startLiveTranscript(lang) {
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    var recog = new SR();
    recog.lang = lang;
    recog.interimResults = true;
    recog.continuous = true;
    recog.onresult = function (e) {
      var interim = '';
      for (var i = e.resultIndex; i < e.results.length; i++) {
        if (!e.results[i].isFinal) interim += e.results[i][0].transcript;
      }
      if (interim) _showInterim(interim);
    };
    recog.onerror = function () {};
    try { recog.start(); } catch (e) {}
    state.liveRecog = recog;
  }

  function _stopLiveTranscript() {
    if (state.liveRecog) {
      try { state.liveRecog.stop(); } catch (e) {}
      state.liveRecog = null;
    }
    _hideInterim();
  }

  // ─── VOICE WEBSOCKET ──────────────────────────────────────────────────────────

  function connectVoice() {
    if (state.voiceSocket && state.voiceSocket.readyState < 2) return;
    var lang = (config.lang || navigator.language || 'en').split('-')[0].toLowerCase();
    var url = _voiceWsUrl() + '?lang=' + lang + '&user_id=' + encodeURIComponent(state.userId || getUserId());
    var ws = new WebSocket(url);
    state.voiceSocket = ws;

    ws.onopen = function () {
      state.voiceConnected = true;
    };
    ws.onclose = function () {
      state.voiceConnected = false;
      state.voiceSocket = null;
    };
    ws.onerror = function () {
      state.voiceConnected = false;
    };
    ws.onmessage = function (evt) {
      var data;
      try { data = JSON.parse(evt.data); } catch (e) { return; }
      handleVoiceMessage(data);
    };
  }

  function handleVoiceMessage(data) {
    switch (data.type) {
      case 'ping': break;
      case 'session_init': break;

      case 'transcript':
        hideTyping();
        _hideInterim();
        if (data.text) {
          appendMessage('user', '🎤 ' + data.text, null);
          setAgentLabel('Thinking…');
        } else if (data.error) {
          setStatus(data.error);
        }
        break;

      case 'typing':
        showTyping(data.agent);
        break;

      case 'audio_chunk':
        hideTyping();
        if (state.audioCtx && state.audioCtx.state === 'suspended') state.audioCtx.resume();
        _enqueueAudioChunk(data.audio_b64, data.seq);
        break;

      case 'message':
        hideTyping();
        setSendEnabled(true);
        appendMessage('agent', data.content, data.agent);
        setAgentLabel(data.agent || 'Assistant');
        if (!state.isOpen) {
          $('sfl-badge').style.display = 'block';
        }
        break;

      case 'audio_done':
        break;

      case 'error':
        hideTyping();
        setSendEnabled(true);
        appendMessage('agent', data.content || 'An error occurred.', null);
        break;
    }
  }

  // ─── PUSH-TO-TALK ────────────────────────────────────────────────────────────

  function startRecording(evt) {
    if (evt) evt.preventDefault();
    if (state.isRecording) return;

    if (state.audioCtx && state.audioCtx.state === 'suspended') state.audioCtx.resume();

    connectVoice();

    var lang = (config.lang || navigator.language || 'en').split('-')[0].toLowerCase();

    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
      _resetAudioQueue();
      state.audioChunks = [];
      state.isRecording = true;
      var micBtn = $('sfl-mic');
      if (micBtn) micBtn.classList.add('recording');
      _showVoiceFeedback();

      _startLiveTranscript(lang + '-' + lang.toUpperCase());

      var opts = {};
      if (typeof MediaRecorder !== 'undefined') {
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus'))     opts = { mimeType: 'audio/webm;codecs=opus' };
        else if (MediaRecorder.isTypeSupported('audio/webm'))            opts = { mimeType: 'audio/webm' };
        else if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) opts = { mimeType: 'audio/ogg;codecs=opus' };
      }

      state.mediaRecorder = new MediaRecorder(stream, opts);
      state.mediaRecorder.ondataavailable = function (e) {
        if (e.data && e.data.size > 0) state.audioChunks.push(e.data);
      };
      state.mediaRecorder.onstop = function () {
        state.isRecording = false;
        var micBtn = $('sfl-mic');
        if (micBtn) micBtn.classList.remove('recording');
        stream.getTracks().forEach(function (t) { t.stop(); });
        var blob = new Blob(state.audioChunks, { type: state.mediaRecorder.mimeType || 'audio/webm' });
        _sendAudioBlob(blob);
      };
      state.mediaRecorder.start();
    }).catch(function (err) {
      state.isRecording = false;
      var micBtn = $('sfl-mic');
      if (micBtn) micBtn.classList.remove('recording');
      setStatus('Mic access denied: ' + err.message);
    });
  }

  function stopRecording(evt) {
    if (evt) evt.preventDefault();
    if (!state.isRecording || !state.mediaRecorder) return;
    _stopLiveTranscript();
    state.mediaRecorder.stop();
  }

  function _sendAudioBlob(blob) {
    var reader = new FileReader();
    reader.onload = function () {
      var b64 = reader.result.split(',')[1];
      var _doSend = function () {
        if (state.voiceSocket && state.voiceSocket.readyState === WebSocket.OPEN) {
          state.voiceSocket.send(JSON.stringify({ audio_b64: b64 }));
          showTyping('Stayforlong');
          setSendEnabled(false);
        } else {
          setTimeout(_doSend, 150);
        }
      };
      _doSend();
    };
    reader.readAsDataURL(blob);
  }

  // ─── WEBSOCKET ──────────────────────────────────────────────────────────────

  function connect() {
    if (state.socket && state.socket.readyState < 2) return;
    setStatus('');
    setAgentLabel("Connecting...");

    var detectedLang = (config.lang || navigator.language || 'en').split('-')[0].toLowerCase();
    state.userId = state.userId || getUserId();

    // ── GTM / dataLayer context bridge ────────────────────────────────────────
    // config.contextVars keys become extra query params on the WS URL.
    // Values may be GTM variable outputs (strings) resolved before this script runs.
    var ctxParams = '';
    var ctxVars = config.contextVars || {};
    for (var ctxKey in ctxVars) {
      if (Object.prototype.hasOwnProperty.call(ctxVars, ctxKey)) {
        var ctxVal = ctxVars[ctxKey];
        if (ctxVal !== null && ctxVal !== undefined && ctxVal !== '' && ctxVal !== '{{' + ctxKey + '}}') {
          ctxParams += '&' + encodeURIComponent(ctxKey) + '=' + encodeURIComponent(ctxVal);
        }
      }
    }

    var wsUrl = config.wsUrl + '?lang=' + detectedLang + '&user_id=' + encodeURIComponent(state.userId) + ctxParams;
    var ws = new WebSocket(wsUrl);
    state.socket = ws;

    ws.onopen = function () {
      state.isConnected = true;
      state.reconnectAttempts = 0;
      setSendEnabled(true);
      setStatus('');
    };

    ws.onmessage = function (event) {
      var data;
      try { data = JSON.parse(event.data); } catch (e) { return; }
      handleServerMessage(data);
    };

    ws.onclose = function () {
      state.isConnected = false;
      setSendEnabled(false);
      _stopPing();
      if (state.isOpen && state.reconnectAttempts < state.MAX_RECONNECT) {
        state.reconnectAttempts++;
        setStatus('Reconnecting (' + state.reconnectAttempts + '/' + state.MAX_RECONNECT + ')...');
        setTimeout(connect, state.RECONNECT_DELAY);
      } else if (state.reconnectAttempts >= state.MAX_RECONNECT) {
        setStatus('No connection. Reload the page.');
      }
    };

    ws.onerror = function () {
      setStatus('Connection error.');
    };
  }

  function sendMessage() {
    var input = $('sfl-input');
    var text = input.value.trim();
    if (!text) return;
    if (!state.isConnected || !state.socket || state.socket.readyState !== 1) {
      setStatus('No connection to server.');
      return;
    }

    appendMessage('user', text, null);
    state.socket.send(JSON.stringify({ message: text }));

    input.value = '';
    input.style.height = 'auto';
    setSendEnabled(false);

    // Send periodic client-side pings while waiting for a response so Railway's
    // proxy doesn't close the connection due to client-side inactivity.
    _startPing();
  }

  function _startPing() {
    _stopPing();
    state._pingInterval = setInterval(function () {
      if (state.socket && state.socket.readyState === 1) {
        state.socket.send(JSON.stringify({ type: 'ping' }));
      }
    }, 15000);
  }

  function _stopPing() {
    if (state._pingInterval) {
      clearInterval(state._pingInterval);
      state._pingInterval = null;
    }
  }

  // ─── SERVER MESSAGE HANDLER ─────────────────────────────────────────────────

  function handleServerMessage(data) {
    switch (data.type) {
      case 'session_init':
        state.sessionId = data.session_id;
        if (data.user_id) state.userId = data.user_id;
        // Render previous conversation history before the welcome message
        if (data.history && data.history.length > 0) {
          appendSeparator('Previous conversation');
          for (var i = 0; i < data.history.length; i++) {
            var m = data.history[i];
            appendMessage(m.role === 'user' ? 'user' : 'agent', m.content, m.agent || null);
          }
          appendSeparator('New session');
        }
        break;

      case 'typing':
        showTyping(data.agent);
        break;

      case 'chunk':
        if (!state._streamingBubble) {
          hideTyping();
          var wrapper = document.createElement('div');
          wrapper.className = 'sfl-msg agent';
          if (data.agent && data.agent !== 'Stayforlong Assistant') {
            var label = document.createElement('div');
            label.className = 'sfl-agent-label';
            label.textContent = data.agent;
            wrapper.appendChild(label);
          }
          var bubble = document.createElement('div');
          bubble.className = 'sfl-bubble';
          wrapper.appendChild(bubble);
          $('sfl-messages').insertBefore(wrapper, $('sfl-typing'));
          state._streamingBubble = bubble;
        }
        state._streamingBubble.textContent += data.content;
        $('sfl-messages').scrollTop = $('sfl-messages').scrollHeight;
        break;

      case 'message':
        hideTyping();
        setSendEnabled(true);
        _stopPing();
        if (state._streamingBubble) {
          state._streamingBubble.textContent = data.content;
          state._streamingBubble = null;
          setAgentLabel(data.agent || 'Assistant');
        } else {
          appendMessage('agent', data.content, data.agent);
          setAgentLabel(data.agent || 'Assistant');
        }
        // Show unread badge if chat is closed
        if (!state.isOpen) {
          $('sfl-badge').style.display = 'block';
        }
        break;

      case 'error':
        hideTyping();
        setSendEnabled(true);
        _stopPing();
        appendMessage('agent', data.content || 'An error occurred.', null);
        break;
    }
  }

  // ─── TOGGLE OPEN/CLOSE ──────────────────────────────────────────────────────

  function openChat() {
    state.isOpen = true;
    $('sfl-window').classList.add('open');
    $('sfl-badge').style.display = 'none';
    $('sfl-input').focus();
    if (!state.isConnected) connect();
  }

  function closeChat() {
    state.isOpen = false;
    $('sfl-window').classList.remove('open');
  }

  function toggleChat() {
    if (state.isOpen) closeChat(); else openChat();
  }

  // ─── AUTO-RESIZE TEXTAREA ────────────────────────────────────────────────────

  function autoResize(el) {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  }

  // ─── EVENT BINDING ──────────────────────────────────────────────────────────

  function bindEvents() {
    $('sfl-btn').addEventListener('click', toggleChat);
    $('sfl-close').addEventListener('click', closeChat);
    $('sfl-send').addEventListener('click', sendMessage);

    var input = $('sfl-input');
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
    input.addEventListener('input', function () { autoResize(this); });

    // Close on Escape key
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && state.isOpen) closeChat();
    });

    // ── Mic button (push-to-talk) ─────────────────────────────────────────────
    if (config.enableVoice) {
      var mic = $('sfl-mic');
      if (mic) {
        mic.addEventListener('mousedown',  function (e) { e.preventDefault(); startRecording(); });
        mic.addEventListener('mouseup',    function (e) { e.preventDefault(); stopRecording(); });
        mic.addEventListener('mouseleave', function ()  { stopRecording(); });
        mic.addEventListener('touchstart', function (e) { e.preventDefault(); startRecording(); }, { passive: false });
        mic.addEventListener('touchend',   function (e) { e.preventDefault(); stopRecording(); },  { passive: false });
      }
    }
  }

  // ─── INIT ────────────────────────────────────────────────────────────────────

  function init() {
    if (document.getElementById('sfl-chat-host')) return; // Already initialized

    var host = document.createElement('div');
    host.id = 'sfl-chat-host';
    document.body.appendChild(host);

    var shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = TEMPLATE;
    state.shadow = shadow;

    bindEvents();

    // Don't auto-connect: lazy connection when user opens chat
    setSendEnabled(false);
  }

  // Wait for DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})(window.StayforlongChat);
