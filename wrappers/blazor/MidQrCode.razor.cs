using Microsoft.AspNetCore.Components;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.JSInterop;

namespace MidManStudio.MidQr.Blazor;

/// <summary>
/// Blazor component that renders a QR code SVG via the mid-qr WASM library.
/// </summary>
public partial class MidQrCode : IAsyncDisposable
{
    // ── Path constant ─────────────────────────────────────────────────────────
    // Blazor static web assets are served at _content/{PackageId}/...
    private const string JsModulePath =
        "./_content/MidManStudio.MidQr.Blazor/js/midQrModule.js";

    // ── DI ────────────────────────────────────────────────────────────────────
    [Inject] private IJSRuntime        JS              { get; set; } = default!;
    [Inject] private IServiceProvider  ServiceProvider { get; set; } = default!;

    // ── Parameters ────────────────────────────────────────────────────────────

    /// <summary>Content to encode into the QR code. Required.</summary>
    [Parameter, EditorRequired] public string Data { get; set; } = string.Empty;

    /// <summary>Full generation options.  Locked mode is configured here via Options.Locked.</summary>
    [Parameter] public MidQrGenerateOptions? Options { get; set; }

    /// <summary>Convenience theme preset (ignored when Options includes Gradient/Logo).</summary>
    [Parameter] public MidQrTheme Theme { get; set; } = MidQrTheme.Standard;

    /// <summary>Called after every successful QR generation.</summary>
    [Parameter] public EventCallback<MidQrResult> OnGenerated { get; set; }

    /// <summary>Called when generation fails.</summary>
    [Parameter] public EventCallback<string> OnError { get; set; }

    /// <summary>Additional CSS class on the root element.</summary>
    [Parameter] public string CssClass { get; set; } = string.Empty;

    /// <summary>Inline style on the root element.</summary>
    [Parameter] public string Style { get; set; } = string.Empty;

    /// <summary>Loading overlay text.  Default: "Generating QR code…"</summary>
    [Parameter] public string LoadingMessage { get; set; } = "Generating QR code…";

    /// <summary>Show a Retry button when generation fails.</summary>
    [Parameter] public bool ShowRetryOnError { get; set; } = true;

    /// <summary>Optional content rendered below the QR code.</summary>
    [Parameter] public RenderFragment? InfoContent { get; set; }

    // ── Public read-only properties ───────────────────────────────────────────

    /// <summary>Whether locked mode is active.</summary>
    public bool IsLocked => Options?.Locked is not null &&
                            !string.IsNullOrEmpty(Options.Locked.RedirectUrl);

    // ── Internal state ────────────────────────────────────────────────────────

    private readonly string _instanceId = Guid.NewGuid().ToString("N")[..8];

    private IJSObjectReference? _jsModule;
    private IMidQrIconProvider? _iconProvider;
    private bool _jsInitialised;

    private bool   _isLoading    = false;
    private bool   _hasError     = false;
    private string _errorMessage = string.Empty;
    private bool   _isGenerating = false;

    private string _spinnerSvg = string.Empty;
    private string _errorSvg   = string.Empty;
    private string _lockedSvg  = string.Empty;

    private string               _lastData    = string.Empty;
    private MidQrGenerateOptions? _lastOptions;
    private MidQrTheme           _lastTheme   = MidQrTheme.Standard;

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    protected override async Task OnInitializedAsync()
    {
        await base.OnInitializedAsync();

        // Resolve icon provider — try DI, fall back to built-in default
        _iconProvider = ServiceProvider.GetService<IMidQrIconProvider>()
                       ?? new DefaultMidQrIconProvider();

        var spinnerTask = _iconProvider.GetLoadingSpinnerSvgAsync();
        var errorTask   = _iconProvider.GetErrorIconSvgAsync();
        var lockedTask  = _iconProvider.GetLockedIconSvgAsync();
        await Task.WhenAll(spinnerTask, errorTask, lockedTask);

        _spinnerSvg = spinnerTask.Result;
        _errorSvg   = errorTask.Result;
        _lockedSvg  = lockedTask.Result;

        try
        {
            _jsModule      = await JS.InvokeAsync<IJSObjectReference>("import", JsModulePath);
            _jsInitialised = true;
        }
        catch (Exception ex)
        {
            await SetError($"Failed to load QR module: {ex.Message}");
        }
    }

