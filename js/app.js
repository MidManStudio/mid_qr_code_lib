/**
 * app.js — Entry point for the generator page.
 */

import { initEngine, generateQr }           from './qr-engine.js';
import { initControls, getData, getOptions } from './controls.js';
import {
  initPreview, initFormatMenu,
  setLoading, setStatus, showQr,
  enableActions, getCurrentSvg,
}                                            from './preview.js';
import { initDownload }                      from './download.js';

let _hasGenerated = false;
let _debounceTimer = null;
let _engineReady   = false;

async function doGenerate() {
  if (!_engineReady) { setStatus('Engine loading…', 'generating'); return; }

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

    const label = options.frame ? ' with frame' : '';
    setStatus(`Generated${label} — ${data.length} chars`, 'success');
    _hasGenerated = true;

    setTimeout(() => {
      if (document.getElementById('status-dot')?.dataset.state === 'success')
        setStatus('Ready', 'idle');
    }, 2500);

  } catch (err) {
    console.error('Generation failed:', err);
    setStatus(`Error: ${err.message}`, 'error');
    enableActions(getCurrentSvg() !== null);
  } finally {
    setLoading(false);
  }
}

function scheduleAutoGenerate(e) {
  if (!_hasGenerated || !_engineReady) return;
  // Don't auto-trigger on tab clicks or type-selector clicks
  if (e?.target?.closest?.('.tab-btn'))   return;
  if (e?.target?.closest?.('.type-btn'))  return;
  if (e?.target?.closest?.('.frame-card')) return;
  clearTimeout(_debounceTimer);
  _debounceTimer = setTimeout(doGenerate, 500);
}

async function boot() {
  initPreview();
  initControls(scheduleAutoGenerate);
  initFormatMenu();
  initDownload({ onStatus: setStatus });

  document.getElementById('btn-generate')?.addEventListener('click', doGenerate);

  setStatus('Loading engine…', 'generating');
  document.getElementById('btn-generate').disabled = true;

  try {
    await initEngine();
    _engineReady = true;
    setStatus('Ready', 'idle');
    document.getElementById('btn-generate').disabled = false;
  } catch (err) {
    console.error('Engine init failed:', err);
    setStatus('Failed to load engine — check console', 'error');
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
