#!/usr/bin/env node
import { readFile, readdir, stat, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { stripExif } from "./index.js";

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png"]);

interface Options {
  dryRun: boolean;
  check: boolean;
  quiet: boolean;
}

const HELP = `scrub-exif — losslessly strip Exif/GPS/XMP/IPTC metadata from JPEG & PNG

Usage:
  scrub-exif <files|dirs...> [options]

Options:
  --dry-run   Report what would be removed without writing files
  --check     Exit non-zero if any file still contains metadata (no writes)
  --quiet     Only print files that changed and the summary
  -h, --help  Show this help
  -v, --version  Show version

Examples:
  scrub-exif photo.jpg
  scrub-exif ./images --dry-run
  scrub-exif . --check        # CI gate: fail if metadata is present
`;

const readVersion = async (): Promise<string> => {
  const pkg = JSON.parse(
    await readFile(new URL("../package.json", import.meta.url), "utf8"),
  );
  return pkg.version ?? "0.0.0";
};

/** Recursively collect image file paths from the given files and directories. */
const collect = async (paths: string[]): Promise<string[]> => {
  const out: string[] = [];
  for (const p of paths) {
    const info = await stat(p);
    if (info.isDirectory()) {
      const entries = await readdir(p);
      out.push(...(await collect(entries.map((e) => join(p, e)))));
    } else if (IMAGE_EXTENSIONS.has(extname(p).toLowerCase())) {
      out.push(p);
    }
  }
  return out.sort();
};

const run = async (): Promise<number> => {
  const argv = process.argv.slice(2);

  if (argv.includes("-h") || argv.includes("--help")) {
    process.stdout.write(HELP);
    return 0;
  }
  if (argv.includes("-v") || argv.includes("--version")) {
    process.stdout.write(`${await readVersion()}\n`);
    return 0;
  }

  const options: Options = {
    dryRun: argv.includes("--dry-run"),
    check: argv.includes("--check"),
    quiet: argv.includes("--quiet"),
  };
  const inputs = argv.filter((a) => !a.startsWith("-"));

  if (inputs.length === 0) {
    process.stderr.write("error: no files or directories given\n\n");
    process.stdout.write(HELP);
    return 2;
  }

  const files = await collect(inputs);
  let changed = 0;
  let savedBytes = 0;

  for (const path of files) {
    const data = new Uint8Array(await readFile(path));
    const result = stripExif(data);

    if (result.format === "unknown") {
      if (!options.quiet) process.stdout.write(`[skip ] ${path}\n`);
      continue;
    }
    if (!result.changed) {
      if (!options.quiet) process.stdout.write(`[clean] ${path}\n`);
      continue;
    }

    const diff = data.length - result.data.length;
    savedBytes += diff;
    changed++;
    const note = options.check ? "" : options.dryRun ? " (dry-run)" : "";
    process.stdout.write(
      `[strip] ${path} removed=[${result.removed.join(", ")}] (-${diff} bytes)${note}\n`,
    );

    if (!options.dryRun && !options.check) {
      await writeFile(path, result.data);
    }
  }

  const verb = options.dryRun || options.check ? "would be" : "";
  process.stdout.write(
    `\n${changed}/${files.length} files ${verb} stripped (-${savedBytes} bytes).\n`,
  );

  // In --check mode, a non-zero exit signals "metadata still present".
  return options.check && changed > 0 ? 1 : 0;
};

run().then(
  (code) => process.exit(code),
  (err) => {
    process.stderr.write(`scrub-exif: ${err?.message ?? err}\n`);
    process.exit(1);
  },
);