    protected override async Task OnParametersSetAsync()
    {
        await base.OnParametersSetAsync();
        if (!_jsInitialised || _isGenerating) return;
        if (Data == _lastData && Options == _lastOptions && Theme == _lastTheme) return;
        await GenerateQrCode();
    }

    protected override async Task OnAfterRenderAsync(bool firstRender)
    {
        if (firstRender && _jsInitialised && string.IsNullOrEmpty(_lastData))
            await GenerateQrCode();
    }

    // ── Public API ────────────────────────────────────────────────────────────

    /// <summary>Force the QR code to regenerate immediately.</summary>
    public async Task RefreshAsync() => await GenerateQrCode();

    // ── Generation ────────────────────────────────────────────────────────────

    private async Task GenerateQrCode()
    {
        if (_isGenerating || !_jsInitialised || _jsModule is null) return;
        if (string.IsNullOrWhiteSpace(Data)) return;

        _isGenerating = true;
        _hasError     = false;
        _isLoading    = true;
        StateHasChanged();

        try
        {
            _lastData    = Data;
            _lastOptions = Options;
            _lastTheme   = Theme;

            var opts      = Options ?? new MidQrGenerateOptions();
            var errorLevel = opts.Locked is not null && opts.ErrorLevel < MidQrErrorLevel.H
                ? MidQrErrorLevel.H
                : opts.ErrorLevel;

            var jsOpts = BuildJsOptions(opts, errorLevel);

            var svg = await _jsModule.InvokeAsync<string>(
                "generateQrCode",
                Data,
                jsOpts,
                IsLocked ? opts.Locked!.RedirectUrl : null);

            await _jsModule.InvokeVoidAsync(
                "setSvgContent",
                $"mid-qr-container-{_instanceId}",
                svg);

            if (OnGenerated.HasDelegate)
            {
                await OnGenerated.InvokeAsync(new MidQrResult
                {
                    Data        = Data,
                    SvgContent  = svg,
                    Theme       = Theme,
                    GeneratedAt = DateTime.UtcNow,
                    IsLocked    = IsLocked,
                });
            }
        }
        catch (Exception ex)
        {
            await SetError($"QR generation failed: {ex.Message}");
        }
        finally
        {
            _isLoading    = false;
            _isGenerating = false;
            StateHasChanged();
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private static object BuildJsOptions(MidQrGenerateOptions opts, MidQrErrorLevel errorLevel)
    {
        return new
        {
            size        = opts.Size,
            darkColor   = opts.DarkColor,
            lightColor  = opts.LightColor,
            errorLevel  = errorLevel.ToString(),
            margin      = opts.Margin,
            gradient    = opts.Gradient is null ? null : new
            {
                direction = GradientDirectionToJs(opts.Gradient.Direction),
                color1    = opts.Gradient.Color1,
                color2    = opts.Gradient.Color2,
            },
            logo = opts.Logo is null ? null : new
            {
                url       = opts.Logo.Url,
                sizeRatio = opts.Logo.SizeRatio,
                border    = opts.Logo.AddBorder ? new
                {
                    color  = opts.Logo.BorderColor,
                    width  = opts.Logo.BorderWidth,
                    radius = opts.Logo.BorderRadius,
                } : null,
            },
        };
    }

    private static string GradientDirectionToJs(MidQrGradientDirection d) => d switch
    {
        MidQrGradientDirection.LinearX  => "linear-x",
        MidQrGradientDirection.LinearY  => "linear-y",
        MidQrGradientDirection.Diagonal => "diagonal",
        MidQrGradientDirection.Radial   => "radial",
        _                               => "linear-x",
    };

    private async Task SetError(string message)
    {
        _hasError     = true;
        _errorMessage = message;
        if (OnError.HasDelegate)
            await OnError.InvokeAsync(message);
        StateHasChanged();
    }

    // ── Disposal ──────────────────────────────────────────────────────────────

    public async ValueTask DisposeAsync()
    {
        if (_jsModule is not null)
        {
            try   { await _jsModule.DisposeAsync(); }
            catch { /* suppress */ }
        }
    }
}
