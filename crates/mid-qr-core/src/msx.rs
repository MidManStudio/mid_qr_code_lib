//! MSX (DixScript source) QR code output.
//!
//! Mirrors `render_svg`'s geometry exactly — same module/eye/frame math,
//! via the same `pub(crate)` helpers in `generate.rs` — but serializes to
//! MSX's `@DATA` scene/elements format instead of SVG tags. This is only
//! possible because MSX's `path` element accepts standard SVG path `d`
//! syntax directly, so none of the path-building math needed to change,
//! only the wrapper around it.
//!
//! Not supported, on purpose:
//! - **Logo.** MSX v0.1 has no raster/image element (that's MPX's job per
//!   its own spec's non-goals) — refused with a clear error rather than
//!   silently dropping the logo from the output.
//! - **Frame text letter-spacing.** MSX's text style object has no
//!   letter-spacing field; the label still renders, just without the
//!   extra tracking the SVG version applies.
//!
//! One assumption worth flagging: MSX's gradient defs document their
//! x1/y1/x2/y2 (and cx/cy/r) as "0.0..1.0 in gradient space", with no
//! settable field anywhere in the schema to opt into absolute pixel
//! space (unlike SVG's `gradientUnits`, which the SVG output here does
//! use). So unlike the SVG generator — which positions gradients in
//! absolute canvas pixels — this emits normalized 0..1 bounding-box-style
//! coordinates. Not verified against a real MSX renderer (the compiler
//! needs a newer Rust toolchain than was available while building this),
//! so treat the gradient direction/radius mapping as a reasoned best
//! guess pending a real render to confirm against.

use crate::error::QrError;
use crate::generate::{
    circle_path, frame_bg_radius, frame_geom, is_in_finder, module_path, rounded_rect_path,
    CornerDotStyle, CornerSquareStyle, FrameGeom, FrameOptions, GenerateOptions,
    GradientDirection, GradientOptions,
};

/// Render `opts` as MSX DixScript source text instead of SVG.
///
/// Takes the already-computed QR module matrix, same as `render_svg` —
/// call sites resolve `opts.data` into a matrix once and can feed it to
/// either renderer.
pub fn render_msx(matrix: &[Vec<bool>], qr_w: usize, opts: &GenerateOptions) -> Result<String, QrError> {
    if let Some(ref logo) = opts.logo {
        let _ = logo; // acknowledged, refused below regardless of its contents
        return Err(QrError::UnsupportedFeature(
            "logo embedding — MSX v0.1 has no raster/image element yet. \
             Drop the logo, or export as SVG/PNG instead.".to_string(),
        ));
    }

    let quiet: usize = if opts.margin { 4 } else { 0 };
    let total = qr_w + 2 * quiet;
    let ms = opts.size as f32 / total as f32;
    let qr_px = ms * total as f32;

    let geom = opts.frame.as_ref()
        .map(|f| frame_geom(f.style, !f.text.is_empty()))
        .unwrap_or(FrameGeom { pad_x: 0.0, pad_y_top: 0.0, pad_y_bot: 0.0 });

    let scene_w = qr_px + geom.pad_x * 2.0;
    let scene_h = qr_px + geom.pad_y_top + geom.pad_y_bot;

    let qr_area_x = geom.pad_x;
    let qr_area_y = geom.pad_y_top;
    let mod_ox = qr_area_x + quiet as f32 * ms;
    let mod_oy = qr_area_y + quiet as f32 * ms;

    let eye_tl = (mod_ox, mod_oy);
    let eye_tr = (mod_ox + (qr_w as f32 - 7.0) * ms, mod_oy);
    let eye_bl = (mod_ox, mod_oy + (qr_w as f32 - 7.0) * ms);

    let use_grad = opts.gradient.is_some();
    let data_fill: String = if use_grad { "url(#midQrGrad)".to_string() } else { opts.dark_color.clone() };
    let eye_outer: String = if let Some(ref e) = opts.eye_color {
        e.outer.clone()
    } else if use_grad {
        "url(#midQrGrad)".to_string()
    } else {
        opts.dark_color.clone()
    };
    let eye_inner: String = if let Some(ref e) = opts.eye_color {
        e.inner.clone()
    } else if use_grad {
        "url(#midQrGrad)".to_string()
    } else {
        opts.dark_color.clone()
    };

    let mut elements = String::new();

    // ① Background — same corner-radius-matching fix as the SVG renderer,
    // so a rounded frame style doesn't show a square canvas behind it.
    let bg_radius = frame_bg_radius(opts.frame.as_ref().map(|f| f.style));
    push_rect(&mut elements, 0.0, 0.0, scene_w, scene_h, bg_radius, &opts.light_color);

    // ② Frame background
    if let Some(ref frame) = opts.frame {
        push_frame_bg(&mut elements, scene_w, scene_h, qr_area_x, qr_area_y, qr_px, frame, &opts.light_color);
    }

    // ③ Data modules — one combined path, exactly like the SVG version
    let mut data_path = String::with_capacity(qr_w * qr_w * 28);
    for row in 0..qr_w {
        for col in 0..qr_w {
            if is_in_finder(row, col, qr_w) { continue; }
            if !matrix[row][col] { continue; }
            let x = mod_ox + col as f32 * ms;
            let y = mod_oy + row as f32 * ms;
            data_path.push_str(&module_path(x, y, ms, opts.module_style));
            data_path.push(' ');
        }
    }
    if !data_path.is_empty() {
        push_path(&mut elements, data_path.trim_end(), &data_fill, None);
    }

    // ④ Finder pattern eyes
    for (ox, oy) in [eye_tl, eye_tr, eye_bl] {
        push_finder(&mut elements, ox, oy, ms, opts.corner_square_style, opts.corner_dot_style, &eye_outer, &eye_inner);
    }

    // ⑤ Frame text (skip the logo step entirely — refused above)
    if let Some(ref frame) = opts.frame {
        push_frame_text(&mut elements, scene_w, scene_h, qr_area_y, qr_px, frame);
    }

    // ── Defs (gradient) ──────────────────────────────────────────────────
    let mut defs = String::new();
    if let Some(ref grad) = opts.gradient {
        defs.push_str(&build_gradient_def_msx("midQrGrad", grad));
    }

    Ok(format!(
        "// Generated by mid-qr — https://github.com/MidManStudio/mid_qr_code_lib\n\
         // Do not edit by hand; re-run the generator to update.\n\
         \n\
         @CONFIG(\n\
         \x20 version  -> \"1.0.0\"\n\
         \x20 features -> \"data\"\n\
         )\n\
         \n\
         @DATA(\n\
         \x20 scene: {{ width = {sw:.3}, height = {sh:.3}, background = \"none\" }}\n\
         \n\
         {defs_block}\
         \x20 elements::\n\
         {elements}\
         )\n",
        sw = scene_w,
        sh = scene_h,
        defs_block = if defs.is_empty() {
            String::new()
        } else {
            format!(" defs::\n{defs}\n")
        },
        elements = elements,
    ))
}

