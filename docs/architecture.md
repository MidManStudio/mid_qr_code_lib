# Architecture & Contributing

## Project structure

```
mid-qr/
├── crates/
│   ├── mid-qr-core/          Pure Rust — no WASM dependency
│   │   └── src/
│   │       ├── lib.rs
│   │       ├── error.rs      QrError enum
│   │       ├── generate.rs   SVG renderer (all style options)
│   │       └── decode.rs     rxing static-image decode
│   └── mid-qr-wasm/          wasm-bindgen surface
│       └── src/lib.rs        JS option structs → core types
│
├── npm/                      TypeScript npm package
│   ├── src/
│   │   ├── index.ts          Public API entry point + MidQr facade
│   │   ├── generator.ts      MidQrGenerator class (WASM calls)
│   │   ├── scanner.ts        MidQrScanner class (nimiq wrapper)
│   │   ├── types.ts          All exported TypeScript types
│   │   └── utils.ts          Shared nimiq QrScanner resolution
│   ├── wasm/                 wasm-pack output (gitignored, built by CI)
│   ├── dist/                 TypeScript build output (gitignored)
│   └── worker/               nimiq files (fetched by CI)
│
├── site/                     GitHub Pages demo site
│   ├── index.html            Generator page
│   ├── scanner.html          Scanner page
│   ├── css/                  Component stylesheet system
│   └── js/                   Site-specific JS modules
│
├── wrappers/
│   └── blazor/               .NET Blazor component library
│       ├── MidQrCode.razor   Generator component
│       ├── MidQrScanner.razor Scanner component
│       ├── MidQrData.cs      All C# types and enums
│       ├── IMidQrIconProvider.cs  Icon provider interface
│       ├── ServiceCollectionExtensions.cs
│       └── wwwroot/js/midQrModule.js  Blazor JS interop bridge
│
├── docs/
│   ├── api.md                Full API reference
│   ├── architecture.md       Architecture overview
│   └── getting-started.md    Quickstart guide
│
├── tests/
│   └── integration.rs        Rust integration tests
│
└── .github/workflows/
    ├── build-wasm.yml         Build WASM + dist branch
    ├── pages.yml              Build + deploy GitHub Pages
    ├── publish-npm.yml        Publish to npmjs.com
    └── publish-nuget.yml      Publish to nuget.org
```

---

## How the Rust renderer works

The SVG generator in `crates/mid-qr-core/src/generate.rs` builds the output in six layers, drawn in order:

```
① Light background rect
② Frame background / border elements (rendered BEFORE QR)
③ Data modules — single combined <path> for all dark cells
④ Finder-pattern eyes — rendered separately with corner styles
⑤ Logo image + white backing
⑥ Frame text label (rendered last, always on top)
```

Module paths are built as SVG path fragments concatenated into a single `<path d="...">` element. This keeps the DOM small regardless of QR version.

Gradient coordinates use `gradientUnits="userSpaceOnUse"` so they always span the correct QR area regardless of frame padding.

---

## Decode paths in detail

### Path 1 — BarcodeDetector API (Chromium)

Used by the nimiq `QrScanner` class when `BarcodeDetector` is available and includes `qr_code` in its supported formats. This is the fastest path — zero JavaScript binarization overhead.

### Path 2 — nimiq worker (all browsers)

A Web Worker running a hand-tuned binary binarizer (`qr-scanner-worker.min.js`). Uses the same luma weights as the Rust decoder:
```
luma = (R×77 + G×150 + B×29) >> 8
```
Handles motion blur and uneven lighting better than a pure threshold.

### Path 3 — rxing WASM (still images)

`crates/mid-qr-core/src/decode.rs` wraps the `rxing` crate. Used exclusively for still-image decode (file upload, canvas snapshot). Uses `Luma8LuminanceSource` + `HybridBinarizer` + `QRCodeReader`. Accuracy is higher than the worker on high-resolution clean images.

---

## WASM build notes

### Why `wasm-opt = false` in the crate manifest

The `wasm-opt` binary bundled with older `wasm-pack` versions cannot handle all WebAssembly proposals emitted by the Rust toolchain when `rxing` + `encoding_rs` are compiled together:

- `bulk-memory` (memory.fill / memory.copy)
- `nontrapping-float-to-int` (i32.trunc_sat_f32_s)

