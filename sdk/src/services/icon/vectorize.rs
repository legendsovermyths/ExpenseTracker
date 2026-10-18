//! Turns a generated black-on-white icon image into one SVG path on the same
//! 24×24 grid as the app's built-in icons.
//!
//! decode → flatten alpha onto white → downscale → Otsu threshold (inverting
//! white-on-black art) → drop specks / fill pinholes → trace splines →
//! centre the glyph in a 20×20 box with a 2-unit margin → one evenodd path.

use image::{imageops::FilterType, GrayImage, ImageReader, Luma};
use std::io::Cursor;
use visioncortex::{BinaryImage, CompoundPath, CompoundPathElement, PathSimplifyMode, PointF64};

/// Working resolution. FLUX sends 512²; tracing at 384 keeps detail for a
/// 24-unit grid while staying fast on a phone.
const WORK: u32 = 384;
const MAX_INPUT_SIDE: u32 = 4096;
/// Ink blobs or holes smaller than this share of the canvas are noise.
const SPECK_RATIO: f64 = 0.0012;
/// Above this ink coverage the picture is a photo or a filled card, not a glyph.
const MAX_COVERAGE: f64 = 0.62;
/// Must stay under the `icon.path` CHECK in Supabase (16384).
pub const MAX_PATH_CHARS: usize = 12_000;
const MAX_SEGMENTS: usize = 900;
const GRID: f64 = 24.0;
const MARGIN: f64 = 2.0;

#[derive(Debug, PartialEq, Eq)]
pub enum VectorizeError {
    Decode,
    Empty,
    NotAnIcon,
    TooComplex,
}

impl std::fmt::Display for VectorizeError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(match self {
            VectorizeError::Decode => "Couldn't read the generated image",
            VectorizeError::Empty => "The generated image was blank",
            VectorizeError::NotAnIcon => "That came out as a picture, not an icon. Try again",
            VectorizeError::TooComplex => "That icon is too detailed. Try a simpler description",
        })
    }
}

impl std::error::Error for VectorizeError {}

#[derive(Debug, Clone, PartialEq)]
pub struct VectorIcon {
    /// Absolute-coordinate SVG path data in a 0 0 24 24 viewBox; render
    /// with fill-rule="evenodd".
    pub path: String,
    pub subpaths: usize,
    pub segments: usize,
}

pub fn vectorize(bytes: &[u8]) -> Result<VectorIcon, VectorizeError> {
    let gray = decode(bytes)?;
    let mut ink = threshold(&gray);
    let side = ink.width * ink.height;
    let min_area = ((side as f64) * SPECK_RATIO).max(4.0) as usize;
    clean(&mut ink, min_area);

    let mut count = 0usize;
    for y in 0..ink.height {
        for x in 0..ink.width {
            count += ink.get_pixel(x, y) as usize;
        }
    }
    if count == 0 {
        return Err(VectorizeError::Empty);
    }
    if count as f64 / side as f64 > MAX_COVERAGE {
        return Err(VectorizeError::NotAnIcon);
    }

    // Coarser settings until the path fits; a glyph that still doesn't fit
    // is too busy to read at 24px anyway.
    for (segment_length, precision) in [(4.0, 2u32), (6.0, 1), (9.0, 1)] {
        let traced = trace(&ink, min_area, segment_length);
        let icon = emit(&traced, &ink, precision)?;
        if icon.path.len() <= MAX_PATH_CHARS && icon.segments <= MAX_SEGMENTS {
            return Ok(icon);
        }
    }
    Err(VectorizeError::TooComplex)
}

