using Microsoft.AspNetCore.Components;
using Microsoft.AspNetCore.Components.Routing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.JSInterop;

namespace MidManStudio.MidQr.Blazor;

/// <summary>
/// Blazor QR code scanner component backed by the mid-qr JS/WASM library.
/// </summary>
public partial class MidQrScanner : IAsyncDisposable
{
    // ── Path constant ─────────────────────────────────────────────────────────
    private const string JsModulePath =
        "./_content/MidManStudio.MidQr.Blazor/js/midQrModule.js";

    // ── DI ────────────────────────────────────────────────────────────────────
    [Inject] private IJSRuntime       JS              { get; set; } = default!;
    [Inject] private IServiceProvider ServiceProvider { get; set; } = default!;

    // ── Parameters ────────────────────────────────────────────────────────────

    /// <summary>Called with the decoded result on every successful scan.</summary>
    [Parameter] public EventCallback<MidQrScanResult> OnQrCodeDetected { get; set; }

    /// <summary>Called when a non-locked QR is detected in LockedMode.</summary>
    [Parameter] public EventCallback<string> OnExternalScan { get; set; }

    /// <summary>Only accept locked mid-qr payloads when true.</summary>
    [Parameter] public bool LockedMode { get; set; }

    [Parameter] public string Width   { get; set; } = "100%";
    [Parameter] public string Height  { get; set; } = "400px";
    [Parameter] public string CssClass{ get; set; } = string.Empty;
    [Parameter] public string Style   { get; set; } = string.Empty;

    /// <summary>"environment" (rear), "user" (front), or a deviceId.</summary>
    [Parameter] public string PreferredCamera { get; set; } = "environment";

    [Parameter] public int  MaxScansPerSecond  { get; set; } = 5;
    [Parameter] public bool ShowOverlay        { get; set; } = true;
    [Parameter] public bool ShowControls       { get; set; } = true;
    [Parameter] public bool ShowCameraSwitch   { get; set; } = true;
    [Parameter] public bool AutoStopOnSuccess  { get; set; } = true;
    [Parameter] public int  AutoStopDelayMs    { get; set; } = 800;

    [Parameter] public string StartLabel        { get; set; } = "Start Scanner";
    [Parameter] public string StopLabel         { get; set; } = "Stop Scanner";
    [Parameter] public string CameraSwitchLabel { get; set; } = "Switch Camera";
    [Parameter] public string ProcessingMessage { get; set; } = "Processing…";

    [Parameter] public RenderFragment<MidQrScanResult>? ResultContent  { get; set; }
    [Parameter] public RenderFragment?                  ControlsContent{ get; set; }

    // ── Public state ──────────────────────────────────────────────────────────

    public bool IsScanning   { get; private set; }
    public bool IsProcessing { get; private set; }

    // ── Internal state ────────────────────────────────────────────────────────

    private readonly string _instanceId = Guid.NewGuid().ToString("N")[..8];

    private IJSObjectReference?                   _jsModule;
    private DotNetObjectReference<MidQrScanner>?  _dotNetRef;
    private IMidQrIconProvider?                   _iconProvider;
    private bool _jsInitialised;

    private string _overlaySvg = string.Empty;
    private string _spinnerSvg = string.Empty;

    private string _statusMessage = string.Empty;
    private string _statusType    = string.Empty;
    private CancellationTokenSource? _statusCts;

    private MidQrScanResult? _lastResult;
    private int _cameraCount = 1;

    private readonly SemaphoreSlim _scanLock = new(1, 1);

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    protected override async Task OnInitializedAsync()
    {
        await base.OnInitializedAsync();

        _iconProvider = ServiceProvider.GetService<IMidQrIconProvider>()
                       ?? new DefaultMidQrIconProvider();

        var overlayTask = _iconProvider.GetScanOverlaySvgAsync();
        var spinnerTask = _iconProvider.GetLoadingSpinnerSvgAsync();
        await Task.WhenAll(overlayTask, spinnerTask);

        _overlaySvg = overlayTask.Result;
        _spinnerSvg = spinnerTask.Result;
        _dotNetRef  = DotNetObjectReference.Create(this);

        try
        {
            _jsModule      = await JS.InvokeAsync<IJSObjectReference>("import", JsModulePath);
            _jsInitialised = true;
            _cameraCount   = await _jsModule.InvokeAsync<int>("getCameraCount");
        }
        catch (Exception ex)
        {
            await ShowStatusAsync($"Failed to load scanner: {ex.Message}", "error", 0);
        }
    }

    // ── JS-invokable ──────────────────────────────────────────────────────────

