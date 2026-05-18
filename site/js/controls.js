/**
 * controls.js
 * Manages all option controls: tabs, type selectors, style pickers,
 * color pickers, toggles, range sliders, logo upload.
 *
 * Exports:
 *   initControls(onChange)  — wire up everything; calls onChange() on any change
 *   getData()               — return the current encoded data string
 *   getOptions()            — return the full GenerateOptions object
 */

// ── SVG path helpers (mirrors Rust generate.rs) ───────────────────────────────

function sqPath(x, y, w, h) {
  return `M${f(x)} ${f(y)}H${f(x+w)}V${f(y+h)}H${f(x)}Z `;
}

function circlePath(cx, cy, r) {
  return `M${f(cx-r)} ${f(cy)}a${f(r)} ${f(r)} 0 1 0 ${f(2*r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2*r)} 0Z `;
}

function rrPath(x, y, w, h, r) {
  r = Math.min(r, w/2 - 0.01, h/2 - 0.01);
  return `M${f(x+r)} ${f(y)}h${f(w-2*r)}a${f(r)} ${f(r)} 0 0 1 ${f(r)} ${f(r)}v${f(h-2*r)}a${f(r)} ${f(r)} 0 0 1 ${f(-r)} ${f(r)}h${f(-w+2*r)}a${f(r)} ${f(r)} 0 0 1 ${f(-r)} ${f(-r)}v${f(-h+2*r)}a${f(r)} ${f(r)} 0 0 1 ${f(r)} ${f(-r)}Z `;
}

function f(n) { return +n.toFixed(3); }

// ── Preview SVG generators ────────────────────────────────────────────────────

const PATTERN = [
  [1,1,1,0],[1,0,1,1],[0,1,0,1],[1,0,1,1],
];

function moduleShapeD(x, y, m, style) {
  const r35 = m * 0.35, r45 = m * 0.45, r25 = m * 0.25, r32 = m * 0.32;
  switch (style) {
    case 'dot':           return circlePath(x + m/2, y + m/2, m * 0.42);
    case 'rounded':       return rrPath(x, y, m, m, r25);
    case 'extra-rounded': return rrPath(x, y, m, m, r45);
    case 'classy':
      return `M${f(x)} ${f(y)}H${f(x+m-r35)}a${f(r35)} ${f(r35)} 0 0 1 ${f(r35)} ${f(r35)}V${f(y+m)}H${f(x+r35)}a${f(r35)} ${f(r35)} 0 0 1 ${f(-r35)} ${f(-r35)}Z `;
    case 'classy-rounded': return rrPath(x, y, m, m, r32);
    default:               return sqPath(x, y, m, m);
  }
}

function modulePreviewSVG(style) {
  const S = 48, m = 9, g = 2.5, pad = 2.5;
  let d = '';
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      if (!PATTERN[r][c]) continue;
      d += moduleShapeD(pad + c*(m+g), pad + r*(m+g), m, style);
    }
  }
  return svg48(d);
}

function cornerSqPreviewSVG(style) {
  const S = 48, ms = 5.2, ox = 2.4, oy = 2.4;
  const o7 = 7*ms, i5 = 5*ms, cx = ox+3.5*ms, cy = oy+3.5*ms;
  let d;
  if (style === 'extra-rounded') {
    d = rrPath(ox, oy, o7, o7, ms*1.4) + rrPath(ox+ms, oy+ms, i5, i5, ms*0.8);
  } else if (style === 'dot') {
    d = circlePath(cx, cy, 3.5*ms) + circlePath(cx, cy, 2.5*ms);
  } else {
    d = sqPath(ox,oy,o7,o7) + sqPath(ox+ms,oy+ms,i5,i5);
  }
  const dot = `<rect x="${f(ox+2*ms)}" y="${f(oy+2*ms)}" width="${f(3*ms)}" height="${f(3*ms)}"/>`;
  return `<svg viewBox="0 0 ${S} ${S}" xmlns="http://www.w3.org/2000/svg" fill="currentColor"><path d="${d}" fill-rule="evenodd"/>${dot}</svg>`;
}

