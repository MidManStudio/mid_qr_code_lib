/**
 * app.js — Entry point
 *
 * Initialises the QR engine and wires controls → preview → download.
 *
 * Build / deployment note:
 *   The site expects the following paths to exist at runtime:
 *     ./js/mid-qr.js              ← npm/dist/index.js
 *     ./wasm/mid_qr_wasm_bg.wasm  ← from the dist branch
 *     ./js/worker/qr-scanner.umd.min.js
 */

import { initEngine, generateQr }           from './qr-engine.js';
import { initControls, getData, getOptions } from './controls.js';
import {
  initPreview, initFormatMenu,
  setLoading, setStatus, showQr,
  enableActions, getCurrentSvg,
}                                            from './preview.js';
import { initDownload }                     from './download.js';

// ── State ─────────────────────────────────────────────────────────────────────

let _hasGenerated = false;
let _debounceTimer = null;
let _engineReady   = false;

// ── Generate ──────────────────────────────────────────────────────────────────

async function doGenerate() {
  if (!_engineReady) {
    setStatus('Engine loading, please wait…', 'generating');
    return;
  }

  clearTimeout(_debounceTimer);

  let data, options;
  try {
    data    = getData();
    options = getOptions();
  } catch (err) {
    setStatus(`Input error: ${err.message}`, 'error');
    return;
  }

  setLoading(true);
  setStatus('Generating…', 'generating');

  try {
    const svg = generateQr(data, options);
    showQr(svg);
    enableActions(true);
    setStatus(`Ready — ${data.length} chars`, 'success');
    _hasGenerated = true;

    setTimeout(() => {
      if (document.getElementById('status-dot')?.dataset.state === 'success') {
        setStatus('Ready', 'idle');
      }
    }, 2500);

  } catch (err) {
    console.error('Generation failed:', err);
    setStatus(`Error: ${err.message}`, 'error');
    enableActions(getCurrentSvg() !== null);
  } finally {
    setLoading(false);
  }
}

// Debounced auto-generate (fires after first manual generate)
function scheduleAutoGenerate() {
  if (!_hasGenerated || !_engineReady) return;
  clearTimeout(_debounceTimer);
  _debounceTimer = setTimeout(doGenerate, 480);
}

// ── Boot ──────────────────────────────────────────────────────────────────────

async function boot() {

  // Init UI (synchronous — no WASM needed)
  initPreview();
  initControls(scheduleAutoGenerate);
  initFormatMenu(fmt => {
    const btn = document.getElementById('btn-download');
    if (btn) {
      const span = btn.childNodes[0];
      if (span?.nodeType === Node.TEXT_NODE) {
        span.textContent = `Download ${fmt.toUpperCase()}`;
      }
    }
  });
  initDownload({ onStatus: setStatus });

  // Wire generate button
  document.getElementById('btn-generate')?.addEventListener('click', doGenerate);

  // Status
  setStatus('Loading engine…', 'generating');

  // Load WASM async
  try {
    await initEngine();
    _engineReady = true;
    setStatus('Ready', 'idle');

    // Enable button
    const btn = document.getElementById('btn-generate');
    if (btn) btn.disabled = false;

  } catch (err) {
    console.error('Engine init failed:', err);
    setStatus('Failed to load QR engine', 'error');
    return;
  }
}

// ── Run ───────────────────────────────────────────────────────────────────────

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
    }
