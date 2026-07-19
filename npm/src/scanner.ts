// =============================================================================
// mid-qr — Real-time camera scanner
//
// Wraps nimiq QrScanner (loaded as UMD via <script> tag).
// Uses window.QrScanner resolved by getQrScannerClass() from utils.ts.
// =============================================================================

import type {
  ScannerOptions,
  ScanResult,
  OnDecodeCallback,
  OnDecodeErrorCallback,
  CameraInfo,
} from './types.js';
import { getQrScannerClass, type QrScannerStatic, type QrScannerInstance } from './utils.js';

// ── Default scan region ───────────────────────────────────────────────────────

function defaultScanRegion(video: HTMLVideoElement) {
  const size = Math.round(Math.min(video.videoWidth, video.videoHeight) * 0.80);
  return {
    x:      Math.round((video.videoWidth  - size) / 2),
    y:      Math.round((video.videoHeight - size) / 2),
    width:  size,
    height: size,
  };
}

// ── MidQrScanner ──────────────────────────────────────────────────────────────

export class MidQrScanner {
  private readonly _inner:    QrScannerInstance;
  private readonly _video:    HTMLVideoElement;
  private          _cameras:  CameraInfo[] = [];
  private readonly _onDecode: OnDecodeCallback;
  private readonly _onError:  OnDecodeErrorCallback | undefined;

  private _scanning  = false;
  private _cameraIdx = 0;

  private constructor(
    inner:    QrScannerInstance,
    video:    HTMLVideoElement,
    onDecode: OnDecodeCallback,
    onError?: OnDecodeErrorCallback,
  ) {
    this._inner    = inner;
    this._video    = video;
    this._onDecode = onDecode;
    this._onError  = onError;
  }

  static async create(
    video:    HTMLVideoElement,
    onDecode: OnDecodeCallback,
    options?: ScannerOptions,
    onError?: OnDecodeErrorCallback,
  ): Promise<MidQrScanner> {
    // Resolve the class — throws with a clear message if UMD not loaded
    const QrScanner: QrScannerStatic = getQrScannerClass();

    // Deliberately NOT calling QrScanner.listCameras() here, even though
    // an earlier version of this file did. Nimiq's own source warns
    // against exactly that: "Call listCameras after successfully
    // starting a QR scanner to avoid creating a temporary video stream."
    // Calling it before any stream is active means it has to open a
    // throwaway getUserMedia stream just to read device labels, then
    // immediately close it — right before start() opens the REAL stream
    // moments later. That back-to-back open/close/open of the camera
    // hardware is exactly the kind of timing issue that's flaky on
    // mobile (nimiq's own comment: "especially...on mobile when the
    // camera is already in use and some browsers disallow a second
    // stream"). On affected devices the <video> element can still appear
    // to show *something*, while the scan loop never actually receives
    // usable frames — which looks identical to "it's just not scanning,"
    // silently, with no error surfaced anywhere.
    //
    // preferredCamera is passed straight through as the raw facingMode
    // string or explicit deviceId; the actual camera list is resolved
    // in start(), once a stream already exists (see the comment there
    // for why that's the point where listCameras() becomes free).
    const preferred = options?.preferredCamera ?? 'environment';

    const inner = new QrScanner(
      video,
      nimiqResult => onDecode({
        data:         nimiqResult.data,
        cornerPoints: nimiqResult.cornerPoints,
      }),
      {
        preferredCamera:           preferred,
        maxScansPerSecond:         options?.maxScansPerSecond    ?? 5,
        highlightScanRegion:       options?.highlightScanRegion  ?? false,
        highlightCodeOutline:      options?.highlightCodeOutline ?? false,
        returnDetailedScanResult:  true,
        onDecodeError:             onError ?? (() => { /* silent */ }),
        calculateScanRegion:       defaultScanRegion,
      },
    );

    return new MidQrScanner(inner, video, onDecode, onError);
  }

  // ── Control ────────────────────────────────────────────────────────────────