fn decode(bytes: &[u8]) -> Result<GrayImage, VectorizeError> {
    let mut reader = ImageReader::new(Cursor::new(bytes))
        .with_guessed_format()
        .map_err(|_| VectorizeError::Decode)?;
    let mut limits = image::Limits::default();
    limits.max_image_width = Some(MAX_INPUT_SIDE);
    limits.max_image_height = Some(MAX_INPUT_SIDE);
    limits.max_alloc = Some(128 * 1024 * 1024);
    reader.limits(limits);
    let img = reader.decode().map_err(|_| VectorizeError::Decode)?;
    if img.width() < 16 || img.height() < 16 {
        return Err(VectorizeError::Decode);
    }

    // Transparent pixels count as white background.
    let la = img.to_luma_alpha8();
    let mut gray = GrayImage::new(la.width(), la.height());
    for (x, y, p) in la.enumerate_pixels() {
        let (l, a) = (p[0] as u32, p[1] as u32);
        gray.put_pixel(x, y, Luma([(255 - (a * (255 - l)) / 255) as u8]));
    }

    let (w, h) = gray.dimensions();
    let scale = WORK as f64 / w.max(h) as f64;
    if scale < 1.0 {
        let nw = ((w as f64 * scale).round() as u32).max(1);
        let nh = ((h as f64 * scale).round() as u32).max(1);
        gray = image::imageops::resize(&gray, nw, nh, FilterType::Triangle);
    }
    Ok(gray)
}

fn otsu(gray: &GrayImage) -> u8 {
    let mut hist = [0u64; 256];
    for p in gray.pixels() {
        hist[p[0] as usize] += 1;
    }
    let total: u64 = hist.iter().sum();
    let sum_all: f64 = hist.iter().enumerate().map(|(i, &c)| i as f64 * c as f64).sum();
    let (mut w_b, mut sum_b, mut best, mut best_t) = (0u64, 0f64, -1f64, 128u8);
    for t in 0..256 {
        w_b += hist[t];
        if w_b == 0 {
            continue;
        }
        let w_f = total - w_b;
        if w_f == 0 {
            break;
        }
        sum_b += t as f64 * hist[t] as f64;
        let m_b = sum_b / w_b as f64;
        let m_f = (sum_all - sum_b) / w_f as f64;
        let between = w_b as f64 * w_f as f64 * (m_b - m_f).powi(2);
        if between > best {
            best = between;
            best_t = t as u8;
        }
    }
    // A near-uniform image has no real split; keep the cut mid-grey so a
    // blank canvas stays blank instead of turning JPEG noise into ink.
    best_t.clamp(64, 192)
}

fn threshold(gray: &GrayImage) -> BinaryImage {
    let t = otsu(gray);
    let (w, h) = gray.dimensions();
    let mut ink = BinaryImage::new_w_h(w as usize, h as usize);
    for (x, y, p) in gray.enumerate_pixels() {
        ink.set_pixel(x as usize, y as usize, p[0] <= t);
    }

    // The background is whatever fills most of the border. If that's "ink",
    // the art is white-on-black: flip it.
    let mut border = 0usize;
    let mut dark = 0usize;
    for x in 0..ink.width {
        for y in [0, ink.height - 1] {
            border += 1;
            dark += ink.get_pixel(x, y) as usize;
        }
    }
    for y in 0..ink.height {
        for x in [0, ink.width - 1] {
            border += 1;
            dark += ink.get_pixel(x, y) as usize;
        }
    }
    if dark * 2 > border {
        ink = ink.negative();
    }
    ink
}

/// Remove ink specks, then fill pinholes (small enclosed background).
fn clean(ink: &mut BinaryImage, min_area: usize) {
    for c in ink.to_clusters(false).iter() {
        if c.size() < min_area {
            for p in c.points.iter() {
                ink.set_pixel(p.x as usize, p.y as usize, false);
            }
        }
    }
    let (w, h) = (ink.width as i32, ink.height as i32);
    for c in ink.negative().to_clusters(false).iter() {
        let touches_edge =
            c.rect.left <= 0 || c.rect.top <= 0 || c.rect.right >= w || c.rect.bottom >= h;
        if !touches_edge && c.size() < min_area {
            for p in c.points.iter() {
                ink.set_pixel(p.x as usize, p.y as usize, true);
            }
        }
    }
}

fn trace(ink: &BinaryImage, min_area: usize, segment_length: f64) -> Vec<CompoundPath> {
    ink.to_clusters(false)
        .iter()
        .filter(|c| c.size() >= min_area)
        .map(|c| {
            c.to_compound_path(
                PathSimplifyMode::Spline,
                60f64.to_radians(),
                segment_length,
                10,
                45f64.to_radians(),
            )
        })
        .collect()
}

