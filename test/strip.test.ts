import { describe, expect, it } from "vitest";
import { detectFormat, stripExif } from "../src/index.js";
import { stripJpeg } from "../src/jpeg.js";
import { stripPng } from "../src/png.js";
import {
  buildJpeg,
  buildPng,
  fakeExifPayload,
  fakeTiffExif,
  jpegSegment,
  pngChunk,
} from "./helpers.js";

const hasBytes = (haystack: Uint8Array, needle: string): boolean =>
  Buffer.from(haystack).includes(needle);

describe("stripJpeg", () => {
  it("removes APP1 (Exif/GPS) and APP13 (IPTC) and is byte-for-byte lossless", () => {
    const clean = buildJpeg();
    const dirty = buildJpeg([
      jpegSegment(0xe1, fakeExifPayload()), // APP1 Exif w/ GPS
      jpegSegment(0xed, new Uint8Array([1, 2, 3, 4])), // APP13 IPTC
    ]);

    expect(hasBytes(dirty, "FAKE_GPS")).toBe(true);

    const { data, removed } = stripJpeg(dirty);

    expect(removed).toEqual(["APP1", "APP13"]);
    // Round-trip equality proves no other byte (incl. scan data) was touched.
    expect(data).toEqual(clean);
    expect(hasBytes(data, "FAKE_GPS")).toBe(false);
  });

  it("removes COM comment segments", () => {
    const clean = buildJpeg();
    const dirty = buildJpeg([jpegSegment(0xfe, fakeExifPayload())]);
    const { data, removed } = stripJpeg(dirty);
    expect(removed).toEqual(["COM"]);
    expect(data).toEqual(clean);
  });

  it("removes multiple APP1 segments (Exif + XMP)", () => {
    const clean = buildJpeg();
    const dirty = buildJpeg([
      jpegSegment(0xe1, fakeExifPayload()),
      jpegSegment(0xe1, new Uint8Array([0x68, 0x74, 0x74, 0x70])), // 'http' (XMP)
    ]);
    const { data, removed } = stripJpeg(dirty);
    expect(removed).toEqual(["APP1", "APP1"]);
    expect(data).toEqual(clean);
  });

  it("keeps color-related segments (APP0/APP2/APP14)", () => {
    const withColor = buildJpeg([
      jpegSegment(0xe2, new Uint8Array([0x49, 0x43, 0x43])), // APP2 ICC
      jpegSegment(0xe1, fakeExifPayload()), // APP1 to drop
      jpegSegment(0xee, new Uint8Array([0x41, 0x64, 0x6f, 0x62, 0x65])), // APP14 Adobe
    ]);
    const { data, removed } = stripJpeg(withColor);
    expect(removed).toEqual(["APP1"]);
    expect(hasBytes(data, "ICC")).toBe(true); // APP2 preserved
    expect(hasBytes(data, "Adobe")).toBe(true); // APP14 preserved
  });

  it("is idempotent: a clean image is unchanged", () => {
    const clean = buildJpeg();
    const { data, removed } = stripJpeg(clean);
    expect(removed).toEqual([]);
    expect(data).toEqual(clean);
  });
});

describe("stripPng", () => {
  it("removes eXIf and text chunks and is byte-for-byte lossless", () => {
    const clean = buildPng();
    const dirty = buildPng([
      pngChunk("eXIf", fakeTiffExif()),
      pngChunk("tEXt", new Uint8Array([0x68, 0x69])), // 'hi'
      pngChunk("iTXt", new Uint8Array([0x78, 0x6d, 0x70])), // 'xmp'
    ]);

    expect(hasBytes(dirty, "FAKE_GPS")).toBe(true);

    const { data, removed } = stripPng(dirty);

    expect(removed).toEqual(["eXIf", "tEXt", "iTXt"]);
    expect(data).toEqual(clean); // IHDR/IDAT/IEND + CRCs untouched
    expect(hasBytes(data, "FAKE_GPS")).toBe(false);
  });

  it("removes tIME and zTXt chunks", () => {
    const clean = buildPng();
    const dirty = buildPng([
      pngChunk("tIME", new Uint8Array([0x07, 0xe9, 1, 1, 0, 0, 0])),
      pngChunk("zTXt", new Uint8Array([0x78, 0x9c])),
    ]);
    const { data, removed } = stripPng(dirty);
    expect(removed).toEqual(["tIME", "zTXt"]);
    expect(data).toEqual(clean);
  });

  it("is idempotent: a clean image is unchanged", () => {
    const clean = buildPng();
    const { data, removed } = stripPng(clean);
    expect(removed).toEqual([]);
    expect(data).toEqual(clean);
  });
});

describe("stripExif (dispatcher)", () => {
  it("detects formats from magic bytes", () => {
    expect(detectFormat(buildJpeg())).toBe("jpeg");
    expect(detectFormat(buildPng())).toBe("png");
    expect(detectFormat(new Uint8Array([1, 2, 3, 4]))).toBe("unknown");
  });

  it("returns unknown input unchanged", () => {
    const input = new Uint8Array([1, 2, 3, 4, 5]);
    const result = stripExif(input);
    expect(result.format).toBe("unknown");
    expect(result.changed).toBe(false);
    expect(result.data).toEqual(input);
  });

  it("reports changed=true and the removed labels for JPEG", () => {
    const result = stripExif(buildJpeg([jpegSegment(0xe1, fakeExifPayload())]));
    expect(result.format).toBe("jpeg");
    expect(result.changed).toBe(true);
    expect(result.removed).toEqual(["APP1"]);
  });

  it("reports changed=false for a clean PNG", () => {
    const result = stripExif(buildPng());
    expect(result.format).toBe("png");
    expect(result.changed).toBe(false);
    expect(result.removed).toEqual([]);
  });
});
