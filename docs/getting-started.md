# Getting Started with mid-qr

This guide takes you from installation to a fully styled, camera-scanning QR code app in under 10 minutes.

---

## Prerequisites

- A modern browser (Chrome, Firefox, Safari, Edge)
- Node.js 18+ (for the npm package)
- .NET 7 or .NET 8 (for the Blazor package)

---

## JavaScript / TypeScript

### 1. Install

```bash
npm install @midmanstudio/mid-qr
```

### 2. Set up your HTML

The nimiq QR scanner must be loaded as a UMD script **before** any `<script type="module">`. This is a hard requirement — the UMD bundle sets `window.QrScanner` and resolves the camera worker path relative to its own URL.

```html
<!DOCTYPE html>
<html>
<head>
  <title>My QR App</title>
</head>
<body>
  <div id="qr-output"></div>
  <video id="camera" autoplay muted playsinline></video>

  <!-- 1. nimiq UMD — MUST come first -->
  <script src="node_modules/@midmanstudio/mid-qr/worker/qr-scanner.umd.min.js"></script>

  <!-- 2. Your app module -->
  <script type="module" src="app.js"></script>
</body>
</html>
```

### 3. Initialise

```js
// app.js
import { MidQr } from '@midmanstudio/mid-qr';

// Pass an explicit WASM URL — required for any non-localhost deployment
const wasmUrl = new URL('/node_modules/@midmanstudio/mid-qr/wasm/mid_qr_wasm_bg.wasm', location.origin);
const qr = await MidQr.create(wasmUrl);

console.log('mid-qr ready, version:', qr.version);
```

### 4. Generate your first QR code

```js
const svg = qr.generate({ data: 'https://example.com', size: 300 });
document.getElementById('qr-output').innerHTML = svg;
```

### 5. Add styling

```js
const svg = qr.generate({
  data:              'https://example.com',
  size:              320,
  errorLevel:        'M',
  moduleStyle:       'dot',
  cornerSquareStyle: 'extra-rounded',
  cornerDotStyle:    'dot',
  gradient: {
    direction: 'diagonal',
    color1:    '#e63946',
    color2:    '#2563eb',
  },
});
document.getElementById('qr-output').innerHTML = svg;
```

### 6. Scan with the camera

```js
const video   = document.getElementById('camera');
const scanner = await qr.createScanner(
  video,
  result => {
    console.log('Scanned:', result.data);
    scanner.stop();
  },
  { preferredCamera: 'environment', maxScansPerSecond: 5 }
);

await scanner.start();
```

### 7. Decode a still image

```js
const fileInput = document.getElementById('my-file-input');
fileInput.addEventListener('change', async () => {
  const file = fileInput.files[0];
  try {
    const text = await qr.decode(file);
    console.log('Decoded:', text);
  } catch (err) {
    console.error('No QR code found:', err);
  }
});
```

---

## GitHub Pages / CDN deployment

When serving from a path other than `/`, you must pass the WASM URL explicitly:

```js
// Works on any path, including /my-repo/ or a custom CDN origin
const wasmUrl = new URL('/my-repo/wasm/mid_qr_wasm_bg.wasm', location.origin);
const qr = await MidQr.create(wasmUrl);
```

Copy these files to your server / dist folder:
```
wasm/mid_qr_wasm_bg.wasm
wasm/mid_qr_wasm.js
js/worker/qr-scanner.umd.min.js
js/worker/qr-scanner-worker.min.js
js/mid-qr.js    ← compiled npm dist
```

---

## Blazor

### 1. Install

```bash
dotnet add package MidManStudio.MidQr.Blazor
```

### 2. Register services

`Program.cs`:
```csharp
using MidQr.Blazor;

builder.Services.AddMidQrBlazor();
```

### 3. Add the script tag

In `wwwroot/index.html` (Blazor WASM) or `Pages/_Host.cshtml` (Blazor Server), add this **before** the Blazor framework script:

