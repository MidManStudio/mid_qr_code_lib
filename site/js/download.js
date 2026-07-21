/**
 * download.js
 * Handles SVG / PNG download and clipboard copy.
 */

import { getCurrentSvg, getCurrentData, getCurrentOptions } from './preview.js';
import { generateQrMsx } from './qr-engine.js';

let _format = 'svg';  // 'svg' | 'png' | 'msx'

// ── PNG conversion ────────────────────────────────────────────────────────────

function svgToPngBlob(svgString, scale = 2) {
  return new Promise((resolve, reject) => {
    // Parse the SVG to find its declared width/height
    const parser  = new DOMParser();
    const doc     = parser.parseFromString(svgString, 'image/svg+xml');
    const svgEl   = doc.documentElement;
    const w       = parseFloat(svgEl.getAttribute('width')  || '400');
    const h       = parseFloat(svgEl.getAttribute('height') || '400');

    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const img  = new Image();

    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width  = w * scale;
      canvas.height = h * scale;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Canvas to Blob failed')), 'image/png');
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load SVG as image'));
    };

    img.src = url;
  });
}

// ── Trigger download ──────────────────────────────────────────────────────────

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a   = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function getFilename(ext) {
  return `mid-qr-${Date.now()}.${ext}`;
}

// ── Public actions ────────────────────────────────────────────────────────────

export async function downloadCurrent() {
  const svg = getCurrentSvg();
  if (!svg) return;

  if (_format === 'svg') {
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    triggerDownload(blob, getFilename('svg'));
  } else if (_format === 'msx') {
    try {
      const msx = generateQrMsx(getCurrentData(), getCurrentOptions());
      const blob = new Blob([msx], { type: 'text/plain;charset=utf-8' });
      triggerDownload(blob, getFilename('msx'));
    } catch (err) {
      console.error('MSX export failed:', err);
      const msg = /logo/i.test(err.message)
        ? 'MSX export doesn\'t support a logo yet (no raster element in MSX v0.1). Remove the logo, or use SVG/PNG instead.'
        : `MSX export failed: ${err.message}`;
      alert(msg);
    }
  } else {
    try {
      const blob = await svgToPngBlob(svg, 2);
      triggerDownload(blob, getFilename('png'));
    } catch (err) {
      console.error('PNG export failed:', err);
      alert('PNG export failed. Try SVG format instead.');
    }
  }
}

export async function copySvgToClipboard() {
  const svg = getCurrentSvg();
  if (!svg) return false;

  try {
    await navigator.clipboard.writeText(svg);
    return true;
  } catch {
    // Fallback: select a textarea
    const ta = document.createElement('textarea');
    ta.value = svg;
    ta.style.cssText = 'position:fixed;opacity:0;';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  }
}

// ── Init ──────────────────────────────────────────────────────────────────────

export function initDownload({ onStatus }) {
  const btnDownload = document.getElementById('btn-download');
  const btnCopy     = document.getElementById('btn-copy');

  btnDownload?.addEventListener('click', async () => {
    onStatus('Preparing download…', 'generating');
    await downloadCurrent();
    onStatus('Downloaded', 'success');
    setTimeout(() => onStatus('Ready', 'idle'), 2000);
  });

  btnCopy?.addEventListener('click', async () => {
    const ok = await copySvgToClipboard();
    onStatus(ok ? 'SVG copied to clipboard' : 'Copy failed', ok ? 'success' : 'error');
    setTimeout(() => onStatus('Ready', 'idle'), 2000);
  });

  // Format menu
  document.getElementById('fmt-menu')?.addEventListener('click', e => {
    const opt = e.target.closest('.fmt-option');
    if (opt?.dataset.fmt) {
      _format = opt.dataset.fmt;
      // Update the download button label
      const label = btnDownload?.querySelector('.btn__label') ?? btnDownload;
      if (label) label.textContent = `Download ${_format.toUpperCase()}`;
    }
  });
  }
