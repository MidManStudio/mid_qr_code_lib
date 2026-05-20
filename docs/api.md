# mid-qr API Reference

Complete API catalog for the `mid-qr` npm package (`MidQr`, `MidQrGenerator`, `MidQrScanner`) and the `MidManStudio.MidQr.Blazor` NuGet package.

---

## Table of Contents

1. [JavaScript / TypeScript API](#javascript--typescript-api)
   - [MidQr (combined facade)](#midqr-combined-facade)
   - [MidQrGenerator (generation + static decode)](#midqrgenerator)
   - [MidQrScanner (camera scanning)](#midqrscanner)
   - [GenerateOptions](#generateoptions)
   - [Style option types](#style-option-types)
   - [GradientOptions](#gradientoptions)
   - [LogoOptions](#logooptions)
   - [FrameOptions](#frameoptions)
   - [EyeColorOptions](#eyecoloroptions)
   - [ScannerOptions](#scanneroptions)
   - [ScanResult](#scanresult)
   - [MidQrCapabilities](#midqrcapabilities)
   - [MidQrStatus](#midqrstatus)
2. [Blazor / .NET API](#blazor--net-api)
   - [MidQrCode component](#midqrcode-component)
   - [MidQrScanner component](#midqrscanner-component-blazor)
   - [MidQrGenerateOptions](#midqrgenerateoptions-net)
   - [MidQrData types](#midqrdata-types)
   - [IMidQrIconProvider](#imidqriconprovider)
   - [ServiceCollectionExtensions](#servicecollectionextensions)
3. [WASM exports (Rust surface)](#wasm-exports)
4. [Locked payload protocol](#locked-payload-protocol)

---

## JavaScript / TypeScript API

### Installation

```bash
npm install mid-qr
```

```html
<!-- REQUIRED: UMD bundle loaded before any module script -->
<script src="path/to/qr-scanner.umd.min.js"></script>
```

---

### MidQr (combined facade)

The recommended entry point. Provides generation, static decode, and camera scanning through a single object.

#### `MidQr.create(wasmUrl?): Promise<MidQr>`

Initialise the WASM module. Must be awaited once before any other call. Safe to call multiple times — returns the cached instance.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `wasmUrl` | `string \| URL` | No | Explicit path to `mid_qr_wasm_bg.wasm`. Required for GitHub Pages / CDN deployments. |

```ts
// GitHub Pages / CDN — explicit URL required
const qr = await MidQr.create(new URL('/wasm/mid_qr_wasm_bg.wasm', location.origin));

// Local dev — path inferred from import.meta.url
const qr = await MidQr.create();
```

---

#### `qr.generate(options): string`

Generate a QR code and return an SVG string. All style fields are optional.

```ts
const svg = qr.generate({
  data:              'https://example.com',
  size:              320,
  errorLevel:        'H',
  darkColor:         '#000000',
  lightColor:        '#ffffff',
  moduleStyle:       'dot',
  cornerSquareStyle: 'extra-rounded',
  cornerDotStyle:    'dot',
  eyeColor:          { outer: '#e63946', inner: '#2563eb' },
  gradient:          { direction: 'diagonal', color1: '#e63946', color2: '#2563eb' },
  logo:              { url: '/logo.svg', sizeRatio: 0.25 },
  frame:             { style: 2, color: '#1a1a2e', text: 'Scan Me!', textColor: '#fff' },
});
document.getElementById('qr').innerHTML = svg;
```

See [GenerateOptions](#generateoptions) for all fields.

---

#### `qr.generateSimple(data, size?, darkColor?, lightColor?): string`

Convenience wrapper — no options object.

| Parameter | Type | Default |
|---|---|---|
| `data` | `string` | required |
| `size` | `number` | `300` |
| `darkColor` | `string` | `'#000000'` |
| `lightColor` | `string` | `'#FFFFFF'` |

---

#### `qr.decode(source): Promise<string>`

Decode a QR code from a still image using the nimiq scanner.

**Accepted source types:** `File` | `Blob` | `URL` | `string` (URL) | `HTMLImageElement` | `HTMLCanvasElement` | `SVGImageElement` | `OffscreenCanvas` | `ImageBitmap` | `HTMLVideoElement`

> Requires `qr-scanner.umd.min.js` loaded via `<script>` tag before any `<script type="module">`.

```ts
const text = await qr.decode(fileInput.files[0]);
```

---

#### `qr.createScanner(video, onDecode, options?, onError?): Promise<MidQrScanner>`

Create a real-time camera scanner. Returns a `MidQrScanner` instance.

| Parameter | Type | Description |
|---|---|---|
| `video` | `HTMLVideoElement` | The `<video>` element to stream into |
| `onDecode` | `(result: ScanResult) => void` | Called on each successful decode |
| `options` | `ScannerOptions` | Optional scanner configuration |
| `onError` | `(err: Error \| string) => void` | Silent by default |

---

#### `MidQr.hasCamera(): Promise<boolean>`

Static. Returns `true` if at least one camera device is available.

#### `MidQr.listCameras(): Promise<CameraInfo[]>`

Static. Lists all available camera devices. Requests permission labels if not yet granted.

---

#### `qr.getCapabilities(): MidQrCapabilities`

Returns all supported option values as typed arrays. Use to drive UI pickers.

```ts
const caps = qr.getCapabilities();
caps.moduleStyles        // ['square','dot','rounded','extra-rounded','classy','classy-rounded']
caps.cornerSquareStyles  // ['square','extra-rounded','dot']
caps.cornerDotStyles     // ['square','dot']
caps.gradientDirections  // ['linear-x','linear-y','diagonal','radial']
caps.errorLevels         // ['L','M','Q','H']
caps.frameStyles         // [0,1,2,3,4,5,6,7,8]
```

---

#### `qr.version: string`

Version string from the compiled WASM build (e.g. `"0.1.0"`).

#### `qr.status: MidQrStatus`

Diagnostic snapshot — see [MidQrStatus](#midqrstatus).

---

### MidQrGenerator

Generation-only class. Use this when you do not need the camera scanner to keep bundle size minimal.

```ts
import { MidQrGenerator } from 'mid-qr';

const gen = await MidQrGenerator.create(wasmUrl);
const svg = gen.generate({ data: '...', moduleStyle: 'dot' });
```

Exposes the same `generate()`, `generateSimple()`, `decode()`, `getCapabilities()`, and `version` members as `MidQr`.

---

### MidQrScanner

Real-time camera scanner. Returned by `MidQr.createScanner()` or created directly.

```ts
import { MidQrScanner } from 'mid-qr';

const scanner = await MidQrScanner.create(videoEl, onDecode, options, onError);
await scanner.start();
```

#### Methods

| Method | Returns | Description |
|---|---|---|
| `start()` | `Promise<void>` | Start the camera and begin scanning |
| `stop()` | `void` | Pause scanning (stream remains open) |
| `destroy()` | `void` | Stop and release all resources |
| `switchCamera()` | `Promise<void>` | Cycle to the next camera device |
| `setCameraById(deviceId)` | `Promise<void>` | Switch to a specific camera by deviceId |
| `hasFlash()` | `Promise<boolean>` | Whether the active camera has a torch |
| `toggleFlash()` | `Promise<void>` | Toggle torch on/off |

#### Properties

| Property | Type | Description |
|---|---|---|
| `isScanning` | `boolean` | Whether the scanner is currently active |
| `flashOn` | `boolean` | Current torch state |
| `cameras` | `CameraInfo[]` | All enumerated camera devices |
| `currentCamera` | `CameraInfo \| undefined` | The active camera |

#### Static helpers

| Method | Returns | Description |
|---|---|---|
| `MidQrScanner.hasCamera()` | `Promise<boolean>` | Camera availability check |
| `MidQrScanner.listCameras()` | `Promise<CameraInfo[]>` | Enumerate all cameras |

---

### GenerateOptions

All fields are optional except `data`.

| Field | Type | Default | Description |
|---|---|---|---|
| `data` | `string` | **required** | Content to encode |
| `size` | `number` | `300` | Target SVG size in px (rounded up to fit whole modules) |
| `darkColor` | `string` | `'#000000'` | CSS color for dark modules |
| `lightColor` | `string` | `'#FFFFFF'` | CSS color for background |
| `errorLevel` | `ErrorLevel` | `'M'` | Error correction level. Use `'H'` with logos or locked mode |
| `margin` | `boolean` | `true` | Include the quiet zone |
| `moduleStyle` | `ModuleStyle` | `'square'` | Shape of every data module |
| `cornerSquareStyle` | `CornerSquareStyle` | `'square'` | Outer ring of each finder-pattern eye |
| `cornerDotStyle` | `CornerDotStyle` | `'square'` | Inner dot of each finder-pattern eye |
| `eyeColor` | `EyeColorOptions` | — | Independent colors for eye outer ring and inner dot |
| `gradient` | `GradientOptions` | — | Gradient fill for dark modules |
| `logo` | `LogoOptions` | — | Logo embedded at the centre |
| `frame` | `FrameOptions` | — | Decorative frame around the QR code |

---

### Style option types

#### `ErrorLevel`

```ts
type ErrorLevel = 'L' | 'M' | 'Q' | 'H';
```

| Value | Recovery capacity | Notes |
|---|---|---|
| `'L'` | 7% | Smallest QR codes |
| `'M'` | 15% | Default |
| `'Q'` | 25% | Good for logos |
| `'H'` | 30% | Required for logos and locked mode |

---

#### `ModuleStyle`

Shape applied to every data module.

```ts
type ModuleStyle = 'square' | 'dot' | 'rounded' | 'extra-rounded' | 'classy' | 'classy-rounded';
```

| Value | Description |
|---|---|
| `'square'` | Sharp-corner rectangles (default) |
| `'dot'` | Filled circles (~90% of module size) |
| `'rounded'` | Rectangles with 25% corner radius |
| `'extra-rounded'` | Rectangles with 45% corner radius |
| `'classy'` | Square with top-right + bottom-left corners rounded |
| `'classy-rounded'` | Uniform 32% corner rounding |

---

#### `CornerSquareStyle`

Shape of the outer 7×7 ring of each finder-pattern eye.

```ts
type CornerSquareStyle = 'square' | 'extra-rounded' | 'dot';
```

| Value | Description |
|---|---|
| `'square'` | Sharp rectangle (default) |
| `'extra-rounded'` | Heavily rounded rectangle |
| `'dot'` | Concentric circles |

---

#### `CornerDotStyle`

Shape of the inner 3×3 dot of each finder-pattern eye.

```ts
type CornerDotStyle = 'square' | 'dot';
```

| Value | Description |
|---|---|
| `'square'` | Filled square (default) |
| `'dot'` | Filled circle |

---

#### `GradientDirection`

```ts
type GradientDirection = 'linear-x' | 'linear-y' | 'diagonal' | 'radial';
```

---

### GradientOptions

```ts
interface GradientOptions {
  direction?: GradientDirection; // default: 'linear-x'
  color1: string;                // gradient start — CSS color
  color2: string;                // gradient end   — CSS color
}
```

The gradient applies to all dark modules. Eyes also receive the gradient unless `eyeColor` is set.

---

### LogoOptions

```ts
interface LogoOptions {
  url: string;          // URL or data-URI
  sizeRatio?: number;   // 0.10–0.35, default 0.25
  border?: {
    color: string;
    width?: number;     // default 2
    radius?: number;    // corner radius
  };
}
```

> Always use `errorLevel: 'H'` when embedding a logo.

---

### FrameOptions

Decorative border around the QR code with an optional label.

```ts
interface FrameOptions {
  style: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  color: string;       // frame background / border CSS color
  text?: string;       // label text (default: "Scan Me!")
  textColor?: string;  // label text color (default: "#ffffff")
}
```

| style | Description |
|---|---|
| `0` | No frame (default) |
| `1` | Solid square background — label **below** |
| `2` | Rounded background — label **below** |
| `3` | Solid square background — label **above** |
| `4` | Rounded background — label **above** |
| `5` | Square border + rounded badge tab below |
| `6` | Rounded border + rounded badge tab below |
| `7` | Thick square border only (no label) |
| `8` | Double square border (no label) |

---

### EyeColorOptions

```ts
interface EyeColorOptions {
  outer: string; // outer 7×7 ring CSS color
  inner: string; // inner 3×3 dot CSS color
}
```

When omitted, eyes inherit `darkColor` (or the gradient if one is set).

---

### ScannerOptions

```ts
interface ScannerOptions {
  preferredCamera?: 'environment' | 'user' | string; // default: 'environment'
  maxScansPerSecond?: number;                         // default: 5
  highlightScanRegion?: boolean;                      // default: false
  highlightCodeOutline?: boolean;                     // default: false
}
```

---

### ScanResult

```ts
interface ScanResult {
  data: string;
  cornerPoints: Array<{ x: number; y: number }>;
}
```

---

### MidQrCapabilities

```ts
interface MidQrCapabilities {
  errorLevels:        ErrorLevel[];
  gradientDirections: GradientDirection[];
  moduleStyles:       ModuleStyle[];
  cornerSquareStyles: CornerSquareStyle[];
  cornerDotStyles:    CornerDotStyle[];
  frameStyles:        number[];
}
```

---

### MidQrStatus

```ts
interface MidQrStatus {
  wasmLoaded:            boolean;
  version:               string;
  nativeBarcodeDetector: boolean;
}
```

---

### CameraInfo

```ts
interface CameraInfo {
  id:    string;
  label: string;
}
```

---

## Blazor / .NET API

### Installation

```bash
dotnet add package MidManStudio.MidQr.Blazor
```

`Program.cs`:
```csharp
builder.Services.AddMidQrBlazor();
```

`index.html` / `_Host.cshtml` (before the Blazor framework script):
```html
<script src="_content/MidManStudio.MidQr.Blazor/js/worker/qr-scanner.umd.min.js"></script>
```

---

### MidQrCode component

Renders a QR code SVG inside a styled container.

```razor
<MidQrCode Data="https://example.com"
           Options="@myOptions"
           Theme="MidQrTheme.Gradient"
           OnGenerated="@HandleGenerated"
           OnError="@HandleError"
           LoadingMessage="Building QR…"
           ShowRetryOnError="true"
           CssClass="my-qr"
           Style="max-width:400px">
  <InfoContent>
    <p>Scan this code with any camera app.</p>
  </InfoContent>
</MidQrCode>
```

#### Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `Data` | `string` | **required** | Content to encode |
| `Options` | `MidQrGenerateOptions?` | `null` | Full generation options |
| `Theme` | `MidQrTheme` | `Standard` | Convenience theme preset |
| `OnGenerated` | `EventCallback<MidQrResult>` | — | Fires after each successful generation |
| `OnError` | `EventCallback<string>` | — | Fires on generation failure |
| `CssClass` | `string` | `""` | Additional CSS class on root element |
| `Style` | `string` | `""` | Inline style on root element |
| `LoadingMessage` | `string` | `"Generating QR code…"` | Overlay loading text |
| `ShowRetryOnError` | `bool` | `true` | Show Retry button on error |
| `InfoContent` | `RenderFragment?` | `null` | Slot rendered below the QR code |

#### Public methods

| Method | Description |
|---|---|
| `RefreshAsync()` | Force immediate regeneration |

#### Public properties

| Property | Type | Description |
|---|---|---|
| `IsLocked` | `bool` | Whether locked mode is active via `Options.Locked` |

---

### MidQrScanner component (Blazor)

Real-time camera scanner with built-in controls.

```razor
<MidQrScanner OnQrCodeDetected="@HandleScan"
              LockedMode="true"
              PreferredCamera="environment"
              MaxScansPerSecond="5"
              Width="100%"
              Height="400px"
              AutoStopOnSuccess="true"
              ShowControls="true"
              ShowOverlay="true"
              ShowCameraSwitch="true">
  <ResultContent Context="result">
    <p>Decoded: @result.Data</p>
  </ResultContent>
</MidQrScanner>
```

#### Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `OnQrCodeDetected` | `EventCallback<MidQrScanResult>` | — | Fires on every successful decode |
| `OnExternalScan` | `EventCallback<string>` | — | Fires when a non-locked QR is rejected in locked mode |
| `LockedMode` | `bool` | `false` | Only accept locked mid-qr payloads |
| `PreferredCamera` | `string` | `"environment"` | `"environment"`, `"user"`, or a deviceId |
| `MaxScansPerSecond` | `int` | `5` | Decode rate |
| `Width` | `string` | `"100%"` | CSS width |
| `Height` | `string` | `"400px"` | CSS height |
| `AutoStopOnSuccess` | `bool` | `true` | Stop scanning after first successful decode |
| `AutoStopDelayMs` | `int` | `800` | Delay before auto-stop (ms) |
| `ShowControls` | `bool` | `true` | Show the start/stop/switch button bar |
| `ShowOverlay` | `bool` | `true` | Show the animated corner-frame overlay |
| `ShowCameraSwitch` | `bool` | `true` | Show the camera-switch button |
| `StartLabel` | `string` | `"Start Scanner"` | Start button label |
| `StopLabel` | `string` | `"Stop Scanner"` | Stop button label |
| `CameraSwitchLabel` | `string` | `"Switch Camera"` | Switch button label |
| `ProcessingMessage` | `string` | `"Processing…"` | Processing overlay text |
| `ResultContent` | `RenderFragment<MidQrScanResult>?` | `null` | Slot shown after each scan |
| `ControlsContent` | `RenderFragment?` | `null` | Additional controls slot |

#### Public methods

| Method | Description |
|---|---|
| `StartScanningAsync()` | Start the camera and scanner |
| `StopScanningAsync()` | Stop and release the camera |
| `SwitchCameraAsync()` | Cycle to the next camera |
| `ShowStatusAsync(message, type, durationMs)` | Show a status message programmatically |

#### Public properties

| Property | Type | Description |
|---|---|---|
| `IsScanning` | `bool` | Whether the scanner is active |
| `IsProcessing` | `bool` | Whether a decode is in progress |

---

### MidQrGenerateOptions (.NET)

```csharp
var options = new MidQrGenerateOptions
{
    Size       = 300,
    DarkColor  = "#000000",
    LightColor = "#ffffff",
    ErrorLevel = MidQrErrorLevel.H,
    Margin     = true,

    Gradient = new MidQrGradientOptions
    {
        Direction = MidQrGradientDirection.Diagonal,
        Color1    = "#e63946",
        Color2    = "#2563eb",
    },

    Logo = new MidQrLogoOptions
    {
        Url        = "https://example.com/logo.svg",
        SizeRatio  = 0.25f,
        AddBorder  = true,
        BorderColor = "#ffffff",
        BorderWidth = 3,
        BorderRadius = 4,
    },

    Locked = new MidQrLockedOptions
    {
        RedirectUrl = "https://your-app.com/scan-redirect",
    },
};
```

---

### MidQrData types

#### `MidQrErrorLevel` enum
`L | M | Q | H`

#### `MidQrGradientDirection` enum
`LinearX | LinearY | Diagonal | Radial`

#### `MidQrTheme` enum
`Standard | Gradient | Branded | GradientWithLogo`

#### `MidQrResult` class
Passed to `OnGenerated`:

```csharp
public class MidQrResult
{
    public string     Id;          // GUID
    public string     Data;        // original Data parameter value
    public string     SvgContent;  // full SVG string
    public MidQrTheme Theme;
    public DateTime   GeneratedAt;
    public bool       IsLocked;
}
```

#### `MidQrScanResult` class
Passed to `OnQrCodeDetected`:

```csharp
public class MidQrScanResult
{
    public string   Data;       // decoded text (unwrapped if locked)
    public bool     WasLocked;  // whether locked-mode unwrap was applied
    public DateTime ScannedAt;
}
```

---

### IMidQrIconProvider

Implement and register in DI to supply custom SVG icons.

```csharp
public interface IMidQrIconProvider
{
    Task<string> GetLoadingSpinnerSvgAsync();
    Task<string> GetErrorIconSvgAsync();
    Task<string> GetLockedIconSvgAsync();
    Task<string> GetScanOverlaySvgAsync();
}
```

If not registered, `DefaultMidQrIconProvider` is used automatically with built-in inline SVGs.

**Adapter example:**

```csharp
public sealed class MidQrVisualAdapter : IMidQrIconProvider
{
    private readonly IVisualElementsService _vis;
    public MidQrVisualAdapter(IVisualElementsService vis) => _vis = vis;

    public Task<string> GetLoadingSpinnerSvgAsync() => _vis.GetSvgAsync(SvgType.Loading);
    public Task<string> GetErrorIconSvgAsync()      => _vis.GetSvgAsync(SvgType.Warning);
    public Task<string> GetLockedIconSvgAsync()     => _vis.GetSvgAsync(SvgType.Lock);
    public Task<string> GetScanOverlaySvgAsync()    => _vis.GetSvgAsync(SvgType.QrScanOverlay);
}
```

Register:
```csharp
builder.Services.AddMidQrBlazor()
       .AddScoped<IMidQrIconProvider, MidQrVisualAdapter>();
```

---

### ServiceCollectionExtensions

```csharp
// Registers DefaultMidQrIconProvider (TryAdd — won't override your own registration)
builder.Services.AddMidQrBlazor();
```

---

## WASM exports

The Rust WASM surface (`crates/mid-qr-wasm/src/lib.rs`) exports these functions to JavaScript:

| JS name | Rust fn | Description |
|---|---|---|
| `generate(options)` | `generate` | Generate SVG from options object |
| `generateSimple(data, size, dark, light)` | `generate_simple` | Simple SVG generation |
| `decodeRgba(rgba, width, height)` | `decode_rgba_js` | Decode from raw RGBA pixel buffer |
| `decodeLuma(luma, width, height)` | `decode_luma_js` | Decode from luma (greyscale) buffer |
| `rgbaToLuma(rgba)` | `rgba_to_luma_js` | Convert RGBA → luma |
| `getVersion()` | `get_version` | Package version string |
| `getSupportedErrorLevels()` | `get_supported_error_levels` | Comma-separated list |
| `getSupportedGradientDirections()` | — | Comma-separated list |
| `getSupportedModuleStyles()` | — | Comma-separated list |
| `getSupportedCornerSquareStyles()` | — | Comma-separated list |
| `getSupportedCornerDotStyles()` | — | Comma-separated list |
| `getSupportedFrameStyles()` | — | `"index:name"` pairs |

---

## Locked payload protocol

The locked payload feature lets you embed sensitive data in a QR code that is only revealed to an app using the mid-qr scanner. External camera apps see only a redirect URL.

### Encoding

```
QR data = "<redirectUrl>?mid-qr-v1=<base64>"
base64  = btoa(JSON.stringify({ data: "<actual payload>" }))
```

Example:
```ts
const b64 = btoa(unescape(encodeURIComponent(JSON.stringify({ data: 'secret-token' }))));
const qrData = `https://your-app.com/redirect?mid-qr-v1=${b64}`;
```

### Decoding (JavaScript)

```ts
const LOCKED_PREFIX = 'mid-qr-v1=';

function unwrapLocked(raw: string): { payload: string; wasLocked: boolean } {
  const idx = raw.indexOf(LOCKED_PREFIX);
  if (idx < 0) return { payload: raw, wasLocked: false };
  try {
    let b64 = raw.slice(idx + LOCKED_PREFIX.length).split('&')[0].split('#')[0];
    const payload = JSON.parse(decodeURIComponent(escape(atob(b64)))).data ?? raw;
    return { payload, wasLocked: true };
  } catch {
    return { payload: raw, wasLocked: false };
  }
}
```

### Decoding (C#)

```csharp
private static (string payload, bool wasLocked) UnwrapLockedPayload(string raw)
{
    const string prefix = "mid-qr-v1=";
    int idx = raw.IndexOf(prefix, StringComparison.Ordinal);
    if (idx < 0) return (raw, false);

    var b64 = raw[(idx + prefix.Length)..];
    var amp = b64.IndexOf('&'); if (amp >= 0) b64 = b64[..amp];
    var hsh = b64.IndexOf('#'); if (hsh >= 0) b64 = b64[..hsh];

    var json    = Encoding.UTF8.GetString(Convert.FromBase64String(b64));
    var payload = JsonDocument.Parse(json).RootElement.GetProperty("data").GetString() ?? raw;
    return (payload, true);
}
```

### Locked mode rules

- Always use `errorLevel: 'H'` — the redirect URL makes the payload significantly longer.
- External cameras open the redirect URL in a browser.
- The mid-qr scanner (JS or Blazor) unwraps the real payload automatically.
- In `LockedMode: true`, the scanner rejects any QR code that does not contain a `mid-qr-v1=` parameter and fires `OnExternalScan` instead.
