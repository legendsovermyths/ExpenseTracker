// Pure logic for the `split-import` Edge Function: chunking, the prompt and
// validation of the model's answer. Plain JavaScript so both Deno (the
// function) and Node (supabase/tests/split-import.test.mjs) can import it.
//
// Category ids are the device's local SQLite ids. The model only ever sees
// ids from the list the device sent, and anything else it returns is dropped.

export const CHUNK_DESCRIPTIONS = 40;
export const MAX_NEW_CATEGORIES = 10;
export const MAX_NEW_PER_CHUNK = 3;
const MAX_NAME_CHARS = 40;
const CONFIDENCE = new Set(["high", "medium", "low"]);
const ICON_RE = /^[a-z0-9-]{1,40}$/;

/**
 * Key used to treat "Swiggy 123", "SWIGGY" and "swiggy!" as one description.
 * @param {string} s
 */
export function normalizeDescription(s) {
  const base = String(s ?? "").toLowerCase().normalize("NFKC");
  const cleaned = base.replace(/[0-9]+/g, " ").replace(/[^\p{L}]+/gu, " ").trim();
  return cleaned || base.trim();
}

/** @param {string} s */
function normalizeName(s) {
  return String(s ?? "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

/** @param {string} s */
function titleCase(s) {
  return s
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(" ");
}

/**
 * Assigns a chunk number to every item. Items with the same normalised
 * description share a chunk so each description is sent once; a chunk holds
 * at most `size` distinct descriptions.
 * @template {{ description: string }} T
 * @param {T[]} items
 * @param {number} [size]
 * @returns {(T & { chunk: number })[]}
 */
export function assignChunks(items, size = CHUNK_DESCRIPTIONS) {
  /** @type {Map<string, number>} */
  const chunkOf = new Map();
  let distinct = 0;
  return items.map((it) => {
    const key = normalizeDescription(it.description);
    let chunk = chunkOf.get(key);
    if (chunk === undefined) {
      chunk = Math.floor(distinct / size);
      chunkOf.set(key, chunk);
      distinct++;
    }
    return { ...it, chunk };
  });
}

/**
 * Distinct descriptions in a chunk (first spelling wins), plus the index each
 * item maps to.
 * @param {{ description: string }[]} items
 */
export function distinctDescriptions(items) {
  /** @type {Map<string, number>} */
  const index = new Map();
  /** @type {string[]} */
  const descriptions = [];
  const itemIndex = items.map((it) => {
    const key = normalizeDescription(it.description);
    let i = index.get(key);
    if (i === undefined) {
      i = descriptions.length;
      index.set(key, i);
      descriptions.push(it.description);
    }
    return i;
  });
  return { descriptions, itemIndex };
}

/**
 * @typedef {{ id: number, name: string, parent_id: number | null }} Cat
 * @typedef {{ key: string, name: string, parent_id: number | null, icon: string }} NewCat
 * @typedef {{ category_id: number | null, subcategory_id: number | null,
 *             new_category_key: string | null, confidence: "high" | "medium" | "low" }} Result
 */

/** @param {Cat[]} categories */
export function categoryContext(categories) {
  const parents = categories.filter((c) => c.parent_id == null);
  return parents
    .map((p) => {
      const subs = categories.filter((c) => c.parent_id === p.id);
      const s = subs.length ? ` [${subs.map((c) => `${c.id}:${c.name}`).join(", ")}]` : "";
      return `${p.id}:${p.name}${s}`;
    })
    .join("\n");
}

/**
 * @param {Cat[]} categories
 * @param {string} merchants
 * @param {string[]} descriptions
 * @param {NewCat[]} proposed  new categories already proposed for this job
 */
export function buildPrompt(categories, merchants, descriptions, proposed) {
  const already = proposed.length
    ? `\nNew categories already proposed for this import (use "new_category" with their key instead of proposing a duplicate):\n${proposed
        .map((n) => `${n.key}:${n.name}${n.parent_id != null ? ` (under ${n.parent_id})` : ""}`)
        .join("\n")}\n`
    : "";
  return `You categorise a user's share of shared expenses (bill splits with friends) for an expense tracking app.

Available categories (format: id:name [subcategory_id:subcategory_name, ...]):
${categoryContext(categories)}
${already}
User's recent merchant history (description → category):
${merchants || "No history yet"}

Expenses to categorise (format: index|description):
${descriptions.map((d, i) => `${i}|${d.replace(/[\r\n|]+/g, " ")}`).join("\n")}

Return ONLY valid JSON in this exact format:
{
  "results": [
    { "i": 0, "category_id": 3, "subcategory_id": 7, "confidence": "high" },
    { "i": 1, "new_category": "pets", "confidence": "medium" }
  ],
  "new_categories": [
    { "key": "pets", "name": "Pets", "parent_id": null, "icon": "paw" }
  ]
}

Rules:
- Return one result for every index
- Use category_id and subcategory_id exactly from the available categories; never invent ids. subcategory_id is optional and must belong to category_id
- Prefer existing categories. Use the merchant history for consistent categorisation
- Only propose a new category when an expense clearly fits none of the existing ones. Propose at most ${MAX_NEW_PER_CHUNK}
- A new category's parent_id is null for a top-level category, or an existing top-level category id to make it a subcategory
- New category names are short and in Title Case, e.g. "Pets", "Gifts"
- icon is a MaterialCommunityIcons name, e.g. "paw", "gift-outline", "airplane"
- confidence is "high", "medium" or "low"`;
}

/**
 * Validates the model's JSON for one chunk. Unknown ids are dropped, a
 * subcategory given as category_id is moved under its parent, and new
 * categories are deduplicated against existing categories and against
 * `proposed` (which is updated in place).
 * @param {string | undefined | null} text
 * @param {number} count  number of descriptions sent
 * @param {Cat[]} categories
 * @param {NewCat[]} proposed
 * @returns {Result[]}  one result per description, index-aligned
 */
export function parseChunkResult(text, count, categories, proposed) {
  /** @type {Result[]} */
  const out = Array.from({ length: count }, () => ({
    category_id: null,
    subcategory_id: null,
    new_category_key: null,
    confidence: "low",
  }));
  /** @type {any} */
  let data;
  try {
    data = JSON.parse(String(text ?? ""));
  } catch {
    return out;
  }
  if (!data || typeof data !== "object") return out;

  const byId = new Map(categories.map((c) => [c.id, c]));
  const isParent = (/** @type {unknown} */ id) =>
    typeof id === "number" && byId.has(id) && byId.get(id).parent_id == null;

  // The model's keys → a key in `proposed`, or an existing category.
  /** @type {Map<string, { key: string } | { existing: Cat }>} */
  const keyMap = new Map();
  for (const p of proposed) keyMap.set(p.key, { key: p.key });
  const rawNew = Array.isArray(data.new_categories)
    ? data.new_categories.slice(0, MAX_NEW_PER_CHUNK)
    : [];
  for (const n of rawNew) {
    if (!n || typeof n.key !== "string" || typeof n.name !== "string") continue;
    const name = titleCase(n.name).slice(0, MAX_NAME_CHARS);
    const norm = normalizeName(name);
    if (!norm) continue;
    const parentId = isParent(n.parent_id) ? n.parent_id : null;
    const existing =
      categories.find((c) => normalizeName(c.name) === norm && (c.parent_id ?? null) === parentId) ??
      (parentId == null ? categories.find((c) => normalizeName(c.name) === norm) : undefined);
    if (existing) {
      keyMap.set(n.key, { existing });
      continue;
    }
    const prior = proposed.find((p) => normalizeName(p.name) === norm);
    if (prior) {
      keyMap.set(n.key, { key: prior.key });
      continue;
    }
    if (proposed.length >= MAX_NEW_CATEGORIES) continue;
    let key = norm.replace(/\s+/g, "-").slice(0, 40);
    while (proposed.some((p) => p.key === key)) key += "-x";
    const icon = typeof n.icon === "string" && ICON_RE.test(n.icon) ? n.icon : "shape-outline";
    proposed.push({ key, name, parent_id: parentId, icon });
    keyMap.set(n.key, { key });
  }

  const results = Array.isArray(data.results) ? data.results : [];
  for (const r of results) {
    if (!r || !Number.isInteger(r.i) || r.i < 0 || r.i >= count) continue;
    const confidence = CONFIDENCE.has(r.confidence) ? r.confidence : "medium";
    /** @type {Result | null} */
    let res = null;

    if (typeof r.new_category === "string" && keyMap.has(r.new_category)) {
      const m = keyMap.get(r.new_category);
      if ("existing" in m) {
        const c = m.existing;
        res = c.parent_id == null
          ? { category_id: c.id, subcategory_id: null, new_category_key: null, confidence }
          : { category_id: c.parent_id, subcategory_id: c.id, new_category_key: null, confidence };
      } else {
        const p = proposed.find((x) => x.key === m.key);
        res = { category_id: p?.parent_id ?? null, subcategory_id: null, new_category_key: m.key, confidence };
      }
    } else if (typeof r.category_id === "number" && byId.has(r.category_id)) {
      const c = byId.get(r.category_id);
      if (c.parent_id == null) {
        const sub = typeof r.subcategory_id === "number" ? byId.get(r.subcategory_id) : undefined;
        res = {
          category_id: c.id,
          subcategory_id: sub && sub.parent_id === c.id ? sub.id : null,
          new_category_key: null,
          confidence,
        };
      } else if (isParent(c.parent_id)) {
        res = { category_id: c.parent_id, subcategory_id: c.id, new_category_key: null, confidence };
      }
    }
    if (res) out[r.i] = res;
  }
  return out;
}
