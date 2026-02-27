/**
 * Stayforlong Chat Widget
 * GTM-injectable, zero-dependency, Shadow DOM isolated.
 *
 * Usage (GTM Custom HTML tag):
 *   <script>
 *     window.StayforlongChat = {
 *       wsUrl: 'wss://your-backend.com/ws',
 *       accentColor: '#f60e5f',
 *       lang: 'es',  // optional — omit to auto-detect from navigator.language
 *     };
 *   </script>
 *   <script src="https://your-cdn.com/sfl-chat-widget.js"></script>
 */
(function (cfg) {
  'use strict';

  var config = Object.assign({
    wsUrl: 'ws://localhost:8000/ws',
    accentColor: '#f60e5f',
    secondaryColor: '#c40a4c',
    lang: null,   // null = auto-detect from navigator.language; set 'es'/'en' to force
    position: 'bottom-right',
    welcomeMessage: null,
  }, cfg || {});

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
  ';

  // ─── HTML TEMPLATE ─────────────────────────────────────────────────────────

  var CHAT_ICON = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z"/></svg>';
  var CLOSE_ICON = '&#x2715;';
  var SEND_ICON = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>';

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
      <div id="sfl-status"></div>\
      <div id="sfl-input-row">\
        <textarea id="sfl-input" rows="1" placeholder="Write your message..." aria-label="Message"></textarea>\
        <button id="sfl-send" aria-label="Send">' + SEND_ICON + '</button>\
      </div>\
    </div>\
  ';

  // ─── STATE ─────────────────────────────────────────────────────────────────

  var state = {
    socket: null,
    sessionId: null,
    isOpen: false,
    isConnected: false,
    reconnectAttempts: 0,
    MAX_RECONNECT: 3,
    RECONNECT_DELAY: 2500,
    shadow: null,
  };

  // ─── DOM HELPERS ────────────────────────────────────────────────────────────

  function $(id) { return state.shadow.getElementById(id); }

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

  // ─── WEBSOCKET ──────────────────────────────────────────────────────────────

  function connect() {
    if (state.socket && state.socket.readyState < 2) return;
    setStatus('');
    setAgentLabel("Connecting...");

    var detectedLang = (config.lang || navigator.language || 'en').split('-')[0].toLowerCase();
    var wsUrl = config.wsUrl + '?lang=' + detectedLang;
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
  }

  // ─── SERVER MESSAGE HANDLER ─────────────────────────────────────────────────

  function handleServerMessage(data) {
    switch (data.type) {
      case 'session_init':
        state.sessionId = data.session_id;
        break;

      case 'typing':
        showTyping(data.agent);
        break;

      case 'message':
        hideTyping();
        setSendEnabled(true);
        appendMessage('agent', data.content, data.agent);
        setAgentLabel(data.agent || 'Assistant');
        // Show unread badge if chat is closed
        if (!state.isOpen) {
          $('sfl-badge').style.display = 'block';
        }
        break;

      case 'error':
        hideTyping();
        setSendEnabled(true);
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
