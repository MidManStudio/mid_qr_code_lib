# Changelog

All notable changes to mid-qr are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versions follow [Semantic Versioning](https://semver.org/).

---

## [Unreleased]

### Added
- `MidQrImageHelpers.ToDataUriAsync()` (Blazor) — converts an uploaded `IBrowserFile` into the base64 data-URI that `MidQrLogoOptions.Url` expects, for embedding a logo picked via `<InputFile>`
- Hex text-input twin for the frame label text color picker (`site/index.html`), matching every other color control

### Changed
- **Breaking (pre-release, not yet published):** npm package renamed `mid-qr` → `@midmanstudio/mid-qr`
- Blazor C# namespace changed `MidQr.Blazor` → `MidManStudio.MidQr.Blazor` (assembly name and root namespace now match the existing NuGet `PackageId`)
- All GitHub URLs across the repo (package manifests, docs, site) corrected from `github.com/Mid-D-Man/mid-qr` / `github.com/MidManStudio/mid-qr` to `github.com/MidManStudio/mid_qr_code_lib`

### Fixed
- **Scanner:** `switchCamera()` could silently do nothing — the initial camera was selected by facingMode string while the tracked camera index was a separate, independently-guessed value, so the two could point at different cameras. The index is now resolved from a real device ID up front.
- **Scanner UI:** the scan-line overlay rendered incorrectly on desktop — `.scan-frame` computed width/height independently against a non-square 4:3 parent, producing a squashed rectangle, and the scan-line animation used a hardcoded pixel offset that assumed a fixed square size. Frame is now a true square via `aspect-ratio`, and the animation uses percentage offsets.
- **Generator:** rounded frame background styles (2 and 4) showed the square canvas background peeking out from behind the rounded corners — the base background rect was always square while the frame overlay was rounded. The base rect now matches the frame's corner radius.

### Removed
- 

---

## [0.1.0] — 2026-04-27

### Added

**Core (Rust / WASM)**
- Six data module styles: `square`, `dot`, `rounded`, `extra-rounded`, `classy`, `classy-rounded`
- Three finder-eye outer ring styles: `square`, `extra-rounded`, `dot`
- Two finder-eye inner dot styles: `square`, `dot`
- Independent eye colours via `EyeColorOptions` (`outer` + `inner`)
- Four gradient modes: `linear-x`, `linear-y`, `diagonal`, `radial` — using `gradientUnits="userSpaceOnUse"`
- Logo embedding with optional white backing and rounded border
- Eight decorative frame styles (0 = none, 1–8 = various backgrounds, borders, and badge tabs) with label text support
- Static-image QR decode via `rxing` 0.8 using `Luma8LuminanceSource` + `HybridBinarizer` + `QRCodeReader`
- RGBA → luma conversion matching nimiq scanner weights (`R×77 + G×150 + B×29 >> 8`)
- Full WASM capability query functions: `getSupportedModuleStyles`, `getSupportedCornerSquareStyles`, etc.
- WASM build with external `binaryen` `wasm-opt` (`-Oz` + bulk-memory + nontrapping-float-to-int + sign-ext + mutable-globals)

**npm package (TypeScript)**
- `MidQr` combined facade — `create()`, `generate()`, `generateSimple()`, `decode()`, `createScanner()`, `getCapabilities()`, `version`, `status`
- `MidQrGenerator` — generation + static decode only (smaller import)
- `MidQrScanner` — real-time camera scanning via nimiq QrScanner wrapper
  - Multi-instance support (one scanner per video element)
  - Camera enumeration, camera switching, torch/flash control
  - Locked-mode payload unwrapping
  - `maxScansPerSecond` throttle
  - 80% scan region with quality constraints (`1920×1080` ideal)
- Locked payload protocol: `<redirectUrl>?mid-qr-v1=<base64(json)>`
- `getCapabilities()` returns all supported option values as typed arrays

**Site**
- Generator page (`site/index.html`) with full option controls: content types, module style picker, eye style picker, frame picker, gradient, logo upload, locked mode
- Scanner page (`site/scanner.html`) with camera lifecycle, locked-mode rejection, scan history
- Dark theme design system (`site/css/`) with CSS custom properties, responsive layout

**Blazor (.NET)**
- `MidQrCode` Razor component — full generation options, loading/error states, locked badge, `InfoContent` slot
- `MidQrScanner` Razor component — camera control, locked mode, multi-camera, `ResultContent` slot, `ControlsContent` slot
- `IMidQrIconProvider` interface + `DefaultMidQrIconProvider` fallback
- `MidQrGenerateOptions`, `MidQrGradientOptions`, `MidQrLogoOptions`, `MidQrLockedOptions` records
- `MidQrResult`, `MidQrScanResult` event data classes
- `ServiceCollectionExtensions.AddMidQrBlazor()` DI registration
- Scoped CSS for both components using CSS custom properties for theming
- Multi-target: `net7.0` and `net8.0`
- `midQrModule.js` JS interop bridge: WASM lifecycle, generation, locked encoding, scanner management

**CI / Workflows**
- `build-wasm.yml` — WASM build, optimise, test, TS build, dist branch assembly and push
- `pages.yml` — full site build and GitHub Pages deployment
- `publish-npm.yml` — version guard, build, `npm publish`
- `publish-nuget.yml` — version resolution, WASM build, `dotnet pack`, `dotnet nuget push`

---

[Unreleased]: https://github.com/MidManStudio/mid_qr_code_lib/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/MidManStudio/mid_qr_code_lib/releases/tag/v0.1.0