    /// <summary>Called by JS for every decoded frame.</summary>
    [JSInvokable]
    public async Task OnFrameDecoded(string rawData)
    {
        if (IsProcessing || string.IsNullOrEmpty(rawData)) return;
        if (!await _scanLock.WaitAsync(0)) return;

        try
        {
            IsProcessing = true;
            await InvokeAsync(StateHasChanged);

            var (payload, wasLocked) = UnwrapLockedPayload(rawData);

            if (LockedMode && !wasLocked)
            {
                if (OnExternalScan.HasDelegate)
                    await OnExternalScan.InvokeAsync(rawData);
                return;
            }

            var result = new MidQrScanResult
            {
                Data      = payload,
                WasLocked = wasLocked,
                ScannedAt = DateTime.UtcNow,
            };

            _lastResult = result;

            if (OnQrCodeDetected.HasDelegate)
                await OnQrCodeDetected.InvokeAsync(result);

            await ShowStatusAsync("Scan successful", "success", 2500);

            if (AutoStopOnSuccess)
            {
                await Task.Delay(AutoStopDelayMs);
                await StopScanningAsync();
            }
        }
        finally
        {
            IsProcessing = false;
            _scanLock.Release();
            await InvokeAsync(StateHasChanged);
        }
    }

    // ── Public scanner control ────────────────────────────────────────────────

    public async Task StartScanningAsync()
    {
        if (!_jsInitialised || _jsModule is null || IsScanning) return;
        try
        {
            await _jsModule.InvokeVoidAsync(
                "startScanner",
                $"mid-qr-video-{_instanceId}",
                _dotNetRef,
                PreferredCamera,
                MaxScansPerSecond);

            IsScanning = true;
            await InvokeAsync(StateHasChanged);
        }
        catch (Exception ex)
        {
            await ShowStatusAsync($"Camera error: {ex.Message}", "error", 4000);
        }
    }

    public async Task StopScanningAsync()
    {
        if (!_jsInitialised || _jsModule is null || !IsScanning) return;
        try
        {
            await _jsModule.InvokeVoidAsync("stopScanner", $"mid-qr-video-{_instanceId}");
        }
        catch { /* suppress */ }
        finally
        {
            IsScanning   = false;
            IsProcessing = false;
            await InvokeAsync(StateHasChanged);
        }
    }

    public async Task SwitchCameraAsync()
    {
        if (!_jsInitialised || _jsModule is null || !IsScanning) return;
        try
        {
            await _jsModule.InvokeVoidAsync("switchCamera", $"mid-qr-video-{_instanceId}");
        }
        catch (Exception ex)
        {
            await ShowStatusAsync($"Camera switch failed: {ex.Message}", "error", 3000);
        }
    }

    // ── Status ────────────────────────────────────────────────────────────────

    public async Task ShowStatusAsync(string message, string type = "info", int durationMs = 3000)
    {
        _statusCts?.Cancel();
        _statusCts?.Dispose();
        _statusCts     = null;
        _statusMessage = message;
        _statusType    = type;
        await InvokeAsync(StateHasChanged);

        if (durationMs <= 0) return;

        _statusCts = new CancellationTokenSource();
        var token  = _statusCts.Token;

        try
        {
            await Task.Delay(durationMs, token);
            if (!token.IsCancellationRequested)
            {
                _statusMessage = string.Empty;
                _statusType    = string.Empty;
                await InvokeAsync(StateHasChanged);
            }
        }
        catch (TaskCanceledException) { /* expected */ }
    }

    // ── Locked payload unwrap ─────────────────────────────────────────────────

    private const string LockedPrefix = "mid-qr-v1=";

    private static (string payload, bool wasLocked) UnwrapLockedPayload(string raw)
    {
        try
        {
            int idx = raw.IndexOf(LockedPrefix, StringComparison.Ordinal);
            if (idx < 0) return (raw, false);

            var b64 = raw[(idx + LockedPrefix.Length)..];
            var amp = b64.IndexOf('&'); if (amp >= 0) b64 = b64[..amp];
            var hsh = b64.IndexOf('#'); if (hsh >= 0) b64 = b64[..hsh];

            var json    = System.Text.Encoding.UTF8.GetString(Convert.FromBase64String(b64));
            var doc     = System.Text.Json.JsonDocument.Parse(json);
            var payload = doc.RootElement.GetProperty("data").GetString() ?? raw;
            return (payload, true);
        }
        catch { return (raw, false); }
    }

    // ── Navigation guard (optional — wire up in your page if needed) ──────────

    public async Task OnBeforeInternalNavigation(LocationChangingContext _)
    {
        await StopScanningAsync();
        _statusCts?.Cancel();
    }

    // ── Disposal ──────────────────────────────────────────────────────────────

    public async ValueTask DisposeAsync()
    {
        await StopScanningAsync();
        _statusCts?.Cancel();
        _statusCts?.Dispose();
        _dotNetRef?.Dispose();
        _scanLock.Dispose();

        if (_jsModule is not null)
        {
            try   { await _jsModule.DisposeAsync(); }
            catch { /* suppress */ }
        }
    }
}
