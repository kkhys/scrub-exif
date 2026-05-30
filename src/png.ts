import { concat, type StripOutcome } from "./util.js";

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

// Ancillary chunks that carry metadata rather than image data:
//   eXIf — Exif block (can include GPS), same TIFF structure as JPEG APP1
//   tEXt / zTXt / iTXt — textual metadata and XMP
//   tIME — last-modification timestamp
// Structural and color chunks (IHDR, PLTE, iCCP, sRGB, gAMA, cHRM, pHYs,
// IDAT, IEND, ...) are kept untouched so the image decodes identically.
const DROP_CHUNKS = new Set(["eXIf", "tEXt", "zTXt", "iTXt", "tIME"]);

/** True when the buffer starts with the 8-byte PNG signature. */
export const isPng = (data: Uint8Array): boolean =>
  SIGNATURE.every((b, i) => data[i] === b);

/**
 * Removes Exif/text/timestamp chunks from a PNG without re-encoding. Each PNG
 * chunk is self-contained (length + type + data + CRC), so dropping whole
 * metadata chunks leaves every remaining chunk — and its CRC — byte-identical.
 */
export const stripPng = (data: Uint8Array): StripOutcome => {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const chunks: Uint8Array[] = [data.subarray(0, 8)]; // signature
  const removed: string[] = [];
  let i = 8;

  while (i + 8 <= data.length) {
    const dataLen = view.getUint32(i);
    const type = String.fromCharCode(
      data[i + 4] ?? 0,
      data[i + 5] ?? 0,
      data[i + 6] ?? 0,
      data[i + 7] ?? 0,
    );
    const chunkEnd = i + 12 + dataLen; // length(4) + type(4) + data + crc(4)

    if (chunkEnd > data.length) {
      // Malformed/truncated chunk — copy the remainder verbatim and stop.
      chunks.push(data.subarray(i));
      i = data.length;
      break;
    }

    if (DROP_CHUNKS.has(type)) {
      removed.push(type);
    } else {
      chunks.push(data.subarray(i, chunkEnd));
    }
    i = chunkEnd;

    if (type === "IEND") break;
  }

  // Preserve any trailing bytes after IEND (unusual, but never corrupt them).
  if (i < data.length) chunks.push(data.subarray(i));

  return { data: concat(chunks), removed };
};
