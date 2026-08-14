/**
 * Meta frequently repeats the same phrase across error fields with inconsistent
 * casing (e.g. "Message undeliverable" / "Message Undeliverable"), which a plain
 * exact-match Set doesn't dedupe. Case-insensitive, keeps the first casing seen.
 */
export function dedupeCaseInsensitive(parts: (string | undefined)[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const part of parts) {
    if (!part) continue;
    const key = part.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(part);
  }
  return result;
}
