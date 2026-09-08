/**
 * qr-engine.js
 * Thin wrapper around the mid-qr WASM library.
 *
 * The compiled JS lives at ./mid-qr.js (copied from npm/dist/index.js
 * during the site build step). The WASM binary lives at ../wasm/.
 */

let _qr = null;

// ── Init ──────────────────────────────────────────────────────────────────────

/**
 * Initialise the WASM module. Must be awaited before calling generate().
 * Safe to call multiple times — returns the cached instance after first load.
 */
export async function initEngine() {
  if (_qr) return _qr;

  const wasmUrl = new URL('../wasm/mid_qr_wasm_bg.wasm', import.meta.url);

  const { MidQr } = await import('./mid-qr.js');
  _qr = await MidQr.create(wasmUrl);
  return _qr;
}

// ── Generate ──────────────────────────────────────────────────────────────────

/**
 * Generate a QR code SVG from raw data + a full options object.
 *
 * @param {string} data     — encoded content string
 * @param {object} options  — matches GenerateOptions from npm/src/types.ts
 * @returns {string}        — SVG markup
 */
export function generateQr(data, options) {
  if (!_qr) throw new Error('QR engine not initialised — call initEngine() first');
  if (!data || !data.trim()) throw new Error('Data is empty');
  return _qr.generate({ data, ...options });
}

/**
 * Same as generateQr(), but returns MSX (DixScript source text) instead
 * of SVG. Throws if options.logo is set — MSX v0.1 has no raster/image
 * element yet.
 */
export function generateQrMsx(data, options) {
  if (!_qr) throw new Error('QR engine not initialised — call initEngine() first');
  if (!data || !data.trim()) throw new Error('Data is empty');
  return _qr.generateMsx({ data, ...options });
}

// ── Capabilities ──────────────────────────────────────────────────────────────

export function getCapabilities() {
  if (!_qr) return null;
  return _qr.getCapabilities();
}

export function isReady() {
  return _qr !== null;
}
