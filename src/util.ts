/** Concatenate byte chunks into a single Uint8Array. */
export const concat = (parts: Uint8Array[]): Uint8Array => {
  let total = 0;
  for (const p of parts) total += p.length;
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
};

/** Outcome of stripping a single image buffer. */
export interface StripOutcome {
  /** The image bytes with metadata segments removed. */
  data: Uint8Array;
  /** Labels of the removed segments/chunks (e.g. "APP1", "eXIf"). */
  removed: string[];
}
