/**
 * Stayforlong Voice Widget
 * Standalone voice-interaction layer — Shadow DOM isolated, zero dependencies.
 *
 * Connects to /ws/voice on the same backend as the text widget.
 * Can be loaded alongside sfl-chat-widget.js OR independently.
 *
 * Usage:
 *   <script>
 *     window.StayforlongVoice = {
 *       voiceWsUrl: 'wss://your-backend.com/ws/voice',  // optional, auto-derived otherwise
 *       wsUrl:      'wss://your-backend.com/ws',        // used when voiceWsUrl is omitted
 *       accentColor: '#f60e5f',
 *       lang: 'es',   // optional — omit to auto-detect
 *     };
 *   </script>
 *   <script src="https://your-cdn.com/sfl-voice-widget.js"></script>
 *
 * The widget renders a floating mic button (bottom-left by default so it does
 * not overlap the text chat button at bottom-right).
 * Hold to talk, release to send.  The response is spoken back via audio chunks.
 * The full text of the conversation turn also appears in a small overlay.
 */
(function (cfg) {
  'use strict';

  // ── Config ──────────────────────────────────────────────────────────────────

  var config = Object.assign({
    wsUrl: (function () {
      var h = (typeof location !== 'undefined') ? location.hostname : '';
      var isLocal = !h || h === 'localhost' || h === '127.0.0.1';
      return isLocal
        ? 'ws://localhost:8000/ws'
        : 'wss://sfl-multi-agents-ws.up.railway.app/ws';
    })(),
    voiceWsUrl: null,      // null = replace /ws with /ws/voice in wsUrl
    accentColor: '#f60e5f',
    secondaryColor: '#c40a4c',
    lang: null,            // null = auto-detect from navigator.language
    position: 'bottom-left',
  }, cfg || {});

  function _voiceUrl() {
    if (config.voiceWsUrl) return config.voiceWsUrl;
    return config.wsUrl.replace(/\/ws(\?.*)?$/, '/ws/voice');
  }

  // ── Shadow DOM host ──────────────────────────────────────────────────────────

  if (document.getElementById('sfl-voice-host')) return;
  var host = document.createElement('div');
  host.id = 'sfl-voice-host';
  document.body.appendChild(host);
  var shadow = host.attachShadow({ mode: 'open' });

  // ── Styles ───────────────────────────────────────────────────────────────────

  var style = document.createElement('style');
  style.textContent = [
    ':host { all: initial; }',
    '*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }',

    /* mic button */
    '#sfl-voice-btn {',
    '  position: fixed;',
    (config.position === 'bottom-right' ? '  right: 24px;' : '  left: 24px;'),
    '  bottom: 24px;',
    '  width: 60px; height: 60px;',
    '  border-radius: 50%;',
    '  background: ' + config.accentColor + ';',
    '  border: none;',
    '  cursor: pointer;',
    '  display: flex; align-items: center; justify-content: center;',
    '  box-shadow: 0 4px 16px rgba(0,0,0,0.25);',
    '  z-index: 2147483645;',
    '  transition: transform 0.15s, box-shadow 0.15s;',
    '  user-select: none; -webkit-user-select: none; touch-action: none;',
    '}',
    '#sfl-voice-btn:hover { transform: scale(1.08); box-shadow: 0 6px 20px rgba(0,0,0,0.3); }',
    '#sfl-voice-btn svg { width: 26px; height: 26px; fill: #fff; }',
    '#sfl-voice-btn.recording {',
    '  background: #fff;',
    '  border: 3px solid ' + config.accentColor + ';',
    '  animation: sflv-pulse 0.9s infinite;',
    '}',
    '#sfl-voice-btn.recording svg { fill: ' + config.accentColor + '; }',
    '@keyframes sflv-pulse {',
    '  0%,100% { box-shadow: 0 0 0 0 rgba(246,14,95,0.45); }',
    '  50%      { box-shadow: 0 0 0 10px rgba(246,14,95,0); }',
    '}',

    /* transcript / response overlay */
    '#sflv-overlay {',
    '  position: fixed;',
    (config.position === 'bottom-right' ? '  right: 96px;' : '  left: 96px;'),
    '  bottom: 20px;',
    '  max-width: 280px;',
    '  background: rgba(255,255,255,0.97);',
    '  border: 1px solid #e8ecf0;',
    '  border-radius: 14px;',
    '  box-shadow: 0 4px 20px rgba(0,0,0,0.12);',
    '  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;',
    '  font-size: 13px;',
    '  line-height: 1.5;',
    '  color: #1d1d1f;',
    '  z-index: 2147483644;',
    '  display: none;',
    '  flex-direction: column;',
    '  gap: 0;',
    '  overflow: hidden;',
    '}',
    '#sflv-overlay.visible { display: flex; }',

    '#sflv-header {',
    '  background: linear-gradient(135deg,' + config.secondaryColor + ',' + config.accentColor + ');',
    '  color: #fff;',
    '  padding: 8px 12px;',
    '  font-size: 11px;',
    '  font-weight: 700;',
    '  letter-spacing: 0.3px;',
    '  display: flex; align-items: center; gap: 6px;',
    '}',
    '#sflv-header svg { width: 12px; height: 12px; fill: #fff; opacity: 0.85; }',
    '#sflv-status-dot {',
    '  width: 7px; height: 7px; border-radius: 50%;',
    '  background: rgba(255,255,255,0.45);',
    '}',
    '#sflv-status-dot.active { background: #4ade80; }',

    '#sflv-body { padding: 10px 13px; display: flex; flex-direction: column; gap: 6px; }',

    '.sflv-msg { display: flex; flex-direction: column; gap: 2px; }',
    '.sflv-lbl { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px; color: #9e9e9e; }',
    '.sflv-lbl.voice { color: ' + config.accentColor + '; }',
    '.sflv-bubble {',
    '  padding: 7px 10px;',
    '  border-radius: 10px;',
    '  word-break: break-word;',
    '  white-space: pre-wrap;',
    '}',
    '.sflv-msg.user .sflv-bubble { background: ' + config.accentColor + '; color: #fff; border-bottom-right-radius: 3px; }',
    '.sflv-msg.agent .sflv-bubble { background: #f0f4f8; color: #1d1d1f; border-bottom-left-radius: 3px; }',

    '#sflv-typing {',
    '  display: none; gap: 4px; align-items: center; padding: 4px 2px;',
    '}',
    '#sflv-typing.visible { display: flex; }',
    '#sflv-typing span {',
    '  width: 5px; height: 5px; border-radius: 50%; background: #bbb;',
    '  animation: sflv-bounce 1.2s infinite;',
    '}',
    '#sflv-typing span:nth-child(2) { animation-delay: 0.2s; }',
    '#sflv-typing span:nth-child(3) { animation-delay: 0.4s; }',
    '@keyframes sflv-bounce {',
    '  0%,80%,100% { transform: translateY(0); }',
    '  40%         { transform: translateY(-4px); }',
    '}',

    '#sflv-hint {',
    '  font-size: 10px; color: #b0b0b8; text-align: center;',
    '  padding: 4px 12px 8px;',
    '}',
  ].join('\n');

  // ── HTML ─────────────────────────────────────────────────────────────────────

  var MIC_SVG = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 1a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4zm-1 17.93A8 8 0 0 1 4.07 12H6a6 6 0 0 0 12 0h1.93A8 8 0 0 1 13 18.93V21h2v2H9v-2h2v-2.07z"/></svg>';

  var btn = document.createElement('button');
  btn.id = 'sfl-voice-btn';
  btn.setAttribute('aria-label', 'Hold to speak');
  btn.title = 'Hold to speak';
  btn.innerHTML = MIC_SVG;

  var overlay = document.createElement('div');
  overlay.id = 'sflv-overlay';
  overlay.innerHTML = [
    '<div id="sflv-header">',
    '  <div id="sflv-status-dot"></div>',
    '  <span>Voice assistant</span>',
    '</div>',
    '<div id="sflv-body">',
    '  <div id="sflv-typing" aria-hidden="true">',
    '    <span></span><span></span><span></span>',
    '  </div>',
    '</div>',
    '<div id="sflv-hint">Hold mic button to speak</div>',
  ].join('');

  shadow.appendChild(style);
  shadow.appendChild(btn);
  shadow.appendChild(overlay);

  // ── Helpers ──────────────────────────────────────────────────────────────────

  function $(id) { return shadow.getElementById(id); }

  function _showOverlay() { overlay.classList.add('visible'); }
  function _hideOverlayLater(ms) {
    setTimeout(function () { overlay.classList.remove('visible'); }, ms || 4000);
  }

  function _showTyping() { $('sflv-typing').classList.add('visible'); }
  function _hideTyping()  { $('sflv-typing').classList.remove('visible'); }

  function _appendMsg(role, text) {
    var body = $('sflv-body');
    var typing = $('sflv-typing');

    var wrap = document.createElement('div');
    wrap.className = 'sflv-msg ' + role;

    var lbl = document.createElement('div');
    lbl.className = 'sflv-lbl' + (role === 'user' ? ' voice' : '');
    lbl.textContent = role === 'user' ? '🎤 You' : 'Assistant';
    wrap.appendChild(lbl);

    var bubble = document.createElement('div');
    bubble.className = 'sflv-bubble';
    bubble.textContent = text;
    wrap.appendChild(bubble);

    body.insertBefore(wrap, typing);

    // Keep only last 4 messages to avoid overflow
    var msgs = body.querySelectorAll('.sflv-msg');
    if (msgs.length > 4) msgs[0].remove();
  }

  function _setStatusDot(active) {
    var dot = $('sflv-status-dot');
    if (active) dot.classList.add('active');
    else dot.classList.remove('active');
  }

  function _getUserId() {
    var KEY = 'sfl_chat_user_id';
    try {
      var v = localStorage.getItem(KEY);
      if (v) return v;
      v = 'sfl_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem(KEY, v);
      return v;
    } catch (e) {
      return 'anon_' + Math.random().toString(36).substr(2, 12);
    }
  }

  // ── Audio queue (gapless sequential playback via Web Audio API) ───────────

  var _audioCtx = null;
  var _audioQueue = [];
  var _audioNextSeq = 0;
  var _audioPlaying = false;

  function _getAudioCtx() {
    if (!_audioCtx) {
      _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    return _audioCtx;
  }

  function _resetAudio() {
    _audioQueue = [];
    _audioNextSeq = 0;
    _audioPlaying = false;
  }

  function _b64ToArrayBuffer(b64) {
    var binary = atob(b64);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer;
  }

  function _enqueueChunk(b64, seq) {
    var ctx = _getAudioCtx();
    ctx.decodeAudioData(_b64ToArrayBuffer(b64), function (buffer) {
      _audioQueue.push({ seq: seq, buffer: buffer });
      _audioQueue.sort(function (a, b) { return a.seq - b.seq; });
      if (!_audioPlaying) _playNext();
    });
  }

  function _playNext() {
    if (!_audioQueue.length) { _audioPlaying = false; return; }
    var item = _audioQueue[0];
    if (item.seq !== _audioNextSeq) { _audioPlaying = false; return; }
    _audioQueue.shift();
    _audioNextSeq++;
    _audioPlaying = true;
    var ctx = _getAudioCtx();
    var src = ctx.createBufferSource();
    src.buffer = item.buffer;
    src.connect(ctx.destination);
    src.onended = _playNext;
    src.start(0);
  }

  // ── WebSocket ────────────────────────────────────────────────────────────────

  var _ws = null;
  var _userId = _getUserId();
  var _lang = (config.lang || navigator.language || 'en').split('-')[0].toLowerCase();

  function _connectWs() {
    if (_ws && _ws.readyState < 2) return;
    var url = _voiceUrl() + '?lang=' + _lang + '&user_id=' + encodeURIComponent(_userId);
    _ws = new WebSocket(url);
    _ws.onopen  = function () { _setStatusDot(true); };
    _ws.onclose = function () { _setStatusDot(false); _ws = null; };
    _ws.onerror = function () { _setStatusDot(false); };
    _ws.onmessage = function (evt) {
      var data;
      try { data = JSON.parse(evt.data); } catch (e) { return; }
      _handleMsg(data);
    };
  }

  function _handleMsg(data) {
    switch (data.type) {
      case 'ping': break;
      case 'session_init': break;

      case 'transcript':
        _hideTyping();
        if (data.text) {
          _showOverlay();
          _appendMsg('user', data.text);
        }
        break;

      case 'typing':
        _showOverlay();
        _showTyping();
        break;

      case 'audio_chunk':
        _hideTyping();
        // Resume AudioContext if browser suspended it (autoplay policy)
        if (_audioCtx && _audioCtx.state === 'suspended') _audioCtx.resume();
        _enqueueChunk(data.audio_b64, data.seq);
        break;

      case 'message':
        _hideTyping();
        _appendMsg('agent', data.content);
        _hideOverlayLater(8000);
        break;

      case 'audio_done': break;

      case 'error':
        _hideTyping();
        _appendMsg('agent', data.content || 'An error occurred.');
        _hideOverlayLater(5000);
        break;
    }
  }

  // ── MediaRecorder (push-to-talk) ─────────────────────────────────────────────

  var _recorder = null;
  var _chunks = [];
  var _recording = false;

  function _startRecording() {
    if (_recording) return;

    // Ensure AudioContext is unblocked on first gesture
    if (_audioCtx && _audioCtx.state === 'suspended') _audioCtx.resume();

    _connectWs();

    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
      _resetAudio();
      _chunks = [];
      _recording = true;
      btn.classList.add('recording');
      _showOverlay();

      var opts = {};
      if (typeof MediaRecorder !== 'undefined') {
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus'))  opts = { mimeType: 'audio/webm;codecs=opus' };
        else if (MediaRecorder.isTypeSupported('audio/webm'))         opts = { mimeType: 'audio/webm' };
        else if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) opts = { mimeType: 'audio/ogg;codecs=opus' };
      }

      _recorder = new MediaRecorder(stream, opts);
      _recorder.ondataavailable = function (e) { if (e.data && e.data.size > 0) _chunks.push(e.data); };
      _recorder.onstop = function () {
        _recording = false;
        btn.classList.remove('recording');
        stream.getTracks().forEach(function (t) { t.stop(); });
        var blob = new Blob(_chunks, { type: _recorder.mimeType || 'audio/webm' });
        _sendAudio(blob);
      };
      _recorder.start();

    }).catch(function () {
      _recording = false;
      btn.classList.remove('recording');
    });
  }

  function _stopRecording() {
    if (!_recording || !_recorder) return;
    _recorder.stop();
  }

  function _sendAudio(blob) {
    var reader = new FileReader();
    reader.onload = function () {
      var b64 = reader.result.split(',')[1];
      var _send = function () {
        if (_ws && _ws.readyState === WebSocket.OPEN) {
          _ws.send(JSON.stringify({ audio_b64: b64 }));
          _showTyping();
        } else {
          setTimeout(_send, 150);
        }
      };
      _send();
    };
    reader.readAsDataURL(blob);
  }

  // ── Button events (mouse + touch) ────────────────────────────────────────────

  btn.addEventListener('mousedown',  function (e) { e.preventDefault(); _startRecording(); });
  btn.addEventListener('mouseup',    function (e) { e.preventDefault(); _stopRecording(); });
  btn.addEventListener('mouseleave', function ()  { _stopRecording(); });
  btn.addEventListener('touchstart', function (e) { e.preventDefault(); _startRecording(); }, { passive: false });
  btn.addEventListener('touchend',   function (e) { e.preventDefault(); _stopRecording(); },  { passive: false });

  // ── Pre-connect on page load so the first voice turn has no WS setup delay ──
  _connectWs();

})(window.StayforlongVoice || {});
