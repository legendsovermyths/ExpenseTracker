// The house style for AI icons. Shared by the `ai` Edge Function and
// supabase/tests/icon-lab.mjs (prompt tuning against the real model), so
// plain JavaScript that both Deno and Node can import.
//
// The user only supplies the subject ("surfboard", "chai"). Everything about
// the look is fixed here so every icon in the app shares one style: a solid
// black glyph on white, which the SDK traces into a single SVG path and the
// app tints like its built-in icons. FLUX follows positive description far
// better than "don't" lists, so the style is described first and the short
// exclusion list comes last.

export const MAX_SUBJECT_CHARS = 60;

// Leading/trailing filler people type that only fights the template.
const FILLER_RE = [
  /^(please\s+)?(make|create|draw|generate|design|give me)\s+(me\s+)?/i,
  /^(an?\s+)?(simple\s+|minimal(ist)?\s+|cute\s+|nice\s+)?(icon|logo|symbol|glyph|emoji|picture|image|drawing)\s+(of|for)\s+/i,
  /\s+(icon|logo|symbol|glyph|emoji)$/i,
  /^(an?|the)\s+/i,
];

/**
 * Normalise what the user typed into a short subject.
 * @param {unknown} raw
 * @returns {{ subject: string } | { error: string, status: number }}
 */
export function cleanSubject(raw) {
  if (typeof raw !== "string") return { error: "prompt must be a string", status: 400 };
  let s = raw
    .normalize("NFKC")
    .replace(/[^\p{L}\p{M}\p{N}\s'&,./()-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  for (const re of FILLER_RE) s = s.replace(re, "").trim();
  if (s.length > MAX_SUBJECT_CHARS) return { error: "prompt is too long", status: 413 };
  if (!/\p{L}/u.test(s)) return { error: "Describe the icon in a few words", status: 400 };
  return { subject: s };
}

/** @param {string} subject */
export function iconPrompt(subject) {
  return [
    `A minimalist pictogram icon representing "${subject}".`,
    `Style: one bold, solid black (#000000) glyph on a plain, pure white (#FFFFFF) background, in the spirit of Apple SF Symbols and Google Material Symbols (filled). A flat 2D vector look built from a few simple geometric shapes, with smooth confident curves, softly rounded corners and a single consistent heavy stroke weight. Small inner details are drawn as clean white cut-outs inside the black shape rather than as thin lines, so the icon still reads clearly at 24 pixels.`,
    `Subject: show the most familiar, everyday form of it, front or side view, instantly recognisable from its silhouette alone. If it is an abstract idea (like rent, salary or savings), use its most common visual symbol.`,
    `Composition: exactly one subject, centred, filling about 70% of the square canvas with an even empty white margin on every side.`,
    `Exactly two flat colours, black and white. No grey, shading, gradients, texture, shadows, 3D, outline frame, circle or badge behind it, background scenery, text, letters or numbers.`,
  ].join("\n\n");
}