fn ink_bounds(ink: &BinaryImage) -> Option<(usize, usize, usize, usize)> {
    let (mut x0, mut y0, mut x1, mut y1) = (usize::MAX, usize::MAX, 0, 0);
    for y in 0..ink.height {
        for x in 0..ink.width {
            if ink.get_pixel(x, y) {
                x0 = x0.min(x);
                y0 = y0.min(y);
                x1 = x1.max(x + 1);
                y1 = y1.max(y + 1);
            }
        }
    }
    (x0 != usize::MAX).then_some((x0, y0, x1, y1))
}

fn fmt_num(v: f64, precision: u32) -> String {
    let m = 10f64.powi(precision as i32);
    let r = (v * m).round() / m;
    if r == 0.0 {
        "0".into()
    } else {
        format!("{r}")
    }
}

type P = (f64, f64);

enum Seg {
    L(P),
    C(P, P, P),
}

/// Distance from `p` to segment a–b, in grid units.
fn off_line(p: P, a: P, b: P) -> f64 {
    let (dx, dy) = (b.0 - a.0, b.1 - a.1);
    let len2 = dx * dx + dy * dy;
    if len2 < 1e-12 {
        return ((p.0 - a.0).powi(2) + (p.1 - a.1).powi(2)).sqrt();
    }
    let t = (((p.0 - a.0) * dx + (p.1 - a.1) * dy) / len2).clamp(0.0, 1.0);
    ((p.0 - a.0 - t * dx).powi(2) + (p.1 - a.1 - t * dy).powi(2)).sqrt()
}

/// Under half a source pixel: invisible at any size the app draws.
const STRAIGHT_EPS: f64 = 0.025;

/// Curves that are really straight become lines, and runs of collinear
/// lines merge, so straight edges stay crisp and the path stays small.
fn simplify(start: P, segs: Vec<Seg>) -> Vec<Seg> {
    let mut out: Vec<Seg> = Vec::with_capacity(segs.len());
    let mut cur = start;
    // Start of the trailing line run in `out`, plus every corner merged away
    // so far: all must stay on the merged line, so gentle arcs don't drift.
    let mut run_start: Option<P> = None;
    let mut dropped: Vec<P> = Vec::new();
    for s in segs {
        let s = match s {
            Seg::C(c1, c2, e) if off_line(c1, cur, e) < STRAIGHT_EPS && off_line(c2, cur, e) < STRAIGHT_EPS => Seg::L(e),
            other => other,
        };
        match s {
            Seg::L(e) => {
                if let (Some(rs), Some(Seg::L(prev))) = (run_start, out.last_mut()) {
                    let p = *prev;
                    if off_line(p, rs, e) < STRAIGHT_EPS && dropped.iter().all(|&d| off_line(d, rs, e) < STRAIGHT_EPS) {
                        dropped.push(p);
                        *prev = e;
                        cur = e;
                        continue;
                    }
                }
                run_start = Some(cur);
                dropped.clear();
                out.push(Seg::L(e));
                cur = e;
            }
            Seg::C(c1, c2, e) => {
                run_start = None;
                dropped.clear();
                out.push(Seg::C(c1, c2, e));
                cur = e;
            }
        }
    }
    // A closing line back to the start is implied by Z.
    if let Some(Seg::L(e)) = out.last() {
        if (e.0 - start.0).abs() < 1e-9 && (e.1 - start.1).abs() < 1e-9 {
            out.pop();
        }
    }
    out
}

