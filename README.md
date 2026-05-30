# scrub-exif

Losslessly strip Exif/GPS/XMP/IPTC metadata from JPEG and PNG files.

- **Lossless** — pixel data is never re-encoded. Only metadata segments/chunks are removed; every remaining byte (including color profiles) is preserved.
- **Zero dependencies** — nothing is installed alongside it.
- **No native binaries** — pure TypeScript/JavaScript. No `exiftool`, no `sharp`, no platform builds. Runs anywhere Node does (and in Bun/Deno).

## Why

Photos carry hidden metadata — most importantly **GPS coordinates** that can reveal your home address. Common tools have trade-offs:

| Tool | Strips metadata | Lossless | No native binary |
| --- | --- | --- | --- |
| `exiftool` | ✅ everything | ✅ | ❌ (Perl binary) |
| `sharp` | ✅ on re-encode | ❌ recompresses | ❌ (native) |
| **scrub-exif** | ✅ Exif/GPS/XMP/IPTC | ✅ | ✅ |

`scrub-exif` removes the metadata that matters for privacy while leaving the
compressed image data byte-for-byte intact.

## Install

```sh
npm install scrub-exif
# or run without installing:
npx scrub-exif <files|dirs...>
```

## CLI

```sh
scrub-exif photo.jpg                # strip a single file in place
scrub-exif ./images                 # recurse a directory (.jpg/.jpeg/.png)
scrub-exif ./images --dry-run       # show what would be removed, write nothing
scrub-exif . --check                # exit 1 if any file still has metadata
scrub-exif ./images --quiet         # only print changed files + summary
```

`--check` makes a great CI gate or pre-commit hook: it never writes and fails
when metadata is still present.

```
[strip] images/beach.jpg removed=[APP1, APP13] (-29953 bytes)
[clean] images/logo.png
[skip ] images/notes.txt

1/3 files stripped (-29953 bytes).
```

## Programmatic API

```ts
import { readFile, writeFile } from "node:fs/promises";
import { stripExif } from "scrub-exif";

const input = new Uint8Array(await readFile("photo.jpg"));
const result = stripExif(input);

result.format; // "jpeg" | "png" | "unknown"
result.removed; // e.g. ["APP1", "APP13"]
result.changed; // true if any metadata was removed

if (result.changed) {
  await writeFile("photo.jpg", result.data);
}
```

Lower-level, format-specific functions are also exported:

```ts
import { stripJpeg, stripPng, isJpeg, isPng, detectFormat } from "scrub-exif";
```

## What gets removed

| Format | Removed | Kept |
| --- | --- | --- |
| JPEG | `APP1` (Exif/GPS, XMP), `APP13` (IPTC/Photoshop), `COM` (comments) | `APP0` (JFIF), `APP2` (ICC profile), `APP14` (Adobe), and all image data |
| PNG | `eXIf`, `tEXt`, `zTXt`, `iTXt` (XMP), `tIME` | `IHDR`, `PLTE`, `iCCP`, `sRGB`, `gAMA`, `cHRM`, `pHYs`, `IDAT`, `IEND`, … |

Unknown formats are returned unchanged.

## License

MIT © kkhys