function cornerDotPreviewSVG(style) {
  const S = 48, ms = 5.5, ox = 2, oy = 2;
  const o7 = 7*ms, cx = ox+3.5*ms, cy = oy+3.5*ms;
  const ring = sqPath(ox,oy,o7,o7) + sqPath(ox+ms,oy+ms,5*ms,5*ms);
  const dot  = style === 'dot'
    ? circlePath(cx, cy, 1.5*ms)
    : sqPath(ox+2*ms, oy+2*ms, 3*ms, 3*ms);
  return `<svg viewBox="0 0 ${S} ${S}" xmlns="http://www.w3.org/2000/svg" fill="currentColor"><path d="${ring}" fill-rule="evenodd"/><path d="${dot}"/></svg>`;
}

function framePreviewSVG(style) {
  const S = 54;
  const fills = {
    bg:  'fill="currentColor" fill-opacity=".18"',
    qr:  'fill="currentColor" fill-opacity=".07"',
    bdg: 'fill="currentColor" fill-opacity=".5"',
  };
  switch (style) {
    case 0:
      return `<svg viewBox="0 0 ${S} ${S}" xmlns="http://www.w3.org/2000/svg" fill="none"><rect x="11" y="8" width="32" height="32" rx="3" stroke="currentColor" stroke-opacity=".25" stroke-width="1.5" stroke-dasharray="4 2.5"/><text x="27" y="51" text-anchor="middle" font-size="7.5" font-family="Inter,sans-serif" fill="currentColor" fill-opacity=".35" letter-spacing=".5">NONE</text></svg>`;
    case 1:
      return `<svg viewBox="0 0 ${S} ${S}" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="1" width="52" height="52" rx="2" ${fills.bg}/><rect x="7" y="5" width="40" height="34" rx="2" ${fills.qr}/></svg>`;
    case 2:
      return `<svg viewBox="0 0 ${S} ${S}" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="1" width="52" height="52" rx="10" ${fills.bg}/><rect x="7" y="5" width="40" height="34" rx="7" ${fills.qr}/></svg>`;
    case 3:
      return `<svg viewBox="0 0 ${S} ${S}" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="1" width="52" height="52" rx="2" ${fills.bg}/><rect x="7" y="16" width="40" height="34" rx="2" ${fills.qr}/></svg>`;
    case 4:
      return `<svg viewBox="0 0 ${S} ${S}" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="1" width="52" height="52" rx="10" ${fills.bg}/><rect x="7" y="16" width="40" height="34" rx="7" ${fills.qr}/></svg>`;
    case 5:
      return `<svg viewBox="0 0 ${S} ${S}" xmlns="http://www.w3.org/2000/svg"><rect x="4" y="4" width="46" height="32" fill="none" stroke="currentColor" stroke-opacity=".4" stroke-width="2"/><rect x="5" y="5" width="44" height="30" ${fills.qr}/><rect x="11" y="40" width="32" height="11" rx="5.5" ${fills.bdg}/></svg>`;
    case 6:
      return `<svg viewBox="0 0 ${S} ${S}" xmlns="http://www.w3.org/2000/svg"><rect x="4" y="4" width="46" height="32" rx="7" fill="none" stroke="currentColor" stroke-opacity=".4" stroke-width="2"/><rect x="5" y="5" width="44" height="30" rx="6" ${fills.qr}/><rect x="11" y="40" width="32" height="11" rx="5.5" ${fills.bdg}/></svg>`;
    case 7:
      return `<svg viewBox="0 0 ${S} ${S}" xmlns="http://www.w3.org/2000/svg" fill="none"><rect x="3" y="3" width="48" height="48" stroke="currentColor" stroke-opacity=".45" stroke-width="4"/></svg>`;
    case 8:
      return `<svg viewBox="0 0 ${S} ${S}" xmlns="http://www.w3.org/2000/svg" fill="none"><rect x="2" y="2" width="50" height="50" stroke="currentColor" stroke-opacity=".4" stroke-width="2"/><rect x="7" y="7" width="40" height="40" stroke="currentColor" stroke-opacity=".25" stroke-width="1.5"/></svg>`;
    default:
      return `<svg viewBox="0 0 ${S} ${S}" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="1" width="52" height="52" ${fills.bg}/></svg>`;
  }
}

