using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace MidManStudio.MidQr.Blazor;

/// <summary>
/// Extension methods for registering mid-qr Blazor services.
/// </summary>
public static class ServiceCollectionExtensions
{
    /// <summary>
    /// Register mid-qr Blazor services.  Call once in <c>Program.cs</c>.
    ///
    /// <code>
    /// // Basic — uses the built-in SVG icon set:
    /// builder.Services.AddMidQrBlazor();
    ///
    /// // Custom icons — supply your own VisualElementsService adapter:
    /// builder.Services.AddMidQrBlazor()
    ///        .AddScoped&lt;IMidQrIconProvider, MyIconAdapter&gt;();
    /// </code>
    ///
    /// Then in your Blazor host page add the nimiq UMD script tag
    /// <strong>before</strong> the Blazor framework script:
    /// <code>
    /// &lt;script src="_content/MidManStudio.MidQr.Blazor/js/worker/qr-scanner.umd.min.js"&gt;&lt;/script&gt;
    /// </code>
    /// </summary>
    public static IServiceCollection AddMidQrBlazor(this IServiceCollection services)
    {
        services.TryAddScoped<IMidQrIconProvider, DefaultMidQrIconProvider>();
        return services;
    }
}
