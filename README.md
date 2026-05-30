# scrub-exif

[![npm version](https://img.shields.io/npm/v/scrub-exif.svg)](https://www.npmjs.com/package/scrub-exif)
[![CI](https://github.com/kkhys/scrub-exif/actions/workflows/ci.yml/badge.svg)](https://github.com/kkhys/scrub-exif/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/scrub-exif.svg)](./LICENSE)

Losslessly strip Exif/GPS and all other metadata from JPEG and PNG files, keeping only the color profile.

- **Lossless** — pixel data is never re-encoded. Only metadata segments/chunks are removed; every remaining byte (including color profiles) is preserved.
- **Zero dependencies** — nothing is installed alongside it.
- **No native binaries** — pure TypeScript/JavaScript. No `exiftool`, no `sharp`, no platform builds. Runs anywhere Node does (and in Bun/Deno).

## Why

Photos carry hidden metadata — most importantly **GPS coordinates** that can reveal your home address. Common tools have trade-offs:

| Tool | Strips metadata | Lossless | No native binary |
| --- | --- | --- | --- |
| `exiftool` | ✅ everything | ✅ | ❌ (Perl binary) |
| `sharp` | ✅ on re-encode | ❌ recompresses | ❌ (native) |
| **scrub-exif** | ✅ all but ICC profile | ✅ | ✅ |

`scrub-exif` removes every metadata block — Exif/GPS, XMP, IPTC, vendor and
comment segments — while keeping the ICC color profile and leaving the
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

## Use as a pre-commit hook (lefthook)

Strip metadata automatically every time images are committed. Install
`scrub-exif` as a dev dependency and add a command to your
[lefthook](https://lefthook.dev) config:

```yaml
# lefthook.yml
pre-commit:
  commands:
    scrub-exif:
      glob: "*.{jpg,jpeg,png,JPG,JPEG,PNG}"
      run: npx scrub-exif {staged_files}
      stage_fixed: true
```

`stage_fixed: true` re-stages the cleaned files, so the commit always lands
without metadata. `{staged_files}` passes only the staged images matching the
glob, keeping the hook fast.

> With pnpm/Yarn you can swap `npx` for `pnpm exec` / `yarn`. The hook activates
> after `lefthook install` runs (e.g. via a `prepare` script on install).

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
| JPEG | `APP1` (Exif/GPS, XMP), `APP13` (IPTC/Photoshop), every other `APPn` vendor segment, `COM` (comments) | `APP0` (JFIF), `APP2` (ICC profile), `APP14` (Adobe), and all image data |
| PNG | `eXIf`, `tEXt`, `zTXt`, `iTXt` (XMP), `tIME` | `IHDR`, `PLTE`, `iCCP`, `sRGB`, `gAMA`, `cHRM`, `pHYs`, `IDAT`, `IEND`, … |

Unknown formats are returned unchanged.

## License

MIT © kkhys
