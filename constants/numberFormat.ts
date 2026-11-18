import type { CompactUnits } from "./currency";

/**
 * Thousands separators for a run of digits. "indian" groups the last three
 * and then pairs (25,22,543); "western" groups in threes (2,522,543).
 * Worklet-safe: no regex, no store access.
 */
export function groupDigits(digits: string, units: CompactUnits = "western"): string {
  "worklet";
  const size = digits.length;
  if (size <= 3) return digits;
  let out = "";
  for (let i = 0; i < size; i++) {
    const fromEnd = size - i;
    const breakHere =
      i > 0 &&
      (units === "indian"
        ? fromEnd === 3 || (fromEnd > 3 && (fromEnd - 3) % 2 === 0)
        : fromEnd % 3 === 0);
    if (breakHere) out += ",";
    out += digits[i];
  }
  return out;
}