function svg48(pathD) {
  return `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" fill="currentColor"><path d="${pathD}"/></svg>`;
}

// ── Style picker definitions ───────────────────────────────────────────────────

const MODULE_STYLES = [
  { value: 'square',         label: 'Square' },
  { value: 'dot',            label: 'Dot' },
  { value: 'rounded',        label: 'Rounded' },
  { value: 'extra-rounded',  label: 'Extra Round' },
  { value: 'classy',         label: 'Classy' },
  { value: 'classy-rounded', label: 'Soft' },
];

const CORNER_SQ_STYLES = [
  { value: 'square',        label: 'Square' },
  { value: 'extra-rounded', label: 'Rounded' },
  { value: 'dot',           label: 'Circle' },
];

const CORNER_DOT_STYLES = [
  { value: 'square', label: 'Square' },
  { value: 'dot',    label: 'Circle' },
];

const FRAME_STYLES = [
  { value: 0, label: 'None' },
  { value: 1, label: 'Solid Below' },
  { value: 2, label: 'Round Below' },
  { value: 3, label: 'Solid Above' },
  { value: 4, label: 'Round Above' },
  { value: 5, label: 'Badge' },
  { value: 6, label: 'Round Badge' },
  { value: 7, label: 'Thick Border' },
  { value: 8, label: 'Double Border' },
];

// ── Internal state ────────────────────────────────────────────────────────────

let _logoDataUri = null;
let _logoFilename = '';

// ── Populate grids ────────────────────────────────────────────────────────────

function buildStyleGrid(containerId, defs, previewFn, activeValue) {
  const grid = document.getElementById(containerId);
  if (!grid) return;
  grid.innerHTML = '';

  for (const def of defs) {
    const btn = document.createElement('button');
    btn.className = 'style-card' + (String(def.value) === String(activeValue) ? ' is-active' : '');
    btn.dataset.value = def.value;
    btn.setAttribute('aria-pressed', String(def.value) === String(activeValue));
    btn.setAttribute('aria-label', def.label);

    const preview = document.createElement('div');
    preview.className = 'style-card__preview';
    preview.innerHTML = previewFn(def.value);

    const label = document.createElement('span');
    label.className = 'style-card__label';
    label.textContent = def.label;

    btn.appendChild(preview);
    btn.appendChild(label);
    grid.appendChild(btn);
  }

  grid.addEventListener('click', e => {
    const card = e.target.closest('.style-card');
    if (!card) return;
    grid.querySelectorAll('.style-card').forEach(c => {
      c.classList.remove('is-active');
      c.setAttribute('aria-pressed', 'false');
    });
    card.classList.add('is-active');
    card.setAttribute('aria-pressed', 'true');
  });
}

