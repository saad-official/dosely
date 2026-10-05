/** Profile helpers. */

/**
 * Avatar initial for a profile name: its first character (a whole code point, so an emoji stays
 * intact), upper-cased; `?` for a blank name. Always fits `ProfileSchema.initial` (1–2 UTF-16 units).
 */
export function initialFor(name: string): string {
  const first = Array.from(name.trim())[0];
  if (!first) return "?";
  const upper = first.toUpperCase();
  return upper.length <= 2 ? upper : first;
}