fn emit(paths: &[CompoundPath], ink: &BinaryImage, precision: u32) -> Result<VectorIcon, VectorizeError> {
    let (x0, y0, x1, y1) = ink_bounds(ink).ok_or(VectorizeError::Empty)?;
    let (bw, bh) = ((x1 - x0) as f64, (y1 - y0) as f64);
    let k = (GRID - 2.0 * MARGIN) / bw.max(bh);
    // Centre the glyph's box on the grid.
    let ox = GRID / 2.0 - (x0 as f64 + bw / 2.0) * k;
    let oy = GRID / 2.0 - (y0 as f64 + bh / 2.0) * k;
    let map = |p: &PointF64| ((p.x * k + ox).clamp(0.0, GRID), (p.y * k + oy).clamp(0.0, GRID));
    let pt = |p: P| format!("{} {}", fmt_num(p.0, precision), fmt_num(p.1, precision));

    let mut out = String::new();
    let (mut subpaths, mut segments) = (0usize, 0usize);
    for compound in paths {
        for el in compound.iter() {
            let pts: Vec<P> = match el {
                CompoundPathElement::Spline(s) => s.points.iter().map(map).collect(),
                CompoundPathElement::PathF64(p) => p.path.iter().map(map).collect(),
                CompoundPathElement::PathI32(p) => p.path.iter().map(|q| map(&q.to_point_f64())).collect(),
            };
            let is_spline = matches!(el, CompoundPathElement::Spline(_));
            if pts.len() < if is_spline { 4 } else { 3 } {
                continue;
            }
            let raw: Vec<Seg> = if is_spline {
                pts[1..].chunks_exact(3).map(|c| Seg::C(c[0], c[1], c[2])).collect()
            } else {
                pts[1..].iter().map(|&q| Seg::L(q)).collect()
            };
            let segs = simplify(pts[0], raw);
            if segs.is_empty() {
                continue;
            }
            if !out.is_empty() {
                out.push(' ');
            }
            out.push('M');
            out.push_str(&pt(pts[0]));
            for s in &segs {
                match *s {
                    Seg::L(e) => {
                        out.push('L');
                        out.push_str(&pt(e));
                    }
                    Seg::C(c1, c2, e) => {
                        out.push_str(&format!("C{} {} {}", pt(c1), pt(c2), pt(e)));
                    }
                }
            }
            segments += segs.len();
            out.push('Z');
            subpaths += 1;
        }
    }
    if subpaths == 0 {
        return Err(VectorizeError::Empty);
    }
    Ok(VectorIcon { path: out, subpaths, segments })
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::{ImageFormat, Rgba, RgbaImage};

    const COFFEE: &[u8] = include_bytes!("../../../tests/fixtures/coffee-cup.jpg");

    fn png(img: &RgbaImage) -> Vec<u8> {
        let mut buf = Cursor::new(Vec::new());
        img.write_to(&mut buf, ImageFormat::Png).unwrap();
        buf.into_inner()
    }

    fn canvas(bg: [u8; 4]) -> RgbaImage {
        RgbaImage::from_pixel(512, 512, Rgba(bg))
    }

    /// Ring centred at (cx, cy): outer radius r1, hole radius r0.
    fn ring(img: &mut RgbaImage, cx: f64, cy: f64, r0: f64, r1: f64, fg: [u8; 4]) {
        for (x, y, p) in img.enumerate_pixels_mut() {
            let d = ((x as f64 - cx).powi(2) + (y as f64 - cy).powi(2)).sqrt();
            if d <= r1 && d >= r0 {
                *p = Rgba(fg);
            }
        }
    }

    fn numbers(path: &str) -> Vec<f64> {
        path.split(|c: char| c.is_ascii_alphabetic() || c == ' ')
            .filter(|s| !s.is_empty())
            .map(|s| s.parse::<f64>().unwrap())
            .collect()
    }

    /// Mirrors the `icon_path_shape` CHECK in migration 0012.
    fn assert_db_safe(path: &str) {
        assert!(path.starts_with('M'), "{path}");
        assert!(path.len() <= 16384);
        assert!(path.chars().all(|c| "MmLlHhVvCcSsQqTtZz0123456789 .,eE+-".contains(c)), "{path}");
    }

    fn bounds(path: &str) -> (f64, f64, f64, f64) {
        let n = numbers(path);
        let xs: Vec<f64> = n.iter().step_by(2).copied().collect();
        let ys: Vec<f64> = n.iter().skip(1).step_by(2).copied().collect();
        let lo = |v: &[f64]| v.iter().copied().fold(f64::MAX, f64::min);
        let hi = |v: &[f64]| v.iter().copied().fold(f64::MIN, f64::max);
        (lo(&xs), lo(&ys), hi(&xs), hi(&ys))
    }

    fn preview(name: &str, path: &str) {
        let dir = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("target/icon-preview");
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(
            dir.join(format!("{name}.svg")),
            format!(r#"<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="240" height="240"><rect width="24" height="24" fill="white"/><path fill-rule="evenodd" d="{path}"/></svg>"#),
        )
        .unwrap();
    }

    const BLACK: [u8; 4] = [0, 0, 0, 255];
    const WHITE: [u8; 4] = [255, 255, 255, 255];

    #[test]
    fn traces_the_real_flux_coffee_cup() {
        let icon = vectorize(COFFEE).unwrap();
        preview("coffee-cup", &icon.path);
        assert_db_safe(&icon.path);
        assert!((1..=4).contains(&icon.subpaths), "{} subpaths", icon.subpaths);
        assert!(icon.segments > 4 && icon.segments < 200, "{} segments", icon.segments);
        let (x0, y0, x1, y1) = bounds(&icon.path);
        // Wider than tall: spans the 20-unit box horizontally, centred vertically.
        assert!(x0 >= 0.0 && x1 <= 24.0 && y0 >= 0.0 && y1 <= 24.0);
        assert!((x1 - x0) > 19.0, "width {}", x1 - x0);
        assert!(((y0 + y1) / 2.0 - 12.0).abs() < 1.0, "not centred: {y0}..{y1}");
    }

    #[test]
    fn is_deterministic() {
        assert_eq!(vectorize(COFFEE).unwrap(), vectorize(COFFEE).unwrap());
    }

    #[test]
    fn ring_keeps_its_hole_and_fills_the_box() {
        let mut img = canvas(WHITE);
        ring(&mut img, 256.0, 256.0, 80.0, 180.0, BLACK);
        let icon = vectorize(&png(&img)).unwrap();
        preview("ring", &icon.path);
        assert_db_safe(&icon.path);
        assert_eq!(icon.subpaths, 2, "{}", icon.path);
        let (x0, y0, x1, y1) = bounds(&icon.path);
        for (v, want) in [(x0, 2.0), (y0, 2.0), (x1, 22.0), (y1, 22.0)] {
            assert!((v - want).abs() < 0.6, "bounds {x0} {y0} {x1} {y1}");
        }
    }

    #[test]
    fn white_on_black_art_is_inverted() {
        let mut img = canvas(BLACK);
        ring(&mut img, 256.0, 256.0, 80.0, 180.0, WHITE);
        let icon = vectorize(&png(&img)).unwrap();
        assert_eq!(icon.subpaths, 2, "{}", icon.path);
    }

    #[test]
    fn transparent_background_counts_as_white() {
        let mut img = canvas([0, 0, 0, 0]);
        ring(&mut img, 256.0, 256.0, 80.0, 180.0, BLACK);
        assert_eq!(vectorize(&png(&img)).unwrap().subpaths, 2);
    }

    #[test]
    fn grey_ink_on_off_white_still_works() {
        let mut img = canvas([240, 238, 235, 255]);
        ring(&mut img, 256.0, 256.0, 80.0, 180.0, [70, 70, 70, 255]);
        assert_eq!(vectorize(&png(&img)).unwrap().subpaths, 2);
    }

    #[test]
    fn specks_and_pinholes_are_cleaned() {
        let mut img = canvas(WHITE);
        ring(&mut img, 256.0, 256.0, 80.0, 180.0, BLACK);
        for i in 0..40u32 {
            let (x, y) = ((i * 97) % 500 + 4, (i * 53) % 60 + 4);
            img.put_pixel(x, y, Rgba(BLACK)); // specks in the margin
            img.put_pixel(256 + (i % 6), 120 + (i % 3), Rgba(WHITE)); // pinholes in the ink
        }
        let icon = vectorize(&png(&img)).unwrap();
        assert_eq!(icon.subpaths, 2, "{}", icon.path);
    }

    #[test]
    fn small_glyph_is_scaled_up_and_centred() {
        let mut img = canvas(WHITE);
        ring(&mut img, 100.0, 400.0, 10.0, 40.0, BLACK);
        let (x0, y0, x1, y1) = bounds(&vectorize(&png(&img)).unwrap().path);
        assert!((x0 - 2.0).abs() < 0.8 && (x1 - 22.0).abs() < 0.8, "{x0} {x1}");
        assert!((y0 - 2.0).abs() < 0.8 && (y1 - 22.0).abs() < 0.8, "{y0} {y1}");
    }

    #[test]
    fn separate_shapes_stay_separate() {
        let mut img = canvas(WHITE);
        ring(&mut img, 150.0, 256.0, 0.0, 60.0, BLACK);
        ring(&mut img, 362.0, 256.0, 0.0, 60.0, BLACK);
        assert_eq!(vectorize(&png(&img)).unwrap().subpaths, 2);
    }

    #[test]
    fn island_inside_a_hole_is_kept() {
        let mut img = canvas(WHITE);
        ring(&mut img, 256.0, 256.0, 120.0, 200.0, BLACK);
        ring(&mut img, 256.0, 256.0, 0.0, 50.0, BLACK);
        assert_eq!(vectorize(&png(&img)).unwrap().subpaths, 3);
    }

    #[test]
    fn blank_images_are_rejected() {
        assert_eq!(vectorize(&png(&canvas(WHITE))), Err(VectorizeError::Empty));
        assert_eq!(vectorize(&png(&canvas(BLACK))), Err(VectorizeError::Empty));
        assert_eq!(vectorize(&png(&canvas([0, 0, 0, 0]))), Err(VectorizeError::Empty));
    }

    #[test]
    fn photo_like_images_are_rejected() {
        let mut img = canvas(WHITE);
        let mut s: u32 = 7;
        for p in img.pixels_mut() {
            s = s.wrapping_mul(1_103_515_245).wrapping_add(12345);
            let v = (s >> 16) as u8;
            *p = Rgba([v, v, v, 255]);
        }
        let r = vectorize(&png(&img));
        assert!(matches!(r, Err(VectorizeError::NotAnIcon) | Err(VectorizeError::TooComplex)), "{r:?}");
    }

    #[test]
    fn a_filled_card_is_not_an_icon() {
        let mut img = canvas(WHITE);
        for (x, y, p) in img.enumerate_pixels_mut() {
            if (8..504).contains(&x) && (8..504).contains(&y) && !((200..312).contains(&x) && (200..312).contains(&y)) {
                *p = Rgba(BLACK);
            }
        }
        assert_eq!(vectorize(&png(&img)), Err(VectorizeError::NotAnIcon));
    }

    #[test]
    fn busy_patterns_are_too_complex() {
        let mut img = canvas(WHITE);
        for (x, y, p) in img.enumerate_pixels_mut() {
            if (x / 9 + y / 9) % 2 == 0 && (40..472).contains(&x) && (40..472).contains(&y) {
                *p = Rgba(BLACK);
            }
        }
        assert_eq!(vectorize(&png(&img)), Err(VectorizeError::TooComplex));
    }

    #[test]
    fn garbage_and_oversized_inputs_are_decode_errors() {
        assert_eq!(vectorize(b"not an image"), Err(VectorizeError::Decode));
        assert_eq!(vectorize(&[]), Err(VectorizeError::Decode));
        assert_eq!(vectorize(&COFFEE[..COFFEE.len() / 3]), Err(VectorizeError::Decode));
        let tiny = RgbaImage::from_pixel(8, 8, Rgba(BLACK));
        assert_eq!(vectorize(&png(&tiny)), Err(VectorizeError::Decode));
        let huge = RgbaImage::from_pixel(5000, 20, Rgba(WHITE));
        assert_eq!(vectorize(&png(&huge)), Err(VectorizeError::Decode));
    }

    #[test]
    fn straight_edges_become_lines() {
        let mut img = canvas(WHITE);
        for (x, y, p) in img.enumerate_pixels_mut() {
            if (100..412).contains(&x) && (100..412).contains(&y) && !((200..312).contains(&x) && (200..312).contains(&y)) {
                *p = Rgba(BLACK);
            }
        }
        let icon = vectorize(&png(&img)).unwrap();
        preview("square-frame", &icon.path);
        assert_eq!(icon.subpaths, 2, "{}", icon.path);
        assert!(icon.path.contains('L'), "{}", icon.path);
        // Two squares: a handful of lines/corners each, not dozens of curves.
        assert!(icon.segments <= 24, "{} segments: {}", icon.segments, icon.path);
    }

    #[test]
    fn simplify_keeps_curves_and_merges_runs() {
        let segs = vec![
            Seg::C((1.0, 0.0), (2.0, 0.0), (3.0, 0.0)), // straight → line
            Seg::L((6.0, 0.0)),                          // collinear → merged
            Seg::C((7.0, 2.0), (8.0, 2.0), (9.0, 0.0)), // real curve
            Seg::L((0.0, 0.0)),                          // closes to start → dropped
        ];
        let out = simplify((0.0, 0.0), segs);
        assert_eq!(out.len(), 2);
        assert!(matches!(out[0], Seg::L((x, _)) if x == 6.0));
        assert!(matches!(out[1], Seg::C(..)));
        // A gentle arc of tiny lines must not collapse into one chord.
        let arc: Vec<Seg> = (1..=20)
            .map(|i| {
                let a = i as f64 * 0.05;
                Seg::L((10.0 * a.sin(), 10.0 - 10.0 * a.cos()))
            })
            .collect();
        assert!(simplify((0.0, 0.0), arc).len() > 3);
    }

    /// Traces every image `supabase/tests/icon-lab.mjs` produced and writes
    /// sheet.html: FLUX output beside the traced icon at hero and list size.
    #[test]
    #[ignore]
    fn icon_lab() {
        let Ok(dir) = std::env::var("ICON_LAB_DIR") else {
            eprintln!("set ICON_LAB_DIR");
            return;
        };
        let mut entries: Vec<_> = std::fs::read_dir(&dir)
            .unwrap()
            .filter_map(|e| e.ok().map(|e| e.path()))
            .filter(|p| matches!(p.extension().and_then(|e| e.to_str()), Some("jpg" | "png")))
            .collect();
        entries.sort();
        let mut rows = String::new();
        for p in entries {
            let name = p.file_stem().unwrap().to_string_lossy().to_string();
            let file = p.file_name().unwrap().to_string_lossy().to_string();
            let cell = match vectorize(&std::fs::read(&p).unwrap()) {
                Ok(icon) => {
                    println!("✓ {name}: {} subpaths, {} segments, {} bytes", icon.subpaths, icon.segments, icon.path.len());
                    let svg = |px: u32, fill: &str| {
                        format!(r#"<svg viewBox="0 0 24 24" width="{px}" height="{px}"><path fill="{fill}" fill-rule="evenodd" d="{}"/></svg>"#, icon.path)
                    };
                    format!(
                        r#"<div class="plate big">{}</div><div class="plate small">{}</div><div class="plate dark">{}</div><small>{} segs · {} B</small>"#,
                        svg(52, "#2C7A5C"), svg(20, "#C8392F"), svg(52, "#F2C14E"), icon.segments, icon.path.len()
                    )
                }
                Err(e) => {
                    println!("✗ {name}: {e}");
                    format!("<b class=err>{e}</b>")
                }
            };
            rows.push_str(&format!(r#"<div class="row"><img src="{file}"><div class="cells">{cell}</div><p>{name}</p></div>"#));
        }
        let html = format!(
            r#"<!doctype html><meta charset=utf-8><style>
body{{font:14px -apple-system;background:#f4f5f8;margin:24px;display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px}}
.row{{background:#fff;border-radius:16px;padding:12px;display:grid;grid-template-columns:120px 1fr;gap:12px;align-items:center}}
img{{width:120px;height:120px;border-radius:8px;border:1px solid #eee}}
.cells{{display:flex;gap:10px;align-items:center;flex-wrap:wrap}}
.plate{{display:grid;place-items:center;border-radius:22px}}
.big{{width:96px;height:96px;background:#2C7A5C20}}.small{{width:36px;height:36px;border-radius:10px;background:#C8392F20}}
.dark{{width:96px;height:96px;background:#1c1f26}}p{{grid-column:1/3;margin:0;color:#556}}small{{color:#99a}}.err{{color:#C8392F}}
</style>{rows}"#
        );
        std::fs::write(format!("{dir}/sheet.html"), html).unwrap();
        println!("wrote {dir}/sheet.html");
    }

    #[test]
    fn non_square_canvas_works() {
        let mut img = RgbaImage::from_pixel(800, 400, Rgba(WHITE));
        ring(&mut img, 400.0, 200.0, 50.0, 150.0, BLACK);
        let icon = vectorize(&png(&img)).unwrap();
        assert_eq!(icon.subpaths, 2);
        let (x0, y0, x1, y1) = bounds(&icon.path);
        assert!((x0 - 2.0).abs() < 0.8 && (y1 - 22.0).abs() < 0.8, "{x0} {y0} {x1} {y1}");
    }
}