function buildFrameGrid() {
  const grid = document.getElementById('frame-style-grid');
  if (!grid) return;
  grid.innerHTML = '';

  for (const def of FRAME_STYLES) {
    const btn = document.createElement('button');
    btn.className = 'frame-card' + (def.value === 0 ? ' is-active' : '');
    btn.dataset.value = def.value;
    btn.setAttribute('aria-pressed', def.value === 0 ? 'true' : 'false');
    btn.setAttribute('aria-label', `Frame style: ${def.label}`);

    const preview = document.createElement('div');
    preview.className = 'frame-card__preview';
    preview.innerHTML = framePreviewSVG(def.value);

    const label = document.createElement('span');
    label.className = 'frame-card__label';
    label.textContent = def.label;

    btn.appendChild(preview);
    btn.appendChild(label);
    grid.appendChild(btn);
  }

  grid.addEventListener('click', e => {
    const card = e.target.closest('.frame-card');
    if (!card) return;
    grid.querySelectorAll('.frame-card').forEach(c => {
      c.classList.remove('is-active');
      c.setAttribute('aria-pressed', 'false');
    });
    card.classList.add('is-active');
    card.setAttribute('aria-pressed', 'true');

    const style = parseInt(card.dataset.value, 10);
    const optsSection = document.getElementById('frame-opts-section');
    const textBlock   = document.getElementById('frame-text-block');
    optsSection.classList.toggle('is-open', style !== 0);
    if (textBlock) textBlock.style.display = (style === 7 || style === 8) ? 'none' : '';
  });
}

// ── Range slider fill ─────────────────────────────────────────────────────────

function syncRangeFill(input) {
  const min = parseFloat(input.min) || 0;
  const max = parseFloat(input.max) || 100;
  const pct = ((parseFloat(input.value) - min) / (max - min)) * 100;
  input.style.background =
    `linear-gradient(to right, #2563eb ${pct}%, rgba(255,255,255,0.08) ${pct}%)`;
}

// ── Color picker + hex input sync ─────────────────────────────────────────────

function bindColorPair(swatchId, hexId) {
  const swatch = document.getElementById(swatchId);
  const hex    = document.getElementById(hexId);
  if (!swatch || !hex) return;

  swatch.addEventListener('input', () => {
    if (hex) hex.value = swatch.value.toUpperCase();
  });

  if (hex) {
    hex.addEventListener('input', () => {
      const v = hex.value.trim();
      if (/^#[0-9a-fA-F]{6}$/.test(v)) swatch.value = v;
    });
    hex.addEventListener('blur', () => {
      hex.value = swatch.value.toUpperCase();
    });
  }
}

// ── Toggle + collapsible ──────────────────────────────────────────────────────

function bindToggle(checkboxId, sectionId) {
  const cb  = document.getElementById(checkboxId);
  const sec = document.getElementById(sectionId);
  if (!cb || !sec) return;

  const sync = () => sec.classList.toggle('is-open', cb.checked);
  cb.addEventListener('change', sync);
  sync();
}

// ── Tabs ──────────────────────────────────────────────────────────────────────

function initTabs() {
  const nav   = document.querySelector('.tab-nav');
  const panels = document.querySelectorAll('.tab-panel');
  if (!nav) return;

  nav.addEventListener('click', e => {
    const btn = e.target.closest('.tab-btn');
    if (!btn) return;

    nav.querySelectorAll('.tab-btn').forEach(b => {
      b.classList.remove('is-active');
      b.setAttribute('aria-selected', 'false');
    });
    panels.forEach(p => p.classList.remove('is-active'));

    btn.classList.add('is-active');
    btn.setAttribute('aria-selected', 'true');
    const target = document.getElementById(btn.getAttribute('aria-controls'));
    if (target) target.classList.add('is-active');
  });
}

// ── Content type ──────────────────────────────────────────────────────────────

function initContentType() {
  const grid = document.querySelector('.type-grid');
  if (!grid) return;

  const allFields = ['url','text','wifi','email','phone','sms'];

  grid.addEventListener('click', e => {
    const btn = e.target.closest('.type-btn');
    if (!btn) return;
    const type = btn.dataset.type;

    grid.querySelectorAll('.type-btn').forEach(b => b.classList.remove('is-active'));
    btn.classList.add('is-active');

    allFields.forEach(f => {
      const el = document.getElementById(`fields-${f}`);
      if (el) el.classList.toggle('is-hidden', f !== type);
    });
  });
}

// ── Pill groups ───────────────────────────────────────────────────────────────

function initPillGroups() {
  document.querySelectorAll('.pill-group').forEach(group => {
    group.addEventListener('click', e => {
      const pill = e.target.closest('.pill');
      if (!pill) return;
      const g = pill.dataset.group;
      group.querySelectorAll(`.pill[data-group="${g}"]`).forEach(p =>
        p.classList.remove('is-active')
      );
      pill.classList.add('is-active');
    });
  });
}

// ── Logo upload ───────────────────────────────────────────────────────────────

function initLogoUpload() {
  const zone    = document.getElementById('upload-zone');
  const input   = document.getElementById('logo-file');
  const opts    = document.getElementById('logo-opts');
  const thumb   = document.getElementById('logo-thumb');
  const fname   = document.getElementById('logo-filename');
  const removeBtn = document.getElementById('logo-remove');

  if (!zone || !input) return;

  function loadFile(file) {
    if (!file || !file.type.startsWith('image/')) return;
    if (file.size > 1_048_576) {
      alert('Logo file must be smaller than 1 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = e => {
      _logoDataUri = e.target.result;
      _logoFilename = file.name;
      if (thumb) thumb.src = _logoDataUri;
      if (fname) fname.textContent = file.name;
      if (zone) zone.classList.add('is-hidden');
      if (opts) opts.classList.remove('is-hidden');
    };
    reader.readAsDataURL(file);
  }

  input.addEventListener('change', () => loadFile(input.files[0]));

  zone.addEventListener('dragover',  e => { e.preventDefault(); zone.classList.add('is-dragover'); });
  zone.addEventListener('dragleave', ()  => zone.classList.remove('is-dragover'));
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('is-dragover');
    loadFile(e.dataTransfer.files[0]);
  });

  if (removeBtn) {
    removeBtn.addEventListener('click', () => {
      _logoDataUri = null;
      _logoFilename = '';
      input.value = '';
      if (thumb) thumb.src = '';
      if (opts)  opts.classList.add('is-hidden');
      if (zone)  zone.classList.remove('is-hidden');
    });
  }

  // Range display
  const logoRange = document.getElementById('logo-size');
  const logoDisp  = document.getElementById('logo-size-display');
  if (logoRange && logoDisp) {
    logoRange.addEventListener('input', () => {
      logoDisp.textContent = logoRange.value;
      syncRangeFill(logoRange);
    });
    syncRangeFill(logoRange);
  }

  bindToggle('logo-border-enabled', 'logo-border-section');
}