// ── Element emitters ────────────────────────────────────────────────────────

fn push_rect(out: &mut String, x: f32, y: f32, w: f32, h: f32, rx: f32, fill: &str) {
    if rx > 0.0 {
        out.push_str(&format!(
            "    {{ type = \"rect\", x = {x:.3}, y = {y:.3}, width = {w:.3}, height = {h:.3}, rx = {rx:.3}, style = {{ fill = \"{fill}\" }} }}\n"
        ));
    } else {
        out.push_str(&format!(
            "    {{ type = \"rect\", x = {x:.3}, y = {y:.3}, width = {w:.3}, height = {h:.3}, style = {{ fill = \"{fill}\" }} }}\n"
        ));
    }
}

fn push_rect_stroke(out: &mut String, x: f32, y: f32, w: f32, h: f32, rx: f32, stroke: &str, stroke_width: f32) {
    let rx_part = if rx > 0.0 { format!(", rx = {rx:.3}") } else { String::new() };
    out.push_str(&format!(
        "    {{ type = \"rect\", x = {x:.3}, y = {y:.3}, width = {w:.3}, height = {h:.3}{rx_part}, style = {{ fill = \"none\", stroke = \"{stroke}\", stroke_width = {stroke_width:.3} }} }}\n"
    ));
}

fn push_path(out: &mut String, d: &str, fill: &str, fill_rule: Option<&str>) {
    let rule_part = fill_rule.map(|r| format!(", fill_rule = \"{r}\"")).unwrap_or_default();
    out.push_str(&format!(
        "    {{ type = \"path\", d = \"{d}\", style = {{ fill = \"{fill}\"{rule_part} }} }}\n"
    ));
}

