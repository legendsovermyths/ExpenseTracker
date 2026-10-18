// Shared matching for in-memory search boxes: case- and accent-insensitive,
// word order doesn't matter, and every word must appear in some field.
// ("dominos pizza" finds "Pizza from Domino's"; "₹1,200" or "$1,200" finds 1200.)

const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[₹$€£¥₩฿₱৳₦₽₺,']/g, "");

export const searchTokens = (query: string): string[] =>
  normalize(query).split(/\s+/).filter(Boolean);

/** True when every word in `query` appears in at least one of `fields`. */
export const matchesSearch = (
  query: string,
  ...fields: Array<string | number | null | undefined>
): boolean => {
  const tokens = searchTokens(query);
  if (tokens.length === 0) return true;
  const haystack = fields
    .filter((f) => f !== null && f !== undefined && f !== "")
    .map((f) => normalize(String(f)))
    .join(" ");
  return tokens.every((t) => haystack.includes(t));
};
