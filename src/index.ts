import { isJpeg, stripJpeg } from "./jpeg.js";
import { isPng, stripPng } from "./png.js";
import type { StripOutcome } from "./util.js";

export type { StripOutcome } from "./util.js";
export { isJpeg, stripJpeg } from "./jpeg.js";
export { isPng, stripPng } from "./png.js";

export type ImageFormat = "jpeg" | "png" | "unknown";

export interface StripResult extends StripOutcome {
  /** Detected input format. */
  format: ImageFormat;
  /** Whether any metadata was removed. */
  changed: boolean;
}

/** Detect the image format from its magic bytes. */
export const detectFormat = (data: Uint8Array): ImageFormat => {
  if (isJpeg(data)) return "jpeg";
  if (isPng(data)) return "png";
  return "unknown";
};

/**
 * Losslessly strip Exif/GPS/XMP/IPTC metadata from a JPEG or PNG buffer.
 *
 * Unknown formats are returned unchanged with `format: "unknown"`. The pixel
 * data is never re-encoded, so the operation is byte-for-byte lossless.
 */
export const stripExif = (data: Uint8Array): StripResult => {
  const format = detectFormat(data);
  const outcome: StripOutcome =
    format === "jpeg"
      ? stripJpeg(data)
      : format === "png"
        ? stripPng(data)
        : { data, removed: [] };
  return { ...outcome, format, changed: outcome.removed.length > 0 };
};