  async start(): Promise<void> {
    await this._inner.start();
    this._scanning = true;

    // Fetch the camera list now that a stream is already active. Per
    // nimiq's own listCameras() implementation, it only opens a temporary
    // stream when device labels aren't already available — and with a
    // stream already running, they are, so this resolves for free with
    // no extra getUserMedia call. See the comment in create() for why
    // doing this earlier (before any stream existed) was the actual bug.
    try {
      this._cameras = await getQrScannerClass().listCameras(true);
    } catch {
      this._cameras = [];
    }

    // Match the ACTUALLY running device against the fetched list, so
    // switchCamera()'s index is grounded in reality rather than a guess
    // made before anything had started.
    const stream = this._video.srcObject;
    if (stream instanceof MediaStream) {
      const track = stream.getVideoTracks()[0];
      const activeId = track?.getSettings?.().deviceId;
      if (activeId) {
        const idx = this._cameras.findIndex(c => c.id === activeId);
        if (idx !== -1) this._cameraIdx = idx;
      }

      // Request higher resolution from the camera track when possible
      if (track?.applyConstraints) {
        try {
          await track.applyConstraints({
            width:  { ideal: 1920, min: 1280 },
            height: { ideal: 1080, min: 720  },
          });
        } catch { /* non-fatal — lower resolution still scans */ }
      }
    }
  }

  stop(): void {
    this._inner.stop();
    this._scanning = false;
  }

  destroy(): void {
    this._inner.destroy();
    this._scanning = false;
  }

  async switchCamera(): Promise<void> {
    if (this._cameras.length <= 1) return;
    const wasScanning = this._scanning;

    this._cameraIdx = (this._cameraIdx + 1) % this._cameras.length;
    const nextId = this._cameras[this._cameraIdx].id;

    if (wasScanning) {
      this._inner.stop();
      // The underlying library's setCamera() does a forced, zero-delay
      // pause before requesting the next stream (it explicitly skips the
      // 300ms grace period its own non-forced pause path uses elsewhere).
      // On some mobile browsers, requesting a new camera immediately after
      // stopping the last one can silently come back with the SAME
      // physical camera — the hardware hasn't released it yet. This looks
      // exactly like "the switch button does nothing." A short delay here
      // gives it time to actually let go before we ask for the next one.
      await new Promise(resolve => setTimeout(resolve, 250));
    }

    await this._inner.setCamera(nextId);
    if (wasScanning) await this._inner.start();
  }

  async setCameraById(deviceId: string): Promise<void> {
    const idx = this._cameras.findIndex(c => c.id === deviceId);
    if (idx === -1) throw new Error(`mid-qr: camera '${deviceId}' not found`);
    const wasScanning = this._scanning;
    this._cameraIdx = idx;

    if (wasScanning) {
      this._inner.stop();
      await new Promise(resolve => setTimeout(resolve, 250)); // see switchCamera()
    }

    await this._inner.setCamera(deviceId);
    if (wasScanning) await this._inner.start();
  }

  // ── Flash ──────────────────────────────────────────────────────────────────

  get flashOn(): boolean             { return this._inner.isFlashOn(); }
  async hasFlash(): Promise<boolean> { return this._inner.hasFlash(); }
  async toggleFlash(): Promise<void> { return this._inner.toggleFlash(); }

  // ── State ──────────────────────────────────────────────────────────────────

  get isScanning(): boolean               { return this._scanning; }
  get cameras(): CameraInfo[]             { return [...this._cameras]; }
  get currentCamera(): CameraInfo | undefined { return this._cameras[this._cameraIdx]; }

  // ── Static helpers ─────────────────────────────────────────────────────────

  static async hasCamera(): Promise<boolean> {
    try {
      return await getQrScannerClass().hasCamera();
    } catch { return false; }
  }

  static async listCameras(): Promise<CameraInfo[]> {
    try {
      return await getQrScannerClass().listCameras(true).catch(() => []);
    } catch { return []; }
  }
}