```html
<script src="_content/MidManStudio.MidQr.Blazor/js/worker/qr-scanner.umd.min.js"></script>
```

### 4. Add the namespace

`_Imports.razor`:
```razor
@using MidQr.Blazor
```

### 5. Generate a QR code

```razor
@page "/generate"

<MidQrCode Data="https://example.com"
           Options="@_opts"
           OnGenerated="@OnDone" />

@code {
    private MidQrGenerateOptions _opts = new()
    {
        Size       = 300,
        ErrorLevel = MidQrErrorLevel.M,
    };

    private void OnDone(MidQrResult result)
    {
        Console.WriteLine($"Generated {result.SvgContent.Length} chars of SVG");
    }
}
```

### 6. Add a gradient

```csharp
private MidQrGenerateOptions _opts = new()
{
    Size       = 320,
    ErrorLevel = MidQrErrorLevel.M,
    Gradient   = new MidQrGradientOptions
    {
        Direction = MidQrGradientDirection.Diagonal,
        Color1    = "#e63946",
        Color2    = "#2563eb",
    },
};
```

### 7. Add a scanner

```razor
@page "/scan"

<MidQrScanner OnQrCodeDetected="@HandleScan"
              PreferredCamera="environment"
              AutoStopOnSuccess="true"
              Height="380px">
  <ResultContent Context="result">
    <p class="scan-result">@result.Data</p>
  </ResultContent>
</MidQrScanner>

@code {
    private void HandleScan(MidQrScanResult result)
    {
        Console.WriteLine($"Scanned: {result.Data} (locked: {result.WasLocked})");
    }
}
```

---

## Locked payload mode

Locked mode lets you embed sensitive data that only the mid-qr scanner reveals. External camera apps get redirected to a page you control.

### JavaScript

```js
// Build the locked data string manually
const payload     = 'your-secret-session-token';
const redirectUrl = 'https://your-app.com/scan-redirect';
const b64         = btoa(unescape(encodeURIComponent(JSON.stringify({ data: payload }))));
const lockedData  = `${redirectUrl}?mid-qr-v1=${b64}`;

const svg = qr.generate({ data: lockedData, errorLevel: 'H', size: 300 });
```

Start a scanner in locked mode:
```js
const scanner = await qr.createScanner(
  video,
  result => {
    // result.data is already unwrapped to 'your-secret-session-token'
    console.log('Locked payload:', result.data);
  },
  { preferredCamera: 'environment' }
);
await scanner.start();
```

### Blazor

```csharp
private MidQrGenerateOptions _opts = new()
{
    ErrorLevel = MidQrErrorLevel.H,
    Locked     = new MidQrLockedOptions
    {
        RedirectUrl = "https://your-app.com/scan-redirect",
    },
};
```

```razor
<MidQrCode Data="your-secret-session-token" Options="@_opts" />

<MidQrScanner LockedMode="true"
              OnQrCodeDetected="@HandleScan"
              OnExternalScan="@HandleRejected" />
```

---

## TypeScript types import

```ts
import type {
  GenerateOptions,
  ModuleStyle,
  CornerSquareStyle,
  CornerDotStyle,
  EyeColorOptions,
  FrameOptions,
  GradientOptions,
  GradientDirection,
  LogoOptions,
  LogoBorderOptions,
  ErrorLevel,
  ScannerOptions,
  ScanResult,
  OnDecodeCallback,
  CameraInfo,
  MidQrStatus,
  MidQrCapabilities,
} from '@midmanstudio/mid-qr';
```

---

## Next steps

- [Full API Reference](API_REFERENCE.md) — every option, method, and type
- [Architecture](docs/architecture.md) — how the three decode paths work
- [Live demo](https://midmanstudio.github.io/mid_qr_code_lib/) — interactive playground
- [GitHub](https://github.com/MidManStudio/mid_qr_code_lib) — source code and issues