// ── Main init ─────────────────────────────────────────────────────────────────

/**
 * Wire up all controls.
 * @param {() => void} onChange — called whenever any option changes
 */
export function initControls(onChange) {
  initTabs();
  initContentType();
  initPillGroups();

  // Style grids
  buildStyleGrid('module-style-grid', MODULE_STYLES,    modulePreviewSVG,   'square');
  buildStyleGrid('corner-sq-grid',    CORNER_SQ_STYLES, cornerSqPreviewSVG, 'square');
  buildStyleGrid('corner-dot-grid',   CORNER_DOT_STYLES, cornerDotPreviewSVG, 'square');
  buildFrameGrid();

  // Color pairs
  bindColorPair('color-dark',       'color-dark-hex');
  bindColorPair('color-light',      'color-light-hex');
  bindColorPair('grad-c1',          'grad-c1-hex');
  bindColorPair('grad-c2',          'grad-c2-hex');
  bindColorPair('eye-outer',        'eye-outer-hex');
  bindColorPair('eye-inner',        'eye-inner-hex');
  bindColorPair('frame-color',      'frame-color-hex');

  // Toggle + collapsibles
  bindToggle('grad-enabled',       'grad-section');
  bindToggle('eye-color-enabled',  'eye-color-section');

  // Range sliders
  const sizeRange = document.getElementById('input-size');
  const sizeDisp  = document.getElementById('size-display');
  if (sizeRange) {
    sizeRange.addEventListener('input', () => {
      if (sizeDisp) sizeDisp.textContent = sizeRange.value;
      syncRangeFill(sizeRange);
    });
    syncRangeFill(sizeRange);
  }

  // Logo
  initLogoUpload();

  // onChange delegation — listen on the whole workspace
  if (typeof onChange === 'function') {
    document.getElementById('workspace')?.addEventListener('change', onChange);
    document.getElementById('workspace')?.addEventListener('click',  onChange);
  }
}