fn push_finder(
    out: &mut String,
    ox: f32, oy: f32, ms: f32,
    csq: CornerSquareStyle, cdot: CornerDotStyle,
    outer_fill: &str, inner_fill: &str,
) {
    let outer_d = match csq {
        CornerSquareStyle::Square => {
            let op = format!("M{:.3} {:.3}H{:.3}V{:.3}H{:.3}Z", ox, oy, ox + 7.0 * ms, oy + 7.0 * ms, ox);
            let ip = format!("M{:.3} {:.3}H{:.3}V{:.3}H{:.3}Z", ox + ms, oy + ms, ox + 6.0 * ms, oy + 6.0 * ms, ox + ms);
            format!("{op}{ip}")
        }
        CornerSquareStyle::ExtraRounded => {
            format!(
                "{}{}",
                rounded_rect_path(ox, oy, 7.0 * ms, 7.0 * ms, ms * 1.4),
                rounded_rect_path(ox + ms, oy + ms, 5.0 * ms, 5.0 * ms, ms * 0.8),
            )
        }
        CornerSquareStyle::Dot => {
            let cx = ox + 3.5 * ms;
            let cy = oy + 3.5 * ms;
            format!("{}{}", circle_path(cx, cy, 3.5 * ms), circle_path(cx, cy, 2.5 * ms))
        }
    };
    push_path(out, &outer_d, outer_fill, Some("evenodd"));

    let cx = ox + 3.5 * ms;
    let cy = oy + 3.5 * ms;
    match cdot {
        CornerDotStyle::Square => push_rect(out, ox + 2.0 * ms, oy + 2.0 * ms, 3.0 * ms, 3.0 * ms, 0.0, inner_fill),
        CornerDotStyle::Dot => {
            out.push_str(&format!(
                "    {{ type = \"circle\", cx = {cx:.3}, cy = {cy:.3}, r = {r:.3}, style = {{ fill = \"{inner_fill}\" }} }}\n",
                r = 1.5 * ms
            ));
        }
    }
}

fn push_frame_bg(out: &mut String, scene_w: f32, scene_h: f32, qr_x: f32, qr_y: f32, qr_size: f32, opts: &FrameOptions, light: &str) {
    if opts.style == 0 { return; }
    let ip = 6.0_f32;
    let wx = qr_x - ip;
    let wy = qr_y - ip;
    let ww = qr_size + ip * 2.0;
    let wh = qr_size + ip * 2.0;

    match opts.style {
        1 | 3 => {
            push_rect(out, 0.0, 0.0, scene_w, scene_h, 0.0, &opts.color);
            push_rect(out, wx, wy, ww, wh, 0.0, light);
        }
        2 | 4 => {
            let r = 22.0_f32;
            push_rect(out, 0.0, 0.0, scene_w, scene_h, r, &opts.color);
            push_rect(out, wx, wy, ww, wh, r * 0.5, light);
        }
        5 => {
            push_rect_stroke(out, wx - 3.0, wy - 3.0, ww + 6.0, wh + 6.0, 0.0, &opts.color, 4.0);
            push_rect(out, wx, wy, ww, wh, 0.0, light);
            let bw = ww * 0.78;
            let bx = (scene_w - bw) * 0.5;
            let by = qr_y + qr_size + 10.0;
            push_rect(out, bx, by, bw, 44.0, 22.0, &opts.color);
        }
        6 => {
            let r = 14.0_f32;
            push_rect_stroke(out, wx - 3.0, wy - 3.0, ww + 6.0, wh + 6.0, r, &opts.color, 4.0);
            push_rect(out, wx, wy, ww, wh, r * 0.6, light);
            let bw = ww * 0.78;
            let bx = (scene_w - bw) * 0.5;
            let by = qr_y + qr_size + 10.0;
            push_rect(out, bx, by, bw, 44.0, 22.0, &opts.color);
        }
        7 => push_rect_stroke(out, 3.0, 3.0, scene_w - 6.0, scene_h - 6.0, 0.0, &opts.color, 6.0),
        8 => {
            push_rect_stroke(out, 2.0, 2.0, scene_w - 4.0, scene_h - 4.0, 0.0, &opts.color, 3.0);
            push_rect_stroke(out, 8.0, 8.0, scene_w - 16.0, scene_h - 16.0, 0.0, &opts.color, 2.0);
        }
        _ => {}
    }
}

fn push_frame_text(out: &mut String, scene_w: f32, scene_h: f32, qr_y: f32, qr_size: f32, opts: &FrameOptions) {
    if opts.style == 0 || opts.text.is_empty() { return; }

    let (tx, ty) = match opts.style {
        3 | 4 => (scene_w * 0.5, scene_h - qr_y - qr_size * 0.5),
        5 | 6 => {
            let ip = 6.0_f32;
            let wh = qr_size + ip * 2.0;
            let by = qr_y - ip + wh + 10.0;
            (scene_w * 0.5, by + 44.0 * 0.5)
        }
        7 | 8 => return,
        _ => (scene_w * 0.5, scene_h - 26.0),
    };

    // No letter_spacing field in MSX's text style — see module doc comment.
    out.push_str(&format!(
        "    {{ type = \"text\", x = {tx:.3}, y = {ty:.3}, content = \"{content}\", \
         style = {{ fill = \"{fill}\", font_family = \"Arial,Helvetica,sans-serif\", \
         font_size = 15, font_weight = \"bold\", text_anchor = \"middle\", dominant_baseline = \"middle\" }} }}\n",
        content = escape_msx_string(&opts.text),
        fill = opts.text_color,
    ));
}

