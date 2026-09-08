# @midmanstudio/mid-qr

Unified QR code generation and scanning — Rust/WASM core, custom dot
styles, gradients, logos, and frames.

## Install

```bash
npm install @midmanstudio/mid-qr
```

## Quick start

```ts
import { MidQr } from '@midmanstudio/mid-qr';

const qr = await MidQr.create(
  new URL('/wasm/mid_qr_wasm_bg.wasm', location.origin),
);

const svg = qr.generate({
  data:              'https://example.com',
  size:              320,
  moduleStyle:       'dot',
  cornerSquareStyle: 'extra-rounded',
  gradient: { direction: 'diagonal', color1: '#e63946', color2: '#2563eb' },
});
```

Camera scanning requires `qr-scanner.umd.min.js` loaded via a `<script>`
tag before your module script — see the package's `worker/` directory.

## Full API

Every option (`moduleStyle`, `cornerSquareStyle`, `cornerDotStyle`,
`eyeColor`, `frame`, `logo`, `gradient`), plus the scanner and decode
APIs, is documented in the main repository:
https://github.com/MidManStudio/mid_qr_code_lib/blob/main/docs/api.md

## License

MIT — see [LICENSE](https://github.com/MidManStudio/mid_qr_code_lib/blob/main/LICENSE).
