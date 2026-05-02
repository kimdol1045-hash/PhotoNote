/**
 * Filename helpers for `name-N` versioning convention.
 * "photo"     → { base: "photo", suffix: null }
 * "photo-2"   → { base: "photo", suffix: 2 }
 * "photo-x-3" → { base: "photo-x", suffix: 3 }
 */
export function parseVersionedName(name: string): { base: string; suffix: number | null } {
  const m = name.match(/^(.*)-(\d+)$/);
  if (!m) return { base: name, suffix: null };
  return { base: m[1], suffix: Number(m[2]) };
}

export function joinVersionedName(base: string, version: number): string {
  return version === 0 ? base : `${base}-${version}`;
}

/** Removes any trailing `-N` to recover the original base. */
export function rootBaseName(name: string): string {
  return parseVersionedName(name).base;
}

/** Sanitises user input to safe filename characters. */
export function sanitizeName(input: string): string {
  const trimmed = input.trim().replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ');
  return trimmed.slice(0, 60);
}