The CI workflow installs a separate, current `binaryen` package and runs `wasm-opt` explicitly with the required `--enable-*` flags.

### Why `rxing` with `encoding_rs` feature

`rxing 0.8` requires either `"encoding_rs"` or `"legacy_encoding"` to be explicitly enabled — without one of them it emits a `compile_error!`. We choose `encoding_rs` because:
- It is Mozilla's implementation, designed for WASM / no_std / browser use.
- It compiles cleanly to `wasm32-unknown-unknown` with no native dependencies.
- `"legacy_encoding"` uses the older `encoding` crate (0.2) which has known WASM issues.

### Why `panic = "abort"` is removed from the workspace profile

With `panic = "abort"`, Rust panics terminate the WASM module immediately. With the default `panic = "unwind"`, wasm-bindgen wraps every exported function in `std::panic::catch_unwind`, so panics inside generation or decode are converted to JS errors rather than crashing the whole page.

---

## Contributing

### Opening issues

- **Bug:** include browser/runtime, mid-qr version, minimal reproduction steps, and any console errors.
- **Feature request:** describe the use case, not just the implementation. If you have a visual idea, a sketch or mockup is very helpful.

### Pull requests

1. Fork and create a branch: `git checkout -b feat/my-feature`
2. Make your changes.
3. Run tests: `cargo test -p mid-qr-core --features generate,decode`
4. Rebuild WASM locally and verify the site still works.
5. Open a PR against `main`.

### Coding conventions

**Rust**
- All public functions must have a doc comment.
- Errors go through `QrError` — no `unwrap()` in library code.
- Keep SVG path generation in pure arithmetic; avoid string-heavy approaches.

**TypeScript**
- Use `undefined` (not `null`) for optional fields sent to WASM — serde-wasm-bindgen maps missing fields to `None`, but `null` causes a type error.
- Lazy init the WASM module via `ensureWasm()` so it is not fetched until needed.

**Blazor**
- All new parameters should have XML doc comments.
- Icon SVGs come from `IMidQrIconProvider`, never hardcoded in components.
- Use `TryAdd` pattern when registering default implementations.

### Adding a new module style

1. Add a variant to `ModuleStyle` in `generate.rs` and implement `module_path()`.
2. Add the string mapping in `ModuleStyle::from_str()`.
3. Add the variant to `getSupportedModuleStyles()` in `lib.rs` (WASM).
4. Add the TypeScript union type in `types.ts`.
5. Add a preview SVG function in `controls.js`.
6. Add the card to `MODULE_STYLES` in `controls.js`.

### Adding a new frame style

1. Add the geometry in `frame_geom()` in `generate.rs`.
2. Add the background elements in `render_frame_bg()`.
3. Add text positioning in `render_frame_text()`.
4. Increment the range in `FrameOptions.style` (TypeScript union + Rust validation).
5. Add the preview in `framePreviewSVG()` in `controls.js`.
6. Add the card to `FRAME_STYLES` in `controls.js`.

---

## CI pipeline overview

```
push to main
    │
    ├─► build-wasm.yml
    │     Build WASM (wasm-pack)
    │     Optimise WASM (binaryen wasm-opt)
    │     Run cargo test -p mid-qr-core
    │     Build TypeScript (tsc + rollup)
    │     Assemble dist-out/ tree
    │     Push to dist branch
    │
    └─► pages.yml
          Build WASM + TS (same steps)
          Assemble _site/
          Deploy to gh-pages branch

tag v*
    └─► publish-npm.yml
          Build WASM + TS
          Run tests
          npm publish --access public

tag nuget-v*
    └─► publish-nuget.yml
          Build WASM
          Copy to Blazor wwwroot
          Fetch nimiq files
          dotnet pack
          dotnet nuget push
```

---

## Local development workflow

```bash
# Terminal 1 — watch WASM
cd crates/mid-qr-wasm
wasm-pack build --target web --dev --out-dir ../../npm/wasm --out-name mid_qr_wasm

# Terminal 2 — watch TypeScript
cd npm
npm run build:ts -- --watch

# Terminal 3 — serve the site
npx serve site -p 3000
# Open http://localhost:3000
# The site imports from ../wasm/ and js/mid-qr.js (the compiled TS output)
```

---

## License

MIT © MidManStudio
