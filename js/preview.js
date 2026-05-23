/**
 * preview.js
 * Manages the QR preview panel — output, loading overlay, status bar.
 */

const el = id => document.getElementById(id);

export function initPreview() {
  // Close format menu when clicking outside
  document.addEventListener('click', e => {
    const menu   = el('fmt-menu');
    const toggle = el('btn-fmt-toggle');
    if (!menu || menu.hidden) return;
    if (!menu.contains(e.target) && e.target !== toggle) {
      closeFormatMenu();
    }
  });
}

// ── Loading ───────────────────────────────────────────────────────────────────

export function setLoading(active) {
  el('qr-loading')?.classList.toggle('is-hidden', !active);
}

// ── QR display ────────────────────────────────────────────────────────────────

let _currentSvg = null;

export function showQr(svgString) {
  _currentSvg = svgString;

  const output = el('qr-output');
  const empty  = el('qr-empty');

  if (!output) return;

  if (empty) empty.remove();  // remove placeholder

  // Clear previous and inject new SVG
  output.innerHTML = svgString;

  // Ensure the SVG scales correctly inside the panel
  const svgEl = output.querySelector('svg');
  if (svgEl) {
    svgEl.removeAttribute('width');
    svgEl.removeAttribute('height');
    svgEl.style.width  = '100%';
    svgEl.style.height = 'auto';
    svgEl.style.maxWidth = '380px';
  }
}

export function showEmpty() {
  _currentSvg = null;
  const output = el('qr-output');
  if (output) {
    output.innerHTML = `
      <div class="qr-empty" id="qr-empty">
        <svg class="qr-empty__art" viewBox="0 0 120 120" fill="none" aria-hidden="true">
          <defs>
            <linearGradient id="eg2" x1="0" y1="0" x2="120" y2="120" gradientUnits="userSpaceOnUse">
              <stop stop-color="#e63946" stop-opacity=".5"/>
              <stop offset="1" stop-color="#2563eb" stop-opacity=".5"/>
            </linearGradient>
          </defs>
          <rect x="10" y="10" width="40" height="40" rx="4" stroke="url(#eg2)" stroke-width="2" fill="none" stroke-dasharray="5 3"/>
          <rect x="70" y="10" width="40" height="40" rx="4" stroke="url(#eg2)" stroke-width="2" fill="none" stroke-dasharray="5 3"/>
          <rect x="10" y="70" width="40" height="40" rx="4" stroke="url(#eg2)" stroke-width="2" fill="none" stroke-dasharray="5 3"/>
          <rect x="20" y="20" width="20" height="20" rx="2" fill="url(#eg2)" opacity=".35"/>
          <rect x="80" y="20" width="20" height="20" rx="2" fill="url(#eg2)" opacity=".35"/>
          <rect x="20" y="80" width="20" height="20" rx="2" fill="url(#eg2)" opacity=".35"/>
          <rect x="70" y="70" width="12" height="12" rx="2" fill="url(#eg2)" opacity=".18"/>
          <rect x="86" y="70" width="12" height="12" rx="2" fill="url(#eg2)" opacity=".13"/>
          <rect x="70" y="86" width="12" height="12" rx="2" fill="url(#eg2)" opacity=".13"/>
          <rect x="86" y="86" width="12" height="12" rx="2" fill="url(#eg2)" opacity=".18"/>
        </svg>
        <p class="qr-empty__label">Configure options and hit <strong>Generate QR Code</strong></p>
      </div>`;
  }
}

export function getCurrentSvg() { return _currentSvg; }

// ── Status bar ────────────────────────────────────────────────────────────────

export function setStatus(text, state = 'idle') {
  const dot  = el('status-dot');
  const span = el('status-text');
  if (dot)  dot.dataset.state  = state;
  if (span) span.textContent   = text;
}

// ── Action buttons ────────────────────────────────────────────────────────────

export function enableActions(enabled) {
  const copy     = el('btn-copy');
  const download = el('btn-download');
  const fmtToggle = el('btn-fmt-toggle');
  if (copy)     copy.disabled     = !enabled;
  if (download) download.disabled = !enabled;
  if (fmtToggle) fmtToggle.disabled = !enabled;
}

// ── Format menu ───────────────────────────────────────────────────────────────

export function initFormatMenu(onFormatChange) {
  const toggle  = el('btn-fmt-toggle');
  const menu    = el('fmt-menu');
  if (!toggle || !menu) return;

  toggle.addEventListener('click', e => {
    e.stopPropagation();
    const open = !menu.hidden;
    menu.hidden = open;
    toggle.setAttribute('aria-expanded', String(!open));
  });

  menu.addEventListener('click', e => {
    const opt = e.target.closest('.fmt-option');
    if (!opt) return;
    menu.querySelectorAll('.fmt-option').forEach(o => o.classList.remove('is-active'));
    opt.classList.add('is-active');
    closeFormatMenu();
    onFormatChange?.(opt.dataset.fmt);
  });
}

function closeFormatMenu() {
  const menu   = el('fmt-menu');
  const toggle = el('btn-fmt-toggle');
  if (menu)   menu.hidden = true;
  if (toggle) toggle.setAttribute('aria-expanded', 'false');
        }
