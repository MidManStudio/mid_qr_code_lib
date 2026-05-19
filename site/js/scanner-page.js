/**
 * scanner-page.js
 * Handles the QR scanner page — camera lifecycle, decode, locked payload
 * unwrapping, result display, and scan history.
 */

const el = id => document.getElementById(id);

// ── Locked payload unwrap ─────────────────────────────────────────────────────

const LOCKED_PREFIX = 'mid-qr-v1=';

function unwrapLocked(raw) {
  const idx = raw.indexOf(LOCKED_PREFIX);
  if (idx < 0) return { payload: raw, wasLocked: false };
  try {
    let b64 = raw.slice(idx + LOCKED_PREFIX.length);
    b64 = b64.split('&')[0].split('#')[0];
    const json    = decodeURIComponent(escape(atob(b64)));
    const payload = JSON.parse(json).data ?? raw;
    return { payload, wasLocked: true };
  } catch {
    return { payload: raw, wasLocked: false };
  }
}

function isUrl(str) {
  try { return /^https?:\/\//i.test(str); } catch { return false; }
}

// ── Pill groups ───────────────────────────────────────────────────────────────

function initPillGroups() {
  document.querySelectorAll('.pill-group').forEach(group => {
    group.addEventListener('click', e => {
      const pill = e.target.closest('.pill');
      if (!pill) return;
      group.querySelectorAll('.pill').forEach(p => p.classList.remove('is-active'));
      pill.classList.add('is-active');
    });
  });
}

// ── Range display ─────────────────────────────────────────────────────────────

function initRanges() {
  const rate = el('scan-rate');
  const disp = el('scan-rate-display');
  if (!rate) return;
  const sync = () => {
    if (disp) disp.textContent = rate.value;
    const pct = ((rate.value - rate.min) / (rate.max - rate.min)) * 100;
    rate.style.background =
      `linear-gradient(to right, #2563eb ${pct}%, rgba(255,255,255,0.08) ${pct}%)`;
  };
  rate.addEventListener('input', sync);
  sync();
}

// ── Status ────────────────────────────────────────────────────────────────────

function setStatus(text, state = 'idle') {
  const dot  = el('ctrl-status-dot');
  const span = el('ctrl-status-text');
  if (dot)  dot.dataset.state = state;
  if (span) span.textContent  = text;
}

// ── Result display ────────────────────────────────────────────────────────────

let _lastResult = null;

function showResult(payload, wasLocked, wasRejected = false) {
  const box     = el('result-box');
  const meta    = el('result-meta');
  const badge   = el('result-badge');
  const actions = el('result-actions');
  const timeEl  = el('result-time');
  const openBtn = el('btn-open-url');

  if (!box) return;

  box.textContent = payload;
  box.classList.remove('has-result', 'is-locked', 'is-rejected');

  if (wasRejected) {
    box.classList.add('is-rejected');
    box.textContent = 'Rejected — not a locked mid-qr payload';
    badge.textContent  = 'REJECTED';
    badge.className    = 'result-badge result-badge--rejected';
  } else if (wasLocked) {
    box.classList.add('is-locked', 'has-result');
    badge.textContent  = 'LOCKED PAYLOAD';
    badge.className    = 'result-badge result-badge--locked';
  } else {
    box.classList.add('has-result');
    badge.textContent  = 'PLAIN';
    badge.className    = 'result-badge result-badge--plain';
  }

  const now = new Date();
  if (timeEl) {
    timeEl.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  meta?.classList.remove('is-hidden');
  if (!wasRejected) actions?.classList.remove('is-hidden');

  // Show / hide open URL button
  if (openBtn) {
    const canOpen = !wasRejected && isUrl(payload);
    openBtn.classList.toggle('is-hidden', !canOpen);
  }

  _lastResult = wasRejected ? null : payload;
}

// ── Scan history ──────────────────────────────────────────────────────────────

const _history = [];

function addToHistory(payload, wasLocked, time) {
  _history.unshift({ payload, wasLocked, time });
  if (_history.length > 50) _history.pop();
  renderHistory();
}

function renderHistory() {
  const list = el('history-list');
  if (!list) return;

  if (_history.length === 0) {
    list.innerHTML = `<p style="font-size:var(--text-xs);color:var(--c-text-2);padding:var(--sp-1) 0">
      Scan results appear here</p>`;
    return;
  }

  list.innerHTML = _history.map((item, i) => `
    <div class="history-item" data-index="${i}" tabindex="0" role="button"
         aria-label="Scan result: ${item.payload.slice(0,60)}">
      <span class="history-item__text">${escHtml(item.payload)}</span>
      <span class="history-item__time">${item.time}</span>
    </div>
  `).join('');

  list.querySelectorAll('.history-item').forEach(item => {
    const onClick = () => {
      const idx = parseInt(item.dataset.index, 10);
      const h   = _history[idx];
      if (h) showResult(h.payload, h.wasLocked);
    };
    item.addEventListener('click', onClick);
    item.addEventListener('keydown', e => e.key === 'Enter' && onClick());
  });
}

function escHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Scanner lifecycle ─────────────────────────────────────────────────────────

let _scanner   = null;
let _scanning  = false;

async function startScanner() {
  if (_scanning) return;

  const video       = el('scanner-video');
  const idle        = el('camera-idle');
  const overlay     = el('scan-overlay');
  const lockedMode  = el('locked-mode')?.checked ?? false;
  const camPref     = document.querySelector('.pill.is-active[data-group="cam-pref"]')?.dataset.value ?? 'environment';
  const maxScans    = parseInt(el('scan-rate')?.value ?? 5, 10);

  setStatus('Requesting camera…', 'generating');

  try {
    const { MidQrScanner } = await import('./mid-qr.js');

    _scanner = await MidQrScanner.create(
      video,
      result => {
        const { payload, wasLocked } = unwrapLocked(result.data);

        if (lockedMode && !wasLocked) {
          setStatus('Rejected — not a locked payload', 'error');
          showResult(result.data, false, true);
          setTimeout(() => setStatus('Scanning…', 'generating'), 2000);
          return;
        }

        const timeStr = new Date().toLocaleTimeString([], {
          hour: '2-digit', minute: '2-digit', second: '2-digit',
        });

        showResult(payload, wasLocked);
        addToHistory(payload, wasLocked, timeStr);

        setStatus(wasLocked ? 'Locked payload decoded' : 'QR code scanned', 'success');
        setTimeout(() => {
          if (_scanning) setStatus('Scanning…', 'generating');
        }, 2500);
      },
      { preferredCamera: camPref, maxScansPerSecond: maxScans },
      () => { /* silent decode errors */ }
    );

    await _scanner.start();
    _scanning = true;

    idle?.classList.add('is-hidden');
    video?.classList.remove('is-hidden');
    overlay?.classList.remove('is-hidden');

    el('btn-start')?.setAttribute('disabled', '');
    el('btn-stop')?.removeAttribute('disabled');
    el('btn-switch-cam')?.toggleAttribute('disabled', (_scanner?.cameras?.length ?? 1) <= 1);

    setStatus('Scanning…', 'generating');

  } catch (err) {
    console.error('Scanner start failed:', err);
    setStatus(`Camera error: ${err.message ?? err}`, 'error');
  }
}

function stopScanner() {
  if (!_scanning) return;

  _scanner?.stop();
  _scanner?.destroy();
  _scanner  = null;
  _scanning = false;

  el('scanner-video')?.classList.add('is-hidden');
  el('scan-overlay')?.classList.add('is-hidden');
  el('camera-idle')?.classList.remove('is-hidden');

  el('btn-start')?.removeAttribute('disabled');
  el('btn-stop')?.setAttribute('disabled', '');
  el('btn-switch-cam')?.setAttribute('disabled', '');

  setStatus('Scanner stopped', 'idle');
}

async function switchCamera() {
  if (!_scanner) return;
  try {
    await _scanner.switchCamera();
    setStatus('Camera switched', 'success');
    setTimeout(() => { if (_scanning) setStatus('Scanning…', 'generating'); }, 1500);
  } catch (err) {
    setStatus(`Switch failed: ${err.message ?? err}`, 'error');
  }
}

// ── Copy result ───────────────────────────────────────────────────────────────

async function copyResult() {
  if (!_lastResult) return;
  try {
    await navigator.clipboard.writeText(_lastResult);
    const btn = el('btn-copy-result');
    if (btn) {
      const prev = btn.textContent;
      btn.textContent = 'Copied';
      setTimeout(() => { btn.textContent = prev; }, 1800);
    }
  } catch {
    /* clipboard not available */
  }
}

// ── Boot ──────────────────────────────────────────────────────────────────────

function boot() {
  initPillGroups();
  initRanges();
  renderHistory();

  el('btn-start')?.addEventListener('click', startScanner);
  el('btn-stop')?.addEventListener('click', stopScanner);
  el('btn-switch-cam')?.addEventListener('click', switchCamera);
  el('btn-copy-result')?.addEventListener('click', copyResult);

  el('btn-open-url')?.addEventListener('click', () => {
    if (_lastResult && isUrl(_lastResult)) window.open(_lastResult, '_blank', 'noopener');
  });

  el('btn-clear-history')?.addEventListener('click', () => {
    _history.length = 0;
    renderHistory();
  });

  // Stop scanner on page hide (tab switch / minimize)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopScanner();
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
                           }
