import { concat, type StripOutcome } from "./util.js";

const SOI = 0xd8; // Start of image
const EOI = 0xd9; // End of image
const SOS = 0xda; // Start of scan (entropy-coded data follows)

// Segments that hold metadata, not pixel data:
//   APP1  (0xE1) — Exif (including GPS) and XMP
//   APP13 (0xED) — IPTC / Photoshop resources
//   COM   (0xFE) — free-form comment
// Everything else, including APP0 (JFIF), APP2 (ICC color profile) and
// APP14 (Adobe), is preserved so the image decodes identically.
const DROP_MARKERS = new Set([0xe1, 0xed]);
const COM_MARKER = 0xfe;

/** True when the buffer starts with the JPEG SOI marker. */
export const isJpeg = (data: Uint8Array): boolean =>
  data[0] === 0xff && data[1] === SOI;

const label = (marker: number): string =>
  marker >= 0xe0 && marker <= 0xef
    ? `APP${marker - 0xe0}`
    : marker === COM_MARKER
      ? "COM"
      : `0x${marker.toString(16)}`;

/**
 * Removes Exif/XMP/IPTC/comment segments from a JPEG without re-encoding.
 * Only whole marker segments are dropped; all other bytes — including the
 * entropy-coded scan data — are copied verbatim, so the result is lossless.
 */
export const stripJpeg = (data: Uint8Array): StripOutcome => {
  const chunks: Uint8Array[] = [data.subarray(0, 2)]; // SOI
  const removed: string[] = [];
  let i = 2;

  while (i < data.length) {
    if (data[i] !== 0xff) {
      // Not a marker boundary — copy the rest verbatim and stop.
      chunks.push(data.subarray(i));
      break;
    }
    const marker = data[i + 1];
    if (marker === undefined) {
      // Truncated marker at end of file — copy the rest verbatim and stop.
      chunks.push(data.subarray(i));
      break;
    }

    // Start of scan: the remaining bytes are entropy-coded image data.
    if (marker === SOS) {
      chunks.push(data.subarray(i));
      break;
    }

    // Standalone markers without a length field.
    if (marker === EOI || (marker >= 0xd0 && marker <= 0xd7)) {
      chunks.push(data.subarray(i, i + 2));
      i += 2;
      continue;
    }

    const segLen = ((data[i + 2] ?? 0) << 8) | (data[i + 3] ?? 0);
    const segEnd = i + 2 + segLen;

    if (DROP_MARKERS.has(marker) || marker === COM_MARKER) {
      removed.push(label(marker));
    } else {
      chunks.push(data.subarray(i, segEnd));
    }
    i = segEnd;
  }

  return { data: concat(chunks), removed };
};
