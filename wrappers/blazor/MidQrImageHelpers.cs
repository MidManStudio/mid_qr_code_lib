using Microsoft.AspNetCore.Components.Forms;

namespace MidManStudio.MidQr.Blazor;

/// <summary>
/// Helpers for turning a browser-side image (an <see cref="IBrowserFile"/> from
/// an &lt;InputFile&gt;, i.e. a Blazor-wrapped Blob) into the data-URI string
/// that <see cref="MidQrLogoOptions.Url"/> expects.
///
/// The underlying Rust/WASM renderer just writes whatever string you give it
/// straight into an SVG &lt;image href="..."&gt; element. A `blob:` URL
/// (e.g. from <c>URL.CreateObjectURL</c>-style APIs) only resolves inside the
/// tab/session that created it, so it silently breaks the moment the SVG is
/// downloaded, saved to a file, or rendered somewhere else. A base64 data-URI
/// has no such lifetime — it's the actual image bytes, so it's the only safe
/// choice for a logo that needs to survive outside the live page.
/// </summary>
public static class MidQrImageHelpers
{
    /// <summary>Default upload cap (2 MB) — logos are small; this just guards against huge accidental uploads.</summary>
    public const long DefaultMaxSizeBytes = 2 * 1024 * 1024;

    /// <summary>
    /// Reads an uploaded browser file and returns a
    /// <c>data:&lt;mime&gt;;base64,&lt;...&gt;</c> string ready to assign to
    /// <see cref="MidQrLogoOptions.Url"/>.
    /// </summary>
    /// <param name="file">The file from an &lt;InputFile OnChange="..."&gt; handler.</param>
    /// <param name="maxAllowedSize">
    /// Upper bound passed to <see cref="IBrowserFile.OpenReadStream"/>.
    /// Throws if the file is larger than this. Default 2 MB.
    /// </param>
    /// <param name="cancellationToken">Optional cancellation token.</param>
    /// <exception cref="ArgumentNullException">file is null.</exception>
    /// <exception cref="IOException">The file exceeds maxAllowedSize.</exception>
    public static async Task<string> ToDataUriAsync(
        IBrowserFile file,
        long maxAllowedSize = DefaultMaxSizeBytes,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(file);

        await using var stream = file.OpenReadStream(maxAllowedSize, cancellationToken);
        using var memory = new MemoryStream();
        await stream.CopyToAsync(memory, cancellationToken);

        var base64      = Convert.ToBase64String(memory.ToArray());
        var contentType = string.IsNullOrWhiteSpace(file.ContentType)
            ? "image/png"
            : file.ContentType;

        return $"data:{contentType};base64,{base64}";
    }
}