fn build_gradient_def_msx(id: &str, opts: &GradientOptions) -> String {
    let c1 = &opts.color1;
    let c2 = &opts.color2;
    let stops = format!(
        "[ {{ offset = 0.0, color = \"{c1}\" }}, {{ offset = 1.0, color = \"{c2}\" }} ]"
    );
    match opts.direction {
        GradientDirection::Radial => format!(
            "   {{ type = \"radial_gradient\", id = \"{id}\", cx = 0.5, cy = 0.5, r = 0.5, stops = {stops} }}\n"
        ),
        GradientDirection::LinearX => format!(
            "   {{ type = \"linear_gradient\", id = \"{id}\", x1 = 0.0, y1 = 0.0, x2 = 1.0, y2 = 0.0, stops = {stops} }}\n"
        ),
        GradientDirection::LinearY => format!(
            "   {{ type = \"linear_gradient\", id = \"{id}\", x1 = 0.0, y1 = 0.0, x2 = 0.0, y2 = 1.0, stops = {stops} }}\n"
        ),
        GradientDirection::Diagonal => format!(
            "   {{ type = \"linear_gradient\", id = \"{id}\", x1 = 0.0, y1 = 0.0, x2 = 1.0, y2 = 1.0, stops = {stops} }}\n"
        ),
    }
}

/// Escape a string for embedding in an MSX/DixScript string literal.
fn escape_msx_string(s: &str) -> String {
    s.replace('\\', "\\\\").replace('"', "\\\"")
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::generate::ModuleStyle;
    use qrcode::{QrCode, Color as QrColor, EcLevel};

    fn matrix_for(data: &str) -> (Vec<Vec<bool>>, usize) {
        let code = QrCode::with_error_correction_level(data.as_bytes(), EcLevel::M).unwrap();
        let w = code.width();
        let colors = code.into_colors();
        let matrix = colors.chunks(w).map(|r| r.iter().map(|c| *c == QrColor::Dark).collect()).collect();
        (matrix, w)
    }

    fn base_opts(data: &str) -> GenerateOptions {
        GenerateOptions { data: data.to_string(), ..Default::default() }
    }

    #[test]
    fn basic_msx_has_structure() {
        let (matrix, w) = matrix_for("https://example.com");
        let msx = render_msx(&matrix, w, &base_opts("https://example.com")).unwrap();
        assert!(msx.contains("@CONFIG("));
        assert!(msx.contains("@DATA("));
        assert!(msx.contains("elements::"));
        assert!(msx.contains("type = \"path\""));
    }

    #[test]
    fn logo_is_refused() {
        let (matrix, w) = matrix_for("test");
        let mut o = base_opts("test");
        o.logo = Some(crate::generate::LogoOptions {
            url: "data:image/png;base64,AAAA".to_string(),
            size_ratio: 0.2,
            border: None,
        });
        let result = render_msx(&matrix, w, &o);
        assert!(matches!(result, Err(QrError::UnsupportedFeature(_))));
    }

    #[test]
    fn gradient_adds_defs() {
        let (matrix, w) = matrix_for("test");
        let mut o = base_opts("test");
        o.gradient = Some(GradientOptions {
            direction: GradientDirection::Diagonal,
            color1: "#ff0000".to_string(),
            color2: "#0000ff".to_string(),
        });
        let msx = render_msx(&matrix, w, &o).unwrap();
        assert!(msx.contains("defs::"));
        assert!(msx.contains("linear_gradient"));
        assert!(msx.contains("url(#midQrGrad)"));
    }

    #[test]
    fn dot_module_style_generates() {
        let (matrix, w) = matrix_for("test");
        let mut o = base_opts("test");
        o.module_style = ModuleStyle::Dot;
        render_msx(&matrix, w, &o).unwrap();
    }

    #[test]
    fn frame_text_generates() {
        let (matrix, w) = matrix_for("test");
        let mut o = base_opts("test");
        o.frame = Some(FrameOptions {
            style: 1,
            color: "#1a1a2e".to_string(),
            text: "Scan Me!".to_string(),
            text_color: "#ffffff".to_string(),
        });
        let msx = render_msx(&matrix, w, &o).unwrap();
        assert!(msx.contains("Scan Me!"));
    }
}
