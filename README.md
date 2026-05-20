# mid-qr

> Unified QR code generation and scanning — Rust/WebAssembly core, JS npm package, Blazor wrapper.

[![npm](https://img.shields.io/npm/v/mid-qr?color=%232563eb&label=npm)](https://www.npmjs.com/package/mid-qr)
[![NuGet](https://img.shields.io/nuget/v/MidManStudio.MidQr.Blazor?color=%237c3aed&label=nuget)](https://www.nuget.org/packages/MidManStudio.MidQr.Blazor/)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![Build](https://img.shields.io/github/actions/workflow/status/MidManStudio/mid-qr/build-wasm.yml?branch=main)](https://github.com/MidManStudio/mid-qr/actions)

**Live demo:** https://midmanstudio.github.io/mid-qr/

---

## What is mid-qr?

mid-qr is a high-quality QR code library built around a **Rust/WASM core**. It exposes a full-featured TypeScript npm package and a Blazor component library, both sharing the same rendering engine. No server required — everything runs in the browser.

### Feature highlights

- **Six module shapes** — square, dot, rounded, extra-rounded, classy, classy-rounded
- **Three finder-eye styles** — per outer ring and inner dot, independently
- **Custom eye colours** — outer ring and inner dot coloured separately from data modules
- **Four gradient modes** — linear-x, linear-y, diagonal, radial
- **Logo embedding** — centred image with optional white border
- **Eight decorative frame styles** — with optional label text above or below
- **Three decode paths** — native BarcodeDetector (Chromium), nimiq worker (all browsers), rxing WASM (still images)
- **Locked payload mode** — hide real data from external scanners; only the mid-qr scanner unwraps it
- **Zero server dependency** — pure client-side WASM

---

## Packages

| Layer | Location | Description |
|---|---|---|
| Core (Rust) | `crates/mid-qr-core` | Pure Rust — SVG generation + static image decode |
| WASM bindings | `crates/mid-qr-wasm` | wasm-bindgen surface, compiled to cdylib |
| npm package | `npm/` | TypeScript wrapper + nimiq camera scanner |
| Blazor wrapper | `wrappers/blazor/` | Razor components + JS interop |

---

## Quick start

### JavaScript / TypeScript

```bash
npm install mid-qr
```

```html
<!-- Required: load the nimiq UMD bundle BEFORE your module script -->
<script src="node_modules/mid-qr/worker/qr-scanner.umd.min.js"></script>
<script type="module" src="your-app.js"></script>
```

```ts
import { MidQr } from 'mid-qr';

// Initialise — pass an explicit WASM URL for CDN/GitHub Pages deployments
const qr = await MidQr.create(new URL('/wasm/mid_qr_wasm_bg.wasm', location.origin));

// Generate a plain QR code
const svg = qr.generate({ data: 'https://example.com', size: 300 });
document.getElementById('qr').innerHTML = svg;
```

### Blazor (.NET 7 / .NET 8)

```bash
dotnet add package MidManStudio.MidQr.Blazor
```

`Program.cs`:
```csharp
builder.Services.AddMidQrBlazor();
```

`index.html` / `_Host.cshtml` (before the Blazor script):
```html
<script src="_content/MidManStudio.MidQr.Blazor/js/worker/qr-scanner.umd.min.js"></script>
```

`YourPage.razor`:
```razor
<MidQrCode Data="https://example.com"
           Options="@(new MidQrGenerateOptions { Size = 300 })"
           OnGenerated="@HandleGenerated" />
```

---

## Styling examples

### Gradient + custom eye colours

```ts
const svg = qr.generate({
  data:              'https://example.com',
  size:              320,
  errorLevel:        'H',
  moduleStyle:       'dot',
  cornerSquareStyle: 'extra-rounded',
  cornerDotStyle:    'dot',
  eyeColor:          { outer: '#e63946', inner: '#2563eb' },
  gradient:          { direction: 'diagonal', color1: '#e63946', color2: '#2563eb' },
});
```

### Logo with frame

```ts
const svg = qr.generate({
  data:       'https://example.com',
  errorLevel: 'H',
  logo:       { url: '/logo.svg', sizeRatio: 0.25, border: { color: '#fff', radius: 4 } },
  frame:      { style: 2, color: '#1a1a2e', text: 'Scan Me!', textColor: '#ffffff' },
});
```

### Locked payload (scanner-restricted QR)

```ts
// External cameras see: https://your-app.com/redirect
// Only the mid-qr scanner reveals: "your-secret-payload"
const svg = qr.generate({
  data:       'https://your-app.com/redirect?mid-qr-v1=<base64payload>',
  errorLevel: 'H',
  size:       300,
});
```

Use `getData()` from controls.js or build the locked URL manually:
```ts
const b64 = btoa(JSON.stringify({ data: 'your-secret-payload' }));
const lockedData = `https://your-app.com/redirect?mid-qr-v1=${b64}`;
```

### Real-time camera scanning

```ts
const scanner = await qr.createScanner(
  videoElement,
  result => console.log('Decoded:', result.data),
  { preferredCamera: 'environment', maxScansPerSecond: 5 }
);
await scanner.start();
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Consumer  (Browser JS / Blazor WASM / Blazor Server)       │
├───────────────────────────┬─────────────────────────────────┤
│  npm/src/generator.ts     │  npm/src/scanner.ts             │
│  (WASM calls, SVG output) │  (camera orchestration)         │
├───────────────────────────┤                                 │
│  crates/mid-qr-wasm       │  nimiq qr-scanner-worker        │
│  (wasm-bindgen bindings)  │  (real-time frame binarizer)    │
├───────────────────────────┤  BarcodeDetector API            │
│  crates/mid-qr-core       │  (native Chromium fallback)     │
│  generate.rs  (qrcode)    │                                 │
│  decode.rs    (rxing)     │  ← still-image decode only      │
└───────────────────────────┴─────────────────────────────────┘
```

### Why three decode paths?

| Path | Used for | Why |
|---|---|---|
| BarcodeDetector API | Camera frames — modern Chromium | Native OS decode, zero JS overhead |
| nimiq worker | Camera frames — non-Chromium | Hand-tuned binarizer for motion blur and uneven lighting |
| rxing WASM | Still images (file upload) | Best accuracy on high-resolution clean images |

---

## Build outputs

| Artefact | Source | Destination |
|---|---|---|
| `mid_qr_wasm_bg.wasm` | `cargo build --target wasm32` | `npm/wasm/` and `wrappers/blazor/wwwroot/wasm/` |
| `dist/index.js` | TypeScript (`npm/src/`) | `npm/dist/` |
| npm package | `npm/dist/` + `npm/wasm/` | npmjs.com |
| NuGet package | `wrappers/blazor/` | nuget.org |

---

## Development

### Prerequisites

- Rust stable + `wasm32-unknown-unknown` target
- wasm-pack
- Node.js 20+
- .NET 8 SDK (for Blazor package only)

### Build

```bash
# 1. Build WASM
wasm-pack build crates/mid-qr-wasm \
  --target web --release \
  --out-dir ../../npm/wasm \
  --out-name mid_qr_wasm

# 2. Build TypeScript
cd npm && npm install && npm run build:ts

# 3. Run Rust tests
cargo test -p mid-qr-core --features generate,decode
```

### CI

| Workflow | Trigger | What it does |
|---|---|---|
| `build-wasm.yml` | Push to main | Build WASM + TS, assemble `dist` branch |
| `pages.yml` | Push to main | Build + deploy GitHub Pages site |
| `publish-npm.yml` | Tag `v*` | Build + publish to npmjs.com |
| `publish-nuget.yml` | Tag `nuget-v*` | Build + publish to nuget.org |

---

## Releasing

### npm

```bash
# 1. Bump npm/package.json version to e.g. 0.2.0
# 2. Commit and tag:
git tag v0.2.0
git push origin v0.2.0
# CI publishes to npm automatically
```

### NuGet

```bash
git tag nuget-v0.2.0
git push origin nuget-v0.2.0
# CI builds the .nupkg and publishes to nuget.org
```

---

## Install from GitHub dist branch (no npm registry required)

```bash
npm install github:MidManStudio/mid-qr#dist
```

---

## License

MIT © MidManStudio