// ── Read helpers ──────────────────────────────────────────────────────────────

function getActivePill(group) {
  return document.querySelector(`.pill.is-active[data-group="${group}"]`)?.dataset.value ?? null;
}

function getActiveCard(gridId) {
  return document.querySelector(`#${gridId} .style-card.is-active`)?.dataset.value ?? null;
}

function getActiveFrame() {
  const card = document.querySelector('#frame-style-grid .frame-card.is-active');
  return card ? parseInt(card.dataset.value, 10) : 0;
}

function getActiveContentType() {
  return document.querySelector('.type-btn.is-active')?.dataset.type ?? 'url';
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Build the encoded data string from the current form values. */
export function getData() {
  const type = getActiveContentType();
  const g    = id => document.getElementById(id)?.value ?? '';

  switch (type) {
    case 'url':   return g('input-url').trim() || 'https://example.com';
    case 'text':  return g('input-text').trim() || 'Hello World';
    case 'wifi':  {
      const ssid = g('input-wifi-ssid');
      const pass = g('input-wifi-pass');
      const enc  = g('input-wifi-enc');
      return `WIFI:T:${enc};S:${ssid};P:${pass};;`;
    }
    case 'email': {
      const to   = g('input-email-to');
      const subj = encodeURIComponent(g('input-email-subject'));
      const body = encodeURIComponent(g('input-email-body'));
      return `mailto:${to}?subject=${subj}&body=${body}`;
    }
    case 'phone': return `tel:${g('input-phone')}`;
    case 'sms':   {
      const to   = g('input-sms-to');
      const body = encodeURIComponent(g('input-sms-body'));
      return `sms:${to}?body=${body}`;
    }
    default: return g('input-url').trim();
  }
}

/** Collect the full options object from all controls. */
export function getOptions() {
  const g = id => document.getElementById(id);

  const gradEnabled = g('grad-enabled')?.checked;
  const eyeEnabled  = g('eye-color-enabled')?.checked;
  const frameStyle  = getActiveFrame();

  return {
    size:              parseInt(g('input-size')?.value ?? 400, 10),
    errorLevel:        getActivePill('ec') ?? 'M',
    darkColor:         g('color-dark')?.value  ?? '#000000',
    lightColor:        g('color-light')?.value ?? '#ffffff',
    moduleStyle:       getActiveCard('module-style-grid') ?? 'square',
    cornerSquareStyle: getActiveCard('corner-sq-grid')    ?? 'square',
    cornerDotStyle:    getActiveCard('corner-dot-grid')   ?? 'square',
    margin: true,

    gradient: gradEnabled ? {
      direction: getActivePill('grad-dir') ?? 'linear-x',
      color1:    g('grad-c1')?.value ?? '#e63946',
      color2:    g('grad-c2')?.value ?? '#2563eb',
    } : undefined,

    eyeColor: eyeEnabled ? {
      outer: g('eye-outer')?.value ?? '#e63946',
      inner: g('eye-inner')?.value ?? '#2563eb',
    } : undefined,

    frame: frameStyle !== 0 ? {
      style:     frameStyle,
      color:     g('frame-color')?.value ?? '#1a1a2e',
      text:      g('frame-text')?.value  ?? 'Scan Me!',
      textColor: g('frame-text-color')?.value ?? '#ffffff',
    } : undefined,

    logo: _logoDataUri ? {
      url:        _logoDataUri,
      sizeRatio:  parseFloat(g('logo-size')?.value ?? 25) / 100,
      border:     g('logo-border-enabled')?.checked ? {
        color:  g('logo-border-color')?.value ?? '#ffffff',
        width:  3,
        radius: 4,
      } : undefined,
    } : undefined,
  };
}
